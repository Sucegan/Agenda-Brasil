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
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(year, month - 1, day));
}

export function localDateISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type DayChoice = { iso: string; day: number; month: string; weekday: string };

export function upcomingDays(count: number, now = new Date()): DayChoice[] {
  const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const weekdayNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      iso: localDateISO(date),
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      weekday: weekdayNames[date.getDay()],
    };
  });
}

export function displayTime(time: string) {
  return time.slice(0, 5);
}
