import { index, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";
import { versions } from "./versions";

// ==================== 用户分组表 ====================
export const userGroups = mysqlTable("user_groups", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: varchar("app_id", { length: 36 }).notNull().references(() => apps.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetVersionId: varchar("target_version_id", { length: 36 }).references(() => versions.id, { onDelete: "set null" }), // 分组级别的目标版本（优先级中等）
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}, table => [
  index("user_groups_app_id_idx").on(table.appId),
  index("user_groups_name_idx").on(table.name),
  index("user_groups_target_version_id_idx").on(table.targetVersionId),
]);
