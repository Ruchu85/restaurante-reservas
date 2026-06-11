import { createAdminClient, getSalonId } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessHoursForm } from "@/components/dashboard/BusinessHoursForm";
import { BlockedDayForm } from "@/components/dashboard/BlockedDayForm";
import { StaffManager } from "@/components/dashboard/StaffManager";
import type { StaffMember } from "@/types";

export const metadata = { title: "Horarios — Panel admin" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const admin = createAdminClient();
  const salonId = await getSalonId();

  const [{ data: hours }, { data: blockedDays }, { data: staff }] = await Promise.all([
    admin
      .from("business_hours")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .order("day_of_week"),
    admin
      .from("blocked_days")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date"),
    admin
      .from("staff_members")
      .select("*")
      .eq("salon_id", salonId ?? "")
      .eq("active", true)
      .order("name"),
  ]);

  const hoursMap = new Map(hours?.map((h) => [h.day_of_week, h]) ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Horarios</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Horario semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS.map((dayName, dayIndex) => (
              <BusinessHoursForm
                key={dayIndex}
                dayOfWeek={dayIndex}
                dayName={dayName}
                existing={hoursMap.get(dayIndex)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cierres y días no laborables</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockedDayForm blockedDays={blockedDays ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profesionales</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffManager staff={(staff as StaffMember[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
