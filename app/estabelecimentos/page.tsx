'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Search, Star, Users } from 'lucide-react';
import { BusinessBrandIcon, businessBrandStyle } from '@/components/business-brand';
import { SiteRights } from '@/components/site-rights';
import type { PlatformPublicSettings, PublicEstablishment } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export default function EstablishmentsPage() {
  const [establishments, setEstablishments] = useState<PublicEstablishment[]>([]);
  const [platform, setPlatform] = useState<PlatformPublicSettings | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.rpc('listar_estabelecimentos_publicos'),
      supabase.rpc('obter_configuracao_publica'),
    ]).then(([shopsResult, platformResult]) => {
      if (!active) return;
      setLoading(false);
      if (shopsResult.error) {
        setError('Não foi possível carregar os estabelecimentos agora.');
        return;
      }
      setEstablishments(shopsResult.data ?? []);
      setPlatform(platformResult.data ?? null);
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return establishments;
    return establishments.filter((shop) => `${shop.nome} ${shop.endereco ?? ''}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [establishments, search]);

  return (
    <main className="app-screen app-shell safe-page-bottom text-zinc-100">
      <header className="safe-header sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">{platform?.nome_site ?? 'Agenda Brasil'}</p><h1 className="text-xl font-black sm:text-2xl">Onde você quer agendar?</h1></div><Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300"><ArrowLeft size={15} /> Voltar</Link></div>
      </header>
      <section className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="brand-surface panel-card overflow-hidden p-5 sm:p-7"><div className="max-w-2xl"><p className="text-sm leading-6 text-zinc-400">{platform?.subtitulo ?? 'Escolha um estabelecimento, conheça a equipe e reserve um horário disponível em tempo real.'}</p><label className="relative mt-5 block"><span className="sr-only">Buscar estabelecimento</span><Search className="absolute left-4 top-3.5 text-zinc-600" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou endereço" className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-500" /></label></div></div>

        {platform?.aviso_global && <p role="status" className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">{platform.aviso_global}</p>}
        {loading && <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-zinc-900" />)}</div>}
        {error && <p className="mt-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-red-200">{error}</p>}
        {!loading && !error && <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((shop) => <article key={shop.id} className="brand-surface panel-card flex flex-col p-5" style={businessBrandStyle(shop.cor_primaria, shop.cor_secundaria)}><div className="flex items-start justify-between gap-3"><span className="brand-icon"><BusinessBrandIcon icon={shop.icone} size={24} /></span><span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-200"><Star size={13} className="fill-current" /> {Number(shop.avaliacao_media).toFixed(1)}</span></div><h2 className="mt-5 text-xl font-black">{shop.nome}</h2><div className="mt-3 flex-1 space-y-2 text-xs text-zinc-500">{shop.endereco && <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" /> {shop.endereco}</p>}<p className="flex items-center gap-2"><Users size={14} /> {shop.profissionais} profissional(is)</p></div><Link href={`/agendar?estabelecimento=${encodeURIComponent(shop.slug)}`} className="primary-button mt-5 w-full">Ver agenda e serviços</Link></article>)}</div>}
        {!loading && !error && filtered.length === 0 && <p className="mt-5 rounded-3xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">Nenhum estabelecimento encontrado.</p>}
        <SiteRights className="mt-8 border-t border-zinc-900 pt-5" />
      </section>
    </main>
  );
}
