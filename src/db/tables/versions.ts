import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 版本表 ====================
export const versions = sqliteTable("versions", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  version: text().notNull(), // 1.2.0
  build: text().notNull(), // 构建号，如：100, 101, 102
  runtimeVersion: text().notNull(), // Runtime 版本
  name: text().notNull(), // 版本名称
  description: text(),
  status: text().notNull().default("draft"), // draft, published, rolled_back
  fileUrl: text().notNull(),
  fileSize: integer().notNull(), // bytes
  checksum: text().notNull(), // sha256:abc123...
  isMandatory: integer({ mode: "boolean" }).notNull().default(false),
  publishedAt: integer({ mode: "timestamp" }),
  rolledBackAt: integer({ mode: "timestamp" }),
  publishedBy: text().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("versions_app_id_idx").on(table.appId),
  index("versions_status_idx").on(table.status),
  index("versions_version_idx").on(table.version),
  index("versions_build_idx").on(table.build),
  unique("versions_app_build_unique").on(table.appId, table.build),
]);
