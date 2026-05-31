---
title: "003 - NestJS模块与依赖注入：掌握企业级架构的核心"
slug: "003-nestjs-modules"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.684+08:00"
updated_at: "2026-04-29T10:02:48.033+08:00"
reading_time: 53
tags: []
---

## 难度标注

> **难度：** 🔴 较高 | **前置知识：** NestJS基础、TypeScript装饰器、面向对象设计 | **预计耗时：** 4-5小时

---

## 概念讲解

### 什么是模块系统？

模块（Module）是NestJS组织应用结构的基本单位。每个模块封装一组相关的功能，包括控制器、服务、和其他提供者。模块之间通过**imports/exports**建立依赖关系。

### 什么是依赖注入（DI）？

依赖注入是一种设计模式：**对象不自己创建依赖，而是由外部容器注入**。NestJS内置了强大的IoC容器，自动管理对象的创建和生命周期。

```typescript
// Without DI: Manual instantiation (tight coupling)
const service = new UsersService(new DatabaseService(new ConfigService()));
const controller = new UsersController(service);

// With DI: NestJS handles everything (loose coupling)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {} // Auto-injected!
}
```

### 模块系统的核心要素

| 要素 | 作用 | 类比 |
|------|------|------|
| `imports` | 引入其他模块的导出 | import库 |
| `exports` | 暴露当前模块的提供者 | export接口 |
| `providers` | 注册可注入的服务 | 注册组件 |
| `controllers` | 注册控制器 | 注册路由 |

### Provider的四种注册方式

```typescript
@Module({
  providers: [
    // 1. Class provider (shorthand)
    UsersService,

    // 2. Class provider (full form)
    { provide: UsersService, useClass: UsersService },

    // 3. Value provider (mock/constant)
    { provide: 'CONFIG', useValue: { db: 'postgres' } },

    // 4. Factory provider (async/dynamic)
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        return await createConnection(configService.dbConfig);
      },
      inject: [ConfigService],
    },
  ],
})
```

---

## 脑图

```
NestJS模块与依赖注入
├── 模块系统（Module）
│   ├── @Module() 装饰器
│   ├── imports → 引入外部模块
│   ├── exports → 暴露提供者
│   ├── providers → 注册服务
│   └── controllers → 注册控制器
├── 依赖注入（DI）
│   ├── IoC容器
│   ├── 构造函数注入
│   ├── 属性注入（@Inject）
│   ├── Provider类型
│   │   ├── useClass
│   │   ├── useValue
│   │   ├── useFactory
│   │   └── useExisting（别名）
│   └── 作用域
│       ├── DEFAULT（单例）
│       ├── REQUEST（每请求）
│       └── TRANSIENT（每次注入）
├── 模块间通信
│   ├── exports + imports 模式
│   ├── 全局模块（@Global）
│   └── 动态模块（forRoot/forFeature）
└── 高级模式
    ├── 循环依赖（forwardRef）
    ├── 自定义Provider
    ├── 异步Provider
    └── 动态模块注册
```

---

## 完整代码：博客系统模块化架构

### 项目结构

```
blog-system/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── logger/
│   │   │   ├── logger.module.ts
│   │   │   └── logger.service.ts
│   │   └── database/
│   │       ├── database.module.ts
│   │       └── database.service.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   ├── posts/
│   │   ├── posts.module.ts
│   │   ├── posts.controller.ts
│   │   ├── posts.service.ts
│   │   └── dto/
│   └── config/
│       ├── config.module.ts
│       └── config.service.ts
```

### 代码实现

```typescript
// src/config/config.service.ts - Configuration service
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly config: Record<string, any>;

  constructor() {
    this.config = {
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'blog_db',
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret',
        expiresIn: process.env.JWT_EXPIRES || '24h',
      },
    };
  }

  get(path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }
}
```

```typescript
// src/config/config.module.ts - Global config module
import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Global() // Available everywhere without importing
@Module({
  providers: [ConfigService],
  exports: [ConfigService], // Export so other modules can use it
})
export class ConfigModule {}
```

```typescript
// src/common/database/database.service.ts - Simulated database
import { Injectable, OnModuleInit } from '@nestjs/common';

interface DatabaseRecord {
  id: number;
  [key: string]: any;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private tables: Map<string, DatabaseRecord[]> = new Map();
  private counters: Map<string, number> = new Map();

  onModuleInit() {
    console.log('📦 Database service initialized');
  }

  // Get or create a table
  private getTable(name: string): DatabaseRecord[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
      this.counters.set(name, 1);
    }
    return this.tables.get(name)!;
  }

  // Find all records in a table
  findAll(table: string): DatabaseRecord[] {
    return this.getTable(table);
  }

  // Find one record by ID
  findOne(table: string, id: number): DatabaseRecord | undefined {
    return this.getTable(table).find(r => r.id === id);
  }

  // Create a new record
  create(table: string, data: Omit<DatabaseRecord, 'id'>): DatabaseRecord {
    const id = this.counters.get(table)!;
    this.counters.set(table, id + 1);
    const record = { id, ...data };
    this.getTable(table).push(record);
    return record;
  }

  // Update a record
  update(table: string, id: number, data: Partial<DatabaseRecord>): DatabaseRecord | undefined {
    const record = this.findOne(table, id);
    if (!record) return undefined;
    Object.assign(record, data);
    return record;
  }

  // Delete a record
  delete(table: string, id: number): boolean {
    const tableData = this.getTable(table);
    const index = tableData.findIndex(r => r.id === id);
    if (index === -1) return false;
    tableData.splice(index, 1);
    return true;
  }

  // Find records by condition
  findWhere(table: string, predicate: (r: DatabaseRecord) => boolean): DatabaseRecord[] {
    return this.getTable(table).filter(predicate);
  }
}
```

```typescript
// src/common/database/database.module.ts
import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

```typescript
// src/common/logger/logger.service.ts - Custom logging service
import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  log(context: string, message: string) {
    console.log(`[${new Date().toISOString()}] [${context}] ${message}`);
  }

  error(context: string, message: string, trace?: string) {
    console.error(`[${new Date().toISOString()}] [${context}] ERROR: ${message}`);
    if (trace) console.error(trace);
  }

  warn(context: string, message: string) {
    console.warn(`[${new Date().toISOString()}] [${context}] WARN: ${message}`);
  }
}
```

```typescript
// src/common/logger/logger.module.ts
import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
```

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class UsersService {
  private readonly TABLE = 'users';

  constructor(
    private readonly db: DatabaseService,    // Injected from global module
    private readonly logger: LoggerService,   // Injected from global module
  ) {}

  create(data: { name: string; email: string }) {
    // Check for duplicate email
    const existing = this.db.findWhere(
      this.TABLE,
      u => u.email === data.email,
    );
    if (existing.length > 0) {
      throw new ConflictException('Email already exists');
    }

    const user = this.db.create(this.TABLE, data);
    this.logger.log('UsersService', `User created: ${user.id}`);
    return user;
  }

  findAll() {
    return this.db.findAll(this.TABLE);
  }

  findOne(id: number) {
    const user = this.db.findOne(this.TABLE, id);
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }
}
```

```typescript
// src/users/users.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: { name: string; email: string }) {
    return this.usersService.create(body);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
```

```typescript
// src/users/users.module.ts - Users feature module
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export so PostsModule can use it
})
export class UsersModule {}
```

```typescript
// src/posts/posts.service.ts - Posts depend on Users
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostsService {
  private readonly TABLE = 'posts';

  constructor(
    private readonly db: DatabaseService,
    private readonly usersService: UsersService, // Cross-module injection!
  ) {}

  create(data: { title: string; content: string; authorId: number }) {
    // Verify author exists
    this.usersService.findOne(data.authorId);

    const post = this.db.create(this.TABLE, {
      ...data,
      publishedAt: new Date(),
    });
    return post;
  }

  findAll() {
    return this.db.findAll(this.TABLE).map(post => ({
      ...post,
      author: this.usersService.findOne(post.authorId),
    }));
  }

  findOne(id: number) {
    const post = this.db.findOne(this.TABLE, id);
    if (!post) throw new NotFoundException(`Post #${id} not found`);
    return { ...post, author: this.usersService.findOne(post.authorId) };
  }
}
```

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() body: { title: string; content: string; authorId: number }) {
    return this.postsService.create(body);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }
}
```

```typescript
// src/posts/posts.module.ts - Imports UsersModule to access UsersService
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], // Import to get access to exported UsersService
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

```typescript
// src/app.module.ts - Root module wires everything together
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    ConfigModule,   // @Global but still need to import once in root
    DatabaseModule, // @Global
    LoggerModule,   // @Global
    UsersModule,    // Feature module
    PostsModule,    // Feature module (imports UsersModule internally)
  ],
})
export class AppModule {}
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3000);
  console.log('🚀 Blog system running on http://localhost:3000');
}
bootstrap();
```

---

## 执行预览

```bash
$ npm run start:dev
📦 Database service initialized
🚀 Blog system running on http://localhost:3000

# Create a user
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@blog.com"}'
{"id":1,"name":"Alice","email":"alice@blog.com"}

# Create a post (references user)
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","content":"Hello world!","authorId":1}'
{"id":1,"title":"My First Post","content":"Hello world!","authorId":1,"publishedAt":"2024-01-15T10:00:00.000Z"}

# Get posts with author info
$ curl http://localhost:3000/posts
[{
  "id":1,"title":"My First Post","content":"Hello world!","authorId":1,
  "author":{"id":1,"name":"Alice","email":"alice@blog.com"},
  "publishedAt":"2024-01-15T10:00:00.000Z"
}]

# Try creating post with non-existent author
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Ghost Post","content":"...","authorId":999}'
{"statusCode":404,"message":"User #999 not found"}
```

---

## 注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| Provider作用域 | 默认单例，整个应用共享 | 大部分场景用默认即可，REQUEST scope有性能开销 |
| 循环依赖 | A导入B，B导入A | 用 `forwardRef(() => Module)` 解决，但尽量避免 |
| 全局模块 | @Global只需注册一次 | 适合通用服务（Config、Logger），不适合业务模块 |
| exports粒度 | 只导出其他模块需要的服务 | 不要导出内部实现细节 |
| 动态模块 | forRoot/forFeature模式 | 配置类模块用 forRoot 一次，业务模块用 forFeature |
| 注入顺序 | 构造函数参数按类型注入 | TypeScript emitDecoratorMetadata 必须开启 |
| 可选依赖 | @Optional() 装饰器 | 没有对应provider时不报错，注入为null |

---

## 避坑指南

### ❌ 忘记 export Service

```typescript
// WRONG: Other modules import UsersModule but can't access UsersService
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  // Missing: exports: [UsersService]
})
export class UsersModule {}
```

### ✅ 正确 export 需要共享的服务

```typescript
// CORRECT: UsersService available to importing modules
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### ❌ 每个模块都 import 全局模块

```typescript
// WRONG: Redundant import of global module
@Global()
@Module({ providers: [ConfigService], exports: [ConfigService] })
export class ConfigModule {}

// This is unnecessary:
@Module({ imports: [ConfigModule] }) // Not needed for @Global modules
export class UsersModule {}
```

### ✅ 全局模块只在根模块注册一次

```typescript
// CORRECT: Register once in AppModule, use everywhere
@Module({
  imports: [ConfigModule, UsersModule], // ConfigModule registered once
})
export class AppModule {}

// Other modules just inject directly:
@Injectable()
export class UsersService {
  constructor(private config: ConfigService) {} // Works without import!
}
```

### ❌ 循环依赖未处理

```typescript
// WRONG: Circular dependency causes runtime error
@Module({ imports: [PostsModule], providers: [UsersService] })
export class UsersModule {}

@Module({ imports: [UsersModule], providers: [PostsService] })
export class PostsModule {}
// Error: Circular dependency detected
```

### ✅ 用 forwardRef 解决循环依赖

```typescript
// CORRECT: Use forwardRef to break the cycle
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [forwardRef(() => PostsModule)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

// In service, also use forwardRef:
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => PostsService))
    private postsService: PostsService,
  ) {}
}
```

---

## 练习题

### 🟢 基础题

1. **模块可见性**：UsersModule exports UsersService，PostsModule imports UsersModule。PostsModule 中的 PostsController 能直接注入 UsersService 吗？PostsModule 的子模块能吗？

<details><summary>参考答案</summary>PostsModule中可以注入（直接导入即获得导出的provider）。但PostsModule的子模块**不能**——exports只在直接导入的模块中可见，不传递给子模块。</details>

### 🟡 进阶题

2. **自定义Provider**：使用 `useFactory` 创建一个异步的 `CacheService`，它依赖 ConfigService 获取缓存配置。

<details><summary>参考答案</summary>

```typescript
@Module({
  providers: [
    {
      provide: 'CACHE_SERVICE',
      useFactory: async (configService: ConfigService) => {
        const ttl = configService.get('cache.ttl') || 300;
        const store = new Map(); // Simulated cache store
        return {
          get: (key: string) => store.get(key),
          set: (key: string, value: any) => store.set(key, { value, expires: Date.now() + ttl * 1000 }),
          delete: (key: string) => store.delete(key),
        };
      },
      inject: [ConfigService],
    },
  ],
  exports: ['CACHE_SERVICE'],
})
export class CacheModule {}
```

</details>

### 🔴 挑战题

3. **动态模块**：实现一个 `DatabaseModule.forRoot()` 模式，forRoot 接收配置参数，forFeature 注册特定表的 Repository。

<details><summary>参考答案</summary>

```typescript
// database.module.ts
import { Module, DynamicModule, Provider } from '@nestjs/common';

interface DatabaseModuleOptions {
  host: string;
  port: number;
  database: string;
}

// Simulated repository factory
class Repository<T> {
  constructor(private tableName: string) {}
  findAll() { return `Querying all from ${this.tableName}`; }
}

@Module({})
export class DatabaseModule {
  // forRoot: Register connection (once, in root module)
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const connectionProvider: Provider = {
      provide: 'DATABASE_CONNECTION',
      useFactory: () => {
        console.log(`Connecting to ${options.host}:${options.port}/${options.database}`);
        return { connected: true, config: options };
      },
    };
    return {
      module: DatabaseModule,
      providers: [connectionProvider],
      exports: [connectionProvider],
      global: true, // Available everywhere after forRoot
    };
  }

  // forFeature: Register repository for a specific table
  static forFeature(tableName: string): DynamicModule {
    const repositoryProvider: Provider = {
      provide: `${tableName.toUpperCase()}_REPOSITORY`,
      useFactory: () => new Repository(tableName),
    };
    return {
      module: DatabaseModule,
      providers: [repositoryProvider],
      exports: [repositoryProvider],
    };
  }
}

// Usage in app.module.ts:
// imports: [DatabaseModule.forRoot({ host: 'localhost', port: 5432, database: 'blog' })]
// Usage in feature module:
// imports: [DatabaseModule.forFeature('users')]
```

</details>

---

## 知识点总结

```
NestJS模块与DI
├── 模块（@Module）
│   ├── providers → 注册服务到DI容器
│   ├── controllers → 注册路由控制器
│   ├── imports → 引入其他模块的exports
│   ├── exports → 暴露providers给外部
│   └── @Global → 全局可用（无需重复import）
├── 依赖注入
│   ├── 构造函数注入（推荐）
│   │   └── constructor(private svc: Service) {}
│   ├── @Inject() 属性/参数注入
│   │   └── @Inject('TOKEN') private config
│   └── Provider类型
│       ├── useClass → 类（默认）
│       ├── useValue → 常量/模拟对象
│       ├── useFactory → 动态/异步创建
│       └── useExisting → 别名映射
├── 作用域
│   ├── DEFAULT → 单例（推荐）
│   ├── REQUEST → 每请求一个实例
│   └── TRANSIENT → 每次注入新实例
├── 高级模式
│   ├── 动态模块 → forRoot() / forFeature()
│   ├── 循环依赖 → forwardRef()
│   ├── 异步Provider → useFactory + async
│   └── 可选依赖 → @Optional()
└── 最佳实践
    ├── 模块按业务领域划分
    ├── 只export必要的provider
    ├── 避免循环依赖（重构优先）
    └── 全局模块只用于基础设施
```

---

## 举一反三

| 场景 | 实现方案 | 关键技术 |
|------|---------|---------|
| 多数据库连接 | useFactory创建多个连接 | @Inject('DB_PRIMARY'), @Inject('DB_REPLICA') |
| 插件系统 | 动态模块 + forRoot | registerAsync, DynamicModule |
| 测试Mock | useValue覆盖provider | { provide: Service, useValue: mockObj } |
| 条件注册 | useFactory + 环境判断 | process.env判断返回不同实现 |
| 事件总线 | EventEmitter2模块 | @nestjs/event-emitter, @OnEvent() |
| 多租户 | REQUEST scope + TenantService | @Inject(REQUEST), request.headers |
| 配置切换 | useExisting别名 | 开发/生产环境切换实现 |
| 懒加载模块 | LazyModuleLoader | 按需加载大型模块 |
| 中间件DI | 自定义Injector | ModuleRef.get() / ModuleRef.create() |
| 健康检查 | @nestjs/terminus | HealthCheckService, HealthIndicator |

---

## 参考资料

- [NestJS Modules 官方文档](https://docs.nestjs.com/modules)
- [NestJS Dependency Injection](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- [NestJS Circular Dependency](https://docs.nestjs.com/fundamentals/circular-dependency)
- [InversifyJS](https://github.com/inversify/InversifyJS)（NestJS DI底层灵感来源）

---

## 代码演进

### v1: 单模块单文件

```typescript
// Everything in one module
@Module({
  controllers: [UsersController, PostsController],
  providers: [UsersService, PostsService],
})
export class AppModule {}
```

问题：所有代码耦合在一起，难以维护。

### v2: 按功能拆分模块

```typescript
// Separate feature modules
@Module({
  imports: [UsersModule, PostsModule],
})
export class AppModule {}

// UsersModule has its own controller + service
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Share with PostsModule
})
export class UsersModule {}

// PostsModule imports UsersModule for cross-module DI
@Module({
  imports: [UsersModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

### v3: 企业级模块化架构（本文最终版）

在 v2 基础上增加：
- ✅ 全局基础设施模块（Config、Database、Logger）
- ✅ 自定义 Provider（useFactory、useValue）
- ✅ 模块间依赖关系清晰（exports/imports）
- ✅ 跨模块服务注入（PostsService → UsersService）
- ✅ 统一的数据库服务抽象
- ✅ 生命周期钩子（OnModuleInit）
- ✅ 完整的模块目录结构

从"大杂烩"到"清晰的分层架构"，这就是NestJS模块化的演进路径。
