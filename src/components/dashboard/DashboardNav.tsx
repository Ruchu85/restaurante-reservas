"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Calendar, ClipboardList, Clock,
  ExternalLink, Home, ListOrdered, LogOut, Settings, TableProperties,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
  { href: "/dashboard/calendario", label: "Calendario", icon: Calendar },
  { href: "/dashboard/reservas", label: "Reservas", icon: ClipboardList },
  { href: "/dashboard/mesas", label: "Mesas", icon: TableProperties },
  { href: "/dashboard/lista-espera", label: "Lista de espera", icon: ListOrdered },
  { href: "/dashboard/informes", label: "Informes", icon: BarChart3 },
  { href: "/dashboard/horarios", label: "Horarios", icon: Clock },
  { href: "/dashboard/ajustes", label: "Ajustes", icon: Settings },
];

interface DashboardNavProps {
  userName: string;
  userRole: string;
  restaurantName?: string;
}

export function DashboardNav({ userName, userRole, restaurantName = "Restaurante" }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-white">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-stone-800 truncate text-sm">{restaurantName}</div>
            <div className="text-xs text-stone-400">Panel de gestión</div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(href, exact)
                  ? "bg-amber-50 font-medium text-amber-800"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900",
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", isActive(href, exact) ? "text-amber-600" : "")} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            Ver página pública
          </Link>
          <div className="px-3 pb-1">
            <div className="text-sm font-medium truncate text-stone-800">{userName}</div>
            <div className="text-xs text-stone-400 capitalize">{userRole}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-white md:hidden safe-area-pb">
        {navItems.slice(0, 5).map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
              isActive(href, exact) ? "text-amber-700 font-medium" : "text-stone-500",
            )}
          >
            <Icon className={cn("h-5 w-5", isActive(href, exact) ? "stroke-[2.5px]" : "")} />
            <span className="truncate max-w-full px-0.5">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
