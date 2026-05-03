import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { ServiceForm } from "@/components/dashboard/ServiceForm";
import { Clock, Plus } from "lucide-react";

export const metadata = { title: "Servicios — Salón Demo" };

export default async function ServiciosPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", salonId)
    .order("name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona el catálogo de servicios del salón
          </p>
        </div>
        <ServiceForm salonId={salonId} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!services || services.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Plus className="mx-auto mb-3 h-8 w-8" />
              No hay servicios todavía. Crea el primero.
            </div>
          ) : (
            <div className="divide-y">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{service.name}</span>
                      {!service.active && (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                        {service.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDuration(service.duration_minutes)}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(service.price_cents)}
                      </span>
                    </div>
                  </div>
                  <ServiceForm salonId={salonId} service={service} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
