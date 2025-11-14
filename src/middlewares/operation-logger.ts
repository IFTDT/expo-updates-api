import { createMiddleware } from "hono/factory";

import type { AppBindings } from "@/lib/types";

import db from "@/db";
import { operationLogs } from "@/db/schema";

import type { AuthPayload } from "./auth";

/**
 * 从路径中提取操作类型和目标类型
 */
function extractOperationInfo(path: string, method: string): {
  type: string;
  targetType: string | null;
  action: string;
} {
  // 标准化路径，移除查询参数
  const normalizedPath = path.split("?")[0];

  // 提取路径段
  const segments = normalizedPath.split("/").filter(Boolean);

  // 确定目标类型（从路径中推断）
  let targetType: string | null = null;
  if (segments.includes("versions")) {
    targetType = "version";
  }
  else if (segments.includes("app-users") || segments.includes("users")) {
    targetType = "user";
  }
  else if (segments.includes("apps")) {
    targetType = "app";
  }
  else if (segments.includes("update-tasks")) {
    targetType = "update_task";
  }
  else if (segments.includes("platform-users")) {
    targetType = "platform_user";
  }

  // 确定操作类型
  let type = "unknown";
  if (method === "GET") {
    if (segments.length > 2) {
      // 例如: /api/apps/{appId}/versions/{id}
      type = `${targetType || "resource"}.view`;
    }
    else if (segments.length === 2) {
      // 例如: /api/apps/{appId}/versions
      type = `${targetType || "resource"}.list`;
    }
    else {
      type = "resource.view";
    }
  }
  else if (method === "POST") {
    type = `${targetType || "resource"}.create`;
  }
  else if (method === "PUT" || method === "PATCH") {
    type = `${targetType || "resource"}.update`;
  }
  else if (method === "DELETE") {
    type = `${targetType || "resource"}.delete`;
  }

  return {
    type,
    targetType,
    action: method,
  };
}

/**
 * 从路径中提取 appId 和 targetId
 */
function extractIds(path: string, params: Record<string, string>): {
  appId: string | null;
  targetId: string | null;
} {
  // 优先从验证后的参数中获取
  const appId = params.appId || null;
  const targetId = params.id || params.versionId || params.userId || null;

  // 如果参数中没有，尝试从路径中提取
  if (!appId) {
    const appIdMatch = path.match(/\/apps\/([^/]+)/);
    if (appIdMatch) {
      return {
        appId: appIdMatch[1],
        targetId: targetId || (path.match(/\/versions\/([^/]+)/)?.[1] || null),
      };
    }
  }

  return { appId, targetId };
}

/**
 * 操作日志中间件
 * 记录所有需要认证的操作到 operation_logs 表
 */
export const operationLoggerMiddleware = createMiddleware<AppBindings>(
  async (c, next) => {
    // 执行请求处理
    await next();

    // 获取用户信息（只有认证过的请求才记录日志）
    const user = c.get("user") as AuthPayload | undefined;
    if (!user) {
      return; // 未认证的请求不记录日志
    }

    // 获取请求信息
    const path = c.req.path;
    const method = c.req.method;

    // 跳过所有 GET 请求（查看数据不记录）
    if (method === "GET") {
      return;
    }

    // 获取响应状态码（默认为 200）
    const statusCode = c.res.status || 200;

    // 跳过某些路径（如健康检查、文档等）
    if (
      path.startsWith("/doc")
      || path.startsWith("/reference")
      || path.startsWith("/favicon")
      || path === "/"
    ) {
      return;
    }

    // 提取操作信息
    const { type, targetType, action } = extractOperationInfo(path, method);

    // 尝试从参数中提取 appId 和 targetId
    let appId: string | null = null;
    let targetId: string | null = null;
    let routeParams: Record<string, unknown> | null = null;
    let queryParams: Record<string, unknown> | null = null;

    try {
      // 尝试获取验证后的路由参数
      const params = (c.req.valid as (key: string) => Record<string, string> | undefined)("param");
      if (params) {
        routeParams = params as Record<string, unknown>;
        const ids = extractIds(path, params);
        appId = ids.appId;
        targetId = ids.targetId;
      }
      else {
        // 如果参数验证失败，从路径中提取
        const ids = extractIds(path, {});
        appId = ids.appId;
        targetId = ids.targetId;
      }
    }
    catch {
      // 参数验证失败时，从路径中提取
      const ids = extractIds(path, {});
      appId = ids.appId;
      targetId = ids.targetId;
    }

    // 获取查询参数
    try {
      const query = (c.req.valid as (key: string) => Record<string, unknown> | undefined)("query");
      if (query) {
        queryParams = query;
      }
      else {
        // 如果验证失败，尝试从 URL 中解析查询参数
        const url = new URL(c.req.url);
        if (url.searchParams.toString()) {
          queryParams = Object.fromEntries(url.searchParams.entries());
        }
      }
    }
    catch {
      // 如果验证失败，尝试从 URL 中解析查询参数
      try {
        const url = new URL(c.req.url);
        if (url.searchParams.toString()) {
          queryParams = Object.fromEntries(url.searchParams.entries());
        }
      }
      catch {
        // 忽略解析错误
      }
    }

    // 确定操作状态
    const status = statusCode >= 200 && statusCode < 300 ? "success" : "failed";

    // 构建详细信息
    const details: Record<string, unknown> = {
      path,
      method,
      statusCode,
    };

    // 记录路由参数（如果存在）
    if (routeParams && Object.keys(routeParams).length > 0) {
      details.params = routeParams;
    }

    // 记录查询参数（如果存在）
    if (queryParams && Object.keys(queryParams).length > 0) {
      details.query = queryParams;
    }

    // 对于 POST、PUT、PATCH 请求，尝试记录请求体
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        // 尝试获取验证后的 JSON 数据
        const body = (c.req.valid as (key: string) => Record<string, unknown> | undefined)("json");
        if (body) {
          // 过滤敏感字段，只记录安全的字段
          const safeFields = [
            "version",
            "build",
            "runtimeVersion",
            "name",
            "description",
            "status",
            "isMandatory",
            "publishTime",
            "scheduledAt",
            "type",
            "deviceId",
            "userId",
            "versionId",
          ];
          const safeBody: Record<string, unknown> = {};
          for (const field of safeFields) {
            if (field in body) {
              safeBody[field] = body[field];
            }
          }
          // 如果还有其他非敏感字段，也可以记录（但要排除明显的敏感字段）
          const sensitiveFields = ["password", "token", "secret", "key", "auth"];
          for (const [key, value] of Object.entries(body)) {
            if (!safeFields.includes(key) && !sensitiveFields.some(sensitive => key.toLowerCase().includes(sensitive))) {
              // 只记录简单类型，避免记录复杂对象
              if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
                safeBody[key] = value;
              }
            }
          }
          if (Object.keys(safeBody).length > 0) {
            details.body = safeBody;
          }
        }
      }
      catch {
        // 如果无法获取请求体，忽略错误（请求体可能已被消费）
      }
    }

    // 异步记录日志（不阻塞响应）
    db.insert(operationLogs)
      .values({
        appId: appId || undefined,
        type,
        action,
        targetId: targetId || undefined,
        targetType: targetType || undefined,
        status,
        details: JSON.stringify(details),
        userId: user.userId,
      })
      .catch((error) => {
        // 记录日志失败不应该影响请求处理
        // 可以使用 logger 记录错误，但这里避免循环依赖
        console.error("Failed to write operation log:", error);
      });
  },
);
