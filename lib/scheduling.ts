import type { AppointmentStatus, BusinessDay } from "@/lib/database.types";

export const weekdayLabels: Record<BusinessDay, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
};

export function formatWorkDays(days: BusinessDay[]) {
  const orderedDays = [...days].sort((first, second) => first - second);
  if (orderedDays.length === 6 && !orderedDays.includes(0)) return "Segunda a sábado";
  if (orderedDays.length === 7) return "Todos os dias";
  return orderedDays.map((day) => weekdayLabels[day]).join(", ");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function brazilDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return { year: Number(getPart("year")), month: Number(getPart("month")), day: Number(getPart("day")) };
}

export function brazilDateISO(date = new Date()) {
  const { year, month, day } = brazilDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type DayChoice = { iso: string; day: number; month: string; weekday: string; businessDay: BusinessDay };

export function upcomingDays(count: number, now = new Date()): DayChoice[] {
  const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const weekdayNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  const initial = brazilDateParts(now);
  const initialUtc = Date.UTC(initial.year, initial.month - 1, initial.day);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(initialUtc + index * 86_400_000);
    return {
      iso: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
      day: date.getUTCDate(),
      month: monthNames[date.getUTCMonth()],
      weekday: weekdayNames[date.getUTCDay()],
      businessDay: date.getUTCDay() as BusinessDay,
    };
  });
}

export function displayTime(time: string) {
  return time.slice(0, 5);
}
