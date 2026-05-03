import Link from "next/link";
import { CheckCircle2, Calendar, Clock, User, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata = {
  title: "Cita confirmada — Salón Demo",
};

interface AppointmentDetail {
  customer_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  service: { name: string; duration_minutes: number; price_cents: number } | null;
  staff: { display_name: string } | null;
}

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const appointmentId = params.id;

  let appointment: AppointmentDetail | null = null;

  if (appointmentId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("appointments")
      .select(
        "customer_name, starts_at, ends_at, status, notes, service:services(name, duration_minutes, price_cents), staff:staff_members(display_name)",
      )
      .eq("id", appointmentId)
      .single();

    if (data) {
      appointment = {
        customer_name: data.customer_name,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        status: data.status,
        notes: data.notes,
        service: Array.isArray(data.service) ? (data.service[0] ?? null) : (data.service as AppointmentDetail["service"]),
        staff: Array.isArray(data.staff) ? (data.staff[0] ?? null) : (data.staff as AppointmentDetail["staff"]),
      };
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80">
            <Scissors className="h-5 w-5" />
            Salón Demo
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">¡Cita confirmada!</h1>
          <p className="mt-2 text-muted-foreground">
            Hemos recibido tu reserva correctamente. Te esperamos.
          </p>
        </div>

        {appointment && (
          <Card className="mb-6 text-left">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Detalles de tu cita</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{appointment.customer_name}</span>
                </div>
                {appointment.service && (
                  <div className="flex items-center gap-3 text-sm">
                    <Scissors className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{appointment.service.name}</span>
                  </div>
                )}
                {appointment.staff && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Con {appointment.staff.display_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{formatDate(appointment.starts_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>
                    {formatTime(appointment.starts_at)} —{" "}
                    {formatTime(appointment.ends_at)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Si necesitas cancelar o modificar tu cita, llámanos o escríbenos.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/">Volver al inicio</Link>
            </Button>
            <Button asChild>
              <Link href="/reservar">Hacer otra reserva</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
