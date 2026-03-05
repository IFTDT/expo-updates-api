import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, operationLogs, users } from "@/db/schema";
import { paginationResponse, errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { ExportLogsRoute, GetOneRoute, ListRoute } from "./logs.routes";

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
  const conditions = [eq(operationLogs.appId, appId)];

  if (query.type) {
    conditions.push(eq(operationLogs.type, query.type));
  }

  if (query.status) {
    conditions.push(eq(operationLogs.status, query.status));
  }

  if (query.userId) {
    conditions.push(eq(operationLogs.userId, query.userId));
  }

  if (query.startDate) {
    conditions.push(gte(operationLogs.createdAt, new Date(query.startDate)));
  }

  if (query.endDate) {
    conditions.push(lte(operationLogs.createdAt, new Date(query.endDate)));
  }

  if (query.search) {
    const searchPattern = `%${query.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${operationLogs.action}) LIKE ${searchPattern}`,
        sql`LOWER(${operationLogs.type}) LIKE ${searchPattern}`,
      )!,
    );
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(operationLogs).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表
  const items = await db.query.operationLogs.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(operationLogs.createdAt)],
  });

  const userIds = items.map(item => item.userId);
  const userRows = userIds.length > 0
    ? await db.query.users.findMany({
        where: inArray(users.id, userIds),
        columns: { id: true, name: true },
      })
    : [];
  const userMap = new Map(userRows.map(u => [u.id, u]));

  // 格式化响应
  const formattedItems = items.map((item) => {
    let details: Record<string, unknown> | undefined;
    if (item.details) {
      try {
        details = JSON.parse(item.details);
      }
      catch {
        details = undefined;
      }
    }

    return {
      id: item.id,
      type: item.type,
      action: item.action,
      targetId: item.targetId || undefined,
      targetType: item.targetType || undefined,
      status: item.status,
      details,
      userId: item.userId,
      user: userMap.get(item.userId) ? {
        id: userMap.get(item.userId)!.id,
        name: userMap.get(item.userId)!.name,
      } : undefined,
      createdAt: item.createdAt,
    };
  });

  return paginationResponse(c, formattedItems, page, limit, total);
};

export const getOne = async (c: Parameters<AppRouteHandler<GetOneRoute>>[0]) => {
  const { appId, id } = c.req.valid("param");

  // 验证日志是否存在
  const log = await db.query.operationLogs.findFirst({
    where: and(eq(operationLogs.id, id), eq(operationLogs.appId, appId)),
  });

  if (!log) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "日志不存在",
      { resource: "log", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, log.userId),
    columns: { id: true, name: true, email: true },
  });

  // 解析details
  let details: Record<string, unknown> | undefined;
  if (log.details) {
    try {
      details = JSON.parse(log.details);
    }
    catch {
      details = undefined;
    }
  }

  return successResponse(c, {
    id: log.id,
    type: log.type,
    action: log.action,
    targetId: log.targetId || undefined,
    targetType: log.targetType || undefined,
    status: log.status,
    details,
    userId: log.userId,
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
    } : undefined,
    createdAt: log.createdAt,
  });
};

export const exportLogs = async (c: Parameters<AppRouteHandler<ExportLogsRoute>>[0]) => {
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
  const conditions = [eq(operationLogs.appId, appId)];

  if (query.type) {
    conditions.push(eq(operationLogs.type, query.type));
  }

  if (query.status) {
    conditions.push(eq(operationLogs.status, query.status));
  }

  if (query.startDate) {
    conditions.push(gte(operationLogs.createdAt, new Date(query.startDate)));
  }

  if (query.endDate) {
    conditions.push(lte(operationLogs.createdAt, new Date(query.endDate)));
  }

  const where = and(...conditions);

  // 获取所有日志
  const logs = await db.query.operationLogs.findMany({
    where,
    orderBy: [desc(operationLogs.createdAt)],
  });

  const exportUserIds = logs.map(log => log.userId);
  const exportUsers = exportUserIds.length > 0
    ? await db.query.users.findMany({
        where: inArray(users.id, exportUserIds),
        columns: { id: true, name: true, email: true },
      })
    : [];
  const exportUserMap = new Map(exportUsers.map(u => [u.id, u]));

  // 生成CSV或XLSX文件
  if (query.format === "csv") {
    const headers = ["ID", "类型", "操作", "目标ID", "目标类型", "状态", "操作人", "操作时间"];
    const rows = logs.map((log) => [
      log.id,
      log.type,
      log.action,
      log.targetId || "",
      log.targetType || "",
      log.status,
      exportUserMap.get(log.userId)?.name || "",
      log.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="logs_${appId}_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // 简化的导出响应（实际可以集成xlsx库）
  return errorResponse(
    c,
    "NOT_IMPLEMENTED",
    "XLSX导出功能暂未实现",
    undefined,
    HttpStatusCodes.NOT_IMPLEMENTED,
  );
};

