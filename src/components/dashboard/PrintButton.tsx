"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { downloadTicketsPDF, type SalonInfo } from "@/lib/printTicket";
import { markTicketPrinted } from "@/actions/appointments";
import type { Appointment } from "@/types";
import { cn } from "@/lib/utils";

interface PrintButtonProps {
  appointments: Appointment[];
  variant?: "icon" | "default";
  label?: string;
  salon?: SalonInfo;
}

export function PrintButton({
  appointments,
  variant = "default",
  label = "Imprimir tickets",
  salon,
}: PrintButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const allPrinted = appointments.length > 0 && appointments.every((a) => a.ticket_printed);

  function handlePrint() {
    if (!appointments.length) return;
    const ids = appointments.map((a) => a.id);
    startTransition(async () => {
      try {
        // Assign ticket numbers first so the PDF shows the real sequential number
        const result = await markTicketPrinted(ids);
        if ("error" in result && result.error) {
          toast.error("Error al marcar como impreso: " + result.error);
          return;
        }
        const returned = "appointments" in result ? result.appointments : null;
        const aptsWithNumbers = returned && returned.length > 0 ? returned : appointments;
        await downloadTicketsPDF(aptsWithNumbers, salon);
        // Force server components on this page to re-render with fresh data
        router.refresh();
      } catch (err) {
        console.error("[PrintButton]", err);
        toast.error("Error al generar el ticket. Inténtalo de nuevo.");
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
      {isPending ? "Procesando…" : label}
    </Button>
  );
}
