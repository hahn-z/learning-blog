---
title: "003 - JavaScript Promise与async/await异步编程完全指南"
slug: "003-es6-promise-async-await"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T10:26:24.562+08:00"
updated_at: "2026-04-29T10:02:46.05+08:00"
reading_time: 21
tags: ["前端"]
---


# JavaScript Promise与async/await异步编程完全指南

> **难度标注：** 🔴 高级 | **前置知识：** 函数、闭包、基本异步概念
> **阅读时间：** 约22分钟 | **代码量：** 约180行

---

## 一、概念讲解

JavaScript是**单线程**语言，通过**事件循环（Event Loop）**实现异步。异步编程经历了三个阶段：**回调 → Promise → async/await**。

### 1.1 Promise三态

- **Pending（等待中）** → **Fulfilled（已完成）** / **Rejected（已拒绝）**
- 状态一旦变更不可逆

### 1.2 async/await

`async`函数返回Promise，`await`暂停执行直到Promise settle。是Promise的**语法糖**，让异步代码看起来像同步。

### 1.3 事件循环

微任务（Promise.then）优先于宏任务（setTimeout），同一轮循环中微任务队列全部清空后才处理下一个宏任务。

---

## 二、脑图

```
                  异步编程
                 /    |    \
            回调  Promise  async/await
             |      |          |
          回调地狱  三态转换   语法糖
                  / | \       |
              then catch finally  try/catch
                |                    |
            链式调用           错误处理
                \               /
                 并发控制
              /    |    \
         all  race  allSettled  any
```

---

## 三、完整代码示例

```javascript
// ============================================
// 1. Promise basics
// ============================================
const resolveAfter = (ms, value) => new Promise(resolve => {
  setTimeout(() => resolve(value), ms);
});

const rejectAfter = (ms, reason) => new Promise((_, reject) => {
  setTimeout(() => reject(new Error(reason)), ms);
});

// Promise chain
resolveAfter(100, 1)
  .then(val => {
    console.log(`Step 1: ${val}`);
    return val + 1;
  })
  .then(val => {
    console.log(`Step 2: ${val}`);
    return val * 2;
  })
  .then(val => console.log(`Step 3: ${val}`))
  .catch(err => console.error("Caught:", err.message))
  .finally(() => console.log("Chain complete"));

// ============================================
// 2. async/await
// ============================================
async function fetchUserData(userId) {
  try {
    // Simulate API calls
    const user = await resolveAfter(50, { id: userId, name: "Alice" });
    console.log(`User: ${user.name}`);

    const posts = await resolveAfter(30, [
      { id: 1, title: "Hello" },
      { id: 2, title: "World" },
    ]);
    console.log(`Posts: ${posts.length}`);

    return { user, posts };
  } catch (error) {
    console.error("Fetch failed:", error.message);
    throw error;
  }
}

// ============================================
// 3. Concurrency patterns
// ============================================
async function concurrencyDemo() {
  // Promise.all — all must succeed
  const results = await Promise.all([
    resolveAfter(50, "A"),
    resolveAfter(30, "B"),
    resolveAfter(40, "C"),
  ]);
  console.log("all:", results); // ["A", "B", "C"] after ~50ms

  // Promise.allSettled — wait for all, regardless of outcome
  const settled = await Promise.allSettled([
    resolveAfter(20, "success"),
    rejectAfter(30, "failed"),
  ]);
  console.log("allSettled:", settled.map(r => r.status));

  // Promise.race — first to settle wins
  const winner = await Promise.race([
    resolveAfter(10, "fast"),
    resolveAfter(50, "slow"),
  ]);
  console.log("race:", winner); // "fast"

  // Promise.any — first to fulfill
  const firstOk = await Promise.any([
    rejectAfter(10, "bad"),
    resolveAfter(20, "good"),
    resolveAfter(30, "also good"),
  ]);
  console.log("any:", firstOk); // "good"
}

// ============================================
// 4. Error handling patterns
// ============================================
// Retry with exponential backoff
async function fetchWithRetry(fn, retries = 3, delay = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(`Attempt ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      await resolveAfter(delay * (2 ** i), undefined);
    }
  }
}

// Sequential vs parallel
async function sequential() {
  const start = Date.now();
  await resolveAfter(50, 1);
  await resolveAfter(50, 2);
  console.log(`Sequential: ${Date.now() - start}ms`); // ~100ms
}

async function parallel() {
  const start = Date.now();
  await Promise.all([resolveAfter(50, 1), resolveAfter(50, 2)]);
  console.log(`Parallel: ${Date.now() - start}ms`); // ~50ms
}

// ============================================
// 5. Run demos
// ============================================
(async () => {
  console.log("=== Chain ===");
  await resolveAfter(150, null); // wait for chain demo

  console.log("\n=== async/await ===");
  await fetchUserData(1);

  console.log("\n=== Concurrency ===");
  await concurrencyDemo();

  console.log("\n=== Retry ===");
  let attempt = 0;
  await fetchWithRetry(async () => {
    attempt++;
    if (attempt < 3) throw new Error("not yet");
    return "success!";
  });
  console.log("Retry result: success after 3 attempts");

  console.log("\n=== Sequential vs Parallel ===");
  await sequential();
  await parallel();
})();
```

---

## 四、执行预览

```
=== Chain ===
Step 1: 1
Step 2: 2
Step 3: 4
Chain complete

=== async/await ===
User: Alice
Posts: 2

=== Concurrency ===
all: [ 'A', 'B', 'C' ]
allSettled: [ 'fulfilled', 'rejected' ]
race: fast
any: good

=== Retry ===
Attempt 1 failed: not yet
Attempt 2 failed: not yet
Retry result: success after 3 attempts

=== Sequential vs Parallel ===
Sequential: ~100ms
Parallel: ~50ms
```

---

## 五、注意事项

| 特性 | Promise | async/await | 说明 |
|------|---------|-------------|------|
| 返回值 | `.then()`链 | 直接`await` | await更直观 |
| 错误处理 | `.catch()` | `try/catch` | 风格不同，效果一样 |
| 调试 | 较难断点 | 可断点 | await本质是同步写法 |
| 并发 | `Promise.all()` | 同 | async函数内仍需Promise.all |
| 顶层await | ❌（ES2022模块） | ✅（模块中） | 普通脚本需IIFE |

---

## 六、避坑指南

### ❌ 串行执行可并行的请求
```javascript
const a = await fetchA(); // 100ms
const b = await fetchB(); // 100ms
// Total: ~200ms (wasted!)
```
### ✅ Promise.all并行
```javascript
const [a, b] = await Promise.all([fetchA(), fetchB()]);
// Total: ~100ms
```

### ❌ 忘记catch导致未处理拒绝
```javascript
async function loadData() {
  const data = await fetch(url); // may throw
  return data.json();
}
loadData(); // unhandled rejection if fetch fails!
```
### ✅ 始终处理错误
```javascript
loadData().catch(console.error);
// or
async function safeLoadData() {
  try {
    const data = await fetch(url);
    return await data.json();
  } catch (err) {
    console.error("Failed:", err);
    return null;
  }
}
```

---

## 七、练习题

### 🟢 基础
1. 将以下回调改写为Promise版本：
```javascript
function delay(ms, callback) {
  setTimeout(() => callback("done"), ms);
}
```

### 🟡 进阶
2. 实现`promiseMap(arr, fn, concurrency)`，限制并发数为concurrency地执行异步任务。

### 🔴 挑战
3. 实现`AbortController`的简化版：一个`cancellableDelay(ms)`函数，返回Promise和cancel方法，cancel后Promise reject。

---

## 八、知识点总结

```
异步编程体系
├── 事件循环
│   ├── 调用栈 (Call Stack)
│   ├── 微任务队列 (Promise.then/MutationObserver)
│   └── 宏任务队列 (setTimeout/setInterval/I/O)
├── Promise
│   ├── 三态：pending → fulfilled/rejected
│   ├── .then()/.catch()/.finally()
│   ├── 链式调用
│   └── 静态方法：all/race/allSettled/any
├── async/await
│   ├── async函数返回Promise
│   ├── await暂停直到Promise settle
│   ├── try/catch错误处理
│   └── 顶层await (ES2022)
└── 并发控制
    ├── Promise.all (全部成功)
    ├── Promise.allSettled (全部完成)
    ├── Promise.race (最快一个)
    └── Promise.any (最快成功的)
```

---

## 九、举一反三

| 场景 | 推荐 | 原因 |
|------|------|------|
| 多API并行 | `Promise.all` | 最快完成 |
| 超时控制 | `Promise.race` | 超时则拒绝 |
| 最佳尝试 | `Promise.any` | CDN多源 |
| 批量操作 | `Promise.allSettled` | 不因单个失败放弃 |
| 重试逻辑 | async循环 + await | 清晰易读 |
| 限流 | 信号量/队列模式 | 控制并发数 |

---

## 十、参考资料

- [MDN: Promise](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [JavaScript事件循环详解](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Event_loop)

---

## 十一、代码演进

### v1: 回调地狱
```javascript
getUser(id, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      console.log(comments); // pyramid of doom
    });
  });
});
```

### v2: Promise链
```javascript
getUser(id)
  .then(user => getPosts(user.id))
  .then(posts => getComments(posts[0].id))
  .then(comments => console.log(comments))
  .catch(err => console.error(err));
```

### v3: async/await
```javascript
async function loadData(id) {
  try {
    const user = await getUser(id);
    const posts = await getPosts(user.id);
    const comments = await getComments(posts[0].id);
    return comments;
  } catch (err) {
    console.error(err);
  }
}
```

---

## 十二、总结

| 核心要点 | 说明 |
|----------|------|
| **Promise三态** | pending → fulfilled/rejected，不可逆 |
| **微任务优先** | Promise.then先于setTimeout执行 |
| **async/await** | Promise语法糖，同步写异步 |
| **并行用all** | 不要把可并行的请求串行化 |
| **错误必处理** | .catch()或try/catch，二选一 |
