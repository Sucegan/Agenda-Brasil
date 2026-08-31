'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Mail, MessageCircle, ShieldCheck, Users } from 'lucide-react';
import { SiteRights } from '@/components/site-rights';
import { supabase } from '@/lib/supabase';

const fallbackEmail = 'sucegantech@gmail.com';

export function BusinessContact() {
  const [supportEmail, setSupportEmail] = useState(fallbackEmail);

  useEffect(() => {
    let active = true;
    void supabase.rpc('obter_configuracao_publica').then(({ data }) => {
      if (active && data?.email_suporte) setSupportEmail(data.email_suporte);
    });
    return () => { active = false; };
  }, []);

  const subject = encodeURIComponent('Quero contratar a Agenda Brasil');
  const body = encodeURIComponent('Olá, Sucegan Tech! Quero conhecer os planos e cadastrar meu estabelecimento na Agenda Brasil.');

  return (
    <main className="app-screen safe-page-bottom bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6">
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-amber-500/20 bg-zinc-900/80 shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-gradient-to-br from-amber-500/15 via-zinc-950 to-emerald-500/10 p-7 sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200"><BadgeCheck size={15} /> Contratação assistida</span>
          <h1 className="mt-6 text-3xl font-black leading-tight sm:text-4xl">Leve a Agenda Brasil para o seu negócio.</h1>
          <p className="mt-4 leading-7 text-zinc-400">A Sucegan Tech cria sua unidade com segurança, configura o proprietário e libera o convite para os profissionais. Não existe cadastro automático de novas barbearias.</p>
          <div className="mt-7 space-y-3 text-sm text-zinc-300"><p className="flex gap-2"><ShieldCheck className="shrink-0 text-emerald-400" size={18} /> Administrador da plataforma separado da equipe.</p><p className="flex gap-2"><Users className="shrink-0 text-emerald-400" size={18} /> Proprietário gerencia funcionários, comissões e unidade.</p><p className="flex gap-2"><MessageCircle className="shrink-0 text-emerald-400" size={18} /> Implantação acompanhada até o primeiro agendamento.</p></div>
        </aside>
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Fale com o responsável pelo site</p>
          <h2 className="mt-3 text-2xl font-black">Solicite uma demonstração</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Envie uma mensagem informando o nome do estabelecimento, cidade e quantidade de profissionais. A Sucegan Tech retornará com os próximos passos e o plano adequado.</p>
          <a href={`mailto:${supportEmail}?subject=${subject}&body=${body}`} className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 font-black text-zinc-950 hover:bg-emerald-400"><Mail size={18} /> Quero contratar</a>
          <p className="mt-3 text-center text-xs text-zinc-500">Contato: <a className="font-bold text-zinc-300 hover:text-white" href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
          <Link href="/" className="mt-7 inline-flex items-center justify-center gap-2 text-sm font-bold text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Voltar para entrar</Link>
        </div>
      </section>
      <SiteRights className="mx-auto mt-6 max-w-5xl" />
    </main>
  );
}
