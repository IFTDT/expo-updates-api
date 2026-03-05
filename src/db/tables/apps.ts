import { index, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { users } from "./users";

// ==================== 应用表 ====================
export const apps = mysqlTable("apps", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  appId: varchar("app_id", { length: 255 }).notNull().unique(), // com.example.app
  icon: text("icon"),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, inactive
  currentVersion: varchar("current_version", { length: 50 }), // 当前版本号（文本，向后兼容）
  currentVersionId: varchar("current_version_id", { length: 36 }), // 当前版本ID（关联到versions表）
  ownerId: varchar("owner_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .onUpdateNow()
    .notNull(),
}, table => [
  index("apps_app_id_idx").on(table.appId),
  index("apps_owner_id_idx").on(table.ownerId),
  index("apps_status_idx").on(table.status),
  index("apps_current_version_id_idx").on(table.currentVersionId),
]);
