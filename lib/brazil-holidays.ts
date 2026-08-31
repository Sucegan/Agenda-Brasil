export type BrazilHolidayKind = 'nacional' | 'ponto_facultativo';

export type BrazilHoliday = {
  data: string;
  nome: string;
  tipo: BrazilHolidayKind;
};

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const shiftIsoDate = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

// Gregorian Easter calculation (Meeus/Jones/Butcher). Movable holidays are
// derived locally so the agenda does not depend on an external API to load.
export function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

export function brazilHolidays(year: number): BrazilHoliday[] {
  const easter = easterSunday(year);
  const holidays: BrazilHoliday[] = [
    { data: isoDate(year, 1, 1), nome: 'Confraternização Universal', tipo: 'nacional' },
    { data: shiftIsoDate(easter, -48), nome: 'Carnaval (segunda-feira)', tipo: 'ponto_facultativo' },
    { data: shiftIsoDate(easter, -47), nome: 'Carnaval (terça-feira)', tipo: 'ponto_facultativo' },
    { data: shiftIsoDate(easter, -2), nome: 'Paixão de Cristo', tipo: 'nacional' },
    { data: isoDate(year, 4, 21), nome: 'Tiradentes', tipo: 'nacional' },
    { data: isoDate(year, 5, 1), nome: 'Dia Mundial do Trabalho', tipo: 'nacional' },
    { data: shiftIsoDate(easter, 60), nome: 'Corpus Christi', tipo: 'ponto_facultativo' },
    { data: isoDate(year, 9, 7), nome: 'Independência do Brasil', tipo: 'nacional' },
    { data: isoDate(year, 10, 12), nome: 'Nossa Senhora Aparecida', tipo: 'nacional' },
    { data: isoDate(year, 11, 2), nome: 'Finados', tipo: 'nacional' },
    { data: isoDate(year, 11, 15), nome: 'Proclamação da República', tipo: 'nacional' },
    { data: isoDate(year, 11, 20), nome: 'Dia Nacional de Zumbi e da Consciência Negra', tipo: 'nacional' },
    { data: isoDate(year, 12, 25), nome: 'Natal', tipo: 'nacional' },
  ];
  return holidays.sort((left, right) => left.data.localeCompare(right.data));
}
