"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface Props {
  enlaces: { href: string; label: string }[];
  telefono?: string | null;
}

/**
 * Navegación de móvil. En escritorio los enlaces van en la cabecera; por
 * debajo de `md` no caben, así que aquí se despliegan a pantalla completa.
 *
 * El panel se cierra al pulsar un enlace (son anclas de la misma página: sin
 * navegación no hay nada que lo cierre) y con la tecla Escape.
 */
export function MenuMovil({ enlaces, telefono }: Props) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    // Bloquear el scroll de fondo: si no, al arrastrar sobre el panel se
    // mueve la página que hay debajo.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        className="-mr-1 p-2 text-white transition-colors [.is-solid_&]:text-stone-800 md:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className="fixed inset-0 z-[70] flex flex-col bg-stone-950/97 backdrop-blur-sm md:hidden"
        >
          <div className="flex h-16 items-center justify-end px-4">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú"
              className="-mr-1 p-2 text-white"
              autoFocus
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav aria-label="Principal" className="flex flex-1 flex-col justify-center gap-1 px-8 pb-24">
            {enlaces.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setAbierto(false)}
                className="border-b border-white/10 py-5 text-3xl font-semibold text-white transition-colors active:text-amber-400"
              >
                {label}
              </a>
            ))}
            <Link
              href="/reservar"
              onClick={() => setAbierto(false)}
              className="mt-8 rounded-xl bg-amber-600 px-6 py-4 text-center text-lg font-bold text-white"
            >
              Reservar mesa
            </Link>
            {telefono && (
              <a
                href={`tel:${telefono}`}
                className="mt-4 text-center text-base text-stone-300 underline-offset-4"
              >
                {telefono}
              </a>
            )}
            <Link
              href="/login"
              onClick={() => setAbierto(false)}
              className="mt-8 text-center text-sm text-stone-500"
            >
              Acceso personal
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
