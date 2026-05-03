"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Loader2 } from "lucide-react";
import { createService, updateService, deleteService } from "@/actions/services";
import type { Service } from "@/types";

interface ServiceFormProps {
  salonId: string;
  service?: Service;
}

export function ServiceForm({ salonId, service }: ServiceFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    duration_minutes: service?.duration_minutes ?? 60,
    buffer_before_minutes: service?.buffer_before_minutes ?? 0,
    buffer_after_minutes: service?.buffer_after_minutes ?? 0,
    price_cents: service ? service.price_cents / 100 : 0,
    active: service?.active ?? true,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...form,
        salon_id: salonId,
        price_cents: Math.round(form.price_cents * 100),
        description: form.description || undefined,
      };

      const result = service
        ? await updateService(service.id, payload)
        : await createService(payload);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(service ? "Servicio actualizado" : "Servicio creado");
        setOpen(false);
      }
    });
  }

  async function handleDelete() {
    if (!service) return;
    if (!confirm("¿Seguro que quieres eliminar este servicio?")) return;
    startTransition(async () => {
      const result = await deleteService(service.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Servicio eliminado");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {service ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo servicio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descripción</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duración (min) *</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                value={form.duration_minutes}
                onChange={(e) => update("duration_minutes", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Precio (€) *</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={form.price_cents}
                onChange={(e) => update("price_cents", Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="buf-before">Buffer antes (min)</Label>
              <Input
                id="buf-before"
                type="number"
                min={0}
                value={form.buffer_before_minutes}
                onChange={(e) => update("buffer_before_minutes", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buf-after">Buffer después (min)</Label>
              <Input
                id="buf-after"
                type="number"
                min={0}
                value={form.buffer_after_minutes}
                onChange={(e) => update("buffer_after_minutes", Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {service && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                Eliminar
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
