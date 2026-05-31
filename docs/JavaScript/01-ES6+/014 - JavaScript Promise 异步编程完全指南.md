---
title: "014 - JavaScript Promise 异步编程完全指南"
slug: "014-js-promise"
category: "JavaScript ES6+"
tech_stack: "JavaScript"
created_at: "2026-04-26T11:32:09.519+08:00"
updated_at: "2026-04-29T10:02:46.165+08:00"
reading_time: 33
tags: []
---

## 难度标注

> 🟡 **中等难度** — 需要理解事件循环、异步执行模型

## 概念讲解

### 什么是 Promise？

Promise 是一个代表异步操作最终完成（或失败）的对象。它有三种状态：

```
Pending（进行中） ──→ Fulfilled（已完成）✅
                  ╰─→ Rejected（已拒绝）❌
```

**状态转换规则：**
- 只能从 Pending → Fulfilled 或 Pending → Rejected
- 状态一旦改变，不可逆（不可变属性）
- 没有"取消"状态

### 为什么需要 Promise？

```javascript
// Callback Hell (Pyramid of Doom)
getUser(id, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      console.log(details);
    });
  });
});

// Promise Chain (Flat and readable)
getUser(id)
  .then(user => getOrders(user.id))
  .then(orders => getOrderDetails(orders[0].id))
  .then(details => console.log(details))
  .catch(err => handleError(err));
```

## 脑图

```
              Promise
                │
    ┌───────────┼───────────┐
    │           │           │
  创建        链式调用     静态方法
    │           │           │
 ┌──┴──┐   ┌───┴───┐   ┌───┴────┐
 │new   │   │.then()│   │all()   │
 │resolve│   │.catch()│  │race()  │
 │reject│   │.finally│  │allSettled│
 └──────┘   └───────┘   │any()   │
                          └────────┘
```

## 完整 JS 代码

### 创建 Promise

```javascript
// ============ Creating Promises ============

// Basic creation
const promise = new Promise((resolve, reject) => {
  const success = true;
  if (success) {
    resolve('Operation succeeded!');
  } else {
    reject(new Error('Operation failed!'));
  }
});

// Wrapping callback-based API
function fetchUser(id) {
  return new Promise((resolve, reject) => {
    // Simulate async API call
    setTimeout(() => {
      if (id > 0) {
        resolve({ id, name: `User${id}` });
      } else {
        reject(new Error('Invalid user ID'));
      }
    }, 1000);
  });
}

// Promise.resolve / Promise.reject shortcuts
const resolved = Promise.resolve(42);        // immediately resolved
const rejected = Promise.reject('Error!');    // immediately rejected

// Promisifying Node.js callback style
const fs = require('fs');
function readFilePromise(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
```

### 链式调用

```javascript
// ============ Promise Chaining ============

// Each .then() returns a new Promise
fetchUser(1)
  .then(user => {
    console.log(user); // {id:1, name:'User1'}
    return fetchOrders(user.id); // return another Promise
  })
  .then(orders => {
    console.log(orders);
    return orders[0];
  })
  .then(order => fetchOrderDetails(order.id))
  .then(details => {
    console.log('Details:', details);
  })
  .catch(err => {
    // Catches ANY error in the chain above
    console.error('Error:', err.message);
  })
  .finally(() => {
    // Always runs, regardless of success/failure
    console.log('Cleanup done');
  });

// Transforming values in .then()
Promise.resolve(5)
  .then(x => x * 2)      // 10
  .then(x => x + 1)      // 11
  .then(x => `Result: ${x}`) // 'Result: 11'
  .then(console.log);

// Returning non-Promise values
Promise.resolve(1)
  .then(x => x + 1)           // wraps 2 in Promise.resolve(2)
  .then(x => ({ value: x }))  // wraps object
  .then(obj => console.log(obj.value)); // 2
```

### 错误处理

```javascript
// ============ Error Handling ============

// .catch() catches errors from any .then() above it
Promise.resolve('start')
  .then(() => { throw new Error('Boom!'); })
  .then(() => console.log('skipped'))   // skipped!
  .catch(err => console.error(err.message)) // 'Boom!'
  .then(() => console.log('recovered'));    // 'recovered' — catch returns resolved Promise

// Error in catch handler
Promise.resolve()
  .then(() => { throw new Error('first'); })
  .catch(() => { throw new Error('second'); })
  .catch(err => console.log(err.message)); // 'second'

// try/catch inside .then()
Promise.resolve({ a: 1 })
  .then(data => {
    try {
      JSON.parse('invalid json');
    } catch (e) {
      return { error: e.message }; // recover gracefully
    }
  })
  .then(result => console.log(result)); // {error: 'Unexpected token...'}
```

### 静态方法（并发控制）

```javascript
// ============ Promise Static Methods ============

// Promise.all(): Wait for ALL to resolve (fail-fast)
const p1 = fetch('/api/users');
const p2 = fetch('/api/posts');
const p3 = fetch('/api/comments');

Promise.all([p1, p2, p3])
  .then(([users, posts, comments]) => {
    console.log('All loaded!', users, posts, comments);
  })
  .catch(err => {
    // If ANY fails, all fail
    console.error('One failed:', err);
  });

// Promise.allSettled(): Wait for ALL, regardless of outcome
Promise.allSettled([
  Promise.resolve('ok'),
  Promise.reject('fail'),
  Promise.resolve('also ok')
]).then(results => {
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      console.log('✅', r.value);
    } else {
      console.log('❌', r.reason);
    }
  });
  // ✅ ok, ❌ fail, ✅ also ok
});

// Promise.race(): First to settle wins
Promise.race([
  fetch('/api/fast'),
  new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
])
  .then(res => console.log('Fast response'))
  .catch(err => console.log('Timeout or error'));

// Promise.any(): First SUCCESSFUL result (ignores rejects)
Promise.any([
  Promise.reject('server1 down'),
  Promise.resolve('server2 OK'),
  Promise.resolve('server3 OK')
])
  .then(first => console.log(first)) // 'server2 OK'
  .catch(err => {
    // Only fails if ALL promises reject
    console.log('All failed:', err.errors);
  });
```

### 实战：带重试和超时

```javascript
// ============ Practical Patterns ============

// Retry pattern
function fetchWithRetry(url, retries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      fetch(url)
        .then(resolve)
        .catch(err => {
          if (n <= 0) {
            reject(err);
          } else {
            console.log(`Retry ${retries - n + 1}/${retries}...`);
            setTimeout(() => attempt(n - 1), delay);
          }
        });
    }
    attempt(retries);
  });
}

// Timeout wrapper
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Sequential execution
async function sequential(urls) {
  const results = [];
  for (const url of urls) {
    results.push(await fetch(url).then(r => r.json()));
  }
  return results;
}

// Concurrent with limit
async function concurrentLimit(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = task().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
```

## 执行预览

```
// Promise states
new Promise(resolve => resolve(42))
  → Pending → Fulfilled(42)

new Promise((_, reject) => reject('err'))
  → Pending → Rejected('err')

// Chaining
Promise.resolve(1)
  .then(x => x + 1)    // 2
  .then(x => x * 3)    // 6
  .then(console.log)   // 6

// Promise.all
all([resolve(1), resolve(2), resolve(3)])
  → [1, 2, 3]

// Promise.allSettled
allSettled([resolve(1), reject('e'), resolve(3)])
  → [{status:'fulfilled',value:1},
     {status:'rejected',reason:'e'},
     {status:'fulfilled',value:3}]
```

## 注意事项

| 方法 | 行为 | 失败处理 | 返回值 |
|------|------|---------|--------|
| `Promise.all()` | 全部成功才成功 | 一个失败则全部失败 | 值数组 |
| `Promise.allSettled()` | 等待全部完成 | 永远不失败 | 结果对象数组 |
| `Promise.race()` | 第一个完成的 | 第一个失败就失败 | 第一个值 |
| `Promise.any()` | 第一个成功的 | 全部失败才失败 | 第一个成功值 |

| 注意点 | 说明 |
|--------|------|
| **executor 同步执行** | `new Promise(fn)` 中 fn 是同步执行的 |
| **.then() 微任务** | `.then` 回调放入微任务队列，异步执行 |
| **值穿透** | `.then()` 不传函数时，值会穿透到下一个 |
| **catch 位置** | 总是在链末尾放 `.catch()` |

## 避坑指南

### ❌ 忘记 return Promise
```javascript
// ❌ Wrong: forgot to return inner Promise
function getUser(id) {
  fetch(`/api/users/${id}`)
    .then(r => r.json());
  // Returns undefined, not the Promise!
}

// ✅ Correct: return the Promise chain
function getUser(id) {
  return fetch(`/api/users/${id}`)
    .then(r => r.json());
}
```

### ❌ 在 Promise 构造函数中 throw
```javascript
// ❌ Wrong: throw inside executor (works but bad practice)
new Promise(() => {
  throw new Error('fail'); // caught implicitly
});

// ✅ Correct: use reject explicitly
new Promise((resolve, reject) => {
  reject(new Error('fail'));
});
```

### ❌ Promise.all 一个失败丢失其他结果
```javascript
// ❌ Risk: one failure loses all results
Promise.all([p1, p2, p3]).catch(err => {
  // p2 and p3 results are lost!
});

// ✅ Correct: use allSettled if you need all results
Promise.allSettled([p1, p2, p3]).then(results => {
  // All results available, check .status
});
```

### ❌ 嵌套 Promise（Promise 回调地狱）
```javascript
// ❌ Wrong: nesting Promises
fetchUser(id).then(user => {
  fetchOrders(user.id).then(orders => {
    fetchDetails(orders[0].id).then(details => {
      // callback hell all over again!
    });
  });
});

// ✅ Correct: flat chain
fetchUser(id)
  .then(user => fetchOrders(user.id))
  .then(orders => fetchDetails(orders[0].id))
  .then(details => { /* clean! */ });
```

## 练习题

### 🟢 入门：基本 Promise

```javascript
// 1. Wrap setTimeout in a Promise: delay(ms) returns Promise
// delay(1000).then(() => console.log('1 second later'))

// 2. Chain: add(1,2) → multiply(result, 3) → subtract(result, 1)
// Each returns a Promise, expected result: 8
```

### 🟡 进阶：并发控制

```javascript
// 3. Load 3 APIs in parallel, render when all done
// fetch('/users'), fetch('/posts'), fetch('/comments')
// → Promise.all

// 4. Implement a simple retry(3 times, 1s interval)
// retryFn(fetchData, 3, 1000)
```

### 🔴 挑战：并发池

```javascript
// 5. Implement asyncPool(limit, tasks)
// Run at most `limit` tasks concurrently
// asyncPool(2, [t1,t2,t3,t4,t5]) → max 2 running at a time
```

<details>
<summary>📋 参考答案</summary>

```javascript
// 1
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 2
const add = (a, b) => Promise.resolve(a + b);
const multiply = (a, b) => Promise.resolve(a * b);
const subtract = (a, b) => Promise.resolve(a - b);
add(1, 2)
  .then(r => multiply(r, 3))
  .then(r => subtract(r, 1))
  .then(console.log); // 8

// 3
Promise.all([
  fetch('/users').then(r => r.json()),
  fetch('/posts').then(r => r.json()),
  fetch('/comments').then(r => r.json())
]).then(([users, posts, comments]) => render(users, posts, comments));

// 4
function retryFn(fn, retries, delayMs) {
  return fn().catch(err => {
    if (retries <= 0) throw err;
    return new Promise(r => setTimeout(r, delayMs))
      .then(() => retryFn(fn, retries - 1, delayMs));
  });
}

// 5
async function asyncPool(limit, tasks) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = task().then(r => { executing.delete(p); return r; });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}
```
</details>

## 知识点总结

```
Promise
├── 基础
│   ├── 三种状态: pending → fulfilled/rejected
│   ├── new Promise((resolve, reject) => {})
│   └── 状态不可逆
├── 链式调用
│   ├── .then(onFulfilled, onRejected)
│   ├── .catch(onRejected)
│   ├── .finally(onSettled)
│   └── 每个 .then 返回新 Promise
├── 静态方法
│   ├── all() — 全部成功
│   ├── allSettled() — 全部完成
│   ├── race() — 最快的
│   ├── any() — 第一个成功
│   ├── resolve() — 快捷创建
│   └── reject() — 快捷创建
├── 错误处理
│   ├── .catch() 捕获链中任何错误
│   ├── catch 后可继续 .then()
│   └── 未捕获 → UnhandledPromiseRejection
└── 实战模式
    ├── 重试模式
    ├── 超时包装
    ├── 并发限制池
    └── 顺序执行
```

## 举一反三

| 场景 | 方案 | 方法 |
|------|------|------|
| 并行请求 | Promise.all | `Promise.all([p1, p2, p3])` |
| 超时控制 | Promise.race | `Promise.race([request, timeout(ms)])` |
| 重试机制 | 递归 + catch | `fn().catch(() => retry(fn, n-1))` |
| 批量不丢结果 | Promise.allSettled | `allSettled(tasks).then(check)` |
| 缓存 Promise | 存储引用 | `const cached = fetch(url); cached.then(...)` |
| 链式数据流 | return + .then | `fetch().then(parse).then(transform)` |

## 参考资料

- [MDN: Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [MDN: Using Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [Promise Anti-patterns](https://github.com/petkaantonov/bluebird/wiki/Promise-anti-patterns)
- [JavaScript 异步编程](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous)

## 代码演进

### v1 — 回调地狱
```javascript
getUser(id, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      render(details);
    });
  });
});
```

### v2 — Promise 链式调用
```javascript
getUser(id)
  .then(user => getOrders(user.id))
  .then(orders => getOrderDetails(orders[0].id))
  .then(render)
  .catch(handleError);
```

### v3 — async/await（下篇详解）
```javascript
async function loadDetails(id) {
  try {
    const user = await getUser(id);
    const orders = await getOrders(user.id);
    const details = await getOrderDetails(orders[0].id);
    render(details);
  } catch (err) {
    handleError(err);
  }
}
```
