import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";

const tags = ["Auth"];

// ==================== 登录 ====================
export const login = createRoute({
  path: "/api/auth/login",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        email: z.string().email("邮箱格式不正确"),
        password: z.string().min(6, "密码至少6位"),
        rememberMe: z.boolean().default(false),
      }),
      "登录请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          accessToken: z.string(),
          refreshToken: z.string(),
          expiresIn: z.number(),
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            role: z.string(),
            avatar: z.string().nullable().optional(),
          }),
        }),
      }),
      "登录成功",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "认证失败",
    ),
  },
});

// ==================== 登出 ====================
export const logout = createRoute({
  path: "/api/auth/logout",
  method: "post",
  tags,
  security: [{ Bearer: [] }],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        message: z.string(),
      }),
      "登出成功",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "未认证",
    ),
  },
});

// ==================== 获取当前用户 ====================
export const getMe = createRoute({
  path: "/api/auth/me",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          avatar: z.string().nullable().optional(),
          appIds: z.array(z.string()),
        }),
      }),
      "获取成功",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "未认证",
    ),
  },
});

// ==================== 刷新Token ====================
export const refresh = createRoute({
  path: "/api/auth/refresh",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        refreshToken: z.string(),
      }),
      "刷新Token请求",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          accessToken: z.string(),
          expiresIn: z.number(),
        }),
      }),
      "刷新成功",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
      "Token无效",
    ),
  },
});

export type LoginRoute = typeof login;
export type LogoutRoute = typeof logout;
export type GetMeRoute = typeof getMe;
export type RefreshRoute = typeof refresh;
