'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Health = {
  providers: { email: boolean; whatsapp: boolean };
  counts: Record<string, number>;
  generatedAt: string;
};

export function NotificationHealth({ barbershopId }: { barbershopId: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setLoading(false);
    const response = await fetch(`/api/business-health?barbearia=${encodeURIComponent(barbershopId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setHealth(await response.json() as Health);
    setLoading(false);
  }, [barbershopId]);

  useEffect(() => { void load(); }, [load]);
  const channels = health ? [
    ['E-mail de agendamento', 'email', health.providers.email],
    ['WhatsApp', 'whatsapp', health.providers.whatsapp],
  ] as const : [];
  const errors = Object.entries(health?.counts ?? {}).filter(([key]) => key.endsWith(':erro')).reduce((sum, [, value]) => sum + value, 0);

  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Saúde das automações</h2><p className="mt-1 text-xs text-zinc-500">Provedores e entregas dos últimos 7 dias.</p></div><button onClick={() => { void load(); }} disabled={loading} aria-label="Atualizar saúde das automações" className="rounded-lg border border-zinc-700 p-2 text-zinc-300 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>{health ? <><div className="mt-4 grid gap-2 sm:grid-cols-2">{channels.map(([label, channel, active]) => <div key={channel} className={`rounded-xl border p-3 text-sm ${active ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>{active ? <CheckCircle2 className="mb-2 text-emerald-400" size={18} /> : <AlertTriangle className="mb-2 text-amber-400" size={18} />}<b>{label}</b><p className="mt-1 text-xs text-zinc-400">{active ? 'Configurado' : channel === 'email' ? 'Falta configurar o Resend na Vercel' : 'Credenciais pendentes'} · {health.counts[`${channel}:enviada`] ?? 0} enviadas</p></div>)}</div><p className={`mt-4 text-xs ${errors ? 'text-red-300' : 'text-zinc-500'}`}>{errors ? `${errors} mensagem(ns) falharam e precisam de atenção.` : 'Nenhuma falha acumulada no período.'}</p>{!health.providers.email && <p className="mt-2 text-xs text-amber-300">O Resend conectado ao Supabase envia cadastro e acesso. Confirmações da agenda precisam também da chave de API na Vercel.</p>}</> : <p className="mt-4 text-sm text-zinc-500">{loading ? 'Consultando automações...' : 'Não foi possível consultar agora.'}</p>}</section>;
}
