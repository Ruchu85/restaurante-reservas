"use client";

import { useState, useCallback } from "react";
import { Plus, Search, ChevronRight, Calendar, Users, Clock, X } from "lucide-react";
import { cn, formatTime, formatShortDate } from "@/lib/utils";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ReservationForm } from "@/components/dashboard/ReservationForm";
import type { Reservation, Restaurant, RestaurantTable } from "@/types";
import { updateReservationStatus } from "@/actions/reservations";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  seated: "En mesa",
  completed: "Completada",
  no_show: "No llegó",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-stone-100 text-stone-600",
  no_show: "bg-red-100 text-red-800",
  cancelled: "bg-stone-100 text-stone-400",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "seated", label: "En mesa" },
  { value: "completed", label: "Completadas" },
  { value: "no_show", label: "No llegaron" },
  { value: "cancelled", label: "Canceladas" },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[status])}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

interface Props {
  restaurant: Restaurant;
  tables: RestaurantTable[];
  initialReservations: Reservation[];
  initialDate: string;
}

export function ReservasClient({ restaurant, tables, initialReservations, initialDate }: Props) {
  const [date, setDate] = useState(initialDate);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Reservation | null>(null);

  const fetchForDate = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/reservations?date=${d}`);
      const data = await res.json();
      setReservations(data.reservations ?? []);
    } catch {
      toast.error("Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleDateChange(d: string) {
    setDate(d);
    fetchForDate(d);
  }

  const filtered = reservations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.guest_name.toLowerCase().includes(q) || r.guest_phone.includes(q);
    }
    return true;
  });

  async function handleStatusChange(id: string, status: Reservation["status"]) {
    const res = await updateReservationStatus(id, status);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Estado actualizado");
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Reservas</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white border border-stone-100 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre o teléfono…"
              className="w-full rounded-lg border border-stone-200 pl-9 pr-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s.value
                  ? "bg-amber-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="text-xs text-stone-500">
          {filtered.length} reserva{filtered.length !== 1 ? "s" : ""} ·{" "}
          {filtered.filter(r => r.status !== "cancelled").reduce((s, r) => s + r.party_size, 0)} comensales
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-stone-400 text-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Sin reservas</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 transition-colors text-left"
              >
                <div className="flex-shrink-0 w-14">
                  <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at)}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTime(r.ends_at)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">{r.guest_name}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" />{r.party_size}
                    </span>
                    {r.table && <span>· {r.table.name}</span>}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <ChevronRight className="h-4 w-4 text-stone-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New reservation dialog */}
      <DialogPrimitive.Root open={showNew} onOpenChange={setShowNew}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <DialogPrimitive.Title className="text-lg font-bold text-stone-800">
                Nueva reserva
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="p-1 rounded-lg hover:bg-stone-100">
                <X className="h-4 w-4 text-stone-500" />
              </DialogPrimitive.Close>
            </div>
            <ReservationForm
              restaurant={restaurant}
              tables={tables}
              onClose={() => { setShowNew(false); fetchForDate(date); }}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Detail dialog */}
      <DialogPrimitive.Root open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-xl">
            {selected && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <DialogPrimitive.Title className="text-lg font-bold text-stone-800">
                    {selected.guest_name}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close className="p-1 rounded-lg hover:bg-stone-100">
                    <X className="h-4 w-4 text-stone-500" />
                  </DialogPrimitive.Close>
                </div>

                <p className="text-sm text-stone-500 mb-4">
                  {formatShortDate(selected.starts_at)} · {formatTime(selected.starts_at)} · {selected.party_size} personas
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div><div className="text-xs text-stone-400">Teléfono</div><div className="font-medium">{selected.guest_phone}</div></div>
                  {selected.guest_email && <div><div className="text-xs text-stone-400">Email</div><div className="font-medium truncate">{selected.guest_email}</div></div>}
                  <div><div className="text-xs text-stone-400">Mesa</div><div className="font-medium">{selected.table?.name ?? "Sin asignar"}</div></div>
                  <div><div className="text-xs text-stone-400">Estado</div><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
                  <div><div className="text-xs text-stone-400">Origen</div><div className="font-medium capitalize">{selected.source}</div></div>
                </div>

                {selected.notes && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-50 text-sm text-stone-600">
                    <div className="text-xs font-medium text-stone-400 mb-1">Notas del cliente</div>
                    {selected.notes}
                  </div>
                )}
                {selected.internal_notes && (
                  <div className="mb-3 p-3 rounded-lg bg-stone-50 text-sm text-stone-600">
                    <div className="text-xs font-medium text-stone-400 mb-1">Notas internas</div>
                    {selected.internal_notes}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium text-stone-400 uppercase tracking-wide">Cambiar estado</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["confirmed", "seated", "completed", "no_show", "cancelled"] as const).map((s) => (
                      <button
                        key={s}
                        disabled={selected.status === s}
                        onClick={() => handleStatusChange(selected.id, s)}
                        className={cn(
                          "rounded-lg py-2 text-xs font-medium transition-colors border",
                          selected.status === s
                            ? "bg-amber-600 text-white border-amber-600 cursor-default"
                            : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100",
                        )}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
