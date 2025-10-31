import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { paginationQuerySchema } from "@/lib/pagination";
import { notFoundSchema } from "@/lib/constants";
import { StringIdParamsSchema } from "@/lib/schemas";

const tags = ["PlatformUsers"];

// ==================== 获取平台用户列表 ====================
export const list = createRoute({
  path: "/api/users",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      ...paginationQuerySchema.shape,
      search: z.string().optional(),
      role: z.string().optional(),
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
            name: z.string(),
            email: z.string(),
            role: z.string(),
            status: z.string(),
            createdAt: z.date(),
            lastLoginAt: z.date().nullable().optional(),
            appIds: z.array(z.string()),
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

// ==================== 创建平台用户 ====================
export const create = createRoute({
  path: "/api/users",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1, "用户名不能为空"),
        email: z.string().email("邮箱格式不正确"),
        password: z.string().min(6, "密码至少6位"),
        role: z.enum(["admin", "app_manager", "viewer"]).default("app_manager"),
        appIds: z.array(z.string()).default([]),
      }),
      "创建用户请求",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          status: z.string(),
        }),
      }),
      "创建成功",
    ),
  },
});

// ==================== 更新平台用户 ====================
export const update = createRoute({
  path: "/api/users/{id}",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1).optional(),
        role: z.enum(["admin", "app_manager", "viewer"]).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        appIds: z.array(z.string()).optional(),
      }),
      "更新用户请求",
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户不存在"),
  },
});

// ==================== 删除平台用户 ====================
export const remove = createRoute({
  path: "/api/users/{id}",
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
        message: z.string(),
      }),
      "删除成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户不存在"),
  },
});

// ==================== 重置用户密码 ====================
export const resetPassword = createRoute({
  path: "/api/users/{id}/reset-password",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        newPassword: z.string().min(6, "密码至少6位"),
      }),
      "重置密码请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        message: z.string(),
      }),
      "密码重置成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户不存在"),
  },
});

// ==================== 启用/禁用用户 ====================
export const toggleStatus = createRoute({
  path: "/api/users/{id}/toggle-status",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: StringIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        status: z.enum(["active", "inactive"]),
      }),
      "切换状态请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          status: z.string(),
        }),
      }),
      "状态更新成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户不存在"),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type UpdateRoute = typeof update;
export type RemoveRoute = typeof remove;
export type ResetPasswordRoute = typeof resetPassword;
export type ToggleStatusRoute = typeof toggleStatus;

