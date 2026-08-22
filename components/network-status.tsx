'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (online) return null;
  return <div className="fixed left-3 right-3 top-[calc(12px+env(safe-area-inset-top))] z-[70] mx-auto flex max-w-sm items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950 px-4 py-3 text-sm font-bold text-amber-100 shadow-2xl"><WifiOff size={16} /> Sem conexão. Exibindo dados já carregados.</div>;
}
