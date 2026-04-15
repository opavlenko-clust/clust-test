import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = [
  '/sign-in',
  '/sign-up',
  '/setup',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (user && pathname.startsWith('/admin')) {
    const role = user.user_metadata?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
