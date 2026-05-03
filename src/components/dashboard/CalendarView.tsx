"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";
import type { Appointment } from "@/types";

interface CalendarViewProps {
  appointments: Appointment[];
  staff: { id: string; display_name: string }[];
  currentDate: string;
}

// staff is passed for future column grouping by staff member

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function CalendarView({ appointments, staff: _staff, currentDate }: CalendarViewProps) {
  const router = useRouter();
  const [date, setDate] = useState(new Date(currentDate + "T12:00:00"));

  // Week bounds
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function navigate(delta: number) {
    const nd = new Date(date);
    nd.setDate(date.getDate() + delta * 7);
    setDate(nd);
    router.push(`/dashboard/calendario?date=${nd.toISOString().split("T")[0]}`);
  }

  const today = new Date();

  function getAppointmentsForDayHour(day: Date, hour: number) {
    return appointments.filter((a) => {
      const d = new Date(a.starts_at);
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate() &&
        d.getHours() === hour
      );
    });
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    completed: "bg-slate-100 text-slate-600 border-slate-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setDate(new Date()); navigate(0); }}>
            Hoy
          </Button>
        </div>
        <h2 className="text-sm font-medium">
          {weekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </h2>
      </div>

      {/* Calendar grid */}
      <div className="overflow-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
            <div className="border-r" />
            {weekDays.map((day, i) => {
              const isToday =
                day.getDate() === today.getDate() &&
                day.getMonth() === today.getMonth() &&
                day.getFullYear() === today.getFullYear();
              return (
                <div
                  key={i}
                  className={cn(
                    "py-2 text-center border-r last:border-r-0",
                    isToday && "bg-slate-50",
                  )}
                >
                  <div className="text-xs text-muted-foreground">{DAYS_ES[day.getDay()]}</div>
                  <div
                    className={cn(
                      "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                      isToday && "bg-slate-900 text-white",
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid border-b last:border-b-0"
              style={{ gridTemplateColumns: "60px repeat(7, 1fr)", minHeight: "64px" }}
            >
              <div className="border-r py-1 pr-2 text-right text-xs text-muted-foreground">
                {hour}:00
              </div>
              {weekDays.map((day, i) => {
                const dayAppts = getAppointmentsForDayHour(day, hour);
                const isToday =
                  day.getDate() === today.getDate() &&
                  day.getMonth() === today.getMonth() &&
                  day.getFullYear() === today.getFullYear();
                return (
                  <div
                    key={i}
                    className={cn(
                      "border-r last:border-r-0 p-1 space-y-1",
                      isToday && "bg-slate-50/50",
                    )}
                  >
                    {dayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        className={cn(
                          "rounded border px-1.5 py-1 text-xs cursor-pointer hover:opacity-80",
                          statusColors[appt.status] ?? "bg-slate-100",
                        )}
                        title={`${appt.customer_name} — ${(appt.service as { name: string } | null)?.name}`}
                        onClick={() => router.push(`/dashboard/citas/${appt.id}`)}
                      >
                        <div className="font-medium truncate">{appt.customer_name}</div>
                        <div className="truncate opacity-75">
                          {formatTime(appt.starts_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
