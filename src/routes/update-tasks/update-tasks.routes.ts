import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { paginationQuerySchema } from "@/lib/pagination";
import { notFoundSchema } from "@/lib/constants";
import { AppIdParamsSchema, AppIdVersionIdParamsSchema, StringIdParamsSchema } from "@/lib/schemas";

const tags = ["UpdateTasks"];

// ==================== 获取更新任务列表 ====================
export const list = createRoute({
  path: "/api/apps/{appId}/update-tasks",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      ...paginationQuerySchema.shape,
      status: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          items: z.array(z.object({
            id: z.string(),
            appId: z.string(),
            versionId: z.string(),
            version: z.object({
              id: z.string(),
              version: z.string(),
            }).optional(),
            type: z.string(),
            status: z.string(),
            scheduledAt: z.date().nullable().optional(),
            startedAt: z.date().nullable().optional(),
            completedAt: z.date().nullable().optional(),
            successCount: z.number().optional(),
            failureCount: z.number().optional(),
            createdBy: z.string(),
            createdAt: z.date(),
          })),
          pagination: z.object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          }),
        }),
      }),
      "获取成功",
    ),
  },
});

// ==================== 获取任务详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{appId}/update-tasks/{id}",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      appId: z.string(),
      id: z.string(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          appId: z.string(),
          versionId: z.string(),
          type: z.string(),
          status: z.string(),
          successCount: z.number().optional(),
          failureCount: z.number().optional(),
          progress: z.number().optional(),
          details: z.record(z.string(), z.unknown()).openapi({
            type: "object",
            additionalProperties: true,
          }).optional(),
          createdAt: z.date(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "任务不存在"),
  },
});

// ==================== 创建更新任务 ====================
export const create = createRoute({
  path: "/api/apps/{appId}/update-tasks",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        versionId: z.string().min(1, "版本ID不能为空"),
        type: z.enum(["full", "targeted"]).default("full"),
        targetUserIds: z.array(z.string()).default([]),
        targetGroupIds: z.array(z.string()).default([]),
        scheduledAt: z.string().datetime().nullable().optional(),
      }),
      "创建更新任务请求",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          status: z.string(),
        }),
      }),
      "创建成功",
    ),
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type CreateRoute = typeof create;

