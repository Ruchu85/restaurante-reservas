"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BarChart3, Calendar, ClipboardList, Clock,
  ExternalLink, Home, ListOrdered, LogOut, MoreHorizontal, Settings, TableProperties, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
  { href: "/dashboard/calendario", label: "Calendario", icon: Calendar },
  { href: "/dashboard/reservas", label: "Reservas", icon: ClipboardList },
  { href: "/dashboard/comensales", label: "Comensales", icon: Users },
  { href: "/dashboard/mesas", label: "Mesas", icon: TableProperties },
  { href: "/dashboard/lista-espera", label: "Lista de espera", icon: ListOrdered },
  { href: "/dashboard/informes", label: "Informes", icon: BarChart3 },
  { href: "/dashboard/horarios", label: "Horarios", icon: Clock },
  { href: "/dashboard/ajustes", label: "Ajustes", icon: Settings },
];

// El menú inferior de móvil solo tiene sitio para 5 pestañas: las 4 más
// frecuentes se quedan fijas y el resto vive detrás de "Más" para que ninguna
// sección quede inalcanzable en pantallas estrechas.
const MOBILE_PRIMARY = navItems.slice(0, 4);
const MOBILE_MORE = navItems.slice(4);

interface DashboardNavProps {
  userName: string;
  userRole: string;
  restaurantName?: string;
}

export function DashboardNav({ userName, userRole, restaurantName = "Restaurante" }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreIsActive = MOBILE_MORE.some(({ href, exact }) => isActive(href, exact));

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
      <aside className="hidden md:flex w-60 flex-col border-r bg-panel">
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
                  ? "bg-amber-50 font-medium text-amber-800 dark:text-amber-300"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900",
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", isActive(href, exact) ? "text-amber-600 dark:text-amber-400" : "")} />
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-panel md:hidden safe-area-pb">
        {MOBILE_PRIMARY.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
              isActive(href, exact) ? "text-amber-700 dark:text-amber-300 font-medium" : "text-stone-500",
            )}
          >
            <Icon className={cn("h-5 w-5", isActive(href, exact) ? "stroke-[2.5px]" : "")} />
            <span className="truncate max-w-full px-0.5">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
            moreIsActive ? "text-amber-700 dark:text-amber-300 font-medium" : "text-stone-500",
          )}
        >
          <MoreHorizontal className={cn("h-5 w-5", moreIsActive ? "stroke-[2.5px]" : "")} />
          <span className="truncate max-w-full px-0.5">Más</span>
        </button>
      </nav>

      {/* "Más" sheet — mobile: el resto de secciones que no caben en la barra inferior */}
      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-50 md:hidden" />
          <DialogPrimitive.Content
            className="fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl bg-panel p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden"
            aria-describedby={undefined}
          >
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <DialogPrimitive.Title className="text-sm font-semibold text-stone-800">
                Más opciones
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="p-1 rounded-lg hover:bg-stone-100">
                <X className="h-4 w-4 text-stone-500" />
              </DialogPrimitive.Close>
            </div>
            <div className="grid grid-cols-3 gap-2 px-1 pb-2">
              {MOBILE_MORE.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs text-center transition-colors",
                    isActive(href, exact) ? "bg-amber-50 text-amber-800 dark:text-amber-300 font-medium" : "text-stone-600 hover:bg-stone-50",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive(href, exact) ? "text-amber-600 dark:text-amber-400" : "text-stone-500")} />
                  {label}
                </Link>
              ))}
            </div>
            <div className="border-t pt-2 px-1 space-y-0.5">
              <Link
                href="/"
                target="_blank"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                Ver página pública
              </Link>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
