import type { NextConfig } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;

const allowedOrigins = ["localhost:3000"];
if (appUrl) {
  try {
    allowedOrigins.push(new URL(appUrl).host);
  } catch {
    // ignore malformed URL
  }
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  images: {
    // Fotografía de la web pública. Pexels permite uso comercial sin atribución
    // obligatoria. Para producción real conviene sustituirlas por fotos propias
    // del local y servirlas desde el propio dominio.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/photos/**",
      },
    ],
  },
};

export default nextConfig;
