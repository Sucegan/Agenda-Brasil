'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award, CalendarDays, CheckCircle2, ChevronDown, Edit3,
  MessageSquareText, Scissors, ShieldCheck, Star, ThumbsUp, UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Appointment, Database } from '@/lib/database.types';
import { formatDate } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';

type Review = Database['public']['Tables']['avaliacoes']['Row'];
type ReviewRole = 'cliente' | 'barbeiro' | 'admin';
type Rating = 1 | 2 | 3 | 4 | 5;
type DetailRatings = Pick<Review, 'qualidade' | 'atendimento' | 'pontualidade'>;

const ratingOptions: Rating[] = [1, 2, 3, 4, 5];
const ratingDetails: Record<Rating, { label: string; helper: string }> = {
  1: { label: 'Muito ruim', helper: 'A experiência ficou muito abaixo do esperado.' },
  2: { label: 'Ruim', helper: 'Há pontos importantes que precisam melhorar.' },
  3: { label: 'Regular', helper: 'O atendimento cumpriu parcialmente o esperado.' },
  4: { label: 'Muito bom', helper: 'Uma experiência positiva, com pequenos ajustes.' },
  5: { label: 'Excelente', helper: 'Tudo ocorreu muito bem e superou as expectativas.' },
};
const detailLabels: Array<{ key: keyof DetailRatings; label: string; helper: string }> = [
  { key: 'qualidade', label: 'Resultado do serviço', helper: 'Qualidade e acabamento' },
  { key: 'atendimento', label: 'Atendimento', helper: 'Cuidado e cordialidade' },
  { key: 'pontualidade', label: 'Pontualidade', helper: 'Respeito ao horário marcado' },
];

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} de 5 estrelas`}>
      {ratingOptions.map((star) => (
        <Star key={star} size={size} aria-hidden="true" className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'} />
      ))}
    </span>
  );
}

function RatingPicker({ value, onChange, compact = false, label }: { value: number; onChange: (rating: Rating) => void; compact?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {ratingOptions.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onChange(star)}
          className={`rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${compact ? 'p-1.5' : 'p-2.5'} ${star <= value ? 'border-amber-400/50 bg-amber-400/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}
        >
          <Star size={compact ? 19 : 27} aria-hidden="true" className={star <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'} />
        </button>
      ))}
    </div>
  );
}

function getAverage(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === 'number');
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function ReviewCard({ review, appointment, canEdit = false, onEdit }: { review: Review; appointment?: Appointment; canEdit?: boolean; onEdit?: () => void }) {
  const detailed = detailLabels.filter(({ key }) => typeof review[key] === 'number');
  const wasEdited = review.updated_at !== review.created_at;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={review.nota} />
            <b className="text-sm text-amber-200">{ratingDetails[review.nota as Rating]?.label ?? `${review.nota}/5`}</b>
          </div>
          <p className="mt-2 truncate text-sm font-bold text-zinc-100">{appointment?.servico_nome ?? `Atendimento #${review.agendamento_id}`}</p>
          {appointment && (
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {formatDate(appointment.data)}</span>
              <span className="inline-flex items-center gap-1"><UserRound size={13} /> {appointment.barbeiro_nome}</span>
            </p>
          )}
        </div>
        {canEdit && onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-amber-400/50 hover:text-amber-200">
            <Edit3 size={14} /> Editar
          </button>
        )}
      </div>
      {detailed.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {detailed.map(({ key, label }) => <span key={key} className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">{label}: <b className="text-zinc-200">{review[key]}/5</b></span>)}
        </div>
      )}
      {review.comentario && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">“{review.comentario}”</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-3 text-[11px] text-zinc-600">
        <span>{wasEdited ? 'Avaliação editada' : 'Avaliação enviada'}</span>
        {review.recomendaria !== null && <span className={`inline-flex items-center gap-1 font-bold ${review.recomendaria ? 'text-emerald-400' : 'text-zinc-500'}`}><ThumbsUp size={12} /> {review.recomendaria ? 'Recomendaria' : 'Não recomendaria'}</span>}
      </div>
    </article>
  );
}

export function ReviewLoyalty({ role, appointments, points = 0, barberId, barberIds }: { role: ReviewRole; appointments: Appointment[]; points?: number; barberId?: number; barberIds?: number[] }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [rating, setRating] = useState<Rating>(5);
  const [details, setDetails] = useState<DetailRatings>({ qualidade: 5, atendimento: 5, pontualidade: 5 });
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(true);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [serviceFilter, setServiceFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  const barberIdsKey = barberIds?.join(',') ?? '';
  const appointmentsById = useMemo(() => new Map(appointments.map((appointment) => [appointment.id, appointment])), [appointments]);

  const load = useCallback(async () => {
    if (role === 'admin' && !barberIdsKey) {
      setReviews([]);
      setLoadingReviews(false);
      return;
    }

    setLoadingReviews(true);
    setLoadError('');
    let query = supabase.from('avaliacoes').select('*').order('created_at', { ascending: false });
    if (role === 'barbeiro' && barberId) query = query.eq('barbeiro_id', barberId);
    if (role === 'admin') query = query.in('barbeiro_id', barberIdsKey.split(',').map(Number));
    const { data, error } = await query;
    setLoadingReviews(false);
    if (error) {
      setLoadError('Não foi possível carregar as avaliações agora.');
      return;
    }
    setReviews(data ?? []);
  }, [barberId, barberIdsKey, role]);

  useEffect(() => { void load(); }, [load]);

  const reviewedIds = useMemo(() => new Set(reviews.map((review) => review.agendamento_id)), [reviews]);
  const reviewable = useMemo(() => appointments.filter((appointment) => appointment.status === 'concluido' && !reviewedIds.has(appointment.id)), [appointments, reviewedIds]);
  const activeAppointment = selected ? appointmentsById.get(selected) : undefined;
  const average = getAverage(reviews.map((review) => review.nota));
  const satisfaction = reviews.length ? Math.round(reviews.filter((review) => review.nota >= 4).length / reviews.length * 100) : 0;
  const recommendationVotes = reviews.filter((review) => review.recomendaria !== null);
  const recommendation = recommendationVotes.length ? Math.round(recommendationVotes.filter((review) => review.recomendaria).length / recommendationVotes.length * 100) : null;
  const detailAverages = useMemo(() => detailLabels.map((detail) => ({ ...detail, average: getAverage(reviews.map((review) => review[detail.key])) })), [reviews]);
  const serviceOptions = useMemo(() => Array.from(new Set(reviews.map((review) => appointmentsById.get(review.agendamento_id)?.servico_nome).filter((name): name is string => Boolean(name)))).sort(), [appointmentsById, reviews]);
  const filteredReviews = useMemo(() => reviews.filter((review) => {
    const appointment = appointmentsById.get(review.agendamento_id);
    return (!ratingFilter || review.nota === ratingFilter) && (!serviceFilter || appointment?.servico_nome === serviceFilter);
  }), [appointmentsById, ratingFilter, reviews, serviceFilter]);

  const resetEditor = () => {
    setSelected(null);
    setEditingReviewId(null);
    setRating(5);
    setDetails({ qualidade: 5, atendimento: 5, pontualidade: 5 });
    setWouldRecommend(true);
    setComment('');
  };

  const startNewReview = (appointmentId: number) => {
    resetEditor();
    setSelected(appointmentId);
  };

  const startEditing = (review: Review) => {
    setSelected(review.agendamento_id);
    setEditingReviewId(review.id);
    setRating(review.nota as Rating);
    setDetails({
      qualidade: review.qualidade ?? review.nota,
      atendimento: review.atendimento ?? review.nota,
      pontualidade: review.pontualidade ?? review.nota,
    });
    setWouldRecommend(review.recomendaria);
    setComment(review.comentario ?? '');
  };

  const save = async () => {
    const appointment = selected ? appointmentsById.get(selected) : undefined;
    if (!appointment || appointment.status !== 'concluido') return toast.error('Escolha um atendimento concluído.');

    setSaving(true);
    const wasEditing = Boolean(editingReviewId);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Sua sessão expirou. Entre novamente para avaliar.');
      const feedback = {
        nota: rating,
        comentario: comment.trim() || null,
        qualidade: details.qualidade,
        atendimento: details.atendimento,
        pontualidade: details.pontualidade,
        recomendaria: wouldRecommend,
      };

      const { error } = editingReviewId
        ? await supabase.from('avaliacoes').update({ ...feedback, updated_at: new Date().toISOString() }).eq('id', editingReviewId)
        : await supabase.from('avaliacoes').insert({
          ...feedback,
          agendamento_id: appointment.id,
          usuario_id: userData.user.id,
          barbeiro_id: appointment.barbeiro_id,
        });
      if (error) throw error;

      resetEditor();
      await load();
      toast.success(wasEditing ? 'Avaliação atualizada com sucesso!' : 'Obrigado! Sua avaliação foi enviada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a avaliação.');
    } finally {
      setSaving(false);
    }
  };

  if (role === 'barbeiro' || role === 'admin') {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black"><MessageSquareText className="text-amber-400" size={21} /> Avaliações dos serviços</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{role === 'admin' ? 'Visão consolidada e privada de toda a unidade.' : 'Feedback privado dos clientes que você atendeu.'}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-left sm:text-right">
            <div className="flex items-center gap-2 sm:justify-end"><b className="text-2xl text-amber-300">{average?.toFixed(1) ?? '—'}</b>{average !== null && <Stars value={Math.round(average)} />}</div>
            <p className="text-[11px] text-zinc-500">{reviews.length} {reviews.length === 1 ? 'avaliação recebida' : 'avaliações recebidas'}</p>
          </div>
        </div>

        {loadingReviews && <div className="mt-5 h-32 animate-pulse rounded-2xl bg-zinc-800/60" aria-label="Carregando avaliações" />}
        {!loadingReviews && loadError && <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{loadError}</p>}
        {!loadingReviews && !loadError && reviews.length > 0 && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><small className="text-zinc-500">Satisfação</small><b className="mt-1 block text-xl text-emerald-300">{satisfaction}%</b><span className="text-[10px] text-zinc-600">notas 4 e 5</span></div>
              {detailAverages.map(({ key, label, average: detailAverage }) => <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"><small className="text-zinc-500">{label}</small><b className="mt-1 block text-xl text-zinc-100">{detailAverage?.toFixed(1) ?? '—'}</b><span className="text-[10px] text-zinc-600">média de 5</span></div>)}
            </div>
            {recommendation !== null && <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-sm text-emerald-200"><ThumbsUp size={17} /> <b>{recommendation}%</b> dos clientes com resposta recomendariam o atendimento.</p>}

            <div className="mt-5 grid gap-3 border-y border-zinc-800 py-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-zinc-400">FILTRAR POR NOTA
                <span className="relative mt-1.5 block"><select value={ratingFilter} onChange={(event) => { setRatingFilter(Number(event.target.value)); setVisibleCount(5); }} className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 pr-10 text-sm font-normal text-zinc-200 outline-none focus:border-amber-500"><option value="0">Todas as notas</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrelas</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-zinc-500" size={16} /></span>
              </label>
              <label className="text-xs font-bold text-zinc-400">FILTRAR POR SERVIÇO
                <span className="relative mt-1.5 block"><select value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value); setVisibleCount(5); }} className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 pr-10 text-sm font-normal text-zinc-200 outline-none focus:border-amber-500"><option value="">Todos os serviços</option>{serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-zinc-500" size={16} /></span>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {filteredReviews.slice(0, visibleCount).map((review) => <ReviewCard key={review.id} review={review} appointment={appointmentsById.get(review.agendamento_id)} />)}
              {!filteredReviews.length && <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-sm text-zinc-500">Nenhuma avaliação corresponde aos filtros.</p>}
            </div>
            {visibleCount < filteredReviews.length && <button type="button" onClick={() => setVisibleCount((count) => count + 5)} className="mt-4 w-full rounded-xl border border-zinc-700 py-3 text-sm font-bold text-zinc-300 hover:border-amber-400/50 hover:text-amber-200">Mostrar mais avaliações</button>}
          </>
        )}
        {!loadingReviews && !loadError && !reviews.length && <p className="mt-5 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">As primeiras avaliações aparecerão aqui após atendimentos concluídos.</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 shadow-xl sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><Award className="text-amber-400" size={21} /> Avaliação do serviço</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Avalie somente atendimentos concluídos. Seu feedback é privado e ajuda a melhorar o serviço.</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center"><b className="text-xl text-amber-300">{points}</b><p className="text-[10px] uppercase tracking-wider text-zinc-500">pontos de fidelidade</p></div>
      </div>

      {loadingReviews && <div className="mt-5 h-24 animate-pulse rounded-2xl bg-zinc-800/60" aria-label="Carregando avaliações" />}
      {!loadingReviews && loadError && <p role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{loadError}</p>}

      {!loadingReviews && !activeAppointment && reviewable.length > 0 && (
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <h3 className="font-bold text-zinc-100">Atendimentos aguardando sua avaliação</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {reviewable.map((appointment) => (
              <button key={appointment.id} type="button" onClick={() => startNewReview(appointment.id)} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-left transition hover:border-amber-400/40 hover:bg-amber-400/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
                <span className="flex items-start justify-between gap-3"><span><b className="block text-zinc-100">{appointment.servico_nome}</b><small className="mt-1 block text-zinc-500">{formatDate(appointment.data)} · {appointment.barbeiro_nome}</small></span><span className="rounded-lg bg-amber-400/10 p-2 text-amber-300"><Scissors size={17} /></span></span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-300">Avaliar agora <ChevronDown className="-rotate-90" size={14} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeAppointment && (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-zinc-950/60 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-start">
            <div><span className="text-[10px] font-black uppercase tracking-widest text-amber-400">{editingReviewId ? 'Editando avaliação' : 'Novo feedback'}</span><h3 className="mt-1 font-black text-white">{activeAppointment.servico_nome}</h3><p className="mt-1 text-xs text-zinc-500">{formatDate(activeAppointment.data)} · {activeAppointment.barbeiro_nome}</p></div>
            <button type="button" onClick={resetEditor} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancelar</button>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-zinc-200">Qual é sua nota geral?</p>
            <p className="mt-1 text-xs text-zinc-500">Considere toda a experiência com o serviço.</p>
            <div className="mt-3"><RatingPicker value={rating} onChange={setRating} label="Nota geral do atendimento" /></div>
            <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3"><b className="text-sm text-amber-200">{ratingDetails[rating].label}</b><p className="mt-0.5 text-xs text-zinc-500">{ratingDetails[rating].helper}</p></div>
          </div>

          <fieldset className="mt-5 border-t border-zinc-800 pt-5">
            <legend className="text-sm font-bold text-zinc-200">Conte um pouco mais</legend>
            <p className="mt-1 text-xs text-zinc-500">Esses critérios ajudam a equipe a entender exatamente onde melhorar.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {detailLabels.map(({ key, label, helper }) => (
                <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                  <label className="block text-xs font-bold text-zinc-300">{label}<span className="mt-0.5 block font-normal text-zinc-600">{helper}</span></label>
                  <div className="mt-3"><RatingPicker compact value={details[key] ?? rating} onChange={(value) => setDetails((current) => ({ ...current, [key]: value }))} label={label} /></div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-zinc-200">Você recomendaria este atendimento?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={wouldRecommend === true} onClick={() => setWouldRecommend(true)} className={`rounded-xl border p-3 text-sm font-bold ${wouldRecommend === true ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}><ThumbsUp className="mr-1.5 inline" size={16} /> Sim</button>
              <button type="button" aria-pressed={wouldRecommend === false} onClick={() => setWouldRecommend(false)} className={`rounded-xl border p-3 text-sm font-bold ${wouldRecommend === false ? 'border-zinc-500 bg-zinc-800 text-zinc-100' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>Ainda não</button>
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-bold text-zinc-200">Comentário <span className="font-normal text-zinc-600">(opcional)</span>
            <textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 1000))} maxLength={1000} placeholder="Conte o que mais gostou ou o que poderia melhorar..." className="mt-2 min-h-28 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm font-normal leading-6 outline-none placeholder:text-zinc-700 focus:border-amber-500" />
          </label>
          <p className="mt-1 text-right text-[11px] text-zinc-600">{comment.length}/1000 caracteres</p>

          <button type="button" onClick={() => { void save(); }} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-black text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
            <CheckCircle2 size={18} /> {saving ? 'Salvando avaliação...' : editingReviewId ? 'Salvar alterações' : 'Enviar avaliação'}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-600"><ShieldCheck size={13} /> A avaliação só pode ser vinculada ao seu próprio atendimento concluído.</p>
        </div>
      )}

      {!loadingReviews && !loadError && !activeAppointment && !reviewable.length && !reviews.length && <p className="mt-5 rounded-xl border border-dashed border-zinc-800 p-5 text-center text-sm text-zinc-500">Depois que um atendimento for concluído, a opção de avaliar aparecerá aqui.</p>}

      {!loadingReviews && reviews.length > 0 && (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-zinc-100">Minhas avaliações</h3><p className="mt-0.5 text-xs text-zinc-600">Você pode corrigir sua nota ou comentário quando quiser.</p></div><span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-400">{reviews.length}</span></div>
          <div className="mt-3 space-y-3">{reviews.map((review) => <ReviewCard key={review.id} review={review} appointment={appointmentsById.get(review.agendamento_id)} canEdit onEdit={() => startEditing(review)} />)}</div>
        </div>
      )}
    </section>
  );
}
