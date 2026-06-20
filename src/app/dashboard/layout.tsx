import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { getRestaurant } from "@/lib/restaurant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const restaurant = await getRestaurant();

  return (
    <div className="flex h-svh bg-slate-50">
      <DashboardNav
        userName={profile?.full_name ?? user.email ?? "Usuario"}
        userRole={profile?.role ?? "staff"}
        restaurantName={restaurant?.name ?? "Restaurante"}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
