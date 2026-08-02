"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { localDateTimeToUtc, toLocalDate, addDays } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { guestSignals } from "@/lib/guestSignals";
import { GuestSignalBadges } from "@/components/dashboard/GuestSignalBadges";
import { searchGuests } from "@/actions/guests";
import { createReservation, updateReservation } from "@/actions/reservations";
import type { RestaurantTable, Restaurant, Guest } from "@/types";

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
  defaultDate?: string;
  onClose?: (savedDate?: string) => void;
}

export function ReservationForm({ restaurant, tables, defaultValues, defaultDate, onClose }: Props) {
  // La zona del restaurante manda: un local en Canarias no trabaja en hora peninsular.
  const timeZone = restaurant.timezone || "Europe/Madrid";
  const router = useRouter();
  const isEdit = Boolean(defaultValues?.id);

  const [guestName, setGuestName] = useState(defaultValues?.guest_name ?? "");
  const [guestPhone, setGuestPhone] = useState(defaultValues?.guest_phone ?? "");
  const [guestEmail, setGuestEmail] = useState(defaultValues?.guest_email ?? "");
  const [partySize, setPartySize] = useState(defaultValues?.party_size ?? 2);
  const [tableId, setTableId] = useState(defaultValues?.table_id ?? "");
  const [date, setDate] = useState(
    defaultValues?.starts_at
      ? toLocalDate(new Date(defaultValues.starts_at), timeZone)
      : defaultDate ?? "",
  );
  const [time, setTime] = useState(
    defaultValues?.starts_at
      ? new Date(defaultValues.starts_at).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone,
        })
      : "",
  );
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(defaultValues?.internal_notes ?? "");
  const [saving, setSaving] = useState(false);

  // Reconocimiento de comensal: al escribir el nombre o el teléfono se buscan
  // fichas existentes para no duplicar clientes y ver su historial al momento.
  const [matches, setMatches] = useState<Guest[]>([]);
  const [linkedGuest, setLinkedGuest] = useState<Guest | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTables = tables.filter((t) => t.active);

  function lookupGuest(query: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (linkedGuest || query.trim().length < 3) {
      setMatches([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setMatches(await searchGuests(query));
      } catch {
        setMatches([]);
      }
    }, 300);
  }

  function applyGuest(guest: Guest) {
    setLinkedGuest(guest);
    setGuestName(guest.name);
    setGuestPhone(guest.phone);
    if (guest.email) setGuestEmail(guest.email);
    setMatches([]);
  }

  function clearLinkedGuest() {
    setLinkedGuest(null);
  }

  async function submit(overridePacing: boolean) {
    const startsAtISO = localDateTimeToUtc(date, time, timeZone).toISOString();

    const payload = {
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
      guest_email: guestEmail.trim() || null,
      party_size: partySize,
      starts_at: startsAtISO,
      table_id: tableId || null,
      notes: notes.trim() || null,
      internal_notes: internalNotes.trim() || null,
    };

    if (isEdit && defaultValues?.id) {
      return updateReservation(defaultValues.id, { ...payload, override_pacing: overridePacing });
    }
    return createReservation({ ...payload, source: "admin", override_pacing: overridePacing });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) { toast.error("Indica fecha y hora"); return; }
    if (!guestName.trim()) { toast.error("Indica el nombre del cliente"); return; }
    if (!guestPhone.trim()) { toast.error("Indica el teléfono"); return; }

    setSaving(true);
    try {
      const res = await submit(false);

      if ("error" in res && res.error) {
        // El pacing lo decide el maître: se ofrece forzar en lugar de bloquear.
        if ("code" in res && res.code === "PACING") {
          if (confirm(`${res.error}\n\n¿Crear la reserva de todos modos?`)) {
            const forced = await submit(true);
            if ("error" in forced && forced.error) { toast.error(forced.error); return; }
            toast.success("Reserva creada (pacing forzado)");
            router.refresh();
            onClose?.(date);
          }
          return;
        }
        toast.error(res.error);
        return;
      }

      toast.success(isEdit ? "Reserva actualizada" : "Reserva creada");
      router.refresh();
      onClose?.(date);
    } finally {
      setSaving(false);
    }
  }

  const today = toLocalDate(new Date(), timeZone);
  const maxDate = addDays(today, restaurant.max_advance_days);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {linkedGuest && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-900">
                <UserCheck className="h-4 w-4" />
                Cliente conocido
              </div>
              <p className="mt-0.5 text-xs text-emerald-800">
                {linkedGuest.visits_count} visita(s)
                {linkedGuest.no_shows_count > 0 && ` · ${linkedGuest.no_shows_count} no-show(s)`}
              </p>
              <GuestSignalBadges signals={guestSignals(linkedGuest)} className="mt-1.5" />
            </div>
            <button
              type="button"
              onClick={clearLinkedGuest}
              className="flex-shrink-0 text-xs text-emerald-700 underline hover:text-emerald-900"
            >
              Desvincular
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <label htmlFor="rf-name" className="block text-sm font-medium text-stone-700 mb-1.5">
            Nombre del cliente <span className="text-red-500">*</span>
          </label>
          <input
            id="rf-name"
            type="text"
            value={guestName}
            autoComplete="off"
            onChange={(e) => {
              setGuestName(e.target.value);
              lookupGuest(e.target.value);
            }}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {matches.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => applyGuest(g)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-stone-800">{g.name}</span>
                      <span className="block text-xs text-stone-400">{formatPhone(g.phone)}</span>
                    </span>
                    <span className="flex-shrink-0 text-xs text-stone-400">
                      {g.visits_count} visitas
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="rf-phone" className="block text-sm font-medium text-stone-700 mb-1.5">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            id="rf-phone"
            type="tel"
            value={guestPhone}
            autoComplete="off"
            onChange={(e) => {
              setGuestPhone(e.target.value);
              lookupGuest(e.target.value);
            }}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="rf-email" className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
        <input
          id="rf-email"
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="rf-date" className="block text-sm font-medium text-stone-700 mb-1.5">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            id="rf-date"
            type="date"
            value={date}
            min={today}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
        <div>
          <label htmlFor="rf-time" className="block text-sm font-medium text-stone-700 mb-1.5">
            Hora <span className="text-red-500">*</span>
          </label>
          <input
            id="rf-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step={60 * 15}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="rf-party" className="block text-sm font-medium text-stone-700 mb-1.5">
            Comensales <span className="text-red-500">*</span>
          </label>
          <input
            id="rf-party"
            type="number"
            value={partySize}
            min={1}
            max={restaurant.max_party_size}
            onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          />
        </div>
        <div>
          <label htmlFor="rf-table" className="block text-sm font-medium text-stone-700 mb-1.5">Mesa</label>
          <select
            id="rf-table"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
          >
            <option value="">Auto-asignar (junta mesas si hace falta)</option>
            {activeTables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.capacity} p.)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="rf-notes" className="block text-sm font-medium text-stone-700 mb-1.5">
          Notas del cliente
        </label>
        <textarea
          id="rf-notes"
          value={notes}
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Alergias, ocasión especial…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none"
        />
      </div>

      <div>
        <label htmlFor="rf-internal" className="block text-sm font-medium text-stone-700 mb-1.5">
          Notas internas
        </label>
        <textarea
          id="rf-internal"
          value={internalNotes}
          maxLength={500}
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
            onClick={() => onClose?.()}
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
