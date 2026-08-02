import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { getCurrentRestaurant } from "@/lib/restaurant";

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

  return (
    <div className="flex h-svh bg-slate-50">
      <DashboardNav
        userName={session.fullName ?? session.email ?? "Usuario"}
        userRole={session.role}
        restaurantName={restaurant.name}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
