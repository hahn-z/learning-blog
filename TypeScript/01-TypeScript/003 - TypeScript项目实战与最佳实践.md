---
title: "003 - TypeScript项目实战与最佳实践"
slug: "003-typescript-project-best-practices"
category: "TypeScript"
tech_stack: "TypeScript"
created_at: "2026-04-26T10:22:36.342+08:00"
updated_at: "2026-04-29T10:02:46.343+08:00"
reading_time: 25
tags: ["TypeScript", "前端"]
---

# TypeScript项目实战与最佳实践

> **难度：** ⭐⭐⭐ 进阶级 | **阅读时间：** 约20分钟 | **前置知识：** TypeScript基础、接口与泛型

## 一、概念讲解

在实际项目中，TypeScript不仅仅是添加类型注解。真正的工程化实践包括：合理的项目结构、严格的tsconfig配置、错误处理模式、类型安全的数据验证、以及与第三方库的类型集成。

### 核心原则

1. **严格模式优先**：开启 `strict: true`
2. **类型驱动开发**：先定义类型，再写实现
3. **边界验证**：运行时数据和编译时类型都要处理
4. **渐进式迁移**：旧项目可以用 `allowJs` 逐步引入

## 二、脑图

```
TypeScript 项目实战
├── 项目结构
│   ├── src/types/ → 全局类型定义
│   ├── src/services/ → 业务逻辑
│   ├── src/utils/ → 工具函数
│   └── src/__tests__/ → 测试
├── tsconfig 配置
│   ├── strict: true
│   ├── paths 别名
│   ├── baseUrl
│   └── include / exclude
├── 错误处理
│   ├── Result 模式
│   ├── 自定义错误类
│   └── 类型守卫
├── 数据验证
│   ├── Zod
│   ├── io-ts
│   └── TypeBox
├── 设计模式
│   ├── Builder 模式
│   ├── 工厂模式
│   └── 策略模式
└── 最佳实践
    ├── 命名规范
    ├── 类型导入
    └── 避免类型断言
```

## 三、完整TypeScript代码

```typescript
// ============================================
// TypeScript Project Best Practices - Full Demo
// ============================================

// --- 1. Result Pattern for Error Handling ---
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

// --- 2. Type-safe API Layer ---
interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
}

class ApiClient {
  constructor(private config: ApiConfig) {}

  async get<T>(url: string): Promise<Result<T>> {
    try {
      const response = await fetch(`${this.config.baseURL}${url}`, {
        headers: this.config.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        return {
          success: false,
          error: new AppError(
            `HTTP ${response.status}`,
            "HTTP_ERROR",
            response.status
          ),
        };
      }

      const data = (await response.json()) as T;
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new AppError(
          err instanceof Error ? err.message : "Unknown error",
          "NETWORK_ERROR"
        ),
      };
    }
  }

  async post<T, B>(url: string, body: B): Promise<Result<T>> {
    try {
      const response = await fetch(`${this.config.baseURL}${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          success: false,
          error: new AppError(
            `HTTP ${response.status}`,
            "HTTP_ERROR",
            response.status
          ),
        };
      }

      const data = (await response.json()) as T;
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: new AppError(
          err instanceof Error ? err.message : "Unknown error",
          "NETWORK_ERROR"
        ),
      };
    }
  }
}

// --- 3. Type-safe Event System ---
type EventKey<T extends Record<string, unknown>> = keyof T & string;
type EventHandler<T> = (payload: T) => void;

class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends EventKey<Events>>(
    event: K,
    handler: EventHandler<Events[K]>
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends EventKey<Events>>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

// --- 4. Type-safe Configuration Builder ---
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
}

class ConfigBuilder<T extends Record<string, unknown>> {
  private config = {} as Partial<T>;

  set<K extends keyof T>(key: K, value: T[K]): this {
    this.config[key] = value;
    return this;
  }

  build(): T {
    // Runtime validation
    const missing = Object.keys(this.config).filter(
      (k) => this.config[k as keyof T] === undefined
    );
    if (missing.length > 0) {
      throw new Error(`Missing config keys: ${missing.join(", ")}`);
    }
    return this.config as T;
  }
}

// --- 5. Type-safe Repository Pattern ---
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Repository<T extends BaseEntity> {
  findById(id: string): Promise<Result<T>>;
  findAll(filter?: Partial<T>): Promise<Result<T[]>>;
  create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<Result<T>>;
  update(id: string, data: Partial<Omit<T, "id" | "createdAt">>): Promise<Result<T>>;
  delete(id: string): Promise<Result<void>>;
}

// In-memory implementation
class InMemoryRepository<T extends BaseEntity> implements Repository<T> {
  private items = new Map<string, T>();

  async findById(id: string): Promise<Result<T>> {
    const item = this.items.get(id);
    if (!item) {
      return { success: false, error: new AppError("Not found", "NOT_FOUND", 404) };
    }
    return { success: true, data: item };
  }

  async findAll(filter?: Partial<T>): Promise<Result<T[]>> {
    let items = Array.from(this.items.values());
    if (filter) {
      items = items.filter((item) =>
        Object.entries(filter).every(
          ([key, value]) => item[key as keyof T] === value
        )
      );
    }
    return { success: true, data: items };
  }

  async create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<T>> {
    const now = new Date();
    const item = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;
    this.items.set(item.id, item);
    return { success: true, data: item };
  }

  async update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt">>
  ): Promise<Result<T>> {
    const existing = this.items.get(id);
    if (!existing) {
      return { success: false, error: new AppError("Not found", "NOT_FOUND", 404) };
    }
    const updated = { ...existing, ...data, updatedAt: new Date() } as T;
    this.items.set(id, updated);
    return { success: true, data: updated };
  }

  async delete(id: string): Promise<Result<void>> {
    if (!this.items.has(id)) {
      return { success: false, error: new AppError("Not found", "NOT_FOUND", 404) };
    }
    this.items.delete(id);
    return { success: true, data: undefined };
  }
}

// --- 6. Usage Example ---
interface Product extends BaseEntity {
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

async function demo() {
  const repo = new InMemoryRepository<Product>();

  // Create
  const createResult = await repo.create({
    name: "TypeScript Guide",
    price: 49.99,
    category: "Books",
    inStock: true,
  });

  if (createResult.success) {
    console.log("Created:", createResult.data.name);
    const id = createResult.data.id;

    // Update
    const updateResult = await repo.update(id, { price: 39.99 });
    if (updateResult.success) {
      console.log("Updated price:", updateResult.data.price);
    }

    // Query
    const allResult = await repo.findAll({ category: "Books" });
    if (allResult.success) {
      console.log("Books count:", allResult.data.length);
    }
  }
}

demo();
```

## 四、执行预览

```
$ npx ts-node project-demo.ts
Created: TypeScript Guide
Updated price: 39.99
Books count: 1
```

## 五、注意事项

| 实践 | 说明 | 建议 |
|------|------|------|
| strict模式 | 开启所有严格检查 | 新项目务必开启 |
| 类型导入 | 使用 `import type` | 避免运行时导入副作用 |
| 错误处理 | 不要用 try/catch 包裹一切 | 用 Result 模式替代异常 |
| 枚举 | const enum 有tree-shaking问题 | 用字面量联合类型替代 |
| any | 紧急情况用 unknown | 渐进式消除 any |

## 六、避坑指南

```typescript
// ❌ 不处理可能的null
const user = users.find(u => u.id === id);
console.log(user.name); // Error: user may be undefined
// ✅ 空值检查
const user = users.find(u => u.id === id);
if (user) console.log(user.name);

// ❌ 直接JSON.parse返回any
const data = JSON.parse(response) as User;
// ✅ 运行时验证
function validateUser(data: unknown): User {
  if (typeof data === "object" && data !== null && "name" in data) {
    return data as User;
  }
  throw new Error("Invalid user data");
}

// ❌ 在业务逻辑中使用类型断言
const price = value as number;
// ✅ 使用类型守卫
if (typeof value === "number") { /* safe */ }

// ❌ 省略函数返回类型
function calculate(input: number) { return input * 1.1; }
// ✅ 显式标注返回类型
function calculate(input: number): number { return input * 1.1; }
```

## 七、练习题

### 🟢 入门
1. 配置一个严格的 `tsconfig.json`，开启所有严格选项
2. 为一个简单的 Express 路由添加类型

### 🟡 进阶
3. 实现类型安全的 `localStorage` 封装（泛型 get/set）
4. 用 Result 模式重构一个使用 try/catch 的函数

### 🔴 挑战
5. 实现一个类型安全的发布-订阅系统，支持事件名称自动补全

## 八、知识点总结

```
TypeScript项目实战
├── Result模式 → 替代异常的安全错误处理
├── 类型安全API → 泛型HTTP客户端
├── 事件系统 → 类型安全的发布/订阅
├── Builder模式 → 链式配置构建
├── Repository模式 → 统一数据访问接口
└── 工程规范 → strict, import type, 显式返回类型
```

## 九、举一反三

| 场景 | 模式 | 优势 |
|------|------|------|
| HTTP请求 | Result<T> | 类型安全的错误处理 |
| 状态管理 | EventBus<Events> | 事件名和payload类型安全 |
| 数据库操作 | Repository<T> | 统一CRUD接口 |
| 配置管理 | ConfigBuilder<T> | 链式调用+类型检查 |
| 表单验证 | Zod schema | 运行时+编译时双重保障 |

## 十、参考资料

- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Effect-TS - Result Pattern](https://effect.website/)
- [Zod - TypeScript-first Schema Validation](https://zod.dev)

## 十一、代码演进

### v1 → 基础CRUD

```typescript
function getUser(id: string) {
  return db.query("SELECT * FROM users WHERE id = ?", [id]);
}
```

### v2 → 泛型Repository

```typescript
class Repository<T> {
  async findById(id: string): Promise<T | null> { /* ... */ }
}
```

### v3 → Result模式 + 完整类型安全

```typescript
class Repository<T extends BaseEntity> {
  async findById(id: string): Promise<Result<T>> { /* ... */ }
  async create(data: Omit<T, "id">): Promise<Result<T>> { /* ... */ }
}
```
