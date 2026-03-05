import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { userApps, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { errorResponse, paginationResponse, successResponse } from "@/lib/response";

import type { CreateRoute, ListRoute, RemoveRoute, ResetPasswordRoute, ToggleStatusRoute, UpdateRoute } from "./platform-users.routes";

export async function list(c: Parameters<AppRouteHandler<ListRoute>>[0]) {
  const query = c.req.valid("query");
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const userPayload = c.get("user");
  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 构建查询条件
  const conditions = [];

  if (query.role) {
    conditions.push(eq(users.role, query.role));
  }

  if (query.status) {
    conditions.push(eq(users.status, query.status));
  }

  if (query.search) {
    // MySQL 不支持 ILIKE（PostgreSQL 特性），使用 LOWER() 函数实现不区分大小写搜索
    const searchPattern = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${users.name}) LIKE ${searchPattern}`,
        sql`LOWER(${users.email}) LIKE ${searchPattern}`,
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(users).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表
  const items = await db.query.users.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(users.createdAt)],
  });

  const userIds = items.map(item => item.id);
  const appRelations = userIds.length > 0
    ? await db.query.userApps.findMany({
        where: inArray(userApps.userId, userIds),
        columns: { userId: true, appId: true },
      })
    : [];
  const appIdsByUserId = new Map<string, string[]>();
  appRelations.forEach((relation) => {
    const list = appIdsByUserId.get(relation.userId) || [];
    list.push(relation.appId);
    appIdsByUserId.set(relation.userId, list);
  });

  // 格式化响应
  const formattedItems = items.map((item) => {
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      status: item.status,
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt || undefined,
      appIds: appIdsByUserId.get(item.id) || [],
    };
  });

  return paginationResponse(c, formattedItems, page, limit, total);
}

export async function create(c: Parameters<AppRouteHandler<CreateRoute>>[0]) {
  const data = c.req.valid("json");
  const userPayload = c.get("user");

  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 检查邮箱是否已存在
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (existing) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "邮箱已存在",
      { field: "email" },
      HttpStatusCodes.UNPROCESSABLE_ENTITY,
    );
  }

  // 加密密码
  const hashedPassword = await hashPassword(data.password);

  // 创建用户
  const [{ id: newUserId }] = await db.insert(users).values({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: data.role,
    status: "active",
  }).$returningId();

  const newUser = await db.query.users.findFirst({
    where: eq(users.id, newUserId),
  });

  if (!newUser) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "用户创建失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // 关联应用
  if (data.appIds.length > 0) {
    const userAppRecords = data.appIds.map(appId => ({
      userId: newUser.id,
      appId,
    }));

    await db.insert(userApps).values(userAppRecords);
  }

  return successResponse(
    c,
    {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    },
    undefined,
    HttpStatusCodes.CREATED,
  );
}

export async function update(c: Parameters<AppRouteHandler<UpdateRoute>>[0]) {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const userPayload = c.get("user");

  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 验证用户是否存在
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
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

  // 更新用户信息
  const updateData: Partial<typeof users.$inferInsert> = {};
  if (data.name)
    updateData.name = data.name;
  if (data.role)
    updateData.role = data.role;
  if (data.status)
    updateData.status = data.status;

  if (Object.keys(updateData).length > 0) {
    await db.update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  // 更新应用关联
  if (data.appIds !== undefined) {
    // 删除现有关联
    await db.delete(userApps)
      .where(eq(userApps.userId, id));

    // 添加新关联
    if (data.appIds.length > 0) {
      const userAppRecords = data.appIds.map(appId => ({
        userId: id,
        appId,
      }));

      await db.insert(userApps).values(userAppRecords);
    }
  }

  // 获取更新后的用户
  const updatedUser = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  return successResponse(c, {
    id: updatedUser!.id,
    name: updatedUser!.name,
    updatedAt: updatedUser!.updatedAt,
  });
}

export async function remove(c: Parameters<AppRouteHandler<RemoveRoute>>[0]) {
  const { id } = c.req.valid("param");
  const userPayload = c.get("user");

  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 不能删除自己
  if (id === userPayload.userId) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "不能删除自己",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 验证用户是否存在
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
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

  // 删除用户（级联删除关联）
  await db.delete(users)
    .where(eq(users.id, id));

  return successResponse(c, null, "用户删除成功");
}

export async function resetPassword(c: Parameters<AppRouteHandler<ResetPasswordRoute>>[0]) {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const userPayload = c.get("user");

  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 验证用户是否存在
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
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

  // 加密新密码
  const hashedPassword = await hashPassword(data.newPassword);

  // 更新密码
  await db.update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, id));

  return successResponse(c, null, "密码重置成功");
}

export async function toggleStatus(c: Parameters<AppRouteHandler<ToggleStatusRoute>>[0]) {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const userPayload = c.get("user");

  if (!userPayload || userPayload.role !== "admin") {
    return errorResponse(
      c,
      "PERMISSION_DENIED",
      "需要管理员权限",
      undefined,
      HttpStatusCodes.FORBIDDEN,
    );
  }

  // 不能禁用自己
  if (id === userPayload.userId && data.status === "inactive") {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "不能禁用自己",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 验证用户是否存在
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
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

  // 更新状态
  await db.update(users)
    .set({ status: data.status, updatedAt: new Date() })
    .where(eq(users.id, id));

  return successResponse(c, {
    id,
    status: data.status,
  });
}
