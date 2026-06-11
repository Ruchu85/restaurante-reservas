import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { getSalon, salonToTicketInfo } from "@/lib/salon";
import type { Appointment } from "@/types";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Tickets — Panel admin" };

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = todayStr();
  const from = params.from ?? today;
  const to = params.to ?? today;

  const admin = createAdminClient();
  const salonId = await getSalonId();
  const SALON_INFO = salonToTicketInfo(await getSalon());

  const { data: appts } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("status", "active")
    .gte("starts_at", from + "T00:00:00+00:00")
    .lte("starts_at", to + "T23:59:59+00:00")
    .order("starts_at");

  const appointments = (appts ?? []).map((a) => ({ ticket_number: null, ...a })) as Appointment[];

  const printed = appointments.filter((a) => a.ticket_printed);
  const pending = appointments.filter((a) => !a.ticket_printed);

  return (
    <div>
      <div className="mb-5">
        <Link
          href="/dashboard"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Panel
        </Link>
        <h1 className="text-xl font-bold md:text-2xl">Tickets</h1>
        <p className="text-sm text-muted-foreground">Gestión e impresión de tickets por fecha</p>
      </div>

      {/* Date filter form */}
      <form method="GET" className="mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Summary + batch print */}
      {appointments.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {appointments.length} cita{appointments.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-emerald-700 font-medium">{printed.length} impresas</span> ·{" "}
            <span className="text-amber-700 font-medium">{pending.length} pendientes</span>
          </span>
          <PrintButton appointments={appointments} label="Imprimir todos" salon={SALON_INFO} />
          {pending.length > 0 && (
            <PrintButton appointments={pending} label="Solo pendientes" salon={SALON_INFO} />
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {appointments.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No hay citas en este rango de fechas.
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {appt.ticket_number && (
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Nº {appt.ticket_number}
                        </span>
                      )}
                      <span className="font-medium">{appt.customer_name}</span>
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{appt.service}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {formatDate(appt.starts_at)} · {formatTime(appt.starts_at)}–{formatTime(appt.ends_at)}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant={appt.ticket_printed ? "outline" : "secondary"} className={appt.ticket_printed ? "border-emerald-300 text-emerald-700" : ""}>
                      {appt.ticket_printed ? "✓ Impreso" : "Pendiente"}
                    </Badge>
                    <PrintButton appointments={[appt]} variant="icon" salon={SALON_INFO} />
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
