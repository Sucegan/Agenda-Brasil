import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { publicSupabaseAnonKey, publicSupabaseUrl } from '@/lib/public-env';

const AUTH_TIMEOUT_MS = 8_000;

function copyAuthState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  ['cache-control', 'expires', 'pragma'].forEach((header) => {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  });
  return target;
}

function withTimeout<T>(operation: Promise<T>, milliseconds: number) {
  let timeout: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Tempo limite de autenticação excedido.')), milliseconds);
  });
  return Promise.race([operation, expired]).finally(() => clearTimeout(timeout));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(publicSupabaseUrl, publicSupabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data, error } = await withTimeout(supabase.auth.getClaims(), AUTH_TIMEOUT_MS);
    if (!error && typeof data?.claims?.sub === 'string') userId = data.claims.sub;
  } catch {
    return response;
  }

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  if (isDashboard && !userId) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('motivo', 'sessao-expirada');
    return copyAuthState(response, NextResponse.redirect(loginUrl));
  }

  // Keep the login page reachable even when the browser still has an old
  // cookie. Redirecting `/` from middleware could trap a user with a valid JWT
  // but an unusable client session in a `/` <-> `/dashboard` loop.
  return response;
}

export const config = { matcher: ['/', '/dashboard/:path*'] };
