import { NextResponse } from 'next/server'

export function proxy(request) {
  const authCookie = request.cookies.get('admin_auth')
  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}