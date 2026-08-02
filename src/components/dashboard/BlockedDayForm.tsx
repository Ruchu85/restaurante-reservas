"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { addBlockedDay, removeBlockedDay } from "@/actions/schedule";
import { toLocalDate } from "@/lib/dates";
import type { BlockedDay } from "@/types";

export function BlockedDayForm({
  blockedDays,
  disabled = false,
}: {
  blockedDays: BlockedDay[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    startTransition(async () => {
      const result = await addBlockedDay({ date, reason: reason || null });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Día bloqueado añadido");
      // Cerrar un día con reservas confirmadas deja clientes plantados:
      // el servidor lo detecta y avisa aquí.
      if ("warning" in result && result.warning) {
        toast.warning(result.warning, { duration: 10000 });
      }
      setDate("");
      setReason("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await removeBlockedDay(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cierre eliminado");
        router.refresh();
      }
    });
  }

  const today = toLocalDate(new Date());

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="blocked-date" className="block text-xs font-medium text-stone-500 mb-1">
            Fecha
          </label>
          <input
            id="blocked-date"
            type="date"
            min={today}
            value={date}
            disabled={disabled}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-36 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
          />
        </div>
        <div className="flex-1 min-w-40">
          <label htmlFor="blocked-reason" className="block text-xs font-medium text-stone-500 mb-1">
            Motivo (opcional)
          </label>
          <input
            id="blocked-reason"
            type="text"
            value={reason}
            disabled={disabled}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vacaciones, festivo…"
            maxLength={100}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none disabled:bg-stone-50"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || disabled}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Añadir
        </button>
      </form>

      {blockedDays.length === 0 ? (
        <p className="text-sm text-stone-400 py-2">Sin cierres programados.</p>
      ) : (
        <div className="space-y-2">
          {blockedDays.map((day) => (
            <div
              key={day.id}
              className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3 bg-white"
            >
              <div>
                <span className="text-sm font-medium text-stone-800">
                  {new Date(day.date + "T12:00:00Z").toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                {day.reason && <span className="ml-2 text-sm text-stone-400">— {day.reason}</span>}
              </div>
              <button
                onClick={() => handleDelete(day.id)}
                disabled={isPending || disabled}
                aria-label={`Eliminar cierre del ${day.date}`}
                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
