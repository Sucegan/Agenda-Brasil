'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, CalendarRange, CreditCard, Landmark, Plus, ReceiptText,
  RefreshCw, Smartphone, WalletCards, BadgeCheck, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  FinancialEntry, FinancialEntryStatus, FinancialEntryType, FinancialSummary,
  MonthlyPlan, PaymentMethod, PaymentTerminal,
} from '@/lib/database.types';
import { brazilDateISO, formatCurrency } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';

type FinanceTab = 'resumo' | 'movimentacoes' | 'planos' | 'maquininhas';

const tabs: { id: FinanceTab; label: string; icon: typeof Banknote }[] = [
  { id: 'resumo', label: 'Resumo', icon: Banknote },
  { id: 'movimentacoes', label: 'Movimentações', icon: ReceiptText },
  { id: 'planos', label: 'Planos mensais', icon: CalendarRange },
  { id: 'maquininhas', label: 'Maquininhas', icon: CreditCard },
];

const methodLabels: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  online: 'Online',
  outro: 'Outro',
};
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function monthStart() {
  return `${brazilDateISO().slice(0, 8)}01`;
}

function Metric({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">{label}</p><p className={`mt-2 text-xl font-black ${tone}`}>{value}</p></article>;
}

export function FinancialCenter({ barbershopId }: { barbershopId: string }) {
  const [tab, setTab] = useState<FinanceTab>('resumo');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(brazilDateISO);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [plans, setPlans] = useState<MonthlyPlan[]>([]);
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState<FinancialEntryType>('receita');
  const [entryCategory, setEntryCategory] = useState('Serviço');
  const [entryMethod, setEntryMethod] = useState<PaymentMethod>('pix');
  const [entryStatus, setEntryStatus] = useState<FinancialEntryStatus>('pago');
  const [entryValue, setEntryValue] = useState('');
  const [entryFee, setEntryFee] = useState('0');
  const [entryDescription, setEntryDescription] = useState('');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planAppointments, setPlanAppointments] = useState('1');
  const [planDiscount, setPlanDiscount] = useState('0');
  const [terminalName, setTerminalName] = useState('');
  const [terminalProvider, setTerminalProvider] = useState('');
  const [terminalIdentifier, setTerminalIdentifier] = useState('');
  const [connectStatus, setConnectStatus] = useState<'nao_conectado' | 'pendente' | 'ativo' | 'restrito'>('nao_conectado');
  const [connectLoading, setConnectLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryResult, entriesResult, plansResult, terminalsResult, businessResult] = await Promise.all([
      supabase.rpc('obter_resumo_financeiro', { p_barbearia_id: barbershopId, p_inicio: startDate, p_fim: endDate }),
      supabase.from('movimentacoes_financeiras').select('*').eq('barbearia_id', barbershopId).gte('ocorrido_em', `${startDate}T00:00:00`).lt('ocorrido_em', `${endDate}T23:59:59.999`).order('ocorrido_em', { ascending: false }).limit(200),
      supabase.from('planos_mensais').select('*').eq('barbearia_id', barbershopId).order('ativo', { ascending: false }).order('preco'),
      supabase.from('terminais_pagamento').select('*').eq('barbearia_id', barbershopId).order('ativa', { ascending: false }).order('apelido'),
      supabase.from('barbearias').select('stripe_onboarding_status').eq('id', barbershopId).single(),
    ]);
    setLoading(false);
    const error = summaryResult.error ?? entriesResult.error ?? plansResult.error ?? terminalsResult.error ?? businessResult.error;
    if (error) return toast.error(error.message ?? 'Não foi possível carregar o financeiro.');
    setSummary(summaryResult.data);
    setEntries(entriesResult.data ?? []);
    setPlans(plansResult.data ?? []);
    setTerminals(terminalsResult.data ?? []);
    setConnectStatus(businessResult.data?.stripe_onboarding_status ?? 'nao_conectado');
  }, [barbershopId, endDate, startDate]);

  useEffect(() => { void load(); }, [load]);

  const paidEntries = useMemo(() => entries.filter((entry) => entry.status === 'pago'), [entries]);

  const createEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(entryValue.replace(',', '.'));
    const fee = Number(entryFee.replace(',', '.'));
    if (!entryCategory.trim() || !Number.isFinite(value) || value < 0 || !Number.isFinite(fee) || fee < 0 || fee > value) return toast.error('Informe categoria, valor e taxa válidos.');
    setSaving(true);
    const { error } = await supabase.rpc('registrar_movimentacao_financeira', {
      p_barbearia_id: barbershopId,
      p_agendamento_id: null,
      p_tipo: entryType,
      p_categoria: entryCategory.trim(),
      p_metodo: entryMethod,
      p_valor_bruto: value,
      p_taxa: fee,
      p_status: entryStatus,
      p_descricao: entryDescription.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message ?? 'Não foi possível registrar a movimentação.');
    setEntryValue('');
    setEntryFee('0');
    setEntryDescription('');
    await load();
    toast.success('Movimentação registrada.');
  };

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(planPrice.replace(',', '.'));
    const appointments = Number(planAppointments);
    const discount = Number(planDiscount.replace(',', '.'));
    if (planName.trim().length < 2 || !Number.isFinite(price) || price < 0 || !Number.isInteger(appointments) || appointments < 1 || appointments > 60 || !Number.isFinite(discount) || discount < 0 || discount > 100) return toast.error('Revise os dados do plano.');
    setSaving(true);
    const { error } = await supabase.from('planos_mensais').insert({
      barbearia_id: barbershopId,
      nome: planName.trim(),
      descricao: planDescription.trim() || null,
      preco: price,
      atendimentos_inclusos: appointments,
      desconto_excedente: discount,
    });
    setSaving(false);
    if (error) return toast.error(error.message ?? 'Não foi possível criar o plano.');
    setPlanName(''); setPlanDescription(''); setPlanPrice(''); setPlanAppointments('1'); setPlanDiscount('0');
    await load();
    toast.success('Plano mensal criado.');
  };

  const createTerminal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (terminalName.trim().length < 2 || terminalProvider.trim().length < 2) return toast.error('Informe o nome e o provedor da maquininha.');
    setSaving(true);
    const { error } = await supabase.from('terminais_pagamento').insert({
      barbearia_id: barbershopId,
      apelido: terminalName.trim(),
      provedor: terminalProvider.trim(),
      identificador: terminalIdentifier.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message ?? 'Não foi possível cadastrar a maquininha.');
    setTerminalName(''); setTerminalProvider(''); setTerminalIdentifier('');
    await load();
    toast.success('Maquininha cadastrada para conciliação.');
  };

  const togglePlan = async (plan: MonthlyPlan) => {
    const { error } = await supabase.from('planos_mensais').update({ ativo: !plan.ativo, updated_at: new Date().toISOString() }).eq('id', plan.id);
    if (error) return toast.error(error.message ?? 'Não foi possível alterar o plano.');
    await load();
  };

  const toggleTerminal = async (terminal: PaymentTerminal) => {
    const { error } = await supabase.from('terminais_pagamento').update({ ativa: !terminal.ativa, updated_at: new Date().toISOString() }).eq('id', terminal.id);
    if (error) return toast.error(error.message ?? 'Não foi possível alterar a maquininha.');
    await load();
  };

  const stripeRequest = async (method: 'GET' | 'POST') => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Entre novamente para configurar pagamentos.');
    const url = method === 'GET' ? `/api/payments/connect?barbershopId=${encodeURIComponent(barbershopId)}` : '/api/payments/connect';
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify({ barbershopId }) : undefined,
    });
    const result = await response.json().catch(() => ({})) as { url?: string; status?: typeof connectStatus; error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Não foi possível acessar a Stripe.');
    return result;
  };

  const connectStripe = async () => {
    setConnectLoading(true);
    try {
      const result = await stripeRequest('POST');
      if (!result.url) throw new Error('Link de ativação indisponível.');
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a ativação.');
      setConnectLoading(false);
    }
  };

  const refreshStripe = async () => {
    setConnectLoading(true);
    try {
      const result = await stripeRequest('GET');
      if (result.status) setConnectStatus(result.status);
      toast.success(result.status === 'ativo' ? 'Recebimentos online ativos.' : 'Situação da Stripe atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a Stripe.');
    } finally {
      setConnectLoading(false);
    }
  };

  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500';

  return (
    <section id="financeiro" className="panel-card overflow-hidden">
      <div className="border-b border-zinc-800 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-blue-500/5 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3"><span className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-300"><WalletCards size={23} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Gestão financeira</p><h2 className="mt-1 text-xl font-black">Caixa, planos e recebimentos</h2><p className="mt-1 text-sm text-zinc-500">Concilie entradas e despesas por estabelecimento.</p></div></div>
          <button type="button" onClick={() => { void load(); }} disabled={loading} className="secondary-button"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
        </div>
        <nav aria-label="Seções financeiras" className="mt-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black ${tab === id ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-zinc-800 bg-zinc-950/50 text-zinc-500'}`}><Icon size={15} /> {label}</button>)}</nav>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-bold text-zinc-400">INÍCIO<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-zinc-400">FIM<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} /></label>
          <button type="button" onClick={() => { void load(); }} className="secondary-button self-end">Aplicar período</button>
        </div>

        {tab === 'resumo' && <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Receitas pagas" value={formatCurrency(Number(summary?.receitas ?? 0))} tone="text-emerald-300" /><Metric label="Despesas + estornos" value={formatCurrency(Number(summary?.despesas ?? 0) + Number(summary?.estornos ?? 0))} tone="text-red-300" /><Metric label="Taxas" value={formatCurrency(Number(summary?.taxas ?? 0))} tone="text-amber-300" /><Metric label="Saldo líquido" value={formatCurrency(Number(summary?.saldo ?? 0))} tone="text-blue-300" /></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4"><p className="text-sm text-zinc-400"><b className="text-white">{paidEntries.length}</b> movimentações pagas no período · <b className="text-amber-300">{formatCurrency(Number(summary?.pendentes ?? 0))}</b> aguardando confirmação.</p></div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="flex items-center gap-2 font-bold text-blue-200"><Smartphone size={17} /> Recebimento online <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase ${connectStatus === 'ativo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{connectStatus.replace('_', ' ')}</span></p><p className="mt-1 text-sm leading-6 text-zinc-400">Conecte a conta do estabelecimento para receber cartão e Pix elegível diretamente, com conciliação automática.</p></div><div className="flex shrink-0 flex-wrap gap-2">{connectStatus === 'ativo' ? <button type="button" onClick={() => { void refreshStripe(); }} disabled={connectLoading} className="secondary-button"><BadgeCheck size={16} /> Verificar conta</button> : <button type="button" onClick={() => { void connectStripe(); }} disabled={connectLoading} className="primary-button"><ExternalLink size={16} /> {connectLoading ? 'Abrindo...' : connectStatus === 'nao_conectado' ? 'Ativar Stripe' : 'Continuar ativação'}</button>}</div></div></div>
        </div>}

        {tab === 'movimentacoes' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={createEntry} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4"><h3 className="font-black">Nova movimentação</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400">TIPO<select value={entryType} onChange={(event) => setEntryType(event.target.value as FinancialEntryType)} className={inputClass}><option value="receita">Receita</option><option value="despesa">Despesa</option><option value="estorno">Estorno</option></select></label><label className="text-xs font-bold text-zinc-400">STATUS<select value={entryStatus} onChange={(event) => setEntryStatus(event.target.value as FinancialEntryStatus)} className={inputClass}><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option></select></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">CATEGORIA<input value={entryCategory} onChange={(event) => setEntryCategory(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">FORMA<select value={entryMethod} onChange={(event) => setEntryMethod(event.target.value as PaymentMethod)} className={inputClass}>{(Object.keys(methodLabels) as PaymentMethod[]).map((method) => <option key={method} value={method}>{methodLabels[method]}</option>)}</select></label><label className="text-xs font-bold text-zinc-400">VALOR<input inputMode="decimal" value={entryValue} onChange={(event) => setEntryValue(event.target.value)} placeholder="0,00" className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">TAXA<input inputMode="decimal" value={entryFee} onChange={(event) => setEntryFee(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">DESCRIÇÃO<input value={entryDescription} onChange={(event) => setEntryDescription(event.target.value)} className={inputClass} /></label></div><button disabled={saving} className="primary-button mt-4 w-full"><Plus size={16} /> Registrar</button></form>
          <div className="space-y-2">{entries.length ? entries.map((entry) => <article key={entry.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 sm:flex-row sm:items-center"><div><p className="font-bold text-white">{entry.categoria}</p><p className="mt-1 text-xs text-zinc-500">{dateTimeFormatter.format(new Date(entry.ocorrido_em))} · {methodLabels[entry.metodo]} · {entry.status}</p>{entry.descricao && <p className="mt-1 text-xs text-zinc-400">{entry.descricao}</p>}</div><div className="text-right"><p className={`font-black ${entry.tipo === 'receita' ? 'text-emerald-300' : 'text-red-300'}`}>{entry.tipo === 'receita' ? '+' : '-'} {formatCurrency(Number(entry.valor_liquido))}</p>{Number(entry.taxa) > 0 && <p className="text-[10px] text-zinc-500">taxa {formatCurrency(Number(entry.taxa))}</p>}</div></article>) : <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Nenhuma movimentação neste período.</p>}</div>
        </div>}

        {tab === 'planos' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={createPlan} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4"><h3 className="font-black">Criar plano mensal</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400 sm:col-span-2">NOME<input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Ex.: Corte todo mês" className={inputClass} /></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">DESCRIÇÃO<input value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">PREÇO MENSAL<input inputMode="decimal" value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">ATENDIMENTOS<input type="number" min="1" max="60" value={planAppointments} onChange={(event) => setPlanAppointments(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">DESCONTO EXCEDENTE (%)<input type="number" min="0" max="100" step="0.01" value={planDiscount} onChange={(event) => setPlanDiscount(event.target.value)} className={inputClass} /></label></div><button disabled={saving} className="primary-button mt-4 w-full"><Plus size={16} /> Criar plano</button></form>
          <div className="grid gap-3 sm:grid-cols-2">{plans.length ? plans.map((plan) => <article key={plan.id} className={`rounded-2xl border p-4 ${plan.ativo ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/45 opacity-70'}`}><p className="font-black">{plan.nome}</p><p className="mt-1 text-2xl font-black text-emerald-300">{formatCurrency(Number(plan.preco))}<span className="text-xs font-medium text-zinc-500">/mês</span></p><p className="mt-2 text-xs leading-5 text-zinc-400">{plan.atendimentos_inclusos} atendimento(s) · {Number(plan.desconto_excedente)}% no excedente</p>{plan.descricao && <p className="mt-2 text-xs text-zinc-500">{plan.descricao}</p>}<button type="button" onClick={() => { void togglePlan(plan); }} className="secondary-button mt-4 w-full">{plan.ativo ? 'Pausar plano' : 'Ativar plano'}</button></article>) : <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500 sm:col-span-2">Crie o primeiro plano mensal.</p>}</div>
        </div>}

        {tab === 'maquininhas' && <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={createTerminal} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4"><h3 className="flex items-center gap-2 font-black"><Landmark size={18} className="text-blue-300" /> Cadastrar maquininha</h3><p className="mt-1 text-xs text-zinc-500">O identificador serve somente para conciliação. Nunca informe senha ou chave secreta.</p><div className="mt-4 space-y-3"><label className="text-xs font-bold text-zinc-400">APELIDO<input value={terminalName} onChange={(event) => setTerminalName(event.target.value)} placeholder="Ex.: Balcão principal" className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">PROVEDOR<input value={terminalProvider} onChange={(event) => setTerminalProvider(event.target.value)} placeholder="Ex.: Stone, Cielo, Mercado Pago" className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">IDENTIFICADOR OPCIONAL<input value={terminalIdentifier} onChange={(event) => setTerminalIdentifier(event.target.value)} maxLength={120} className={inputClass} /></label></div><button disabled={saving} className="primary-button mt-4 w-full"><Plus size={16} /> Cadastrar</button></form>
          <div className="space-y-3">{terminals.length ? terminals.map((terminal) => <article key={terminal.id} className={`rounded-2xl border p-4 ${terminal.ativa ? 'border-blue-500/25 bg-blue-500/5' : 'border-zinc-800 bg-zinc-950/45 opacity-70'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{terminal.apelido}</p><p className="mt-1 text-xs text-zinc-500">{terminal.provedor}{terminal.identificador ? ` · ${terminal.identificador}` : ''}</p></div><CreditCard size={20} className="text-blue-300" /></div><button type="button" onClick={() => { void toggleTerminal(terminal); }} className="secondary-button mt-4 w-full">{terminal.ativa ? 'Desativar' : 'Reativar'}</button></article>) : <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Nenhuma maquininha cadastrada.</p>}</div>
        </div>}
      </div>
    </section>
  );
}
