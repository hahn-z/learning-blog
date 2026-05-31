---
title: "007 - Node.js 事件循环机制完全指南"
slug: "007-event-loop"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.599+08:00"
updated_at: "2026-04-29T10:02:47.888+08:00"
reading_time: 29
tags: []
---

# Node.js 事件循环机制完全指南

> **难度：** ⭐⭐⭐ 中等偏上
> **前置知识：** JavaScript 基础、回调函数、异步编程概念
> **阅读时间：** 约 25 分钟

---

## 一、概念讲解

### 什么是事件循环？

Node.js 是**单线程**的，但它能处理大量并发请求，秘密就在于**事件循环（Event Loop）**。

简单类比：想象一个餐厅的服务员，他一次只能服务一桌，但他不断在多桌之间轮转——谁点了菜就记下来，菜好了就端上去。他不需要同时站在每一桌旁边。

事件循环就是那个"服务员"，不断检查是否有待处理的回调、定时器、I/O 事件，有的话就执行，没有就等一下再检查。

### 为什么需要事件循环？

```
传统多线程模型（如 Java）：
  每个请求 → 一个线程 → 线程空闲时浪费资源 → 线程切换开销大

Node.js 事件循环模型：
  所有请求 → 单线程 + 事件循环 → I/O 等待时处理其他请求 → 高效利用 CPU
```

### 事件循环的六个阶段

```
   ┌───────────────────────────┐
┌─>│         timers             │  ← setTimeout / setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks      │  ← 系统级回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare        │  ← 内部使用（libuv）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │         poll               │  ← I/O 回调（文件读写、网络等）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │         check              │  ← setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     close callbacks        │  ← socket.on('close', ...)
│  └─────────────┬─────────────┘
│                                │
└────────────────────────────────┘
```

**各阶段详解：**

| 阶段 | 说明 | 常见 API |
|------|------|---------|
| **timers** | 执行到期的 setTimeout/setInterval 回调 | `setTimeout`, `setInterval` |
| **pending callbacks** | 推迟到下一轮循环的 I/O 回调 | TCP 连接错误等 |
| **idle, prepare** | libuv 内部使用，开发者无需关心 | — |
| **poll** | 获取新的 I/O 事件，执行 I/O 相关回调 | `fs.readFile`, `net.Server` |
| **check** | 在 poll 之后立即执行 | `setImmediate` |
| **close callbacks** | 关闭事件的回调 | `socket.destroy()` |

### 微任务（Microtasks）

除了事件循环的六个阶段，还有**微任务队列**，优先级更高：

- `process.nextTick()` — 最高优先级，每个阶段之间执行
- `Promise.then/catch/finally` — nextTick 之后执行

```
执行顺序：
  同步代码 → nextTick → Promise → 事件循环下一阶段
```

---

## 二、脑图

```
Event Loop 事件循环
├── 核心概念
│   ├── 单线程模型
│   ├── 非阻塞 I/O
│   ├── 事件驱动
│   └── libuv 引擎
├── 六个阶段
│   ├── timers (定时器)
│   ├── pending callbacks (待处理回调)
│   ├── idle/prepare (内部)
│   ├── poll (轮询) ← 核心
│   ├── check (检查)
│   └── close callbacks (关闭回调)
├── 微任务队列
│   ├── process.nextTick (最优先)
│   └── Promise (次优先)
├── 常见 API 执行顺序
│   ├── setTimeout vs setImmediate
│   ├── nextTick vs Promise
│   └── 同步 vs 异步
└── 实践要点
    ├── 不要阻塞事件循环
    ├── 合理使用 nextTick
    └── 理解 I/O 密集 vs CPU 密集
```

---

## 三、完整代码示例

### 示例 1：事件循环阶段验证

```js
// event-loop-phases.js
// Demonstrate the execution order of different event loop phases

console.log('1. Sync code starts');

// timers phase
setTimeout(() => {
  console.log('2. setTimeout (timers phase)');
}, 0);

// check phase
setImmediate(() => {
  console.log('3. setImmediate (check phase)');
});

// microtasks
process.nextTick(() => {
  console.log('4. nextTick (microtask)');
});

Promise.resolve().then(() => {
  console.log('5. Promise.then (microtask)');
});

// poll phase - I/O callback
const fs = require('fs');
fs.readFile(__filename, () => {
  console.log('6. readFile callback (poll phase)');

  // Inside I/O callback, setImmediate always runs before setTimeout
  setTimeout(() => {
    console.log('7.  inner setTimeout');
  }, 0);
  setImmediate(() => {
    console.log('8.  inner setImmediate');
  });
});

console.log('9. Sync code ends');
```

### 示例 2：微任务优先级

```js
// microtask-priority.js
// Show the priority order of microtasks

console.log('=== Microtask Priority Demo ===');

setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout'), 0);

Promise.resolve()
  .then(() => console.log('Promise 1'))
  .then(() => console.log('Promise 2'));

process.nextTick(() => console.log('nextTick 1'));
process.nextTick(() => console.log('nextTick 2'));

Promise.resolve().then(() => {
  console.log('Promise 3');
  process.nextTick(() => console.log('nextTick inside Promise'));
});

console.log('Sync end');

// Execution order:
// Sync end → nextTick 1 → nextTick 2 → Promise 1 → Promise 3 →
// nextTick inside Promise → Promise 2 → setTimeout → setImmediate
```

### 示例 3：阻塞事件循环的教训

```js
// blocking-event-loop.js
// WARNING: This shows what NOT to do

const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/fast') {
    res.end('Fast response!\n');
  } else if (req.url === '/slow') {
    // BAD: CPU-intensive work blocks the event loop
    const start = Date.now();
    while (Date.now() - start < 5000) {
      // Blocking for 5 seconds!
    }
    res.end('Slow response after 5s\n');
  }
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('Try: /fast (instant) and /slow (blocks everything)');
});
```

---

## 四、执行预览

**示例 1 运行结果：**

```
$ node event-loop-phases.js
1. Sync code starts
9. Sync code ends
4. nextTick (microtask)
5. Promise.then (microtask)
2. setTimeout (timers phase)
3. setImmediate (check phase)
6. readFile callback (poll phase)
8.  inner setImmediate
7.  inner setTimeout
```

**示例 2 运行结果：**

```
$ node microtask-priority.js
=== Microtask Priority Demo ===
Sync end
nextTick 1
nextTick 2
Promise 1
Promise 3
nextTick inside Promise
Promise 2
setTimeout
setImmediate
```

**关键观察：**
- 同步代码最先执行
- `nextTick` > `Promise` > `setTimeout` > `setImmediate`
- 在 I/O 回调内部，`setImmediate` 先于 `setTimeout`

---

## 五、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| setTimeout(fn, 0) 不是真 0ms | 浏览器最低 4ms，Node.js 默认 1ms | 不要依赖 0ms 的精确性 |
| setImmediate vs setTimeout | 在主模块中顺序不确定，I/O 回调中 setImmediate 优先 | 在 I/O 回调中用 setImmediate |
| process.nextTick 太多会饿死 | 大量 nextTick 会阻止事件循环进入下一阶段 | 控制数量，优先用 Promise |
| 不要阻塞事件循环 | CPU 密集任务会让所有请求排队 | 用 Worker Threads 或拆分任务 |
| poll 阶段的行为 | 有回调就执行，没有就等待或进入 check | 理解 poll 是核心停留点 |

---

## 六、避坑指南

### ❌ 陷阱 1：以为 setTimeout(fn, 0) 会立即执行

```js
// ❌ Wrong: Expecting immediate execution
setTimeout(() => console.log('first'), 0);
console.log('second');
// Actual output: second → first
```

```js
// ✅ Correct: Understand async scheduling
setTimeout(() => console.log('scheduled'), 0);
console.log('sync runs first');
// Always remember: sync > microtasks > macrotasks
```

### ❌ 陷阱 2：在 I/O 回调外假设 setImmediate 和 setTimeout 的顺序

```js
// ❌ Wrong: Assuming fixed order in main module
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
// Order is NON-DETERMINISTIC in main module!
```

```js
// ✅ Correct: Inside I/O callback, setImmediate always wins
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate')); // Always first!
});
```

### ❌ 陷阱 3：CPU 密集操作阻塞事件循环

```js
// ❌ Wrong: Blocking the event loop
app.get('/compute', (req, res) => {
  let sum = 0;
  for (let i = 0; i < 1e10; i++) sum += i; // Blocks everything!
  res.send({ sum });
});
```

```js
// ✅ Correct: Use Worker Threads or chunk the work
const { Worker } = require('worker_threads');
app.get('/compute', (req, res) => {
  const worker = new Worker('./compute.js');
  worker.on('message', sum => res.send({ sum }));
});
```

---

## 七、练习题

### 🟢 入门：输出顺序预测

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
process.nextTick(() => console.log('D'));
console.log('E');
```

**问题：** 请写出 A-E 的输出顺序。

<details>
<summary>参考答案</summary>

A → E → D → C → B

解析：同步代码(A, E) → nextTick(D) → Promise(C) → setTimeout(B)
</details>

### 🟡 进阶：嵌套异步顺序

```js
setTimeout(() => {
  console.log('1');
  Promise.resolve().then(() => console.log('2'));
}, 0);

Promise.resolve().then(() => {
  console.log('3');
  setTimeout(() => console.log('4'), 0);
});

console.log('5');
```

**问题：** 写出完整输出顺序。

<details>
<summary>参考答案</summary>

5 → 3 → 1 → 2 → 4

解析：同步(5) → Promise微任务(3, 注册setTimeout) → timers(1, Promise微任务2) → timers(4)
</details>

### 🔴 挑战：事件循环实战

实现一个简单的任务调度器，支持优先级：

```js
class TaskScheduler {
  constructor() {
    this.tasks = [];
  }

  addTask(fn, priority = 'normal') {
    // TODO: implement
    // priority: 'high' (nextTick), 'normal' (Promise), 'low' (setTimeout)
  }

  runAll() {
    // TODO: execute all tasks by priority
  }
}
```

<details>
<summary>参考答案</summary>

```js
class TaskScheduler {
  constructor() {
    this.highTasks = [];
    this.normalTasks = [];
    this.lowTasks = [];
  }

  addTask(fn, priority = 'normal') {
    const pool = priority === 'high' ? this.highTasks
      : priority === 'low' ? this.lowTasks
      : this.normalTasks;
    pool.push(fn);
    return this; // chainable
  }

  runAll() {
    // High priority → nextTick
    process.nextTick(() => {
      this.highTasks.forEach(fn => fn());
    });
    // Normal priority → Promise
    Promise.resolve().then(() => {
      this.normalTasks.forEach(fn => fn());
    });
    // Low priority → setTimeout
    setTimeout(() => {
      this.lowTasks.forEach(fn => fn());
    }, 0);
  }
}

// Usage
const scheduler = new TaskScheduler();
scheduler
  .addTask(() => console.log('low task'), 'low')
  .addTask(() => console.log('normal task'))
  .addTask(() => console.log('high task'), 'high')
  .runAll();
// Output: high task → normal task → low task
```
</details>

---

## 八、知识点总结

```
Event Loop
├── 1. 单线程 + 非阻塞 I/O
├── 2. 六个阶段循环
│   ├── timers → setTimeout/setInterval
│   ├── pending callbacks
│   ├── poll ← 核心 I/O 处理
│   ├── check → setImmediate
│   └── close callbacks
├── 3. 微任务优先级
│   ├── process.nextTick (最高)
│   └── Promise (次高)
├── 4. 关键规则
│   ├── 同步 > 微任务 > 宏任务
│   ├── I/O 内 setImmediate > setTimeout
│   └── 不要阻塞事件循环
└── 5. libuv
    └── 事件循环的底层实现引擎
```

---

## 九、举一反三

| 场景 | 类比理解 | 实际应用 |
|------|---------|---------|
| 餐厅服务员 | 服务员在多桌间轮转 | 事件循环处理多请求 |
| 快递分拣 | 按优先级分到不同传送带 | nextTick/Promise/setTimeout 分队列 |
| 红绿灯 | 定时切换，不阻塞其他方向 | timers 阶段的定时检查 |
| 流水线工人 | 完成一个工序就传给下一个 | poll → check → close 的阶段流转 |
| 电话排队 | VIP 客户优先接入 | 微任务优先于宏任务 |

---

## 十、参考资料

- [Node.js 官方文档 - Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [libuv 官方文档](https://docs.libuv.org/en/v1.x/design.html)
- [MDN - 并发模型与事件循环](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Event_loop)
- 《深入浅出 Node.js》— 朴灵

---

## 十一、代码演进

### v1：基础理解 — 同步 vs 异步

```js
// v1: Basic sync vs async
console.log('Start');
setTimeout(() => console.log('Timeout'), 0);
console.log('End');
// Output: Start → End → Timeout
```

### v2：进阶 — 微任务优先级

```js
// v2: Understanding microtask priority
console.log('Start');
setTimeout(() => console.log('setTimeout'), 0);
setImmediate(() => console.log('setImmediate'));
Promise.resolve().then(() => console.log('Promise'));
process.nextTick(() => console.log('nextTick'));
console.log('End');
// Output: Start → End → nextTick → Promise → setTimeout → setImmediate
```

### v3：实战 — 请求调度器

```js
// v3: Practical request scheduler using event loop knowledge
const http = require('http');

const requestQueue = {
  high: [],   // nextTick level
  normal: [], // Promise level
  low: [],    // setTimeout level
};

function scheduleRequest(handler, priority = 'normal') {
  requestQueue[priority].push(handler);
  drainQueue();
}

function drainQueue() {
  process.nextTick(() => {
    while (requestQueue.high.length) requestQueue.high.shift()();
  });
  Promise.resolve().then(() => {
    while (requestQueue.normal.length) requestQueue.normal.shift()();
  });
  setTimeout(() => {
    while (requestQueue.low.length) requestQueue.low.shift()();
  }, 0);
}

// Usage
const server = http.createServer((req, res) => {
  const priority = req.headers['x-priority'] || 'normal';
  scheduleRequest(() => res.end('Handled!\n'), priority);
});

server.listen(3000, () => console.log('Scheduler running on :3000'));
```

**演进总结：** v1 认识异步 → v2 掌握优先级 → v3 应用于实战调度。

---

*掌握事件循环，就掌握了 Node.js 异步编程的灵魂。* 🔄
