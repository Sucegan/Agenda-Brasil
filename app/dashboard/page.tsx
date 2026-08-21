'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

// ==========================================
// COMPONENTE: SKELETON DE CARREGAMENTO
// ==========================================
const DashboardSkeleton = () => (
  <main className="min-h-screen bg-zinc-950 p-6 flex flex-col gap-6 animate-pulse w-full items-center">
    <div className="h-16 bg-zinc-900 rounded-lg max-w-4xl w-full border border-zinc-800"></div>
    <div className="h-[400px] bg-zinc-900 rounded-2xl max-w-4xl w-full border border-zinc-800"></div>
    <div className="h-[200px] bg-zinc-900 rounded-xl max-w-4xl w-full border border-zinc-800"></div>
  </main>
);

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<number | null>(null);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);

  // Estados do Fluxo de Agendamento (Cliente)
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<any>(null);
  const [selectedServico, setSelectedServico] = useState<any>(null);
  const [selectedData, setSelectedData] = useState<string>('');
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [selectedHorario, setSelectedHorario] = useState<string>('');
  const [diasProximos, setDiasProximos] = useState<any[]>([]);
  const [step, setStep] = useState<number>(1);

  // Estados do Barbeiro
  const [novoServicoNome, setNovoServicoNome] = useState('');
  const [novoServicoPrecoFormatado, setNovoServicoPrecoFormatado] = useState('');
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [inicioAlmoco, setInicioAlmoco] = useState('12:00');
  const [fimAlmoco, setFimAlmoco] = useState('13:00');
  const [diasTrabalho, setDiasTrabalho] = useState('Segunda a Sábado');

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    carregarDados();
    gerarDiasProximos();
  }, []);

  const gerarDiasProximos = () => {
    const dias = [];
    const diasSemana = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    for (let i = 0; i < 15; i++) {
      const data = new Date();
      data.setDate(data.getDate() + i);
      dias.push({
        iso: data.toISOString().split('T')[0],
        dia: data.getDate(),
        mes: meses[data.getMonth()],
        semana: diasSemana[data.getDay()]
      });
    }
    setDiasProximos(dias);
  };

  const carregarDados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/');

    const { data: userData } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
    setUsuario(userData);

    if (userData?.tipo === 'cliente') {
      let { data: clienteData } = await supabase.from('clientes').select('id').eq('usuario_id', session.user.id).single();
      if (!clienteData) {
        const { data: novoCliente } = await supabase.from('clientes').insert([{ nome: userData.nome, telefone: userData.telefone || '(00) 00000-0000', email: session.user.email, usuario_id: session.user.id }]).select('id').single();
        if (novoCliente) clienteData = novoCliente;
      }
      if (clienteData) {
        setClienteId(clienteData.id);
        carregarAgendamentosCliente(clienteData.id);
      }
      const { data: barbeirosData } = await supabase.from('barbeiros').select('*');
      const { data: servicosData } = await supabase.from('servicos').select('*').order('nome');
      if (barbeirosData) setBarbeiros(barbeirosData);
      if (servicosData) setServicos(servicosData);
    } 
    else if (userData?.tipo === 'barbeiro') {
      let { data: barbeiroData } = await supabase.from('barbeiros').select('*').eq('usuario_id', session.user.id).single();
      if (!barbeiroData) {
        const { data: novoBarbeiro } = await supabase.from('barbeiros').insert([{ nome: userData.nome, telefone: userData.telefone || '', usuario_id: session.user.id, horario_inicio: '08:00', horario_fim: '18:00', inicio_almoco: '12:00', fim_almoco: '13:00', dias_trabalho: 'Segunda a Sábado' }]).select('*').single();
        if (novoBarbeiro) barbeiroData = novoBarbeiro;
      }
      if (barbeiroData) {
        setBarbeiroId(barbeiroData.id);
        setHorarioInicio(barbeiroData.horario_inicio || '08:00');
        setHorarioFim(barbeiroData.horario_fim || '18:00');
        setInicioAlmoco(barbeiroData.inicio_almoco || '12:00');
        setFimAlmoco(barbeiroData.fim_almoco || '13:00');
        setDiasTrabalho(barbeiroData.dias_trabalho || 'Segunda a Sábado');
        carregarAgendamentosBarbeiro(barbeiroData.id);
        const { data: servicosData } = await supabase.from('servicos').select('*').eq('barbeiro_id', barbeiroData.id).order('nome');
        if (servicosData) setServicos(servicosData);
      }
    }
    setLoading(false);
  };

  const carregarAgendamentosCliente = async (cId: number) => {
    const { data } = await supabase.from('agendamentos').select(`id, data, horario, status, barbeiros(nome), servicos(nome, preco)`).eq('cliente_id', cId).order('data', { ascending: true }).order('horario', { ascending: true });
    if (data) setAgendamentos(data);
  };

  const carregarAgendamentosBarbeiro = async (bId: number) => {
    // Agora puxamos o PREÇO também para calcular o Faturamento
    const { data } = await supabase.from('agendamentos').select(`id, data, horario, status, clientes(nome, telefone), servicos(nome, duracao, preco)`).eq('barbeiro_id', bId).order('data', { ascending: true }).order('horario', { ascending: true });
    if (data) setAgendamentos(data);
  };

  // ==========================================
  // MOTOR INTELIGENTE (AGORA COM HORÁRIO DE ALMOÇO)
  // ==========================================
  const calcularHorariosDisponiveis = async (dataSelecionada: string) => {
    if (!selectedBarbeiro || !selectedServico) return;
    
    const { data: agendaDoDia } = await supabase
      .from('agendamentos')
      .select('horario, servicos(duracao), status')
      .eq('barbeiro_id', selectedBarbeiro.id)
      .eq('data', dataSelecionada)
      .neq('status', 'cancelado');

    const converterParaMinutos = (horaStr: string) => {
      const [h, m] = horaStr.split(':').map(Number);
      return h * 60 + m;
    };

    const converterParaHora = (minutosTotal: number) => {
      const h = Math.floor(minutosTotal / 60);
      const m = minutosTotal % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const inicioExp = converterParaMinutos(selectedBarbeiro.horario_inicio || '08:00');
    const fimExp = converterParaMinutos(selectedBarbeiro.horario_fim || '18:00');
    const iniAlmoco = converterParaMinutos(selectedBarbeiro.inicio_almoco || '12:00');
    const fAlmoco = converterParaMinutos(selectedBarbeiro.fim_almoco || '13:00');
    const duracaoServico = selectedServico.duracao;
    
    const bloqueios = (agendaDoDia || []).map((ag: any) => {
      const inicio = converterParaMinutos(ag.horario);
      const duracao = Array.isArray(ag.servicos) ? ag.servicos[0]?.duracao : ag.servicos?.duracao;
      const fim = inicio + (duracao || 30);
      return { inicio, fim };
    });

    let horariosValidos = [];
    
    const agora = new Date();
    const dataHojeISO = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const horaAtualMinutos = agora.getHours() * 60 + agora.getMinutes();

    for (let tempoAtual = inicioExp; (tempoAtual + duracaoServico) <= fimExp; tempoAtual += 30) {
      
      // BLOQUEIO DO PASSADO
      if (dataSelecionada === dataHojeISO && tempoAtual <= horaAtualMinutos) continue;

      const fimDoSlot = tempoAtual + duracaoServico;
      
      // BLOQUEIO DE ALMOÇO
      if (tempoAtual < fAlmoco && fimDoSlot > iniAlmoco) continue;

      // BLOQUEIO DE CONFLITO COM OUTROS AGENDAMENTOS
      const temConflito = bloqueios.some((b: any) => (tempoAtual < b.fim && fimDoSlot > b.inicio));

      if (!temConflito) {
        horariosValidos.push(converterParaHora(tempoAtual));
      }
    }

    setHorariosDisponiveis(horariosValidos);
    setSelectedData(dataSelecionada);
    setSelectedHorario('');
  };

  const handleAgendar = async () => {
    if (!clienteId || !selectedBarbeiro || !selectedServico || !selectedData || !selectedHorario) return toast.error('Preencha todos os campos do agendamento.');
    const toastId = toast.loading('Processando agendamento...');
    const { error } = await supabase.from('agendamentos').insert([{ cliente_id: clienteId, barbeiro_id: selectedBarbeiro.id, servico_id: selectedServico.id, data: selectedData, horario: `${selectedHorario}:00`, status: 'agendado' }]);
    if (error) {
      toast.error(`Erro ao agendar: ${error.message}`, { id: toastId });
    } else {
      toast.success('Agendamento realizado com sucesso! 🎉', { id: toastId });
      setTimeout(() => {
        setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData(''); setSelectedHorario('');
        carregarAgendamentosCliente(clienteId);
      }, 1000);
    }
  };

  const cancelarAgendamentoCliente = async (id: number, data: string, horario: string) => {
    const [ano, mes, dia] = data.split('-');
    const [hora, min] = horario.split(':');
    const dataAgendamento = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(min));
    const agora = new Date();
    const diffHoras = (dataAgendamento.getTime() - agora.getTime()) / (1000 * 60 * 60);

    if (diffHoras > 0 && diffHoras < 2) return toast.error('Não é possível cancelar com menos de 2h de antecedência. Ligue para a barbearia.');
    if (confirm('Deseja cancelar este agendamento?')) {
      const toastId = toast.loading('Cancelando...');
      const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id);
      if (error) toast.error('Erro ao cancelar.', { id: toastId });
      else {
        toast.success('Agendamento cancelado.', { id: toastId });
        if (clienteId) carregarAgendamentosCliente(clienteId);
      }
    }
  };

  const formatarZap = (numero: string) => `https://wa.me/55${numero.replace(/\D/g, '')}`;

  // ==========================================
  // LÓGICAS DO BARBEIRO
  // ==========================================
  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '');
    if (!valor) return setNovoServicoPrecoFormatado('');
    setNovoServicoPrecoFormatado((Number(valor) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const handleSalvarExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeiroId) return;
    const toastId = toast.loading('Salvando horários...');
    const { error } = await supabase.from('barbeiros').update({ horario_inicio: horarioInicio, horario_fim: horarioFim, inicio_almoco: inicioAlmoco, fim_almoco: fimAlmoco, dias_trabalho: diasTrabalho }).eq('id', barbeiroId);
    if (error) toast.error('Erro ao salvar expediente.', { id: toastId });
    else toast.success('Expediente atualizado!', { id: toastId });
  };

  const atualizarStatus = async (agendamentoId: number, novoStatus: string) => {
    await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', agendamentoId);
    toast.success(`Status alterado para ${novoStatus}`);
    if (barbeiroId) carregarAgendamentosBarbeiro(barbeiroId);
  };

  const handleAdicionarServico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeiroId || !novoServicoNome || !novoServicoPrecoFormatado || !novoServicoDuracao) return toast.error('Preencha todos os campos.');
    const precoLimpo = parseFloat(novoServicoPrecoFormatado.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    const toastId = toast.loading('Salvando serviço...');
    const { error } = await supabase.from('servicos').insert([{ nome: novoServicoNome, preco: precoLimpo, duracao: parseInt(novoServicoDuracao), barbeiro_id: barbeiroId }]);
    
    if (error) toast.error('Erro ao salvar.', { id: toastId });
    else {
      toast.success('Serviço adicionado!', { id: toastId });
      setNovoServicoNome(''); setNovoServicoPrecoFormatado(''); setNovoServicoDuracao('');
      const { data } = await supabase.from('servicos').select('*').eq('barbeiro_id', barbeiroId).order('nome');
      if (data) setServicos(data);
    }
  };

  const handleExcluirServico = async (servicoId: number) => {
    if (!confirm('Deseja excluir este serviço?')) return;
    await supabase.from('servicos').delete().eq('id', servicoId);
    toast.success('Serviço excluído.');
    const { data } = await supabase.from('servicos').select('*').eq('barbeiro_id', barbeiroId).order('nome');
    if (data) setServicos(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // ==========================================
  // MÉTRICAS FINANCEIRAS DO BARBEIRO
  // ==========================================
  const agora = new Date();
  const hoje = new Date(agora.getTime() - (agora.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  
  const agendamentosHoje = agendamentos.filter(a => a.data === hoje);
  const faturamentoHoje = agendamentosHoje.filter(a => a.status === 'concluído').reduce((acc, curr) => {
    const preco = Array.isArray(curr.servicos) ? curr.servicos[0]?.preco : curr.servicos?.preco;
    return acc + (Number(preco) || 0);
  }, 0);
  
  const cortesHoje = agendamentosHoje.filter(a => a.status === 'concluído').length;
  
  const agendamentosFuturos = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  const previsaoSemana = agendamentosFuturos.reduce((acc, curr) => {
    const preco = Array.isArray(curr.servicos) ? curr.servicos[0]?.preco : curr.servicos?.preco;
    return acc + (Number(preco) || 0);
  }, 0);


  // Renderização do Loading Skeleton
  if (loading) return <DashboardSkeleton />;

  const servicosDoBarbeiroSelecionado = servicos.filter((s) => s.barbeiro_id === selectedBarbeiro?.id);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white font-sans relative pb-20">
      <Toaster position="top-center" reverseOrder={false} />
      
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda Brasil</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Olá, {usuario?.nome} <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 ml-2 capitalize">{usuario?.tipo}</span>
          </p>
        </div>
        <button onClick={handleLogout} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">Sair</button>
      </header>

      <section className="mx-auto mt-8 max-w-4xl space-y-6">
        
        {/* ==========================================
            ÁREA DO CLIENTE
        ========================================== */}
        {usuario?.tipo === 'cliente' && (
          <>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-emerald-400">Novo Agendamento</h2>
                 {step > 1 && (
                    <button onClick={() => {setStep(1); setSelectedBarbeiro(null); setSelectedServico(null); setSelectedData('');}} className="text-xs flex items-center text-zinc-400 hover:text-white transition">↺ Reiniciar</button>
                 )}
              </div>

              {step === 1 && (
                <div className="animate-in fade-in duration-300">
                  <p className="mb-4 text-sm font-medium text-zinc-300">Selecione o profissional:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {barbeiros.map(barbeiro => (
                      <button key={barbeiro.id} onClick={() => handleSelectBarbeiro(barbeiro)} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-700 bg-zinc-800 hover:border-emerald-500 hover:bg-zinc-800/80 transition-all text-left group">
                        <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center text-xl font-bold text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-900 transition-colors">{barbeiro.nome.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-white">{barbeiro.nome}</p>
                          <p className="text-xs text-zinc-400">{barbeiro.dias_trabalho}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-6 flex gap-2 overflow-x-auto pb-2"><span className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 border border-zinc-700">Profissional: <b className="text-white">{selectedBarbeiro.nome}</b></span></div>
                  <p className="mb-4 text-sm font-medium text-zinc-300">Selecione um de nossos serviços 👇</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {servicosDoBarbeiroSelecionado.map((servico) => (
                      <button key={servico.id} onClick={() => handleSelectServico(servico)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-amber-600/30 bg-amber-500/10 hover:bg-amber-500 hover:text-zinc-950 transition-all text-center group text-amber-500">
                        <span className="font-semibold text-sm group-hover:text-zinc-950">{servico.nome}</span>
                        <span className="font-bold mt-1 group-hover:text-zinc-900">R$ {Number(servico.preco).toFixed(2)}</span>
                        <span className="text-[10px] opacity-70 mt-1">({servico.duracao} min)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in duration-300">
                  <div className="mb-6 flex gap-2 flex-wrap pb-2">
                    <button onClick={() => setStep(1)} className="shrink-0 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400 border border-zinc-700 hover:text-white">Profissional: <b className="text-white">{selectedBarbeiro.nome}</b></button>
                    <button onClick={() => setStep(2)} className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-500 border border-amber-500/30 hover:bg-amber-500/40">Serviço: <b className="text-white">{selectedServico.nome}</b></button>
                  </div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300 bg-zinc-800 p-3 rounded-lg border border-zinc-700 w-max">📅 Qual dia você deseja agendar?</p>
                  
                  <div className="flex gap-2 overflow-x-auto pb-4 snap-x hide-scrollbar">
                    {diasProximos.map((diaInfo) => (
                      <button key={diaInfo.iso} onClick={() => calcularHorariosDisponiveis(diaInfo.iso)} className={`snap-start shrink-0 flex flex-col items-center justify-center h-20 w-16 rounded-xl border transition-all ${selectedData === diaInfo.iso ? 'bg-amber-500 border-amber-400 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                        <span className="text-[10px] font-bold tracking-wider">{diaInfo.mes}</span>
                        <span className="text-xl font-black leading-none my-1">{diaInfo.dia}</span>
                        <span className="text-[10px] font-medium">{diaInfo.semana}</span>
                      </button>
                    ))}
                  </div>

                  {selectedData && (
                    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {horariosDisponiveis.length > 0 ? (
                        <>
                          <p className="mb-3 text-sm font-medium text-zinc-300">Selecione o horário:</p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-6">
                            {horariosDisponiveis.map(hora => (
                              <button key={hora} onClick={() => setSelectedHorario(hora)} className={`py-2 rounded-lg text-sm font-bold border transition-all ${selectedHorario === hora ? 'bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}>{hora}</button>
                            ))}
                          </div>
                          <button onClick={handleAgendar} disabled={!selectedHorario} className="w-full rounded-xl bg-emerald-600 py-4 font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50">Confirmar Agendamento</button>
                        </>
                      ) : (
                        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-center mt-2"><p className="text-sm font-medium text-red-400">🕒 Esse profissional não possui horários disponíveis.</p></div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-white">Meus Agendamentos</h2>
              {agendamentos.length === 0 ? <p className="text-sm text-zinc-500">Nenhum agendamento encontrado.</p> : (
                <div className="space-y-3">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 gap-4">
                      <div>
                        <p className="font-bold text-white">{item.servicos?.nome}</p>
                        <p className="text-sm text-zinc-400">Com: {item.barbeiros?.nome}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-500">
                          <span className="bg-amber-500/10 px-2 py-1 rounded">📅 {item.data.split('-').reverse().join('/')}</span>
                          <span className="bg-amber-500/10 px-2 py-1 rounded">🕒 {item.horario?.slice(0, 5)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase border ${item.status === 'concluído' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : item.status === 'cancelado' ? 'bg-red-950/50 text-red-400 border-red-900/50' : 'bg-blue-950/50 text-blue-400 border-blue-900/50'}`}>{item.status}</span>
                        {(item.status === 'agendado' || item.status === 'confirmado') && (
                          <button onClick={() => cancelarAgendamentoCliente(item.id, item.data, item.horario)} className="text-[11px] text-red-400 hover:text-red-300 underline mt-1">Cancelar Agendamento</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ==========================================
            ÁREA DO BARBEIRO
        ========================================== */}
        {usuario?.tipo === 'barbeiro' && (
          <>
            {/* Dashboard Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
               <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">💰</div>
                 <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">Faturamento Hoje</p>
                 <p className="text-3xl font-black text-emerald-400">R$ {faturamentoHoje.toFixed(2)}</p>
               </div>
               <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">✂️</div>
                 <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">Cortes Hoje</p>
                 <p className="text-3xl font-black text-white">{cortesHoje} <span className="text-sm font-normal text-zinc-500">clientes</span></p>
               </div>
               <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl">📈</div>
                 <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">Previsão (Futuros)</p>
                 <p className="text-3xl font-black text-amber-500">R$ {previsaoSemana.toFixed(2)}</p>
               </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-emerald-400">Meu Expediente (Com Almoço)</h2>
              <form onSubmit={handleSalvarExpediente} className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Início</label><input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Saída Almoço</label><input type="time" value={inicioAlmoco} onChange={e => setInicioAlmoco(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-amber-500 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Volta Almoço</label><input type="time" value={fimAlmoco} onChange={e => setFimAlmoco(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-amber-500 text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Fim</label><input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 text-sm" /></div>
                <div className="col-span-2 md:col-span-1 flex items-end"><button type="submit" className="w-full rounded-lg bg-zinc-800 p-2 text-sm font-semibold text-white hover:bg-zinc-700 h-[38px]">Salvar</button></div>
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-6 text-xl font-semibold text-white">Minha Agenda</h2>
              {agendamentos.length === 0 ? <p className="text-sm text-zinc-400">Nenhum cliente agendado.</p> : (
                <div className="space-y-3">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row justify-between rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                           <p className="font-bold text-white text-xl">{item.horario?.slice(0, 5)}</p>
                           {item.clientes?.telefone && (
                             <a href={`${formatarZap(item.clientes.telefone)}?text=Olá ${item.clientes.nome}, confirmando seu agendamento para hoje às ${item.horario?.slice(0, 5)}!`} target="_blank" rel="noopener noreferrer" className="bg-[#25D366]/20 text-[#25D366] text-[10px] font-bold px-2 py-1 rounded flex items-center hover:bg-[#25D366]/30 transition">💬 Chamar no Whats</a>
                           )}
                        </div>
                        <p className="text-sm text-zinc-300 mt-2">{item.clientes?.nome} <span className="text-xs text-emerald-500 ml-2">{item.clientes?.telefone}</span></p>
                        <p className="text-xs text-zinc-500 mt-1">{item.servicos?.nome} (R$ {Number(Array.isArray(item.servicos) ? item.servicos[0]?.preco : item.servicos?.preco).toFixed(2)})</p>
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <select value={item.status} onChange={(e) => atualizarStatus(item.id, e.target.value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider border cursor-pointer focus:outline-none transition-colors ${item.status === 'concluído' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : item.status === 'cancelado' ? 'bg-red-950/50 text-red-400 border-red-900/50' : 'bg-blue-950/50 text-blue-400 border-blue-900/50'}`}>
                          <option value="agendado">Agendado</option><option value="confirmado">Confirmado</option><option value="concluído">Concluído</option><option value="cancelado">Cancelado</option>
                        </select>
                        <p className="text-xs text-zinc-500 mt-2 font-medium">{item.data.split('-').reverse().join('/')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-emerald-400">Cadastrar Serviço</h2>
              <form onSubmit={handleAdicionarServico} className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6 bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                <div className="md:col-span-2"><label className="mb-1 block text-xs font-medium text-zinc-400">Nome</label><input type="text" value={novoServicoNome} onChange={e => setNovoServicoNome(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 outline-none text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Preço</label><input type="text" value={novoServicoPrecoFormatado} onChange={handlePrecoChange} placeholder="R$ 0,00" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 outline-none text-sm" /></div>
                <div><label className="mb-1 block text-xs font-medium text-zinc-400">Minutos</label><input type="number" min="1" value={novoServicoDuracao} onChange={e => setNovoServicoDuracao(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 outline-none text-sm" /></div>
                <div className="md:col-span-4 flex justify-end"><button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Adicionar Serviço</button></div>
              </form>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicos.map(servico => (
                  <div key={servico.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/20 p-3">
                    <div>
                      <p className="font-semibold text-white text-sm">{servico.nome}</p>
                      <p className="text-xs text-zinc-500">{servico.duracao} minutos</p>
                      <p className="font-bold text-amber-500 mt-1">R$ {Number(servico.preco).toFixed(2)}</p>
                    </div>
                    <button onClick={() => handleExcluirServico(servico.id)} className="rounded-lg bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/60 border border-red-900/30">Excluir</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx global>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </main>
  );
}