import { createAdminClient, getRestaurantId } from "@/lib/supabase/admin";
import { BusinessHoursForm } from "@/components/dashboard/BusinessHoursForm";
import { BlockedDayForm } from "@/components/dashboard/BlockedDayForm";
import type { BusinessHours, BlockedDay } from "@/types";

export const metadata = { title: "Horarios del Restaurante" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const admin = createAdminClient();
  const restaurantId = await getRestaurantId();

  const [{ data: hours }, { data: blockedDays }] = await Promise.all([
    admin
      .from("business_hours")
      .select("*")
      .eq("restaurant_id", restaurantId ?? "")
      .order("day_of_week"),
    admin
      .from("blocked_days")
      .select("*")
      .eq("restaurant_id", restaurantId ?? "")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date"),
  ]);

  const hoursMap = new Map<number, BusinessHours>(
    (hours as BusinessHours[] ?? []).map((h) => [h.day_of_week, h]),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-800">Horarios</h1>

      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Horario semanal</h2>
        <p className="text-xs text-stone-400 mb-4">
          Configura almuerzo y cena por separado. Cada franja es el rango en el que se aceptan reservas.
        </p>
        {DAYS.map((dayName, dayIndex) => (
          <BusinessHoursForm
            key={dayIndex}
            dayOfWeek={dayIndex}
            dayName={dayName}
            existing={hoursMap.get(dayIndex)}
          />
        ))}
      </div>

      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Cierres y días no laborables</h2>
        <BlockedDayForm blockedDays={(blockedDays as BlockedDay[]) ?? []} />
      </div>
    </div>
  );
}
