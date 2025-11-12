import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

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
}, table => ({
  emailIdx: index("users_email_idx").on(table.email),
}));

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
}, table => ({
  userIdIdx: index("user_apps_user_id_idx").on(table.userId),
  appIdIdx: index("user_apps_app_id_idx").on(table.appId),
  uniqueUserApp: unique("user_apps_user_app_unique").on(table.userId, table.appId),
}));

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
  currentVersion: text(),
  ownerId: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("apps_app_id_idx").on(table.appId),
  ownerIdIdx: index("apps_owner_id_idx").on(table.ownerId),
  statusIdx: index("apps_status_idx").on(table.status),
}));

// ==================== 版本表 ====================
export const versions = sqliteTable("versions", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  version: text().notNull(), // 1.2.0
  build: text().notNull(), // 构建号，如：100, 101, 102
  name: text().notNull(), // 版本名称
  description: text(),
  status: text().notNull().default("draft"), // draft, published, rolled_back
  fileUrl: text().notNull(),
  fileSize: integer().notNull(), // bytes
  checksum: text().notNull(), // sha256:abc123...
  isMandatory: integer({ mode: "boolean" }).notNull().default(false),
  publishedAt: integer({ mode: "timestamp" }),
  rolledBackAt: integer({ mode: "timestamp" }),
  publishedBy: text().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const versionsAppIdIdx = index("versions_app_id_idx").on(versions.appId);
export const versionsStatusIdx = index("versions_status_idx").on(versions.status);
export const versionsVersionIdx = index("versions_version_idx").on(versions.version);
export const versionsBuildIdx = index("versions_build_idx").on(versions.build);
export const versionsAppBuildUnique = unique("versions_app_build_unique").on(versions.appId, versions.build);

// ==================== 更新任务表 ====================
export const updateTasks = sqliteTable("update_tasks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  versionId: text().notNull().references(() => versions.id, { onDelete: "cascade" }),
  type: text().notNull().default("full"), // full, targeted
  status: text().notNull().default("pending"), // pending, in_progress, completed, failed
  scheduledAt: integer({ mode: "timestamp" }),
  startedAt: integer({ mode: "timestamp" }),
  completedAt: integer({ mode: "timestamp" }),
  successCount: integer().default(0),
  failureCount: integer().default(0),
  progress: integer().default(0), // 0-100
  targetUserIds: text(), // JSON array
  targetGroupIds: text(), // JSON array
  createdBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("update_tasks_app_id_idx").on(table.appId),
  versionIdIdx: index("update_tasks_version_id_idx").on(table.versionId),
  statusIdx: index("update_tasks_status_idx").on(table.status),
  createdByIdx: index("update_tasks_created_by_idx").on(table.createdBy),
}));

// ==================== 应用用户表 ====================
export const appUsers = sqliteTable("app_users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  deviceId: text().notNull(), // 设备ID
  userId: text(), // 用户ID（可选）
  currentVersion: text(),
  lastUpdateAt: integer({ mode: "timestamp" }),
  deviceInfo: text(), // JSON
  status: text().notNull().default("online"), // online, offline
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("app_users_app_id_idx").on(table.appId),
  deviceIdIdx: index("app_users_device_id_idx").on(table.deviceId),
  statusIdx: index("app_users_status_idx").on(table.status),
  appDeviceUnique: unique("app_users_app_device_unique").on(table.appId, table.deviceId),
}));

// ==================== 用户分组表 ====================
export const userGroups = sqliteTable("user_groups", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().notNull().references(() => apps.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  createdBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("user_groups_app_id_idx").on(table.appId),
  nameIdx: index("user_groups_name_idx").on(table.name),
}));

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
}, table => ({
  groupIdIdx: index("user_group_members_group_id_idx").on(table.groupId),
  appUserIdIdx: index("user_group_members_app_user_id_idx").on(table.appUserId),
  uniqueGroupUser: unique("user_group_members_group_user_unique").on(table.groupId, table.appUserId),
}));

// ==================== 操作日志表 ====================
export const operationLogs = sqliteTable("operation_logs", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().references(() => apps.id, { onDelete: "cascade" }),
  type: text().notNull(), // update, rollback, delete, etc.
  action: text().notNull(),
  targetId: text(),
  targetType: text(), // version, user, group, etc.
  status: text().notNull().default("success"), // success, failed
  details: text(), // JSON
  userId: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("operation_logs_app_id_idx").on(table.appId),
  userIdIdx: index("operation_logs_user_id_idx").on(table.userId),
  typeIdx: index("operation_logs_type_idx").on(table.type),
  statusIdx: index("operation_logs_status_idx").on(table.status),
  createdAtIdx: index("operation_logs_created_at_idx").on(table.createdAt),
}));

// ==================== 文件上传表 ====================
export const uploads = sqliteTable("uploads", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  appId: text().references(() => apps.id, { onDelete: "cascade" }),
  fileUrl: text().notNull(),
  fileSize: integer().notNull(),
  checksum: text().notNull(),
  status: text().notNull().default("uploading"), // uploading, completed, failed
  progress: integer().default(0), // 0-100
  uploadedBytes: integer().default(0),
  totalBytes: integer().notNull(),
  uploadedBy: text().notNull().references(() => users.id),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
}, table => ({
  appIdIdx: index("uploads_app_id_idx").on(table.appId),
  statusIdx: index("uploads_status_idx").on(table.status),
  uploadedByIdx: index("uploads_uploaded_by_idx").on(table.uploadedBy),
}));

// ==================== 关系定义 ====================
export const usersRelations = relations(users, ({ many }) => ({
  apps: many(userApps),
  ownedApps: many(apps),
  createdTasks: many(updateTasks),
  operationLogs: many(operationLogs),
  uploads: many(uploads),
}));

export const userAppsRelations = relations(userApps, ({ one }) => ({
  user: one(users, {
    fields: [userApps.userId],
    references: [users.id],
  }),
  app: one(apps, {
    fields: [userApps.appId],
    references: [apps.id],
  }),
}));

export const appsRelations = relations(apps, ({ one, many }) => ({
  owner: one(users, {
    fields: [apps.ownerId],
    references: [users.id],
  }),
  userApps: many(userApps),
  versions: many(versions),
  updateTasks: many(updateTasks),
  appUsers: many(appUsers),
  userGroups: many(userGroups),
  operationLogs: many(operationLogs),
}));

export const versionsRelations = relations(versions, ({ one, many }) => ({
  app: one(apps, {
    fields: [versions.appId],
    references: [apps.id],
  }),
  publisher: one(users, {
    fields: [versions.publishedBy],
    references: [users.id],
  }),
  updateTasks: many(updateTasks),
}));

export const updateTasksRelations = relations(updateTasks, ({ one }) => ({
  app: one(apps, {
    fields: [updateTasks.appId],
    references: [apps.id],
  }),
  version: one(versions, {
    fields: [updateTasks.versionId],
    references: [versions.id],
  }),
  creator: one(users, {
    fields: [updateTasks.createdBy],
    references: [users.id],
  }),
}));

export const appUsersRelations = relations(appUsers, ({ one, many }) => ({
  app: one(apps, {
    fields: [appUsers.appId],
    references: [apps.id],
  }),
  groupMembers: many(userGroupMembers),
}));

export const userGroupsRelations = relations(userGroups, ({ one, many }) => ({
  app: one(apps, {
    fields: [userGroups.appId],
    references: [apps.id],
  }),
  creator: one(users, {
    fields: [userGroups.createdBy],
    references: [users.id],
  }),
  members: many(userGroupMembers),
}));

export const userGroupMembersRelations = relations(userGroupMembers, ({ one }) => ({
  group: one(userGroups, {
    fields: [userGroupMembers.groupId],
    references: [userGroups.id],
  }),
  appUser: one(appUsers, {
    fields: [userGroupMembers.appUserId],
    references: [appUsers.id],
  }),
}));

export const operationLogsRelations = relations(operationLogs, ({ one }) => ({
  app: one(apps, {
    fields: [operationLogs.appId],
    references: [apps.id],
  }),
  user: one(users, {
    fields: [operationLogs.userId],
    references: [users.id],
  }),
}));

export const uploadsRelations = relations(uploads, ({ one }) => ({
  app: one(apps, {
    fields: [uploads.appId],
    references: [apps.id],
  }),
  uploader: one(users, {
    fields: [uploads.uploadedBy],
    references: [users.id],
  }),
}));

// ==================== Zod Schemas ====================
export const selectUsersSchema = toZodV4SchemaTyped(createSelectSchema(users));
export const insertUsersSchema = toZodV4SchemaTyped(createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}));
export const patchUsersSchema = toZodV4SchemaTyped(createInsertSchema(users).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  password: true,
}));

export const selectAppsSchema = toZodV4SchemaTyped(createSelectSchema(apps));
export const insertAppsSchema = toZodV4SchemaTyped(createInsertSchema(apps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentVersion: true,
}));
export const patchAppsSchema = toZodV4SchemaTyped(createInsertSchema(apps).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
}));

export const selectVersionsSchema = toZodV4SchemaTyped(createSelectSchema(versions));
export const insertVersionsSchema = toZodV4SchemaTyped(createInsertSchema(versions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  rolledBackAt: true,
}));
export const patchVersionsSchema = toZodV4SchemaTyped(createInsertSchema(versions).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  appId: true,
}));

export const selectUpdateTasksSchema = toZodV4SchemaTyped(createSelectSchema(updateTasks));
export const insertUpdateTasksSchema = toZodV4SchemaTyped(createInsertSchema(updateTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
}));

export const selectAppUsersSchema = toZodV4SchemaTyped(createSelectSchema(appUsers));
export const insertAppUsersSchema = toZodV4SchemaTyped(createInsertSchema(appUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));

export const selectUserGroupsSchema = toZodV4SchemaTyped(createSelectSchema(userGroups));
export const insertUserGroupsSchema = toZodV4SchemaTyped(createInsertSchema(userGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));

export const selectUserGroupMembersSchema = toZodV4SchemaTyped(createSelectSchema(userGroupMembers));
export const insertUserGroupMembersSchema = toZodV4SchemaTyped(createInsertSchema(userGroupMembers).omit({
  id: true,
  createdAt: true,
}));

export const selectOperationLogsSchema = toZodV4SchemaTyped(createSelectSchema(operationLogs));
export const insertOperationLogsSchema = toZodV4SchemaTyped(createInsertSchema(operationLogs).omit({
  id: true,
  createdAt: true,
}));

export const selectUploadsSchema = toZodV4SchemaTyped(createSelectSchema(uploads));
export const insertUploadsSchema = toZodV4SchemaTyped(createInsertSchema(uploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));

// 保留旧的 tasks 表（如果还需要的话）
export const tasks = sqliteTable("tasks", {
  id: integer({ mode: "number" })
    .primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  done: integer({ mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectTasksSchema = toZodV4SchemaTyped(createSelectSchema(tasks));

export const insertTasksSchema = toZodV4SchemaTyped(createInsertSchema(
  tasks,
  {
    name: field => field.min(1).max(500),
  },
).required({
  done: true,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));

// @ts-expect-error partial exists on zod v4 type
export const patchTasksSchema = insertTasksSchema.partial();
