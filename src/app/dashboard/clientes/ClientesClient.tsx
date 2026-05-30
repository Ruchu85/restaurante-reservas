"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer, deleteCustomer } from "@/actions/customers";
import type { Customer } from "@/types";

interface ClientesClientProps {
  customers: Customer[];
}

export function ClientesClient({ customers: initial }: ClientesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createCustomer(newName.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cliente añadido");
        setNewName("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string, name: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCustomer(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${name}" eliminado`);
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Clientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona la lista de clientes del salón. Al crear una cita se guardan automáticamente.
        </p>
      </div>

      {/* Formulario alta rápida */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-customer" className="sr-only">
            Nombre del nuevo cliente
          </Label>
          <Input
            id="new-customer"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del cliente…"
            minLength={2}
            maxLength={100}
          />
        </div>
        <Button type="submit" disabled={isPending || !newName.trim()}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Añadir
        </Button>
      </form>

      {/* Lista de clientes */}
      {initial.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
          Aún no hay clientes registrados. Se añaden automáticamente al crear citas.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border overflow-hidden">
          {initial.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50">
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                {c.preferred_service && (
                  <div className="text-xs text-muted-foreground">{c.preferred_service}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(c.id, c.name)}
                disabled={isPending && deletingId === c.id}
                className="text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                title="Eliminar cliente"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {initial.length} cliente{initial.length !== 1 ? "s" : ""} registrado{initial.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
