import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { users } from "@/db/schema";
import env from "@/env";
import { hashPassword } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/response";

import type { CreateAdminRoute } from "./admin.routes";

/**
 * 创建管理员账户
 * - 如果系统中没有管理员，可以直接创建第一个管理员
 * - 如果系统中已有管理员，需要提供管理密钥（通过环境变量 ADMIN_KEY 配置）
 */
export async function createAdmin(c: Parameters<AppRouteHandler<CreateAdminRoute>>[0]) {
  const data = c.req.valid("json");

  // 检查系统中是否已存在管理员
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
  });

  // 如果已有管理员，需要验证管理密钥
  if (existingAdmin) {
    // 从环境变量获取管理密钥
    // 如果没有配置 ADMIN_KEY，使用默认值（仅用于开发环境）
    const adminKey = env.ADMIN_KEY || "default-admin-key-change-in-production";

    if (!data.adminKey || data.adminKey !== adminKey) {
      return errorResponse(
        c,
        "PERMISSION_DENIED",
        "系统中已有管理员，创建新管理员需要提供有效的管理密钥",
        undefined,
        HttpStatusCodes.FORBIDDEN,
      );
    }
  }

  // 检查邮箱是否已存在
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (existingUser) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "邮箱已存在",
      { field: "email" },
      HttpStatusCodes.CONFLICT,
    );
  }

  // 加密密码
  const hashedPassword = await hashPassword(data.password);

  // 创建管理员用户
  const [{ id: newAdminId }] = await db.insert(users).values({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: "admin",
    status: "active",
  }).$returningId();

  const newAdmin = await db.query.users.findFirst({
    where: eq(users.id, newAdminId),
  });

  if (!newAdmin) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "管理员创建失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  return successResponse(
    c,
    {
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      status: newAdmin.status,
    },
    existingAdmin ? "管理员创建成功" : "第一个管理员账户创建成功",
    HttpStatusCodes.CREATED,
  );
}
