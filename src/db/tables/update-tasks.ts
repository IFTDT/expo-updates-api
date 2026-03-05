import { index, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";
import { versions } from "./versions";

// ==================== 更新任务表 ====================
export const updateTasks = mysqlTable("update_tasks", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).notNull().references(() => apps.id, { onDelete: "cascade" }),
  versionId: varchar("version_id", { length: 36 }).notNull().references(() => versions.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull().default("full"), // full, targeted
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, in_progress, completed, failed
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  successCount: int("success_count").default(0),
  failureCount: int("failure_count").default(0),
  progress: int("progress").default(0), // 0-100
  targetUserIds: text("target_user_ids"), // JSON array - 目标用户ID列表（app_users.id）
  targetGroupIds: text("target_group_ids"), // JSON array - 目标用户组ID列表（user_groups.id）
  successUserIds: text("success_user_ids"), // JSON array - 更新成功的用户ID列表（app_users.id）
  failureUserIds: text("failure_user_ids"), // JSON array - 更新失败的用户ID列表（app_users.id）
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}, table => [
  index("update_tasks_app_id_idx").on(table.appId),
  index("update_tasks_version_id_idx").on(table.versionId),
  index("update_tasks_status_idx").on(table.status),
  index("update_tasks_created_by_idx").on(table.createdBy),
]);
