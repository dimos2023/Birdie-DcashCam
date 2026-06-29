import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose Google Maps key to the browser bundle from server-only GOOGLE_MAPS_API_KEY
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },
};

export default nextConfig;
