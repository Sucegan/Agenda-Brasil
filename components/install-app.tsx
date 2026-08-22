'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || localStorage.getItem('agenda-install-dismissed') === '1') return;
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); setDismissed(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setDismissed(false);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed) return null;
  const dismiss = () => { localStorage.setItem('agenda-install-dismissed', '1'); setDismissed(true); };
  const install = async () => {
    if (!prompt) return setShowIosHelp(true);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setDismissed(true);
    setPrompt(null);
  };

  return (
    <aside className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-3 right-3 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-900 p-4 text-zinc-100 shadow-2xl" aria-label="Instalar aplicativo">
      <button onClick={dismiss} className="absolute right-2 top-2 rounded-lg p-2 text-zinc-500 hover:text-white" aria-label="Fechar"><X size={16} /></button>
      <div className="flex items-start gap-3"><span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400"><Download size={20} /></span><div className="pr-6"><b className="block text-sm">Instale a Agenda Brasil</b><p className="mt-1 text-xs text-zinc-400">Acesso rápido e experiência de aplicativo no celular.</p></div></div>
      {showIosHelp ? <p className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300"><Share2 className="mr-1 inline" size={14} /> No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p> : <button onClick={() => { void install(); }} className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white">Instalar</button>}
    </aside>
  );
}
