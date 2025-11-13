import { and, eq } from "drizzle-orm";
import FormData from "form-data";
import mime from "mime";
import fs from "node:fs/promises";
import path from "node:path";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, appUsers, userGroupMembers, versions } from "@/db/schema";
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

  const { updateBundlePath } = bundleResult;

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
  if (path.isAbsolute(assetName)) {
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

  // 检查资源是否存在
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

  // 确定资源类型
  const relativePath = path.relative(updateBundlePath, assetPath);
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
    const asset = await fs.readFile(assetPath);

    c.header("content-type", contentType);

    const body = new Uint8Array(asset);

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
  trackDevice?: boolean;
}

interface ResolveUpdateBundlePathSuccess {
  ok: true;
  updateBundlePath: string;
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

async function resolveUpdateBundlePath(
  params: ResolveUpdateBundlePathParams,
): Promise<ResolveUpdateBundlePathResult> {
  const { runtimeVersion, appId, deviceId, userId, trackDevice = false }
    = params;

  if (!appId) {
    try {
      const updateBundlePath
        = await getLatestUpdateBundlePathForRuntimeVersionAsync(
          runtimeVersion,
          "uploads",
        );
      return { ok: true, updateBundlePath };
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
    return {
      ok: false,
      status: 403,
      error: {
        code: "APP_INACTIVE",
        message: `App ${appId} is inactive.`,
      },
    };
  }

  let appUser: typeof appUsers.$inferSelect | null = null;
  if (deviceId) {
    const foundAppUser = await db.query.appUsers.findFirst({
      where: and(eq(appUsers.appId, app.id), eq(appUsers.deviceId, deviceId)),
    });

    if (foundAppUser) {
      appUser = foundAppUser;
      if (trackDevice) {
        await db
          .update(appUsers)
          .set({
            currentVersion: runtimeVersion,
            lastUpdateAt: new Date(),
            userId: userId || foundAppUser.userId,
            status: "online",
            updatedAt: new Date(),
          })
          .where(eq(appUsers.id, foundAppUser.id));
      }
    }
    else if (trackDevice) {
      const [newAppUser] = await db
        .insert(appUsers)
        .values({
          appId: app.id,
          deviceId,
          userId: userId || null,
          currentVersion: runtimeVersion,
          lastUpdateAt: new Date(),
          status: "online",
        })
        .returning();
      appUser = newAppUser;
    }
  }

  let targetVersionId: string | null = null;

  if (appUser?.targetVersionId) {
    targetVersionId = appUser.targetVersionId;
  }
  else if (appUser) {
    const userGroupMember = await db.query.userGroupMembers.findFirst({
      where: eq(userGroupMembers.appUserId, appUser.id),
      with: {
        group: {
          columns: {
            id: true,
            targetVersionId: true,
            appId: true,
          },
        },
      },
    });

    if (
      userGroupMember?.group?.targetVersionId
      && userGroupMember.group.appId === app.id
    ) {
      targetVersionId = userGroupMember.group.targetVersionId;
    }
  }

  if (!targetVersionId && app.currentVersionId) {
    targetVersionId = app.currentVersionId;
  }

  if (targetVersionId) {
    const version = await db.query.versions.findFirst({
      where: and(eq(versions.id, targetVersionId), eq(versions.appId, app.id)),
    });

    if (!version) {
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
      return {
        ok: false,
        status: 404,
        error: {
          code: "VERSION_NOT_PUBLISHED",
          message: `Version ${version.version} is not published.`,
        },
      };
    }

    const updateBundlePath = path.isAbsolute(version.fileUrl)
      ? path.join(process.cwd(), version.fileUrl)
      : path.join(process.cwd(), "uploads", version.fileUrl);

    try {
      await fs.access(updateBundlePath, fs.constants.F_OK);
    }
    catch {
      return {
        ok: false,
        status: 404,
        error: {
          code: "UPDATE_NOT_FOUND",
          message: `Update bundle not found at ${updateBundlePath}.`,
        },
      };
    }

    return { ok: true, updateBundlePath };
  }

  try {
    const updateBundlePath
      = await getLatestUpdateBundlePathForRuntimeVersionAsync(
        runtimeVersion,
        "uploads",
        appId || undefined,
      );
    return { ok: true, updateBundlePath };
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
