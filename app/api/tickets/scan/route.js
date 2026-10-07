import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
    try {
        const { event_id, ticket_code } = await request.json()

        if (!event_id) {
            return NextResponse.json(
                { error: 'Event ID is required' },
                { status: 400 }
            )
        }

        if (!ticket_code?.trim()) {
            return NextResponse.json(
                { error: 'Ticket code is required' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            return NextResponse.json(
                { error: 'You must be logged in' },
                { status: 401 }
            )
        }

        const { data: membership, error: membershipError } = await supabase
            .from('event_members')
            .select('id, role')
            .eq('event_id', event_id)
            .eq('user_id', user.id)
            .single()

        if (membershipError || !membership) {
            return NextResponse.json(
                { error: 'You do not have access to this event' },
                { status: 403 }
            )
        }

        const { data, error } = await supabase.rpc('scan_ticket', {
            p_event_id: event_id,
            p_ticket_code: ticket_code.trim(),
        })

        if (error) {
            console.error('Ticket scan database error:', error)

            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            )
        }

        const result = data?.[0]

        if (!result) {
            return NextResponse.json(
                { error: 'No scan result was returned' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            result: result.scan_result,
            ticket_id: result.ticket_id,
            attendee_name: result.attendee_name,
            scanned_at: result.scanned_at,
        })
    } catch (error) {
        console.error('Ticket scan error:', error)

        return NextResponse.json(
            { error: 'Something went wrong while scanning the ticket' },
            { status: 500 }
        )
    }
}