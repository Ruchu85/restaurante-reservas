"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cancelAppointment } from "@/actions/appointments";

interface AppointmentActionsProps {
  appointmentId: string;
  status: string;
}

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const [isPending, startTransition] = useTransition();

  if (status === "cancelled") return null;

  function handleCancel() {
    if (!confirm("¿Cancelar esta cita?")) return;
    startTransition(async () => {
      const result = await cancelAppointment(appointmentId);
      if (result.error) {
        toast.error("Error: " + result.error);
      } else {
        toast.success("Cita cancelada");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={handleCancel}
      title="Cancelar cita"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
