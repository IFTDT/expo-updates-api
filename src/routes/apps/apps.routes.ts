import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema } from "stoker/openapi/schemas";

import { notFoundSchema } from "@/lib/constants";
import { paginationQuerySchema, sortQuerySchema } from "@/lib/pagination";
import { StringIdParamsSchema } from "@/lib/schemas";

const tags = ["Apps"];

// ==================== 获取应用列表 ====================
export const list = createRoute({
  path: "/api/apps",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      ...paginationQuerySchema.shape,
      search: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      ...sortQuerySchema.shape,
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          items: z.array(z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string().nullable().optional(),
            appId: z.string(),
            description: z.string().nullable().optional(),
            status: z.string(),
            currentVersion: z.string().nullable().optional(),
            userCount: z.number().optional(),
            updateCount: z.number().optional(),
            createdAt: z.date(),
            updatedAt: z.date(),
            ownerId: z.string(),
            owner: z.object({
              id: z.string(),
              name: z.string(),
            }).optional(),
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

// ==================== 获取应用详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{id}",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          icon: z.string().nullable().optional(),
          appId: z.string(),
          description: z.string().nullable().optional(),
          status: z.string(),
          currentVersion: z.string().nullable().optional(),
          userCount: z.number().optional(),
          updateCount: z.number().optional(),
          versions: z.number().optional(),
          createdAt: z.date(),
          updatedAt: z.date(),
          ownerId: z.string(),
          owner: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          }).optional(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "应用不存在"),
  },
});

// ==================== 创建应用 ====================
export const create = createRoute({
  path: "/api/apps",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1, "应用名称不能为空"),
        appId: z.string().min(1, "应用ID不能为空"),
        description: z.string().optional(),
        icon: z.string().url().optional(),
      }),
      "创建应用请求",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          appId: z.string(),
          status: z.string(),
          createdAt: z.date(),
        }),
      }),
      "创建成功",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(StringIdParamsSchema),
      "验证失败",
    ),
  },
});

// ==================== 更新应用 ====================
export const update = createRoute({
  path: "/api/apps/{id}",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      }),
      "更新应用请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          updatedAt: z.date(),
        }),
      }),
      "更新成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "应用不存在"),
  },
});

// ==================== 删除应用 ====================
export const remove = createRoute({
  path: "/api/apps/{id}",
  method: "delete",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.null(),
        message: z.string(),
      }),
      "删除成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "应用不存在"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createErrorSchema(z.object({})),
      "权限不足",
    ),
  },
});

// ==================== 设置应用最新版本 ====================
export const setCurrentVersion = createRoute({
  path: "/api/apps/{id}/current-version",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        versionId: z.string().min(1, "版本ID不能为空"),
      }),
      "设置应用最新版本请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          currentVersionId: z.string().nullable(),
          updatedAt: z.date(),
        }),
      }),
      "设置成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "应用或版本不存在"),
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type CreateRoute = typeof create;
export type UpdateRoute = typeof update;
export type RemoveRoute = typeof remove;
export type SetCurrentVersionRoute = typeof setCurrentVersion;
