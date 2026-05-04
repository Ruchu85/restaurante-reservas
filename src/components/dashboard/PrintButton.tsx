"use client";

import { useTransition } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { printTickets } from "@/lib/printTicket";
import { markTicketPrinted } from "@/actions/appointments";
import type { Appointment } from "@/types";
import { cn } from "@/lib/utils";

interface PrintButtonProps {
  appointments: Appointment[];
  variant?: "icon" | "default";
  label?: string;
  salonName?: string;
}

export function PrintButton({
  appointments,
  variant = "default",
  label = "Imprimir tickets",
  salonName = "Salón",
}: PrintButtonProps) {
  const [isPending, startTransition] = useTransition();
  const allPrinted = appointments.length > 0 && appointments.every((a) => a.ticket_printed);

  function handlePrint() {
    if (!appointments.length) return;
    printTickets(appointments, salonName);
    const ids = appointments.map((a) => a.id);
    startTransition(async () => {
      const result = await markTicketPrinted(ids);
      if (result.error) {
        toast.error("No se pudo marcar como impreso");
      }
    });
  }

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrint}
        disabled={isPending}
        title={allPrinted ? "Ticket impreso (reimprimir)" : "Imprimir ticket"}
        className={cn(
          "text-muted-foreground",
          allPrinted ? "text-emerald-600 hover:text-emerald-700" : "hover:text-foreground"
        )}
      >
        <Printer className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isPending || !appointments.length}
      className={cn(allPrinted && "border-emerald-300 text-emerald-700")}
    >
      <Printer className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );
}
