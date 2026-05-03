"use client";

import { User, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/types";

interface StaffStepProps {
  staff: Pick<StaffMember, "id" | "display_name" | "bio">[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function StaffStep({ staff, selected, onSelect }: StaffStepProps) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">¿Con quién quieres la cita?</h2>
      <div className="space-y-3">
        {/* Opción "Cualquiera" */}
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "w-full rounded-lg border p-4 text-left transition-all hover:border-slate-400",
            selected === null
              ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
              : "border-slate-200",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
              <Shuffle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Cualquier profesional</div>
              <div className="text-sm text-muted-foreground">
                Te asignamos el profesional disponible
              </div>
            </div>
          </div>
        </button>

        {staff.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member.id)}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all hover:border-slate-400",
              selected === member.id
                ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                : "border-slate-200",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                <User className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium">{member.display_name}</div>
                {member.bio && (
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {member.bio}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
