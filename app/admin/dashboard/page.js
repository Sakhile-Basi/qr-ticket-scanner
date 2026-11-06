'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
    const [events, setEvents] = useState([])
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [eventName, setEventName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)

    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        loadDashboard()
    }, [])

    async function loadDashboard() {
        setLoading(true)
        setError(null)

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            router.push('/admin/login')
            return
        }

        const [{ data: profileData, error: profileError }, { data: eventData, error: eventError }] =
            await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('id', user.id)
                    .single(),

                supabase
                    .from('events')
                    .select('id, name, status, poster_url, created_at, starts_at, venue_name, city, setup_completed_at')
                    .order('created_at', { ascending: false }),
            ])

        if (profileError) {
            setError(profileError.message)
        } else {
            setProfile(profileData)
        }

        if (eventError) {
            setError(eventError.message)
        } else {
            setEvents(eventData || [])
        }

        setLoading(false)
    }

    async function createEvent(e) {
        e.preventDefault()

        if (!eventName.trim()) {
            setError('Please enter an event name.')
            return
        }

        setCreating(true)
        setError(null)

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            router.push('/admin/login')
            return
        }

        const inviteToken = crypto.randomUUID()

        const { data: event, error: eventError } = await supabase
            .from('events')
            .insert({
                owner_id: user.id,
                name: eventName.trim(),
                invite_token: inviteToken,
            })
            .select()
            .single()

        if (eventError) {
            setError(eventError.message)
            setCreating(false)
            return
        }

        const { error: memberError } = await supabase
            .from('event_members')
            .insert({
                event_id: event.id,
                user_id: user.id,
                role: 'owner',
            })

        if (memberError) {
            setError(memberError.message)
            setCreating(false)
            return
        }

        setEventName('')
        setShowCreate(false)
        setCreating(false)

        router.push(`/admin/events/${event.id}/setup`)
    }

    async function logout() {
        await supabase.auth.signOut()
        router.push('/admin/login')
        router.refresh()
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-6xl mx-auto px-6 py-8">

                <header className="flex items-center justify-between mb-10">
                    <div>
                        <p className="text-gray-400 text-sm">Event Operations</p>
                        <h1 className="text-3xl font-bold mt-1">
                            {profile?.full_name
                                ? `Welcome, ${profile.full_name}`
                                : 'Dashboard'}
                        </h1>
                    </div>

                    <button
                        onClick={logout}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        Sign out
                    </button>
                </header>

                {error && (
                    <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3">
                        {error}
                    </div>
                )}

                <section className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-semibold">Your Events</h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Create and manage your events from here.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-xl bg-[#FFF9EE] px-5 py-2.5 font-semibold text-[#1D1A16] transition-colors hover:bg-[#C99146] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932]"
                    >
                        + Create Event
                    </button>
                </section>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : events.length === 0 ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                        <h3 className="text-xl font-semibold">No events yet</h3>
                        <p className="text-gray-400 mt-2 mb-6">
                            Create your first event to start adding attendees and generating tickets.
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="rounded-xl bg-[#FFF9EE] px-5 py-3 font-semibold text-[#1D1A16] transition-colors hover:bg-[#C99146]"
                        >
                            Create Your First Event
                        </button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {events.map((event) => (
                            <button
                                key={event.id}
                                onClick={() => router.push(`/admin/events/${event.id}`)}
                                className="text-left bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <h3 className="text-lg font-semibold">{event.name}</h3>
                                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-950 text-green-300">
                                        {event.status}
                                    </span>
                                </div>

                                <p className="text-gray-500 text-sm mt-5">
                                    Created {new Date(event.created_at).toLocaleDateString()}
                                </p>
                            </button>
                        ))}
                    </div>
                )}

                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1D1A16]/75 p-6">
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-repeat opacity-[0.12] blur-[3px]" style={{ backgroundImage: "url('/digital-inkabi-pattern.svg')", backgroundSize: "640px 540px" }} />
                        <form
                            onSubmit={createEvent}
                            className="relative z-10 w-full max-w-md rounded-2xl border border-[#D6C6AD] bg-[#FFF9EE] p-6 text-[#1D1A16] shadow-[0_24px_72px_rgba(64,42,16,0.2)]"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-3"><img src="/digital-inkabi.jpeg" alt="" className="h-12 w-12 rounded-lg border border-[#DDCFB7] object-cover" /><h2 className="text-xl font-semibold">Create Event</h2></div>
                                    <p className="mt-1 text-sm text-[#6F6658]">
                                        Create the event now, then complete its setup in a few steps.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="text-[#675C4D] hover:text-[#1D1A16] text-xl"
                                >
                                    ×
                                </button>
                            </div>

                            <label className="mb-2 block text-sm font-medium text-[#4C453B]">
                                Event name
                            </label>

                            <input
                                type="text"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                placeholder="e.g. National Sports Day"
                                autoFocus
                                className="w-full rounded-xl border border-[#D9CDBB] bg-white px-4 py-3 text-[#1D1A16] placeholder:text-[#80786D] outline-none focus-visible:border-[#A97932] focus-visible:ring-2 focus-visible:ring-[#A97932]/25"
                            />

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 rounded-xl border border-[#CFC0AA] bg-[#FFF9EE] py-3 font-semibold text-[#1D1A16] transition-colors hover:bg-[#EEE1CD]"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 rounded-xl bg-[#1D1A16] py-3 font-semibold text-[#FFF9EE] transition-colors hover:bg-[#C99146] hover:text-[#1D1A16] disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

            </div>
        </main>
    )
}
