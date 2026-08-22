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

  const { data, error } = await admin
    .from('notificacoes')
    .select('*')
    .eq('status', 'pendente')
    .lte('agendado_para', new Date().toISOString())
    .lt('tentativas', 4)
    .order('agendado_para')
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const row of data as Notification[]) {
    try {
      await deliverNotification(row);
      await admin.from('notificacoes').update({ status: 'enviada', enviada_em: new Date().toISOString(), ultimo_erro: null }).eq('id', row.id);
      results.push({ id: row.id, status: 'enviada' });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Falha desconhecida';
      const attempts = row.tentativas + 1;
      await admin.from('notificacoes').update({ status: attempts >= 4 ? 'erro' : 'pendente', tentativas: attempts, ultimo_erro: message }).eq('id', row.id);
      results.push({ id: row.id, status: attempts >= 4 ? 'erro' : 'pendente', error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export const GET = processQueue;
export const POST = processQueue;
