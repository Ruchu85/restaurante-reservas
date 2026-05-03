"use client";

import { useState, useEffect, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatTime, toMadridDate } from "@/lib/utils";
import { getAvailableSlots } from "@/actions/availability";
import type { Service, TimeSlot } from "@/types";

interface DateTimeStepProps {
  salonId: string;
  service: Service;
  staffId?: string;
  selected: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function DateTimeStep({ salonId, service, staffId, selected, onSelect }: DateTimeStepProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedDate) return;
    setSlots([]);
    startTransition(async () => {
      const result = await getAvailableSlots(salonId, service.id, selectedDate, staffId);
      if (result.slots) setSlots(result.slots);
    });
  }, [selectedDate, salonId, service.id, staffId]);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function isDisabled(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return d < t;
  }

  function formatDateStr(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    return toMadridDate(d);
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Elige fecha y hora</h2>

      {/* Calendar */}
      <div className="mb-6 rounded-lg border p-4">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = formatDateStr(day);
            const isSelected = selectedDate === dateStr;
            const disabled = isDisabled(day);
            return (
              <button
                key={day}
                disabled={disabled}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "rounded-md py-1.5 text-sm transition-colors",
                  isSelected
                    ? "bg-slate-900 text-white"
                    : disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : "hover:bg-slate-100",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <h3 className="mb-3 text-sm font-medium">
            Horarios disponibles para el{" "}
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>

          {isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay huecos disponibles para este día. Prueba otra fecha.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const key = slot.starts_at.toISOString();
                const isSelected = selected?.starts_at.toISOString() === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelect(slot)}
                    className={cn(
                      "rounded-lg border py-2 text-sm transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 hover:border-slate-400",
                    )}
                  >
                    {formatTime(slot.starts_at)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!selectedDate && (
        <p className="text-center text-sm text-muted-foreground">
          Selecciona un día para ver los huecos disponibles.
        </p>
      )}
    </div>
  );
}
