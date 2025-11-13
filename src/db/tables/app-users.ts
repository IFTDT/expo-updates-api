import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { versions } from "./versions";

// ==================== 应用用户表 ====================
export const appUsers = sqliteTable("app_users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  deviceId: text().notNull(), // 设备ID
  userId: text(), // 用户ID（可选）
  currentVersion: text(), // 当前运行的版本号（文本）
  targetVersionId: text().references(() => versions.id, { onDelete: "set null" }), // 用户级别的目标版本（优先级最高）
  lastUpdateAt: integer({ mode: "timestamp" }),
  deviceInfo: text(), // JSON
  status: text().notNull().default("online"), // online, offline
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("app_users_app_id_idx").on(table.appId),
  index("app_users_device_id_idx").on(table.deviceId),
  index("app_users_status_idx").on(table.status),
  index("app_users_target_version_id_idx").on(table.targetVersionId),
  unique("app_users_app_device_unique").on(table.appId, table.deviceId),
]);

