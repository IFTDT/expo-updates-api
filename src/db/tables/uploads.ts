import { index, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 文件上传表 ====================
export const uploads = mysqlTable("uploads", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).references(() => apps.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileSize: int("file_size").notNull(),
  checksum: varchar("checksum", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("uploading"), // uploading, completed, failed
  progress: int("progress").default(0), // 0-100
  uploadedBytes: int("uploaded_bytes").default(0),
  totalBytes: int("total_bytes").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}, table => [
  index("uploads_app_id_idx").on(table.appId),
  index("uploads_status_idx").on(table.status),
  index("uploads_uploaded_by_idx").on(table.uploadedBy),
]);
