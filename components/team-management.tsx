'use client';

import { useState } from 'react';
import { Crown, Pencil, Save, UserCog, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatWorkDays } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';
import type { Barber } from '@/lib/database.types';

type TeamManagementProps = {
  barbershopId: string;
  members: Barber[];
  isAdmin: boolean;
  onUpdated: () => Promise<void>;
  onStatusChange: (member: Barber) => Promise<unknown>;
};

export function TeamManagement({ barbershopId, members, isAdmin, onUpdated, onStatusChange }: TeamManagementProps) {
  const [editing, setEditing] = useState<Barber | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('50');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openEditor = (member: Barber) => {
    setEditing(member);
    setName(member.nome);
    setPhone(member.telefone ?? '');
    setCommission(String(member.comissao_percentual));
    setNotes(member.observacoes_gestao ?? '');
  };

  const saveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const percentage = Number(commission.replace(',', '.'));
    if (name.trim().length < 2 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return toast.error('Revise o nome e a comissão de 0% a 100%.');
    setSaving(true);
    try {
      const { error } = await supabase.rpc('atualizar_dados_profissional', {
        p_barbeiro_id: editing.id,
        p_nome: name.trim(),
        p_telefone: phone.trim(),
        p_comissao_percentual: percentage,
        p_observacoes: notes.trim(),
      });
      if (error) toast.error(error.message);
      else {
        await onUpdated();
        setEditing(null);
        toast.success('Dados profissionais atualizados.');
      }
    } catch (error) {
      console.error('[team] update failed', error);
      toast.error('Não foi possível atualizar o profissional.');
    } finally {
      setSaving(false);
    }
  };

  const assignOwner = async () => {
    if (!editing || !window.confirm(`Definir “${editing.nome}” como proprietário desta unidade?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('definir_proprietario_barbearia', {
        p_barbearia_id: barbershopId,
        p_barbeiro_id: editing.id,
      });
      if (error) toast.error(error.message);
      else {
        await onUpdated();
        setEditing(null);
        toast.success('Proprietário definido e separado do administrador da plataforma.');
      }
    } catch (error) {
      console.error('[team] owner assignment failed', error);
      toast.error('Não foi possível definir o proprietário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel-card p-5">
      <div className="mb-4"><h2 className="flex items-center gap-2 text-lg font-black"><UserCog size={20} className="text-blue-300" /> Equipe do estabelecimento</h2><p className="mt-1 text-xs text-zinc-500">O proprietário gerencia comissão e dados da equipe. O administrador da plataforma nunca aparece como profissional.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => <article key={member.id} className={`rounded-2xl border p-4 ${member.ativo === false ? 'border-zinc-800 bg-zinc-950/45 opacity-70' : member.funcao === 'proprietario' ? 'border-amber-500/25 bg-amber-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
          <div className="flex items-start justify-between gap-3"><div><p className="font-black">{member.nome}</p><p className="mt-1 text-xs text-zinc-500">{formatWorkDays(member.dias_trabalho)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${member.funcao === 'proprietario' ? 'bg-amber-500/15 text-amber-200' : 'bg-blue-500/15 text-blue-200'}`}>{member.funcao === 'proprietario' ? 'Proprietário' : 'Funcionário'}</span></div>
          <div className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 text-xs"><span className="text-zinc-500">Comissão profissional</span><b className="ml-2 text-emerald-300">{Number(member.comissao_percentual).toFixed(2).replace('.', ',')}%</b></div>
          <div className="mt-4 flex gap-2"><button type="button" onClick={() => openEditor(member)} className="secondary-button flex-1"><Pencil className="mr-1 inline" size={14} /> Gerenciar</button><button type="button" disabled={member.funcao === 'proprietario' && member.ativo} title={member.funcao === 'proprietario' && member.ativo ? 'Transfira a propriedade antes de desativar.' : undefined} onClick={() => { void onStatusChange(member); }} className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35 ${member.ativo === false ? 'border-emerald-500/25 text-emerald-300' : 'border-red-500/25 text-red-300'}`}>{member.ativo === false ? 'Reativar' : 'Desativar'}</button></div>
        </article>)}
      </div>

      {editing && <form onSubmit={saveMember} className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-black text-white">Gerenciar {editing.nome}</h3><p className="mt-1 text-xs text-zinc-500">Dados operacionais e divisão financeira deste profissional.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-zinc-700 p-2 text-zinc-400" aria-label="Fechar gestão"><X size={16} /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nome profissional<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-400" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-400" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Comissão do profissional (%)<input type="number" min="0" max="100" step="0.01" value={commission} onChange={(event) => setCommission(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-400" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Parte da barbearia<input readOnly value={`${Math.max(0, 100 - Number(commission || 0)).toFixed(2).replace('.', ',')}%`} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 sm:col-span-2">Observações internas<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none focus:border-violet-400" /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} className="primary-button flex-1"><Save className="mr-1 inline" size={16} /> Salvar gestão</button>{isAdmin && editing.funcao !== 'proprietario' && <button type="button" disabled={saving || !editing.ativo} onClick={() => { void assignOwner(); }} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-40"><Crown className="mr-1 inline" size={16} /> Tornar proprietário</button>}</div>
      </form>}
    </section>
  );
}
