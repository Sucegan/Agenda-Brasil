import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Notification } from '@/lib/database.types';
import { deliverNotification } from '@/lib/server/notifications';

type AdminClient = SupabaseClient<Database>;

export async function flushEmailNotifications(
  admin: AdminClient,
  userId: string,
  appointmentId?: number,
) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_EMAIL_FROM) {
    return { configured: false, processed: 0, sent: 0, failed: 0 };
  }

  let query = admin
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', userId)
    .eq('canal', 'email')
    .eq('status', 'pendente')
    .lte('agendado_para', new Date().toISOString())
    .lt('tentativas', 4)
    .order('agendado_para')
    .limit(10);
  if (appointmentId) query = query.eq('agendamento_id', appointmentId);
  const { data, error } = await query;
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const pending of data ?? []) {
    const leaseId = crypto.randomUUID();
    const { data: claimed } = await admin
      .from('notificacoes')
      .update({
        status: 'processando',
        tentativas: pending.tentativas + 1,
        lease_id: leaseId,
        lease_expires_at: new Date(Date.now() + 300_000).toISOString(),
      })
      .eq('id', pending.id)
      .eq('status', 'pendente')
      .select('*')
      .maybeSingle();
    if (!claimed) continue;

    try {
      await deliverNotification(claimed as Notification);
      await admin.from('notificacoes').update({
        status: 'enviada',
        enviada_em: new Date().toISOString(),
        ultimo_erro: null,
        lease_id: null,
        lease_expires_at: null,
      }).eq('id', claimed.id).eq('lease_id', leaseId);
      sent += 1;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha desconhecida';
      await admin.from('notificacoes').update({
        status: claimed.tentativas >= 4 ? 'erro' : 'pendente',
        ultimo_erro: message.slice(0, 2_000),
        lease_id: null,
        lease_expires_at: null,
      }).eq('id', claimed.id).eq('lease_id', leaseId);
      failed += 1;
    }
  }

  return { configured: true, processed: sent + failed, sent, failed };
}
