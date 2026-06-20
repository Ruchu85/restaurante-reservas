import { getRestaurant } from "@/lib/restaurant";
import { SettingsClient } from "@/components/dashboard/SettingsClient";

export const metadata = { title: "Ajustes del Restaurante" };

export default async function AjustesPage() {
  const restaurant = await getRestaurant();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Ajustes</h1>
        <p className="text-sm text-stone-400">Configura tu restaurante</p>
      </div>
      <SettingsClient restaurant={restaurant} />
    </div>
  );
}
