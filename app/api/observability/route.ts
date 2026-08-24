import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';
import { consumeRateLimit, isSameSiteRequest } from '@/lib/server/request-protection';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['erro_cliente', 'erro_servidor', 'web_vital']);
type ObservabilityBody = { tipo?: string; rota?: string; mensagem?: string; contexto?: Record<string, unknown> };

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 32_000) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 });
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });

  const rawBody = await request.text();
  if (rawBody.length > 32_000) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 });
  let body: ObservabilityBody | null = null;
  try { body = JSON.parse(rawBody) as ObservabilityBody; } catch { body = null; }
  if (!body || !body.tipo || !allowedTypes.has(body.tipo) || typeof body.mensagem !== 'string') {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  }

  const { admin, user } = await getAuthenticatedUser(request);
  if (admin && !await consumeRateLimit(admin, request, 'observability', 30, 60)) {
    return NextResponse.json({ error: 'Limite de eventos excedido.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  let safeContext: Record<string, unknown> = {};
  try {
    const serialized = JSON.stringify(body.contexto ?? {});
    if (serialized.length <= 16_000) safeContext = JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    safeContext = {};
  }
  const event = {
    usuario_id: user?.id ?? null,
    tipo: body.tipo as 'erro_cliente' | 'erro_servidor' | 'web_vital',
    rota: String(body.rota ?? '/').slice(0, 300),
    mensagem: body.mensagem.slice(0, 2_000),
    contexto: safeContext,
  };

  if (admin) {
    const { error } = await admin.from('telemetria_eventos').insert(event);
    if (error) return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 500 });
  } else if (process.env.NODE_ENV !== 'test') {
    console.error('[Agenda Brasil telemetry]', event);
  }

  return new NextResponse(null, { status: 204 });
}
