import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appointmentsCsv } from '../lib/export';
import type { Appointment } from '../lib/database.types';

const appointment: Appointment = {
  id: 1,
  data: '2026-08-21',
  horario: '14:30:00',
  status: 'concluido',
  cliente_id: 1,
  barbeiro_id: 2,
  servico_id: 3,
  servico_nome: 'Corte; barba',
  servico_preco: 60,
  servico_duracao: 45,
  barbeiro_nome: 'João',
  cliente_nome: '=HYPERLINK("https://example.com")',
  cliente_telefone: '11999999999',
  created_at: '2026-08-20T12:00:00Z',
  cancelado_at: null,
  origem: 'painel',
  sinal_valor: 10,
  sinal_status: 'pago',
  cancelamento_tardio: false,
  public_token: '00000000-0000-0000-0000-000000000000',
  pontos_creditados: true,
};

test('appointmentsCsv creates a UTF-8 spreadsheet with stable columns', () => {
  const csv = appointmentsCsv([appointment]);
  assert.ok(csv.startsWith('\uFEFFData;Horário;Cliente'));
  assert.match(csv, /"Corte; barba"/);
  assert.match(csv, /;pago;painel/);
});

test('appointmentsCsv neutralizes spreadsheet formulas from user input', () => {
  const csv = appointmentsCsv([appointment]);
  assert.match(csv, /'\=HYPERLINK/);
});
