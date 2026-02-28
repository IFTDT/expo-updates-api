import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";
import { versions } from "./versions";

// ==================== 用户分组表 ====================
export const userGroups = sqliteTable("user_groups", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  targetVersionId: text().references(() => versions.id, { onDelete: "set null" }), // 分组级别的目标版本（优先级中等）
  createdBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("user_groups_app_id_idx").on(table.appId),
  index("user_groups_name_idx").on(table.name),
  index("user_groups_target_version_id_idx").on(table.targetVersionId),
]);
