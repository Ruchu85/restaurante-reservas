"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Check, ChevronRight, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLocalDate, addDays } from "@/lib/dates";
import { toast } from "sonner";

type Step = "date-party" | "time" | "contact" | "done";

interface TimeSlot {
  starts_at: string;
  ends_at: string;
  available_tables: number;
}

interface ConfirmedReservation {
  id: string;
  confirmation_token: string;
  starts_at: string;
  guest_name: string;
  party_size: number;
}

/**
 * Las opciones salen del máximo que tenga configurado el restaurante. Estaban
 * fijas en 8 mientras la web anunciaba grupos de hasta 10: el cliente llegaba
 * aquí y no encontraba su tamaño de mesa.
 */
function opcionesComensales(max: number): number[] {
  return Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);
}

const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Atajos de fecha, saltándose los días de cierre.
 *
 * Ofrecer "Hoy" sin mirar el horario mandaba al visitante, dos días de cada
 * siete, a un "no hay disponibilidad" que no explicaba nada.
 */
function atajosFecha(hoy: string, diasAbiertos: number[]): { etiqueta: string; fecha: string }[] {
  return Array.from({ length: 21 }, (_, n) => addDays(hoy, n))
    .filter((f) => diasAbiertos.length === 0 || diasAbiertos.includes(diaSemana(f)))
    .slice(0, 4)
    .map((fecha) => ({
      fecha,
      etiqueta:
        fecha === hoy ? "Hoy" : fecha === addDays(hoy, 1) ? "Mañana" : NOMBRES_DIA[diaSemana(fecha)],
    }));
}

export function BookingWizard({
  maxPartySize = 10,
  maxAdvanceDays = 30,
  timeZone = "Europe/Madrid",
  fechaInicial = "",
  comensalesIniciales = 2,
  diasAbiertos = [],
  telefono,
}: {
  maxPartySize?: number;
  maxAdvanceDays?: number;
  timeZone?: string;
  /** Vienen del selector rápido del hero, por la URL. */
  fechaInicial?: string;
  comensalesIniciales?: number;
  /** Días de la semana con servicio (0 = domingo). */
  diasAbiertos?: number[];
  /** Para ofrecer una salida cuando no hay hueco: llamar. */
  telefono?: string | null;
}) {
  const [step, setStep] = useState<Step>("date-party");
  const [date, setDate] = useState(fechaInicial);
  const [partySize, setPartySize] = useState(comensalesIniciales);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedReservation | null>(null);

  // Día natural del restaurante: con `toISOString()` a las 00:30 de Madrid en
  // verano el mínimo del selector era ayer. El máximo sale de la configuración
  // del restaurante, para no ofrecer fechas que el servidor va a rechazar.
  const today = toLocalDate(new Date(), timeZone);
  const maxDateStr = addDays(today, maxAdvanceDays);

  // Para explicar un resultado vacío: distinguir "ese día cerramos" de "ese
  // día está lleno" cambia por completo lo que hay que decirle al visitante.
  const cerradoEseDia =
    !!date && diasAbiertos.length > 0 && !diasAbiertos.includes(diaSemana(date));
  const proximoDiaAbierto = date
    ? Array.from({ length: 21 }, (_, n) => addDays(date, n + 1)).find(
        (f) => diasAbiertos.length === 0 || diasAbiertos.includes(diaSemana(f)),
      )
    : undefined;

  const loadSlots = useCallback(async (d: string, ps: number) => {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const res = await fetch(`/api/reservations?date=${d}&party_size=${ps}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      toast.error("Error al cargar horarios disponibles");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  async function handleDatePartyNext() {
    if (!date) { toast.error("Selecciona una fecha"); return; }
    await loadSlots(date, partySize);
    setStep("time");
  }

  async function handleSubmit() {
    if (!selectedSlot) return;
    if (!guestName.trim() || guestName.trim().length < 2) {
      toast.error("Escribe tu nombre completo (mínimo 2 caracteres)");
      return;
    }
    const phoneClean = guestPhone.trim();
    if (!phoneClean || !/^[+\d\s\-().]{6,30}$/.test(phoneClean)) {
      toast.error("Introduce un número de teléfono válido");
      return;
    }
    if (guestEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      toast.error("El email no tiene un formato válido");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          starts_at: selectedSlot.starts_at,
          party_size: partySize,
          guest_name: guestName.trim(),
          guest_phone: guestPhone.trim(),
          guest_email: guestEmail.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Error al crear la reserva");
        return;
      }

      setConfirmed(data.reservation);
      setStep("done");
    } catch {
      toast.error("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });

  const formatDateDisplayLower = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  // En español los días de la semana no llevan mayúscula, salvo al empezar
  // frase. Para las etiquetas independientes ("Martes, 11 de agosto") sí
  // hace falta; para el texto que sigue a "el" (línea del próximo servicio)
  // se usa la variante en minúscula, o quedaba "es el Miércoles, 12…".
  const formatDateDisplay = (d: string) => {
    const texto = formatDateDisplayLower(d);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };

  if (step === "done" && confirmed) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">¡Reserva confirmada!</h2>
        <p className="text-stone-500 mb-8 max-w-sm mx-auto">
          Hemos guardado tu reserva. Te esperamos el{" "}
          <strong>{formatDateDisplay(date)}</strong> a las{" "}
          <strong>{formatTime(confirmed.starts_at)}</strong>.
        </p>

        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 max-w-sm mx-auto mb-8 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Nombre</span>
            <span className="font-medium">{confirmed.guest_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Comensales</span>
            <span className="font-medium">{confirmed.party_size} personas</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Fecha</span>
            <span className="font-medium">{formatDateDisplay(date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Hora</span>
            <span className="font-medium">{formatTime(confirmed.starts_at)}</span>
          </div>
          <div className="border-t border-amber-200 pt-3">
            <div className="text-xs text-stone-400 mb-1">Código de reserva</div>
            <div className="text-xs font-mono text-stone-600 break-all">{confirmed.confirmation_token}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <Link
            href={`/reservar/${confirmed.confirmation_token}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-amber-200 bg-white py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
          >
            Ver o cancelar mi reserva
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="text-sm text-stone-400 hover:text-stone-600 font-medium"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {(["date-party", "time", "contact"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors",
                step === s
                  ? "bg-amber-700 text-white"
                  : (["date-party", "time", "contact"].indexOf(step) > i)
                    ? "bg-amber-100 text-amber-700"
                    : "bg-stone-100 text-stone-400",
              )}
            >
              {(["date-party", "time", "contact"].indexOf(step) > i) ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div className={cn(
                "h-0.5 flex-1 rounded transition-colors",
                (["date-party", "time", "contact"].indexOf(step) > i)
                  ? "bg-amber-300"
                  : "bg-stone-200",
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Date & Party */}
      {step === "date-party" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-stone-800 mb-1">¿Cuándo venís?</h2>
            <p className="text-sm text-stone-500">Selecciona la fecha y el número de comensales</p>
          </div>

          <div>
            <label htmlFor="reserva-fecha" className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-700" aria-hidden />
              Fecha
            </label>
            <div className="mb-2 grid grid-cols-4 gap-2">
              {atajosFecha(today, diasAbiertos).map((a) => (
                <button
                  key={a.fecha}
                  type="button"
                  onClick={() => setDate(a.fecha)}
                  className={cn(
                    "rounded-xl border py-3.5 text-xs font-semibold transition-all",
                    date === a.fecha
                      ? "border-amber-700 bg-amber-700 text-white shadow-md"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-amber-300 hover:text-amber-800",
                  )}
                >
                  {a.etiqueta}
                </button>
              ))}
            </div>
            <input
              id="reserva-fecha"
              name="fecha"
              type="date"
              value={date}
              min={today}
              max={maxDateStr}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
          </div>

          <div>
            <span id="reserva-pax" className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-700" aria-hidden />
              Número de comensales
            </span>
            <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="reserva-pax">
              {opcionesComensales(maxPartySize).map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n)}
                  className={cn(
                    "rounded-xl py-3 text-sm font-semibold transition-all border",
                    partySize === n
                      ? "bg-amber-700 text-white border-amber-700 shadow-md"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300 hover:text-amber-700",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Para grupos de más de {maxPartySize} personas, llámanos y lo organizamos contigo.
            </p>
          </div>

          <button
            onClick={handleDatePartyNext}
            disabled={!date}
            className="w-full rounded-xl bg-amber-700 py-3.5 font-semibold text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            Ver horarios disponibles
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 2: Time */}
      {step === "time" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("date-party")}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-stone-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Elige horario</h2>
              <p className="text-sm text-stone-500">
                {formatDateDisplay(date)} · {partySize} {partySize === 1 ? "comensal" : "comensales"}
              </p>
            </div>
          </div>

          <div aria-live="polite" aria-busy={loadingSlots}>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12">
              {/* Un "no hay disponibilidad" a secas deja al visitante sin
                  salida: si el motivo es que ese día se cierra, hay que
                  decirlo y ofrecer el siguiente servicio de un clic. */}
              {cerradoEseDia ? (
                <>
                  <p className="text-stone-600 mb-1 font-medium">
                    Los {NOMBRES_DIA[diaSemana(date)].toLowerCase()} cerramos.
                  </p>
                  {proximoDiaAbierto && (
                    <>
                      <p className="text-sm text-stone-500 mb-4">
                        El próximo servicio es el {formatDateDisplayLower(proximoDiaAbierto)}.
                      </p>
                      <button
                        onClick={() => {
                          setDate(proximoDiaAbierto);
                          loadSlots(proximoDiaAbierto, partySize);
                        }}
                        className="rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
                      >
                        Ver ese día
                      </button>
                      {telefono && (
                        <p className="mt-4 text-sm text-stone-500">
                          ¿Prefieres hablarlo?{" "}
                          <a
                            href={`tel:${telefono}`}
                            className="inline-block py-1 font-medium text-amber-800 underline underline-offset-4"
                          >
                            {telefono}
                          </a>
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-stone-600 mb-4">
                    No queda mesa libre para {partySize}{" "}
                    {partySize === 1 ? "persona" : "personas"} ese día.
                  </p>
                  <button
                    onClick={() => setStep("date-party")}
                    className="rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
                  >
                    Probar otra fecha
                  </button>
                  {telefono && (
                    <p className="mt-4 text-sm text-stone-500">
                      A veces guardamos alguna mesa por teléfono:{" "}
                      <a
                        href={`tel:${telefono}`}
                        className="inline-block py-1 font-medium text-amber-800 underline underline-offset-4"
                      >
                        {telefono}
                      </a>
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.starts_at}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "rounded-xl py-3 text-sm font-semibold transition-all border",
                    selectedSlot?.starts_at === slot.starts_at
                      ? "bg-amber-700 text-white border-amber-700 shadow-md"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:border-amber-300 hover:text-amber-700",
                  )}
                >
                  {formatTime(slot.starts_at)}
                </button>
              ))}
            </div>
          )}
          </div>

          {selectedSlot && (
            <button
              onClick={() => setStep("contact")}
              className="w-full rounded-xl bg-amber-700 py-3.5 font-semibold text-white hover:bg-amber-800 transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Step 3: Contact */}
      {step === "contact" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("time")}
              className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-stone-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Tus datos</h2>
              <p className="text-sm text-stone-500">
                {formatDateDisplay(date)} · {selectedSlot && formatTime(selectedSlot.starts_at)} · {partySize} {partySize === 1 ? "persona" : "personas"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              {/* `htmlFor`/`id` en cada par: sin ellos un lector de pantalla
                  anuncia cuatro campos sin nombre, justo en el formulario que
                  genera el negocio. `autoComplete` para que el navegador pueda
                  rellenarlos. */}
              <label htmlFor="reserva-nombre" className="block text-sm font-medium text-stone-700 mb-1.5">
                Nombre completo <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="reserva-nombre"
                name="nombre"
                type="text"
                required
                autoComplete="name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Juan García"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="reserva-telefono" className="block text-sm font-medium text-stone-700 mb-1.5">
                Teléfono <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                id="reserva-telefono"
                name="telefono"
                type="tel"
                required
                autoComplete="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="reserva-email" className="block text-sm font-medium text-stone-700 mb-1.5">
                Email <span className="text-stone-500 font-normal">(opcional)</span>
              </label>
              <input
                id="reserva-email"
                name="email"
                type="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label htmlFor="reserva-notas" className="block text-sm font-medium text-stone-700 mb-1.5">
                Alergias o peticiones especiales{" "}
                <span className="text-stone-500 font-normal">(opcional)</span>
              </label>
              <textarea
                id="reserva-notas"
                name="notas"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej: alergia al marisco, trona para bebé…"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all resize-none"
              />
            </div>
          </div>

          <p className="text-xs text-stone-400">
            Puedes cancelar tu reserva con hasta 2 horas de antelación.
          </p>

          <button
            onClick={handleSubmit}
            disabled={submitting || !guestName.trim() || !guestPhone.trim()}
            className="w-full rounded-xl bg-amber-700 py-3.5 font-semibold text-white hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirmando reserva…
              </>
            ) : (
              <>
                Confirmar reserva
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
