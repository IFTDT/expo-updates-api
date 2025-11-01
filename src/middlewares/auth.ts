import { createMiddleware } from "hono/factory";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppBindings } from "@/lib/types";

import { extractToken, verifyToken } from "@/lib/auth";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * JWT认证中间件
 */
export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  const token = extractToken(authorization);

  if (!token) {
    return c.json(
      {
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "需要认证，请提供有效的Token",
        },
      },
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  try {
    const payload = verifyToken(token);
    c.set("user", payload);
  }
  catch (error) {
    return c.json(
      {
        success: false,
        error: {
          code: "AUTH_INVALID",
          message: "Token无效或已过期",
        },
      },
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  await next();
});

/**
 * 权限检查中间件（需要管理员权限）
 */
export const adminMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get("user") as AuthPayload | undefined;

  if (!user || user.role !== "admin") {
    return c.json(
      {
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message: "需要管理员权限",
        },
      },
      HttpStatusCodes.FORBIDDEN,
    );
  }

  await next();
});

/**
 * 权限检查中间件（需要应用管理员权限）
 */
export const appManagerMiddleware = createMiddleware<AppBindings>(
  async (c, next) => {
    const user = c.get("user") as AuthPayload | undefined;

    if (!user || !["admin", "app_manager"].includes(user.role)) {
      return c.json(
        {
          success: false,
          error: {
            code: "PERMISSION_DENIED",
            message: "权限不足",
          },
        },
        HttpStatusCodes.FORBIDDEN,
      );
    }

    await next();
  },
);
