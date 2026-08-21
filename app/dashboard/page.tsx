'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import type { Appointment, Barber, Service, UserProfile } from '@/lib/database.types';
import { 
  Wallet, Scissors, TrendingUp, Clock, CalendarDays, 
  LogOut, Plus, Trash2, CheckCircle2, MessageCircle, 
  ChevronDown, UserPlus, Copy, AlertCircle, Check
} from 'lucide-react';

// ==========================================
// COMPONENTE 1: SKELETON DE CARREGAMENTO
// ==========================================
const DashboardSkeleton = () => (
  <main className="min-h-screen bg-zinc-950 p-6 flex flex-col gap-6 animate-pulse w-full items-center">
    <div className="h-16 bg-zinc-900 rounded-lg max-w-4xl w-full border border-zinc-800"></div>
    <div className="h-[200px] bg-zinc-900 rounded-2xl max-w-4xl w-full border border-zinc-800"></div>
    <div className="h-[400px] bg-zinc-900 rounded-xl max-w-4xl w-full border border-zinc-800"></div>
  </main>
);

// ==========================================
// COMPONENTE 2: DROPDOWN DE STATUS CUSTOMIZADO
// ==========================================
const StatusDropdown = ({ currentStatus, onChange }: { currentStatus: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statusConfig: Record<string, { color: string, label: string }> = {
    'agendado': { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'AGENDADO' },
    'confirmado': { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'CONFIRMADO' },
    'concluido': { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'CONCLUÍDO' },
    'cancelado': { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'CANCELADO' },
  };

  const current = statusConfig[currentStatus.toLowerCase()] || statusConfig['agendado'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wider border transition-all hover:brightness-125 shadow-sm ${current.color}`}
      >
        {current.label} <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setIsOpen(false); }}
              className="w-full text-left px-4 py-3 text-xs font-bold tracking-wider hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 flex items-center justify-between"
            >
              <span className={config.color.split(' ')[0]}>{config.label}</span>
              {currentStatus.toLowerCase() === key && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<UserProfile | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<number | null>(null);
  const [barbeiros, setBarbeiros] = useState<Barber[]>([]);
  const [servicos, setServicos] = useState<Service[]>([]);
  const [agendamentos, setAgendamentos] = useState<Appointment[]>([]);

  // Estados Cliente
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<Barber | null>(null);
  const [selectedServico, setSelectedServico] = useState<Service | null>(null);
  const [selectedData, setSelectedData] = useState<string>('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [selectedHorario, setSelectedHorario] = useState<string>('');
  const [diasProximos] = useState<{ iso: string; dia: number; mes: string; semana: string }[]>(() => {
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return Array.from({ length: 15 }, (_, index) => {
      const data = new Date();
      data.setHours(12, 0, 0, 0);
      data.setDate(data.getDate() + index);
      return { iso: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`, dia: data.getDate(), mes: meses[data.getMonth()], semana: diasSemana[data.getDay()] };
    });
  });
  const [step, setStep] = useState<number>(1);

  // Estados Barbeiro
  const [novoServicoNome, setNovoServicoNome] = useState('');
  const [novoServicoPrecoFormatado, setNovoServicoPrecoFormatado] = useState('');
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const carregarAgendamentosCliente = async () => {
    const { data, error } = await supabase.from('agendamentos').select('*').order('data').order('horario');
    if (error) throw error;
    setAgendamentos(data ?? []);
  };

  const carregarAgendamentosBarbeiro = async (id: number) => {
    const { data, error } = await supabase.from('agendamentos').select('*').eq('barbeiro_id', id).order('data').order('horario');
    if (error) throw error;
    setAgendamentos(data ?? []);
  };

  const carregarServicosBarbeiro = async (id: number) => {
    const { data, error } = await supabase.from('servicos').select('*').eq('barbeiro_id', id).order('nome');
    if (error) throw error;
    setServicos(data ?? []);
  };

  const carregarDados = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/');
      const { data: userData, error: userError } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
      if (userError || !userData) throw new Error('Não foi possível carregar o perfil. Confirme o e-mail e tente novamente.');
      setUsuario(userData);

      if (userData.tipo === 'cliente') {
        const [{ data: barbeirosData, error: barbeirosError }, { data: servicosData, error: servicosError }] = await Promise.all([
          supabase.from('barbeiros').select('*').order('nome'),
          supabase.from('servicos').select('*').order('nome'),
        ]);
        if (barbeirosError || servicosError) throw barbeirosError || servicosError;
        setBarbeiros(barbeirosData ?? []);
        setServicos(servicosData ?? []);
        await carregarAgendamentosCliente();
      } else {
        const { data: barbeiroData, error } = await supabase.from('barbeiros').select('*').eq('usuario_id', session.user.id).single();
        if (error || !barbeiroData) throw new Error('Não foi possível carregar o perfil profissional.');
        setBarbeiroId(barbeiroData.id);
        setHorarioInicio(barbeiroData.horario_inicio);
        setHorarioFim(barbeiroData.horario_fim);
        await Promise.all([carregarAgendamentosBarbeiro(barbeiroData.id), carregarServicosBarbeiro(barbeiroData.id)]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const calcularHorariosDisponiveis = async (dataSelecionada: string) => {
    if (!selectedBarbeiro || !selectedServico) return;
    
    const { data, error } = await supabase.rpc('listar_horarios_disponiveis', { p_barbeiro_id: selectedBarbeiro.id, p_servico_id: selectedServico.id, p_data: dataSelecionada });
    if (error) return toast.error(error.message);
    setHorariosDisponiveis((data ?? []).map(({ horario }) => horario.slice(0, 5)));
    setSelectedData(dataSelecionada); setSelectedHorario('');
  };

  // AGENDAR USANDO TOAST.PROMISE (BLINDADO CONTRA BUGS)
  const handleAgendar = async () => {
    if (!selectedBarbeiro || !selectedServico || !selectedData || !selectedHorario) {
      toast.error('Preencha todos os campos.');
      return;
    }

    const promessa = async () => {
      const { error } = await supabase.rpc('criar_agendamento', { p_barbeiro_id: selectedBarbeiro.id, p_servico_id: selectedServico.id, p_data: selectedData, p_horario: `${selectedHorario}:00` });
      if (error) throw new Error(error.message);
      setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData(''); setSelectedHorario('');
      await carregarAgendamentosCliente();
    };

    toast.promise(promessa(), {
      loading: 'Processando agendamento...',
      success: 'Agendamento realizado com sucesso! 🎉',
      error: (err) => `Erro: ${err.message}`
    });
  };

  const cancelarAgendamentoCliente = async (id: number) => {
    if (confirm('Cancelar este agendamento?')) {
      toast.promise(
        async () => {
          const { error } = await supabase.rpc('cancelar_meu_agendamento', { p_agendamento_id: id });
          if (error) throw error;
          await carregarAgendamentosCliente();
        },
        { loading: 'Cancelando...', success: 'Agendamento cancelado.', error: 'Erro ao cancelar.' }
      );
    }
  };

  const formatarZap = (numero: string) => `https://wa.me/55${numero.replace(/\D/g, '')}`;

  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '');
    if (!valor) return setNovoServicoPrecoFormatado('');
    setNovoServicoPrecoFormatado((Number(valor) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const handleSalvarExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeiroId) return;
    toast.promise(
      async () => {
        if (horarioInicio >= horarioFim) throw new Error('O horário de início deve ser anterior ao fim.');
        const { error } = await supabase.from('barbeiros').update({ horario_inicio: horarioInicio, horario_fim: horarioFim }).eq('id', barbeiroId);
        if (error) throw error;
      },
      { loading: 'Salvando horários...', success: 'Expediente atualizado!', error: 'Erro ao salvar expediente.' }
    );
  };

  const atualizarStatus = async (agendamentoId: number, novoStatus: string) => {
    const { error } = await supabase.rpc('atualizar_status_agendamento', { p_agendamento_id: agendamentoId, p_status: novoStatus as 'agendado' | 'confirmado' | 'concluido' | 'cancelado' });
    if (error) return toast.error(error.message);
    toast.success('Status atualizado!');
    if (barbeiroId) await carregarAgendamentosBarbeiro(barbeiroId);
  };

  const handleAdicionarServico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeiroId || !novoServicoNome || !novoServicoPrecoFormatado || !novoServicoDuracao) {
      toast.error('Preencha tudo.');
      return;
    }
    const preco = parseFloat(novoServicoPrecoFormatado.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());

    toast.promise(
      async () => {
        const { error } = await supabase.from('servicos').insert([{ nome: novoServicoNome, preco, duracao: parseInt(novoServicoDuracao), barbeiro_id: barbeiroId }]);
        if (error) throw error;
        setNovoServicoNome(''); setNovoServicoPrecoFormatado(''); setNovoServicoDuracao('');
        await carregarServicosBarbeiro(barbeiroId);
      },
      { loading: 'Adicionando serviço...', success: 'Serviço adicionado!', error: 'Erro ao adicionar serviço.' }
    );
  };

  const handleExcluirServico = async (servicoId: number) => {
    if (!confirm('Excluir este serviço?')) return;
    toast.promise(
      async () => {
        const { error } = await supabase.from('servicos').delete().eq('id', servicoId);
        if (error) throw error;
        if (barbeiroId) await carregarServicosBarbeiro(barbeiroId);
      },
      { loading: 'Excluindo...', success: 'Serviço excluído.', error: 'Erro ao excluir.' }
    );
  };

  const hoje = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  useEffect(() => {
    const timeout = window.setTimeout(() => { void carregarDados(); }, 0);
    const subscription = supabase.channel('agenda-atualizada').on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => { void carregarDados(); }).subscribe();
    return () => { window.clearTimeout(timeout); void supabase.removeChannel(subscription); };
    // The initial load and subscription are deliberately registered once per mounted dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agendamentosHoje = agendamentos.filter((a) => a.data === hoje);
  const faturamentoHoje = agendamentosHoje.filter((a) => a.status === 'concluido').reduce((acc, curr) => acc + Number(curr.servico_preco || 0), 0);
  const cortesHoje = agendamentosHoje.filter((a) => a.status === 'concluido').length;
  const previsaoSemana = agendamentos.filter((a) => a.data >= hoje && a.status !== 'cancelado').reduce((acc, curr) => acc + Number(curr.servico_preco || 0), 0);

  if (loading) return <DashboardSkeleton />;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 font-sans relative pb-20 selection:bg-emerald-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#27272a', color: '#fff', border: '1px solid #3f3f46' } }} />
      
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-zinc-800/80 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Agenda Brasil</h1>
          <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
            Olá, {usuario?.nome} 
            <span className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-[10px] font-bold text-zinc-300 uppercase tracking-widest border border-zinc-700">{usuario?.tipo}</span>
          </p>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <section className="mx-auto max-w-4xl space-y-6">
        
        {/* ==========================================
            ÁREA DO CLIENTE
        ========================================== */}
        {usuario?.tipo === 'cliente' && (
           <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="text-emerald-500" size={22} /> Novo Agendamento</h2>
                  {step > 1 && <button onClick={() => {setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData('');}} className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1">↺ Reiniciar</button>}
                </div>

                {step === 1 && (
                  <div className="animate-in fade-in duration-300">
                    <p className="mb-4 text-sm font-medium text-zinc-400">Selecione o profissional:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {barbeiros.map((b) => (
                        <button key={b.id} onClick={() => { setSelectedBarbeiro(b); setStep(2); }} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-800/30 hover:border-emerald-500/50 hover:bg-zinc-800 transition-all text-left group">
                          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl font-bold text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">{b.nome?.charAt(0).toUpperCase()}</div>
                          <div><p className="font-semibold text-white">{b.nome}</p><p className="text-xs text-zinc-400">Atendimento Profissional</p></div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {step === 2 && (
                  <div className="animate-in fade-in duration-300">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 border border-zinc-700">Profissional: <b className="text-white">{selectedBarbeiro?.nome}</b></span>
                    </div>
                    <p className="mb-4 text-sm font-medium text-zinc-400">Selecione um de nossos serviços 👇</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {servicos.filter(s => s.barbeiro_id === selectedBarbeiro.id).map((s) => (
                        <button key={s.id} onClick={() => { setSelectedServico(s); setStep(3); }} className="flex flex-col items-center justify-center p-4 rounded-xl border border-amber-600/30 bg-amber-500/10 hover:bg-amber-500 hover:text-zinc-950 transition-all text-center group text-amber-500">
                          <span className="font-semibold text-sm group-hover:text-zinc-950">{s.nome}</span>
                          <span className="font-bold mt-1 group-hover:text-zinc-950">R$ {Number(s.preco).toFixed(2)}</span>
                          <span className="text-[10px] opacity-80 mt-1">({s.duracao} min)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="animate-in fade-in duration-300">
                    <div className="mb-4 flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 border border-zinc-700">Profissional: <b className="text-white">{selectedBarbeiro?.nome}</b></span>
                      <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400 border border-amber-500/30">Serviço: <b className="text-white">{selectedServico?.nome}</b></span>
                    </div>

                    <p className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2"><CalendarDays size={16} className="text-amber-500"/> Qual dia você deseja agendar?</p>
                    
                    <div className="flex gap-2 overflow-x-auto pb-4 snap-x hide-scrollbar">
                      {diasProximos.map((d) => (
                        <button key={d.iso} onClick={() => calcularHorariosDisponiveis(d.iso)} className={`snap-start shrink-0 flex flex-col items-center justify-center h-20 w-16 rounded-xl border transition-all ${selectedData === d.iso ? 'bg-amber-500 border-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                          <span className="text-[10px] font-bold tracking-wider">{d.mes}</span>
                          <span className="text-xl font-black my-1">{d.dia}</span>
                          <span className="text-[10px] font-medium">{d.semana}</span>
                        </button>
                      ))}
                    </div>

                    {selectedData && (
                      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {horariosDisponiveis.length > 0 ? (
                          <>
                            <p className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2"><Clock size={16} className="text-emerald-500"/> Selecione o horário:</p>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-6">
                              {horariosDisponiveis.map((hora: string) => (
                                <button key={hora} onClick={() => setSelectedHorario(hora)} className={`py-2 rounded-lg text-sm font-bold border transition-all ${selectedHorario === hora ? 'bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}>{hora}</button>
                              ))}
                            </div>
                            <button onClick={handleAgendar} disabled={!selectedHorario} className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-950">Confirmar Agendamento</button>
                          </>
                        ) : (
                          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-center"><p className="text-sm font-medium text-red-400 flex items-center justify-center gap-2"><AlertCircle size={16}/> Sem horários disponíveis para esta data.</p></div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Meus Agendamentos (Cliente) */}
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl p-6 shadow-xl">
                <h2 className="mb-4 text-lg font-bold flex items-center gap-2"><CalendarDays size={20} className="text-emerald-500"/> Meus Agendamentos</h2>
                {agendamentos.length === 0 ? <p className="text-sm text-zinc-500">Nenhum agendamento encontrado.</p> : (
                  <div className="space-y-3">
                    {agendamentos.map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 gap-4">
                        <div>
                          <p className="font-bold text-white text-base">{item.servico_nome}</p>
                          <p className="text-sm text-zinc-400">Profissional: <span className="text-zinc-200">{item.barbeiro_nome}</span></p>
                          <div className="mt-2.5 flex items-center gap-2 text-xs font-medium">
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">📅 {item.data.split('-').reverse().join('/')}</span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">🕒 {item.horario?.slice(0, 5)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between gap-2">
                          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase border ${
                            item.status === 'concluido' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' :
                            item.status === 'cancelado' ? 'bg-red-950/50 text-red-400 border-red-900/50' :
                            'bg-blue-950/50 text-blue-400 border-blue-900/50'
                          }`}>{item.status}</span>
                          {(item.status === 'agendado' || item.status === 'confirmado') && (
                            <button onClick={() => cancelarAgendamentoCliente(item.id)} className="text-xs text-red-400 hover:text-red-300 underline mt-1">Cancelar</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           </div>
        )}

        {/* ==========================================
            ÁREA DO BARBEIRO
        ========================================== */}
        {usuario?.tipo === 'barbeiro' && (
          <>
            {/* BOTÃO DE CONVITE DE BARBEIRO */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm p-6 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><UserPlus size={24} /></div>
                <div>
                  <p className="font-bold text-white text-base">Convidar Novo Barbeiro</p>
                  <p className="text-xs text-zinc-400">Gere e copie um link de convite exclusivo para sua equipe.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const link = `${window.location.origin}/?tipo=barbeiro`;
                  navigator.clipboard.writeText(link);
                  toast.success('Link de convite copiado para a área de transferência!');
                }}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-950"
              >
                <Copy size={16} /> Copiar Link de Convite
              </button>
            </div>

            {/* Cards Financeiros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                 <div className="absolute top-4 right-4 text-emerald-400/20 group-hover:text-emerald-400/30 transition-colors"><Wallet size={48} /></div>
                 <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-2">Faturamento Hoje</p>
                 <p className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]">R$ {faturamentoHoje.toFixed(2)}</p>
               </div>
               <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-zinc-700 transition-all">
                 <div className="absolute top-4 right-4 text-zinc-400/20 group-hover:text-zinc-400/30 transition-colors"><Scissors size={48} /></div>
                 <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-2">Cortes Hoje</p>
                 <p className="text-3xl font-black text-white">{cortesHoje} <span className="text-sm font-medium text-zinc-500">clientes</span></p>
               </div>
               <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
                 <div className="absolute top-4 right-4 text-amber-400/20 group-hover:text-amber-400/30 transition-colors"><TrendingUp size={48} /></div>
                 <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-2">Previsão Futura</p>
                 <p className="text-3xl font-black text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.2)]">R$ {previsaoSemana.toFixed(2)}</p>
               </div>
            </div>

            {/* Expediente com Almoço */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm p-6 shadow-xl relative">
              <h2 className="mb-6 text-lg font-bold flex items-center gap-2 text-emerald-400"><Clock size={20} /> Meu Expediente</h2>
              <form onSubmit={handleSalvarExpediente} className="grid grid-cols-2 gap-4 md:grid-cols-5 items-end">
                {[{label: 'Início', val: horarioInicio, set: setHorarioInicio, color: 'focus:border-emerald-500'}, 
                  {label: 'Fim', val: horarioFim, set: setHorarioFim, color: 'focus:border-emerald-500'}].map((campo, i) => (
                  <div key={i}>
                    <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{campo.label}</label>
                    <input type="time" value={campo.val} onChange={e => campo.set(e.target.value)} 
                           className={`time-input w-full rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-white outline-none transition-colors ${campo.color} hover:border-zinc-700`} />
                  </div>
                ))}
                <div className="col-span-2 md:col-span-1">
                  <button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3.5 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950">
                    <CheckCircle2 size={18} /> Salvar
                  </button>
                </div>
              </form>
            </div>

            {/* Agenda */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm p-6 shadow-xl">
              <h2 className="mb-6 text-lg font-bold flex items-center gap-2 text-emerald-400"><CalendarDays size={20} /> Minha Agenda</h2>
              {agendamentos.length === 0 ? <p className="text-sm text-zinc-500">Nenhum cliente agendado.</p> : (
                <div className="space-y-3">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 gap-4 hover:border-zinc-700/80 transition-all">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <p className="font-black text-white text-2xl tracking-tight">{item.horario?.slice(0, 5)}</p>
                           {item.cliente_telefone && (
                             <a href={`${formatarZap(item.cliente_telefone)}?text=Olá ${item.cliente_nome}, confirmando seu agendamento para hoje às ${item.horario?.slice(0, 5)}!`} target="_blank" rel="noopener noreferrer"
                                className="bg-[#25D366]/10 text-[#25D366] text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/20 shadow-sm">
                               <MessageCircle size={14} /> WhatsApp
                             </a>
                           )}
                        </div>
                        <p className="text-sm text-zinc-200 font-medium">{item.cliente_nome} <span className="text-xs text-zinc-500 ml-2 font-mono">{item.cliente_telefone}</span></p>
                        <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5"><Scissors size={12} className="text-amber-500"/> {item.servico_nome} • <strong className="text-emerald-400">R$ {Number(item.servico_preco).toFixed(2)}</strong></p>
                      </div>
                      
                      <div className="flex flex-col sm:items-end justify-between gap-3">
                        <StatusDropdown currentStatus={item.status} onChange={(novoStatus) => atualizarStatus(item.id, novoStatus)} />
                        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800/80">
                          {item.data.split('-').reverse().join('/')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cadastro de Serviços */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm p-6 shadow-xl">
              <h2 className="mb-6 text-lg font-bold flex items-center gap-2 text-amber-400"><Scissors size={20} /> Cadastrar Serviço</h2>
              <form onSubmit={handleAdicionarServico} className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/60">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Nome do Serviço</label>
                  <input type="text" value={novoServicoNome} onChange={e => setNovoServicoNome(e.target.value)} placeholder="Ex: Corte Degradê" className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-white outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Preço</label>
                  <input type="text" value={novoServicoPrecoFormatado} onChange={handlePrecoChange} placeholder="R$ 0,00" className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-white outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Duração (Min)</label>
                  <input type="number" min="1" value={novoServicoDuracao} onChange={e => setNovoServicoDuracao(e.target.value)} placeholder="30" className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-white outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600" />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold px-6 py-3 transition-colors flex items-center gap-2 shadow-lg shadow-amber-950">
                    <Plus size={18} /> Adicionar Serviço
                  </button>
                </div>
              </form>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicos.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 hover:border-zinc-700 transition-colors">
                    <div>
                      <p className="font-bold text-white text-sm">{s.nome}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1"><Clock size={12} className="text-zinc-500"/> {s.duracao} min</p>
                      <p className="font-black text-amber-500 mt-2">R$ {Number(s.preco).toFixed(2)}</p>
                    </div>
                    <button onClick={() => handleExcluirServico(s.id)} className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-1.5">
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; } 
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .time-input::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(0.8);
          cursor: pointer;
          opacity: 0.6;
          transition: 0.2s;
        }
        .time-input::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
    </main>
  );
}
