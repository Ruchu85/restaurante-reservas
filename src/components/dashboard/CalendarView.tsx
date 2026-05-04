"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";
import type { Appointment, StaffMember } from "@/types";

interface CalendarViewProps {
  appointments: Appointment[];
  staff: Pick<StaffMember, "id" | "name">[];
  currentDate: string;
}

type ViewMode = "day" | "week" | "month";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00–20:00
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

function apptCountColor(count: number) {
  if (count === 0) return null;
  if (count <= 2) return "bg-emerald-100 text-emerald-700";
  if (count <= 4) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function CalendarView({ appointments, staff, currentDate }: CalendarViewProps) {
  const router = useRouter();
  const [date, setDate] = useState(new Date(currentDate + "T12:00:00"));
  const [view, setView] = useState<ViewMode>("day");

  const today = new Date();

  // Week helpers
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Month helpers
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
    if (view === "day") {
      nd.setDate(date.getDate() + delta);
    } else if (view === "week") {
      nd.setDate(date.getDate() + delta * 7);
    } else {
      nd.setMonth(date.getMonth() + delta);
    }
    setDate(nd);
    router.push(`/dashboard/calendario?date=${toDateString(nd)}`);
  }

  function goToday() {
    const nd = new Date();
    setDate(nd);
    router.push(`/dashboard/calendario?date=${toDateString(nd)}`);
  }

  function getApptForDayHour(day: Date, hour: number) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return sameDay(d, day) && d.getHours() === hour;
    });
  }

  function getApptForDay(day: Date) {
    return appointments.filter((a) => sameDay(new Date(a.starts_at), day));
  }

  const VIEW_LABELS_MAP = { day: "Día", week: "Semana", month: "Mes" };

  const headerTitle =
    view === "day"
      ? date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      : view === "week"
      ? weekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
      : date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const isToday = sameDay(date, today);

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="border-b">
        {/* Row 1: navigation + title + new button */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-0.5">
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
              isToday && view === "day" && "font-semibold"
            )}
          >
            {headerTitle}
          </h2>

          <Button
            size="sm"
            className="h-8 text-xs px-3 flex-shrink-0"
            onClick={() => router.push(`/dashboard/citas/nueva?date=${toDateString(date)}`)}
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Nueva cita</span>
          </Button>
        </div>

        {/* Row 2: view switcher — full width pill on mobile */}
        <div className="px-3 pb-2.5">
          <div className="flex rounded-lg border bg-slate-50 p-0.5 gap-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                  view === v
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {VIEW_LABELS_MAP[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DAY VIEW */}
      {view === "day" && (
        <div className="overflow-auto">
          {HOURS.map((hour) => {
            const hourAppts = getApptForDayHour(date, hour);
            return (
              <div key={hour} className="flex border-b last:border-b-0" style={{ minHeight: "56px" }}>
                <div className="w-12 flex-shrink-0 border-r py-1 pr-2 text-right text-xs text-muted-foreground">
                  {hour}:00
                </div>
                <div className="flex-1 p-1 space-y-1">
                  {hourAppts.map((appt) => {
                    const staffMember = staff.find((s) => s.id === appt.staff_id);
                    return (
                      <div
                        key={appt.id}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-sm cursor-pointer hover:bg-blue-100 active:bg-blue-200 transition-colors"
                        onClick={() => router.push(`/dashboard/citas/${appt.id}`)}
                      >
                        <div className="font-medium">{appt.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)} · {appt.service}
                          {staffMember && <> · {staffMember.name}</>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WEEK VIEW */}
      {view === "week" && (
        <div className="overflow-auto">
          <div className="min-w-[560px]">
            {/* Day headers */}
            <div className="grid border-b" style={{ gridTemplateColumns: "40px repeat(7, 1fr)" }}>
              <div className="border-r" />
              {weekDays.map((day, i) => {
                const isT = sameDay(day, today);
                const dayAppts = getApptForDay(day);
                return (
                  <div
                    key={i}
                    className={cn(
                      "py-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-slate-50",
                      isT && "bg-slate-50"
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
                        isT && "bg-slate-900 text-white"
                      )}
                    >
                      {day.getDate()}
                    </div>
                    {dayAppts.length > 0 && (
                      <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: "40px repeat(7, 1fr)", minHeight: "48px" }}
              >
                <div className="border-r py-1 pr-1 text-right text-xs text-muted-foreground leading-tight">
                  {hour}:00
                </div>
                {weekDays.map((day, i) => {
                  const dayAppts = getApptForDayHour(day, hour);
                  const isT = sameDay(day, today);
                  return (
                    <div
                      key={i}
                      className={cn("border-r last:border-r-0 p-0.5 space-y-0.5", isT && "bg-slate-50/60")}
                    >
                      {dayAppts.map((appt) => (
                        <div
                          key={appt.id}
                          className="rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-xs cursor-pointer hover:bg-blue-100 transition-colors truncate"
                          title={`${appt.customer_name} — ${appt.service}`}
                          onClick={() => router.push(`/dashboard/citas/${appt.id}`)}
                        >
                          <div className="font-medium truncate">{appt.customer_name}</div>
                          <div className="opacity-75 truncate">{formatTime(appt.starts_at)}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {view === "month" && (
        <div className="p-2">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {monthWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
              {week.map((day, di) => {
                const dayAppts = getApptForDay(day);
                const count = dayAppts.length;
                const isT = sameDay(day, today);
                const isCurrentMonth = day.getMonth() === date.getMonth();
                const colorClass = apptCountColor(count);

                return (
                  <div
                    key={di}
                    className={cn(
                      "min-h-[56px] rounded-md border p-1 cursor-pointer transition-colors active:bg-slate-100",
                      isT ? "ring-2 ring-slate-900 ring-inset border-transparent" : "hover:bg-slate-50",
                      !isCurrentMonth && "opacity-30 bg-slate-50/50"
                    )}
                    onClick={() => {
                      setDate(new Date(day));
                      setView("day");
                    }}
                  >
                    <div
                      className={cn(
                        "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5",
                        isT && "bg-slate-900 text-white"
                      )}
                    >
                      {day.getDate()}
                    </div>
                    {colorClass && (
                      <div className={cn("text-xs rounded px-0.5 text-center font-semibold leading-tight", colorClass)}>
                        {count}
                      </div>
                    )}
                    {dayAppts[0] && (
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
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-200" /> 1–2
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-200" /> 3–4
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-red-200" /> 5+
            </span>
          </div>
        </div>
      )}

      {/* Mobile: week strip below day view */}
      {view === "day" && (
        <div className="border-t px-2 py-2 flex gap-1 overflow-x-auto md:hidden">
          {weekDays.map((day, i) => {
            const isT = sameDay(day, today);
            const isSelected = sameDay(day, date);
            const hasAppts = getApptForDay(day).length > 0;
            return (
              <button
                key={i}
                onClick={() => {
                  setDate(new Date(day));
                }}
                className={cn(
                  "flex flex-col items-center flex-shrink-0 rounded-lg p-1.5 min-w-[38px] transition-colors",
                  isSelected
                    ? "bg-slate-900 text-white"
                    : isT
                    ? "bg-slate-100"
                    : "hover:bg-slate-50"
                )}
              >
                <span className="text-xs">{DAYS_SHORT[day.getDay()]}</span>
                <span className="text-sm font-semibold">{day.getDate()}</span>
                {hasAppts && (
                  <div
                    className={cn(
                      "mt-0.5 h-1 w-1 rounded-full",
                      isSelected ? "bg-white" : "bg-blue-500"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
