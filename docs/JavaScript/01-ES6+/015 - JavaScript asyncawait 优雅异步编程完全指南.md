---
title: "015 - JavaScript async/await 优雅异步编程完全指南"
slug: "015-js-async-await"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:32:09.53+08:00"
updated_at: "2026-04-29T10:02:46.177+08:00"
reading_time: 41
tags: []
---

## 难度标注

> 🟡 **中等难度** — 需要先理解 Promise，async/await 是 Promise 的语法糖

## 概念讲解

### 什么是 async/await？

`async/await` 是 ES2017 引入的语法糖，让 Promise 链式调用看起来像同步代码：

```javascript
// Promise chain
function fetchUser(id) {
  return getUser(id)
    .then(user => getOrders(user.id))
    .then(orders => orders[0])
    .catch(err => handleError(err));
}

// async/await: reads like synchronous code
async function fetchUser(id) {
  try {
    const user = await getUser(id);
    const orders = await getOrders(user.id);
    return orders[0];
  } catch (err) {
    handleError(err);
  }
}
```

### 核心规则

1. **`async` 函数始终返回 Promise**
2. **`await` 只能在 `async` 函数内使用**（顶层 await 需 ES Module）
3. **`await` 暂停执行，直到 Promise resolve**
4. **`await` 的值是 Promise resolve 的值**

```javascript
async function example() {
  // async function always returns a Promise
  return 42; // equivalent to: return Promise.resolve(42)
}

const result = example();
console.log(result); // Promise {<fulfilled>: 42}

// To get the value:
result.then(val => console.log(val)); // 42
```

### async/await 与事件循环

```
async function flow() {
  console.log('1');          // sync
  await delay(0);
  console.log('2');          // microtask (after await)
  console.log('3');          // sync (continues after await)
}
console.log('A');
flow();
console.log('B');

// Output: A, 1, B, 2, 3
// Why: flow() starts sync, hits await, yields control
//       B runs, then microtask queue processes 2, 3
```

## 脑图

```
              async/await
                  │
      ┌───────────┼───────────┐
      │           │           │
   基础语法    错误处理     并发模式
      │           │           │
  ┌───┴───┐  ┌───┴───┐  ┌───┴────┐
  │async  │  │try/catch│  │串行    │
  │await  │  │.catch()│  │并行    │
  │返回值 │  │包装函数│  │并发限制 │
  └───────┘  └───────┘  └────────┘
```

## 完整 JS 代码

### 基础用法

```javascript
// ============ Basic async/await ============

// Simulate async API
const delay = ms => new Promise(r => setTimeout(r, ms));

const fakeFetch = (url, data, ms = 500) =>
  delay(ms).then(() => ({ url, data }));

// Sequential execution (one after another)
async function loadDashboard() {
  console.log('Loading...');
  const user = await fakeFetch('/api/user', { name: 'Alice' });
  console.log('User loaded:', user.data.name);

  const posts = await fakeFetch('/api/posts', ['Post 1', 'Post 2']);
  console.log('Posts loaded:', posts.data.length);

  const stats = await fakeFetch('/api/stats', { views: 1000 });
  console.log('Stats loaded:', stats.data.views);

  return { user, posts, stats };
}

// Return value is always a Promise
const result = loadDashboard();
console.log(result); // Promise
result.then(data => console.log('All done!', data));

// Await with non-Promise (auto-wrapped)
async function example() {
  const val = await 42;        // Promise.resolve(42)
  const arr = await [1, 2, 3]; // Promise.resolve([1,2,3])
  console.log(val, arr);
}
```

### 错误处理

```javascript
// ============ Error Handling ============

// try/catch (recommended)
async function safeFetch(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
    return null; // graceful fallback
  }
}

// Multiple catches in sequence
async function loadUserProfile(id) {
  let user, posts;
  try {
    user = await fetchUser(id);
  } catch (err) {
    console.error('User fetch failed:', err);
    user = { id, name: 'Unknown' };
  }
  try {
    posts = await fetchPosts(id);
  } catch (err) {
    console.error('Posts fetch failed:', err);
    posts = [];
  }
  return { user, posts };
}

// Wrapper function pattern (avoid try/catch everywhere)
async function wrap(promise) {
  try {
    const data = await promise;
    return [data, null];
  } catch (err) {
    return [null, err];
  }
}

// Usage: Go-style error handling
async function main() {
  const [user, userErr] = await wrap(fetchUser(1));
  if (userErr) return handleError(userErr);

  const [orders, orderErr] = await wrap(fetchOrders(user.id));
  if (orderErr) return handleError(orderErr);

  console.log('Orders:', orders);
}
```

### 并发模式

```javascript
// ============ Concurrency Patterns ============

// ❌ Sequential: 3 seconds total (waits for each)
async function slow() {
  const a = await delay(1000).then(() => 'A');
  const b = await delay(1000).then(() => 'B');
  const c = await delay(1000).then(() => 'C');
  return [a, b, c]; // takes ~3 seconds
}

// ✅ Parallel: 1 second total (all at once)
async function fast() {
  const [a, b, c] = await Promise.all([
    delay(1000).then(() => 'A'),
    delay(1000).then(() => 'B'),
    delay(1000).then(() => 'C')
  ]);
  return [a, b, c]; // takes ~1 second
}

// Parallel with individual error handling
async function resilient() {
  const results = await Promise.allSettled([
    fetch('/api/users'),
    fetch('/api/posts'),
    fetch('/api/comments')
  ]);
  const [users, posts, comments] = results.map(r => {
    if (r.status === 'fulfilled') return r.value;
    console.warn('Request failed:', r.reason);
    return null;
  });
  return { users, posts, comments };
}

// Concurrent pool with limit
async function asyncPool(limit, items, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = fn(item).then(result => {
      executing.delete(p);
      return result;
    });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// Usage: process 100 URLs, max 5 at a time
async function batchProcess(urls) {
  return asyncPool(5, urls, async (url) => {
    const res = await fetch(url);
    return res.json();
  });
}
```

### 循环中的 async/await

```javascript
// ============ Loops and Iteration ============

// Sequential: for...of (one at a time)
async function processSequentially(urls) {
  const results = [];
  for (const url of urls) {
    const res = await fetch(url);
    results.push(await res.json());
  }
  return results;
}

// Parallel: map + Promise.all (all at once)
async function processInParallel(urls) {
  return Promise.all(
    urls.map(async url => {
      const res = await fetch(url);
      return res.json();
    })
  );
}

// ❌ forEach does NOT wait for async
async function wrongForEach(urls) {
  urls.forEach(async url => {
    const res = await fetch(url); // NOT awaited by forEach!
    console.log(await res.json()); // logs out of order
  });
  console.log('Done!'); // prints BEFORE fetches complete!
}

// Filter with async
async function asyncFilter(items, predicate) {
  const results = await Promise.all(items.map(predicate));
  return items.filter((_, i) => results[i]);
}

// Usage
const activeUsers = await asyncFilter(users, async user => {
  const status = await checkStatus(user.id);
  return status.active;
});
```

### 高级模式

```javascript
// ============ Advanced Patterns ============

// Timeout wrapper
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Usage
const data = await withTimeout(fetch('/api/slow'), 5000);

// Retry with exponential backoff
async function retry(fn, { attempts = 3, delay = 1000, factor = 2 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const waitMs = delay * Math.pow(factor, i);
      console.log(`Attempt ${i + 1} failed, retrying in ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

// Usage
const result = await retry(() => fetch('/api/unstable'), { attempts: 5 });

// Memoize async function
function asyncMemoize(fn) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = await fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// Top-level await (ES Module only)
// const config = await loadConfig();
// const db = await connectDB(config);
```

## 执行预览

```
// Basic
async function greet() {
  return 'hello';
}
greet() → Promise<'hello'>

// Await pauses execution
async function demo() {
  console.log('start');
  await delay(100);
  console.log('after 100ms');
}
demo();
console.log('sync');
// Output: start → sync → after 100ms

// Sequential vs Parallel
sequential: await a, await b, await c  → 3s
parallel: await Promise.all([a,b,c])   → 1s

// Error handling
try { await failingOp() } catch(e) { /* caught */ }

// Go-style with wrap()
const [data, err] = await wrap(fetchData())
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| **async 函数返回 Promise** | 即使 return 一个普通值，也会被包装为 Promise |
| **await 只在 async 内** | 顶层 await 需要 ES Module（`type="module"`） |
| **错误会"冒泡"** | 未 catch 的错误变成 rejected Promise |
| **forEach 不等 async** | `forEach` 不等待 async 回调，用 `for...of` 代替 |
| **循环中的并行** | `map` + `Promise.all` 实现并行处理 |
| **调试更方便** | 堆栈信息比 `.then` 链更清晰 |

| 串行 vs 并行选择 | 场景 |
|----------------|------|
| **串行（await 循环）** | 有依赖关系：B 需要 A 的结果 |
| **并行（Promise.all）** | 无依赖：多个独立请求 |
| **限制并发（pool）** | 大量请求，需要控制并发数 |

## 避坑指南

### ❌ forEach 中用 await
```javascript
// ❌ Wrong: forEach doesn't await
async function loadAll(ids) {
  const results = [];
  ids.forEach(async id => {
    results.push(await fetch(id)); // NOT sequential, race conditions!
  });
  return results; // empty! forEach returned immediately
}

// ✅ Correct: use for...of for sequential
async function loadAll(ids) {
  const results = [];
  for (const id of ids) {
    results.push(await fetch(id));
  }
  return results;
}

// ✅ Or Promise.all for parallel
async function loadAll(ids) {
  return Promise.all(ids.map(id => fetch(id)));
}
```

### ❌ 不必要的串行
```javascript
// ❌ Slow: sequential when independent
async function loadPage() {
  const user = await getUser();     // 500ms
  const posts = await getPosts();   // 500ms
  const tags = await getTags();     // 500ms
  // Total: ~1500ms
}

// ✅ Fast: parallel for independent requests
async function loadPage() {
  const [user, posts, tags] = await Promise.all([
    getUser(),
    getPosts(),
    getTags()
  ]);
  // Total: ~500ms
}
```

### ❌ 忘记 await
```javascript
// ❌ Wrong: missing await, result is a Promise
async function getData() {
  const data = fetchAsync(); // missing await!
  console.log(data); // Promise {<pending>} — not the data!
}

// ✅ Correct
async function getData() {
  const data = await fetchAsync();
  console.log(data); // actual data
}
```

### ❌ try/catch 吞掉错误
```javascript
// ❌ Wrong: silently swallowing errors
async function loadUser(id) {
  try {
    return await fetchUser(id);
  } catch (err) {
    // Error lost! Nobody knows it failed.
  }
}

// ✅ Correct: at least log it
async function loadUser(id) {
  try {
    return await fetchUser(id);
  } catch (err) {
    console.error('Failed to load user:', err);
    return null; // explicit fallback
  }
}
```

## 练习题

### 🟢 入门：基本 async/await

```javascript
// 1. Convert Promise chain to async/await
fetch('/api/user')
  .then(r => r.json())
  .then(user => fetch(`/api/posts?userId=${user.id}`))
  .then(r => r.json())
  .then(posts => console.log(posts))
  .catch(err => console.error(err));

// 2. Create a delay function and use it
// wait(1000) → waits 1 second, then continues
```

### 🟡 进阶：并发与错误处理

```javascript
// 3. Load user, posts, comments in parallel
// If any fails, use null as fallback (don't let one break others)

// 4. Implement Go-style error wrapper [data, err]
// async function wrap(promise) → [data, null] or [null, error]
```

### 🔴 挑战：高级模式

```javascript
// 5. Implement a task queue that runs max N tasks concurrently
// class TaskQueue { constructor(concurrency) {} enqueue(fn) {} }
// Usage:
// const queue = new TaskQueue(3);
// queue.enqueue(() => fetch(url1));
// queue.enqueue(() => fetch(url2));
// ...

// 6. Implement retry with exponential backoff
// retry(fn, {maxRetries: 3, baseDelay: 1000})
```

<details>
<summary>📋 参考答案</summary>

```javascript
// 1
async function loadPosts() {
  try {
    const userRes = await fetch('/api/user');
    const user = await userRes.json();
    const postsRes = await fetch(`/api/posts?userId=${user.id}`);
    const posts = await postsRes.json();
    console.log(posts);
  } catch (err) {
    console.error(err);
  }
}

// 2
const wait = ms => new Promise(r => setTimeout(r, ms));
async function demo() {
  console.log('waiting...');
  await wait(1000);
  console.log('done!');
}

// 3
async function loadAll() {
  const results = await Promise.allSettled([
    fetch('/api/user').then(r => r.json()),
    fetch('/api/posts').then(r => r.json()),
    fetch('/api/comments').then(r => r.json())
  ]);
  return results.map(r => r.status === 'fulfilled' ? r.value : null);
}

// 4
async function wrap(promise) {
  try {
    const data = await promise;
    return [data, null];
  } catch (err) {
    return [null, err];
  }
}

// 5
class TaskQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.running++;
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.next();
        }
      };
      if (this.running < this.concurrency) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
  next() {
    if (this.queue.length && this.running < this.concurrency) {
      this.queue.shift()();
    }
  }
}

// 6
async function retry(fn, { maxRetries = 3, baseDelay = 1000 } = {}) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
}
```
</details>

## 知识点总结

```
async/await
├── 基础
│   ├── async 函数 → 返回 Promise
│   ├── await → 暂停直到 Promise resolve
│   ├── await 只能在 async 内使用
│   └── 顶层 await（ES Module）
├── 错误处理
│   ├── try/catch（推荐）
│   ├── Go-style: [data, err] wrapper
│   ├── catch 后可继续
│   └── 未 catch → rejected Promise
├── 并发模式
│   ├── 串行：for...of + await
│   ├── 并行：Promise.all
│   ├── 容错：Promise.allSettled
│   ├── 限制并发：asyncPool
│   └── 任务队列：TaskQueue class
├── 循环
│   ├── for...of: 串行等待 ✅
│   ├── map + Promise.all: 并行 ✅
│   ├── forEach: 不等待 ❌
│   └── async filter: map + filter
└── 高级模式
    ├── 超时: Promise.race
    ├── 重试: exponential backoff
    ├── 缓存: asyncMemoize
    └── 优雅降级: try/catch + fallback
```

## 举一反三

| 场景 | 推荐模式 | 示例 |
|------|---------|------|
| 有依赖的请求 | 串行 await | `const a = await f1(); const b = await f2(a.id)` |
| 无依赖的请求 | 并行 Promise.all | `await Promise.all([f1(), f2(), f3()])` |
| 大量请求 | 并发池 | `asyncPool(5, urls, fetch)` |
| 不稳定 API | 重试 + 退避 | `retry(fn, {maxRetries:3})` |
| 超时控制 | Promise.race | `withTimeout(fetch(url), 5000)` |
| 错误不中断 | allSettled + fallback | `[null, null, data]` |
| 简化 try/catch | Go-style wrap | `[data, err] = await wrap(fn())` |

## 参考资料

- [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN: await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
- [Async/Await 详解](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
- [JavaScript Event Loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)

## 代码演进

### v1 — 回调地狱
```javascript
getUser(id, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    render({ user, orders });
  });
});
```

### v2 — Promise 链
```javascript
getUser(id)
  .then(user => getOrders(user.id).then(orders => ({ user, orders })))
  .then(render)
  .catch(handleError);
```

### v3 — async/await
```javascript
async function loadUserPage(id) {
  try {
    const user = await getUser(id);
    const orders = await getOrders(user.id);
    render({ user, orders });
  } catch (err) {
    handleError(err);
  }
}
```

### v4 — 并行优化 + 容错
```javascript
async function loadUserPage(id) {
  const [user, orders] = await Promise.all([
    getUser(id).catch(() => null),
    getOrders(id).catch(() => [])
  ]);
  render({ user, orders });
}
```
