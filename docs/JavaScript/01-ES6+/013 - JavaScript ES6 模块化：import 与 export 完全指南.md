---
title: "013 - JavaScript ES6 模块化：import 与 export 完全指南"
slug: "013-js-modules"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:32:09.506+08:00"
updated_at: "2026-04-29T10:02:46.153+08:00"
reading_time: 27
tags: []
---

## 难度标注

> 🟡 **中等难度** — 需要理解模块系统原理、构建工具配置

## 概念讲解

### 什么是模块化？

模块化是将代码拆分为独立文件（模块），每个模块有自己的作用域，通过 `export` 暴露接口，通过 `import` 引用其他模块的功能。

**模块化的好处：**
- **封装**：模块内部变量不会污染全局
- **复用**：一个模块可以在多个地方使用
- **维护**：代码分文件管理，职责清晰
- **依赖管理**：明确声明模块间的依赖关系

### ES6 模块 vs CommonJS

| 特性 | ES6 Module | CommonJS |
|------|-----------|----------|
| 语法 | `import`/`export` | `require`/`module.exports` |
| 加载 | 编译时静态分析 | 运行时动态加载 |
| 值的类型 | **引用**（实时绑定） | **值的拷贝** |
| 顶层 this | `undefined` | 模块对象 |
| Tree-shaking | ✅ 支持 | ❌ 不支持 |
| 使用场景 | 前端（浏览器、打包工具） | Node.js 后端 |

### 静态 vs 动态导入

```javascript
// Static import: analyzed at compile time
import { utils } from './utils.js';

// Dynamic import: loaded at runtime (returns Promise)
const module = await import('./heavy-module.js');
```

## 脑图

```
              ES6 模块化
                  │
       ┌──────────┼──────────┐
       │          │          │
    export     import     高级用法
       │          │          │
   ┌───┴───┐  ┌──┴──┐  ┌───┴────┐
   │named  │  │named│  │dynamic │
   │default│  │default│ │rename │
   │re-export│ │namespace│ │circular│
   └───────┘  └─────┘  └────────┘
```

## 完整 JS 代码

### export — 导出模块

```javascript
// ============ math-utils.js ============

// Named exports: export individual items
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export class Calculator {
  constructor() {
    this.result = 0;
  }
  add(n) { this.result += n; return this; }
  getResult() { return this.result; }
}

// Private: not exported, only accessible within this module
function internalHelper() {
  return 'internal';
}
```

```javascript
// ============ logger.js ============

// Default export: one per module
export default class Logger {
  constructor(prefix) {
    this.prefix = prefix;
  }
  log(msg) {
    console.log(`[${this.prefix}] ${msg}`);
  }
}

// Can also have named exports alongside default
export const LEVELS = { DEBUG: 0, INFO: 1, ERROR: 2 };
```

```javascript
// ============ constants.js ============

// Export list (declare first, export later)
const MAX_SIZE = 100;
const MIN_SIZE = 1;
const DEFAULT_PAGE = 1;

export { MAX_SIZE, MIN_SIZE, DEFAULT_PAGE };

// Re-export from another module
export { add, multiply } from './math-utils.js';
export * from './math-utils.js';          // re-export all
export { default as Calculator } from './math-utils.js'; // rename default
```

### import — 导入模块

```javascript
// ============ app.js ============

// Named imports
import { add, multiply } from './math-utils.js';

// Default import
import Logger from './logger.js';

// Import default + named
import Logger, { LEVELS } from './logger.js';

// Rename during import
import { add as sum, multiply as mul } from './math-utils.js';

// Namespace import (import all as object)
import * as math from './math-utils.js';
console.log(math.add(1, 2));       // 3
console.log(math.PI);               // 3.14159

// Side-effect import (run module code only)
import './polyfill.js';
```

### 动态导入

```javascript
// ============ Dynamic Import ============

// Load module on demand (returns a Promise)
async function loadChart() {
  const { Chart } = await import('./chart-module.js');
  return new Chart('#container');
}

// Conditional loading
async function getFormatter(locale) {
  if (locale === 'zh') {
    const { formatZh } = await import('./formatters/zh.js');
    return formatZh;
  }
  const { formatEn } = await import('./formatters/en.js');
  return formatEn;
}

// With try/catch for error handling
async function safeImport(specifier) {
  try {
    return await import(specifier);
  } catch (err) {
    console.error(`Failed to load: ${specifier}`, err);
    return null;
  }
}

// React lazy loading pattern
// const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

### 模块模式实战

```javascript
// ============ config.js: Singleton pattern ============

// Module-level variable (private state)
let _config = {
  apiBase: 'https://api.example.com',
  timeout: 5000
};

// Exported getter/setter
export function getConfig() {
  return { ..._config }; // return copy
}

export function setConfig(updates) {
  _config = { ..._config, ...updates };
}

// ============ api.js: Depends on config ============
import { getConfig } from './config.js';

export async function fetchData(endpoint) {
  const { apiBase, timeout } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${apiBase}${endpoint}`, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
```

## 执行预览

```
// math-utils.js exports
export const PI = 3.14159
export function add(a,b) { return a+b }

// app.js imports
import { add } from './math-utils.js'
add(1, 2) → 3

import * as math from './math-utils.js'
math.add(3, 4) → 7

import Logger, { LEVELS } from './logger.js'
new Logger('app').log('hi') → [app] hi

// Dynamic import
const mod = await import('./heavy.js')
mod.doSomething() → loaded!
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| **浏览器要求** | `<script type="module">` 才能使用 ES6 模块 |
| **文件扩展名** | 浏览器中必须写 `.js` 后缀，Node 中可省略 |
| **严格模式** | ES6 模块自动启用严格模式（不可取消） |
| **异步加载** | 浏览器中模块默认 `defer` 加载 |
| **CORS** | 跨域模块需要正确的 CORS 头 |
| **路径** | 必须使用相对路径 `./` 或绝对路径，不能省略 `./` |
| **循环依赖** | 可能得到未初始化的 export（需要重构避免） |

## 避坑指南

### ❌ 忘记 type="module"
```html
<!-- ❌ Wrong: treated as classic script, import fails -->
<script src="app.js"></script>

<!-- ✅ Correct: enable ES6 module mode -->
<script type="module" src="app.js"></script>
```

### ❌ 混用 ES6 模块和 CommonJS
```javascript
// ❌ Wrong: cannot use require in ES6 module
import { something } from 'pkg';
const other = require('other-pkg'); // SyntaxError in ESM

// ✅ Correct: use import consistently
import something from 'pkg';
import other from 'other-pkg';
```

### ❌ 修改导入的值
```javascript
// ❌ Wrong: imports are read-only bindings
import { config } from './config.js';
config.timeout = 10000; // TypeError in strict mode (if config is primitive)

// ✅ Correct: import and create local copy
import { config } from './config.js';
const myConfig = { ...config, timeout: 10000 };
```

### ❌ 循环依赖
```javascript
// ❌ a.js imports from b.js, b.js imports from a.js
// → may get undefined for not-yet-initialized exports

// ✅ Correct: extract shared code to c.js
// a.js → imports from c.js
// b.js → imports from c.js
```

## 练习题

### 🟢 入门：基本导入导出

```javascript
// 1. Create string-utils.js that exports:
//    - capitalize(str): "hello" → "Hello"
//    - truncate(str, len): "hello world", 8 → "hello..."
//    - default export: a function reverse(str)

// 2. In app.js, import and use all of the above
```

### 🟡 进阶：模块设计

```javascript
// 3. Design a module pattern for a simple key-value store:
//    store.set('key', 'value')
//    store.get('key') → 'value'
//    store.getAll() → {key: 'value'}
//    store.remove('key')
//    Hint: use module-level private variable

// 4. Create a plugin system using dynamic imports:
//    loadPlugin('analytics') → imports ./plugins/analytics.js
```

### 🔴 挑战：循环依赖与架构

```javascript
// 5. Refactor circular dependency:
//    userService.js imports from logger.js
//    logger.js imports from config.js
//    config.js imports from userService.js (to get user preferences)
//    → How to break the cycle?
```

<details>
<summary>📋 参考答案</summary>

```javascript
// 1. string-utils.js
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
export function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}
export default function reverse(str) {
  return str.split('').reverse().join('');
}

// 2. app.js
import reverse, { capitalize, truncate } from './string-utils.js';
console.log(capitalize('hello'));     // Hello
console.log(truncate('hello world', 8)); // hello...
console.log(reverse('hello'));        // olleh

// 3. store.js
const _store = {};
export const store = {
  set(key, value) { _store[key] = value; },
  get(key) { return _store[key]; },
  getAll() { return { ..._store }; },
  remove(key) { delete _store[key]; }
};

// 4. plugin-loader.js
export async function loadPlugin(name) {
  try {
    return await import(`./plugins/${name}.js`);
  } catch (err) {
    console.error(`Plugin '${name}' not found:`, err);
    return null;
  }
}

// 5. Extract config to separate module, remove config→userService dependency
// config.js: pure config, no imports from userService
// userService.js: imports config + logger
// logger.js: imports config only
```
</details>

## 知识点总结

```
ES6 模块化
├── export
│   ├── Named export: export const/fn/class
│   ├── Default export: export default X
│   ├── Export list: export { a, b, c }
│   └── Re-export: export { x } from './y.js'
├── import
│   ├── Named: import { a, b } from './mod'
│   ├── Default: import X from './mod'
│   ├── Rename: import { a as b } from './mod'
│   ├── Namespace: import * as mod from './mod'
│   └── Side-effect: import './polyfill'
├── Dynamic Import
│   ├── import('./mod') → Promise
│   ├── 按需加载 / 代码分割
│   └── 配合 try/catch 错误处理
├── 核心特性
│   ├── 编译时静态分析
│   ├── 实时绑定（引用而非拷贝）
│   ├── 自动严格模式
│   └── 支持 Tree-shaking
└── 常见问题
    ├── 循环依赖 → 提取共享模块
    ├── 路径必须写 ./ 
    └── 浏览器需 type="module"
```

## 举一反三

| 场景 | 方案 | 示例 |
|------|------|------|
| 工具函数库 | named export + namespace import | `import * as utils from './utils'` |
| 单一主类 | default export | `export default class App {}` |
| 配置模块 | singleton 模式 | 模块级变量 + getter/setter |
| 按需加载 | dynamic import | `await import('./heavy')` |
| 插件系统 | dynamic import + 约定路径 | `import(\`./plugins/\${name}\`)` |
| 聚合导出 | re-export | `export { a } from './a'` |

## 参考资料

- [MDN: import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
- [MDN: export](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [ES6 Modules in Depth](https://hacks.mozilla.org/2015/08/es6-in-depth-modules/)

## 代码演进

### v1 — 全局脚本
```javascript
// Everything in one file, global scope
var API_BASE = 'https://api.example.com';
function fetchData(url) { /* ... */ }
function renderChart(data) { /* ... */ }
// Risk: naming collisions, hard to maintain
```

### v2 — IIFE 模块模式
```javascript
// Immediately Invoked Function Expression
var ApiModule = (function() {
  var baseUrl = 'https://api.example.com';
  function fetch(url) { /* use baseUrl */ }
  return { fetch: fetch };
})();
// Better: scoped, but manual dependency management
```

### v3 — ES6 模块
```javascript
// api.js
const baseUrl = 'https://api.example.com';
export async function fetch(endpoint) { /* ... */ }

// chart.js
import { fetch } from './api.js';
export function render(selector) { /* ... */ }

// app.js
import { render } from './chart.js';
render('#app');
// Clean: explicit deps, tree-shakeable, scope isolated
```
