'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function ScanPage() {
  const [result, setResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef(null)
  const isProcessing = useRef(false)

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startScanner = async () => {
    setResult(null)
    setScanning(true)

    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (isProcessing.current) return
        isProcessing.current = true

        await scanner.stop()
        setScanning(false)
        setLoading(true)

        const res = await fetch('/api/tickets/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_code: decodedText }),
        })

        const data = await res.json()
        setResult(data)
        setLoading(false)
        isProcessing.current = false
      },
      () => {}
    )
  }

  const handleReset = () => {
    setResult(null)
    setScanning(false)
  }

  const bgColor = result
    ? result.valid
      ? 'bg-green-900'
      : 'bg-red-900'
    : 'bg-gray-950'

  return (
    <main className={`min-h-screen ${bgColor} text-white flex flex-col items-center justify-center p-8 transition-colors duration-500`}>
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">Ticket Scanner</h1>

        {!scanning && !result && !loading && (
          <button
            onClick={startScanner}
            className="w-full bg-green-600 hover:bg-green-500 rounded-xl py-4 text-lg font-semibold transition-colors"
          >
            Start Scanning
          </button>
        )}

        <div id="qr-reader" className={`w-full rounded-xl overflow-hidden ${scanning ? 'block' : 'hidden'}`} />

        {loading && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300">Validating ticket...</p>
          </div>
        )}

        {result && (
          <div className="w-full flex flex-col items-center gap-4 text-center">
            <div className="text-6xl">
              {result.valid ? '✅' : '❌'}
            </div>
            <p className="text-2xl font-bold">{result.message}</p>
            {result.ticket && (
              <div className="bg-white/10 rounded-xl p-4 w-full">
                <p className="text-xl font-semibold">{result.ticket.attendee_name}</p>
                <p className="text-gray-300 text-sm">{result.ticket.email}</p>
              </div>
            )}
            <button
              onClick={handleReset}
              className="w-full bg-white text-gray-900 hover:bg-gray-100 rounded-xl py-3 font-semibold transition-colors"
            >
              Scan Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}