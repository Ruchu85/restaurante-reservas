"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Users } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { Reservation } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 border-blue-300 text-blue-800",
  seated: "bg-green-100 border-green-300 text-green-800",
  completed: "bg-stone-100 border-stone-200 text-stone-500",
  no_show: "bg-red-100 border-red-300 text-red-700",
  cancelled: "bg-stone-50 border-stone-200 text-stone-400",
};

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isoDate(d: Date) {
  return d.toLocaleDateString("en-CA");
}

export function CalendarClient({
  initialReservations,
  today,
}: {
  initialReservations: Reservation[];
  today: string;
}) {
  const [viewDate, setViewDate] = useState(new Date(today + "T12:00:00"));
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthDays(year, month);

  // Group reservations by date
  const byDate = new Map<string, Reservation[]>();
  for (const r of initialReservations) {
    const d = r.starts_at.split("T")[0];
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  const selectedReservations = byDate.get(selectedDate) ?? [];

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-stone-800">Calendario</h1>

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
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-stone-400">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            if (!d) return <div key={`empty-${i}`} className="aspect-square p-1" />;
            const ds = isoDate(d);
            const rsvs = byDate.get(ds) ?? [];
            const active = rsvs.filter((r) => r.status !== "cancelled");
            const isToday = ds === today;
            const isSelected = ds === selectedDate;

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={cn(
                  "aspect-square p-1 flex flex-col items-center justify-start transition-colors relative",
                  isSelected ? "bg-amber-50" : "hover:bg-stone-50",
                )}
              >
                <span className={cn(
                  "text-xs w-6 h-6 rounded-full flex items-center justify-center mb-0.5 font-medium",
                  isToday ? "bg-amber-600 text-white" : isSelected ? "text-amber-700 font-bold" : "text-stone-600",
                )}>
                  {d.getDate()}
                </span>
                {active.length > 0 && (
                  <span className="text-[9px] font-bold text-amber-700 leading-none">
                    {active.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day reservations */}
      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-50">
          <h2 className="font-semibold text-stone-800 text-sm">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </h2>
        </div>

        {selectedReservations.length === 0 ? (
          <div className="py-10 text-center">
            <Calendar className="h-7 w-7 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">Sin reservas activas</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {selectedReservations.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-shrink-0 w-12 text-center">
                  <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">{r.guest_name}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    {r.party_size}
                    {r.table && ` · ${r.table.name}`}
                  </div>
                </div>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full border font-medium",
                  STATUS_COLORS[r.status] ?? "bg-stone-100 text-stone-500",
                )}>
                  {r.status === "confirmed" ? "Conf." : r.status === "seated" ? "Mesa" : r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
