"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { addBlockedDay, removeBlockedDay } from "@/actions/schedule";
import type { BlockedDay } from "@/types";

export function BlockedDayForm({ blockedDays: initial }: { blockedDays: BlockedDay[] }) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<BlockedDay[]>(initial);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    startTransition(async () => {
      const result = await addBlockedDay({ date, reason: reason || null });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Día bloqueado añadido");
        // Refresh via router for server data; optimistic local update here
        const newEntry: BlockedDay = {
          id: crypto.randomUUID(),
          restaurant_id: "",
          date,
          reason: reason || null,
          created_at: new Date().toISOString(),
        };
        setDays((prev) =>
          [...prev, newEntry].sort((a, b) => a.date.localeCompare(b.date)),
        );
        setDate("");
        setReason("");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await removeBlockedDay(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cierre eliminado");
        setDays((prev) => prev.filter((d) => d.id !== id));
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Fecha</label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-36 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium text-stone-500 mb-1">Motivo (opcional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vacaciones, festivo…"
            maxLength={100}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Añadir
        </button>
      </form>

      {days.length === 0 ? (
        <p className="text-sm text-stone-400 py-2">Sin cierres programados.</p>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.id} className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3 bg-white">
              <div>
                <span className="text-sm font-medium text-stone-800">
                  {new Date(day.date + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {day.reason && (
                  <span className="ml-2 text-sm text-stone-400">— {day.reason}</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(day.id)}
                disabled={isPending}
                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
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
