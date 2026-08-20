'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [status, setStatus] = useState('Verificando conexão...');

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('servicos').select('*');
      if (error) {
        setStatus(`Erro na conexão: ${error.message}`);
      } else {
        setStatus('Conexão com Supabase estabelecida com sucesso!');
      }
    }
    testConnection();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white">
      <h1 className="text-4xl font-bold mb-4">Agenda Brasil</h1>
      <p className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">{status}</p>
    </main>
  );
}