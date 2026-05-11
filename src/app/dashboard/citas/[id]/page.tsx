import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { EditAppointmentForm } from "@/components/dashboard/EditAppointmentForm";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { SALON_INFO } from "@/lib/salonConfig";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Appointment, Service } from "@/types";

export const metadata = { title: "Editar cita — PELUQUERIA ALI" };

export default async function EditCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const [{ data: appointment }, { data: services }] = await Promise.all([
    admin
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salonId ?? "")
      .single(),
    admin
      .from("services")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .eq("active", true)
      .order("name"),
  ]);

  if (!appointment) notFound();

  const appt = { ticket_number: null, price: null, ...appointment } as Appointment;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/citas"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a citas
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Editar cita</h1>
            <p className="text-sm text-muted-foreground">
              {appt.customer_name} · {appt.service}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {appt.ticket_printed ? (
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-xs font-medium">
                  ✓ Ticket impreso
                  {appt.ticket_number ? ` · Nº ${appt.ticket_number}` : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Pendiente de imprimir
                </Badge>
              )}
            </div>
          </div>
          <PrintButton appointments={[appt]} label="Imprimir ticket" salon={SALON_INFO} />
        </div>
      </div>

      <EditAppointmentForm appointment={appt} services={(services as Service[]) ?? []} />
    </div>
  );
}
