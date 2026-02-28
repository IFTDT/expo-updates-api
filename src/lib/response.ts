import type { Context } from "hono";

import * as HttpStatusCodes from "stoker/http-status-codes";

type ContentfulStatusCode = typeof HttpStatusCodes[keyof typeof HttpStatusCodes];

/**
 * 成功响应格式
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * 错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 分页响应格式
 */
export interface PaginationResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 返回成功响应
 */
export function successResponse<T>(
  c: Context,
  data: T,
  message?: string,
  status: ContentfulStatusCode = HttpStatusCodes.OK,
) {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return c.json(response as never, status as never);
}

/**
 * 返回错误响应
 */
export function errorResponse(
  c: Context,
  code: string,
  message: string,
  details?: unknown,
  status: ContentfulStatusCode = HttpStatusCodes.BAD_REQUEST,
) {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return c.json(response as never, status as never);
}

/**
 * 返回分页响应
 */
export function paginationResponse<T>(
  c: Context,
  items: T[],
  page: number,
  limit: number,
  total: number,
) {
  const totalPages = Math.ceil(total / limit);

  return successResponse(
    c,
    {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    } as PaginationResponse<T>,
  );
}
