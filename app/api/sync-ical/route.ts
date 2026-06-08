import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { propertyId, airbnbIcalUrl } = await req.json()

    if (!airbnbIcalUrl) {
      return NextResponse.json({ error: 'No iCal URL provided' }, { status: 400 })
    }

    // Fetch iCal from Airbnb server-side (no CORS issues)
    const res = await fetch(airbnbIcalUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch iCal from Airbnb' }, { status: 400 })
    }

    const icsText = await res.text()
    const events = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []

    let imported = 0
    let skipped = 0

    for (const event of events) {
      const uid = event.match(/UID:(.*)/)?.[1]?.trim()
      const dtstart = event.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim()
      const dtend = event.match(/DTEND[^:]*:(.*)/)?.[1]?.trim()
      const summary = event.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Airbnb Guest'

      if (!uid || !dtstart || !dtend) continue

      const isBlock = summary.toLowerCase().includes('not available') ||
                      summary.toLowerCase().includes('blocked')

      const { data: existing } = await supabaseAdmin
        .from('Booking')
        .select('id')
        .eq('externalUid', uid)
        .single()

      if (existing) { skipped++; continue }

      const parseIcalDate = (d: string) => {
        const clean = d.replace(/T\d+Z?$/, '')
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
      }

      const { error } = await supabaseAdmin.from('Booking').insert({
        propertyId,
        guestName: isBlock ? 'Blocked' : summary,
        checkIn: new Date(parseIcalDate(dtstart)).toISOString(),
        checkOut: new Date(parseIcalDate(dtend)).toISOString(),
        status: isBlock ? 'CANCELLED' : 'CONFIRMED',
        source: 'AIRBNB',
        externalUid: uid,
        guestCount: 1,
        notes: isBlock ? 'Auto-blocked from Airbnb calendar' : null,
      })

      if (!error) imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: events.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}