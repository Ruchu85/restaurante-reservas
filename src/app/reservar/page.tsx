export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { getRestaurant } from "@/lib/restaurant";
import { toLocalDate, addDays } from "@/lib/dates";
import { pexels, IMAGES, MENU_DEGUSTACION } from "@/lib/landingContent";

export const metadata = {
  title: "Reservar mesa",
};

/**
 * Solo se acepta una fecha con forma de fecha y dentro de la ventana que
 * admite el restaurante: los parámetros de la URL los escribe cualquiera.
 */
function fechaValida(valor: string | undefined, hoy: string, maximo: string): string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  return valor >= hoy && valor <= maximo ? valor : "";
}

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; pax?: string }>;
}) {
  const [restaurant, params] = await Promise.all([getRestaurant(), searchParams]);

  const timeZone = restaurant?.timezone ?? "Europe/Madrid";
  const maxPartySize = restaurant?.max_party_size ?? 10;
  const maxAdvanceDays = restaurant?.max_advance_days ?? 30;

  const hoy = toLocalDate(new Date(), timeZone);
  const fechaInicial = fechaValida(params.fecha, hoy, addDays(hoy, maxAdvanceDays));

  const pax = Number(params.pax);
  const comensalesIniciales =
    Number.isInteger(pax) && pax >= 1 && pax <= maxPartySize ? pax : 2;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            href="/"
            aria-label="Volver a la portada"
            className="-ml-2 rounded-lg p-2.5 transition-colors hover:bg-stone-100"
          >
            <ArrowLeft className="h-4 w-4 text-stone-600" />
          </Link>
          <div>
            <div className="text-sm font-semibold text-stone-800">
              {restaurant?.name ?? "Restaurante"}
            </div>
            <div className="text-xs text-stone-500">Reservar mesa</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-stone-900 md:text-3xl">
          <span className="titular">Reserva tu mesa</span>
        </h1>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
          <div className="mx-auto w-full max-w-lg">
            <BookingWizard
              maxPartySize={maxPartySize}
              maxAdvanceDays={maxAdvanceDays}
              timeZone={timeZone}
              fechaInicial={fechaInicial}
              comensalesIniciales={comensalesIniciales}
            />
          </div>

          {/*
            Recordatorio del menú degustación mientras se reserva: es el
            producto de mayor margen y antes solo aparecía una vez, enterrado
            al final de la carta.
          */}
          <aside className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
            <div className="relative aspect-[4/3]">
              <Image
                src={pexels(IMAGES.servicio, 640)}
                alt="Emplatado del menú degustación"
                fill
                sizes="320px"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <UtensilsCrossed className="h-5 w-5 text-amber-700" aria-hidden />
              <h2 className="mt-2 font-bold text-stone-900">{MENU_DEGUSTACION.titulo}</h2>
              <p className="mt-2 text-sm text-stone-600">{MENU_DEGUSTACION.descripcion}</p>
              <p className="mt-3 text-sm text-stone-700">
                <span className="text-lg font-bold text-amber-800">
                  {MENU_DEGUSTACION.precio} €
                </span>{" "}
                por persona · {MENU_DEGUSTACION.pasos} pasos
              </p>
              <p className="mt-3 text-xs text-stone-500">
                Pídelo en el paso de datos, en «Alguna petición especial».
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
