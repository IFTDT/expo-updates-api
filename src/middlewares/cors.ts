import { cors } from "hono/cors";

/**
 * CORS 中间件
 * 支持跨域访问
 */
export const corsMiddleware = cors({
  origin: "*", // 允许所有来源，生产环境建议配置具体域名
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposeHeaders: ["Content-Length", "X-Request-Id"],
  credentials: true,
  maxAge: 86400, // 24小时
});
