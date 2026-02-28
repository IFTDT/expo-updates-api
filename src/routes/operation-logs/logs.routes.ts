import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { paginationQuerySchema } from "@/lib/pagination";
import { notFoundSchema } from "@/lib/constants";
import { AppIdParamsSchema, AppIdVersionIdParamsSchema } from "@/lib/schemas";

const tags = ["Logs"];

// ==================== 获取操作日志 ====================
export const list = createRoute({
  path: "/api/apps/{appId}/logs",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      ...paginationQuerySchema.shape,
      type: z.string().optional(),
      status: z.enum(["success", "failed"]).optional(),
      userId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          items: z.array(z.object({
            id: z.string(),
            type: z.string(),
            action: z.string(),
            targetId: z.string().nullable().optional(),
            targetType: z.string().nullable().optional(),
            status: z.string(),
            details: z.record(z.string(), z.unknown()).openapi({
              type: "object",
              additionalProperties: true,
            }).optional(),
            userId: z.string(),
            user: z.object({
              id: z.string(),
              name: z.string(),
            }).optional(),
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

// ==================== 获取日志详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{appId}/logs/{id}",
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
          type: z.string(),
          action: z.string(),
          targetId: z.string().nullable().optional(),
          targetType: z.string().nullable().optional(),
          status: z.string(),
          details: z.record(z.string(), z.unknown()).openapi({
            type: "object",
            additionalProperties: true,
          }).optional(),
          userId: z.string(),
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          }).optional(),
          createdAt: z.date(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "日志不存在"),
  },
});

// ==================== 导出日志 ====================
export const exportLogs = createRoute({
  path: "/api/apps/{appId}/logs/export",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      format: z.enum(["csv", "xlsx"]).default("csv"),
      type: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "文件下载流",
      content: {
        "application/octet-stream": {
          schema: z.instanceof(Blob).openapi({
            type: "string",
            format: "binary",
          }),
        },
      },
    },
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type ExportLogsRoute = typeof exportLogs;

