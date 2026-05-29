---
title: "001 - TypeScript类型系统入门"
slug: "001-typescript-type-system-basics"
category: "TypeScript"
tech_stack: "TypeScript"
created_at: "2026-04-26T10:22:36.297+08:00"
updated_at: "2026-04-29T10:02:46.322+08:00"
reading_time: 18
tags: ["TypeScript", "前端"]
---

# TypeScript类型系统入门

> **难度：** ⭐⭐ 入门级 | **阅读时间：** 约15分钟 | **前置知识：** JavaScript基础

## 一、概念讲解

TypeScript的类型系统是它的核心魅力所在。JavaScript是动态类型语言，变量在运行时才能确定类型，这导致很多错误只能在运行时暴露。TypeScript通过**静态类型检查**，在编译阶段就能捕获大部分类型错误。

### 静态类型 vs 动态类型

```typescript
// JavaScript - 运行时才报错
function add(a, b) {
  return a + b;
}
add("1", "2"); // "12" — 字符串拼接，不是数字相加！

// TypeScript - 编译时就能发现问题
function add(a: number, b: number): number {
  return a + b;
}
add("1", "2"); // Error: Argument of type 'string' is not assignable to parameter of type 'number'.
```

### 类型系统的分类

TypeScript采用的是**结构化类型系统（Structural Type System）**，也叫"鸭子类型"。只要两个类型的结构兼容，就认为它们是兼容的，不需要显式声明继承关系。

```typescript
// Structural typing - only shape matters
interface Point { x: number; y: number; }
interface Coordinate { x: number; y: number; }

const p: Point = { x: 1, y: 2 };
const c: Coordinate = p; // OK! Structure matches
```

## 二、脑图

```
TypeScript 类型系统
├── 基础类型
│   ├── number / string / boolean
│   ├── null / undefined
│   ├── symbol / bigint
│   ├── void / never
│   └── any / unknown
├── 复合类型
│   ├── 数组 Array<T>
│   ├── 元组 [T1, T2]
│   ├── 对象 object
│   └── 枚举 enum
├── 类型注解
│   ├── 变量: Type
│   ├── 函数参数和返回值
│   └── 类型断言 as Type
├── 类型推断
│   ├── 初始化推断
│   ├── 返回值推断
│   └── 最佳通用类型
└── 高级特性
    ├── 联合类型 A | B
    ├── 交叉类型 A & B
    ├── 字面量类型
    └── 类型守卫
```

## 三、完整TypeScript代码

```typescript
// ============================================
// TypeScript Type System Basics - Complete Demo
// ============================================

// --- 1. Basic Types ---
const userName: string = "Alice";
const userAge: number = 30;
const isActive: boolean = true;
const nothing: null = null;
const notAssigned: undefined = undefined;

// --- 2. Array and Tuple ---
const scores: number[] = [95, 87, 92];
const names: Array<string> = ["Alice", "Bob"];

// Tuple: fixed-length array with known types
const userRecord: [number, string, boolean] = [1, "Alice", true];

// --- 3. Enum ---
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

const move: Direction = Direction.Up;

// --- 4. Special Types ---
// any: opt out of type checking (avoid in production)
let flexible: any = "hello";
flexible = 42; // OK, but unsafe

// unknown: type-safe any
let safe: unknown = "hello";
// safe.toUpperCase(); // Error: Object is of type 'unknown'
if (typeof safe === "string") {
  safe.toUpperCase(); // OK after type narrowing
}

// void: function returns nothing
function logMessage(msg: string): void {
  console.log(msg);
}

// never: function never returns
function throwError(message: string): never {
  throw new Error(message);
}

// --- 5. Union and Intersection ---
type Status = "active" | "inactive" | "banned";
type ID = string | number;

interface HasName { name: string; }
interface HasAge { age: number; }
type Person = HasName & HasAge; // Intersection: has both name and age

const user: Person = { name: "Alice", age: 30 };

// --- 6. Type Guards ---
function processValue(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase(); // TypeScript knows it's string here
  }
  return value.toFixed(2); // TypeScript knows it's number here
}

// --- 7. Type Assertions ---
const input = document.getElementById("email") as HTMLInputElement;
const length = input.value.length;

// Non-null assertion (use with caution!)
const element = document.querySelector(".box")!;
element.classList.add("active");

// --- 8. Literal Types ---
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type StatusCode = 200 | 404 | 500;

function request(url: string, method: HttpMethod): void {
  console.log(`${method} ${url}`);
}

request("/api/users", "GET"); // OK
// request("/api/users", "PATCH"); // Error: "PATCH" is not assignable

// --- 9. Type Inference ---
let count = 0; // inferred as number
const greeting = "hello"; // inferred as "hello" (literal type with const)

function multiply(a: number, b: number) {
  return a * b; // return type inferred as number
}

// --- 10. Practical Example ---
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

function createUser(data: Omit<User, "id">): User {
  return {
    id: Math.floor(Math.random() * 10000),
    ...data,
  };
}

function canEdit(user: User): boolean {
  return user.role === "admin" || user.role === "editor";
}

// Usage
const newUser = createUser({
  name: "Bob",
  email: "bob@example.com",
  role: "editor",
});

console.log(canEdit(newUser)); // true
```

## 四、执行预览

```
$ npx ts-node typescript-basics.ts
true
GET /api/users
```

编译检查：
```
$ npx tsc --noEmit typescript-basics.ts
# 无错误输出 = 类型检查通过 ✅
```

## 五、注意事项

| 要点 | 说明 | 建议 |
|------|------|------|
| `any` 的使用 | `any` 会跳过所有类型检查 | 尽量用 `unknown` 替代 |
| 类型断言 | `as` 不会做运行时转换 | 只在确定类型时使用 |
| 枚举 | 数字枚举会生成反向映射 | 优先使用字符串枚举 |
| 类型推断 | TypeScript能自动推断大部分类型 | 能推断就不手动标注 |
| `never` | 表示永不存在的类型 | 用于穷尽检查和异常函数 |

## 六、避坑指南

### ❌ 到 ✅

```typescript
// ❌ 滥用 any
function parse(data: any) { return data.value; }
// ✅ 使用 unknown + 类型守卫
function parse(data: unknown) {
  if (typeof data === "object" && data !== null && "value" in data) {
    return (data as { value: string }).value;
  }
  throw new Error("Invalid data");
}

// ❌ 忽略 null/undefined
function getLength(arr: string[]) { return arr[0].length; }
// ✅ 处理可能为 undefined 的情况
function getLength(arr: string[]) { return arr[0]?.length ?? 0; }

// ❌ 类型断言绕过检查
const num = "123" as number; // 运行时仍是字符串
// ✅ 正确的类型转换
const num = Number("123"); // 实际转换

// ❌ 非空断言滥用
const el = document.querySelector(".box")!;
// ✅ 空值检查
const el = document.querySelector(".box");
if (el) { el.classList.add("active"); }
```

## 七、练习题

### 🟢 入门
1. 为以下变量添加类型注解：`const name = "Alice"`, `const age = 30`, `const hobbies = ["coding", "reading"]`
2. 编写一个函数 `formatUser(name: string, age: number): string`，返回 `"Alice (30)"` 格式

### 🟡 进阶
3. 定义一个 `Result<T>` 类型，可以是 `{ success: true; data: T }` 或 `{ success: false; error: string }`
4. 编写类型守卫函数 `isString(value: unknown): value is string`

### 🔴 挑战
5. 实现一个 `deepReadonly<T>` 工具类型，将对象所有属性（包括嵌套）变为只读

## 八、知识点总结

```
TypeScript类型系统核心
├── 类型注解 → 变量: Type
├── 类型推断 → 自动推导，减少冗余
├── 基础类型 → string, number, boolean, null, undefined, void, never
├── 复合类型 → Array, Tuple, Enum, Object
├── 组合类型 → Union(|), Intersection(&)
├── 类型守卫 → typeof, instanceof, in, 自定义守卫
└── 类型断言 → as Type, !, <>语法
```

## 九、举一反三

| 场景 | 类型工具 | 示例 |
|------|---------|------|
| API响应 | 联合类型 | `type Response = Success | Error` |
| 配置项 | 交叉类型 | `type Config = Default & Partial<UserConfig>` |
| 事件处理 | 字面量类型 | `type Event = "click" \| "hover"` |
| 表单验证 | 类型守卫 | `if (typeof value === "string")` |
| 错误处理 | never | `throw new Error()` 返回 never |

## 十、参考资料

- [TypeScript Handbook - Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Deep Dive - Type System](https://basarat.gitbook.io/typescript/type-system)
- [TypeScript Playground](https://www.typescriptlang.org/play)

## 十一、代码演进

### v1 → 基础类型注解

```typescript
function greet(name: string): string {
  return "Hello, " + name;
}
```

### v2 → 联合类型 + 类型守卫

```typescript
function greet(name: string | string[]): string {
  if (Array.isArray(name)) {
    return name.map(n => "Hello, " + n).join(", ");
  }
  return "Hello, " + name;
}
```

### v3 → 泛型 + 条件类型

```typescript
function greet<T extends string | string[]>(names: T): T extends string[] ? string[] : string {
  if (Array.isArray(names)) {
    return names.map(n => `Hello, ${n}`) as any;
  }
  return `Hello, ${names}` as any;
}
```
