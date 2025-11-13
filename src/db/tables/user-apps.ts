import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { apps } from "./apps";
import { users } from "./users";

// ==================== 用户应用关联表 ====================
export const userApps = sqliteTable("user_apps", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, table => [
  index("user_apps_user_id_idx").on(table.userId),
  index("user_apps_app_id_idx").on(table.appId),
  unique("user_apps_user_app_unique").on(table.userId, table.appId),
]);

