"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { updateAppointment } from "@/actions/appointments";
import type { Appointment, Service } from "@/types";

interface EditAppointmentFormProps {
  appointment: Appointment;
  services?: Service[];
}

const DEFAULT_SERVICES = [
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

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initFromAppointment(appt: Appointment, serviceNames: string[]) {
  const startsAt = new Date(appt.starts_at);
  const endsAt = new Date(appt.ends_at);
  const durationMins = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  const local = toLocalDatetimeValue(startsAt);
  const knownService = serviceNames.includes(appt.service);
  const knownDuration = DURATIONS.some((d) => d.value === durationMins);

  return {
    customer_name: appt.customer_name,
    service: knownService ? appt.service : "Otro",
    service_custom: knownService ? "" : appt.service,
    duration: knownDuration ? durationMins : 30,
    date: local.split("T")[0],
    start_time: local.split("T")[1],
    notes: appt.notes ?? "",
    price: appt.price != null ? String(appt.price) : "",
  };
}

export function EditAppointmentForm({ appointment, services = [] }: EditAppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const serviceNames =
    services.length > 0 ? [...services.map((s) => s.name), "Otro"] : DEFAULT_SERVICES;

  const [form, setForm] = useState(() => initFromAppointment(appointment, serviceNames));

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleServiceChange(v: string) {
    const found = services.find((s) => s.name === v);
    setForm((f) => ({
      ...f,
      service: v,
      price: found?.price != null ? String(found.price) : f.price,
    }));
  }

  function computeTimes() {
    const starts = new Date(`${form.date}T${form.start_time}:00`);
    const ends = new Date(starts.getTime() + form.duration * 60 * 1000);
    return { starts, ends };
  }

  const endTime = (() => {
    try {
      const { ends } = computeTimes();
      return toLocalDatetimeValue(ends).split("T")[1];
    } catch {
      return "";
    }
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { starts, ends } = computeTimes();
    const serviceName = form.service === "Otro" ? form.service_custom.trim() : form.service;

    if (!serviceName) {
      toast.error("Indica el nombre del servicio");
      return;
    }

    const priceVal = form.price !== "" ? parseFloat(form.price) : null;

    startTransition(async () => {
      const result = await updateAppointment(appointment.id, {
        customer_name: form.customer_name,
        service: serviceName,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: form.notes || undefined,
        price: priceVal,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cita actualizada");
        router.push("/dashboard/citas");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="customer">Nombre del cliente *</Label>
        <Input
          id="customer"
          value={form.customer_name}
          onChange={(e) => update("customer_name", e.target.value)}
          required
          minLength={2}
          placeholder="Ana García"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="service-select">Servicio *</Label>
        <Select value={form.service} onValueChange={handleServiceChange}>
          <SelectTrigger id="service-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {serviceNames.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.service === "Otro" && (
          <Input
            value={form.service_custom}
            onChange={(e) => update("service_custom", e.target.value)}
            placeholder="Nombre del servicio"
            required
          />
        )}
      </div>

      {/* Precio */}
      <div className="space-y-1.5">
        <Label htmlFor="price">Precio (opcional)</Label>
        <div className="relative">
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            max="9999"
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            placeholder="0.00"
            className="pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            €
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha *</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start-time">Hora de inicio *</Label>
          <Input
            id="start-time"
            type="time"
            step={900}
            value={form.start_time}
            onChange={(e) => update("start_time", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="duration">Duración *</Label>
          <Select
            value={String(form.duration)}
            onValueChange={(v) => update("duration", Number(v))}
          >
            <SelectTrigger id="duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Hora de fin</Label>
          <Input
            value={endTime}
            readOnly
            className="bg-slate-50 text-muted-foreground"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Preferencias, alergias, indicaciones…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
