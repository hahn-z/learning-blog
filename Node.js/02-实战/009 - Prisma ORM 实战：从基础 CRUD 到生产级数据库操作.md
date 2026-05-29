---
title: "009 - Prisma ORM 实战：从基础 CRUD 到生产级数据库操作"
slug: "009-prisma"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.715+08:00"
updated_at: "2026-04-29T10:02:48.088+08:00"
reading_time: 39
tags: []
---

## 难度标注

> ⭐⭐⭐☆☆ 中等 | 需要了解 Node.js 和数据库基础

## 概念讲解

### 什么是 Prisma？

Prisma 是下一代 Node.js/TypeScript ORM，它不使用传统的装饰器或模型类，而是通过 **Schema 声明式定义** 数据模型，然后自动生成类型安全的客户端代码。

### Prisma vs 其他 ORM

| 特性 | Prisma | TypeORM | Sequelize | Mongoose |
|------|--------|---------|-----------|----------|
| 类型安全 | ✅ 自动生成 | ⚠️ 需手动 | ❌ 弱 | ⚠️ 需手动 |
| Schema 定义 | `.prisma` 文件 | 装饰器 | JS 对象 | Schema |
| 迁移工具 | ✅ 内置 | ✅ 内置 | ❌ 手动 | ❌ 无 |
| 查询方式 | 链式 API | QueryBuilder | 链式/原始 | 链式 |
| 学习曲线 | 低 | 中 | 中 | 中 |
| 多数据库 | ✅ | ✅ | ✅ | MongoDB only |

### 核心组件

- **Prisma Schema**（`schema.prisma`）：声明式数据模型定义
- **Prisma Client**：自动生成的类型安全查询客户端
- **Prisma Migrate**：数据库迁移管理工具
- **Prisma Studio**：可视化数据库管理界面

## 脑图

```
Prisma ORM
├── 核心概念
│   ├── Schema 定义 (schema.prisma)
│   ├── 数据源 (datasource)
│   ├── 生成器 (generator)
│   └── 模型 (model)
├── CRUD 操作
│   ├── create / createMany
│   ├── findUnique / findFirst / findMany
│   ├── update / updateMany / upsert
│   └── delete / deleteMany
├── 高级查询
│   ├── 过滤 (where)
│   ├── 排序 (orderBy)
│   ├── 分页 (skip/take/cursor)
│   ├── 关联查询 (include/select)
│   └── 原始 SQL ($queryRaw)
├── 关系
│   ├── 一对一 (1:1)
│   ├── 一对多 (1:N)
│   └── 多对多 (M:N)
├── 迁移
│   ├── prisma migrate dev
│   ├── prisma migrate deploy
│   └── prisma db push
└── 最佳实践
    ├── 事务 ($transaction)
    ├── 中间件/扩展
    ├── 连接池管理
    └── N+1 优化
```

## 完整代码

### 项目初始化

```bash
mkdir prisma-demo && cd prisma-demo
npm init -y
npm install prisma @prisma/client express
npx prisma init --datasource-provider postgresql
```

### Schema 定义

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  avatar    String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users") // Map to table name "users"
}

model Profile {
  id     Int     @id @default(autoincrement())
  bio    String?
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int     @unique @map("user_id")

  @@map("profiles")
}

model Post {
  id        Int       @id @default(autoincrement())
  title     String
  content   String?
  published Boolean   @default(false)
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int       @map("author_id")
  tags      Tag[]
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@index([authorId]) // Add index for foreign key
  @@map("posts")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  posts Post[]

  @@map("tags")
}

enum Role {
  USER
  ADMIN
}
```

### v1：基础 CRUD

```typescript
// src/database.ts
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Enable logging
});

export default prisma;
```

```typescript
// src/user.service.ts
import prisma from './database';

export class UserService {
  // Create a new user
  async create(data: { email: string; name?: string }) {
    return prisma.user.create({ data });
  }

  // Find user by ID with profile
  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        posts: {
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  // Find user by email
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  // List users with pagination
  async findMany(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: { select: { posts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Update user
  async update(id: number, data: { name?: string; email?: string }) {
    return prisma.user.update({ where: { id }, data });
  }

  // Delete user (cascade deletes profile and posts)
  async remove(id: number) {
    return prisma.user.delete({ where: { id } });
  }
}
```

```typescript
// src/post.service.ts
import prisma from './database';
import { Prisma } from '@prisma/client';

export class PostService {
  // Create post with tags (connect or create)
  async create(data: {
    title: string;
    content?: string;
    authorId: number;
    tagNames?: string[];
  }) {
    return prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: data.authorId,
        tags: {
          connectOrCreate: data.tagNames?.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { tags: true, author: { select: { id: true, name: true } } },
    });
  }

  // Search posts with dynamic filters
  async search(params: {
    keyword?: string;
    tag?: string;
    authorId?: number;
    published?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { keyword, tag, authorId, published, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const where: Prisma.PostWhereInput = {};
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (tag) where.tags = { some: { name: tag } };
    if (authorId) where.authorId = authorId;
    if (published !== undefined) where.published = published;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        include: { tags: true, author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ]);

    return { data: posts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Publish a post
  async publish(id: number) {
    return prisma.post.update({ where: { id }, data: { published: true } });
  }
}
```

### v2：事务和高级查询

```typescript
// src/advanced.service.ts
import prisma from './database';

export class AdvancedService {
  /**
   * Interactive transaction: create user + profile atomically
   * Rolls back both if either fails
   */
  async createUserWithProfile(data: {
    email: string;
    name: string;
    bio?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Check if email already exists
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      if (existing) throw new Error(`Email ${data.email} already registered`);

      // Create user
      const user = await tx.user.create({
        data: { email: data.email, name: data.name },
      });

      // Create profile
      const profile = await tx.profile.create({
        data: { bio: data.bio || '', userId: user.id },
      });

      return { user, profile };
    });
  }

  /**
   * Batch transaction: create multiple posts atomically
   */
  async batchCreatePosts(posts: Array<{ title: string; authorId: number }>) {
    return prisma.$transaction(
      posts.map((post) => prisma.post.create({ data: post })),
    );
  }

  /**
   * Aggregation: get post count by author, ordered by most posts
   */
  async getAuthorStats() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { posts: true } },
      },
      orderBy: { posts: { _count: 'desc' } },
    });
  }

  /**
   * Raw SQL for complex full-text search (PostgreSQL)
   */
  async searchWithRank(keyword: string) {
    return prisma.$queryRaw`
      SELECT p.id, p.title, p.content,
             ts_rank_cd(
               to_tsvector('english', p.title || ' ' || COALESCE(p.content, '')),
               plainto_tsquery('english', ${keyword})
             ) AS rank
      FROM posts p
      WHERE to_tsvector('english', p.title || ' ' || COALESCE(p.content, ''))
            @@ plainto_tsquery('english', ${keyword})
      ORDER BY rank DESC
      LIMIT 20
    `;
  }

  /**
   * Upsert: insert if not exists, update if exists
   */
  async upsertUser(email: string, name: string) {
    return prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });
  }
}
```

### v3：Express API + 错误处理

```typescript
// src/app.ts
import express from 'express';
import prisma from './database';
import { UserService } from './user.service';
import { PostService } from './post.service';

const app = express();
app.use(express.json());

const userService = new UserService();
const postService = new PostService();

// User routes
app.post('/users', async (req, res, next) => {
  try {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  } catch (err) { next(err); }
});

app.get('/users', async (req, res, next) => {
  try {
    const result = await userService.findMany(
      Number(req.query.page) || 1,
      Number(req.query.limit) || 20,
    );
    res.json(result);
  } catch (err) { next(err); }
});

app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userService.findById(Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// Post routes
app.post('/posts', async (req, res, next) => {
  try {
    const post = await postService.create(req.body);
    res.status(201).json(post);
  } catch (err) { next(err); }
});

app.get('/posts', async (req, res, next) => {
  try {
    const result = await postService.search({
      keyword: req.query.keyword as string,
      tag: req.query.tag as string,
      authorId: req.query.authorId ? Number(req.query.authorId) : undefined,
      published: req.query.published === 'true' ? true : undefined,
      page: Number(req.query.page) || 1,
    });
    res.json(result);
  } catch (err) { next(err); }
});

app.patch('/posts/:id/publish', async (req, res, next) => {
  try {
    const post = await postService.publish(Number(req.params.id));
    res.json(post);
  } catch (err) { next(err); }
});

// Prisma error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  if (err.code === 'P2002') {
    // Unique constraint violation
    return res.status(409).json({ error: 'Duplicate entry', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    // Record not found
    return res.status(404).json({ error: 'Record not found' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown: disconnect Prisma
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
```

## 执行预览

```bash
# 生成迁移
$ npx prisma migrate dev --name init

Applying migration `20260429_init`
The following migration(s) have been applied:
migrations/
  └─ 20260429_init/
    └─ migration.sql

✔ Generated Prisma Client

# 生成客户端
$ npx prisma generate
✔ Prisma Client generated successfully

# 打开可视化界面
$ npx prisma studio
✔ Prisma Studio is up on http://localhost:5555

# 启动服务
$ npx ts-node src/app.ts
Server running on http://localhost:3000

# API 测试
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice"}'

{"id":1,"email":"alice@example.com","name":"Alice","role":"USER",...}

$ curl http://localhost:3000/users
{"data":[{"id":1,"email":"alice@example.com",...}],"pagination":{"page":1,"limit":20,"total":1,"totalPages":1}}

$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello Prisma","content":"My first post","authorId":1,"tagNames":["typescript","orm"]}'

{"id":1,"title":"Hello Prisma","tags":[{"id":1,"name":"typescript"},{"id":2,"name":"orm"}],...}
```

## 注意事项

| 项目 | 说明 |
|------|------|
| 连接池 | PostgreSQL 默认连接数 `num_cpus * 2 + 1`，可通过 `connection_limit` 调整 |
| N+1 问题 | 用 `include` 预加载关联，避免循环中查询 |
| 事务超时 | 交互式事务默认 5 秒超时，可配置 `timeout` 参数 |
| 软删除 | Prisma 不内置软删除，需在 Schema 中加 `deletedAt` 字段 |
| 连接管理 | API 服务用单例 PrismaClient，Serverless 每次新建 |
| Schema 变更 | 改完 Schema 后必须 `npx prisma migrate dev` 生成迁移 |
| 枚举限制 | `enum` 在 MySQL 中是真实 ENUM 类型，SQLite 不支持 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 每个 API 请求 `new PrismaClient()` | 应用级别单例，复用连接池 |
| 在循环中查询关联数据 | 用 `include` 一次加载，或用 `$queryRaw` JOIN |
| 忽略 Prisma 错误码 | 根据 `err.code`（P2002、P2025 等）做精准处理 |
| 直接拼接 SQL 字符串 | 用 `$queryRaw` 标签模板，自动参数化防注入 |
| `findMany` 不加 `take` 限制 | 始终设置分页限制，避免一次加载全量数据 |
| 生产环境用 `migrate dev` | 生产用 `migrate deploy`，不会重置数据 |
| 忘记 `$disconnect()` | 应用关闭时断开连接，避免连接泄漏 |

## 练习题

### 🟢 初级

1. 定义一个 `Comment` 模型，关联到 `Post` 和 `User`（多对一关系）
2. 编写查询：获取所有已发布的文章，按创建时间倒序排列
3. 使用 `createMany` 批量插入 10 条测试数据

### 🟡 中级

4. 实现标签的多对多查询：获取包含特定标签的所有文章
5. 编写交互式事务：创建文章时同时更新用户的文章计数缓存
6. 实现光标分页（cursor-based pagination），替代 offset 分页

### 🔴 高级

7. 使用 Prisma Middleware 实现自动软删除（查询时自动过滤 `deletedAt`）
8. 编写数据库 seeding 脚本（`prisma/seed.ts`），生成测试数据
9. 实现乐观锁：使用 `version` 字段防止并发更新冲突

## 知识点总结

```
Prisma ORM 知识树
├── Schema
│   ├── model 定义
│   ├── @id @unique @default
│   ├── @map @@map (字段/表映射)
│   ├── @relation (关联关系)
│   ├── enum 枚举
│   └── @@index 索引
├── 查询 API
│   ├── findUnique (唯一键查询)
│   ├── findFirst (条件首条)
│   ├── findMany (条件列表)
│   ├── create / createMany
│   ├── update / updateMany / upsert
│   └── delete / deleteMany
├── 关联操作
│   ├── include (预加载)
│   ├── select (字段选择)
│   ├── connect / connectOrCreate
│   └── create (嵌套创建)
├── 高级功能
│   ├── $transaction (事务)
│   ├── $queryRaw (原始 SQL)
│   ├── _count (聚合计数)
│   └── Prisma Middleware
├── 迁移
│   ├── prisma migrate dev
│   ├── prisma migrate deploy
│   └── prisma db push (原型)
└── 工具链
    ├── prisma studio
    ├── prisma generate
    ├── prisma seed
    └── prisma validate
```

## 举一反三

| Prisma 特性 | 本文用法 | 其他场景 | 迁移方案 |
|------------|---------|---------|---------|
| 关联查询 | include 预加载 | 多层嵌套关联 | 多级 `include` 或 `select` |
| 事务 | 交互式 $transaction | 批量转账 | 批量事务 + 乐观锁 |
| 动态过滤 | Prisma.WhereInput | 多条件搜索 | 构建动态 where 对象 |
| 原始 SQL | 全文搜索 | 复杂报表统计 | `$queryRaw` + 类型映射 |
| connectOrCreate | 标签自动创建 | 用户设置 | 确保唯一字段有索引 |
| 分页 | skip/take | 无限滚动 | cursor-based 分页 |

## 参考资料

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma vs TypeORM 对比](https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm)

## 代码演进

```
v1 (基础 CRUD)
├── Schema 定义
├── PrismaClient 单例
├── User/Post Service
├── 分页查询
└── 关联预加载

       ↓ 加入事务

v2 (高级查询)
├── 交互式事务
├── 批量操作
├── 聚合统计
├── 原始 SQL
└── Upsert

       ↓ 生产集成

v3 (Express API)
├── RESTful 路由
├── Prisma 错误处理
├── 动态过滤搜索
├── 优雅关闭
└── 连接池管理
```
