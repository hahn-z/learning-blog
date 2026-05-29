---
title: "004 - NestJS RESTful API 实战：从零构建企业级接口"
slug: "004-nestjs-rest"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.691+08:00"
updated_at: "2026-04-29T10:02:48.043+08:00"
reading_time: 36
tags: []
---

## 🎯 难度标注

**难度等级：⭐⭐⭐ 中级**

> 前置要求：熟悉 TypeScript 基础、了解 REST API 概念、有 Node.js 开发经验。本文不讲解 TypeScript 语法基础。

---

## 📖 概念讲解

### 什么是 NestJS？

NestJS 是一个用于构建高效、可扩展的 Node.js 服务端应用的框架。它使用 TypeScript 编写，结合了面向对象编程（OOP）、函数式编程（FP）和函数响应式编程（FRP）的元素。

### 核心设计理念

NestJS 的架构深受 Angular 启发，核心概念包括：

| 概念 | 说明 | 类比 |
|------|------|------|
| **Module** | 组织应用结构的容器 | Angular Module |
| **Controller** | 处理 HTTP 请求的路由层 | Express Router |
| **Provider/Service** | 封装业务逻辑 | Service Layer |
| **Middleware** | 请求处理管道中的中间件 | Express Middleware |
| **Guard** | 权限验证守卫 | Express Auth Middleware |
| **Interceptor** | 拦截请求/响应做额外处理 | Express 中间件的增强版 |
| **Pipe** | 数据转换与验证 | Express Validator |
| **Filter** | 统一异常处理 | Express Error Handler |

### 为什么选 NestJS 而不是 Express？

```
Express:  自由度高 → 但大型项目结构混乱
NestJS:   约定优于配置 → 结构清晰，团队协作友好
```

---

## 🧠 知识脑图

```
NestJS RESTful API
├── 核心概念
│   ├── Module (模块化组织)
│   ├── Controller (路由处理)
│   ├── Service (业务逻辑)
│   └── DTO (数据传输对象)
├── 请求生命周期
│   ├── Middleware → Guard → Interceptor → Pipe
│   └── Controller → Service → Response
├── 数据验证
│   ├── class-validator 装饰器
│   └── ValidationPipe 全局管道
├── 异常处理
│   ├── 内置异常 (NotFoundException等)
│   └── 自定义异常过滤器
└── API 规范
    ├── RESTful 路由设计
    ├── 统一响应格式
    └── 分页与过滤
```

---

## 💻 完整代码实现

### 项目初始化

```bash
# Create new NestJS project
nest new blog-api
cd blog-api

# Install dependencies
npm install class-validator class-transformer
npm install @nestjs/mapped-types
```

### v1：基础 CRUD

```typescript
// src/posts/dto/create-post.dto.ts
import { IsString, IsOptional, IsInt, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsString()
  category?: string;
}

// src/posts/dto/update-post.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

```typescript
// src/posts/posts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';

export interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PostsService {
  // In-memory store (will be replaced with DB in v2)
  private posts: Post[] = [];
  private idCounter = 0;

  create(dto: { title: string; content: string; category?: string }): Post {
    const post: Post = {
      id: ++this.idCounter,
      title: dto.title,
      content: dto.content,
      category: dto.category || 'uncategorized',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.posts.push(post);
    return post;
  }

  findAll(page = 1, limit = 10): { data: Post[]; total: number } {
    const start = (page - 1) * limit;
    return {
      data: this.posts.slice(start, start + limit),
      total: this.posts.length,
    };
  }

  findOne(id: number): Post {
    const post = this.posts.find((p) => p.id === id);
    if (!post) throw new NotFoundException(`Post #${id} not found`);
    return post;
  }

  update(id: number, dto: Partial<Post>): Post {
    const post = this.findOne(id);
    Object.assign(post, { ...dto, updatedAt: new Date() });
    return post;
  }

  remove(id: number): void {
    this.findOne(id); // Ensure exists
    this.posts = this.posts.filter((p) => p.id !== id);
  }
}
```

```typescript
// src/posts/posts.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.findAll(
      parseInt(page || '1', 10),
      parseInt(limit || '10', 10),
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.postsService.remove(id);
    return { message: 'Deleted successfully' };
  }
}
```

```typescript
// src/posts/posts.module.ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown props
      transform: true,            // Auto-transform types
    }),
  );

  // Enable CORS
  app.enableCors();

  await app.listen(3000);
  console.log('Application running on http://localhost:3000');
}
bootstrap();
```

### v2：统一响应格式 + 异常过滤器

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable, NestInterceptor, ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

// Standard API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    this.logger.error(
      `${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

```typescript
// Updated src/main.ts for v2
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Apply global interceptor and filter
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors();
  await app.listen(3000);
  logger.log('Application running on http://localhost:3000');
}
bootstrap();
```

### v3：分页 DTO + Swagger 文档

```typescript
// src/common/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

// src/common/dto/paginated-result.dto.ts
export class PaginatedResultDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
```

```bash
# Install Swagger for v3
npm install @nestjs/swagger
```

```typescript
// src/main.ts additions for Swagger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Blog API')
  .setDescription('A RESTful blog API built with NestJS')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

## 🔍 执行预览

```bash
# Start the server
$ npm run start:dev

# Create a post
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello NestJS","content":"My first NestJS post!"}'

# Response (v2 format):
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Hello NestJS",
    "content": "My first NestJS post!",
    "category": "uncategorized",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}

# Get all posts with pagination
$ curl "http://localhost:3000/posts?page=1&limit=5"

# Validation error (missing required field)
$ curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":""}'

# Response:
{
  "success": false,
  "statusCode": 400,
  "message": [
    "title must be longer than or equal to 1 characters",
    "content must be longer than or equal to 10 characters",
    "content should not be empty"
  ],
  "timestamp": "2024-01-15T10:31:00.000Z"
}

# Delete a post
$ curl -X DELETE http://localhost:3000/posts/1
{
  "success": true,
  "data": { "message": "Deleted successfully" },
  "timestamp": "2024-01-15T10:32:00.000Z"
}
```

---

## ⚠️ 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| ValidationPipe | 必须全局注册，否则 DTO 验证不生效 | 在 `main.ts` 中配置 |
| ParseIntPipe | 路由参数默认是 string 类型 | 使用 `ParseIntPipe` 自动转换 |
| whitelist: true | 过滤 DTO 中未定义的属性 | 防止批量赋值攻击 |
| 模块划分 | 每个 Feature 一个 Module | 保持模块职责单一 |
| 异步操作 | Service 方法建议返回 Promise | 为后续接入数据库预留 |
| 路由顺序 | `@Get('search')` 必须在 `@Get(':id')` 之前 | 否则 "search" 会被当作 id |
| CORS | 生产环境应限制来源域名 | 不要用 `app.enableCors()` 无参调用 |

---

## 🚫 避坑指南

### ❌ 在 Controller 里写业务逻辑
```typescript
// BAD: Business logic in controller
@Post()
create(@Body() dto: CreatePostDto) {
  if (!dto.title) throw new BadRequestException('Title required');
  const post = { id: Date.now(), ...dto };
  this.posts.push(post); // Direct data access
  return post;
}
```

### ✅ Controller 只做路由分发，Service 处理业务
```typescript
// GOOD: Controller delegates to service
@Post()
create(@Body() dto: CreatePostDto) {
  return this.postsService.create(dto);
}
```

### ❌ 不使用 DTO 验证
```typescript
// BAD: Accept any body
@Post()
create(@Body() body: any) {  // No validation!
  return this.postsService.create(body);
}
```

### ✅ 使用 class-validator DTO
```typescript
// GOOD: Validate with DTO
@Post()
create(@Body() dto: CreatePostDto) {
  return this.postsService.create(dto);
}
```

### ❌ 忽略错误处理
```typescript
// BAD: Let errors bubble up without context
@Get(':id')
findOne(@Param('id') id: string) {
  return this.posts[parseInt(id)]; // undefined if not found
}
```

### ✅ 明确抛出业务异常
```typescript
// GOOD: Throw descriptive exceptions
findOne(id: number): Post {
  const post = this.posts.find(p => p.id === id);
  if (!post) throw new NotFoundException(`Post #${id} not found`);
  return post;
}
```

---

## 🏋️ 练习题

### 🟢 基础题

1. **创建一个 Cats 模块**：实现 Cat 实体的 CRUD，包含 `name`、`age`、`breed` 字段，使用 DTO 验证。

2. **添加查询过滤**：在 `GET /posts` 接口添加 `category` 查询参数，按分类过滤结果。

### 🟡 进阶题

3. **自定义异常**：创建 `PostAlreadyExistsException`，当创建重复标题的文章时抛出，并配置专门的异常过滤器。

4. **请求日志拦截器**：实现一个 `LoggingInterceptor`，记录每个请求的方法、URL、响应时间和状态码。

### 🔴 挑战题

5. **版本控制 API**：使用 NestJS 的版本控制功能，实现 `v1` 和 `v2` 两个版本的 Posts API，v2 新增 `tags` 字段和全文搜索功能。

---

## 📝 知识点总结

```
NestJS RESTful API
├── 请求处理
│   ├── @Controller() - 路由前缀
│   ├── @Get/@Post/@Put/@Delete - HTTP 方法
│   ├── @Body/@Param/@Query - 参数提取
│   └── ParseIntPipe - 自动类型转换
├── 数据验证
│   ├── class-validator - 装饰器验证
│   ├── class-transformer - 类型转换
│   └── ValidationPipe - 全局管道
├── 响应处理
│   ├── TransformInterceptor - 统一响应格式
│   ├── AllExceptionsFilter - 统一异常格式
│   └── NotFoundException - 业务异常
├── 架构分层
│   ├── Module - 模块化组织
│   ├── Controller - 路由层
│   ├── Service - 业务层
│   └── DTO - 数据传输层
└── API 设计
    ├── RESTful 规范
    ├── 分页查询
    └── Swagger 文档
```

---

## 🔄 举一反三

| 场景 | NestJS 方案 | 对应 Express 方案 |
|------|-------------|-------------------|
| 数据验证 | class-validator + ValidationPipe | joi / express-validator |
| 统一响应 | TransformInterceptor | 自定义中间件 |
| 异常处理 | @Catch() ExceptionFilter | express-error-handler |
| 权限控制 | Guard (@Injectable) | 中间件鉴权 |
| 请求日志 | LoggingInterceptor | morgan |
| API 文档 | @nestjs/swagger | swagger-jsdoc |
| 分页查询 | PaginationDto + Service | 手动解析 query 参数 |
| 速率限制 | @nestjs/throttler | express-rate-limit |

---

## 📚 参考资料

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
- [NestJS Providers](https://docs.nestjs.com/providers)
- [class-validator GitHub](https://github.com/typestack/class-validator)
- [NestJS Swagger 插件](https://docs.nestjs.com/openapi/introduction)

---

## 🛤️ 代码演进路线

### v1 → 基础 CRUD（本文已覆盖）
- 内存数据存储
- 基本 CRUD 端点
- DTO 验证
- ParseIntPipe

### v2 → 生产就绪（本文已覆盖）
- 统一响应格式（TransformInterceptor）
- 全局异常过滤器（AllExceptionsFilter）
- 日志记录
- CORS 配置

### v3 → 企业级（后续文章展开）
- TypeORM 数据库集成（→ 下一篇：NestJS TypeORM）
- JWT 认证（→ 下下篇：NestJS 认证JWT）
- Swagger API 文档
- 速率限制
- 缓存拦截器
- 单元测试 & E2E 测试

> **下一站**：[NestJS TypeORM → 数据持久化实战](/posts/025-nestjs-typeorm)
