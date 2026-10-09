"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, Users, Clock, Moon, AlertCircle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { toLocalDate, dayOfWeek, rangoDelMes, claveMes } from "@/lib/dates";
import { resolveServiceDate } from "@/lib/availability";
import { toast } from "sonner";
import type { Reservation, BusinessHours, BlockedDay, RestaurantTable } from "@/types";

// ─── constants ───────────────────────────────────────────────────────────────

const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/25 text-blue-800 dark:text-blue-300",
  seated:    "bg-green-100 dark:bg-green-500/15 border-green-200 dark:border-green-500/25 text-green-800 dark:text-green-300",
  completed: "bg-stone-100 border-stone-200 text-stone-500",
  no_show:   "bg-red-100 dark:bg-red-500/15 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300",
  cancelled: "bg-stone-50 border-stone-100 text-stone-400",
};
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmada",
  seated:    "En mesa",
  completed: "Completada",
  no_show:   "No llegó",
  cancelled: "Cancelada",
};

// Occupancy level 0-4 → color class for the indicator bar
const OCC_BAR = [
  "",                      // 0 — no reservations
  "bg-emerald-400",        // 1 — tranquilo  (<25%)
  "bg-amber-400",          // 2 — moderado   (25-55%)
  "bg-orange-500",         // 3 — lleno       (55-80%)
  "bg-red-500",            // 4 — muy lleno  (>80%)
];
const OCC_LABEL = ["", "Tranquilo", "Moderado", "Lleno", "Completo"];

// ─── helpers ─────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toLocaleDateString("en-CA"); }

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

/**
 * Hora local de una reserva, en minutos desde medianoche.
 *
 * El formateador se guarda por zona y el resultado por fecha: esta función se
 * llama una vez por reserva y franja, o sea decenas de miles de veces al
 * pintar un mes. Construyendo un `Intl.DateTimeFormat` en cada llamada, que
 * era lo que hacía, el calendario se comía más de dos segundos de CPU antes
 * de aparecer en pantalla.
 */
const formateadoresHora = new Map<string, Intl.DateTimeFormat>();
const minutosPorFecha = new Map<string, number>();

function localMins(isoStr: string, timeZone: string): number {
  const clave = timeZone + isoStr;
  const guardado = minutosPorFecha.get(clave);
  if (guardado !== undefined) return guardado;

  let dtf = formateadoresHora.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
    });
    formateadoresHora.set(timeZone, dtf);
  }

  const parts = dtf.formatToParts(new Date(isoStr));
  const h = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  const total = h * 60 + m;
  minutosPorFecha.set(clave, total);
  return total;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minsToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

/**
 * Límites de un turno en minutos desde medianoche.
 *
 * Si el cierre es menor o igual que la apertura, el turno termina de madrugada
 * y se le suman 24 h. Sin esto, un turno de cena 20:30–01:00 daba
 * `openMins=1230, closeMins=60`: ninguna reserva cumplía `m >= 1230 && m < 60`,
 * así que el servicio de noche entero aparecía vacío.
 */
function shiftBounds(open: string, close: string): { openMins: number; closeMins: number } {
  const openMins = timeToMins(open);
  let closeMins = timeToMins(close);
  if (closeMins <= openMins) closeMins += 1440;
  return { openMins, closeMins };
}

/** Lleva un minuto de madrugada al mismo eje que el turno que cruza medianoche. */
function normalizeToShift(mins: number, openMins: number): number {
  return mins < openMins ? mins + 1440 : mins;
}


function occupancyLevel(covers: number, totalSeats: number, shifts: number): 0|1|2|3|4 {
  if (totalSeats === 0 || covers === 0) return 0;
  const pct = covers / (totalSeats * Math.max(shifts, 1));
  if (pct < 0.25) return 1;
  if (pct < 0.55) return 2;
  if (pct < 0.80) return 3;
  return 4;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface Shift {
  label: string;
  open: string;
  close: string;
  reservations: Reservation[];
}

interface Props {
  initialReservations: Reservation[];
  businessHours: BusinessHours[];
  blockedDays: BlockedDay[];
  tables: RestaurantTable[];
  today: string;
  /** Zona horaria del restaurante: todo lo que se pinta debe usarla. */
  timeZone?: string;
}

// ─── component ───────────────────────────────────────────────────────────────

export function CalendarClient({
  initialReservations,
  businessHours,
  blockedDays,
  tables,
  today,
  timeZone = "Europe/Madrid",
}: Props) {
  const [view, setView] = useState<"month" | "day">("month");
  const [viewDate, setViewDate] = useState(new Date(today + "T12:00:00"));
  const [selectedDate, setSelectedDate] = useState(today);

  // ── Carga por meses ────────────────────────────────────────────────────────
  // La página solo trae el mes inicial. Los demás se piden cuando el usuario
  // llega a ellos y se quedan guardados, así que ir y volver entre meses no
  // vuelve a llamar al servidor.
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const mesesCargados = useRef<Set<string>>(new Set([claveMes(today)]));
  const [cargandoMes, setCargandoMes] = useState(false);

  // El mes que hay que tener cargado: el de la rejilla en vista de mes, y el
  // del día elegido cuando se navega día a día con las flechas.
  const mesNecesario = view === "day" ? claveMes(selectedDate) : claveMes(isoDate(viewDate));

  useEffect(() => {
    if (mesesCargados.current.has(mesNecesario)) return;
    // Se marca antes de pedir: si no, un doble render dispararía dos peticiones.
    mesesCargados.current.add(mesNecesario);

    const { desde, hasta } = rangoDelMes(mesNecesario + "-01");
    let cancelado = false;
    setCargandoMes(true);

    fetch(`/api/dashboard/calendario?desde=${desde}&hasta=${hasta}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("fallo"))))
      .then(({ reservations: nuevas }: { reservations: Reservation[] }) => {
        if (cancelado) return;
        setReservations(prev => {
          // Por id, porque los márgenes de siete días hacen que dos meses
          // contiguos compartan reservas y si no saldrían duplicadas.
          const porId = new Map(prev.map(r => [r.id, r]));
          for (const r of nuevas) {
            if (["confirmed", "seated", "completed"].includes(r.status)) porId.set(r.id, r);
          }
          return [...porId.values()];
        });
      })
      .catch(() => {
        // Si falla, se olvida para poder reintentar al volver a ese mes.
        mesesCargados.current.delete(mesNecesario);
        toast.error("No se han podido cargar las reservas de ese mes");
      })
      .finally(() => !cancelado && setCargandoMes(false));

    return () => { cancelado = true; };
  }, [mesNecesario]);
  // Franjas desplegadas en la vista de día (clave: "turno·HH:MM").
  const [openSlots, setOpenSlots] = useState<Set<string>>(new Set());
  // Para saltar a una reserva concreta al pulsar su mesa dentro de una franja.
  const reservationRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  function toggleSlot(key: string) {
    setOpenSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function jumpToReservation(id: string) {
    const el = reservationRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    window.setTimeout(() => setHighlightedId(cur => (cur === id ? null : cur)), 1600);
  }

  const totalSeats = useMemo(() => tables.reduce((s, t) => s + t.capacity, 0), [tables]);

  // Agrupadas por DÍA DE SERVICIO, no por el día del reloj.
  //
  // Una reserva de las 00:15 del domingo es la cola de la cena del sábado: si
  // se agrupa por el día natural, no encaja en ningún turno del domingo (que
  // abre a las 13:30) y desaparece de la vista, además de sumar su ocupación
  // al día equivocado. `resolveServiceDate` es la misma función que usa el
  // motor de reservas, así que panel y validación cuentan lo mismo.
  const byDate = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const d =
        resolveServiceDate(new Date(r.starts_at), new Date(r.ends_at), businessHours, {
          timeZone,
        }) ?? toLocalDate(new Date(r.starts_at), timeZone);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return m;
  }, [reservations, businessHours, timeZone]);

  const blockedSet = useMemo(() => new Set(blockedDays.map(b => b.date)), [blockedDays]);
  const blockedReasonMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const b of blockedDays) m.set(b.date, b.reason);
    return m;
  }, [blockedDays]);

  const bhByDow = useMemo(() => {
    const m = new Map<number, BusinessHours>();
    for (const h of businessHours) m.set(h.day_of_week, h);
    return m;
  }, [businessHours]);

  function getDayState(ds: string) {
    const isBlocked = blockedSet.has(ds);
    const dow = dayOfWeek(ds);
    const bh = bhByDow.get(dow);
    const isClosed = isBlocked || !bh || !bh.is_open;
    const shifts = bh?.is_open ? (bh.opens_at_2 ? 2 : 1) : 0;
    const rsvs = byDate.get(ds) ?? [];
    const covers = rsvs.reduce((s, r) => s + r.party_size, 0);
    const occ: 0|1|2|3|4 = isClosed ? 0 : occupancyLevel(covers, totalSeats, shifts);
    return { isClosed, isBlocked, bh, shifts, rsvs, covers, occ };
  }

  function getShiftsForDay(ds: string): Shift[] {
    const { isClosed, bh } = getDayState(ds);
    if (isClosed || !bh) return [];
    const dayRsvs = (byDate.get(ds) ?? [])
      .filter(r => r.status !== "cancelled")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    const build = (label: string, open: string, close: string): Shift => {
      const { openMins, closeMins } = shiftBounds(open, close);
      return {
        label,
        open: open.slice(0, 5),
        close: close.slice(0, 5),
        reservations: dayRsvs.filter(r => {
          const m = normalizeToShift(localMins(r.starts_at, timeZone), openMins);
          return m >= openMins && m < closeMins;
        }),
      };
    };

    const shifts: Shift[] = [];
    if (bh.opens_at && bh.closes_at) {
      shifts.push(build(bh.opens_at_2 ? "Comida" : "Turno", bh.opens_at, bh.closes_at));
    }
    if (bh.opens_at_2 && bh.closes_at_2) {
      shifts.push(build("Cena", bh.opens_at_2, bh.closes_at_2));
    }
    return shifts;
  }

  // ── Month navigation ────────────────────────────────────────────────────────
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days  = getMonthDays(year, month);

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  function selectDay(ds: string) {
    setSelectedDate(ds);
    setView("day");
  }

  /** Busca el próximo día con servicio a partir de (sin incluir) `fromDs`, hasta 60 días vista. */
  function findNextOpenDate(fromDs: string): string | null {
    const d = new Date(fromDs + "T12:00:00");
    for (let i = 0; i < 60; i++) {
      d.setDate(d.getDate() + 1);
      const ds = isoDate(d);
      if (!getDayState(ds).isClosed) return ds;
    }
    return null;
  }

  // ── Day view data ───────────────────────────────────────────────────────────
  const selState  = getDayState(selectedDate);
  const selShifts = getShiftsForDay(selectedDate);
  const selBlocked = blockedSet.has(selectedDate);
  const selBlockReason = blockedReasonMap.get(selectedDate);
  // Mediodía UTC para que la etiqueta no dependa de la zona del servidor.
  const selDateLabel = new Date(selectedDate + "T12:00:00Z").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });

  // ── Slot occupancy for a shift ──────────────────────────────────────────────
  interface SlotTableStatus {
    table: RestaurantTable;
    reservation: Reservation | null;
  }
  interface SlotInfo {
    label: string;
    free: number;
    occupied: number;
    total: number;
    tableStatuses: SlotTableStatus[];
  }

  const activeTables = useMemo(
    () => [...tables].filter(t => t.active).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [tables],
  );

  function slotOccupancy(shift: Shift): SlotInfo[] {
    const result: SlotInfo[] = [];
    const { openMins, closeMins } = shiftBounds(shift.open, shift.close);
    const INTERVAL = 30;

    for (let cur = openMins; cur < closeMins; cur += INTERVAL) {
      const slotEnd = cur + INTERVAL;
      // Una reserva de grupo puede ocupar varias mesas juntadas: se indexa
      // por mesa para poder pintar el detalle de cada una por separado.
      const occupantByTable = new Map<string, Reservation>();
      for (const r of shift.reservations) {
        const rStart = normalizeToShift(localMins(r.starts_at, timeZone), openMins);
        const rEnd = normalizeToShift(localMins(r.ends_at, timeZone), rStart);
        if (rStart < slotEnd && rEnd > cur) {
          const ids = r.table_ids?.length ? r.table_ids : r.table_id ? [r.table_id] : [];
          for (const id of ids) occupantByTable.set(id, r);
        }
      }
      const tableStatuses: SlotTableStatus[] = activeTables.map(t => ({
        table: t,
        reservation: occupantByTable.get(t.id) ?? null,
      }));
      const occupied = tableStatuses.filter(s => s.reservation).length;
      result.push({
        label: minsToLabel(cur % 1440),
        free: activeTables.length - occupied,
        occupied,
        total: activeTables.length,
        tableStatuses,
      });
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — DAY VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === "day") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("month")}
            className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
            aria-label="Volver al mes"
          >
            <ChevronLeft className="h-5 w-5 text-stone-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 capitalize">{selDateLabel}</h1>
            {selState.occ > 0 && (
              <p className={cn("text-xs font-medium", selState.occ >= 3 ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400")}>
                {OCC_LABEL[selState.occ]} · {selState.covers} comensales
              </p>
            )}
          </div>
          {/* Day nav */}
          <div className="flex gap-1">
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() - 1);
                setSelectedDate(isoDate(d));
              }}
              className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-stone-500" />
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedDate + "T12:00:00");
                d.setDate(d.getDate() + 1);
                setSelectedDate(isoDate(d));
              }}
              className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Closed / Blocked */}
        {selState.isClosed && (
          <div className="min-h-[46vh] flex items-center justify-center">
            <div className={cn(
              "rounded-2xl border p-6 flex flex-col items-center text-center gap-3 max-w-xs",
              selBlocked ? "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/25" : "bg-stone-50 border-stone-100",
            )}>
              <div className={cn(
                "h-11 w-11 rounded-full flex items-center justify-center",
                selBlocked ? "bg-red-100 dark:bg-red-500/15" : "bg-stone-100",
              )}>
                {selBlocked
                  ? <AlertCircle className="h-5 w-5 text-red-400" />
                  : <Moon className="h-5 w-5 text-stone-400" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-700">
                  {selBlocked ? "Día bloqueado" : "Restaurante cerrado"}
                </p>
                {selBlockReason && (
                  <p className="text-xs text-stone-500 mt-0.5">{selBlockReason}</p>
                )}
              </div>
              {(() => {
                const nextOpen = findNextOpenDate(selectedDate);
                if (!nextOpen) return null;
                const nextLabel = new Date(nextOpen + "T12:00:00").toLocaleDateString("es-ES", {
                  weekday: "long", day: "numeric", month: "short",
                });
                return (
                  <button
                    onClick={() => setSelectedDate(nextOpen)}
                    className="mt-1 text-amber-700 dark:text-amber-300 bg-amber-100 hover:bg-amber-200 transition-colors px-4 py-2 rounded-2xl flex flex-col items-center gap-0.5"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">Próximo día con servicio</span>
                    <span className="text-sm font-semibold capitalize flex items-center gap-1">
                      {nextLabel}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* Shifts */}
        {selShifts.map((shift) => {
          const slots = slotOccupancy(shift);
          const shiftCovers = shift.reservations.reduce((s, r) => s + r.party_size, 0);
          const shiftOcc = occupancyLevel(shiftCovers, totalSeats, 1);

          return (
            <div key={shift.label} className="rounded-2xl bg-panel border border-stone-100 shadow-sm overflow-hidden">
              {/* Shift header */}
              <div className="px-5 py-3.5 border-b border-stone-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-stone-800 text-sm">{shift.label}</h2>
                  <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {shift.open} – {shift.close}
                  </p>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full",
                    shiftOcc === 0 ? "bg-stone-100 text-stone-500" :
                    shiftOcc === 1 ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                    shiftOcc === 2 ? "bg-amber-100 text-amber-700 dark:text-amber-300" :
                    shiftOcc === 3 ? "bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300" :
                                     "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300",
                  )}>
                    {shiftOcc === 0 ? "Sin reservas" : OCC_LABEL[shiftOcc]}
                  </span>
                  {shiftCovers > 0 && (
                    <p className="text-xs text-stone-400 mt-1">{shiftCovers} comensales</p>
                  )}
                </div>
              </div>

              {/* Slot occupancy grid — cada franja se puede desplegar para ver el detalle mesa a mesa */}
              {slots.length > 0 && (
                <div className="px-5 py-3 border-b border-stone-50">
                  <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide mb-2">
                    Mesas por franja · toca una franja para ver el detalle
                  </p>
                  <div className="space-y-1">
                    {slots.map(slot => {
                      const pct = slot.total > 0 ? slot.occupied / slot.total : 0;
                      const key = `${shift.label}·${slot.label}`;
                      const isOpen = openSlots.has(key);
                      return (
                        <div key={slot.label} className="rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleSlot(key)}
                            aria-expanded={isOpen}
                            className={cn(
                              "w-full flex items-center gap-2.5 py-2 px-2 -mx-1.5 rounded-lg border transition-colors",
                              isOpen
                                ? "bg-amber-50 border-amber-200"
                                : "bg-panel border-stone-100 hover:border-amber-200 hover:bg-amber-50/40",
                            )}
                          >
                            <span className="text-xs text-stone-500 w-10 flex-shrink-0 font-mono">{slot.label}</span>
                            <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden relative">
                              {pct > 0 && (
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    pct < 0.25 ? "bg-emerald-400" :
                                    pct < 0.55 ? "bg-amber-400" :
                                    pct < 0.80 ? "bg-orange-500" :
                                                 "bg-red-500",
                                  )}
                                  style={{ width: `${Math.round(pct * 100)}%` }}
                                />
                              )}
                            </div>
                            <span className={cn(
                              "text-xs font-medium w-12 text-right flex-shrink-0",
                              slot.free === 0 ? "text-red-600 dark:text-red-400" :
                              slot.free <= 2  ? "text-orange-600 dark:text-orange-400" :
                                               "text-stone-500",
                            )}>
                              {slot.free}/{slot.total} lib.
                            </span>
                            <ChevronDown className={cn(
                              "h-4 w-4 flex-shrink-0 transition-transform",
                              isOpen ? "rotate-180 text-amber-600 dark:text-amber-400" : "text-amber-400",
                            )} />
                          </button>

                          {/* Panel expandible con el detalle mesa a mesa (animado sin medir alturas) */}
                          <div
                            className="grid transition-[grid-template-rows] duration-200 ease-out"
                            style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                          >
                            <div className="overflow-hidden">
                              <div className="flex flex-wrap gap-1.5 pt-1 pb-2.5 pl-11 pr-1.5">
                                {slot.tableStatuses.length === 0 ? (
                                  <span className="text-xs text-stone-400">Sin mesas activas</span>
                                ) : (
                                  slot.tableStatuses.map(ts => {
                                    const occupied = !!ts.reservation;
                                    return (
                                      <button
                                        key={ts.table.id}
                                        type="button"
                                        disabled={!occupied}
                                        onClick={() => occupied && jumpToReservation(ts.reservation!.id)}
                                        className={cn(
                                          "text-[11px] px-2.5 py-2 rounded-lg border font-medium flex items-center gap-1 transition-colors min-h-[36px]",
                                          occupied
                                            // En oscuro la rampa está invertida, así que `stone-800` pasa a
                                            // ser un tono claro y el texto blanco encima desaparecía. El
                                            // `dark:` devuelve el mismo contraste dando la vuelta al texto.
                                            ? "bg-stone-800 border-stone-800 text-white dark:text-stone-50 hover:bg-amber-600 hover:border-amber-600 hover:text-white cursor-pointer active:scale-95"
                                            : "bg-panel border-stone-200 text-stone-400 cursor-default",
                                        )}
                                        title={occupied ? `${ts.reservation!.guest_name} · ${ts.reservation!.party_size}p — ver en la lista` : "Mesa libre"}
                                      >
                                        <span>{ts.table.name}</span>
                                        {occupied && (
                                          <span className="opacity-80 font-normal">
                                            · {ts.reservation!.guest_name.split(" ")[0]} ({ts.reservation!.party_size})
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reservations list */}
              {shift.reservations.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-stone-400 text-sm">Sin reservas en este turno</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {shift.reservations.map(r => (
                    <div
                      key={r.id}
                      ref={el => {
                        if (el) reservationRefs.current.set(r.id, el);
                        else reservationRefs.current.delete(r.id);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 transition-colors duration-500",
                        highlightedId === r.id ? "bg-amber-50 ring-1 ring-inset ring-amber-300" : "bg-transparent",
                      )}
                    >
                      <div className="flex-shrink-0 text-center w-12">
                        <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at, timeZone)}</div>
                        <div className="text-[10px] text-stone-400">{formatTime(r.ends_at, timeZone)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-stone-800 truncate">{r.guest_name}</div>
                        <div className="text-xs text-stone-400 flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {r.party_size} personas
                          {r.table && <span>· {r.table.name}</span>}
                        </div>
                      </div>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0",
                        STATUS_COLORS[r.status] ?? "bg-stone-100 text-stone-500",
                      )}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Open day but no shifts configured */}
        {!selState.isClosed && selShifts.length === 0 && (
          <div className="rounded-2xl bg-panel border border-stone-100 shadow-sm py-10 text-center">
            <Calendar className="h-7 w-7 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">Sin turnos configurados</p>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — MONTH VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Calendario</h1>
        <button
          onClick={() => { setSelectedDate(today); setView("day"); }}
          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium flex items-center gap-1"
        >
          <Calendar className="h-3.5 w-3.5" />
          Hoy
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-stone-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />Tranquilo</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Moderado</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />Lleno</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Completo</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-stone-200 inline-block" />Cerrado</span>
      </div>

      <div className="rounded-2xl bg-panel border border-stone-100 shadow-sm overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft className="h-4 w-4 text-stone-600" />
          </button>
          <span className="font-semibold text-stone-800 text-sm flex items-center gap-2">
            {MONTHS[month]} {year}
            {/* Solo aparece al saltar a un mes que aún no está cargado; volver
                a uno ya visitado no pide nada y no parpadea. */}
            {cargandoMes && (
              <span
                className="h-3 w-3 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"
                role="status"
                aria-label="Cargando reservas del mes"
              />
            )}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight className="h-4 w-4 text-stone-600" />
          </button>
        </div>

        {/* DOW headers */}
        <div className="grid grid-cols-7 border-b border-stone-50">
          {DOW_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            if (!d) return <div key={`e-${i}`} className="aspect-square" />;
            const ds = isoDate(d);
            const { isClosed, isBlocked, occ, rsvs } = getDayState(ds);
            const isToday    = ds === today;
            const isSelected = ds === selectedDate;
            const activeCount = rsvs.filter(r => r.status !== "cancelled").length;

            return (
              <button
                key={ds}
                onClick={() => selectDay(ds)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-between py-1 transition-colors relative",
                  isClosed
                    ? "bg-stone-50"
                    : isSelected
                    ? "bg-amber-50"
                    : "hover:bg-stone-50",
                )}
              >
                {/* Closed diagonal stripe overlay */}
                {isClosed && (
                  <div
                    className="absolute inset-0 opacity-[0.06] pointer-events-none"
                    style={{
                      backgroundImage: "repeating-linear-gradient(45deg, #78716c 0, #78716c 1px, transparent 0, transparent 50%)",
                      backgroundSize: "6px 6px",
                    }}
                  />
                )}

                {/* Date number */}
                <span className={cn(
                  "text-xs w-6 h-6 rounded-full flex items-center justify-center font-medium mt-0.5",
                  isToday
                    ? "bg-amber-600 text-white"
                    : isSelected
                    ? "text-amber-700 dark:text-amber-300 font-bold"
                    : isClosed
                    ? "text-stone-300"
                    : "text-stone-700",
                )}>
                  {d.getDate()}
                </span>

                {/* Bottom indicator */}
                <div className="w-full flex flex-col items-center pb-0.5 gap-0.5">
                  {!isClosed && occ > 0 && (
                    <>
                      <span className={cn("w-1.5 h-1.5 rounded-full", OCC_BAR[occ])} />
                      <span className="text-[8px] leading-none text-stone-400">{activeCount}</span>
                    </>
                  )}
                  {isClosed && (
                    <span className="text-[8px] leading-none text-stone-300">
                      {isBlocked ? "bloq." : "cerr."}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day preview (tap to open day view) */}
      <div
        className="rounded-2xl bg-panel border border-stone-100 shadow-sm overflow-hidden cursor-pointer"
        onClick={() => setView("day")}
      >
        <div className="px-5 py-3.5 border-b border-stone-50 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800 text-sm capitalize">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </h2>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            Ver día <ChevronRight className="h-3 w-3" />
          </span>
        </div>

        {selState.isClosed ? (
          <div className="px-5 py-5 flex items-center gap-2.5 text-stone-400">
            {selBlocked
              ? <AlertCircle className="h-4 w-4 text-red-400" />
              : <Moon className="h-4 w-4" />
            }
            <span className="text-sm">
              {selBlocked
                ? `Bloqueado${selBlockReason ? ` · ${selBlockReason}` : ""}`
                : "Cerrado"}
            </span>
          </div>
        ) : selState.rsvs.filter(r => r.status !== "cancelled").length === 0 ? (
          <div className="px-5 py-5 flex items-center gap-2 text-stone-400">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Sin reservas</span>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {selState.rsvs
              .filter(r => r.status !== "cancelled")
              .slice(0, 4)
              .map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-xs font-bold text-stone-700 w-10 flex-shrink-0">
                    {formatTime(r.starts_at, timeZone)}
                  </span>
                  <span className="text-sm text-stone-700 truncate flex-1">{r.guest_name}</span>
                  <span className="text-xs text-stone-400 flex items-center gap-0.5 flex-shrink-0">
                    <Users className="h-3 w-3" />{r.party_size}
                  </span>
                </div>
              ))}
            {selState.rsvs.filter(r => r.status !== "cancelled").length > 4 && (
              <div className="px-5 py-2 text-xs text-stone-400 text-center">
                +{selState.rsvs.filter(r => r.status !== "cancelled").length - 4} más
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
