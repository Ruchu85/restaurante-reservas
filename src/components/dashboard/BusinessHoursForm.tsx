"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { upsertBusinessHours } from "@/actions/schedule";
import type { BusinessHours } from "@/types";

interface Props {
  dayOfWeek: number;
  dayName: string;
  existing?: BusinessHours;
}

export function BusinessHoursForm({ dayOfWeek, dayName, existing }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(existing?.is_open ?? dayOfWeek !== 1); // lunes cerrado por defecto
  const [opensAt, setOpensAt] = useState(existing?.opens_at ?? "13:30");
  const [closesAt, setClosesAt] = useState(existing?.closes_at ?? "16:00");
  const [split, setSplit] = useState(Boolean(existing?.opens_at_2 && existing?.closes_at_2));
  const [opensAt2, setOpensAt2] = useState(existing?.opens_at_2 ?? "20:30");
  const [closesAt2, setClosesAt2] = useState(existing?.closes_at_2 ?? "23:30");

  function handleSave() {
    startTransition(async () => {
      const result = await upsertBusinessHours({
        day_of_week: dayOfWeek,
        is_open: isOpen,
        opens_at: isOpen ? opensAt : null,
        closes_at: isOpen ? closesAt : null,
        opens_at_2: isOpen && split ? opensAt2 : null,
        closes_at_2: isOpen && split ? closesAt2 : null,
      });
      if (result.error) {
        toast.error("Error al guardar: " + result.error);
      } else {
        toast.success(`Horario de ${dayName} guardado`);
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-100 p-3 bg-white">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-24 flex-shrink-0 text-sm font-medium text-stone-700">{dayName}</div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            isOpen ? "bg-amber-600" : "bg-stone-200",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
              isOpen ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>

        {isOpen ? (
          <>
            <input
              type="time"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
            <span className="text-stone-400 text-sm">–</span>
            <input
              type="time"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </>
        ) : (
          <span className="text-sm text-stone-400">Cerrado</span>
        )}

        <button
          onClick={handleSave}
          disabled={isPending}
          className="ml-auto rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          Guardar
        </button>
      </div>

      {isOpen && (
        <div className="mt-2.5 pl-28 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
            <input
              type="checkbox"
              checked={split}
              onChange={(e) => setSplit(e.target.checked)}
              className="rounded border-stone-300 accent-amber-600"
            />
            Turno de cena
          </label>
          {split && (
            <>
              <input
                type="time"
                value={opensAt2}
                onChange={(e) => setOpensAt2(e.target.value)}
                className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <span className="text-stone-400 text-sm">–</span>
              <input
                type="time"
                value={closesAt2}
                onChange={(e) => setClosesAt2(e.target.value)}
                className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
