import { and, count, desc, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, versions, users, appUsers, updateTasks } from "@/db/schema";
import { paginationResponse, errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { CreateRoute, GetOneRoute, ListRoute, PublishRoute, RemoveRoute, RollbackRoute } from "./versions.routes";

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
  const conditions = [eq(versions.appId, appId)];

  if (query.status) {
    conditions.push(eq(versions.status, query.status));
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(versions).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表（简化排序，默认按创建时间倒序）
  const items = await db.query.versions.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(versions.createdAt)],
    with: {
      publisher: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 获取每个版本的用户数
  const formattedItems = await Promise.all(items.map(async (item) => {
    // 统计使用该版本的用户数
    const userCount = await db.query.appUsers.findMany({
      where: eq(appUsers.currentVersion, item.version),
      columns: { id: true },
    });

    return {
      id: item.id,
      version: item.version,
      name: item.name,
      description: item.description,
      status: item.status,
      fileUrl: item.fileUrl,
      fileSize: item.fileSize,
      checksum: item.checksum,
      isMandatory: item.isMandatory,
      publishedAt: item.publishedAt || undefined,
      publishedBy: item.publishedBy || undefined,
      publisher: item.publisher ? {
        id: item.publisher.id,
        name: item.publisher.name,
      } : undefined,
      userCount: userCount.length,
      createdAt: item.createdAt,
    };
  }));

  return paginationResponse(c, formattedItems, page, limit, total);
};

export const getOne = async (c: Parameters<AppRouteHandler<GetOneRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");

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

  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
    with: {
      publisher: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 统计使用该版本的用户数
  const userCount = await db.query.appUsers.findMany({
    where: eq(appUsers.currentVersion, version.version),
    columns: { id: true },
  });

  return successResponse(c, {
    id: version.id,
    version: version.version,
    name: version.name,
    description: version.description,
    status: version.status,
    fileUrl: version.fileUrl,
    fileSize: version.fileSize,
    checksum: version.checksum,
    isMandatory: version.isMandatory,
    publishedAt: version.publishedAt || undefined,
    rolledBackAt: version.rolledBackAt || undefined,
    publishedBy: version.publishedBy || undefined,
    publisher: version.publisher ? {
      id: version.publisher.id,
      name: version.publisher.name,
    } : undefined,
    userCount: userCount.length,
    createdAt: version.createdAt,
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

  // 检查版本号是否已存在
  const existing = await db.query.versions.findFirst({
    where: and(eq(versions.appId, appId), eq(versions.version, data.version)),
  });

  if (existing) {
    return errorResponse(
      c,
      "VERSION_CONFLICT",
      "版本号已存在",
      { version: data.version },
      HttpStatusCodes.CONFLICT,
    );
  }

  // 创建版本
  const publishedAt = data.publishTime === "now" ? new Date() : (data.scheduledAt ? new Date(data.scheduledAt) : null);
  const status = publishedAt ? "published" : "draft";

  const [newVersion] = await db.insert(versions).values({
    appId,
    version: data.version,
    name: data.name,
    description: data.description,
    status,
    fileUrl: data.fileUrl,
    fileSize: data.fileSize,
    checksum: data.checksum,
    isMandatory: data.isMandatory,
    publishedAt,
    publishedBy: publishedAt ? userPayload.userId : undefined,
  }).returning();

  // 如果立即发布，创建更新任务
  let taskId: string | undefined;
  if (status === "published") {
    const [task] = await db.insert(updateTasks).values({
      appId,
      versionId: newVersion.id,
      type: "full",
      status: "pending",
      createdBy: userPayload.userId,
    }).returning();
    taskId = task.id;
  }

  // 更新应用的当前版本
  await db.update(apps)
    .set({ currentVersion: data.version, updatedAt: new Date() })
    .where(eq(apps.id, appId));

  return successResponse(
    c,
    {
      id: newVersion.id,
      version: newVersion.version,
      status: newVersion.status,
      publishedAt: newVersion.publishedAt || undefined,
      taskId,
    },
    "版本创建成功",
    HttpStatusCodes.CREATED,
  );
};

export const publish = async (c: Parameters<AppRouteHandler<PublishRoute>>[0]) => {
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

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  if (version.status === "published") {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "版本已发布",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 更新版本状态
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  await db.update(versions)
    .set({
      status: "published",
      publishedAt: scheduledAt || new Date(),
      publishedBy: userPayload.userId,
      updatedAt: new Date(),
    })
    .where(eq(versions.id, id));

  // 创建更新任务
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: id,
    type: data.type,
    status: scheduledAt ? "pending" : "pending",
    scheduledAt,
    targetUserIds: data.targetUserIds.length > 0 ? JSON.stringify(data.targetUserIds) : undefined,
    targetGroupIds: data.targetGroupIds.length > 0 ? JSON.stringify(data.targetGroupIds) : undefined,
    createdBy: userPayload.userId,
  }).returning();

  // 更新应用的当前版本
  await db.update(apps)
    .set({ currentVersion: version.version, updatedAt: new Date() })
    .where(eq(apps.id, appId));

  return successResponse(c, {
    taskId: task.id,
    status: task.status,
  }, "发布任务已创建");
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

  // 验证当前版本
  const currentVersion = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!currentVersion) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 验证目标版本
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

  // 更新当前版本状态为已回滚
  await db.update(versions)
    .set({
      status: "rolled_back",
      rolledBackAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(versions.id, id));

  // 创建回滚任务
  const [task] = await db.insert(updateTasks).values({
    appId,
    versionId: data.toVersionId,
    type: data.type,
    status: "pending",
    targetUserIds: data.targetUserIds.length > 0 ? JSON.stringify(data.targetUserIds) : undefined,
    targetGroupIds: data.targetGroupIds.length > 0 ? JSON.stringify(data.targetGroupIds) : undefined,
    createdBy: userPayload.userId,
  }).returning();

  // 更新应用的当前版本为目标版本
  await db.update(apps)
    .set({ currentVersion: toVersion.version, updatedAt: new Date() })
    .where(eq(apps.id, appId));

  return successResponse(c, {
    taskId: task.id,
    status: task.status,
  }, "回滚任务已创建");
};

export const remove = async (c: Parameters<AppRouteHandler<RemoveRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 只能删除草稿版本
  if (version.status !== "draft") {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "只能删除草稿版本",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 删除版本
  await db.delete(versions)
    .where(eq(versions.id, id));

  return successResponse(c, null, "版本删除成功");
};

