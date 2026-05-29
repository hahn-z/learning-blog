---
title: "002 - TypeScript接口、泛型与高级类型"
slug: "002-typescript-interfaces-generics"
category: "TypeScript"
tech_stack: "TypeScript"
created_at: "2026-04-26T10:22:36.318+08:00"
updated_at: "2026-04-29T10:02:46.331+08:00"
reading_time: 21
tags: ["TypeScript", "前端"]
---

# TypeScript接口、泛型与高级类型

> **难度：** ⭐⭐⭐ 进阶级 | **阅读时间：** 约20分钟 | **前置知识：** TypeScript基础类型

## 一、概念讲解

接口（Interface）和泛型（Generics）是TypeScript类型系统的两大支柱。接口定义了对象的"形状"，泛型则让类型成为参数，实现类型的复用和灵活性。

### 接口 vs 类型别名

```typescript
// Interface - can be extended and merged
interface User {
  name: string;
  age: number;
}

interface Employee extends User {
  employeeId: string;
}

// Type alias - more flexible, supports unions
type Status = "active" | "inactive";
type Result<T> = { success: boolean; data: T };
```

### 泛型的本质

泛型就是**类型的参数化**。把类型当作变量一样传递，让函数和类不绑定具体类型。

```typescript
// Without generics - need separate functions
function identityString(val: string): string { return val; }
function identityNumber(val: number): number { return val; }

// With generics - one function for all types
function identity<T>(val: T): T { return val; }
```

## 二、脑图

```
TypeScript 高级类型系统
├── 接口 Interface
│   ├── 属性修饰（readonly, ?）
│   ├── 索引签名 [key: string]
│   ├── 继承 extends
│   └── 声明合并
├── 泛型 Generics
│   ├── 泛型函数 <T>
│   ├── 泛型接口 Interface<T>
│   ├── 泛型类 Class<T>
│   └── 泛型约束 extends
├── 工具类型 Utility Types
│   ├── Partial<T> / Required<T>
│   ├── Pick<T, K> / Omit<T, K>
│   ├── Record<K, V>
│   ├── Readonly<T>
│   └── ReturnType<T> / Parameters<T>
├── 条件类型
│   ├── T extends U ? X : Y
│   ├── infer 关键字
│   └── 分布式条件类型
└── 映射类型
    ├── { [K in keyof T]: ... }
    └── 键的重映射 as
```

## 三、完整TypeScript代码

```typescript
// ============================================
// TypeScript Interfaces, Generics & Advanced Types
// ============================================

// --- 1. Interface Basics ---
interface User {
  readonly id: number;
  name: string;
  age?: number; // optional property
  [key: string]: unknown; // index signature for extra props
}

const user: User = { id: 1, name: "Alice", extra: "value" };
// user.id = 2; // Error: readonly

// --- 2. Interface Extension ---
interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

interface BlogPost extends User, Timestamps {
  title: string;
  content: string;
  tags: string[];
}

// --- 3. Generic Functions ---
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

function mergeObjects<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}

// Generic constraints with keyof
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// --- 4. Generic Interfaces ---
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: Date;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// Usage
const userResponse: ApiResponse<User> = {
  data: { id: 1, name: "Alice" },
  status: 200,
  message: "OK",
  timestamp: new Date(),
};

// --- 5. Generic Classes ---
class DataStore<T> {
  private items: T[] = [];

  add(item: T): void {
    this.items.push(item);
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  getAll(): T[] {
    return [...this.items];
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
}

const store = new DataStore<User>();
store.add({ id: 1, name: "Alice" });

// --- 6. Built-in Utility Types ---
interface Todo {
  title: string;
  description: string;
  completed: boolean;
}

// Partial - all properties optional
type PartialTodo = Partial<Todo>;
const update: PartialTodo = { completed: true };

// Required - all properties required
type RequiredTodo = Required<Todo>;

// Pick - select specific properties
type TodoPreview = Pick<Todo, "title" | "completed">;

// Omit - exclude specific properties
type TodoInfo = Omit<Todo, "completed">;

// Record - construct type with property keys and value type
type PageInfo = Record<"home" | "about" | "contact", { url: string }>;
const pages: PageInfo = {
  home: { url: "/" },
  about: { url: "/about" },
  contact: { url: "/contact" },
};

// Readonly
type ReadonlyTodo = Readonly<Todo>;

// --- 7. Conditional Types ---
type IsString<T> = T extends string ? "yes" : "no";
type A = IsString<string>; // "yes"
type B = IsString<number>; // "no"

// infer keyword
type UnpackPromise<T> = T extends Promise<infer U> ? U : T;
type Result = UnpackPromise<Promise<string>>; // string

// Extract and Exclude
type StringOrNumber = string | number | boolean;
type OnlyString = Extract<StringOrNumber, string | number>; // string | number
type NoBoolean = Exclude<StringOrNumber, boolean>; // string | number

// --- 8. Mapped Types ---
type Optional<T> = {
  [K in keyof T]?: T[K];
};

type ReadonlyDeep<T> = {
  readonly [K in keyof T]: T[K];
};

// Key remapping (TS 4.1+)
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }

// --- 9. Template Literal Types ---
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

// --- 10. Practical: Type-safe Event Emitter ---
type EventMap = {
  login: { userId: string; timestamp: Date };
  logout: { userId: string };
  error: { message: string; code: number };
};

class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Array<(data: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners[event]?.forEach(handler => handler(data));
  }
}

const emitter = new TypedEmitter<EventMap>();
emitter.on("login", (data) => {
  console.log(`User ${data.userId} logged in at ${data.timestamp}`);
});
emitter.emit("login", { userId: "u1", timestamp: new Date() });
```

## 四、执行预览

```
$ npx tsc --noEmit advanced-types.ts
# 编译通过 ✅

$ npx ts-node advanced-types.ts
User u1 logged in at Wed Apr 29 2026 01:00:00 GMT+0800
```

## 五、注意事项

| 要点 | 说明 | 建议 |
|------|------|------|
| 接口 vs type | 接口可合并和扩展，type更灵活 | 定义对象形状用接口，联合/交叉用type |
| 泛型约束 | 限制泛型的范围 | 用 `extends` 添加约束 |
| 条件类型分发 | 联合类型会自动分发 | 用 `[T]` 包裹阻止分发 |
| mapped types | 只读映射 | 注意 `readonly` 和 `?` 修饰符 |
| infer | 只能在条件类型的extends子句中使用 | 用于提取嵌套类型 |

## 六、避坑指南

```typescript
// ❌ 泛型没有约束
function getLength<T>(val: T) { return val.length; } // Error
// ✅ 用 extends 约束
function getLength<T extends { length: number }>(val: T): number { return val.length; }

// ❌ 接口定义函数重载不清晰
interface Fn { (x: string): number; (x: number): string; }
// ✅ 用type更清晰
type Fn = ((x: string) => number) & ((x: number) => string);

// ❌ 映射类型修改了索引签名
// ✅ 使用 Pick + 重新组合来精确控制

// ❌ 条件类型没有处理 never
type Wrap<T> = T extends string ? [T] : never;
type Result = Wrap<string | number>; // [string] (distributed)
// ✅ 包装在元组中阻止分发
type Wrap2<T> = [T] extends [string] ? [T] : never;
```

## 七、练习题

### 🟢 入门
1. 定义 `Customer` 接口，包含 name、email、可选的 phone
2. 编写泛型函数 `lastElement<T>(arr: T[]): T | undefined`

### 🟡 进阶
3. 实现 `DeepPartial<T>` 工具类型，递归地将所有属性变为可选
4. 编写类型安全的 `Object.keys` 包装函数

### 🔴 挑战
5. 实现 `UnionToIntersection<U>` 工具类型

## 八、知识点总结

```
接口·泛型·高级类型
├── 接口 → 定义对象形状，支持继承与合并
├── 泛型 → 类型参数化，<T>语法
│   ├── 约束 → extends
│   └── 默认值 → <T = Default>
├── 工具类型 → Partial, Pick, Omit, Record, Readonly
├── 条件类型 → T extends U ? X : Y
│   └── infer → 类型推断
├── 映射类型 → [K in keyof T]
└── 模板字面量类型 → `on${Event}`
```

## 九、举一反三

| 场景 | 高级类型 | 示例 |
|------|---------|------|
| API客户端 | 泛型接口 | `ApiResponse<T>` |
| 表单处理 | Partial + Pick | `UpdateDTO = Partial<Pick<User, 'name'>>` |
| 状态管理 | 交叉类型 | `State & Actions` |
| 事件系统 | 映射类型 | `Getters<T>` |
| 数据库模型 | 条件类型 | `ColumnType<T>` |

## 十、参考资料

- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook - Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Type Challenges](https://github.com/type-challenges/type-challenges)

## 十一、代码演进

### v1 → 基础接口

```typescript
interface User { name: string; age: number; }
function getUser(): User { return { name: "Alice", age: 30 }; }
```

### v2 → 泛型响应

```typescript
interface ApiResponse<T> { data: T; status: number; }
function getUser(): ApiResponse<User> { return { data: { name: "Alice", age: 30 }, status: 200 }; }
```

### v3 → 完整类型安全

```typescript
class ApiClient {
  async request<T>(url: string): Promise<ApiResponse<T>> {
    const res = await fetch(url);
    return { data: await res.json() as T, status: res.status };
  }
}
```
