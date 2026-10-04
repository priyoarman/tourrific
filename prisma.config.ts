import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

// The Prisma CLI only reads `.env` by itself. Next.js keeps local secrets in
// `.env.local`, so load that here. On a host the variables are already set.
if (existsSync(".env.local")) loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
});
