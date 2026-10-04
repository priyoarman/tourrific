import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Loaded from node_modules at run time instead of being bundled: geoip-lite
  // reads its data files from its own folder, and airports-json is 3 MB of data.
  serverExternalPackages: ["geoip-lite", "airports-json"],
};

export default nextConfig;
