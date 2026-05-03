"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Scissors,
  Calendar,
  ClipboardList,
  Package,
  Users,
  Clock,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/calendario", label: "Calendario", icon: Calendar },
  { href: "/dashboard/citas", label: "Citas", icon: ClipboardList },
  { href: "/dashboard/servicios", label: "Servicios", icon: Package },
  { href: "/dashboard/equipo", label: "Equipo", icon: Users },
  { href: "/dashboard/horarios", label: "Horarios", icon: Clock },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
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

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Scissors className="h-6 w-6" />
        <span className="font-bold">Salón Demo</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-auto p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <div className="mb-2 px-3">
          <div className="text-sm font-medium truncate">{userName}</div>
          <div className="text-xs text-muted-foreground capitalize">{userRole}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-600"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
