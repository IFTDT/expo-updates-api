import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, appUsers, updateTasks, versions } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/response";

import type { BatchUpdateRoute, GetOneRoute, ListRoute, RollbackRoute, SetTargetVersionRoute, UpdateVersionRoute } from "./app-users.routes";

export async function list(c: Parameters<AppRouteHandler<ListRoute>>[0]) {
  const { appId } = c.req.valid("param");
  const query = c.req.valid("query");
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

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
  const conditions = [eq(appUsers.appId, appId)];

  if (query.status) {
    conditions.push(eq(appUsers.status, query.status));
  }

  if (query.version) {
    conditions.push(eq(appUsers.currentVersionId, query.version));
  }

  if (query.platform) {
    // 大小写不敏感的平台查询
    conditions.push(
      sql`LOWER(${appUsers.platform}) = LOWER(${query.platform})`,
    );
  }

  if (query.search) {
    // MySQL 不支持 ILIKE（PostgreSQL 特性），使用 LOWER() 函数实现不区分大小写搜索
    const searchPattern = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${appUsers.deviceId}) LIKE ${searchPattern}`,
        sql`LOWER(COALESCE(${appUsers.userId}, '')) LIKE ${searchPattern}`,
      )!,
    );
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(appUsers).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表（关联版本信息）
  const items = await db.query.appUsers.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(appUsers.lastUpdateAt)],
  });

  const currentVersionIds = items
    .map(item => item.currentVersionId)
    .filter((id): id is string => Boolean(id));
  const versionRows = currentVersionIds.length > 0
    ? await db.query.versions.findMany({
        where: inArray(versions.id, currentVersionIds),
        columns: { id: true, version: true, build: true, runtimeVersion: true },
      })
    : [];
  const versionMap = new Map(versionRows.map(v => [v.id, v]));

  // 格式化响应
  const formattedItems = items.map((item) => {
    let deviceInfo: Record<string, unknown> | undefined;
    if (item.deviceInfo) {
      try {
        deviceInfo = JSON.parse(item.deviceInfo);
      }
      catch {
        deviceInfo = undefined;
      }
    }

    return {
      id: item.id,
      deviceId: item.deviceId,
      userId: item.userId || undefined,
      platform: item.platform || undefined,
      currentVersionId: item.currentVersionId || undefined,
      currentVersion: item.currentVersionId && versionMap.get(item.currentVersionId)
        ? {
            id: versionMap.get(item.currentVersionId)!.id,
            version: versionMap.get(item.currentVersionId)!.version,
            build: versionMap.get(item.currentVersionId)!.build,
            runtimeVersion: versionMap.get(item.currentVersionId)!.runtimeVersion,
          }
        : undefined,
      lastUpdateAt: item.lastUpdateAt || undefined,
      deviceInfo,
      status: item.status,
    };
  });

  // 获取统计信息
  const allUsers = await db.query.appUsers.findMany({
    where: eq(appUsers.appId, appId),
    columns: { status: true, currentVersionId: true },
  });

  const stats = {
    total: allUsers.length,
    online: allUsers.filter(u => u.status === "online").length,
    offline: allUsers.filter(u => u.status === "offline").length,
    versions: new Set(allUsers.map(u => u.currentVersionId).filter(Boolean)).size,
  };

  return successResponse(c, {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats,
  });
}

export async function getOne(c: Parameters<AppRouteHandler<GetOneRoute>>[0]) {
  const { appId, id } = c.req.valid("param");

  const user = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.id, id), eq(appUsers.appId, appId)),
  });

  if (!user) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户不存在",
      { resource: "user", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const currentVersion = user.currentVersionId
    ? await db.query.versions.findFirst({
        where: eq(versions.id, user.currentVersionId),
        columns: { id: true, version: true, runtimeVersion: true },
      })
    : null;

  // 解析设备信息
  let deviceInfo: Record<string, unknown> | undefined;
  if (user.deviceInfo) {
    try {
      deviceInfo = JSON.parse(user.deviceInfo);
    }
    catch {
      deviceInfo = undefined;
    }
  }

  // 获取更新历史（简化版，实际可以从操作日志表获取）
  const updateHistory = user.lastUpdateAt
    ? [{
        version: currentVersion?.version || "",
        updatedAt: user.lastUpdateAt,
        status: "success",
      }]
    : [];

  return successResponse(c, {
    id: user.id,
    deviceId: user.deviceId,
    userId: user.userId || undefined,
    currentVersionId: user.currentVersionId || undefined,
    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          version: currentVersion.version,
          runtimeVersion: currentVersion.runtimeVersion,
        }
      : undefined,
    lastUpdateAt: user.lastUpdateAt || undefined,
    deviceInfo,
    status: user.status,
    updateHistory,
  });
}

export async function updateVersion(c: Parameters<AppRouteHandler<UpdateVersionRoute>>[0]) {
  const { appId, id } = c.req.valid("param");
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

  // 验证用户是否存在
  const user = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.id, id), eq(appUsers.appId, appId)),
  });

  if (!user) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户不存在",
      { resource: "user", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, data.versionId), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id: data.versionId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 创建更新任务
  const [{ id: taskId }] = await db.insert(updateTasks).values({
    appId,
    versionId: data.versionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify([id]),
    createdBy: userPayload.userId,
  }).$returningId();

  const task = await db.query.updateTasks.findFirst({
    where: eq(updateTasks.id, taskId),
  });

  if (!task) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "创建更新任务失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return successResponse(c, {
    taskId: task.id,
    status: task.status,
  });
}

export async function batchUpdate(c: Parameters<AppRouteHandler<BatchUpdateRoute>>[0]) {
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

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, data.versionId), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id: data.versionId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 创建批量更新任务
  const [{ id: taskId }] = await db.insert(updateTasks).values({
    appId,
    versionId: data.versionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify(data.userIds),
    createdBy: userPayload.userId,
  }).$returningId();

  const task = await db.query.updateTasks.findFirst({
    where: eq(updateTasks.id, taskId),
  });

  if (!task) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "创建批量更新任务失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return successResponse(c, {
    taskId: task.id,
    affectedCount: data.userIds.length,
  });
}

export async function rollback(c: Parameters<AppRouteHandler<RollbackRoute>>[0]) {
  const { appId, id } = c.req.valid("param");
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

  // 验证用户是否存在
  const user = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.id, id), eq(appUsers.appId, appId)),
  });

  if (!user) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户不存在",
      { resource: "user", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 验证目标版本是否存在
  const toVersion = await db.query.versions.findFirst({
    where: and(eq(versions.id, data.toVersionId), eq(versions.appId, appId)),
  });

  if (!toVersion) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "目标版本不存在",
      { resource: "version", id: data.toVersionId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 创建回滚任务
  const [{ id: taskId }] = await db.insert(updateTasks).values({
    appId,
    versionId: data.toVersionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify([id]),
    createdBy: userPayload.userId,
  }).$returningId();

  const task = await db.query.updateTasks.findFirst({
    where: eq(updateTasks.id, taskId),
  });

  if (!task) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "创建回滚任务失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return successResponse(c, {
    taskId: task.id,
  });
}

export async function setTargetVersion(c: Parameters<AppRouteHandler<SetTargetVersionRoute>>[0]) {
  const { appId, id } = c.req.valid("param");
  const { versionId } = c.req.valid("json");

  // 验证用户是否存在
  const user = await db.query.appUsers.findFirst({
    where: and(eq(appUsers.id, id), eq(appUsers.appId, appId)),
  });

  if (!user) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户不存在",
      { resource: "user", id },
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

  // 更新用户的目标版本ID
  await db.update(appUsers)
    .set({
      targetVersionId: versionId,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, id));

  const updatedUser = await db.query.appUsers.findFirst({
    where: eq(appUsers.id, id),
  });

  if (!updatedUser) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "更新目标版本失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return successResponse(c, {
    id: updatedUser.id,
    targetVersionId: updatedUser.targetVersionId,
    updatedAt: updatedUser.updatedAt,
  });
}
