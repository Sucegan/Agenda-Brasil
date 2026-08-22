import { NextResponse } from 'next/server';
import { createAdminClient, getAuthenticatedUser } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['erro_cliente', 'erro_servidor', 'web_vital']);

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 32_000) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 });
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site'].includes(fetchSite)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });

  const body = await request.json().catch(() => null) as null | { tipo?: string; rota?: string; mensagem?: string; contexto?: Record<string, unknown> };
  if (!body || !body.tipo || !allowedTypes.has(body.tipo) || typeof body.mensagem !== 'string') {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  }

  const { user } = await getAuthenticatedUser(request);
  const admin = createAdminClient();
  const event = {
    usuario_id: user?.id ?? null,
    tipo: body.tipo as 'erro_cliente' | 'erro_servidor' | 'web_vital',
    rota: String(body.rota ?? '/').slice(0, 300),
    mensagem: body.mensagem.slice(0, 2_000),
    contexto: body.contexto ?? {},
  };

  if (admin) {
    const { error } = await admin.from('telemetria_eventos').insert(event);
    if (error) return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 500 });
  } else if (process.env.NODE_ENV !== 'test') {
    console.error('[Agenda Brasil telemetry]', event);
  }

  return new NextResponse(null, { status: 204 });
}
