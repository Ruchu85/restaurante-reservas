export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Clock, MapPin, Phone, Star, UtensilsCrossed, Quote } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestaurant, getBusinessHours } from "@/lib/restaurant";
import { toLocalDate, dayOfWeek } from "@/lib/dates";
import {
  pexels,
  IMAGES,
  CARTA,
  MENU_DEGUSTACION,
  RESENAS,
  GALERIA,
} from "@/lib/landingContent";
import type { BusinessHours } from "@/types";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const NAV = [
  { href: "#carta", label: "Carta" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#galeria", label: "Galería" },
  { href: "#visitanos", label: "Visítanos" },
];

/** Turnos de un día como "13:30 – 16:00 · 20:30 – 23:30". */
function turnos(h: BusinessHours | undefined): string | null {
  if (!h || !h.is_open) return null;
  const rangos: string[] = [];
  if (h.opens_at && h.closes_at) rangos.push(`${h.opens_at.slice(0, 5)} – ${h.closes_at.slice(0, 5)}`);
  if (h.opens_at_2 && h.closes_at_2) rangos.push(`${h.opens_at_2.slice(0, 5)} – ${h.closes_at_2.slice(0, 5)}`);
  return rangos.length > 0 ? rangos.join(" · ") : null;
}

function precio(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default async function HomePage() {
  const restaurant = await getRestaurant();
  const timeZone = restaurant?.timezone ?? "Europe/Madrid";
  const hoursData = restaurant
    ? await getBusinessHours(createAdminClient(), restaurant.id)
    : [];

  const hoy = dayOfWeek(toLocalDate(new Date(), timeZone));
  const horarioHoy = turnos(hoursData.find((h) => h.day_of_week === hoy));
  const nombre = restaurant?.name ?? "Restaurante";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-stone-800 sm:text-xl">
            {nombre}
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
            {NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium text-stone-600 transition-colors hover:text-amber-700"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-stone-500 transition-colors hover:text-stone-800 sm:block"
            >
              Acceso personal
            </Link>
            <Link
              href="/reservar"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Reservar mesa
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-stone-900 text-white">
        <Image
          src={pexels(IMAGES.hero, 1920)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-stone-950/80 via-stone-950/55 to-stone-950/90"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-28 text-center md:py-40">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-200">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Cocina mediterránea de autor
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">{nombre}</h1>
          {restaurant?.description && (
            <p className="mx-auto mt-6 max-w-xl text-lg text-stone-200">{restaurant.description}</p>
          )}

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/reservar"
              className="rounded-xl bg-amber-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-amber-950/40 transition-colors hover:bg-amber-500"
            >
              Reservar mesa ahora
            </Link>
            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/20"
              >
                Llamar para reservar
              </a>
            )}
          </div>

          <p className="mt-8 text-sm text-stone-300">
            {horarioHoy ? (
              <>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Hoy abrimos {horarioHoy}
              </>
            ) : (
              <>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-stone-500" />
                Hoy cerramos. Consulta el horario más abajo.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ── Barra de datos ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {restaurant?.address && (
            <div className="flex items-start gap-4 rounded-2xl border border-stone-100 bg-white p-6 shadow-sm">
              <span className="rounded-lg bg-amber-50 p-2">
                <MapPin className="h-5 w-5 text-amber-600" />
              </span>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Dónde estamos
                </div>
                <div className="text-sm font-medium text-stone-800">{restaurant.address}</div>
              </div>
            </div>
          )}
          {restaurant?.phone && (
            <div className="flex items-start gap-4 rounded-2xl border border-stone-100 bg-white p-6 shadow-sm">
              <span className="rounded-lg bg-amber-50 p-2">
                <Phone className="h-5 w-5 text-amber-600" />
              </span>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Reservas por teléfono
                </div>
                <a
                  href={`tel:${restaurant.phone}`}
                  className="text-sm font-medium text-stone-800 transition-colors hover:text-amber-600"
                >
                  {restaurant.phone}
                </a>
              </div>
            </div>
          )}
          <div className="flex items-start gap-4 rounded-2xl border border-stone-100 bg-white p-6 shadow-sm">
            <span className="rounded-lg bg-amber-50 p-2">
              <Clock className="h-5 w-5 text-amber-600" />
            </span>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
                Hoy
              </div>
              <div className="text-sm font-medium text-stone-800">{horarioHoy ?? "Cerrado"}</div>
              <div className="text-xs text-stone-400">
                Grupos de más de {restaurant?.max_party_size ?? 10}: llámanos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Nosotros ─────────────────────────────────────────────── */}
      <section id="nosotros" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:py-28">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={pexels(IMAGES.historia, 1000)}
              alt="Barra del restaurante al anochecer"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Nuestra casa
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-800 md:text-4xl">
              Producto de temporada, sin artificios
            </h2>
            <div className="mt-6 space-y-4 text-stone-600">
              <p>
                Abrimos en el corazón de Madrid con una idea sencilla: comprar bien y
                molestar poco al producto. Trabajamos con pequeños productores del
                Mediterráneo y cambiamos la carta cada estación, según lo que llega al
                mercado esa misma mañana.
              </p>
              <p>
                La brasa de encina es el centro de la cocina. A su alrededor, arroces de
                fondo largo, pescado de lonja y verduras de huerta cercana. Nada viaja más
                de lo necesario.
              </p>
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-stone-200 pt-6">
              {[
                ["2014", "Desde"],
                ["48", "Comensales"],
                ["100%", "Producto nacional"],
              ].map(([valor, etiqueta]) => (
                <div key={etiqueta}>
                  <dt className="text-2xl font-bold text-stone-800">{valor}</dt>
                  <dd className="text-xs text-stone-500">{etiqueta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Carta ────────────────────────────────────────────────── */}
      <section id="carta" className="scroll-mt-20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">La carta</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-800 md:text-4xl">
              Qué vas a comer
            </h2>
            <p className="mt-4 text-stone-600">
              Cambia con la temporada. Si tienes alguna alergia o intolerancia, dínoslo al
              reservar y la cocina lo tendrá en cuenta.
            </p>
          </div>

          <div className="mt-14 space-y-16">
            {CARTA.map((seccion) => (
              <div key={seccion.id}>
                <div className="mb-8 flex items-baseline gap-4">
                  <h3 className="text-xl font-bold text-stone-800">{seccion.titulo}</h3>
                  <span className="h-px flex-1 bg-stone-200" />
                  <span className="hidden text-sm text-stone-400 sm:block">
                    {seccion.descripcion}
                  </span>
                </div>

                <ul className="grid gap-6 md:grid-cols-2">
                  {seccion.platos.map((plato) => (
                    <li
                      key={plato.nombre}
                      className="flex gap-4 rounded-2xl border border-stone-100 p-4 transition-colors hover:border-amber-200 hover:bg-amber-50/40"
                    >
                      {plato.imagen && (
                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={pexels(plato.imagen, 200, 200)}
                            alt={plato.nombre}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h4 className="font-semibold text-stone-800">{plato.nombre}</h4>
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
          <div className="mt-16 overflow-hidden rounded-3xl bg-stone-900 text-white">
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
                  className="mt-8 inline-block rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-500"
                >
                  Reservar mesa
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Galería ──────────────────────────────────────────────── */}
      <section id="galeria" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Galería</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-800 md:text-4xl">
            El sitio y la cocina
          </h2>
        </div>
        {/*
          Mosaico que cuadra en ambos tamaños con 6 fotos:
          - móvil  : 2 columnas → 3 filas exactas
          - desktop: la primera ocupa 2×2 y las otras 5 rellenan → 9 celdas, 3 filas
          Sin esto la última foto quedaba sola en su fila.
        */}
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-3 md:gap-4">
          {GALERIA.map((foto, i) => (
            <div
              key={foto.id}
              className={`relative aspect-square overflow-hidden rounded-2xl ${
                i === 0 ? "md:col-span-2 md:row-span-2 md:aspect-auto" : ""
              }`}
            >
              <Image
                src={pexels(foto.id, i === 0 ? 1200 : 800, i === 0 ? 1200 : 800)}
                alt={foto.alt}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Equipo ───────────────────────────────────────────────── */}
      <section className="bg-stone-900 py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-400">
              La cocina
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Un equipo pequeño y muy terco
            </h2>
            <p className="mt-6 text-stone-300">
              Siete personas en cocina y cuatro en sala. Lo justo para que nadie tenga que
              correr y cada plato salga como debe. Trabajamos con dos turnos al día porque
              preferimos servir bien a servir mucho.
            </p>
            <blockquote className="mt-8 border-l-2 border-amber-500 pl-5 text-stone-200 italic">
              «Si un producto no está en su punto, ese día no lo servimos. Es la única
              norma que no se negocia.»
              <footer className="mt-2 text-sm not-italic text-stone-400">
                Elena Vidal, jefa de cocina
              </footer>
            </blockquote>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl md:aspect-[4/3]">
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

      {/* ── Reseñas ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Reseñas</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-800 md:text-4xl">
            Lo que dicen quienes ya han venido
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {RESENAS.map((r) => (
            <figure
              key={r.autor}
              className="flex flex-col rounded-2xl border border-stone-100 bg-white p-6 shadow-sm"
            >
              <Quote className="h-6 w-6 text-amber-200" />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
                {r.texto}
              </blockquote>
              <figcaption className="mt-5 border-t border-stone-100 pt-4">
                <div className="flex items-center gap-1" aria-label={`${r.puntuacion} de 5`}>
                  {Array.from({ length: r.puntuacion }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="mt-1.5 text-sm font-semibold text-stone-800">{r.autor}</div>
                <div className="text-xs text-stone-400">vía {r.fuente}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Visítanos: horario + reserva ─────────────────────────── */}
      <section id="visitanos" className="scroll-mt-20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
              Visítanos
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-800 md:text-4xl">
              Horario y reservas
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Horario */}
            <div className="overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
              <h3 className="border-b border-stone-100 px-6 py-4 font-semibold text-stone-800">
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
                        className={`flex items-center justify-between border-b border-stone-100 px-6 py-3.5 last:border-0 ${
                          esHoy ? "bg-amber-50" : ""
                        }`}
                      >
                        <span
                          className={`text-sm ${
                            esHoy ? "font-bold text-amber-900" : "font-medium text-stone-700"
                          }`}
                        >
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

            {/* Reserva */}
            <div className="flex flex-col justify-center rounded-2xl bg-amber-600 p-8 text-white md:p-10">
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
                className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-center font-bold text-amber-700 shadow-lg transition-colors hover:bg-amber-50"
              >
                Reservar mesa
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

      {/* ── Pie ──────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="text-lg font-bold text-stone-800">{nombre}</div>
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
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    {restaurant.address}
                  </li>
                )}
                {restaurant?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0 text-amber-600" />
                    <a href={`tel:${restaurant.phone}`} className="hover:text-amber-700">
                      {restaurant.phone}
                    </a>
                  </li>
                )}
                {restaurant?.email && (
                  <li>
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
            © {new Date().getFullYear()} {nombre}. Carta y fotografías de demostración.
          </div>
        </div>
      </footer>
    </div>
  );
}
