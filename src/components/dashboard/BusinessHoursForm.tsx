"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { BusinessHours } from "@/types";

interface BusinessHoursFormProps {
  salonId: string;
  dayOfWeek: number;
  dayName: string;
  existing?: BusinessHours;
}

export function BusinessHoursForm({
  salonId,
  dayOfWeek,
  dayName,
  existing,
}: BusinessHoursFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(existing?.is_open ?? dayOfWeek !== 0);
  const [opensAt, setOpensAt] = useState(existing?.opens_at ?? "09:00");
  const [closesAt, setClosesAt] = useState(existing?.closes_at ?? "20:00");

  async function handleSave() {
    startTransition(async () => {
      const supabase = createClient();
      const payload = {
        salon_id: salonId,
        day_of_week: dayOfWeek,
        opens_at: opensAt,
        closes_at: closesAt,
        is_open: isOpen,
      };

      let error;
      if (existing) {
        ({ error } = await supabase
          .from("business_hours")
          .update(payload)
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("business_hours").insert(payload));
      }

      if (error) toast.error("Error al guardar: " + error.message);
      else toast.success(`Horario de ${dayName} guardado`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="w-20 flex-shrink-0 text-sm font-medium">{dayName}</div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          isOpen ? "bg-slate-900" : "bg-slate-200",
        )}
        aria-label={isOpen ? "Cerrar" : "Abrir"}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition",
            isOpen ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>

      {isOpen ? (
        <>
          <Input
            type="time"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">—</span>
          <Input
            type="time"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="w-28"
          />
        </>
      ) : (
        <span className="text-sm text-muted-foreground">Cerrado</span>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={handleSave}
        disabled={isPending}
        className="ml-auto"
      >
        Guardar
      </Button>
    </div>
  );
}
