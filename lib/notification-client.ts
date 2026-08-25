'use client';

import { supabase } from '@/lib/supabase';

export async function requestNotificationDelivery(appointmentId?: number) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch('/api/notifications/flush', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentId }),
  }).catch(() => undefined);
}
