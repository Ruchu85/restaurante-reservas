import { createClient } from "@supabase/supabase-js";

/**
 * La portada y la imagen para compartir se generan al compilar (`revalidate`)
 * y consultan Supabase con la clave de servicio. En Vercel esa clave existe, pero
 * el CI de GitHub no la tiene —y no conviene copiarla allí—, así que el build
 * reventaba con «supabaseKey is required» y el CI llevaba semanas en rojo.
 *
 * Solo dentro de GitHub Actions se usa una clave falsa: las consultas devuelven
 * vacío, las páginas pintan su versión de reserva y el build termina. Ese CI no
 * publica nada. En cualquier otro entorno, sin clave real falla como siempre.
 */
const CLAVE_FALSA_PARA_EL_CI = "clave-falsa-solo-para-el-ci-de-github";

export function createAdminClient() {
  const claveServicio =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.GITHUB_ACTIONS === "true" ? CLAVE_FALSA_PARA_EL_CI : undefined);

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    claveServicio!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getRestaurantId(): Promise<string | null> {
  const slug = process.env.NEXT_PUBLIC_RESTAURANT_SLUG || "restaurante-demo";
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .single();
  return data?.id ?? null;
}
