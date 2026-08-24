import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

export function isSameSiteRequest(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function consumeRateLimit(
  admin: SupabaseClient<Database>,
  request: Request,
  scope: string,
  maxRequests: number,
  windowSeconds: number,
) {
  const secret = process.env.RATE_LIMIT_SALT
    ?? process.env.CRON_SECRET
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? 'agenda-brasil-local';
  const keyHash = createHash('sha256')
    .update(`${scope}:${getClientIp(request)}:${secret}`)
    .digest('hex');
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    p_key_hash: keyHash,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[Agenda Brasil rate limit]', error.message);
    return process.env.NODE_ENV !== 'production';
  }
  return data === true;
}

export async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, configured: false };
  if (!token) return { ok: false, configured: true };

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: getClientIp(request),
  });

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as { success?: boolean };
    return { ok: response.ok && result.success === true, configured: true };
  } catch {
    return { ok: false, configured: true };
  }
}
