export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Clock, MapPin, Phone, Star, UtensilsCrossed, Quote, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurant, getBusinessHours } from "@/lib/restaurant";
import { toLocalDate, dayOfWeek } from "@/lib/dates";
import { Motion } from "@/components/landing/Motion";
import { MenuMovil } from "@/components/landing/MenuMovil";
import { pexels, IMAGES, CARTA, MENU_DEGUSTACION, RESENAS, GALERIA } from "@/lib/landingContent";
import type { BusinessHours } from "@/types";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const NAV = [
  { href: "#carta", label: "Carta" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#galeria", label: "Galería" },
  { href: "#visitanos", label: "Visítanos" },
];

const CINTA = [
  "Cocina mediterránea de autor",
  "Producto de temporada",
  "Brasa de encina",
  "Pescado de lonja",
  "Huerta cercana",
  "Bodega del Bierzo",
];

function turnos(h: BusinessHours | undefined): string | null {
  if (!h?.is_open) return null;
  const rangos: string[] = [];
  if (h.opens_at && h.closes_at) rangos.push(`${h.opens_at.slice(0, 5)} – ${h.closes_at.slice(0, 5)}`);
  if (h.opens_at_2 && h.closes_at_2) rangos.push(`${h.opens_at_2.slice(0, 5)} – ${h.closes_at_2.slice(0, 5)}`);
  return rangos.length ? rangos.join(" · ") : null;
}

const precio = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

const SCHEMA_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * Ficha de Restaurant para buscadores: horario, teléfono, rango de precios y
 * valoración. Es lo que permite que Google muestre el horario y las estrellas
 * junto al resultado, y lo que leen los asistentes de IA al recomendar sitios.
 */
function fichaSchema(
  nombre: string,
  restaurant: Awaited<ReturnType<typeof getRestaurant>>,
  horas: BusinessHours[],
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

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: nombre,
    description: restaurant?.description ?? undefined,
    servesCuisine: "Mediterránea",
    priceRange: "€€",
    acceptsReservations: "True",
    telephone: restaurant?.phone ?? undefined,
    email: restaurant?.email ?? undefined,
    address: restaurant?.address
      ? { "@type": "PostalAddress", streetAddress: restaurant.address, addressCountry: "ES" }
      : undefined,
    image: [pexels(IMAGES.historia, 1200), pexels(IMAGES.comedor, 1200)],
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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: (RESENAS.reduce((s, r) => s + r.puntuacion, 0) / RESENAS.length).toFixed(1),
      reviewCount: RESENAS.length,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await getRestaurant();
  const nombre = restaurant?.name ?? "Restaurante";
  const descripcion =
    restaurant?.description ??
    "Cocina mediterránea de autor. Reserva tu mesa en dos minutos.";
  const portada = pexels(IMAGES.historia, 1200, 630);

  return {
    title: `${nombre} — Reserva tu mesa`,
    description: descripcion,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: nombre,
      title: `${nombre} — Reserva tu mesa`,
      description: descripcion,
      images: [{ url: portada, width: 1200, height: 630, alt: nombre }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${nombre} — Reserva tu mesa`,
      description: descripcion,
      images: [portada],
    },
  };
}

export default async function HomePage() {
  const restaurant = await getRestaurant();
  const timeZone = restaurant?.timezone ?? "Europe/Madrid";
  const hoursData = restaurant ? await getBusinessHours(createAdminClient(), restaurant.id) : [];

  const hoy = dayOfWeek(toLocalDate(new Date(), timeZone));
  const horarioHoy = turnos(hoursData.find((h) => h.day_of_week === hoy));
  const nombre = restaurant?.name ?? "Restaurante";

  return (
    <div className="min-h-screen bg-stone-50">
      <script
        type="application/ld+json"
        // El `<` escapado evita que un texto de la base de datos pueda cerrar
        // la etiqueta y colar marcado.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(fichaSchema(nombre, restaurant, hoursData)).replace(/</g, "\\u003c"),
        }}
      />

      <Motion />

      {/*
        Sin JavaScript nadie añade `.is-visible`, así que la página se quedaría
        en blanco: el contenido está en el HTML pero con opacidad 0. Esto lo
        devuelve todo a la vista.
      */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Progreso de lectura */}
      <div
        data-progress
        aria-hidden
        className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-amber-500"
      />

      {/* ── Cabecera ───────────────────────────────────────────── */}
      <header
        data-header
        className="fixed inset-x-0 top-0 z-50 border-b border-transparent [&.is-solid]:border-stone-200 [&.is-solid]:bg-white/85 [&.is-solid]:backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-white transition-colors [.is-solid_&]:text-stone-900 sm:text-xl"
          >
            {nombre}
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
            {NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-white/85 transition-colors hover:text-amber-300 [.is-solid_&]:text-stone-600 [.is-solid_&]:hover:text-amber-700"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-white/70 transition-colors hover:text-white [.is-solid_&]:text-stone-500 [.is-solid_&]:hover:text-stone-800 sm:block"
            >
              Acceso personal
            </Link>
            <Link
              href="/reservar"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-950/20 transition-all hover:bg-amber-500 hover:shadow-amber-900/30"
            >
              Reservar mesa
            </Link>
            <MenuMovil enlaces={NAV} telefono={restaurant?.phone} />
          </div>
        </div>
      </header>

      {/* ── Hero con vídeo ─────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-stone-950 text-white">
        {/*
          El póster es la imagen que mide el LCP y lo que ve quien tenga el
          vídeo bloqueado o datos limitados. El vídeo va mudo, en bucle y con
          playsInline (sin él, iOS lo abre a pantalla completa).
        */}
        <video
          className="deriva-lenta absolute inset-0 h-full w-full object-cover opacity-60"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/video/hero-poster.jpg"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/45 to-stone-950/95"
        />

        <div className="relative mx-auto max-w-4xl px-4 pb-24 pt-28 text-center">
          <p
            data-reveal
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm text-amber-100 backdrop-blur-sm"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Cocina mediterránea de autor
          </p>

          <h1
            data-reveal
            data-reveal-delay="120"
            className="text-[clamp(2.6rem,8vw,5.5rem)] font-bold leading-[0.98] tracking-tight"
          >
            {nombre}
          </h1>

          {restaurant?.description && (
            <p
              data-reveal
              data-reveal-delay="260"
              className="mx-auto mt-7 max-w-xl text-lg text-stone-200/90"
            >
              {restaurant.description}
            </p>
          )}

          <div
            data-reveal
            data-reveal-delay="400"
            className="mt-10 flex flex-col justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/reservar"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-amber-950/40 transition-all hover:bg-amber-500 hover:shadow-2xl"
            >
              Reservar mesa
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                Llamar para reservar
              </a>
            )}
          </div>

          <p data-reveal data-reveal-delay="540" className="mt-9 text-sm text-stone-300">
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${horarioHoy ? "bg-emerald-400" : "bg-stone-500"}`}
            />
            {horarioHoy ? `Hoy abrimos ${horarioHoy}` : "Hoy cerramos. Consulta el horario más abajo."}
          </p>
        </div>

        <a
          href="#nosotros"
          aria-label="Ir al contenido"
          className="rebote absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 transition-colors hover:text-white"
        >
          <ChevronDown className="h-7 w-7" />
        </a>
      </section>

      {/* ── Cinta ──────────────────────────────────────────────── */}
      <div className="overflow-hidden border-y border-stone-200 bg-stone-900 py-4" aria-hidden>
        <div className="cinta-pista">
          {[0, 1].map((copia) => (
            <div key={copia} className="flex shrink-0">
              {CINTA.map((t) => (
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
      <section id="nosotros" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:py-32">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div data-reveal="izquierda" className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src={pexels(IMAGES.historia, 1000)}
                alt="Barra del restaurante al anochecer"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {/* Tarjeta flotante: profundidad sin recargar */}
            <div
              data-parallax="0.05"
              className="absolute -bottom-7 -right-4 hidden rounded-2xl border border-stone-100 bg-white/90 px-6 py-4 shadow-xl backdrop-blur-sm md:block"
            >
              <div className="text-3xl font-bold text-amber-600">12</div>
              <div className="text-xs text-stone-500">años en Gran Vía</div>
            </div>
          </div>

          <div data-reveal="derecha">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Nuestra casa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
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
                  <dt className="text-2xl font-bold text-stone-900">{valor}</dt>
                  <dd className="text-xs text-stone-500">{etiqueta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Carta ──────────────────────────────────────────────── */}
      <section id="carta" className="scroll-mt-20 bg-white py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">La carta</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
              Qué vas a comer
            </h2>
            <p className="mt-4 text-stone-600">
              Cambia con la temporada. Si tienes alguna alergia o intolerancia, dínoslo al
              reservar y la cocina lo tendrá en cuenta.
            </p>
          </div>

          <div className="mt-16 space-y-16">
            {CARTA.map((seccion) => (
              <div key={seccion.id}>
                <div data-reveal className="mb-8 flex items-baseline gap-4">
                  <h3 className="text-xl font-bold text-stone-900">{seccion.titulo}</h3>
                  <span className="h-px flex-1 bg-stone-200" />
                  <span className="hidden text-sm text-stone-400 sm:block">{seccion.descripcion}</span>
                </div>

                <ul className="grid gap-5 md:grid-cols-2">
                  {seccion.platos.map((plato, i) => (
                    <li
                      key={plato.nombre}
                      data-reveal
                      data-reveal-delay={i * 70}
                      className="group flex gap-4 rounded-2xl border border-stone-100 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-lg hover:shadow-amber-900/5"
                    >
                      {plato.imagen && (
                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={pexels(plato.imagen, 200, 200)}
                            alt={plato.nombre}
                            fill
                            sizes="96px"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h4 className="font-semibold text-stone-900">{plato.nombre}</h4>
                          <span className="whitespace-nowrap font-semibold text-amber-700">
                            {precio(plato.precio)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">{plato.descripcion}</p>
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
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Menú degustación */}
          <div data-reveal="zoom" className="mt-16 overflow-hidden rounded-3xl bg-stone-900 text-white">
            <div className="grid md:grid-cols-2">
              <div className="relative min-h-56">
                <Image
                  src={pexels(IMAGES.servicio, 900)}
                  alt="Pase de platos en sala"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="p-8 md:p-12">
                <UtensilsCrossed className="h-8 w-8 text-amber-400" />
                <h3 className="mt-4 text-2xl font-bold">{MENU_DEGUSTACION.titulo}</h3>
                <p className="mt-3 text-stone-300">{MENU_DEGUSTACION.descripcion}</p>
                <div className="mt-6 flex items-end gap-6">
                  <div>
                    <div className="text-3xl font-bold text-amber-400">
                      {precio(MENU_DEGUSTACION.precio)}
                    </div>
                    <div className="text-xs text-stone-400">
                      {MENU_DEGUSTACION.pasos} pasos, por persona
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-stone-200">
                      +{precio(MENU_DEGUSTACION.precioMaridaje)}
                    </div>
                    <div className="text-xs text-stone-400">maridaje opcional</div>
                  </div>
                </div>
                <Link
                  href="/reservar"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-500"
                >
                  Reservar mesa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vídeo de cocina ────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[65svh] items-center overflow-hidden bg-stone-950 text-white">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/video/cocina-poster.jpg"
          aria-hidden
          tabIndex={-1}
        >
          <source src="/video/cocina.mp4" type="video/mp4" />
        </video>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/55 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-24">
          <div data-reveal className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">La brasa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
              El fuego manda
            </h2>
            <p className="mt-6 text-lg text-stone-200/90">
              Encina, temperatura y paciencia. Casi todo lo que sale de esta cocina pasa
              antes por la parrilla: el pescado del día, las verduras de la huerta y la
              carne madurada treinta días.
            </p>
            <a
              href="#carta"
              className="group mt-8 inline-flex items-center gap-2 text-base font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Ver la carta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Galería ────────────────────────────────────────────── */}
      <section id="galeria" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:py-32">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Galería</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
            El sitio y la cocina
          </h2>
        </div>

        {/*
          Mosaico que cuadra en los dos tamaños: en móvil dos columnas y tres
          filas; en escritorio la primera foto ocupa 2×2 y las otras cinco
          rellenan las nueve celdas. Sin eso, la última quedaba huérfana.
        */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-3 md:gap-4">
          {GALERIA.map((foto, i) => (
            <div
              key={foto.id}
              data-reveal="zoom"
              data-reveal-delay={i * 80}
              className={`group relative aspect-square overflow-hidden rounded-2xl ${
                i === 0 ? "md:col-span-2 md:row-span-2 md:aspect-auto" : ""
              }`}
            >
              <Image
                src={pexels(foto.id, i === 0 ? 1200 : 800, i === 0 ? 1200 : 800)}
                alt={foto.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
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
      <section className="overflow-hidden bg-stone-900 py-24 text-white md:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 md:gap-16">
          <div data-reveal="izquierda">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">La cocina</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Un equipo pequeño y muy terco
            </h2>
            <p className="mt-6 text-stone-300">
              Siete personas en cocina y cuatro en sala. Lo justo para que nadie tenga que
              correr y cada plato salga como debe. Trabajamos con dos turnos al día porque
              preferimos servir bien a servir mucho.
            </p>
            <blockquote className="mt-8 border-l-2 border-amber-500 pl-5 italic text-stone-200">
              «Si un producto no está en su punto, ese día no lo servimos. Es la única norma
              que no se negocia.»
              <footer className="mt-2 text-sm not-italic text-stone-400">
                Elena Vidal, jefa de cocina
              </footer>
            </blockquote>
          </div>
          <div data-reveal="derecha" className="relative aspect-[4/5] overflow-hidden rounded-3xl md:aspect-[4/3]">
            <Image
              src={pexels(IMAGES.chef, 1000)}
              alt="Jefa de cocina emplatando"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Reseñas ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Reseñas</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
            Lo que dicen quienes ya han venido
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {RESENAS.map((r, i) => (
            <figure
              key={r.autor}
              data-reveal
              data-reveal-delay={i * 110}
              className="flex flex-col rounded-2xl border border-stone-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/5"
            >
              <Quote className="h-6 w-6 text-amber-200" />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
                {r.texto}
              </blockquote>
              <figcaption className="mt-5 border-t border-stone-100 pt-4">
                <div className="flex items-center gap-1" aria-label={`${r.puntuacion} de 5 estrellas`}>
                  {Array.from({ length: r.puntuacion }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  ))}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-stone-900">{r.autor}</div>
                <div className="text-xs text-stone-400">vía {r.fuente}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Visítanos ──────────────────────────────────────────── */}
      <section id="visitanos" className="scroll-mt-20 bg-white py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Visítanos</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl">
              Horario y reservas
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div data-reveal="izquierda" className="overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
              <h3 className="border-b border-stone-100 px-6 py-4 font-semibold text-stone-900">
                Horario semanal
              </h3>
              {hoursData.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-stone-400">
                  Consúltanos el horario por teléfono.
                </p>
              ) : (
                <ul>
                  {hoursData.map((h) => {
                    const t = turnos(h);
                    const esHoy = h.day_of_week === hoy;
                    return (
                      <li
                        key={h.day_of_week}
                        className={`flex items-center justify-between border-b border-stone-100 px-6 py-3.5 last:border-0 ${esHoy ? "bg-amber-50" : ""}`}
                      >
                        <span className={`text-sm ${esHoy ? "font-bold text-amber-900" : "font-medium text-stone-700"}`}>
                          {DAY_NAMES[h.day_of_week]}
                          {esHoy && <span className="ml-2 text-xs font-normal">(hoy)</span>}
                        </span>
                        {t ? (
                          <span className="text-sm text-stone-600">{t}</span>
                        ) : (
                          <span className="text-sm text-stone-400">Cerrado</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              data-reveal="derecha"
              className="flex flex-col justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 p-8 text-white md:p-10"
            >
              <h3 className="text-2xl font-bold">Reserva en 2 minutos</h3>
              <p className="mt-3 text-amber-50">
                Elige fecha, hora y número de comensales. Confirmación inmediata y podrás
                cancelar desde el enlace que te enviamos.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-amber-50">
                {[
                  "Sin llamadas ni esperas",
                  `Grupos de hasta ${restaurant?.max_party_size ?? 10} personas`,
                  "Cuéntanos alergias al reservar",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/reservar"
                className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-center font-bold text-amber-700 shadow-lg transition-all hover:bg-amber-50 hover:shadow-xl"
              >
                Reservar mesa
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              {restaurant?.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="mt-3 text-center text-sm text-amber-100 underline-offset-4 hover:underline"
                >
                  o llámanos al {restaurant.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pie ────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="text-lg font-bold text-stone-900">{nombre}</div>
              {restaurant?.description && (
                <p className="mt-2 max-w-xs text-sm text-stone-500">{restaurant.description}</p>
              )}
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Contacto
              </div>
              <ul className="space-y-2 text-sm text-stone-600">
                {restaurant?.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden />
                    {restaurant.address}
                  </li>
                )}
                {restaurant?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden />
                    <a href={`tel:${restaurant.phone}`} className="hover:text-amber-700">
                      {restaurant.phone}
                    </a>
                  </li>
                )}
                {restaurant?.email && (
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 flex-shrink-0 text-transparent" aria-hidden />
                    <a href={`mailto:${restaurant.email}`} className="hover:text-amber-700">
                      {restaurant.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Enlaces
              </div>
              <ul className="space-y-2 text-sm text-stone-600">
                {NAV.map(({ href, label }) => (
                  <li key={href}>
                    <a href={href} className="hover:text-amber-700">
                      {label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/reservar" className="font-medium text-amber-700 hover:text-amber-800">
                    Reservar mesa
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-stone-400 hover:text-stone-600">
                    Acceso personal
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
            © {new Date().getFullYear()} {nombre}. Carta, fotografías y vídeos de demostración.
          </div>
        </div>
      </footer>
    </div>
  );
}
