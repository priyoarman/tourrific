import type { NextConfig } from "next";

// The Express backend (api/ in the repo root). While it is being migrated, the
// browser calls /api/* on this app and Next forwards it, so there is no CORS setup.
const API_URL = process.env.API_URL ?? "http://localhost:5500";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
