import { sql } from "drizzle-orm";
import { datetime, index, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ==================== 平台用户表 ====================
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // bcrypt 加密后的密码
  role: varchar("role", { length: 50 }).notNull().default("app_manager"), // admin, app_manager, viewer
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, inactive
  avatar: text("avatar"),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at")
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`)
    .notNull(),
  lastLoginAt: datetime("last_login_at"),
}, table => [
  index("users_email_idx").on(table.email),
]);
