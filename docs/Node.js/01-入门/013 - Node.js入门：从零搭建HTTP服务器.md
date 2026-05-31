---
title: "013 - Node.js入门：从零搭建HTTP服务器"
slug: "013-http-server"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.633+08:00"
updated_at: "2026-04-29T10:02:47.937+08:00"
reading_time: 23
tags: []
---

## 难度标注

> 🟢 入门级 | 预计学习时间：30分钟 | 前置知识：JavaScript基础、命令行操作

---

## 概念讲解

### 什么是HTTP服务器？

HTTP服务器就是一个**不断监听网络请求的程序**。当浏览器（客户端）发起请求时，服务器接收请求、处理逻辑、然后返回响应。这就是整个Web的运行基础。

在Node.js出现之前，搭建HTTP服务器通常需要Apache、Nginx等软件，或者Java/PHP的Web框架。而Node.js把HTTP服务器的能力直接内置到了语言标准库中，几行代码就能启动一个Web服务器。

### 核心概念：请求-响应模型

```
浏览器                    Node.js服务器
  │                          │
  │─── HTTP REQUEST ────────>│
  │    (GET /hello)          │
  │                          │ 解析请求
  │                          │ 执行业务逻辑
  │<── HTTP RESPONSE ───────│
  │    (200 OK + HTML)       │
  │                          │
```

### Node.js的http模块

Node.js内置了`http`模块，无需安装任何第三方包就能创建HTTP服务器。核心API：

- `http.createServer(callback)` — 创建服务器实例
- `server.listen(port)` — 监听指定端口
- 回调函数接收 `(req, res)` 两个对象
  - `req`（IncomingMessage）：请求信息（URL、方法、头部等）
  - `res`（ServerResponse）：响应工具（状态码、头部、内容等）

---

## 脑图（ASCII）

```
                     ┌──────────────────────┐
                     │   Node.js HTTP Server │
                     └──────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
     ┌──────┴──────┐   ┌───────┴───────┐   ┌───────┴───────┐
     │  http模块    │   │  req对象      │   │  res对象       │
     └──────┬──────┘   └───────┬───────┘   └───────┬───────┘
            │                  │                   │
    ┌───────┴───────┐  ┌──────┴──────┐    ┌───────┴───────┐
    │createServer() │  │req.url      │    │res.writeHead()│
    │listen()       │  │req.method   │    │res.end()      │
    │close()        │  │req.headers  │    │res.write()    │
    └───────────────┘  │req.on('data')│   │res.statusCode │
                       └─────────────┘    └───────────────┘
```

---

## 完整Node.js代码

### v1：最简HTTP服务器

```js
// v1-minimal.js - The simplest HTTP server in Node.js
const http = require('http');

const server = http.createServer((req, res) => {
  res.end('Hello from Node.js!');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

### v2：路由 + JSON响应 + 请求方法处理

```js
// v2-router.js - HTTP server with routing and method handling
const http = require('http');

const todos = [
  { id: 1, text: 'Learn Node.js', done: false },
  { id: 2, text: 'Build a project', done: false },
];

const server = http.createServer((req, res) => {
  // Parse URL and method
  const { method, url } = req;

  // Route: GET /todos
  if (method === 'GET' && url === '/todos') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ data: todos }));
    return;
  }

  // Route: POST /todos - create a new todo
  if (method === 'POST' && url === '/todos') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const { text } = JSON.parse(body);
      const newTodo = { id: todos.length + 1, text, done: false };
      todos.push(newTodo);
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ data: newTodo }));
    });
    return;
  }

  // Route: 404 fallback
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(3000, () => {
  console.log('Todo API running at http://localhost:3000');
});
```

### v3：模块化 + 静态文件服务

```js
// v3-modular.js - Modular server with static file serving
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIME type mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Todo data store
const todos = [
  { id: 1, text: 'Learn Node.js', done: false },
  { id: 2, text: 'Build a project', done: false },
];

// Helper: send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Helper: parse request body as JSON
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Route handler: API routes
async function handleApi(req, res) {
  const { method, url } = req;

  // GET /api/todos
  if (method === 'GET' && url === '/api/todos') {
    return sendJson(res, 200, { data: todos });
  }

  // POST /api/todos
  if (method === 'POST' && url === '/api/todos') {
    const { text } = await parseBody(req);
    const newTodo = { id: todos.length + 1, text, done: false };
    todos.push(newTodo);
    return sendJson(res, 201, { data: newTodo });
  }

  // DELETE /api/todos/:id
  if (method === 'DELETE' && url.startsWith('/api/todos/')) {
    const id = parseInt(url.split('/').pop());
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) return sendJson(res, 404, { error: 'Not found' });
    todos.splice(index, 1);
    return sendJson(res, 200, { message: 'Deleted' });
  }

  return false; // Not an API route
}

// Static file handler
function handleStatic(req, res) {
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(data);
  });
}

// Main server
const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  try {
    // Try API routes first
    const handled = await handleApi(req, res);
    if (!handled) {
      // Fall back to static files
      handleStatic(req, res);
    }
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

---

## 执行预览

```bash
$ node v2-router.js
Todo API running at http://localhost:3000

# 另一个终端
$ curl http://localhost:3000/todos
{"data":[{"id":1,"text":"Learn Node.js","done":false},{"id":2,"text":"Build a project","done":false}]}

$ curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"Write tests"}'
{"data":{"id":3,"text":"Write tests","done":false}}

$ curl http://localhost:3000/unknown
{"error":"Not Found"}
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| 端口占用 | 3000端口被占用会报`EADDRINUSE`，换端口或杀进程 |
| Content-Type | 返回HTML用`text/html`，返回JSON用`application/json` |
| 字符编码 | 中文内容记得加`charset=utf-8`，否则浏览器可能乱码 |
| req.body | Node.js的http模块不会自动解析请求体，需要手动监听`data`事件 |
| 错误处理 | `res.end()`只能调一次，多次调用会报错 |
| 端口范围 | 有效端口1-65535，1024以下需要root权限 |

---

## 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| 忘记调用`res.end()` | 每个请求路径都必须调用`res.end()`，否则请求会挂起 |
| `res.end()`调用多次 | 用`return res.end()`确保只执行一次 |
| 直接用`req.body`获取数据 | 需要监听`req.on('data')`和`req.on('end')`手动拼接 |
| 路由判断只看URL不看方法 | 同时判断`method`和`url`，否则GET/POST无法区分 |
| 异步回调中仍然访问`res` | 确保在`res.end()`前没有其他地方已经结束响应 |
| `http.createServer()`后忘了`listen()` | 两个方法都要调用，`createServer`只创建不启动 |

---

## 练习题

### 🟢 初级（理解概念）

1. 创建一个HTTP服务器，访问`/time`时返回当前服务器时间
2. 让服务器同时支持`/hello`返回"Hello"和`/bye`返回"Goodbye"

### 🟡 中级（动手实践）

3. 实现一个简单的计数器API：`GET /count`返回访问次数，每访问一次+1
4. 实现一个`POST /echo`接口，将请求体原样返回

### 🔴 高级（综合挑战）

5. 实现一个完整的RESTful API，包含CRUD操作（增删改查），数据存储在内存数组中，并实现`PUT /api/todos/:id`更新功能
6. 给v3版本添加日志中间件：记录每个请求的方法、URL、响应状态码和耗时

---

## 知识点总结（树状）

```
Node.js HTTP服务器
├── http模块
│   ├── createServer(callback) → 创建服务器
│   ├── listen(port, callback) → 监听端口
│   └── close(callback) → 关闭服务器
├── req对象（IncomingMessage）
│   ├── req.url → 请求路径
│   ├── req.method → 请求方法（GET/POST/...）
│   ├── req.headers → 请求头对象
│   └── req.on('data'/'end') → 接收请求体
├── res对象（ServerResponse）
│   ├── res.writeHead(statusCode, headers) → 写入响应头
│   ├── res.write(data) → 写入响应体（可多次）
│   ├── res.end(data) → 结束响应
│   └── res.statusCode → 设置/获取状态码
├── 路由处理
│   ├── URL匹配
│   ├── 方法判断
│   └── 404处理
└── 静态文件服务
    ├── fs.readFile()
    ├── MIME类型映射
    └── 路径安全检查
```

---

## 举一反三

| 场景 | 核心思路 | 关键API |
|------|---------|---------|
| 返回HTML页面 | 设置Content-Type为text/html | `res.writeHead(200, {'Content-Type':'text/html'})` |
| 返回JSON数据 | 对象序列化为字符串 | `JSON.stringify()` + `application/json` |
| 文件下载 | 设置Content-Disposition头 | `res.setHeader('Content-Disposition','attachment; filename=xxx')` |
| 重定向 | 设置301/302状态码+Location头 | `res.writeHead(302, {Location: '/new-url'})` |
| 处理大文件上传 | 分块接收，流式写入 | `req.on('data')` + `fs.createWriteStream()` |
| 支持CORS | 添加跨域响应头 | `res.setHeader('Access-Control-Allow-Origin','*')` |

---

## 参考资料

- [Node.js http模块官方文档](https://nodejs.org/api/http.html)
- [MDN - HTTP请求方法](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods)
- [HTTP状态码完整列表](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)

---

## 代码演进

```
v1（5行代码）─── v2（40行）─── v3（100行）
 │                │              │
最简服务器      路由+API       模块化+静态文件
单路径响应      POST解析       工具函数封装
无错误处理      JSON响应       错误处理兜底
                               MIME类型映射
```

**v1 → v2 关键变化：** 引入路由判断和请求方法区分，实现真正的API
**v2 → v3 关键变化：** 模块化拆分（handleApi/handleStatic），Promise化异步，添加静态文件服务
