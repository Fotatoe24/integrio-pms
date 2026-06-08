'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export default function SetupPage() {
  const [status, setStatus] = useState('')

  async function createAdmin() {
    setStatus('Creating admin...')
    const hashed = await bcrypt.hash('admin123', 12)

    const { data, error } = await supabase
      .from('User')
      .insert({ 
        email: 'integrio.business@gmail.com', 
        password: hashed, 
        name: 'Admin', 
        role: 'ADMIN' 
      })
      .select()
      .single()

    if (error) {
      setStatus('Error: ' + error.message)
    } else {
      setStatus('Admin created! ' + JSON.stringify(data))
    }
  }

  return (
    <div style={{ padding: 32, color: 'white', background: '#0c0e12', minHeight: '100vh' }}>
      <h1>Setup</h1>
      <button onClick={createAdmin} style={{ padding: '12px 24px', marginTop: 16, cursor: 'pointer' }}>
        Create Admin User
      </button>
      <p style={{ marginTop: 16 }}>{status}</p>
    </div>
  )
}