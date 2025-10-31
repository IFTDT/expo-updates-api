import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { notFoundSchema } from "@/lib/constants";
import { StringIdParamsSchema } from "@/lib/schemas";

const tags = ["Upload"];

// ==================== 上传更新包 ====================
export const upload = createRoute({
  path: "/api/upload",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.instanceof(File).openapi({
              type: "string",
              format: "binary",
            }),
            appId: z.string().min(1, "应用ID不能为空"),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          fileUrl: z.string(),
          fileSize: z.number(),
          checksum: z.string(),
          uploadId: z.string(),
        }),
      }),
      "上传成功",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "上传失败",
    ),
  },
});

// ==================== 查询上传进度 ====================
export const getProgress = createRoute({
  path: "/api/upload/{uploadId}/progress",
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
          uploadId: z.string(),
          progress: z.number(),
          status: z.string(),
          uploadedBytes: z.number(),
          totalBytes: z.number(),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "上传记录不存在"),
  },
});

export type UploadRoute = typeof upload;
export type GetProgressRoute = typeof getProgress;

