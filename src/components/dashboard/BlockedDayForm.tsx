"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { addBlockedDay, removeBlockedDay } from "@/actions/schedule";
import type { BlockedDay } from "@/types";

interface BlockedDayFormProps {
  blockedDays: BlockedDay[];
}

export function BlockedDayForm({ blockedDays: initial }: BlockedDayFormProps) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<BlockedDay[]>(initial);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;

    startTransition(async () => {
      const result = await addBlockedDay(date, reason || null);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success("Día bloqueado añadido");
        setDays((prev) =>
          [...prev, result.data as BlockedDay].sort((a, b) => a.date.localeCompare(b.date))
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
        toast.error("Error al eliminar: " + result.error);
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
        <div className="space-y-1.5 flex-shrink-0">
          <Label htmlFor="block-date">Fecha</Label>
          <Input
            id="block-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-40"
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-40">
          <Label htmlFor="block-reason">Motivo (opcional)</Label>
          <Input
            id="block-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vacaciones, festivo…"
            maxLength={100}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Añadir
        </Button>
      </form>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Sin cierres programados.</p>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <span className="text-sm font-medium">
                  {new Date(day.date + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {day.reason && (
                  <span className="ml-2 text-sm text-muted-foreground">— {day.reason}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                disabled={isPending}
                onClick={() => handleDelete(day.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
