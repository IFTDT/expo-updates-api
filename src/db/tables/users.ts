import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ==================== 平台用户表 ====================
export const users = sqliteTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  email: text().notNull().unique(),
  password: text().notNull(), // bcrypt 加密后的密码
  role: text().notNull().default("app_manager"), // admin, app_manager, viewer
  status: text().notNull().default("active"), // active, inactive
  avatar: text(),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
  lastLoginAt: integer({ mode: "timestamp" }),
}, table => [
  index("users_email_idx").on(table.email),
]);
