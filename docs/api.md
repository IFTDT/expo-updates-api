# Expo Updates Admin API 接口文档

## 1. 概述

### 1.1 API 基础信息
- **Base URL**: `https://api.example.com/v1` (待配置)
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **时区**: UTC（时间戳）/ ISO 8601（日期字符串）

### 1.2 认证方式
所有 API 请求（除登录接口外）都需要在请求头中携带认证 Token：

```
Authorization: Bearer <access_token>
```

Token 获取方式：
1. 通过登录接口获取 `access_token` 和 `refresh_token`
2. 使用 `refresh_token` 刷新 `access_token`

### 1.3 响应格式

#### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

### 1.4 HTTP 状态码
- `200 OK` - 请求成功
- `201 Created` - 创建成功
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未认证或Token过期
- `403 Forbidden` - 无权限
- `404 Not Found` - 资源不存在
- `422 Unprocessable Entity` - 数据验证失败
- `500 Internal Server Error` - 服务器错误

### 1.5 错误代码说明
- `AUTH_REQUIRED` - 需要认证
- `AUTH_INVALID` - 认证失败
- `AUTH_EXPIRED` - Token过期
- `PERMISSION_DENIED` - 权限不足
- `RESOURCE_NOT_FOUND` - 资源不存在
- `VALIDATION_ERROR` - 数据验证失败
- `UPLOAD_FAILED` - 文件上传失败
- `VERSION_CONFLICT` - 版本冲突
- `OPERATION_FAILED` - 操作失败

## 2. 认证接口

### 2.1 用户登录
**POST** `/api/auth/login`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "1",
      "name": "张三",
      "email": "user@example.com",
      "role": "admin",
      "avatar": "https://example.com/avatar.png"
    }
  }
}
```

### 2.2 用户登出
**POST** `/api/auth/logout`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

### 2.3 获取当前用户信息
**GET** `/api/auth/me`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "张三",
    "email": "user@example.com",
    "role": "admin",
    "avatar": "https://example.com/avatar.png",
    "appIds": ["1", "2"]
  }
}
```

### 2.4 刷新 Token
**POST** `/api/auth/refresh`

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

## 3. 应用接口

### 3.1 获取应用列表
**GET** `/api/apps`

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20，最大 50
- `search` (string, 可选): 搜索关键词（应用名称）
- `status` (string, 可选): 状态筛选 (`active` | `inactive`)
- `sort` (string, 可选): 排序字段，默认 `updatedAt`
- `order` (string, 可选): 排序方向 (`asc` | `desc`)，默认 `desc`

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "1",
        "name": "购物 App",
        "icon": "https://cdn.example.com/apps/icon.png",
        "appId": "com.example.shopping",
        "description": "一个功能完善的购物应用",
        "status": "active",
        "currentVersion": "1.2.0",
        "userCount": 1250,
        "updateCount": 8,
        "createdAt": "2023-06-01T00:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "ownerId": "1",
        "owner": {
          "id": "1",
          "name": "张三"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

### 3.2 获取应用详情
**GET** `/api/apps/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `id` (string, 必需): 应用 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "购物 App",
    "icon": "https://cdn.example.com/apps/icon.png",
    "appId": "com.example.shopping",
    "description": "一个功能完善的购物应用",
    "status": "active",
    "currentVersion": "1.2.0",
    "userCount": 1250,
    "updateCount": 8,
    "versions": 12,
    "createdAt": "2023-06-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "ownerId": "1",
    "owner": {
      "id": "1",
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }
}
```

### 3.3 创建应用
**POST** `/api/apps`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "name": "新应用",
  "appId": "com.example.newapp",
  "description": "应用描述",
  "icon": "https://cdn.example.com/apps/icon.png"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "2",
    "name": "新应用",
    "appId": "com.example.newapp",
    "status": "active",
    "createdAt": "2024-01-20T10:00:00Z"
  }
}
```

### 3.4 更新应用信息
**PUT** `/api/apps/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `id` (string, 必需): 应用 ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "status": "active"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "更新后的名称",
    "updatedAt": "2024-01-20T10:00:00Z"
  }
}
```

## 4. 版本接口

### 4.1 获取版本列表
**GET** `/api/apps/:appId/versions`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**查询参数**:
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20
- `status` (string, 可选): 状态筛选 (`draft` | `published` | `rolled_back`)
- `sort` (string, 可选): 排序字段，默认 `publishedAt`
- `order` (string, 可选): 排序方向 (`asc` | `desc`)，默认 `desc`

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "v1",
        "version": "1.2.0",
        "name": "功能优化版本",
        "description": "优化了购物车功能，提升了用户体验",
        "status": "published",
        "fileUrl": "https://cdn.example.com/updates/v1.2.0.tar.gz",
        "fileSize": 5242880,
        "checksum": "sha256:abc123...",
        "isMandatory": true,
        "publishedAt": "2024-01-15T10:30:00Z",
        "publishedBy": "1",
        "publisher": {
          "id": "1",
          "name": "张三"
        },
        "userCount": 1250,
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

### 4.2 获取版本详情
**GET** `/api/apps/:appId/versions/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID
- `id` (string, 必需): 版本 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "v1",
    "version": "1.2.0",
    "name": "功能优化版本",
    "description": "优化了购物车功能，提升了用户体验",
    "status": "published",
    "fileUrl": "https://cdn.example.com/updates/v1.2.0.tar.gz",
    "fileSize": 5242880,
    "checksum": "sha256:abc123...",
    "isMandatory": true,
    "publishedAt": "2024-01-15T10:30:00Z",
    "rolledBackAt": null,
    "publishedBy": "1",
    "publisher": {
      "id": "1",
      "name": "张三"
    },
    "userCount": 1250,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### 4.3 创建新版本
**POST** `/api/apps/:appId/versions`

**请求头**:
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**请求体** (multipart/form-data):
- `file` (file, 必需): 更新包文件 (.tar.gz, .zip, .tgz)
- `version` (string, 必需): 版本号
- `name` (string, 必需): 版本名称
- `description` (string, 可选): 版本说明
- `isMandatory` (boolean, 可选): 是否强制更新，默认 false
- `publishTime` (string, 可选): 发布时间 (`now` | `scheduled`)
- `scheduledAt` (string, 可选): 计划发布时间 (ISO 8601, publishTime 为 scheduled 时必需)

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "v2",
    "version": "1.2.1",
    "status": "published",
    "publishedAt": "2024-01-20T10:00:00Z",
    "taskId": "task-123"
  },
  "message": "版本创建成功"
}
```

### 4.4 发布版本
**POST** `/api/apps/:appId/versions/:id/publish`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID
- `id` (string, 必需): 版本 ID

**请求体**:
```json
{
  "type": "full",
  "targetUserIds": [],
  "targetGroupIds": [],
  "scheduledAt": null
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "task-123",
    "status": "pending"
  },
  "message": "发布任务已创建"
}
```

### 4.5 回滚版本
**POST** `/api/apps/:appId/versions/:id/rollback`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID
- `id` (string, 必需): 当前版本 ID

**请求体**:
```json
{
  "toVersionId": "v3",
  "type": "full",
  "reason": "发现严重bug，需要回滚",
  "targetUserIds": [],
  "targetGroupIds": []
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "rollback-123",
    "status": "pending"
  },
  "message": "回滚任务已创建"
}
```

### 4.6 删除草稿版本
**DELETE** `/api/apps/:appId/versions/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID
- `id` (string, 必需): 版本 ID

**响应**:
```json
{
  "success": true,
  "message": "版本删除成功"
}
```

## 5. 更新任务接口

### 5.1 获取更新任务列表
**GET** `/api/apps/:appId/update-tasks`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**查询参数**:
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20
- `status` (string, 可选): 状态筛选

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "task-123",
        "appId": "1",
        "versionId": "v1",
        "version": {
          "id": "v1",
          "version": "1.2.0"
        },
        "type": "full",
        "status": "completed",
        "scheduledAt": null,
        "startedAt": "2024-01-15T10:00:00Z",
        "completedAt": "2024-01-15T10:05:00Z",
        "successCount": 1250,
        "failureCount": 0,
        "createdBy": "1",
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 5.2 获取任务详情
**GET** `/api/apps/:appId/update-tasks/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "task-123",
    "appId": "1",
    "versionId": "v1",
    "type": "full",
    "status": "completed",
    "successCount": 1250,
    "failureCount": 0,
    "progress": 100,
    "details": {
      "total": 1250,
      "processed": 1250,
      "failed": []
    },
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

### 5.3 创建更新任务
**POST** `/api/apps/:appId/update-tasks`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "versionId": "v1",
  "type": "targeted",
  "targetUserIds": ["u1", "u2"],
  "targetGroupIds": ["g1"],
  "scheduledAt": "2024-01-20T10:00:00Z"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "task-124",
    "status": "pending"
  }
}
```

## 6. 用户接口

### 6.1 获取用户列表
**GET** `/api/apps/:appId/users`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**查询参数**:
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20
- `search` (string, 可选): 搜索关键词（用户ID或设备ID）
- `version` (string, 可选): 版本筛选
- `status` (string, 可选): 状态筛选 (`online` | `offline`)
- `platform` (string, 可选): 平台筛选 (`ios` | `android`)

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "u1",
        "deviceId": "device-abc123",
        "userId": "user-001",
        "currentVersion": "1.2.0",
        "lastUpdateAt": "2024-01-15T10:30:00Z",
        "deviceInfo": {
          "platform": "ios",
          "osVersion": "17.2",
          "appVersion": "1.2.0"
        },
        "status": "online"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63
    },
    "stats": {
      "total": 1250,
      "online": 850,
      "offline": 400,
      "versions": 3
    }
  }
}
```

### 6.2 获取用户详情
**GET** `/api/apps/:appId/users/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "u1",
    "deviceId": "device-abc123",
    "userId": "user-001",
    "currentVersion": "1.2.0",
    "lastUpdateAt": "2024-01-15T10:30:00Z",
    "deviceInfo": {
      "platform": "ios",
      "osVersion": "17.2",
      "appVersion": "1.2.0"
    },
    "status": "online",
    "updateHistory": [
      {
        "version": "1.2.0",
        "updatedAt": "2024-01-15T10:30:00Z",
        "status": "success"
      }
    ]
  }
}
```

### 6.3 更新用户版本
**POST** `/api/apps/:appId/users/:id/update`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID
- `id` (string, 必需): 用户 ID

**请求体**:
```json
{
  "versionId": "v1",
  "force": false
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "user-update-123",
    "status": "pending"
  }
}
```

### 6.4 批量更新用户
**POST** `/api/apps/:appId/users/batch-update`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "userIds": ["u1", "u2", "u3"],
  "versionId": "v1"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "batch-update-123",
    "affectedCount": 3
  }
}
```

### 6.5 回滚用户版本
**POST** `/api/apps/:appId/users/:id/rollback`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "toVersionId": "v3",
  "reason": "用户请求回滚"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "taskId": "user-rollback-123"
  }
}
```

## 7. 用户分组接口

### 7.1 获取分组列表
**GET** `/api/apps/:appId/user-groups`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**查询参数**:
- `search` (string, 可选): 搜索关键词

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "g1",
        "name": "VIP用户",
        "description": "高级付费用户组",
        "userCount": 120,
        "userIds": ["u1", "u2"],
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-10T00:00:00Z",
        "createdBy": "1"
      }
    ]
  }
}
```

### 7.2 获取分组详情
**GET** `/api/apps/:appId/user-groups/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "g1",
    "name": "VIP用户",
    "description": "高级付费用户组",
    "userCount": 120,
    "userIds": ["u1", "u2"],
    "users": [
      {
        "id": "u1",
        "userId": "user-001",
        "deviceId": "device-abc123"
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-10T00:00:00Z"
  }
}
```

### 7.3 创建分组
**POST** `/api/apps/:appId/user-groups`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "name": "新分组",
  "description": "分组描述",
  "userIds": ["u1", "u2"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "g2",
    "name": "新分组",
    "userCount": 2,
    "createdAt": "2024-01-20T10:00:00Z"
  }
}
```

### 7.4 更新分组
**PUT** `/api/apps/:appId/user-groups/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "name": "更新后的分组名",
  "description": "更新后的描述",
  "userIds": ["u1", "u2", "u3"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "g1",
    "name": "更新后的分组名",
    "userCount": 3,
    "updatedAt": "2024-01-20T10:00:00Z"
  }
}
```

### 7.5 删除分组
**DELETE** `/api/apps/:appId/user-groups/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "分组删除成功"
}
```

### 7.6 添加用户到分组
**POST** `/api/apps/:appId/user-groups/:id/users`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "userIds": ["u3", "u4"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "addedCount": 2,
    "userCount": 122
  }
}
```

### 7.7 从分组移除用户
**DELETE** `/api/apps/:appId/user-groups/:id/users`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "userIds": ["u1", "u2"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "removedCount": 2,
    "userCount": 120
  }
}
```

## 8. 操作日志接口

### 8.1 获取操作日志
**GET** `/api/apps/:appId/logs`

**请求头**:
```
Authorization: Bearer <access_token>
```

**路径参数**:
- `appId` (string, 必需): 应用 ID

**查询参数**:
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20
- `type` (string, 可选): 操作类型筛选
- `status` (string, 可选): 状态筛选 (`success` | `failed`)
- `userId` (string, 可选): 操作人ID筛选
- `startDate` (string, 可选): 开始日期 (ISO 8601)
- `endDate` (string, 可选): 结束日期 (ISO 8601)
- `search` (string, 可选): 搜索关键词

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "log1",
        "type": "update",
        "action": "发布版本 1.2.0",
        "targetId": "v1",
        "targetType": "version",
        "status": "success",
        "details": {
          "version": "1.2.0",
          "userCount": 1250
        },
        "userId": "1",
        "user": {
          "id": "1",
          "name": "张三"
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 8.2 获取日志详情
**GET** `/api/apps/:appId/logs/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "log1",
    "type": "update",
    "action": "发布版本 1.2.0",
    "targetId": "v1",
    "targetType": "version",
    "status": "success",
    "details": {
      "version": "1.2.0",
      "userCount": 1250,
      "fileSize": 5242880,
      "duration": 300
    },
    "userId": "1",
    "user": {
      "id": "1",
      "name": "张三",
      "email": "zhangsan@example.com"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 8.3 导出日志
**GET** `/api/apps/:appId/logs/export`

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `format` (string, 可选): 导出格式 (`csv` | `xlsx`)，默认 `csv`
- `type` (string, 可选): 操作类型筛选
- `status` (string, 可选): 状态筛选
- `startDate` (string, 可选): 开始日期
- `endDate` (string, 可选): 结束日期

**响应**: 文件下载流

## 9. 统计接口

### 9.1 获取应用统计信息
**GET** `/api/apps/:appId/stats`

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `startDate` (string, 可选): 开始日期 (ISO 8601)
- `endDate` (string, 可选): 结束日期 (ISO 8601)

**响应**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "updateSuccessRate": 99.2,
      "successCount": 1240,
      "failureCount": 10,
      "activeVersions": 3,
      "totalUpdates": 1430
    },
    "versionDistribution": [
      {
        "version": "1.2.0",
        "count": 850,
        "percentage": 68
      },
      {
        "version": "1.1.9",
        "count": 280,
        "percentage": 22.4
      },
      {
        "version": "1.1.8",
        "count": 120,
        "percentage": 9.6
      }
    ],
    "updateTimeline": [
      {
        "date": "2024-01-15",
        "count": 450
      },
      {
        "date": "2024-01-14",
        "count": 320
      }
    ],
    "failureReasons": [
      {
        "reason": "网络超时",
        "count": 5
      },
      {
        "reason": "存储空间不足",
        "count": 3
      }
    ]
  }
}
```

### 9.2 获取版本分布统计
**GET** `/api/apps/:appId/stats/version-distribution`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "version": "1.2.0",
      "count": 850,
      "percentage": 68
    },
    {
      "version": "1.1.9",
      "count": 280,
      "percentage": 22.4
    }
  ]
}
```

### 9.3 获取更新成功率统计
**GET** `/api/apps/:appId/stats/update-success-rate`

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `startDate` (string, 可选): 开始日期
- `endDate` (string, 可选): 结束日期

**响应**:
```json
{
  "success": true,
  "data": {
    "successRate": 99.2,
    "successCount": 1240,
    "failureCount": 10,
    "totalCount": 1250
  }
}
```

## 10. 平台用户管理接口

### 10.1 获取平台用户列表
**GET** `/api/users`

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `page` (number, 可选): 页码
- `limit` (number, 可选): 每页数量
- `search` (string, 可选): 搜索关键词
- `role` (string, 可选): 角色筛选
- `status` (string, 可选): 状态筛选

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "1",
        "name": "张三",
        "email": "zhangsan@example.com",
        "role": "admin",
        "status": "active",
        "createdAt": "2023-01-15T00:00:00Z",
        "lastLoginAt": "2024-01-15T10:30:00Z",
        "appIds": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

### 10.2 创建平台用户
**POST** `/api/users`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "name": "新用户",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "app_manager",
  "appIds": ["1", "2"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "2",
    "name": "新用户",
    "email": "newuser@example.com",
    "role": "app_manager",
    "status": "active"
  }
}
```

### 10.3 更新平台用户
**PUT** `/api/users/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "name": "更新后的用户名",
  "role": "app_manager",
  "status": "active",
  "appIds": ["1"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "2",
    "name": "更新后的用户名",
    "updatedAt": "2024-01-20T10:00:00Z"
  }
}
```

### 10.4 删除平台用户
**DELETE** `/api/users/:id`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "message": "用户删除成功"
}
```

### 10.5 重置用户密码
**POST** `/api/users/:id/reset-password`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "newPassword": "newpassword123"
}
```

**响应**:
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

### 10.6 启用/禁用用户
**POST** `/api/users/:id/toggle-status`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "status": "inactive"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "2",
    "status": "inactive"
  }
}
```

## 11. 文件上传接口

### 11.1 上传更新包
**POST** `/api/upload`

**请求头**:
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**请求体** (multipart/form-data):
- `file` (file, 必需): 更新包文件
- `appId` (string, 必需): 应用 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "fileUrl": "https://cdn.example.com/updates/v1.2.0.tar.gz",
    "fileSize": 5242880,
    "checksum": "sha256:abc123...",
    "uploadId": "upload-123"
  }
}
```

**说明**:
- 支持的文件格式：`.tar.gz`, `.zip`, `.tgz`
- 最大文件大小：100MB
- 上传过程中可以查询上传进度

### 11.2 查询上传进度
**GET** `/api/upload/:uploadId/progress`

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "uploadId": "upload-123",
    "progress": 75,
    "status": "uploading",
    "uploadedBytes": 3932160,
    "totalBytes": 5242880
  }
}
```

## 12. WebSocket 接口（可选）

### 12.1 实时任务状态更新
**WS** `/ws/tasks/:taskId`

**连接参数**:
- `token` (string, 必需): 认证 Token

**消息格式**:
```json
{
  "type": "task_update",
  "data": {
    "taskId": "task-123",
    "status": "in_progress",
    "progress": 50,
    "successCount": 625,
    "failureCount": 0
  }
}
```

## 13. 错误处理示例

### 13.1 认证错误
```json
{
  "success": false,
  "error": {
    "code": "AUTH_EXPIRED",
    "message": "Token已过期，请重新登录",
    "details": {
      "expiredAt": "2024-01-20T10:00:00Z"
    }
  }
}
```

### 13.2 权限错误
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "您没有权限执行此操作",
    "details": {
      "requiredRole": "admin",
      "currentRole": "viewer"
    }
  }
}
```

### 13.3 验证错误
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "数据验证失败",
    "details": {
      "fields": {
        "version": ["版本号格式不正确"],
        "name": ["版本名称不能为空"]
      }
    }
  }
}
```

### 13.4 资源不存在
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "应用不存在",
    "details": {
      "resource": "app",
      "id": "999"
    }
  }
}
```

## 14. 速率限制

API 请求存在速率限制：
- **认证接口**: 每分钟 5 次
- **其他接口**: 每分钟 60 次
- **文件上传**: 每分钟 10 次

超出限制时返回：
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请稍后再试",
    "details": {
      "retryAfter": 60
    }
  }
}
```

响应头包含：
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642680000
Retry-After: 60
```

## 15. 版本控制

API 版本通过 URL 路径控制：
- `/v1/api/*` - 当前版本
- 未来可能引入 `/v2/api/*`

旧版本将在新版本发布后保留至少 6 个月。

## 16. 最佳实践

### 16.1 请求建议
1. 使用 HTTPS 协议
2. 合理设置请求超时时间（建议 30 秒）
3. 实现请求重试机制（指数退避）
4. 使用分页参数避免一次性加载大量数据
5. 合理使用缓存减少请求次数

### 16.2 错误处理建议
1. 检查 HTTP 状态码
2. 检查响应中的 `success` 字段
3. 根据错误代码进行相应处理
4. 记录错误日志便于排查
5. 向用户展示友好的错误提示

### 16.3 文件上传建议
1. 实现上传进度显示
2. 支持断点续传（如需要）
3. 在上传前验证文件格式和大小
4. 使用分块上传处理大文件
5. 上传失败时提供重试机制

