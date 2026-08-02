"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateGuest } from "@/actions/guests";
import { cn } from "@/lib/utils";
import type { Guest, GuestTag } from "@/types";

const TAG_LABELS: Record<GuestTag, string> = {
  vip: "VIP",
  habitual: "Habitual",
  alergias: "Alergias",
  celebracion: "Celebración",
  prensa: "Prensa",
  conflictivo: "Conflictivo",
};

const ALL_TAGS = Object.keys(TAG_LABELS) as GuestTag[];

/** Edita las notas de sala del comensal: alérgenos, preferencias y etiquetas. */
export function GuestProfileForm({ guest }: { guest: Guest }) {
  const [tags, setTags] = useState<GuestTag[]>(guest.tags ?? []);
  const [allergies, setAllergies] = useState(guest.allergies ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [isPending, startTransition] = useTransition();

  function toggleTag(tag: GuestTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await updateGuest(guest.id, {
        tags,
        allergies: allergies.trim() || null,
        notes: notes.trim() || null,
      });
      if ("error" in result && result.error) toast.error(result.error);
      else toast.success("Ficha actualizada");
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-stone-100 p-5 shadow-sm space-y-4">
      <h2 className="font-semibold text-stone-800">Notas de sala</h2>

      <div>
        <span className="mb-2 block text-xs font-medium text-stone-500">Etiquetas</span>
        <div className="flex flex-wrap gap-2">
          {ALL_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-amber-300 bg-amber-100 text-amber-900"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50",
                )}
              >
                {TAG_LABELS[tag]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="guest-allergies" className="mb-1 block text-xs font-medium text-stone-500">
          Alergias e intolerancias
        </label>
        <input
          id="guest-allergies"
          value={allergies}
          maxLength={300}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="Marisco, gluten…"
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
        <p className="mt-1 text-xs text-stone-400">
          Se muestra en cada reserva de este comensal, para que cocina lo sepa siempre.
        </p>
      </div>

      <div>
        <label htmlFor="guest-notes" className="mb-1 block text-xs font-medium text-stone-500">
          Notas internas
        </label>
        <textarea
          id="guest-notes"
          value={notes}
          maxLength={1000}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Prefiere mesa junto a la ventana, viene con carrito…"
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
      >
        {isPending ? "Guardando…" : "Guardar ficha"}
      </button>
    </div>
  );
}
