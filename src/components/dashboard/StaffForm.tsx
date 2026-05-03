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
import { createStaffMember, updateStaffMember } from "@/actions/staff";
import type { StaffMember } from "@/types";

interface StaffFormProps {
  salonId: string;
  staff?: StaffMember;
}

export function StaffForm({ salonId, staff }: StaffFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    display_name: staff?.display_name ?? "",
    bio: staff?.bio ?? "",
    active: staff?.active ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...form,
        salon_id: salonId,
        bio: form.bio || undefined,
      };

      const result = staff
        ? await updateStaffMember(staff.id, payload)
        : await createStaffMember(payload);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(staff ? "Profesional actualizado" : "Profesional añadido");
        setOpen(false);
      }
    });
  }

  async function handleDeactivate() {
    if (!staff) return;
    startTransition(async () => {
      const result = await updateStaffMember(staff.id, { active: false });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Profesional desactivado");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {staff ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Añadir profesional
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{staff ? "Editar profesional" : "Añadir profesional"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Descripción / especialidad</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={2}
            />
          </div>
          <DialogFooter className="gap-2">
            {staff && staff.active && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDeactivate}
                disabled={isPending}
              >
                Desactivar
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
