# Expo Updates API

一个基于 Hono + OpenAPI 的 Expo Updates 服务端实现，提供完整的 Expo 应用热更新管理和多应用分发功能。

## ✨ 特性

### 核心功能

- 🚀 **Expo Updates 协议支持**
  - 支持 Protocol Version 0 和 1
  - Manifest API - 获取更新清单
  - Assets API - 下载资源文件
  - 支持代码签名（RSA-SHA256）
  - 支持 `noUpdateAvailable` 和 `rollBackToEmbedded` 指令

- 📦 **多应用分发管理**
  - 支持多应用独立管理
  - 基于应用包名（app-id）的应用隔离
  - 设备信息追踪和用户识别
  - 灵活的更新包目录结构

- 🔐 **完整的认证授权体系**
  - JWT 认证（Access Token + Refresh Token）
  - 基于角色的权限控制（管理员、应用管理员）
  - 用户会话管理

- 📊 **应用管理功能**
  - 应用创建和配置
  - 版本管理和发布
  - 更新任务管理
  - 用户分组管理
  - 操作日志记录
  - 数据统计分析

### 技术特性

- ✅ **类型安全**：TypeScript + Zod 端到端类型安全
- ✅ **自动文档**：基于 OpenAPI 规范自动生成 API 文档
- ✅ **结构化日志**：使用 Pino 进行结构化日志记录
- ✅ **数据库迁移**：使用 Drizzle Kit 管理数据库迁移
- ✅ **测试支持**：使用 Vitest 进行单元测试
- ✅ **代码质量**：ESLint 代码检查和格式化

## 🛠️ 技术栈

### 核心框架

- **[Hono](https://hono.dev/)** - 轻量级、高性能的 Web 框架
- **[@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)** - 类型安全的 OpenAPI 集成
- **[@hono/node-server](https://github.com/honojs/hono/tree/main/packages/node-server)** - Node.js 运行时支持

### 数据库与 ORM

- **[Drizzle ORM](https://orm.drizzle.team/)** - 类型安全的 TypeScript ORM
- **[Turso](https://turso.tech/)** - 基于 SQLite 的边缘数据库
- **[drizzle-zod](https://orm.drizzle.team/docs/zod)** - Zod 验证器集成

### 数据验证

- **[Zod](https://zod.dev/)** - TypeScript 优先的运行时类型验证库

### 开发工具

- **[Vitest](https://vitest.dev/)** - 快速单元测试框架
- **[tsx](https://github.com/esbuild-kit/tsx)** - TypeScript 执行工具
- **[ESLint](https://eslint.org/)** - 代码检查工具

## 📋 前置要求

- **Node.js** >= 18.0.0 (推荐 >= 20.0.0)
- **pnpm** >= 8.0.0

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/expo-updates-api.git
cd expo-updates-api
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

创建 `.env` 文件并配置必要的环境变量：

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少需要配置以下变量：

```env
# 数据库配置
DATABASE_URL=file:./dev.db  # 开发环境使用 SQLite
# DATABASE_URL=libsql://your-database.turso.io  # 生产环境使用 Turso
# DATABASE_AUTH_TOKEN=your-turso-token  # 生产环境必需

# JWT 配置
JWT_SECRET=your-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info
NODE_ENV=development
PORT=9999

# Expo Updates 配置（可选）
UPDATES_BASE_URL=http://localhost:9999
PRIVATE_KEY_PATH=./code-signing-keys/private-key.pem  # 代码签名私钥路径（可选）

# 管理密钥（可选，用于创建管理员账户）
ADMIN_KEY=your-admin-key
```

### 4. 初始化数据库

```bash
# 推送数据库模式（开发环境）
pnpm db:push

# 或生成迁移文件并应用迁移（推荐）
pnpm db:generate
pnpm db:migrate
```

### 5. 启动开发服务器

```bash
pnpm dev
```

服务器将在 `http://localhost:9999` 启动。

### 6. 访问 API 文档

启动后，你可以访问以下端点：

- **OpenAPI 规范文档**：`http://localhost:9999/doc`
- **交互式 API 文档**：`http://localhost:9999/reference`

## 📁 项目结构

```
expo-updates-api/
├── src/                      # 源代码目录
│   ├── app.ts                # 应用主入口（导出 Hono 应用）
│   ├── index.ts              # 本地开发入口（启动 Node.js 服务器）
│   ├── env.ts                # 环境变量配置（使用 Zod 验证）
│   ├── db/                   # 数据库相关
│   │   ├── index.ts          # 数据库连接配置
│   │   ├── schema.ts         # 数据库模式定义
│   │   └── migrations/       # 数据库迁移文件
│   ├── lib/                  # 工具库和配置
│   │   ├── create-app.ts     # 应用创建函数
│   │   ├── configure-open-api.ts  # OpenAPI 配置
│   │   ├── auth.ts           # 认证工具函数
│   │   ├── constants.ts      # 常量定义
│   │   └── types.ts          # 类型定义
│   ├── middlewares/          # 中间件
│   │   ├── pino-logger.ts    # Pino 日志中间件
│   │   ├── auth.ts           # 认证中间件
│   │   └── cors.ts           # CORS 中间件
│   └── routes/               # 路由定义
│       ├── index.route.ts    # 根路由
│       ├── auth/             # 认证路由
│       ├── apps/             # 应用管理路由
│       ├── versions/         # 版本管理路由
│       ├── expo-updates/     # Expo Updates 协议路由
│       └── ...               # 其他路由模块
├── docs/                     # 文档目录
│   ├── expo-updates-api.md   # Expo Updates API 使用文档
│   └── api.md                # 管理 API 接口文档
├── drizzle.config.ts         # Drizzle ORM 配置
├── vitest.config.ts          # Vitest 测试配置
├── tsconfig.json             # TypeScript 配置
└── package.json              # 项目依赖配置
```

## 📖 API 文档

### Expo Updates API

本项目实现了 Expo Updates 协议的两个核心端点：

- `GET /api/expo-updates/manifest` - 获取更新清单
- `GET /api/expo-updates/assets` - 获取资源文件

详细使用说明请参考：[Expo Updates API 文档](./docs/expo-updates-api.md)

### 管理 API

完整的 RESTful API 接口，包括：

- 认证接口：登录、登出、刷新 Token
- 应用管理：应用的 CRUD 操作
- 版本管理：版本的创建、发布、回滚
- 用户管理：应用用户和平台用户管理
- 更新任务：更新任务的创建和查询
- 统计分析：应用统计数据查询
- 操作日志：操作日志查询和导出

详细接口文档请参考：[管理 API 文档](./docs/api.md)

或访问运行时的交互式文档：`http://localhost:9999/reference`

## 🔧 开发

### 可用脚本

```bash
# 开发
pnpm dev              # 启动开发服务器（热重载）

# 构建
pnpm build            # 构建项目
pnpm start            # 启动生产服务器

# 代码质量
pnpm lint             # 检查代码
pnpm lint:fix         # 自动修复代码问题
pnpm typecheck        # TypeScript 类型检查

# 测试
pnpm test             # 运行测试

# 数据库
pnpm db:push          # 推送数据库模式（开发环境）
pnpm db:generate      # 生成迁移文件
pnpm db:migrate       # 应用迁移
pnpm db:studio        # 打开 Drizzle Studio
```

### 环境变量说明

| 变量名                   | 类型   | 必需 | 说明                                                       |
| ------------------------ | ------ | ---- | ---------------------------------------------------------- |
| `DATABASE_URL`           | string | ✅   | 数据库连接 URL（支持 `file:`、`http://`、`https://` 协议） |
| `DATABASE_AUTH_TOKEN`    | string | ⚠️   | 数据库认证令牌（生产环境必需）                             |
| `JWT_SECRET`             | string | ✅   | JWT 密钥（至少 32 个字符）                                 |
| `JWT_EXPIRES_IN`         | string | ❌   | Access Token 过期时间（默认：1h）                          |
| `JWT_REFRESH_EXPIRES_IN` | string | ❌   | Refresh Token 过期时间（默认：7d）                         |
| `LOG_LEVEL`              | string | ✅   | 日志级别（fatal/error/warn/info/debug/trace/silent）       |
| `NODE_ENV`               | string | ❌   | 运行环境（默认：development）                              |
| `PORT`                   | number | ❌   | 服务器端口（默认：9999）                                   |
| `UPDATES_BASE_URL`       | string | ❌   | Expo Updates 服务器基础 URL                                |
| `PRIVATE_KEY_PATH`       | string | ❌   | Expo Updates 代码签名私钥路径                              |
| `ADMIN_KEY`              | string | ❌   | 管理密钥（用于创建管理员账户）                             |

## 🧪 测试

使用 Vitest 进行单元测试：

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test --watch

# 覆盖率报告
pnpm test --coverage
```

## 📦 部署

### 构建项目

```bash
pnpm build
```

### 运行生产服务器

```bash
pnpm start
```

### 环境配置

确保在生产环境中配置以下环境变量：

- `DATABASE_URL` - 使用 Turso 或其他生产数据库
- `DATABASE_AUTH_TOKEN` - 数据库认证令牌
- `JWT_SECRET` - 强随机密钥
- `NODE_ENV=production`
- `LOG_LEVEL` - 根据需求设置日志级别

### 部署建议

- 使用反向代理（如 Nginx）处理 HTTPS 和静态资源
- 使用进程管理器（如 PM2）管理 Node.js 进程
- 配置对象存储服务（如 AWS S3、阿里云 OSS）存储更新包文件
- 配置 CDN 加速资源文件分发
- 使用环境变量管理敏感配置

## 🔐 安全建议

1. **JWT 密钥**：使用强随机密钥，至少 32 个字符
2. **数据库认证**：生产环境必须配置 `DATABASE_AUTH_TOKEN`
3. **HTTPS**：生产环境必须使用 HTTPS
4. **代码签名**：生产环境建议配置代码签名私钥
5. **文件上传**：限制文件大小和类型，验证文件完整性
6. **速率限制**：在生产环境中配置 API 速率限制

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 遵循项目代码风格（使用 ESLint）
- 编写清晰的提交信息
- 为新功能添加测试
- 更新相关文档

## 📄 License

本项目采用 [MIT License](./LICENSE) 许可证。

## 🙏 致谢

- [Hono](https://hono.dev/) - 优秀的 Web 框架
- [Expo](https://expo.dev/) - Expo Updates 协议参考
- [Drizzle ORM](https://orm.drizzle.team/) - 类型安全的 ORM

## 📚 相关资源

- [Expo Updates 官方文档](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Hono 文档](https://hono.dev/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team/docs)
- [OpenAPI 规范](https://swagger.io/specification/)

## 💬 反馈

如果你遇到问题或有建议，请：

- 提交 [Issue](https://github.com/your-username/expo-updates-api/issues)
- 开启 [Discussion](https://github.com/your-username/expo-updates-api/discussions)

---

**注意**：本项目是 Expo Updates 服务端的实现示例，生产环境使用前请进行充分测试和安全评估。
