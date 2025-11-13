import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { paginationQuerySchema } from "@/lib/pagination";
import { notFoundSchema } from "@/lib/constants";
import { AppIdParamsSchema, AppIdVersionIdParamsSchema } from "@/lib/schemas";

const tags = ["AppUsers"];

// ==================== 获取用户列表 ====================
export const list = createRoute({
  path: "/api/apps/{appId}/users",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      ...paginationQuerySchema.shape,
      search: z.string().optional(),
      version: z.string().optional(),
      status: z.enum(["online", "offline"]).optional(),
      platform: z.enum(["ios", "android"]).optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          items: z.array(z.object({
            id: z.string(),
            deviceId: z.string(),
            userId: z.string().nullable().optional(),
            currentVersion: z.string().nullable().optional(),
            lastUpdateAt: z.date().nullable().optional(),
            deviceInfo: z.record(z.string(), z.unknown()).openapi({
              type: "object",
              additionalProperties: true,
            }).optional(),
            status: z.string(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
          stats: z.object({
            total: z.number(),
            online: z.number(),
            offline: z.number(),
            versions: z.number(),
          }),
        }),
      }),
      "获取成功",
    ),
  },
});

// ==================== 获取用户详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{appId}/users/{id}",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          deviceId: z.string(),
          userId: z.string().nullable().optional(),
          currentVersion: z.string().nullable().optional(),
          lastUpdateAt: z.date().nullable().optional(),
          deviceInfo: z.record(z.string(), z.unknown()).openapi({
            type: "object",
            additionalProperties: true,
          }).optional(),
          status: z.string(),
          updateHistory: z.array(z.object({
            version: z.string(),
            updatedAt: z.date(),
            status: z.string(),
          })),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户不存在"),
  },
});

// ==================== 更新用户版本 ====================
export const updateVersion = createRoute({
  path: "/api/apps/{appId}/users/{id}/update",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        versionId: z.string().min(1, "版本ID不能为空"),
        force: z.boolean().default(false),
      }),
      "更新用户版本请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          taskId: z.string(),
          status: z.string(),
        }),
      }),
      "更新任务已创建",
    ),
  },
});

// ==================== 批量更新用户 ====================
export const batchUpdate = createRoute({
  path: "/api/apps/{appId}/users/batch-update",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        userIds: z.array(z.string()).min(1, "至少选择一个用户"),
        versionId: z.string().min(1, "版本ID不能为空"),
      }),
      "批量更新用户请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          taskId: z.string(),
          affectedCount: z.number(),
        }),
      }),
      "批量更新任务已创建",
    ),
  },
});

// ==================== 回滚用户版本 ====================
export const rollback = createRoute({
  path: "/api/apps/{appId}/users/{id}/rollback",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        toVersionId: z.string().min(1, "目标版本ID不能为空"),
        reason: z.string().optional(),
      }),
      "回滚用户版本请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          taskId: z.string(),
        }),
      }),
      "回滚任务已创建",
    ),
  },
});

// ==================== 设置用户最新版本 ====================
export const setTargetVersion = createRoute({
  path: "/api/apps/{appId}/users/{id}/target-version",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        versionId: z.string().min(1, "版本ID不能为空"),
      }),
      "设置用户最新版本请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          targetVersionId: z.string().nullable(),
          updatedAt: z.date(),
        }),
      }),
      "设置成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户或版本不存在"),
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type UpdateVersionRoute = typeof updateVersion;
export type BatchUpdateRoute = typeof batchUpdate;
export type RollbackRoute = typeof rollback;
export type SetTargetVersionRoute = typeof setTargetVersion;

