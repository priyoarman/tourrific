import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Loaded from node_modules at run time instead of being bundled: geoip-lite
  // reads its data files from its own folder, and airports-json is 3 MB of data.
  serverExternalPackages: ["geoip-lite", "airports-json"],
  // Itineraries live at /itinerary/<id>, made from a flight and hotel picked in the planner.
  // Temporary, so browsers don't hold on to it if /itinerary gets a page again.
  redirects: async () => [{ source: "/itinerary", destination: "/plan", permanent: false }],
};

export default nextConfig;
