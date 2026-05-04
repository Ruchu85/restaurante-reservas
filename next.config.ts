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
};

export default nextConfig;
