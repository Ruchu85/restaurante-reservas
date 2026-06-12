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
    <div className="flex flex-col items-center py-1">
      {/* Header compacto */}
      <div className="mb-2 text-center">
        <h1 className="text-lg font-bold tracking-tight uppercase leading-tight">{salonName}</h1>
        <p className="text-muted-foreground text-xs capitalize">{todayLabel}</p>
      </div>

      {/* Resumen del día */}
      <div className="w-full max-w-xs rounded-xl bg-slate-900 text-white p-3 mb-2">
        <div className="text-[10px] text-slate-400 mb-1.5">Resumen de hoy</div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <div className="text-xl font-bold">{todays.length}</div>
            <div className="text-[10px] text-slate-400">Citas</div>
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-400">
              {todays.filter((a) => new Date(a.starts_at) > now).length}
            </div>
            <div className="text-[10px] text-slate-400">Pendientes</div>
          </div>
          <div>
            <div className="text-xl font-bold">{revenue.toFixed(0)}€</div>
            <div className="text-[10px] text-slate-400">Previsto</div>
          </div>
        </div>
      </div>

      {/* Próxima cita */}
      {next && (
        <Link
          href={`/dashboard/citas/${next.id}`}
          className="w-full max-w-xs rounded-xl border bg-white px-3 py-2 mb-2 flex items-center gap-2.5 active:scale-[0.99] transition-transform"
        >
          <div className="w-10 h-8 rounded-md bg-emerald-100 grid place-items-center text-emerald-700 font-bold text-xs flex-shrink-0">
            {formatTime(next.starts_at)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{next.customer_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{next.service}</div>
          </div>
          <span className="text-slate-300 text-sm">›</span>
        </Link>
      )}

      {/* Nueva cita */}
      <Link
        href="/dashboard/citas/nueva"
        className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-white font-semibold text-sm w-full max-w-xs transition-all active:scale-95 hover:bg-slate-700"
      >
        <Plus className="h-4 w-4" />
        Nueva cita
      </Link>

      {/* Rejilla 4×2 — cabe en una sola pantalla */}
      <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
        {cards.map(({ href, icon: Icon, label, bg, fg }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 transition-all active:scale-95 ${bg}`}
          >
            <Icon className={`h-6 w-6 ${fg}`} />
            <span className={`text-[10px] font-semibold leading-none text-center ${fg}`}>{label}</span>
          </Link>
        ))}

        <form action={signOut}>
          <button
            type="submit"
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 w-full transition-all active:scale-95 bg-rose-50 border-rose-200"
          >
            <LogOut className="h-6 w-6 text-rose-600" />
            <span className="text-[10px] font-semibold leading-none text-rose-600">Salir</span>
          </button>
        </form>
      </div>
    </div>
  );
}
