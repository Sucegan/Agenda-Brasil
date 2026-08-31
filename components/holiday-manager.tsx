'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck2, CalendarX2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { brazilHolidays } from '@/lib/brazil-holidays';
import { formatDate } from '@/lib/scheduling';
import { supabase } from '@/lib/supabase';
import type { BusinessHoliday } from '@/lib/database.types';

type HolidayManagerProps = {
  barbershopId: string;
  holidays: BusinessHoliday[];
  canManage: boolean;
  onUpdated: () => Promise<void>;
};

export function HolidayManager({ barbershopId, holidays, canManage, onUpdated }: HolidayManagerProps) {
  const initialYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear);
  const [customDate, setCustomDate] = useState('');
  const [customName, setCustomName] = useState('');
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const automatic = useMemo(() => brazilHolidays(year), [year]);
  const closedByDate = useMemo(() => new Map(holidays.map((item) => [item.data, item])), [holidays]);
  const automaticDates = useMemo(() => new Set(automatic.map((item) => item.data)), [automatic]);
  const customClosed = holidays.filter((item) => item.data.startsWith(`${year}-`) && !automaticDates.has(item.data));

  const closeHoliday = async (date: string, description: string) => {
    setSavingDate(date);
    try {
      const { error } = await supabase.rpc('definir_feriado_fechado', {
        p_barbearia_id: barbershopId,
        p_data: date,
        p_descricao: description,
      });
      if (error) {
        toast.error(error.message);
        return false;
      }
      await onUpdated();
      toast.success('Data marcada como fechada.');
      return true;
    } catch (error) {
      console.error('[holidays] close failed', error);
      toast.error('Não foi possível atualizar esta data.');
      return false;
    } finally {
      setSavingDate(null);
    }
  };

  const openHoliday = async (date: string) => {
    setSavingDate(date);
    try {
      const { error } = await supabase.rpc('definir_feriado_aberto', {
        p_barbearia_id: barbershopId,
        p_data: date,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await onUpdated();
      toast.success('A agenda ficará aberta nesta data.');
    } catch (error) {
      console.error('[holidays] open failed', error);
      toast.error('Não foi possível atualizar esta data.');
    } finally {
      setSavingDate(null);
    }
  };

  const saveCustomHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customDate || customName.trim().length < 2) return toast.error('Informe a data e a descrição.');
    const saved = await closeHoliday(customDate, customName.trim());
    if (saved) {
      setCustomDate('');
      setCustomName('');
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black"><CalendarX2 className="text-orange-400" size={20} /> Feriados e funcionamento</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Os feriados nacionais e pontos facultativos aparecem automaticamente. Feche somente as datas em que a unidade não atenderá.</p>
        </div>
        <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold outline-none focus:border-orange-400">
          {[initialYear, initialYear + 1].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-2">
        {automatic.map((item) => {
          const isClosed = closedByDate.has(item.data);
          const isSaving = savingDate === item.data;
          return (
            <article key={item.data} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${isClosed ? 'border-orange-500/30 bg-orange-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
              <div className="min-w-0">
                <p className="font-bold text-zinc-100">{item.nome}</p>
                <p className="mt-1 text-xs text-zinc-500">{formatDate(item.data)} · {item.tipo === 'nacional' ? 'Feriado nacional' : 'Ponto facultativo'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`mr-auto rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isClosed ? 'bg-orange-500/20 text-orange-200' : 'bg-emerald-500/15 text-emerald-300'}`}>{isClosed ? 'Fechado' : 'Aberto'}</span>
                {canManage && <>
                  <button type="button" disabled={isSaving || !isClosed} onClick={() => { void openHoliday(item.data); }} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-35"><CalendarCheck2 className="mr-1 inline" size={14} /> Abrir</button>
                  <button type="button" disabled={isSaving || isClosed} onClick={() => { void closeHoliday(item.data, item.nome); }} className="rounded-lg border border-orange-500/30 px-3 py-2 text-xs font-bold text-orange-200 disabled:opacity-35"><CalendarX2 className="mr-1 inline" size={14} /> Fechar</button>
                </>}
              </div>
            </article>
          );
        })}
      </div>

      {canManage && <form onSubmit={saveCustomHoliday} className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 sm:grid-cols-[0.7fr_1.3fr_auto]">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Outra data<input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none focus:border-orange-400" /></label>
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Motivo<input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Ex.: aniversário da cidade" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 outline-none focus:border-orange-400" /></label>
        <button disabled={Boolean(savingDate)} className="self-end rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-50"><Plus className="mr-1 inline" size={16} /> Fechar data</button>
      </form>}

      {customClosed.length > 0 && <div className="mt-4 space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Outras datas fechadas</p>
        {customClosed.map((item) => <div key={item.data} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs"><span>{formatDate(item.data)} <b className="ml-2 text-orange-200">{item.descricao}</b></span>{canManage && <button type="button" disabled={savingDate === item.data} onClick={() => { void openHoliday(item.data); }} className="font-bold text-emerald-300">Reabrir</button>}</div>)}
      </div>}
    </section>
  );
}
