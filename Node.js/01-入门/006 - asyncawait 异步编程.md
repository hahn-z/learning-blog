---
title: "006 - async/await 异步编程"
slug: "006-async-await"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.595+08:00"
updated_at: "2026-04-29T10:02:47.881+08:00"
reading_time: 22
tags: []
---

# async/await 异步编程

> **难度：** ⭐⭐⭐（中级）
> **阅读时间：** 约 18 分钟
> **前置知识：** 回调函数、Promise 基础

---

## 一、概念讲解

`async/await` 是 Promise 的**语法糖**，让异步代码看起来像同步代码。它不取代 Promise，而是建立在 Promise 之上。

- `async` 函数自动返回 Promise
- `await` 暂停执行，等待 Promise 完成
- `try/catch` 捕获异步错误

**核心价值：** 可读性。把 `.then().catch()` 链变成线性的、自上而下的代码流。

**生活类比：** await 就像排队等咖啡——你站在那里等（代码暂停），拿到咖啡（Promise resolve）后继续走。但你等待时，咖啡师在服务下一个人（事件循环继续）。

---

## 二、知识脑图

```
async/await 异步编程
├── 基础语法
│   ├── async 函数声明
│   ├── await 表达式
│   ├── 返回值自动包装为 Promise
│   └── await 只在 async 函数内有效
├── 错误处理
│   ├── try/catch/finally
│   ├── 多 await 时的错误定位
│   └── 全局 unhandledRejection
├── 控制流模式
│   ├── 串行（顺序 await）
│   ├── 并行（Promise.all + await）
│   ├── 循环中的 await
│   └── 限流并发
├── 高级用法
│   ├── 顶层 await（ES2022 / ESM）
│   ├── async 迭代器 for await...of
│   ├── async 生成器函数
│   └── 中断/取消（AbortController）
└── 最佳实践
    ├── 避免 await 在循环中（需要并行时）
    ├── 始终处理错误
    └── 不要在非必要处用 async
```

---

## 三、完整代码示例

### 3.1 基础用法

```javascript
// async-await-basics.js
const fs = require('fs').promises;

// async function always returns a Promise
async function readConfig() {
  try {
    const data = await fs.readFile('package.json', 'utf-8');
    const config = JSON.parse(data);
    console.log(`Package: ${config.name} v${config.version}`);
    return config; // Automatically wrapped in Promise
  } catch (err) {
    console.error('Failed to read config:', err.message);
    throw err; // Re-throw to let caller handle
  } finally {
    console.log('Config read attempt finished');
  }
}

// Call async function
readConfig()
  .then(cfg => console.log('Success:', cfg.name))
  .catch(err => console.error('Caught outside:', err.message));
```

### 3.2 并行 vs 串行

```javascript
// parallel-vs-serial.js
const fs = require('fs').promises;

// ❌ Serial - unnecessarily slow
async function slowRead() {
  const a = await fs.readFile('file1.txt', 'utf-8');
  const b = await fs.readFile('file2.txt', 'utf-8');
  const c = await fs.readFile('file3.txt', 'utf-8');
  return [a, b, c]; // Takes sum of all 3 reads
}

// ✅ Parallel - much faster
async function fastRead() {
  const [a, b, c] = await Promise.all([
    fs.readFile('file1.txt', 'utf-8'),
    fs.readFile('file2.txt', 'utf-8'),
    fs.readFile('file3.txt', 'utf-8'),
  ]);
  return [a, b, c]; // Takes max of 3 reads
}
```

### 3.3 循环中的异步

```javascript
// loop-async.js
const fs = require('fs').promises;

// Serial: process one by one
async function processSerial(files) {
  for (const file of files) {
    const data = await fs.readFile(file, 'utf-8');
    console.log(`${file}: ${data.length} chars`);
  }
}

// Parallel: process all at once
async function processParallel(files) {
  await Promise.all(
    files.map(async (file) => {
      const data = await fs.readFile(file, 'utf-8');
      console.log(`${file}: ${data.length} chars`);
    })
  );
}

// Batch: process N at a time
async function processBatch(files, batchSize = 2) {
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (file) => {
        const data = await fs.readFile(file, 'utf-8');
        console.log(`${file}: ${data.length} chars`);
      })
    );
  }
}

// Demo
const files = ['a.txt', 'b.txt', 'c.txt', 'd.txt'];
processSerial(files)
  .then(() => console.log('--- Serial done ---'))
  .then(() => processBatch(files, 2))
  .then(() => console.log('--- Batch done ---'));
```

### 3.4 实战：带重试的 HTTP 请求

```javascript
// retry-request.js

// Generic retry wrapper using async/await
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) throw err;

      const backoff = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`Attempt ${attempt} failed, retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// Usage: simulate flaky operation
let callCount = 0;
async function flakyOperation() {
  callCount++;
  if (callCount < 3) throw new Error(`Flaky fail #${callCount}`);
  return 'Success on attempt ' + callCount;
}

withRetry(flakyOperation, 5, 100)
  .then(result => console.log('Result:', result))
  .catch(err => console.error('All retries failed:', err.message));
```

---

## 四、执行预览

```
$ node async-await-basics.js
Package: my-project v1.0.0
Config read attempt finished
Success: my-project

$ node retry-request.js
Attempt 1 failed, retrying in 100ms...
Attempt 2 failed, retrying in 200ms...
Result: Success on attempt 3
```

---

## 五、注意事项

| 要点 | 说明 |
|------|------|
| await 只能在 async 函数内 | 普通函数中用 await 会语法错误（除非顶层 await + ESM） |
| async 函数返回 Promise | `return value` 等同于 `Promise.resolve(value)` |
| await 不阻塞线程 | 它暂停的是当前 async 函数，事件循环照常运行 |
| 错误不会自动传播到外层 | 必须用 try/catch 或外层 `.catch()` 捕获 |
| forEach 中用 await 无效 | `forEach` 回调不是 async 上下文，用 `for...of` 代替 |

---

## 六、避坑指南

### ❌ 坑 1：在 forEach 中 await

```javascript
// ❌ Bad - forEach ignores async, logs in random order
[1, 2, 3].forEach(async (n) => {
  await delay(100);
  console.log(n);
});
console.log('done'); // prints FIRST!

// ✅ Good - use for...of for serial
async function processAll() {
  for (const n of [1, 2, 3]) {
    await delay(100);
    console.log(n);
  }
  console.log('done'); // prints LAST
}
```

### ❌ 坑 2：忘记 try/catch

```javascript
// ❌ Bad - unhandled rejection if file doesn't exist
async function read() {
  const data = await fs.readFile('missing.txt', 'utf-8');
  console.log(data);
}

// ✅ Good - always handle errors
async function read() {
  try {
    const data = await fs.readFile('missing.txt', 'utf-8');
    console.log(data);
  } catch (err) {
    console.error('Read failed:', err.message);
  }
}
```

### ❌ 坑 3：串行化可并行的操作

```javascript
// ❌ Bad - 3 sequential waits, total ~3s
async function slow() {
  const a = await fetch('/api/a'); // 1s
  const b = await fetch('/api/b'); // 1s
  const c = await fetch('/api/c'); // 1s
}

// ✅ Good - parallel, total ~1s
async function fast() {
  const [a, b, c] = await Promise.all([
    fetch('/api/a'),
    fetch('/api/b'),
    fetch('/api/c'),
  ]);
}
```

---

## 七、练习题

### 🟢 初级：async 函数封装

用 async/await 重写以下 Promise 链：

```javascript
function getFileSize(path) {
  return fs.promises.readFile(path, 'utf-8')
    .then(data => data.length)
    .catch(() => -1);
}
```

<details>
<summary>参考答案</summary>

```javascript
async function getFileSize(path) {
  try {
    const data = await fs.promises.readFile(path, 'utf-8');
    return data.length;
  } catch {
    return -1;
  }
}
```
</details>

### 🟡 中级：并发控制

实现 `asyncPool(limit, tasks)`，最多同时执行 limit 个异步任务，返回所有结果数组。

### 🔴 高级：异步队列

实现一个 `AsyncQueue` 类，支持 `enqueue(task)` 和 `start(concurrency)`，任务间共享并发限制，支持优先级。

---

## 八、知识点总结

```
async/await 异步编程
├── 语法
│   ├── async function → 返回 Promise
│   ├── await promise → 暂停直到 resolve
│   ├── try/catch → 捕获 rejected
│   └── 顶层 await（ESM）
├── 模式
│   ├── 串行：顺序 await
│   ├── 并行：Promise.all + await
│   ├── 批处理：循环 + Promise.all 切片
│   └── 重试：循环 + 指数退避
├── 易错点
│   ├── forEach 中 await 无效
│   ├── 忘记 try/catch
│   ├── 不必要的串行化
│   └── 返回值未 await
└── 底层
    ├── 本质是 Promise 语法糖
    ├── 微任务队列执行
    └── 生成器 + 自动执行器的简写
```

---

## 九、举一反三

| 场景 | async/await 模式 | 关键点 |
|------|-----------------|--------|
| 文件操作 | `await fs.promises.readFile()` | 使用 fs.promises API |
| HTTP 请求 | `await fetch(url)` + try/catch | 处理网络错误和状态码 |
| 数据库操作 | `await db.query(sql)` | 事务需串行 await |
| 批量导入 | `for...of` + await | 逐条处理避免内存溢出 |
| 并发爬虫 | `Promise.all` 分批 + await | 控制并发数 |
| CLI 工具 | 顶层 async IIFE | `;(async () => { ... })()` |

---

## 十、参考资料

- [MDN - async function](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN - await](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/await)
- [Node.js Async Hooks](https://nodejs.org/api/async_hooks.html)

---

## 十一、代码演进

### v1：回调（回调地狱）

```javascript
fs.readFile('a.txt', 'utf-8', (err, a) => {
  if (err) return console.error(err);
  fs.readFile('b.txt', 'utf-8', (err, b) => {
    if (err) return console.error(err);
    console.log(a + b);
  });
});
```

### v2：Promise（链式调用）

```javascript
fsp.readFile('a.txt', 'utf-8')
  .then(a => fsp.readFile('b.txt', 'utf-8').then(b => a + b))
  .then(result => console.log(result))
  .catch(err => console.error(err));
```

### v3：async/await（线性可读）

```javascript
async function concat(a, b) {
  try {
    const contentA = await fsp.readFile(a, 'utf-8');
    const contentB = await fsp.readFile(b, 'utf-8');
    console.log(contentA + contentB);
  } catch (err) {
    console.error(err);
  }
}
concat('a.txt', 'b.txt');
```

> **async/await 是异步编程的最终形态吗？** 几乎是。它让异步代码拥有了同步代码的可读性，同时保留了非阻塞的性能优势。掌握回调和 Promise 是基础，但日常开发中 async/await 才是主力。

---

> **上一章：** [Promise 异步编程](/posts/005-promises) | **系列完结**
