import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { appUsers } from "./app-users";
import { userGroups } from "./user-groups";

// ==================== 用户分组成员表 ====================
export const userGroupMembers = sqliteTable("user_group_members", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  groupId: text().notNull().references(() => userGroups.id, { onDelete: "cascade" }),
  appUserId: text().notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, table => [
  index("user_group_members_group_id_idx").on(table.groupId),
  index("user_group_members_app_user_id_idx").on(table.appUserId),
  unique("user_group_members_group_user_unique").on(table.groupId, table.appUserId),
]);
