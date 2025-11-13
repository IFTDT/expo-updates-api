import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 操作日志表 ====================
export const operationLogs = sqliteTable("operation_logs", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().references(() => apps.id, { onDelete: "cascade" }),
  type: text().notNull(), // update, rollback, delete, etc.
  action: text().notNull(),
  targetId: text(),
  targetType: text(), // version, user, group, etc.
  status: text().notNull().default("success"), // success, failed
  details: text(), // JSON
  userId: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, table => [
  index("operation_logs_app_id_idx").on(table.appId),
  index("operation_logs_user_id_idx").on(table.userId),
  index("operation_logs_type_idx").on(table.type),
  index("operation_logs_status_idx").on(table.status),
  index("operation_logs_created_at_idx").on(table.createdAt),
]);

