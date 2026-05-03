"use client";

import { Clock, Scissors } from "lucide-react";
import { cn, formatCurrency, formatDuration } from "@/lib/utils";
import type { Service } from "@/types";

interface ServiceStepProps {
  services: Service[];
  selected: Service | null;
  onSelect: (service: Service) => void;
}

export function ServiceStep({ services, selected, onSelect }: ServiceStepProps) {
  if (services.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No hay servicios disponibles en este momento.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">¿Qué servicio deseas?</h2>
      <div className="space-y-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelect(service)}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all hover:border-slate-400",
              selected?.id === service.id
                ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                : "border-slate-200",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Scissors className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">{service.name}</div>
                  {service.description && (
                    <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                      {service.description}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(service.duration_minutes)}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-semibold">{formatCurrency(service.price_cents)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
