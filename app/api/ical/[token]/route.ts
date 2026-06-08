import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: property } = await supabaseAdmin
    .from('Property')
    .select('id, name')
    .eq('ourIcalToken', token)
    .single()

  if (!property) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: bookings } = await supabaseAdmin
    .from('Booking')
    .select('*')
    .eq('propertyId', property.id)
    .not('status', 'eq', 'CANCELLED')

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events = (bookings || []).map(b => `BEGIN:VEVENT
UID:${b.id}@integrio
DTSTART:${formatDate(b.checkIn)}
DTEND:${formatDate(b.checkOut)}
SUMMARY:${b.guestName}
STATUS:CONFIRMED
END:VEVENT`).join('\n')

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Integrio PMS//EN
CALNAME:${property.name}
${events}
END:VCALENDAR`

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${property.name}.ics"`,
    },
  })
}