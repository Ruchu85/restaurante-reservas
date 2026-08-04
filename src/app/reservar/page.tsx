export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurant, getBusinessHours } from "@/lib/restaurant";
import { toLocalDate, addDays } from "@/lib/dates";
import { pexels, precio, IMAGES, MENU_DEGUSTACION } from "@/lib/landingContent";

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

  const horas = restaurant
    ? await getBusinessHours(createAdminClient(), restaurant.id)
    : [];
  const diasAbiertos = horas.filter((h) => h.is_open).map((h) => h.day_of_week);

  const timeZone = restaurant?.timezone ?? "Europe/Madrid";
  const maxPartySize = restaurant?.max_party_size ?? 10;
  const maxAdvanceDays = restaurant?.max_advance_days ?? 30;

  const hoy = toLocalDate(new Date(), timeZone);
  // Sin fecha en la URL —seis de los siete accesos a esta página no la pasan—
  // se preselecciona el próximo día con servicio. Antes se llegaba a un
  // formulario vacío con el botón desactivado.
  const proximoAbierto = (() => {
    for (let i = 0; i <= maxAdvanceDays; i++) {
      const f = addDays(hoy, i);
      const [a, m, d] = f.split("-").map(Number);
      if (diasAbiertos.length === 0 || diasAbiertos.includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay())) return f;
    }
    return hoy;
  })();

  const fechaInicial =
    fechaValida(params.fecha, hoy, addDays(hoy, maxAdvanceDays)) || proximoAbierto;

  const pax = Number(params.pax);
  const comensalesIniciales =
    Number.isInteger(pax) && pax >= 1 && pax <= maxPartySize ? pax : 2;

  return (
    <div className="min-h-screen bg-stone-50">
      {/*
        La reserva es el paso que decide, así que mantiene la marca del hero:
        fondo oscuro, serif y el mismo ámbar. Con la cabecera gris de panel
        que había antes, el visitante sentía que había salido del restaurante.
      */}
      <header className="relative isolate overflow-hidden bg-stone-950 text-white">
        <Image
          src={pexels(IMAGES.historia, 1400)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-stone-950/70 to-stone-950" />
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5">
          <Link
            href="/"
            className="foco-claro -ml-2 inline-flex items-center gap-2 rounded-lg p-2.5 text-sm text-stone-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {restaurant?.name ?? "Restaurante"}
          </Link>
          <h1 className="titular mt-4 text-[clamp(1.9rem,5vw,3rem)] leading-tight">
            Reserva tu mesa
          </h1>
          <p className="mt-2 max-w-md text-sm text-stone-300">
            Tres pasos y confirmación inmediata. Podrás cancelar desde el enlace que te enviamos.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
          <div className="mx-auto w-full max-w-lg">
            <BookingWizard
              maxPartySize={maxPartySize}
              maxAdvanceDays={maxAdvanceDays}
              timeZone={timeZone}
              fechaInicial={fechaInicial}
              comensalesIniciales={comensalesIniciales}
              diasAbiertos={diasAbiertos}
            />
          </div>

          {/*
            Recordatorio del menú degustación mientras se reserva: es el
            producto de mayor margen y antes solo aparecía una vez, enterrado
            al final de la carta.
          */}
          <aside className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
            <div className="foto-editorial relative aspect-[4/3] bg-stone-200">
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
                  {precio(MENU_DEGUSTACION.precio)}
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
