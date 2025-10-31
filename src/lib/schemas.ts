import { z } from "@hono/zod-openapi";

/**
 * ID参数Schema（字符串类型）
 */
export const StringIdParamsSchema = z.object({
  id: z.string(),
});

/**
 * 应用ID参数Schema
 */
export const AppIdParamsSchema = z.object({
  appId: z.string(),
});

/**
 * 应用ID和版本ID参数Schema
 */
export const AppIdVersionIdParamsSchema = z.object({
  appId: z.string(),
  id: z.string(),
});

