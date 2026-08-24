import { NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { admin, user } = await getAuthenticatedUser(request);
  if (!admin || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `business-health:${user.id}`, 30, 60)) {
    return NextResponse.json({ error: 'Limite de consultas excedido.' }, { status: 429 });
  }
  const { data: barber } = await admin.from('barbeiros').select('id').eq('usuario_id', user.id).maybeSingle();
  if (!barber) return NextResponse.json({ error: 'Acesso restrito a profissionais.' }, { status: 403 });

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await admin.from('notificacoes').select('canal,status').gte('created_at', since);
  if (error) return NextResponse.json({ error: 'Não foi possível consultar as automações.' }, { status: 500 });
  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = `${row.canal}:${row.status}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    providers: {
      email: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_FROM),
      whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    },
    counts,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
