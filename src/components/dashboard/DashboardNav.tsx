"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Calendar, ClipboardList, Clock, Home, LogOut, Receipt, Scissors, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
  { href: "/dashboard/calendario", label: "Calendario", icon: Calendar },
  { href: "/dashboard/citas", label: "Citas", icon: ClipboardList },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/informes", label: "Informes", icon: BarChart3 },
  { href: "/dashboard/tickets", label: "Tickets", icon: Receipt },
  { href: "/dashboard/horarios", label: "Horarios", icon: Clock },
  { href: "/dashboard/ajustes", label: "Ajustes", icon: Settings },
];

interface DashboardNavProps {
  userName: string;
  userRole: string;
}

export function DashboardNav({ userName, userRole }: DashboardNavProps) {
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
      <aside className="hidden md:flex w-56 flex-col border-r bg-white">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Scissors className="h-5 w-5 flex-shrink-0" />
          <span className="font-bold truncate">PELUQUERIA ALI</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(href, exact)
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3 space-y-1">
          <div className="px-3 pb-1">
            <div className="text-sm font-medium truncate">{userName}</div>
            <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
              isActive(href, exact) ? "text-slate-900 font-medium" : "text-slate-500",
            )}
          >
            <Icon className={cn("h-5 w-5", isActive(href, exact) ? "stroke-[2.5px]" : "")} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
