import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/auth";
import { toLocalDate } from "@/lib/dates";
import { BusinessHoursForm } from "@/components/dashboard/BusinessHoursForm";
import { BlockedDayForm } from "@/components/dashboard/BlockedDayForm";
import type { BusinessHours, BlockedDay } from "@/types";

export const metadata = { title: "Horarios del Restaurante" };

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function HorariosPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const [{ data: hours }, { data: blockedDays }] = await Promise.all([
    admin
      .from("business_hours")
      .select("*")
      .eq("restaurant_id", session.restaurantId)
      .order("day_of_week"),
    admin
      .from("blocked_days")
      .select("*")
      .eq("restaurant_id", session.restaurantId)
      .gte("date", toLocalDate(new Date()))
      .order("date"),
  ]);

  const hoursMap = new Map<number, BusinessHours>(
    ((hours as BusinessHours[]) ?? []).map((h) => [h.day_of_week, h]),
  );

  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-800">Horarios</h1>

      {!isAdmin && (
        <p className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
          Solo un administrador puede modificar horarios y cierres.
        </p>
      )}

      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Horario semanal</h2>
        <p className="text-xs text-stone-400 mb-4">
          Configura almuerzo y cena por separado. Si el cierre es anterior a la apertura (p. ej.
          20:30 → 01:00) se entiende que el turno termina de madrugada.
        </p>
        {DAYS.map((dayName, dayIndex) => (
          <BusinessHoursForm
            key={dayIndex}
            dayOfWeek={dayIndex}
            dayName={dayName}
            existing={hoursMap.get(dayIndex)}
            disabled={!isAdmin}
          />
        ))}
      </div>

      <div className="rounded-2xl bg-stone-50 border border-stone-100 p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Cierres y días no laborables</h2>
        <BlockedDayForm blockedDays={(blockedDays as BlockedDay[]) ?? []} disabled={!isAdmin} />
      </div>
    </div>
  );
}
