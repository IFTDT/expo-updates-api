import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

const tags = ["Expo Updates"];

// ==================== Manifest 路由 ====================
export const manifestRoute = createRoute({
  method: "get",
  path: "/api/expo-updates/manifest",
  tags,
  summary: "获取更新清单",
  description: "返回 Expo 应用的更新清单，包含资源元数据和启动资源",
  request: {
    headers: z.object({
      "expo-protocol-version": z.string().optional().openapi({
        description: "Expo 协议版本",
        example: "1",
      }),
      "expo-platform": z.enum(["ios", "android"]).openapi({
        description: "平台类型",
        example: "ios",
      }),
      "expo-runtime-version": z.string().openapi({
        description: "运行时版本",
        example: "1.0.0",
      }),
      "expo-current-update-id": z.string().optional().openapi({
        description: "当前更新 ID",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
      "expo-embedded-update-id": z.string().optional().openapi({
        description: "嵌入更新 ID",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
      "expo-expect-signature": z.string().optional().openapi({
        description: "是否期望签名",
        example: "true",
      }),
      "x-app-id": z.string().optional().openapi({
        description: "应用包名(如 com.example.app)",
        example: "com.example.app",
      }),
      "x-device-id": z.string().optional().openapi({
        description: "设备 ID",
        example: "device-123456",
      }),
      "x-user-id": z.string().optional().openapi({
        description: "用户 ID(可选)",
        example: "user-123456",
      }),
    }),
    query: z.object({
      "app-id": z.string().optional().openapi({
        description: "应用包名(如 com.example.app)，如果 Header 中未提供",
        example: "com.example.app",
      }),
      "device-id": z.string().optional().openapi({
        description: "设备 ID，如果 Header 中未提供",
        example: "device-123456",
      }),
      "user-id": z.string().optional().openapi({
        description: "用户 ID(可选)，如果 Header 中未提供",
        example: "user-123456",
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "更新清单（multipart/mixed 响应）",
      content: {
        "multipart/mixed": {
          schema: z.object({}),
        },
      },
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "请求参数错误",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "未找到更新",
    ),
    [HttpStatusCodes.METHOD_NOT_ALLOWED]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "不支持的请求方法",
    ),
  },
});

// ==================== Assets 路由 ====================
export const assetsRoute = createRoute({
  method: "get",
  path: "/api/expo-updates/assets",
  tags,
  summary: "获取资源文件",
  description: "返回单个资源文件（JavaScript bundle 或资源）",
  request: {
    query: z.object({
      "asset": z.string().openapi({
        description: "资源路径",
        example: "updates/com.example.app/1.0.0/1234567890/bundles/ios-main.js",
      }),
      "runtimeVersion": z.string().openapi({
        description: "运行时版本",
        example: "1.0.0",
      }),
      "platform": z.enum(["ios", "android"]).openapi({
        description: "平台类型",
        example: "ios",
      }),
      "app-id": z.string().optional().openapi({
        description: "应用包名(如 com.example.app)",
        example: "com.example.app",
      }),
      "device-id": z.string().optional().openapi({
        description: "设备 ID",
        example: "device-123456",
      }),
      "user-id": z.string().optional().openapi({
        description: "用户 ID(可选)",
        example: "user-123456",
      }),
    }),
    headers: z.object({
      "x-app-id": z.string().optional().openapi({
        description: "应用包名(如 com.example.app)",
        example: "com.example.app",
      }),
      "x-device-id": z.string().optional().openapi({
        description: "设备 ID",
        example: "device-123456",
      }),
      "x-user-id": z.string().optional().openapi({
        description: "用户 ID(可选)",
        example: "user-123456",
      }),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: {
      description: "资源文件内容",
      content: {
        "application/javascript": {
          schema: z.string(),
        },
        "image/png": {
          schema: z.string(),
        },
        "application/octet-stream": {
          schema: z.string(),
        },
      },
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "请求参数错误",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "资源不存在",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "服务器错误",
    ),
  },
});
