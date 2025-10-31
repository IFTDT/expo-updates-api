import { z } from "@hono/zod-openapi";

/**
 * 分页查询参数Schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * 排序查询参数Schema
 */
export const sortQuerySchema = z.object({
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc").optional(),
});

export type SortQuery = z.infer<typeof sortQuerySchema>;

/**
 * 计算分页信息
 */
export function getPaginationInfo(
  page: number,
  limit: number,
  total: number,
) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
  };
}

