import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { toMadridDate } from "@/lib/utils";
import { BarChart3, TrendingDown, TrendingUp, Users, Calendar } from "lucide-react";

export const metadata = { title: "Informes" };

export default async function InformesPage() {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  const today = toMadridDate(new Date());
  const thisMonthStart = today.slice(0, 8) + "01";
  const prev30Start = new Date(today + "T00:00:00");
  prev30Start.setDate(prev30Start.getDate() - 29);
  const prev30Str = toMadridDate(prev30Start);

  const [{ data: thisMonth }, { data: last30 }, { data: todayRsvs }] =
    await Promise.all([
      admin
        .from("reservations")
        .select("status, party_size, source, starts_at")
        .eq("restaurant_id", restaurantId ?? "")
        .gte("starts_at", thisMonthStart + "T00:00:00.000Z")
        .lte("starts_at", today + "T23:59:59.999Z"),
      admin
        .from("reservations")
        .select("status, party_size, source, starts_at")
        .eq("restaurant_id", restaurantId ?? "")
        .gte("starts_at", prev30Str + "T00:00:00.000Z")
        .lte("starts_at", today + "T23:59:59.999Z"),
      admin
        .from("reservations")
        .select("status, party_size")
        .eq("restaurant_id", restaurantId ?? "")
        .gte("starts_at", today + "T00:00:00.000Z")
        .lte("starts_at", today + "T23:59:59.999Z"),
    ]);

  type Row = { status: string; party_size: number; source: string; starts_at: string };
  const monthData = (thisMonth ?? []) as Row[];
  const last30Data = (last30 ?? []) as Row[];
  const todayData = (todayRsvs ?? []) as Row[];

  const activeStatuses = ["confirmed", "seated", "completed"];
  const monthActive = monthData.filter((r) => activeStatuses.includes(r.status));
  const monthCovers = monthActive.reduce((s, r) => s + r.party_size, 0);
  const monthNoShow = monthData.filter((r) => r.status === "no_show").length;
  const monthCancelled = monthData.filter((r) => r.status === "cancelled").length;
  const noShowRate =
    monthData.length > 0 ? ((monthNoShow / monthData.length) * 100).toFixed(1) : "0";

  const last30Active = last30Data.filter((r) => activeStatuses.includes(r.status));
  const last30Covers = last30Active.reduce((s, r) => s + r.party_size, 0);
  const todayCovers = todayData
    .filter((r) => r.status !== "cancelled")
    .reduce((s, r) => s + r.party_size, 0);

  const sourceCount = last30Data.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  const dowCount = last30Active.reduce<Record<number, number>>((acc, r) => {
    const dow = new Date(r.starts_at).getDay();
    acc[dow] = (acc[dow] ?? 0) + 1;
    return acc;
  }, {});
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const maxDow = Math.max(...Object.values(dowCount), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-800">Informes</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Reservas este mes", value: monthActive.length, icon: Calendar, cls: "text-amber-600 bg-amber-50" },
          { label: "Comensales hoy", value: todayCovers, icon: Users, cls: "text-blue-600 bg-blue-50" },
          { label: "Comensales (30 días)", value: last30Covers, icon: TrendingUp, cls: "text-green-600 bg-green-50" },
          { label: "Tasa no-show", value: noShowRate + "%", icon: TrendingDown, cls: "text-red-500 bg-red-50" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className={`p-1.5 rounded-lg inline-flex mb-3 ${cls.split(" ")[1]}`}>
              <Icon className={`h-4 w-4 ${cls.split(" ")[0]}`} />
            </div>
            <div className="text-2xl font-bold text-stone-800">{value}</div>
            <div className="text-xs text-stone-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Month summary */}
      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5">
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-amber-600" />
          Resumen del mes · {monthCovers} comensales
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total reservas", value: monthData.length },
            { label: "Confirmadas/completadas", value: monthActive.length },
            { label: "Canceladas", value: monthCancelled },
            { label: "No presentados", value: monthNoShow },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-stone-50">
              <div className="text-2xl font-bold text-stone-800">{value}</div>
              <div className="text-xs text-stone-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekday chart */}
      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5">
        <h2 className="font-semibold text-stone-800 mb-4">Reservas por día de la semana (30 días)</h2>
        <div className="flex items-end gap-2 h-24">
          {DAYS.map((name, i) => {
            const count = dowCount[i] ?? 0;
            const pct = maxDow > 0 ? (count / maxDow) * 100 : 0;
            return (
              <div key={name} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-amber-400 transition-all"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <div className="text-xs text-stone-400">{name}</div>
                <div className="text-xs font-medium text-stone-600">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source breakdown */}
      {Object.keys(sourceCount).length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm p-5">
          <h2 className="font-semibold text-stone-800 mb-4">Origen de reservas (30 días)</h2>
          <div className="space-y-3">
            {(["online", "phone", "admin"] as const)
              .filter((s) => sourceCount[s])
              .map((source) => {
                const count = sourceCount[source] ?? 0;
                const total = last30Data.length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const labels: Record<string, string> = {
                  online: "Online (web)",
                  phone: "Teléfono",
                  admin: "Manual (staff)",
                };
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-stone-700">{labels[source]}</span>
                      <span className="text-stone-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
