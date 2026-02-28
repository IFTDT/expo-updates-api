import { and, count, desc, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, updateTasks, versions } from "@/db/schema";
import { errorResponse, paginationResponse, successResponse } from "@/lib/response";

import type { CreateRoute, GetOneRoute, ListRoute } from "./update-tasks.routes";

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
  const conditions = [eq(updateTasks.appId, appId)];

  if (query.status) {
    conditions.push(eq(updateTasks.status, query.status));
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(updateTasks).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表
  const items = await db.query.updateTasks.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(updateTasks.createdAt)],
    with: {
      version: {
        columns: {
          id: true,
          version: true,
        },
      },
    },
  });

  // 格式化响应
  const formattedItems = items.map((item) => {
    return {
      id: item.id,
      appId: item.appId,
      versionId: item.versionId,
      version: item.version
        ? {
            id: item.version.id,
            version: item.version.version,
          }
        : undefined,
      type: item.type,
      status: item.status,
      scheduledAt: item.scheduledAt || undefined,
      startedAt: item.startedAt || undefined,
      completedAt: item.completedAt || undefined,
      successCount: item.successCount || 0,
      failureCount: item.failureCount || 0,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
    };
  });

  return paginationResponse(c, formattedItems, page, limit, total);
}

export async function getOne(c: Parameters<AppRouteHandler<GetOneRoute>>[0]) {
  const { appId, id } = c.req.valid("param");

  // 验证任务是否存在
  const task = await db.query.updateTasks.findFirst({
    where: and(eq(updateTasks.id, id), eq(updateTasks.appId, appId)),
  });

  if (!task) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "任务不存在",
      { resource: "task", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 解析details
  let details: Record<string, unknown> | undefined;
  if (task.targetUserIds || task.targetGroupIds) {
    details = {
      total: (task.successCount || 0) + (task.failureCount || 0),
      processed: (task.successCount || 0) + (task.failureCount || 0),
      failed: [],
    };
  }

  return successResponse(c, {
    id: task.id,
    appId: task.appId,
    versionId: task.versionId,
    type: task.type,
    status: task.status,
    successCount: task.successCount || 0,
    failureCount: task.failureCount || 0,
    progress: task.progress || 0,
    details,
    createdAt: task.createdAt,
  });
}

export async function create(c: Parameters<AppRouteHandler<CreateRoute>>[0]) {
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
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: data.versionId,
    type: data.type,
    status: scheduledAt ? "pending" : "pending",
    scheduledAt,
    targetUserIds: data.targetUserIds.length > 0 ? JSON.stringify(data.targetUserIds) : undefined,
    targetGroupIds: data.targetGroupIds.length > 0 ? JSON.stringify(data.targetGroupIds) : undefined,
    createdBy: userPayload.userId,
  }).returning();

  return successResponse(
    c,
    {
      id: task.id,
      status: task.status,
    },
    undefined,
    HttpStatusCodes.CREATED,
  );
}
