import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { notFoundSchema } from "@/lib/constants";
import { AppIdParamsSchema, AppIdVersionIdParamsSchema } from "@/lib/schemas";

const tags = ["UserGroups"];

// ==================== 获取分组列表 ====================
export const list = createRoute({
  path: "/api/apps/{appId}/user-groups",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
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
            name: z.string(),
            description: z.string().nullable().optional(),
            userCount: z.number(),
            userIds: z.array(z.string()),
            createdAt: z.date(),
            updatedAt: z.date(),
            createdBy: z.string(),
          })),
        }),
      }),
      "获取成功",
    ),
  },
});

// ==================== 获取分组详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}",
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
          name: z.string(),
          description: z.string().nullable().optional(),
          userCount: z.number(),
          userIds: z.array(z.string()),
          users: z.array(z.object({
            id: z.string(),
            userId: z.string().nullable().optional(),
            deviceId: z.string(),
          })),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "分组不存在"),
  },
});

// ==================== 创建分组 ====================
export const create = createRoute({
  path: "/api/apps/{appId}/user-groups",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1, "分组名称不能为空"),
        description: z.string().optional(),
        userIds: z.array(z.string()).default([]),
      }),
      "创建分组请求",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          userCount: z.number(),
          createdAt: z.date(),
        }),
      }),
      "创建成功",
    ),
  },
});

// ==================== 更新分组 ====================
export const update = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        userIds: z.array(z.string()).optional(),
      }),
      "更新分组请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          userCount: z.number(),
          updatedAt: z.date(),
        }),
      }),
      "更新成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "分组不存在"),
  },
});

// ==================== 删除分组 ====================
export const remove = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}",
  method: "delete",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        message: z.string(),
      }),
      "删除成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "分组不存在"),
  },
});

// ==================== 添加用户到分组 ====================
export const addUsers = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}/users",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        userIds: z.array(z.string()).min(1, "至少选择一个用户"),
      }),
      "添加用户请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          addedCount: z.number(),
          userCount: z.number(),
        }),
      }),
      "添加成功",
    ),
  },
});

// ==================== 从分组移除用户 ====================
export const removeUsers = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}/users",
  method: "delete",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        userIds: z.array(z.string()).min(1, "至少选择一个用户"),
      }),
      "移除用户请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          removedCount: z.number(),
          userCount: z.number(),
        }),
      }),
      "移除成功",
    ),
  },
});

// ==================== 设置用户组最新版本 ====================
export const setTargetVersion = createRoute({
  path: "/api/apps/{appId}/user-groups/{id}/target-version",
  method: "put",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        versionId: z.string().min(1, "版本ID不能为空"),
      }),
      "设置用户组最新版本请求",
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "用户组或版本不存在"),
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type CreateRoute = typeof create;
export type UpdateRoute = typeof update;
export type RemoveRoute = typeof remove;
export type AddUsersRoute = typeof addUsers;
export type RemoveUsersRoute = typeof removeUsers;
export type SetTargetVersionRoute = typeof setTargetVersion;
