"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cancelReservationByToken } from "@/actions/reservations";
import { Calendar, Clock, Users, MapPin, AlertTriangle, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import type { Reservation } from "@/types";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed: { label: "Confirmada", color: "bg-green-100 text-green-700", icon: <CheckCircle className="h-4 w-4" /> },
  seated: { label: "En mesa", color: "bg-blue-100 text-blue-700", icon: <CheckCircle className="h-4 w-4" /> },
  completed: { label: "Completada", color: "bg-stone-100 text-stone-600", icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-600", icon: <XCircle className="h-4 w-4" /> },
  no_show: { label: "No presentado", color: "bg-orange-100 text-orange-600", icon: <XCircle className="h-4 w-4" /> },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Madrid",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60);
}

interface Props {
  reservation: Reservation;
  restaurantName: string;
}

export function ReservationDetailClient({ reservation, restaurantName }: Props) {
  const [cancelled, setCancelled] = useState(reservation.status === "cancelled");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canCancel =
    !cancelled &&
    reservation.status !== "completed" &&
    reservation.status !== "no_show" &&
    hoursUntil(reservation.starts_at) > 2;

  const tooLateToCancel =
    !cancelled &&
    reservation.status === "confirmed" &&
    hoursUntil(reservation.starts_at) <= 2 &&
    hoursUntil(reservation.starts_at) > 0;

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelReservationByToken(reservation.confirmation_token);
      if (res.error) {
        toast.error(res.error);
      } else {
        setCancelled(true);
        setShowConfirm(false);
        toast.success("Reserva cancelada correctamente.");
      }
    });
  }

  const status = cancelled ? "cancelled" : reservation.status;
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.confirmed;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
            ← {restaurantName}
          </Link>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Tu reserva</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {restaurantName}
          </p>
        </div>

        {/* Details card */}
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm divide-y divide-stone-50">
          <div className="p-5 flex items-start gap-4">
            <div className="p-2 rounded-xl bg-amber-50">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-400 uppercase tracking-wide">Fecha</div>
              <div className="font-semibold text-stone-800 capitalize mt-0.5">
                {formatDate(reservation.starts_at)}
              </div>
            </div>
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="p-2 rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-400 uppercase tracking-wide">Hora</div>
              <div className="font-semibold text-stone-800 mt-0.5">
                {formatTime(reservation.starts_at)} — {formatTime(reservation.ends_at)}
              </div>
            </div>
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="p-2 rounded-xl bg-amber-50">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-400 uppercase tracking-wide">Comensales</div>
              <div className="font-semibold text-stone-800 mt-0.5">
                {reservation.party_size} {reservation.party_size === 1 ? "persona" : "personas"}
              </div>
            </div>
          </div>

          {reservation.table && (
            <div className="p-5 flex items-start gap-4">
              <div className="p-2 rounded-xl bg-amber-50">
                <MapPin className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-400 uppercase tracking-wide">Mesa</div>
                <div className="font-semibold text-stone-800 mt-0.5">
                  {reservation.table.name}
                  <span className="text-sm font-normal text-stone-400 ml-1.5 capitalize">
                    ({reservation.table.section})
                  </span>
                </div>
              </div>
            </div>
          )}

          {reservation.notes && (
            <div className="p-5">
              <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Notas</div>
              <p className="text-sm text-stone-600">{reservation.notes}</p>
            </div>
          )}
        </div>

        {/* Guest info */}
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5">
          <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Datos del cliente</div>
          <div className="space-y-1.5">
            <div className="font-semibold text-stone-800">{reservation.guest_name}</div>
            <div className="text-sm text-stone-500">{reservation.guest_phone}</div>
            {reservation.guest_email && (
              <div className="text-sm text-stone-500">{reservation.guest_email}</div>
            )}
          </div>
        </div>

        {/* Confirmation token */}
        <div className="rounded-xl bg-stone-100 px-4 py-3">
          <div className="text-xs text-stone-400 mb-1">Código de reserva</div>
          <div className="text-xs font-mono text-stone-600 break-all">{reservation.confirmation_token}</div>
        </div>

        {/* Actions */}
        {cancelled && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-700">Reserva cancelada</div>
              <p className="text-sm text-red-600 mt-0.5">
                Tu reserva ha sido cancelada.{" "}
                <Link href="/reservar" className="underline hover:no-underline">
                  ¿Quieres hacer una nueva?
                </Link>
              </p>
            </div>
          </div>
        )}

        {tooLateToCancel && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-700">Cancelación no disponible</div>
              <p className="text-sm text-amber-600 mt-0.5">
                Las cancelaciones deben realizarse con al menos 2 horas de antelación.
                Para cancelar, llámanos directamente.
              </p>
            </div>
          </div>
        )}

        {canCancel && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full rounded-xl border border-red-200 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Cancelar reserva
          </button>
        )}

        {showConfirm && (
          <div className="rounded-2xl bg-white border border-red-100 shadow-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-stone-800">¿Confirmar cancelación?</div>
                <p className="text-sm text-stone-500 mt-0.5">
                  Esta acción no se puede deshacer. Tu mesa quedará libre para otros clientes.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-stone-200 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? "Cancelando…" : "Sí, cancelar"}
                {!isPending && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* New reservation CTA */}
        {(reservation.status === "completed" || reservation.status === "no_show" || cancelled) && (
          <Link
            href="/reservar"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-600 py-3.5 font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Hacer una nueva reserva
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
