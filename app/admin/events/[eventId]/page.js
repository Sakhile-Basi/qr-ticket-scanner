'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EventManagementPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()

    const eventId = params.eventId

    const [posterFile, setPosterFile] = useState(null)
    const [uploadingPoster, setUploadingPoster] = useState(false)

    const [event, setEvent] = useState(null)

    const [stats, setStats] = useState({
    attendees: 0,
    tickets: 0,
    checkedIn: 0,
    teamMembers: 0,
})

const [loading, setLoading] = useState(true)

const [error, setError] = useState(null)


async function loadEvent() {
    setLoading(true)
    setError(null)

    try {
        console.log('EVENT 1 - eventId:', eventId)

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        console.log('EVENT 2 - user:', user?.id)
        console.log('EVENT 2 - auth error:', userError)

        if (userError || !user) {
            router.push('/admin/login')
            return
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

        console.log('EVENT 3 - membership:', membership)
        console.log('EVENT 3 - membership error:', membershipError)

        if (membershipError || !membership) {
            setError('You do not have access to this event.')
            return
        }

        const {
            data,
            error: eventError,
        } = await supabase
            .from('events')
            .select(`
                id,
                name,
                status,
                invite_token,
                poster_url,
                created_at,
                owner_id
            `)
            .eq('id', eventId)
            .single()

        console.log('EVENT 4 - event:', data)
        console.log('EVENT 4 - event error:', eventError)

        if (eventError || !data) {
            setError(
                eventError?.message ||
                'This event could not be found.'
            )
            return
        }

        setEvent(data)

        const [
            { count: ticketCount, error: ticketError },
            { count: checkedInCount, error: checkedInError },
            { count: teamCount, error: teamError },
        ] = await Promise.all([
            supabase
                .from('tickets')
                .select('*', {
                    count: 'exact',
                    head: true,
                })
                .eq('event_id', eventId),

            supabase
                .from('tickets')
                .select('*', {
                    count: 'exact',
                    head: true,
                })
                .eq('event_id', eventId)
                .eq('status', 'used'),

            supabase
                .from('event_members')
                .select('*', {
                    count: 'exact',
                    head: true,
                })
                .eq('event_id', eventId),
        ])

        console.log('EVENT 5 - ticket error:', ticketError)
        console.log('EVENT 5 - checked in error:', checkedInError)
        console.log('EVENT 5 - team error:', teamError)

        if (
            ticketError ||
            checkedInError ||
            teamError
        ) {
            setError(
                ticketError?.message ||
                checkedInError?.message ||
                teamError?.message ||
                'Unable to load event statistics.'
            )

            return
        }

        setStats({
            attendees: ticketCount || 0,
            tickets: ticketCount || 0,
            checkedIn: checkedInCount || 0,
            teamMembers: teamCount || 0,
        })
    } catch (error) {
        console.error('EVENT LOAD CRASH:', error)

        setError(
            error?.message ||
            'Something went wrong while loading the event.'
        )
    } finally {
        setLoading(false)
    }
}

useEffect(() => {
    if (!eventId) {
        return
    }

    void (async () => {
        await loadEvent()
    })()
}, [eventId])

    async function handlePosterUpload() {
    if (!posterFile) {
        setError('Please choose an image first.')
        return
    }

    if (!posterFile.type.startsWith('image/')) {
        setError('Please choose a valid image file.')
        return
    }

    const maxSize = 5 * 1024 * 1024

    if (posterFile.size > maxSize) {
        setError('Poster image must be smaller than 5MB.')
        return
    }

    setUploadingPoster(true)
    setError(null)

    const fileExtension =
        posterFile.name.split('.').pop()?.toLowerCase() || 'jpg'

    const filePath =
        `${eventId}/poster-${Date.now()}.${fileExtension}`

    const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(filePath, posterFile, {
            contentType: posterFile.type,
        })

    if (uploadError) {
        setError(uploadError.message)
        setUploadingPoster(false)
        return
    }

    const { data: publicUrlData } = supabase.storage
        .from('event-posters')
        .getPublicUrl(filePath)

    const posterUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase
        .from('events')
        .update({
            poster_url: posterUrl,
        })
        .eq('id', eventId)

    if (updateError) {
        setError(updateError.message)
        setUploadingPoster(false)
        return
    }

    setEvent((currentEvent) => ({
        ...currentEvent,
        poster_url: posterUrl,
    }))

    setPosterFile(null)
    setUploadingPoster(false)
}

    async function logout() {
        await supabase.auth.signOut()
        router.push('/admin/login')
        router.refresh()
    }

    if (loading || (!event && !error)) {
    return (
        <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </main>
    )
}

    if (!event && error) {
    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-4xl mx-auto px-6 py-10">

                <button
                    onClick={() => router.push('/admin/dashboard')}
                    className="text-gray-400 hover:text-white text-sm mb-8"
                >
                    ← Back to Dashboard
                </button>

                <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl px-5 py-4">
                    <h1 className="font-semibold text-lg">
                        Unable to load event
                    </h1>

                    <p className="text-sm mt-2">
                        {error}
                    </p>
                </div>

            </div>
        </main>
    )
}

    return (
        <main className="min-h-screen bg-gray-950 text-white">

            <div className="max-w-6xl mx-auto px-6 py-8">

                {/* Header */}
                <header className="flex items-center justify-between mb-8">

                    <button
                        onClick={() => router.push('/admin/dashboard')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back to Dashboard
                    </button>

                    <button
                        onClick={logout}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        Sign out
                    </button>

                </header>

                {error && (
    <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-xl px-5 py-4">
        {error}
    </div>
)}

                {/* Event heading */}
                <section className="mb-8">

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">

                        <div>

                            <p className="text-green-400 text-sm font-medium">
                                Event Management
                            </p>

                            <h1 className="text-3xl md:text-4xl font-bold mt-2">
                                {event.name}
                            </h1>

                            <p className="text-gray-400 mt-2">
                                Created{' '}
                                {new Date(event.created_at).toLocaleDateString()}
                            </p>

                        </div>

                        <span className="self-start text-sm px-3 py-1.5 rounded-full bg-green-950 text-green-300 border border-green-900">
                            {event.status}
                        </span>

                    </div>

                </section>

                {/* Event Poster */}
<section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">

    <div className="flex flex-col lg:flex-row gap-6">

        <div className="w-full lg:w-64">

            {event.poster_url ? (
                <img
                    src={event.poster_url}
                    alt={`${event.name} poster`}
                    className="w-full aspect-[4/5] object-cover rounded-xl border border-gray-800"
                />
            ) : (
                <div className="w-full aspect-[4/5] bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
                    No poster uploaded
                </div>
            )}

        </div>

        <div className="flex-1">

            <h2 className="text-lg font-semibold">
                Event Poster
            </h2>

            <p className="text-gray-400 text-sm mt-2">
                This image will be used on tickets generated for this event.
            </p>

            <div className="mt-5">

                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        setPosterFile(e.target.files?.[0] || null)
                        setError(null)
                    }}
                    className="block w-full text-sm text-gray-400
                        file:mr-4
                        file:py-2.5
                        file:px-4
                        file:rounded-lg
                        file:border-0
                        file:bg-gray-800
                        file:text-white
                        hover:file:bg-gray-700"
                />

            </div>

            {posterFile && (
                <p className="text-gray-500 text-sm mt-3">
                    Selected: {posterFile.name}
                </p>
            )}

            <button
                onClick={handlePosterUpload}
                disabled={!posterFile || uploadingPoster}
                className="mt-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-lg font-semibold"
            >
                {uploadingPoster
                    ? 'Uploading...'
                    : event.poster_url
                        ? 'Replace Poster'
                        : 'Upload Poster'}
            </button>

        </div>

    </div>

</section>

                {/* Overview */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm">
                            Attendees
                        </p>

                       <p className="text-3xl font-bold mt-2">
                          {stats.attendees}
                      </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm">
                            Tickets
                        </p>

                        <p className="text-3xl font-bold mt-2">
                            {stats.tickets}
                        </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm">
                            Checked In
                        </p>

                        <p className="text-3xl font-bold mt-2">
                         {stats.checkedIn}
                       </p>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm">
                            Team Members
                        </p>

                        <p className="text-3xl font-bold mt-2">
                            {stats.teamMembers}
                        </p>
                    </div>

                </section>

                {/* Main management options */}
                <section>

                    <div className="mb-5">
                        <h2 className="text-xl font-semibold">
                            Manage Event
                        </h2>

                        <p className="text-gray-400 text-sm mt-1">
                            Manage every part of this event from one place.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">

                        {/* Attendees */}
                        <button 
                        onClick={() => router.push(`/admin/events/${eventId}/attendees`)}
                            className="text-left bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 transition-colors"
                        >
                            <div className="text-3xl mb-4">
                                👥
                            </div>

                            <h3 className="text-lg font-semibold">
                                Attendees
                            </h3>

                            <p className="text-gray-400 text-sm mt-2">
                                Add and manage people attending your event.
                            </p>

                            <p className="text-green-400 text-sm mt-5">
                                Manage attendees →
                            </p>
                        </button>

                        {/* Tickets */}
                        <button
                            onClick={() =>
                            router.push(`/admin/events/${eventId}/tickets`)
                            } 
                            className="text-left bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 transition-colors"
                        >
                            <div className="text-3xl mb-4">
                                🎟️
                            </div>

                            <h3 className="text-lg font-semibold">
                                Tickets
                            </h3>

                            <p className="text-gray-400 text-sm mt-2">
                                Generate and manage tickets for this event.
                            </p>

                            <p className="text-green-400 text-sm mt-5">
                                Manage tickets →
                            </p>
                        </button>

                        {/* Scanner */}
                        <button
                            onClick={() =>
                           router.push(`/admin/events/${eventId}/scanner`)
                           }
                            className="text-left bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 transition-colors"
                        >
                            <div className="text-3xl mb-4">
                                📷
                            </div>

                            <h3 className="text-lg font-semibold">
                                Scan Tickets
                            </h3>

                            <p className="text-gray-400 text-sm mt-2">
                                Scan QR tickets and record attendance.
                            </p>

                            <p className="text-green-400 text-sm mt-5">
                                Open scanner →
                            </p>
                        </button>

                        {/* Team */}
                        <button
                            onClick={() =>
                            router.push(
                            `/admin/events/${eventId}/team`
                            )
                        }
                            className="text-left bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 transition-colors"
                        >
                            <div className="text-3xl mb-4">
                                🧑‍💼
                            </div>

                            <h3 className="text-lg font-semibold">
                                Team
                            </h3>

                            <p className="text-gray-400 text-sm mt-2">
                                Invite staff and manage event permissions.
                            </p>

                            <p className="text-green-400 text-sm mt-5">
                                Manage team →
                            </p>
                        </button>

                    </div>

                </section>

                {/* Event information */}
                <section className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl p-6">

                    <h2 className="text-lg font-semibold">
                        Event Information
                    </h2>

                    <div className="mt-5 space-y-4">

                        <div>
                            <p className="text-gray-500 text-sm">
                                Event ID
                            </p>

                            <p className="text-gray-300 text-sm font-mono mt-1 break-all">
                                {event.id}
                            </p>
                        </div>

                    </div>

                </section>

            </div>

        </main>
    )
}