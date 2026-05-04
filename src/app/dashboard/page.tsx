import Link from "next/link";
import { Calendar, ClipboardList, Clock, LogOut, Plus } from "lucide-react";
import { signOut } from "@/actions/auth";

const cards = [
  {
    href: "/dashboard/calendario",
    icon: Calendar,
    label: "Calendario",
    bg: "bg-blue-50 border-blue-200",
    fg: "text-blue-700",
  },
  {
    href: "/dashboard/citas",
    icon: ClipboardList,
    label: "Citas",
    bg: "bg-emerald-50 border-emerald-200",
    fg: "text-emerald-700",
  },
  {
    href: "/dashboard/horarios",
    icon: Clock,
    label: "Horarios",
    bg: "bg-amber-50 border-amber-200",
    fg: "text-amber-700",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100svh-8rem)]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Panel de gestión</h1>
        <p className="text-muted-foreground mt-1 text-sm">¿Qué quieres hacer?</p>
      </div>

      <Link
        href="/dashboard/citas/nueva"
        className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-white font-semibold text-base w-full max-w-xs transition-all active:scale-95 hover:bg-slate-700"
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
            <Icon className={`h-10 w-10 ${fg}`} />
            <span className={`text-sm font-semibold ${fg}`}>{label}</span>
          </Link>
        ))}

        <form action={signOut}>
          <button
            type="submit"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-6 aspect-square w-full transition-all active:scale-95 bg-rose-50 border-rose-200"
          >
            <LogOut className="h-10 w-10 text-rose-600" />
            <span className="text-sm font-semibold text-rose-600">Salir</span>
          </button>
        </form>
      </div>
    </div>
  );
}
