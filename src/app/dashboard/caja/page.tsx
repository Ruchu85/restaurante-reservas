import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { getSalon, salonToTicketInfo } from "@/lib/salon";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { ChevronLeft, Euro } from "lucide-react";
import type { Appointment } from "@/types";

export const metadata = { title: "Cierre de caja — PELUQUERIA ALI" };

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const params = await searchParams;
  const day = params.day ?? todayStr();

  const admin = createAdminClient();
  const salonId = await getSalonId();
  const SALON_INFO = salonToTicketInfo(await getSalon());

  const { data } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("status", "active")
    .gte("starts_at", day + "T00:00:00+00:00")
    .lte("starts_at", day + "T23:59:59+00:00")
    .order("starts_at");

  const appts = (data ?? []).map((a) => ({ ticket_number: null, ...a })) as Appointment[];
  const total = appts.reduce((s, a) => s + (a.price ?? 0), 0);
  const withPrice = appts.filter((a) => a.price != null).length;
  const withoutPrice = appts.length - withPrice;

  // Desglose por servicio
  const byService = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const cur = byService.get(a.service) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += a.price ?? 0;
    byService.set(a.service, cur);
  }
  const services = [...byService.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  const dayLabel = new Date(day + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="mb-5">
        <Link
          href="/dashboard/informes"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Informes
        </Link>
        <h1 className="text-xl font-bold md:text-2xl flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Cierre de caja
        </h1>
        <p className="text-sm text-muted-foreground capitalize">{dayLabel}</p>
      </div>

      {/* Selector de día */}
      <form method="GET" className="mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Día</label>
          <input type="date" name="day" defaultValue={day} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
          Ver
        </button>
      </form>

      {/* Total */}
      <Card className="mb-5">
        <CardContent className="p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total del día</div>
          <div className="text-4xl font-bold">{total.toFixed(2)} €</div>
          <div className="text-xs text-muted-foreground mt-2">
            {appts.length} cita{appts.length !== 1 ? "s" : ""}
            {withoutPrice > 0 && (
              <span className="text-amber-600"> · {withoutPrice} sin precio</span>
            )}
          </div>
          {appts.length > 0 && (
            <div className="mt-4">
              <PrintButton appointments={appts} label="Imprimir tickets del día" salon={SALON_INFO} />
            </div>
          )}
        </CardContent>
      </Card>

      {appts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          No hay citas para este día.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Desglose por servicio */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Desglose por servicio</h2>
              <div className="divide-y">
                {services.map(([name, v]) => (
                  <div key={name} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate pr-2">
                      {name} <span className="text-muted-foreground text-xs">×{v.count}</span>
                    </span>
                    <span className="font-semibold flex-shrink-0">{v.revenue.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detalle de citas */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3">Citas del día</h2>
              <div className="divide-y">
                {appts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 text-sm gap-2">
                    <span className="min-w-0">
                      <span className="text-muted-foreground text-xs mr-1.5">{formatTime(a.starts_at)}</span>
                      <span className="truncate">{a.customer_name}</span>
                    </span>
                    <span className="font-semibold flex-shrink-0">
                      {a.price != null ? `${a.price.toFixed(2)} €` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
