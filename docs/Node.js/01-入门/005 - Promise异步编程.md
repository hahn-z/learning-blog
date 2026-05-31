---
title: "005 - Promise异步编程"
slug: "005-promises"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.59+08:00"
updated_at: "2026-04-29T10:02:47.874+08:00"
reading_time: 19
tags: []
---

# Promise 异步编程

> **难度：** ⭐⭐⭐（中级）
> **阅读时间：** 约 18 分钟
> **前置知识：** 回调函数、异步基础

---

## 一、概念讲解

**Promise** 是异步操作的容器，代表一个"未来的值"。它有三种状态：

- **Pending（进行中）**：初始状态
- **Fulfilled（已完成）**：操作成功，值为 `resolve` 的参数
- **Rejected（已拒绝）**：操作失败，原因为 `reject` 的参数

**核心思想：** 把回调从参数形式变成了返回值形式，支持链式调用（`.then().catch()`），解决回调地狱。

**生活类比：** Promise 就像一张取餐小票——你拿到小票时餐还没好（Pending），餐好了会通知你（Fulfilled），厨房着火了也会通知你（Rejected）。

---

## 二、知识脑图

```
Promise 异步编程
├── Promise 基础
│   ├── 三种状态（Pending/Fulfilled/Rejected）
│   ├── 状态转换（不可逆）
│   └── resolve / reject
├── 核心方法
│   ├── .then(onFulfilled, onRejected)
│   ├── .catch(onRejected)
│   ├── .finally(onSettled)
│   └── 链式调用机制
├── 静态方法
│   ├── Promise.all（全部成功才成功）
│   ├── Promise.allSettled（等全部完成）
│   ├── Promise.race（取最快的一个）
│   ├── Promise.any（取第一个成功的）
│   └── Promise.resolve / Promise.reject
├── 错误处理
│   ├── catch 捕获链中任意错误
│   ├── 错误冒泡机制
│   └── unhandledRejection 事件
└── 实践模式
    ├── promisify 回调转 Promise
    ├── 串行 vs 并行
    └── Promise 池/限流
```

---

## 三、完整代码示例

### 3.1 创建与使用 Promise

```javascript
// promise-basics.js

// Create a Promise
function readFilePromise(filePath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) reject(err);       // Reject on error
      else resolve(data);          // Resolve with data
    });
  });
}

// Consume the Promise
readFilePromise(__filename)
  .then(data => {
    console.log(`Read ${data.length} chars`);
    return data.toUpperCase();     // Chain: return value for next .then
  })
  .then(upper => {
    console.log(`Upper: ${upper.substring(0, 50)}...`);
  })
  .catch(err => {
    console.error('Error:', err.message);
  })
  .finally(() => {
    console.log('Cleanup: always runs');
  });
```

### 3.2 并行与串行

```javascript
// parallel-serial.js
const fs = require('fs').promises; // Node 10+ built-in promise APIs

// Parallel: read all files at once
async function readFilesParallel(files) {
  const promises = files.map(f => fs.readFile(f, 'utf-8'));
  const results = await Promise.all(promises);
  return results;
}

// Serial: read one by one
async function readFilesSerial(files) {
  const results = [];
  for (const f of files) {
    results.push(await fs.readFile(f, 'utf-8'));
  }
  return results;
}

// Promise.all demo
Promise.all([
  fs.readFile('file1.txt', 'utf-8').catch(() => 'fallback-1'),
  fs.readFile('file2.txt', 'utf-8').catch(() => 'fallback-2'),
])
  .then(results => console.log('All done:', results))
  .catch(err => console.error('One failed:', err.message));
```

### 3.3 Promise 静态方法对比

```javascript
// static-methods.js

// Promise.all - all must succeed
Promise.all([
  Promise.resolve(1),
  Promise.resolve(2),
  Promise.resolve(3),
]).then(arr => console.log('all:', arr)); // [1, 2, 3]

// Promise.allSettled - wait for all, regardless of outcome
Promise.allSettled([
  Promise.resolve('ok'),
  Promise.reject('fail'),
  Promise.resolve('also ok'),
]).then(arr => console.log('allSettled:', arr));
// [{status:'fulfilled',value:'ok'}, {status:'rejected',reason:'fail'}, ...]

// Promise.race - first to settle wins
Promise.race([
  new Promise(r => setTimeout(() => r('slow'), 200)),
  new Promise(r => setTimeout(() => r('fast'), 50)),
]).then(val => console.log('race:', val)); // 'fast'

// Promise.any - first to succeed
Promise.any([
  Promise.reject('err1'),
  Promise.resolve('ok'),
  Promise.resolve('also ok'),
]).then(val => console.log('any:', val)); // 'ok'
```

---

## 四、执行预览

```
$ node promise-basics.js
Read 512 chars
Upper: CONST FS = REQUIRE('FS');...
Cleanup: always runs

$ node static-methods.js
all: [ 1, 2, 3 ]
allSettled: [
  { status: 'fulfilled', value: 'ok' },
  { status: 'rejected', reason: 'fail' },
  { status: 'fulfilled', value: 'also ok' }
]
race: fast
any: ok
```

---

## 五、注意事项

| 要点 | 说明 |
|------|------|
| 状态不可逆 | 从 Pending 变为 Fulfilled/Rejected 后不可再变 |
| then 返回新 Promise | 每个 `.then()` 返回新的 Promise，不是原来的 |
| 值穿透 | `.then()` 不传参数时值会穿透到下一个 |
| reject vs throw | 在 `.then()` 中 throw 等同于 reject |
| 未处理的 rejection | 会触发 `process.on('unhandledRejection')` |
| Promise.all 快速失败 | 一个 reject 则整体 reject，其余结果丢弃 |

---

## 六、避坑指南

### ❌ 坑 1：忘记 return Promise

```javascript
// ❌ Bad - forgot return, parallel becomes accidental serial
function loadUser() {
  fetch('/api/user').then(r => r.json()); // forgot return!
}
loadUser().then(user => console.log(user)); // undefined

// ✅ Good
function loadUser() {
  return fetch('/api/user').then(r => r.json());
}
```

### ❌ 坑 2：Promise 构造反模式

```javascript
// ❌ Bad - wrapping an existing Promise
function getData() {
  return new Promise((resolve, reject) => {
    fetch('/api/data')
      .then(r => resolve(r.json()))
      .catch(err => reject(err));
  });
}

// ✅ Good - just return the chain
function getData() {
  return fetch('/api/data').then(r => r.json());
}
```

### ❌ 坑 3：循环中收集结果

```javascript
// ❌ Bad - push promises but expect values
const results = [];
files.forEach(f => {
  results.push(fs.readFile(f, 'utf-8')); // push Promise, not data!
});

// ✅ Good
const results = await Promise.all(
  files.map(f => fs.readFile(f, 'utf-8'))
);
```

---

## 七、练习题

### 🟢 初级：封装回调为 Promise

将 `setTimeout` 封装为 `delay(ms)` 函数，返回 Promise，ms 毫秒后 resolve。

```javascript
function delay(ms) {
  // Your code here
}
delay(1000).then(() => console.log('1 second passed'));
```

<details>
<summary>参考答案</summary>

```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```
</details>

### 🟡 中级：超时机制

实现 `withTimeout(promise, ms)`，如果 promise 在 ms 内未完成则 reject "Timeout"。

### 🔴 高级：限流并发

实现 `promisePool(tasks, limit)`，tasks 是返回 Promise 的函数数组，最多同时执行 limit 个。

---

## 八、知识点总结

```
Promise 异步编程
├── 创建 Promise
│   ├── new Promise((resolve, reject) => {})
│   ├── Promise.resolve(value)
│   └── Promise.reject(reason)
├── 消费 Promise
│   ├── .then() → 链式处理成功
│   ├── .catch() → 统一捕获错误
│   └── .finally() → 清理逻辑
├── 组合方法
│   ├── Promise.all → 全部成功
│   ├── Promise.allSettled → 全部完成
│   ├── Promise.race → 最快的一个
│   └── Promise.any → 第一个成功
├── 关键机制
│   ├── 微任务队列（Microtask Queue）
│   ├── then 回调异步执行
│   └── 错误冒泡
└── Node.js 集成
    ├── fs.promises
    ├── util.promisify
    └── → async/await（下一章）
```

---

## 九、举一反三

| 场景 | Promise 用法 | 关键方法 |
|------|-------------|---------|
| 多文件读取 | `Promise.all(files.map(...))` | 并行加速 |
| 带超时的请求 | `Promise.race([fetch, delay])` | 超时控制 |
| 重试机制 | 递归 `.catch(() => retry())` | 指数退避 |
| 串行执行 | `array.reduce((p, item) => p.then(...))` | 顺序控制 |
| 缓存层 | 返回已有 Promise 避免重复请求 | 缓存 Promise |
| 批处理 | `Promise.allSettled` 容错 | 部分失败可接受 |

---

## 十、参考资料

- [MDN - Promise](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [Node.js fs.promises](https://nodejs.org/api/fs.html#fs_promises_api)
- [Promise 规范 - Promises/A+](https://promisesaplus.com/)

---

## 十一、代码演进

### v1：回调地狱（复习）

```javascript
fs.readFile('a.txt', 'utf-8', (err, a) => {
  if (err) return handleError(err);
  fs.readFile('b.txt', 'utf-8', (err, b) => {
    if (err) return handleError(err);
    console.log(a + b);
  });
});
```

### v2：Promise 链式调用

```javascript
const fsp = require('fs').promises;
fsp.readFile('a.txt', 'utf-8')
  .then(a => fsp.readFile('b.txt', 'utf-8').then(b => a + b))
  .then(result => console.log(result))
  .catch(err => console.error(err));
```

### v3：async/await（预告）

```javascript
const fsp = require('fs').promises;
async function main() {
  try {
    const a = await fsp.readFile('a.txt', 'utf-8');
    const b = await fsp.readFile('b.txt', 'utf-8');
    console.log(a + b);
  } catch (err) {
    console.error(err);
  }
}
main();
```

---

> **上一章：** [异步编程：回调函数](/posts/004-async-callbacks) | **下一章：** [async/await](/posts/006-async-await)
