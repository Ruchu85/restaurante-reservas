"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";

/** Buscador de comensales por nombre, teléfono o email. */
export function GuestSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  function submit(next: string) {
    startTransition(() => {
      router.push(next.trim() ? `/dashboard/comensales?q=${encodeURIComponent(next.trim())}` : "/dashboard/comensales");
    });
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar por nombre, teléfono o email…"
        aria-label="Buscar comensales"
        className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-9 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setValue("");
            submit("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {isPending && (
        <span className="absolute -bottom-5 left-1 text-xs text-stone-400">Buscando…</span>
      )}
    </form>
  );
}
