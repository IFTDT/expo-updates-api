import AdmZip from "adm-zip";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as tar from "tar";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, appUsers, updateTasks, uploads, users, versions } from "@/db/schema";
import { buildOssFileUrl, uploadDirectoryToOss } from "@/lib/oss-upload";
import { errorResponse, paginationResponse, successResponse } from "@/lib/response";

import type { CreateFromUrlRoute, CreateRoute, GetOneRoute, ListRoute, PublishRoute, RemoveRoute, RollbackRoute } from "./versions.routes";

export async function list(c: Parameters<AppRouteHandler<ListRoute>>[0]) {
  const { appId } = c.req.valid("param");
  const query = c.req.valid("query");
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

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

  // 构建查询条件
  const conditions = [eq(versions.appId, appId)];

  if (query.status) {
    conditions.push(eq(versions.status, query.status));
  }

  const where = and(...conditions);

  // 获取总数
  const totalResult = await db.select({ count: count() }).from(versions).where(where);
  const total = totalResult[0]?.count || 0;

  // 获取列表（简化排序，默认按创建时间倒序）
  const items = await db.query.versions.findMany({
    where,
    limit,
    offset,
    orderBy: [desc(versions.createdAt)],
  });

  const publisherIds = items
    .map(item => item.publishedBy)
    .filter((id): id is string => Boolean(id));
  const publishers = publisherIds.length > 0
    ? await db.query.users.findMany({
        where: inArray(users.id, publisherIds),
        columns: { id: true, name: true },
      })
    : [];
  const publisherMap = new Map(publishers.map(p => [p.id, p]));

  // 获取每个版本的用户数
  const formattedItems = await Promise.all(items.map(async (item) => {
    // 统计使用该版本的用户数
    const userCount = await db.query.appUsers.findMany({
      where: eq(appUsers.currentVersionId, item.id),
      columns: { id: true },
    });

    return {
      id: item.id,
      version: item.version,
      build: item.build,
      runtimeVersion: item.runtimeVersion,
      name: item.name,
      description: item.description,
      status: item.status,
      fileUrl: item.fileUrl,
      fileSize: item.fileSize,
      checksum: item.checksum,
      isMandatory: item.isMandatory,
      publishedAt: item.publishedAt || undefined,
      publishedBy: item.publishedBy || undefined,
      publisher: item.publishedBy && publisherMap.get(item.publishedBy)
        ? {
            id: publisherMap.get(item.publishedBy)!.id,
            name: publisherMap.get(item.publishedBy)!.name,
          }
        : undefined,
      userCount: userCount.length,
      createdAt: item.createdAt,
    };
  }));

  return paginationResponse(c, formattedItems, page, limit, total);
}

export async function getOne(c: Parameters<AppRouteHandler<GetOneRoute>>[0]) {
  const { appId, id } = c.req.valid("param");

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

  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  const publisher = version.publishedBy
    ? await db.query.users.findFirst({
        where: eq(users.id, version.publishedBy),
        columns: { id: true, name: true },
      })
    : null;

  // 统计使用该版本的用户数
  const userCount = await db.query.appUsers.findMany({
    where: eq(appUsers.currentVersionId, version.id),
    columns: { id: true },
  });

  return successResponse(c, {
    id: version.id,
    version: version.version,
    build: version.build,
    runtimeVersion: version.runtimeVersion,
    name: version.name,
    description: version.description,
    status: version.status,
    fileUrl: version.fileUrl,
    fileSize: version.fileSize,
    checksum: version.checksum,
    isMandatory: version.isMandatory,
    publishedAt: version.publishedAt || undefined,
    rolledBackAt: version.rolledBackAt || undefined,
    publishedBy: version.publishedBy || undefined,
    publisher: publisher
      ? {
          id: publisher.id,
          name: publisher.name,
        }
      : undefined,
    userCount: userCount.length,
    createdAt: version.createdAt,
  });
}

const UPLOAD_DIR = "./uploads";

const hasInvalidPathSegment = (value: string) => value.includes("..") || value.includes("/") || value.includes("\\");

async function findMetadataRelativePath(baseDir: string): Promise<string | null> {
  const candidates: string[] = [];

  const walk = async (currentDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      }
      else if (entry.isFile() && entry.name === "metadata.json") {
        const relativePath = path.relative(baseDir, absolutePath);
        if (relativePath && !relativePath.startsWith("..")) {
          candidates.push(relativePath);
        }
      }
    }
  };

  await walk(baseDir);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) {
      return depthA - depthB;
    }
    return a.localeCompare(b);
  });

  return candidates[0]!;
}

export async function create(c: Parameters<AppRouteHandler<CreateRoute>>[0]) {
  const { appId } = c.req.valid("param");
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

  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody();
  }
  catch (error) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "请求体解析失败",
      { error: error instanceof Error ? error.message : "Unknown error" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const file = body.file as File | undefined;
  const version = typeof body.version === "string" ? body.version.trim() : undefined;
  const build = typeof body.build === "string" ? body.build.trim() : undefined;
  const runtimeVersion = typeof body.runtimeVersion === "string" ? body.runtimeVersion.trim() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const description = typeof body.description === "string" ? body.description : undefined;
  const publishTimeRaw = typeof body.publishTime === "string" && body.publishTime.length > 0 ? body.publishTime : "now";
  const scheduledAtRaw = typeof body.scheduledAt === "string" && body.scheduledAt.length > 0 ? body.scheduledAt : undefined;
  const isMandatoryRaw = body.isMandatory;
  const uploadToOssRaw = body.uploadToOss;

  if (!file) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "文件不能为空",
      { field: "file" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!version) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "版本号不能为空",
      { field: "version" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!build) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "构建号不能为空",
      { field: "build" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!runtimeVersion) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "Runtime 版本不能为空",
      { field: "runtimeVersion" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (hasInvalidPathSegment(runtimeVersion)) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "runtimeVersion 不能包含路径分隔符",
      { field: "runtimeVersion" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  if (!name) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "版本名称不能为空",
      { field: "name" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const publishTime = publishTimeRaw === "scheduled" ? "scheduled" : "now";

  let scheduledAt: Date | null = null;
  if (publishTime === "scheduled") {
    if (!scheduledAtRaw) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "定时发布时间不能为空",
        { field: "scheduledAt" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    const parsedDate = new Date(scheduledAtRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "定时发布时间格式不正确",
        { field: "scheduledAt" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    scheduledAt = parsedDate;
  }
  else if (scheduledAtRaw) {
    const parsedDate = new Date(scheduledAtRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "定时发布时间格式不正确",
        { field: "scheduledAt" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    scheduledAt = parsedDate;
  }

  const isMandatory = typeof isMandatoryRaw === "string"
    ? isMandatoryRaw === "true"
    : Boolean(isMandatoryRaw);
  const uploadToOss = typeof uploadToOssRaw === "string"
    ? uploadToOssRaw === "true"
    : Boolean(uploadToOssRaw);

  // 检查构建号是否已存在（同一应用下构建号必须唯一）
  const existing = await db.query.versions.findFirst({
    where: and(eq(versions.appId, appId), eq(versions.build, build)),
  });

  if (existing) {
    return errorResponse(
      c,
      "BUILD_CONFLICT",
      "构建号已存在",
      { build },
      HttpStatusCodes.CONFLICT,
    );
  }

  const allowedExtensions = [".tar.gz", ".zip", ".tgz"];
  const originalFileName = file.name || "bundle";
  // 检查 .tar.gz 扩展名（需要特殊处理，因为包含两个点）
  let extension = "";
  const lowerFileName = originalFileName.toLowerCase();
  if (lowerFileName.endsWith(".tar.gz")) {
    extension = ".tar.gz";
  }
  else if (lowerFileName.endsWith(".tgz")) {
    extension = ".tgz";
  }
  else {
    const lastDotIndex = originalFileName.lastIndexOf(".");
    extension = lastDotIndex !== -1 ? originalFileName.slice(lastDotIndex).toLowerCase() : "";
  }

  if (!allowedExtensions.includes(extension)) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "不支持的文件格式，仅支持 .tar.gz, .zip, .tgz",
      { field: "file" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "文件大小不能超过100MB",
      { field: "file" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const hash = createHash("sha256");
  hash.update(buffer);
  const checksum = `sha256:${hash.digest("hex")}`;

  const sanitizedVersionSegment = version.replace(/\./g, "") || version;
  if (hasInvalidPathSegment(sanitizedVersionSegment)) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "版本号不能包含路径分隔符",
      { field: "version" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const timestamp = Date.now().toString();
  const safeFileName = originalFileName.replace(/[^\w.-]/g, "_");
  const storageDir = path.join(UPLOAD_DIR, appId, runtimeVersion, sanitizedVersionSegment, timestamp);
  const ossObjectPrefix = uploadToOss
    ? path.posix.join(
        "expo/updates",
        app.appId.replaceAll(".", "_").replace(/[^\w-]/g, "_"),
        runtimeVersion,
        sanitizedVersionSegment,
        timestamp,
      )
    : null;

  await mkdir(storageDir, { recursive: true });

  // 写入压缩包文件
  const filePath = path.join(storageDir, safeFileName);
  await writeFile(filePath, buffer);

  // 解压文件
  try {
    if (extension === ".zip") {
      // 解压 ZIP 文件
      const zip = new AdmZip(filePath);
      zip.extractAllTo(storageDir, true);
    }
    else if (extension === ".tar.gz" || extension === ".tgz") {
      // 解压 TAR.GZ 文件
      await tar.extract({
        file: filePath,
        cwd: storageDir,
        strip: 0,
      });
    }

    // 解压完成后删除压缩包
    await unlink(filePath);
  }
  catch (error) {
    // 如果解压失败，尝试删除压缩包
    try {
      await unlink(filePath);
    }
    catch {
      // 忽略删除错误
    }
    return errorResponse(
      c,
      "EXTRACTION_ERROR",
      "文件解压失败",
      { error: error instanceof Error ? error.message : "Unknown error" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  if (uploadToOss) {
    try {
      if (!ossObjectPrefix) {
        throw new Error("OSS 上传路径生成失败");
      }
      await uploadDirectoryToOss(storageDir, ossObjectPrefix);
    }
    catch (error) {
      return errorResponse(
        c,
        "OSS_UPLOAD_ERROR",
        "文件上传到 OSS 失败",
        { error: error instanceof Error ? error.message : "Unknown error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  const metadataRelativePath = await findMetadataRelativePath(storageDir);
  if (!metadataRelativePath) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "解压后未找到 metadata.json",
      { field: "file" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const fileUrl = uploadToOss && ossObjectPrefix
    ? buildOssFileUrl(path.posix.join(ossObjectPrefix, metadataRelativePath.split(path.sep).join(path.posix.sep)))
    : `/${path.posix.join("uploads", appId, runtimeVersion, sanitizedVersionSegment, timestamp, metadataRelativePath.split(path.sep).join(path.posix.sep))}`;

  // 创建上传记录
  const [{ id: uploadId }] = await db.insert(uploads).values({
    appId,
    fileUrl,
    fileSize: file.size,
    checksum,
    status: "completed",
    progress: 100,
    uploadedBytes: file.size,
    totalBytes: file.size,
    uploadedBy: userPayload.userId,
  }).$returningId();

  // 创建版本
  const publishedAt = publishTime === "now" ? new Date() : scheduledAt;
  const status = publishedAt ? "published" : "draft";

  const [{ id: newVersionId }] = await db.insert(versions).values({
    appId,
    version,
    build,
    runtimeVersion,
    name,
    description: description ?? null,
    status,
    fileUrl,
    fileSize: file.size,
    checksum,
    isMandatory,
    publishedAt,
    publishedBy: publishedAt ? userPayload.userId : undefined,
  }).$returningId();

  const newVersion = await db.query.versions.findFirst({
    where: eq(versions.id, newVersionId),
  });

  if (!newVersion) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "版本创建失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // 如果立即发布，创建更新任务
  let taskId: string | undefined;
  if (status === "published") {
    const [{ id }] = await db.insert(updateTasks).values({
      appId,
      versionId: newVersion.id,
      type: "full",
      status: "pending",
      scheduledAt: publishTime === "scheduled" && scheduledAt ? scheduledAt : undefined,
      targetUserIds: JSON.stringify([]),
      targetGroupIds: JSON.stringify([]),
      createdBy: userPayload.userId,
    }).$returningId();
    taskId = id;
  }

  // 更新应用的当前版本
  await db.update(apps)
    .set({
      currentVersionId: newVersion.id,
      currentVersion: version,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appId));

  return successResponse(
    c,
    {
      id: newVersion.id,
      version: newVersion.version,
      status: newVersion.status,
      publishedAt: newVersion.publishedAt || undefined,
      uploadId,
      taskId,
    },
    "版本创建成功",
    HttpStatusCodes.CREATED,
  );
}

export async function createFromUrl(c: Parameters<AppRouteHandler<CreateFromUrlRoute>>[0]) {
  const { appId } = c.req.valid("param");
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

  const data = c.req.valid("json");

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

  // 检查构建号是否已存在（同一应用下构建号必须唯一）
  const existing = await db.query.versions.findFirst({
    where: and(eq(versions.appId, appId), eq(versions.build, data.build)),
  });

  if (existing) {
    return errorResponse(
      c,
      "BUILD_CONFLICT",
      "构建号已存在",
      { build: data.build },
      HttpStatusCodes.CONFLICT,
    );
  }

  const publishTime = data.publishTime || "now";

  let scheduledAt: Date | null = null;
  if (publishTime === "scheduled" && data.scheduledAt) {
    const parsedDate = new Date(data.scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return errorResponse(
        c,
        "VALIDATION_ERROR",
        "定时发布时间格式不正确",
        { field: "scheduledAt" },
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    scheduledAt = parsedDate;
  }

  if (publishTime === "scheduled" && !scheduledAt) {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "定时发布时间不能为空",
      { field: "scheduledAt" },
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  const publishedAt = publishTime === "now" ? new Date() : scheduledAt;
  const status = publishedAt ? "published" : "draft";

  const [{ id: newVersionId }] = await db.insert(versions).values({
    appId,
    version: data.version,
    build: data.build,
    runtimeVersion: data.runtimeVersion,
    name: data.name,
    description: data.description ?? null,
    status,
    fileUrl: data.fileUrl,
    fileSize: data.fileSize,
    checksum: data.checksum,
    isMandatory: data.isMandatory ?? false,
    publishedAt,
    publishedBy: publishedAt ? userPayload.userId : undefined,
  }).$returningId();

  const newVersion = await db.query.versions.findFirst({
    where: eq(versions.id, newVersionId),
  });

  if (!newVersion) {
    return errorResponse(
      c,
      "INTERNAL_ERROR",
      "版本创建失败",
      undefined,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  let taskId: string | undefined;
  if (status === "published") {
    const [{ id }] = await db.insert(updateTasks).values({
      appId,
      versionId: newVersion.id,
      type: "full",
      status: "pending",
      scheduledAt: publishTime === "scheduled" && scheduledAt ? scheduledAt : undefined,
      targetUserIds: JSON.stringify([]),
      targetGroupIds: JSON.stringify([]),
      createdBy: userPayload.userId,
    }).$returningId();
    taskId = id;
  }

  await db.update(apps)
    .set({
      currentVersionId: newVersion.id,
      currentVersion: data.version,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appId));

  return successResponse(
    c,
    {
      id: newVersion.id,
      version: newVersion.version,
      status: newVersion.status,
      publishedAt: newVersion.publishedAt || undefined,
      taskId,
    },
    "版本创建成功",
    HttpStatusCodes.CREATED,
  );
}

export async function publish(c: Parameters<AppRouteHandler<PublishRoute>>[0]) {
  const { appId, id } = c.req.valid("param");
  const data = c.req.valid("json");
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

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  if (version.status === "published") {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "版本已发布",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 更新版本状态
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  await db.update(versions)
    .set({
      status: "published",
      publishedAt: scheduledAt || new Date(),
      publishedBy: userPayload.userId,
      updatedAt: new Date(),
    })
    .where(eq(versions.id, id));

  // 创建更新任务
  const [{ id: taskId }] = await db.insert(updateTasks).values({
    appId,
    versionId: id,
    type: data.type,
    status: scheduledAt ? "pending" : "pending",
    scheduledAt,
    targetUserIds: data.targetUserIds.length > 0 ? JSON.stringify(data.targetUserIds) : null,
    targetGroupIds: data.targetGroupIds.length > 0 ? JSON.stringify(data.targetGroupIds) : null,
    createdBy: userPayload.userId,
  }).$returningId();

  // 更新应用的当前版本
  await db.update(apps)
    .set({
      currentVersionId: id,
      currentVersion: version.version,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appId));

  return successResponse(c, {
    taskId,
    status: scheduledAt ? "pending" : "pending",
  }, "发布任务已创建");
}

export async function rollback(c: Parameters<AppRouteHandler<RollbackRoute>>[0]) {
  const { appId, id } = c.req.valid("param");
  const data = c.req.valid("json");
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

  // 验证当前版本
  const currentVersion = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!currentVersion) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 验证目标版本
  const toVersion = await db.query.versions.findFirst({
    where: and(eq(versions.id, data.toVersionId), eq(versions.appId, appId)),
  });

  if (!toVersion) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "目标版本不存在",
      { resource: "version", id: data.toVersionId },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 更新当前版本状态为已回滚
  await db.update(versions)
    .set({
      status: "rolled_back",
      rolledBackAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(versions.id, id));

  // 创建回滚任务
  const [{ id: taskId }] = await db.insert(updateTasks).values({
    appId,
    versionId: data.toVersionId,
    type: data.type,
    status: "pending",
    targetUserIds: data.targetUserIds.length > 0 ? JSON.stringify(data.targetUserIds) : null,
    targetGroupIds: data.targetGroupIds.length > 0 ? JSON.stringify(data.targetGroupIds) : null,
    createdBy: userPayload.userId,
  }).$returningId();

  // 更新应用的当前版本为目标版本
  await db.update(apps)
    .set({
      currentVersionId: data.toVersionId,
      currentVersion: toVersion.version,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appId));

  return successResponse(c, {
    taskId,
    status: "pending",
  }, "回滚任务已创建");
}

export async function remove(c: Parameters<AppRouteHandler<RemoveRoute>>[0]) {
  const { appId, id } = c.req.valid("param");

  // 验证版本是否存在
  const version = await db.query.versions.findFirst({
    where: and(eq(versions.id, id), eq(versions.appId, appId)),
  });

  if (!version) {
    return errorResponse(
      c,
      "RESOURCE_NOT_FOUND",
      "版本不存在",
      { resource: "version", id },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  // 只能删除草稿版本
  if (version.status !== "draft") {
    return errorResponse(
      c,
      "VALIDATION_ERROR",
      "只能删除草稿版本",
      undefined,
      HttpStatusCodes.BAD_REQUEST,
    );
  }

  // 删除版本
  await db.delete(versions)
    .where(eq(versions.id, id));

  return successResponse(c, null, "版本删除成功");
}
