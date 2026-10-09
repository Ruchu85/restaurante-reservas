"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMA_COOKIE, type Tema } from "@/lib/tema";

/**
 * Interruptor de claro/oscuro del panel.
 *
 * El cambio se aplica en el acto sobre el DOM —quitando o poniendo la clase
 * `panel-oscuro` en el contenedor— y la cookie solo sirve para que la próxima
 * carga ya venga pintada del color correcto desde el servidor. Hacerlo al
 * revés (escribir la cookie y recargar) dejaría medio segundo de espera en un
 * botón del que se espera respuesta inmediata.
 */
export function ThemeToggle({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);

  function cambiar() {
    const nuevo: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    document.getElementById("panel")?.classList.toggle("panel-oscuro", nuevo === "oscuro");
    // Un año: es una preferencia, no una sesión.
    document.cookie = `${TEMA_COOKIE}=${nuevo}; path=/; max-age=31536000; samesite=lax`;
  }

  const oscuro = tema === "oscuro";
  return (
    <button
      type="button"
      onClick={cambiar}
      aria-pressed={oscuro}
      title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
        "border-stone-200 bg-panel text-stone-500",
        "hover:bg-stone-100 hover:text-stone-800",
      )}
    >
      {oscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
