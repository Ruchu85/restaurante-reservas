"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAppointment } from "@/actions/appointments";
import type { BusinessHours } from "@/types";

interface ExistingAppt { starts_at: string; ends_at: string }

interface NewAppointmentFormProps {
  initialDate?: string;
  businessHours?: BusinessHours[];
  existingAppointments?: ExistingAppt[];
}

const SERVICES = [
  "Corte de cabello",
  "Coloración",
  "Mechas / Balayage",
  "Peinado",
  "Tratamiento keratina",
  "Manicura",
  "Otro",
];

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hora", value: 60 },
  { label: "1 h 30 min", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "2 h 30 min", value: 150 },
  { label: "3 horas", value: 180 },
];

function roundToQuarter(date: Date): Date {
  const ms = 15 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function computeSlots(
  date: string,
  businessHours: BusinessHours[],
  existingAppts: ExistingAppt[]
): { time: string; occupied: boolean }[] {
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();
  const hours = businessHours.find((h) => h.day_of_week === dayOfWeek);

  let openMin = 8 * 60;
  let closeMin = 20 * 60;

  if (hours) {
    if (!hours.is_open) return [];
    const [oh, om] = hours.opens_at.split(":").map(Number);
    const [ch, cm] = hours.closes_at.split(":").map(Number);
    openMin = oh * 60 + om;
    closeMin = ch * 60 + cm;
  }

  const slots: { time: string; occupied: boolean }[] = [];
  for (let m = openMin; m < closeMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);

    const occupied = existingAppts.some((appt) => {
      const s = new Date(appt.starts_at);
      const e = new Date(appt.ends_at);
      return s < slotEnd && e > slotStart;
    });

    slots.push({ time, occupied });
  }
  return slots;
}

export function NewAppointmentForm({
  initialDate,
  businessHours = [],
  existingAppointments = [],
}: NewAppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultStart = roundToQuarter(new Date());

  const [form, setForm] = useState({
    customer_name: "",
    service: SERVICES[0],
    service_custom: "",
    duration: 30,
    date: initialDate ?? defaultStart.toISOString().split("T")[0],
    start_time: `${String(defaultStart.getHours()).padStart(2, "0")}:${String(defaultStart.getMinutes()).padStart(2, "0")}`,
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function computeTimes() {
    const starts = new Date(`${form.date}T${form.start_time}:00`);
    const ends = new Date(starts.getTime() + form.duration * 60_000);
    return { starts, ends };
  }

  const endTime = (() => {
    try {
      const { ends } = computeTimes();
      return toLocalDatetimeValue(ends).split("T")[1];
    } catch { return ""; }
  })();

  // Recompute slots when date changes
  const slots = useMemo(
    () => computeSlots(form.date, businessHours, existingAppointments),
    [form.date, businessHours, existingAppointments]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { starts, ends } = computeTimes();
    const serviceName = form.service === "Otro" ? form.service_custom.trim() : form.service;
    if (!serviceName) { toast.error("Indica el nombre del servicio"); return; }

    startTransition(async () => {
      const result = await createAppointment({
        customer_name: form.customer_name,
        service: serviceName,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: form.notes || undefined,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cita creada");
        router.push("/dashboard/citas");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Cliente */}
      <div className="space-y-1.5">
        <Label htmlFor="customer">Nombre del cliente *</Label>
        <Input
          id="customer"
          value={form.customer_name}
          onChange={(e) => update("customer_name", e.target.value)}
          required minLength={2} placeholder="Ana García" autoFocus
        />
      </div>

      {/* Servicio */}
      <div className="space-y-1.5">
        <Label htmlFor="service-select">Servicio *</Label>
        <Select value={form.service} onValueChange={(v) => update("service", v)}>
          <SelectTrigger id="service-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {form.service === "Otro" && (
          <Input
            value={form.service_custom}
            onChange={(e) => update("service_custom", e.target.value)}
            placeholder="Nombre del servicio" required
          />
        )}
      </div>

      {/* Fecha */}
      <div className="space-y-1.5">
        <Label htmlFor="date">Fecha *</Label>
        <Input
          id="date" type="date" value={form.date}
          onChange={(e) => update("date", e.target.value)} required
        />
      </div>

      {/* Hora de inicio: selector de slots + manual */}
      <div className="space-y-1.5">
        <Label>Hora de inicio *</Label>

        {slots.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map(({ time, occupied }) => (
              <button
                key={time}
                type="button"
                disabled={occupied}
                onClick={() => update("start_time", time)}
                className={cn(
                  "rounded-md border px-1.5 py-2 text-xs font-medium transition-colors leading-none",
                  form.start_time === time
                    ? "bg-slate-900 text-white border-slate-900"
                    : occupied
                    ? "bg-rose-50 text-rose-300 border-rose-100 cursor-not-allowed line-through"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200"
                )}
              >
                {time}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Input
            type="time" step={900} value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
            required className="w-32"
          />
          <span className="text-xs text-muted-foreground">o escribe la hora</span>
        </div>
      </div>

      {/* Duración y hora de fin */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="duration">Duración *</Label>
          <Select value={String(form.duration)} onValueChange={(v) => update("duration", Number(v))}>
            <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Hora de fin</Label>
          <Input value={endTime} readOnly className="bg-slate-50 text-muted-foreground" />
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes" value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={2} maxLength={500} placeholder="Preferencias, alergias, indicaciones…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear cita
        </Button>
      </div>
    </form>
  );
}
