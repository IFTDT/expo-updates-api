import { index, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { versions } from "./versions";

// ==================== 应用用户表 ====================
export const appUsers = mysqlTable("app_users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).notNull().references(() => apps.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id", { length: 255 }).notNull(), // 设备ID
  userId: varchar("user_id", { length: 36 }), // 用户ID（可选）
  platform: varchar("platform", { length: 50 }), // 运行平台：ios 或 android
  currentVersionId: varchar("current_version_id", { length: 36 }).references(() => versions.id, { onDelete: "set null" }), // 当前运行的版本ID
  targetVersionId: varchar("target_version_id", { length: 36 }).references(() => versions.id, { onDelete: "set null" }), // 用户级别的目标版本（优先级最高）
  lastUpdateAt: timestamp("last_update_at"),
  deviceInfo: text("device_info"), // JSON
  status: varchar("status", { length: 50 }).notNull().default("online"), // online, offline
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}, table => [
  index("app_users_app_id_idx").on(table.appId),
  index("app_users_device_id_idx").on(table.deviceId),
  index("app_users_status_idx").on(table.status),
  index("app_users_current_version_id_idx").on(table.currentVersionId),
  index("app_users_target_version_id_idx").on(table.targetVersionId),
  unique("app_users_app_device_unique").on(table.appId, table.deviceId),
]);
