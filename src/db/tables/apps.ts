import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./users";

// ==================== 应用表 ====================
export const apps = sqliteTable("apps", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  appId: text().notNull().unique(), // com.example.app
  icon: text(),
  description: text(),
  status: text().notNull().default("active"), // active, inactive
  currentVersion: text(), // 当前版本号（文本，向后兼容）
  currentVersionId: text(), // 当前版本ID（关联到versions表）
  ownerId: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => [
  index("apps_app_id_idx").on(table.appId),
  index("apps_owner_id_idx").on(table.ownerId),
  index("apps_status_idx").on(table.status),
  index("apps_current_version_id_idx").on(table.currentVersionId),
]);
