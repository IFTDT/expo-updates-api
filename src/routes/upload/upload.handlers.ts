import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, uploads } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/response";

import type { GetProgressRoute, UploadRoute } from "./upload.routes";

// 上传文件存储目录
const UPLOAD_DIR = "./uploads";

export async function upload(c: Parameters<AppRouteHandler<UploadRoute>>[0]) {
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

  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;
    const appId = body.appId as string | undefined;

    if (!file) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "文件不能为空",
        { field: "file" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    if (!appId) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "应用ID不能为空",
        { field: "appId" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    // 验证应用是否存在
    const app = await db.query.apps.findFirst({
      where: eq(apps.id, appId),
    });

    if (!app) {
      return errorResponse(
        c,
        "RESOURCE_NOT_FOUND",
        "应用不存在",
        { resource: "app", id: appId },
        HttpStatusCodes.NOT_FOUND,
      );
    }

    // 验证文件格式
    const allowedExtensions = [".tar.gz", ".zip", ".tgz"];
    const fileName = file.name || "";
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
    if (!allowedExtensions.includes(ext)) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "不支持的文件格式，仅支持 .tar.gz, .zip, .tgz",
        { field: "file" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    // 验证文件大小（100MB）
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "文件大小不能超过100MB",
        { field: "file" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    // eslint-disable-next-line node/prefer-global/buffer
    const buffer = Buffer.from(arrayBuffer);

    // 计算文件校验和
    const hash = createHash("sha256");
    hash.update(buffer);
    const checksum = `sha256:${hash.digest("hex")}`;

    // 生成文件路径
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^\w.-]/g, "_");
    const filePath = join(UPLOAD_DIR, appId, `${timestamp}_${safeFileName}`);

    // 确保目录存在
    await mkdir(dirname(filePath), { recursive: true });

    // 保存文件
    await writeFile(filePath, buffer);

    // 生成文件URL（实际应该使用CDN或对象存储）
    const fileUrl = `/uploads/${appId}/${timestamp}_${safeFileName}`;

    // 创建上传记录
    const [uploadRecord] = await db.insert(uploads).values({
      appId,
      fileUrl,
      fileSize: file.size,
      checksum,
      status: "completed",
      progress: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      uploadedBy: userPayload.userId,
    }).returning();

    return successResponse(c, {
      fileUrl,
      fileSize: file.size,
      checksum,
      uploadId: uploadRecord.id,
    });
  }
  catch (error) {
    return errorResponse(
      c,
      "UPLOAD_FAILED",
      "文件上传失败",
      { error: error instanceof Error ? error.message : "Unknown error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function getProgress(c: Parameters<AppRouteHandler<GetProgressRoute>>[0]) {
  const { id } = c.req.valid("param");

  // 查找上传记录
  const uploadRecord = await db.query.uploads.findFirst({
    where: eq(uploads.id, id),
  });

  if (!uploadRecord) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "上传记录不存在",
      { resource: "upload", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return successResponse(c, {
    uploadId: uploadRecord.id,
    progress: uploadRecord.progress || 0,
    status: uploadRecord.status,
    uploadedBytes: uploadRecord.uploadedBytes || 0,
    totalBytes: uploadRecord.totalBytes,
  });
}
