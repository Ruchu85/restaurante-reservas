"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createStaffMember, deleteStaffMember } from "@/actions/staff";
import type { StaffMember } from "@/types";

interface StaffManagerProps {
  staff: StaffMember[];
}

export function StaffManager({ staff }: StaffManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createStaffMember(name.trim());
      if (result.error) toast.error(result.error);
      else {
        toast.success("Profesional añadido");
        setName("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string, n: string) {
    startTransition(async () => {
      const result = await deleteStaffMember(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`"${n}" eliminado`);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del profesional…"
          minLength={2}
          maxLength={100}
        />
        <Button type="submit" disabled={isPending || !name.trim()}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Añadir
        </Button>
      </form>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No hay profesionales. Añade el primero para poder asignar citas.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border overflow-hidden">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <span className="text-sm font-medium">{s.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(s.id, s.name)}
                disabled={isPending}
                className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                title="Eliminar profesional"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
