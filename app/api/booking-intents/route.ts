import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/supabase-admin';
import { consumeRateLimit, isSameSiteRequest, verifyTurnstile } from '@/lib/server/request-protection';
import { upcomingDays } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

type IntentPayload = {
  action?: unknown;
  barberId?: unknown;
  serviceId?: unknown;
  date?: unknown;
  time?: unknown;
  period?: unknown;
  identity?: { name?: unknown; phone?: unknown; email?: unknown };
  termsAccepted?: unknown;
  captchaToken?: unknown;
};

const periods = new Set(['manha', 'tarde', 'noite', 'qualquer']);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 });
  if (!await consumeRateLimit(admin, request, 'booking-intent', 5, 900)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429, headers: { 'Retry-After': '900' } });
  }

  const rawBody = await request.text();
  if (rawBody.length > 16_000) return NextResponse.json({ error: 'Payload muito grande.' }, { status: 413 });
  let body: IntentPayload | null = null;
  try { body = JSON.parse(rawBody) as IntentPayload; } catch { body = null; }
  const action = body?.action;
  const barberId = Number(body?.barberId);
  const serviceId = Number(body?.serviceId);
  const date = typeof body?.date === 'string' ? body.date : '';
  const time = typeof body?.time === 'string' ? body.time : '';
  const period = typeof body?.period === 'string' ? body.period : 'qualquer';
  const name = typeof body?.identity?.name === 'string' ? body.identity.name.trim() : '';
  const phone = typeof body?.identity?.phone === 'string' ? body.identity.phone.trim() : '';
  const email = typeof body?.identity?.email === 'string' ? body.identity.email.trim().toLowerCase() : '';
  const captchaToken = typeof body?.captchaToken === 'string' ? body.captchaToken : '';

  const allowedDates = new Set(upcomingDays(91).map((choice) => choice.iso));
  const invalid = (action !== 'book' && action !== 'waitlist')
    || !Number.isSafeInteger(barberId) || barberId <= 0
    || !Number.isSafeInteger(serviceId) || serviceId <= 0
    || !isoDate.test(date) || !allowedDates.has(date)
    || (action === 'book' && !clockTime.test(time))
    || !periods.has(period)
    || name.length < 2 || name.length > 120
    || phone.replace(/\D/g, '').length < 10 || phone.length > 30
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320
    || body?.termsAccepted !== true;
  if (invalid) return NextResponse.json({ error: 'Confira os dados do agendamento.' }, { status: 400 });

  const captcha = await verifyTurnstile(captchaToken, request);
  if (!captcha.ok) return NextResponse.json({ error: 'Não foi possível validar a verificação de segurança.' }, { status: 400 });

  const [{ data: barber }, { data: service }] = await Promise.all([
    admin.from('barbeiros').select('barbearia_id, ativo').eq('id', barberId).maybeSingle(),
    admin.from('servicos').select('id').eq('id', serviceId).eq('barbeiro_id', barberId).maybeSingle(),
  ]);
  const { data: business } = barber
    ? await admin.from('barbearias').select('agendamento_publico, ativa').eq('id', barber.barbearia_id).maybeSingle()
    : { data: null };
  if (!business?.ativa || !business.agendamento_publico || !barber?.ativo || !service) {
    return NextResponse.json({ error: 'Esta opção de agendamento não está disponível.' }, { status: 409 });
  }

  if (action === 'book') {
    const { data: availableSlots, error: slotsError } = await admin.rpc('buscar_horarios_disponiveis', {
      p_barbeiro_id: barberId,
      p_servico_id: serviceId,
      p_data: date,
    });
    const stillAvailable = !slotsError && availableSlots?.some((slot) => slot.horario.slice(0, 5) === time);
    if (!stillAvailable) {
      return NextResponse.json({ error: 'Este período não está mais disponível. Atualize os horários e escolha outro.' }, { status: 409 });
    }
  }

  const { data, error } = await admin.from('booking_intents').insert({
    action,
    barber_id: barberId,
    service_id: serviceId,
    booking_date: date,
    booking_time: action === 'book' ? `${time}:00` : null,
    period: period as 'manha' | 'tarde' | 'noite' | 'qualquer',
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    terms_accepted: true,
  }).select('token').single();

  if (error || !data) return NextResponse.json({ error: 'Não foi possível preparar o agendamento.' }, { status: 500 });
  return NextResponse.json({ token: data.token, expiresIn: 1800 }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
