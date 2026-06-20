"use client";

import { useState } from "react";
import { ListOrdered, Plus, Check, Bell, X, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { addToWaitlist, updateWaitlistStatus } from "@/actions/waitlist";
import type { WaitlistEntry } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  waiting: "Esperando",
  notified: "Notificado",
  seated: "Sentado",
  removed: "Eliminado",
};

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800",
  notified: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  removed: "bg-stone-100 text-stone-500",
};

export function ListaEsperaClient({ entries: initialEntries }: { entries: WaitlistEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[]>(initialEntries);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    guest_name: "",
    guest_phone: "",
    party_size: 2,
    preferred_date: new Date().toISOString().split("T")[0],
    preferred_time: "",
    notes: "",
  });

  async function handleAdd() {
    if (!form.guest_name.trim() || !form.guest_phone.trim()) {
      toast.error("Nombre y teléfono obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await addToWaitlist({
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim(),
        party_size: form.party_size,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time || null,
        notes: form.notes.trim() || null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Añadido a la lista de espera");
      router.refresh();
      setShowNew(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, status: WaitlistEntry["status"]) {
    const res = await updateWaitlistStatus(id, status);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Estado actualizado");
    setEntries((prev) =>
      status === "seated" || status === "removed"
        ? prev.filter((e) => e.id !== id)
        : prev.map((e) => e.id === id ? { ...e, status } : e),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-800">Lista de espera</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Añadir
        </button>
      </div>

      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <div className="py-14 text-center">
            <ListOrdered className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">La lista de espera está vacía</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {entries.map((e, idx) => (
              <div key={e.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-800">{e.guest_name}</div>
                  <div className="text-xs text-stone-500 flex flex-wrap gap-2 mt-0.5">
                    <span>{e.guest_phone}</span>
                    <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{e.party_size}</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{e.preferred_date}{e.preferred_time && ` ${e.preferred_time}`}</span>
                  </div>
                  {e.notes && <div className="text-xs text-stone-400 mt-0.5 truncate">{e.notes}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_COLORS[e.status])}>
                    {STATUS_LABELS[e.status]}
                  </span>
                  {e.status === "waiting" && (
                    <button
                      onClick={() => handleStatus(e.id, "notified")}
                      title="Marcar como notificado"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-stone-400 hover:text-blue-600 transition-colors"
                    >
                      <Bell className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleStatus(e.id, "seated")}
                    title="Sentar"
                    className="p-1.5 rounded-lg hover:bg-green-50 text-stone-400 hover:text-green-600 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleStatus(e.id, "removed")}
                    title="Eliminar"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DialogPrimitive.Root open={showNew} onOpenChange={(o) => !o && setShowNew(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <DialogPrimitive.Title className="text-lg font-bold text-stone-800">
                Añadir a la lista
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="p-1 rounded-lg hover:bg-stone-100">
                <X className="h-4 w-4 text-stone-500" />
              </DialogPrimitive.Close>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Nombre *</label>
                <input type="text" value={form.guest_name} onChange={(e) => setForm(f => ({ ...f, guest_name: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Teléfono *</label>
                <input type="tel" value={form.guest_phone} onChange={(e) => setForm(f => ({ ...f, guest_phone: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Comensales</label>
                  <input type="number" min={1} max={20} value={form.party_size} onChange={(e) => setForm(f => ({ ...f, party_size: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Fecha preferida</label>
                  <input type="date" value={form.preferred_date} onChange={(e) => setForm(f => ({ ...f, preferred_date: e.target.value }))}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Hora preferida</label>
                <input type="time" value={form.preferred_time} onChange={(e) => setForm(f => ({ ...f, preferred_time: e.target.value }))}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <DialogPrimitive.Close asChild>
                  <button className="flex-1 rounded-lg border border-stone-200 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">Cancelar</button>
                </DialogPrimitive.Close>
                <button onClick={handleAdd} disabled={saving}
                  className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                  {saving ? "Añadiendo…" : "Añadir"}
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
