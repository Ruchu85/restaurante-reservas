export const dynamic = "force-dynamic";

import Link from "next/link";
import { Calendar, Clock, MapPin, Phone, Star, Users } from "lucide-react";
import { getRestaurant, getBusinessHours } from "@/lib/restaurant";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HomePage() {
  const restaurant = await getRestaurant();
  const hoursData = restaurant ? await getBusinessHours(restaurant.id) : [];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-stone-800">
            {restaurant?.name ?? "Restaurante"}
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
            >
              Acceso personal
            </Link>
            <Link
              href="/reservar"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Reservar mesa
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-stone-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 opacity-90" />
        <div className="relative mx-auto max-w-6xl px-4 py-28 md:py-40 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Cocina mediterránea de autor
          </div>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
            {restaurant?.name ?? "Bienvenido"}
          </h1>
          {restaurant?.description && (
            <p className="mt-6 text-lg text-stone-300 max-w-xl mx-auto">
              {restaurant.description}
            </p>
          )}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/reservar"
              className="rounded-xl bg-amber-600 px-8 py-4 text-base font-semibold text-white hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/30"
            >
              Reservar mesa ahora
            </Link>
            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Llamar para reservar
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="mx-auto max-w-6xl px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {restaurant?.address && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex gap-4 items-start">
              <div className="p-2 rounded-lg bg-amber-50">
                <MapPin className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Dirección</div>
                <div className="text-sm font-medium text-stone-800">{restaurant.address}</div>
              </div>
            </div>
          )}
          {restaurant?.phone && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex gap-4 items-start">
              <div className="p-2 rounded-lg bg-amber-50">
                <Phone className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Teléfono</div>
                <a href={`tel:${restaurant.phone}`} className="text-sm font-medium text-stone-800 hover:text-amber-600 transition-colors">
                  {restaurant.phone}
                </a>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex gap-4 items-start">
            <div className="p-2 rounded-lg bg-amber-50">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Grupos</div>
              <div className="text-sm font-medium text-stone-800">Hasta {restaurant?.max_party_size ?? 10} personas</div>
              <div className="text-xs text-stone-400">Grupos mayores: llámenos</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-6xl px-4 mt-16">
        <div className="rounded-3xl bg-amber-600 p-8 md:p-12 text-white text-center">
          <Calendar className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Reserva en 2 minutos</h2>
          <p className="text-amber-100 max-w-md mx-auto mb-8">
            Elige fecha, hora y número de comensales. Confirmación instantánea.
          </p>
          <Link
            href="/reservar"
            className="inline-block rounded-xl bg-white text-amber-700 px-8 py-4 font-bold text-base hover:bg-amber-50 transition-colors shadow-lg"
          >
            Hacer una reserva
          </Link>
        </div>
      </section>

      {/* Horarios */}
      {hoursData.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 mt-16 mb-8">
          <h2 className="text-2xl font-bold text-stone-800 mb-6 text-center">Horario</h2>
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden max-w-lg mx-auto">
            {hoursData.map((h) => (
              <div
                key={h.day_of_week}
                className="flex items-center justify-between px-6 py-3.5 border-b border-stone-50 last:border-0"
              >
                <span className="text-sm font-medium text-stone-700">
                  {DAY_NAMES[h.day_of_week]}
                </span>
                {h.is_open ? (
                  <div className="text-right space-y-0.5">
                    {h.opens_at && h.closes_at && (
                      <div className="flex items-center gap-1.5 text-sm text-stone-600">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        {h.opens_at.slice(0, 5)} – {h.closes_at.slice(0, 5)}
                      </div>
                    )}
                    {h.opens_at_2 && h.closes_at_2 && (
                      <div className="flex items-center gap-1.5 text-sm text-stone-600">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        {h.opens_at_2.slice(0, 5)} – {h.closes_at_2.slice(0, 5)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-stone-400">Cerrado</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white mt-8">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-stone-400">
          <p>© {new Date().getFullYear()} {restaurant?.name ?? "Restaurante"}</p>
          {restaurant?.email && (
            <a href={`mailto:${restaurant.email}`} className="mt-1 block hover:text-amber-600 transition-colors">
              {restaurant.email}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
