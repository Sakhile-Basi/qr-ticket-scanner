import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request) {
  const { ticket_code } = await request.json()
  const cookieStore = await cookies()
  const scanned_by = cookieStore.get('admin_name')?.value || 'Unknown'

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
    .update({ scanned: true, scanned_at: new Date().toISOString(), scanned_by })
    .eq('ticket_code', ticket_code)

  return NextResponse.json({ valid: true, message: 'Check in successful', ticket })
}