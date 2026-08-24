'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Mail, MapPin, Scissors, ShieldCheck, UserRound, Users } from 'lucide-react';
import { Captcha } from '@/components/captcha';
import { SiteRights } from '@/components/site-rights';
import { supabase } from '@/lib/supabase';
import { displayTime, formatCurrency, formatWorkDays, upcomingDays, type DayChoice } from '@/lib/scheduling';
import type { PublicBarber, PublicCatalog, Service } from '@/lib/database.types';

type PendingBooking = {
  action: 'book' | 'waitlist';
  barberId: number;
  serviceId: number;
  date: string;
  time?: string;
  period?: 'manha' | 'tarde' | 'noite' | 'qualquer';
  identity: { name: string; phone: string; email: string };
};

const PENDING_KEY = 'agenda-brasil-pending-booking';

function readPending() {
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    return value ? JSON.parse(value) as PendingBooking : null;
  } catch {
    return null;
  }
}

export default function PublicBookingPage() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [barber, setBarber] = useState<PublicBarber | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [period, setPeriod] = useState<'manha' | 'tarde' | 'noite' | 'qualquer'>('qualquer');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<'book' | 'waitlist' | null>(null);
  const resumedIntent = useRef<string | null>(null);
  const days = useMemo<DayChoice[]>(() => upcomingDays(45), []);
  const holidays = useMemo(() => new Map(catalog?.feriados.map((holiday) => [holiday.data, holiday.descricao]) ?? []), [catalog]);

  const completeAction = useCallback(async (pending: PendingBooking) => {
    const toastId = toast.loading(pending.action === 'book' ? 'Finalizando agendamento...' : 'Entrando na fila de espera...');
    if (pending.action === 'book' && pending.time) {
      const { error } = await supabase.rpc('criar_agendamento_com_origem', {
        p_barbeiro_id: pending.barberId,
        p_servico_id: pending.serviceId,
        p_data: pending.date,
        p_horario: `${pending.time}:00`,
        p_origem: 'link_publico',
      });
      if (error) return toast.error(error.message, { id: toastId });
      setFinished('book');
    } else {
      const { error } = await supabase.rpc('entrar_fila_espera', {
        p_barbeiro_id: pending.barberId,
        p_servico_id: pending.serviceId,
        p_data: pending.date,
        p_periodo: pending.period ?? 'qualquer',
      });
      if (error) return toast.error(error.message, { id: toastId });
      setFinished('waitlist');
    }
    sessionStorage.removeItem(PENDING_KEY);
    toast.success(pending.action === 'book' ? 'Horário reservado!' : 'Você entrou na fila de espera!', { id: toastId });
  }, []);

  const completeIntent = useCallback(async (token: string) => {
    if (resumedIntent.current === token) return;
    resumedIntent.current = token;
    const toastId = toast.loading('Finalizando sua solicitação segura...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      resumedIntent.current = null;
      return toast.error('Este link não iniciou uma sessão válida. Solicite um novo link neste navegador.', { id: toastId });
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
      resumedIntent.current = null;
      return toast.error('Entre novamente para concluir a solicitação.', { id: toastId });
    }

    try {
      const response = await fetch(`/api/booking-intents/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => ({})) as { error?: string; action?: 'book' | 'waitlist' };
      if (!response.ok || !result.action) {
        resumedIntent.current = null;
        return toast.error(result.error ?? 'Não foi possível concluir a solicitação.', { id: toastId });
      }
      window.history.replaceState({}, '', '/agendar');
      setFinished(result.action);
      toast.success(result.action === 'book' ? 'Horário reservado!' : 'Você entrou na fila de espera!', { id: toastId });
    } catch {
      resumedIntent.current = null;
      toast.error('A conexão falhou. Tente abrir o link novamente.', { id: toastId });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const [{ data, error }, { data: userData, error: userError }] = await Promise.all([
        supabase.rpc('obter_catalogo_publico'),
        supabase.auth.getUser(),
      ]);
      if (!active) return;
      if (error || !data) toast.error(error?.message ?? 'Não foi possível carregar a agenda.');
      else setCatalog(data);
      if (userError) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      const userId = userError ? null : userData.user?.id ?? null;
      setSessionUserId(userId);
      setLoading(false);

      const search = new URLSearchParams(window.location.search);
      const intentToken = search.get('intent');
      if (userId && intentToken) {
        await completeIntent(intentToken);
      } else if (userId && search.get('retomar') === '1') {
        const pending = readPending();
        if (pending) await completeAction(pending);
      }
    };
    void initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
      const intentToken = new URLSearchParams(window.location.search).get('intent');
      // Supabase invokes this callback while holding its auth lock. Schedule
      // the follow-up outside the callback so getUser/getSession cannot
      // deadlock, which was especially visible in Safari.
      if (session?.user.id && intentToken) {
        window.setTimeout(() => { void completeIntent(intentToken); }, 0);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [completeAction, completeIntent]);

  const selectDate = async (choice: DayChoice) => {
    if (!barber || !service || holidays.has(choice.iso)) return;
    setDate(choice.iso);
    setTime('');
    setSlots([]);
    setCheckingSlots(true);
    const { data, error } = await supabase.rpc('buscar_horarios_disponiveis', {
      p_barbeiro_id: barber.id,
      p_servico_id: service.id,
      p_data: choice.iso,
    });
    setCheckingSlots(false);
    if (error) return toast.error(error.message);
    setSlots((data ?? []).map((slot) => displayTime(slot.horario)));
  };

  const buildPending = (action: 'book' | 'waitlist'): PendingBooking | null => {
    if (!barber || !service || !date || (action === 'book' && !time)) return null;
    return {
      action,
      barberId: barber.id,
      serviceId: service.id,
      date,
      time: time || undefined,
      period,
      identity: { name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase() },
    };
  };

  const authenticateOrComplete = async (action: 'book' | 'waitlist') => {
    if (submitting) return;
    const pending = buildPending(action);
    if (!pending) return toast.error('Complete as escolhas antes de continuar.');
    if (sessionUserId) return completeAction(pending);
    if (pending.identity.name.length < 2 || pending.identity.phone.replace(/\D/g, '').length < 10 || !pending.identity.email.includes('@')) {
      return toast.error('Informe nome, WhatsApp e e-mail válidos.');
    }
    if (!terms) return toast.error('É necessário aceitar os termos e a política de privacidade.');

    setSubmitting(true);
    try {
      const response = await fetch('/api/booking-intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, termsAccepted: true, captchaToken }),
      });
      const prepared = await response.json().catch(() => ({})) as { token?: string; error?: string };
      if (!response.ok || !prepared.token) return toast.error(prepared.error ?? 'Não foi possível preparar o agendamento.');

      const { error } = await supabase.auth.signInWithOtp({
        email: pending.identity.email,
        options: {
          emailRedirectTo: `${window.location.origin}/agendar?intent=${encodeURIComponent(prepared.token)}`,
          shouldCreateUser: true,
          captchaToken: captchaToken || undefined,
          data: { nome: pending.identity.name, telefone: pending.identity.phone, tipo: 'cliente', termos_aceitos: true },
        },
      });
      if (error) return toast.error(error.message);
      setMagicLinkSent(true);
      toast.success('Enviamos um link seguro para o seu e-mail. Abra-o neste mesmo navegador para concluir.');
    } catch {
      toast.error('Não foi possível conectar. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="app-screen flex items-center justify-center bg-zinc-950 text-zinc-300"><p className="animate-pulse">Carregando agenda...</p></main>;
  if (!catalog?.negocio) return <main className="app-screen flex items-center justify-center bg-zinc-950 p-6 text-center text-zinc-300">Agenda indisponível no momento.</main>;
  if (!catalog.negocio.agendamento_publico) return <main className="app-screen flex items-center justify-center bg-zinc-950 p-6 text-center text-zinc-300"><section><h1 className="text-2xl font-black text-white">Agendamento público indisponível</h1><p className="mt-2">Entre na sua conta para consultar a agenda.</p><Link href="/" className="mt-5 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Entrar</Link></section></main>;

  if (finished) return (
    <main className="app-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <section className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-zinc-900 p-8 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
        <h1 className="mt-4 text-2xl font-black">{finished === 'book' ? 'Horário reservado!' : 'Você está na fila!'}</h1>
        <p className="mt-2 text-sm text-zinc-400">{finished === 'book' ? 'Você receberá as atualizações pelos canais escolhidos no seu perfil.' : 'Avisaremos quando surgir um horário compatível.'}</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Abrir minha agenda</Link>
      </section>
    </main>
  );

  const filteredServices = catalog.servicos.filter((item) => item.barbeiro_id === barber?.id);
  return (
    <main className="app-screen safe-page-bottom bg-zinc-950 text-zinc-100">
      <Toaster position="top-center" />
      <header className="safe-header border-b border-zinc-800 px-4 pb-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Agendamento online</p><h1 className="text-xl font-black">{catalog.negocio.nome}</h1></div>
          <Link href="/" className="flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300"><ArrowLeft size={15} /> Entrar</Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        {(catalog.negocio.endereco || catalog.negocio.telefone) && <div className="flex flex-wrap gap-3 text-xs text-zinc-400">{catalog.negocio.endereco && <span className="flex items-center gap-1"><MapPin size={14} /> {catalog.negocio.endereco}</span>}{catalog.negocio.telefone && <span>{catalog.negocio.telefone}</span>}</div>}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl">
          <h2 className="mb-4 flex items-center gap-2 font-black"><Users className="text-emerald-400" size={20} /> 1. Escolha o profissional</h2>
          <div className="grid gap-3 sm:grid-cols-2">{catalog.barbeiros.map((item) => <button key={item.id} onClick={() => { setBarber(item); setService(null); setDate(''); setSlots([]); }} className={`rounded-xl border p-4 text-left ${barber?.id === item.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}><b className="block">{item.nome}</b><small className="text-zinc-500">{formatWorkDays(item.dias_trabalho)}</small></button>)}</div>
        </section>

        {barber && <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 font-black"><Scissors className="text-amber-400" size={20} /> 2. Escolha o serviço</h2><div className="grid gap-3 sm:grid-cols-3">{filteredServices.map((item) => <button key={item.id} onClick={() => { setService(item); setDate(''); setSlots([]); }} className={`rounded-xl border p-4 text-left ${service?.id === item.id ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}><b className="block">{item.nome}</b><small className="text-zinc-400">{formatCurrency(Number(item.preco))} · {item.duracao} min</small></button>)}</div></section>}

        {service && <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 font-black"><CalendarDays className="text-blue-400" size={20} /> 3. Escolha data e horário</h2><div className="flex gap-2 overflow-x-auto pb-3">{days.map((day) => { const holiday = holidays.get(day.iso); const disabled = !barber?.dias_trabalho.includes(day.businessDay) || Boolean(holiday); return <button key={day.iso} disabled={disabled} title={holiday} onClick={() => { void selectDate(day); }} className={`shrink-0 rounded-xl border px-3 py-2 text-xs disabled:opacity-30 ${date === day.iso ? 'border-blue-400 bg-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'}`}><b className="block">{day.day} {day.month}</b><span>{day.weekday}</span></button>; })}</div>{checkingSlots && <p className="mt-4 animate-pulse text-sm text-zinc-400">Consultando horários...</p>}{date && !checkingSlots && slots.length > 0 && <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{slots.map((slot) => <button key={slot} onClick={() => setTime(slot)} className={`rounded-lg border py-2 text-sm font-bold ${time === slot ? 'border-emerald-400 bg-emerald-500 text-zinc-950' : 'border-zinc-700 bg-zinc-950'}`}>{slot}</button>)}</div>}{date && !checkingSlots && slots.length === 0 && <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4"><p className="text-sm text-amber-200">Sem horários livres. Entre na fila e avisaremos quando houver uma vaga.</p><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"><option value="qualquer">Qualquer período</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></div>}</section>}

        {date && (time || slots.length === 0) && <section className="rounded-2xl border border-emerald-500/25 bg-zinc-900/80 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 font-black"><UserRound className="text-emerald-400" size={20} /> 4. Identificação segura</h2>{sessionUserId ? <p className="mb-4 flex items-center gap-2 text-sm text-emerald-300"><ShieldCheck size={17} /> Você já está identificado.</p> : <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400">NOME<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white" /></label><label className="text-xs font-bold text-zinc-400">WHATSAPP<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white" /></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">E-MAIL<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white" /></label><label className="flex items-start gap-2 text-xs text-zinc-400 sm:col-span-2"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>Aceito os <Link href="/termos" className="text-emerald-400 underline">termos de uso</Link> e a <Link href="/privacidade" className="text-emerald-400 underline">política de privacidade</Link>.</span></label><div className="sm:col-span-2"><Captcha onToken={setCaptchaToken} /></div></div>}{magicLinkSent ? <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-200"><Mail className="mr-2 inline" size={17} /> Abra o link enviado ao seu e-mail neste mesmo navegador para concluir. O link é válido por 30 minutos.</div> : <button disabled={submitting} onClick={() => { void authenticateOrComplete(time ? 'book' : 'waitlist'); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"><Clock size={18} /> {submitting ? 'Preparando com segurança...' : time ? 'Reservar horário' : 'Entrar na fila de espera'}</button>}{time && catalog.negocio.sinal_percentual > 0 && <p className="mt-3 text-center text-xs text-zinc-500">Este serviço solicita sinal de {catalog.negocio.sinal_percentual}%. As instruções Pix aparecerão depois da reserva.</p>}</section>}
        <SiteRights className="border-t border-zinc-900 pt-5" />
      </section>
    </main>
  );
}
