# MySQL 迁移完成总结

## ✅ 已完成的迁移步骤

### 1. 依赖包更新 ✅
- ✅ 移除 `@libsql/client`
- ✅ 添加 `mysql2`

**下一步操作：**
```bash
pnpm install
```

### 2. 数据库连接配置 ✅
- ✅ 更新 `src/db/index.ts`
  - 从 `drizzle-orm/libsql` 改为 `drizzle-orm/mysql2`
  - 使用 `mysql2/promise` 创建连接池
  - 配置连接池参数

### 3. Drizzle 配置 ✅
- ✅ 更新 `drizzle.config.ts`
  - `dialect` 从 `"turso"` 改为 `"mysql"`
  - 移除 `authToken` 配置

### 4. 环境变量配置 ✅
- ✅ 更新 `src/env.ts`
  - 移除 `DATABASE_AUTH_TOKEN`
  - 更新 `DATABASE_URL` 验证逻辑（要求 `mysql://` 或 `mysql2://` 前缀）

### 5. 所有表定义文件 ✅
已更新以下所有表定义文件：
- ✅ `src/db/tables/apps.ts`
- ✅ `src/db/tables/users.ts`
- ✅ `src/db/tables/versions.ts`
- ✅ `src/db/tables/tasks.ts`
- ✅ `src/db/tables/app-users.ts`
- ✅ `src/db/tables/update-tasks.ts`
- ✅ `src/db/tables/user-groups.ts`
- ✅ `src/db/tables/user-group-members.ts`
- ✅ `src/db/tables/operation-logs.ts`
- ✅ `src/db/tables/uploads.ts`
- ✅ `src/db/tables/user-apps.ts`

**主要变更：**
- `sqliteTable` → `mysqlTable`
- `text()` → `varchar(length)` 或 `text()`
- `integer({ mode: "timestamp" })` → `timestamp()`
- `integer({ mode: "boolean" })` → `boolean()`
- `integer({ mode: "number" })` → `int()`
- UUID 主键：`text()` → `varchar(36)`
- 自增主键：`integer({ mode: "number" }).primaryKey({ autoIncrement: true })` → `int().primaryKey().autoincrement()`

### 6. 代码注释更新 ✅
- ✅ 更新了 4 个 handlers 文件中的 SQLite 相关注释

---

## 📋 下一步需要执行的操作

### 1. 安装依赖
```bash
pnpm install
```

### 2. 更新环境变量文件 (.env)
将 `DATABASE_URL` 更新为 MySQL 连接字符串格式：

**旧格式（Turso）：**
```env
DATABASE_URL=libsql://your-database-url
DATABASE_AUTH_TOKEN=your-auth-token
```

**新格式（MySQL）：**
```env
DATABASE_URL=mysql://user:password@host:port/database
# 或者
DATABASE_URL=mysql2://user:password@host:port/database
```

**示例：**
```env
DATABASE_URL=mysql://root:password@localhost:3306/expo_updates
```

### 3. 删除旧的迁移文件（可选，但推荐）
旧的 SQLite 迁移文件不再适用，建议删除后重新生成：

```bash
# 备份现有迁移文件（如果需要）
# 然后删除 src/db/migrations/ 目录下的所有文件
```

### 4. 生成新的 MySQL 迁移文件
```bash
pnpm db:generate
```

### 5. 应用迁移
```bash
pnpm db:migrate
```

或者使用 push 命令（开发环境）：
```bash
pnpm db:push
```

### 6. 测试数据库连接
启动应用并测试数据库连接：
```bash
pnpm dev
```

### 7. 验证功能
测试以下功能确保一切正常：
- ✅ 数据库连接
- ✅ 表创建
- ✅ CRUD 操作
- ✅ 关系查询
- ✅ 索引功能

---

## ⚠️ 注意事项

### 数据迁移
如果已有数据需要迁移：
1. 导出 SQLite 数据
2. 转换为 MySQL 兼容格式
3. 导入到 MySQL 数据库

### 字符集设置
确保 MySQL 数据库使用 `utf8mb4` 字符集以支持完整的 Unicode（包括 emoji）：
```sql
ALTER DATABASE your_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### UUID 格式
所有 UUID 字段现在使用 `varchar(36)` 存储，确保数据格式一致。

### 时区设置
注意 MySQL 的时区设置，确保时间戳正确：
```sql
SET time_zone = '+00:00';  -- 或你的时区
```

---

## 🔍 验证清单

- [ ] 依赖已安装（`pnpm install`）
- [ ] `.env` 文件已更新 MySQL 连接字符串
- [ ] 旧迁移文件已删除（可选）
- [ ] 新迁移文件已生成（`pnpm db:generate`）
- [ ] 迁移已应用（`pnpm db:migrate` 或 `pnpm db:push`）
- [ ] 应用可以正常启动
- [ ] 数据库连接正常
- [ ] 所有表已正确创建
- [ ] CRUD 操作正常
- [ ] 关系查询正常

---

## 📚 参考文档

- [Drizzle ORM MySQL 文档](https://orm.drizzle.team/docs/get-started-mysql)
- [mysql2 文档](https://github.com/sidorares/node-mysql2)
- [MySQL 数据类型文档](https://dev.mysql.com/doc/refman/8.0/en/data-types.html)
- 详细迁移指南：`MIGRATION_TO_MYSQL.md`

---

## 🎉 迁移完成！

所有代码更改已完成。请按照上述步骤完成环境配置和数据库迁移。
