# Expo Updates API 使用文档

本文档详细说明如何使用 Expo Updates 服务端接口进行热更新。

## 📋 目录

- [概述](#概述)
- [重要说明](#重要说明)
- [API 端点](#api-端点)
- [Manifest API](#manifest-api)
- [Assets API](#assets-api)
- [客户端配置](#客户端配置)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)

## 概述

Expo Updates API 提供两个核心端点：

1. **Manifest API**：获取更新清单，包含可用的更新信息
2. **Assets API**：下载具体的资源文件（JavaScript bundle 和静态资源）

### 多应用分发管理

本项目支持多应用分发管理，允许根据应用包名（app-id）和用户标识（device-id/user-id）为不同的应用和用户提供特定的更新包。

**关键特性：**

- 📦 **按应用分发**：通过 `x-app-id` 或 `app-id` 参数指定应用包名，系统会从该应用的更新包目录中查找更新
- 👤 **用户识别**：通过 `x-device-id` 或 `device-id` 参数记录设备信息，用于追踪更新状态
- 📊 **设备管理**：系统自动记录和更新设备的版本信息、最后更新时间等

**更新包目录结构：**

```
updates/
├── {appId}/                    # 应用包名目录（如 com.example.app）
│   └── {runtimeVersion}/        # 运行时版本目录（如 1.0.0）
│       └── {timestamp}/         # 更新包目录（如 1234567890）
│           ├── metadata.json
│           ├── bundles/
│           └── assets/
└── {runtimeVersion}/            # 向后兼容：无 appId 时的旧结构
    └── {timestamp}/
        ├── metadata.json
        ├── bundles/
        └── assets/
```

### 更新流程

```
客户端应用启动
    ↓
Expo Updates SDK 自动请求 Manifest API
    (包含 app-id, device-id, runtime-version 等参数)
    ↓
服务器验证应用存在性和状态
    ↓
服务器记录设备信息到数据库（如果提供了 device-id）
    ↓
SDK 解析 Manifest，获取更新信息
    ↓
如果有更新，SDK 自动下载 Assets
    ↓
应用更新到新版本
```

## 重要说明

### 使用 Expo Updates SDK（推荐方式）

**如果你使用的是 Expo Updates SDK（`expo-updates`），你不需要手动调用任何接口！**

Expo Updates SDK 会自动处理所有与服务器的交互：

1. ✅ **客户端**：只需要在 `app.json` 中配置更新服务器 URL
2. ✅ **服务端**：只需要实现对应的接口端点（Manifest API 和 Assets API）
3. ✅ **SDK 自动**：自动调用 Manifest API 检查更新、自动下载 Assets、自动应用更新

#### 客户端配置示例

```json
{
  "expo": {
    "updates": {
      "url": "http://localhost:9999/api/expo-updates/manifest",
      "enabled": true
    }
  }
}
```

#### 客户端代码示例

```typescript
import * as Updates from "expo-updates";

// Expo Updates SDK 会自动调用服务端接口
// 你只需要调用 SDK 的方法即可
const update = await Updates.checkForUpdateAsync();
if (update.isAvailable) {
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
```

#### 多应用分发：添加自定义 Header（Expo SDK 53+）

如果你需要多应用分发管理（添加 `x-app-id`、`x-device-id` 等自定义 Header），Expo SDK 53+ 提供了 `Updates.setUpdateURLAndRequestHeadersOverride()` 方法：

```typescript
import Constants from "expo-constants";
import * as Updates from "expo-updates";

// 在应用启动时设置自定义 Header
async function configureUpdates() {
  // 获取应用包名和设备信息
  const appId = Constants.expoConfig?.ios?.bundleIdentifier
    || Constants.expoConfig?.android?.package
    || "com.example.app";

  // 获取设备 ID（可以使用 expo-device 或其他库）
  const deviceId = await getDeviceId(); // 你需要实现这个函数

  // 获取用户 ID（从你的用户系统）
  const userId = await getUserId(); // 你需要实现这个函数

  // 设置自定义 URL 和 Header（Expo SDK 53+）
  // 注意：这个方法需要在检查更新之前调用
  if (Updates.setUpdateURLAndRequestHeadersOverride) {
    Updates.setUpdateURLAndRequestHeadersOverride(
      Updates.configuration?.updateUrl || "http://localhost:9999/api/expo-updates/manifest",
      {
        "x-app-id": appId,
        "x-device-id": deviceId,
        ...(userId && { "x-user-id": userId }),
      }
    );
  }
}

// 在应用启动时调用
configureUpdates();

// 然后正常使用 Expo Updates SDK
async function checkForUpdates() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  }
  catch (error) {
    console.error("检查更新失败:", error);
  }
}
```

**注意：**

- `setUpdateURLAndRequestHeadersOverride` 方法在 Expo SDK 53+ 中可用
- 如果你的 Expo SDK 版本低于 53，需要使用其他方法（见下方"备选方案"）

### 多应用分发：使用 Query 参数（备选方案）

如果你的 Expo SDK 版本低于 53，或者 `setUpdateURLAndRequestHeadersOverride` 方法不可用，可以使用 **Query 参数** 的方式：

```typescript
import Constants from "expo-constants";
import * as Updates from "expo-updates";

// 在 app.json 中配置带 Query 参数的 URL
// {
//   "expo": {
//     "updates": {
//       "url": "http://localhost:9999/api/expo-updates/manifest?app-id={APP_ID}&device-id={DEVICE_ID}",
//       "enabled": true
//     }
//   }
// }

// 或者在运行时动态构建 URL
function getUpdateUrl() {
  const appId = Constants.expoConfig?.ios?.bundleIdentifier
    || Constants.expoConfig?.android?.package
    || "com.example.app";
  const deviceId = "device-123456"; // 从你的设备管理系统获取
  const userId = "user-123456"; // 从你的用户系统获取

  const baseUrl = "http://localhost:9999/api/expo-updates/manifest";
  const params = new URLSearchParams({
    "app-id": appId,
    "device-id": deviceId,
  });

  if (userId) {
    params.append("user-id", userId);
  }

  return `${baseUrl}?${params.toString()}`;
}

// 注意：由于 Expo Updates SDK 在构建时读取 app.json，
// 这种方式需要在构建时替换 URL 中的占位符，或者在运行时使用自定义更新逻辑
```

### 手动调用接口（不推荐，但支持完全自定义）

**只有在不使用 Expo Updates SDK，需要自己实现客户端逻辑时，才需要手动调用接口。**

这种情况下，你可以完全控制请求的 Header 和参数：

- 手动调用 Manifest API 获取更新清单（可以添加任意自定义 Header）
- 手动解析 multipart/mixed 响应
- 手动下载所有 Assets
- 手动验证资源完整性
- 手动应用更新

这种方式复杂且容易出错，**强烈建议使用 Expo Updates SDK**。

## 服务端实现要求

**服务端只需要实现以下两个接口端点：**

1. `GET /api/expo-updates/manifest` - Manifest API
2. `GET /api/expo-updates/assets` - Assets API

Expo Updates SDK 会自动使用这些端点，你不需要关心客户端如何调用它们。

## API 端点

### 基础 URL

```
开发环境：http://localhost:9999
生产环境：{UPDATES_BASE_URL}
```

### 端点列表

- `GET /api/expo-updates/manifest` - 获取更新清单
- `GET /api/expo-updates/assets` - 获取资源文件

## Manifest API

### 端点信息

**URL**: `/api/expo-updates/manifest`

**方法**: `GET`

**Content-Type**: `multipart/mixed` (响应)

### 请求参数

#### Header 参数

| 参数名                    | 类型   | 必需 | 说明                                                                                         | 示例                                   |
| ------------------------- | ------ | ---- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| `expo-protocol-version`   | string | 否   | Expo 协议版本，默认为 "0"。Protocol Version 1 支持更多功能（如 rollback、noUpdateAvailable） | "1"                                    |
| `expo-platform`           | string | 是   | 应用平台，必须是 "ios" 或 "android"                                                          | "ios"                                  |
| `expo-runtime-version`    | string | 是   | 应用的运行时版本，必须与服务器端更新包的 runtimeVersion 匹配                                 | "1.0.0"                                |
| `expo-current-update-id`  | string | 否   | 客户端当前安装的更新 ID（UUID 格式）。用于 Protocol Version 1 的 noUpdateAvailable 检查      | "550e8400-e29b-41d4-a716-446655440000" |
| `expo-embedded-update-id` | string | 否   | 应用内置的更新 ID（UUID 格式）。用于 Protocol Version 1 的 rollback 检查                     | "550e8400-e29b-41d4-a716-446655440001" |
| `expo-expect-signature`   | string | 否   | 如果设置为 "true"，服务器将返回签名的 manifest（需要配置 PRIVATE_KEY_PATH）                  | "true"                                 |
| `x-app-id`                | string | 否   | 应用包名（如 com.example.app），用于多应用分发管理。如果提供，将从该应用的更新包中查找更新   | "com.example.app"                      |
| `x-device-id`             | string | 否   | 设备 ID，用于记录设备信息和更新状态                                                          | "device-123456"                        |
| `x-user-id`               | string | 否   | 用户 ID（可选），用于关联用户和设备的更新记录                                                | "user-123456"                          |

#### Query 参数（备选）

如果无法在 Header 中传递参数，也可以使用 Query 参数：

- `platform`: 同 `expo-platform`
- `runtime-version`: 同 `expo-runtime-version`
- `app-id`: 同 `x-app-id`（应用包名）
- `device-id`: 同 `x-device-id`（设备 ID）
- `user-id`: 同 `x-user-id`（用户 ID）

### 请求示例

#### cURL

```bash
# 基本请求（Protocol Version 0）
curl -X GET "http://localhost:9999/api/expo-updates/manifest" \
  -H "expo-platform: ios" \
  -H "expo-runtime-version: 1.0.0"

# Protocol Version 1 请求（支持 rollback 和 noUpdateAvailable）
curl -X GET "http://localhost:9999/api/expo-updates/manifest" \
  -H "expo-protocol-version: 1" \
  -H "expo-platform: ios" \
  -H "expo-runtime-version: 1.0.0" \
  -H "expo-current-update-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "expo-embedded-update-id: 550e8400-e29b-41d4-a716-446655440001"

# 多应用分发请求（包含 app-id 和 device-id）
curl -X GET "http://localhost:9999/api/expo-updates/manifest" \
  -H "expo-platform: ios" \
  -H "expo-runtime-version: 1.0.0" \
  -H "x-app-id: com.example.app" \
  -H "x-device-id: device-123456" \
  -H "x-user-id: user-123456"

# 请求签名（需要服务器配置 PRIVATE_KEY_PATH）
curl -X GET "http://localhost:9999/api/expo-updates/manifest" \
  -H "expo-protocol-version: 1" \
  -H "expo-platform: ios" \
  -H "expo-runtime-version: 1.0.0" \
  -H "expo-expect-signature: true"
```

#### JavaScript (Fetch API)

```javascript
// 基本请求
async function fetchManifest() {
  const response = await fetch("http://localhost:9999/api/expo-updates/manifest", {
    method: "GET",
    headers: {
      "expo-platform": "ios",
      "expo-runtime-version": "1.0.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

// Protocol Version 1 请求
async function fetchManifestV1(currentUpdateId, embeddedUpdateId) {
  const response = await fetch("http://localhost:9999/api/expo-updates/manifest", {
    method: "GET",
    headers: {
      "expo-protocol-version": "1",
      "expo-platform": "ios",
      "expo-runtime-version": "1.0.0",
      "expo-current-update-id": currentUpdateId || "",
      "expo-embedded-update-id": embeddedUpdateId || "",
    },
  });

  return response;
}

// 多应用分发请求（包含 app-id 和 device-id）
async function fetchManifestForApp(appId, deviceId, userId, runtimeVersion, platform) {
  const response = await fetch("http://localhost:9999/api/expo-updates/manifest", {
    method: "GET",
    headers: {
      "expo-platform": platform || "ios",
      "expo-runtime-version": runtimeVersion || "1.0.0",
      "x-app-id": appId,
      "x-device-id": deviceId,
      ...(userId && { "x-user-id": userId }),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
}

// 请求签名
async function fetchManifestWithSignature(currentUpdateId, embeddedUpdateId) {
  const response = await fetch("http://localhost:9999/api/expo-updates/manifest", {
    method: "GET",
    headers: {
      "expo-protocol-version": "1",
      "expo-platform": "ios",
      "expo-runtime-version": "1.0.0",
      "expo-current-update-id": currentUpdateId || "",
      "expo-embedded-update-id": embeddedUpdateId || "",
      "expo-expect-signature": "true",
    },
  });

  return response;
}
```

#### React Native (Expo Updates)

```typescript
import * as Updates from "expo-updates";

async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  }
  catch (error) {
    console.error("检查更新失败:", error);
  }
}
```

### 响应格式

#### 成功响应 (200 OK)

响应格式为 `multipart/mixed`，包含以下内容：

**Content-Type**: `multipart/mixed; boundary={boundary}`

**响应 Header**:

- `expo-protocol-version`: 服务器使用的协议版本
- `expo-sfv-version`: SFV 版本（当前为 "0"）
- `cache-control`: "private, max-age=0"

**响应体（multipart）**:

##### 1. Manifest（正常更新）

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "runtimeVersion": "1.0.0",
  "assets": [
    {
      "hash": "sha256:abc123...",
      "key": "4f1cb2cac2370cd5050681232e8575a8",
      "fileExtension": ".png",
      "contentType": "image/png",
      "url": "http://localhost:9999/api/expo-updates/assets?asset=updates/1.0.0/1234567890/assets/4f1cb2cac2370cd5050681232e8575a8&runtimeVersion=1.0.0&platform=ios",
      "size": 1024
    }
  ],
  "launchAsset": {
    "hash": "sha256:def456...",
    "key": "9d01842d6ee1224f7188971c5d397115",
    "fileExtension": ".bundle",
    "contentType": "application/javascript",
    "url": "http://localhost:9999/api/expo-updates/assets?asset=updates/1.0.0/1234567890/bundles/ios-9d01842d6ee1224f7188971c5d397115.js&runtimeVersion=1.0.0&platform=ios",
    "size": 500000
  },
  "metadata": {},
  "extra": {
    "expoClient": {
      "name": "My Expo App",
      "version": "1.0.0",
      "slug": "my-expo-app"
    }
  }
}
```

**Manifest 字段说明**:

| 字段                        | 类型           | 说明                                         |
| --------------------------- | -------------- | -------------------------------------------- |
| `id`                        | string         | 更新 ID（UUID 格式），用于标识此更新         |
| `createdAt`                 | string         | 更新创建时间（ISO 8601 格式）                |
| `runtimeVersion`            | string         | 运行时版本，必须与请求的 runtimeVersion 匹配 |
| `assets`                    | array          | 静态资源列表（图片、字体等）                 |
| `assets[].hash`             | string         | 资源的 SHA256 哈希值（base64url 编码）       |
| `assets[].key`              | string         | 资源的唯一标识符                             |
| `assets[].fileExtension`    | string \| null | 文件扩展名（如 ".png"）                      |
| `assets[].contentType`      | string         | MIME 类型（如 "image/png"）                  |
| `assets[].url`              | string         | 资源下载 URL                                 |
| `assets[].size`             | number         | 资源大小（字节）                             |
| `launchAsset`               | object         | JavaScript bundle（启动资源）                |
| `launchAsset.hash`          | string         | Bundle 的 SHA256 哈希值                      |
| `launchAsset.key`           | string         | Bundle 的唯一标识符                          |
| `launchAsset.fileExtension` | string         | 文件扩展名（".bundle"）                      |
| `launchAsset.contentType`   | string         | MIME 类型（"application/javascript"）        |
| `launchAsset.url`           | string         | Bundle 下载 URL                              |
| `launchAsset.size`          | number         | Bundle 大小（字节）                          |
| `metadata`                  | object         | 额外的元数据（当前为空对象）                 |
| `extra`                     | object         | 额外信息                                     |
| `extra.expoClient`          | object         | Expo 客户端配置信息                          |

##### 2. Directive（Protocol Version 1）

如果使用 Protocol Version 1，可能返回指令而非 manifest：

**noUpdateAvailable 指令**:

```json
{
  "type": "noUpdateAvailable",
  "parameters": {}
}
```

**rollBackToEmbedded 指令**:

```json
{
  "type": "rollBackToEmbedded",
  "parameters": {
    "commitTime": "2025-01-15T12:00:00.000Z"
  }
}
```

**Directive 字段说明**:

| 字段                    | 类型   | 说明                                                  |
| ----------------------- | ------ | ----------------------------------------------------- |
| `type`                  | string | 指令类型："noUpdateAvailable" 或 "rollBackToEmbedded" |
| `parameters`            | object | 指令参数                                              |
| `parameters.commitTime` | string | （仅 rollBackToEmbedded）回滚提交时间                 |

##### 3. 签名（如果请求包含 expo-expect-signature）

响应 Header 中会包含 `expo-signature`:

```
expo-signature: sig="BASE64_SIGNATURE"; keyid="main"
```

#### 错误响应

##### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PLATFORM",
    "message": "Unsupported platform. Expected either ios or android."
  }
}
```

**常见错误代码**:

- `INVALID_PLATFORM`: 平台参数无效
- `MISSING_RUNTIME_VERSION`: 缺少 runtimeVersion
- `SIGNING_ERROR`: 代码签名错误（请求签名但服务器未配置私钥）
- `ROLLBACK_NOT_SUPPORTED`: Protocol Version 0 不支持 rollback
- `NO_UPDATE_DIRECTIVE_NOT_SUPPORTED`: Protocol Version 0 不支持 noUpdateAvailable 指令
- `APP_NOT_FOUND`: 应用不存在（当提供了 app-id 但应用未找到时）
- `APP_INACTIVE`: 应用已停用（当提供的 app-id 对应的应用状态为 inactive 时）

##### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "UPDATE_NOT_FOUND",
    "message": "No updates found for runtime version: 1.0.0"
  }
}
```

##### 405 Method Not Allowed

```json
{
  "success": false,
  "error": {
    "code": "METHOD_NOT_ALLOWED",
    "message": "Expected GET."
  }
}
```

##### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

### 解析 multipart/mixed 响应

由于响应是 `multipart/mixed` 格式，需要使用专门的解析器：

```javascript
import FormData from "form-data";

async function parseMultipartResponse(response) {
  const contentType = response.headers.get("content-type");
  const boundary = contentType.split("boundary=")[1];

  // 使用 FormData 解析 multipart 响应
  const formData = new FormData();
  const text = await response.text();

  // 这里需要使用 multipart 解析库
  // 例如使用 'form-data' 或 'multipart-parser'

  return {
    manifest: null, // 解析后的 manifest
    directive: null, // 解析后的 directive
    signature: null, // 解析后的签名
  };
}
```

**注意**: 在实际使用 Expo Updates SDK 时，这些解析逻辑已经内置，无需手动解析。

## Assets API

### 端点信息

**URL**: `/api/expo-updates/assets`

**方法**: `GET`

**Content-Type**: 根据资源类型（如 `application/javascript`、`image/png`）

### 请求参数

#### Query 参数

| 参数名           | 类型   | 必需 | 说明                                                         | 示例                                                           |
| ---------------- | ------ | ---- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `asset`          | string | 是   | 资源路径（相对于项目根目录或更新包目录的路径）               | "updates/com.example.app/1.0.0/1234567890/bundles/ios-main.js" |
| `runtimeVersion` | string | 是   | 运行时版本，必须与请求的资源所属的更新包 runtimeVersion 匹配 | "1.0.0"                                                        |
| `platform`       | string | 是   | 应用平台，必须是 "ios" 或 "android"                          | "ios"                                                          |
| `app-id`         | string | 否   | 应用包名（如 com.example.app），用于多应用分发管理           | "com.example.app"                                              |
| `device-id`      | string | 否   | 设备 ID                                                      | "device-123456"                                                |
| `user-id`        | string | 否   | 用户 ID（可选）                                              | "user-123456"                                                  |

### 请求示例

#### cURL

```bash
# 下载 JavaScript bundle（launch asset）
curl -X GET "http://localhost:9999/api/expo-updates/assets?asset=updates/1.0.0/1234567890/bundles/ios-9d01842d6ee1224f7188971c5d397115.js&runtimeVersion=1.0.0&platform=ios" \
  --output bundle.js

# 下载图片资源
curl -X GET "http://localhost:9999/api/expo-updates/assets?asset=updates/1.0.0/1234567890/assets/4f1cb2cac2370cd5050681232e8575a8&runtimeVersion=1.0.0&platform=ios" \
  --output image.png

# 多应用分发：下载指定应用的资源
curl -X GET "http://localhost:9999/api/expo-updates/assets?asset=updates/com.example.app/1.0.0/1234567890/bundles/ios-main.js&runtimeVersion=1.0.0&platform=ios&app-id=com.example.app&device-id=device-123456" \
  --output bundle.js
```

#### JavaScript (Fetch API)

```javascript
// 下载资源
async function downloadAsset(assetUrl) {
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // 获取资源的 MIME 类型
  const contentType = response.headers.get("content-type");

  // 根据类型处理
  if (contentType === "application/javascript") {
    // JavaScript bundle
    const bundle = await response.text();
    return bundle;
  }
  else {
    // 二进制资源（图片、字体等）
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  }
}

// 使用示例
const bundleUrl = "http://localhost:9999/api/expo-updates/assets?asset=updates/1.0.0/1234567890/bundles/ios-main.js&runtimeVersion=1.0.0&platform=ios";
const bundle = await downloadAsset(bundleUrl);
```

#### React Native (Expo Updates)

```typescript
import * as Updates from "expo-updates";

async function fetchUpdate() {
  try {
    // Expo Updates SDK 会自动处理资源下载
    await Updates.fetchUpdateAsync();
  }
  catch (error) {
    console.error("下载更新失败:", error);
  }
}
```

### 响应格式

#### 成功响应 (200 OK)

**Content-Type**: 根据资源类型自动设置

**响应体**: 资源的二进制内容或文本内容

**支持的 Content-Type**:

- `application/javascript` - JavaScript bundle
- `image/png`, `image/jpeg`, `image/svg+xml` - 图片资源
- `application/font-woff`, `application/font-ttf` - 字体资源
- `application/octet-stream` - 其他二进制资源

#### 错误响应

##### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ASSET_NAME",
    "message": "No asset name provided."
  }
}
```

**常见错误代码**:

- `INVALID_ASSET_NAME`: 缺少或无效的资源名称
- `INVALID_PLATFORM`: 平台参数无效
- `MISSING_RUNTIME_VERSION`: 缺少 runtimeVersion
- `UPDATE_NOT_FOUND`: 找不到对应的更新包

##### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset \"updates/1.0.0/1234567890/bundles/ios-main.js\" does not exist."
  }
}
```

##### 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "FILE_READ_ERROR",
    "message": "Failed to read asset file"
  }
}
```

## 完整示例

### 客户端更新流程示例

```typescript
// 完整的更新流程示例
interface UpdateManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  assets: Asset[];
  launchAsset: Asset;
  metadata: Record<string, any>;
  extra: {
    expoClient: Record<string, any>;
  };
}

interface Asset {
  hash: string;
  key: string;
  fileExtension: string | null;
  contentType: string;
  url: string;
  size: number;
}

class ExpoUpdatesClient {
  private baseUrl: string;
  private runtimeVersion: string;
  private platform: "ios" | "android";

  constructor(baseUrl: string, runtimeVersion: string, platform: "ios" | "android") {
    this.baseUrl = baseUrl;
    this.runtimeVersion = runtimeVersion;
    this.platform = platform;
  }

  /**
   * 检查是否有更新
   */
  async checkForUpdate(currentUpdateId?: string): Promise<UpdateManifest | null> {
    const headers: Record<string, string> = {
      "expo-protocol-version": "1",
      "expo-platform": this.platform,
      "expo-runtime-version": this.runtimeVersion,
    };

    if (currentUpdateId) {
      headers["expo-current-update-id"] = currentUpdateId;
    }

    const response = await fetch(`${this.baseUrl}/api/expo-updates/manifest`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`检查更新失败: ${response.status}`);
    }

    // 解析 multipart/mixed 响应
    // 注意：这里简化了，实际需要使用 multipart 解析库
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("multipart/mixed")) {
      // 解析 multipart 响应
      const manifest = await this.parseManifestResponse(response);
      return manifest;
    }

    return null;
  }

  /**
   * 下载资源
   */
  async downloadAsset(assetUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(assetUrl);

    if (!response.ok) {
      throw new Error(`下载资源失败: ${response.status}`);
    }

    return response.arrayBuffer();
  }

  /**
   * 下载所有资源
   */
  async downloadUpdate(manifest: UpdateManifest): Promise<{
    launchAsset: ArrayBuffer;
    assets: Map<string, ArrayBuffer>;
  }> {
    const assets = new Map<string, ArrayBuffer>();

    // 下载启动资源
    const launchAsset = await this.downloadAsset(manifest.launchAsset.url);

    // 下载其他资源
    for (const asset of manifest.assets) {
      const buffer = await this.downloadAsset(asset.url);
      assets.set(asset.key, buffer);
    }

    return {
      launchAsset,
      assets,
    };
  }

  /**
   * 解析 manifest 响应（简化版）
   * 实际实现需要使用 multipart 解析库
   */
  private async parseManifestResponse(response: Response): Promise<UpdateManifest | null> {
    // 这里需要使用 multipart 解析库（如 'form-data'）
    // 简化示例，实际需要完整实现
    const text = await response.text();
    // 解析 multipart 内容...
    return null;
  }
}

// 使用示例
const client = new ExpoUpdatesClient(
  "http://localhost:9999",
  "1.0.0",
  "ios"
);

async function checkAndDownloadUpdate() {
  try {
    // 1. 检查更新
    const currentUpdateId = await getCurrentUpdateId(); // 从本地存储获取
    const manifest = await client.checkForUpdate(currentUpdateId);

    if (!manifest) {
      console.log("没有可用更新");
      return;
    }

    // 2. 检查是否是同一个更新
    if (currentUpdateId === manifest.id) {
      console.log("已是最新版本");
      return;
    }

    // 3. 下载更新
    console.log("开始下载更新...");
    const { launchAsset, assets } = await client.downloadUpdate(manifest);

    // 4. 验证资源哈希
    // ...

    // 5. 保存更新到本地
    // ...

    // 6. 应用更新
    // ...

    console.log("更新完成");
  }
  catch (error) {
    console.error("更新失败:", error);
  }
}
```

### 使用 Expo Updates SDK（推荐）

对于使用 Expo 框架的应用，推荐使用官方的 `expo-updates` SDK。

**Expo Updates SDK 会自动处理所有 API 调用，你只需要：**

1. 在 `app.json` 中配置更新服务器 URL
2. 调用 SDK 的方法检查更新

#### app.json 配置

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "http://localhost:9999/api/expo-updates/manifest",
      "enabled": true,
      "fallbackToCacheTimeout": 30000,
      "codeSigningCertificate": "./code-signing/certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    }
  }
}
```

#### 客户端代码示例

```typescript
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      // Expo Updates SDK 会自动调用 /api/expo-updates/manifest
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        // Expo Updates SDK 会自动调用 /api/expo-updates/assets 下载资源
        await Updates.fetchUpdateAsync();

        // 重新加载应用以应用更新
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  }

  return (
    // 你的应用内容
  );
}
```

**关键点：**

- ✅ SDK 会自动向 `updates.url` 发送请求（通常是 `/api/expo-updates/manifest`）
- ✅ SDK 会自动解析 multipart/mixed 响应
- ✅ SDK 会自动下载 manifest 中返回的所有 assets
- ✅ SDK 会自动验证资源完整性
- ✅ 你不需要手动调用任何服务端接口

## 错误处理

### 常见错误及处理

#### 1. 网络错误

```typescript
try {
  const response = await fetch(manifestUrl);
}
catch (error) {
  if (error instanceof TypeError) {
    // 网络连接错误
    console.error("网络连接失败，请检查网络设置");
  }
  else {
    console.error("未知错误:", error);
  }
}
```

#### 2. 服务器错误

```typescript
const response = await fetch(manifestUrl);

if (response.status === 404) {
  console.error("未找到更新，可能 runtimeVersion 不匹配");
}
else if (response.status === 400) {
  const error = await response.json();
  console.error("请求参数错误:", error.error.message);
}
else if (response.status >= 500) {
  console.error("服务器错误，请稍后重试");
}
```

#### 3. 资源下载失败

```typescript
async function downloadAssetWithRetry(url: string, maxRetries = 3): Promise<ArrayBuffer> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.arrayBuffer();
    }
    catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error("下载失败");
}
```

## 最佳实践

### 1. 使用 Protocol Version 1

Protocol Version 1 提供更多功能，包括：

- `noUpdateAvailable` 指令：避免不必要的资源下载
- `rollBackToEmbedded` 指令：支持回滚到嵌入版本

### 2. 缓存更新 ID

```typescript
// 保存当前更新 ID
async function saveCurrentUpdateId(updateId: string) {
  await AsyncStorage.setItem("currentUpdateId", updateId);
}

// 获取当前更新 ID
async function getCurrentUpdateId(): Promise<string | null> {
  return await AsyncStorage.getItem("currentUpdateId");
}

// 检查更新时传递当前更新 ID
const currentUpdateId = await getCurrentUpdateId();
const manifest = await checkForUpdate(currentUpdateId);
```

### 3. 验证资源完整性

```typescript
import crypto from "node:crypto";

async function verifyAssetHash(
  data: ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(data))
    .digest("base64url");

  return hash === expectedHash;
}

// 使用
const asset = await downloadAsset(manifest.launchAsset.url);
const isValid = await verifyAssetHash(asset, manifest.launchAsset.hash);

if (!isValid) {
  throw new Error("资源哈希验证失败");
}
```

### 4. 后台更新

```typescript
import { AppState } from "react-native";

AppState.addEventListener("change", (nextAppState) => {
  if (nextAppState === "active") {
    // 应用进入前台时检查更新
    checkForUpdates();
  }
});
```

### 5. 用户提示

```typescript
import { Alert } from "react-native";

async function checkForUpdatesWithPrompt() {
  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      Alert.alert(
        "发现新版本",
        "是否立即更新？",
        [
          { text: "稍后", style: "cancel" },
          {
            text: "立即更新",
            onPress: async () => {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            },
          },
        ]
      );
    }
  }
  catch (error) {
    console.error("检查更新失败:", error);
  }
}
```

### 6. 错误上报

```typescript
async function checkForUpdatesWithErrorReporting() {
  try {
    const update = await Updates.checkForUpdateAsync();
    // ...
  }
  catch (error) {
    // 上报错误到监控服务
    await reportError("update_check_failed", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## 参数总结表

### Manifest API 参数

| 参数                      | 位置         | 类型   | 必需 | 说明                              |
| ------------------------- | ------------ | ------ | ---- | --------------------------------- |
| `expo-protocol-version`   | Header       | string | 否   | Expo 协议版本（默认 "0"）         |
| `expo-platform`           | Header/Query | string | 是   | 平台（"ios" 或 "android"）        |
| `expo-runtime-version`    | Header/Query | string | 是   | 运行时版本                        |
| `expo-current-update-id`  | Header       | string | 否   | 当前更新 ID（Protocol Version 1） |
| `expo-embedded-update-id` | Header       | string | 否   | 嵌入更新 ID（Protocol Version 1） |
| `expo-expect-signature`   | Header       | string | 否   | 是否期望签名（"true"）            |
| `x-app-id`                | Header/Query | string | 否   | 应用包名（如 com.example.app）    |
| `x-device-id`             | Header/Query | string | 否   | 设备 ID                           |
| `x-user-id`               | Header/Query | string | 否   | 用户 ID（可选）                   |

### Assets API 参数

| 参数             | 位置   | 类型   | 必需 | 说明                           |
| ---------------- | ------ | ------ | ---- | ------------------------------ |
| `asset`          | Query  | string | 是   | 资源路径                       |
| `runtimeVersion` | Query  | string | 是   | 运行时版本                     |
| `platform`       | Query  | string | 是   | 平台（"ios" 或 "android"）     |
| `app-id`         | Query  | string | 否   | 应用包名（如 com.example.app） |
| `device-id`      | Query  | string | 否   | 设备 ID                        |
| `user-id`        | Query  | string | 否   | 用户 ID（可选）                |
| `x-app-id`       | Header | string | 否   | 应用包名（如 com.example.app） |
| `x-device-id`    | Header | string | 否   | 设备 ID                        |
| `x-user-id`      | Header | string | 否   | 用户 ID（可选）                |

## 客户端配置

### 使用 Expo Updates SDK（推荐）

如果你使用 Expo Updates SDK，客户端配置非常简单：

#### 1. 安装依赖

```bash
npx expo install expo-updates
```

#### 2. 配置 app.json

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "version": "1.0.0",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "http://localhost:9999/api/expo-updates/manifest",
      "enabled": true,
      "fallbackToCacheTimeout": 30000,
      "codeSigningCertificate": "./code-signing/certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    }
  }
}
```

#### 3. 配置参数说明

| 参数                     | 类型    | 说明                                                        | 必需               |
| ------------------------ | ------- | ----------------------------------------------------------- | ------------------ |
| `url`                    | string  | 更新服务器 Manifest API 的 URL。SDK 会自动向此 URL 发送请求 | ✅ 是              |
| `enabled`                | boolean | 是否启用更新功能                                            | ❌ 否（默认 true） |
| `fallbackToCacheTimeout` | number  | 如果更新检查失败，使用缓存的超时时间（毫秒）                | ❌ 否（默认 0）    |
| `codeSigningCertificate` | string  | 代码签名证书路径（用于验证 manifest 签名）                  | ❌ 否              |
| `codeSigningMetadata`    | object  | 代码签名元数据                                              | ❌ 否              |

#### 4. 客户端代码

```typescript
import * as Updates from "expo-updates";

// SDK 会自动调用服务端接口，你只需要调用 SDK 方法
async function checkAndApplyUpdates() {
  try {
    // SDK 自动请求 Manifest API
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      // SDK 自动请求 Assets API 下载所有资源
      await Updates.fetchUpdateAsync();

      // 应用更新
      await Updates.reloadAsync();
    }
  }
  catch (error) {
    console.error("更新失败:", error);
  }
}
```

#### 5. SDK 自动处理的内容

- ✅ 自动发送请求到 `updates.url`
- ✅ 自动添加必需的 Header（expo-platform、expo-runtime-version 等）
- ✅ 自动解析 multipart/mixed 响应
- ✅ 自动下载所有 assets（包括 launchAsset）
- ✅ 自动验证资源哈希
- ✅ 自动缓存更新
- ✅ 自动处理 Protocol Version 0 和 1
- ✅ **Expo SDK 53+**：支持通过 `setUpdateURLAndRequestHeadersOverride` 添加自定义 Header

### 服务端要求

**你只需要确保服务端实现了以下接口：**

1. ✅ `GET /api/expo-updates/manifest` - 返回更新清单
2. ✅ `GET /api/expo-updates/assets` - 返回资源文件

**不需要关心客户端如何调用，SDK 会自动处理！**

## 总结

### 使用 Expo Updates SDK（推荐）

1. ✅ **客户端**：只需在 `app.json` 中配置 `updates.url`
2. ✅ **服务端**：只需实现 Manifest API 和 Assets API
3. ✅ **SDK 自动**：自动调用接口、解析响应、下载资源、验证完整性
4. ✅ **Protocol Version 1**：推荐使用，支持更多功能（rollback、noUpdateAvailable）
5. ✅ **多应用分发**：Expo SDK 53+ 支持通过 `setUpdateURLAndRequestHeadersOverride` 添加自定义 Header（`x-app-id`、`x-device-id` 等）

### 服务端接口要求

- **Manifest API** (`GET /api/expo-updates/manifest`)：返回更新清单
- **Assets API** (`GET /api/expo-updates/assets`)：返回资源文件
- 支持 Protocol Version 0 和 1
- 支持代码签名（可选）
- 返回正确的 multipart/mixed 格式

### 不需要手动调用接口

**如果你使用 Expo Updates SDK，不需要手动调用任何接口！** SDK 会自动处理所有 HTTP 请求。

如有问题，请参考：

- [Expo Updates 官方文档](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Custom Expo Updates Server](https://github.com/expo/custom-expo-updates-server)
- 查看服务器日志
