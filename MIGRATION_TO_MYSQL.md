# 从 Turso (SQLite) 迁移到 MySQL 指南

本文档列出了将数据库从 Turso (SQLite) 迁移到 MySQL 需要调整的所有内容。

## 📋 迁移清单

### 1. 更新依赖包 (package.json)

#### 需要移除的依赖：
- `@libsql/client` - Turso/SQLite 客户端

#### 需要添加的依赖：
```json
{
  "dependencies": {
    "mysql2": "^3.6.0"  // MySQL 客户端（推荐使用 mysql2，支持 Promise）
  }
}
```

**操作步骤：**
```bash
pnpm remove @libsql/client
pnpm add mysql2
```

---

### 2. 更新数据库连接配置 (src/db/index.ts)

**当前代码：**
```typescript
import { drizzle } from "drizzle-orm/libsql";
```

**需要改为：**
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
```

**连接配置需要改为：**
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import env from "@/env";
import * as schema from "./schema";

const connection = mysql.createConnection({
  uri: env.DATABASE_URL,
});

const db = drizzle(connection, {
  schema,
  mode: "default", // 或 "planetscale" 如果使用 PlanetScale
  casing: "snake_case",
});

export default db;
```

**或者使用连接池（推荐生产环境）：**
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import env from "@/env";
import * as schema from "./schema";

const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  // 或者使用详细配置：
  // host: env.DATABASE_HOST,
  // port: env.DATABASE_PORT,
  // user: env.DATABASE_USER,
  // password: env.DATABASE_PASSWORD,
  // database: env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const db = drizzle(pool, {
  schema,
  mode: "default",
  casing: "snake_case",
});

export default db;
```

---

### 3. 更新 Drizzle 配置 (drizzle.config.ts)

**当前配置：**
```typescript
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  casing: "snake_case",
  dbCredentials: {
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  },
});
```

**需要改为：**
```typescript
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "mysql",
  casing: "snake_case",
  dbCredentials: {
    url: env.DATABASE_URL,
    // 或者使用详细配置：
    // host: env.DATABASE_HOST,
    // port: env.DATABASE_PORT,
    // user: env.DATABASE_USER,
    // password: env.DATABASE_PASSWORD,
    // database: env.DATABASE_NAME,
  },
});
```

---

### 4. 更新环境变量配置 (src/env.ts)

**需要移除：**
- `DATABASE_AUTH_TOKEN` - MySQL 不需要认证令牌

**需要更新：**
- `DATABASE_URL` 验证逻辑 - MySQL 连接字符串格式：`mysql://user:password@host:port/database`

**更新后的环境变量 Schema：**
```typescript
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  DATABASE_URL: z.string().url().refine(
    (val) => val.startsWith("mysql://") || val.startsWith("mysql2://"),
    { message: "DATABASE_URL 必须是有效的 MySQL 连接字符串" },
  ),
  // 移除 DATABASE_AUTH_TOKEN
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  // ... 其他环境变量
});

// 移除 superRefine 中关于 DATABASE_AUTH_TOKEN 的验证
```

**可选：如果需要更细粒度的控制，可以添加：**
```typescript
DATABASE_HOST: z.string().optional(),
DATABASE_PORT: z.coerce.number().default(3306),
DATABASE_USER: z.string().optional(),
DATABASE_PASSWORD: z.string().optional(),
DATABASE_NAME: z.string().optional(),
```

---

### 5. 更新所有表定义文件 (src/db/tables/*.ts)

这是最关键的步骤，需要修改所有表定义文件。

#### 5.1 导入语句更改

**当前：**
```typescript
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
```

**改为：**
```typescript
import { index, int, mysqlTable, text, timestamp, boolean, varchar } from "drizzle-orm/mysql-core";
```

#### 5.2 表定义更改

**当前：**
```typescript
export const apps = sqliteTable("apps", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // ...
});
```

**改为：**
```typescript
export const apps = mysqlTable("apps", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 或者使用 binary(16) 存储 UUID（更高效）：
  // id: binary("id", { length: 16 })
  //   .primaryKey()
  //   .$defaultFn(() => Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex")),
  // ...
});
```

#### 5.3 数据类型映射

| SQLite (当前) | MySQL (目标) | 说明 |
|--------------|-------------|------|
| `text()` | `varchar(length)` 或 `text()` | 文本字段，根据长度选择 |
| `text().primaryKey()` | `varchar(36).primaryKey()` | UUID 主键 |
| `integer({ mode: "timestamp" })` | `timestamp()` 或 `datetime()` | 时间戳 |
| `integer({ mode: "boolean" })` | `boolean()` 或 `tinyint(1)` | 布尔值 |
| `integer({ mode: "number" })` | `int()` | 整数 |
| `integer().primaryKey({ autoIncrement: true })` | `int().primaryKey().autoincrement()` | 自增主键 |

#### 5.4 具体字段类型调整示例

**时间戳字段：**
```typescript
// SQLite
createdAt: integer({ mode: "timestamp" })
  .$defaultFn(() => new Date())
  .notNull(),

// MySQL
createdAt: timestamp("created_at")
  .defaultNow()
  .notNull(),
  // 或者使用 datetime：
  // createdAt: datetime("created_at", { mode: "date", fsp: 3 })
  //   .defaultNow()
  //   .notNull(),
```

**布尔字段：**
```typescript
// SQLite
isMandatory: integer({ mode: "boolean" }).notNull().default(false),

// MySQL
isMandatory: boolean("is_mandatory").notNull().default(false),
```

**文本字段：**
```typescript
// SQLite
name: text().notNull(),

// MySQL（根据实际需求选择长度）
name: varchar("name", { length: 255 }).notNull(),
// 或者如果长度不确定：
// name: text("name").notNull(),
```

**自增主键：**
```typescript
// SQLite
id: integer({ mode: "number" })
  .primaryKey({ autoIncrement: true }),

// MySQL
id: int("id")
  .primaryKey()
  .autoincrement(),
```

#### 5.5 UUID 生成函数

MySQL 可以使用应用层生成 UUID，或者使用 MySQL 的 `UUID()` 函数：

**应用层生成（推荐，与当前代码兼容）：**
```typescript
id: varchar("id", { length: 36 })
  .primaryKey()
  .$defaultFn(() => crypto.randomUUID()),
```

**MySQL 函数生成：**
```typescript
id: varchar("id", { length: 36 })
  .primaryKey()
  .default(sql`(UUID())`),
```

#### 5.6 需要更新的文件列表

需要更新以下所有表定义文件：
- `src/db/tables/apps.ts`
- `src/db/tables/users.ts`
- `src/db/tables/versions.ts`
- `src/db/tables/app-users.ts`
- `src/db/tables/update-tasks.ts`
- `src/db/tables/user-groups.ts`
- `src/db/tables/user-group-members.ts`
- `src/db/tables/operation-logs.ts`
- `src/db/tables/uploads.ts`
- `src/tables/tasks.ts`
- `src/db/tables/user-apps.ts`

---

### 6. 更新迁移文件

**重要：** 需要删除旧的 SQLite 迁移文件，重新生成 MySQL 迁移文件。

**操作步骤：**
1. 备份现有数据（如果需要）
2. 删除 `src/db/migrations/` 目录下的所有迁移文件
3. 更新所有表定义文件（步骤 5）
4. 运行 `pnpm db:generate` 生成新的 MySQL 迁移文件
5. 运行 `pnpm db:migrate` 应用迁移

---

### 7. 检查代码中的数据库特定查询

搜索代码中是否有 SQLite 特定的查询语法，例如：
- `LIKE` 查询（MySQL 也支持，但大小写敏感性可能不同）
- 字符串函数（如 `SUBSTR` vs `SUBSTRING`）
- 日期函数（如 `datetime()` vs `NOW()`）

**检查命令：**
```bash
# 搜索可能的 SQLite 特定语法
grep -r "sqlite" src/
grep -r "libsql" src/
```

---

### 8. 更新 .env 文件

**当前格式（Turso）：**
```env
DATABASE_URL=libsql://your-database-url
DATABASE_AUTH_TOKEN=your-auth-token
```

**MySQL 格式：**
```env
DATABASE_URL=mysql://user:password@host:port/database
# 或者
DATABASE_URL=mysql2://user:password@host:port/database
```

**示例：**
```env
DATABASE_URL=mysql://root:password@localhost:3306/expo_updates
```

---

### 9. 测试和验证

迁移完成后，需要测试以下功能：

1. **数据库连接**：确保应用可以连接到 MySQL 数据库
2. **表创建**：验证所有表都正确创建
3. **CRUD 操作**：测试增删改查操作
4. **关系查询**：测试外键关系和关联查询
5. **索引**：验证索引是否正确创建
6. **迁移脚本**：确保迁移脚本可以正常运行

---

### 10. 性能优化建议

迁移到 MySQL 后，可以考虑以下优化：

1. **连接池配置**：使用连接池管理数据库连接
2. **索引优化**：根据查询模式优化索引
3. **字符集设置**：使用 `utf8mb4` 字符集支持完整的 Unicode
4. **存储引擎**：使用 `InnoDB` 存储引擎（默认）支持事务和外键

---

## 🔄 迁移步骤总结

1. ✅ 更新 `package.json`：移除 `@libsql/client`，添加 `mysql2`
2. ✅ 更新 `src/db/index.ts`：更改导入和连接配置
3. ✅ 更新 `drizzle.config.ts`：更改 dialect 和连接配置
4. ✅ 更新 `src/env.ts`：移除 `DATABASE_AUTH_TOKEN`，更新验证逻辑
5. ✅ 更新所有表定义文件：`sqliteTable` → `mysqlTable`，调整数据类型
6. ✅ 删除旧迁移文件，重新生成 MySQL 迁移
7. ✅ 更新 `.env` 文件：使用 MySQL 连接字符串
8. ✅ 运行测试：确保所有功能正常

---

## ⚠️ 注意事项

1. **数据迁移**：如果已有数据，需要编写数据迁移脚本
2. **UUID 格式**：确保 UUID 格式在 MySQL 中正确存储和查询
3. **时区设置**：注意 MySQL 的时区设置，确保时间戳正确
4. **字符集**：使用 `utf8mb4` 字符集以支持完整的 Unicode（包括 emoji）
5. **外键约束**：MySQL 默认启用外键约束，确保数据完整性
6. **事务支持**：MySQL 的 InnoDB 引擎支持事务，可以利用此特性

---

## 📚 参考资源

- [Drizzle ORM MySQL 文档](https://orm.drizzle.team/docs/get-started-mysql)
- [mysql2 文档](https://github.com/sidorares/node-mysql2)
- [MySQL 数据类型文档](https://dev.mysql.com/doc/refman/8.0/en/data-types.html)
