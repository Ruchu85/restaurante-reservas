import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, salon_id")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen bg-slate-50">
      <DashboardNav
        userName={profile?.full_name ?? user.email ?? "Usuario"}
        userRole={profile?.role ?? "staff"}
      />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
