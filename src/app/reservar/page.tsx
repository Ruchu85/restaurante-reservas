import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { Scissors } from "lucide-react";
import Link from "next/link";

const SALON_SLUG = process.env.NEXT_PUBLIC_SALON_SLUG ?? "salon-demo";

export const metadata = {
  title: "Reservar cita — Salón Demo",
};

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, timezone")
    .eq("slug", SALON_SLUG)
    .single();

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Salón no encontrado.</p>
      </div>
    );
  }

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", salon.id)
    .eq("active", true)
    .order("name");

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, display_name, bio")
    .eq("salon_id", salon.id)
    .eq("active", true)
    .order("display_name");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity">
            <Scissors className="h-5 w-5" />
            {salon.name}
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Reservar cita</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sigue los pasos para completar tu reserva
          </p>
        </div>

        <BookingWizard
          salonId={salon.id}
          services={services ?? []}
          staff={staff ?? []}
          initialServiceId={params.service}
        />
      </main>
    </div>
  );
}
