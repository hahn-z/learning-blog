---
title: "015 - Node.js入门：Express框架从零到一"
slug: "015-express-basics"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.644+08:00"
updated_at: "2026-04-29T10:02:47.954+08:00"
reading_time: 32
tags: []
---

## 难度标注

> 🟢 入门级 | 预计学习时间：40分钟 | 前置知识：JavaScript基础、HTTP协议基础

---

## 概念讲解

### 什么是Express？

Express是Node.js最流行的Web框架，它基于内置的`http`模块，提供了更优雅的API来构建Web应用和API服务。如果`http`模块是手动挡汽车，那Express就是自动挡——底层原理一样，但开起来轻松得多。

### 为什么需要Express？

用原生`http`模块写路由，代码长这样：

```js
if (method === 'GET' && url === '/users') { ... }
else if (method === 'POST' && url === '/users') { ... }
else if (method === 'GET' && url.startsWith('/users/')) { ... }
```

Express写法：

```js
app.get('/users', handler);
app.post('/users', handler);
app.get('/users/:id', handler);
```

清晰、简洁、好维护。这就是框架的价值。

### 核心概念

| 概念 | 说明 |
|------|------|
| **路由（Routing）** | 将URL+方法映射到处理函数 |
| **中间件（Middleware）** | 请求处理流水线中的一个个处理站 |
| **请求对象（req）** | 封装了请求信息，比原生http更丰富 |
| **响应对象（res）** | 提供了send/json/render等便捷方法 |

### 中间件模型

```
请求 → [日志中间件] → [解析中间件] → [认证中间件] → [路由处理] → 响应
          │                │               │              │
        记录日志        解析body        检查token       业务逻辑
```

每个中间件可以：
- 执行代码
- 修改req/res对象
- 调用`next()`传递给下一个中间件
- 直接结束响应（不调用next）

---

## 脑图（ASCII）

```
                      ┌──────────────────────┐
                      │     Express.js        │
                      └──────────┬───────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────┴──────┐      ┌───────┴───────┐      ┌───────┴───────┐
   │  路由系统    │      │  中间件系统    │      │  请求/响应     │
   └──────┬──────┘      └───────┬───────┘      └───────┬───────┘
          │                     │                      │
   ┌──────┴──────┐      ┌──────┴──────┐       ┌───────┴───────┐
   │app.get()    │      │app.use()    │       │req.query      │
   │app.post()   │      │app.use(path)│       │req.params     │
   │app.put()    │      │第三方中间件   │       │req.body       │
   │app.delete() │      │错误中间件     │       │res.json()     │
   │app.all()    │      │router中间件  │       │res.send()     │
   └─────────────┘      └─────────────┘       │res.status()   │
                                               │res.redirect() │
                                               └───────────────┘
```

---

## 完整Node.js代码

### v1：最简Express应用

```js
// v1-minimal.js - The simplest Express app
// First: npm init -y && npm install express

const express = require('express');
const app = express();
const PORT = 3000;

// Route: home page
app.get('/', (req, res) => {
  res.send('Hello Express!');
});

// Route: return JSON
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
```

### v2：路由 + 中间件 + 请求解析

```js
// v2-routes.js - Express with routes, middleware, and body parsing
const express = require('express');
const app = express();
const PORT = 3000;

// === Middleware ===

// Built-in: parse JSON body
app.use(express.json());

// Built-in: parse URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// Custom middleware: request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// === Data Store ===
const todos = [
  { id: 1, title: 'Learn Express', done: false },
  { id: 2, title: 'Build a project', done: false },
];

// === Routes ===

// List all todos
app.get('/api/todos', (req, res) => {
  res.json({ data: todos });
});

// Get single todo
app.get('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json({ data: todo });
});

// Create todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const newTodo = {
    id: todos.length > 0 ? Math.max(...todos.map((t) => t.id)) + 1 : 1,
    title,
    done: false,
  };
  todos.push(newTodo);
  res.status(201).json({ data: newTodo });
});

// Update todo
app.put('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  const { title, done } = req.body;
  if (title !== undefined) todo.title = title;
  if (done !== undefined) todo.done = done;
  res.json({ data: todo });
});

// Delete todo
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  todos.splice(index, 1);
  res.json({ message: 'Deleted' });
});

// Query parameter example: /api/search?q=express
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  const results = todos.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
  res.json({ data: results });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Todo API running at http://localhost:${PORT}`);
});
```

### v3：模块化架构 + Router

```js
// v3-modular/app.js - Modular Express app with Router
const express = require('express');
const logger = require('./middleware/logger');
const errorGuard = require('./middleware/errorGuard');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(logger);

// Routes
app.use('/api/todos', todosRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Error handlers (must be last)
app.use(errorGuard.notFound);
app.use(errorGuard.handler);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// --------------------------------------------------
// v3-modular/middleware/logger.js
// --------------------------------------------------
// const logger = (req, res, next) => {
//   const start = Date.now();
//   res.on('finish', () => {
//     console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
//   });
//   next();
// };
// module.exports = logger;

// --------------------------------------------------
// v3-modular/middleware/errorGuard.js
// --------------------------------------------------
// const notFound = (req, res, next) => {
//   res.status(404).json({ error: `Route ${req.originalUrl} not found` });
// };
//
// const handler = (err, req, res, next) => {
//   console.error(`[${new Date().toISOString()}] Error:`, err.message);
//   const status = err.status || 500;
//   res.status(status).json({ error: err.message || 'Internal server error' });
// };
//
// module.exports = { notFound, handler };

// --------------------------------------------------
// v3-modular/routes/todos.js
// --------------------------------------------------
// const express = require('express');
// const router = express.Router();
//
// let todos = [
//   { id: 1, title: 'Learn Express', done: false },
//   { id: 2, title: 'Build a project', done: false },
// ];
//
// // GET /api/todos
// router.get('/', (req, res) => {
//   res.json({ data: todos });
// });
//
// // GET /api/todos/:id
// router.get('/:id', (req, res) => {
//   const todo = todos.find((t) => t.id === parseInt(req.params.id));
//   if (!todo) return res.status(404).json({ error: 'Not found' });
//   res.json({ data: todo });
// });
//
// // POST /api/todos
// router.post('/', (req, res) => {
//   const { title } = req.body;
//   if (!title) return res.status(400).json({ error: 'Title required' });
//   const todo = {
//     id: todos.length > 0 ? Math.max(...todos.map((t) => t.id)) + 1 : 1,
//     title, done: false,
//   };
//   todos.push(todo);
//   res.status(201).json({ data: todo });
// });
//
// // PUT /api/todos/:id
// router.put('/:id', (req, res) => {
//   const todo = todos.find((t) => t.id === parseInt(req.params.id));
//   if (!todo) return res.status(404).json({ error: 'Not found' });
//   Object.assign(todo, req.body);
//   res.json({ data: todo });
// });
//
// // DELETE /api/todos/:id
// router.delete('/:id', (req, res) => {
//   const index = todos.findIndex((t) => t.id === parseInt(req.params.id));
//   if (index === -1) return res.status(404).json({ error: 'Not found' });
//   todos.splice(index, 1);
//   res.json({ message: 'Deleted' });
// });
//
// module.exports = router;
```

---

## 执行预览

```bash
$ npm init -y && npm install express
$ node v2-routes.js
Todo API running at http://localhost:3000

# 另一个终端
$ curl http://localhost:3000/api/todos
{"data":[{"id":1,"title":"Learn Express","done":false},{"id":2,"title":"Build a project","done":false}]}

$ curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Write tests"}'
{"data":{"id":3,"title":"Write tests","done":false}}

$ curl http://localhost:3000/api/todos/1
{"data":{"id":1,"title":"Learn Express","done":false}}

$ curl http://localhost:3000/api/search?q=learn
{"data":[{"id":1,"title":"Learn Express","done":false}]}

$ curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
{"data":{"id":1,"title":"Learn Express","done":true}}

$ curl -X DELETE http://localhost:3000/api/todos/3
{"message":"Deleted"}

# Server log output:
GET /api/todos → 200 (2ms)
POST /api/todos → 201 (1ms)
GET /api/search?q=learn → 200 (1ms)
PUT /api/todos/1 → 200 (1ms)
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| 安装依赖 | Express需要`npm install express`，不是Node.js内置模块 |
| 中间件顺序 | `app.use()`的顺序很重要，错误中间件必须放在最后 |
| body解析 | Express 4.16+内置`express.json()`，不再需要`body-parser` |
| 路由参数 | `:id`通过`req.params.id`获取，自动字符串类型，需要`parseInt()` |
| 查询参数 | `?q=hello`通过`req.query.q`获取 |
| 错误中间件 | 必须有4个参数`(err, req, res, next)`，Express通过参数数量识别 |

---

## 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| `req.body`是undefined | 在路由之前添加`app.use(express.json())` |
| 中间件不调用`next()` | 每个中间件必须调用`next()`（除非要结束响应） |
| 错误中间件放在路由前面 | 错误处理中间件必须放在所有路由之后 |
| `res.json()`之后还写代码 | `res.json()`/`res.send()`会结束响应，之后的代码可能不执行 |
| `router.get('/:id')`匹配了其他路径 | 路由定义顺序很重要，具体路径放在参数路由前面 |
| 忘记`return res.status(404).json(...)` | 不return的话代码会继续执行，可能触发"headers already sent" |

---

## 练习题

### 🟢 初级（理解概念）

1. 创建一个Express应用，有3个路由：`/`返回"Home"、`/about`返回"About"、`/contact`返回"Contact"
2. 添加一个中间件，在每个请求的响应头中添加`X-Powered-By: MyExpress`

### 🟡 中级（动手实践）

3. 实现一个完整的CRUD API，管理"书签"资源（title + url），包含搜索功能
4. 写一个认证中间件：检查请求头中的`Authorization`，如果没有返回401

### 🔴 高级（综合挑战）

5. 用Router模块化重构练习3的API，拆分为routes/middleware/models三个目录
6. 实现一个简易的请求限流中间件：同一IP每分钟最多60次请求，超出返回429

---

## 知识点总结（树状）

```
Express.js
├── 基础
│   ├── express() → 创建应用实例
│   ├── app.listen(port) → 启动服务器
│   └── npm install express → 安装依赖
├── 路由
│   ├── app.get(path, handler) → GET路由
│   ├── app.post(path, handler) → POST路由
│   ├── app.put/delete/all() → 其他方法
│   ├── 路径参数 → req.params（:id）
│   └── 查询参数 → req.query（?key=value）
├── 中间件
│   ├── app.use(middleware) → 全局中间件
│   ├── app.use(path, middleware) → 路径中间件
│   ├── express.json() → 解析JSON请求体
│   ├── express.urlencoded() → 解析表单数据
│   ├── express.static() → 静态文件服务
│   └── 自定义中间件 → (req, res, next) => {}
├── 请求/响应
│   ├── req.body → 请求体
│   ├── req.params → 路径参数
│   ├── req.query → 查询参数
│   ├── req.headers → 请求头
│   ├── res.json() → JSON响应
│   ├── res.send() → 文本响应
│   ├── res.status() → 设置状态码
│   └── res.redirect() → 重定向
└── 模块化
    ├── express.Router() → 创建路由模块
    ├── 按功能拆分文件
    └── 错误处理中间件
```

---

## 举一反三

| 场景 | 核心思路 | 关键API |
|------|---------|---------|
| 静态网站 | 用express.static托管HTML/CSS/JS | `app.use(express.static('public'))` |
| REST API | JSON请求/响应 + 状态码 | `express.json()` + `res.json()` + `res.status()` |
| 表单处理 | 解析URL-encoded数据 | `express.urlencoded({ extended: true })` |
| 文件上传 | 使用multer中间件 | `const multer = require('multer')` |
| 用户认证 | JWT中间件检查token | `req.headers.authorization` + `jsonwebtoken` |
| API跨域 | 使用cors中间件 | `const cors = require('cors'); app.use(cors())` |

---

## 参考资料

- [Express.js官方文档](https://expressjs.com/)
- [Express路由指南](https://expressjs.com/en/guide/routing.html)
- [Express中间件列表](https://expressjs.com/en/resources/middleware.html)
- [MDN - HTTP状态码](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)

---

## 代码演进

```
v1（15行）──── v2（80行）──── v3（模块化）
 │              │               │
Hello World    完整CRUD API    Router拆分
单个路由       中间件+日志      中间件模块化
无请求解析     错误处理         错误守卫模块
               查询参数          独立路由文件
```

**v1 → v2 关键变化：** 引入中间件系统、完整CRUD路由、请求体解析、错误处理
**v2 → v3 关键变化：** express.Router()拆分路由、中间件独立文件、错误处理模块化、项目结构规范化
