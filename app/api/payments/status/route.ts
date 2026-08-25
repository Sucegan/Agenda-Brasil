import { NextResponse } from 'next/server';
import { confirmPaidCheckout, markCheckoutExpired } from '@/lib/server/payment-sync';
import { getAuthenticatedUser } from '@/lib/server/supabase-admin';
import { getStripe } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const stripe = getStripe();
  const { admin, user } = await getAuthenticatedUser(request);
  if (!stripe || !admin || !user) return NextResponse.json({ error: 'Autenticação ou pagamento indisponível.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.json({ error: 'Pagamento inválido.' }, { status: 400 });
  const { data: checkout } = await admin.from('checkouts_pagamento').select('usuario_id').eq('stripe_session_id', sessionId).maybeSingle();
  if (checkout?.usuario_id !== user.id) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === 'expired') await markCheckoutExpired(admin, session.id);
    const paid = await confirmPaidCheckout(admin, session);
    return NextResponse.json({ paid, status: session.status, paymentStatus: session.payment_status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível confirmar o pagamento.' }, { status: 502 });
  }
}
