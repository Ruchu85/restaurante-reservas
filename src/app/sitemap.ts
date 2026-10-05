import type { MetadataRoute } from "next";
import { esDemoPublica } from "@/lib/demo-publica";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  // El restaurante ficticio de la demo no se indexa, así que tampoco anuncia
  // URLs. El mapa del sitio que importa es el de la página de producto, en
  // https://cita-lista.es/sitemap.xml.
  if (esDemoPublica()) return [];

  const ahora = new Date();
  return [
    { url: BASE, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/reservar`, lastModified: ahora, changeFrequency: "monthly", priority: 0.8 },
  ];
}
