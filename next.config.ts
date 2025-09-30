import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // experimental: {
  //   // Skip build-time pre-rendering errors
  //   forceSwcTransforms: true,
  // },
  eslint: {
    // Ignore ESLint errors during production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds even with type errors
    ignoreBuildErrors: true,
  },
  images: {
    // Add the remote domains where your placement logos are hosted
    domains: [
      "imagekit-production.higherin.com",
      "cdn.companylogos.com",     // e.g. Prosple / Highered / scraped sources
      "storage.googleapis.com",   // if you store logos in GCS
      "your-supabase-project.supabase.co" // if logos are in Supabase Storage
    ],
  },
};

export default nextConfig;
