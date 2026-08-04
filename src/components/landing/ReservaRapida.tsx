"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface Props {
  /** Día natural del restaurante, ya en su zona horaria. */
  hoy: string;
  maxComensales: number;
}

const NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/**
 * Selector de reserva dentro del hero.
 *
 * El patrón del sector (Resy, SevenRooms, OpenTable) es empezar la reserva
 * donde el visitante ya está mirando, no mandarlo a un formulario vacío. Aquí
 * solo se recogen fecha y comensales; la elección de hora sigue en /reservar,
 * que es quien consulta la disponibilidad real.
 */
export function ReservaRapida({ hoy, maxComensales }: Props) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoy);
  const [pax, setPax] = useState(2);

  const dias = [0, 1, 2, 3].map((n) => {
    const f = sumarDias(hoy, n);
    const [a, m, d] = f.split("-").map(Number);
    const etiqueta =
      n === 0 ? "Hoy" : n === 1 ? "Mañana" : NOMBRES[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
    return { f, etiqueta };
  });

  const opciones = Array.from({ length: Math.min(maxComensales, 10) }, (_, i) => i + 1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/reservar?fecha=${fecha}&pax=${pax}`);
      }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-stone-950/45 p-3 backdrop-blur-md sm:flex-row sm:items-end"
    >
      <div className="flex-1 text-left">
        <label htmlFor="rr-fecha" className="mb-1.5 block px-1 text-xs font-medium text-stone-300">
          Día
        </label>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Elegir día">
          {dias.map(({ f, etiqueta }) => (
            <button
              key={f}
              type="button"
              onClick={() => setFecha(f)}
              aria-pressed={fecha === f}
              className={`foco-claro h-11 rounded-xl px-2 text-xs font-semibold transition-colors ${
                fecha === f
                  ? "bg-white text-stone-900"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        {/* Campo oculto tras los atajos: quien quiera otro día lo elige aquí. */}
        <input id="rr-fecha" type="hidden" value={fecha} readOnly />
      </div>

      <div className="text-left sm:w-32">
        <label htmlFor="rr-pax" className="mb-1.5 block px-1 text-xs font-medium text-stone-300">
          Comensales
        </label>
        <select
          id="rr-pax"
          value={pax}
          onChange={(e) => setPax(Number(e.target.value))}
          className="foco-claro h-11 w-full appearance-none rounded-xl bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          {opciones.map((n) => (
            <option key={n} value={n} className="text-stone-900">
              {n} {n === 1 ? "persona" : "personas"}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="foco-claro group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-6 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition-colors hover:bg-amber-600"
      >
        Ver horas libres
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
