'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Banknote, Building2, CalendarCheck2, ExternalLink,
  RefreshCw, Search, ShieldCheck, Star, Store, UserRoundCheck, Users, WalletCards,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  AccountType, AdminClientDirectoryEntry, AdminDashboardSummary,
  AdminUserDirectoryEntry,
} from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';

type AdminSection = 'visao-geral' | 'unidades' | 'acessos' | 'clientes' | 'financeiro';

const sectionLabels: Record<AdminSection, string> = {
  'visao-geral': 'Visão geral',
  unidades: 'Unidades',
  acessos: 'Acessos',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
};

const roleLabels: Record<AccountType, string> = {
  admin: 'Administrador',
  barbeiro: 'Profissional',
  cliente: 'Cliente',
};

function MetricCard({ label, value, helper, icon: Icon, tone = 'emerald' }: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Building2;
  tone?: 'emerald' | 'violet' | 'amber' | 'blue';
}) {
  const tones = {
    emerald: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300',
    violet: 'border-violet-500/25 bg-violet-500/5 text-violet-300',
    amber: 'border-amber-500/25 bg-amber-500/5 text-amber-300',
    blue: 'border-blue-500/25 bg-blue-500/5 text-blue-300',
  };

  return (
    <article className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          <p className="mt-1 text-xs text-zinc-500">{helper}</p>
        </div>
        <span className="rounded-xl border border-current/20 bg-zinc-950/50 p-2.5"><Icon size={19} /></span>
      </div>
    </article>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">{children}</p>;
}

export function AdminCommandCenter({
  activeBarbershopId,
  onSelectBarbershop,
  onRefresh,
}: {
  activeBarbershopId: string | null;
  onSelectBarbershop: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [section, setSection] = useState<AdminSection>('visao-geral');
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [users, setUsers] = useState<AdminUserDirectoryEntry[]>([]);
  const [clients, setClients] = useState<AdminClientDirectoryEntry[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userType, setUserType] = useState<AccountType | ''>('');
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [changingUnitId, setChangingUnitId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async (search = '', role: AccountType | '' = '') => {
    const { data, error: usersError } = await supabase.rpc('listar_usuarios_admin', {
      p_busca: search.trim() || null,
      p_tipo: role || null,
      p_limite: 150,
    });
    if (usersError) throw usersError;
    setUsers(data ?? []);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data, error: summaryError }] = await Promise.all([
        supabase.rpc('obter_resumo_admin'),
        loadUsers(),
      ]);
      if (summaryError || !data) throw summaryError ?? new Error('Resumo administrativo indisponível.');
      setSummary(data);
    } catch (loadError) {
      console.error('[admin:center] load failed', loadError);
      setError('Não foi possível carregar a central administrativa.');
    } finally {
      setLoading(false);
    }
  }, [loadUsers]);

  const loadClients = useCallback(async (search = '') => {
    if (!activeBarbershopId) {
      setClients([]);
      return;
    }
    setClientsLoading(true);
    const { data, error: clientsError } = await supabase.rpc('listar_clientes_admin', {
      p_barbearia_id: activeBarbershopId,
      p_busca: search.trim() || null,
      p_limite: 150,
    });
    setClientsLoading(false);
    if (clientsError) {
      toast.error('Não foi possível carregar os clientes desta unidade.');
      return;
    }
    setClients(data ?? []);
  }, [activeBarbershopId]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { setClientSearch(''); void loadClients(); }, [loadClients]);

  const changeUnitStatus = async (id: string, active: boolean, name: string) => {
    const action = active ? 'reativar' : 'desativar';
    if (!window.confirm(`Deseja realmente ${action} a unidade “${name}”?${active ? '' : ' O link público também será desligado.'}`)) return;
    setChangingUnitId(id);
    const { error: updateError } = await supabase.rpc('admin_alterar_status_barbearia', {
      p_barbearia_id: id,
      p_ativa: active,
    });
    setChangingUnitId(null);
    if (updateError) return toast.error(updateError.message ?? 'Não foi possível alterar a unidade.');
    try {
      await Promise.all([loadSummary(), onRefresh()]);
      toast.success(active ? 'Unidade reativada.' : 'Unidade desativada e agenda pública pausada.');
    } catch (refreshError) {
      console.error('[admin:center] refresh failed', refreshError);
      toast.success('Status alterado. Atualize a página para recarregar os dados.');
    }
  };

  const metrics = summary?.metricas;
  const selectedUnit = summary?.unidades.find((unit) => unit.id === activeBarbershopId);

  return (
    <section id="central-admin" className="overflow-hidden rounded-3xl border border-violet-500/25 bg-zinc-900/80 shadow-2xl shadow-violet-950/10">
      <div className="border-b border-zinc-800 bg-gradient-to-br from-violet-500/15 via-zinc-900 to-emerald-500/5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl border border-violet-400/30 bg-violet-500/15 p-3 text-violet-200"><ShieldCheck size={24} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Controle total da plataforma</p>
              <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Central administrativa</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Acompanhe todas as unidades, acessos, clientes, pagamentos e indicadores sem sair do mesmo painel.</p>
            </div>
          </div>
          <button type="button" onClick={() => { void Promise.all([loadSummary(), loadClients(clientSearch)]); }} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:border-violet-400/50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar central
          </button>
        </div>

        <nav aria-label="Seções administrativas" className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(sectionLabels) as AdminSection[]).map((item) => (
            <button key={item} type="button" onClick={() => setSection(item)} aria-pressed={section === item} className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-black transition ${section === item ? 'border-violet-400/50 bg-violet-500/20 text-violet-100' : 'border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300'}`}>
              {sectionLabels[item]}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-5 sm:p-6">
        {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">{error} <button type="button" onClick={() => { void loadSummary(); }} className="ml-2 font-bold underline">Tentar novamente</button></div>}
        {loading && !summary && <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-zinc-800/70" />)}</div>}

        {summary && section === 'visao-geral' && metrics && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Unidades" value={`${metrics.unidades_ativas}/${metrics.unidades_total}`} helper="ativas na plataforma" icon={Building2} tone="violet" />
              <MetricCard label="Agenda de hoje" value={String(metrics.agendamentos_hoje)} helper="horários ativos" icon={CalendarCheck2} tone="blue" />
              <MetricCard label="Receita do mês" value={formatCurrency(Number(metrics.receita_mes))} helper="serviços concluídos" icon={Banknote} />
              <MetricCard label="Base de clientes" value={String(metrics.clientes)} helper={`${metrics.profissionais} profissionais`} icon={Users} tone="amber" />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <article className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 lg:col-span-2">
                <h3 className="flex items-center gap-2 font-black text-white"><Activity className="text-emerald-400" size={18} /> Saúde da operação</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-zinc-500">Avaliação média</p><p className="mt-1 flex items-center gap-1 text-lg font-black text-amber-300"><Star size={17} className="fill-amber-300" /> {Number(metrics.avaliacao_media).toFixed(1)}</p></div>
                  <div><p className="text-xs text-zinc-500">Sinais aguardando</p><p className="mt-1 text-lg font-black text-amber-200">{formatCurrency(Number(metrics.sinais_pendentes))}</p></div>
                  <div><p className="text-xs text-zinc-500">Usuários cadastrados</p><p className="mt-1 text-lg font-black text-blue-200">{metrics.usuarios}</p></div>
                </div>
              </article>
              <article className={`rounded-2xl border p-4 ${(metrics.erros_24h || metrics.exclusoes_pendentes) ? 'border-amber-500/25 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                <h3 className="flex items-center gap-2 font-black text-white"><AlertTriangle className={(metrics.erros_24h || metrics.exclusoes_pendentes) ? 'text-amber-300' : 'text-emerald-300'} size={18} /> Atenção administrativa</h3>
                <p className="mt-3 text-sm text-zinc-300"><b>{metrics.erros_24h}</b> erro(s) técnico(s) nas últimas 24h</p>
                <p className="mt-2 text-sm text-zinc-300"><b>{metrics.exclusoes_pendentes}</b> solicitação(ões) de exclusão pendente(s)</p>
              </article>
            </div>
          </div>
        )}

        {summary && section === 'unidades' && (
          <div>
            <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h3 className="text-lg font-black text-white">Todas as unidades</h3><p className="mt-1 text-sm text-zinc-500">Administre unidades ativas e inativas de toda a plataforma.</p></div><span className="text-xs font-bold text-zinc-500">{summary.unidades.length} cadastrada(s)</span></div>
            <div className="grid gap-3 lg:grid-cols-2">
              {summary.unidades.map((unit) => (
                <article key={unit.id} className={`rounded-2xl border p-4 ${unit.id === activeBarbershopId ? 'border-violet-400/45 bg-violet-500/10' : 'border-zinc-800 bg-zinc-950/45'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-black text-white">{unit.nome}</p><p className="mt-1 truncate text-xs text-zinc-500">/agendar?estabelecimento={unit.slug}</p></div>
                    <div className="flex flex-wrap justify-end gap-1"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${unit.ativa ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>{unit.ativa ? 'Ativa' : 'Inativa'}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${unit.agendamento_publico ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-800 text-zinc-500'}`}>{unit.agendamento_publico ? 'Pública' : 'Privada'}</span></div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-zinc-900 p-2"><b className="block text-sm text-white">{unit.profissionais}</b><small className="text-[10px] text-zinc-600">Equipe</small></div><div className="rounded-lg bg-zinc-900 p-2"><b className="block text-sm text-white">{unit.agendamentos}</b><small className="text-[10px] text-zinc-600">Agenda</small></div><div className="rounded-lg bg-zinc-900 p-2"><b className="block text-sm text-amber-200">{Number(unit.avaliacao_media).toFixed(1)}</b><small className="text-[10px] text-zinc-600">Nota</small></div></div>
                  <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onSelectBarbershop(unit.id)} className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500">Gerenciar unidade</button>{unit.ativa && unit.agendamento_publico && <a href={`/agendar?estabelecimento=${encodeURIComponent(unit.slug)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300" aria-label={`Abrir agenda pública de ${unit.nome}`}><ExternalLink size={15} /></a>}<button type="button" onClick={() => { void changeUnitStatus(unit.id, !unit.ativa, unit.nome); }} disabled={changingUnitId === unit.id} className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${unit.ativa ? 'border-red-500/25 text-red-300' : 'border-emerald-500/25 text-emerald-300'}`}>{changingUnitId === unit.id ? 'Salvando...' : unit.ativa ? 'Desativar' : 'Reativar'}</button></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {summary && section === 'acessos' && (
          <div>
            <div className="mb-4"><h3 className="text-lg font-black text-white">Usuários e permissões</h3><p className="mt-1 text-sm text-zinc-500">Diretório central de administradores, profissionais e clientes.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void loadUsers(userSearch, userType); }} className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <label className="relative"><span className="sr-only">Buscar usuário</span><Search className="absolute left-3 top-3.5 text-zinc-600" size={16} /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nome, e-mail ou telefone" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-9 pr-3 text-sm outline-none focus:border-violet-500" /></label>
              <select value={userType} onChange={(event) => setUserType(event.target.value as AccountType | '')} aria-label="Filtrar por perfil" className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-500"><option value="">Todos os perfis</option><option value="admin">Administradores</option><option value="barbeiro">Profissionais</option><option value="cliente">Clientes</option></select>
              <button className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold hover:bg-violet-500">Buscar</button>
            </form>
            {users.length ? <div className="overflow-x-auto rounded-xl border border-zinc-800"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-950/80 text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Cadastro</th></tr></thead><tbody className="divide-y divide-zinc-800">{users.map((user) => <tr key={user.id} className="bg-zinc-950/30"><td className="px-4 py-3"><b className="block text-zinc-100">{user.nome}</b><small className="text-zinc-600">{user.id.slice(0, 8)}</small></td><td className="px-4 py-3"><span className="block text-zinc-300">{user.email}</span><small className="text-zinc-600">{user.telefone || 'Sem telefone'}</small></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${user.tipo === 'admin' ? 'bg-violet-500/15 text-violet-300' : user.tipo === 'barbeiro' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{roleLabels[user.tipo]}</span></td><td className="px-4 py-3 text-xs text-zinc-500">{new Date(user.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div> : <EmptyState>Nenhum usuário encontrado com esses filtros.</EmptyState>}
          </div>
        )}

        {summary && section === 'clientes' && (
          <div>
            <div className="mb-4"><h3 className="text-lg font-black text-white">Clientes da unidade</h3><p className="mt-1 text-sm text-zinc-500">Histórico, relacionamento, faltas e fidelidade em {selectedUnit?.nome ?? 'unidade selecionada'}.</p></div>
            <form onSubmit={(event) => { event.preventDefault(); void loadClients(clientSearch); }} className="mb-4 flex gap-2"><label className="relative flex-1"><span className="sr-only">Buscar cliente</span><Search className="absolute left-3 top-3.5 text-zinc-600" size={16} /><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nome, e-mail ou telefone" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></label><button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold hover:bg-emerald-500">Buscar</button></form>
            {clientsLoading ? <p className="py-8 text-center text-sm text-zinc-500">Carregando clientes...</p> : clients.length ? <div className="grid gap-3 lg:grid-cols-2">{clients.map((client) => <article key={client.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{client.nome}</p><p className="mt-1 text-xs text-zinc-500">{client.email || 'Sem e-mail'} · {client.telefone}</p></div><UserRoundCheck className="text-emerald-400" size={19} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span><b className="block text-zinc-100">{client.agendamentos}</b><small className="text-zinc-600">Agendamentos</small></span><span><b className="block text-zinc-100">{formatCurrency(Number(client.total_gasto))}</b><small className="text-zinc-600">Total gasto</small></span><span><b className="block text-orange-200">{client.faltas}</b><small className="text-zinc-600">Faltas</small></span><span><b className="block text-amber-200">{client.pontos_fidelidade}</b><small className="text-zinc-600">Pontos</small></span></div>{client.ultimo_atendimento && <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] text-zinc-600">Último atendimento: {formatDate(client.ultimo_atendimento)}</p>}</article>)}</div> : <EmptyState>Esta unidade ainda não possui clientes com histórico.</EmptyState>}
          </div>
        )}

        {summary && section === 'financeiro' && metrics && (
          <div>
            <div className="mb-4"><h3 className="text-lg font-black text-white">Financeiro consolidado</h3><p className="mt-1 text-sm text-zinc-500">Receita realizada e sinais que ainda exigem conferência.</p></div>
            <div className="grid gap-3 sm:grid-cols-2"><MetricCard label="Receita consolidada" value={formatCurrency(Number(metrics.receita_mes))} helper="serviços concluídos neste mês" icon={WalletCards} /><MetricCard label="Sinais pendentes" value={formatCurrency(Number(metrics.sinais_pendentes))} helper="pagamentos pendentes ou informados" icon={AlertTriangle} tone="amber" /></div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-950/80 text-[10px] uppercase tracking-wider text-zinc-600"><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Receita do mês</th><th className="px-4 py-3">Agendamentos</th><th className="px-4 py-3">Avaliação</th></tr></thead><tbody className="divide-y divide-zinc-800">{summary.unidades.map((unit) => <tr key={unit.id}><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold text-zinc-200"><Store size={14} className="text-violet-300" /> {unit.nome}</span></td><td className="px-4 py-3 font-black text-emerald-300">{formatCurrency(Number(unit.receita_mes))}</td><td className="px-4 py-3 text-zinc-400">{unit.agendamentos}</td><td className="px-4 py-3 text-amber-300">{Number(unit.avaliacao_media).toFixed(1)}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </div>
    </section>
  );
}
