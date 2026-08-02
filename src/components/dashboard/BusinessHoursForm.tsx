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
  disabled?: boolean;
}

/** Recorta "HH:MM:SS" (lo que devuelve Postgres) a "HH:MM", que es lo que acepta <input type="time">. */
function toInputTime(value: string | null | undefined, fallback: string): string {
  return value ? value.slice(0, 5) : fallback;
}

export function BusinessHoursForm({ dayOfWeek, dayName, existing, disabled = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(existing?.is_open ?? dayOfWeek !== 1); // lunes cerrado por defecto
  const [opensAt, setOpensAt] = useState(toInputTime(existing?.opens_at, "13:30"));
  const [closesAt, setClosesAt] = useState(toInputTime(existing?.closes_at, "16:00"));
  const [split, setSplit] = useState(Boolean(existing?.opens_at_2 && existing?.closes_at_2));
  const [opensAt2, setOpensAt2] = useState(toInputTime(existing?.opens_at_2, "20:30"));
  const [closesAt2, setClosesAt2] = useState(toInputTime(existing?.closes_at_2, "23:30"));
  const [pacing, setPacing] = useState(
    existing?.max_covers_per_slot != null ? String(existing.max_covers_per_slot) : "",
  );

  function handleSave() {
    startTransition(async () => {
      const result = await upsertBusinessHours({
        day_of_week: dayOfWeek,
        is_open: isOpen,
        opens_at: isOpen ? opensAt : null,
        closes_at: isOpen ? closesAt : null,
        opens_at_2: isOpen && split ? opensAt2 : null,
        closes_at_2: isOpen && split ? closesAt2 : null,
        max_covers_per_slot: pacing.trim() === "" ? null : Number(pacing),
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
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
          role="switch"
          aria-checked={isOpen}
          aria-label={`${dayName}: ${isOpen ? "abierto" : "cerrado"}`}
          disabled={disabled}
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            disabled && "cursor-not-allowed opacity-60",
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
              disabled={disabled}
              aria-label={`${dayName}: apertura del primer turno`}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
            />
            <span className="text-stone-400 text-sm">–</span>
            <input
              type="time"
              value={closesAt}
              disabled={disabled}
              aria-label={`${dayName}: cierre del primer turno`}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
            />
          </>
        ) : (
          <span className="text-sm text-stone-400">Cerrado</span>
        )}

        <button
          onClick={handleSave}
          disabled={isPending || disabled}
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
              disabled={disabled}
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
                disabled={disabled}
                aria-label={`${dayName}: apertura del turno de cena`}
                onChange={(e) => setOpensAt2(e.target.value)}
                className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
              />
              <span className="text-stone-400 text-sm">–</span>
              <input
                type="time"
                value={closesAt2}
                disabled={disabled}
                aria-label={`${dayName}: cierre del turno de cena`}
                onChange={(e) => setClosesAt2(e.target.value)}
                className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
              />
            </>
          )}

          <label className="flex items-center gap-2 text-xs text-stone-500">
            Máx. comensales por franja
            <input
              type="number"
              min={0}
              max={2000}
              value={pacing}
              disabled={disabled}
              placeholder="Sin límite"
              aria-label={`${dayName}: máximo de comensales por franja`}
              onChange={(e) => setPacing(e.target.value)}
              className="w-24 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
            />
          </label>
        </div>
      )}
    </div>
  );
}
