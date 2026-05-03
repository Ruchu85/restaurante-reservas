"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { updateAppointmentStatus, cancelAppointment } from "@/actions/appointments";
import type { AppointmentStatus } from "@/types";

interface AppointmentActionsProps {
  appointmentId: string;
  status: string;
}

export function AppointmentActions({ appointmentId, status }: AppointmentActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleAction(newStatus: AppointmentStatus) {
    startTransition(async () => {
      const result =
        newStatus === "cancelled"
          ? await cancelAppointment(appointmentId)
          : await updateAppointmentStatus(appointmentId, newStatus);

      if (result.error) {
        toast.error("Error: " + result.error);
      } else {
        toast.success("Cita actualizada");
      }
    });
  }

  if (status === "cancelled" || status === "completed") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === "pending" && (
          <DropdownMenuItem onClick={() => handleAction("confirmed")}>
            Confirmar
          </DropdownMenuItem>
        )}
        {status !== "completed" && (
          <DropdownMenuItem onClick={() => handleAction("completed")}>
            Marcar completada
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => handleAction("no_show")}
          className="text-yellow-600"
        >
          No presentado
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAction("cancelled")}
          className="text-destructive"
        >
          Cancelar cita
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
