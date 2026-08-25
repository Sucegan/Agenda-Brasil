import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { confirmPaidCheckout, markCheckoutExpired } from '@/lib/server/payment-sync';
import { createAdminClient } from '@/lib/server/supabase-admin';
import { getStripe } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !signature || !secret) return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 }); }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') await confirmPaidCheckout(admin, event.data.object);
    if (event.type === 'checkout.session.expired') await markCheckoutExpired(admin, event.data.object.id);
    if (event.type === 'customer.subscription.deleted') {
      await admin.from('assinaturas_clientes').update({ status: 'cancelada', updated_at: new Date().toISOString() }).eq('referencia_externa', event.data.object.id);
    }
  } catch (error) {
    console.error('[payments:webhook]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Falha ao processar evento.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
