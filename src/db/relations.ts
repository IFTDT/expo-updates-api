import { relations } from "drizzle-orm";

import {
  apps,
  appUsers,
  operationLogs,
  updateTasks,
  uploads,
  userApps,
  userGroupMembers,
  userGroups,
  users,
  versions,
} from "./tables";

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
  uploads: many(uploads),
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
  appUsers: many(appUsers),
  userGroups: many(userGroups),
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
  currentVersion: one(versions, {
    fields: [appUsers.currentVersionId],
    references: [versions.id],
  }),
  targetVersion: one(versions, {
    fields: [appUsers.targetVersionId],
    references: [versions.id],
  }),
  groupMembers: many(userGroupMembers),
}));

export const userGroupsRelations = relations(userGroups, ({ one, many }) => ({
  app: one(apps, {
    fields: [userGroups.appId],
    references: [apps.id],
  }),
  targetVersion: one(versions, {
    fields: [userGroups.targetVersionId],
    references: [versions.id],
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
