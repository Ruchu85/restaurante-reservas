"use client";

import { Loader2, Calendar, Clock, Scissors, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime, formatCurrency, formatDuration } from "@/lib/utils";
import type { Service, StaffMember, TimeSlot } from "@/types";

interface CustomerStepProps {
  service: Service;
  slot: TimeSlot;
  staff?: Pick<StaffMember, "id" | "display_name" | "bio">;
  data: { name: string; email: string; phone: string; notes: string };
  onChange: (data: { name: string; email: string; phone: string; notes: string }) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function CustomerStep({
  service,
  slot,
  staff,
  data,
  onChange,
  onConfirm,
  isLoading,
}: CustomerStepProps) {
  const isValid = data.name.trim().length >= 2 && data.email.includes("@") && data.phone.trim().length >= 6;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Tus datos</h2>

      {/* Summary */}
      <Card className="mb-6 bg-slate-50">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Resumen de tu cita</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
              {service.name} — {formatDuration(service.duration_minutes)} — {formatCurrency(service.price_cents)}
            </div>
            {staff && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Con {staff.display_name}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDate(slot.starts_at)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatTime(slot.starts_at)} — {formatTime(slot.ends_at)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre completo *</Label>
          <Input
            id="name"
            placeholder="María García"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico *</Label>
          <Input
            id="email"
            type="email"
            placeholder="maria@ejemplo.es"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+34 600 000 000"
            value={data.phone}
            onChange={(e) => onChange({ ...data, phone: e.target.value })}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas adicionales</Label>
          <Textarea
            id="notes"
            placeholder="¿Alguna indicación especial? (opcional)"
            value={data.notes}
            onChange={(e) => onChange({ ...data, notes: e.target.value })}
            rows={3}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          onClick={onConfirm}
          disabled={!isValid || isLoading}
          className="w-full sm:w-auto"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirmando…
            </>
          ) : (
            "Confirmar cita"
          )}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground text-center">
        Al confirmar, aceptas que tus datos sean usados para gestionar tu reserva.
      </p>
    </div>
  );
}
