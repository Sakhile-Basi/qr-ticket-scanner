'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function JoinEventPage() {
    const params = useParams()
    const router = useRouter()
    const supabase = createClient()
    const joinStartedRef = useRef(false)


    const token = params.token

    const [message, setMessage] =
        useState('Joining event...')

    const [error, setError] =
        useState(null)

    async function joinEvent() {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                const next =
                    `/admin/join/${token}`

                router.replace(
                    `/admin/login?next=${encodeURIComponent(
                        next
                    )}`
                )

                return
            }

            const response = await fetch(
                '/api/events/join',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                    },
                    body: JSON.stringify({
                        invite_token: token,
                    }),
                }
            )

            const data =
                await response.json()

            if (!response.ok) {
                setError(
                    data.error ||
                        'Unable to join event.'
                )

                return
            }

            setMessage(
                data.already_member
                    ? 'Opening event...'
                    : `Joined ${data.event.name}. Opening event...`
            )

            router.replace(
                `/admin/events/${data.event.id}`
            )
        } catch (error) {
            console.error(
                'Join page error:',
                error
            )

            setError(
                'Something went wrong while joining the event.'
            )
        }
    }

    useEffect(() => {
    if (!token) return
    if (joinStartedRef.current) return

    joinStartedRef.current = true

    void joinEvent()
}, [token])

    return (
        <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">

                {error ? (
                    <>
                        <h1 className="text-xl font-bold text-red-400">
                            Unable to Join Event
                        </h1>

                        <p className="text-gray-400 mt-3">
                            {error}
                        </p>

                        <button
                            onClick={() =>
                                router.push(
                                    '/admin/dashboard'
                                )
                            }
                            className="mt-6 bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-lg font-semibold"
                        >
                            Go to Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />

                        <p className="text-gray-300 mt-5">
                            {message}
                        </p>
                    </>
                )}

            </div>
        </main>
    )
}