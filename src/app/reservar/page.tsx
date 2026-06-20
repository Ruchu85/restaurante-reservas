export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { getRestaurant } from "@/lib/restaurant";

export const metadata = {
  title: "Reservar mesa",
};

export default async function ReservarPage() {
  const restaurant = await getRestaurant();

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ArrowLeft className="h-4 w-4 text-stone-600" />
          </Link>
          <div>
            <div className="text-sm font-semibold text-stone-800">
              {restaurant?.name ?? "Restaurante"}
            </div>
            <div className="text-xs text-stone-400">Reservar mesa</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <BookingWizard maxPartySize={restaurant?.max_party_size ?? 10} />
      </main>
    </div>
  );
}
