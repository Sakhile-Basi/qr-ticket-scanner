'use client'

import { useState, useRef } from 'react'
import QRCode from 'qrcode'

export default function GeneratePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [ticket, setTicket] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)

  const handleGenerate = async () => {
    if (!name.trim()) return setError('Attendee name is required')
    setLoading(true)
    setError(null)

    const res = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendee_name: name, email }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    const qr = await QRCode.toDataURL(data.ticket.ticket_code, { width: 300 })
    setTicket(data.ticket)
    setQrDataUrl(qr)
    setLoading(false)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `ticket-${ticket.attendee_name}.png`
    link.click()
  }

  const handleReset = () => {
    setName('')
    setEmail('')
    setTicket(null)
    setQrDataUrl(null)
    setError(null)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Generate Ticket</h1>

        {!ticket ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Firstname Lastname"
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Email or Phone</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. example@email.com or 082..."
                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg py-3 font-semibold transition-colors"
            >
              {loading ? 'Generating...' : 'Generate Ticket'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="bg-white p-4 rounded-xl">
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">{ticket.attendee_name}</p>
              <p className="text-gray-400 text-sm">{ticket.email}</p>
              <p className="text-gray-500 text-xs mt-1 font-mono">{ticket.ticket_code}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleDownload}
                className="flex-1 bg-green-600 hover:bg-green-500 rounded-lg py-3 font-semibold transition-colors"
              >
                Download QR
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-700 hover:bg-gray-600 rounded-lg py-3 font-semibold transition-colors"
              >
                New Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}