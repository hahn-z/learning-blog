---
title: "002 - NestJS入门：用TypeScript构建企业级Node.js应用"
slug: "002-nestjs-intro"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.68+08:00"
updated_at: "2026-04-29T10:02:48.022+08:00"
reading_time: 39
tags: []
---

## 难度标注

> **难度：** 🟡 中等 | **前置知识：** TypeScript基础、Node.js、面向对象编程 | **预计耗时：** 3-4小时

---

## 概念讲解

### 什么是NestJS？

NestJS是一个用于构建高效、可扩展的Node.js服务器端应用的框架。它使用**TypeScript**编写，结合了面向对象编程（OOP）、函数式编程（FP）和函数响应式编程（FRP）的元素。

### 核心设计理念

NestJS的灵感来自Angular，采用**装饰器（Decorator）+ 依赖注入（DI）+ 模块化**的架构：

```
NestJS架构 = Angular的设计模式 + Express/Fastify的底层
```

### 与其他框架对比

| 特性 | Express | Koa | NestJS |
|------|---------|-----|--------|
| 语言 | JavaScript | JavaScript | TypeScript（首选） |
| 架构 | 无固定架构 | 无固定架构 | 分层模块化架构 |
| DI | 无 | 无 | 内置依赖注入 |
| 装饰器 | 无 | 无 | 大量使用 |
| 测试 | 需自行配置 | 需自行配置 | 内置Jest + e2e |
| 学习曲线 | 低 | 低 | 中高 |
| 适用场景 | 小型项目 | 中型项目 | 企业级应用 |

### 核心概念速览

1. **Controller（控制器）**：处理HTTP请求，定义路由
2. **Service（服务）**：封装业务逻辑，可被注入到控制器
3. **Module（模块）**：组织相关功能，声明依赖关系
4. **Decorator（装饰器）**：附加元数据，简化代码
5. **Pipe（管道）**：数据验证和转换
6. **Guard（守卫）**：权限验证
7. **Interceptor（拦截器）**：请求/响应变换

---

## 脑图

```
NestJS入门
├── 项目初始化
│   ├── @nestjs/cli 安装
│   ├── nest new project
│   └── 项目结构解析
├── 核心概念
│   ├── Controller → 处理请求
│   ├── Service → 业务逻辑
│   ├── Module → 组织模块
│   └── DI → 依赖注入容器
├── 装饰器体系
│   ├── @Controller() / @Get() / @Post()
│   ├── @Body() / @Param() / @Query()
│   ├── @Injectable()
│   └── @Module()
├── 请求生命周期
│   ├── Middleware → Guard → Interceptor
│   ├── Pipe → Controller → Service
│   └── Interceptor → Response
├── 数据验证
│   ├── class-validator
│   ├── class-transformer
│   └── ValidationPipe
└── 实战项目
    ├── 用户CRUD API
    ├── DTO数据验证
    └── 异常过滤器
```

---

## 完整代码：NestJS 用户管理 API

### 项目结构

```
nestjs-demo/
├── src/
│   ├── main.ts                 # Bootstrap
│   ├── app.module.ts           # Root module
│   ├── users/
│   │   ├── users.module.ts     # Users module
│   │   ├── users.controller.ts # Users controller
│   │   ├── users.service.ts    # Users service
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   └── common/
│       └── filters/
│           └── http-exception.filter.ts
├── test/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### 代码实现

```typescript
// src/main.ts - Application bootstrap
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown props
      transform: true,            // Auto-transform types
    }),
  );

  // Enable CORS
  app.enableCors();

  await app.listen(3000);
  console.log('🚀 NestJS server running on http://localhost:3000');
}
bootstrap();
```

```typescript
// src/app.module.ts - Root module
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';

@Module({
  imports: [UsersModule],
})
export class AppModule {}
```

```typescript
// src/users/entities/user.entity.ts
export class User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
    this.createdAt = new Date();
  }
}
```

```typescript
// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
```

```typescript
// src/users/dto/update-user.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
```

```typescript
// src/users/users.service.ts - Business logic layer
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 1;

  // Create a new user
  create(createUserDto: CreateUserDto): User {
    const user = new User({
      id: this.idCounter++,
      name: createUserDto.name,
      email: createUserDto.email,
    });
    this.users.push(user);
    return user;
  }

  // Find all users
  findAll(): User[] {
    return this.users;
  }

  // Find one user by ID
  findOne(id: number): User {
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  // Update a user
  update(id: number, updateUserDto: UpdateUserDto): User {
    const user = this.findOne(id);
    Object.assign(user, updateUserDto);
    return user;
  }

  // Delete a user
  remove(id: number): void {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new NotFoundException(`User #${id} not found`);
    }
    this.users.splice(index, 1);
  }
}
```

```typescript
// src/users/users.controller.ts - Request handler
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto): User {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(): User[] {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): User {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): User {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.remove(id);
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
})
export class UsersModule {}
```

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      success: false,
      statusCode: status,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### package.json 核心依赖

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.14",
    "rxjs": "^7.8.0"
  }
}
```

---

## 执行预览

```bash
# 安装CLI并创建项目
$ npm i -g @nestjs/cli
$ nest new nestjs-demo
$ cd nestjs-demo

# 启动开发模式
$ npm run start:dev
[Nest] Log [NestFactory] Starting Nest application...
[Nest] Log [InstanceLoader] AppModule dependencies initialized
[Nest] Log [RoutesResolver] UsersController {/users}
[Nest] Log [RouterExplorer] Mapped {/users, POST} route
[Nest] Log [RouterExplorer] Mapped {/users, GET} route
[Nest] Log [RouterExplorer] Mapped {/users/:id, GET} route
[Nest] Log [RouterExplorer] Mapped {/users/:id, PUT} route
[Nest] Log [RouterExplorer] Mapped {/users/:id, DELETE} route
🚀 NestJS server running on http://localhost:3000

# 创建用户
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"123456"}'
{"id":1,"name":"Alice","email":"alice@test.com","createdAt":"2024-01-15T10:00:00.000Z"}

# 验证失败（缺少必填字段）
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob"}'
{
  "success": false,
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than 5 characters"]
}

# 获取所有用户
$ curl http://localhost:3000/users
[{"id":1,"name":"Alice","email":"alice@test.com","createdAt":"2024-01-15T10:00:00.000Z"}]
```

---

## 注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 装饰器顺序 | 装饰器执行从下到上 | Method装饰器写在最上面，Param装饰器在参数上 |
| DTO验证 | 必须启用ValidationPipe | 在main.ts中全局注册，否则class-validator不生效 |
| 依赖注入 | 通过构造函数注入 | 使用 `private readonly` + TypeScript类型 |
| 模块导入 | Service默认在模块内可用 | 跨模块使用需要exports + imports |
| 异步provider | 支持factory provider | 数据库连接等异步初始化用useFactory |
| 热重载 | start:dev 支持HMR | 开发时用 start:dev，生产用 start:prod |
| CLI生成 | nest g resource name | 快速生成完整CRUD模块 |

---

## 避坑指南

### ❌ 忘记注册 Service 到 Module

```typescript
// WRONG: UsersController can't resolve UsersService
@Module({
  controllers: [UsersController],
  // Missing providers: [UsersService]
})
export class UsersModule {}
// Error: Nest can't resolve dependencies of UsersController
```

### ✅ 正确注册 providers

```typescript
// CORRECT: Register service as provider
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

### ❌ 忘记启用 ValidationPipe

```typescript
// WRONG: DTO decorators are ignored, any data passes through
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // No ValidationPipe registered!
  await app.listen(3000);
}
```

### ✅ 全局注册 ValidationPipe

```typescript
// CORRECT: Global validation active for all routes
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000);
}
```

### ❌ 直接在 Controller 写业务逻辑

```typescript
// WRONG: Controller doing business logic
@Post()
create(@Body() dto: CreateUserDto) {
  // Validation, database calls, email sending... all here
  if (!dto.email.includes('@')) throw new Error('bad email');
  const user = { id: ++this.counter, ...dto };
  this.users.push(user);
  return user;
}
```

### ✅ Controller 只做路由，Service 处理业务

```typescript
// CORRECT: Thin controller, fat service
@Post()
create(@Body() dto: CreateUserDto): User {
  return this.usersService.create(dto); // Delegate to service
}
```

---

## 练习题

### 🟢 基础题

1. **CLI命令**：用NestJS CLI创建一个名为 `products` 的完整CRUD模块，命令是什么？

<details><summary>参考答案</summary>`nest g resource products`（自动生成 controller、service、module、dto、entities）</details>

2. **装饰器匹配**：以下请求对应哪个方法？`GET /users/42`

```typescript
@Get() findAll() {}
@Get(':id') findOne(@Param('id') id: string) {}
@Get('profile') getProfile() {}
```

<details><summary>参考答案</summary>`findOne`，因为 `:id` 是动态参数，匹配 `42`。注意 `profile` 是固定路径，优先级高于动态参数。</details>

### 🟡 进阶题

3. **自定义Pipe**：实现一个 `ParseEmailPipe`，验证参数是否为合法email格式。

<details><summary>参考答案</summary>

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseEmailPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new BadRequestException('Invalid email format');
    }
    return value;
  }
}

// Usage: @Param('email', ParseEmailPipe) email: string
```

</details>

### 🔴 挑战题

4. **实现全局响应拦截器**：创建一个拦截器，将所有成功响应包装为 `{ success: true, data: <original> }` 格式。

<details><summary>参考答案</summary>

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface Response<T> { success: boolean; data: T; }

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(map(data => ({ success: true, data })));
  }
}

// Register globally in main.ts:
// app.useGlobalInterceptors(new TransformInterceptor());
```

</details>

---

## 知识点总结

```
NestJS框架
├── 装饰器（Decorators）
│   ├── 类装饰器: @Controller(), @Module(), @Injectable()
│   ├── 方法装饰器: @Get(), @Post(), @Put(), @Delete()
│   └── 参数装饰器: @Body(), @Param(), @Query(), @Headers()
├── 核心组件
│   ├── Controller → 接收请求，返回响应
│   ├── Service → 封装业务逻辑
│   ├── Module → 组织组件，声明依赖
│   └── DTO → 定义数据结构和验证规则
├── 请求处理管道
│   ├── Middleware → 请求预处理
│   ├── Guard → 权限验证
│   ├── Interceptor → 请求/响应变换
│   └── Pipe → 数据验证和转换
└── 生命周期
    ├── onModuleInit → 模块初始化
    ├── onApplicationBootstrap → 应用启动完成
    └── onModuleDestroy → 模块销毁
```

---

## 举一反三

| 场景 | NestJS方案 | 关键技术 |
|------|-----------|---------|
| 数据库操作 | TypeORM / Prisma | @InjectRepository, PrismaService |
| JWT认证 | Passport + JWT Strategy | @UseGuards(AuthGuard('jwt')) |
| 文件上传 | Multer中间件 | @UseInterceptors(FileInterceptor) |
| WebSocket | @WebSocketGateway | socket.io, @SubscribeMessage |
| 微服务 | @MessagePattern | TCP/Redis/RabbitMQ transport |
| 任务调度 | @nestjs/schedule | @Cron(), @Interval() |
| 缓存 | @nestjs/cache-manager | @CacheKey(), TTL配置 |
| 日志 | 自定义Logger | @InjectLogger, winston |
| 配置管理 | @nestjs/config | ConfigService, .env文件 |
| API文档 | @nestjs/swagger | @ApiTags, @ApiOperation |

---

## 参考资料

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS CLI 文档](https://docs.nestjs.com/cli/overview)
- [class-validator 装饰器列表](https://github.com/typestack/class-validator)
- [NestJS GitHub 仓库](https://github.com/nestjs/nest)

---

## 代码演进

### v1: 最小NestJS应用

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';

@Controller()
class AppController {
  @Get()
  hello() { return { message: 'Hello NestJS!' }; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### v2: 分离Controller和Service

```typescript
// Separation of concerns
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  
  @Get() findAll() { return this.usersService.findAll(); }
  @Post() create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }
}

@Injectable()
export class UsersService {
  private users = [];
  findAll() { return this.users; }
  create(dto) { const user = { id: Date.now(), ...dto }; this.users.push(user); return user; }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
```

### v3: 企业级完整项目（本文最终版）

在 v2 基础上增加：
- ✅ DTO数据验证（class-validator + ValidationPipe）
- ✅ 统一异常过滤器
- ✅ 类型安全的Param解析（ParseIntPipe）
- ✅ 规范的HTTP状态码（@HttpCode）
- ✅ Entity实体类
- ✅ 完整的项目目录结构
- ✅ CORS支持

从单文件到分层架构，这就是NestJS项目演进的标准路径。
