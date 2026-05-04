import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessHoursForm } from "@/components/dashboard/BusinessHoursForm";
import { BlockedDayForm } from "@/components/dashboard/BlockedDayForm";

export const metadata = { title: "Horarios — Panel admin" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const [{ data: hours }, { data: blockedDays }] = await Promise.all([
    supabase
      .from("business_hours")
      .select("*")
      .eq("salon_id", salonId)
      .order("day_of_week"),
    supabase
      .from("blocked_days")
      .select("*")
      .eq("salon_id", salonId)
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date"),
  ]);

  const hoursMap = new Map(hours?.map((h) => [h.day_of_week, h]) ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Horarios</h1>

      {/* Business hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Horario semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS.map((dayName, dayIndex) => (
              <BusinessHoursForm
                key={dayIndex}
                salonId={salonId}
                dayOfWeek={dayIndex}
                dayName={dayName}
                existing={hoursMap.get(dayIndex)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Blocked days */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cierres y días no laborables</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockedDayForm salonId={salonId} blockedDays={blockedDays ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
