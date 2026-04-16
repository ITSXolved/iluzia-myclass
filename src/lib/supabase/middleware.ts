import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Skip auth when Supabase is not yet configured (dev/preview mode)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl.includes('placeholder') || !supabaseUrl.startsWith('https://')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/signup', '/player', '/payment', '/payment/success', '/payment/failure'];
  const isPublicRoute = publicRoutes.some(route => pathname === route);
  const isApiRoute = pathname.startsWith('/api/');
  const isStaticRoute = pathname.startsWith('/_next/') || pathname.startsWith('/favicon');

  if (isStaticRoute || isApiRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in, check role for admin/student routes
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Redirect admin trying to access student routes
      if (pathname.startsWith('/student') && profile.role === 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin';
        return NextResponse.redirect(url);
      }

      // Redirect student trying to access admin routes
      if (pathname.startsWith('/admin') && profile.role === 'student') {
        const url = request.nextUrl.clone();
        url.pathname = '/student';
        return NextResponse.redirect(url);
      }

      // Redirect logged-in users from login/signup to their dashboard
      if (pathname === '/login' || pathname === '/signup') {
        const url = request.nextUrl.clone();
        url.pathname = profile.role === 'admin' ? '/admin' : '/student';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
