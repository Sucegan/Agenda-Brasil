import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import { publicSupabaseAnonKey, publicSupabaseUrl } from '@/lib/public-env';
import { consumeRateLimit, isSameSiteRequest } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(token)) return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 });

  const { admin, user } = await getAuthenticatedUser(request);
  if (!admin || !user?.email) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `booking-complete:${user.id}`, 8, 900)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429, headers: { 'Retry-After': '900' } });
  }

  const { data: intent, error: intentError } = await admin
    .from('booking_intents')
    .select('*')
    .eq('token', token)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (intentError || !intent) return NextResponse.json({ error: 'Este link expirou ou já foi utilizado.' }, { status: 410 });
  if (intent.customer_email !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Use o mesmo e-mail informado no agendamento.' }, { status: 403 });
  }

  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
  const userClient = createClient<Database>(publicSupabaseUrl, publicSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = intent.action === 'book'
    ? await userClient.rpc('criar_agendamento_com_origem', {
        p_barbeiro_id: intent.barber_id,
        p_servico_id: intent.service_id,
        p_data: intent.booking_date,
        p_horario: intent.booking_time ?? '',
        p_origem: 'link_publico',
      })
    : await userClient.rpc('entrar_fila_espera', {
        p_barbeiro_id: intent.barber_id,
        p_servico_id: intent.service_id,
        p_data: intent.booking_date,
        p_periodo: intent.period,
      });

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 409 });
  await admin.from('booking_intents').update({ consumed_at: new Date().toISOString() }).eq('token', token).is('consumed_at', null);
  return NextResponse.json({ completed: true, action: intent.action }, { headers: { 'Cache-Control': 'no-store' } });
}
