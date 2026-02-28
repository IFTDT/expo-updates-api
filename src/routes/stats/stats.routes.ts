import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { AppIdParamsSchema } from "@/lib/schemas";

const tags = ["Stats"];

// ==================== 获取应用统计信息 ====================
export const getAppStats = createRoute({
  path: "/api/apps/{appId}/stats",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          summary: z.object({
            updateSuccessRate: z.number(),
            successCount: z.number(),
            failureCount: z.number(),
            activeVersions: z.number(),
            totalUpdates: z.number(),
          }),
          versionDistribution: z.array(z.object({
            version: z.string(),
            build: z.string(),
            runtimeVersion: z.string(),
            count: z.number(),
            percentage: z.number(),
          })),
          updateTimeline: z.array(z.object({
            date: z.string(),
            count: z.number(),
          })),
          failureReasons: z.array(z.object({
            reason: z.string(),
            count: z.number(),
          })),
        }),
      }),
      "获取成功",
    ),
  },
});

// ==================== 获取版本分布统计 ====================
export const getVersionDistribution = createRoute({
  path: "/api/apps/{appId}/stats/version-distribution",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.array(z.object({
          version: z.string(),
          build: z.string(),
          runtimeVersion: z.string(),
          count: z.number(),
          percentage: z.number(),
        })),
      }),
      "获取成功",
    ),
  },
});

// ==================== 获取更新成功率统计 ====================
export const getUpdateSuccessRate = createRoute({
  path: "/api/apps/{appId}/stats/update-success-rate",
  method: "get",
  tags,
  security: [{ Bearer: [] }],
  request: {
    params: AppIdParamsSchema,
    query: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.literal(true),
        data: z.object({
          successRate: z.number(),
          successCount: z.number(),
          failureCount: z.number(),
          totalCount: z.number(),
        }),
      }),
      "获取成功",
    ),
  },
});

export type GetAppStatsRoute = typeof getAppStats;
export type GetVersionDistributionRoute = typeof getVersionDistribution;
export type GetUpdateSuccessRateRoute = typeof getUpdateSuccessRate;
