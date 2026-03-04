import type { Dictionary } from "structured-headers";

import mime from "mime";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { serializeDictionary } from "structured-headers";

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function joinUpdatePath(basePath: string, filePath: string) {
  if (isHttpUrl(basePath)) {
    return new URL(filePath, ensureTrailingSlash(basePath)).toString();
  }
  return path.join(basePath, filePath);
}

async function readFileBufferAny(filePath: string): Promise<Buffer> {
  if (isHttpUrl(filePath)) {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  return fs.readFile(filePath);
}

/**
 * SHA256 哈希转 UUID
 */
export function convertSHA256HashToUUID(hash: string): string {
  const hex = Buffer.from(hash, "base64url").toString("hex");
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join("-");
}

/**
 * 获取文件的 SHA256 哈希
 */
export async function getFileHashAsync(filePath: string): Promise<string> {
  const buffer = await readFileBufferAny(filePath);
  const hash = crypto.createHash("sha256").update(buffer).digest("base64url");
  return hash;
}

/**
 * 从文件路径获取 MIME 类型
 */
export function getMimeType(filePath: string, isLaunchAsset: boolean): string {
  if (isLaunchAsset) {
    return "application/javascript";
  }

  const ext = path.extname(filePath);
  const mimeType = mime.getType(ext);
  return mimeType || "application/octet-stream";
}

/**
 * RSA-SHA256 签名
 */
export function signRSASHA256(data: string, privateKey: string): string {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data, "utf8");
  sign.end();
  return sign.sign(privateKey, "base64");
}

/**
 * 获取私钥
 */
export async function getPrivateKeyAsync(): Promise<string | null> {
  // eslint-disable-next-line node/no-process-env
  const privateKeyPath = process.env.PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return null;
  }
  try {
    const pemBuffer = await fs.readFile(privateKeyPath);
    return pemBuffer.toString("utf8");
  }
  catch {
    return null;
  }
}

/**
 * 转换为字典项表示
 */
export function convertToDictionaryItemsRepresentation(
  obj: Record<string, string>,
): Dictionary {
  return new Map(Object.entries(obj).map(([k, v]) => [k, [v, new Map()]]));
}

/**
 * 序列化签名字典
 */
export function serializeSignature(dictionary: Dictionary): string {
  return serializeDictionary(dictionary);
}

/**
 * 检查更新目录是否存在
 */
export async function checkUpdateDirectoryExists(
  updatePath: string,
): Promise<boolean> {
  if (isHttpUrl(updatePath)) {
    try {
      const response = await fetch(updatePath, { method: "HEAD" });
      if (response.ok) {
        return true;
      }
      const fallback = await fetch(updatePath);
      return fallback.ok;
    }
    catch {
      return false;
    }
  }
  try {
    await fs.access(updatePath, fs.constants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

/**
 * 获取最新更新包路径
 */
export async function getLatestUpdateBundlePathForRuntimeVersionAsync(
  runtimeVersion: string,
  baseDir: string = "uploads",
  appId?: string,
): Promise<string> {
  // 如果提供了 appId，路径结构为: updates/{appId}/{runtimeVersion}/...
  // 否则保持向后兼容: updates/{runtimeVersion}/...
  let runtimeDir: string;
  if (appId) {
    runtimeDir = path.join(process.cwd(), baseDir, appId, runtimeVersion);
  }
  else {
    runtimeDir = path.join(process.cwd(), baseDir, runtimeVersion);
  }

  // 检查 runtime 目录是否存在
  const exists = await checkUpdateDirectoryExists(runtimeDir);
  if (!exists) {
    if (appId) {
      throw new Error(
        `No updates found for app ${appId} with runtime version: ${runtimeVersion}`,
      );
    }
    else {
      throw new Error(
        `No updates found for runtime version: ${runtimeVersion}`,
      );
    }
  }

  // 读取所有更新目录
  const entries = await fs.readdir(runtimeDir, { withFileTypes: true });
  const directories = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .reverse();

  if (directories.length === 0) {
    if (appId) {
      throw new Error(
        `No updates found for app ${appId} with runtime version: ${runtimeVersion}`,
      );
    }
    else {
      throw new Error(
        `No updates found for runtime version: ${runtimeVersion}`,
      );
    }
  }

  // 返回最新的更新目录
  return path.join(runtimeDir, directories[0]);
}

/**
 * 读取更新元数据
 */
export async function getMetadataAsync(updateBundlePath: string): Promise<{
  metadataJson: any;
  createdAt: string;
  id: string;
}> {
  const metadataPath = joinUpdatePath(updateBundlePath, "metadata.json");

  try {
    const metadataBuffer = await readFileBufferAny(metadataPath);
    const metadataContent = metadataBuffer.toString("utf-8");
    const metadataJson = JSON.parse(metadataContent);

    // 尝试从 exup 文件获取哈希作为 ID
    const exupPath = path.join(updateBundlePath, "shell-app-manifest.exup");
    let id: string;

    if (await checkUpdateDirectoryExists(exupPath)) {
      id = await getFileHashAsync(exupPath);
    }
    else {
      // 如果没有 exup 文件，使用 metadata 的哈希
      id = crypto
        .createHash("sha256")
        .update(JSON.stringify(metadataJson))
        .digest("base64url");
    }

    return {
      metadataJson,
      createdAt: new Date().toISOString(),
      id,
    };
  }
  catch (error) {
    throw new Error(`Failed to read metadata: ${error}`);
  }
}

/**
 * 获取资源元数据
 */
export async function getAssetMetadataAsync(params: {
  updateBundlePath: string;
  filePath: string;
  ext: string | null;
  runtimeVersion: string;
  platform: string;
  isLaunchAsset: boolean;
  baseUrl?: string;
}): Promise<{
  hash?: string;
  key: string;
  fileExtension?: string | null;
  contentType: string;
  url: string;
  size?: number;
}> {
  const {
    updateBundlePath,
    filePath,
    ext,
    runtimeVersion,
    platform,
    isLaunchAsset,
    // eslint-disable-next-line node/no-process-env
    baseUrl = process.env.UPDATES_BASE_URL || "http://localhost:9999",
  } = params;

  // 提取资源 key（文件名，不包含扩展名）
  const fileName = path.basename(filePath);
  const key = isLaunchAsset ? fileName.replace(/\.(js|bundle)$/, "") : fileName;

  const contentType = getMimeType(filePath, isLaunchAsset);

  const assetUrl = isHttpUrl(updateBundlePath)
    // 远程存储（如 OSS）时，直接使用 metadata 所在目录拼接资源路径
    ? joinUpdatePath(updateBundlePath, filePath)
    // 本地存储时，继续走 API assets 端点
    : (() => {
        const localAssetUrl = new URL("/api/expo-updates/assets", baseUrl);
        localAssetUrl.searchParams.set("asset", filePath);
        localAssetUrl.searchParams.set("runtimeVersion", runtimeVersion);
        localAssetUrl.searchParams.set("platform", platform);
        return localAssetUrl.toString();
      })();

  return {
    key,
    fileExtension: ext ? `.${ext}` : isLaunchAsset ? ".bundle" : null,
    contentType,
    url: assetUrl,
  };
}

/**
 * 获取 Expo 配置
 */
export async function getExpoConfigAsync(
  updateBundlePath: string,
): Promise<any> {
  const expoConfigPath = joinUpdatePath(updateBundlePath, "expoConfig.json");

  try {
    const configBuffer = await readFileBufferAny(expoConfigPath);
    const configContent = configBuffer.toString("utf-8");
    return JSON.parse(configContent);
  }
  catch {
    // 如果无法读取配置，返回空对象
    return {};
  }
}

/**
 * 创建回滚指令
 */
export async function createRollBackDirectiveAsync(
  updateBundlePath: string,
): Promise<{
  type: string;
  parameters: {
    commitTime: string;
  };
}> {
  const rollbackPath = joinUpdatePath(updateBundlePath, "rollback");

  try {
    const rollbackBuffer = await readFileBufferAny(rollbackPath);
    const rollbackContent = rollbackBuffer.toString("utf-8");
    const rollbackData = JSON.parse(rollbackContent);

    return {
      type: "rollBackToEmbedded",
      parameters: {
        commitTime: rollbackData.commitTime || new Date().toISOString(),
      },
    };
  }
  catch {
    throw new Error("Rollback file not found");
  }
}

/**
 * 检查是否存在 rollback 标记
 */
export async function checkRollbackExists(
  updateBundlePath: string,
): Promise<boolean> {
  const rollbackPath = joinUpdatePath(updateBundlePath, "rollback");
  try {
    if (isHttpUrl(rollbackPath)) {
      const response = await fetch(rollbackPath, { method: "HEAD" });
      if (response.ok) {
        return true;
      }
      const fallback = await fetch(rollbackPath);
      return fallback.ok;
    }
    await fs.access(rollbackPath, fs.constants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

/**
 * 创建无更新指令
 */
export function createNoUpdateDirective(): {
  type: string;
  parameters: Record<string, unknown>;
} {
  return {
    type: "noUpdateAvailable",
    parameters: {},
  };
}
