import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEMO_READONLY_COOKIE } from "@/lib/demoReadonly";

/**
 * Enlace que se manda en los correos y WhatsApp de venta: "Panel de gestión".
 * Loguea automáticamente como el admin de la demo (mismas credenciales de
 * siempre, ver README) y marca la sesión como solo-lectura, para que
 * cualquier prospecto vea el panel real sin pedir usuario/contraseña y sin
 * poder tocar los datos que están viendo a la vez otros prospectos.
 *
 * Usa request.url (no NEXT_PUBLIC_APP_URL) para el redirect: así funciona
 * igual desde cualquier dominio que sirva la app (reservas-restaurante-demo
 * y cita-lista.es apuntan al mismo despliegue).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: "admin@restaurante-demo.com",
    password: "Admin1234!",
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?redirectTo=/dashboard", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_READONLY_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días: dura lo que la propia prueba gratuita
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
