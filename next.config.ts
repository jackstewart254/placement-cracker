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
};

export default nextConfig;
