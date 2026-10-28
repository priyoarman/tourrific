import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["geoip-lite", "airports-json"],
  redirects: async () => [{ source: "/itinerary", destination: "/plan", permanent: false }],
};

export default nextConfig;
