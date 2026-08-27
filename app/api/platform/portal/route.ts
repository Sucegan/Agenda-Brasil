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
  if (!admin || !user) return NextResponse.json({ error: 'Entre novamente para continuar.' }, { status: 401 });
  if (!await consumeRateLimit(admin, request, `platform-portal:${user.id}`, 8, 900)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  const { data: subscription } = await admin.from('assinaturas_plataforma')
    .select('stripe_customer_id')
    .eq('usuario_id', user.id)
    .maybeSingle();
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: 'A cobrança ainda não foi ativada para esta conta.' }, { status: 409 });
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });
    return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[platform:portal]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Não foi possível abrir o gerenciamento da cobrança.' }, { status: 502 });
  }
}
