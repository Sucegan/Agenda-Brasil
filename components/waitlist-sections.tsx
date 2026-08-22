'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/scheduling';
import type { ProfessionalWaitlistEntry, WaitlistEntry } from '@/lib/database.types';

export function JoinWaitlistButton({ barberId, serviceId, date }: { barberId: number; serviceId: number; date: string }) {
  const [period, setPeriod] = useState<'manha' | 'tarde' | 'noite' | 'qualquer'>('qualquer');
  const join = async () => {
    const { error } = await supabase.rpc('entrar_fila_espera', { p_barbeiro_id: barberId, p_servico_id: serviceId, p_data: date, p_periodo: period });
    if (error) return toast.error(error.message);
    toast.success('Você entrou na fila de espera.');
  };
  return <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-sm"><option value="qualquer">Qualquer período</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select><button onClick={() => { void join(); }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-bold text-zinc-950"><BellRing size={16} /> Entrar na fila</button></div>;
}

export function ClientWaitlist() {
  const [items, setItems] = useState<WaitlistEntry[]>([]);
  const load = async () => { const { data } = await supabase.from('fila_espera').select('*').in('status', ['aguardando', 'notificado']).order('data'); setItems(data ?? []); };
  useEffect(() => { void load(); }, []);
  if (!items.length) return null;
  return <section className="rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5"><h2 className="mb-3 flex items-center gap-2 font-black"><BellRing className="text-amber-400" size={18} /> Minha fila de espera</h2><div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs"><span>{formatDate(item.data)} · {item.periodo} · <b className="text-amber-300">{item.status}</b></span><button onClick={async () => { const { error } = await supabase.rpc('cancelar_fila_espera', { p_fila_id: item.id }); if (error) toast.error(error.message); else { toast.success('Removido da fila.'); await load(); } }} className="p-2 text-red-300" aria-label="Sair da fila"><Trash2 size={15} /></button></div>)}</div></section>;
}

export function ProfessionalWaitlist() {
  const [items, setItems] = useState<ProfessionalWaitlistEntry[]>([]);
  useEffect(() => { void supabase.rpc('listar_fila_profissional').then(({ data }) => setItems(data ?? [])); }, []);
  if (!items.length) return null;
  return <section className="rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5"><h2 className="mb-3 flex items-center gap-2 font-black"><BellRing className="text-amber-400" size={18} /> Fila de espera</h2><div className="space-y-2">{items.map((item) => { const phone = item.cliente_telefone.replace(/\D/g, ''); const to = phone.length <= 11 ? `55${phone}` : phone; return <div key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm sm:flex-row sm:items-center"><span><b>{item.cliente_nome}</b><small className="block text-zinc-500">{item.servico_nome} · {formatDate(item.data)} · {item.periodo}</small></span><a href={`https://wa.me/${to}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/25 px-3 py-2 text-xs font-bold text-emerald-300"><MessageCircle size={14} /> WhatsApp</a></div>; })}</div></section>;
}
