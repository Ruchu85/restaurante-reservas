import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppointmentActions } from "@/components/dashboard/AppointmentActions";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { getSalon, salonToTicketInfo } from "@/lib/salon";
import type { Appointment } from "@/types";

export const metadata = { title: "Citas — Panel admin" };

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const SALON_INFO = salonToTicketInfo(await getSalon());
  const q = params.q?.trim() ?? "";

  let query = admin
    .from("appointments")
    .select("*, staff:staff_members(id, name)")
    .eq("salon_id", salonId ?? "")
    .order("starts_at", { ascending: false })
    .limit(100);

  if (params.status === "cancelled") {
    query = query.eq("status", "cancelled");
  } else {
    query = query.eq("status", "active");
  }

  if (q) {
    query = query.ilike("customer_name", `%${q}%`);
  }

  const { data: appointments } = await query;
  const appts = (appointments ?? []).map((a) => ({ ticket_number: null, ...a })) as Appointment[];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Citas</h1>
        <div className="flex items-center gap-2">
          {appts.length > 0 && params.status !== "cancelled" && (
            <PrintButton appointments={appts} label="Imprimir todos" salon={SALON_INFO} />
          )}
          <Button asChild size="sm">
            <Link href="/dashboard/citas/nueva">
              <Plus className="mr-1 h-4 w-4" />
              Nueva
            </Link>
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <form method="GET" className="mb-3 flex gap-2">
        {params.status === "cancelled" && <input type="hidden" name="status" value="cancelled" />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente…"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button type="submit" className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
          Buscar
        </button>
      </form>

      <div className="mb-4 flex gap-2">
        <Link href={q ? `/dashboard/citas?q=${encodeURIComponent(q)}` : "/dashboard/citas"}>
          <Badge variant={!params.status || params.status === "active" ? "default" : "outline"} className="cursor-pointer">
            Activas
          </Badge>
        </Link>
        <Link href={q ? `/dashboard/citas?status=cancelled&q=${encodeURIComponent(q)}` : "/dashboard/citas?status=cancelled"}>
          <Badge variant={params.status === "cancelled" ? "default" : "outline"} className="cursor-pointer">
            Canceladas
          </Badge>
        </Link>
        {q && (
          <Link href={params.status === "cancelled" ? "/dashboard/citas?status=cancelled" : "/dashboard/citas"}>
            <Badge variant="outline" className="cursor-pointer">
              ✕ &ldquo;{q}&rdquo;
            </Badge>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {appts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No hay citas para mostrar.
            </div>
          ) : (
            <div className="divide-y">
              {appts.map((appt) => (
                <div key={appt.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{appt.customer_name}</span>
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{appt.service}</span>
                      {appt.ticket_printed && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Impreso</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {formatDate(appt.starts_at)} · {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)}
                    </div>
                    {appt.notes && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {appt.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {appt.status === "active" && (
                      <>
                        <PrintButton appointments={[appt]} variant="icon" salon={SALON_INFO} />
                        <AppointmentActions appointmentId={appt.id} status={appt.status} />
                      </>
                    )}
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
