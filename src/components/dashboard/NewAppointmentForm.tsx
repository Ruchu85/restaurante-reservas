"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createAppointment } from "@/actions/appointments";
import type { StaffMember, BusinessHours } from "@/types";

interface NewAppointmentFormProps {
  salonId: string;
  staff: StaffMember[];
  businessHours: BusinessHours[];
  initialDate?: string;
  initialStaffId?: string;
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

export function NewAppointmentForm({
  salonId,
  staff,
  initialDate,
  initialStaffId,
}: NewAppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultStart = roundToQuarter(new Date());

  const [form, setForm] = useState({
    staff_id: initialStaffId ?? (staff[0]?.id ?? ""),
    customer_name: "",
    service: SERVICES[0],
    service_custom: "",
    duration: 60,
    date: initialDate ?? defaultStart.toISOString().split("T")[0],
    start_time: `${String(defaultStart.getHours()).padStart(2, "0")}:${String(defaultStart.getMinutes()).padStart(2, "0")}`,
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function computeTimes() {
    const starts = new Date(`${form.date}T${form.start_time}:00`);
    const ends = new Date(starts.getTime() + form.duration * 60 * 1000);
    return { starts, ends };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { starts, ends } = computeTimes();
    const serviceName = form.service === "Otro" ? form.service_custom.trim() : form.service;

    if (!serviceName) {
      toast.error("Indica el nombre del servicio");
      return;
    }

    startTransition(async () => {
      const result = await createAppointment({
        salon_id: salonId,
        staff_id: form.staff_id || null,
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

  const endTime = (() => {
    try {
      const { ends } = computeTimes();
      return toLocalDatetimeValue(ends).split("T")[1];
    } catch {
      return "";
    }
  })();

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
        <Select value={form.service} onValueChange={(v) => update("service", v)}>
          <SelectTrigger id="service-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
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

      <div className="space-y-1.5">
        <Label htmlFor="staff-select">Profesional</Label>
        <Select value={form.staff_id} onValueChange={(v) => update("staff_id", v)}>
          <SelectTrigger id="staff-select">
            <SelectValue placeholder="Sin asignar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Hora de fin</Label>
          <Input value={endTime} readOnly className="bg-slate-50 text-muted-foreground" />
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
          Crear cita
        </Button>
      </div>
    </form>
  );
}
