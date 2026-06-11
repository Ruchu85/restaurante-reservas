"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Users, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createService, deleteService, updateService } from "@/actions/services";
import { updateSalonInfo, updateSlotCapacity } from "@/actions/salon";
import type { Salon, Service } from "@/types";

interface SettingsClientProps {
  initialServices: Service[];
  salon: Salon | null;
}

export function SettingsClient({ initialServices, salon }: SettingsClientProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isPending, startTransition] = useTransition();

  // ---- Capacidad ----
  const [capacity, setCapacity] = useState<number>(salon?.slot_capacity ?? 1);

  function handleCapacity(n: number) {
    const prev = capacity;
    setCapacity(n);
    startTransition(async () => {
      const result = await updateSlotCapacity(n);
      if (result.error) {
        toast.error(result.error);
        setCapacity(prev);
      } else {
        toast.success(
          n === 1 ? "1 cliente por tramo" : `${n} clientes por tramo`,
        );
      }
    });
  }

  // ---- Datos del salón ----
  const [salonForm, setSalonForm] = useState({
    name: salon?.name ?? "",
    owner: salon?.owner ?? "",
    nif: salon?.nif ?? "",
    address: salon?.address ?? "",
    phone: salon?.phone ?? "",
    city: salon?.city ?? "",
  });

  function updateSalonField<K extends keyof typeof salonForm>(key: K, value: string) {
    setSalonForm((f) => ({ ...f, [key]: value }));
  }

  function handleSaveSalon(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateSalonInfo({
        name: salonForm.name.trim(),
        owner: salonForm.owner.trim() || null,
        nif: salonForm.nif.trim() || null,
        address: salonForm.address.trim() || null,
        phone: salonForm.phone.trim() || null,
        city: salonForm.city.trim() || null,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Datos del salón guardados");
    });
  }

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDuration, setNewDuration] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");

  function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createService({
        name: newName.trim(),
        price: newPrice ? parseFloat(newPrice) : null,
        duration_minutes: newDuration ? parseInt(newDuration) : null,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Servicio añadido");
        setServices((prev) => [
          ...prev,
          result.service as Service,
        ]);
        setNewName("");
        setNewPrice("");
        setNewDuration("");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteService(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setServices((prev) => prev.filter((s) => s.id !== id));
        toast.success("Servicio eliminado");
      }
    });
  }

  function startEdit(s: Service) {
    setEditId(s.id);
    setEditName(s.name);
    setEditPrice(s.price != null ? String(s.price) : "");
    setEditDuration(s.duration_minutes != null ? String(s.duration_minutes) : "");
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      const result = await updateService(id, {
        name: editName.trim(),
        price: editPrice ? parseFloat(editPrice) : null,
        duration_minutes: editDuration ? parseInt(editDuration) : null,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        setServices((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  name: editName.trim(),
                  price: editPrice ? parseFloat(editPrice) : null,
                  duration_minutes: editDuration ? parseInt(editDuration) : null,
                }
              : s,
          ),
        );
        setEditId(null);
        toast.success("Servicio actualizado");
      }
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ---- Capacidad por tramo ---- */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Clientes por tramo horario
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          ¿Cuántos clientes puedes atender a la vez en la misma franja? La agenda
          calculará los huecos libres y los colores según este valor.
        </p>
        <div className="grid grid-cols-4 gap-2 max-w-xs">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleCapacity(n)}
              disabled={isPending}
              className={cn(
                "rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors",
                capacity === n
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-border bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {capacity === 1
            ? "Una cita ocupa el tramo por completo (modo clásico)."
            : `Cada tramo admite ${capacity} citas simultáneas antes de marcarse como completo.`}
        </p>
      </section>

      {/* ---- Datos del salón ---- */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Store className="h-4 w-4" />
          Datos del salón
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Aparecen en los tickets impresos y en la cabecera de la app.
        </p>
        <form onSubmit={handleSaveSalon} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="salon-name" className="text-xs">Nombre *</Label>
              <Input
                id="salon-name" value={salonForm.name}
                onChange={(e) => updateSalonField("name", e.target.value)}
                placeholder="Peluquería Ali" className="text-sm" required
              />
            </div>
            <div>
              <Label htmlFor="salon-owner" className="text-xs">Titular</Label>
              <Input
                id="salon-owner" value={salonForm.owner}
                onChange={(e) => updateSalonField("owner", e.target.value)}
                placeholder="Alicia Quintana" className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="salon-nif" className="text-xs">NIF / CIF</Label>
              <Input
                id="salon-nif" value={salonForm.nif}
                onChange={(e) => updateSalonField("nif", e.target.value)}
                placeholder="10.200.117-P" className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="salon-address" className="text-xs">Dirección</Label>
              <Input
                id="salon-address" value={salonForm.address}
                onChange={(e) => updateSalonField("address", e.target.value)}
                placeholder="C/ Real, 16" className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="salon-city" className="text-xs">Población</Label>
              <Input
                id="salon-city" value={salonForm.city}
                onChange={(e) => updateSalonField("city", e.target.value)}
                placeholder="24717 Val de San Román (León)" className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="salon-phone" className="text-xs">Teléfono</Label>
              <Input
                id="salon-phone" value={salonForm.phone}
                onChange={(e) => updateSalonField("phone", e.target.value)}
                placeholder="626 758 515" className="text-sm"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isPending || !salonForm.name.trim()}>
            Guardar datos
          </Button>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-base font-semibold mb-1">Tipos de servicio</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configura los servicios y sus precios. Al crear citas, el precio se
          autocompletará según el servicio elegido.
        </p>

        {services.length > 0 ? (
          <div className="divide-y rounded-lg border mb-4 overflow-hidden">
            {services.map((s) =>
              editId === s.id ? (
                <div key={s.id} className="p-3 bg-slate-50 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 sm:col-span-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre del servicio"
                        className="text-sm"
                      />
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Precio"
                        className="pr-7 text-sm"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="5"
                        step="5"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder="Minutos"
                        className="pr-8 text-sm"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">min</span>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)} disabled={isPending}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(s.id)} disabled={isPending || !editName.trim()}>
                      <Check className="h-4 w-4 mr-1" />
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.price != null ? `${s.price.toFixed(2)} €` : "Sin precio"}
                      {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
                    onClick={() => startEdit(s)} disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600 flex-shrink-0"
                    onClick={() => handleDelete(s.id)} disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic mb-4">
            No hay servicios configurados. Añade el primero.
          </p>
        )}

        <form onSubmit={handleAddService} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <Label htmlFor="new-name" className="text-xs">Nombre *</Label>
              <Input
                id="new-name" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Corte de cabello"
                className="text-sm" required
              />
            </div>
            <div>
              <Label htmlFor="new-price" className="text-xs">Precio (€)</Label>
              <div className="relative">
                <Input
                  id="new-price" type="number" min="0" step="0.01"
                  value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00" className="pr-7 text-sm"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
              </div>
            </div>
            <div>
              <Label htmlFor="new-duration" className="text-xs">Duración (min)</Label>
              <div className="relative">
                <Input
                  id="new-duration" type="number" min="5" step="5"
                  value={newDuration} onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="30" className="pr-8 text-sm"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">min</span>
              </div>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={isPending || !newName.trim()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Añadir servicio
          </Button>
        </form>
      </section>
    </div>
  );
}
