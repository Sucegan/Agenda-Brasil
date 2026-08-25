'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { appointmentStatusLabels, displayTime, formatDate } from '@/lib/scheduling';
import type { AppointmentStatus, Notification } from '@/lib/database.types';

type NotificationPayload = {
  barbearia_nome?: string;
  barbeiro_nome?: string;
  servico_nome?: string;
  data?: string;
  horario?: string;
  status?: AppointmentStatus;
};

function notificationText(notification: Notification) {
  const payload = notification.payload as NotificationPayload;
  const service = payload.servico_nome ?? 'Atendimento';
  const professional = payload.barbeiro_nome ? ` com ${payload.barbeiro_nome}` : '';
  const schedule = payload.data && payload.horario
    ? `${formatDate(payload.data)} às ${displayTime(payload.horario)}`
    : 'horário informado na agenda';
  if (notification.tipo === 'confirmacao') return `${service}${professional} registrado para ${schedule}.`;
  if (notification.tipo === 'lembrete_24h') return `Lembrete: ${service}${professional} será ${schedule}.`;
  if (notification.tipo === 'fila_espera') return `Uma vaga de ${service}${professional} ficou disponível.`;
  if (notification.tipo === 'status' && payload.status) return `${service}${professional}: ${appointmentStatusLabels[payload.status]}.`;
  return `${service}${professional} recebeu uma atualização.`;
}

export function NotificationInbox({ userId, barbershopId }: { userId: string; barbershopId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('canal', 'in_app')
      .contains('payload', { barbearia_id: barbershopId })
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
    setLoading(false);
  }, [barbershopId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`notificacoes-${userId}-${barbershopId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `usuario_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [barbershopId, load, userId]);

  const unreadIds = useMemo(() => notifications.filter((item) => !item.lida_em).map((item) => item.id), [notifications]);
  const markAllRead = async () => {
    if (!unreadIds.length) return;
    const { error } = await supabase.rpc('marcar_notificacoes_lidas', { p_ids: unreadIds });
    if (!error) setNotifications((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, lida_em: new Date().toISOString() } : item));
  };

  return (
    <section className="rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-5 shadow-xl" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><BellRing className="text-blue-400" size={20} /> Notificações</h2>
          <p className="mt-1 text-xs text-zinc-500">Confirmações ficam salvas aqui mesmo se o e-mail atrasar.</p>
        </div>
        {unreadIds.length > 0 && <button onClick={() => { void markAllRead(); }} className="flex items-center gap-1 rounded-lg border border-blue-500/25 px-3 py-2 text-xs font-bold text-blue-300"><CheckCheck size={15} /> Marcar lidas</button>}
      </div>
      <div className="mt-4 space-y-2">
        {notifications.map((item) => {
          const payload = item.payload as NotificationPayload;
          return <article key={item.id} className={`rounded-xl border p-3 ${item.lida_em ? 'border-zinc-800 bg-zinc-950/40' : 'border-blue-500/30 bg-blue-500/10'}`}>
            <div className="flex items-start gap-2"><Bell size={15} className={item.lida_em ? 'mt-0.5 text-zinc-600' : 'mt-0.5 text-blue-300'} /><div><p className="text-sm text-zinc-200">{notificationText(item)}</p><p className="mt-1 text-[11px] text-zinc-500">{payload.barbearia_nome ?? 'Agenda Brasil'} · {new Date(item.created_at).toLocaleString('pt-BR')}</p></div></div>
          </article>;
        })}
        {!loading && notifications.length === 0 && <p className="text-sm text-zinc-500">As confirmações e alterações dos seus horários aparecerão aqui.</p>}
        {loading && <p className="animate-pulse text-sm text-zinc-500">Carregando notificações...</p>}
      </div>
    </section>
  );
}
