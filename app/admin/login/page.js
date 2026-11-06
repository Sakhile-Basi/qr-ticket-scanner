'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
            'Account created. Check your email to confirm your account, then return to continue.'
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

    function switchMode(nextMode) {
        setMode(nextMode)
        setError(null)
        setMessage(null)
    }

    const fieldClasses = 'w-full rounded-lg border border-[#34445C] bg-[#172237] px-4 py-3 text-sm text-[#F3F6FC] placeholder:text-[#8799B1] outline-none transition-colors duration-150 focus-visible:border-[#3B82F6] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40'

    return (
        <main className="flex min-h-svh items-center justify-center bg-[#050913] px-6 py-12 font-sans text-[#F3F6FC]">
            <div className="w-full max-w-[440px]">
                <header className="mb-8 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#675B43] bg-[#F8F3E7]">
                            <Image
                                src="/digital-inkabi.jpeg"
                                alt="Digital Inkabi logo"
                                width={64}
                                height={64}
                                priority
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div>
                            <p className="text-base font-semibold tracking-tight">digital.inkabi</p>
                            <p className="mt-1 text-xs text-[#A7B7CC]">Event management</p>
                        </div>
                    </div>
                </header>

                <section className="relative overflow-hidden rounded-2xl border border-[#26364D] bg-[#101827] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:p-8" aria-labelledby="auth-title">
                    <span aria-hidden="true" className="absolute right-8 top-0 h-[3px] w-10 rounded-b bg-[#E32636]" />

                    <div className="mb-7">
                        <h1 id="auth-title" className="text-[28px] font-medium leading-tight tracking-tight">
                            {mode === 'login' ? 'Organiser access' : 'Create an account'}
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-[#A7B7CC]">
                            {mode === 'login'
                                ? 'Sign in to manage events, tickets and check-ins'
                                : 'Create an organiser account to manage your events'}
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-[#19263B] p-1" aria-label="Account access mode">
                        <button
                            type="button"
                            onClick={() => switchMode('login')}
                            aria-pressed={mode === 'login'}
                            className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6] ${
                                mode === 'login'
                                    ? 'bg-[#2B405F] text-white'
                                    : 'text-[#A7B7CC] hover:bg-[#23344D] hover:text-white'
                            }`}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode('signup')}
                            aria-pressed={mode === 'signup'}
                            className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6] ${
                                mode === 'signup'
                                    ? 'bg-[#2B405F] text-white'
                                    : 'text-[#A7B7CC] hover:bg-[#23344D] hover:text-white'
                            }`}
                        >
                            Create account
                        </button>
                    </div>

                    <form
                        className="flex flex-col gap-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            handleSubmit()
                        }}
                        noValidate
                        aria-busy={loading}
                    >
                        {mode === 'signup' && (
                            <div>
                                <label htmlFor="organiser-name" className="mb-2 block text-sm text-[#C2D0E1]">Full name</label>
                                <input
                                    id="organiser-name"
                                    name="name"
                                    type="text"
                                    value={fullName}
                                    onChange={(event) => setFullName(event.target.value)}
                                    placeholder="Your full name"
                                    autoComplete="name"
                                    className={fieldClasses}
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="organiser-email" className="mb-2 block text-sm text-[#C2D0E1]">Email address</label>
                            <input
                                id="organiser-email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                className={fieldClasses}
                            />
                        </div>

                        <div>
                            <label htmlFor="organiser-password" className="mb-2 block text-sm text-[#C2D0E1]">Password</label>
                            <input
                                id="organiser-password"
                                name="password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                className={fieldClasses}
                            />
                        </div>

                        {error && (
                            <div role="alert" className="rounded-lg border border-[#A73B48] bg-[#3A1821] px-4 py-3 text-sm leading-5 text-[#FFD8DD]">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div role="status" className="rounded-lg border border-[#357D65] bg-[#153A32] px-4 py-3 text-sm leading-5 text-[#CEF4E3]">
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 w-full rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#1D4ED8] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93C5FD] disabled:cursor-wait disabled:opacity-60"
                        >
                            {loading
                                ? mode === 'login' ? 'Signing in...' : 'Creating account...'
                                : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                </section>
            </div>
        </main>
    )
}