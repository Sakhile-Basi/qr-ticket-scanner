'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    if (!name.trim()) return setError('Please enter your name')
    if (!password.trim()) return setError('Please enter the password')
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, name }),
    })

    if (res.ok) {
      router.push('/admin/dashboard')
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 shadow-xl flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your details to continue</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Sakhile"
              className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Password"
              className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg py-3 font-semibold transition-colors"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </div>
      </div>
    </main>
  )
}