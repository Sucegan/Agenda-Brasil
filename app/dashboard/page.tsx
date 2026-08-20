'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    getUserData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="text-zinc-400">Carregando painel...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Agenda Brasil</h1>
          <p className="text-sm text-zinc-400">
            Bem-vindo, {user?.user_metadata?.nome || user?.email}!
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Sair
        </button>
      </header>

      <section className="mx-auto mt-8 max-w-4xl">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-emerald-400">Painel Principal</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Sua conta está autenticada com sucesso como: <span className="font-semibold text-white">{user?.user_metadata?.tipo || 'Cliente'}</span>.
          </p>
        </div>
      </section>
    </main>
  );
}