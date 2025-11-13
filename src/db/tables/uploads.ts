import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 文件上传表 ====================
export const uploads = sqliteTable("uploads", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().references(() => apps.id, { onDelete: "cascade" }),
  fileUrl: text().notNull(),
  fileSize: integer().notNull(),
  checksum: text().notNull(),
  status: text().notNull().default("uploading"), // uploading, completed, failed
  progress: integer().default(0), // 0-100
  uploadedBytes: integer().default(0),
  totalBytes: integer().notNull(),
  uploadedBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("uploads_app_id_idx").on(table.appId),
  index("uploads_status_idx").on(table.status),
  index("uploads_uploaded_by_idx").on(table.uploadedBy),
]);

