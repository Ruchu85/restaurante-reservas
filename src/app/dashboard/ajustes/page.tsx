import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { getSalon } from "@/lib/salon";
import { SettingsClient } from "@/components/dashboard/SettingsClient";
import type { Service } from "@/types";

export const metadata = { title: "Ajustes — PELUQUERIA ALI" };

export default async function AjustesPage() {
  const admin = createAdminClient();
  const salonId = await getSalonId();
  const salon = await getSalon();

  let services: Service[] = [];
  try {
    const { data } = await admin
      .from("services")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .eq("active", true)
      .order("name");
    services = (data as Service[]) ?? [];
  } catch {
    // services table may not exist yet — handled gracefully in UI
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Configura tu salón</p>
      </div>
      <SettingsClient initialServices={services} salon={salon} />
    </div>
  );
}
