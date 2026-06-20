import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { toMadridDate, formatTime } from "@/lib/utils";
import Link from "next/link";
import { Calendar, ChevronRight, Clock, TrendingUp, Users, UtensilsCrossed } from "lucide-react";
import type { Reservation } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  seated: "En mesa",
  completed: "Completada",
  no_show: "No llegó",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  completed: "bg-stone-100 text-stone-600",
  no_show: "bg-red-100 text-red-800",
  cancelled: "bg-stone-100 text-stone-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default async function DashboardPage() {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();
  const today = toMadridDate(new Date());

  const { data: reservations } = await admin
    .from("reservations")
    .select("*, table:restaurant_tables(id, name, section)")
    .eq("restaurant_id", restaurantId ?? "")
    .gte("starts_at", today + "T00:00:00.000Z")
    .lte("starts_at", today + "T23:59:59.999Z")
    .order("starts_at");

  const todayList = (reservations ?? []) as Reservation[];

  const activeToday = todayList.filter((r) => r.status !== "cancelled");
  const totalCovers = activeToday.reduce((sum, r) => sum + r.party_size, 0);
  const seated = activeToday.filter((r) => r.status === "seated").length;
  const confirmed = activeToday.filter((r) => r.status === "confirmed").length;
  const noShow = todayList.filter((r) => r.status === "no_show").length;

  const nowIso = new Date().toISOString();
  const upcoming = todayList
    .filter((r) => r.starts_at > nowIso && r.status === "confirmed")
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 capitalize">
            {new Date(today + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Resumen del día</p>
        </div>
        <Link
          href="/dashboard/reservas"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          + Nueva reserva
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Reservas hoy", value: activeToday.length, icon: Calendar, color: "amber" },
          { label: "Comensales", value: totalCovers, icon: Users, color: "blue" },
          { label: "En mesa ahora", value: seated, icon: UtensilsCrossed, color: "green" },
          { label: "No presentados", value: noShow, icon: TrendingUp, color: "red" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg bg-${color}-50`}>
                <Icon className={`h-4 w-4 text-${color}-600`} />
              </div>
              <span className="text-xs font-medium text-stone-500">{label}</span>
            </div>
            <div className="text-3xl font-bold text-stone-800">{value}</div>
          </div>
        ))}
      </div>

      {(confirmed > 0 || seated > 0) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
          <p className="text-sm text-amber-800 font-medium">
            {seated > 0 && `${seated} mesa${seated !== 1 ? "s" : ""} ocupada${seated !== 1 ? "s" : ""}`}
            {seated > 0 && confirmed > 0 && " · "}
            {confirmed > 0 && `${confirmed} reserva${confirmed !== 1 ? "s" : ""} pendiente${confirmed !== 1 ? "s" : ""} de llegada`}
          </p>
        </div>
      )}

      {/* Today's reservations */}
      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
          <h2 className="font-semibold text-stone-800">Reservas de hoy</h2>
          <Link href="/dashboard/reservas" className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1">
            Ver todas <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {todayList.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Calendar className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Sin reservas para hoy</p>
            <Link href="/dashboard/reservas" className="mt-3 inline-block text-sm text-amber-600 hover:text-amber-700">
              Añadir reserva
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {todayList.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/reservas/${r.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 transition-colors"
              >
                <div className="flex-shrink-0 w-14">
                  <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at)}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTime(r.ends_at)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-800 truncate">{r.guest_name}</div>
                  <div className="text-xs text-stone-400">
                    {r.party_size} personas{r.table && ` · ${r.table.name}`}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <ChevronRight className="h-4 w-4 text-stone-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-50">
            <h2 className="font-semibold text-stone-800">Próximas llegadas</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {upcoming.map((r) => {
              const minutesUntil = Math.round(
                (new Date(r.starts_at).getTime() - Date.now()) / 60000,
              );
              return (
                <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-800">{r.guest_name}</div>
                    <div className="text-xs text-stone-400">{r.party_size} personas · {formatTime(r.starts_at)}</div>
                  </div>
                  <div className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">
                    en {minutesUntil < 60 ? `${minutesUntil} min` : `${Math.round(minutesUntil / 60)}h`}
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
