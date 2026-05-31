---
title: "008 - NestJS 测试实战：从单元测试到 E2E 测试全覆盖"
slug: "008-nestjs-testing"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.71+08:00"
updated_at: "2026-04-29T10:02:48.08+08:00"
reading_time: 40
tags: []
---

## 难度标注

> ⭐⭐⭐☆☆ 中等 | 需要了解 NestJS 基础和测试概念

## 概念讲解

### 为什么需要测试？

测试不是负担，而是安全网。当你修改代码时，测试能快速告诉你是否破坏了已有功能。NestJS 提供了完整的测试工具链，让单元测试和 E2E 测试都变得简单。

### NestJS 测试体系

NestJS 默认使用 **Jest** 作为测试框架，并提供了 `@nestjs/testing` 包来简化测试编写。

**三种测试类型：**

| 类型 | 范围 | 速度 | 目的 |
|------|------|------|------|
| 单元测试 | 单个类/函数 | ⚡ 极快 | 验证逻辑正确性 |
| 集成测试 | 模块内多组件 | 🏃 较快 | 验证组件协作 |
| E2E 测试 | 完整应用 | 🐢 较慢 | 验证用户场景 |

**核心概念：**
- **Test Module**：用 `Test.createTestingModule()` 创建测试用的 Nest 模块
- **Mock / Stub**：替换真实依赖，隔离测试目标
- **Supertest**：E2E 测试中模拟 HTTP 请求

### 测试金字塔

```
        /  E2E  \           ← 少量，慢
       / 集成测试  \         ← 适量
      /   单元测试    \      ← 大量，快
```

## 脑图

```
NestJS Testing
├── 单元测试
│   ├── Test.createTestingModule()
│   ├── Jest Mock (jest.fn / jest.mock)
│   ├── Controller 测试
│   └── Service 测试
├── E2E 测试
│   ├── supertest (request)
│   ├── app.init() / app.close()
│   └── 数据库测试策略
├── Mock 策略
│   ├── 手动 Mock
│   ├── jest.fn()
│   ├── jest.mock()
│   └── Custom Provider
├── 测试技巧
│   ├── beforeEach / afterEach
│   ├── 覆盖率配置
│   ├── 异步测试
│   └── 环境变量模拟
└── 最佳实践
    ├── AAA 模式 (Arrange-Act-Assert)
    ├── 命名规范
    ├── 测试独立性
    └── CI/CD 集成
```

## 完整代码

### 被测代码

```typescript
// src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './interfaces/cat.interface';

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  create(createCatDto: CreateCatDto): Cat {
    const cat: Cat = {
      id: this.cats.length + 1,
      ...createCatDto,
      createdAt: new Date(),
    };
    this.cats.push(cat);
    return cat;
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    const cat = this.cats.find((c) => c.id === id);
    if (!cat) {
      throw new NotFoundException(`Cat #${id} not found`);
    }
    return cat;
  }

  update(id: number, updateDto: Partial<CreateCatDto>): Cat {
    const cat = this.findOne(id);
    Object.assign(cat, updateDto);
    return cat;
  }

  remove(id: number): void {
    const index = this.cats.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Cat #${id} not found`);
    }
    this.cats.splice(index, 1);
  }
}
```

```typescript
// src/cats/cats.controller.ts
import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { Cat } from './interfaces/cat.interface';

@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Post()
  create(@Body() createCatDto: CreateCatDto): Cat {
    return this.catsService.create(createCatDto);
  }

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Cat {
    return this.catsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Partial<CreateCatDto>): Cat {
    return this.catsService.update(+id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): void {
    this.catsService.remove(+id);
  }
}
```

```typescript
// src/cats/dto/create-cat.dto.ts
export class CreateCatDto {
  name: string;
  age: number;
  breed: string;
}
```

```typescript
// src/cats/interfaces/cat.interface.ts
export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
  createdAt: Date;
}
```

### v1：单元测试

```typescript
// src/cats/cats.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatsService } from './cats.service';

describe('CatsService', () => {
  let service: CatsService;

  beforeEach(async () => {
    // Create a fresh module for each test
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatsService],
    }).compile();

    service = module.get<CatsService>(CatsService);
  });

  describe('create', () => {
    it('should create a cat and return it with an id', () => {
      // Arrange
      const dto = { name: 'Whiskers', age: 3, breed: 'Siamese' };

      // Act
      const result = service.create(dto);

      // Assert
      expect(result).toEqual({
        id: 1,
        name: 'Whiskers',
        age: 3,
        breed: 'Siamese',
        createdAt: expect.any(Date),
      });
    });

    it('should auto-increment id', () => {
      service.create({ name: 'Cat1', age: 1, breed: 'A' });
      const cat2 = service.create({ name: 'Cat2', age: 2, breed: 'B' });

      expect(cat2.id).toBe(2);
    });
  });

  describe('findAll', () => {
    it('should return empty array initially', () => {
      expect(service.findAll()).toEqual([]);
    });

    it('should return all created cats', () => {
      service.create({ name: 'Cat1', age: 1, breed: 'A' });
      service.create({ name: 'Cat2', age: 2, breed: 'B' });

      expect(service.findAll()).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return cat by id', () => {
      const created = service.create({ name: 'Tom', age: 4, breed: 'Persian' });
      const found = service.findOne(created.id);
      expect(found.name).toBe('Tom');
    });

    it('should throw NotFoundException for missing id', () => {
      expect(() => service.findOne(999)).toThrow(NotFoundException);
      expect(() => service.findOne(999)).toThrow('Cat #999 not found');
    });
  });

  describe('update', () => {
    it('should update cat fields', () => {
      const cat = service.create({ name: 'Tom', age: 4, breed: 'Persian' });
      const updated = service.update(cat.id, { age: 5 });
      expect(updated.age).toBe(5);
      expect(updated.name).toBe('Tom'); // Unchanged
    });
  });

  describe('remove', () => {
    it('should remove cat from list', () => {
      const cat = service.create({ name: 'Tom', age: 4, breed: 'Persian' });
      service.remove(cat.id);
      expect(service.findAll()).toHaveLength(0);
    });

    it('should throw when removing non-existent cat', () => {
      expect(() => service.remove(999)).toThrow(NotFoundException);
    });
  });
});
```

```typescript
// src/cats/cats.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

describe('CatsController', () => {
  let controller: CatsController;
  let service: CatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatsController],
      providers: [CatsService], // Use real service for controller test
    }).compile();

    controller = module.get<CatsController>(CatsController);
    service = module.get<CatsService>(CatsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create and return result', () => {
      const dto = { name: 'Tom', age: 3, breed: 'Persian' };
      const result = controller.create(dto);
      expect(result.name).toBe('Tom');
      expect(service.findAll()).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should convert string id to number', () => {
      const cat = service.create({ name: 'Tom', age: 3, breed: 'Persian' });
      const result = controller.findOne('1');
      expect(result.id).toBe(1);
    });
  });
});
```

### v2：带 Mock 的单元测试

```typescript
// src/cats/cats.controller.spec.ts (v2 - with mocks)
import { Test, TestingModule } from '@nestjs/testing';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

describe('CatsController (with mocks)', () => {
  let controller: CatsController;
  // Fully mocked service
  let service: jest.Mocked<CatsService>;

  beforeEach(async () => {
    // Create mock for each service method
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatsController],
      providers: [
        {
          provide: CatsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CatsController>(CatsController);
    service = module.get(CatsService);
  });

  describe('create', () => {
    it('should delegate to service.create', () => {
      const dto = { name: 'Tom', age: 3, breed: 'Persian' };
      const expected = { id: 1, ...dto, createdAt: new Date() };
      service.create.mockReturnValue(expected);

      const result = controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return array from service', () => {
      const cats = [{ id: 1, name: 'Tom', age: 3, breed: 'P', createdAt: new Date() }];
      service.findAll.mockReturnValue(cats);

      expect(controller.findAll()).toEqual(cats);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should convert id param to number', () => {
      service.findOne.mockReturnValue({ id: 1 } as any);
      controller.findOne('1');
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });
});
```

### v3：E2E 测试

```typescript
// test/cats.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Cats API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply same pipes as production
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testCat = { name: 'Tom', age: 3, breed: 'Persian' };

  describe('POST /cats', () => {
    it('should create a cat', () => {
      return request(app.getHttpServer())
        .post('/cats')
        .send(testCat)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Tom');
          expect(res.body.id).toBeDefined();
        });
    });
  });

  describe('GET /cats', () => {
    it('should return array of cats', () => {
      return request(app.getHttpServer())
        .get('/cats')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('GET /cats/:id', () => {
    it('should return 404 for non-existent cat', () => {
      return request(app.getHttpServer())
        .get('/cats/9999')
        .expect(404);
    });
  });

  describe('Full CRUD flow', () => {
    let catId: number;

    it('should complete full CRUD lifecycle', async () => {
      // Create
      const createRes = await request(app.getHttpServer())
        .post('/cats')
        .send({ name: 'Lifecycle Cat', age: 1, breed: 'Test' });
      expect(createRes.status).toBe(201);
      catId = createRes.body.id;

      // Read
      const getRes = await request(app.getHttpServer())
        .get(`/cats/${catId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Lifecycle Cat');

      // Update
      const updateRes = await request(app.getHttpServer())
        .patch(`/cats/${catId}`)
        .send({ age: 2 });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.age).toBe(2);

      // Delete
      const deleteRes = await request(app.getHttpServer())
        .delete(`/cats/${catId}`);
      expect(deleteRes.status).toBe(200);

      // Verify deleted
      await request(app.getHttpServer())
        .get(`/cats/${catId}`)
        .expect(404);
    });
  });
});
```

## 执行预览

```bash
# 运行单元测试
$ npm run test

 PASS  src/cats/cats.service.spec.ts
  CatsService
    create
      ✓ should create a cat and return it with an id (3 ms)
      ✓ should auto-increment id (1 ms)
    findAll
      ✓ should return empty array initially
      ✓ should return all created cats (1 ms)
    findOne
      ✓ should return cat by id (1 ms)
      ✓ should throw NotFoundException for missing id (2 ms)
    update
      ✓ should update cat fields (1 ms)
    remove
      ✓ should remove cat from list (1 ms)
      ✓ should throw when removing non-existent cat

 PASS  src/cats/cats.controller.spec.ts
  CatsController (with mocks)
    ✓ should delegate to service.create (2 ms)
    ✓ should return array from service (1 ms)
    ✓ should convert id param to number

Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total

# 运行 E2E 测试
$ npm run test:e2e

 PASS  test/cats.e2e-spec.ts
  Cats API (e2e)
    POST /cats
      ✓ should create a cat (45 ms)
    GET /cats
      ✓ should return array of cats (8 ms)
    GET /cats/:id
      ✓ should return 404 for non-existent cat (5 ms)
    Full CRUD flow
      ✓ should complete full CRUD lifecycle (32 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

## 注意事项

| 项目 | 说明 |
|------|------|
| 测试隔离 | 每个 `it` 块应该独立运行，不依赖其他测试的执行顺序 |
| beforeEach | 用它重置状态，确保每次测试都从干净的状态开始 |
| Mock 边界 | Controller 测试 Mock Service，Service 测试 Mock Repository |
| E2E 环境 | E2E 测试可能需要独立的测试数据库，避免污染开发数据 |
| 覆盖率 | 目标 80%+ 覆盖率，核心业务逻辑争取 95%+ |
| 异步测试 | 注意 `async/await`，忘记 `await` 会导致假通过 |
| jest.useFakeTimers | 涉及定时器的代码需要 mock 时间 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 测试之间共享可变状态 | 每个测试独立创建数据，用 `beforeEach` 重置 |
| 测试实现细节（私有方法） | 测试公开的 API 行为和输出 |
| `expect` 放在 `catch` 块中 | 使用 `expect().rejects.toThrow()` 或 `expect(() => fn()).toThrow()` |
| E2E 测试依赖执行顺序 | 每个测试自包含，或用 `describe` 分组确保顺序 |
| 忽略 TypeScript 类型 | 用 `as any` 仅在必要时，尽量保持类型安全 |
| Mock 一切导致测试无意义 | 关键路径用真实依赖，仅 Mock 外部 I/O（DB、HTTP） |
| `setTimeout` 中写断言 | 用 `jest.useFakeTimers()` 或 `waitFor()` 工具 |

## 练习题

### 🟢 初级

1. 为 `CatsService` 编写 `findAll` 返回空数组的测试
2. 编写测试验证 `create` 方法返回的对象包含 `id` 字段
3. 编写 Controller 测试，验证 `findOne` 正确调用 Service

### 🟡 中级

4. 使用 `jest.fn()` Mock `CatsService`，编写 Controller 的完整测试
5. 编写测试验证 `NotFoundException` 在查询不存在记录时被抛出
6. 为 E2E 测试添加验证管道（ValidationPipe）的测试用例

### 🔴 高级

7. 编写数据库相关的集成测试，使用内存 SQLite
8. 实现 `@nestjs/testing` 的自定义 Provider 覆盖外部服务
9. 配置 CI 流水线，实现覆盖率门禁（低于 80% 则构建失败）

## 知识点总结

```
NestJS Testing 知识树
├── 单元测试
│   ├── Test.createTestingModule()
│   ├── module.get<T>() 获取实例
│   ├── jest.fn() 创建 Mock
│   └── expect() 断言
├── Mock 策略
│   ├── useValue - 对象 Mock
│   ├── useFactory - 动态 Mock
│   ├── useExisting - 别名
│   └── jest.spyOn() - 部分 Mock
├── E2E 测试
│   ├── supertest request()
│   ├── app.init() / app.close()
│   ├── httpServer 模拟请求
│   └── 状态码 + 响应体断言
├── 配置
│   ├── jest-e2e.json
│   ├── 覆盖率 collectCoverageFrom
│   └── moduleNameMapper 路径别名
└── 模式
    ├── AAA (Arrange-Act-Assert)
    ├── Given-When-Then
    └── 测试夹具 (Fixtures)
```

## 举一反三

| 场景 | 本文方法 | 迁移场景 | 迁移方案 |
|------|---------|---------|---------|
| Service 测试 | 直接实例化 | 第三方 API 调用 | Mock axios/fetch |
| Controller 测试 | Mock Service | Guard/Interceptor | 用 `overrideGuard` 跳过或 Mock |
| E2E 测试 | supertest | GraphQL API | 用 `request().send({ query })` |
| Mock Provider | useValue | TypeORM Repository | Mock `find`/`save`/`findOne` |
| 覆盖率 | Jest 配置 | 前端组件 | 加 `@testing-library` |

## 参考资料

- [NestJS Testing 官方文档](https://docs.nestjs.com/fundamentals/testing)
- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Testing NestJS 系列](https://javascript.plainenglish.io/testing-nestjs-apps-with-jest-7553296e2f0b)

## 代码演进

```
v1 (纯单元测试)
├── Service 直接测试
├── Controller 用真实 Service
├── 简单断言
└── 无 Mock

       ↓ 引入 Mock

v2 (Mock 隔离)
├── jest.fn() Mock Service
├── Controller 完全隔离
├── 验证调用参数
└── 验证调用次数

       ↓ 完整覆盖

v3 (E2E + 集成)
├── supertest HTTP 模拟
├── 完整 CRUD 生命周期
├── 验证管道和异常
└── CI 覆盖率门禁
```
