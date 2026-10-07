import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')
}

function safeFilePart(value) {
    return value
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

async function loadPoster(url) {
    if (!url) return null

    try {
        const response = await fetch(url)

        if (!response.ok) {
            return null
        }

        const contentType =
            response.headers.get('content-type') ||
            'image/jpeg'

        const supported =
            contentType.includes('jpeg') ||
            contentType.includes('jpg') ||
            contentType.includes('png') ||
            contentType.includes('webp')

        if (!supported) {
            return null
        }

        const arrayBuffer =
            await response.arrayBuffer()

        const base64 =
            Buffer.from(arrayBuffer).toString(
                'base64'
            )

        let format = 'JPEG'

        if (contentType.includes('png')) {
            format = 'PNG'
        }

        if (contentType.includes('webp')) {
            format = 'WEBP'
        }

        return {
            dataUrl:
                `data:${contentType};base64,${base64}`,
            format,
        }
    } catch (error) {
        console.error(
            'Unable to load event poster:',
            error
        )

        return null
    }
}

async function generateTicketPdf(event, ticket) {
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    })

    const pageWidth =
        pdf.internal.pageSize.getWidth()

    const pageHeight =
        pdf.internal.pageSize.getHeight()

    // Background
    pdf.setFillColor(17, 24, 39)

    pdf.rect(
        0,
        0,
        pageWidth,
        pageHeight,
        'F'
    )

    let currentY = 18

    // Event poster
    const poster =
        await loadPoster(event.poster_url)

    if (poster) {
        try {
            const properties =
                pdf.getImageProperties(
                    poster.dataUrl
                )

            const maxWidth =
                pageWidth - 30

            const maxHeight = 90

            let width = maxWidth

            let height =
                width *
                (properties.height /
                    properties.width)

            if (height > maxHeight) {
                height = maxHeight

                width =
                    height *
                    (properties.width /
                        properties.height)
            }

            const x =
                (pageWidth - width) / 2

            pdf.addImage(
                poster.dataUrl,
                poster.format,
                x,
                currentY,
                width,
                height
            )

            currentY += height + 12
        } catch (error) {
            console.error(
                'Unable to add poster to PDF:',
                error
            )
        }
    }

    // Event name
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(24)

    const eventLines =
        pdf.splitTextToSize(
            event.name,
            pageWidth - 30
        )

    pdf.text(
        eventLines,
        pageWidth / 2,
        currentY,
        {
            align: 'center',
        }
    )

    currentY +=
        eventLines.length * 10 + 5

    // Admit one
    pdf.setTextColor(156, 163, 175)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)

    pdf.text(
        'ADMIT ONE',
        pageWidth / 2,
        currentY,
        {
            align: 'center',
        }
    )

    currentY += 10

    // Attendee
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)

    const attendeeLines =
        pdf.splitTextToSize(
            ticket.attendee_name,
            pageWidth - 30
        )

    pdf.text(
        attendeeLines,
        pageWidth / 2,
        currentY,
        {
            align: 'center',
        }
    )

    currentY +=
        attendeeLines.length * 8 + 8

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

    const qrSize = 65
    const qrX =
        (pageWidth - qrSize) / 2

    pdf.setFillColor(255, 255, 255)

    pdf.roundedRect(
        qrX - 4,
        currentY - 4,
        qrSize + 8,
        qrSize + 8,
        2,
        2,
        'F'
    )

    pdf.addImage(
        qrDataUrl,
        'PNG',
        qrX,
        currentY,
        qrSize,
        qrSize
    )

    currentY += qrSize + 14

    // Reference
    pdf.setTextColor(156, 163, 175)
    pdf.setFont('courier', 'normal')
    pdf.setFontSize(8)

    const ticketReference =
        `Ticket: ${ticket.ticket_code}`

    const referenceLines =
        pdf.splitTextToSize(
            ticketReference,
            pageWidth - 30
        )

    pdf.text(
        referenceLines,
        pageWidth / 2,
        currentY,
        {
            align: 'center',
        }
    )

    currentY += 10

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    pdf.text(
        'Present this QR code at the entrance',
        pageWidth / 2,
        currentY,
        {
            align: 'center',
        }
    )

    return Buffer.from(
        pdf.output('arraybuffer')
    )
}

export async function POST(request) {
    try {
        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json(
                {
                    error:
                        'Email service is not configured.',
                },
                { status: 500 }
            )
        }

        const {
            event_id,
            ticket_id,
        } = await request.json()

        if (!event_id || !ticket_id) {
            return NextResponse.json(
                {
                    error:
                        'Event ID and ticket ID are required.',
                },
                { status: 400 }
            )
        }

        const supabase =
            await createClient()

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                {
                    error:
                        'You must be logged in.',
                },
                { status: 401 }
            )
        }

        // Verify organiser belongs to event.
        const {
            data: membership,
            error: membershipError,
        } = await supabase
            .from('event_members')
            .select('id, role')
            .eq('event_id', event_id)
            .eq('user_id', user.id)
            .single()

        if (
            membershipError ||
            !membership
        ) {
            return NextResponse.json(
                {
                    error:
                        'You do not have access to this event.',
                },
                { status: 403 }
            )
        }

        const {
            data: event,
            error: eventError,
        } = await supabaseAdmin
            .from('events')
            .select(
                'id, name, poster_url, status'
            )
            .eq('id', event_id)
            .single()

        if (eventError || !event) {
            return NextResponse.json(
                {
                    error:
                        'Event could not be found.',
                },
                { status: 404 }
            )
        }

        const {
            data: ticket,
            error: ticketError,
        } = await supabaseAdmin
            .from('tickets')
            .select(`
                id,
                event_id,
                ticket_code,
                attendee_name,
                attendee_email,
                status
            `)
            .eq('id', ticket_id)
            .eq('event_id', event_id)
            .single()

        if (ticketError || !ticket) {
            return NextResponse.json(
                {
                    error:
                        'Ticket could not be found.',
                },
                { status: 404 }
            )
        }

        if (ticket.status !== 'valid') {
            return NextResponse.json(
                {
                    error:
                        'Only valid tickets can be emailed.',
                },
                { status: 400 }
            )
        }

        if (
            !isValidEmail(
                ticket.attendee_email
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        'This attendee does not have a valid email address.',
                },
                { status: 400 }
            )
        }

        const pdfBuffer =
            await generateTicketPdf(
                event,
                ticket
            )

        const fileName =
            `${safeFilePart(event.name)}-${safeFilePart(
                ticket.attendee_name
            )}-ticket.pdf`

        const resend =
            new Resend(
                process.env.RESEND_API_KEY
            )

        const {
            data: emailData,
            error: emailError,
        } = await resend.emails.send({
            from:
                process.env
                    .RESEND_FROM_EMAIL ||
                'Event Tickets <onboarding@resend.dev>',

            to: [
                ticket.attendee_email,
            ],

            subject:
                `${event.name} - Your Ticket`,

            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
                    <h1 style="font-size: 24px;">
                        ${escapeHtml(event.name)}
                    </h1>

                    <p>
                        Hi ${escapeHtml(
                            ticket.attendee_name
                        )},
                    </p>

                    <p>
                        Your ticket for
                        <strong>${escapeHtml(
                            event.name
                        )}</strong>
                        is attached to this email.
                    </p>

                    <p>
                        Please keep the ticket available on your phone or print it before arriving at the event.
                    </p>

                    <p>
                        The QR code on the ticket will be scanned at the entrance.
                    </p>

                    <p style="margin-top: 30px; color: #6b7280; font-size: 13px;">
                        This ticket is unique. Do not share the QR code with other people.
                    </p>
                </div>
            `,

            attachments: [
                {
                    content: pdfBuffer,
                    filename: fileName,
                    contentType:
                        'application/pdf',
                },
            ],
        })

        if (emailError) {
            console.error(
                'Resend email error:',
                emailError
            )

            return NextResponse.json(
                {
                    error:
                        emailError.message ||
                        'Unable to send ticket email.',
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            email_id: emailData?.id,
            recipient:
                ticket.attendee_email,
        })
    } catch (error) {
        console.error(
            'Ticket email error:',
            error
        )

        return NextResponse.json(
            {
                error:
                    'Something went wrong while emailing the ticket.',
            },
            { status: 500 }
        )
    }
}