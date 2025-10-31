import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, appUsers, versions, updateTasks } from "@/db/schema";
import { paginationResponse, errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { BatchUpdateRoute, GetOneRoute, ListRoute, RollbackRoute, UpdateVersionRoute } from "./app-users.routes";

export const list = async (c: Parameters<AppRouteHandler<ListRoute>>[0]) => {
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
    conditions.push(eq(appUsers.currentVersion, query.version));
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(appUsers.deviceId, `%${query.search}%`),
        ilike(appUsers.userId || "", `%${query.search}%`),
      )!,
    );
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(appUsers).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表
  const items = await db.query.appUsers.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(appUsers.lastUpdateAt)],
  });

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
      currentVersion: item.currentVersion || undefined,
      lastUpdateAt: item.lastUpdateAt || undefined,
      deviceInfo,
      status: item.status,
    };
  });

  // 获取统计信息
  const allUsers = await db.query.appUsers.findMany({
    where: eq(appUsers.appId, appId),
    columns: { status: true, currentVersion: true },
  });

  const stats = {
    total: allUsers.length,
    online: allUsers.filter(u => u.status === "online").length,
    offline: allUsers.filter(u => u.status === "offline").length,
    versions: new Set(allUsers.map(u => u.currentVersion).filter(Boolean)).size,
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
};

export const getOne = async (c: Parameters<AppRouteHandler<GetOneRoute>>[0]) => {
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
  const updateHistory = user.lastUpdateAt ? [{
    version: user.currentVersion || "",
    updatedAt: user.lastUpdateAt,
    status: "success",
  }] : [];

  return successResponse(c, {
    id: user.id,
    deviceId: user.deviceId,
    userId: user.userId || undefined,
    currentVersion: user.currentVersion || undefined,
    lastUpdateAt: user.lastUpdateAt || undefined,
    deviceInfo,
    status: user.status,
    updateHistory,
  });
};

export const updateVersion = async (c: Parameters<AppRouteHandler<UpdateVersionRoute>>[0]) => {
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
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: data.versionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify([id]),
    createdBy: userPayload.userId,
  }).returning();

  return successResponse(c, {
    taskId: task.id,
    status: task.status,
  });
};

export const batchUpdate = async (c: Parameters<AppRouteHandler<BatchUpdateRoute>>[0]) => {
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
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: data.versionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify(data.userIds),
    createdBy: userPayload.userId,
  }).returning();

  return successResponse(c, {
    taskId: task.id,
    affectedCount: data.userIds.length,
  });
};

export const rollback = async (c: Parameters<AppRouteHandler<RollbackRoute>>[0]) => {
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
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: data.toVersionId,
    type: "targeted",
    status: "pending",
    targetUserIds: JSON.stringify([id]),
    createdBy: userPayload.userId,
  }).returning();

  return successResponse(c, {
    taskId: task.id,
  });
};

