import { and, desc, eq, or } from "drizzle-orm";
import FormData from "form-data";
import mime from "mime";
import fs from "node:fs/promises";
import path from "node:path";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, appUsers, updateTasks, userGroupMembers, userGroups, versions } from "@/db/schema";
import {
  checkRollbackExists,
  convertSHA256HashToUUID,
  convertToDictionaryItemsRepresentation,
  createNoUpdateDirective,
  createRollBackDirectiveAsync,
  getAssetMetadataAsync,
  getExpoConfigAsync,
  getLatestUpdateBundlePathForRuntimeVersionAsync,
  getMetadataAsync,
  getPrivateKeyAsync,
  serializeSignature,
  signRSASHA256,
} from "@/lib/expo-updates-helpers";

import type { assetsRoute, manifestRoute } from "./expo-updates.routes";

/**
 * Manifest 处理函数
 */
export const manifestHandler: AppRouteHandler<typeof manifestRoute> = async (
  c,
) => {
  // 只支持 GET 请求
  if (c.req.method !== "GET") {
    return c.json(
      {
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Expected GET." },
      },
      405,
    );
  }

  // 提取协议版本（默认 0）
  const protocolVersion = Number.parseInt(
    c.req.header("expo-protocol-version") || "0",
    10,
  );

  // 提取并验证平台
  const platform = c.req.header("expo-platform") || c.req.query("platform");
  if (platform !== "ios" && platform !== "android") {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_PLATFORM",
          message: "Unsupported platform. Expected either ios or android.",
        },
      },
      400,
    );
  }

  // 提取并验证运行时版本
  const runtimeVersion
    = c.req.header("expo-runtime-version") || c.req.query("runtime-version");
  if (!runtimeVersion || typeof runtimeVersion !== "string") {
    return c.json(
      {
        success: false,
        error: {
          code: "MISSING_RUNTIME_VERSION",
          message: "No runtimeVersion provided.",
        },
      },
      400,
    );
  }

  const appId = c.req.header("x-app-id") || c.req.query("app-id");
  const deviceId = c.req.header("x-device-id") || c.req.query("device-id");
  const userId = c.req.header("x-user-id") || c.req.query("user-id");

  const bundleResult = await resolveUpdateBundlePath({
    runtimeVersion,
    appId,
    deviceId,
    userId,
    platform,
    trackDevice: true,
  });

  if (!bundleResult.ok) {
    return c.json(
      {
        success: false,
        error: bundleResult.error,
      },
      bundleResult.status,
    );
  }

  const { updateBundlePath, targetVersionId, appId: resolvedAppId } = bundleResult;

  try {
    // 读取元数据
    const { metadataJson, createdAt, id }
      = await getMetadataAsync(updateBundlePath);
    const currentUpdateId = convertSHA256HashToUUID(id);

    // Protocol version 1 特有功能：检查 rollback 和 no update available
    const clientCurrentUpdateId = c.req.header("expo-current-update-id");
    const embeddedUpdateId = c.req.header("expo-embedded-update-id");

    if (protocolVersion === 1) {
      // 检查是否存在 rollback 标记
      const hasRollback = await checkRollbackExists(updateBundlePath);
      if (hasRollback) {
        if (embeddedUpdateId && clientCurrentUpdateId === embeddedUpdateId) {
          // 客户端已经在使用嵌入版本，不需要回滚
          // 返回 noUpdateAvailable
          return await putNoUpdateAvailableInResponseAsync(c, protocolVersion);
        }

        // 返回 rollback 指令
        return await putRollBackInResponseAsync(
          c,
          updateBundlePath,
          protocolVersion,
        );
      }

      // 检查是否已经是当前更新（no update available）
      if (clientCurrentUpdateId === currentUpdateId) {
        return await putNoUpdateAvailableInResponseAsync(c, protocolVersion);
      }
    }
    else if (
      protocolVersion === 0
      && clientCurrentUpdateId === currentUpdateId
    ) {
      // Protocol version 0 不支持 noUpdateAvailable 指令
      // 但是我们可以跳过构建 manifest，直接返回现有更新
      // 为了保持兼容性，我们仍然返回最新更新
    }

    // 构建 manifest
    const platformSpecificMetadata = metadataJson.fileMetadata[platform];
    const manifest = {
      id: currentUpdateId,
      createdAt,
      runtimeVersion,
      assets: await Promise.all(
        platformSpecificMetadata.assets.map((asset: any) =>
          getAssetMetadataAsync({
            updateBundlePath,
            filePath: asset.path,
            ext: asset.ext,
            runtimeVersion,
            platform,
            isLaunchAsset: false,
          }),
        ),
      ),
      launchAsset: await getAssetMetadataAsync({
        updateBundlePath,
        filePath: platformSpecificMetadata.bundle,
        isLaunchAsset: true,
        runtimeVersion,
        platform,
        ext: null,
      }),
      metadata: {},
      extra: { expoClient: await getExpoConfigAsync(updateBundlePath) },
    };

    // 可选代码签名
    let signature = null;
    if (c.req.header("expo-expect-signature")) {
      const privateKey = await getPrivateKeyAsync();
      if (!privateKey) {
        return c.json(
          {
            success: false,
            error: {
              code: "SIGNING_ERROR",
              message:
                "Code signing requested but no key supplied when starting server.",
            },
          },
          400,
        );
      }

      const manifestString = JSON.stringify(manifest);
      const hashSignature = signRSASHA256(manifestString, privateKey);
      const dictionary = convertToDictionaryItemsRepresentation({
        sig: hashSignature,
        keyid: "main",
      });
      signature = serializeSignature(dictionary);
    }

    // 返回 multipart 响应
    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest), {
      contentType: "application/json",
      header: {
        "content-type": "application/json; charset=utf-8",
        ...(signature ? { "expo-signature": signature } : {}),
      },
    });

    c.header("expo-protocol-version", protocolVersion.toString());
    c.header("expo-sfv-version", "0");
    c.header("cache-control", "private, max-age=0");
    c.header("content-type", `multipart/mixed; boundary=${form.getBoundary()}`);

    const buffer = form.getBuffer();
    const body = new Uint8Array(buffer);

    // 成功返回更新，更新统计信息
    if (targetVersionId && resolvedAppId) {
      const { appUserId } = bundleResult;
      await updateTaskStats(targetVersionId, resolvedAppId, true, appUserId || null);
    }

    return new Response(body, {
      headers: c.res.headers,
      status: 200,
    });
  }
  catch (error: any) {
    // 处理失败，更新失败计数
    if (targetVersionId && resolvedAppId) {
      // 尝试获取 appUserId（如果存在）
      let appUserIdForStats: string | null = null;
      if (deviceId && resolvedAppId) {
        try {
          const foundUser = await db.query.appUsers.findFirst({
            where: and(eq(appUsers.appId, resolvedAppId), eq(appUsers.deviceId, deviceId)),
          });
          appUserIdForStats = foundUser?.id || null;
        }
        catch {
          // 忽略错误
        }
      }
      await updateTaskStats(targetVersionId, resolvedAppId, false, appUserIdForStats);
    }
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      },
      500,
    );
  }
};

/**
 * 返回 rollback 指令
 */
async function putRollBackInResponseAsync(
  c: Parameters<AppRouteHandler<typeof manifestRoute>>[0],
  updateBundlePath: string,
  protocolVersion: number,
): Promise<Response> {
  if (protocolVersion === 0) {
    return c.json(
      {
        success: false,
        error: {
          code: "ROLLBACK_NOT_SUPPORTED",
          message: "Rollbacks not supported on protocol version 0",
        },
      },
      400,
    );
  }

  const embeddedUpdateId = c.req.header("expo-embedded-update-id");
  if (!embeddedUpdateId) {
    return c.json(
      {
        success: false,
        error: {
          code: "MISSING_EMBEDDED_UPDATE_ID",
          message: "Invalid Expo-Embedded-Update-ID request header specified.",
        },
      },
      400,
    );
  }

  const currentUpdateId = c.req.header("expo-current-update-id");
  if (currentUpdateId === embeddedUpdateId) {
    // 客户端已经在使用嵌入版本，返回 noUpdateAvailable
    return await putNoUpdateAvailableInResponseAsync(c, protocolVersion);
  }

  const directive = await createRollBackDirectiveAsync(updateBundlePath);

  // 可选代码签名
  let signature = null;
  if (c.req.header("expo-expect-signature")) {
    const privateKey = await getPrivateKeyAsync();
    if (!privateKey) {
      return c.json(
        {
          success: false,
          error: {
            code: "SIGNING_ERROR",
            message:
              "Code signing requested but no key supplied when starting server.",
          },
        },
        400,
      );
    }

    const directiveString = JSON.stringify(directive);
    const hashSignature = signRSASHA256(directiveString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: "main",
    });
    signature = serializeSignature(dictionary);
  }

  // 返回 multipart 响应
  const form = new FormData();
  form.append("directive", JSON.stringify(directive), {
    contentType: "application/json",
    header: {
      "content-type": "application/json; charset=utf-8",
      ...(signature ? { "expo-signature": signature } : {}),
    },
  });

  c.header("expo-protocol-version", "1");
  c.header("expo-sfv-version", "0");
  c.header("cache-control", "private, max-age=0");
  c.header("content-type", `multipart/mixed; boundary=${form.getBoundary()}`);

  const buffer = form.getBuffer();
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: c.res.headers,
    status: 200,
  });
}

/**
 * 返回无更新可用指令
 */
async function putNoUpdateAvailableInResponseAsync(
  c: Parameters<AppRouteHandler<typeof manifestRoute>>[0],
  protocolVersion: number,
): Promise<Response> {
  if (protocolVersion === 0) {
    // Protocol version 0 不支持 noUpdateAvailable 指令
    // 在这种情况下，应该返回最新的更新
    return c.json(
      {
        success: false,
        error: {
          code: "NO_UPDATE_DIRECTIVE_NOT_SUPPORTED",
          message:
            "NoUpdateAvailable directive not available in protocol version 0",
        },
      },
      400,
    );
  }

  const directive = createNoUpdateDirective();

  // 可选代码签名
  let signature = null;
  if (c.req.header("expo-expect-signature")) {
    const privateKey = await getPrivateKeyAsync();
    if (!privateKey) {
      return c.json(
        {
          success: false,
          error: {
            code: "SIGNING_ERROR",
            message:
              "Code signing requested but no key supplied when starting server.",
          },
        },
        400,
      );
    }

    const directiveString = JSON.stringify(directive);
    const hashSignature = signRSASHA256(directiveString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: "main",
    });
    signature = serializeSignature(dictionary);
  }

  // 返回 multipart 响应
  const form = new FormData();
  form.append("directive", JSON.stringify(directive), {
    contentType: "application/json",
    header: {
      "content-type": "application/json; charset=utf-8",
      ...(signature ? { "expo-signature": signature } : {}),
    },
  });

  c.header("expo-protocol-version", "1");
  c.header("expo-sfv-version", "0");
  c.header("cache-control", "private, max-age=0");
  c.header("content-type", `multipart/mixed; boundary=${form.getBoundary()}`);

  const buffer = form.getBuffer();
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: c.res.headers,
    status: 200,
  });
}

/**
 * Assets 处理函数
 */
export const assetsHandler: AppRouteHandler<typeof assetsRoute> = async (c) => {
  const query = c.req.valid("query");
  const assetName = query.asset;
  const runtimeVersion = query.runtimeVersion;
  const platform = query.platform;

  // 验证资源名称
  if (!assetName || typeof assetName !== "string") {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_ASSET_NAME",
          message: "No asset name provided.",
        },
      },
      400,
    );
  }

  // 验证平台
  if (platform !== "ios" && platform !== "android") {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_PLATFORM",
          message: "No platform provided. Expected \"ios\" or \"android\".",
        },
      },
      400,
    );
  }

  // 验证运行时版本
  if (!runtimeVersion || typeof runtimeVersion !== "string") {
    return c.json(
      {
        success: false,
        error: {
          code: "MISSING_RUNTIME_VERSION",
          message: "No runtimeVersion provided.",
        },
      },
      400,
    );
  }

  // 提取应用包名（从 header 或 query）
  const appId = c.req.header("x-app-id") || query["app-id"];

  const deviceId = c.req.header("x-device-id") || query["device-id"];
  const userId = c.req.header("x-user-id") || query["user-id"];

  const bundleResult = await resolveUpdateBundlePath({
    runtimeVersion,
    appId,
    deviceId,
    userId,
    platform,
    trackDevice: false,
  });

  if (!bundleResult.ok) {
    return c.json(
      {
        success: false,
        error: bundleResult.error,
      },
      bundleResult.status,
    );
  }

  const { updateBundlePath } = bundleResult;
  const isRemoteBundlePath = /^https?:\/\//i.test(updateBundlePath);
  // 加载元数据以确定资源类型
  let metadataJson: any;
  try {
    const { metadataJson: meta } = await getMetadataAsync(updateBundlePath);
    metadataJson = meta;
  }
  catch {
    return c.json(
      {
        success: false,
        error: {
          code: "METADATA_ERROR",
          message: "Failed to read metadata.",
        },
      },
      500,
    );
  }

  // 解析资源路径 - assetName 可能是相对路径或绝对路径
  let assetPath: string;
  if (isRemoteBundlePath) {
    assetPath = new URL(assetName, updateBundlePath.endsWith("/") ? updateBundlePath : `${updateBundlePath}/`).toString();
  }
  else if (path.isAbsolute(assetName)) {
    assetPath = assetName;
  }
  else {
    // 如果是相对路径，尝试相对于更新包路径或工作目录
    if (assetName.startsWith(updateBundlePath)) {
      assetPath = path.resolve(assetName);
    }
    else {
      // 尝试在更新包目录中查找
      assetPath = path.join(updateBundlePath, assetName);
    }
  }

  // 确定资源类型
  const relativePath = isRemoteBundlePath ? assetName : path.relative(updateBundlePath, assetPath);
  const assetMetadata = metadataJson.fileMetadata[platform].assets.find(
    (asset: any) => asset.path === relativePath,
  );

  const isLaunchAsset
    = metadataJson.fileMetadata[platform].bundle === relativePath;

  // 确定 MIME 类型
  let contentType: string;
  if (isLaunchAsset) {
    contentType = "application/javascript";
  }
  else if (assetMetadata?.ext) {
    const ext = assetMetadata.ext.startsWith(".")
      ? assetMetadata.ext
      : `.${assetMetadata.ext}`;
    const mimeType = mime.getType(ext);
    contentType = mimeType || "application/octet-stream";
  }
  else {
    const ext = path.extname(assetPath);
    const mimeType = mime.getType(ext);
    contentType = mimeType || "application/octet-stream";
  }

  // 提供服务资源
  try {
    let body: ArrayBuffer;
    if (isRemoteBundlePath) {
      const response = await fetch(assetPath);
      if (!response.ok) {
        return c.json(
          {
            success: false,
            error: {
              code: "ASSET_NOT_FOUND",
              message: `Asset "${assetName}" does not exist.`,
            },
          },
          404,
        );
      }
      body = await response.arrayBuffer();
      const remoteContentType = response.headers.get("content-type");
      c.header("content-type", remoteContentType || contentType);
    }
    else {
      try {
        await fs.access(assetPath, fs.constants.F_OK);
      }
      catch {
        return c.json(
          {
            success: false,
            error: {
              code: "ASSET_NOT_FOUND",
              message: `Asset "${assetName}" does not exist.`,
            },
          },
          404,
        );
      }
      const asset = await fs.readFile(assetPath);
      c.header("content-type", contentType);
      body = Uint8Array.from(asset).buffer;
    }

    return new Response(body, {
      headers: c.res.headers,
      status: 200,
    });
  }
  catch (error: any) {
    return c.json(
      {
        success: false,
        error: {
          code: "FILE_READ_ERROR",
          message: error.message,
        },
      },
      500,
    );
  }
};

interface ResolveUpdateBundlePathParams {
  runtimeVersion: string;
  appId?: string | null;
  deviceId?: string | null;
  userId?: string | null;
  platform?: string | null;
  trackDevice?: boolean;
}

interface ResolveUpdateBundlePathSuccess {
  ok: true;
  updateBundlePath: string;
  targetVersionId?: string | null;
  appId?: string;
  appUserId?: string | null;
}

interface ResolveUpdateBundlePathFailure {
  ok: false;
  status: 403 | 404;
  error: {
    code: string;
    message: string;
  };
}

type ResolveUpdateBundlePathResult
  = | ResolveUpdateBundlePathSuccess
    | ResolveUpdateBundlePathFailure;

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function normalizeBundlePathFromFileUrl(fileUrl: string) {
  if (isHttpUrl(fileUrl)) {
    const url = new URL(fileUrl);
    if (url.pathname.endsWith("/metadata.json")) {
      url.pathname = url.pathname.slice(0, -"/metadata.json".length);
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  }

  const normalized = fileUrl.replace(/\\/g, "/");
  return normalized.endsWith("/metadata.json")
    ? normalized.slice(0, -"/metadata.json".length)
    : normalized;
}

async function resolveUpdateBundlePath(
  params: ResolveUpdateBundlePathParams,
): Promise<ResolveUpdateBundlePathResult> {
  const { runtimeVersion, appId, deviceId, userId, platform, trackDevice = false }
    = params;

  if (!appId) {
    try {
      const updateBundlePath
        = await getLatestUpdateBundlePathForRuntimeVersionAsync(
          runtimeVersion,
          "uploads",
        );
      return {
        ok: true,
        updateBundlePath,
        targetVersionId: null,
        appId: undefined,
      };
    }
    catch (error: any) {
      return {
        ok: false,
        status: 404,
        error: {
          code: "UPDATE_NOT_FOUND",
          message: error.message,
        },
      };
    }
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.appId, appId),
  });

  if (!app) {
    return {
      ok: false,
      status: 404,
      error: {
        code: "APP_NOT_FOUND",
        message: `App with id ${appId} not found.`,
      },
    };
  }

  if (app.status !== "active") {
    // 如果 trackDevice 为 true，记录更新失败
    // 注意：此时可能还没有 appUser，需要先查询
    if (trackDevice && app.currentVersionId) {
      let appUserIdForStats: string | null = null;
      if (deviceId) {
        const foundUser = await db.query.appUsers.findFirst({
          where: and(eq(appUsers.appId, app.id), eq(appUsers.deviceId, deviceId)),
        });
        appUserIdForStats = foundUser?.id || null;
      }
      await updateTaskStats(app.currentVersionId, app.id, false, appUserIdForStats);
    }
    return {
      ok: false,
      status: 403,
      error: {
        code: "APP_INACTIVE",
        message: `App ${appId} is inactive.`,
      },
    };
  }

  // 先查询用户（如果存在），用于确定 targetVersionId
  let appUser: typeof appUsers.$inferSelect | null = null;
  if (deviceId) {
    const foundUser = await db.query.appUsers.findFirst({
      where: and(eq(appUsers.appId, app.id), eq(appUsers.deviceId, deviceId)),
    });
    appUser = foundUser ?? null;
  }

  // 确定 targetVersionId
  let targetVersionId: string | null = null;

  if (appUser?.targetVersionId) {
    targetVersionId = appUser.targetVersionId;
  }
  else if (appUser) {
    const userGroupMember = await db.query.userGroupMembers.findFirst({
      where: eq(userGroupMembers.appUserId, appUser.id),
      columns: { groupId: true },
    });

    if (userGroupMember) {
      const group = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, userGroupMember.groupId),
        columns: {
          id: true,
          targetVersionId: true,
          appId: true,
        },
      });

      if (
        group?.targetVersionId
        && group.appId === app.id
      ) {
        targetVersionId = group.targetVersionId;
      }
    }
  }

  if (!targetVersionId && app.currentVersionId) {
    targetVersionId = app.currentVersionId;
  }

  // 获取目标版本信息
  let targetUpdateBundlePath: string | null = null;
  if (targetVersionId) {
    const version = await db.query.versions.findFirst({
      where: and(eq(versions.id, targetVersionId), eq(versions.appId, app.id)),
    });

    if (!version) {
      // 如果 trackDevice 为 true，记录更新失败
      if (trackDevice) {
        await updateTaskStats(targetVersionId, app.id, false, appUser?.id || null);
      }
      return {
        ok: false,
        status: 404,
        error: {
          code: "VERSION_NOT_FOUND",
          message: `Target version ${targetVersionId} not found.`,
        },
      };
    }

    if (version.status !== "published") {
      // 如果 trackDevice 为 true，记录更新失败
      if (trackDevice) {
        await updateTaskStats(targetVersionId, app.id, false, appUser?.id || null);
      }
      return {
        ok: false,
        status: 404,
        error: {
          code: "VERSION_NOT_PUBLISHED",
          message: `Version ${version.version} is not published.`,
        },
      };
    }

    const normalizedBundlePath = normalizeBundlePathFromFileUrl(version.fileUrl);
    targetUpdateBundlePath = isHttpUrl(normalizedBundlePath)
      ? normalizedBundlePath
      : path.isAbsolute(normalizedBundlePath)
        ? path.join(process.cwd(), normalizedBundlePath)
        : path.join(process.cwd(), "uploads", normalizedBundlePath);

    if (!isHttpUrl(targetUpdateBundlePath)) {
      try {
        await fs.access(targetUpdateBundlePath, fs.constants.F_OK);
      }
      catch {
        // 如果 trackDevice 为 true，记录更新失败
        if (trackDevice) {
          await updateTaskStats(targetVersionId, app.id, false, appUser?.id || null);
        }
        return {
          ok: false,
          status: 404,
          error: {
            code: "UPDATE_NOT_FOUND",
            message: `Update bundle not found at ${targetUpdateBundlePath}.`,
          },
        };
      }
    }
  }

  // 更新或插入用户信息（在确定 targetVersionId 之后）
  if (trackDevice && deviceId) {
    if (appUser) {
      // 更新现有用户
      await db
        .update(appUsers)
        .set({
          // 如果有目标版本，使用目标版本的ID，否则保持原值
          currentVersionId: targetVersionId || appUser.currentVersionId,
          lastUpdateAt: new Date(),
          userId: userId || appUser.userId,
          platform: platform || appUser.platform,
          status: "online",
          updatedAt: new Date(),
        })
        .where(eq(appUsers.id, appUser.id));
    }
    else {
      // 插入新用户
      const [{ id: newUserId }] = await db
        .insert(appUsers)
        .values({
          appId: app.id,
          deviceId,
          userId: userId || null,
          platform: platform || null,
          // 如果有目标版本，使用目标版本的ID
          currentVersionId: targetVersionId || null,
          lastUpdateAt: new Date(),
          status: "online",
        })
        .$returningId();
      const newUser = await db.query.appUsers.findFirst({
        where: eq(appUsers.id, newUserId),
      });
      appUser = newUser ?? null;
    }
  }

  // 如果找到了目标版本，返回对应的 updateBundlePath
  if (targetUpdateBundlePath && targetVersionId) {
    return {
      ok: true,
      updateBundlePath: targetUpdateBundlePath,
      targetVersionId,
      appId: app.id,
      appUserId: appUser?.id || null,
    };
  }

  try {
    const updateBundlePath
      = await getLatestUpdateBundlePathForRuntimeVersionAsync(
        runtimeVersion,
        "uploads",
        appId || undefined,
      );
    return {
      ok: true,
      updateBundlePath,
      targetVersionId: targetVersionId || null,
      appId: app.id,
      appUserId: appUser?.id || null,
    };
  }
  catch (error: any) {
    // 如果 trackDevice 为 true，记录更新失败
    if (trackDevice) {
      const versionId = targetVersionId || app.currentVersionId;
      if (versionId) {
        await updateTaskStats(versionId, app.id, false, appUser?.id || null);
      }
    }
    return {
      ok: false,
      status: 404,
      error: {
        code: "UPDATE_NOT_FOUND",
        message: error.message,
      },
    };
  }
}

/**
 * 更新更新任务的统计信息
 * @param versionId 版本ID
 * @param appId 应用ID
 * @param isSuccess 是否成功
 * @param appUserId 应用用户ID（可选，用于记录成功/失败的用户列表）
 */
async function updateTaskStats(
  versionId: string,
  appId: string,
  isSuccess: boolean,
  appUserId?: string | null,
): Promise<void> {
  try {
    // 查找指向该版本的待处理或进行中的更新任务
    const tasks = await db.query.updateTasks.findMany({
      where: and(
        eq(updateTasks.versionId, versionId),
        eq(updateTasks.appId, appId),
        or(
          eq(updateTasks.status, "pending"),
          eq(updateTasks.status, "in_progress"),
        ),
      ),
      orderBy: [desc(updateTasks.createdAt)],
      limit: 1, // 只更新最新的任务
    });

    if (tasks.length > 0) {
      const task = tasks[0];
      const currentSuccessCount = task.successCount || 0;
      const currentFailureCount = task.failureCount || 0;

      // 解析现有的成功和失败用户ID列表
      let successUserIds: string[] = [];
      let failureUserIds: string[] = [];

      if (task.successUserIds) {
        try {
          successUserIds = JSON.parse(task.successUserIds) as string[];
        }
        catch {
          successUserIds = [];
        }
      }

      if (task.failureUserIds) {
        try {
          failureUserIds = JSON.parse(task.failureUserIds) as string[];
        }
        catch {
          failureUserIds = [];
        }
      }

      // 如果提供了 appUserId，检查是否已记录（去重逻辑）
      // 同一个版本、同一个用户只记录一次，不论成功失败
      let shouldUpdate = true;
      if (appUserId) {
        // 如果用户已经在成功列表或失败列表中，则不重复记录
        if (successUserIds.includes(appUserId) || failureUserIds.includes(appUserId)) {
          shouldUpdate = false;
        }
        else {
          // 用户未记录过，添加到对应的列表
          if (isSuccess) {
            successUserIds.push(appUserId);
          }
          else {
            failureUserIds.push(appUserId);
          }
        }
      }

      if (shouldUpdate) {
        const updateData: Partial<typeof updateTasks.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (appUserId) {
          // 更新用户ID列表
          updateData.successUserIds = JSON.stringify(successUserIds);
          updateData.failureUserIds = JSON.stringify(failureUserIds);
          // 更新计数（基于列表长度）
          updateData.successCount = successUserIds.length;
          updateData.failureCount = failureUserIds.length;
        }
        else {
          // 如果没有 appUserId，只更新计数
          updateData.successCount = isSuccess ? currentSuccessCount + 1 : currentSuccessCount;
          updateData.failureCount = isSuccess ? currentFailureCount : currentFailureCount + 1;
        }

        await db
          .update(updateTasks)
          .set(updateData)
          .where(eq(updateTasks.id, task.id));
      }
    }
  }
  catch (error) {
    // 静默失败，不影响主流程
    console.error("Failed to update task stats:", error);
  }
}
