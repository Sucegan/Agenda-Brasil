'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import type { PlatformPublicSettings } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export function PlatformNotice() {
  const [settings, setSettings] = useState<PlatformPublicSettings | null>(null);
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('obter_configuracao_publica');
    if (data) setSettings(data);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (!settings) return null;
  const message = settings.modo_manutencao
    ? settings.aviso_global || 'Estamos realizando uma manutenção programada. Algumas ações podem ficar temporariamente indisponíveis.'
    : settings.aviso_global;
  if (!message || (!settings.modo_manutencao && dismissedNotice === message)) return null;

  return (
    <aside role="status" aria-live="polite" className={`fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${settings.modo_manutencao ? 'border-amber-500/40 bg-amber-950/95 text-amber-100' : 'border-blue-500/35 bg-blue-950/95 text-blue-100'}`}>
      {settings.modo_manutencao ? <AlertTriangle className="mt-0.5 shrink-0" size={19} /> : <Info className="mt-0.5 shrink-0" size={19} />}
      <div className="min-w-0 flex-1"><b className="block text-sm">{settings.modo_manutencao ? 'Manutenção em andamento' : settings.nome_site}</b><p className="mt-0.5 text-xs leading-5 opacity-90">{message}</p></div>
      {!settings.modo_manutencao && <button type="button" onClick={() => setDismissedNotice(message)} className="rounded-lg p-1 opacity-70 hover:bg-white/10 hover:opacity-100" aria-label="Fechar aviso"><X size={17} /></button>}
    </aside>
  );
}
