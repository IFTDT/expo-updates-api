import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { apps, appUsers, versions, updateTasks, operationLogs } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { GetAppStatsRoute, GetUpdateSuccessRateRoute, GetVersionDistributionRoute } from "./stats.routes";

export const getAppStats = async (c: Parameters<AppRouteHandler<GetAppStatsRoute>>[0]) => {
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

  // 构建时间范围条件
  const conditions = [eq(operationLogs.appId, appId)];
  if (query.startDate) {
    conditions.push(gte(operationLogs.createdAt, new Date(query.startDate)));
  }
  if (query.endDate) {
    conditions.push(lte(operationLogs.createdAt, new Date(query.endDate)));
  }
  const where = and(...conditions);

  // 获取所有用户
  const allUsers = await db.query.appUsers.findMany({
    where: eq(appUsers.appId, appId),
    columns: { currentVersion: true, status: true },
  });

  // 获取版本分布
  const versionCounts = new Map<string, number>();
  allUsers.forEach((user) => {
    if (user.currentVersion) {
      versionCounts.set(user.currentVersion, (versionCounts.get(user.currentVersion) || 0) + 1);
    }
  });

  const totalUsers = allUsers.length;
  const versionDistribution = Array.from(versionCounts.entries())
    .map(([version, count]) => ({
      version,
      count,
      percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 获取更新任务统计
  const tasks = await db.query.updateTasks.findMany({
    where: eq(updateTasks.appId, appId),
    columns: { status: true, successCount: true, failureCount: true },
  });

  const successCount = tasks.reduce((sum, task) => sum + (task.successCount || 0), 0);
  const failureCount = tasks.reduce((sum, task) => sum + (task.failureCount || 0), 0);
  const totalUpdates = successCount + failureCount;
  const updateSuccessRate = totalUpdates > 0 ? (successCount / totalUpdates) * 100 : 0;

  // 获取活跃版本数
  const activeVersions = await db.query.versions.findMany({
    where: and(eq(versions.appId, appId), eq(versions.status, "published")),
    columns: { id: true },
  });

  // 获取更新时间线（简化版）
  const updateTimeline: Array<{ date: string; count: number }> = [];
  // 实际可以从operationLogs按日期分组获取

  // 获取失败原因（简化版）
  const failureReasons: Array<{ reason: string; count: number }> = [];
  // 实际可以从任务详情或日志中提取

  return successResponse(c, {
    summary: {
      updateSuccessRate,
      successCount,
      failureCount,
      activeVersions: activeVersions.length,
      totalUpdates,
    },
    versionDistribution,
    updateTimeline,
    failureReasons,
  });
};

export const getVersionDistribution = async (c: Parameters<AppRouteHandler<GetVersionDistributionRoute>>[0]) => {
  const { appId } = c.req.valid("param");

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

  // 获取所有用户
  const allUsers = await db.query.appUsers.findMany({
    where: eq(appUsers.appId, appId),
    columns: { currentVersion: true },
  });

  // 统计版本分布
  const versionCounts = new Map<string, number>();
  allUsers.forEach((user) => {
    if (user.currentVersion) {
      versionCounts.set(user.currentVersion, (versionCounts.get(user.currentVersion) || 0) + 1);
    }
  });

  const totalUsers = allUsers.length;
  const distribution = Array.from(versionCounts.entries())
    .map(([version, count]) => ({
      version,
      count,
      percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return successResponse(c, distribution);
};

export const getUpdateSuccessRate = async (c: Parameters<AppRouteHandler<GetUpdateSuccessRateRoute>>[0]) => {
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
  const conditions = [eq(updateTasks.appId, appId)];
  if (query.startDate) {
    conditions.push(gte(updateTasks.createdAt, new Date(query.startDate)));
  }
  if (query.endDate) {
    conditions.push(lte(updateTasks.createdAt, new Date(query.endDate)));
  }
  const where = and(...conditions);

  // 获取更新任务统计
  const tasks = await db.query.updateTasks.findMany({
    where,
    columns: { successCount: true, failureCount: true },
  });

  const successCount = tasks.reduce((sum, task) => sum + (task.successCount || 0), 0);
  const failureCount = tasks.reduce((sum, task) => sum + (task.failureCount || 0), 0);
  const totalCount = successCount + failureCount;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  return successResponse(c, {
    successRate,
    successCount,
    failureCount,
    totalCount,
  });
};

