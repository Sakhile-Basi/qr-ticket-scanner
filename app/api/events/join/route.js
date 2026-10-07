import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
    try {
        const { invite_token } = await request.json()

        if (!invite_token?.trim()) {
            return NextResponse.json(
                { error: 'Invite token is required' },
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

        const { data: event, error: eventError } =
            await supabaseAdmin
                .from('events')
                .select('id, name, status')
                .eq('invite_token', invite_token.trim())
                .single()

        if (eventError || !event) {
            return NextResponse.json(
                { error: 'This invitation is invalid.' },
                { status: 404 }
            )
        }

        if (event.status !== 'active') {
            return NextResponse.json(
                { error: 'This event is no longer active.' },
                { status: 400 }
            )
        }

        const { data: existingMember } =
            await supabaseAdmin
                .from('event_members')
                .select('id, role')
                .eq('event_id', event.id)
                .eq('user_id', user.id)
                .maybeSingle()

        if (existingMember) {
            return NextResponse.json({
                event,
                membership: existingMember,
                already_member: true,
            })
        }

        const {
            data: membership,
            error: membershipError,
        } = await supabaseAdmin
            .from('event_members')
            .insert({
                event_id: event.id,
                user_id: user.id,
                role: 'organiser',
            })
            .select('id, role')
            .single()

        if (membershipError) {
            console.error(
                'Event join error:',
                membershipError
            )

            return NextResponse.json(
                { error: membershipError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            event,
            membership,
            already_member: false,
        })
    } catch (error) {
        console.error('Join event error:', error)

        return NextResponse.json(
            { error: 'Unable to join event.' },
            { status: 500 }
        )
    }
}