---
title: "001 - Koa框架入门：用洋葱模型打造优雅的Node.js应用"
slug: "001-koa-basics"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.674+08:00"
updated_at: "2026-04-29T10:02:48.013+08:00"
reading_time: 31
tags: []
---

## 难度标注

> **难度：** 🟡 中等 | **前置知识：** Node.js基础、HTTP模块、ES6+语法 | **预计耗时：** 2-3小时

---

## 概念讲解

### 什么是Koa？

Koa是由Express原班人马打造的下一代Node.js Web框架。它的核心设计理念是**优雅、简洁、富有表现力**。Koa没有绑定任何中间件，而是提供了一套轻量而强大的机制，让你像搭积木一样组装应用。

### 为什么选择Koa？

| 特性 | Express | Koa |
|------|---------|-----|
| 中间件模型 | 线性（回调） | 洋葱模型（async/await） |
| 错误处理 | 回调瀑布 | try/catch 原生捕获 |
| 体积 | 较重（内置路由等） | 极轻（仅核心） |
| 上下文对象 | req/res 分离 | ctx 统一封装 |
| 异步支持 | 回调/Promise | 原生async/await |

### 洋葱模型

Koa最核心的概念是**洋葱模型中间件**。请求从外层进入，逐层穿透到核心，响应再从核心逐层返回。

```
请求 →  [中间件A] → [中间件B] → [中间件C] → 核心
                                                    ↓
响应 ← [中间件A] ← [中间件B] ← [中间件C] ← 核心
```

关键在于 `await next()` 这一行——它把控制权交给下一个中间件，等下游全部处理完毕后，控制权才返回到当前中间件。

---

## 脑图

```
Koa框架入门
├── 核心概念
│   ├── Application (app)
│   ├── Context (ctx)
│   ├── Request (ctx.req / ctx.request)
│   └── Response (ctx.res / ctx.response)
├── 中间件机制
│   ├── app.use() 注册
│   ├── await next() 流转控制
│   ├── 洋葱模型执行顺序
│   └── 错误中间件
├── 路由
│   ├── koa-router
│   ├── RESTful 设计
│   └── 参数获取 (params / query / body)
├── 常用中间件
│   ├── koa-bodyparser (请求体解析)
│   ├── koa-static (静态文件)
│   ├── koa-logger (日志)
│   └── koa-cors (跨域)
└── 实战应用
    ├── 项目结构设计
    ├── 错误处理策略
    └── 完整API示例
```

---

## 完整代码：Koa RESTful API 服务

### 项目结构

```
koa-demo/
├── app.js            # Application entry
├── middleware/
│   ├── error.js      # Error handling middleware
│   └── logger.js     # Custom logger middleware
├── routes/
│   └── users.js      # User routes
├── package.json
└── .env
```

### 代码实现

```javascript
// app.js - Main application entry point
const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');

const app = new Koa();
const router = new Router();

// Simulated database
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
];
let nextId = 3;

// ========================================
// Middleware: Error handling (must be first)
// ========================================
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message,
    };
    // Emit error event for logging
    ctx.app.emit('error', err, ctx);
  }
});

// ========================================
// Middleware: Request logging (onion model demo)
// ========================================
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.method} ${ctx.url}`);
  
  await next(); // Pass control to next middleware
  
  const duration = Date.now() - start;
  console.log(`← ${ctx.method} ${ctx.url} ${ctx.status} ${duration}ms`);
});

// ========================================
// Middleware: Built-in plugins
// ========================================
app.use(cors());
app.use(bodyParser());

// ========================================
// Routes: CRUD operations for users
// ========================================

// GET /users - List all users
router.get('/users', (ctx) => {
  ctx.body = { success: true, data: users };
});

// GET /users/:id - Get a single user
router.get('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  
  ctx.body = { success: true, data: user };
});

// POST /users - Create a new user
router.post('/users', (ctx) => {
  const { name, email } = ctx.request.body;
  
  // Validation
  if (!name || !email) {
    const err = new Error('Name and email are required');
    err.status = 400;
    throw err;
  }
  
  const user = { id: nextId++, name, email };
  users.push(user);
  
  ctx.status = 201;
  ctx.body = { success: true, data: user };
});

// PUT /users/:id - Update a user
router.put('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  
  const { name, email } = ctx.request.body;
  users[index] = { ...users[index], name: name || users[index].name, email: email || users[index].email };
  
  ctx.body = { success: true, data: users[index] };
});

// DELETE /users/:id - Delete a user
router.delete('/users/:id', (ctx) => {
  const id = parseInt(ctx.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  
  users.splice(index, 1);
  ctx.status = 204;
});

// Register routes
app.use(router.routes());
app.use(router.allowedMethods());

// Global error event listener
app.on('error', (err, ctx) => {
  console.error(`[ERROR] ${err.status || 500}: ${err.message}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Koa server running on http://localhost:${PORT}`);
});

module.exports = app;
```

### package.json

```json
{
  "name": "koa-demo",
  "version": "1.0.0",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "koa": "^2.15.0",
    "@koa/router": "^12.0.1",
    "koa-bodyparser": "^4.4.1",
    "@koa/cors": "^5.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## 执行预览

```bash
# 启动服务
$ npm start
🚀 Koa server running on http://localhost:3000

# 创建用户
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@test.com"}'

# Response
{
  "success": true,
  "data": { "id": 3, "name": "Charlie", "email": "charlie@test.com" }
}

# 获取用户列表
$ curl http://localhost:3000/users
{
  "success": true,
  "data": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" },
    { "id": 3, "name": "Charlie", "email": "charlie@test.com" }
  ]
}

# 获取不存在的用户
$ curl http://localhost:3000/users/999
{
  "success": false,
  "message": "User not found"
}

# 服务端日志（洋葱模型效果）
→ GET /users
← GET /users 200 2ms
→ POST /users
← POST /users 201 1ms
```

---

## 注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 中间件顺序 | 错误处理必须放在最前面 | 先注册 error handler，再注册业务中间件 |
| await next() | 忘记 await 会导致洋葱断裂 | 始终使用 `await next()`，不要省略 |
| body 解析 | Koa 默认不解析请求体 | 必须安装 koa-bodyparser 并在路由前注册 |
| 错误冒泡 | 非异步错误不会被 try/catch 捕获 | 确保所有中间件使用 async/await |
| 路由匹配 | allowedMethods() 自动处理 405 | 路由注册后务必调用 `router.allowedMethods()` |
| ctx.body 赋值 | 等价于 ctx.response.body | 读用 ctx.request.body，写用 ctx.body |
| 静态文件 | Koa 不内置静态文件服务 | 需安装 koa-static 中间件 |

---

## 避坑指南

### ❌ 忘记 await next()

```javascript
// WRONG: Control flow breaks, downstream middleware skipped
app.use(async (ctx, next) => {
  console.log('A');
  next(); // Missing await!
  console.log('B'); // Executes immediately, not after downstream
});
```

### ✅ 正确使用 await next()

```javascript
// CORRECT: Proper onion model flow
app.use(async (ctx, next) => {
  console.log('A');
  await next(); // Wait for all downstream middleware
  console.log('B'); // Executes after downstream completes
});
```

### ❌ 错误处理中间件放在路由后面

```javascript
// WRONG: Route errors won't be caught
app.use(router.routes());
app.use(async (ctx, next) => {
  try { await next(); } catch(e) { /* never reached */ }
});
```

### ✅ 错误处理中间件放在最前面

```javascript
// CORRECT: Catches all downstream errors
app.use(async (ctx, next) => {
  try { await next(); } catch(e) { ctx.body = { error: e.message }; }
});
app.use(router.routes());
```

### ❌ 直接操作 ctx.res

```javascript
// WRONG: Bypasses Koa's response handling
app.use(ctx => {
  ctx.res.end('hello'); // Koa middleware may not work correctly
});
```

### ✅ 使用 ctx.body 设置响应

```javascript
// CORRECT: Koa handles response properly
app.use(ctx => {
  ctx.body = 'hello'; // Koa manages headers, status, streaming
});
```

---

## 练习题

### 🟢 基础题

1. **中间件执行顺序**：以下代码的输出顺序是什么？

```javascript
app.use(async (ctx, next) => { console.log(1); await next(); console.log(2); });
app.use(async (ctx, next) => { console.log(3); await next(); console.log(4); });
app.use(ctx => { console.log(5); ctx.body = 'done'; });
```

<details><summary>参考答案</summary>输出顺序：1 → 3 → 5 → 4 → 2（标准洋葱模型）</details>

2. **查询参数获取**：如何在 Koa 中获取 `GET /search?keyword=koa&page=2` 的参数？

<details><summary>参考答案</summary>`ctx.query.keyword` 和 `ctx.query.page`（Koa自动解析query string为对象）</details>

### 🟡 进阶题

3. **实现限流中间件**：写一个中间件，限制每个IP每分钟最多60次请求。

```javascript
// Hint: Use a Map to track request counts per IP
const requestCounts = new Map();

app.use(async (ctx, next) => {
  const ip = ctx.ip;
  // Your implementation here
  await next();
});
```

<details><summary>参考答案</summary>

```javascript
const requestCounts = new Map();
const RATE_LIMIT = 60;
const WINDOW_MS = 60 * 1000;

app.use(async (ctx, next) => {
  const ip = ctx.ip;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const requests = requestCounts.get(ip);
  // Clean up old entries
  const recent = requests.filter(t => now - t < WINDOW_MS);
  
  if (recent.length >= RATE_LIMIT) {
    ctx.status = 429;
    ctx.body = { error: 'Too many requests' };
    return;
  }
  
  recent.push(now);
  requestCounts.set(ip, recent);
  await next();
});
```

</details>

### 🔴 挑战题

4. **实现 JWT 认证中间件**：编写一个中间件，从 Authorization header 提取 JWT token 并验证，将解码后的用户信息挂载到 `ctx.state.user`。

<details><summary>参考答案</summary>

```javascript
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

app.use(async (ctx, next) => {
  // Skip auth for login/register routes
  if (ctx.path === '/login' || ctx.path === '/register') {
    return await next();
  }
  
  const auth = ctx.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    ctx.throw(401, 'No token provided');
  }
  
  try {
    const token = auth.slice(7);
    ctx.state.user = jwt.verify(token, SECRET);
    await next();
  } catch (err) {
    ctx.throw(401, 'Invalid token');
  }
});
```

</details>

---

## 知识点总结

```
Koa框架
├── 核心API
│   ├── new Koa() → 创建应用实例
│   ├── app.use(middleware) → 注册中间件
│   ├── app.listen(port) → 启动服务
│   └── app.on('error', handler) → 全局错误监听
├── Context (ctx)
│   ├── ctx.request → Koa封装的请求对象
│   ├── ctx.response → Koa封装的响应对象
│   ├── ctx.params → 路由参数
│   ├── ctx.query → 查询字符串
│   ├── ctx.request.body → 请求体(需bodyparser)
│   ├── ctx.body → 设置响应体
│   ├── ctx.status → 设置状态码
│   ├── ctx.throw(status, msg) → 抛出HTTP错误
│   └── ctx.state → 跨中间件共享数据
├── 中间件
│   ├── async (ctx, next) => {}
│   ├── await next() → 传递控制权
│   └── 洋葱模型 → 请求穿透 + 响应回穿
└── 路由 (@koa/router)
    ├── router.get/post/put/delete
    ├── router.routes() → 注册到app
    └── router.allowedMethods() → 自动405
```

---

## 举一反三

| 场景 | Koa实现方案 | 关键中间件/技术 |
|------|------------|----------------|
| 文件上传服务 | koa-body + multipart | koa-body, koa-static |
| JWT认证 | 自定义auth中间件 | jsonwebtoken, koa-jwt |
| 日志系统 | 自定义logger中间件 | winston, koa-logger |
| 请求限流 | 自定义rate-limit中间件 | Map + 时间窗口 |
| Cookie/Session | koa-session | koa-session, koa-cookie |
| 模板渲染 | koa-views | koa-views, ejs/pug |
| WebSocket | koa-websocket | ws, koa-websocket |
| API文档 |swagger集成 | koa2-swagger-ui |
| 文件流下载 | ctx.body = fs.createReadStream() | Node.js fs模块 |
| HTTPS服务 | Node.js https.createServer() | https, koa.callback() |

---

## 参考资料

- [Koa 官方文档](https://koajs.com/)
- [@koa/router GitHub](https://github.com/koajs/router)
- [Koa 中间件机制源码解析](https://github.com/koajs/koa/blob/master/lib/application.js)
- [Express vs Koa 对比](https://nodejs.org/en/learn)

---

## 代码演进

### v1: 最小Koa应用

```javascript
const Koa = require('koa');
const app = new Koa();

app.use(ctx => {
  ctx.body = 'Hello Koa!';
});

app.listen(3000);
```

### v2: 加入中间件和路由

```javascript
const Koa = require('koa');
const Router = require('@koa/router');
const app = new Koa();
const router = new Router();

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.url} ${Date.now() - start}ms`);
});

router.get('/', ctx => { ctx.body = 'Home'; });
router.get('/users', ctx => { ctx.body = []; });

app.use(router.routes());
app.listen(3000);
```

### v3: 完整RESTful API（本文最终版）

在 v2 基础上增加：
- ✅ 统一错误处理中间件
- ✅ 完整 CRUD 路由
- ✅ 请求体解析（koa-bodyparser）
- ✅ 跨域支持（@koa/cors）
- ✅ 参数校验
- ✅ 模拟数据库
- ✅ 洋葱模型请求日志

这就是从"Hello World"到生产级Koa应用的完整演进路径。
