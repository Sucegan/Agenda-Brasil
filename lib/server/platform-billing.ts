import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database, PlatformSubscriptionStatus } from '@/lib/database.types';

type AdminClient = SupabaseClient<Database>;

const toIso = (timestamp: number | null | undefined) => timestamp ? new Date(timestamp * 1000).toISOString() : null;
const stripeId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id ?? null;

export async function syncPlatformCheckout(
  admin: AdminClient,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) throw new Error('Checkout da plataforma sem assinatura.');
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncPlatformSubscription(admin, subscription, {
    ownerId: session.metadata?.owner_id,
    planId: session.metadata?.plan_id,
    checkoutSessionId: session.id,
  });
}

export async function syncPlatformSubscription(
  admin: AdminClient,
  subscription: Stripe.Subscription,
  overrides: { ownerId?: string; planId?: string; checkoutSessionId?: string } = {},
) {
  const ownerId = overrides.ownerId || subscription.metadata.owner_id;
  const planId = Number(overrides.planId || subscription.metadata.plan_id);
  const subscriptionId = subscription.id;

  const existingQuery = admin.from('assinaturas_plataforma').select('id, usuario_id, plano_id');
  const { data: existing, error: existingError } = ownerId
    ? await existingQuery.eq('usuario_id', ownerId).maybeSingle()
    : await existingQuery.eq('stripe_subscription_id', subscriptionId).maybeSingle();
  if (existingError || !existing) throw new Error(existingError?.message ?? 'Assinatura local não encontrada.');

  const validPlanId = Number.isSafeInteger(planId) && planId > 0 ? planId : existing.plano_id;
  const period = subscription.items.data[0];
  const customerId = stripeId(subscription.customer);
  const payload: Database['public']['Tables']['assinaturas_plataforma']['Update'] = {
    plano_id: validPlanId,
    status: subscription.status as PlatformSubscriptionStatus,
    trial_ends_at: toIso(subscription.trial_end),
    current_period_start: toIso(period?.current_period_start),
    current_period_end: toIso(period?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    livemode: subscription.livemode,
    updated_at: new Date().toISOString(),
  };
  if (overrides.checkoutSessionId) payload.stripe_checkout_session_id = overrides.checkoutSessionId;

  const { error } = await admin.from('assinaturas_plataforma').update(payload).eq('id', existing.id);
  if (error) throw new Error(error.message);
}

export async function markPlatformCheckoutExpired(admin: AdminClient, sessionId: string) {
  const { data: current } = await admin.from('assinaturas_plataforma')
    .select('id, stripe_subscription_id, trial_ends_at')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  if (!current || current.stripe_subscription_id) return;

  const trialActive = Boolean(current.trial_ends_at && new Date(current.trial_ends_at).getTime() > Date.now());
  const { error } = await admin.from('assinaturas_plataforma').update({
    status: trialActive ? 'trialing' : 'incomplete_expired',
    stripe_checkout_session_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', current.id);
  if (error) throw new Error(error.message);
}
