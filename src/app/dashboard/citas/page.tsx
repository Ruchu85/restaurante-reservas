import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";
import { AppointmentActions } from "@/components/dashboard/AppointmentActions";

export const metadata = { title: "Citas — Salón Demo" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No presentado",
};

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "secondary" | "destructive"> = {
  pending: "warning",
  confirmed: "success",
  completed: "secondary",
  cancelled: "destructive",
  no_show: "secondary",
};

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  let query = supabase
    .from("appointments")
    .select("*, service:services(name, price_cents), staff:staff_members(display_name)")
    .eq("salon_id", salonId)
    .order("starts_at", { ascending: false })
    .limit(50);

  if (params.status) query = query.eq("status", params.status);

  const { data: appointments } = await query;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Citas</h1>
          <p className="text-sm text-muted-foreground">Listado y gestión de reservas</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/citas/nueva">Nueva cita</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {[
          { label: "Todas", value: "" },
          { label: "Pendientes", value: "pending" },
          { label: "Confirmadas", value: "confirmed" },
          { label: "Completadas", value: "completed" },
          { label: "Canceladas", value: "cancelled" },
        ].map(({ label, value }) => (
          <Link key={value} href={value ? `/dashboard/citas?status=${value}` : "/dashboard/citas"}>
            <Badge
              variant={params.status === value || (!params.status && value === "") ? "default" : "outline"}
              className="cursor-pointer"
            >
              {label}
            </Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!appointments || appointments.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No hay citas que mostrar.
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{appt.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {appt.customer_email} · {appt.customer_phone}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{(appt.service as { name: string } | null)?.name}</span>
                      {(appt.staff as { display_name: string } | null)?.display_name && (
                        <span>con {(appt.staff as { display_name: string }).display_name}</span>
                      )}
                      <span>
                        {formatDate(appt.starts_at)} · {formatTime(appt.starts_at)} — {formatTime(appt.ends_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={STATUS_VARIANTS[appt.status] ?? "secondary"}>
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                    <AppointmentActions appointmentId={appt.id} status={appt.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
