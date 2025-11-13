import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

import {
  appUsers,
  apps,
  operationLogs,
  tasks,
  updateTasks,
  uploads,
  userGroupMembers,
  userGroups,
  users,
  versions,
} from "./tables";

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
export const patchAppUsersSchema = toZodV4SchemaTyped(createInsertSchema(appUsers).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  appId: true,
  deviceId: true,
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
  lastUpdateAt: true,
}));

export const selectUserGroupsSchema = toZodV4SchemaTyped(createSelectSchema(userGroups));
export const insertUserGroupsSchema = toZodV4SchemaTyped(createInsertSchema(userGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}));
export const patchUserGroupsSchema = toZodV4SchemaTyped(createInsertSchema(userGroups).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
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

