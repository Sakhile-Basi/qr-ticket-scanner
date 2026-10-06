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
                    .select('id, name, status, poster_url, created_at')
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

        router.push(`/admin/events/${event.id}`)
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
                        className="bg-green-600 hover:bg-green-500 px-5 py-2.5 rounded-lg font-semibold transition-colors"
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
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-lg font-semibold"
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
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
                        <form
                            onSubmit={createEvent}
                            className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-semibold">Create Event</h2>
                                    <p className="text-gray-400 text-sm mt-1">
                                        You will automatically become the event owner.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="text-gray-400 hover:text-white text-xl"
                                >
                                    ×
                                </button>
                            </div>

                            <label className="text-sm text-gray-400 mb-2 block">
                                Event name
                            </label>

                            <input
                                type="text"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                placeholder="e.g. National Sports Day"
                                autoFocus
                                className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-3 font-semibold"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg py-3 font-semibold"
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
