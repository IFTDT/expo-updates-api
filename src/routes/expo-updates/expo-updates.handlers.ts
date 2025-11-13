import { and, eq } from "drizzle-orm";
import FormData from "form-data";
import mime from "mime";
import fs from "node:fs/promises";
import path from "node:path";

import type { AppRouteHandler } from "@/lib/types";

import db from "@/db";
import { apps, appUsers } from "@/db/schema";
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
  const runtimeVersion =
    c.req.header("expo-runtime-version") || c.req.query("runtime-version");
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

  // 提取应用包名和设备/用户信息
  const appId = c.req.header("x-app-id") || c.req.query("app-id");
  const deviceId = c.req.header("x-device-id") || c.req.query("device-id");
  const userId = c.req.header("x-user-id") || c.req.query("user-id");

  // 如果提供了 appId，验证应用是否存在
  let app: typeof apps.$inferSelect | null = null;
  if (appId) {
    app = await db.query.apps.findFirst({
      where: eq(apps.appId, appId),
    });

    if (!app) {
      return c.json(
        {
          success: false,
          error: {
            code: "APP_NOT_FOUND",
            message: `App with id ${appId} not found.`,
          },
        },
        404,
      );
    }

    // 如果应用已停用，返回错误
    if (app.status !== "active") {
      return c.json(
        {
          success: false,
          error: {
            code: "APP_INACTIVE",
            message: `App ${appId} is inactive.`,
          },
        },
        403,
      );
    }

    // 如果提供了 deviceId，记录或更新设备信息
    if (deviceId) {
      const existingAppUser = await db.query.appUsers.findFirst({
        where: and(eq(appUsers.appId, app.id), eq(appUsers.deviceId, deviceId)),
      });

      if (existingAppUser) {
        // 更新设备信息
        await db
          .update(appUsers)
          .set({
            currentVersion: runtimeVersion,
            lastUpdateAt: new Date(),
            userId: userId || existingAppUser.userId,
            status: "online",
            updatedAt: new Date(),
          })
          .where(eq(appUsers.id, existingAppUser.id));
      } else {
        // 创建新设备记录
        await db.insert(appUsers).values({
          appId: app.id,
          deviceId,
          userId: userId || null,
          currentVersion: runtimeVersion,
          lastUpdateAt: new Date(),
          status: "online",
        });
      }
    }
  }

  // 查找最新更新包（如果提供了 appId，使用 appId 查找）
  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(
      runtimeVersion,
      "uploads",
      appId || undefined,
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: {
          code: "UPDATE_NOT_FOUND",
          message: error.message,
        },
      },
      404,
    );
  }

  try {
    // 读取元数据
    const { metadataJson, createdAt, id } =
      await getMetadataAsync(updateBundlePath);
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
    } else if (
      protocolVersion === 0 &&
      clientCurrentUpdateId === currentUpdateId
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

    return new Response(form.getBuffer(), {
      headers: c.res.headers,
      status: 200,
    });
  } catch (error: any) {
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

  return new Response(form.getBuffer(), {
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

  return new Response(form.getBuffer(), {
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
          message: 'No platform provided. Expected "ios" or "android".',
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

  // 如果提供了 appId，验证应用是否存在
  if (appId) {
    const app = await db.query.apps.findFirst({
      where: eq(apps.appId, appId),
    });

    if (!app) {
      return c.json(
        {
          success: false,
          error: {
            code: "APP_NOT_FOUND",
            message: `App with id ${appId} not found.`,
          },
        },
        404,
      );
    }

    if (app.status !== "active") {
      return c.json(
        {
          success: false,
          error: {
            code: "APP_INACTIVE",
            message: `App ${appId} is inactive.`,
          },
        },
        403,
      );
    }
  }

  // 定位更新包（如果提供了 appId，使用 appId 查找）
  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(
      runtimeVersion,
      "uploads",
      appId || undefined,
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: {
          code: "UPDATE_NOT_FOUND",
          message: error.message,
        },
      },
      404,
    );
  }
  console.log("updateBundlePath", updateBundlePath);

  // 加载元数据以确定资源类型
  let metadataJson: any;
  try {
    const { metadataJson: meta } = await getMetadataAsync(updateBundlePath);
    metadataJson = meta;
  } catch (error: any) {
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
  } else {
    // 如果是相对路径，尝试相对于更新包路径或工作目录
    if (assetName.startsWith(updateBundlePath)) {
      assetPath = path.resolve(assetName);
    } else {
      // 尝试在更新包目录中查找
      assetPath = path.join(updateBundlePath, assetName);
    }
  }

  console.log("assetPath", assetPath);

  // 检查资源是否存在
  try {
    await fs.access(assetPath, fs.constants.F_OK);
  } catch {
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

  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === relativePath;

  // 确定 MIME 类型
  let contentType: string;
  if (isLaunchAsset) {
    contentType = "application/javascript";
  } else if (assetMetadata?.ext) {
    const ext = assetMetadata.ext.startsWith(".")
      ? assetMetadata.ext
      : `.${assetMetadata.ext}`;
    const mimeType = mime.getType(ext);
    contentType = mimeType || "application/octet-stream";
  } else {
    const ext = path.extname(assetPath);
    const mimeType = mime.getType(ext);
    contentType = mimeType || "application/octet-stream";
  }

  // 提供服务资源
  try {
    const asset = await fs.readFile(assetPath);

    c.header("content-type", contentType);

    return new Response(asset, {
      headers: c.res.headers,
      status: 200,
    });
  } catch (error: any) {
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
