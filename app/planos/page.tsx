'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { SiteRights } from '@/components/site-rights';
import { supabase } from '@/lib/supabase';
import type { PlatformPlanPublic } from '@/lib/database.types';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export default function PlansPage() {
  const [plans, setPlans] = useState<PlatformPlanPublic[]>([]);

  useEffect(() => {
    void supabase.rpc('listar_planos_plataforma_publicos').then(({ data }) => setPlans(data ?? []));
  }, []);

  return (
    <main className="app-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-black text-emerald-300"><Building2 size={20} /> Agenda Brasil</Link>
          <Link href="/" className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-emerald-500/40">Entrar</Link>
        </nav>

        <header className="mx-auto max-w-3xl py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300"><Sparkles size={14} /> 14 dias grátis · sem cartão</span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">Sua agenda cheia.<br /><span className="text-emerald-400">Sua gestão no controle.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">Agenda online, equipe, pagamentos, avaliações e financeiro em um único sistema preparado para celular e computador.</p>
          <Link href="/cadastro/estabelecimento" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white shadow-xl shadow-emerald-950/40 hover:bg-emerald-500"><BadgeCheck size={19} /> Começar teste grátis</Link>
        </header>

        <section className="grid gap-5 lg:grid-cols-3" aria-label="Planos da plataforma">
          {(plans.length ? plans : Array.from({ length: 3 }, (_, index) => ({ id: index } as PlatformPlanPublic))).map((plan) => plan.nome ? (
            <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 shadow-2xl ${plan.destaque ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/70'}`}>
              {plan.destaque && <span className="absolute right-5 top-5 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-950">Mais escolhido</span>}
              <h2 className="text-2xl font-black text-white">{plan.nome}</h2>
              <p className="mt-2 min-h-16 text-sm leading-6 text-zinc-400">{plan.descricao}</p>
              <p className="mt-5 text-4xl font-black text-white">{money(Number(plan.preco_mensal))}<span className="text-sm font-medium text-zinc-500">/mês</span></p>
              <p className="mt-2 text-xs font-bold text-amber-300">Até {plan.max_profissionais} profissionais · {plan.max_unidades} unidade(s)</p>
              <ul className="my-6 flex-1 space-y-3 text-sm text-zinc-300">{plan.recursos.map((resource) => <li key={resource} className="flex items-start gap-2"><Check className="mt-0.5 shrink-0 text-emerald-400" size={15} /> {resource}</li>)}</ul>
              <Link href="/cadastro/estabelecimento" className={`flex items-center justify-center rounded-xl px-4 py-3 text-sm font-black ${plan.destaque ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400' : 'border border-zinc-700 bg-zinc-950 text-white hover:border-emerald-500/50'}`}>Testar {plan.nome}</Link>
            </article>
          ) : <div key={plan.id} className="h-96 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/70" />)}
        </section>

        <section className="mt-10 grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:grid-cols-3">
          <p className="flex items-center gap-3 text-sm text-zinc-300"><ShieldCheck className="text-emerald-400" /> Pagamento seguro pela Stripe</p>
          <p className="flex items-center gap-3 text-sm text-zinc-300"><Check className="text-emerald-400" /> Cancele quando quiser</p>
          <p className="flex items-center gap-3 text-sm text-zinc-300"><Check className="text-emerald-400" /> Seus dados continuam seus</p>
        </section>
        <SiteRights className="mt-10 border-t border-zinc-900 pt-6" />
      </section>
    </main>
  );
}
