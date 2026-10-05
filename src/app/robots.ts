import type { MetadataRoute } from "next";
import { esDemoPublica } from "@/lib/demo-publica";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * El panel y las páginas de confirmación no deben indexarse: las segundas
 * llevan un token de reserva en la URL.
 *
 * Y si este despliegue es el restaurante ficticio de la demo, no se indexa
 * nada en absoluto: es material comercial, no un restaurante real, y compitió
 * con la página de producto por las búsquedas de la marca.
 */
export default function robots(): MetadataRoute.Robots {
  if (esDemoPublica()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      // Sin `sitemap` ni `host`: antes apuntaban al dominio `.vercel.app`, que
      // le decía a Google que el hogar canónico de la marca era un dominio
      // desechable en lugar de cita-lista.es.
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/login", "/api/", "/reservar/", "/demo"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
