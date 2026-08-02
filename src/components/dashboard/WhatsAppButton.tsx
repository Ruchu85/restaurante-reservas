"use client";

import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/phone";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Template = "confirm" | "remind" | "late" | "waitlist";

const TEMPLATES: Record<Template, (ctx: MessageContext) => string> = {
  confirm: (c) =>
    `Hola ${c.guestName}, te confirmamos tu reserva para ${c.partySize} personas hoy a las ${c.time}. ¡Te esperamos!`,
  remind: (c) =>
    `Hola ${c.guestName}, te recordamos tu reserva de hoy a las ${c.time} para ${c.partySize} personas. ¿Nos confirmas que vienes?`,
  late: (c) =>
    `Hola ${c.guestName}, tu mesa de las ${c.time} está lista. ¿Vienes de camino? Podemos guardarla 15 minutos más.`,
  waitlist: (c) =>
    `Hola ${c.guestName}, se nos ha liberado una mesa para ${c.partySize} personas. ¿La quieres? Responde en los próximos 10 minutos, por favor.`,
};

interface MessageContext {
  guestName: string;
  partySize: number;
  time: string;
}

interface WhatsAppButtonProps {
  phone: string | null | undefined;
  guestName: string;
  partySize: number;
  startsAt?: string;
  template?: Template;
  label?: string;
  className?: string;
  /** Zona del restaurante: la hora del mensaje debe ser la que ve el cliente. */
  timeZone?: string;
}

/**
 * Abre WhatsApp con un mensaje ya redactado para el comensal.
 *
 * Solo aparece si el número puede recibir WhatsApp: los fijos españoles
 * (8xx/9xx) no tienen, así que mostrar el botón sería engañar al usuario.
 */
export function WhatsAppButton({
  phone,
  guestName,
  partySize,
  startsAt,
  template = "remind",
  label,
  className,
  timeZone,
}: WhatsAppButtonProps) {
  const time = startsAt ? formatTime(startsAt, timeZone) : "";
  const message = TEMPLATES[template]({ guestName, partySize, time });
  const href = whatsappLink(phone, message);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Escribir a ${guestName} por WhatsApp`}
      aria-label={`Escribir a ${guestName} por WhatsApp`}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100",
        className,
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
