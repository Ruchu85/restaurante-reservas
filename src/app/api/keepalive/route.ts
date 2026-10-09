import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Siempre se ejecuta de verdad: una respuesta cacheada no tocaría la base de datos.
export const dynamic = "force-dynamic";

/**
 * Lo llama una vez al día el cron de Vercel (ver `vercel.json`).
 *
 * El plan gratuito de Supabase PAUSA el proyecto tras una semana sin actividad.
 * Con la demo pública enlazada desde los correos de captación eso significa que
 * un prospecto que entre después de unos días sin visitas se encuentra un 404 en
 * `/demo` y un panel vacío. Una lectura mínima al día basta para que no se pause.
 */
export async function GET() {
  const { error } = await createAdminClient()
    .from("restaurants")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  return NextResponse.json(
    { ok: !error },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
