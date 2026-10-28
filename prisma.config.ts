import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

if (existsSync(".env.local")) loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
});
