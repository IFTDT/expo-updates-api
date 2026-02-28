import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

const tags = ["Admin"];

// ==================== 创建管理员 ====================
export const createAdmin = createRoute({
  path: "/api/admin/create",
  method: "post",
  tags,
  summary: "创建管理员账户",
  description: "创建第一个管理员账户或通过密钥创建管理员（如果系统已有管理员，需要提供管理密钥）",
  request: {
    body: jsonContentRequired(
      z.object({
        name: z.string().min(1, "用户名不能为空"),
        email: z.string().email("邮箱格式不正确"),
        password: z.string().min(6, "密码至少6位"),
        adminKey: z.string().optional(), // 管理密钥，如果系统已有管理员则需要
      }),
      "创建管理员请求",
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
        message: z.string(),
      }),
      "管理员创建成功",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "请求错误",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "权限不足",
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "管理员已存在",
    ),
  },
});

export type CreateAdminRoute = typeof createAdmin;
