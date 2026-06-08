import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()
  const hashed = await hashPassword(password)

  const { data, error } = await supabaseAdmin
    .from('User')
    .insert({ email: email.toLowerCase(), password: hashed, name, role: 'ADMIN' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, user: data })
}