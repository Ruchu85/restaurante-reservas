"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Check, ChevronRight, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
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

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function BookingWizard({ maxPartySize = 10 }: { maxPartySize?: number }) {
  const [step, setStep] = useState<Step>("date-party");
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedReservation | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split("T")[0];

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
      timeZone: "Europe/Madrid",
    });

  const formatDateDisplay = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

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
            <span className="font-medium capitalize">{formatDateDisplay(date)}</span>
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
                  ? "bg-amber-600 text-white"
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
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              Fecha
            </label>
            <input
              type="date"
              value={date}
              min={today}
              max={maxDateStr}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              Número de comensales
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PARTY_OPTIONS.filter((n) => n <= maxPartySize).map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n)}
                  className={cn(
                    "rounded-xl py-3 text-sm font-semibold transition-all border",
                    partySize === n
                      ? "bg-amber-600 text-white border-amber-600 shadow-md"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-300 hover:text-amber-700",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {maxPartySize > 8 && (
              <p className="text-xs text-stone-400 mt-2">
                Para más de 8 personas, por favor llámenos directamente.
              </p>
            )}
          </div>

          <button
            onClick={handleDatePartyNext}
            disabled={!date}
            className="w-full rounded-xl bg-amber-600 py-3.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
              <p className="text-sm text-stone-500 capitalize">
                {formatDateDisplay(date)} · {partySize} {partySize === 1 ? "comensal" : "comensales"}
              </p>
            </div>
          </div>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-stone-500 mb-4">No hay disponibilidad para esta fecha.</p>
              <button
                onClick={() => setStep("date-party")}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                Prueba otra fecha
              </button>
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
                      ? "bg-amber-600 text-white border-amber-600 shadow-md"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:border-amber-300 hover:text-amber-700",
                  )}
                >
                  {formatTime(slot.starts_at)}
                </button>
              ))}
            </div>
          )}

          {selectedSlot && (
            <button
              onClick={() => setStep("contact")}
              className="w-full rounded-xl bg-amber-600 py-3.5 font-semibold text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
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
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Juan García"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email <span className="text-stone-400 font-normal">(opcional)</span>
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Alergias o peticiones especiales <span className="text-stone-400 font-normal">(opcional)</span>
              </label>
              <textarea
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
            className="w-full rounded-xl bg-amber-600 py-3.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
