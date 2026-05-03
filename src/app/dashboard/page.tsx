import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard — Salón Demo" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id;

  const today = new Date().toISOString().split("T")[0];

  const [
    { data: todayAppts },
    { data: pendingAppts },
    { count: totalThisMonth },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, service:services(name), staff:staff_members(display_name)")
      .eq("salon_id", salonId ?? "")
      .gte("starts_at", `${today}T00:00:00Z`)
      .lte("starts_at", `${today}T23:59:59Z`)
      .in("status", ["pending", "confirmed"])
      .order("starts_at")
      .limit(10),
    supabase
      .from("appointments")
      .select("id")
      .eq("salon_id", salonId ?? "")
      .eq("status", "pending"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId ?? "")
      .gte("starts_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const statusColors: Record<string, "default" | "warning" | "success" | "secondary"> = {
    pending: "warning",
    confirmed: "success",
    completed: "secondary",
    cancelled: "secondary",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No presentado",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumen</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/citas/nueva">Nueva cita</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Citas hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppts?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAppts?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Este mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalThisMonth ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {!todayAppts || todayAppts.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="mb-2 h-8 w-8 text-green-500" />
              <p className="text-muted-foreground text-sm">No hay citas programadas para hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium w-14 flex-shrink-0">
                      {formatTime(appt.starts_at)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{appt.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(appt.service as { name: string } | null)?.name}
                        {(appt.staff as { display_name: string } | null)?.display_name && (
                          <> · {(appt.staff as { display_name: string }).display_name}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={statusColors[appt.status] ?? "secondary"}>
                    {statusLabels[appt.status] ?? appt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
