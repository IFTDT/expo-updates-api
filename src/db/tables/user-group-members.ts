import { index, mysqlTable, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

import { appUsers } from "./app-users";
import { userGroups } from "./user-groups";

// ==================== 用户分组成员表 ====================
export const userGroupMembers = mysqlTable("user_group_members", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  groupId: varchar("group_id", { length: 36 }).notNull().references(() => userGroups.id, { onDelete: "cascade" }),
  appUserId: varchar("app_user_id", { length: 36 }).notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
}, table => [
  index("user_group_members_group_id_idx").on(table.groupId),
  index("user_group_members_app_user_id_idx").on(table.appUserId),
  unique("user_group_members_group_user_unique").on(table.groupId, table.appUserId),
]);
