---
title: "008 - Node.js EventEmitter 事件系统详解"
slug: "008-events"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.605+08:00"
updated_at: "2026-04-29T10:02:47.896+08:00"
reading_time: 28
tags: []
---

# Node.js EventEmitter 事件系统详解

> **难度：** ⭐⭐ 入门偏中
> **前置知识：** JavaScript 回调函数、对象基础
> **阅读时间：** 约 20 分钟

---

## 一、概念讲解

### 什么是 EventEmitter？

Node.js 的核心设计模式是**事件驱动**，而 `EventEmitter` 是这个模式的基石。

类比：就像学校广播站——有人想广播就去登记（`on`），广播站发通知时所有登记的人都能听到（`emit`），不想听了可以取消登记（`off`）。

```js
const EventEmitter = require('events');
const emitter = new EventEmitter();

// Listen (subscribe)
emitter.on('bell', () => console.log('Class starts!'));

// Emit (publish)
emitter.emit('bell'); // Output: Class starts!
```

### 核心概念

| 概念 | 说明 | 方法 |
|------|------|------|
| **事件名** | 字符串标识，如 `'data'`, `'error'` | — |
| **监听器（Listener）** | 事件触发时执行的回调函数 | `on()`, `once()` |
| **触发（Emit）** | 手动触发一个事件 | `emit()` |
| **移除（Remove）** | 取消监听 | `off()`, `removeAllListeners()` |
| **错误处理** | 特殊事件，无监听器会抛异常 | `on('error', ...)` |

### EventEmitter 的应用场景

Node.js 内部大量使用 EventEmitter：

- `http.Server` — `request`, `connection`, `close`
- `fs.ReadStream` — `data`, `end`, `error`
- `process` — `exit`, `uncaughtException`
- `net.Socket` — `connect`, `data`, `end`

---

## 二、脑图

```
EventEmitter
├── 核心概念
│   ├── 发布-订阅模式
│   ├── 事件名 (string)
│   └── 监听器 (function)
├── 常用方法
│   ├── on(event, listener)     → 绑定
│   ├── once(event, listener)   → 一次性绑定
│   ├── emit(event, ...args)    → 触发
│   ├── off(event, listener)    → 移除
│   └── removeAllListeners()    → 全部移除
├── 高级用法
│   ├── 继承 EventEmitter
│   ├── error 事件 (特殊处理)
│   ├── newListener 事件
│   └── listenerCount / getMaxListeners
├── 实际应用
│   ├── HTTP 服务器
│   ├── Stream 流
│   └── 自定义业务事件
└── 注意事项
    ├── 内存泄漏 (maxListeners)
    ├── error 必须处理
    └── 同步执行监听器
```

---

## 三、完整代码示例

### 示例 1：基础用法

```js
// emitter-basics.js
// Basic EventEmitter usage: on, once, emit, off

const EventEmitter = require('events');
const emitter = new EventEmitter();

// Register a listener
emitter.on('greet', (name) => {
  console.log(`Hello, ${name}!`);
});

// Register a one-time listener
emitter.once('welcome', () => {
  console.log('Welcome! (This only shows once)');
});

// Emit events
emitter.emit('greet', 'Alice');
emitter.emit('greet', 'Bob');
emitter.emit('welcome');
emitter.emit('welcome'); // No output - already consumed

// Remove a specific listener
const onLog = (msg) => console.log(`Log: ${msg}`);
emitter.on('log', onLog);
emitter.emit('log', 'First message');
emitter.off('log', onLog);
emitter.emit('log', 'Second message'); // No output - removed
```

### 示例 2：自定义 EventEmitter 类

```js
// custom-emitter.js
// Create a custom class that extends EventEmitter

const EventEmitter = require('events');

class ChatRoom extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.users = new Set();
  }

  join(user) {
    this.users.add(user);
    this.emit('join', user); // Trigger event
  }

  leave(user) {
    this.users.delete(user);
    this.emit('leave', user);
  }

  send(user, message) {
    if (!this.users.has(user)) {
      this.emit('error', new Error(`${user} is not in the room`));
      return;
    }
    this.emit('message', { user, message, time: new Date() });
  }

  getOnlineUsers() {
    return [...this.users];
  }
}

// Usage
const room = new ChatRoom('Node.js Discussion');

room.on('join', (user) => console.log(`✅ ${user} joined`));
room.on('leave', (user) => console.log(`👋 ${user} left`));
room.on('message', ({ user, message, time }) => {
  console.log(`[${time.toLocaleTimeString()}] ${user}: ${message}`);
});
room.on('error', (err) => console.error(`❌ Error: ${err.message}`));

room.join('Alice');
room.join('Bob');
room.send('Alice', 'Hello everyone!');
room.send('Charlie', 'Hi!'); // Error: Charlie not in room
room.leave('Bob');
```

### 示例 3：事件总线模式

```js
// event-bus.js
// Singleton event bus for cross-module communication

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Increase limit for complex apps
  }

  // Type-safe channel helpers
  channel(name) {
    return {
      publish: (...args) => this.emit(name, ...args),
      subscribe: (fn) => {
        this.on(name, fn);
        return () => this.off(name, fn); // Return unsubscribe function
      }
    };
  }
}

// Singleton instance
const bus = new EventBus();

// Module A: Publisher
const userChannel = bus.channel('user');
setTimeout(() => {
  userChannel.publish({ id: 1, name: 'Alice', action: 'login' });
}, 1000);

// Module B: Subscriber
const unsubscribe = userChannel.subscribe((data) => {
  console.log(`User event: ${data.name} ${data.action}`);
});

// Cleanup when done
setTimeout(() => {
  unsubscribe();
  console.log('Unsubscribed');
}, 3000);
```

---

## 四、执行预览

**示例 1 运行结果：**

```
$ node emitter-basics.js
Hello, Alice!
Hello, Bob!
Welcome! (This only shows once)
Log: First message
```

**示例 2 运行结果：**

```
$ node custom-emitter.js
✅ Alice joined
✅ Bob joined
[10:30:15 AM] Alice: Hello everyone!
❌ Error: Charlie is not in the room
👋 Bob left
```

**示例 3 运行结果：**

```
$ node event-bus.js
User event: Alice login
Unsubscribed
```

---

## 五、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| error 事件 | 没有监听器时，emit('error') 会抛出异常终止进程 | 始终注册 error 监听器 |
| 监听器上限 | 默认最多 10 个，超过会警告 | 用 `setMaxListeners()` 调整，或检查是否泄漏 |
| 同步执行 | 所有监听器按注册顺序同步执行 | 不要假设异步；需要异步用 `setImmediate` 包装 |
| 内存泄漏 | 忘记移除监听器是常见泄漏源 | 用 `once` 或确保 `off` 配对 |
| 事件名冲突 | 字符串事件名容易冲突 | 用常量或 Symbol 管理事件名 |

---

## 六、避坑指南

### ❌ 陷阱 1：忘记处理 error 事件

```js
// ❌ Wrong: No error listener → process crashes
const emitter = new EventEmitter();
emitter.emit('error', new Error('Boom'));
// Throws: Unhandled 'error' event
```

```js
// ✅ Correct: Always handle errors
const emitter = new EventEmitter();
emitter.on('error', (err) => {
  console.error('Caught:', err.message);
});
emitter.emit('error', new Error('Handled gracefully'));
```

### ❌ 陷阱 2：监听器泄漏

```js
// ❌ Wrong: Adding listeners in a loop without cleanup
function handleRequest(req) {
  emitter.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  // Every request adds a new listener! Memory leak!
}
```

```js
// ✅ Correct: Use once or clean up
function handleRequest(req) {
  const handler = (chunk) => process.stdout.write(chunk);
  emitter.on('data', handler);
  emitter.once('end', () => emitter.off('data', handler));
}
```

### ❌ 陷阱 3：箭头函数导致无法 off

```js
// ❌ Wrong: Anonymous arrow function can't be removed
emitter.on('ping', () => console.log('pong'));
emitter.off('ping', () => console.log('pong')); // Does NOT remove!
// Different function reference
```

```js
// ✅ Correct: Store reference for removal
const onPing = () => console.log('pong');
emitter.on('ping', onPing);
emitter.off('ping', onPing); // Now it works!
```

---

## 七、练习题

### 🟢 入门：计数器

创建一个 EventEmitter，实现：
- `on('increment')` → 计数加 1
- `on('decrement')` → 计数减 1
- `on('count')` → 打印当前计数

<details>
<summary>参考答案</summary>

```js
const EventEmitter = require('events');
const counter = new EventEmitter();
let count = 0;

counter.on('increment', () => { count++; });
counter.on('decrement', () => { count--; });
counter.on('count', () => { console.log(`Count: ${count}`); });

counter.emit('increment');
counter.emit('increment');
counter.emit('count');    // Count: 2
counter.emit('decrement');
counter.emit('count');    // Count: 1
```
</details>

### 🟡 进阶：带超时的事件

实现一个函数 `waitFor(emitter, event, timeout)`：
- 等待事件触发，返回 Promise
- 超时未触发则 reject

<details>
<summary>参考答案</summary>

```js
function waitFor(emitter, event, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, handler);
      reject(new Error(`Timeout waiting for "${event}"`));
    }, timeout);

    const handler = (...args) => {
      clearTimeout(timer);
      resolve(args.length === 1 ? args[0] : args);
    };

    emitter.once(event, handler);
  });
}

// Usage
const ee = new EventEmitter();
setTimeout(() => ee.emit('done', 'result'), 500);
waitFor(ee, 'done', 1000).then(console.log); // 'result'
```
</details>

### 🔴 挑战：实现一个简化版 EventEmitter

不使用 `events` 模块，从零实现 `on`, `off`, `once`, `emit`。

<details>
<summary>参考答案</summary>

```js
class MyEmitter {
  constructor() {
    this._events = new Map();
  }

  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    this._events.get(event).push(listener);
    return this;
  }

  off(event, listener) {
    if (!this._events.has(event)) return this;
    const list = this._events.get(event).filter(fn => fn !== listener);
    this._events.set(event, list);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    if (!this._events.has(event)) return false;
    // Copy array to avoid mutation during iteration
    [...this._events.get(event)].forEach(fn => fn(...args));
    return true;
  }
}
```
</details>

---

## 八、知识点总结

```
EventEmitter
├── 发布-订阅模式
├── 核心方法
│   ├── on / addListener → 注册
│   ├── once → 一次性注册
│   ├── emit → 触发
│   ├── off / removeListener → 移除
│   └── removeAllListeners → 清空
├── 特殊事件
│   ├── error → 无监听则崩溃
│   ├── newListener → 监听器注册时触发
│   └── removeListener → 监听器移除时触发
├── 继承方式
│   ├── class extends EventEmitter
│   └── Object.assign / mixin
└── 实践要点
    ├── 始终处理 error
    ├── 防止内存泄漏
    └── 监听器是同步执行的
```

---

## 九、举一反三

| 模式 | EventEmitter 对应 | 生活类比 |
|------|-------------------|---------|
| 发布-订阅 | `emit` + `on` | 报纸订阅：报社发布，订户收到 |
| 观察者模式 | EventEmitter 类 | 股票行情：价格变化通知所有关注者 |
| 信号槽 | `on` = 连接信号槽 | 遥控器：按下按钮(emit)，电视响应(listener) |
| 中间件链 | 顺序注册的监听器 | 快递分拣：每站处理再传下一站 |
| Promise | `once` + 单次 emit | 叫号器：等到叫你的号，只响一次 |

---

## 十、参考资料

- [Node.js 官方文档 - Events](https://nodejs.org/api/events.html)
- [Node.js Design Patterns](https://www.nodejsdesignpatterns.com/)
- [Observer Pattern - Wikipedia](https://en.wikipedia.org/wiki/Observer_pattern)

---

## 十一、代码演进

### v1：基本使用

```js
// v1: Raw EventEmitter usage
const EventEmitter = require('events');
const ee = new EventEmitter();

ee.on('ping', () => console.log('pong'));
ee.emit('ping');
```

### v2：自定义类继承

```js
// v2: Custom class extends EventEmitter
const EventEmitter = require('events');

class Timer extends EventEmitter {
  start(seconds) {
    console.log(`Timer: ${seconds}s`);
    setTimeout(() => this.emit('done'), seconds * 1000);
  }
}

const timer = new Timer();
timer.on('done', () => console.log('Time is up!'));
timer.start(3);
```

### v3：完整事件总线

```js
// v3: Production-ready event bus with typed channels
const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // Safe emit that catches listener errors
  safeEmit(event, ...args) {
    const listeners = this.listeners(event);
    listeners.forEach(fn => {
      try { fn(...args); }
      catch (err) { this.emit('error', err); }
    });
  }

  // Awaitable event
  onceAsync(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout: ${event}`)), timeout
      );
      this.once(event, (...args) => {
        clearTimeout(timer);
        resolve(args);
      });
    });
  }
}

module.exports = new EventBus();
```

**演进总结：** v1 认识 API → v2 学会继承 → v3 生产级封装。

---

*事件驱动是 Node.js 的灵魂，EventEmitter 是理解这一切的起点。* 🎯
