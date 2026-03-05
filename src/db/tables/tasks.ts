import { sql } from "drizzle-orm";
import { boolean, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

// 保留旧的 tasks 表（如果还需要的话）
export const tasks = mysqlTable("tasks", {
  id: int("id")
    .primaryKey()
    .autoincrement(),
  name: varchar("name", { length: 500 }).notNull(),
  done: boolean("done")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});
