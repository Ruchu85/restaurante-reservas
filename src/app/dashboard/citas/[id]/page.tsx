import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { getSalon, salonToTicketInfo } from "@/lib/salon";
import { notFound } from "next/navigation";
import { EditAppointmentForm } from "@/components/dashboard/EditAppointmentForm";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { WhatsAppReminder } from "@/components/dashboard/WhatsAppReminder";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Appointment, Customer, Service } from "@/types";

export const metadata = { title: "Editar cita — PELUQUERIA ALI" };

export default async function EditCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const salon = await getSalon();
  const SALON_INFO = salonToTicketInfo(salon);

  const [{ data: appointment }, { data: services }, { data: staff }] = await Promise.all([
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
    admin
      .from("staff_members")
      .select("id, name")
      .eq("salon_id", salonId ?? "")
      .eq("active", true)
      .order("name"),
  ]);

  if (!appointment) notFound();

  const appt = { ticket_number: null, price: null, ...appointment } as Appointment;

  // Buscar el teléfono del cliente para el recordatorio por WhatsApp
  let customerPhone: string | null = null;
  if (appt.status === "active") {
    const { data: customer } = await admin
      .from("customers")
      .select("phone")
      .eq("salon_id", salonId ?? "")
      .ilike("name", appt.customer_name)
      .maybeSingle();
    customerPhone = (customer as Pick<Customer, "phone"> | null)?.phone ?? null;
  }

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

      {appt.status === "active" && (
        <WhatsAppReminder
          customerName={appt.customer_name}
          phone={customerPhone}
          salonName={SALON_INFO.name}
          startsAt={appt.starts_at}
        />
      )}

      <EditAppointmentForm
        appointment={appt}
        services={(services as Service[]) ?? []}
        staff={staff ?? []}
      />
    </div>
  );
}
