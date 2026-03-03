import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request) {
  const { attendee_name, email } = await request.json()
  const cookieStore = await cookies()
  const created_by = cookieStore.get('admin_name')?.value || 'Unknown'

  const ticket_code = crypto.randomUUID()

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert([{ ticket_code, attendee_name, email, created_by }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ticket: data })
}