import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, userApps, versions, appUsers } from "@/db/schema";
import { paginationResponse, errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { CreateRoute, GetOneRoute, ListRoute, UpdateRoute } from "./apps.routes";

export const list = async (c: Parameters<AppRouteHandler<ListRoute>>[0]) => {
  const query = c.req.valid("query");
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

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

  // 构建查询条件
  const conditions = [];

  // 如果不是管理员，只能查看自己关联的应用
  if (userPayload.role !== "admin") {
    const userAppIds = await db.query.userApps.findMany({
      where: eq(userApps.userId, userPayload.userId),
      columns: { appId: true },
    });
    const appIds = userAppIds.map(ua => ua.appId);
    if (appIds.length === 0) {
      return paginationResponse(c, [], page, limit, 0);
    }
    conditions.push(inArray(apps.id, appIds));
  }

  if (query.status) {
    conditions.push(eq(apps.status, query.status));
  }

  if (query.search) {
    conditions.push(ilike(apps.name, `%${query.search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(apps).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表（简化排序，默认按更新时间倒序）
  const items = await db.query.apps.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(apps.updatedAt)],
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
        },
      },
      versions: {
        columns: { id: true },
      },
      appUsers: {
        columns: { id: true },
      },
    },
  });

  // 格式化响应
  const formattedItems = items.map((item) => {
    return {
      id: item.id,
      name: item.name,
      icon: item.icon,
      appId: item.appId,
      description: item.description,
      status: item.status,
      currentVersion: item.currentVersion,
      userCount: item.appUsers?.length || 0,
      updateCount: item.versions?.length || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ownerId: item.ownerId,
      owner: item.owner ? {
        id: item.owner.id,
        name: item.owner.name,
      } : undefined,
    };
  });

  return paginationResponse(c, formattedItems, page, limit, total);
};

export const getOne = async (c: Parameters<AppRouteHandler<GetOneRoute>>[0]) => {
  const { id } = c.req.valid("param");

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      versions: {
        columns: { id: true },
      },
      appUsers: {
        columns: { id: true },
      },
    },
  });

  if (!app) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "应用不存在",
      { resource: "app", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return successResponse(c, {
    id: app.id,
    name: app.name,
    icon: app.icon,
    appId: app.appId,
    description: app.description,
    status: app.status,
    currentVersion: app.currentVersion,
    userCount: app.appUsers?.length || 0,
    updateCount: app.versions?.length || 0,
    versions: app.versions?.length || 0,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    ownerId: app.ownerId,
    owner: app.owner ? {
      id: app.owner.id,
      name: app.owner.name,
      email: app.owner.email,
    } : undefined,
  });
};

export const create = async (c: Parameters<AppRouteHandler<CreateRoute>>[0]) => {
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

  // 检查appId是否已存在
  const existing = await db.query.apps.findFirst({
    where: eq(apps.appId, data.appId),
  });

  if (existing) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "应用ID已存在",
      { field: "appId" },
      HttpStatusCodes.UNPROCESSABLE_ENTITY,
    );
  }

  // 创建应用
  const [newApp] = await db.insert(apps).values({
    name: data.name,
    appId: data.appId,
    description: data.description,
    icon: data.icon,
    ownerId: userPayload.userId,
    status: "active",
  }).returning();

  // 创建用户应用关联（应用创建者自动关联）
  await db.insert(userApps).values({
    userId: userPayload.userId,
    appId: newApp.id,
  });

  return successResponse(
    c,
    {
      id: newApp.id,
      name: newApp.name,
      appId: newApp.appId,
      status: newApp.status,
      createdAt: newApp.createdAt,
    },
    undefined,
    HttpStatusCodes.CREATED,
  );
};

export const update = async (c: Parameters<AppRouteHandler<UpdateRoute>>[0]) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, id),
  });

  if (!app) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "应用不存在",
      { resource: "app", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 更新应用
  const [updatedApp] = await db.update(apps)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, id))
    .returning();

  return successResponse(c, {
    id: updatedApp.id,
    name: updatedApp.name,
    updatedAt: updatedApp.updatedAt,
  });
};

