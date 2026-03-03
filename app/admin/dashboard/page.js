'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTickets()

    const channel = supabase
      .channel('tickets-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTickets(prev => [payload.new, ...prev])
        }
        if (payload.eventType === 'UPDATE') {
          setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new : t))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
     setTickets(data || [])
     setLoading(false)
  }

  const total = tickets.length
  const checkedIn = tickets.filter(t => t.scanned).length
  const remaining = total - checkedIn
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-4">
      <a
      href="/scan"
      className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
    >
      Scanner

    </a>
          <a
            href="/admin/generate"
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + New Ticket
          </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-1">
            <p className="text-gray-400 text-sm">Total Tickets</p>
            <p className="text-4xl font-bold">{total}</p>
          </div>
          <div className="bg-green-900 rounded-2xl p-6 flex flex-col gap-1">
            <p className="text-green-300 text-sm">Checked In</p>
            <p className="text-4xl font-bold">{checkedIn}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-1">
            <p className="text-gray-400 text-sm">Remaining</p>
            <p className="text-4xl font-bold">{remaining}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <p className="text-gray-400">Check-in Progress</p>
            <p className="font-semibold">{percentage}%</p>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Attendee list */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Attendees</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No tickets yet</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {tickets.map(ticket => (
                <div key={ticket.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{ticket.attendee_name}</p>
                    <p className="text-gray-400 text-sm">{ticket.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${ticket.scanned ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                      {ticket.scanned ? 'Checked In' : 'Not Yet'}
                    </span>
                    {ticket.scanned_at && (
                      <p className="text-gray-500 text-xs">
                        {new Date(ticket.scanned_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}