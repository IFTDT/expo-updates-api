import { defineConfig } from "drizzle-kit";

import env from "@/env";

export default defineConfig({
  schema: "./src/db/tables/index.ts",
  out: "./src/db/migrations",
  dialect: "mysql",
  casing: "snake_case",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
