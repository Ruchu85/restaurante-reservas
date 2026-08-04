import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    { url: BASE, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/reservar`, lastModified: ahora, changeFrequency: "monthly", priority: 0.8 },
  ];
}
