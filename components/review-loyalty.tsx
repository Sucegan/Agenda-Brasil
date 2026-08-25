'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, MessageSquareText, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Appointment, Database } from '@/lib/database.types';
import { formatDate } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';

type Review = Database['public']['Tables']['avaliacoes']['Row'];

export function ReviewLoyalty({ role, appointments, points = 0, barberId }: { role: 'cliente' | 'barbeiro'; appointments: Appointment[]; points?: number; barberId?: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    let query = supabase.from('avaliacoes').select('*').order('created_at', { ascending: false });
    if (role === 'barbeiro' && barberId) query = query.eq('barbeiro_id', barberId);
    const { data } = await query;
    setReviews(data ?? []);
  }, [barberId, role]);
  useEffect(() => { void load(); }, [load]);

  const reviewedIds = useMemo(() => new Set(reviews.map((review) => review.agendamento_id)), [reviews]);
  const reviewable = appointments.filter((appointment) => appointment.status === 'concluido' && !reviewedIds.has(appointment.id));
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.nota, 0) / reviews.length : 0;

  const save = async () => {
    const appointment = appointments.find((item) => item.id === selected);
    if (!appointment) return toast.error('Escolha um atendimento concluído.');
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    const { error } = userId ? await supabase.from('avaliacoes').insert({
      agendamento_id: appointment.id,
      usuario_id: userId,
      barbeiro_id: appointment.barbeiro_id,
      nota: rating,
      comentario: comment.trim() || null,
    }) : { error: new Error('Sessão expirada.') };
    setSaving(false);
    if (error) return toast.error(error.message);
    setSelected(null);
    setComment('');
    setRating(5);
    await load();
    toast.success('Obrigado pela avaliação!');
  };

  if (role === 'barbeiro') return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-black"><MessageSquareText className="text-amber-400" size={20} /> Avaliações</h2><p className="mt-1 text-xs text-zinc-500">Feedback privado dos clientes.</p></div><div className="text-right"><b className="text-2xl text-amber-300">{reviews.length ? average.toFixed(1) : '—'}</b><p className="text-[10px] text-zinc-500">{reviews.length} avaliação(ões)</p></div></div><div className="mt-4 space-y-2">{reviews.slice(0, 5).map((review) => <article key={review.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><div className="flex gap-0.5" aria-label={`${review.nota} de 5 estrelas`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} className={index < review.nota ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'} />)}</div>{review.comentario && <p className="mt-2 text-sm text-zinc-300">{review.comentario}</p>}</article>)}{!reviews.length && <p className="text-sm text-zinc-500">As primeiras avaliações aparecerão aqui.</p>}</div></section>;

  return <section className="rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 shadow-xl"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="flex items-center gap-2 text-lg font-black"><Award className="text-amber-400" size={20} /> Fidelidade e avaliação</h2><p className="mt-1 text-xs text-zinc-500">Cada atendimento concluído soma 10 pontos.</p></div><div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center"><b className="text-xl text-amber-300">{points}</b><p className="text-[10px] uppercase tracking-wider text-zinc-500">pontos</p></div></div>{reviewable.length > 0 ? <div className="mt-5 border-t border-zinc-800 pt-4"><label className="text-xs font-bold text-zinc-400">ATENDIMENTO<select value={selected ?? ''} onChange={(event) => setSelected(Number(event.target.value) || null)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm"><option value="">Selecione</option>{reviewable.map((appointment) => <option key={appointment.id} value={appointment.id}>{formatDate(appointment.data)} · {appointment.servico_nome} · {appointment.barbeiro_nome}</option>)}</select></label><div className="mt-3 flex gap-1" aria-label="Nota da avaliação">{Array.from({ length: 5 }, (_, index) => <button key={index} type="button" onClick={() => setRating(index + 1)} aria-label={`${index + 1} estrelas`}><Star size={25} className={index < rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'} /></button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 1000))} placeholder="Conte como foi o atendimento (opcional)" className="mt-3 min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm" /><button onClick={() => { void save(); }} disabled={saving || !selected} className="mt-3 w-full rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? 'Enviando...' : 'Enviar avaliação'}</button></div> : <p className="mt-4 text-sm text-zinc-500">Conclua um novo atendimento para avaliar.</p>}</section>;
}
