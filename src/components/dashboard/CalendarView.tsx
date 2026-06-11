"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";
import { downloadTicketsPDF, type SalonInfo } from "@/lib/printTicket";
import { SALON_INFO } from "@/lib/salonConfig";
import { markTicketPrinted } from "@/actions/appointments";
import type { Appointment, BlockedDay, BusinessHours, StaffMember } from "@/types";

interface CalendarViewProps {
  appointments: Appointment[];
  staff: Pick<StaffMember, "id" | "name">[];
  currentDate: string;
  blockedDays?: BlockedDay[];
  businessHours?: BusinessHours[];
  capacity?: number;
  salonInfo?: SalonInfo;
}

type ViewMode = "day" | "week" | "month";

// 30-min slots: 07:00 → 21:00
const SLOTS = Array.from({ length: 28 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m, label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
});

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toLocalDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slotOccupancy(slotH: number, slotM: number, day: Date, appts: Appointment[]) {
  const slotStart = new Date(day);
  slotStart.setHours(slotH, slotM, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);
  let n = 0;
  for (const a of appts) {
    if (a.status !== "active") continue;
    const s = new Date(a.starts_at);
    const e = new Date(a.ends_at);
    if (s < slotEnd && e > slotStart) n++;
  }
  return n;
}

type SlotState = "free" | "partial" | "full";

function occupancyState(occupancy: number, capacity: number): SlotState {
  if (occupancy <= 0) return "free";
  if (occupancy >= capacity) return "full";
  return "partial";
}

const SLOT_BG: Record<SlotState, string> = {
  free: "bg-emerald-50 hover:bg-emerald-100 cursor-pointer",
  partial: "bg-amber-50 hover:bg-amber-100 cursor-pointer",
  full: "bg-rose-50",
};

function apptCountColor(n: number) {
  if (n === 0) return null;
  if (n <= 2) return "bg-emerald-100 text-emerald-700";
  if (n <= 4) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function CalendarView({
  appointments,
  staff,
  currentDate,
  blockedDays = [],
  businessHours = [],
  capacity = 1,
  salonInfo = SALON_INFO,
}: CalendarViewProps) {
  const router = useRouter();
  const cap = capacity > 0 ? capacity : 1;
  const [date, setDate] = useState(new Date(currentDate + "T12:00:00"));
  const [view, setView] = useState<ViewMode>("week");
  const [staffFilter, setStaffFilter] = useState<string>("all");

  useEffect(() => {
    setDate(new Date(currentDate + "T12:00:00"));
  }, [currentDate]);

  // Citas visibles según el filtro de profesional
  const visibleAppointments =
    staffFilter === "all"
      ? appointments
      : appointments.filter((a) => a.staff_id === staffFilter);

  const today = new Date();
  const blockedSet = new Set(blockedDays.map((b) => b.date));

  function isBlocked(day: Date) {
    return blockedSet.has(toLocalDateString(day));
  }

  function getBH(day: Date): BusinessHours | undefined {
    return businessHours.find((h) => h.day_of_week === day.getDay());
  }

  function isClosedBySchedule(day: Date): boolean {
    if (businessHours.length === 0) return false;
    const bh = getBH(day);
    return bh ? !bh.is_open : false;
  }

  function isWithinBusinessHours(day: Date, h: number, m: number): boolean {
    const bh = getBH(day);
    if (!bh || !bh.is_open) return false;
    const slotMin = h * 60 + m;
    const inRange = (open: string, close: string) => {
      const [oh, om] = open.split(":").map(Number);
      const [ch, cm] = close.split(":").map(Number);
      return slotMin >= oh * 60 + om && slotMin < ch * 60 + cm;
    };
    if (inRange(bh.opens_at, bh.closes_at)) return true;
    if (bh.opens_at_2 && bh.closes_at_2 && inRange(bh.opens_at_2, bh.closes_at_2)) return true;
    return false;
  }

  /* ---- week helpers ---- */
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  /* ---- month helpers ---- */
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const calStart = new Date(monthStart);
  calStart.setDate(monthStart.getDate() - monthStart.getDay());
  const monthWeeks: Date[][] = [];
  const cur = new Date(calStart);
  while (cur <= monthEnd || monthWeeks.length < 4) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    monthWeeks.push(week);
    if (cur > monthEnd && monthWeeks.length >= 4) break;
  }

  function navigate(delta: number) {
    const nd = new Date(date);
    if (view === "day") nd.setDate(date.getDate() + delta);
    else if (view === "week") nd.setDate(date.getDate() + delta * 7);
    else nd.setMonth(date.getMonth() + delta);
    setDate(nd);
    router.push(`/dashboard/calendario?date=${toLocalDateString(nd)}`);
  }

  function goToday() {
    const nd = new Date();
    setDate(nd);
    router.push(`/dashboard/calendario?date=${toLocalDateString(nd)}`);
  }

  function getApptForDay(day: Date) {
    return visibleAppointments.filter((a) => sameDay(new Date(a.starts_at), day));
  }

  function computeDaySummary(day: Date) {
    const dayAppts = getApptForDay(day);
    if (isBlocked(day) || isClosedBySchedule(day)) {
      return { count: dayAppts.length, freeSlots: 0, occupancyPct: 0 };
    }
    let inHoursSlots = 0;
    let occupiedUnits = 0;
    let freeSlots = 0;
    for (const { h, m } of SLOTS) {
      if (!isWithinBusinessHours(day, h, m)) continue;
      inHoursSlots++;
      const occ = Math.min(slotOccupancy(h, m, day, visibleAppointments), cap);
      occupiedUnits += occ;
      if (occ < cap) freeSlots++;
    }
    const capacityTotal = inHoursSlots * cap;
    const occupancyPct =
      capacityTotal > 0 ? Math.round((occupiedUnits / capacityTotal) * 100) : 0;
    return { count: dayAppts.length, freeSlots, occupancyPct };
  }

  function getApptStartingInSlot(day: Date, h: number, m: number) {
    return visibleAppointments.filter((a) => {
      const d = new Date(a.starts_at);
      return sameDay(d, day) && d.getHours() === h && d.getMinutes() === m;
    });
  }

  function handleFreeSlotClick(day: Date, h: number, m: number) {
    if (isBlocked(day) || isClosedBySchedule(day)) return;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const dateStr = toLocalDateString(day);
    const dayLabel = day.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    toast(`${dayLabel} · ${time}`, {
      description: "¿Crear nueva cita en este horario?",
      action: {
        label: "Crear cita",
        onClick: () => router.push(`/dashboard/citas/nueva?date=${dateStr}&time=${time}`),
      },
      cancel: { label: "Cancelar", onClick: () => {} },
      duration: 8000,
    });
  }

  async function handlePrintView() {
    const appts =
      view === "day"
        ? getApptForDay(date)
        : view === "week"
          ? weekDays.flatMap((d) => getApptForDay(d))
          : [];
    if (!appts.length) {
      window.alert("No hay citas para imprimir.");
      return;
    }
    try {
      const ids = appts.map((a) => a.id);
      // Assign ticket numbers first, then generate PDF with real numbers
      const result = await markTicketPrinted(ids);
      const returned = "appointments" in result ? result.appointments : null;
      const aptsWithNumbers = returned && returned.length > 0 ? returned : appts;
      await downloadTicketsPDF(aptsWithNumbers, salonInfo);
      // Refresh server components so the calendar reflects the "Impreso" state
      router.refresh();
    } catch (err) {
      console.error("[CalendarView print]", err);
      window.alert("Error al imprimir los tickets. Inténtalo de nuevo.");
    }
  }

  function goToDay(day: Date) {
    setDate(new Date(day));
    router.push(`/dashboard/calendario?date=${toLocalDateString(day)}`);
  }

  const VIEW_LABELS = { day: "Día", week: "Semana", month: "Mes" };

  const headerTitle =
    view === "day"
      ? date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      : view === "week"
        ? weekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
        : date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const isToday = sameDay(date, today);

  return (
    <>
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={goToday}>
              Hoy
            </Button>
          </div>
          <h2
            className={cn(
              "flex-1 text-sm font-medium text-center truncate capitalize",
              isToday && view === "day" && "font-semibold",
            )}
          >
            {headerTitle}
          </h2>
          {view !== "month" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handlePrintView}
              title="Descargar tickets PDF"
            >
              <Printer className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs px-3 flex-shrink-0"
            onClick={() =>
              router.push(`/dashboard/citas/nueva?date=${toLocalDateString(date)}`)
            }
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Nueva cita</span>
          </Button>
        </div>
        <div className="px-3 pb-2.5 flex gap-2">
          <div className="flex flex-1 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                  view === v
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          {staff.length > 0 && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-lg border border-border bg-white px-2 text-xs font-medium text-slate-700 max-w-[40%]"
              aria-label="Filtrar por profesional"
            >
              <option value="all">Todos</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ===== DAY VIEW ===== */}
      {view === "day" && (
        <div className="overflow-auto">
          {isBlocked(date) && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
              <span className="text-base">🚫</span>
              Día bloqueado —{" "}
              {blockedDays.find((b) => b.date === toLocalDateString(date))?.reason ??
                "No laborable"}
            </div>
          )}
          {!isBlocked(date) && isClosedBySchedule(date) && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 text-sm text-slate-500 font-medium flex items-center gap-2">
              <span className="text-base">🔒</span>
              Día cerrado según horario del negocio
            </div>
          )}
          {!isBlocked(date) && !isClosedBySchedule(date) && (() => {
            const s = computeDaySummary(date);
            return (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-border text-xs text-slate-600">
                <span>
                  Ocupación <b className="text-slate-900">{s.occupancyPct}%</b>
                </span>
                <span className="text-slate-300">·</span>
                <span>{s.count} cita{s.count !== 1 ? "s" : ""}</span>
                <span className="text-slate-300">·</span>
                <span className="text-emerald-700 font-medium">{s.freeSlots} huecos libres</span>
                {cap > 1 && (
                  <span className="ml-auto text-[11px] text-slate-400">Capacidad {cap}/tramo</span>
                )}
              </div>
            );
          })()}
          {SLOTS.map(({ h, m, label }) => {
            const slotAppts = getApptStartingInSlot(date, h, m);
            const occupancy = slotOccupancy(h, m, date, visibleAppointments);
            const blocked = isBlocked(date);
            const closedDay = isClosedBySchedule(date);
            const inHours = isWithinBusinessHours(date, h, m);
            const state = occupancyState(occupancy, cap);
            const free = state !== "full" && !blocked && !closedDay && inHours;
            const unavailable = !blocked && !closedDay && !inHours;
            return (
              <div
                key={label}
                className={cn(
                  "flex border-b border-border last:border-b-0 transition-colors group",
                  blocked || closedDay
                    ? "bg-stone-50 cursor-not-allowed"
                    : unavailable
                      ? "bg-white"
                      : SLOT_BG[state],
                )}
                style={{ minHeight: "44px" }}
                onClick={() => {
                  if (free) handleFreeSlotClick(date, h, m);
                }}
              >
                <div
                  className={cn(
                    "w-12 flex-shrink-0 border-r border-border py-1 pr-2 text-right text-xs font-medium",
                    m === 0
                      ? "text-slate-600"
                      : "text-slate-400",
                  )}
                >
                  {label}
                </div>
                <div className="flex-1 p-0.5 space-y-0.5 relative">
                  {slotAppts.map((appt) => {
                    const staffMember = staff.find((s) => s.id === appt.staff_id);
                    return (
                      <div
                        key={appt.id}
                        className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1 text-sm cursor-pointer hover:bg-rose-200 active:bg-rose-300 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/citas/${appt.id}`);
                        }}
                      >
                        <div className="font-medium text-rose-900">
                          {appt.customer_name}
                        </div>
                        <div className="text-xs text-rose-700">
                          {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)} · {appt.service}
                          {staffMember && <> · {staffMember.name}</>}
                        </div>
                      </div>
                    );
                  })}
                  {free && state === "free" && slotAppts.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-4 w-4 text-emerald-600" />
                    </div>
                  )}
                  {free && state === "partial" && (
                    <button
                      className="w-full text-left rounded-md border border-dashed border-amber-400 px-2 py-1 text-xs text-amber-700 font-medium hover:bg-amber-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFreeSlotClick(date, h, m);
                      }}
                    >
                      + Añadir cliente · {cap - occupancy === 1 ? "queda 1 hueco" : `quedan ${cap - occupancy} huecos`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== WEEK VIEW ===== */}
      {view === "week" && (
        <div className="overflow-auto">
          <div className="min-w-[560px]">
            {/* Day headers */}
            <div
              className="grid sticky top-0 bg-white z-20 border-b border-border"
              style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
            >
              {/* Corner cell — sticky left */}
              <div className="sticky left-0 bg-white z-30 border-r border-border" />
              {weekDays.map((day, i) => {
                const isT = sameDay(day, today);
                const blocked = isBlocked(day);
                const closedSched = isClosedBySchedule(day);
                const dayAppts = getApptForDay(day);
                return (
                  <div
                    key={i}
                    className={cn(
                      "py-2 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-slate-50",
                      isT && "bg-slate-50",
                      blocked && "bg-red-50",
                      !blocked && closedSched && "bg-stone-50",
                    )}
                    onClick={() => {
                      setDate(new Date(day));
                      setView("day");
                    }}
                  >
                    <div className="text-xs text-muted-foreground">{DAYS_SHORT[day.getDay()]}</div>
                    <div
                      className={cn(
                        "mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isT && "bg-slate-900 text-white",
                        blocked && !isT && "bg-red-500 text-white",
                        closedSched && !blocked && !isT && "text-slate-400",
                      )}
                    >
                      {day.getDate()}
                    </div>
                    {dayAppts.length > 0 && (
                      <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-rose-500" />
                    )}
                    {blocked && (
                      <div className="text-xs text-red-600 leading-tight mt-0.5">
                        Cerrado
                      </div>
                    )}
                    {!blocked && closedSched && (
                      <div className="text-xs text-slate-400 leading-tight mt-0.5">
                        Cerrado
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 30-min slot rows */}
            {SLOTS.map(({ h, m, label }) => (
              <div
                key={label}
                className="grid border-b border-border last:border-b-0"
                style={{ gridTemplateColumns: "44px repeat(7, 1fr)", minHeight: "36px" }}
              >
                {/* Time label — sticky left */}
                <div
                  className={cn(
                    "sticky left-0 bg-white z-10 border-r border-border py-0.5 pr-1 text-right text-xs leading-tight",
                    m === 0
                      ? "text-slate-600 font-medium"
                      : "text-slate-400",
                  )}
                >
                  {label}
                </div>
                {weekDays.map((day, i) => {
                  const slotAppts = getApptStartingInSlot(day, h, m);
                  const occupancy = slotOccupancy(h, m, day, visibleAppointments);
                  const blocked = isBlocked(day);
                  const closedDay = isClosedBySchedule(day);
                  const inHours = isWithinBusinessHours(day, h, m);
                  const state = occupancyState(occupancy, cap);
                  const free = state !== "full" && !blocked && !closedDay && inHours;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-border last:border-r-0 p-0.5 space-y-0.5 transition-colors group relative",
                        blocked || closedDay
                          ? "bg-stone-50 cursor-not-allowed"
                          : !inHours
                            ? "bg-white"
                            : SLOT_BG[state],
                      )}
                      onClick={() => {
                        if (free) handleFreeSlotClick(day, h, m);
                      }}
                    >
                      {slotAppts.map((appt) => (
                        <div
                          key={appt.id}
                          className="rounded border border-rose-300 bg-rose-100 px-1 py-0.5 text-xs cursor-pointer hover:bg-rose-200 transition-colors truncate"
                          title={`${appt.customer_name} — ${appt.service}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/citas/${appt.id}`);
                          }}
                        >
                          <div className="font-medium truncate text-rose-900">
                            {appt.customer_name}
                          </div>
                          <div className="opacity-75 truncate text-rose-700">
                            {formatTime(appt.starts_at)}
                          </div>
                        </div>
                      ))}
                      {free && slotAppts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <Plus className={cn("h-3 w-3", state === "partial" ? "text-amber-500" : "text-emerald-500")} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== MONTH VIEW ===== */}
      {view === "month" && (
        <div className="p-2">
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map((d) => (
              <div
                key={d}
                className="text-center text-xs text-muted-foreground py-1 font-medium"
              >
                {d}
              </div>
            ))}
          </div>
          {monthWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
              {week.map((day, di) => {
                const dayAppts = getApptForDay(day);
                const count = dayAppts.length;
                const isT = sameDay(day, today);
                const blocked = isBlocked(day);
                const closedSched = isClosedBySchedule(day);
                const isCurrentMonth = day.getMonth() === date.getMonth();
                const colorClass = apptCountColor(count);
                return (
                  <div
                    key={di}
                    className={cn(
                      "min-h-[56px] rounded-md border border-border p-1 cursor-pointer transition-colors active:opacity-80",
                      blocked
                        ? "bg-red-100 border-red-300"
                        : closedSched
                          ? "bg-stone-50 border-stone-100"
                          : isT
                            ? "ring-2 ring-slate-900 ring-inset border-transparent hover:bg-slate-50"
                            : "hover:bg-slate-50",
                      !isCurrentMonth && "opacity-30",
                    )}
                    onClick={() => {
                      setDate(new Date(day));
                      setView("day");
                    }}
                  >
                    <div
                      className={cn(
                        "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5",
                        isT && "bg-slate-900 text-white",
                        blocked && !isT && "text-red-700",
                        closedSched && !blocked && !isT && "text-slate-400",
                      )}
                    >
                      {day.getDate()}
                    </div>
                    {blocked && (
                      <div className="text-xs text-red-600 leading-tight font-medium">
                        Cerrado
                      </div>
                    )}
                    {!blocked && closedSched && (
                      <div className="text-xs text-slate-400 leading-tight">
                        Cerrado
                      </div>
                    )}
                    {!blocked && !closedSched && colorClass && (
                      <div
                        className={cn(
                          "text-xs rounded px-0.5 text-center font-semibold leading-tight",
                          colorClass,
                        )}
                      >
                        {count}
                      </div>
                    )}
                    {!blocked && !closedSched && dayAppts[0] && (
                      <div className="hidden sm:block mt-0.5 text-xs text-muted-foreground truncate leading-tight">
                        {dayAppts[0].customer_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-2 flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-200" />{" "}
              Bloqueado
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-slate-200" />{" "}
              Cerrado
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-200" />{" "}
              1–2
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-200" />{" "}
              3–4
            </span>
          </div>
        </div>
      )}

      {/* Mobile week strip (day view only) */}
      {view === "day" && (
        <div className="border-t border-border px-2 py-2 flex gap-1 overflow-x-auto md:hidden">
          {weekDays.map((day, i) => {
            const isT = sameDay(day, today);
            const isSelected = sameDay(day, date);
            const hasAppts = getApptForDay(day).length > 0;
            const blocked = isBlocked(day);
            const closedSched = isClosedBySchedule(day);
            return (
              <button
                key={i}
                onClick={() => goToDay(day)}
                className={cn(
                  "flex flex-col items-center flex-shrink-0 rounded-lg p-1.5 min-w-[38px] transition-colors",
                  isSelected
                    ? "bg-slate-900 text-white"
                    : blocked
                      ? "bg-red-100 text-red-700"
                      : closedSched
                        ? "bg-stone-50 text-slate-400"
                        : isT
                          ? "bg-stone-50"
                          : "hover:bg-slate-50",
                )}
              >
                <span className="text-xs">{DAYS_SHORT[day.getDay()]}</span>
                <span className="text-sm font-semibold">{day.getDate()}</span>
                {hasAppts && (
                  <div
                    className={cn(
                      "mt-0.5 h-1 w-1 rounded-full",
                      isSelected ? "bg-white" : "bg-rose-500",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>

    {/* Mobile FAB — visible only on small screens, floats above bottom nav */}
    <button
      className="fixed bottom-[72px] right-4 z-40 md:hidden flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-white font-semibold text-sm shadow-lg active:scale-95 transition-transform"
      onClick={() => router.push(`/dashboard/citas/nueva?date=${toLocalDateString(date)}`)}
    >
      <Plus className="h-4 w-4" />
      Nueva cita
    </button>
    </>
  );
}
