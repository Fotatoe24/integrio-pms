'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [result, setResult] = useState<string>('Testing...')

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase.from('User').select('count')
      if (error) {
        setResult('FAILED: ' + error.message)
      } else {
        setResult('CONNECTED! Data: ' + JSON.stringify(data))
      }
    }
    test()
  }, [])

  return (
    <div style={{ padding: 32, color: 'white', background: '#0c0e12', minHeight: '100vh' }}>
      <h1>DB Test</h1>
      <p>{result}</p>
    </div>
  )
}