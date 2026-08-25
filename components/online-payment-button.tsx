'use client';

import { useState } from 'react';
import { CreditCard, LoaderCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

type Props = ({ appointmentId: number; kind?: 'sinal' | 'servico'; planId?: never } | { planId: number; appointmentId?: never; kind?: never }) & {
  className?: string;
  label?: string;
};

export function OnlinePaymentButton({ appointmentId, planId, kind, className = '', label }: Props) {
  const [loading, setLoading] = useState(false);
  const pay = async () => {
    if (loading) return;
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      return toast.error('Entre como cliente para continuar.');
    }
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(appointmentId ? { appointmentId, kind } : { planId }),
      });
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !result.url) return toast.error(result.error ?? 'Não foi possível abrir o pagamento.');
      window.location.assign(result.url);
    } catch {
      toast.error('Falha de conexão ao abrir o pagamento.');
    } finally {
      setLoading(false);
    }
  };
  return <button type="button" onClick={() => { void pay(); }} disabled={loading} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-60 ${className}`}><span>{loading ? <LoaderCircle size={14} className="animate-spin" /> : <CreditCard size={14} />}</span>{loading ? 'Abrindo...' : label ?? (planId ? 'Assinar online' : 'Pagar online')}</button>;
}
