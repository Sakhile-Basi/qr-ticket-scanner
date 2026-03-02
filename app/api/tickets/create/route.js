import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { attendee_name, email } = await request.json()

  const ticket_code = crypto.randomUUID()

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert([{ ticket_code, attendee_name, email }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ticket: data })
}