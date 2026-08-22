import type { Appointment } from '@/lib/database.types';

function escapeCsv(value: unknown) {
  const raw = String(value ?? '');
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function appointmentsCsv(appointments: Appointment[]) {
  const headers = ['Data', 'Horário', 'Cliente', 'Profissional', 'Serviço', 'Valor', 'Status', 'Sinal', 'Origem'];
  const rows = appointments.map((item) => [item.data, item.horario.slice(0, 5), item.cliente_nome, item.barbeiro_nome, item.servico_nome, item.servico_preco, item.status, item.sinal_status, item.origem]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\n')}`;
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
