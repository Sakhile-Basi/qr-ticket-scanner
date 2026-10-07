'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()

    const [mode, setMode] = useState('login')

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [error, setError] = useState(null)
    const [message, setMessage] = useState(null)
    const [loading, setLoading] = useState(false)

    function getDestination() {
        const searchParams = new URLSearchParams(
            window.location.search
        )

        const next = searchParams.get('next')

        if (
            next &&
            next.startsWith('/admin/')
        ) {
            return next
        }

        return '/admin/dashboard'
    }

    async function handleLogin() {
        if (!email.trim()) {
            setError('Please enter your email.')
            return
        }

        if (!password.trim()) {
            setError('Please enter your password.')
            return
        }

        setLoading(true)
        setError(null)
        setMessage(null)

        const { error: loginError } =
            await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            })

        if (loginError) {
            setError(loginError.message)
            setLoading(false)
            return
        }

        const destination = getDestination()

        router.replace(destination)
        router.refresh()
    }

    async function handleSignUp() {
        if (!fullName.trim()) {
            setError('Please enter your full name.')
            return
        }

        if (!email.trim()) {
            setError('Please enter your email.')
            return
        }

        if (password.length < 6) {
            setError(
                'Password must be at least 6 characters.'
            )
            return
        }

        setLoading(true)
        setError(null)
        setMessage(null)

        const destination = getDestination()

        const callbackUrl =
            `${window.location.origin}/auth/callback?next=${encodeURIComponent(
                destination
            )}`

        const {
            data,
            error: signUpError,
        } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: {
                    full_name: fullName.trim(),
                },
                emailRedirectTo: callbackUrl,
            },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
            return
        }

        /*
         * If email confirmation is disabled,
         * Supabase gives us a session immediately.
         */
        if (data.session) {
            router.replace(destination)
            router.refresh()
            return
        }

        /*
         * If email confirmation is enabled,
         * they must confirm their email first.
         */
        setMessage(
            'Account created. Check your email to confirm your account, then you will continue to the event invitation.'
        )

        setLoading(false)
    }

    function handleSubmit() {
        if (loading) return

        if (mode === 'login') {
            handleLogin()
        } else {
            handleSignUp()
        }
    }

    function handleKeyDown(event) {
        if (event.key === 'Enter') {
            handleSubmit()
        }
    }

    function switchMode(nextMode) {
        setMode(nextMode)
        setError(null)
        setMessage(null)
    }

    return (
        <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">

            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8">

                <div className="text-center mb-7">

                    <h1 className="text-2xl font-bold">
                        {mode === 'login'
                            ? 'Organiser Login'
                            : 'Create Organiser Account'}
                    </h1>

                    <p className="text-gray-400 text-sm mt-2">
                        {mode === 'login'
                            ? 'Sign in to manage your events.'
                            : 'Create an account to join and manage events.'}
                    </p>

                </div>

                {/* Login / Sign-up tabs */}
                <div className="grid grid-cols-2 bg-gray-800 rounded-xl p-1 mb-6">

                    <button
                        type="button"
                        onClick={() =>
                            switchMode('login')
                        }
                        className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                            mode === 'login'
                                ? 'bg-gray-700 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Sign In
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            switchMode('signup')
                        }
                        className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                            mode === 'signup'
                                ? 'bg-gray-700 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Create Account
                    </button>

                </div>

                <div className="flex flex-col gap-4">

                    {mode === 'signup' && (
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">
                                Full Name
                            </label>

                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) =>
                                    setFullName(
                                        e.target.value
                                    )
                                }
                                onKeyDown={
                                    handleKeyDown
                                }
                                placeholder="e.g. Sakhile Basi"
                                autoComplete="name"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            onKeyDown={
                                handleKeyDown
                            }
                            placeholder="you@example.com"
                            autoComplete="email"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) =>
                                setPassword(
                                    e.target.value
                                )
                            }
                            onKeyDown={
                                handleKeyDown
                            }
                            placeholder={
                                mode === 'signup'
                                    ? 'At least 6 characters'
                                    : 'Password'
                            }
                            autoComplete={
                                mode === 'signup'
                                    ? 'new-password'
                                    : 'current-password'
                            }
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="bg-green-950 border border-green-800 text-green-300 rounded-lg px-4 py-3 text-sm">
                            {message}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg py-3 font-semibold transition-colors"
                    >
                        {loading
                            ? mode === 'login'
                                ? 'Signing in...'
                                : 'Creating account...'
                            : mode === 'login'
                              ? 'Sign In'
                              : 'Create Account'}
                    </button>

                </div>

            </div>

        </main>
    )
}