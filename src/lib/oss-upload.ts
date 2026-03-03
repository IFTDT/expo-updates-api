import OSS from "ali-oss";
import { readdir } from "node:fs/promises";
import path from "node:path";

import env from "@/env";

const toPosixPath = (value: string) => value.split(path.sep).join(path.posix.sep);

function createOssClient() {
  const {
    OSS_REGION,
    OSS_BUCKET,
    OSS_ACCESS_KEY_ID,
    OSS_ACCESS_KEY_SECRET,
  } = env;

  if (!OSS_REGION || !OSS_BUCKET || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw new Error("OSS 配置缺失，请检查 OSS_REGION、OSS_BUCKET、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET");
  }

  return new OSS({
    region: OSS_REGION,
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
  });
}

async function collectFilesRecursively(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectFilesRecursively(absolutePath);
    }
    if (entry.isFile()) {
      return [absolutePath];
    }
    return [];
  }));
  return nested.flat();
}

export async function uploadDirectoryToOss(storageDir: string, objectPrefix: string) {
  const ossClient = createOssClient();
  const files = await collectFilesRecursively(storageDir);

  for (const absolutePath of files) {
    const relativePath = path.relative(storageDir, absolutePath);
    if (!relativePath || relativePath.startsWith("..")) {
      continue;
    }
    const objectKey = path.posix.join(objectPrefix, toPosixPath(relativePath));
    try {
      await ossClient.put(objectKey, absolutePath);
    }
    catch (error) {
      console.error(`Failed to upload file ${absolutePath} to OSS with key ${objectKey}`, error);
      throw error;
    }
  }

  return files.length;
}

export function buildOssFileUrl(objectKey: string): string {
  const normalizedKey = objectKey.replace(/^\/+/, "");
  const { OSS_ENDPOINT, OSS_BUCKET, OSS_REGION } = env;

  if (OSS_ENDPOINT) {
    const endpoint = OSS_ENDPOINT.startsWith("http://") || OSS_ENDPOINT.startsWith("https://")
      ? OSS_ENDPOINT
      : `https://${OSS_ENDPOINT}`;
    return `${endpoint.replace(/\/+$/, "")}/${normalizedKey}`;
  }

  if (!OSS_BUCKET || !OSS_REGION) {
    throw new Error("OSS 配置缺失，请检查 OSS_BUCKET、OSS_REGION 或 OSS_ENDPOINT");
  }

  return `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com/${normalizedKey}`;
}
