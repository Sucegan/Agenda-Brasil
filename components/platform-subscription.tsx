'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CreditCard, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { PlatformPlanPublic, PlatformSubscriptionSummary } from '@/lib/database.types';

const statusLabels: Record<PlatformSubscriptionSummary['status'], string> = {
  incomplete: 'ativação pendente',
  incomplete_expired: 'ativação expirada',
  trialing: 'teste grátis',
  active: 'ativa',
  past_due: 'pagamento pendente',
  canceled: 'cancelada',
  unpaid: 'pagamento não realizado',
  paused: 'pausada',
  exempt: 'isenta',
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function PlatformSubscription() {
  const [plans, setPlans] = useState<PlatformPlanPublic[]>([]);
  const [subscription, setSubscription] = useState<PlatformSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<number | 'portal' | null>(null);

  const load = useCallback(async () => {
    const [{ data: planData, error: planError }, { data: subscriptionData, error: subscriptionError }] = await Promise.all([
      supabase.rpc('listar_planos_plataforma_publicos'),
      supabase.rpc('obter_minha_assinatura_plataforma').maybeSingle(),
    ]);
    if (planError || subscriptionError) throw planError ?? subscriptionError;
    setPlans(planData ?? []);
    setSubscription(subscriptionData ?? null);
  }, []);

  useEffect(() => {
    void load().catch(() => toast.error('Não foi possível carregar sua assinatura.')).finally(() => setLoading(false));
  }, [load]);

  const authenticatedRequest = async (path: string, body?: object) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Entre novamente para continuar.');
    const response = await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (!response.ok || !result.url) throw new Error(result.error ?? 'Não foi possível abrir a cobrança.');
    window.location.assign(result.url);
  };

  const subscribe = async (planId: number) => {
    if (action !== null) return;
    setAction(planId);
    try { await authenticatedRequest('/api/platform/checkout', { planId }); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.'); setAction(null); }
  };

  const openPortal = async () => {
    if (action !== null) return;
    setAction('portal');
    try { await authenticatedRequest('/api/platform/portal'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível gerenciar a cobrança.'); setAction(null); }
  };

  if (loading) return <section className="h-48 animate-pulse rounded-3xl border border-amber-500/20 bg-zinc-900/70" aria-label="Carregando assinatura" />;
  if (!subscription) return null;

  const trialDays = subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : 0;
  const hasStripeSubscription = Boolean(subscription.stripe_subscription_id);

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-emerald-500/5 shadow-2xl">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/80 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300"><Sparkles size={22} /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Assinatura Sucegan Tech</p>
            <h2 className="mt-1 text-xl font-black text-white">Plano {subscription.plano_nome}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {statusLabels[subscription.status]}
              {subscription.status === 'trialing' && ` · ${trialDays} dia(s) restantes`}
              {subscription.cancel_at_period_end && ' · cancelamento programado'}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-black text-white">{money(Number(subscription.preco_mensal))}<span className="text-xs font-medium text-zinc-500">/mês</span></p>
          <p className="mt-1 text-xs text-zinc-500">Até {subscription.max_profissionais} profissionais · {subscription.max_unidades} unidade(s)</p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {hasStripeSubscription ? (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-sm text-emerald-200"><ShieldCheck size={18} /> Cobrança protegida e administrada pela Stripe.</p>
            <button type="button" onClick={() => { void openPortal(); }} disabled={action !== null} className="secondary-button">
              {action === 'portal' ? <LoaderCircle size={16} className="animate-spin" /> : <CreditCard size={16} />} Gerenciar cobrança
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
              Seu teste está ativo sem cartão. Escolha o plano antes do vencimento para continuar usando a plataforma sem interrupções; seus dados permanecem preservados.
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {plans.map((plan) => (
                <article key={plan.id} className={`rounded-2xl border p-4 ${plan.id === subscription.plano_id ? 'border-amber-400/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}>
                  <div className="flex items-center justify-between gap-2"><h3 className="font-black text-white">{plan.nome}</h3>{plan.destaque && <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-black uppercase text-emerald-300">Recomendado</span>}</div>
                  <p className="mt-2 text-lg font-black text-amber-300">{money(Number(plan.preco_mensal))}<span className="text-[10px] font-medium text-zinc-500">/mês</span></p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{plan.max_profissionais} profissionais · {plan.max_unidades} unidade(s)</p>
                  <button type="button" onClick={() => { void subscribe(plan.id); }} disabled={action !== null} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50">
                    {action === plan.id ? <LoaderCircle size={14} className="animate-spin" /> : <BadgeCheck size={14} />} Ativar {plan.nome}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
