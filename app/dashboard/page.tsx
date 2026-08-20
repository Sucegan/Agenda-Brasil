'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<number | null>(null);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);

  // Formulário de Agendamento (Visão Cliente)
  const [selectedBarbeiro, setSelectedBarbeiro] = useState('');
  const [selectedServico, setSelectedServico] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horarioAgendamento, setHorarioAgendamento] = useState('');

  // Formulário de Serviços (Visão Barbeiro)
  const [novoServicoNome, setNovoServicoNome] = useState('');
  const [novoServicoPrecoFormatado, setNovoServicoPrecoFormatado] = useState('');
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('');

  // Configurações de Expediente do Barbeiro
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [diasTrabalho, setDiasTrabalho] = useState('Segunda a Sábado');

  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const router = useRouter();

  const dataHoje = new Date().toISOString().split('T')[0];

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setUsuario(userData);

    if (userData?.tipo === 'cliente') {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('id')
        .eq('usuario_id', session.user.id)
        .single();

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
      let { data: barbeiroData } = await supabase
        .from('barbeiros')
        .select('*')
        .eq('usuario_id', session.user.id)
        .single();

      if (!barbeiroData) {
        const { data: novoBarbeiro } = await supabase
          .from('barbeiros')
          .insert([
            {
              nome: userData.nome,
              telefone: userData.telefone || '',
              usuario_id: session.user.id,
              horario_inicio: '08:00',
              horario_fim: '18:00',
              dias_trabalho: 'Segunda a Sábado'
            }
          ])
          .select('*')
          .single();

        if (novoBarbeiro) {
          barbeiroData = novoBarbeiro;
        }
      }

      if (barbeiroData) {
        setBarbeiroId(barbeiroData.id);
        setHorarioInicio(barbeiroData.horario_inicio || '08:00');
        setHorarioFim(barbeiroData.horario_fim || '18:00');
        setDiasTrabalho(barbeiroData.dias_trabalho || 'Segunda a Sábado');

        carregarAgendamentosBarbeiro(barbeiroData.id);

        const { data: servicosData } = await supabase
          .from('servicos')
          .select('*')
          .eq('barbeiro_id', barbeiroData.id)
          .order('nome');
        if (servicosData) setServicos(servicosData);
      }
    }

    setLoading(false);
  };

  const carregarAgendamentosCliente = async (cId: number) => {
    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id, data, horario, status,
        barbeiros(nome), servicos(nome, preco)
      `)
      .eq('cliente_id', cId)
      .order('data', { ascending: true })
      .order('horario', { ascending: true });

    if (data) setAgendamentos(data);
  };

  const carregarAgendamentosBarbeiro = async (bId: number) => {
    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id, data, horario, status,
        clientes(nome, telefone), servicos(nome, duracao)
      `)
      .eq('barbeiro_id', bId)
      .order('data', { ascending: true })
      .order('horario', { ascending: true });

    if (data) setAgendamentos(data);
  };

  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, '');
    if (!valor) {
      setNovoServicoPrecoFormatado('');
      return;
    }
    const numero = Number(valor) / 100;
    const formatado = numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    setNovoServicoPrecoFormatado(formatado);
  };

  const handleSalvarExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeiroId) return;

    const { error } = await supabase
      .from('barbeiros')
      .update({
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_trabalho: diasTrabalho,
      })
      .eq('id', barbeiroId);

    if (error) {
      alert(`Erro ao salvar expediente: ${error.message}`);
    } else {
      alert('Horários e dias de atendimento atualizados com sucesso!');
    }
  };

  const handleAgendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem('');

    if (!clienteId || !selectedBarbeiro || !selectedServico || !dataAgendamento || !horarioAgendamento) {
      setMensagem('Preencha todos os campos do agendamento.');
      return;
    }

    const horarioFormatado = horarioAgendamento.length === 5 ? horarioAgendamento : `${horarioAgendamento}:00`;

    const { error } = await supabase.from('agendamentos').insert([
      {
        cliente_id: clienteId,
        barbeiro_id: parseInt(selectedBarbeiro),
        servico_id: parseInt(selectedServico),
        data: dataAgendamento,
        horario: horarioFormatado,
        status: 'agendado',
      },
    ]);

    if (error) {
      setMensagem(`Erro ao agendar: ${error.message}`);
    } else {
      setMensagem('Agendamento realizado com sucesso!');
      setSelectedBarbeiro('');
      setSelectedServico('');
      setDataAgendamento('');
      setHorarioAgendamento('');
      carregarAgendamentosCliente(clienteId);
    }
  };

  const atualizarStatus = async (agendamentoId: number, novoStatus: string) => {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: novoStatus })
      .eq('id', agendamentoId);

    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`);
    } else {
      if (barbeiroId) carregarAgendamentosBarbeiro(barbeiroId);
    }
  };

  const handleAdicionarServico = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!barbeiroId) {
      alert('Erro: ID do barbeiro não encontrado.');
      return;
    }
    if (!novoServicoNome || !novoServicoPrecoFormatado || !novoServicoDuracao) {
      alert('Preencha todos os campos para cadastrar o serviço.');
      return;
    }

    const precoLimpo = parseFloat(
      novoServicoPrecoFormatado
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim()
    );

    const { error } = await supabase.from('servicos').insert([
      {
        nome: novoServicoNome,
        preco: precoLimpo,
        duracao: parseInt(novoServicoDuracao),
        barbeiro_id: barbeiroId,
      }
    ]);

    if (error) {
      alert(`Erro ao adicionar serviço: ${error.message}`);
    } else {
      setNovoServicoNome('');
      setNovoServicoPrecoFormatado('');
      setNovoServicoDuracao('');
      
      const { data } = await supabase
        .from('servicos')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .order('nome');
      if (data) setServicos(data);
    }
  };

  const handleExcluirServico = async (servicoId: number) => {
    if (!confirm('Deseja realmente excluir este serviço?')) return;

    const { error } = await supabase
      .from('servicos')
      .delete()
      .eq('id', servicoId);

    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      const { data } = await supabase
        .from('servicos')
        .select('*')
        .eq('barbeiro_id', barbeiroId)
        .order('nome');
      if (data) setServicos(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-400">Carregando painel...</p>
      </main>
    );
  }

  const servicosDoBarbeiroSelecionado = servicos.filter(
    (s) => s.barbeiro_id === Number(selectedBarbeiro)
  );

  const barbeiroSelecionadoInfo = barbeiros.find((b) => b.id === Number(selectedBarbeiro));

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda Brasil</h1>
          <p className="text-sm text-zinc-400">
            Olá, {usuario?.nome} <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 ml-2 capitalize">{usuario?.tipo}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Sair
        </button>
      </header>

      <section className="mx-auto mt-8 max-w-4xl space-y-6">
        
        {usuario?.tipo === 'cliente' && (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-emerald-400">Novo Agendamento</h2>
              <form onSubmit={handleAgendar} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Barbeiro</label>
                  <select 
                    value={selectedBarbeiro} 
                    onChange={(e) => {
                      setSelectedBarbeiro(e.target.value);
                      setSelectedServico('');
                    }} 
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Selecione um barbeiro</option>
                    {barbeiros.map((b) => (<option key={b.id} value={b.id}>{b.nome}</option>))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Serviço</label>
                  <select 
                    value={selectedServico} 
                    onChange={(e) => setSelectedServico(e.target.value)}
                    disabled={!selectedBarbeiro}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">
                      {!selectedBarbeiro ? 'Escolha um barbeiro primeiro' : 'Selecione um serviço'}
                    </option>
                    {servicosDoBarbeiroSelecionado.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)} ({s.duracao} min)</option>
                    ))}
                  </select>
                </div>

                {/* Exibe os dias e horários de atendimento do barbeiro escolhido */}
                {barbeiroSelecionadoInfo && (
                  <div className="md:col-span-2 rounded bg-zinc-800/40 p-3 border border-zinc-800 text-xs text-zinc-300 flex justify-between">
                    <span>📅 <b>Dias:</b> {barbeiroSelecionadoInfo.dias_trabalho || 'Segunda a Sábado'}</span>
                    <span>⏰ <b>Horário:</b> {barbeiroSelecionadoInfo.horario_inicio} às {barbeiroSelecionadoInfo.horario_fim}</span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Data</label>
                  <input type="date" min={dataHoje} value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Horário</label>
                  <input type="time" value={horarioAgendamento} onChange={(e) => setHorarioAgendamento(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none" />
                </div>

                <div className="md:col-span-2">
                  <button type="submit" className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 transition-colors">
                    Confirmar Agendamento
                  </button>
                </div>
              </form>

              {mensagem && (
                <p className="mt-4 rounded border border-zinc-700 bg-zinc-800 p-3 text-center text-sm text-emerald-400">{mensagem}</p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-white">Meus Agendamentos</h2>
              {agendamentos.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum agendamento encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 gap-4">
                      <div>
                        <p className="font-semibold text-white">{item.servicos?.nome}</p>
                        <p className="text-xs text-zinc-400">Barbeiro: {item.barbeiros?.nome}</p>
                        <p className="text-xs text-zinc-400">Data: {item.data.split('-').reverse().join('/')} às {item.horario?.slice(0, 5)}</p>
                      </div>
                      <span className={`self-start sm:self-center rounded px-2.5 py-1 text-xs font-medium border uppercase tracking-wider ${
                        item.status === 'concluído' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                        item.status === 'cancelado' ? 'bg-red-950 text-red-400 border-red-800' :
                        'bg-blue-950 text-blue-400 border-blue-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {usuario?.tipo === 'barbeiro' && (
          <>
            {/* Bloco de Configurar Horários e Dias de Atendimento */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-semibold text-emerald-400">Meu Expediente</h2>
              <form onSubmit={handleSalvarExpediente} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Início do Expediente</label>
                  <input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Fim do Expediente</label>
                  <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Dias de Atendimento</label>
                  <input type="text" value={diasTrabalho} onChange={e => setDiasTrabalho(e.target.value)} placeholder="Ex: Segunda a Sábado" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <button type="submit" className="rounded-lg bg-zinc-800 px-6 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors">
                    Salvar Expediente
                  </button>
                </div>
              </form>
            </div>

            {/* Bloco 1: Agenda */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg mt-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Minha Agenda</h2>
              </div>
              
              {agendamentos.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum cliente agendado no momento.</p>
              ) : (
                <div className="space-y-3">
                  {agendamentos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 gap-4">
                      <div>
                        <p className="font-semibold text-white text-lg">{item.horario?.slice(0, 5)}</p>
                        <p className="text-sm text-zinc-300"><span className="text-zinc-500">Cliente:</span> {item.clientes?.nome}</p>
                        <p className="text-sm text-zinc-300"><span className="text-zinc-500">Serviço:</span> {item.servicos?.nome} ({item.servicos?.duracao} min)</p>
                        <p className="text-xs text-emerald-500 mt-1">📱 {item.clientes?.telefone}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => atualizarStatus(item.id, e.target.value)}
                          className={`rounded px-2.5 py-1 text-xs font-medium uppercase tracking-wider border cursor-pointer focus:outline-none transition-colors ${
                            item.status === 'concluído' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                            item.status === 'cancelado' ? 'bg-red-950 text-red-400 border-red-800' :
                            'bg-blue-950 text-blue-400 border-blue-800'
                          }`}
                        >
                          <option value="agendado">Agendado</option>
                          <option value="concluído">Concluído</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                        <p className="text-xs text-zinc-500">{item.data.split('-').reverse().join('/')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco 2: Gerenciamento de Serviços */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg mt-6">
              <h2 className="mb-4 text-xl font-semibold text-emerald-400">Gerenciar Serviços</h2>
              
              <form onSubmit={handleAdicionarServico} className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6 bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Nome do Serviço</label>
                  <input type="text" value={novoServicoNome} onChange={e => setNovoServicoNome(e.target.value)} placeholder="Ex: Corte Degradê" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Preço</label>
                  <input 
                    type="text" 
                    value={novoServicoPrecoFormatado} 
                    onChange={handlePrecoChange} 
                    placeholder="R$ 0,00" 
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Duração (min)</label>
                  <input type="number" min="1" max="480" value={novoServicoDuracao} onChange={e => setNovoServicoDuracao(e.target.value)} placeholder="Ex: 30" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">
                    Adicionar Serviço
                  </button>
                </div>
              </form>

              {servicos.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum serviço cadastrado.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {servicos.map(servico => (
                    <div key={servico.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
                      <div>
                        <p className="font-semibold text-white text-sm">{servico.nome}</p>
                        <p className="text-xs text-zinc-400">Duração: {servico.duracao} min</p>
                        <p className="font-medium text-emerald-400 mt-1">
                          R$ {Number(servico.preco).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleExcluirServico(servico.id)}
                        className="rounded bg-red-950/60 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/60 border border-red-900/50 transition-colors self-center"
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </section>
    </main>
  );
}