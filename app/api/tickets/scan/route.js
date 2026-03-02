import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { ticket_code } = await request.json()

  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('ticket_code', ticket_code)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ valid: false, message: 'Ticket not found' }, { status: 404 })
  }

  if (ticket.scanned) {
    return NextResponse.json({
      valid: false,
      message: 'Already checked in',
      ticket,
    })
  }

  await supabaseAdmin
    .from('tickets')
    .update({ scanned: true, scanned_at: new Date().toISOString() })
    .eq('ticket_code', ticket_code)

  return NextResponse.json({ valid: true, message: 'Check in successful', ticket })
}