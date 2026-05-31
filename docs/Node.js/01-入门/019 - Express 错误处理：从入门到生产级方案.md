---
title: "019 - Express 错误处理：从入门到生产级方案"
slug: "019-express-error"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.665+08:00"
updated_at: "2026-04-29T10:02:47.992+08:00"
reading_time: 28
tags: []
---

## 难度标注

> 🟡 **中级难度** | 需要掌握 Express 基础路由和中间件概念

## 概念讲解

### 什么是错误处理？

在 Express 应用中，错误处理是指捕获、记录和响应用户请求过程中发生的异常。一个没有错误处理的应用就像一辆没有刹车的车——跑得越快越危险。

Express 提供了一套**错误处理中间件**机制，它和普通中间件的区别在于拥有 **4 个参数**：`(err, req, res, next)`。

### 错误的来源

在实际项目中，错误主要来自三类：

1. **路由处理错误** — 业务逻辑中的 `throw` 或 `next(err)`
2. **同步错误** — 函数内部直接 `throw new Error()`
3. **异步错误** — `Promise` rejection、`async/await` 的异常

### Express 默认的错误处理行为

Express 自带一个默认的错误处理器，它会在没有自定义错误中间件时：
- 在开发环境返回 HTML 错误页面和堆栈信息
- 在生产环境隐藏堆栈信息

但这个默认行为对 API 项目来说并不友好——我们需要 JSON 格式的错误响应。

## 脑图

```
Express 错误处理
├── 错误来源
│   ├── 同步错误 (throw)
│   ├── 异步错误 (Promise rejection)
│   └── next(err) 显式传递
├── 错误中间件
│   ├── 四参数签名 (err, req, res, next)
│   ├── 放在所有中间件之后
│   └── 可链式使用多个
├── 错误分类
│   ├── 400 Bad Request
│   ├── 401 Unauthorized
│   ├── 404 Not Found
│   └── 500 Internal Server Error
└── 最佳实践
    ├── 自定义 Error 类
    ├── 集中式错误处理
    ├── 错误日志记录
    └── 安全的错误响应
```

## 完整代码

### v1：基础错误处理

```js
// v1-basic-error-handler.js
// Basic Express error handling with a global error middleware

const express = require('express');
const app = express();

app.use(express.json());

// A route that triggers an error
app.get('/divide', (req, res, next) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);

  if (b === 0) {
    return next(new Error('Division by zero is not allowed'));
  }

  res.json({ result: a / b });
});

// 404 handler - no route matched
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Global error handling middleware (4 parameters!)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}: ${err.message}`);

  res.status(500).json({
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(3000, () => console.log('v1 running on :3000'));
```

### v2：自定义错误类 + HTTP 状态码

```js
// v2-custom-errors.js
// Custom error classes with proper HTTP status codes

const express = require('express');
const app = express();
app.use(express.json());

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Mark as expected error
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

// Simulated database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

// GET /users/:id - find a user
app.get('/users/:id', (req, res, next) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return next(new ValidationError('User ID must be a number'));
  }

  const user = users.find(u => u.id === id);
  if (!user) {
    return next(new NotFoundError('User'));
  }

  res.json(user);
});

// POST /users - create a user with validation
app.post('/users', (req, res, next) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return next(new ValidationError('name and email are required'));
  }

  if (!email.includes('@')) {
    return next(new ValidationError('Invalid email format'));
  }

  const newUser = { id: users.length + 1, name, email };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Auth middleware example
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return next(new AuthError('Missing authorization token'));
  }
  next();
};

app.get('/profile', authMiddleware, (req, res) => {
  res.json({ message: 'Secret profile data' });
});

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Route'));
});

// Global error handler
app.use((err, req, res, next) => {
  // Default to 500 if no status code
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[${statusCode}] ${err.message}`);

  const response = {
    error: err.message,
    status: statusCode,
    timestamp: new Date().toISOString()
  };

  // Only show stack trace in development
  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

app.listen(3000, () => console.log('v2 running on :3000'));
```

### v3：生产级错误处理（含 async wrapper + 日志）

```js
// v3-production-error-handler.js
// Production-grade error handling with async wrapper and logging

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

// === Error Classes ===
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource) { super(`${resource} not found`, 404); }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

// === Async Handler Wrapper ===
// Wraps async route handlers to catch rejected promises automatically
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// === Logger ===
const logError = (err) => {
  const logEntry = {
    time: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500
  };

  // Append to error log file
  const logPath = path.join(__dirname, 'error.log');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

  // Also log to console with color
  const code = err.statusCode || 500;
  console.error(`\x1b[31m[${code}]\x1b[0m ${err.message}`);
};

// === Simulated Database ===
const db = {
  findUser: async (id) => {
    await new Promise(r => setTimeout(r, 100)); // simulate async
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    return users.find(u => u.id === id) || null;
  },

  createUser: async (data) => {
    await new Promise(r => setTimeout(r, 100));
    if (!data.name || !data.email) {
      throw new ValidationError('name and email are required');
    }
    return { id: Date.now(), ...data };
  }
};

// === Routes ===
app.get('/users/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ValidationError('ID must be a number');

  const user = await db.findUser(id);
  if (!user) throw new NotFoundError('User');

  res.json(user);
}));

app.post('/users', asyncHandler(async (req, res) => {
  const user = await db.createUser(req.body);
  res.status(201).json(user);
}));

// Trigger an unexpected error for testing
app.get('/crash', asyncHandler(async (req, res) => {
  undefinedVariable.foo; // ReferenceError!
}));

// 404
app.use((req, res, next) => {
  next(new NotFoundError('Route'));
});

// === Global Error Handler ===
app.use((err, req, res, next) => {
  logError(err);

  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;
  const isDev = process.env.NODE_ENV !== 'production';

  // Operational errors: safe to expose message
  // Programming errors: do NOT leak details
  const message = isOperational
    ? err.message
    : 'Internal Server Error';

  const response = {
    error: message,
    status: statusCode,
    timestamp: new Date().toISOString()
  };

  if (isDev) {
    response.stack = err.stack;
    response.isOperational = isOperational;
  }

  res.status(statusCode).json(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`v3 running on :${PORT} (${process.env.NODE_ENV || 'development'})`);
});
```

## 执行预览

```bash
# 启动 v3
$ node v3-production-error-handler.js
v3 running on :3000 (development)

# 正常请求
$ curl http://localhost:3000/users/1
{"id":1,"name":"Alice"}

# 用户不存在
$ curl http://localhost:3000/users/999
{"error":"User not found","status":404,"timestamp":"2025-01-15T10:30:00.000Z"}

# 参数验证失败
$ curl http://localhost:3000/users/abc
{"error":"ID must be a number","status":400,"timestamp":"2025-01-15T10:30:05.000Z"}

# 未捕获的编程错误
$ curl http://localhost:3000/crash
{"error":"Internal Server Error","status":500,"stack":"...","isOperational":false}

# 404 路由
$ curl http://localhost:3000/unknown
{"error":"Route not found","status":404,"timestamp":"2025-01-15T10:30:10.000Z"}
```

## 注意事项

| 事项 | 说明 | 严重度 |
|------|------|--------|
| 错误中间件必须 4 参数 | Express 通过参数个数识别错误中间件 | 🔴 高 |
| 放在所有路由之后 | 否则无法捕获前面的错误 | 🔴 高 |
| async 错误需要 next | Express 4 不会自动捕获 async 错误 | 🔴 高 |
| 生产环境隐藏堆栈 | 不要暴露内部实现细节 | 🟡 中 |
| 区分操作性/编程性错误 | 影响错误信息是否暴露给用户 | 🟡 中 |
| 记录错误日志 | 方便排查问题 | 🟡 中 |
| 使用 process.on 兜底 | 捕获未处理的 Promise rejection | 🟢 建议 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `app.use((err, req, res) => {})` 只有3个参数 | 必须写 4 个参数 `(err, req, res, next)`，Express 靠参数个数判断 |
| 在 async 函数中 throw 后忘记处理 | 用 `asyncHandler` 包装或 `try/catch` + `next(err)` |
| 所有错误都返回 500 | 根据错误类型返回合适的 HTTP 状态码 |
| 把错误堆栈发给用户 | 生产环境只返回友好提示，堆栈写日志 |
| `res.json()` 之后又 `next(err)` | 只选一个：要么发响应，要么传给错误中间件 |
| 不处理 unhandledRejection | 添加 `process.on('unhandledRejection')` 兜底 |
| 多个 `res.send()` / `res.json()` | 确保每个请求只发一次响应 |

## 练习题

### 🟢 入门题

1. 写一个 Express 路由，当请求参数 `age` 小于 0 或大于 150 时，返回 400 错误
2. 创建一个全局错误中间件，将所有错误统一返回 JSON 格式 `{ error, status, timestamp }`

### 🟡 进阶题

3. 实现 `asyncHandler` 高阶函数，自动捕获 async 路由中的异常并传给 `next()`
4. 创建一个 `AppError` 基类，支持自定义状态码和错误类型（`ValidationError`、`NotFoundError`、`AuthError`），并在全局中间件中根据类型区分处理

### 🔴 挑战题

5. 实现一个完整的错误处理体系：自定义错误类 + asyncHandler + 错误日志文件 + 生产/开发环境区分 + `process.on` 兜底 + 请求 ID 追踪

## 知识点总结

```
Express 错误处理
├── 错误中间件
│   ├── 签名: (err, req, res, next) — 4参数缺一不可
│   ├── 位置: 所有路由和中间件之后
│   └── 可注册多个，按顺序执行
├── 错误传递
│   ├── next(err) — 显式传递
│   ├── throw — 同步代码中自动捕获
│   └── asyncHandler — 包装异步函数自动捕获
├── 自定义错误
│   ├── AppError 基类 (message + statusCode)
│   ├── isOperational 标记可预期错误
│   └── 子类: NotFound / Validation / Auth
├── 生产环境
│   ├── 隐藏堆栈信息
│   ├── 不暴露内部错误细节
│   └── 记录到日志文件
└── 兜底机制
    ├── process.on('uncaughtException')
    └── process.on('unhandledRejection')
```

## 举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| REST API 错误 | 自定义 AppError + 全局中间件 | 统一 JSON 格式 |
| 表单验证 | ValidationError + 400 | 列出所有字段错误 |
| 数据库操作失败 | try/catch → AppError | 区分连接错误和查询错误 |
| 第三方 API 调用失败 | axios 拦截器 + AppError | 设置超时 + 重试 |
| 文件上传错误 | multer 错误处理 | LIMIT_FILE_SIZE 等 |
| JWT 认证失败 | AuthError + 401 | 区分过期和无效 |
| 限流触发 | 429 Too Many Requests | 返回 Retry-After |
| WebSocket 错误 | socket.on('error') | 断线重连机制 |

## 参考资料

- [Express 官方文档 - 错误处理](https://expressjs.com/en/guide/error-handling.html)
- [Express 常见问题 - async 错误](https://expressjs.com/en/guide/error-handling.html#catching-errors-in-async)
- [Joyent - Node.js 生产环境错误处理](https://www.joyent.com/node-js/production/design/errors)
- [MDN - HTTP 状态码](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

## 代码演进

```
v1: 基础错误中间件
├── next(err) 手动传递
├── 统一 500 响应
└── 问题: 没有状态码区分，所有错误都是 500

        ↓ 改进

v2: 自定义错误类
├── AppError 基类 (message + statusCode)
├── NotFoundError / ValidationError / AuthError
├── 全局中间件根据 statusCode 返回
└── 问题: async 错误需要手动 try/catch

        ↓ 改进

v3: 生产级方案
├── asyncHandler 包装器自动捕获
├── isOperational 区分可预期/不可预期错误
├── 错误日志记录到文件
├── 生产环境隐藏堆栈
└── process.on 兜底
```
