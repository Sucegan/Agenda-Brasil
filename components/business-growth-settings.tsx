'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, Copy, CreditCard, Link2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BusinessSettings } from '@/lib/database.types';

async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); return true; } catch { return false; }
}

export function BusinessGrowthSettings({ business, onUpdated }: { business: BusinessSettings; onUpdated: () => Promise<void> }) {
  const [slug, setSlug] = useState(business.slug);
  const [publicBooking, setPublicBooking] = useState(business.agendamento_publico);
  const [cancellationHours, setCancellationHours] = useState(String(business.cancelamento_horas));
  const [deposit, setDeposit] = useState(String(business.sinal_percentual));
  const [pixKey, setPixKey] = useState(business.pix_chave ?? '');
  const [pixOwner, setPixOwner] = useState(business.pix_beneficiario ?? '');
  const [email, setEmail] = useState(business.lembrete_email);
  const [whatsapp, setWhatsapp] = useState(business.lembrete_whatsapp);
  const [push, setPush] = useState(business.lembrete_push);
  const [noShows, setNoShows] = useState(String(business.bloquear_apos_faltas));
  const [blockDays, setBlockDays] = useState(String(business.dias_bloqueio));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSlug(business.slug); }, [business.slug]);
  const publicUrl = typeof window === 'undefined' ? `/agendar?estabelecimento=${slug}` : `${window.location.origin}/agendar?estabelecimento=${slug}`;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('atualizar_configuracoes_avancadas', {
      p_slug: slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      p_agendamento_publico: publicBooking,
      p_cancelamento_horas: Number(cancellationHours),
      p_sinal_percentual: Number(deposit),
      p_pix_chave: pixKey,
      p_pix_beneficiario: pixOwner,
      p_lembrete_email: email,
      p_lembrete_whatsapp: whatsapp,
      p_lembrete_push: push,
      p_bloquear_apos_faltas: Number(noShows),
      p_dias_bloqueio: Number(blockDays),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    await onUpdated();
    toast.success('Regras da agenda atualizadas.');
  };

  const Toggle = ({ label, checked, update }: { label: string; checked: boolean; update: (value: boolean) => void }) => <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => update(event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>;
  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-emerald-500';

  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="text-emerald-400" size={20} /> Regras, automações e crescimento</h2><p className="mt-1 text-sm text-zinc-500">Configure o link público, cancelamento, sinal, faltas e canais automáticos.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400">IDENTIFICADOR DO LINK<input value={slug} onChange={(event) => setSlug(event.target.value)} className={inputClass} /></label><div className="flex items-end"><button onClick={async () => { const done = await copy(publicUrl); toast[done ? 'success' : 'error'](done ? 'Link público copiado.' : 'Não foi possível copiar.'); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300"><Copy size={16} /> Copiar link de agendamento</button></div><Toggle label="Aceitar agendamento público" checked={publicBooking} update={setPublicBooking} /><Toggle label="Lembretes por e-mail" checked={email} update={setEmail} /><Toggle label="Lembretes por WhatsApp" checked={whatsapp} update={setWhatsapp} /><Toggle label="Notificações push" checked={push} update={setPush} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-bold text-zinc-400">CANCELAMENTO MÍNIMO (H)<input type="number" min="0" max="168" value={cancellationHours} onChange={(event) => setCancellationHours(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">SINAL (%)<input type="number" min="0" max="100" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">BLOQUEAR APÓS FALTAS<input type="number" min="0" max="20" value={noShows} onChange={(event) => setNoShows(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">DIAS DE BLOQUEIO<input type="number" min="1" max="365" value={blockDays} onChange={(event) => setBlockDays(event.target.value)} className={inputClass} /></label></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400"><CreditCard className="mr-1 inline" size={14} /> CHAVE PIX<input value={pixKey} onChange={(event) => setPixKey(event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">BENEFICIÁRIO PIX<input value={pixOwner} onChange={(event) => setPixOwner(event.target.value)} className={inputClass} /></label></div><button onClick={() => { void save(); }} disabled={saving} className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar regras'}</button><div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3"><span className="flex items-center gap-1"><Link2 size={13} /> Link mágico sem senha</span><span className="flex items-center gap-1"><BellRing size={13} /> Fila automática criada</span><span className="flex items-center gap-1"><CreditCard size={13} /> Pix depende de confirmação</span></div></section>;
}
