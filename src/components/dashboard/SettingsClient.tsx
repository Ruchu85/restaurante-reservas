"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createService, deleteService, updateService } from "@/actions/services";
import type { Service } from "@/types";

interface SettingsClientProps {
  initialServices: Service[];
}

export function SettingsClient({ initialServices }: SettingsClientProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [isPending, startTransition] = useTransition();

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
