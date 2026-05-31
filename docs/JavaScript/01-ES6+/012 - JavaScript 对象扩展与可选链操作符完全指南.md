---
title: "012 - JavaScript 对象扩展与可选链操作符完全指南"
slug: "012-js-object-optional"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:32:09.494+08:00"
updated_at: "2026-04-29T10:02:46.137+08:00"
reading_time: 30
tags: []
---

## 难度标注

> 🟡 **中等难度** — 涉及 ES6+ 语法特性和解构概念

## 概念讲解

### 对象扩展运算符（Spread Operator）`...`

对象扩展运算符 `...` 用于将一个对象的属性"展开"到另一个对象中。它是**浅拷贝**，不是深拷贝。

```javascript
const defaults = { theme: 'dark', lang: 'zh', fontSize: 14 };
const userPrefs = { lang: 'en', sidebar: true };

const merged = { ...defaults, ...userPrefs };
// { theme: 'dark', lang: 'en', fontSize: 14, sidebar: true }
// userPrefs 的 lang 覆盖了 defaults 的 lang
```

**核心特性：**
- 后面的属性覆盖前面的（`{...a, ...b}`，b 的同名属性覆盖 a）
- 浅拷贝：嵌套对象仍然是引用
- 只复制**可枚举的自有属性**

### 可选链操作符 `?.`

可选链允许你安全地访问嵌套对象的属性，即使中间某个属性是 `null` 或 `undefined`，也不会报错。

```javascript
const user = { address: { city: 'Shanghai' } };

// Without optional chaining
const zip = user && user.address && user.address.zip; // undefined

// With optional chaining
const zip = user?.address?.zip; // undefined, no error!
```

**三种用法：**
1. `obj?.prop` — 访问属性
2. `obj?.[expr]` — 动态属性访问
3. `obj?.()` — 调用函数（如果存在）

### 空值合并操作符 `??`（常与 `?.` 搭配）

```javascript
const port = config?.server?.port ?? 3000; // default to 3000 if null/undefined
```

`??` 只在值为 `null` 或 `undefined` 时使用默认值，而 `||` 对所有假值（`0`, `''`, `false`）都生效。

## 脑图

```
            对象扩展与可选链
                │
    ┌───────────┴───────────┐
    │                       │
  扩展运算符(...)         可选链(?.)
    │                       │
  ┌─┴──┐               ┌───┴───┐
  │浅拷贝│               │属性访问 │
  │合并  │               │函数调用 │
  │解构  │               │动态键   │
  └────┘               └───────┘
    │                       │
  搭配使用：                 搭配：
  rest参数                  空值合并 ??
  函数参数默认值              ||
```

## 完整 JS 代码

### 对象扩展运算符

```javascript
// ============ Spread Operator: Merge & Clone ============

// Clone an object
const original = { a: 1, b: 2, c: 3 };
const clone = { ...original };
console.log(clone); // {a: 1, b: 2, c: 3}
clone.a = 999;
console.log(original.a); // 1 — original unchanged

// Merge with override (later wins)
const defaults = { color: 'blue', size: 'M', timeout: 3000 };
const options = { size: 'L', verbose: true };
const config = { ...defaults, ...options };
console.log(config);
// {color: 'blue', size: 'L', timeout: 3000, verbose: true}

// Conditional properties (spread nothing is safe)
const base = { name: 'App', version: '1.0' };
const debug = { ...base, ...(process.env.NODE_ENV === 'development' ? { debug: true } : {}) };
console.log(debug); // depends on env

// Remove a property (using rest in destructuring)
const { c, ...withoutC } = { a: 1, b: 2, c: 3, d: 4 };
console.log(withoutC); // {a: 1, b: 2, d: 4}

// Update nested object (immutable update)
const state = {
  user: { name: 'Alice', age: 25 },
  settings: { theme: 'dark' }
};
const newState = {
  ...state,
  user: { ...state.user, age: 26 }
};
console.log(newState.user.age); // 26
console.log(state.user.age);    // 25 — original unchanged

// BEWARE: shallow copy!
const obj = { nested: { value: 1 } };
const copied = { ...obj };
copied.nested.value = 999;
console.log(obj.nested.value); // 999 — shared reference!
```

### 可选链操作符

```javascript
// ============ Optional Chaining: Safe Access ============

const user = {
  name: 'Alice',
  address: {
    city: 'Shanghai',
    coordinates: { lat: 31.23, lng: 121.47 }
  },
  // phone is undefined
  getFullName() { return `${this.name} Smith`; }
};

// Property access
console.log(user?.name);                    // 'Alice'
console.log(user?.phone?.number);           // undefined (no error)
console.log(user?.address?.city);           // 'Shanghai'
console.log(user?.address?.zip);            // undefined

// Dynamic property
const key = 'city';
console.log(user?.address?.[key]);          // 'Shanghai'
console.log(user?.metadata?.[key]);         // undefined

// Function call
console.log(user.getFullName?.());          // 'Alice Smith'
console.log(user.getAge?.());               // undefined
user.unknownMethod?.();                     // no error, returns undefined

// With nullish coalescing
const zip = user?.address?.zip ?? '000000';
console.log(zip); // '000000'

// Important: only checks null/undefined, not other falsy
const obj = { count: 0, name: '' };
console.log(obj?.count);   // 0 (not undefined!)
console.log(obj?.name);    // '' (not undefined!)
```

### 解构赋值高级用法

```javascript
// ============ Destructuring Patterns ============

// Object destructuring with defaults
const { name = 'Unknown', age = 0, role = 'user' } = { name: 'Alice' };
console.log(name, age, role); // Alice 0 user

// Nested destructuring
const response = {
  data: { users: [{ id: 1, name: 'Alice' }] },
  status: 200
};
const { data: { users: [firstUser] }, status } = response;
console.log(firstUser); // {id: 1, name: 'Alice'}

// Rename during destructuring
const { name: userName, age: userAge } = { name: 'Bob', age: 30 };
console.log(userName, userAge); // Bob 30

// Function parameter destructuring
function createUser({ name, role = 'user', active = true } = {}) {
  return { name, role, active };
}
console.log(createUser({ name: 'Alice' })); // {name:'Alice', role:'user', active:true}
console.log(createUser());                   // {name:undefined, role:'user', active:true}

// Deep cloning with spread (practical pattern)
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (isObject(source[key]) && isObject(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}
```

## 执行预览

```
// Spread merge
{...{a:1,b:2}, ...{b:3,c:4}} → {a:1, b:3, c:4}

// Shallow copy pitfall
obj = {nested:{v:1}}
copy = {...obj}
copy.nested.v = 999
obj.nested.v → 999 ⚠️ shared reference!

// Optional chaining
user?.address?.city     → 'Shanghai'
user?.phone?.number     → undefined (safe)
user.getFullName?.()    → 'Alice Smith'
user.missing?.()        → undefined (safe)

// Nullish coalescing
null ?? 'default'    → 'default'
undefined ?? 'default' → 'default'
0 ?? 'default'       → 0 (NOT 'default'!)
'' ?? 'default'      → '' (NOT 'default'!)
```

## 注意事项

| 特性 | 浏览器支持 | Node.js | 注意 |
|------|-----------|---------|------|
| 扩展运算符 `{...obj}` | Chrome 60+ | 8.3+ | 浅拷贝，注意嵌套引用 |
| 可选链 `?.` | Chrome 80+ | 14+ | 不能用于赋值左侧 |
| 空值合并 `??` | Chrome 80+ | 14+ | 与 `\|\|` 的假值处理不同 |
| 解构默认值 | Chrome 49+ | 6+ | 仅在 `undefined` 时生效 |

| 注意点 | 说明 |
|--------|------|
| **浅拷贝陷阱** | `{...obj}` 嵌套对象仍是引用，修改会互相影响 |
| **?. 不能赋值** | `user?.name = 'Bob'` 会报 SyntaxError |
| **?. 短路** | 一旦遇到 null/undefined，后续属性不再求值 |
| **?? 优先级** | `??` 不能和 `\|\|` 或 `&&` 混用，必须加括号 |
| **解构默认值** | 只在值为 `undefined` 时生效，`null` 不会触发默认值 |

## 避坑指南

### ❌ 扩展运算符的浅拷贝陷阱
```javascript
// ❌ Wrong: nested object is still a reference
const original = { settings: { theme: 'dark' } };
const copy = { ...original };
copy.settings.theme = 'light';
console.log(original.settings.theme); // 'light' — mutated!

// ✅ Correct: deep spread for nested objects
const deepCopy = { ...original, settings: { ...original.settings } };
deepCopy.settings.theme = 'light';
console.log(original.settings.theme); // 'dark' — safe

// ✅ Best: use structuredClone for true deep copy
const realClone = structuredClone(original);
```

### ❌ 可选链用于赋值
```javascript
// ❌ Wrong: cannot use optional chaining on left side of assignment
user?.address?.city = 'Beijing'; // SyntaxError

// ✅ Correct: check first, then assign
if (user?.address) {
  user.address.city = 'Beijing';
}
```

### ❌ ?? 与 || 混淆
```javascript
// ❌ Wrong: || treats 0 and '' as falsy
const pageSize = options.pageSize || 10;
// If options.pageSize is 0, it becomes 10!

// ✅ Correct: ?? only reacts to null/undefined
const pageSize = options.pageSize ?? 10;
// pageSize = 0 is preserved
```

### ❌ 解构时 null 不触发默认值
```javascript
// ❌ Gotcha: null does NOT trigger default value
const { name = 'Unknown' } = { name: null };
console.log(name); // null (not 'Unknown')

// ✅ Correct: use nullish coalescing after destructuring
const input = { name: null };
const name = input.name ?? 'Unknown';
console.log(name); // 'Unknown'
```

## 练习题

### 🟢 入门：基本用法

```javascript
// 1. Merge two config objects, userConfig overrides defaults
const defaults = { theme: 'light', lang: 'zh', perPage: 20 };
const userConfig = { theme: 'dark', perPage: 50 };
// Expected: {theme:'dark', lang:'zh', perPage:50}

// 2. Safely get user.address.zip or return 'N/A'
const user = { name: 'Alice', address: { city: 'Shanghai' } };
// Expected: 'N/A'

// 3. Clone an object without modifying original
const obj = { a: 1, b: { c: 2 } };
```

### 🟡 进阶：组合运用

```javascript
// 4. Remove 'password' from user object using rest destructuring
const user = { id: 1, name: 'Alice', password: 'secret', email: 'a@b.com' };
// Expected: {id:1, name:'Alice', email:'a@b.com'}

// 5. Create a function with destructured params and defaults
function greet(/* destructure here */) {
  // return greeting string
}
greet({ name: 'Alice' }); // 'Hello, Alice!'
greet({});                 // 'Hello, Guest!'
greet();                   // 'Hello, Guest!'
```

### 🔴 挑战：深层嵌套

```javascript
// 6. Deep merge two objects (handle nested objects recursively)
// deepMerge({a:{b:1,c:2}}, {a:{c:3,d:4}}) → {a:{b:1,c:3,d:4}}

// 7. Safe deep getter using optional chaining
// getDeepValue(obj, 'a.b.c.d') → value or undefined
```

<details>
<summary>📋 参考答案</summary>

```javascript
// 1
const config = { ...defaults, ...userConfig };

// 2
const zip = user?.address?.zip ?? 'N/A';

// 3
const clone = { ...obj, b: { ...obj.b } }; // or structuredClone(obj)

// 4
const { password, ...safeUser } = user;

// 5
function greet({ name = 'Guest' } = {}) {
  return `Hello, ${name}!`;
}

// 6
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null &&
        typeof target[key] === 'object' && target[key] !== null) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// 7
const getDeepValue = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
```
</details>

## 知识点总结

```
对象扩展与可选链
├── 扩展运算符 (...)
│   ├── 浅拷贝对象
│   ├── 合并对象（后者覆盖前者）
│   ├── 条件属性展开
│   ├── Rest 解构（排除属性）
│   └── ⚠️ 嵌套对象仍为引用
├── 可选链 (?.)
│   ├── 属性访问 obj?.prop
│   ├── 动态键 obj?.[expr]
│   ├── 函数调用 fn?.()
│   └── 遇到 null/undefined 返回 undefined
├── 空值合并 (??)
│   ├── 仅 null/undefined 触发默认值
│   ├── 区别于 || (0, '', false 也触发)
│   └── 不能与 || 混用（需括号）
└── 解构赋值
    ├── 默认值（仅 undefined 触发）
    ├── 重命名 { name: userName }
    ├── 嵌套解构
    └── 函数参数解构 + 默认值
```

## 举一反三

| 场景 | 推荐方案 | 示例 |
|------|---------|------|
| 合并配置 | spread | `{...defaults, ...user}` |
| 安全访问嵌套属性 | `?.` | `user?.addr?.city` |
| 提供默认值 | `??` | `val ?? default` |
| 不可变更新 | spread + nested spread | `{...state, user: {...state.user, age: 26}}` |
| 排除属性 | rest 解构 | `const {pwd, ...safe} = user` |
| 深拷贝 | structuredClone | `structuredClone(obj)` |
| 条件属性 | spread + 三元 | `{...base, ...(cond ? {x:1} : {})}` |

## 参考资料

- [MDN: Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax)
- [MDN: Optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
- [MDN: Nullish coalescing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- [ES6 解构赋值完全指南](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)

## 代码演进

### v1 — 手动安全检查
```javascript
// Verbose: manual null checks everywhere
function getCity(user) {
  if (user !== null && user !== undefined) {
    if (user.address !== null && user.address !== undefined) {
      return user.address.city;
    }
  }
  return 'Unknown';
}
```

### v2 — 可选链 + 空值合并
```javascript
// Clean: one-liner
const getCity = user => user?.address?.city ?? 'Unknown';
```

### v3 — 不可变状态更新模式
```javascript
// Immutable update pattern with spread
function updateUser(state, userId, updates) {
  return {
    ...state,
    users: state.users.map(u =>
      u.id === userId
        ? { ...u, ...updates, updatedAt: Date.now() }
        : u
    )
  };
}
```
