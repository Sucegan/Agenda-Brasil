'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import {
  Award, BarChart3, Building2, CalendarCheck2, CalendarDays, CalendarX2,
  CircleX, Clock, Copy, KeyRound, LogOut, MapPin,
  MessageCircle, Plus, Scissors, Settings, Trash2, TrendingUp, Umbrella,
  UserCog, UserPlus, Users, Wallet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  appointmentStatusLabels, brazilDateISO, displayTime, formatCurrency,
  formatDate, formatWorkDays, upcomingDays, weekdayLabels, type DayChoice,
} from '@/lib/scheduling';
import type {
  Appointment, AppointmentStatus, Barber, BusinessDay, BusinessHoliday,
  BusinessSettings, PublicBarber, ScheduleBlock, Service, UserProfile,
} from '@/lib/database.types';

const statuses: AppointmentStatus[] = ['agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu'];

const statusClasses: Record<AppointmentStatus, string> = {
  agendado: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  confirmado: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  concluido: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  cancelado: 'border-red-500/30 bg-red-500/10 text-red-300',
  nao_compareceu: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
};

const DashboardSkeleton = () => (
  <main className="flex min-h-screen w-full flex-col items-center gap-6 bg-zinc-950 p-4 animate-pulse sm:p-6">
    <div className="h-16 w-full max-w-5xl rounded-xl border border-zinc-800 bg-zinc-900" />
    <div className="h-44 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900" />
    <div className="h-96 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900" />
  </main>
);

function StatusPill({ status }: { status: AppointmentStatus }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses[status]}`}>{appointmentStatusLabels[status]}</span>;
}

function StatCard({ label, value, icon: Icon, color = 'emerald' }: { label: string; value: string; icon: typeof Wallet; color?: 'emerald' | 'amber' | 'blue' | 'orange' }) {
  const colors = {
    emerald: 'text-emerald-400 border-emerald-500/30',
    amber: 'text-amber-400 border-amber-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    orange: 'text-orange-400 border-orange-500/30',
  };
  const [text, border] = colors[color].split(' ');
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-zinc-900/70 p-5 shadow-xl ${border}`}>
      <Icon className={`absolute right-4 top-4 opacity-15 ${text}`} size={44} />
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`text-2xl font-black ${text}`}>{value}</p>
    </div>
  );
}

function AppointmentItem({ item, role, onStatusChange, onConfirm, onCancel }: {
  item: Appointment;
  role: 'cliente' | 'barbeiro';
  onStatusChange?: (status: AppointmentStatus) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const canConfirm = role === 'cliente' && item.status === 'agendado' && onConfirm;
  const canCancel = role === 'cliente' && ['agendado', 'confirmado'].includes(item.status) && onCancel;
  const digits = item.cliente_telefone?.replace(/\D/g, '') ?? '';
  const whatsapp = digits ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` : '';
  return (
    <article className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/45 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-xl font-black text-white">{displayTime(item.horario)}</p>
          <StatusPill status={item.status} />
        </div>
        <p className="font-bold text-zinc-100">{role === 'barbeiro' ? item.cliente_nome : item.servico_nome}</p>
        <p className="mt-1 text-xs text-zinc-400">
          {role === 'barbeiro' ? <>{item.servico_nome} · {formatCurrency(Number(item.servico_preco ?? 0))}</> : <>Profissional: {item.barbeiro_nome} · {formatCurrency(Number(item.servico_preco ?? 0))}</>}
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-500">{formatDate(item.data)} · {item.servico_duracao ?? 0} min</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {role === 'barbeiro' && whatsapp && (
          <a href={`${whatsapp}?text=${encodeURIComponent(`Olá, ${item.cliente_nome}! Lembrete do seu horário em ${formatDate(item.data)} às ${displayTime(item.horario)}.`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20">
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        {role === 'barbeiro' && onStatusChange && <select value={item.status} onChange={(event) => onStatusChange(event.target.value as AppointmentStatus)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-emerald-500">
          {statuses.map((status) => <option key={status} value={status}>{appointmentStatusLabels[status]}</option>)}
        </select>}
        {canConfirm && <button onClick={onConfirm} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">Confirmar presença</button>}
        {canCancel && <button onClick={onCancel} className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20">Cancelar</button>}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [negocio, setNegocio] = useState<BusinessSettings | null>(null);
  const [barbeiro, setBarbeiro] = useState<Barber | null>(null);
  const [barbeiros, setBarbeiros] = useState<PublicBarber[]>([]);
  const [servicos, setServicos] = useState<Service[]>([]);
  const [agendamentos, setAgendamentos] = useState<Appointment[]>([]);
  const [feriados, setFeriados] = useState<BusinessHoliday[]>([]);
  const [bloqueios, setBloqueios] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const [perfilAberto, setPerfilAberto] = useState(false);
  const [nomePerfil, setNomePerfil] = useState('');
  const [telefonePerfil, setTelefonePerfil] = useState('');
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<PublicBarber | null>(null);
  const [selectedServico, setSelectedServico] = useState<Service | null>(null);
  const [selectedData, setSelectedData] = useState('');
  const [selectedHorario, setSelectedHorario] = useState('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [diasProximos] = useState<DayChoice[]>(() => upcomingDays(30));

  const [novoServicoNome, setNovoServicoNome] = useState('');
  const [novoServicoPreco, setNovoServicoPreco] = useState('');
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('30');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [diasTrabalho, setDiasTrabalho] = useState<BusinessDay[]>([1, 2, 3, 4, 5, 6]);
  const [bloqueioTipo, setBloqueioTipo] = useState<'pausa' | 'folga' | 'ferias'>('pausa');
  const [bloqueioInicio, setBloqueioInicio] = useState('');
  const [bloqueioFim, setBloqueioFim] = useState('');
  const [bloqueioHoraInicio, setBloqueioHoraInicio] = useState('12:00');
  const [bloqueioHoraFim, setBloqueioHoraFim] = useState('13:00');
  const [bloqueioMotivo, setBloqueioMotivo] = useState('');
  const [feriadoData, setFeriadoData] = useState('');
  const [feriadoDescricao, setFeriadoDescricao] = useState('');
  const [nomeNegocio, setNomeNegocio] = useState('');
  const [enderecoNegocio, setEnderecoNegocio] = useState('');
  const [telefoneNegocio, setTelefoneNegocio] = useState('');
  const [logoNegocio, setLogoNegocio] = useState('');

  const hoje = brazilDateISO();

  const carregarDados = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/');
      return;
    }
    setEmail(session.user.email ?? '');
    const [{ data: perfil, error: perfilError }, { data: configuracoes, error: configError }, { data: feriadosData, error: feriadosError }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', session.user.id).single(),
      supabase.from('configuracoes_negocio').select('*').eq('id', true).maybeSingle(),
      supabase.from('feriados_negocio').select('*').order('data'),
    ]);
    if (perfilError || !perfil) throw new Error('Não foi possível carregar seu perfil. Confirme o e-mail e tente novamente.');
    if (configError || feriadosError) throw configError ?? feriadosError;
    setUsuario(perfil);
    setNomePerfil(perfil.nome);
    setTelefonePerfil(perfil.telefone ?? '');
    setNegocio(configuracoes);
    setFeriados(feriadosData ?? []);
    if (configuracoes) {
      setNomeNegocio(configuracoes.nome);
      setEnderecoNegocio(configuracoes.endereco ?? '');
      setTelefoneNegocio(configuracoes.telefone ?? '');
      setLogoNegocio(configuracoes.logo_url ?? '');
    }
    if (perfil.tipo === 'cliente') {
      const [{ data: profissionais, error: profissionaisError }, { data: servicosData, error: servicosError }, { data: agendaData, error: agendaError }] = await Promise.all([
        supabase.rpc('listar_barbeiros_publicos'),
        supabase.from('servicos').select('*').order('nome'),
        supabase.from('agendamentos').select('*').order('data').order('horario'),
      ]);
      if (profissionaisError || servicosError || agendaError) throw profissionaisError ?? servicosError ?? agendaError;
      setBarbeiros(profissionais ?? []);
      setServicos(servicosData ?? []);
      setAgendamentos(agendaData ?? []);
      setBarbeiro(null);
      setBloqueios([]);
      return;
    }
    const { data: profissional, error: profissionalError } = await supabase.from('barbeiros').select('*').eq('usuario_id', session.user.id).single();
    if (profissionalError || !profissional) throw new Error('Não foi possível carregar o perfil profissional.');
    const [{ data: servicosData, error: servicosError }, { data: agendaData, error: agendaError }, { data: bloqueiosData, error: bloqueiosError }] = await Promise.all([
      supabase.from('servicos').select('*').eq('barbeiro_id', profissional.id).order('nome'),
      supabase.from('agendamentos').select('*').eq('barbeiro_id', profissional.id).order('data').order('horario'),
      supabase.from('bloqueios_agenda').select('*').eq('barbeiro_id', profissional.id).order('data_inicio'),
    ]);
    if (servicosError || agendaError || bloqueiosError) throw servicosError ?? agendaError ?? bloqueiosError;
    setBarbeiro(profissional);
    setServicos(servicosData ?? []);
    setAgendamentos(agendaData ?? []);
    setBloqueios(bloqueiosData ?? []);
    setHorarioInicio(displayTime(profissional.horario_inicio));
    setHorarioFim(displayTime(profissional.horario_fim));
    setDiasTrabalho(profissional.dias_trabalho);
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void carregarDados().catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Falha ao carregar os dados.')).finally(() => setLoading(false));
    }, 0);
    const channel = supabase.channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => { void carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => { void carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueios_agenda' }, () => { void carregarDados(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feriados_negocio' }, () => { void carregarDados(); })
      .subscribe();
    return () => { window.clearTimeout(initialLoad); void supabase.removeChannel(channel); };
  }, [carregarDados]);

  const feriadosPorData = useMemo(() => new Map(feriados.map((feriado) => [feriado.data, feriado.descricao])), [feriados]);
  const agendaHoje = useMemo(() => agendamentos.filter((item) => item.data === hoje), [agendamentos, hoje]);
  const agendaFutura = useMemo(() => agendamentos.filter((item) => item.data >= hoje && !['cancelado', 'nao_compareceu'].includes(item.status)), [agendamentos, hoje]);
  const faturamentoHoje = useMemo(() => agendaHoje.filter((item) => item.status === 'concluido').reduce((total, item) => total + Number(item.servico_preco ?? 0), 0), [agendaHoje]);
  const previsaoFutura = useMemo(() => agendaFutura.reduce((total, item) => total + Number(item.servico_preco ?? 0), 0), [agendaFutura]);
  const relatorioMes = useMemo(() => {
    const itens = agendamentos.filter((item) => item.data.startsWith(hoje.slice(0, 7)));
    const concluidos = itens.filter((item) => item.status === 'concluido');
    const receitas = concluidos.reduce((total, item) => total + Number(item.servico_preco ?? 0), 0);
    const agrupar = (key: 'servico_nome' | 'cliente_nome') => concluidos.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item[key] ?? 'Sem informação']: (acc[item[key] ?? 'Sem informação'] ?? 0) + 1 }), {});
    return {
      receitas,
      ticket: concluidos.length ? receitas / concluidos.length : 0,
      faltas: itens.filter((item) => item.status === 'nao_compareceu').length,
      favorito: Object.entries(agrupar('servico_nome')).sort((a, b) => b[1] - a[1])[0],
      frequente: Object.entries(agrupar('cliente_nome')).sort((a, b) => b[1] - a[1])[0],
    };
  }, [agendamentos, hoje]);

  const atualizarPerfil = async (event: React.FormEvent) => {
    event.preventDefault();
    const toastId = toast.loading('Salvando perfil...');
    const { data, error } = await supabase.rpc('atualizar_meu_perfil', { p_nome: nomePerfil, p_telefone: telefonePerfil });
    if (error || !data) return toast.error(error?.message ?? 'Não foi possível salvar seu perfil.', { id: toastId });
    await supabase.auth.updateUser({ data: { nome: nomePerfil, full_name: nomePerfil, display_name: nomePerfil, telefone: telefonePerfil } });
    setUsuario(data);
    toast.success('Perfil atualizado!', { id: toastId });
  };

  const solicitarNovaSenha = async () => {
    if (!email) return toast.error('Não encontramos seu e-mail.');
    const toastId = toast.loading('Enviando link...');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (error) return toast.error('Não foi possível enviar o link de recuperação.', { id: toastId });
    toast.success('Link de recuperação enviado para seu e-mail.', { id: toastId });
  };

  const calcularHorarios = async (data: string) => {
    if (!selectedBarbeiro || !selectedServico) return;
    const { data: slots, error } = await supabase.rpc('buscar_horarios_disponiveis', { p_barbeiro_id: selectedBarbeiro.id, p_servico_id: selectedServico.id, p_data: data });
    if (error) return toast.error(error.message);
    setSelectedData(data);
    setSelectedHorario('');
    setHorariosDisponiveis((slots ?? []).map((slot) => displayTime(slot.horario)));
  };

  const agendar = async () => {
    if (!selectedBarbeiro || !selectedServico || !selectedData || !selectedHorario) return toast.error('Escolha profissional, serviço, data e horário.');
    const toastId = toast.loading('Confirmando agendamento...');
    const { error } = await supabase.rpc('criar_agendamento', { p_barbeiro_id: selectedBarbeiro.id, p_servico_id: selectedServico.id, p_data: selectedData, p_horario: `${selectedHorario}:00` });
    if (error) return toast.error(error.message, { id: toastId });
    setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData(''); setSelectedHorario(''); setHorariosDisponiveis([]);
    await carregarDados();
    toast.success('Agendamento realizado! Confirme sua presença na lista abaixo.', { id: toastId });
  };

  const confirmarAgendamento = async (id: number) => {
    const toastId = toast.loading('Confirmando presença...');
    const { error } = await supabase.rpc('confirmar_meu_agendamento', { p_agendamento_id: id });
    if (error) return toast.error(error.message, { id: toastId });
    await carregarDados();
    toast.success('Presença confirmada!', { id: toastId });
  };

  const cancelarAgendamento = async (id: number) => {
    if (!window.confirm('Deseja cancelar este agendamento?')) return;
    const toastId = toast.loading('Cancelando...');
    const { error } = await supabase.rpc('cancelar_meu_agendamento', { p_agendamento_id: id });
    if (error) return toast.error(error.message, { id: toastId });
    await carregarDados();
    toast.success('Agendamento cancelado.', { id: toastId });
  };

  const atualizarStatus = async (id: number, status: AppointmentStatus) => {
    const { error } = await supabase.rpc('atualizar_status_agendamento', { p_agendamento_id: id, p_status: status });
    if (error) return toast.error(error.message);
    await carregarDados();
    toast.success('Status atualizado.');
  };

  const salvarExpediente = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!barbeiro) return;
    if (horarioInicio >= horarioFim || diasTrabalho.length === 0) return toast.error('Informe horários válidos e ao menos um dia de atendimento.');
    const toastId = toast.loading('Salvando expediente...');
    const { error } = await supabase.from('barbeiros').update({ horario_inicio: horarioInicio, horario_fim: horarioFim, dias_trabalho: diasTrabalho }).eq('id', barbeiro.id);
    if (error) return toast.error(error.message, { id: toastId });
    await carregarDados();
    toast.success('Expediente atualizado!', { id: toastId });
  };

  const adicionarServico = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!barbeiro) return;
    const preco = Number(novoServicoPreco.replace(',', '.'));
    const duracao = Number(novoServicoDuracao);
    if (!novoServicoNome.trim() || !Number.isFinite(preco) || preco <= 0 || !Number.isInteger(duracao) || duracao < 5) return toast.error('Informe nome, preço válido e duração de ao menos 5 minutos.');
    const toastId = toast.loading('Adicionando serviço...');
    const { error } = await supabase.from('servicos').insert({ nome: novoServicoNome.trim(), preco, duracao, barbeiro_id: barbeiro.id });
    if (error) return toast.error(error.message, { id: toastId });
    setNovoServicoNome(''); setNovoServicoPreco(''); setNovoServicoDuracao('30');
    await carregarDados();
    toast.success('Serviço adicionado!', { id: toastId });
  };

  const excluirServico = async (id: number) => {
    if (!window.confirm('Excluir este serviço?')) return;
    const { error } = await supabase.from('servicos').delete().eq('id', id);
    if (error?.code === '23503') return toast.error('Este serviço já possui agendamentos e não pode ser excluído.');
    if (error) return toast.error(error.message);
    await carregarDados();
    toast.success('Serviço excluído.');
  };

  const salvarBloqueio = async (event: React.FormEvent) => {
    event.preventDefault();
    const diaFim = bloqueioFim || bloqueioInicio;
    if (!bloqueioInicio || !diaFim || !bloqueioMotivo.trim()) return toast.error('Informe período e motivo do bloqueio.');
    const horarioParcial = bloqueioTipo === 'pausa';
    const toastId = toast.loading('Bloqueando agenda...');
    const { error } = await supabase.rpc('criar_bloqueio_agenda', {
      p_data_inicio: bloqueioInicio, p_data_fim: diaFim,
      p_hora_inicio: horarioParcial ? `${bloqueioHoraInicio}:00` : null,
      p_hora_fim: horarioParcial ? `${bloqueioHoraFim}:00` : null,
      p_tipo: bloqueioTipo, p_motivo: bloqueioMotivo.trim(),
    });
    if (error) return toast.error(error.message, { id: toastId });
    setBloqueioInicio(''); setBloqueioFim(''); setBloqueioMotivo('');
    await carregarDados();
    toast.success('Período bloqueado.', { id: toastId });
  };

  const removerBloqueio = async (id: number) => {
    if (!window.confirm('Remover este bloqueio?')) return;
    const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', id);
    if (error) return toast.error(error.message);
    await carregarDados();
    toast.success('Bloqueio removido.');
  };

  const salvarFeriado = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usuario || !feriadoData || !feriadoDescricao.trim()) return toast.error('Informe a data e a descrição do feriado.');
    const toastId = toast.loading('Salvando feriado...');
    const { error } = await supabase.from('feriados_negocio').upsert({ data: feriadoData, descricao: feriadoDescricao.trim(), criado_por: usuario.id }, { onConflict: 'data' });
    if (error) return toast.error(error.message, { id: toastId });
    setFeriadoData(''); setFeriadoDescricao('');
    await carregarDados();
    toast.success('Feriado salvo.', { id: toastId });
  };

  const removerFeriado = async (data: string) => {
    if (!window.confirm('Remover este feriado?')) return;
    const { error } = await supabase.from('feriados_negocio').delete().eq('data', data);
    if (error) return toast.error(error.message);
    await carregarDados();
    toast.success('Feriado removido.');
  };

  const salvarNegocio = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nomeNegocio.trim()) return toast.error('Informe o nome da barbearia.');
    const toastId = toast.loading('Salvando configurações...');
    const { error } = await supabase.from('configuracoes_negocio').update({
      nome: nomeNegocio.trim(), endereco: enderecoNegocio.trim() || null,
      telefone: telefoneNegocio.trim() || null, logo_url: logoNegocio.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', true);
    if (error) return toast.error(error.message, { id: toastId });
    await carregarDados();
    toast.success('Configurações salvas!', { id: toastId });
  };

  const criarConvite = async () => {
    const { data, error } = await supabase.rpc('criar_convite_barbeiro');
    if (error || !data) return toast.error(error?.message ?? 'Não foi possível criar o convite.');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?tipo=barbeiro&convite=${data}`);
      toast.success('Convite copiado. Válido por 7 dias e para um único uso.');
    } catch { toast.error('Não foi possível copiar o convite.'); }
  };

  if (loading) return <DashboardSkeleton />;

  const proximosCliente = agendamentos.filter((item) => item.data >= hoje && !['concluido', 'cancelado', 'nao_compareceu'].includes(item.status));
  const historicoCliente = agendamentos.filter((item) => !proximosCliente.some((proximo) => proximo.id === item.id));
  const diasOrdenados: BusinessDay[] = [0, 1, 2, 3, 4, 5, 6];

  return (
    <main className="min-h-screen bg-zinc-950 pb-16 text-zinc-100 selection:bg-emerald-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-xl font-black text-transparent sm:text-2xl">{negocio?.nome ?? 'Agenda Brasil'}</h1>
            <p className="mt-0.5 truncate text-xs text-zinc-400">Olá, {usuario?.nome} <span className="ml-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-300">{usuario?.tipo}</span></p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setPerfilAberto((open) => !open)} className="rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300" aria-label="Abrir perfil"><UserCog size={17} /></button>
            <button onClick={() => { void supabase.auth.signOut(); router.replace('/'); }} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-800"><LogOut size={16} /><span className="hidden sm:inline">Sair</span></button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        {perfilAberto && (
          <section className="rounded-2xl border border-emerald-500/25 bg-zinc-900/80 p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-2"><UserCog className="text-emerald-400" size={20} /><h2 className="font-bold">Meu perfil</h2></div>
            <form onSubmit={atualizarPerfil} className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nome<input value={nomePerfil} onChange={(event) => setNomePerfil(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-emerald-500" /></label>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">WhatsApp<input value={telefonePerfil} onChange={(event) => setTelefonePerfil(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white outline-none focus:border-emerald-500" /></label>
              <div className="flex items-end gap-2"><button className="flex-1 rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white hover:bg-emerald-500">Salvar perfil</button><button type="button" onClick={() => { void solicitarNovaSenha(); }} className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-amber-300 hover:border-amber-500/50" title="Enviar recuperação de senha"><KeyRound size={18} /></button></div>
            </form>
            <p className="mt-3 text-xs text-zinc-500">E-mail da conta: {email}</p>
          </section>
        )}

        {usuario?.tipo === 'cliente' && (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black"><CalendarDays className="text-emerald-400" size={21} /> Novo agendamento</h2>{step > 1 && <button onClick={() => { setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData(''); setSelectedHorario(''); }} className="text-xs font-bold text-zinc-400 hover:text-white">Reiniciar</button>}</div>
              {step === 1 && <><p className="mb-3 text-sm text-zinc-400">Escolha o profissional.</p><div className="grid gap-3 sm:grid-cols-2">{barbeiros.map((profissional) => <button key={profissional.id} onClick={() => { setSelectedBarbeiro(profissional); setSelectedServico(null); setStep(2); }} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-left hover:border-emerald-500/50"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 font-black text-emerald-300">{profissional.nome.charAt(0).toUpperCase()}</span><span><b className="block text-white">{profissional.nome}</b><small className="text-zinc-500">{formatWorkDays(profissional.dias_trabalho)}</small></span></button>)}{barbeiros.length === 0 && <p className="text-sm text-zinc-500">Nenhum profissional disponível ainda.</p>}</div></>}
              {step === 2 && <><p className="mb-3 text-sm text-zinc-400">Serviços de <b className="text-zinc-200">{selectedBarbeiro?.nome}</b></p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{servicos.filter((servico) => servico.barbeiro_id === selectedBarbeiro?.id).map((servico) => <button key={servico.id} onClick={() => { setSelectedServico(servico); setStep(3); }} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-left hover:bg-amber-500 hover:text-zinc-950"><b className="block">{servico.nome}</b><span className="mt-1 block text-xs">{formatCurrency(Number(servico.preco))} · {servico.duracao} min</span></button>)}</div></>}
              {step === 3 && <><div className="mb-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5">{selectedBarbeiro?.nome}</span><span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-amber-300">{selectedServico?.nome}</span></div><p className="mb-3 text-sm text-zinc-400">Escolha uma data disponível.</p><div className="flex gap-2 overflow-x-auto pb-3">{diasProximos.map((dia) => { const feriado = feriadosPorData.get(dia.iso); const indisponivel = !selectedBarbeiro?.dias_trabalho.includes(dia.businessDay) || Boolean(feriado); return <button key={dia.iso} disabled={indisponivel} title={feriado ?? undefined} onClick={() => { void calcularHorarios(dia.iso); }} className={`shrink-0 rounded-xl border px-3 py-2 text-center text-xs disabled:cursor-not-allowed disabled:opacity-35 ${selectedData === dia.iso ? 'border-emerald-400 bg-emerald-500 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-emerald-500/50'}`}><b className="block">{dia.day} {dia.month}</b><span>{dia.weekday}</span></button>; })}</div>{selectedData && <div className="mt-4">{horariosDisponiveis.length ? <><p className="mb-3 text-sm text-zinc-400">Escolha o horário.</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{horariosDisponiveis.map((horario) => <button key={horario} onClick={() => setSelectedHorario(horario)} className={`rounded-lg border py-2 text-sm font-bold ${selectedHorario === horario ? 'border-emerald-400 bg-emerald-500 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-300'}`}>{horario}</button>)}</div><button onClick={() => { void agendar(); }} disabled={!selectedHorario} className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Agendar horário</button></> : <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">Não há horários livres nesta data.</p>}</div>}</>}
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarCheck2 className="text-emerald-400" size={20} /> Próximos horários</h2><div className="space-y-3">{proximosCliente.length ? proximosCliente.map((item) => <AppointmentItem key={item.id} item={item} role="cliente" onConfirm={() => { void confirmarAgendamento(item.id); }} onCancel={() => { void cancelarAgendamento(item.id); }} />) : <p className="text-sm text-zinc-500">Você não tem próximos horários.</p>}</div></section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Clock className="text-zinc-400" size={20} /> Histórico</h2><div className="space-y-3">{historicoCliente.length ? historicoCliente.map((item) => <AppointmentItem key={item.id} item={item} role="cliente" />) : <p className="text-sm text-zinc-500">Seu histórico aparecerá aqui.</p>}</div></section>
          </div>
        )}

        {usuario?.tipo === 'barbeiro' && barbeiro && (
          <div className="space-y-5">
            <section className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl sm:flex-row sm:items-center"><div className="flex items-center gap-3"><span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-300"><UserPlus size={22} /></span><span><b className="block">Convidar profissional</b><small className="text-zinc-500">Link único, válido por 7 dias.</small></span></div><button onClick={() => { void criarConvite(); }} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500"><Copy size={15} /> Copiar convite</button></section>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Faturamento hoje" value={formatCurrency(faturamentoHoje)} icon={Wallet} /><StatCard label="Agenda de hoje" value={`${agendaHoje.length} horários`} icon={CalendarDays} color="blue" /><StatCard label="Previsão futura" value={formatCurrency(previsaoFutura)} icon={TrendingUp} color="amber" /><StatCard label="Faltas no mês" value={`${relatorioMes.faltas} clientes`} icon={CircleX} color="orange" /></section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarCheck2 className="text-emerald-400" size={20} /> Agenda de hoje</h2><div className="space-y-3">{agendaHoje.length ? agendaHoje.map((item) => <AppointmentItem key={item.id} item={item} role="barbeiro" onStatusChange={(status) => { void atualizarStatus(item.id, status); }} />) : <p className="text-sm text-zinc-500">Nenhum cliente agendado para hoje.</p>}</div></section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><BarChart3 className="text-amber-400" size={20} /> Relatório do mês</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Realizado" value={formatCurrency(relatorioMes.receitas)} icon={Wallet} /><StatCard label="Ticket médio" value={formatCurrency(relatorioMes.ticket)} icon={TrendingUp} color="amber" /><StatCard label="Serviço favorito" value={relatorioMes.favorito ? `${relatorioMes.favorito[0]} (${relatorioMes.favorito[1]})` : 'Sem dados'} icon={Award} color="blue" /><StatCard label="Cliente frequente" value={relatorioMes.frequente ? `${relatorioMes.frequente[0]} (${relatorioMes.frequente[1]})` : 'Sem dados'} icon={Users} color="orange" /></div></section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Clock className="text-emerald-400" size={20} /> Expediente</h2><form onSubmit={salvarExpediente} className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Início<input type="time" value={horarioInicio} onChange={(event) => setHorarioInicio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none focus:border-emerald-500" /></label><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Fim<input type="time" value={horarioFim} onChange={(event) => setHorarioFim(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none focus:border-emerald-500" /></label><button className="self-end rounded-xl bg-emerald-600 p-3 font-bold hover:bg-emerald-500">Salvar expediente</button></div><div className="flex flex-wrap gap-2">{diasOrdenados.map((dia) => <button key={dia} type="button" onClick={() => setDiasTrabalho((atual) => atual.includes(dia) ? atual.filter((item) => item !== dia) : [...atual, dia].sort((a, b) => a - b) as BusinessDay[])} className={`rounded-lg border px-3 py-2 text-xs font-bold ${diasTrabalho.includes(dia) ? 'border-emerald-400 bg-emerald-500 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-400'}`}>{weekdayLabels[dia]}</button>)}</div></form></section>
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Umbrella className="text-blue-400" size={20} /> Bloquear agenda</h2><form onSubmit={salvarBloqueio} className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-zinc-400">TIPO<select value={bloqueioTipo} onChange={(event) => setBloqueioTipo(event.target.value as typeof bloqueioTipo)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none"><option value="pausa">Pausa</option><option value="folga">Folga</option><option value="ferias">Férias</option></select></label><label className="text-xs font-bold text-zinc-400">MOTIVO<input value={bloqueioMotivo} onChange={(event) => setBloqueioMotivo(event.target.value)} placeholder="Ex.: Almoço" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-zinc-400">DATA INICIAL<input type="date" value={bloqueioInicio} onChange={(event) => setBloqueioInicio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label><label className="text-xs font-bold text-zinc-400">DATA FINAL<input type="date" value={bloqueioFim} onChange={(event) => setBloqueioFim(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label></div>{bloqueioTipo === 'pausa' && <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-zinc-400">INÍCIO<input type="time" value={bloqueioHoraInicio} onChange={(event) => setBloqueioHoraInicio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label><label className="text-xs font-bold text-zinc-400">FIM<input type="time" value={bloqueioHoraFim} onChange={(event) => setBloqueioHoraFim(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label></div>}<button className="w-full rounded-xl bg-blue-600 py-3 font-bold hover:bg-blue-500">Bloquear período</button></form><div className="mt-4 space-y-2">{bloqueios.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs"><span><b className="uppercase text-blue-300">{item.tipo}</b> · {formatDate(item.data_inicio)}{item.data_fim !== item.data_inicio && ` a ${formatDate(item.data_fim)}`} {item.hora_inicio && `· ${displayTime(item.hora_inicio)}-${displayTime(item.hora_fim ?? '')}`}<small className="ml-2 text-zinc-500">{item.motivo}</small></span><button onClick={() => { void removerBloqueio(item.id); }} className="text-red-300 hover:text-red-200"><Trash2 size={15} /></button></div>)}{!bloqueios.length && <p className="text-xs text-zinc-500">Nenhum bloqueio cadastrado.</p>}</div></div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarX2 className="text-orange-400" size={20} /> Feriados</h2><form onSubmit={salvarFeriado} className="space-y-3"><label className="block text-xs font-bold text-zinc-400">DATA<input type="date" value={feriadoData} onChange={(event) => setFeriadoData(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label><label className="block text-xs font-bold text-zinc-400">DESCRIÇÃO<input value={feriadoDescricao} onChange={(event) => setFeriadoDescricao(event.target.value)} placeholder="Ex.: Natal" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none" /></label><button className="w-full rounded-xl bg-orange-600 py-3 font-bold hover:bg-orange-500">Salvar feriado</button></form><div className="mt-4 space-y-2">{feriados.map((item) => <div key={item.data} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs"><span>{formatDate(item.data)} <b className="ml-2 text-orange-200">{item.descricao}</b></span><button onClick={() => { void removerFeriado(item.data); }} className="text-red-300 hover:text-red-200"><Trash2 size={15} /></button></div>)}{!feriados.length && <p className="text-xs text-zinc-500">Nenhum feriado cadastrado.</p>}</div></div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Scissors className="text-amber-400" size={20} /> Serviços</h2><form onSubmit={adicionarServico} className="grid gap-3 md:grid-cols-4"><input value={novoServicoNome} onChange={(event) => setNovoServicoNome(event.target.value)} placeholder="Nome do serviço" className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-amber-500 md:col-span-2" /><input type="number" min="0.01" step="0.01" value={novoServicoPreco} onChange={(event) => setNovoServicoPreco(event.target.value)} placeholder="Preço (ex: 45.00)" className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-amber-500" /><input type="number" min="5" step="5" value={novoServicoDuracao} onChange={(event) => setNovoServicoDuracao(event.target.value)} placeholder="Duração" className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-amber-500" /><button className="rounded-xl bg-amber-500 px-4 py-3 font-bold text-zinc-950 hover:bg-amber-400 md:col-span-4"><Plus className="mr-1 inline" size={16} /> Adicionar serviço</button></form><div className="mt-4 grid gap-3 sm:grid-cols-2">{servicos.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"><span><b className="block">{item.nome}</b><small className="text-zinc-500">{formatCurrency(Number(item.preco))} · {item.duracao} min</small></span><button onClick={() => { void excluirServico(item.id); }} className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"><Trash2 size={16} /></button></div>)}</div></section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Settings className="text-emerald-400" size={20} /> Configurações da barbearia</h2><form onSubmit={salvarNegocio} className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nome<input value={nomeNegocio} onChange={(event) => setNomeNegocio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500" /></label><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Telefone<input value={telefoneNegocio} onChange={(event) => setTelefoneNegocio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500" /></label><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Endereço<input value={enderecoNegocio} onChange={(event) => setEnderecoNegocio(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500" /></label><label className="text-xs font-bold uppercase tracking-wider text-zinc-400">URL da logo<input type="url" value={logoNegocio} onChange={(event) => setLogoNegocio(event.target.value)} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500" /></label><button className="rounded-xl bg-emerald-600 px-5 py-3 font-bold hover:bg-emerald-500 sm:col-span-2"><Building2 className="mr-1 inline" size={16} /> Salvar configurações</button></form>{negocio?.endereco && <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500"><MapPin size={14} /> {negocio.endereco}</p>}</section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><CalendarDays className="text-emerald-400" size={20} /> Próximos agendamentos</h2><div className="space-y-3">{agendaFutura.length ? agendaFutura.map((item) => <AppointmentItem key={item.id} item={item} role="barbeiro" onStatusChange={(status) => { void atualizarStatus(item.id, status); }} />) : <p className="text-sm text-zinc-500">Não há próximos agendamentos.</p>}</div></section>
          </div>
        )}
      </section>
    </main>
  );
}
