import 'server-only';

import type Stripe from 'stripe';
import type { Database } from '@/lib/database.types';
import type { createAdminClient } from '@/lib/server/supabase-admin';

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type CheckoutRow = Database['public']['Tables']['checkouts_pagamento']['Row'];
type ClientSubscriptionStatus = Database['public']['Tables']['assinaturas_clientes']['Row']['status'];

function stripeId(value: string | { id: string } | null) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

function clientSubscriptionStatus(status: Stripe.Subscription.Status): ClientSubscriptionStatus {
  if (status === 'active' || status === 'trialing') return 'ativa';
  if (status === 'paused') return 'pausada';
  if (status === 'canceled') return 'cancelada';
  if (status === 'incomplete') return 'pendente';
  return 'inadimplente';
}

export async function syncClientSubscription(admin: AdminClient, subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const { error } = await admin.from('assinaturas_clientes').update({
    status: clientSubscriptionStatus(subscription.status),
    proxima_cobranca_em: periodEnd ? new Date(periodEnd * 1_000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('referencia_externa', subscription.id);
  if (error) throw error;
}

export async function markCheckoutExpired(admin: AdminClient, sessionId: string) {
  await admin.from('checkouts_pagamento').update({ status: 'expirado', updated_at: new Date().toISOString() }).eq('stripe_session_id', sessionId).eq('status', 'criado');
}

export async function confirmPaidCheckout(admin: AdminClient, session: Stripe.Checkout.Session) {
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) return false;
  const now = new Date().toISOString();
  const { data: checkout, error } = await admin
    .from('checkouts_pagamento')
    .update({
      status: 'pago',
      stripe_payment_intent_id: stripeId(session.payment_intent),
      stripe_subscription_id: stripeId(session.subscription),
      stripe_customer_id: stripeId(session.customer),
      pago_em: now,
      updated_at: now,
    })
    .eq('stripe_session_id', session.id)
    .neq('status', 'pago')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!checkout) return true;

  if (checkout.agendamento_id) {
    await admin.from('agendamentos').update(checkout.tipo === 'sinal'
      ? { sinal_status: 'pago' }
      : { pagamento_online_status: 'pago' }
    ).eq('id', checkout.agendamento_id);
  }

  if (checkout.plano_id) await activateSubscription(admin, checkout);

  const { data: platform } = await admin.from('configuracoes_plataforma').select('taxa_plataforma_percentual').eq('id', true).maybeSingle();
  const feeRate = Number(platform?.taxa_plataforma_percentual ?? 0);
  const fee = checkout.tipo === 'assinatura' || checkout.tipo === 'sinal' || checkout.tipo === 'servico'
    ? Number((Number(checkout.valor) * feeRate / 100).toFixed(2))
    : 0;
  const { error: ledgerError } = await admin.from('movimentacoes_financeiras').insert({
    barbearia_id: checkout.barbearia_id,
    agendamento_id: checkout.agendamento_id,
    tipo: 'receita',
    categoria: checkout.tipo === 'assinatura' ? 'Plano mensal online' : checkout.tipo === 'sinal' ? 'Sinal online' : 'Serviço online',
    metodo: 'online',
    status: 'pago',
    valor_bruto: checkout.valor,
    taxa: fee,
    descricao: 'Pagamento confirmado automaticamente pela Stripe.',
    referencia_externa: session.id,
    criado_por: checkout.usuario_id,
  });
  if (ledgerError && ledgerError.code !== '23505') throw ledgerError;
  return true;
}

async function activateSubscription(admin: AdminClient, checkout: CheckoutRow) {
  if (!checkout.plano_id) return;
  const { data: client } = await admin.from('clientes').select('id').eq('usuario_id', checkout.usuario_id).maybeSingle();
  if (!client) return;
  const { data: current } = await admin.from('assinaturas_clientes')
    .select('id')
    .eq('plano_id', checkout.plano_id)
    .eq('cliente_id', client.id)
    .in('status', ['pendente', 'ativa', 'pausada', 'inadimplente'])
    .maybeSingle();
  if (current) {
    await admin.from('assinaturas_clientes').update({
      status: 'ativa',
      referencia_externa: checkout.stripe_subscription_id ?? checkout.stripe_session_id,
      updated_at: new Date().toISOString(),
    }).eq('id', current.id);
    return;
  }
  await admin.from('assinaturas_clientes').insert({
    plano_id: checkout.plano_id,
    cliente_id: client.id,
    status: 'ativa',
    referencia_externa: checkout.stripe_subscription_id ?? checkout.stripe_session_id,
  });
}
