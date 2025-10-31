import db from "@/db";
import { operationLogs } from "@/db/schema";

export interface CreateLogParams {
  appId?: string;
  type: string;
  action: string;
  targetId?: string;
  targetType?: string;
  status?: "success" | "failed";
  details?: Record<string, unknown>;
  userId: string;
}

/**
 * 记录操作日志
 */
export async function createOperationLog(params: CreateLogParams): Promise<void> {
  await db.insert(operationLogs).values({
    appId: params.appId,
    type: params.type,
    action: params.action,
    targetId: params.targetId,
    targetType: params.targetType,
    status: params.status || "success",
    details: params.details ? JSON.stringify(params.details) : undefined,
    userId: params.userId,
  });
}

