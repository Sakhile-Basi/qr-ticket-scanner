import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request) {
    try {
        const { searchParams } =
            new URL(request.url)

        const eventId =
            searchParams.get('event_id')

        if (!eventId) {
            return NextResponse.json(
                { error: 'Event ID is required' },
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
            return NextResponse.json(
                {
                    error:
                        'You do not have access to this event',
                },
                { status: 403 }
            )
        }

        const { data: event, error: eventError } =
            await supabaseAdmin
                .from('events')
                .select(`
                    id,
                    name,
                    owner_id,
                    invite_token,
                    status
                `)
                .eq('id', eventId)
                .single()

        if (eventError || !event) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            )
        }

        const { data: members, error: membersError } =
            await supabaseAdmin
                .from('event_members')
                .select(`
                    id,
                    user_id,
                    role,
                    joined_at,
                    profiles (
                        full_name
                    )
                `)
                .eq('event_id', eventId)
                .order('joined_at', {
                    ascending: true,
                })

        if (membersError) {
            console.error(
                'Team load error:',
                membersError
            )

            return NextResponse.json(
                { error: membersError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            event,
            members: members || [],
            current_user_id: user.id,
        })
    } catch (error) {
        console.error('Team API error:', error)

        return NextResponse.json(
            { error: 'Unable to load event team.' },
            { status: 500 }
        )
    }
}

export async function DELETE(request) {
    try {
        const {
            event_id,
            member_id,
        } = await request.json()

        if (!event_id || !member_id) {
            return NextResponse.json(
                {
                    error:
                        'Event ID and member ID are required',
                },
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
                .select('id, owner_id')
                .eq('id', event_id)
                .single()

        if (eventError || !event) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            )
        }

        if (event.owner_id !== user.id) {
            return NextResponse.json(
                {
                    error:
                        'Only the event owner can remove organisers.',
                },
                { status: 403 }
            )
        }

        const {
            data: member,
            error: memberError,
        } = await supabaseAdmin
            .from('event_members')
            .select('id, user_id, role')
            .eq('id', member_id)
            .eq('event_id', event_id)
            .single()

        if (memberError || !member) {
            return NextResponse.json(
                { error: 'Team member not found' },
                { status: 404 }
            )
        }

        if (
            member.role === 'owner' ||
            member.user_id === event.owner_id
        ) {
            return NextResponse.json(
                {
                    error:
                        'The event owner cannot be removed.',
                },
                { status: 400 }
            )
        }

        const { error: deleteError } =
            await supabaseAdmin
                .from('event_members')
                .delete()
                .eq('id', member.id)

        if (deleteError) {
            return NextResponse.json(
                { error: deleteError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
        })
    } catch (error) {
        console.error(
            'Remove team member error:',
            error
        )

        return NextResponse.json(
            {
                error:
                    'Unable to remove team member.',
            },
            { status: 500 }
        )
    }
}