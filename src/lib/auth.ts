import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import env from "@/env";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 生成JWT Token
 */
export function generateToken(
  payload: JWTPayload,
  expiresIn?: string,
): string {
  // @ts-expect-error - jwt.sign类型定义问题，实际可以正常工作
  return jwt.sign(
    payload,
    env.JWT_SECRET,
    { expiresIn: expiresIn || env.JWT_EXPIRES_IN },
  );
}

/**
 * 生成Token对（accessToken + refreshToken）
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
  const accessToken = generateToken(payload, env.JWT_EXPIRES_IN);
  const refreshToken = generateToken(payload, env.JWT_REFRESH_EXPIRES_IN);
  const expiresIn = parseExpiresIn(env.JWT_EXPIRES_IN);

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * 验证Token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  }
  catch {
    throw new Error("Invalid or expired token");
  }
}

/**
 * 从请求头提取Token
 */
export function extractToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * 解析expiresIn字符串为秒数
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 3600; // 默认1小时
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 3600;
  }
}
