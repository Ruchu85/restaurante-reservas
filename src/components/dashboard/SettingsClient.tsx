"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateRestaurant } from "@/actions/restaurant";
import type { Restaurant } from "@/types";

export function SettingsClient({ restaurant }: { restaurant: Restaurant | null }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: restaurant?.name ?? "",
    address: restaurant?.address ?? "",
    phone: restaurant?.phone ?? "",
    email: restaurant?.email ?? "",
    description: restaurant?.description ?? "",
    website: restaurant?.website ?? "",
    max_party_size: restaurant?.max_party_size ?? 10,
    min_advance_hours: restaurant?.min_advance_hours ?? 1,
    max_advance_days: restaurant?.max_advance_days ?? 30,
    reservation_duration_minutes: restaurant?.reservation_duration_minutes ?? 90,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "number" ? parseInt(value) || 0 : value,
    }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateRestaurant({
        ...form,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        description: form.description || null,
        website: form.website || null,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Ajustes guardados");
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="rounded-2xl bg-white border border-stone-100 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Información del restaurante</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Nombre *</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Teléfono</label>
            <input name="phone" value={form.phone} onChange={handleChange}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Dirección</label>
            <input name="address" value={form.address} onChange={handleChange}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Web</label>
            <input name="website" type="url" value={form.website} onChange={handleChange} placeholder="https://…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Descripción</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none resize-none" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-stone-100 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Configuración de reservas</h2>

        <div className="grid grid-cols-2 gap-4">
          {[
            { name: "max_party_size", label: "Máx. comensales por reserva", min: 1, max: 50 },
            { name: "reservation_duration_minutes", label: "Duración por reserva (min)", min: 30, max: 480 },
            { name: "min_advance_hours", label: "Antelación mínima (horas)", min: 0, max: 72 },
            { name: "max_advance_days", label: "Días máximos de antelación", min: 1, max: 365 },
          ].map(({ name, label, min, max }) => (
            <div key={name}>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">{label}</label>
              <input type="number" name={name}
                value={(form as Record<string, string | number>)[name] as number}
                onChange={handleChange} min={min} max={max}
                className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isPending}
        className="w-full rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar ajustes
      </button>
    </form>
  );
}
