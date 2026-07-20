import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { hashPassword, verifyToken, createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    const { newPassword } = await req.json()
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const hashed = await hashPassword(newPassword)

    const { error } = await supabaseAdmin
      .from('User')
      .update({ password: hashed, mustChangePassword: false })
      .eq('id', payload.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Re-issue the token so mustChangePassword=false is reflected
    // immediately, without forcing the person to log in again.
    const freshToken = await createToken({ ...payload, mustChangePassword: false })

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
