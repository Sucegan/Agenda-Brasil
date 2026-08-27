import { NextResponse } from 'next/server';
import { consumeRateLimit, isSameSiteRequest } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';
import { getStripe } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const stripe = getStripe();
  const { admin, user } = await getAuthenticatedUser(request);
  if (!stripe) return NextResponse.json({ error: 'As assinaturas ainda não estão configuradas.' }, { status: 503 });
  if (!admin || !user?.email) return NextResponse.json({ error: 'Entre como proprietário para continuar.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `platform-checkout:${user.id}`, 6, 900)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > 1_000) return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
  let planId = 0;
  try { planId = Number((JSON.parse(raw) as { planId?: unknown }).planId); }
  catch { return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  if (!Number.isSafeInteger(planId) || planId <= 0) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });

  const [{ data: profile }, { data: plan }, { data: subscription }] = await Promise.all([
    admin.from('usuarios').select('nome, tipo').eq('id', user.id).maybeSingle(),
    admin.from('planos_plataforma').select('*').eq('id', planId).eq('ativo', true).maybeSingle(),
    admin.from('assinaturas_plataforma').select('*').eq('usuario_id', user.id).maybeSingle(),
  ]);
  if (profile?.tipo !== 'proprietario') return NextResponse.json({ error: 'Apenas proprietários podem contratar planos.' }, { status: 403 });
  if (!plan) return NextResponse.json({ error: 'Plano indisponível.' }, { status: 404 });
  if (!subscription) return NextResponse.json({ error: 'Crie seu primeiro estabelecimento antes de contratar um plano.' }, { status: 409 });
  if (subscription.stripe_subscription_id && ['trialing', 'active', 'past_due', 'paused'].includes(subscription.status)) {
    return NextResponse.json({ error: 'Sua assinatura já está vinculada. Use “Gerenciar cobrança” para atualizar o pagamento ou cancelar; para trocar de plano, fale com o suporte.' }, { status: 409 });
  }

  try {
    if (subscription.stripe_checkout_session_id) {
      const previous = await stripe.checkout.sessions.retrieve(subscription.stripe_checkout_session_id).catch(() => null);
      if (previous?.status === 'open' && previous.url) return NextResponse.json({ url: previous.url }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let customerId = subscription.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.nome,
        metadata: { agenda_brasil_owner_id: user.id },
      }, { idempotencyKey: `agenda-customer-${user.id}` });
      customerId = customer.id;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const trialEnd = subscription.trial_ends_at ? Math.floor(new Date(subscription.trial_ends_at).getTime() / 1000) : 0;
    const metadata = { checkout_type: 'platform_subscription', owner_id: user.id, plan_id: String(plan.id) };
    const origin = new URL(request.url).origin;
    const lineItem = plan.stripe_price_id
      ? { price: plan.stripe_price_id, quantity: 1 }
      : {
          price_data: {
            currency: 'brl',
            product_data: { name: `Agenda Brasil · ${plan.nome}`, description: plan.descricao },
            recurring: { interval: 'month' as const },
            unit_amount: Math.round(Number(plan.preco_mensal) * 100),
          },
          quantity: 1,
        };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [lineItem],
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      locale: 'pt-BR',
      client_reference_id: user.id,
      metadata,
      subscription_data: {
        metadata,
        ...(trialEnd > nowSeconds + (48 * 60 * 60) ? { trial_end: trialEnd } : {}),
      },
      success_url: `${origin}/dashboard?assinatura=sucesso`,
      cancel_url: `${origin}/dashboard?assinatura=cancelada`,
      expires_at: nowSeconds + (30 * 60),
    }, { idempotencyKey: `agenda-checkout-${subscription.id}-${plan.id}-${subscription.updated_at}` });
    if (!session.url) return NextResponse.json({ error: 'A Stripe não retornou a página segura de pagamento.' }, { status: 502 });

    const { error: saveError } = await admin.from('assinaturas_plataforma').update({
      plano_id: plan.id,
      status: subscription.status === 'trialing' ? 'trialing' : 'incomplete',
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      livemode: session.livemode,
      updated_at: new Date().toISOString(),
    }).eq('id', subscription.id);
    if (saveError) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return NextResponse.json({ error: 'Não foi possível registrar a assinatura com segurança.' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[platform:checkout]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Não foi possível abrir a assinatura agora.' }, { status: 502 });
  }
}
