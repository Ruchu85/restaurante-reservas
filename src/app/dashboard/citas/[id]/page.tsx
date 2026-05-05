import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { EditAppointmentForm } from "@/components/dashboard/EditAppointmentForm";
import { PrintButton } from "@/components/dashboard/PrintButton";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Appointment } from "@/types";

export const metadata = { title: "Editar cita — Panel admin" };

export default async function EditCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const [{ data: appointment }, { data: salon }] = await Promise.all([
    admin
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salonId ?? "")
      .single(),
    admin.from("salons").select("name, address, phone").eq("id", salonId ?? "").single(),
  ]);

  if (!appointment) notFound();

  const appt = { ticket_number: null, ...appointment } as Appointment;

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
              {appt.ticket_printed && <span className="ml-2 text-emerald-600">✓ Ticket impreso</span>}
            </p>
          </div>
          <PrintButton appointments={[appt]} label="Imprimir ticket" salon={salon ?? undefined} />
        </div>
      </div>

      <EditAppointmentForm appointment={appt} />
    </div>
  );
}
