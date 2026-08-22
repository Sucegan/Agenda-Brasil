'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BellRing, Download, Shield, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { appointmentsCsv, downloadFile } from '@/lib/export';
import type { Appointment, UserProfile } from '@/lib/database.types';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function CommunicationPreferences({ user, appointments, onUpdated }: { user: UserProfile; appointments: Appointment[]; onUpdated: () => Promise<void> }) {
  const [email, setEmail] = useState(user.lembretes_email);
  const [whatsapp, setWhatsapp] = useState(user.lembretes_whatsapp);
  const [push, setPush] = useState(user.lembretes_push);
  const [marketing, setMarketing] = useState(user.marketing_opt_in);
  const [saving, setSaving] = useState(false);

  const enablePush = async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) throw new Error('A chave pública de notificações ainda não foi configurada.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador não oferece notificações push.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida.');
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('A assinatura de notificação ficou incompleta.');
    const { error } = await supabase.from('push_subscriptions').upsert({
      usuario_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  };

  const save = async () => {
    setSaving(true);
    try {
      if (push && !user.lembretes_push) await enablePush();
      const { error } = await supabase.rpc('atualizar_preferencias_comunicacao', { p_email: email, p_whatsapp: whatsapp, p_push: push, p_marketing: marketing });
      if (error) throw error;
      await onUpdated();
      toast.success('Preferências atualizadas.');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Não foi possível salvar as preferências.');
    } finally { setSaving(false); }
  };

  const exportData = () => {
    const data = { exported_at: new Date().toISOString(), profile: user, appointments };
    downloadFile('meus-dados-agenda-brasil.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    downloadFile('meus-agendamentos.csv', appointmentsCsv(appointments), 'text/csv;charset=utf-8');
    toast.success('Seus dados foram exportados.');
  };

  const requestDeletion = async () => {
    if (window.prompt('Esta ação é permanente. Digite EXCLUIR para continuar.') !== 'EXCLUIR') return;
    const { error: requestError } = await supabase.rpc('solicitar_exclusao_conta');
    if (requestError) return toast.error(requestError.message);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` } });
    if (response.status === 204) {
      await supabase.auth.signOut();
      window.location.replace('/');
      return;
    }
    toast.success('Solicitação de exclusão registrada. O responsável concluirá o processo.');
  };

  const Toggle = ({ label, checked, setChecked }: { label: string; checked: boolean; setChecked: (value: boolean) => void }) => <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="h-5 w-5 accent-emerald-500" /></label>;

  return <section className="mt-5 border-t border-zinc-800 pt-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><BellRing className="text-emerald-400" size={17} /> Comunicações e privacidade</h3><div className="grid gap-2 sm:grid-cols-2"><Toggle label="Lembretes por e-mail" checked={email} setChecked={setEmail} /><Toggle label="Lembretes por WhatsApp" checked={whatsapp} setChecked={setWhatsapp} /><Toggle label="Notificações no aparelho" checked={push} setChecked={setPush} /><Toggle label="Novidades e promoções" checked={marketing} setChecked={setMarketing} /></div><button onClick={() => { void save(); }} disabled={saving} className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar preferências'}</button><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={exportData} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 p-3 text-xs font-bold"><Download size={15} /> Exportar meus dados</button><button onClick={() => { void requestDeletion(); }} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/25 p-3 text-xs font-bold text-red-300"><Trash2 size={15} /> Solicitar exclusão</button></div><p className="mt-3 flex items-center gap-1 text-[11px] text-zinc-500"><Shield size={13} /> Consulte nossa <Link href="/privacidade" className="text-emerald-400 underline">política de privacidade</Link>.</p></section>;
}
