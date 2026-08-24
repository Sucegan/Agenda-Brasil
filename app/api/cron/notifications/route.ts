import { NextResponse } from 'next/server';
import type { Notification } from '@/lib/database.types';
import { deliverNotification } from '@/lib/server/notifications';
import { createAdminClient } from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function processQueue(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 503 });

  const leaseId = crypto.randomUUID();
  const { data, error } = await admin.rpc('claim_due_notifications', {
    p_limit: 50,
    p_lease_id: leaseId,
    p_lease_seconds: 300,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const processNotification = async (row: Notification) => {
    try {
      await deliverNotification(row);
      const { error: updateError } = await admin.from('notificacoes').update({
        status: 'enviada',
        enviada_em: new Date().toISOString(),
        ultimo_erro: null,
        lease_id: null,
        lease_expires_at: null,
      }).eq('id', row.id).eq('lease_id', leaseId);
      if (updateError) throw updateError;
      return { id: row.id, status: 'enviada' as const };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha desconhecida';
      const status = row.tentativas >= 4 ? 'erro' : 'pendente';
      await admin.from('notificacoes').update({
        status,
        ultimo_erro: message.slice(0, 2_000),
        lease_id: null,
        lease_expires_at: null,
      }).eq('id', row.id).eq('lease_id', leaseId);
      return { id: row.id, status, error: message };
    }
  };

  const queue = (data ?? []) as Notification[];
  const results = [];
  for (let index = 0; index < queue.length; index += 5) {
    results.push(...await Promise.all(queue.slice(index, index + 5).map(processNotification)));
  }

  return NextResponse.json({ claimed: queue.length, processed: results.length, leaseId, results });
}

export const GET = processQueue;
export const POST = processQueue;
