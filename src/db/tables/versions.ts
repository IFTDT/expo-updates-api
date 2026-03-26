import { sql } from "drizzle-orm";
import { boolean, datetime, index, int, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 版本表 ====================
export const versions = mysqlTable("versions", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).notNull().references(() => apps.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 50 }).notNull(), // 1.2.0
  build: varchar("build", { length: 50 }).notNull(), // 构建号，如：100, 101, 102
  runtimeVersion: varchar("runtime_version", { length: 50 }).notNull(), // Runtime 版本
  name: varchar("name", { length: 255 }).notNull(), // 版本名称
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileSize: int("file_size").notNull(), // bytes
  checksum: varchar("checksum", { length: 255 }).notNull(), // sha256:abc123...
  isMandatory: boolean("is_mandatory").notNull().default(false),
  publishedBy: varchar("published_by", { length: 36 }).references(() => users.id),
  deletedAt: datetime("deleted_at"),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
    .notNull(),
}, table => [
  index("versions_app_id_idx").on(table.appId),
  index("versions_version_idx").on(table.version),
  index("versions_build_idx").on(table.build),
  unique("versions_app_build_unique").on(table.appId, table.build),
]);
