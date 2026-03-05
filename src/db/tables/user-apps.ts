import { index, mysqlTable, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 用户应用关联表 ====================
export const userApps = mysqlTable("user_apps", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("app_id", { length: 36 }).notNull().references(() => apps.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
}, table => [
  index("user_apps_user_id_idx").on(table.userId),
  index("user_apps_app_id_idx").on(table.appId),
  unique("user_apps_user_app_unique").on(table.userId, table.appId),
]);
