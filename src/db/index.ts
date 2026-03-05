import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import env from "@/env";

import * as schema from "./schema";

const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = drizzle(pool, {
  schema,
  mode: "default",
  casing: "snake_case",
});

export default db;
