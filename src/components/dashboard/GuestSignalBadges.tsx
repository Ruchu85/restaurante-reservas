import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  neutral: "bg-stone-50 text-stone-600 border-stone-200",
} as const;

export interface GuestSignal {
  label: string;
  tone: keyof typeof TONE_CLASSES;
}

/**
 * Señales del comensal (VIP, habitual, alergias, no-shows) para que el equipo
 * de sala sepa a quién tiene delante sin abrir la ficha.
 */
export function GuestSignalBadges({
  signals,
  className,
}: {
  signals: GuestSignal[];
  className?: string;
}) {
  if (signals.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {signals.map((signal) => (
        <span
          key={signal.label}
          className={cn(
            "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
            TONE_CLASSES[signal.tone],
          )}
        >
          {signal.label}
        </span>
      ))}
    </div>
  );
}
