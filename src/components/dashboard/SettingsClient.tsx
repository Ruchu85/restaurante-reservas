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
    max_covers_per_slot: restaurant?.max_covers_per_slot ?? 0,
    last_seating_offset_minutes: restaurant?.last_seating_offset_minutes ?? 0,
    large_party_threshold: restaurant?.large_party_threshold ?? 6,
    large_party_duration_minutes: restaurant?.large_party_duration_minutes ?? 0,
    block_online_after_no_shows: restaurant?.block_online_after_no_shows ?? 0,
  });
  const [allowCombination, setAllowCombination] = useState(
    restaurant?.allow_table_combination ?? true,
  );

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
        // 0 significa "sin límite" / "usar el valor por defecto".
        max_covers_per_slot: form.max_covers_per_slot || null,
        large_party_duration_minutes: form.large_party_duration_minutes || null,
        block_online_after_no_shows: form.block_online_after_no_shows || null,
        allow_table_combination: allowCombination,
      });
      if ("error" in res && res.error) {
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

      <div className="rounded-2xl bg-white border border-stone-100 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-700">Gestión de sala</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            Controla el ritmo de entrada a cocina y cómo se acomodan los grupos grandes.
          </p>
        </div>

        <div>
          <label
            htmlFor="max_covers_per_slot"
            className="block text-xs font-medium text-stone-500 mb-1.5"
          >
            Máx. comensales por franja de 30 min
          </label>
          <input
            id="max_covers_per_slot"
            type="number"
            name="max_covers_per_slot"
            value={form.max_covers_per_slot}
            onChange={handleChange}
            min={0}
            max={2000}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">
            Evita que entren 40 comensales a la vez y se sature la cocina. 0 = sin límite.
            Puedes afinarlo por día en Horarios.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowCombination}
            onChange={(e) => setAllowCombination(e.target.checked)}
            className="mt-0.5 rounded border-stone-300 accent-amber-600"
          />
          <span className="text-xs text-stone-600">
            <span className="block font-medium text-stone-700">Juntar mesas automáticamente</span>
            Si un grupo no cabe en una sola mesa, se le asignan varias de la misma zona
            (hasta 3). Puedes excluir mesas concretas desde la pantalla de Mesas.
          </span>
        </label>

        <div>
          <label
            htmlFor="last_seating_offset_minutes"
            className="block text-xs font-medium text-stone-500 mb-1.5"
          >
            Última entrada, minutos antes del cierre
          </label>
          <input
            id="last_seating_offset_minutes"
            type="number"
            name="last_seating_offset_minutes"
            value={form.last_seating_offset_minutes}
            onChange={handleChange}
            min={0}
            max={240}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">
            Con cierre a las 16:00 y 45 min aquí, la última mesa entra a las 15:15 aunque
            la sobremesa pase de la hora de cierre. 0 = la reserva debe caber entera
            antes del cierre.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="large_party_threshold"
              className="block text-xs font-medium text-stone-500 mb-1.5"
            >
              Grupo grande a partir de
            </label>
            <input
              id="large_party_threshold"
              type="number"
              name="large_party_threshold"
              value={form.large_party_threshold}
              onChange={handleChange}
              min={1}
              max={50}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="large_party_duration_minutes"
              className="block text-xs font-medium text-stone-500 mb-1.5"
            >
              Duración para grupos grandes (min)
            </label>
            <input
              id="large_party_duration_minutes"
              type="number"
              name="large_party_duration_minutes"
              value={form.large_party_duration_minutes}
              onChange={handleChange}
              min={0}
              max={480}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-stone-400">
          Un grupo de diez no ocupa la mesa lo mismo que una pareja. 0 = usar la
          duración general.
        </p>

        <div>
          <label
            htmlFor="block_online_after_no_shows"
            className="block text-xs font-medium text-stone-500 mb-1.5"
          >
            Bloquear reserva online tras N no-shows
          </label>
          <input
            id="block_online_after_no_shows"
            type="number"
            name="block_online_after_no_shows"
            value={form.block_online_after_no_shows}
            onChange={handleChange}
            min={0}
            max={20}
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">
            Quien acumule ese número de no-shows tendrá que llamar para reservar, y
            decidís vosotros. 0 = sin bloqueo.
          </p>
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
