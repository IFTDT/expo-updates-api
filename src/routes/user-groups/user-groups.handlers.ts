import { and, eq, inArray, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, userGroups, userGroupMembers, appUsers, versions } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { AddUsersRoute, CreateRoute, GetOneRoute, ListRoute, RemoveRoute, RemoveUsersRoute, UpdateRoute, SetTargetVersionRoute } from "./user-groups.routes";

export const list = async (c: Parameters<AppRouteHandler<ListRoute>>[0]) => {
  const { appId } = c.req.valid("param");
  const query = c.req.valid("query");

  // 验证应用是否存在
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "应用不存在",
      { resource: "app", id: appId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 构建查询条件
  const conditions = [eq(userGroups.appId, appId)];

  if (query.search) {
    // SQLite/Turso 不支持 ILIKE，使用 lower() 函数实现不区分大小写搜索
    const searchPattern = `%${query.search.toLowerCase()}%`;
    conditions.push(
      sql`LOWER(${userGroups.name}) LIKE ${searchPattern}`,
    );
  }

  const where = and(...conditions);

  // 获取分组列表
  const groups = await db.query.userGroups.findMany({
    where,
    orderBy: [userGroups.createdAt],
    with: {
      members: {
        with: {
          appUser: {
            columns: {
              id: true,
            },
          },
        },
      },
    },
  });

  // 格式化响应
  const formattedItems = groups.map((group) => {
    const userIds = group.members.map((m: { appUser: { id: string } }) => m.appUser.id);
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      userCount: group.members.length,
      userIds,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      createdBy: group.createdBy,
    };
  });

  return successResponse(c, {
    items: formattedItems,
  });
};

export const getOne = async (c: Parameters<AppRouteHandler<GetOneRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");

  // 验证分组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
    with: {
      members: {
        with: {
          appUser: {
            columns: {
              id: true,
              userId: true,
              deviceId: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "分组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const userIds = group.members.map((m: { appUser: { id: string } }) => m.appUser.id);
  const users = group.members.map((m: { appUser: { id: string; userId: string | null; deviceId: string } }) => ({
    id: m.appUser.id,
    userId: m.appUser.userId || undefined,
    deviceId: m.appUser.deviceId,
  }));

  return successResponse(c, {
    id: group.id,
    name: group.name,
    description: group.description,
    userCount: group.members.length,
    userIds,
    users,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  });
};

export const create = async (c: Parameters<AppRouteHandler<CreateRoute>>[0]) => {
  const { appId } = c.req.valid("param");
  const data = c.req.valid("json");
  const userPayload = c.get("user");

  if (!userPayload) {
    return errorResponse(
      c,
      "AUTH_REQUIRED",
      "需要认证",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  // 验证应用是否存在
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "应用不存在",
      { resource: "app", id: appId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 创建分组
  const [newGroup] = await db.insert(userGroups).values({
    appId,
    name: data.name,
    description: data.description,
    createdBy: userPayload.userId,
  }).returning();

  // 添加用户到分组
  if (data.userIds.length > 0) {
    const members = data.userIds.map((userId) => ({
      groupId: newGroup.id,
      appUserId: userId,
    }));

    await db.insert(userGroupMembers).values(members);
  }

  return successResponse(
    c,
    {
      id: newGroup.id,
      name: newGroup.name,
      userCount: data.userIds.length,
      createdAt: newGroup.createdAt,
    },
    undefined,
    HttpStatusCodes.CREATED,
  );
};

export const update = async (c: Parameters<AppRouteHandler<UpdateRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");
  const data = c.req.valid("json");

  // 验证分组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "分组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 更新分组信息
  const updateData: Partial<typeof userGroups.$inferInsert> = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  if (Object.keys(updateData).length > 0) {
    await db.update(userGroups)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(userGroups.id, id));
  }

  // 如果提供了userIds，更新分组成员
  if (data.userIds !== undefined) {
    // 删除现有成员
    await db.delete(userGroupMembers)
      .where(eq(userGroupMembers.groupId, id));

    // 添加新成员
    if (data.userIds.length > 0) {
      const members = data.userIds.map((userId) => ({
        groupId: id,
        appUserId: userId,
      }));

      await db.insert(userGroupMembers).values(members);
    }
  }

  // 获取更新后的分组信息
  const updatedGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, id),
    with: {
      members: {
        columns: { id: true },
      },
    },
  });

  return successResponse(c, {
    id: updatedGroup!.id,
    name: updatedGroup!.name,
    userCount: updatedGroup!.members.length,
    updatedAt: updatedGroup!.updatedAt,
  });
};

export const remove = async (c: Parameters<AppRouteHandler<RemoveRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");

  // 验证分组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "分组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 删除分组（级联删除成员关系）
  await db.delete(userGroups)
    .where(eq(userGroups.id, id));

  return successResponse(c, null, "分组删除成功");
};

export const addUsers = async (c: Parameters<AppRouteHandler<AddUsersRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");
  const data = c.req.valid("json");

  // 验证分组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "分组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 获取现有成员
  const existingMembers = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, id),
    columns: { appUserId: true },
  });

  const existingUserIds = new Set(existingMembers.map((m) => m.appUserId));

  // 过滤出需要添加的用户（不在现有成员中的）
  const newUserIds = data.userIds.filter((userId) => !existingUserIds.has(userId));

  let addedCount = 0;
  if (newUserIds.length > 0) {
    const members = newUserIds.map((userId) => ({
      groupId: id,
      appUserId: userId,
    }));

    await db.insert(userGroupMembers).values(members);
    addedCount = newUserIds.length;
  }

  // 获取更新后的成员数量
  const updatedGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, id),
    with: {
      members: {
        columns: { id: true },
      },
    },
  });

  return successResponse(c, {
    addedCount,
    userCount: updatedGroup!.members.length,
  });
};

export const removeUsers = async (c: Parameters<AppRouteHandler<RemoveUsersRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");
  const data = c.req.valid("json");

  // 验证分组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "分组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 删除成员
  if (data.userIds.length > 0) {
    await db.delete(userGroupMembers)
      .where(
        and(
          eq(userGroupMembers.groupId, id),
          inArray(userGroupMembers.appUserId, data.userIds),
        )!,
      );
  }

  // 获取更新后的成员数量
  const updatedGroup = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, id),
    with: {
      members: {
        columns: { id: true },
      },
    },
  });

  return successResponse(c, {
    removedCount: data.userIds.length,
    userCount: updatedGroup!.members.length,
  });
};

export const setTargetVersion = async (c: Parameters<AppRouteHandler<SetTargetVersionRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");
  const { versionId } = c.req.valid("json");

  // 验证用户组是否存在
  const group = await db.query.userGroups.findFirst({
    where: and(eq(userGroups.id, id), eq(userGroups.appId, appId)),
  });

  if (!group) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户组不存在",
      { resource: "group", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 验证版本是否存在且属于该应用
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, versionId), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在或不属于该应用",
      { resource: "version", id: versionId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 更新用户组的目标版本ID
  const [updatedGroup] = await db.update(userGroups)
    .set({
      targetVersionId: versionId,
      updatedAt: new Date(),
    })
    .where(eq(userGroups.id, id))
    .returning();

  return successResponse(c, {
    id: updatedGroup.id,
    targetVersionId: updatedGroup.targetVersionId,
    updatedAt: updatedGroup.updatedAt,
  });
};

