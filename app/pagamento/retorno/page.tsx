'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { SiteRights } from '@/components/site-rights';
import { supabase } from '@/lib/supabase';

export default function PaymentReturnPage() {
  const [state, setState] = useState<'checking' | 'paid' | 'pending' | 'error'>('checking');
  const [message, setMessage] = useState('Confirmando seu pagamento com segurança...');

  useEffect(() => {
    let active = true;
    void (async () => {
      const sessionId = new URLSearchParams(window.location.search).get('session_id');
      const { data } = await supabase.auth.getSession();
      if (!sessionId || !data.session?.access_token) {
        if (active) { setState('error'); setMessage('Abra esta página usando a mesma conta que iniciou o pagamento.'); }
        return;
      }
      try {
        const response = await fetch('/api/payments/status', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ sessionId }) });
        const result = await response.json().catch(() => ({})) as { paid?: boolean; error?: string };
        if (!active) return;
        if (!response.ok) { setState('error'); setMessage(result.error ?? 'Não foi possível confirmar o pagamento.'); }
        else if (result.paid) { setState('paid'); setMessage('Pagamento confirmado e registrado no estabelecimento.'); }
        else { setState('pending'); setMessage('O pagamento ainda está sendo processado. Atualize esta página em alguns instantes.'); }
      } catch {
        if (active) { setState('error'); setMessage('A conexão falhou durante a confirmação. O pagamento não será duplicado.'); }
      }
    })();
    return () => { active = false; };
  }, []);

  return <main className="app-screen app-shell flex items-center justify-center p-4 text-zinc-100"><section className="panel-card w-full max-w-lg p-6 text-center sm:p-8">{state === 'checking' ? <LoaderCircle className="mx-auto animate-spin text-blue-300" size={46} /> : state === 'paid' ? <CheckCircle2 className="mx-auto text-emerald-300" size={50} /> : <TriangleAlert className={`mx-auto ${state === 'pending' ? 'text-amber-300' : 'text-red-300'}`} size={50} />}<h1 className="mt-5 text-2xl font-black">{state === 'checking' ? 'Verificando' : state === 'paid' ? 'Pagamento aprovado' : state === 'pending' ? 'Pagamento em processamento' : 'Não foi possível confirmar'}</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p><Link href="/dashboard" className="primary-button mt-6 w-full">Voltar ao painel</Link><SiteRights className="mt-7 border-t border-zinc-800 pt-5" /></section></main>;
}
