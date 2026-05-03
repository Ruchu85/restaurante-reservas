"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ServiceStep } from "./ServiceStep";
import { StaffStep } from "./StaffStep";
import { DateTimeStep } from "./DateTimeStep";
import { CustomerStep } from "./CustomerStep";
import { createAppointment } from "@/actions/appointments";
import type { Service, StaffMember, TimeSlot } from "@/types";
import { CheckCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingWizardProps {
  salonId: string;
  services: Service[];
  staff: Pick<StaffMember, "id" | "display_name" | "bio">[];
  initialServiceId?: string;
}

const STEPS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos"];

export function BookingWizard({
  salonId,
  services,
  staff,
  initialServiceId,
}: BookingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [selectedService, setSelectedService] = useState<Service | null>(
    services.find((s) => s.id === initialServiceId) ?? null,
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleConfirm() {
    if (!selectedService || !selectedSlot) return;

    startTransition(async () => {
      const result = await createAppointment({
        salon_id: salonId,
        service_id: selectedService.id,
        staff_id: selectedSlot.staff_id ?? null,
        starts_at: selectedSlot.starts_at.toISOString(),
        customer_name: customerData.name,
        customer_email: customerData.email,
        customer_phone: customerData.phone,
        notes: customerData.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.push(`/reservar/confirmacion?id=${result.data!.id}`);
    });
  }

  return (
    <div>
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    i < step
                      ? "border-green-500 bg-green-500 text-white"
                      : i === step
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 text-slate-400",
                  )}
                >
                  {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "mt-1 hidden text-xs sm:block",
                    i === step ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    i < step ? "bg-green-500" : "bg-slate-200",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <ServiceStep
              services={services}
              selected={selectedService}
              onSelect={(service) => {
                setSelectedService(service);
                setSelectedSlot(null);
                next();
              }}
            />
          )}
          {step === 1 && (
            <StaffStep
              staff={staff}
              selected={selectedStaffId}
              onSelect={(id) => {
                setSelectedStaffId(id);
                setSelectedSlot(null);
                next();
              }}
            />
          )}
          {step === 2 && selectedService && (
            <DateTimeStep
              salonId={salonId}
              service={selectedService}
              staffId={selectedStaffId ?? undefined}
              selected={selectedSlot}
              onSelect={(slot) => {
                setSelectedSlot(slot);
                next();
              }}
            />
          )}
          {step === 3 && (
            <CustomerStep
              service={selectedService!}
              slot={selectedSlot!}
              staff={staff.find((s) => s.id === selectedSlot?.staff_id)}
              data={customerData}
              onChange={setCustomerData}
              onConfirm={handleConfirm}
              isLoading={isPending}
            />
          )}

          {/* Navigation */}
          {step > 0 && step < 3 && (
            <div className="mt-6 flex justify-start border-t pt-4">
              <Button variant="ghost" size="sm" onClick={back}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Atrás
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
