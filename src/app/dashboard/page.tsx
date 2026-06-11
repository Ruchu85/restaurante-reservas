import Link from "next/link";
import { Calendar, ClipboardList, Clock, BarChart3, LogOut, Plus, Receipt, Settings, Users } from "lucide-react";
import { signOut } from "@/actions/auth";
import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { getSalon } from "@/lib/salon";
import { formatTime } from "@/lib/utils";
import type { Appointment } from "@/types";

const cards = [
  { href: "/dashboard/calendario", icon: Calendar, label: "Calendario", bg: "bg-blue-50 border-blue-200", fg: "text-blue-700" },
  { href: "/dashboard/citas", icon: ClipboardList, label: "Citas", bg: "bg-emerald-50 border-emerald-200", fg: "text-emerald-700" },
  { href: "/dashboard/clientes", icon: Users, label: "Clientes", bg: "bg-cyan-50 border-cyan-200", fg: "text-cyan-700" },
  { href: "/dashboard/informes", icon: BarChart3, label: "Informes", bg: "bg-fuchsia-50 border-fuchsia-200", fg: "text-fuchsia-700" },
  { href: "/dashboard/tickets", icon: Receipt, label: "Tickets", bg: "bg-violet-50 border-violet-200", fg: "text-violet-700" },
  { href: "/dashboard/horarios", icon: Clock, label: "Horarios", bg: "bg-amber-50 border-amber-200", fg: "text-amber-700" },
  { href: "/dashboard/ajustes", icon: Settings, label: "Ajustes", bg: "bg-slate-50 border-slate-200", fg: "text-slate-700" },
] as const;

function todayRangeISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function DashboardPage() {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const salon = await getSalon();
  const { start, end } = todayRangeISO();

  const { data } = await admin
    .from("appointments")
    .select("*")
    .eq("salon_id", salonId ?? "")
    .eq("status", "active")
    .gte("starts_at", start)
    .lte("starts_at", end)
    .order("starts_at");

  const todays = (data ?? []) as Appointment[];
  const revenue = todays.reduce((sum, a) => sum + (a.price ?? 0), 0);
  const now = new Date();
  const next = todays.find((a) => new Date(a.starts_at) > now);

  const salonName = salon?.name ?? "PELUQUERÍA ALI";
  const todayLabel = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col items-center min-h-[calc(100svh-8rem)] py-2">
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{salonName}</h1>
        <p className="text-muted-foreground mt-1 text-sm capitalize">{todayLabel}</p>
      </div>

      {/* Resumen del día */}
      <div className="w-full max-w-xs rounded-2xl bg-slate-900 text-white p-4 mb-4">
        <div className="text-xs text-slate-400 mb-2">Resumen de hoy</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold">{todays.length}</div>
            <div className="text-[10px] text-slate-400">Citas</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {todays.filter((a) => new Date(a.starts_at) > now).length}
            </div>
            <div className="text-[10px] text-slate-400">Pendientes</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{revenue.toFixed(0)}€</div>
            <div className="text-[10px] text-slate-400">Previsto</div>
          </div>
        </div>
      </div>

      {/* Próxima cita */}
      {next && (
        <Link
          href={`/dashboard/citas/${next.id}`}
          className="w-full max-w-xs rounded-xl border bg-white p-3 mb-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="w-12 h-11 rounded-lg bg-emerald-100 grid place-items-center text-emerald-700 font-bold text-xs flex-shrink-0">
            {formatTime(next.starts_at)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{next.customer_name}</div>
            <div className="text-xs text-muted-foreground truncate">{next.service}</div>
          </div>
          <span className="text-slate-300">›</span>
        </Link>
      )}

      <Link
        href="/dashboard/citas/nueva"
        className="mb-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-white font-semibold text-base w-full max-w-xs transition-all active:scale-95 hover:bg-slate-700"
      >
        <Plus className="h-5 w-5" />
        Nueva cita
      </Link>

      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {cards.map(({ href, icon: Icon, label, bg, fg }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-6 aspect-square transition-all active:scale-95 ${bg}`}
          >
            <Icon className={`h-9 w-9 ${fg}`} />
            <span className={`text-sm font-semibold ${fg}`}>{label}</span>
          </Link>
        ))}

        <form action={signOut}>
          <button
            type="submit"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-6 aspect-square w-full transition-all active:scale-95 bg-rose-50 border-rose-200"
          >
            <LogOut className="h-9 w-9 text-rose-600" />
            <span className="text-sm font-semibold text-rose-600">Salir</span>
          </button>
        </form>
      </div>
    </div>
  );
}
