---
title: "002 - 模块系统：CommonJS 与 ESM"
slug: "002-modules"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.573+08:00"
updated_at: "2026-04-29T10:02:47.839+08:00"
reading_time: 18
tags: []
---

# 模块系统：CommonJS 与 ESM

> **难度：** ⭐⭐ 初级 | **预计阅读：** 18 分钟 | **标签：** Node.js, 模块, CommonJS, ES Modules

---

## 一、概念讲解

### 1.1 为什么需要模块化？

没有模块化的世界：
- 所有代码在一个文件里 → 几千行无法维护
- 变量全局污染 → 命名冲突频发
- 代码无法复用 → 复制粘贴满天飞

模块化解决的核心问题：**封装、复用、依赖管理**。

### 1.2 两大模块系统

| 特性 | CommonJS (CJS) | ES Modules (ESM) |
|------|----------------|-------------------|
| 语法 | `require()` / `module.exports` | `import` / `export` |
| 加载方式 | **同步**（运行时加载） | **异步**（编译时静态分析） |
| 加载时机 | 首次 require 时执行并缓存 | 编译时确定依赖 |
| this 指向 | `module.exports` | `undefined`（模块顶层） |
| 启用方式 | 默认（.js 文件） | `"type": "module"` 或 `.mjs` |
| 循环引用 | 返回已执行部分的快照 | 引用绑定，可能 TDZ 报错 |
| 适用场景 | Node.js 服务端 | 浏览器 + Node.js 通用 |

### 1.3 Node.js 模块类型

- **核心模块**：Node.js 自带，如 `fs`、`http`、`path`
- **文件模块**：你自己写的 `.js` 文件
- **第三方模块**：npm 安装的包，如 `express`
- **内置 C++ 模块**：如 `crypto`，底层用 C++ 实现

---

## 二、知识脑图

```
Node.js 模块系统
├── CommonJS (CJS)
│   ├── module.exports = value（导出整体）
│   ├── exports.name = value（导出属性）
│   ├── require('./path')（引入）
│   ├── 加载缓存机制
│   └── require.resolve()（查找路径）
├── ES Modules (ESM)
│   ├── export default
│   ├── export { name }
│   ├── import name from 'module'
│   ├── import { name } from 'module'
│   ├── 动态 import()
│   └── 启用：package.json "type":"module"
├── 模块解析规则
│   ├── 核心模块 → 直接用名字
│   ├── 相对路径 → ./ ../ 开头
│   ├── 绝对路径 → / 开头
│   └── node_modules → 逐级向上查找
└── 特殊机制
    ├── 循环依赖处理
    └── CJS ↔ ESM 互操作
```

---

## 三、完整代码示例

### 3.1 CommonJS 模块

```javascript
// math.js - CommonJS module (exports)
const PI = 3.14159;

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

// Export individual properties
exports.PI = PI;
exports.add = add;
exports.multiply = multiply;
```

```javascript
// logger.js - CommonJS module (module.exports)
class Logger {
  constructor(prefix) {
    this.prefix = prefix;
  }

  info(msg) {
    console.log(`[${this.prefix}] INFO: ${msg}`);
  }

  error(msg) {
    console.error(`[${this.prefix}] ERROR: ${msg}`);
  }
}

// Export the whole class
module.exports = Logger;
```

```javascript
// app.js - Using CommonJS modules
const { PI, add, multiply } = require('./math');
const Logger = require('./logger');

const log = new Logger('App');

log.info(`PI = ${PI}`);
log.info(`2 + 3 = ${add(2, 3)}`);
log.info(`4 * 5 = ${multiply(4, 5)}`);

// Require cache demo
const math2 = require('./math');
console.log(math2 === require('./math') ? 'Cached!' : 'New instance');
```

### 3.2 ES Modules

```javascript
// utils.mjs - ES Module exports
export const VERSION = '1.0.0';

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function greet(name) {
  return `Hello, ${capitalize(name)}!`;
}
```

```javascript
// main.mjs - ES Module imports
import greet, { capitalize, VERSION } from './utils.mjs';

console.log(`Version: ${VERSION}`);
console.log(greet('node'));
console.log(`Capitalized: ${capitalize('hello world')}`);

// Dynamic import
const { sleep } = await import('./utils.mjs');
console.log('Waiting 1s...');
await sleep(1000);
console.log('Done!');
```

### 3.3 混合模式（package.json type: module）

```json
{
  "name": "my-project",
  "type": "module"
}
```

```javascript
// config.js - ESM with top-level await
import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

export async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { port: 3000, host: 'localhost' };
  }
}

export const isDev = process.env.NODE_ENV !== 'production';
```

---

## 四、执行预览

```bash
# CommonJS
$ node app.js
[App] INFO: PI = 3.14159
[App] INFO: 2 + 3 = 5
[App] INFO: 4 * 5 = 20
Cached!

# ESM
$ node main.mjs
Version: 1.0.0
Hello, Node!
Capitalized: Hello world
Waiting 1s...
Done!
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 文件扩展名 | CJS 用 `.js`，ESM 用 `.mjs` 或 `"type":"module"` | 项目统一一种，不要混用 |
| `exports` 赋值 | `exports = {}` 会断开引用 | 用 `module.exports = {}` 重新赋值 |
| ESM 路径 | import 必须写完整扩展名 | `"type":"module"` 时写 `.js`，`.mjs` 写 `.mjs` |
| `__dirname` | ESM 中不存在 | 用 `import.meta.dirname`（Node 21+）或 `fileURLToPath` |
| 循环依赖 | CJS 返回部分执行结果，ESM 可能 TDZ | 设计上避免循环依赖 |
| Top-level await | ESM 支持，CJS 不支持 | 需要顶层 await 必须用 ESM |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `exports = { a: 1 }` | `module.exports = { a: 1 }` 或 `exports.a = 1` |
| `require('./math')` 省略扩展名 | Node 会依次尝试 `.js` → `.json` → `.node`（CJS 可省略，ESM 不可） |
| 在 ESM 中使用 `__dirname` | 用 `import.meta.dirname` 或 `fileURLToPath(import.meta.url)` |
| 在 ESM 中使用 `require()` | 用 `import` 或 `createRequire(import.meta.url)` |
| 混用两种模块系统 | 项目统一一种，互操作用工具转换 |
| 忘记 `.mjs` 扩展名又没设 `"type":"module"` | 二选一：要么设 type，要么用 `.mjs` |

---

## 七、练习题

### 🟢 入门
1. 创建一个 `math.cjs`，导出加减乘除四个函数，在另一个文件中引入使用
2. 创建一个 `str.mjs`，用 ESM 导出字符串工具函数
3. 用 `require.resolve('express')` 查看一个 npm 包的实际路径

### 🟡 进阶
4. 实现一个模块，导出一个带状态计数器（`count()`、`reset()`），验证 require 缓存机制
5. 用 `import()` 动态加载一个模块，实现插件模式
6. 在 ESM 项目中正确获取 `__dirname` 的等价路径

### 🔴 挑战
7. 实现一个简单的模块加载器：给定路径，手动读取文件并执行（模拟 require）
8. 处理 CJS 和 ESM 的循环依赖，观察两者行为差异

---

## 八、知识点总结

```
模块系统
├── CommonJS
│   ├── exports.xxx = value
│   ├── module.exports = value
│   ├── require('path')
│   ├── 缓存机制（require.cache）
│   └── 模块包装函数（function(exports, require, module, __filename, __dirname)）
├── ES Modules
│   ├── export / export default
│   ├── import / import {}
│   ├── 动态 import()（返回 Promise）
│   ├── import.meta.url
│   └── top-level await
├── 解析规则
│   ├── 核心模块：fs, http...
│   ├── 文件模块：./path
│   └── node_modules 查找
└── 互操作
    ├── CJS require ESM → 不行（同步无法加载异步）
    └── ESM import CJS → 可以（default 导出）
```

---

## 九、举一反三

| 场景 | 你学到的 | 扩展应用 |
|------|---------|---------|
| 配置文件 | `module.exports = {}` | 多环境配置（dev/prod/test） |
| 工具函数库 | 多个 export 函数 | Lodash 风格的工具库 |
| 动态加载 | `import()` 动态导入 | 插件系统、按需加载 |
| 模块缓存 | require 只执行一次 | 单例模式实现 |
| ESM __dirname | `import.meta.url` | 跨模块系统兼容的工具库 |

---

## 十、参考资料

- [Node.js Modules 官方文档](https://nodejs.org/api/modules.html)
- [ES Modules in Node.js](https://nodejs.org/api/esm.html)
- [Node.js Module Confusion — Dan Fabulich](https://redfin.engineering/node-modules-madness)
- [JavaScript Modules: A Beginner's Guide — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

---

## 十一、代码演进

### v1：CommonJS 基础导出
```javascript
// math.cjs - v1: Basic CJS exports
function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }

exports.add = add;
exports.sub = sub;
```

### v2：module.exports 重写 + 缓存验证
```javascript
// math.cjs - v2: module.exports with cache demo
const operations = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => b !== 0 ? a / b : NaN,
};

// Stateful counter to prove caching
let callCount = 0;
module.exports = {
  ...operations,
  getCallCount: () => callCount,
  _track: () => callCount++,
};
```

### v3：ESM 重写 + 动态导入
```javascript
// math.mjs - v3: ESM with dynamic import support

export const add = (a, b) => a + b;
export const sub = (a, b) => a - b;
export const mul = (a, b) => a * b;
export const div = (a, b) => b !== 0 ? a / b : NaN;

export default function calculator(a, op, b) {
  const ops = { '+': add, '-': sub, '*': mul, '/': div };
  return ops[op]?.(a, b) ?? NaN;
}

// Usage in another file:
// import calc, { add } from './math.mjs';
// const ops = await import('./math.mjs');  // dynamic
```
