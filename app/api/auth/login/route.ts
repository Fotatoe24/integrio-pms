import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyPassword, createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Accept either an email or a username in the same field, since
    // Evangelina logs in by username and Integrio historically used email.
    const identifier = email.toLowerCase().trim()
    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('*')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.active === false) {
      return NextResponse.json({ error: 'This account has been deactivated' }, { status: 403 })
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await createToken({
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      name: user.name,
      role: user.role,
      avatarColor: user.avatarColor,
      mustChangePassword: !!user.mustChangePassword,
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatarColor: user.avatarColor,
        mustChangePassword: !!user.mustChangePassword,
      },
    })

    response.cookies.set('auth-token', token, {
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
