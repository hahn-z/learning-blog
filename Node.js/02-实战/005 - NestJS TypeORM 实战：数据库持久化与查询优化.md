---
title: "005 - NestJS TypeORM 实战：数据库持久化与查询优化"
slug: "005-nestjs-typeorm"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.695+08:00"
updated_at: "2026-04-29T10:02:48.052+08:00"
reading_time: 36
tags: []
---

## 🎯 难度标注

**难度等级：⭐⭐⭐ 中级**

> 前置要求：已完成 NestJS RESTful API 基础篇、了解 SQL 基础、熟悉 TypeScript 装饰器。本文将在上篇基础上集成 TypeORM。

---

## 📖 概念讲解

### 什么是 TypeORM？

TypeORM 是 TypeScript 和 JavaScript (ES7+) 的 ORM 框架，支持多种数据库（MySQL、PostgreSQL、SQLite、MongoDB 等）。它的核心思想是用 TypeScript 装饰器定义数据库模型，让开发者用面向对象的方式操作数据库。

### ORM vs 原生 SQL

| 维度 | ORM (TypeORM) | 原生 SQL |
|------|---------------|----------|
| 开发效率 | 高（自动生成 SQL） | 低（手写每条语句） |
| 类型安全 | ✅ TypeScript 强类型 | ❌ 字符串拼接 |
| 数据库迁移 | 内置支持 | 需要第三方工具 |
| 复杂查询 | 繁琐（QueryBuilder） | 灵活直观 |
| 性能 | 略有损耗 | 最优 |
| 可维护性 | 高（代码即文档） | 低（SQL 散落各处） |

### NestJS 集成 TypeORM 的方式

```
方式一（推荐）：@nestjs/typeorm 模块 + forRootAsync
方式二（简单）：TypeORM CLI 配置文件
```

---

## 🧠 知识脑图

```
NestJS + TypeORM
├── 配置集成
│   ├── @nestjs/typeorm
│   ├── forRoot / forRootAsync
│   └── 环境变量配置
├── 实体定义
│   ├── @Entity / @Column
│   ├── 主键策略 (@PrimaryGeneratedColumn)
│   └── 时间戳 (@CreateDateColumn / @UpdateDateColumn)
├── 关联关系
│   ├── OneToOne
│   ├── OneToMany / ManyToOne
│   └── ManyToMany
├── 仓库模式
│   ├── @InjectRepository
│   ├── Repository API
│   └── 自定义 Repository
├── 查询
│   ├── find / findOne
│   ├── QueryBuilder
│   └── 分页与排序
├── 迁移
│   ├── 生成迁移文件
│   ├── 执行迁移
│   └── 回滚迁移
└── 优化
    ├── 索引设计
    ├── 懒加载关联
    └── 查询缓存
```

---

## 💻 完整代码实现

### 项目准备

```bash
# Install TypeORM dependencies
npm install @nestjs/typeorm typeorm mysql2
# Or for PostgreSQL: npm install pg
# Or for SQLite (dev): npm install better-sqlite3

npm install @nestjs/config  # Environment config
```

### v1：基础配置与实体

```typescript
// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 3306),
  username: configService.get<string>('DB_USER', 'root'),
  password: configService.get<string>('DB_PASS', ''),
  database: configService.get<string>('DB_NAME', 'blog_db'),
  // Auto-load entities
  autoLoadEntities: true,
  // Sync schema in dev only!
  synchronize: configService.get<string>('NODE_ENV') === 'development',
  // Logging
  logging: configService.get<string>('NODE_ENV') === 'development',
});
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsModule } from './posts/posts.module';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({ isGlobal: true }),
    // TypeORM with async config
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    PostsModule,
  ],
})
export class AppModule {}
```

```typescript
// src/posts/entities/post.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  @Index() // Add index for search
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'uncategorized' })
  @Index()
  category: string;

  @Column({ default: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

```typescript
// src/posts/posts.module.ts (updated for TypeORM)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

```typescript
// src/posts/posts.service.ts (v1 - basic TypeORM)
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
  ) {}

  async create(dto: CreatePostDto): Promise<Post> {
    const post = this.postRepo.create(dto);
    return this.postRepo.save(post);
  }

  async findAll(page = 1, limit = 10): Promise<{ data: Post[]; total: number }> {
    const [data, total] = await this.postRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async findOne(id: number): Promise<Post> {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException(`Post #${id} not found`);
    return post;
  }

  async update(id: number, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(id);
    Object.assign(post, dto);
    return this.postRepo.save(post);
  }

  async remove(id: number): Promise<void> {
    const result = await this.postRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Post #${id} not found`);
    }
  }
}
```

### v2：关联关系 + QueryBuilder

```typescript
// src/users/entities/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ select: false }) // Exclude from default queries
  password: string;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

```typescript
// Updated post entity with author relation
// src/posts/entities/post.entity.ts (add these fields)
import { ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Add to Post entity class:
@ManyToOne(() => User, (user) => user.posts)
author: User;

@Column({ name: 'author_id' })
authorId: number;
```

```typescript
// src/tags/entities/tag.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToMany, JoinTable,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Post, (post) => post.tags)
  @JoinTable()
  posts: Post[];
}
```

```typescript
// Add tags relation to Post entity
@ManyToMany(() => Tag, (tag) => tag.posts)
@JoinTable()
tags: Tag[];
```

```typescript
// src/posts/posts.service.ts (v2 - advanced queries)
async findByCategory(category: string, page = 1, limit = 10) {
  return this.postRepo.findAndCount({
    where: { category },
    skip: (page - 1) * limit,
    take: limit,
    relations: ['author', 'tags'],  // Eager load relations
    order: { createdAt: 'DESC' },
  });
}

// Search using QueryBuilder
async search(keyword: string, page = 1, limit = 10) {
  const qb = this.postRepo.createQueryBuilder('post');

  qb.where('post.title LIKE :keyword', { keyword: `%${keyword}%` })
    .orWhere('post.content LIKE :keyword', { keyword: `%${keyword}%` })
    .leftJoinAndSelect('post.author', 'author')
    .leftJoinAndSelect('post.tags', 'tags')
    .orderBy('post.created_at', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  const [data, total] = await qb.getManyAndCount();
  return { data, total };
}
```

### v3：迁移管理 + 优化

```bash
# Generate a migration
npx typeorm migration:generate -d src/data-source.ts src/migrations/AddPostTags

# Run migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts
```

```typescript
// src/migrations/1705312000000-CreatePostsTable.ts
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreatePostsTable1705312000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'posts',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'content', type: 'text' },
          { name: 'category', type: 'varchar', default: "'uncategorized'" },
          { name: 'is_published', type: 'boolean', default: true },
          { name: 'author_id', type: 'int', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // Add indexes
    await queryRunner.createIndex('posts', new TableIndex({
      name: 'IDX_posts_title',
      columnNames: ['title'],
    }));
    await queryRunner.createIndex('posts', new TableIndex({
      name: 'IDX_posts_category',
      columnNames: ['category'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('posts');
  }
}
```

```typescript
// Environment config
// .env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=secret
DB_NAME=blog_db
NODE_ENV=development
```

---

## 🔍 执行预览

```bash
# Run migrations
$ npx typeorm migration:run -d src/data-source.ts
query: SELECT * FROM `information_schema`.`COLUMNS` ...
query: CREATE TABLE `posts` (`id` int NOT NULL AUTO_INCREMENT, ...)
Migration CreatePostsTable1705312000000 has been executed successfully.

# Start the server
$ npm run start:dev
[Nest] 12345  - 04/15/2024 LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 04/15/2024 LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 04/15/2024 LOG [NestApplication] Nest application successfully started

# Create a post
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"TypeORM Guide","content":"Learn TypeORM with NestJS step by step...","category":"database"}'

# Response:
{
  "success": true,
  "data": {
    "id": 1,
    "title": "TypeORM Guide",
    "content": "Learn TypeORM with NestJS step by step...",
    "category": "database",
    "isPublished": true,
    "createdAt": "2024-04-15T10:00:00.000Z",
    "updatedAt": "2024-04-15T10:00:00.000Z"
  }
}

# Search posts
$ curl "http://localhost:3000/posts/search?keyword=TypeORM"
{
  "success": true,
  "data": { "data": [...], "total": 1 }
}
```

---

## ⚠️ 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| synchronize | 自动同步表结构 | **仅开发环境使用**，生产用迁移 |
| select: false | 敏感字段排除默认查询 | 密码等敏感字段必须设置 |
| Eager vs Lazy | 关联加载策略 | 按需选择，避免 N+1 问题 |
| 连接池 | 默认连接池大小 | 生产环境需根据负载调整 |
| 事务 | 多表操作需保证一致性 | 使用 `@Transaction()` 或 EntityManager |
| 软删除 | `@DeleteDateColumn` | 重要数据推荐软删除 |
| 迁移顺序 | 文件名带时间戳排序 | 命名规范：`Timestamp-Description` |
| SQL 注入 | QueryBuilder 参数绑定 | 用 `:param` 占位符，不要拼接字符串 |

---

## 🚫 避坑指南

### ❌ 生产环境开启 synchronize
```typescript
// BAD: Auto-sync in production - can cause data loss!
TypeOrmModule.forRoot({
  synchronize: true,  // DANGER!
})
```

### ✅ 开发用 synchronize，生产用 migration
```typescript
// GOOD: Conditional sync
{
  synchronize: configService.get('NODE_ENV') === 'development',
}
```

### ❌ N+1 查询问题
```typescript
// BAD: N+1 queries - 1 query for posts + N queries for authors
const posts = await this.postRepo.find();
for (const post of posts) {
  // Each access triggers a separate query!
  console.log(post.author.name);
}
```

### ✅ 使用 relations 或 JoinFetcher
```typescript
// GOOD: Single query with JOIN
const posts = await this.postRepo.find({
  relations: ['author', 'tags'],
});
```

### ❌ 直接拼接 SQL 搜索
```typescript
// BAD: SQL injection vulnerable
qb.where(`title LIKE '%${keyword}%'`);
```

### ✅ 使用参数绑定
```typescript
// GOOD: Parameterized query
qb.where('post.title LIKE :keyword', { keyword: `%${keyword}%` });
```

---

## 🏋️ 练习题

### 🟢 基础题

1. **创建 Comment 实体**：设计评论表，包含 `content`、`postId`（外键关联 Post）、`authorName`，并实现 CRUD API。

2. **添加软删除**：给 Post 实体添加 `@DeleteDateColumn`，修改 remove 方法使用 `softDelete()`。

### 🟡 进阶题

3. **多条件筛选**：实现 `GET /posts?category=xxx&isPublished=true&search=keyword` 多条件组合查询，使用 QueryBuilder 动态构建 WHERE 子句。

4. **数据库事务**：创建文章时同时创建标签（如果标签不存在），用事务保证原子性。

### 🔴 挑战题

5. **读写分离**：配置 TypeORM 主从复制，写操作走主库，读操作走从库，实现数据库读写分离架构。

---

## 📝 知识点总结

```
NestJS + TypeORM
├── 基础配置
│   ├── TypeOrmModule.forRootAsync()
│   ├── ConfigModule 环境变量
│   └── autoLoadEntities
├── 实体定义
│   ├── @Entity / @Column
│   ├── @PrimaryGeneratedColumn
│   ├── @CreateDateColumn / @UpdateDateColumn
│   └── @Index 索引
├── 关联关系
│   ├── @ManyToOne / @OneToMany (一对多)
│   ├── @ManyToMany (多对多)
│   ├── @JoinTable / @JoinColumn
│   └── relations 选项
├── 查询
│   ├── find / findOne / findAndCount
│   ├── QueryBuilder
│   ├── 分页 (skip/take)
│   └── 排序 (order)
├── 迁移
│   ├── migration:generate
│   ├── migration:run
│   └── migration:revert
└── 优化
    ├── 索引设计
    ├── 避免 N+1
    └── select: false 敏感字段
```

---

## 🔄 举一反三

| 场景 | TypeORM 方案 | Prisma 方案 |
|------|-------------|-------------|
| 实体定义 | 装饰器 @Entity | schema.prisma 文件 |
| 数据库迁移 | CLI migration 命令 | prisma migrate |
| 关联查询 | relations / QueryBuilder | include 选项 |
| 事务 | EntityManager.transaction | prisma.$transaction |
| 类型安全 | TypeScript 装饰器 | 自动生成类型 |
| 查询构建 | QueryBuilder (OOP风格) | prisma.xxx.findMany (链式) |
| 多数据库 | 支持 | 支持 |
| 社区活跃度 | ★★★★★ | ★★★★★ |

---

## 📚 参考资料

- [TypeORM 官方文档](https://typeorm.io/)
- [NestJS TypeORM 集成](https://docs.nestjs.com/techniques/database)
- [TypeORM Entity 参考](https://typeorm.io/entities)
- [TypeORM Relations](https://typeorm.io/relations)
- [TypeORM Migrations](https://typeorm.io/migrations)

---

## 🛤️ 代码演进路线

### v1 → 基础集成（本文已覆盖）
- TypeORM 模块配置
- 实体定义与基本 CRUD
- Repository 模式
- 环境变量配置

### v2 → 关联关系（本文已覆盖）
- OneToMany / ManyToOne 关联
- ManyToMany 多对多
- QueryBuilder 高级查询
- 搜索功能

### v3 → 生产优化（后续展开）
- 数据库迁移管理
- 事务处理
- 读写分离
- 查询缓存
- 连接池调优
- 数据库索引优化

> **上一篇**：[NestJS RESTful API → 基础实战](/posts/024-nestjs-rest)
> **下一篇**：[NestJS 认证JWT → 身份验证实战](/posts/026-nestjs-auth)
