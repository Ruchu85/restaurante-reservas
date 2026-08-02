import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RESTAURANT_TIMEZONE } from "@/lib/dates";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Formateadores en la zona del restaurante.
 *
 * `timeZone` es opcional y cae en Europe/Madrid, que es lo correcto para la
 * inmensa mayoría, pero un restaurante en Canarias (Atlantic/Canary) debe poder
 * pasar la suya: si no, el motor calcula bien y la pantalla muestra otra hora.
 */
export function formatTime(date: Date | string, timeZone = RESTAURANT_TIMEZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

export function formatDate(date: Date | string, timeZone = RESTAURANT_TIMEZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

export function formatShortDate(date: Date | string, timeZone = RESTAURANT_TIMEZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
}

export function roundToInterval(date: Date, intervalMinutes = 15): Date {
  const ms = intervalMinutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** @deprecated Usa `toLocalDate` de `@/lib/dates`, que acepta zona horaria. */
export function toMadridDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: RESTAURANT_TIMEZONE });
}
