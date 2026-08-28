import { NextResponse } from 'next/server';
import { consumeRateLimit, isSameSiteRequest } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';
import { getStripe, isStripeTestMode } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

type CheckoutPayload = { appointmentId?: unknown; planId?: unknown; kind?: unknown };

export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const stripe = getStripe();
  const { admin, user } = await getAuthenticatedUser(request);
  if (!stripe) return NextResponse.json({ error: 'Pagamento online ainda não está configurado.' }, { status: 503 });
  if (!admin || !user?.email) return NextResponse.json({ error: 'Entre como cliente para pagar.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `checkout:${user.id}`, 8, 900)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 2_000) return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
  let body: CheckoutPayload;
  try { body = JSON.parse(raw) as CheckoutPayload; } catch { return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const appointmentId = Number(body.appointmentId);
  const planId = Number(body.planId);
  const hasAppointment = Number.isSafeInteger(appointmentId) && appointmentId > 0;
  const hasPlan = Number.isSafeInteger(planId) && planId > 0;
  if (hasAppointment === hasPlan) return NextResponse.json({ error: 'Escolha um agendamento ou plano.' }, { status: 400 });

  const { data: profile } = await admin.from('usuarios').select('tipo').eq('id', user.id).maybeSingle();
  if (profile?.tipo !== 'cliente') return NextResponse.json({ error: 'Apenas clientes podem iniciar pagamentos.' }, { status: 403 });

  try {
    const checkout = hasAppointment
      ? await appointmentCheckout(admin, user.id, appointmentId, body.kind)
      : await planCheckout(admin, user.id, planId);
    if ('error' in checkout) return NextResponse.json({ error: checkout.error }, { status: checkout.status });

    const { business, amount, name, description, type, appointment, plan } = checkout;
    let destination: string | null = null;
    if (business.stripe_account_id) {
      const account = await stripe.accounts.retrieve(business.stripe_account_id);
      if (!account.deleted && account.charges_enabled && account.payouts_enabled) destination = account.id;
    }
    if (!destination && !isStripeTestMode()) return NextResponse.json({ error: 'O estabelecimento ainda não concluiu a ativação dos pagamentos online.' }, { status: 409 });

    const { data: platform } = await admin.from('configuracoes_plataforma').select('taxa_plataforma_percentual').eq('id', true).maybeSingle();
    const feeRate = Math.max(0, Math.min(30, Number(platform?.taxa_plataforma_percentual ?? 0)));
    const amountCents = Math.round(amount * 100);
    const origin = new URL(request.url).origin;
    const common = {
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ price_data: { currency: 'brl', product_data: { name, description }, unit_amount: amountCents, ...(type === 'assinatura' ? { recurring: { interval: 'month' as const } } : {}) }, quantity: 1 }],
      success_url: `${origin}/pagamento/retorno?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?pagamento=cancelado`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      locale: 'pt-BR' as const,
      metadata: { checkout_type: type, barbershop_id: business.id, user_id: user.id, appointment_id: appointment?.id?.toString() ?? '', plan_id: plan?.id?.toString() ?? '' },
    };
    const session = type === 'assinatura'
      ? await stripe.checkout.sessions.create({
          ...common,
          mode: 'subscription',
          subscription_data: {
            metadata: {
              checkout_type: 'client_subscription',
              barbershop_id: business.id,
              user_id: user.id,
              plan_id: plan?.id?.toString() ?? '',
            },
            ...(destination ? { transfer_data: { destination }, application_fee_percent: feeRate } : {}),
          },
        })
      : await stripe.checkout.sessions.create({ ...common, mode: 'payment', payment_intent_data: destination ? { transfer_data: { destination }, application_fee_amount: Math.round(amountCents * feeRate / 100) } : undefined });
    if (!session.url) return NextResponse.json({ error: 'A Stripe não retornou a página segura de pagamento.' }, { status: 502 });

    const { error: saveError } = await admin.from('checkouts_pagamento').insert({
      barbearia_id: business.id,
      usuario_id: user.id,
      agendamento_id: appointment?.id ?? null,
      plano_id: plan?.id ?? null,
      tipo: type,
      valor: amount,
      stripe_session_id: session.id,
      livemode: session.livemode,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    if (saveError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return NextResponse.json({ error: 'Não foi possível registrar o pagamento com segurança.' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[payments:checkout]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Não foi possível abrir o pagamento agora.' }, { status: 502 });
  }
}

type Admin = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>['admin']>;

async function appointmentCheckout(admin: Admin, userId: string, appointmentId: number, requestedKind: unknown) {
  const { data: appointment } = await admin.from('agendamentos').select('*').eq('id', appointmentId).maybeSingle();
  if (!appointment || ['cancelado', 'nao_compareceu'].includes(appointment.status)) return { error: 'Este agendamento não pode ser pago.', status: 409 } as const;
  const [{ data: client }, { data: barber }] = await Promise.all([
    admin.from('clientes').select('usuario_id').eq('id', appointment.cliente_id).maybeSingle(),
    admin.from('barbeiros').select('barbearia_id').eq('id', appointment.barbeiro_id).maybeSingle(),
  ]);
  if (client?.usuario_id !== userId || !barber) return { error: 'Agendamento não encontrado.', status: 404 } as const;
  const { data: business } = await admin.from('barbearias').select('*').eq('id', barber.barbearia_id).eq('ativa', true).maybeSingle();
  if (!business) return { error: 'Estabelecimento indisponível.', status: 409 } as const;
  const kind = requestedKind === 'servico' ? 'servico' : 'sinal';
  const signal = Number(appointment.sinal_valor ?? 0);
  if (kind === 'sinal' && (signal <= 0 || appointment.sinal_status === 'pago')) return { error: 'Este sinal não está pendente.', status: 409 } as const;
  const amount = kind === 'sinal' ? signal : Math.max(0, Number(appointment.servico_preco ?? 0) - (appointment.sinal_status === 'pago' ? signal : 0));
  if (amount < 0.5) return { error: 'O valor precisa ser de pelo menos R$ 0,50.', status: 409 } as const;
  return { business, appointment, plan: null, amount, name: kind === 'sinal' ? `Sinal · ${appointment.servico_nome}` : appointment.servico_nome ?? 'Serviço', description: `${business.nome} · ${appointment.data} às ${appointment.horario.slice(0, 5)}`, type: kind } as const;
}

async function planCheckout(admin: Admin, userId: string, planId: number) {
  const { data: plan } = await admin.from('planos_mensais').select('*').eq('id', planId).eq('ativo', true).maybeSingle();
  if (!plan) return { error: 'Plano indisponível.', status: 404 } as const;
  const [{ data: business }, { data: client }] = await Promise.all([
    admin.from('barbearias').select('*').eq('id', plan.barbearia_id).eq('ativa', true).maybeSingle(),
    admin.from('clientes').select('id').eq('usuario_id', userId).maybeSingle(),
  ]);
  if (!business || !client) return { error: 'Perfil de cliente ou estabelecimento indisponível.', status: 409 } as const;
  const { data: existing } = await admin.from('assinaturas_clientes').select('id').eq('plano_id', plan.id).eq('cliente_id', client.id).in('status', ['pendente', 'ativa', 'pausada', 'inadimplente']).maybeSingle();
  if (existing) return { error: 'Você já possui uma assinatura deste plano.', status: 409 } as const;
  const amount = Number(plan.preco);
  if (amount < 0.5) return { error: 'Planos gratuitos não precisam de checkout.', status: 409 } as const;
  return { business, appointment: null, plan, amount, name: plan.nome, description: `${plan.atendimentos_inclusos} atendimento(s) por mês em ${business.nome}`, type: 'assinatura' as const };
}
