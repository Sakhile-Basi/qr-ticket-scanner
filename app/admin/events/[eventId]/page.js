'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ink = '#1D1A16'
const cream = '#FFF9EE'
const muted = '#756B5D'
const line = '#E5D8C4'
const gold = '#C99146'

function formatDate(value, options = { dateStyle: 'medium' }) {
    if (!value) return 'Not set'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not set'
    return new Intl.DateTimeFormat('en-ZA', options).format(date)
}

function formatEventDate(start, end) {
    if (!start) return 'Dates not added yet'
    if (!end) return formatDate(start)
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Dates not added yet'

    const sameDay = startDate.toDateString() === endDate.toDateString()
    if (sameDay) {
        return `${formatDate(start, { day: 'numeric', month: 'long', year: 'numeric' })} · ${formatDate(start, { hour: '2-digit', minute: '2-digit' })}–${formatDate(end, { hour: '2-digit', minute: '2-digit' })}`
    }
    return `${formatDate(start)} – ${formatDate(end)}`
}

export default function EventManagementPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()
    const eventId = params.eventId

    const [event, setEvent] = useState(null)
    const [posterFile, setPosterFile] = useState(null)
    const [uploadingPoster, setUploadingPoster] = useState(false)
    const [stats, setStats] = useState({ attendees: 0, tickets: 0, checkedIn: 0, teamMembers: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!eventId) return

        let cancelled = false

        async function loadEvent() {
            setLoading(true)
            setError(null)

            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser()
                if (userError || !user) {
                    router.push('/admin/login')
                    return
                }

                const { data: membership, error: membershipError } = await supabase
                    .from('event_members')
                    .select('id, role')
                    .eq('event_id', eventId)
                    .eq('user_id', user.id)
                    .single()

                if (membershipError || !membership) {
                    throw new Error('You do not have access to this event.')
                }

                const { data, error: eventError } = await supabase
                    .from('events')
                    .select('id, name, status, invite_token, poster_url, created_at, owner_id, description, starts_at, ends_at, timezone, venue_name, venue_address, city, setup_completed_at')
                    .eq('id', eventId)
                    .single()

                if (eventError || !data) {
                    throw new Error(eventError?.message || 'This event could not be found.')
                }

                const [
                    { count: ticketCount, error: ticketError },
                    { count: checkedInCount, error: checkedInError },
                    { count: teamCount, error: teamError },
                ] = await Promise.all([
                    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
                    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'used'),
                    supabase.from('event_members').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
                ])

                if (ticketError || checkedInError || teamError) {
                    throw new Error(ticketError?.message || checkedInError?.message || teamError?.message || 'Unable to load event statistics.')
                }

                if (!cancelled) {
                    setEvent(data)
                    setStats({
                        attendees: ticketCount || 0,
                        tickets: ticketCount || 0,
                        checkedIn: checkedInCount || 0,
                        teamMembers: teamCount || 0,
                    })
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError?.message || 'Something went wrong while loading the event.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadEvent()
        return () => { cancelled = true }
    }, [eventId, router, supabase])

    async function handlePosterUpload() {
        if (!posterFile) {
            setError('Choose an image before uploading.')
            return
        }
        if (!posterFile.type.startsWith('image/')) {
            setError('Please choose a valid image file.')
            return
        }
        if (posterFile.size > 5 * 1024 * 1024) {
            setError('Poster image must be smaller than 5MB.')
            return
        }

        setUploadingPoster(true)
        setError(null)

        const extension = posterFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `${eventId}/poster-${Date.now()}.${extension}`

        const { error: uploadError } = await supabase.storage
            .from('event-posters')
            .upload(filePath, posterFile, { contentType: posterFile.type })

        if (uploadError) {
            setError(uploadError.message)
            setUploadingPoster(false)
            return
        }

        const { data: publicUrlData } = supabase.storage.from('event-posters').getPublicUrl(filePath)
        const posterUrl = publicUrlData.publicUrl

        const { error: updateError } = await supabase
            .from('events')
            .update({ poster_url: posterUrl })
            .eq('id', eventId)

        if (updateError) {
            setError(updateError.message)
            setUploadingPoster(false)
            return
        }

        setEvent(current => ({ ...current, poster_url: posterUrl }))
        setPosterFile(null)
        setUploadingPoster(false)
    }

    async function logout() {
        await supabase.auth.signOut()
        router.push('/admin/login')
        router.refresh()
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: cream, color: ink }}>
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#D9C9B0] border-t-[#A97932]" aria-label="Loading event" />
            </main>
        )
    }

    if (!event) {
        return (
            <main className="min-h-screen px-6 py-12" style={{ background: cream, color: ink }}>
                <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8" style={{ borderColor: line }}>
                    <button onClick={() => router.push('/admin/dashboard')} className="mb-6 text-sm font-medium hover:underline" style={{ color: muted }}>← Back to events</button>
                    <h1 className="text-2xl font-semibold">Unable to open this event</h1>
                    <p className="mt-3 text-sm" style={{ color: muted }}>{error || 'Something went wrong.'}</p>
                </div>
            </main>
        )
    }

    const setupComplete = Boolean(event.setup_completed_at)
    const location = [event.venue_name, event.city].filter(Boolean).join(' · ')

    return (
        <main className="min-h-screen" style={{ background: cream, color: ink }}>
            <div className="pointer-events-none fixed inset-0 -z-0 bg-[url('/digital-inkabi-pattern.svg')] bg-repeat opacity-[0.035]" />

            <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:py-10">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <button onClick={() => router.push('/admin/dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-[#A97932]" style={{ color: muted }}>
                        <span aria-hidden="true">←</span> All events
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="hidden text-xs font-medium sm:inline" style={{ color: muted }}>DIGITAL INKABI · EVENT OPERATIONS</span>
                        <button onClick={logout} className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#EEE1CD]" style={{ borderColor: line }}>Sign out</button>
                    </div>
                </header>

                {error && (
                    <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
                )}

                <section className="mb-8 overflow-hidden rounded-3xl border bg-white shadow-[0_12px_40px_rgba(64,42,16,0.06)]" style={{ borderColor: line }}>
                    <div className="grid lg:grid-cols-[1fr_280px]">
                        <div className="p-6 sm:p-9">
                            <div className="mb-5 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: '#72552D' }}>Event overview</span>
                                <span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize" style={{ borderColor: '#C8DCCB', background: '#EFF6EF', color: '#315B39' }}>{event.status}</span>
                                <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: setupComplete ? '#C8DCCB' : '#E8D4B4', background: setupComplete ? '#EFF6EF' : '#FBF4E8', color: setupComplete ? '#315B39' : '#805D2E' }}>
                                    {setupComplete ? 'Setup complete' : 'Setup incomplete'}
                                </span>
                            </div>

                            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{event.name}</h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: muted }}>
                                {event.description || 'Your event workspace. Manage attendees, tickets, entry scanning and your event team from here.'}
                            </p>

                            <div className="mt-7 grid gap-4 border-t pt-6 sm:grid-cols-2" style={{ borderColor: line }}>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Date and time</p>
                                    <p className="mt-2 text-sm font-semibold">{formatEventDate(event.starts_at, event.ends_at)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: muted }}>Location</p>
                                    <p className="mt-2 text-sm font-semibold">{location || 'Venue not added yet'}</p>
                                    {event.venue_address && <p className="mt-1 text-xs" style={{ color: muted }}>{event.venue_address}</p>}
                                </div>
                            </div>

                            <div className="mt-7 flex flex-wrap gap-3">
                                <button onClick={() => router.push(`/admin/events/${eventId}/setup`)} className="rounded-xl px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#C99146] hover:text-[#1D1A16]" style={{ background: ink, color: cream }}>
                                    {setupComplete ? 'Edit event details' : 'Continue event setup'}
                                </button>
                                <p className="self-center text-xs" style={{ color: muted }}>Created {formatDate(event.created_at)}</p>
                            </div>
                        </div>

                        <div className="relative min-h-[240px] bg-[#F0E7D8] lg:min-h-full">
                            {event.poster_url ? (
                                <img src={event.poster_url} alt={`${event.name} poster`} className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D9C9B0] bg-[#FFF9EE] text-2xl" aria-hidden="true">DI</div>
                                    <p className="text-sm font-semibold">Your event poster</p>
                                    <p className="mt-1 max-w-[190px] text-xs" style={{ color: muted }}>Add artwork to give your event its own identity.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {!setupComplete && (
                    <section className="mb-8 flex flex-col gap-4 rounded-2xl border bg-[#F7EFDF] p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#E4D1B2' }}>
                        <div>
                            <h2 className="font-semibold">Finish setting up this event</h2>
                            <p className="mt-1 text-sm" style={{ color: muted }}>Add the required dates and review your event details. Your management tools remain available while setup is incomplete.</p>
                        </div>
                        <button onClick={() => router.push(`/admin/events/${eventId}/setup`)} className="shrink-0 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: ink, color: cream }}>Continue setup →</button>
                    </section>
                )}

                <section className="mb-10">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9A713B' }}>At a glance</p>
                            <h2 className="mt-1 text-xl font-semibold">Event activity</h2>
                        </div>
                        <p className="text-xs" style={{ color: muted }}>Live totals for this event</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[
                            ['Attendees', stats.attendees, 'People registered'],
                            ['Tickets', stats.tickets, 'Tickets generated'],
                            ['Checked in', stats.checkedIn, 'Successful entries'],
                            ['Team members', stats.teamMembers, 'People with access'],
                        ].map(([label, value, helper]) => (
                            <div key={label} className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: line }}>
                                <p className="text-sm font-medium" style={{ color: muted }}>{label}</p>
                                <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
                                <p className="mt-1 text-xs" style={{ color: muted }}>{helper}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-10">
                    <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9A713B' }}>Your workspace</p>
                        <h2 className="mt-1 text-xl font-semibold">Manage this event</h2>
                        <p className="mt-1 text-sm" style={{ color: muted }}>Choose a tool to continue managing your event.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            { title: 'Attendees', description: 'Add guests and manage your attendee list.', action: 'Manage attendees', route: 'attendees', number: '01' },
                            { title: 'Tickets', description: 'Generate, view and distribute unique QR tickets.', action: 'Manage tickets', route: 'tickets', number: '02' },
                            { title: 'Entry scanner', description: 'Scan QR tickets and record guest check-ins.', action: 'Open scanner', route: 'scanner', number: '03' },
                            { title: 'Event team', description: 'Invite staff and manage who can access this event.', action: 'Manage team', route: 'team', number: '04' },
                        ].map(item => (
                            <button key={item.route} onClick={() => router.push(`/admin/events/${eventId}/${item.route}`)} className="group rounded-2xl border bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-[#C99146] hover:shadow-[0_12px_30px_rgba(64,42,16,0.08)]" style={{ borderColor: line }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold">{item.title}</h3>
                                        <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: muted }}>{item.description}</p>
                                    </div>
                                    <span className="text-xs font-semibold tracking-widest" style={{ color: '#A97932' }}>{item.number}</span>
                                </div>
                                <p className="mt-6 text-sm font-semibold transition-colors group-hover:text-[#A97932]">{item.action} <span aria-hidden="true">→</span></p>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border bg-white p-6 sm:p-7" style={{ borderColor: line }}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-lg">
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9A713B' }}>Event branding</p>
                            <h2 className="mt-1 text-lg font-semibold">Event poster</h2>
                            <p className="mt-2 text-sm leading-6" style={{ color: muted }}>The poster is used as part of the visual identity on tickets generated for this event. JPG, PNG and other browser-supported image formats up to 5MB.</p>
                        </div>
                        <div className="flex w-full flex-col gap-3 lg:max-w-md">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => { setPosterFile(e.target.files?.[0] || null); setError(null) }}
                                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#F3EBDD] file:px-4 file:py-2.5 file:font-semibold file:text-[#1D1A16] hover:file:bg-[#E9DCC6]"
                            />
                            {posterFile && <p className="text-xs" style={{ color: muted }}>Selected: {posterFile.name}</p>}
                            <button onClick={handlePosterUpload} disabled={!posterFile || uploadingPoster} className="rounded-xl px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#C99146] hover:text-[#1D1A16] disabled:cursor-not-allowed disabled:opacity-40" style={{ background: ink, color: cream }}>
                                {uploadingPoster ? 'Uploading poster…' : event.poster_url ? 'Replace poster' : 'Upload poster'}
                            </button>
                        </div>
                    </div>
                </section>

                <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs" style={{ borderColor: line, color: muted }}>
                    <span>Digital Inkabi · Event Operations</span>
                    <span>Event created {formatDate(event.created_at)}</span>
                </footer>
            </div>
        </main>
    )
}
