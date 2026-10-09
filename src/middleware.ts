import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPaths = ["/dashboard"];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

/**
 * Solo las rutas con sesión.
 *
 * El patrón anterior cubría el sitio entero, así que cada visita a la web
 * pública del restaurante —la carta, la galería, el formulario de reserva—
 * pagaba una validación del token contra Supabase por red antes de responder,
 * para un visitante que nunca tiene sesión. Y con las peticiones internas del
 * router de Next, la misma llamada se repetía en cada navegación del panel.
 *
 * `/dashboard` es lo que hay que proteger; `/login` entra para que el
 * middleware siga refrescando la cookie de sesión al entrar y al salir.
 */
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
