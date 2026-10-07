'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'

export default function TicketsPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()

    const eventId = params.eventId

    const [event, setEvent] = useState(null)
    const [tickets, setTickets] = useState([])
    const [emailingId, setEmailingId] = useState(null)
    const [success, setSuccess] = useState(null)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [selectedTicket, setSelectedTicket] = useState(null)
    const [ticketImageUrl, setTicketImageUrl] = useState(null)
    const [generatingTicket, setGeneratingTicket] = useState(false)
    const [sharingTicket, setSharingTicket] = useState(false)

    const [revokingId, setRevokingId] = useState(null)

    useEffect(() => {
        if (!eventId) return

        loadPage()
    }, [eventId])

    async function loadPage() {
        setLoading(true)
        setError(null)

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                router.push('/admin/login')
                return
            }

            const {
                data: membership,
                error: membershipError,
            } = await supabase
                .from('event_members')
                .select('id, role')
                .eq('event_id', eventId)
                .eq('user_id', user.id)
                .single()

            if (membershipError || !membership) {
                setError('You do not have access to this event.')
                return
            }

            const {
                data: eventData,
                error: eventError,
            } = await supabase
                .from('events')
                .select('id, name, status, poster_url')
                .eq('id', eventId)
                .single()

            if (eventError || !eventData) {
                setError('Unable to load event.')
                return
            }

            setEvent(eventData)

            const {
                data: ticketData,
                error: ticketError,
            } = await supabase
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
                .order('created_at', {
                    ascending: false,
                })

            if (ticketError) {
                setError('Unable to load tickets.')
                return
            }

            setTickets(ticketData || [])
        } catch (error) {
            console.error('Ticket page error:', error)

            setError(
                'Something went wrong while loading tickets.'
            )
        } finally {
            setLoading(false)
        }
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image()

            image.crossOrigin = 'anonymous'
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = src
        })
    }

    async function handleViewTicket(ticket) {
        try {
            setGeneratingTicket(true)
            setError(null)

            const canvas = document.createElement('canvas')

            canvas.width = 1080
            canvas.height = 1350

            const ctx = canvas.getContext('2d')

            ctx.fillStyle = '#111827'
            ctx.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            )

            // Poster
            if (event.poster_url) {
                const poster = await loadImage(
                    event.poster_url
                )

                const posterHeight = 540
                const imageRatio =
                    poster.width / poster.height

                const targetRatio =
                    canvas.width / posterHeight

                let sourceWidth = poster.width
                let sourceHeight = poster.height
                let sourceX = 0
                let sourceY = 0

                if (imageRatio > targetRatio) {
                    sourceWidth =
                        poster.height * targetRatio

                    sourceX =
                        (poster.width - sourceWidth) / 2
                } else {
                    sourceHeight =
                        poster.width / targetRatio

                    sourceY =
                        (poster.height - sourceHeight) / 2
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

                ctx.fillStyle =
                    'rgba(0, 0, 0, 0.45)'

                ctx.fillRect(
                    0,
                    0,
                    canvas.width,
                    posterHeight
                )
            } else {
                ctx.fillStyle = '#1f2937'

                ctx.fillRect(
                    0,
                    0,
                    canvas.width,
                    540
                )
            }

            // Event name
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 60px Arial'
            ctx.textAlign = 'center'

            ctx.fillText(
                event.name,
                canvas.width / 2,
                450,
                900
            )

            // Attendee
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

            // QR
            const qrDataUrl =
                await QRCode.toDataURL(
                    ticket.ticket_code,
                    {
                        width: 400,
                        margin: 2,
                        errorCorrectionLevel: 'H',
                    }
                )

            const qrImage =
                await loadImage(qrDataUrl)

            const qrSize = 400
            const qrX =
                (canvas.width - qrSize) / 2
            const qrY = 735

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

            // Ticket reference
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

            const finalTicket =
                canvas.toDataURL('image/png')

            setSelectedTicket(ticket)
            setTicketImageUrl(finalTicket)
        } catch (error) {
            console.error(
                'Ticket generation error:',
                error
            )

            setError(
                'Unable to generate ticket image.'
            )
        } finally {
            setGeneratingTicket(false)
        }
    }

    async function handleEmailTicket(ticket) {
    if (!ticket.attendee_email) {
        setError(
            'This attendee does not have an email address.'
        )
        return
    }

    const confirmed =
        window.confirm(
            `Email this ticket to ${ticket.attendee_email}?`
        )

    if (!confirmed) return

    setEmailingId(ticket.id)
    setError(null)
    setSuccess(null)

    try {
        const response = await fetch(
            '/api/tickets/email',
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json',
                },
                body: JSON.stringify({
                    event_id: eventId,
                    ticket_id: ticket.id,
                }),
            }
        )

        const data =
            await response.json()

        if (!response.ok) {
            setError(
                data.error ||
                    'Unable to email ticket.'
            )
            return
        }

        setSuccess(
            `Ticket emailed to ${data.recipient}.`
        )
    } catch (error) {
        console.error(
            'Ticket email request error:',
            error
        )

        setError(
            'Something went wrong while emailing the ticket.'
        )
    } finally {
        setEmailingId(null)
    }
}

    function getTicketFileName(ticket) {
    const safeEventName = event.name
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()

    const safeAttendeeName = ticket.attendee_name
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .toLowerCase()

    return `${safeEventName}-${safeAttendeeName}-ticket`
}

    function handleDownloadPng() {
    if (!ticketImageUrl || !selectedTicket) return

    const link = document.createElement('a')

    link.href = ticketImageUrl
    link.download = `${getTicketFileName(selectedTicket)}.png`

    link.click()
}

async function createTicketPdfBlob() {
    if (!ticketImageUrl || !selectedTicket) {
        throw new Error('Ticket image is not available.')
    }

    const { jsPDF } = await import('jspdf')

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // Keep the ticket's original 1080 x 1350 ratio.
    const ticketRatio = 1080 / 1350

    const margin = 15
    const maxWidth = pageWidth - margin * 2
    const maxHeight = pageHeight - margin * 2

    let ticketWidth = maxWidth
    let ticketHeight = ticketWidth / ticketRatio

    if (ticketHeight > maxHeight) {
        ticketHeight = maxHeight
        ticketWidth = ticketHeight * ticketRatio
    }

    const x = (pageWidth - ticketWidth) / 2
    const y = (pageHeight - ticketHeight) / 2

    pdf.addImage(
        ticketImageUrl,
        'PNG',
        x,
        y,
        ticketWidth,
        ticketHeight
    )

    return pdf.output('blob')
}

async function handleDownloadPdf() {
    if (!selectedTicket) return

    try {
        setError(null)

        const pdfBlob = await createTicketPdfBlob()

        const url = URL.createObjectURL(pdfBlob)

        const link = document.createElement('a')

        link.href = url
        link.download = `${getTicketFileName(selectedTicket)}.pdf`

        link.click()

        URL.revokeObjectURL(url)
    } catch (error) {
        console.error('PDF generation error:', error)

        setError('Unable to generate PDF ticket.')
    }
}

async function handleShareTicket() {
    if (!ticketImageUrl || !selectedTicket) return

    setSharingTicket(true)
    setError(null)

    try {
        const pdfBlob = await createTicketPdfBlob()

        const pdfFile = new File(
            [pdfBlob],
            `${getTicketFileName(selectedTicket)}.pdf`,
            {
                type: 'application/pdf',
            }
        )

        const shareData = {
            title: `${event.name} Ticket`,
            text: `Ticket for ${selectedTicket.attendee_name} - ${event.name}`,
            files: [pdfFile],
        }

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [pdfFile],
            })
        ) {
            await navigator.share(shareData)
            return
        }

        /*
         * Some devices support Web Share but not sharing PDF files.
         * Try the PNG instead.
         */
        const imageResponse = await fetch(ticketImageUrl)
        const imageBlob = await imageResponse.blob()

        const imageFile = new File(
            [imageBlob],
            `${getTicketFileName(selectedTicket)}.png`,
            {
                type: 'image/png',
            }
        )

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [imageFile],
            })
        ) {
            await navigator.share({
                title: `${event.name} Ticket`,
                text: `Ticket for ${selectedTicket.attendee_name} - ${event.name}`,
                files: [imageFile],
            })

            return
        }

        /*
         * Final fallback if the browser supports sharing text
         * but not files.
         */
        if (navigator.share) {
            await navigator.share({
                title: `${event.name} Ticket`,
                text: `Ticket for ${selectedTicket.attendee_name} - ${event.name}`,
            })

            return
        }

        setError(
            'Native sharing is not supported by this browser. Download the ticket instead.'
        )
    } catch (error) {
        /*
         * AbortError normally means the person simply closed
         * the native share menu, so don't show that as an error.
         */
        if (error?.name !== 'AbortError') {
            console.error('Ticket share error:', error)

            setError('Unable to share ticket.')
        }
    } finally {
        setSharingTicket(false)
    }
}

    async function handleRevoke(ticket) {
        if (ticket.status === 'used') {
            setError(
                'A ticket that has already been used cannot be revoked.'
            )
            return
        }

        if (ticket.status === 'revoked') {
            return
        }

        const confirmed = window.confirm(
            `Revoke the ticket for ${ticket.attendee_name}?`
        )

        if (!confirmed) return

        setRevokingId(ticket.id)
        setError(null)

        const { error: revokeError } =
            await supabase
                .from('tickets')
                .update({
                    status: 'revoked',
                })
                .eq('id', ticket.id)
                .eq('event_id', eventId)
                .eq('status', 'valid')

        if (revokeError) {
            setError(revokeError.message)
            setRevokingId(null)
            return
        }

        setTickets((currentTickets) =>
            currentTickets.map((currentTicket) =>
                currentTicket.id === ticket.id
                    ? {
                          ...currentTicket,
                          status: 'revoked',
                      }
                    : currentTicket
            )
        )

        setRevokingId(null)
    }

    const filteredTickets =
        tickets.filter((ticket) => {
            const term =
                search.trim().toLowerCase()

            const matchesSearch =
                !term ||
                ticket.attendee_name
                    ?.toLowerCase()
                    .includes(term) ||
                ticket.attendee_email
                    ?.toLowerCase()
                    .includes(term) ||
                ticket.ticket_code
                    ?.toLowerCase()
                    .includes(term)

            const matchesStatus =
                statusFilter === 'all' ||
                ticket.status === statusFilter

            return (
                matchesSearch &&
                matchesStatus
            )
        })

    const validCount =
        tickets.filter(
            (ticket) =>
                ticket.status === 'valid'
        ).length

    const usedCount =
        tickets.filter(
            (ticket) =>
                ticket.status === 'used'
        ).length

    const revokedCount =
        tickets.filter(
            (ticket) =>
                ticket.status === 'revoked'
        ).length

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-gray-400">
                    Loading tickets...
                </p>
            </main>
        )
    }

    if (!event) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-400 mb-5">
                        {error ||
                            'Unable to load event.'}
                    </p>

                    <button
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}`
                            )
                        }
                        className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-lg"
                    >
                        Back to Event
                    </button>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-6xl mx-auto px-6 py-8">

                {/* Header */}
                <header className="mb-8">
                    <button
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}`
                            )
                        }
                        className="text-gray-400 hover:text-white text-sm mb-4"
                    >
                        ← Back to Event
                    </button>

                    <h1 className="text-3xl font-bold">
                        Tickets
                    </h1>

                    <p className="text-gray-400 mt-2">
                        {event.name}
                    </p>
                </header>

                {/* Error */}
                {error && (
                    <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-xl px-5 py-4">
                        {error}
                    </div>
                )}

                {success && (
                 <div className="mb-6 bg-green-950 border border-green-800 text-green-300 rounded-xl px-5 py-4">
                     {success}
                </div>
                 )}

                {/* Summary */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">
                            Total
                        </p>

                        <p className="text-3xl font-bold mt-2">
                            {tickets.length}
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">
                            Valid
                        </p>

                        <p className="text-3xl font-bold mt-2 text-green-400">
                            {validCount}
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">
                            Used
                        </p>

                        <p className="text-3xl font-bold mt-2">
                            {usedCount}
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-gray-400 text-sm">
                            Revoked
                        </p>

                        <p className="text-3xl font-bold mt-2 text-red-400">
                            {revokedCount}
                        </p>
                    </div>

                </section>

                {/* Search and filter */}
                <section className="flex flex-col md:flex-row gap-4 mb-6">

                    <input
                        type="text"
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        placeholder="Search by attendee, email or ticket code..."
                        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />

                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(
                                e.target.value
                            )
                        }
                        className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="all">
                            All statuses
                        </option>

                        <option value="valid">
                            Valid
                        </option>

                        <option value="used">
                            Used
                        </option>

                        <option value="revoked">
                            Revoked
                        </option>
                    </select>

                </section>

                <p className="text-gray-400 text-sm mb-5">
                    Showing {filteredTickets.length} of{' '}
                    {tickets.length} tickets
                </p>

                {/* Tickets */}
                {filteredTickets.length === 0 ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                        <h2 className="text-xl font-semibold">
                            No tickets found
                        </h2>

                        <p className="text-gray-400 mt-2">
                            Try changing your search or
                            filter.
                        </p>
                    </div>
                ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
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
                                    {filteredTickets.map(
                                        (ticket) => (
                                            <tr
                                                key={
                                                    ticket.id
                                                }
                                                className="border-t border-gray-800"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold">
                                                        {
                                                            ticket.attendee_name
                                                        }
                                                    </p>

                                                    {ticket.attendee_email && (
                                                        <p className="text-gray-500 text-sm mt-1">
                                                            {
                                                                ticket.attendee_email
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <p className="font-mono text-xs text-gray-400">
                                                        {ticket.ticket_code.slice(
                                                            0,
                                                            12
                                                        )}
                                                        ...
                                                    </p>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                                            ticket.status ===
                                                            'valid'
                                                                ? 'bg-green-900/50 text-green-400'
                                                                : ticket.status ===
                                                                    'used'
                                                                  ? 'bg-gray-700 text-gray-300'
                                                                  : 'bg-red-900/50 text-red-400'
                                                        }`}
                                                    >
                                                        {
                                                            ticket.status
                                                        }
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-2">

                                                        <button
                                                            onClick={() =>
                                                                handleViewTicket(
                                                                    ticket
                                                                )
                                                            }
                                                            disabled={
                                                                generatingTicket
                                                            }
                                                            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-2 rounded-lg text-sm"
                                                        >
                                                            View
                                                        </button>

                                                        {ticket.status === 'valid' &&
    ticket.attendee_email && (
        <button
            onClick={() =>
                handleEmailTicket(
                    ticket
                )
            }
            disabled={
                emailingId ===
                ticket.id
            }
            className="bg-green-950 hover:bg-green-900 text-green-300 disabled:opacity-50 px-3 py-2 rounded-lg text-sm"
        >
            {emailingId ===
            ticket.id
                ? 'Sending...'
                : 'Email'}
        </button>
    )}

                                                        {ticket.status ===
                                                            'valid' && (
                                                            <button
                                                                onClick={() =>
                                                                    handleRevoke(
                                                                        ticket
                                                                    )
                                                                }
                                                                disabled={
                                                                    revokingId ===
                                                                    ticket.id
                                                                }
                                                                className="bg-red-950 hover:bg-red-900 text-red-300 disabled:opacity-50 px-3 py-2 rounded-lg text-sm"
                                                            >
                                                                {revokingId ===
                                                                ticket.id
                                                                    ? 'Revoking...'
                                                                    : 'Revoke'}
                                                            </button>
                                                        )}

                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {/* Ticket modal */}
            {selectedTicket &&
                ticketImageUrl && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 md:p-6 z-50 overflow-y-auto">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg my-auto">

                            <div className="flex justify-between items-start gap-4 mb-5">
                                <div>
                                    <h2 className="text-xl font-bold">
                                        Event Ticket
                                    </h2>

                                    <p className="text-gray-400 text-sm mt-1">
                                        {
                                            selectedTicket.attendee_name
                                        }
                                    </p>
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedTicket(
                                            null
                                        )
                                        setTicketImageUrl(
                                            null
                                        )
                                    }}
                                    className="text-gray-400 hover:text-white text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {selectedTicket.status ===
                                'revoked' && (
                                <div className="mb-4 bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-center font-semibold">
                                    REVOKED
                                </div>
                            )}

                            {selectedTicket.status ===
                                'used' && (
                                <div className="mb-4 bg-gray-800 text-gray-300 rounded-lg px-4 py-3 text-center font-semibold">
                                    USED
                                </div>
                            )}

                            <div className="rounded-xl overflow-hidden bg-gray-950">
                                <img
                                    src={
                                        ticketImageUrl
                                    }
                                    alt={`Ticket for ${selectedTicket.attendee_name}`}
                                    className="w-full h-auto"
                                />
                            </div>

                            <div className="grid gap-3 mt-5">

    <button
        onClick={handleDownloadPng}
        className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg py-3 font-semibold"
    >
        Download PNG
    </button>

    <button
        onClick={handleDownloadPdf}
        className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg py-3 font-semibold"
    >
        Download PDF
    </button>

    <button
        onClick={handleShareTicket}
        disabled={sharingTicket}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg py-3 font-semibold"
    >
        {sharingTicket
            ? 'Opening Share Menu...'
            : 'Share Ticket'}
    </button>

    {selectedTicket.status === 'valid' &&
    selectedTicket.attendee_email && (
        <button
            onClick={() =>
                handleEmailTicket(
                    selectedTicket
                )
            }
            disabled={
                emailingId ===
                selectedTicket.id
            }
            className="w-full bg-green-950 hover:bg-green-900 text-green-300 disabled:opacity-50 rounded-lg py-3 font-semibold"
        >
            {emailingId ===
            selectedTicket.id
                ? 'Sending Email...'
                : 'Email Ticket'}
        </button>
    )}

</div>

                        </div>
                    </div>
                )}

        </main>
    )
}