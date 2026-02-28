import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";
import { versions } from "./versions";

// ==================== 更新任务表 ====================
export const updateTasks = sqliteTable("update_tasks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  versionId: text().notNull().references(() => versions.id, { onDelete: "cascade" }),
  type: text().notNull().default("full"), // full, targeted
  status: text().notNull().default("pending"), // pending, in_progress, completed, failed
  scheduledAt: integer({ mode: "timestamp" }),
  startedAt: integer({ mode: "timestamp" }),
  completedAt: integer({ mode: "timestamp" }),
  successCount: integer().default(0),
  failureCount: integer().default(0),
  progress: integer().default(0), // 0-100
  targetUserIds: text(), // JSON array - 目标用户ID列表（app_users.id）
  targetGroupIds: text(), // JSON array - 目标用户组ID列表（user_groups.id）
  successUserIds: text(), // JSON array - 更新成功的用户ID列表（app_users.id）
  failureUserIds: text(), // JSON array - 更新失败的用户ID列表（app_users.id）
  createdBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("update_tasks_app_id_idx").on(table.appId),
  index("update_tasks_version_id_idx").on(table.versionId),
  index("update_tasks_status_idx").on(table.status),
  index("update_tasks_created_by_idx").on(table.createdBy),
]);
