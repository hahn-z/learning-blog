---
title: "006 - NestJS 认证 JWT 实战：从注册登录到权限守卫"
slug: "006-nestjs-auth"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.7+08:00"
updated_at: "2026-04-29T10:02:48.062+08:00"
reading_time: 44
tags: []
---

## 🎯 难度标注

**难度等级：⭐⭐⭐⭐ 中高级**

> 前置要求：已完成 NestJS RESTful API 和 TypeORM 篇、了解 HTTP 认证基本概念、了解 JWT 原理。本文涉及安全敏感内容，请务必在生产环境使用经过审计的配置。

---

## 📖 概念讲解

### 什么是 JWT？

JSON Web Token (JWT) 是一种开放标准 (RFC 7519)，用于在各方之间安全地传输信息。JWT 由三部分组成：

```
Header.Payload.Signature
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.xxxxx

Header:    { "alg": "HS256", "typ": "JWT" }
Payload:   { "userId": 1, "username": "admin", "role": "editor" }
Signature: HMACSHA256(base64(header) + "." + base64(payload), secret)
```

### 认证 vs 授权

| 概念 | 英文 | 回答的问题 | 实现方式 |
|------|------|-----------|---------|
| **认证** | Authentication | 你是谁？ | JWT Token / Session |
| **授权** | Authorization | 你能做什么？ | Role / Permission Guard |

### NestJS 认证架构

```
请求流程：
Client → [Login] → AuthController → AuthService → JWT Token
Client → [API Request + Token] → JwtAuthGuard → Controller → Service
Client → [Admin API + Token] → RolesGuard → JwtAuthGuard → Controller
```

---

## 🧠 知识脑图

```
NestJS JWT 认证
├── 用户管理
│   ├── User Entity
│   ├── 注册 (Register)
│   ├── 密码加密 (bcrypt)
│   └── 用户信息序列化
├── JWT 签发
│   ├── @nestjs/jwt
│   ├── sign() 签发 Token
│   ├── Payload 设计
│   └── Token 过期策略
├── JWT 验证
│   ├── JwtModule 配置
│   ├── @AuthGuard('jwt')
│   └── JwtStrategy (Passport)
├── 守卫系统
│   ├── Guard 生命周期
│   ├── JwtAuthGuard
│   └── RolesGuard (角色)
├── 装饰器
│   ├── @Public() 公开路由
│   ├── @Roles() 角色要求
│   └── @CurrentUser() 当前用户
└── 安全实践
    ├── 密码哈希 (bcrypt)
    ├── Token 刷新
    ├── 速率限制
    └── HTTP-only Cookie
```

---

## 💻 完整代码实现

### 安装依赖

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt class-validator
npm install @types/passport-jwt @types/bcrypt -D
```

### v1：注册登录 + JWT 签发

```typescript
// src/auth/entities/user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  BeforeInsert, BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ select: false }) // Exclude password from default queries
  password: string;

  @Column({ default: 'user' })
  role: string; // 'user' | 'editor' | 'admin'

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Hash password before insert/update
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  // Validate plain password against hash
  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }
}
```

```typescript
// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

// src/auth/dto/login.dto.ts
export class LoginDto {
  @IsString()
  emailOrUsername: string;

  @IsString()
  password: string;
}
```

```typescript
// src/auth/auth.service.ts
import {
  Injectable, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: Partial<User>; token: string }> {
    // Check for existing user
    const exists = await this.userRepo.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (exists) {
      throw new ConflictException('Email or username already exists');
    }

    const user = this.userRepo.create(dto);
    await this.userRepo.save(user);

    const token = this.generateToken(user);
    // Return user without password
    const { password, ...result } = user;
    return { user: result, token };
  }

  async login(dto: LoginDto): Promise<{ user: Partial<User>; token: string }> {
    // Find user with password (select: false requires explicit selection)
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email OR user.username = :username', {
        email: dto.emailOrUsername,
        username: dto.emailOrUsername,
      })
      .addSelect('user.password') // Include password for validation
      .getOne();

    if (!user || !(await user.validatePassword(dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const token = this.generateToken(user);
    const { password, ...result } = user;
    return { user: result, token };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  // Validate user by JWT payload (used by JwtStrategy)
  async validateUser(id: number): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || !user.isActive) return null;
    const { password, ...result } = user;
    return result;
  }
}
```

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

### v2：JWT Strategy + Guards + 装饰器

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  // Called automatically after token verification
  async validate(payload: { sub: number; email: string; role: string }) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user; // Attaches to req.user
  }
}
```

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// src/auth/guards/roles.guard.ts
import {
  Injectable, CanActivate, ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    // No roles required = public access
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

```typescript
// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    // If data is provided, return specific field
    return data ? user?.[data] : user;
  },
);
```

### v3：全局守卫 + 完整使用示例

```typescript
// src/auth/guards/jwt-auth.guard.ts (updated with public route support)
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Skip auth for public routes
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) return true;

    return super.canActivate(context);
  }
}
```

```typescript
// src/app.module.ts (register guards globally)
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  // ...
  providers: [
    // Global guards - applied to ALL routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

```typescript
// src/posts/posts.controller.ts (using auth decorators)
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // Public - no auth needed
  @Public()
  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  // Public - no auth needed
  @Public()
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.postsService.findOne(id);
  }

  // Any authenticated user
  @Post()
  create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: any,
  ) {
    return this.postsService.create(dto, user.id);
  }

  // Only editors and admins
  @Roles('editor', 'admin')
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: CreatePostDto) {
    return this.postsService.update(id, dto);
  }

  // Only admins
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.postsService.remove(id);
  }
}
```

---

## 🔍 执行预览

```bash
# Register a new user
$ curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blog.com","username":"admin","password":"secret123"}'

# Response:
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@blog.com",
      "username": "admin",
      "role": "user",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

# Login
$ curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"admin","password":"secret123"}'

# Access protected route (no token)
$ curl http://localhost:3000/posts
# Response: 401 Unauthorized

# Access protected route (with token)
$ curl http://localhost:3000/posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."

# Response: 200 OK with posts data

# Access admin-only route (with regular user)
$ curl -X DELETE http://localhost:3000/posts/1 \
  -H "Authorization: Bearer <user-token>"
# Response: 403 Forbidden

# Access admin-only route (with admin token)
$ curl -X DELETE http://localhost:3000/posts/1 \
  -H "Authorization: Bearer <admin-token>"
# Response: 200 OK
```

---

## ⚠️ 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| JWT Secret | 签名密钥 | 使用强随机字符串，存环境变量 |
| Token 过期 | 过期时间设置 | 建议 24h，敏感操作可缩短 |
| 密码哈希 | bcrypt salt rounds | 建议 10-12，太大会影响性能 |
| select: false | 密码字段不默认返回 | 查询时需 `addSelect` 才能获取 |
| 全局守卫顺序 | APP_GUARD 注册顺序 | 先 JwtAuthGuard，后 RolesGuard |
| CORS | 跨域配置 | 生产环境限制 Origin |
| HTTPS | 传输安全 | 生产必须 HTTPS，否则 Token 可被截获 |
| Token 存储 | 客户端存储位置 | 推荐 HttpOnly Cookie > localStorage |

---

## 🚫 避坑指南

### ❌ 明文存储密码
```typescript
// BAD: Never store plain text passwords!
@Column()
password: string; // Stored as "mypassword123" in DB
```

### ✅ 使用 bcrypt 哈希
```typescript
// GOOD: Hash with bcrypt
@BeforeInsert()
async hashPassword() {
  this.password = await bcrypt.hash(this.password, 10);
}
```

### ❌ 在 JWT Payload 存敏感信息
```typescript
// BAD: Token can be decoded by anyone (not encrypted)
const payload = { sub: user.id, password: user.password };
```

### ✅ 只存必要的非敏感数据
```typescript
// GOOD: Minimal, non-sensitive payload
const payload = { sub: user.id, email: user.email, role: user.role };
```

### ❌ 不处理 Token 过期
```typescript
// BAD: No expiry means token is valid forever
this.jwtService.sign(payload, { /* no expiresIn */ });
```

### ✅ 设置合理过期时间
```typescript
// GOOD: Set expiration
this.jwtService.sign(payload, { expiresIn: '24h' });
```

### ❌ 前端用 localStorage 存 Token
```typescript
// BAD: Vulnerable to XSS attacks
localStorage.setItem('token', token);
```

### ✅ 使用 HttpOnly Cookie
```typescript
// GOOD: Set as HttpOnly cookie
@Post('login')
async login(@Body() dto: LoginDto, @Res() res: Response) {
  const { token } = await this.authService.login(dto);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  });
  return res.json({ success: true });
}
```

---

## 🏋️ 练习题

### 🟢 基础题

1. **添加修改密码接口**：实现 `PUT /auth/change-password`，需要验证旧密码，哈希新密码后更新。

2. **用户 Profile 接口**：实现 `GET /auth/profile`，使用 `@CurrentUser()` 装饰器获取当前用户信息。

### 🟡 进阶题

3. **Token 刷新机制**：实现双 Token 机制（Access Token 15min + Refresh Token 7d），`POST /auth/refresh` 接口用 Refresh Token 换取新的 Access Token。

4. **登录日志**：记录每次登录的时间、IP、设备信息，实现 `GET /auth/login-history` 查看登录历史。

### 🔴 挑战题

5. **OAuth2 社交登录**：集成 GitHub/Google OAuth2 登录，实现 `GET /auth/github` 和 `GET /auth/github/callback`，用 Passport 的 GitHub Strategy。

---

## 📝 知识点总结

```
NestJS JWT 认证
├── 用户管理
│   ├── User Entity (select: false)
│   ├── bcrypt 密码哈希
│   ├── @BeforeInsert / @BeforeUpdate
│   └── validatePassword()
├── JWT 核心流
│   ├── @nestjs/jwt JwtService
│   ├── sign() 签发 Token
│   ├── Payload 设计 (sub, email, role)
│   └── expiresIn 过期策略
├── Passport 集成
│   ├── JwtStrategy extends PassportStrategy
│   ├── validate() → req.user
│   └── ExtractJwt.fromAuthHeaderAsBearerToken()
├── 守卫系统
│   ├── JwtAuthGuard (全局认证)
│   ├── RolesGuard (角色授权)
│   ├── APP_GUARD 全局注册
│   └── @Public() 公开路由
├── 自定义装饰器
│   ├── @Public() - 跳过认证
│   ├── @Roles() - 角色要求
│   └── @CurrentUser() - 获取当前用户
└── 安全实践
    ├── 密码哈希 (bcrypt, salt 10-12)
    ├── HttpOnly Cookie
    ├── HTTPS 传输
    └── Token 过期策略
```

---

## 🔄 举一反三

| 场景 | JWT + Guard 方案 | Session 方案 |
|------|------------------|-------------|
| 无状态认证 | ✅ 天然支持 | ❌ 需要服务端存储 |
| 分布式部署 | ✅ Token 自包含 | 需要 Redis 共享 Session |
| 撤销认证 | 较难（需黑名单） | ✅ 直接删 Session |
| 跨域认证 | ✅ Token 可跨域 | Cookie 跨域复杂 |
| 安全性 | 防 CSRF，需防 XSS | 防 XSS，需防 CSRF |
| Token 大小 | 较大（自包含数据） | 较小（仅 Session ID） |
| 适用场景 | API、微服务、移动端 | 传统 Web 应用 |

---

## 📚 参考资料

- [NestJS Authentication 官方文档](https://docs.nestjs.com/security/authentication)
- [NestJS Authorization 官方文档](https://docs.nestjs.com/security/authorization)
- [JWT.io - JWT 解码器](https://jwt.io/)
- [Passport.js 官方文档](http://www.passportjs.org/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

## 🛤️ 代码演进路线

### v1 → 基础认证（本文已覆盖）
- User 实体 + bcrypt 密码哈希
- 注册/登录接口
- JWT Token 签发
- AuthService 核心

### v2 → 守卫系统（本文已覆盖）
- JwtStrategy (Passport)
- JwtAuthGuard + RolesGuard
- 自定义装饰器 (@Public, @Roles, @CurrentUser)
- 全局守卫注册

### v3 → 生产安全（后续展开）
- HttpOnly Cookie Token
- Token 刷新机制 (双 Token)
- OAuth2 社交登录
- 速率限制 (防暴力破解)
- 账号锁定策略
- 审计日志

> **上一篇**：[NestJS TypeORM → 数据库持久化](/posts/025-nestjs-typeorm)
