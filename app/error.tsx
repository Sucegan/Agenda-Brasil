'use client';

import { useEffect } from 'react';
import { CircleX } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/observability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ tipo: 'erro_cliente', rota: window.location.pathname, mensagem: error.message, contexto: { digest: error.digest, stack: error.stack } }),
    });
  }, [error]);

  return <main className="app-screen flex items-center justify-center bg-zinc-950 p-4 text-zinc-100"><section className="w-full max-w-md rounded-2xl border border-red-500/20 bg-zinc-900 p-6 text-center"><CircleX className="mx-auto text-red-400" size={36} /><h1 className="mt-4 text-xl font-black">Algo deu errado</h1><p className="mt-2 text-sm text-zinc-400">O problema foi registrado. Tente carregar esta parte novamente.</p><button onClick={reset} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Tentar novamente</button></section></main>;
}
