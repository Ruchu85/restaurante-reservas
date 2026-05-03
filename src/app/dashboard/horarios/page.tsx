import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessHoursForm } from "@/components/dashboard/BusinessHoursForm";

export const metadata = { title: "Horarios — Salón Demo" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const { data: hours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("salon_id", salonId)
    .is("staff_id", null)
    .order("day_of_week");

  // Create default hours structure (all 7 days)
  const hoursMap = new Map(hours?.map((h) => [h.day_of_week, h]) ?? []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Horarios</h1>
        <p className="text-sm text-muted-foreground">
          Configura el horario de apertura del salón
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horario semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map((dayName, dayIndex) => {
              const existing = hoursMap.get(dayIndex);
              return (
                <BusinessHoursForm
                  key={dayIndex}
                  salonId={salonId}
                  dayOfWeek={dayIndex}
                  dayName={dayName}
                  existing={existing}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
