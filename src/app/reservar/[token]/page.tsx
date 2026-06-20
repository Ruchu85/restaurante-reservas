export const dynamic = "force-dynamic";

import Link from "next/link";
import { getReservationByToken } from "@/actions/reservations";
import { getRestaurant } from "@/lib/restaurant";
import { ReservationDetailClient } from "./ReservationDetailClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tu reserva" };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReservationTokenPage({ params }: Props) {
  const { token } = await params;
  const [{ data: reservation, error }, restaurant] = await Promise.all([
    getReservationByToken(token),
    getRestaurant(),
  ]);

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">Reserva no encontrada</h1>
          <p className="text-stone-500 text-sm mb-6">
            El enlace puede haber expirado o la reserva no existe.
          </p>
          <Link
            href="/reservar"
            className="inline-block rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Hacer una nueva reserva
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReservationDetailClient
      reservation={reservation}
      restaurantName={restaurant?.name ?? "Restaurante"}
    />
  );
}
