"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { RestaurantTable, Restaurant } from "@/types";
import { createReservation, updateReservation } from "@/actions/reservations";

interface Props {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  defaultValues?: {
    id?: string;
    guest_name?: string;
    guest_phone?: string;
    guest_email?: string | null;
    party_size?: number;
    starts_at?: string;
    table_id?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
  };
  onClose?: () => void;
}

export function ReservationForm({ restaurant, tables, defaultValues, onClose }: Props) {
  const router = useRouter();
  const isEdit = Boolean(defaultValues?.id);

  const [guestName, setGuestName] = useState(defaultValues?.guest_name ?? "");
  const [guestPhone, setGuestPhone] = useState(defaultValues?.guest_phone ?? "");
  const [guestEmail, setGuestEmail] = useState(defaultValues?.guest_email ?? "");
  const [partySize, setPartySize] = useState(defaultValues?.party_size ?? 2);
  const [tableId, setTableId] = useState(defaultValues?.table_id ?? "");
  const [date, setDate] = useState(defaultValues?.starts_at?.substring(0, 10) ?? "");
  const [time, setTime] = useState(
    defaultValues?.starts_at
      ? new Date(defaultValues.starts_at).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Madrid",
        })
      : "",
  );
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(defaultValues?.internal_notes ?? "");
  const [saving, setSaving] = useState(false);

  const activeTables = tables.filter((t) => t.active);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) { toast.error("Indica fecha y hora"); return; }
    if (!guestName.trim()) { toast.error("Indica el nombre del cliente"); return; }
    if (!guestPhone.trim()) { toast.error("Indica el teléfono"); return; }

    setSaving(true);
    try {
      // Build starts_at in Madrid local time → UTC ISO
      const [h, m] = time.split(":").map(Number);
      const localDate = new Date(date + "T00:00:00");
      localDate.setHours(h, m, 0, 0);
      const startsAtISO = localDate.toISOString();

      if (isEdit && defaultValues?.id) {
        const res = await updateReservation(defaultValues.id, {
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim() || null,
          party_size: partySize,
          starts_at: startsAtISO,
          table_id: tableId || null,
          notes: notes.trim() || null,
          internal_notes: internalNotes.trim() || null,
        });
        if (res.error) { toast.error(res.error); return; }
        toast.success("Reserva actualizada");
      } else {
        const res = await createReservation({
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim() || null,
          party_size: partySize,
          starts_at: startsAtISO,
          table_id: tableId || null,
          notes: notes.trim() || null,
          internal_notes: internalNotes.trim() || null,
          source: "admin",
        });
        if (res.error) { toast.error(res.error); return; }
        toast.success("Reserva creada");
      }

      router.refresh();
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + restaurant.max_advance_days);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Nombre del cliente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
        <input
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Fecha <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={date}
            min={today}
            max={maxDate.toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Hora <span className="text-red-500">*</span></label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step={60 * 30}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Comensales <span className="text-red-500">*</span></label>
          <input
            type="number"
            value={partySize}
            min={1}
            max={restaurant.max_party_size}
            onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">Mesa</label>
          <select
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          >
            <option value="">Auto-asignar</option>
            {activeTables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.capacity} p.)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Notas del cliente
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Alergias, ocasión especial…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Notas internas
        </label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
          placeholder="Solo visible para el personal…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Guardar cambios" : "Crear reserva"}
        </button>
      </div>
    </form>
  );
}
