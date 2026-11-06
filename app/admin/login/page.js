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

    const fieldClasses = 'w-full rounded-lg border border-[#D9CDBB] bg-[#FFFEFA] px-4 py-3 text-sm text-[#1D1A16] placeholder:text-[#80786D] outline-none transition-colors duration-150 focus-visible:border-[#A97932] focus-visible:ring-2 focus-visible:ring-[#A97932]/25'

    return (
        <main className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-[#EDE3D1] px-6 py-12 font-sans text-[#1D1A16]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-repeat opacity-[0.22] blur-[3px]"
                style={{
                    backgroundImage: "url('/digital-inkabi-pattern.svg')",
                    backgroundSize: '640px 540px',
                    maskImage: 'radial-gradient(ellipse at center, transparent 18%, black 82%)',
                }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-[#F8F0E2]/25" />

            <div className="relative z-10 w-full max-w-[440px]">
                <section className="rounded-2xl border border-[#D6C6AD] bg-[#FFF9EE] p-6 shadow-[0_24px_72px_rgba(64,42,16,0.16)] sm:p-8" aria-labelledby="auth-title">
                    <header className="mb-7 flex flex-col items-center text-center">
                        <div className="h-16 w-16 overflow-hidden rounded-xl border border-[#DDCFB7] bg-[#F8F3E7]">
                            <Image
                                src="/digital-inkabi.jpeg"
                                alt="Digital Inkabi logo"
                                width={64}
                                height={64}
                                priority
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <p className="mt-3 text-base font-semibold tracking-tight">digital.inkabi</p>
                        <p className="mt-1 text-xs text-[#6F6658]">Event management</p>
                    </header>

                    <div className="mb-7 text-center">
                        <h1 id="auth-title" className="text-[28px] font-medium leading-tight tracking-tight text-[#1D1A16]">
                            {mode === 'login' ? 'Organiser access' : 'Create an account'}
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-[#665E53]">
                            {mode === 'login'
                                ? 'Sign in to manage events, tickets and check-ins'
                                : 'Create an organiser account to manage your events'}
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-[#EDE5D9] p-1" aria-label="Account access mode">
                        <button
                            type="button"
                            onClick={() => switchMode('login')}
                            aria-pressed={mode === 'login'}
                            className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932] ${
                                mode === 'login'
                                    ? 'bg-[#FFFEFA] text-[#1D1A16] shadow-[0_1px_3px_rgba(64,42,16,0.09)]'
                                    : 'text-[#665E53] hover:bg-[#F6EFE5] hover:text-[#1D1A16]'
                            }`}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode('signup')}
                            aria-pressed={mode === 'signup'}
                            className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932] ${
                                mode === 'signup'
                                    ? 'bg-[#FFFEFA] text-[#1D1A16] shadow-[0_1px_3px_rgba(64,42,16,0.09)]'
                                    : 'text-[#665E53] hover:bg-[#F6EFE5] hover:text-[#1D1A16]'
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
                                <label htmlFor="organiser-name" className="mb-2 block text-sm text-[#4C453B]">Full name</label>
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
                            <label htmlFor="organiser-email" className="mb-2 block text-sm text-[#4C453B]">Email address</label>
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
                            <label htmlFor="organiser-password" className="mb-2 block text-sm text-[#4C453B]">Password</label>
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
                            <div role="alert" className="rounded-lg border border-[#DDA09E] bg-[#FFF1EF] px-4 py-3 text-sm leading-5 text-[#842E2A]">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div role="status" className="rounded-lg border border-[#A6C0A4] bg-[#EEF5EA] px-4 py-3 text-sm leading-5 text-[#285C38]">
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 w-full rounded-lg bg-[#1D1A16] px-4 py-3 text-sm font-semibold text-[#FFF9EE] transition-[background-color,transform] duration-150 hover:bg-[#3C3025] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A97932] disabled:cursor-wait disabled:opacity-60"
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
