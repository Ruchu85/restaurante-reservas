import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { getReservationsForServiceDay } from "@/lib/reservations";
import { toLocalDate } from "@/lib/dates";
import { formatTime } from "@/lib/utils";
import { guestSignals } from "@/lib/guestSignals";
import { GuestSignalBadges } from "@/components/dashboard/GuestSignalBadges";
import { WhatsAppButton } from "@/components/dashboard/WhatsAppButton";
import { Calendar, ChevronRight, Clock, TrendingUp, Users, UtensilsCrossed } from "lucide-react";

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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Las clases de Tailwind deben ser literales completos: `bg-${color}-50` no se
// detecta en compilación y se queda sin estilo.
const STAT_STYLES = {
  amber: { icon: "text-amber-600", bg: "bg-amber-50" },
  blue: { icon: "text-blue-600", bg: "bg-blue-50" },
  green: { icon: "text-green-600", bg: "bg-green-50" },
  red: { icon: "text-red-600", bg: "bg-red-50" },
} as const;

export default async function DashboardPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const today = toLocalDate(new Date(), session.timezone);
  const todayList = await getReservationsForServiceDay(admin, session.restaurantId, today, {
    withRelations: true,
    timeZone: session.timezone,
  });

  const activeToday = todayList.filter((r) => r.status !== "cancelled");
  const totalCovers = activeToday.reduce((sum, r) => sum + r.party_size, 0);
  const seated = activeToday.filter((r) => r.status === "seated").length;
  const confirmed = activeToday.filter((r) => r.status === "confirmed").length;
  const noShow = todayList.filter((r) => r.status === "no_show").length;

  const nowIso = new Date().toISOString();
  const upcoming = todayList
    .filter((r) => r.starts_at > nowIso && r.status === "confirmed")
    .slice(0, 3);

  const stats = [
    { label: "Reservas hoy", value: activeToday.length, icon: Calendar, tone: "amber" as const },
    { label: "Comensales", value: totalCovers, icon: Users, tone: "blue" as const },
    { label: "En mesa ahora", value: seated, icon: UtensilsCrossed, tone: "green" as const },
    { label: "No presentados", value: noShow, icon: TrendingUp, tone: "red" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 capitalize">
            {new Date(today + "T12:00:00Z").toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Resumen del servicio</p>
        </div>
        <Link
          href="/dashboard/reservas"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          + Nueva reserva
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${STAT_STYLES[tone].bg}`}>
                <Icon className={`h-4 w-4 ${STAT_STYLES[tone].icon}`} />
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
            {confirmed > 0 &&
              `${confirmed} reserva${confirmed !== 1 ? "s" : ""} pendiente${confirmed !== 1 ? "s" : ""} de llegada`}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-stone-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
          <h2 className="font-semibold text-stone-800">Reservas de hoy</h2>
          <Link
            href="/dashboard/reservas"
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            Ver todas <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {todayList.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Calendar className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Sin reservas para hoy</p>
            <Link
              href="/dashboard/reservas"
              className="mt-3 inline-block text-sm text-amber-600 hover:text-amber-700"
            >
              Añadir reserva
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {todayList.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition-colors">
                <div className="flex-shrink-0 w-14">
                  <div className="text-sm font-bold text-stone-800">{formatTime(r.starts_at, session.timezone)}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {formatTime(r.ends_at, session.timezone)}
                  </div>
                </div>
                <Link
                  href={`/dashboard/reservas?date=${toLocalDate(new Date(r.starts_at), session.timezone)}`}
                  className="flex-1 min-w-0"
                >
                  <div className="text-sm font-medium text-stone-800 truncate">{r.guest_name}</div>
                  <div className="text-xs text-stone-400">
                    {r.party_size} personas
                    {r.table && ` · ${r.table.name}`}
                    {r.table_ids && r.table_ids.length > 1 && ` +${r.table_ids.length - 1} mesa(s)`}
                  </div>
                  <GuestSignalBadges signals={guestSignals(r.guest)} className="mt-1" />
                </Link>
                <WhatsAppButton
                  phone={r.guest_phone}
                  guestName={r.guest_name}
                  startsAt={r.starts_at}
                  partySize={r.party_size}
                  timeZone={session.timezone}
                />
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

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
                    <div className="text-xs text-stone-400">
                      {r.party_size} personas · {formatTime(r.starts_at, session.timezone)}
                    </div>
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
