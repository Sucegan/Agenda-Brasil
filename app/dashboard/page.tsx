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
  const [novoServicoPreco, setNovoServicoPreco] = useState('');
  const [novoServicoDuracao, setNovoServicoDuracao] = useState('');

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
      const { data: barbeiroData } = await supabase
        .from('barbeiros')
        .select('id')
        .eq('usuario_id', session.user.id)
        .single();

      if (barbeiroData) {
        setBarbeiroId(barbeiroData.id);
        carregarAgendamentosBarbeiro(barbeiroData.id);

        // Barbeiro carrega apenas os seus próprios serviços cadastrados
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

  const handleAgendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem('');

    if (!clienteId || !selectedBarbeiro || !selectedServico || !dataAgendamento || !horarioAgendamento) {
      setMensagem('Preencha todos os campos do agendamento.');
      return;
    }

    const { error } = await supabase.from('agendamentos').insert([
      {
        cliente_id: clienteId,
        barbeiro_id: parseInt(selectedBarbeiro),
        servico_id: parseInt(selectedServico),
        data: dataAgendamento,
        horario: horarioAgendamento,
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

  // Função para adicionar um novo serviço vinculado ao barbeiro logado
  const handleAdicionarServico = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!novoServicoNome || !novoServicoPreco || !novoServicoDuracao || !barbeiroId) {
      alert('Preencha todos os campos para cadastrar o serviço.');
      return;
    }

    const { error } = await supabase.from('servicos').insert([
      {
        nome: novoServicoNome,
        preco: parseFloat(novoServicoPreco),
        duracao: parseInt(novoServicoDuracao),
        barbeiro_id: barbeiroId,
      }
    ]);

    if (error) {
      alert(`Erro ao adicionar serviço: ${error.message}`);
    } else {
      setNovoServicoNome('');
      setNovoServicoPreco('');
      setNovoServicoDuracao('');
      
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

  // Filtra os serviços para o cliente ver apenas os do barbeiro escolhido
  const servicosDoBarbeiroSelecionado = servicos.filter(
    (s) => s.barbeiro_id === Number(selectedBarbeiro)
  );

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
        
        {/* ========================================== */}
        {/* VISÃO DO CLIENTE */}
        {/* ========================================== */}
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
                        <p className="text-xs text-zinc-400">Data: {item.data.split('-').reverse().join('/')} às {item.horario}</p>
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

        {/* ========================================== */}
        {/* VISÃO DO BARBEIRO */}
        {/* ========================================== */}
        {usuario?.tipo === 'barbeiro' && (
          <>
            {/* Bloco 1: Agenda */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
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
                        <p className="font-semibold text-white text-lg">{item.horario}</p>
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
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Preço (R$)</label>
                  <input type="number" step="0.01" value={novoServicoPreco} onChange={e => setNovoServicoPreco(e.target.value)} placeholder="Ex: 35.00" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-300">Duração (min)</label>
                  <input type="number" value={novoServicoDuracao} onChange={e => setNovoServicoDuracao(e.target.value)} placeholder="Ex: 30" className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-white focus:border-emerald-500 focus:outline-none text-sm" />
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
                      </div>
                      <p className="font-medium text-emerald-400">
                        R$ {Number(servico.preco).toFixed(2)}
                      </p>
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