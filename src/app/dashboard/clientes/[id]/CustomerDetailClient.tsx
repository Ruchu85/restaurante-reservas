"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, MessageCircle, Plus, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatShortDate, formatTime } from "@/lib/utils";
import { updateCustomer } from "@/actions/customers";
import type { Appointment, Customer } from "@/types";

interface Props {
  customer: Customer;
  appointments: Appointment[];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 9) return "34" + digits;
  return digits;
}

export function CustomerDetailClient({ customer, appointments }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");

  const active = appointments.filter((a) => a.status === "active");
  const visits = active.length;
  const totalSpend = active.reduce((sum, a) => sum + (a.price ?? 0), 0);
  const isVip = visits >= 5;

  function handleSave() {
    startTransition(async () => {
      const result = await updateCustomer(customer.id, { phone, notes });
      if (result.error) toast.error(result.error);
      else toast.success("Ficha actualizada");
    });
  }

  function handleWhatsApp() {
    const normalized = normalizePhone(phone);
    const text = encodeURIComponent(`Hola ${customer.name.split(" ")[0]} 👋`);
    const url = normalized ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  function handleNewAppointment() {
    router.push(`/dashboard/citas/nueva?customer=${encodeURIComponent(customer.name)}`);
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/clientes"
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      {/* Cabecera */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full bg-cyan-100 grid place-items-center text-cyan-700 font-bold text-lg flex-shrink-0">
          {initials(customer.name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{customer.name}</h1>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {visits} visita{visits !== 1 ? "s" : ""}
            </span>
            {isVip && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                VIP
              </span>
            )}
            {totalSpend > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {totalSpend.toFixed(0)} € gastados
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          onClick={handleWhatsApp}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>
        <button
          onClick={handleNewAppointment}
          className="rounded-lg bg-slate-900 hover:bg-slate-700 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva cita
        </button>
      </div>

      {/* Datos editables */}
      <div className="rounded-xl border bg-white p-4 mb-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cust-phone" className="text-xs">Teléfono</Label>
          <Input
            id="cust-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="626 758 515"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cust-notes" className="text-xs">Preferencias / notas</Label>
          <Textarea
            id="cust-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Tinte 6.0 sin amoniaco, alergias, gustos…"
            className="text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Save className="h-4 w-4 mr-1.5" />
          Guardar ficha
        </Button>
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">Historial</h2>
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            Aún no hay citas registradas para este cliente.
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/citas/${a.id}`}
                className="rounded-lg border bg-white p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.service}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(a.starts_at)} · {formatTime(a.starts_at)}
                    {a.status === "cancelled" && " · cancelada"}
                  </div>
                </div>
                <span className="text-sm font-semibold flex-shrink-0">
                  {a.price != null ? `${a.price.toFixed(2)} €` : "—"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
