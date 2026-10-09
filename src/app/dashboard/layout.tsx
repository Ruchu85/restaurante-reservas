import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { isDemoReadOnly } from "@/lib/demoReadonly";
import { TEMA_COOKIE, temaDesdeCookie } from "@/lib/tema";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Un usuario autenticado pero sin restaurante asignado no tiene nada que ver
  // aquí: se le devuelve al login en lugar de mostrarle un panel vacío.
  const context = await getCurrentRestaurant();
  if (!context) redirect("/login?error=sin-restaurante");

  const { session, restaurant } = context;
  const readOnly = await isDemoReadOnly();
  const tema = temaDesdeCookie((await cookies()).get(TEMA_COOKIE)?.value);

  return (
    // La clase del tema va aquí, no en <html>: la web pública del restaurante
    // comparte el layout raíz y la misma paleta, y debe quedarse en claro.
    // Pintarla ya en el servidor evita el fogonazo blanco al cargar en oscuro.
    <div id="panel" className={cn("flex h-svh bg-stone-50", tema === "oscuro" && "panel-oscuro")}>
      <DashboardNav
        userName={session.fullName ?? session.email ?? "Usuario"}
        userRole={session.role}
        restaurantName={restaurant.name}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {readOnly && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs md:text-sm text-amber-800 dark:text-amber-300">
            <Eye className="h-4 w-4 flex-shrink-0" />
            Estás viendo una demo con datos de ejemplo — puedes navegar por todo, pero los cambios no se guardan.
          </div>
        )}
        <div className="mx-auto max-w-5xl p-4 md:p-6">
          <div className="mb-3 flex justify-end">
            <ThemeToggle inicial={tema} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
