'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'

export default function AttendeesPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()

    const eventId = params.eventId

    const [event, setEvent] = useState(null)
    const [tickets, setTickets] = useState([])
    const [search, setSearch] = useState('')

    const [showAddForm, setShowAddForm] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const [selectedTicket, setSelectedTicket] = useState(null)
    const [ticketImageUrl, setTicketImageUrl] = useState(null)
    const [generatingTicket, setGeneratingTicket] = useState(false)

    useEffect(() => {
        loadPage()
    }, [eventId])

    const loadPage = async () => {
        setLoading(true)
        setError(null)

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            router.push('/admin/login')
            return
        }

        const { data: membership, error: membershipError } = await supabase
            .from('event_members')
            .select('id, role')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .single()

        if (membershipError || !membership) {
            setError('You do not have access to this event.')
            setLoading(false)
            return
        }

        const { data: eventData, error: eventError } = await supabase
           .from('events')
           .select('id, name, status, poster_url')
            .eq('id', eventId)
            .single()

        if (eventError) {
            setError('Unable to load event.')
            setLoading(false)
            return
        }

        setEvent(eventData)

        const { data: ticketData, error: ticketError } = await supabase
            .from('tickets')
            .select(`
                id,
                event_id,
                ticket_code,
                attendee_name,
                attendee_email,
                status,
                created_at
            `)
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })

        if (ticketError) {
            setError('Unable to load attendees.')
            setLoading(false)
            return
        }

        setTickets(ticketData || [])
        setLoading(false)
    }

    const handleAddAttendee = async () => {
        if (!name.trim()) {
            setError('Attendee name is required.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            const response = await fetch('/api/tickets/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_id: eventId,
                    attendee_name: name,
                    attendee_email: email,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Unable to create ticket.')
                setSaving(false)
                return
            }

            setTickets((currentTickets) => [
                data.ticket,
                ...currentTickets,
            ])

            setName('')
            setEmail('')
            setShowAddForm(false)
            setSaving(false)
        } catch (error) {
            setError('Something went wrong while creating the ticket.')
            setSaving(false)
        }
    }

    const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const image = new Image()

        image.crossOrigin = 'anonymous'

        image.onload = () => resolve(image)
        image.onerror = reject

        image.src = src
    })
}

   const handleShowTicket = async (ticket) => {
    try {
        setGeneratingTicket(true)
        setError(null)

        const canvas = document.createElement('canvas')

        canvas.width = 1080
        canvas.height = 1350

        const ctx = canvas.getContext('2d')

        // Main ticket background
        ctx.fillStyle = '#111827'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // ------------------------------------------------
        // Event poster
        // ------------------------------------------------

        if (event.poster_url) {
            const poster = await loadImage(event.poster_url)

            const posterHeight = 540

            const imageRatio = poster.width / poster.height
            const targetRatio = canvas.width / posterHeight

            let sourceWidth = poster.width
            let sourceHeight = poster.height
            let sourceX = 0
            let sourceY = 0

            if (imageRatio > targetRatio) {
                sourceWidth = poster.height * targetRatio
                sourceX = (poster.width - sourceWidth) / 2
            } else {
                sourceHeight = poster.width / targetRatio
                sourceY = (poster.height - sourceHeight) / 2
            }

            ctx.drawImage(
                poster,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                canvas.width,
                posterHeight
            )

            // Dark overlay so event name stays readable
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
            ctx.fillRect(0, 0, canvas.width, posterHeight)
        } else {
            ctx.fillStyle = '#1f2937'
            ctx.fillRect(0, 0, canvas.width, 540)
        }

        // ------------------------------------------------
        // Event name
        // ------------------------------------------------

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 60px Arial'
        ctx.textAlign = 'center'

        ctx.fillText(
            event.name,
            canvas.width / 2,
            450,
            900
        )

        // ------------------------------------------------
        // Attendee section
        // ------------------------------------------------

        ctx.fillStyle = '#9ca3af'
        ctx.font = '28px Arial'

        ctx.fillText(
            'ADMIT ONE',
            canvas.width / 2,
            610
        )

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 48px Arial'

        ctx.fillText(
            ticket.attendee_name,
            canvas.width / 2,
            675,
            900
        )

        // ------------------------------------------------
        // QR code
        // ------------------------------------------------

        const qrDataUrl = await QRCode.toDataURL(
            ticket.ticket_code,
            {
                width: 400,
                margin: 2,
                errorCorrectionLevel: 'H',
            }
        )

        const qrImage = await loadImage(qrDataUrl)

        const qrSize = 400
        const qrX = (canvas.width - qrSize) / 2
        const qrY = 735

        // QR white backing
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(
            qrX - 20,
            qrY - 20,
            qrSize + 40,
            qrSize + 40
        )

        ctx.drawImage(
            qrImage,
            qrX,
            qrY,
            qrSize,
            qrSize
        )

        // ------------------------------------------------
        // Ticket reference
        // ------------------------------------------------

        ctx.fillStyle = '#9ca3af'
        ctx.font = '22px monospace'

        ctx.fillText(
            `Ticket: ${ticket.ticket_code}`,
            canvas.width / 2,
            1230,
            900
        )

        ctx.font = '20px Arial'

        ctx.fillText(
            'Present this QR code at the entrance',
            canvas.width / 2,
            1285
        )

        // ------------------------------------------------
        // Convert canvas to PNG
        // ------------------------------------------------

        const finalTicket = canvas.toDataURL('image/png')

        setSelectedTicket(ticket)
        setTicketImageUrl(finalTicket)

    } catch (error) {
        console.error(error)

        setError('Unable to generate ticket.')
    } finally {
        setGeneratingTicket(false)
    }
}

    const handleDownloadTicket = () => {
    if (!ticketImageUrl || !selectedTicket) return

    const safeName = selectedTicket.attendee_name
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()

    const link = document.createElement('a')

    link.href = ticketImageUrl
    link.download = `${event.name}-${safeName}-ticket.png`

    link.click()
}

    const filteredTickets = tickets.filter((ticket) => {
        const searchTerm = search.toLowerCase()

        return (
            ticket.attendee_name?.toLowerCase().includes(searchTerm) ||
            ticket.attendee_email?.toLowerCase().includes(searchTerm) ||
            ticket.ticket_code?.toLowerCase().includes(searchTerm)
        )
    })

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-gray-400">Loading attendees...</p>
            </main>
        )
    }

    if (error && !event) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>

                    <button
                        onClick={() => router.push(`/admin/events/${eventId}`)}
                        className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-lg"
                    >
                        Back to Event
                    </button>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">

            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

                    <div>
                        <button
                            onClick={() => router.push(`/admin/events/${eventId}`)}
                            className="text-gray-400 hover:text-white text-sm mb-3"
                        >
                            ← Back to Event
                        </button>

                        <h1 className="text-3xl font-bold">
                            Attendees
                        </h1>

                        <p className="text-gray-400 mt-1">
                            {event?.name}
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setShowAddForm(!showAddForm)
                            setError(null)
                        }}
                        className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-lg font-semibold"
                    >
                        {showAddForm ? 'Cancel' : '+ Add Attendee'}
                    </button>

                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-900/40 border border-red-800 text-red-300 rounded-lg p-4 mb-6">
                        {error}
                    </div>
                )}

                {/* Add Attendee */}
                {showAddForm && (
                    <div className="bg-gray-900 rounded-xl p-6 mb-8">

                        <h2 className="text-xl font-semibold mb-5">
                            Add Attendee
                        </h2>

                        <div className="grid md:grid-cols-2 gap-4">

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Full Name *
                                </label>

                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Sakhile Basi"
                                    className="w-full bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                        Email
                                </label>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. example@email.com"
                                    className="w-full bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                        </div>

                        <button
                            onClick={handleAddAttendee}
                            disabled={saving}
                            className="mt-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                        >
                            {saving ? 'Creating Ticket...' : 'Add Attendee'}
                        </button>

                    </div>
                )}

                {/* Search */}
                <div className="mb-6">

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email or ticket code..."
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                </div>

                {/* Summary */}
                <div className="mb-5 text-sm text-gray-400">
                    Showing {filteredTickets.length} of {tickets.length} attendees
                </div>

                {/* Attendees */}
                {filteredTickets.length === 0 ? (

                    <div className="bg-gray-900 rounded-xl p-10 text-center">

                        <h2 className="text-xl font-semibold mb-2">
                            No attendees yet
                        </h2>

                        <p className="text-gray-400 mb-5">
                            Add your first attendee to this event.
                        </p>

                        <button
                            onClick={() => setShowAddForm(true)}
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-lg font-semibold"
                        >
                            + Add Attendee
                        </button>

                    </div>

                ) : (

                    <div className="bg-gray-900 rounded-xl overflow-hidden">

                        <div className="overflow-x-auto">

                            <table className="w-full">

                                <thead className="bg-gray-800">

                                    <tr>
                                        <th className="text-left px-5 py-4 text-sm text-gray-400">
                                            Attendee
                                        </th>

                                        <th className="text-left px-5 py-4 text-sm text-gray-400">
                                            Ticket
                                        </th>

                                        <th className="text-left px-5 py-4 text-sm text-gray-400">
                                            Status
                                        </th>

                                        <th className="text-right px-5 py-4 text-sm text-gray-400">
                                            Actions
                                        </th>
                                    </tr>

                                </thead>

                                <tbody>

                                    {filteredTickets.map((ticket) => (

                                        <tr
                                            key={ticket.id}
                                            className="border-t border-gray-800"
                                        >

                                            <td className="px-5 py-4">

                                                <p className="font-semibold">
                                                    {ticket.attendee_name}
                                                </p>

                                                {ticket.attendee_email && (
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {ticket.attendee_email}
                                                    </p>
                                                )}

                                            </td>

                                            <td className="px-5 py-4">

                                                <p className="font-mono text-xs text-gray-400">
                                                    {ticket.ticket_code}
                                                </p>

                                            </td>

                                            <td className="px-5 py-4">

                                                <span
                                                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                                        ticket.status === 'used'
                                                            ? 'bg-gray-700 text-gray-300'
                                                            : 'bg-green-900/50 text-green-400'
                                                    }`}
                                                >
                                                    {ticket.status}
                                                </span>

                                            </td>

                                            <td className="px-5 py-4">

                                                <div className="flex justify-end gap-2">

                                                    <button
                                                       onClick={() => handleShowTicket(ticket)}
                                                       disabled={generatingTicket}
                                                       className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-2 rounded-lg text-sm"
                                                    >
                                                       {generatingTicket ? 'Generating...' : 'View Ticket'}
                                                   </button>

                                                </div>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

            </div>

            {/* QR Modal */}
           {selectedTicket && ticketImageUrl && (

             <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">

             <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg my-auto">

             <div className="flex justify-between items-center mb-5">

                <div>
                    <h2 className="text-xl font-bold">
                        Event Ticket
                    </h2>

                    <p className="text-gray-400 text-sm mt-1">
                        {selectedTicket.attendee_name}
                    </p>
                </div>

                <button
                    onClick={() => {
                        setSelectedTicket(null)
                        setTicketImageUrl(null)
                    }}
                    className="text-gray-400 hover:text-white text-2xl"
                >
                    ×
                </button>

            </div>

            <div className="rounded-xl overflow-hidden bg-gray-950">
                <img
                    src={ticketImageUrl}
                    alt={`Ticket for ${selectedTicket.attendee_name}`}
                    className="w-full h-auto"
                />
            </div>

            <button
                onClick={handleDownloadTicket}
                className="w-full bg-green-600 hover:bg-green-500 rounded-lg py-3 font-semibold mt-5">
                Download Ticket
            </button>

              </div>

              </div>

        )}

        </main>
    )
}