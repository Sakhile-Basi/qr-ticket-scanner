'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TeamPage() {
    const params = useParams()
    const router = useRouter()

    const eventId = params.eventId

    const [event, setEvent] = useState(null)
    const [members, setMembers] = useState([])
    const [currentUserId, setCurrentUserId] =
        useState(null)

    const [loading, setLoading] =
        useState(true)

    const [error, setError] =
        useState(null)

    const [copied, setCopied] =
        useState(false)

    const [removingId, setRemovingId] =
        useState(null)

    useEffect(() => {
        if (!eventId) return

        loadTeam()
    }, [eventId])

    async function loadTeam() {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(
                `/api/events/team?event_id=${encodeURIComponent(
                    eventId
                )}`
            )

            const data =
                await response.json()

            if (!response.ok) {
                setError(
                    data.error ||
                        'Unable to load team.'
                )

                return
            }

            setEvent(data.event)
            setMembers(data.members || [])
            setCurrentUserId(
                data.current_user_id
            )
        } catch (error) {
            console.error(
                'Load team error:',
                error
            )

            setError(
                'Something went wrong while loading the team.'
            )
        } finally {
            setLoading(false)
        }
    }

    async function copyInviteLink() {
        if (!event?.invite_token) return

        const inviteLink =
            `${window.location.origin}/admin/join/${event.invite_token}`

        try {
            await navigator.clipboard.writeText(
                inviteLink
            )

            setCopied(true)

            setTimeout(() => {
                setCopied(false)
            }, 2000)
        } catch {
            setError(
                'Unable to copy invitation link.'
            )
        }
    }

    async function removeMember(member) {
        const name =
            member.profiles?.full_name ||
            'this organiser'

        const confirmed =
            window.confirm(
                `Remove ${name} from this event?`
            )

        if (!confirmed) return

        setRemovingId(member.id)
        setError(null)

        try {
            const response = await fetch(
                '/api/events/team',
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        event_id: eventId,
                        member_id: member.id,
                    }),
                }
            )

            const data =
                await response.json()

            if (!response.ok) {
                setError(
                    data.error ||
                        'Unable to remove organiser.'
                )

                return
            }

            setMembers(
                (currentMembers) =>
                    currentMembers.filter(
                        (currentMember) =>
                            currentMember.id !==
                            member.id
                    )
            )
        } catch (error) {
            console.error(
                'Remove member error:',
                error
            )

            setError(
                'Something went wrong while removing the organiser.'
            )
        } finally {
            setRemovingId(null)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-gray-400">
                    Loading team...
                </p>
            </main>
        )
    }

    if (!event) {
        return (
            <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
                <div className="text-center">
                    <p className="text-red-400 mb-5">
                        {error ||
                            'Unable to load team.'}
                    </p>

                    <button
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}`
                            )
                        }
                        className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-lg"
                    >
                        Back to Event
                    </button>
                </div>
            </main>
        )
    }

    const isOwner =
        event.owner_id === currentUserId

    const inviteLink =
        typeof window !== 'undefined'
            ? `${window.location.origin}/admin/join/${event.invite_token}`
            : ''

    return (
        <main className="min-h-screen bg-gray-950 text-white">
            <div className="max-w-5xl mx-auto px-6 py-8">

                <header className="mb-8">
                    <button
                        onClick={() =>
                            router.push(
                                `/admin/events/${eventId}`
                            )
                        }
                        className="text-gray-400 hover:text-white text-sm mb-4"
                    >
                        ← Back to Event
                    </button>

                    <h1 className="text-3xl font-bold">
                        Event Team
                    </h1>

                    <p className="text-gray-400 mt-2">
                        {event.name}
                    </p>
                </header>

                {error && (
                    <div className="mb-6 bg-red-950 border border-red-800 text-red-300 rounded-xl px-5 py-4">
                        {error}
                    </div>
                )}

                {isOwner && (
                    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
                        <h2 className="text-xl font-semibold">
                            Invite Organisers
                        </h2>

                        <p className="text-gray-400 text-sm mt-2">
                            Anyone with this link can join
                            this event as an organiser after
                            signing in.
                        </p>

                        <div className="flex flex-col md:flex-row gap-3 mt-5">
                            <input
                                type="text"
                                readOnly
                                value={inviteLink}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300"
                            />

                            <button
                                onClick={
                                    copyInviteLink
                                }
                                className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-lg font-semibold"
                            >
                                {copied
                                    ? 'Copied'
                                    : 'Copy Invite Link'}
                            </button>
                        </div>

                        <p className="text-gray-500 text-xs mt-4">
                            Invite token:{' '}
                            <span className="font-mono">
                                {
                                    event.invite_token
                                }
                            </span>
                        </p>
                    </section>
                )}

                <section>
                    <div className="mb-5">
                        <h2 className="text-xl font-semibold">
                            Team Members
                        </h2>

                        <p className="text-gray-400 text-sm mt-1">
                            {members.length}{' '}
                            {members.length === 1
                                ? 'member'
                                : 'members'}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {members.map((member) => {
                            const isEventOwner =
                                member.role ===
                                    'owner' ||
                                member.user_id ===
                                    event.owner_id

                            return (
                                <div
                                    key={member.id}
                                    className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                                >
                                    <div>
                                        <p className="font-semibold">
                                            {member
                                                .profiles
                                                ?.full_name ||
                                                'Organiser'}

                                            {member.user_id ===
                                                currentUserId && (
                                                <span className="text-gray-500 font-normal ml-2">
                                                    You
                                                </span>
                                            )}
                                        </p>

                                        <div className="flex items-center gap-3 mt-2">
                                            <span
                                                className={`text-xs px-2.5 py-1 rounded-full ${
                                                    isEventOwner
                                                        ? 'bg-green-950 text-green-300'
                                                        : 'bg-gray-800 text-gray-300'
                                                }`}
                                            >
                                                {
                                                    member.role
                                                }
                                            </span>

                                            <span className="text-gray-500 text-xs">
                                                Joined{' '}
                                                {new Date(
                                                    member.joined_at
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>

                                    {isOwner &&
                                        !isEventOwner && (
                                            <button
                                                onClick={() =>
                                                    removeMember(
                                                        member
                                                    )
                                                }
                                                disabled={
                                                    removingId ===
                                                    member.id
                                                }
                                                className="bg-red-950 hover:bg-red-900 text-red-300 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
                                            >
                                                {removingId ===
                                                member.id
                                                    ? 'Removing...'
                                                    : 'Remove'}
                                            </button>
                                        )}
                                </div>
                            )
                        })}
                    </div>
                </section>

            </div>
        </main>
    )
}