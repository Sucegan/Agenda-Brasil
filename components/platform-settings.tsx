'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe2, Save, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type PlatformSettingsRow = Database['public']['Tables']['configuracoes_plataforma']['Row'];

export function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('configuracoes_plataforma').select('*').eq('id', true).single();
    setLoading(false);
    if (error) return toast.error('Não foi possível carregar as configurações da plataforma.');
    setSettings(data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings || settings.nome_site.trim().length < 2 || settings.nome_direitos.trim().length < 2) return toast.error('Informe o nome do site e o titular dos direitos.');
    if (!Number.isFinite(Number(settings.taxa_plataforma_percentual)) || Number(settings.taxa_plataforma_percentual) < 0 || Number(settings.taxa_plataforma_percentual) > 30) return toast.error('A taxa da plataforma deve ficar entre 0% e 30%.');
    const { data: userData } = await supabase.auth.getUser();
    setSaving(true);
    const { error } = await supabase.from('configuracoes_plataforma').update({
      nome_site: settings.nome_site.trim(),
      subtitulo: settings.subtitulo.trim(),
      nome_direitos: settings.nome_direitos.trim(),
      email_suporte: settings.email_suporte?.trim().toLowerCase() || null,
      aviso_global: settings.aviso_global?.trim() || null,
      modo_manutencao: settings.modo_manutencao,
      taxa_plataforma_percentual: Number(settings.taxa_plataforma_percentual),
      updated_at: new Date().toISOString(),
      updated_by: userData.user?.id ?? null,
    }).eq('id', true);
    setSaving(false);
    if (error) return toast.error(error.message ?? 'Não foi possível salvar a plataforma.');
    await load();
    toast.success('Configurações globais atualizadas.');
  };

  if (loading || !settings) return <div className="h-52 animate-pulse rounded-2xl bg-zinc-800/60" />;
  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-500';

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-start gap-3"><span className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-2.5 text-violet-200"><Globe2 size={20} /></span><div><h3 className="font-black">Identidade da plataforma</h3><p className="mt-1 text-sm text-zinc-500">Esses dados valem para todas as unidades. A identidade de cada estabelecimento é configurada separadamente.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-zinc-400">NOME DO SITE<input value={settings.nome_site} onChange={(event) => setSettings({ ...settings, nome_site: event.target.value })} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">TITULAR DOS DIREITOS<input value={settings.nome_direitos} onChange={(event) => setSettings({ ...settings, nome_direitos: event.target.value })} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">SUBTÍTULO<input value={settings.subtitulo} onChange={(event) => setSettings({ ...settings, subtitulo: event.target.value })} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">E-MAIL DE SUPORTE<input type="email" value={settings.email_suporte ?? ''} onChange={(event) => setSettings({ ...settings, email_suporte: event.target.value || null })} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400">TAXA DA PLATAFORMA (%)<input type="number" min="0" max="30" step="0.01" value={settings.taxa_plataforma_percentual} onChange={(event) => setSettings({ ...settings, taxa_plataforma_percentual: Number(event.target.value) })} className={inputClass} /></label><label className="text-xs font-bold text-zinc-400 sm:col-span-2">AVISO GLOBAL<input value={settings.aviso_global ?? ''} maxLength={240} onChange={(event) => setSettings({ ...settings, aviso_global: event.target.value || null })} placeholder="Opcional" className={inputClass} /></label></div>
      </div>
      <label className="flex items-start justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><span><b className="flex items-center gap-2 text-amber-200"><ShieldAlert size={17} /> Modo de manutenção</b><small className="mt-1 block leading-5 text-zinc-500">Prepare o aviso global. A ativação completa deve ser usada somente durante intervenções técnicas.</small></span><input type="checkbox" checked={settings.modo_manutencao} onChange={(event) => setSettings({ ...settings, modo_manutencao: event.target.checked })} className="mt-1 h-5 w-5 accent-violet-500" /></label>
      <button disabled={saving} className="primary-button w-full !bg-violet-600"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar plataforma'}</button>
    </form>
  );
}
