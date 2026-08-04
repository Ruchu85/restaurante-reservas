"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";

interface Props {
  /** Día natural del restaurante, ya en su zona horaria. */
  hoy: string;
  /** Días de la semana con servicio (0 = domingo), para no ofrecer cierres. */
  diasAbiertos: number[];
  maxComensales: number;
}

const NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Selector de reserva dentro del hero.
 *
 * El patrón del sector (Resy, SevenRooms, OpenTable) es empezar la reserva
 * donde el visitante ya está mirando, no mandarlo a un formulario vacío. Aquí
 * solo se recogen fecha y comensales; la elección de hora sigue en /reservar,
 * que es quien consulta la disponibilidad real.
 *
 * Los atajos solo muestran días con servicio. Ofreciendo "Hoy" sin mirar el
 * calendario, dos días de cada siete el botón principal de la portada llevaba
 * derecho a un "no hay disponibilidad".
 */
export function ReservaRapida({ hoy, diasAbiertos, maxComensales }: Props) {
  const router = useRouter();

  // Los cuatro próximos días con servicio, empezando por hoy si está abierto.
  const dias = Array.from({ length: 21 }, (_, n) => sumarDias(hoy, n))
    .filter((f) => diasAbiertos.length === 0 || diasAbiertos.includes(diaSemana(f)))
    .slice(0, 4)
    .map((f, i) => ({
      f,
      etiqueta: f === hoy ? "Hoy" : f === sumarDias(hoy, 1) ? "Mañana" : NOMBRES[diaSemana(f)],
      i,
    }));

  const [fecha, setFecha] = useState(dias[0]?.f ?? hoy);
  const [pax, setPax] = useState(2);

  // Quien quiera otro día no tiene por qué irse a /reservar y empezar de cero.
  const otroDia = !dias.some((d) => d.f === fecha);

  const opciones = Array.from({ length: Math.min(maxComensales, 10) }, (_, i) => i + 1);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/reservar?fecha=${fecha}&pax=${pax}`);
      }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/15 bg-stone-950/50 p-3 backdrop-blur-md sm:flex-row sm:items-end"
    >
      <div className="flex-1 text-left">
        <label htmlFor="rr-otra" className="mb-1.5 block px-1 text-xs font-medium text-stone-200">
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
                fecha === f && !otroDia
                  ? "bg-white text-stone-900"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <input
          id="rr-otra"
          type="date"
          value={fecha}
          min={hoy}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          className={`foco-claro mt-1.5 h-11 w-full rounded-xl border-0 bg-white/10 px-3 text-xs text-white transition-colors hover:bg-white/20 [color-scheme:dark] ${
            otroDia ? "ring-1 ring-white" : ""
          }`}
        />
      </div>

      <div className="text-left sm:w-36">
        <label htmlFor="rr-pax" className="mb-1.5 block px-1 text-xs font-medium text-stone-200">
          Comensales
        </label>
        {/* `appearance-none` quita también la flecha, y sin ella el campo se
            lee como desactivado: se repone con un icono encima. */}
        <div className="relative">
          <select
            id="rr-pax"
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            className="foco-claro h-11 w-full appearance-none rounded-xl bg-white/10 pl-3 pr-9 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            {opciones.map((n) => (
              <option key={n} value={n} className="text-stone-900">
                {n} {n === 1 ? "persona" : "personas"}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
            aria-hidden
          />
        </div>
      </div>

      <button
        type="submit"
        className="foco-claro group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-6 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition-colors hover:bg-amber-600"
      >
        Ver horas libres
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </form>
  );
}
