import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { event_id, attendee_name, attendee_email } = await request.json()

    if (!event_id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    if (!attendee_name?.trim()) {
      return NextResponse.json(
        { error: 'Attendee name is required' },
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

    const ticket_code = crypto.randomUUID()

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .insert([
        {
          event_id,
          ticket_code,
          attendee_name: attendee_name.trim(),
          attendee_email: attendee_email?.trim() || null,
          status: 'valid',
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Ticket creation database error:', error)

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ticket: data })
  } catch (error) {
    console.error('Ticket creation error:', error)

    return NextResponse.json(
      { error: 'Something went wrong while creating the ticket' },
      { status: 500 }
    )
  }
}