'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Download, Printer, TrendingUp } from 'lucide-react';
import { appointmentsCsv, downloadFile } from '@/lib/export';
import { formatCurrency } from '@/lib/scheduling';
import type { Appointment } from '@/lib/database.types';

export function ReportTools({ appointments }: { appointments: Appointment[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(today);
  const filtered = useMemo(() => appointments.filter((item) => item.data >= start && item.data <= end), [appointments, end, start]);
  const completed = filtered.filter((item) => item.status === 'concluido');
  const revenue = completed.reduce((total, item) => total + Number(item.servico_preco ?? 0), 0);
  const cancellationRate = filtered.length ? Math.round(filtered.filter((item) => item.status === 'cancelado').length / filtered.length * 100) : 0;
  const noShowRate = filtered.length ? Math.round(filtered.filter((item) => item.status === 'nao_compareceu').length / filtered.length * 100) : 0;
  const byDay = useMemo(() => completed.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.data]: (acc[item.data] ?? 0) + Number(item.servico_preco ?? 0) }), {}), [completed]);
  const topDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const max = Math.max(...topDays.map(([, value]) => value), 1);

  return <section className="print-report rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="flex items-center gap-2 text-lg font-black"><BarChart3 className="text-amber-400" size={20} /> Relatório detalhado</h2><p className="mt-1 text-xs text-zinc-500">Filtre, compare e exporte os resultados.</p></div><div className="flex gap-2"><button onClick={() => downloadFile(`relatorio-${start}-${end}.csv`, appointmentsCsv(filtered), 'text/csv;charset=utf-8')} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold"><Download size={14} /> CSV</button><button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold"><Printer size={14} /> PDF</button></div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="text-xs font-bold text-zinc-400">DE<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2" /></label><label className="text-xs font-bold text-zinc-400">ATÉ<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2" /></label><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"><small className="text-zinc-400">Receita</small><b className="block text-emerald-300">{formatCurrency(revenue)}</b></div><div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3"><small className="text-zinc-400">Atendimentos</small><b className="block text-blue-300">{completed.length}</b></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-zinc-950/60 p-3 text-sm"><span className="text-zinc-500">Ticket médio</span><b className="block">{formatCurrency(completed.length ? revenue / completed.length : 0)}</b></div><div className="rounded-xl bg-zinc-950/60 p-3 text-sm"><span className="text-zinc-500">Cancelamentos</span><b className="block text-red-300">{cancellationRate}%</b></div><div className="rounded-xl bg-zinc-950/60 p-3 text-sm"><span className="text-zinc-500">Faltas</span><b className="block text-orange-300">{noShowRate}%</b></div></div>{topDays.length > 0 && <div className="mt-5"><p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><TrendingUp size={15} /> Receita diária</p><div className="flex h-36 items-end gap-1.5 overflow-x-auto">{topDays.map(([day, value]) => <div key={day} className="flex h-full min-w-7 flex-1 flex-col justify-end" title={`${day}: ${formatCurrency(value)}`}><div className="rounded-t bg-gradient-to-t from-emerald-700 to-emerald-400" style={{ height: `${Math.max(value / max * 100, 4)}%` }} /><span className="mt-1 text-center text-[8px] text-zinc-600">{day.slice(8)}</span></div>)}</div></div>}</section>;
}
