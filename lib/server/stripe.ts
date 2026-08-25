import 'server-only';

import Stripe from 'stripe';

let stripeClient: Stripe | null | undefined;

export function getStripe() {
  if (stripeClient !== undefined) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  stripeClient = secretKey
    ? new Stripe(secretKey, {
        appInfo: { name: 'Agenda Brasil', version: '1.0.0', url: 'https://agenda-brasil.vercel.app' },
        maxNetworkRetries: 2,
        timeout: 12_000,
      })
    : null;
  return stripeClient;
}

export function isStripeTestMode() {
  return !process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
}
