"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Salon } from "@/types";

interface SalonConfigFormProps {
  salon: Salon | null;
}

export function SalonConfigForm({ salon }: SalonConfigFormProps) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: salon?.name ?? "",
    address: salon?.address ?? "",
    phone: salon?.phone ?? "",
    email: salon?.email ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) return;

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("salons")
        .update(form)
        .eq("id", salon.id);

      if (error) toast.error("Error al guardar: " + error.message);
      else toast.success("Configuración guardada");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="salon-name">Nombre del salón</Label>
        <Input
          id="salon-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salon-address">Dirección</Label>
        <Input
          id="salon-address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salon-phone">Teléfono</Label>
        <Input
          id="salon-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salon-email">Email</Label>
        <Input
          id="salon-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <Button type="submit" disabled={isPending || !salon}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
      </Button>
    </form>
  );
}
