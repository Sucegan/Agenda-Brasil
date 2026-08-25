import { NextResponse } from 'next/server';
import { flushEmailNotifications } from '@/lib/server/notification-queue';
import { consumeRateLimit, isSameSiteRequest } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const { admin, user } = await getAuthenticatedUser(request);
  if (!admin || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `notification-flush:${user.id}`, 20, 300)) {
    return NextResponse.json({ error: 'Muitas solicitações.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as { appointmentId?: unknown };
  const appointmentId = Number(body.appointmentId);
  let targetUserId = user.id;
  if (Number.isSafeInteger(appointmentId) && appointmentId > 0) {
    const { data: appointment } = await admin.from('agendamentos').select('cliente_id,barbeiro_id').eq('id', appointmentId).maybeSingle();
    if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
    const [{ data: client }, { data: barber }] = await Promise.all([
      admin.from('clientes').select('usuario_id').eq('id', appointment.cliente_id).maybeSingle(),
      admin.from('barbeiros').select('usuario_id,barbearia_id').eq('id', appointment.barbeiro_id).maybeSingle(),
    ]);
    let isGlobalAdmin = false;
    if (client && barber && client.usuario_id !== user.id && barber.usuario_id !== user.id) {
      const { data: profile } = await admin.from('usuarios').select('tipo').eq('id', user.id).maybeSingle();
      isGlobalAdmin = profile?.tipo === 'admin';
    }
    if (!client || (client.usuario_id !== user.id && barber?.usuario_id !== user.id && !isGlobalAdmin)) {
      return NextResponse.json({ error: 'Sem permissão para este agendamento.' }, { status: 403 });
    }
    targetUserId = client.usuario_id;
  }

  const result = await flushEmailNotifications(admin, targetUserId, Number.isSafeInteger(appointmentId) ? appointmentId : undefined);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
