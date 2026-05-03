import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalonConfigForm } from "@/components/dashboard/SalonConfigForm";

export const metadata = { title: "Configuración — Salón Demo" };

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .eq("id", salonId)
    .single();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Información y ajustes generales del salón
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del salón</CardTitle>
        </CardHeader>
        <CardContent>
          <SalonConfigForm salon={salon} />
        </CardContent>
      </Card>
    </div>
  );
}
