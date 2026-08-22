'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="pt-BR"><body className="bg-zinc-950 text-zinc-100"><main className="flex min-h-screen items-center justify-center p-4"><section className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center"><h1 className="text-xl font-black">Não foi possível abrir a Agenda Brasil</h1><p className="mt-2 text-sm text-zinc-400">Verifique sua conexão e tente novamente.</p><button onClick={reset} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Recarregar</button></section></main></body></html>;
}
