// La portada solo depende de datos que cambian a lo sumo una vez al día
// (horario, nombre, teléfono). Con `force-dynamic` cada visita —incluida la
// del robot de Google— disparaba dos consultas a Supabase y anulaba la caché
// del CDN. Los horarios se revalidan desde el panel al guardarlos.
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, MapPin, Phone, Star, UtensilsCrossed, Quote, ArrowRight, Mail } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurant, getBusinessHours } from "@/lib/restaurant";
import { toLocalDate, dayOfWeek } from "@/lib/dates";
import { Motion } from "@/components/landing/Motion";
import { MenuMovil } from "@/components/landing/MenuMovil";
import { ReservaRapida } from "@/components/landing/ReservaRapida";
import {
  pexels, precio, IMAGES, CARTA, MENU_DEGUSTACION, RESENAS, GALERIA, RECLAMOS, JEFE_COCINA,
  TEMPORADA, BODEGA,
} from "@/lib/landingContent";
import type { BusinessHours } from "@/types";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const NAV = [
  { href: "#carta", label: "Carta" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#galeria", label: "Galería" },
  { href: "#visitanos", label: "Visítanos" },
];

/** Imagen que ilustra cada bloque de la carta, en el mismo orden que CARTA. */
const IMAGEN_SECCION: Record<string, { id: number; alt: string }> = {
  entrantes: { id: 566566, alt: "Tostada de aguacate con huevo de codorniz" },
  principales: { id: 2233729, alt: "Brochetas de cordero sobre la brasa" },
  postres: { id: 291528, alt: "Tarta de chocolate con frambuesa" },
};

function turnos(h: BusinessHours | undefined): string | null {
  if (!h?.is_open) return null;
  const rangos: string[] = [];
  if (h.opens_at && h.closes_at) rangos.push(`${h.opens_at.slice(0, 5)} – ${h.closes_at.slice(0, 5)}`);
  if (h.opens_at_2 && h.closes_at_2) rangos.push(`${h.opens_at_2.slice(0, 5)} – ${h.closes_at_2.slice(0, 5)}`);
  return rangos.length ? rangos.join(" · ") : null;
}

/**
 * Próximo día abierto a partir de hoy. En el hero no basta con decir "hoy
 * cerramos": eso es una puerta cerrada en la primera pantalla. Hay que dar
 * siempre una fecha a la que apuntar.
 */
function proximaApertura(horas: BusinessHours[], hoy: number): string | null {
  for (let i = 1; i <= 7; i++) {
    const dia = (hoy + i) % 7;
    const t = turnos(horas.find((h) => h.day_of_week === dia));
    if (t) return `${i === 1 ? "mañana" : DAY_NAMES[dia].toLowerCase()} de ${t}`;
  }
  return null;
}

/** Lunes primero: en España la semana no empieza en domingo. */
const ordenSemana = (d: number) => (d + 6) % 7;

const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Ficha de Restaurant para buscadores y asistentes de IA.
 *
 * No se emite `aggregateRating`: las reseñas de esta web son contenido de
 * ejemplo escrito en el propio código, y publicar una valoración agregada que
 * nadie puede verificar incumple las políticas de Google y expone al dominio
 * a una acción manual. Cuando haya reseñas reales se añaden aquí junto a los
 * objetos `Review` que las respaldan.
 */
function fichaSchema(
  nombre: string,
  restaurant: Awaited<ReturnType<typeof getRestaurant>>,
  horas: BusinessHours[],
  base: string,
) {
  const tramos = horas
    .filter((h) => h.is_open)
    .flatMap((h) =>
      [
        [h.opens_at, h.closes_at],
        [h.opens_at_2, h.closes_at_2],
      ]
        .filter(([a, b]) => a && b)
        .map(([a, b]) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: SCHEMA_DAYS[h.day_of_week],
          opens: (a as string).slice(0, 5),
          closes: (b as string).slice(0, 5),
        })),
    );

  // La dirección se guarda como una línea ("Calle Gran Vía 1, Madrid"): el
  // último tramo es la localidad. Sin `addressLocality` no hay resultado
  // enriquecido de restaurante ni aparición en el pack local.
  const partes = (restaurant?.address ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const localidad = partes.length > 1 ? partes[partes.length - 1] : undefined;
  const calle = partes.length > 1 ? partes.slice(0, -1).join(", ") : partes[0];

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${base}/#restaurante`,
    url: base,
    name: nombre,
    description: restaurant?.description ?? undefined,
    servesCuisine: "Mediterránea",
    priceRange: "€€",
    currenciesAccepted: "EUR",
    acceptsReservations: "True",
    telephone: restaurant?.phone ?? undefined,
    email: restaurant?.email ?? undefined,
    address: calle
      ? {
          "@type": "PostalAddress",
          streetAddress: calle,
          addressLocality: localidad,
          addressCountry: "ES",
        }
      : undefined,
    // Enlace al mapa construido desde la dirección: sin coordenadas propias
    // en la base de datos, es la señal de ubicación que se puede dar sin
    // inventarse una latitud. `geo` y `sameAs` entran cuando el restaurante
    // aporte su ficha de Google Business y sus redes.
    hasMap: restaurant?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
      : undefined,
    sameAs: restaurant?.website ? [restaurant.website] : undefined,
    image: [`${base}/opengraph-image`, pexels(IMAGES.historia, 1200), pexels(IMAGES.comedor, 1200)],
    openingHoursSpecification: tramos,
    hasMenu: {
      "@type": "Menu",
      hasMenuSection: CARTA.map((s) => ({
        "@type": "MenuSection",
        name: s.titulo,
        hasMenuItem: s.platos.map((p) => ({
          "@type": "MenuItem",
          name: p.nombre,
          description: p.descripcion,
          offers: { "@type": "Offer", price: p.precio.toFixed(2), priceCurrency: "EUR" },
        })),
      })),
    },
    // Es lo que leen los asistentes de IA cuando alguien pide "resérvame mesa".
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/reservar`,
        inLanguage: "es-ES",
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: { "@type": "FoodEstablishmentReservation", name: "Reserva de mesa" },
    },
  };
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await getRestaurant();
  const nombre = restaurant?.name ?? "Restaurante";
  const descripcion =
    restaurant?.description ?? "Cocina mediterránea de autor. Reserva tu mesa en dos minutos.";
  const titulo = `${nombre} — Reserva tu mesa`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: BASE },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: nombre,
      url: "/",
      title: titulo,
      description: descripcion,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function HomePage() {
  const restaurant = await getRestaurant();
  const timeZone = restaurant?.timezone ?? "Europe/Madrid";
  const hoursData = restaurant ? await getBusinessHours(createAdminClient(), restaurant.id) : [];

  const diaLocal = toLocalDate(new Date(), timeZone);
  const hoy = dayOfWeek(diaLocal);
  const horarioHoy = turnos(hoursData.find((h) => h.day_of_week === hoy));
  const siguiente = horarioHoy ? null : proximaApertura(hoursData, hoy);
  const nombre = restaurant?.name ?? "Restaurante";
  const maxComensales = restaurant?.max_party_size ?? 10;

  const semana = [...hoursData].sort(
    (a, b) => ordenSemana(a.day_of_week) - ordenSemana(b.day_of_week),
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <script
        type="application/ld+json"
        // El `<` escapado evita que un texto de la base de datos pueda cerrar
        // la etiqueta y colar marcado.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(fichaSchema(nombre, restaurant, hoursData, BASE)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />

      {/*
        Sin JavaScript nadie añade `.is-visible`, así que la página se quedaría
        en blanco: el contenido está en el HTML pero con opacidad 0. Esto lo
        devuelve todo a la vista.
      */}
      <noscript>
        <style>{`[data-reveal],[data-lineas] .linea>span{opacity:1!important;transform:none!important}[data-cortina]>img{clip-path:none!important}`}</style>
      </noscript>

      {/* Salta al selector de reserva, no al texto: quien navega con teclado
          busca lo mismo que el resto, y es lo primero que hay que darle. */}
      <a
        href="#reservar-rapido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-stone-900 focus:shadow-lg"
      >
        Saltar a la reserva
      </a>

      <Motion />

      {/* Progreso de lectura */}
      <div data-progress aria-hidden className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-amber-500" />

      {/* ── Cabecera ───────────────────────────────────────────── */}
      <header
        data-header
        className="fixed inset-x-0 top-0 z-50 border-b border-transparent [&.is-solid]:border-stone-200 [&.is-solid]:bg-white/90 [&.is-solid]:backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="titular foco-claro min-w-0 truncate py-2.5 text-lg text-white transition-colors [.is-solid_&]:text-stone-900 [.is-solid_&]:focus-visible:outline-amber-700 sm:text-2xl"
          >
            {nombre}
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
            {NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="foco-claro py-3 text-sm font-medium text-white/90 transition-colors hover:text-amber-300 [.is-solid_&]:text-stone-600 [.is-solid_&]:hover:text-amber-800 [.is-solid_&]:focus-visible:outline-amber-700"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* En móvil la reserva está siempre a mano en la barra inferior:
                repetirla aquí solo comía el ancho del nombre del local. */}
            <Link
              href="/reservar"
              className="foco-claro hidden rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-600 sm:block"
            >
              Reservar mesa
            </Link>
            <MenuMovil enlaces={NAV} telefono={restaurant?.phone} horarioHoy={horarioHoy} />
          </div>
        </div>
      </header>

      {/* ── Hero con vídeo ─────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-stone-950 text-white">
        {/*
          El póster sí se declara aquí: está sobre la línea de flotación y es
          lo que ve el visitante mientras no haya vídeo. El vídeo en cambio se
          arranca desde Motion.tsx, y solo en escritorio y sin ahorro de
          datos: en móvil son 464 KB —la mitad del peso de la página— para un
          fondo decorativo.
        */}
        <video
          data-video-diferido
          className="deriva-lenta absolute inset-0 h-full w-full object-cover opacity-55"
          muted
          loop
          playsInline
          preload="none"
          poster="/video/hero-poster.jpg"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-stone-950/75 via-stone-950/50 to-stone-950/95"
        />

        {/*
          Nada de este bloque lleva `data-reveal`: es el contenido de la
          primera pantalla y el <h1> es el elemento que mide el LCP. Con el
          observador de por medio se quedaba invisible hasta que hidrataba
          React. Aquí la animación es CSS puro y arranca con el primer pintado.
        */}
        <div className="relative mx-auto max-w-4xl px-4 pb-28 pt-28 text-center">
          <p className="entra mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm text-amber-100 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            Cocina mediterránea de autor
          </p>

          <h1 className="titular entra-lcp text-[clamp(2.8rem,8.5vw,6rem)] font-normal leading-[0.95]">
            {nombre}
          </h1>

          {restaurant?.description && (
            <p className="entra entra-3 mx-auto mt-7 max-w-xl text-lg text-stone-200">
              {restaurant.description}
            </p>
          )}

          {/* La reserva empieza aquí, no tras un salto a un formulario vacío. */}
          <div id="reservar-rapido" tabIndex={-1} className="entra entra-4 mt-10 scroll-mt-24 focus:outline-none">
            <ReservaRapida
              hoy={diaLocal}
              diasAbiertos={hoursData.filter((h) => h.is_open).map((h) => h.day_of_week)}
              maxComensales={maxComensales}
            />
          </div>

          <p className="entra entra-5 mt-7 text-sm text-stone-200">
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${horarioHoy ? "bg-emerald-400" : "bg-amber-400"}`}
              aria-hidden
            />
            {horarioHoy ? (
              <>Hoy abrimos {horarioHoy}</>
            ) : siguiente ? (
              <>Hoy cerramos · Abrimos {siguiente}</>
            ) : (
              <>Consúltanos el horario por teléfono</>
            )}
            {restaurant?.phone && (
              <>
                {" · "}
                <a
                  href={`tel:${restaurant.phone}`}
                  className="foco-claro inline-block py-2.5 underline decoration-white/40 underline-offset-4 hover:decoration-white"
                >
                  {restaurant.phone}
                </a>
              </>
            )}
          </p>
        </div>

        <a
          href="#nosotros"
          aria-label="Ir al contenido"
          className="rebote foco-claro absolute bottom-6 left-1/2 -translate-x-1/2 p-3 text-white/70 transition-colors hover:text-white"
        >
          <ChevronDown className="h-7 w-7" aria-hidden />
        </a>
      </section>

      {/* ── Cinta ──────────────────────────────────────────────── */}
      <div className="overflow-hidden border-y border-stone-800 bg-stone-900 py-4" aria-hidden>
        <div className="cinta-pista">
          {[0, 1].map((copia) => (
            <div key={copia} className="flex shrink-0">
              {RECLAMOS.map((t) => (
                <span
                  key={`${copia}-${t}`}
                  className="flex items-center gap-6 whitespace-nowrap px-6 text-sm font-medium uppercase tracking-[0.18em] text-stone-400"
                >
                  {t}
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Nosotros ───────────────────────────────────────────── */}
      <section id="nosotros" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="relative">
            <div data-cortina className="foto-editorial relative aspect-[4/3] overflow-hidden rounded-3xl bg-stone-200">
              <Image
                src={pexels(IMAGES.historia, 1000)}
                alt="Barra del restaurante al anochecer"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div
              data-parallax="0.14"
              className="absolute -bottom-7 -right-4 hidden rounded-2xl border border-stone-100 bg-white/95 px-6 py-4 shadow-xl backdrop-blur-sm md:block"
            >
              <div className="titular text-4xl text-amber-800">12</div>
              <div className="text-xs text-stone-600">años en Gran Vía</div>
            </div>
          </div>

          <div data-reveal="derecha">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
              Nuestra casa
            </p>
            <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-stone-900">
              <span className="subrayado">Producto de temporada</span>, sin artificios
            </h2>
            <div className="mt-6 space-y-4 text-stone-600">
              <p>
                Abrimos en el corazón de Madrid con una idea sencilla: comprar bien y molestar
                poco al producto. Trabajamos con pequeños productores del Mediterráneo y
                cambiamos la carta cada estación, según lo que llega al mercado esa misma mañana.
              </p>
              <p>
                La brasa de encina es el centro de la cocina. A su alrededor, arroces de fondo
                largo, pescado de lonja y verduras de huerta cercana. Nada viaja más de lo necesario.
              </p>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-stone-200 pt-6">
              {[
                ["2014", "Desde"],
                ["48", "Comensales"],
                ["100%", "Producto nacional"],
              ].map(([valor, etiqueta]) => (
                <div key={etiqueta}>
                  <dt className="titular text-3xl text-stone-900">{valor}</dt>
                  <dd className="text-xs text-stone-600">{etiqueta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Carta ──────────────────────────────────────────────── */}
      <section id="carta" className="scroll-mt-20 bg-white py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">La carta</p>
            <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-stone-900">
              Qué vas a comer
            </h2>
            <p className="mt-4 text-stone-600">
              Cambia con la temporada. Si tienes alguna alergia o intolerancia, dínoslo al
              reservar y la cocina lo tendrá en cuenta.
            </p>
          </div>

          {/*
            Una imagen grande por sección y la lista al lado, en vez de una
            miniatura por plato: antes la mitad de los platos tenía foto y la
            otra mitad no, así que las filas quedaban desiguales.
          */}
          <div className="mt-16 space-y-20">
            {CARTA.map((seccion, s) => {
              const foto = IMAGEN_SECCION[seccion.id];
              const invertida = s % 2 === 1;
              return (
                <div
                  key={seccion.id}
                  className="grid items-center gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-14"
                >
                  {foto && (
                    <div
                      data-cortina
                      className={`foto-editorial relative aspect-[4/5] overflow-hidden rounded-3xl bg-stone-200 md:aspect-[3/4] ${
                        invertida ? "md:order-2" : ""
                      }`}
                    >
                      <Image
                        src={pexels(foto.id, 700, 900)}
                        alt={foto.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 40vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div data-reveal={invertida ? "derecha" : "izquierda"}>
                    <h3 className="titular text-2xl text-stone-900 md:text-3xl">
                      {seccion.titulo}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">{seccion.descripcion}</p>

                    <ul className="mt-8 space-y-6">
                      {seccion.platos.map((plato) => (
                        <li key={plato.nombre} className="border-b border-stone-100 pb-5 last:border-0">
                          {/* `items-start` y `shrink-0`: con `items-baseline` el
                              precio se descolocaba cuando el nombre del plato
                              ocupaba dos líneas en móvil. */}
                          <div className="flex items-start justify-between gap-4">
                            <h4 className="font-semibold text-stone-900">{plato.nombre}</h4>
                            <span className="mt-0.5 shrink-0 whitespace-nowrap font-semibold text-amber-800">
                              {precio(plato.precio)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-stone-600">{plato.descripcion}</p>
                          {plato.etiquetas && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {plato.etiquetas.map((e) => (
                                <span
                                  key={e}
                                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                                >
                                  {e}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Menú degustación ───────────────────────────────────── */}
      <section className="bg-white pb-24 md:pb-28">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal="zoom" className="overflow-hidden rounded-3xl bg-stone-900 text-white">
            <div className="grid md:grid-cols-2">
              <div className="foto-editorial relative min-h-56 bg-stone-800">
                <Image
                  src={pexels(IMAGES.servicio, 900)}
                  alt="Uno de los pasos del menú degustación"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="p-8 md:p-12">
                <UtensilsCrossed className="h-8 w-8 text-amber-400" aria-hidden />
                <h2 className="titular mt-4 text-3xl">{MENU_DEGUSTACION.titulo}</h2>
                <p className="mt-3 text-stone-300">{MENU_DEGUSTACION.descripcion}</p>
                <div className="mt-6 flex items-end gap-8">
                  <div>
                    <div className="titular text-4xl text-amber-400">
                      {precio(MENU_DEGUSTACION.precio)}
                    </div>
                    <div className="text-xs text-stone-300">
                      {MENU_DEGUSTACION.pasos} pasos, por persona
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-stone-100">
                      +{precio(MENU_DEGUSTACION.precioMaridaje)}
                    </div>
                    <div className="text-xs text-stone-300">maridaje opcional</div>
                  </div>
                </div>
                <Link
                  href="/reservar"
                  className="foco-claro mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  Reservar mesa
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Temporada y bodega ─────────────────────────────────── */}
      <section className="border-y border-stone-200 bg-stone-100 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-20">
            <div data-reveal="izquierda">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                Temporada
              </p>
              <h2 className="titular mt-3 text-[clamp(1.7rem,3.4vw,2.4rem)] text-stone-900">
                {TEMPORADA.titulo}
              </h2>
              <p className="mt-4 max-w-lg text-stone-600">{TEMPORADA.entradilla}</p>

              <dl className="mt-8 divide-y divide-stone-300 border-t border-stone-300">
                {TEMPORADA.productos.map((p) => (
                  <div
                    key={p.nombre}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5"
                  >
                    <dt className="font-semibold text-stone-900">{p.nombre}</dt>
                    <dd className="text-sm text-stone-600">
                      {p.origen}
                      <span className="mx-2 text-stone-400">·</span>
                      <span className="text-stone-600">{p.meses}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div data-reveal="derecha" className="md:pt-14">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Vinos</p>
              <h2 className="titular mt-3 text-[clamp(1.7rem,3.4vw,2.4rem)] text-stone-900">
                {BODEGA.titulo}
              </h2>
              <p className="mt-4 text-stone-600">{BODEGA.texto}</p>
              <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-stone-300 pt-6">
                {BODEGA.datos.map(([valor, etiqueta]) => (
                  <div key={etiqueta}>
                    <dt className="titular text-3xl text-amber-800">{valor}</dt>
                    <dd className="text-xs text-stone-600">{etiqueta}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vídeo de cocina ────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[65svh] items-center overflow-hidden bg-stone-950 text-white">
        {/*
          Ni `autoPlay` ni `poster`: el primero anula el `preload="none"` y el
          segundo se descarga siempre. Los dos los pone Motion.tsx al
          acercarse esta sección, que está a cinco pantallas del hero.
        */}
        <video
          data-video-diferido
          data-poster="/video/cocina-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/video/cocina.mp4" type="video/mp4" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-stone-950/92 via-stone-950/60 to-transparent"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-24">
          <div className="max-w-xl">
            <p data-reveal className="text-sm font-semibold uppercase tracking-wide text-amber-400">
              La brasa
            </p>
            <h2
              data-lineas
              aria-label="El fuego manda"
              className="titular mt-3 text-[clamp(2.2rem,6vw,4rem)] leading-[1.05]"
            >
              <span className="linea">
                <span>El fuego</span>
              </span>
              <span className="linea">
                <span>manda</span>
              </span>
            </h2>
            <p data-reveal data-reveal-delay="180" className="mt-6 text-lg text-stone-200">
              Fuego vivo, temperatura y paciencia. La brasa de encina para las carnes y el
              pescado; la sartén al rojo para lo que tiene que salir en segundos. Nada
              espera bajo una lámpara.
            </p>
            <a
              href="#carta"
              className="foco-claro group mt-8 inline-flex items-center gap-2 py-3 text-base font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Ver la carta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* ── Galería ────────────────────────────────────────────── */}
      <section id="galeria" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Galería</p>
          <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-stone-900">
            El sitio y la cocina
          </h2>
        </div>

        {/*
          Mosaico de nueve celdas: la primera foto ocupa 2×2 y las otras cinco
          rellenan el resto. La altura del conjunto es fija y las celdas se
          reparten en tres filas iguales; dejándolo al contenido, las filas
          salían de distinto alto y el mosaico quedaba descuadrado.
        */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-3 md:gap-4">
          {GALERIA.map((foto, i) => (
            <div
              key={foto.id}
              data-cortina
              data-reveal-delay={i * 70}
              className={`foto-editorial group relative aspect-square overflow-hidden rounded-2xl bg-stone-200 ${
                i === 0 ? "md:col-span-2 md:row-span-2" : ""
              }`}
            >
              <Image
                src={pexels(foto.id, i === 0 ? 1200 : 800, i === 0 ? 1200 : 800)}
                alt={foto.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-stone-950/55 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Equipo ─────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-stone-900 py-24 text-white md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 md:gap-16">
          <div data-reveal="izquierda">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">La cocina</p>
            <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight">
              Un equipo pequeño y muy terco
            </h2>
            <p className="mt-6 text-stone-200">
              Siete personas en cocina y cuatro en sala. Lo justo para que nadie tenga que
              correr y cada plato salga como debe. Trabajamos con dos turnos al día porque
              preferimos servir bien a servir mucho.
            </p>
            <blockquote className="mt-8 border-l-2 border-amber-500 pl-5 text-lg italic text-stone-100">
              «{JEFE_COCINA.cita}»
              <footer className="mt-2 text-sm not-italic text-stone-300">
                {JEFE_COCINA.nombre}, {JEFE_COCINA.cargo}
              </footer>
            </blockquote>
          </div>
          <div
            data-cortina
            className="foto-editorial relative aspect-[4/5] overflow-hidden rounded-3xl bg-stone-800 md:aspect-[4/3]"
          >
            <Image
              src={pexels(IMAGES.chef, 1000)}
              alt={JEFE_COCINA.alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Reseñas ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 md:py-28">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Reseñas</p>
          <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-stone-900">
            Lo que dicen quienes ya han venido
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {RESENAS.map((r, i) => (
            <figure
              key={r.autor}
              data-reveal
              data-reveal-delay={i * 110}
              className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/5"
            >
              <Quote className="h-6 w-6 text-amber-300" aria-hidden />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
                {r.texto}
              </blockquote>
              <figcaption className="mt-5 border-t border-stone-100 pt-4">
                <div className="flex items-center gap-1" aria-label={`${r.puntuacion} de 5 estrellas`}>
                  {Array.from({ length: r.puntuacion }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
                  ))}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-stone-900">{r.autor}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Visítanos ──────────────────────────────────────────── */}
      <section id="visitanos" className="scroll-mt-20 bg-white py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Visítanos</p>
            <h2 className="titular mt-3 text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-stone-900">
              Horario y reservas
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div data-reveal="izquierda" className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
              <h3 className="border-b border-stone-200 px-6 py-4 font-semibold text-stone-900">
                Horario semanal
              </h3>
              {semana.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-stone-500">
                  Consúltanos el horario por teléfono.
                </p>
              ) : (
                <ul>
                  {semana.map((h) => {
                    const t = turnos(h);
                    const esHoy = h.day_of_week === hoy;
                    return (
                      <li
                        key={h.day_of_week}
                        className={`flex items-center justify-between border-b border-stone-200 px-6 py-3.5 last:border-0 ${esHoy ? "bg-amber-50" : ""}`}
                      >
                        <span className={`text-sm ${esHoy ? "font-bold text-amber-900" : "font-medium text-stone-700"}`}>
                          {DAY_NAMES[h.day_of_week]}
                          {esHoy && <span className="ml-2 text-xs font-normal">(hoy)</span>}
                        </span>
                        {t ? (
                          <span className="text-sm text-stone-700">{t}</span>
                        ) : (
                          <span className="text-sm text-stone-500">Cerrado</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              data-reveal="derecha"
              className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-amber-700 to-amber-800 p-8 text-white md:p-10"
            >
              <h3 className="titular text-3xl">Reserva en 2 minutos</h3>
              <p className="mt-3 text-amber-50">
                Elige fecha, hora y número de comensales. Confirmación inmediata y podrás
                cancelar desde el enlace que te enviamos.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-white">
                {[
                  "Sin llamadas ni esperas",
                  `Grupos de hasta ${maxComensales} personas`,
                  "Cuéntanos alergias al reservar",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-200" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/reservar"
                className="foco-claro group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-center font-bold text-amber-900 shadow-lg transition-all hover:bg-amber-50 hover:shadow-xl"
              >
                Reservar mesa
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              {restaurant?.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="foco-claro mt-4 inline-block py-2.5 text-center text-sm text-white underline underline-offset-4"
                >
                  o llámanos al {restaurant.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pie ────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-stone-50 pb-24 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="titular text-2xl text-stone-900">{nombre}</div>
              {restaurant?.description && (
                <p className="mt-2 max-w-xs text-sm text-stone-600">{restaurant.description}</p>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-600">
                Contacto
              </h2>
              <ul className="space-y-1 text-sm text-stone-600">
                {restaurant?.address && (
                  <li className="flex items-start gap-2 py-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-800" aria-hidden />
                    {restaurant.address}
                  </li>
                )}
                {restaurant?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0 text-amber-800" aria-hidden />
                    <a href={`tel:${restaurant.phone}`} className="block py-2.5 hover:text-amber-800">
                      {restaurant.phone}
                    </a>
                  </li>
                )}
                {restaurant?.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-shrink-0 text-amber-800" aria-hidden />
                    <a href={`mailto:${restaurant.email}`} className="block py-2.5 hover:text-amber-800">
                      {restaurant.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-600">
                Enlaces
              </h2>
              <ul className="text-sm text-stone-600">
                {NAV.map(({ href, label }) => (
                  <li key={href}>
                    <a href={href} className="block py-2.5 hover:text-amber-800">
                      {label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/reservar" className="block py-2.5 font-medium text-amber-800 hover:text-amber-900">
                    Reservar mesa
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-stone-200 pt-6 text-xs text-stone-500 sm:flex-row">
            <p>
              © {new Date().getFullYear()} {nombre}. Carta, reseñas, fotografías y vídeos de demostración.
            </p>
            <Link href="/login" className="inline-block py-2.5 hover:text-stone-800">
              Acceso del personal
            </Link>
          </div>
        </div>
      </footer>

      {/*
        Barra fija de acción en móvil: es el estándar de conversión del sector
        y evita tener que volver arriba para encontrar el botón de reservar.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-stone-200 bg-white/95 p-3 backdrop-blur-md md:hidden">
        <Link
          href="/reservar"
          className="flex-1 rounded-xl bg-amber-700 py-3.5 text-center font-bold text-white"
        >
          Reservar mesa
        </Link>
        {restaurant?.phone && (
          <a
            href={`tel:${restaurant.phone}`}
            aria-label="Llamar al restaurante"
            className="rounded-xl border border-stone-300 px-5 py-3.5 text-stone-800"
          >
            <Phone className="h-5 w-5" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
