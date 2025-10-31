import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import db from "@/db";
import { users, userApps } from "@/db/schema";
import { generateToken, generateTokenPair, verifyToken, verifyPassword } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/response";
import type { AppRouteHandler } from "@/lib/types";

import type { GetMeRoute, LoginRoute, LogoutRoute, RefreshRoute } from "./auth.routes";

export const login = async (c: Parameters<AppRouteHandler<LoginRoute>>[0]) => {
  const { email, password } = c.req.valid("json");

  // 查找用户
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      apps: {
        with: {
          app: true,
        },
      },
    },
  });

  if (!user) {
    return errorResponse(
      c,
      "AUTH_INVALID",
      "邮箱或密码错误",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  // 验证密码
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return errorResponse(
      c,
      "AUTH_INVALID",
      "邮箱或密码错误",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  // 检查用户状态
  if (user.status !== "active") {
    return errorResponse(
      c,
      "AUTH_INVALID",
      "用户已被禁用",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  // 更新最后登录时间
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  // 生成Token
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // 获取用户关联的应用ID
  const appIds = user.apps.map((ua: { appId: string }) => ua.appId);

  return successResponse(c, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || undefined,
    },
    appIds,
  });
};

export const logout = async (c: Parameters<AppRouteHandler<LogoutRoute>>[0]) => {
  // 客户端删除Token即可，服务端可以记录日志
  return successResponse(c, null, "登出成功");
};

export const getMe = async (c: Parameters<AppRouteHandler<GetMeRoute>>[0]) => {
  const userPayload = c.get("user");
  if (!userPayload) {
    return errorResponse(
      c,
      "AUTH_REQUIRED",
      "需要认证",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  // 查找用户及其关联的应用
  const user = await db.query.users.findFirst({
    where: eq(users.id, userPayload.userId),
    with: {
      apps: true,
    },
  });

  if (!user) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "用户不存在",
      undefined,
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const appIds = user.apps.map((ua: { appId: string }) => ua.appId);

  return successResponse(c, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || undefined,
    appIds,
  });
};

export const refresh = async (c: Parameters<AppRouteHandler<RefreshRoute>>[0]) => {
  const { refreshToken } = c.req.valid("json");

  try {
    // 验证refreshToken
    const payload = verifyToken(refreshToken);

    // 查找用户
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || user.status !== "active") {
      return errorResponse(
        c,
        "AUTH_INVALID",
        "Token无效",
        undefined,
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    // 生成新的accessToken
    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateToken(newPayload);
    const expiresIn = 3600; // 1小时

    return successResponse(c, {
      accessToken,
      expiresIn,
    });
  }
  catch (error) {
    return errorResponse(
      c,
      "AUTH_EXPIRED",
      "Token已过期",
      undefined,
      HttpStatusCodes.UNAUTHORIZED,
    );
  }
};

