import assert from 'node:assert/strict';
import test from 'node:test';
import { brazilHolidays, easterSunday } from '@/lib/brazil-holidays';

test('calcula corretamente a Páscoa e os feriados móveis de 2026', () => {
  assert.equal(easterSunday(2026), '2026-04-05');
  const holidays = brazilHolidays(2026);
  assert.equal(holidays.find((item) => item.data === '2026-02-16')?.nome, 'Carnaval (segunda-feira)');
  assert.equal(holidays.find((item) => item.data === '2026-04-03')?.nome, 'Paixão de Cristo');
  assert.equal(holidays.find((item) => item.data === '2026-06-04')?.nome, 'Corpus Christi');
});

test('inclui os feriados nacionais fixos e não repete datas', () => {
  const holidays = brazilHolidays(2027);
  assert.ok(holidays.some((item) => item.data === '2027-01-01'));
  assert.ok(holidays.some((item) => item.data === '2027-11-20'));
  assert.ok(holidays.some((item) => item.data === '2027-12-25'));
  assert.equal(new Set(holidays.map((item) => item.data)).size, holidays.length);
});
