import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/token'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // Validate the user token against Supabase Auth (safe against spoofing)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Verify active POS staff PIN session token (HMAC signed)
  const staffSessionCookie = request.cookies.get('kitchflow_staff_session')?.value
  const staffSession = staffSessionCookie ? await verifySessionToken(staffSessionCookie) : null
  const hasStaffSession = !!staffSession

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'

  // Public routes that anyone can access without being logged in
  const isPublicRoute =
    isLoginPage ||
    pathname.startsWith('/invoice') ||
    pathname.startsWith('/admin') ||
    pathname === '/' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'

  const isAuthenticated = !!user || hasStaffSession

  // Protected kitchen routes: /orders, /kds, /inventory, /margins, /packing, /pos, /delivery
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Enforce granular route permissions for non-owner staff
  if (staffSession && staffSession.role !== 'owner' && !isPublicRoute) {
    const permissions: string[] = Array.isArray(staffSession.permissions)
      ? staffSession.permissions
      : ['orders', 'kds', 'packing']

    const routePermissionMap: Record<string, string> = {
      '/margins': 'margins',
      '/inventory': 'inventory',
      '/settings': 'settings',
      '/kds': 'kds',
      '/packing': 'packing',
      '/orders': 'orders',
      '/pos': 'pos',
    }

    for (const [routePrefix, requiredPerm] of Object.entries(routePermissionMap)) {
      if (pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)) {
        if (!permissions.includes(requiredPerm)) {
          // Find first allowed route for this staff member
          const allowedRoute = ['/orders', '/kds', '/packing', '/pos', '/inventory']
            .find((r) => permissions.includes(routePermissionMap[r])) || '/pos'

          const url = request.nextUrl.clone()
          url.pathname = allowedRoute
          return NextResponse.redirect(url)
        }
        break
      }
    }
  }

  // If user is already authenticated and visits /login, redirect to /pos or /orders
  if (isAuthenticated && isLoginPage) {
    const url = request.nextUrl.clone()
    if (staffSession && staffSession.role !== 'owner') {
      const perms: string[] = Array.isArray(staffSession.permissions) ? staffSession.permissions : []
      const fallback = ['/orders', '/kds', '/packing', '/pos'].find(r => perms.includes(r.replace('/', ''))) || '/orders'
      url.pathname = fallback
    } else {
      url.pathname = hasStaffSession ? '/pos' : '/orders'
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
