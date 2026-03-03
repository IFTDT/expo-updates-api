import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

import { notFoundSchema } from "@/lib/constants";
import { paginationQuerySchema, sortQuerySchema } from "@/lib/pagination";
import { AppIdParamsSchema, AppIdVersionIdParamsSchema } from "@/lib/schemas";

const tags = ["Versions"];

// ==================== 获取版本列表 ====================
export const list = createRoute({
  path: "/api/apps/{appId}/versions",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      ...paginationQuerySchema.shape,
      status: z.enum(["draft", "published", "rolled_back"]).optional(),
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
            version: z.string(),
            build: z.string(),
            runtimeVersion: z.string(),
            name: z.string(),
            description: z.string().nullable().optional(),
            status: z.string(),
            fileUrl: z.string(),
            fileSize: z.number(),
            checksum: z.string(),
            isMandatory: z.boolean(),
            publishedAt: z.date().nullable().optional(),
            publishedBy: z.string().nullable().optional(),
            publisher: z.object({
              id: z.string(),
              name: z.string(),
            }).optional(),
            userCount: z.number().optional(),
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

// ==================== 获取版本详情 ====================
export const getOne = createRoute({
  path: "/api/apps/{appId}/versions/{id}",
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
          version: z.string(),
          build: z.string(),
          runtimeVersion: z.string(),
          name: z.string(),
          description: z.string().nullable().optional(),
          status: z.string(),
          fileUrl: z.string(),
          fileSize: z.number(),
          checksum: z.string(),
          isMandatory: z.boolean(),
          publishedAt: z.date().nullable().optional(),
          rolledBackAt: z.date().nullable().optional(),
          publishedBy: z.string().nullable().optional(),
          publisher: z.object({
            id: z.string(),
            name: z.string(),
          }).optional(),
          userCount: z.number().optional(),
          createdAt: z.date(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "版本不存在"),
  },
});

// ==================== 创建新版本 ====================
export const create = createRoute({
  path: "/api/apps/{appId}/versions",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            version: z.string().min(1, "版本号不能为空"),
            build: z.string().min(1, "构建号不能为空"),
            runtimeVersion: z.string().min(1, "Runtime 版本不能为空"),
            name: z.string().min(1, "版本名称不能为空"),
            description: z.string().optional(),
            isMandatory: z.string().optional().openapi({
              enum: ["true", "false"],
              example: "false",
              description: "是否为强制更新，true/false",
            }),
            uploadToOss: z.string().optional().openapi({
              enum: ["true", "false"],
              example: "false",
              description: "是否上传解压后的文件到 OSS，true/false",
            }),
            publishTime: z.enum(["now", "scheduled"]).default("now"),
            scheduledAt: z.string().datetime().optional(),
            file: z.instanceof(File).openapi({
              type: "string",
              format: "binary",
            }),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          version: z.string(),
          status: z.string(),
          publishedAt: z.date().nullable().optional(),
          uploadId: z.string(),
          taskId: z.string().optional(),
        }),
        message: z.string(),
      }),
      "创建成功",
    ),
  },
});

// ==================== 通过已存在文件创建版本 ====================
export const createFromUrl = createRoute({
  path: "/api/apps/{appId}/versions/by-url",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        version: z.string().min(1, "版本号不能为空"),
        build: z.string().min(1, "构建号不能为空"),
        runtimeVersion: z.string().min(1, "Runtime 版本不能为空"),
        name: z.string().min(1, "版本名称不能为空"),
        description: z.string().optional(),
        isMandatory: z.boolean().default(false),
        fileUrl: z.string().url("文件URL格式不正确"),
        fileSize: z.number().int().positive("文件大小必须大于0"),
        checksum: z.string().min(1, "校验和不能为空"),
        publishTime: z.enum(["now", "scheduled"]).default("now"),
        scheduledAt: z.string().datetime().optional(),
      }),
      "通过已存在文件创建版本请求",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          version: z.string(),
          status: z.string(),
          publishedAt: z.date().nullable().optional(),
          taskId: z.string().optional(),
        }),
        message: z.string(),
      }),
      "创建成功",
    ),
  },
});

// ==================== 发布版本 ====================
export const publish = createRoute({
  path: "/api/apps/{appId}/versions/{id}/publish",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        type: z.enum(["full", "targeted"]).default("full"),
        targetUserIds: z.array(z.string()).default([]),
        targetGroupIds: z.array(z.string()).default([]),
        scheduledAt: z.string().datetime().nullable().optional(),
      }),
      "发布版本请求",
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
        message: z.string(),
      }),
      "发布任务已创建",
    ),
  },
});

// ==================== 回滚版本 ====================
export const rollback = createRoute({
  path: "/api/apps/{appId}/versions/{id}/rollback",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdVersionIdParamsSchema,
    body: jsonContentRequired(
      z.object({
        toVersionId: z.string().min(1, "目标版本ID不能为空"),
        type: z.enum(["full", "targeted"]).default("full"),
        reason: z.string().optional(),
        targetUserIds: z.array(z.string()).default([]),
        targetGroupIds: z.array(z.string()).default([]),
      }),
      "回滚版本请求",
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
        message: z.string(),
      }),
      "回滚任务已创建",
    ),
  },
});

// ==================== 删除草稿版本 ====================
export const remove = createRoute({
  path: "/api/apps/{appId}/versions/{id}",
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "版本不存在"),
  },
});

export type ListRoute = typeof list;
export type GetOneRoute = typeof getOne;
export type CreateRoute = typeof create;
export type CreateFromUrlRoute = typeof createFromUrl;
export type PublishRoute = typeof publish;
export type RollbackRoute = typeof rollback;
export type RemoveRoute = typeof remove;
