import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaffForm } from "@/components/dashboard/StaffForm";
import { User, Plus } from "lucide-react";

export const metadata = { title: "Equipo — Salón Demo" };

export default async function EquipoPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("salon_id")
    .single();

  const salonId = profile?.salon_id ?? "";

  const { data: staff } = await supabase
    .from("staff_members")
    .select("*")
    .eq("salon_id", salonId)
    .order("display_name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los profesionales del salón
          </p>
        </div>
        <StaffForm salonId={salonId} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!staff || staff.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Plus className="mx-auto mb-3 h-8 w-8" />
              No hay profesionales todavía. Añade el primero.
            </div>
          ) : (
            <div className="divide-y">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.display_name}</span>
                        {!member.active && (
                          <Badge variant="secondary">Inactivo</Badge>
                        )}
                      </div>
                      {member.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {member.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <StaffForm salonId={salonId} staff={member} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
