import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
    const requestUrl = new URL(request.url)

    const code =
        requestUrl.searchParams.get('code')

    const requestedNext =
        requestUrl.searchParams.get('next')

    const next =
        requestedNext &&
        requestedNext.startsWith('/admin/')
            ? requestedNext
            : '/admin/dashboard'

    if (!code) {
        const errorUrl =
            new URL(
                '/admin/login',
                requestUrl.origin
            )

        errorUrl.searchParams.set(
            'error',
            'Invalid confirmation link'
        )

        return NextResponse.redirect(errorUrl)
    }

    const supabase = await createClient()

    const { error } =
        await supabase.auth.exchangeCodeForSession(
            code
        )

    if (error) {
        console.error(
            'Auth callback error:',
            error
        )

        const errorUrl =
            new URL(
                '/admin/login',
                requestUrl.origin
            )

        errorUrl.searchParams.set(
            'error',
            'Unable to confirm account'
        )

        return NextResponse.redirect(errorUrl)
    }

    return NextResponse.redirect(
        new URL(
            next,
            requestUrl.origin
        )
    )
}