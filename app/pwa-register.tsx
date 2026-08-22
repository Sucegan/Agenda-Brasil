'use client';

import { useEffect, useState } from 'react';

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        const watchWorker = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        };
        watchWorker(registration.installing);
        registration.addEventListener('updatefound', () => watchWorker(registration.installing));
        await registration.update();
      } catch {
        // Offline support is progressive enhancement; it must never prevent
        // the online scheduling experience from loading.
      }
    };

    if (document.readyState === 'complete') {
      void register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  if (!updateReady) return null;
  return <aside className="fixed left-3 right-3 top-[calc(12px+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-zinc-900 p-3 text-sm text-zinc-100 shadow-2xl"><span>Uma nova versão está pronta.</span><button onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Atualizar</button></aside>;
}
