import { cookies } from "next/headers";

/**
 * Prospectos entran al panel desde el enlace de venta sin usuario ni
 * contraseña (ver /demo): quedan logueados como el admin real de la demo,
 * así que esta cookie es lo único que impide que escriban sobre los datos
 * compartidos que ven otros prospectos al mismo tiempo.
 */
export const DEMO_READONLY_COOKIE = "demo_readonly";

export const READONLY_DEMO = {
  error: "Este panel es una demo de solo lectura — puedes navegar por todo, pero no se pueden guardar cambios.",
} as const;

export async function isDemoReadOnly(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_READONLY_COOKIE)?.value === "1";
}
