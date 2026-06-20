"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, Users, Clock, Moon, AlertCircle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { Reservation, BusinessHours, BlockedDay, RestaurantTable } from "@/types";

// ─── constants ───────────────────────────────────────────────────────────────

const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 border-blue-200 text-blue-800",
  seated:    "bg-green-100 border-green-200 text-green-800",
  completed: "bg-stone-100 border-stone-200 text-stone-500",
  no_show:   "bg-red-100 border-red-200 text-red-700",
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

function madridMins(isoStr: string): number {
  const d = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  return h * 60 + m;
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
}

// ─── component ───────────────────────────────────────────────────────────────

export function CalendarClient({ initialReservations, businessHours, blockedDays, tables, today }: Props) {
  const [view, setView] = useState<"month" | "day">("month");
  const [viewDate, setViewDate] = useState(new Date(today + "T12:00:00"));
  const [selectedDate, setSelectedDate] = useState(today);

  const totalSeats = useMemo(() => tables.reduce((s, t) => s + t.capacity, 0), [tables]);

  // Reservations grouped by YYYY-MM-DD (using the UTC date from starts_at)
  const byDate = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of initialReservations) {
      const d = r.starts_at.substring(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    return m;
  }, [initialReservations]);

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
    const dow = new Date(ds + "T12:00:00").getDay();
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

    const shifts: Shift[] = [];
    if (bh.opens_at && bh.closes_at) {
      const openMins = timeToMins(bh.opens_at);
      const closeMins = timeToMins(bh.closes_at);
      shifts.push({
        label: bh.opens_at_2 ? "Comida" : "Turno",
        open: bh.opens_at.slice(0, 5),
        close: bh.closes_at.slice(0, 5),
        reservations: dayRsvs.filter(r => {
          const m = madridMins(r.starts_at);
          return m >= openMins && m < closeMins;
        }),
      });
    }
    if (bh.opens_at_2 && bh.closes_at_2) {
      const openMins = timeToMins(bh.opens_at_2);
      const closeMins = timeToMins(bh.closes_at_2);
      shifts.push({
        label: "Cena",
        open: bh.opens_at_2.slice(0, 5),
        close: bh.closes_at_2.slice(0, 5),
        reservations: dayRsvs.filter(r => {
          const m = madridMins(r.starts_at);
          return m >= openMins && m < closeMins;
        }),
      });
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

  // ── Day view data ───────────────────────────────────────────────────────────
  const selState  = getDayState(selectedDate);
  const selShifts = getShiftsForDay(selectedDate);
  const selBlocked = blockedSet.has(selectedDate);
  const selBlockReason = blockedReasonMap.get(selectedDate);
  const selDateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });

  // ── Slot occupancy for a shift ──────────────────────────────────────────────
  function slotOccupancy(shift: Shift): Array<{ label: string; free: number; occupied: number; total: number }> {
    const result: Array<{ label: string; free: number; occupied: number; total: number }> = [];
    let cur = timeToMins(shift.open);
    const end = timeToMins(shift.close);
    const INTERVAL = 30;
    while (cur < end) {
      const slotEnd = cur + INTERVAL;
      const occupiedTableIds = new Set<string>();
      for (const r of shift.reservations) {
        const rStart = madridMins(r.starts_at);
        const rEnd   = madridMins(r.ends_at);
        if (rStart < slotEnd && rEnd > cur) {
          if (r.table_id) occupiedTableIds.add(r.table_id);
        }
      }
      const occupied = occupiedTableIds.size;
      const total    = tables.length;
      result.push({ label: minsToLabel(cur), free: total - occupied, occupied, total });
      cur += INTERVAL;
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
              <p className={cn("text-xs font-medium", selState.occ >= 3 ? "text-orange-600" : "text-amber-600")}>
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
          <div className={cn(
            "rounded-2xl border p-5 flex items-center gap-3",
            selBlocked ? "bg-red-50 border-red-100" : "bg-stone-50 border-stone-100",
          )}>
            {selBlocked
              ? <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              : <Moon className="h-5 w-5 text-stone-400 flex-shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold text-stone-700">
                {selBlocked ? "Día bloqueado" : "Restaurante cerrado"}
              </p>
              {selBlockReason && (
                <p className="text-xs text-stone-500 mt-0.5">{selBlockReason}</p>
              )}
            </div>
          </div>
        )}

        {/* Shifts */}
        {selShifts.map((shift) => {
          const slots = slotOccupancy(shift);
          const shiftCovers = shift.reservations.reduce((s, r) => s + r.party_size, 0);
          const maxOccSlot = slots.reduce((max, s) => s.occupied > max ? s.occupied : max, 0);
          const shiftOcc = occupancyLevel(shiftCovers, totalSeats, 1);

          return (
            <div key={shift.label} className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
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
                    shiftOcc === 1 ? "bg-emerald-100 text-emerald-700" :
                    shiftOcc === 2 ? "bg-amber-100 text-amber-700" :
                    shiftOcc === 3 ? "bg-orange-100 text-orange-700" :
                                     "bg-red-100 text-red-700",
                  )}>
                    {shiftOcc === 0 ? "Sin reservas" : OCC_LABEL[shiftOcc]}
                  </span>
                  {shiftCovers > 0 && (
                    <p className="text-xs text-stone-400 mt-1">{shiftCovers} comensales</p>
                  )}
                </div>
              </div>

              {/* Slot occupancy grid */}
              {slots.length > 0 && (
                <div className="px-5 py-3 border-b border-stone-50">
                  <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wide mb-2">
                    Mesas por franja
                  </p>
                  <div className="space-y-1.5">
                    {slots.map(slot => {
                      const pct = slot.total > 0 ? slot.occupied / slot.total : 0;
                      return (
                        <div key={slot.label} className="flex items-center gap-2.5">
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
                            slot.free === 0 ? "text-red-600" :
                            slot.free <= 2  ? "text-orange-600" :
                                             "text-stone-500",
                          )}>
                            {slot.free}/{slot.total} lib.
                          </span>
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
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-shrink-0 text-center w-12">
                        <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at)}</div>
                        <div className="text-[10px] text-stone-400">{formatTime(r.ends_at)}</div>
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
          <div className="rounded-2xl bg-white border border-stone-100 shadow-sm py-10 text-center">
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
          className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
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

      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-50">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft className="h-4 w-4 text-stone-600" />
          </button>
          <span className="font-semibold text-stone-800 text-sm">
            {MONTHS[month]} {year}
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
                    ? "text-amber-700 font-bold"
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
        className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden cursor-pointer"
        onClick={() => setView("day")}
      >
        <div className="px-5 py-3.5 border-b border-stone-50 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800 text-sm capitalize">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </h2>
          <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
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
                    {formatTime(r.starts_at)}
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
