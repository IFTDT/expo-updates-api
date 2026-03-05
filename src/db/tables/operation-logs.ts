import { index, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 操作日志表 ====================
export const operationLogs = mysqlTable("operation_logs", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).references(() => apps.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // update, rollback, delete, etc.
  action: varchar("action", { length: 255 }).notNull(),
  targetId: varchar("target_id", { length: 36 }),
  targetType: varchar("target_type", { length: 50 }), // version, user, group, etc.
  status: varchar("status", { length: 50 }).notNull().default("success"), // success, failed
  details: text("details"), // JSON
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
}, table => [
  index("operation_logs_app_id_idx").on(table.appId),
  index("operation_logs_user_id_idx").on(table.userId),
  index("operation_logs_type_idx").on(table.type),
  index("operation_logs_status_idx").on(table.status),
  index("operation_logs_created_at_idx").on(table.createdAt),
]);
