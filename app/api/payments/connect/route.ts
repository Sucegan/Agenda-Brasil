import { NextResponse } from 'next/server';
import { isSameSiteRequest } from '@/lib/server/request-protection';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';
import { getStripe } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

function accessAllowed(role: string | undefined, userId: string, ownerId: string) {
  return role === 'admin' || (role === 'proprietario' && userId === ownerId);
}

export async function GET(request: Request) {
  const stripe = getStripe();
  const { admin, user } = await getAuthenticatedUser(request);
  if (!stripe || !admin || !user) return NextResponse.json({ error: 'Autenticação ou provedor indisponível.' }, { status: 401 });
  const barbershopId = new URL(request.url).searchParams.get('barbershopId');
  if (!barbershopId) return NextResponse.json({ error: 'Estabelecimento inválido.' }, { status: 400 });
  const [{ data: profile }, { data: business }] = await Promise.all([
    admin.from('usuarios').select('tipo').eq('id', user.id).maybeSingle(),
    admin.from('barbearias').select('id, proprietario_id, stripe_account_id, stripe_onboarding_status').eq('id', barbershopId).maybeSingle(),
  ]);
  if (!business || !accessAllowed(profile?.tipo, user.id, business.proprietario_id)) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  if (!business.stripe_account_id) return NextResponse.json({ status: 'nao_conectado', chargesEnabled: false, payoutsEnabled: false });
  try {
    const account = await stripe.accounts.retrieve(business.stripe_account_id);
    if (account.deleted) return NextResponse.json({ status: 'restrito', chargesEnabled: false, payoutsEnabled: false });
    const status = account.charges_enabled && account.payouts_enabled ? 'ativo' : account.details_submitted ? 'restrito' : 'pendente';
    await admin.from('barbearias').update({ stripe_onboarding_status: status, updated_at: new Date().toISOString() }).eq('id', business.id);
    return NextResponse.json({ status, chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled, detailsSubmitted: account.details_submitted });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar a conta de recebimento.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isSameSiteRequest(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  const stripe = getStripe();
  const { admin, user } = await getAuthenticatedUser(request);
  if (!stripe || !admin || !user?.email) return NextResponse.json({ error: 'Autenticação ou provedor indisponível.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { barbershopId?: unknown } | null;
  const barbershopId = typeof body?.barbershopId === 'string' ? body.barbershopId : '';
  const [{ data: profile }, { data: business }] = await Promise.all([
    admin.from('usuarios').select('tipo').eq('id', user.id).maybeSingle(),
    admin.from('barbearias').select('id, nome, proprietario_id, stripe_account_id').eq('id', barbershopId).maybeSingle(),
  ]);
  if (!business || !accessAllowed(profile?.tipo, user.id, business.proprietario_id)) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
  try {
    let accountId = business.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: user.email,
        business_profile: { name: business.nome, product_description: 'Serviços agendados pela plataforma Agenda Brasil' },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { barbershop_id: business.id, platform: 'agenda-brasil' },
      });
      accountId = account.id;
      await admin.from('barbearias').update({ stripe_account_id: accountId, stripe_onboarding_status: 'pendente', updated_at: new Date().toISOString() }).eq('id', business.id);
    }
    const origin = new URL(request.url).origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=retomar`,
      return_url: `${origin}/dashboard?stripe=conectado`,
      type: 'account_onboarding',
    });
    return NextResponse.json({ url: link.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[payments:connect]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Não foi possível iniciar a ativação Stripe.' }, { status: 502 });
  }
}
