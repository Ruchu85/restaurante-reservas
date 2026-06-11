import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft, TrendingUp, Receipt, Users, Scissors } from "lucide-react";
import type { Appointment } from "@/types";

export const metadata = { title: "Informes — PELUQUERIA ALI" };

function monthRange() {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  };
  return { from: fmt(first), to: fmt(last) };
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const def = monthRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const admin = createAdminClient();
  const salonId = await getSalonId();

  const { data } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("status", "active")
    .gte("starts_at", from + "T00:00:00+00:00")
    .lte("starts_at", to + "T23:59:59+00:00")
    .order("starts_at");

  const appts = (data ?? []) as Appointment[];

  const totalRevenue = appts.reduce((s, a) => s + (a.price ?? 0), 0);
  const count = appts.length;
  const avgTicket = count > 0 ? totalRevenue / count : 0;

  // Top servicios
  const byService = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const cur = byService.get(a.service) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += a.price ?? 0;
    byService.set(a.service, cur);
  }
  const topServices = [...byService.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  // Top clientes
  const byClient = new Map<string, { count: number; revenue: number }>();
  for (const a of appts) {
    const cur = byClient.get(a.customer_name) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += a.price ?? 0;
    byClient.set(a.customer_name, cur);
  }
  const topClients = [...byClient.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  const maxServiceCount = Math.max(1, ...topServices.map(([, v]) => v.count));

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
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold md:text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Informes
            </h1>
            <p className="text-sm text-muted-foreground">Resumen de actividad e ingresos</p>
          </div>
          <Link
            href="/dashboard/caja"
            className="flex-shrink-0 h-9 px-3 rounded-md border bg-white text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Receipt className="h-4 w-4" />
            Cierre de caja
          </Link>
        </div>
      </div>

      {/* Filtro de fechas */}
      <form method="GET" className="mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
        <button type="submit" className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors">
          Filtrar
        </button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Receipt className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <div className="text-2xl font-bold">{totalRevenue.toFixed(0)}€</div>
            <div className="text-[11px] text-muted-foreground">Ingresos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-[11px] text-muted-foreground">Citas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-violet-600 mb-1" />
            <div className="text-2xl font-bold">{avgTicket.toFixed(0)}€</div>
            <div className="text-[11px] text-muted-foreground">Ticket medio</div>
          </CardContent>
        </Card>
      </div>

      {count === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          No hay citas en este rango de fechas.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Top servicios */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Scissors className="h-4 w-4" /> Servicios más solicitados
              </h2>
              <div className="space-y-2.5">
                {topServices.map(([name, v]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium truncate pr-2">{name}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {v.count} · {v.revenue.toFixed(0)}€
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full"
                        style={{ width: `${(v.count / maxServiceCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top clientes */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Mejores clientes
              </h2>
              <div className="divide-y">
                {topClients.map(([name, v], i) => (
                  <div key={name} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <span className="truncate">{name}</span>
                    </span>
                    <span className="text-muted-foreground text-xs flex-shrink-0">
                      {v.count} cita{v.count !== 1 ? "s" : ""} · {v.revenue.toFixed(0)}€
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
