"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface WhatsAppReminderProps {
  customerName: string;
  phone: string | null;
  salonName: string;
  startsAt: string;
}

function buildMessage(name: string, salon: string, startsAt: string) {
  const d = new Date(startsAt);
  const fecha = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  });
  const hora = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
  const firstName = name.split(" ")[0];
  return `Hola ${firstName} 👋 Te recordamos tu cita en ${salon} el ${fecha} a las ${hora}. ¡Te esperamos!`;
}

/** Normaliza a formato internacional para wa.me (asume España si no hay prefijo). */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 9) return "34" + digits; // España
  return digits;
}

export function WhatsAppReminder({ customerName, phone, salonName, startsAt }: WhatsAppReminderProps) {
  const [tel, setTel] = useState(phone ?? "");
  const [message, setMessage] = useState(() => buildMessage(customerName, salonName, startsAt));

  function handleSend() {
    const normalized = normalizePhone(tel);
    const text = encodeURIComponent(message);
    const url = normalized
      ? `https://wa.me/${normalized}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-white p-4 mb-6">
      <div className="text-sm font-semibold mb-1 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        Recordatorio por WhatsApp
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Envía un mensaje listo para el cliente con un toque.
      </p>
      <div className="space-y-2">
        <Input
          type="tel"
          inputMode="tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          placeholder="Teléfono (ej: 626 758 515)"
          className="text-sm"
        />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="text-sm bg-slate-50"
        />
        <button
          type="button"
          onClick={handleSend}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}
