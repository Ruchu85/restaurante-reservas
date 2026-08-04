"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, Phone, Clock } from "lucide-react";

interface Props {
  enlaces: { href: string; label: string }[];
  telefono?: string | null;
  horarioHoy?: string | null;
}

/**
 * Navegación de móvil. En escritorio los enlaces van en la cabecera; por
 * debajo de `md` no caben, así que aquí se despliegan a pantalla completa.
 *
 * Se apoya en el Dialog de Radix en vez de en un div condicional: eso da
 * gratis la trampa de foco, el fondo inerte para los lectores de pantalla, el
 * cierre con Escape, la devolución del foco al botón y el bloqueo del scroll.
 * Escrito a mano, el foco se escapaba del panel a la séptima tabulación.
 */
export function MenuMovil({ enlaces, telefono, horarioHoy }: Props) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir menú"
          className="foco-claro -mr-1 p-2.5 text-white transition-colors [.is-solid_&]:text-stone-800 [.is-solid_&]:focus-visible:outline-amber-700 md:hidden"
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="panel-fondo fixed inset-0 z-[70] bg-stone-950/60 backdrop-blur-sm md:hidden" />
        <Dialog.Content className="panel-menu fixed inset-0 z-[70] flex flex-col bg-stone-950 md:hidden">
          <Dialog.Title className="sr-only">Menú</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navegación del sitio, teléfono y reserva de mesa.
          </Dialog.Description>

          <div className="flex h-16 items-center justify-end px-4">
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar menú"
                className="foco-claro -mr-1 p-2.5 text-white"
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <nav aria-label="Principal" className="flex flex-1 flex-col justify-center px-8 pb-16">
            {enlaces.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={cerrar}
                className="titular foco-claro border-b border-white/10 py-5 text-3xl text-white transition-colors active:text-amber-400"
              >
                {label}
              </a>
            ))}

            <Link
              href="/reservar"
              onClick={cerrar}
              className="foco-claro mt-8 rounded-xl bg-amber-700 px-6 py-4 text-center text-lg font-bold text-white"
            >
              Reservar mesa
            </Link>

            <div className="mt-8 space-y-3 text-sm text-stone-300">
              {horarioHoy && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" aria-hidden />
                  Hoy: {horarioHoy}
                </p>
              )}
              {telefono && (
                <a href={`tel:${telefono}`} className="foco-claro flex items-center gap-2 py-1">
                  <Phone className="h-4 w-4 text-amber-400" aria-hidden />
                  {telefono}
                </a>
              )}
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
