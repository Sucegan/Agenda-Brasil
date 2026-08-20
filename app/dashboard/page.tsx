'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<any>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);

  // Formulário de Agendamento
  const [selectedBarbeiro, setSelectedBarbeiro] = useState('');
  const [selectedServico, setSelectedServico] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horarioAgendamento, setHorarioAgendamento] = useState('');

  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const router = useRouter();

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    // 1. Obter sessão ativa
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }

    // 2. Buscar perfil na tabela 'usuarios'
    const { data: userData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setUsuario(userData);

    // 3. Se for cliente, buscar o id da tabela 'clientes'
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
    }

    // 4. Carregar lista de barbeiros e serviços disponíveis
    const { data: barbeirosData } = await supabase.from('barbeiros').select('*');
    const { data: servicosData } = await supabase.from('servicos').select('*');

    if (barbeirosData) setBarbeiros(barbeirosData);
    if (servicosData) setServicos(servicosData);

    setLoading(false);
  };

  const carregarAgendamentosCliente = async (cId: number) => {
    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id,
        data,
        horario,
        status,
        barbeiros(nome),
        servicos(nome, preco)
      `)
      .eq('cliente_id', cId);

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
      carregarAgendamentosCliente(clienteId);
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

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda Brasil</h1>
          <p className="text-sm text-zinc-400">
            Olá, {usuario?.nome} ({usuario?.tipo})
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Sair
        </button>
      </header>

      <section className="mx-auto mt-8 max-w-4xl space-y-6">
        {/* Formulário para Clientes */}
        {usuario?.tipo === 'cliente' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-emerald-400">Novo Agendamento</h2>
            <form onSubmit={handleAgendar} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">Barbeiro</label>
                <select
                  value={selectedBarbeiro}
                  onChange={(e) => setSelectedBarbeiro(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:outline-none"
                >
                  <option value="">Selecione um barbeiro</option>
                  {barbeiros.map((b) => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">Serviço</label>
                <select
                  value={selectedServico}
                  onChange={(e) => setSelectedServico(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:outline-none"
                >
                  <option value="">Selecione um serviço</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} - R$ {Number(s.preco).toFixed(2)} ({s.duracao} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">Data</label>
                <input
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-300">Horário</label>
                <input
                  type="time"
                  value={horarioAgendamento}
                  onChange={(e) => setHorarioAgendamento(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>

            {mensagem && (
              <p className="mt-4 rounded border border-zinc-700 bg-zinc-800 p-3 text-center text-sm text-zinc-200">
                {mensagem}
              </p>
            )}
          </div>
        )}

        {/* Meus Agendamentos */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-white">Meus Agendamentos</h2>
          {agendamentos.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum agendamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {agendamentos.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
                  <div>
                    <p className="font-semibold text-white">{item.servicos?.nome}</p>
                    <p className="text-xs text-zinc-400">Barbeiro: {item.barbeiros?.nome}</p>
                    <p className="text-xs text-zinc-400">
                      Data: {item.data} às {item.horario}
                    </p>
                  </div>
                  <span className="rounded bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-800">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}