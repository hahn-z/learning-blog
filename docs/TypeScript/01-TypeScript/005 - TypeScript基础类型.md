---
title: "005 - TypeScript基础类型"
slug: "005-ts-basic-types"
category: "TypeScript"
tech_stack: "TypeScript"
created_at: "2026-04-26T17:02:44.411+08:00"
updated_at: "2026-04-29T10:02:46.363+08:00"
reading_time: 25
tags: []
---

# 032-TypeScript基础类型

> **难度：** 🟢 入门 | **阅读时间：** 18分钟 | **前置知识：** TypeScript简介

---

## 一、概念讲解

### TypeScript类型系统概览

TypeScript的类型系统是**结构化类型系统（Structural Typing）**——关注的是值的**形状（shape）**而非名字。只要结构兼容，类型就兼容。

### 原始类型（Primitive Types）

```typescript
// JavaScript has 7 primitives, TypeScript has corresponding types
let str: string = 'hello';
let num: number = 42;        // covers both integer and float
let bool: boolean = true;
let n: null = null;
let u: undefined = undefined;
let big: bigint = 100n;      // ES2020+
let sym: symbol = Symbol('id');
```

### 类型推断（Type Inference）

TypeScript很聪明，很多时候不需要你手动标注：

```typescript
let name = 'Alice';     // inferred as string
let age = 30;           // inferred as number
let items = [1, 2, 3];  // inferred as number[]

// When TypeScript can't infer, it falls back to 'any'
let data;               // implicit any (avoid this!)
data = 'hello';
data = 42;
```

### 数组与元组

```typescript
// Arrays - two syntaxes
const nums: number[] = [1, 2, 3];
const strs: Array<string> = ['a', 'b'];

// Tuple - fixed length, fixed types
const pair: [string, number] = ['age', 25];
const rgb: [number, number, number] = [255, 128, 0];

// Named tuple (TS 4.0+)
const userRecord: [name: string, age: number] = ['Alice', 30];
```

### 特殊类型详解

| 类型 | 含义 | 使用场景 |
|------|------|----------|
| `any` | 任意类型，放弃类型检查 | 快速原型、迁移过渡 |
| `unknown` | 未知但安全的any | API响应、动态数据 |
| `void` | 无返回值 | 不返回内容的函数 |
| `never` | 永远不会有值 | 不可能到达的分支 |
| `null` / `undefined` | 各自的字面值 | 可选值、未初始化 |

#### `any` vs `unknown` 的关键区别

```typescript
// any: completely unchecked
let a: any = 'hello';
a.foo();        // No error at compile time, crashes at runtime
a();            // Same problem

// unknown: must narrow before using
let b: unknown = 'hello';
// b.foo();    // Error: Object is of type 'unknown'
if (typeof b === 'string') {
  console(b.toUpperCase()); // OK, narrowed to string
}
```

#### `never` 的妙用

```typescript
// Function that never returns
function throwError(msg: string): never {
  throw new Error(msg);
}

// Exhaustive check in switch
type Shape = 'circle' | 'square';

function area(shape: Shape): number {
  switch (shape) {
    case 'circle': return Math.PI;
    case 'square': return 1;
    default:
      // If we add a new Shape variant, this will error
      const _exhaustive: never = shape;
      return _exhaustive;
  }
}
```

### 枚举（Enum）

```typescript
// Numeric enum (default)
enum Direction {
  Up,      // 0
  Down,    // 1
  Left,    // 2
  Right    // 3
}

// String enum (recommended)
enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING'
}

// Const enum (inlined, no JS output)
const enum Color {
  Red = '#FF0000',
  Green = '#00FF00'
}
let c = Color.Red; // compiled to '#FF0000' directly
```

### 字面量类型（Literal Types）

```typescript
// String literal
type EventName = 'click' | 'focus' | 'blur';

// Number literal
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

// Boolean literal
type Truthy = true;

// Combined with 'as const'
const config = {
  host: 'localhost',
  port: 3000
} as const;
// typeof config.host = 'localhost' (not string)
// typeof config.port = 3000 (not number)
```

---

## 二、思维导图

```
TypeScript 基础类型
├── 原始类型
│   ├── string
│   ├── number
│   ├── boolean
│   ├── null / undefined
│   ├── bigint
│   └── symbol
├── 复合类型
│   ├── array (T[] / Array<T>)
│   ├── tuple ([A, B])
│   └── object
├── 特殊类型
│   ├── any (不安全)
│   ├── unknown (安全any)
│   ├── void
│   └── never
├── 枚举
│   ├── 数字枚举
│   ├── 字符串枚举
│   └── const enum
├── 字面量类型
│   ├── 字符串字面量
│   ├── 数字字面量
│   ├── 布尔字面量
│   └── as const
└── 类型推断
    ├── 初始化推断
    ├── 最佳通用类型
    └── 上下文推断
```

---

## 三、完整代码示例

```typescript
// ============================================
// TypeScript Basic Types - Complete Examples
// ============================================

// --- 1. Primitive Types ---
const title: string = 'TypeScript Guide';
const version: number = 5.3;
const isPublished: boolean = true;
const empty: null = null;
const pending: undefined = undefined;
const largeNum: bigint = 9007199254740991n;
const uniqueId: symbol = Symbol('unique');

// --- 2. Arrays ---
const scores: number[] = [95, 87, 92];
const names: string[] = ['Alice', 'Bob'];

// Readonly array (immutable)
const constants: readonly number[] = [1, 2, 3];
// constants.push(4); // Error: push doesn't exist on readonly

// --- 3. Tuples ---
const httpSuccess: [number, string] = [200, 'OK'];
const coordinate: [x: number, y: number, z?: number] = [10, 20];

// --- 4. Enums ---
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

function log(message: string, level: LogLevel): void {
  const prefix = LogLevel[level];
  console.log(`[${prefix}] ${message}`);
}

log('System started', LogLevel.INFO);

// --- 5. Special Types ---

// unknown: safe alternative to any
function parseJSON(input: string): unknown {
  return JSON.parse(input);
}

const result = parseJSON('{"name":"Alice"}');
// result.name; // Error: result is unknown

// Type narrowing with unknown
if (typeof result === 'object' && result !== null && 'name' in result) {
  console.log((result as { name: string }).name);
}

// void: function returns nothing
function notify(msg: string): void {
  console.log(msg);
}

// never: impossible states
function assertNever(x: never): never {
  throw new Error('Unexpected value: ' + x);
}

type TrafficLight = 'red' | 'yellow' | 'green';
function handleLight(light: TrafficLight): string {
  switch (light) {
    case 'red': return 'Stop';
    case 'yellow': return 'Caution';
    case 'green': return 'Go';
    default: return assertNever(light);
  }
}

// --- 6. Literal Types ---
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type StatusCode = 200 | 404 | 500;
type FeatureFlag = true;

function request(method: HttpMethod, url: string): void {
  console.log(`${method} ${url}`);
}

request('GET', '/api/users');
// request('PATCH', '/api/users'); // Error: 'PATCH' not in HttpMethod

// --- 7. as const assertions ---
const ROUTES = {
  home: '/',
  about: '/about',
  contact: '/contact'
} as const;

type Route = typeof ROUTES[keyof typeof ROUTES];
// Route = '/' | '/about' | '/contact'

// --- 8. Type Widening & Narrowing ---
let mutableStr = 'hello';   // string (widened)
const fixedStr = 'hello';   // 'hello' (literal, not widened)

// 'let' widens to base type, 'const' keeps literal
function printMutable(s: string) { console.log(s); }
function printFixed(s: 'hello') { console.log(s); }

printMutable(mutableStr);  // OK
printMutable(fixedStr);    // OK
// printFixed(mutableStr); // Error: string not assignable to 'hello'
printFixed(fixedStr);      // OK

console.log('All basic types demonstrated!');
```

---

## 四、执行预览

```bash
$ npx ts-node basic-types.ts
[INFO] System started
GET /api/users
All basic types demonstrated!

# 类型错误示例
$ npx tsc --noEmit
basic-types.ts:45:5 - error TS2322: Type '"PATCH"' is not assignable to type '"GET" | "POST" | "PUT" | "DELETE"'.
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| `number` 不区分int/float | TypeScript只有一个`number`类型 |
| `readonly` vs `const` | `const`用于变量，`readonly`用于属性 |
| 枚举会生成JS代码 | `const enum`不会，但有些构建工具不支持 |
| `null`和`undefined`是所有类型的子类型 | 在`strictNullChecks`下除外（推荐开启） |
| 元组越界不报错（旧版） | TS 4.0+在严格模式下会报错 |
| `as const`很强大 | 它让对象的所有属性变为`readonly`字面量类型 |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|-----------|
| `let x;` 不给初始值 | 要么给初始值，要么标注类型 |
| 大量使用`any` | 用`unknown`替代`any`，更安全 |
| `enum`和`const enum`混用 | 统一用字符串枚举或`const enum` |
| 忽略`strictNullChecks` | 开启它，避免`null`引用错误 |
| 元组当数组用 | 元组是**固定长度固定类型**，不是灵活数组 |
| `as const`到处用 | 只在需要字面量类型的地方用 |

---

## 七、练习题

### 🟢 基础

1. 定义一个`Point`元组类型`[x: number, y: number]`，编写计算两点距离的函数。

2. 创建一个字符串枚举`UserRole`，包含`Admin`/`Editor`/`Viewer`。

### 🟡 进阶

3. 编写一个`safeParse`函数，输入`unknown`，如果值是`string`则返回其长度，否则返回`null`。

4. 用字面量类型定义`HTTPStatus`，包含常见状态码，并写一个`getStatusText`函数。

### 🔴 挑战

5. 实现一个类型安全的`assert`函数：如果条件为`false`，抛出`never`类型的错误。

---

## 八、知识点总结

```
TypeScript 基础类型
├── 原始类型（7种）
│   ├── string / number / boolean
│   ├── null / undefined
│   ├── bigint / symbol
│   └── 类型推断规则
├── 复合类型
│   ├── Array<T> / T[]
│   ├── Tuple [A, B, ...C]
│   └── readonly 修饰
├── 特殊类型
│   ├── any（放弃检查）
│   ├── unknown（安全检查）
│   ├── void（无返回）
│   └── never（不可能）
├── 枚举
│   ├── 数字枚举（双向映射）
│   ├── 字符串枚举（单向）
│   └── const enum（内联）
├── 字面量类型
│   ├── 字符串/数字/布尔
│   ├── as const 断言
│   └── 模板字面量类型(TS 4.1+)
└── 关键配置
    ├── strictNullChecks
    ├── noImplicitAny
    └── strict
```

---

## 九、举一反三

| 场景 | 推荐类型 | 示例 |
|------|----------|------|
| API状态码 | 数字字面量联合 | `200 \| 400 \| 404 \| 500` |
| 配置项 | 字符串枚举 | `enum Env { Dev, Staging, Prod }` |
| 不确定的第三方数据 | `unknown` | `function parse(input: string): unknown` |
| 不返回值的函数 | `void` | `function log(msg: string): void` |
| 不可变数据 | `readonly` / `as const` | `const COLORS = ['red', 'green'] as const` |
| 配对数据 | Tuple | `[string, number]` 错误码+消息 |

---

## 十、参考资料

- [TypeScript Handbook - Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook - Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Type System](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

---

## 十一、代码演进

### v1 — 基础类型标注

```typescript
function processValue(value: any): string {
  return String(value);
}
```

### v2 — 使用具体类型

```typescript
function processValue(value: string | number): string {
  if (typeof value === 'string') return value.toUpperCase();
  return value.toFixed(2);
}
```

### v3 — 完整类型安全

```typescript
function processValue<T extends string | number>(value: T): T extends string ? string : string {
  if (typeof value === 'string') return value.toUpperCase() as any;
  return value.toFixed(2) as any;
}

// With overloaded signatures for perfect types
function format(value: string): string;
function format(value: number): string;
function format(value: string | number): string {
  if (typeof value === 'string') return value.toUpperCase();
  return value.toFixed(2);
}

const a = format('hello'); // type: string
const b = format(42);      // type: string
```

---

**总结：** TypeScript基础类型是整个类型系统的基石。掌握原始类型、特殊类型和字面量类型，你就拥有了表达几乎所有类型约束的能力。
