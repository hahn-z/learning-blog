---
title: "016 - Express路由与中间件"
slug: "016-express-routing"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.649+08:00"
updated_at: "2026-04-29T10:02:47.964+08:00"
reading_time: 34
tags: []
---

# Express路由与中间件

> **难度标注：** ⭐⭐ 初级 | 适合有Node.js基础的开发者
> **阅读时间：** 约20分钟 | **上手时间：** 约30分钟

---

## 一、概念讲解

### 什么是路由？

路由（Routing）决定了应用程序如何响应客户端对特定端点的请求。每个路由可以有一个或多个处理函数，当路由匹配时执行。

简单来说：**路由就是 URL → 处理函数 的映射关系。**

```
客户端请求                    Express应用
GET /users        →→→→→→→    getUsers()
POST /users       →→→→→→→    createUser()
PUT /users/123    →→→→→→→    updateUser()
DELETE /users/123 →→→→→→→    deleteUser()
```

### 什么是中间件？

中间件（Middleware）是Express的核心概念。它是一个函数，可以访问请求对象（`req`）、响应对象（`res`）和下一个中间件函数（`next`）。

**中间件的执行流程像一条流水线：**

```
请求 → 中间件A → 中间件B → 中间件C → 路由处理 → 响应
         ↓          ↓          ↓
       可拦截      可修改      可终止
```

中间件能做的事：
- 执行任何代码
- 修改请求和响应对象
- 结束请求-响应周期
- 调用 `next()` 传递给下一个中间件

---

## 二、脑图（ASCII）

```
Express路由与中间件
├── 路由 (Routing)
│   ├── 基本路由
│   │   ├── app.get()
│   │   ├── app.post()
│   │   ├── app.put()
│   │   └── app.delete()
│   ├── 路由参数
│   │   ├── req.params (路径参数)
│   │   ├── req.query (查询参数)
│   │   └── req.body (请求体)
│   ├── 路由方法
│   │   ├── app.route() 链式路由
│   │   └── express.Router() 模块化路由
│   └── 路由匹配
│       ├── 精确匹配
│       ├── 模式匹配 (/users/:id)
│       └── 正则匹配
├── 中间件 (Middleware)
│   ├── 应用级中间件 (app.use)
│   ├── 路由级中间件 (router.use)
│   ├── 内置中间件
│   │   ├── express.json()
│   │   ├── express.static()
│   │   └── express.urlencoded()
│   ├── 第三方中间件
│   │   ├── morgan (日志)
│   │   ├── cors (跨域)
│   │   └── helmet (安全)
│   └── 错误处理中间件 (err, req, res, next)
└── 执行机制
    ├── 洋葱模型
    ├── next() 调用链
    └── 错误传递机制
```

---

## 三、完整代码

### v1：基础路由与中间件

```javascript
// v1-basic-routing.js - Basic routing and middleware demo
const express = require('express');
const app = express();
const PORT = 3000;

// Custom logger middleware - runs for every request
app.use((req, res, next) => {
  const start = Date.now();
  // Call next to pass control to the next middleware
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Parse JSON request body (built-in middleware)
app.use(express.json());

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Express!' });
});

app.get('/users', (req, res) => {
  // Simulate fetching users from database
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];
  res.json({ users });
});

// Route with URL parameter
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ user: { id: userId, name: 'Alice' } });
});

// POST route
app.post('/users', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  res.status(201).json({ user: { id: 3, name } });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

### v2：模块化路由 + 常用中间件

```javascript
// v2-modular-routes.js - Modular routes with Router
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Third-party middleware
app.use(morgan('dev'));      // HTTP request logger
app.use(cors());             // Enable CORS for all routes
app.use(express.json());     // Parse JSON bodies

// --- Router: users ---
const usersRouter = express.Router();

// Middleware specific to users router
usersRouter.use((req, res, next) => {
  console.log(`[Users Router] ${req.method} ${req.originalUrl}`);
  next();
});

let users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];
let nextId = 3;

// Chain route handlers for same path
usersRouter.route('/')
  .get((req, res) => {
    // Support query filtering: GET /users?name=alice
    let result = users;
    if (req.query.name) {
      result = users.filter(u =>
        u.name.toLowerCase().includes(req.query.name.toLowerCase())
      );
    }
    res.json({ users: result });
  })
  .post((req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email required' });
    }
    const user = { id: nextId++, name, email };
    users.push(user);
    res.status(201).json({ user });
  });

usersRouter.route('/:id')
  .get((req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  })
  .put((req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    Object.assign(user, req.body);
    res.json({ user });
  })
  .delete((req, res) => {
    const index = users.findIndex(u => u.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(index, 1);
    res.status(204).end();
  });

// Mount router at /users
app.use('/users', usersRouter);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'User API v2', endpoints: ['/users'] });
});

// 404 handler - catches unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware (4 parameters required)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

### v3：高级中间件模式

```javascript
// v3-advanced-middleware.js - Advanced middleware patterns
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// --- Pattern 1: Authentication middleware ---
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token || token !== 'Bearer secret-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Attach user info to request for downstream use
  req.user = { id: 1, name: 'Admin', role: 'admin' };
  next();
};

// --- Pattern 2: Role-based authorization middleware (factory) ---
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// --- Pattern 3: Async error wrapper ---
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Pattern 4: Request validation middleware (factory) ---
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && !req.body[field]) {
        errors.push(`${field} is required`);
      }
      if (rules.minLength && req.body[field]?.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
};

// --- Routes ---
let articles = [];
let articleId = 1;

// Public route - no auth needed
app.get('/', (req, res) => {
  res.json({ message: 'Article API v3' });
});

app.get('/articles', (req, res) => {
  res.json({ articles });
});

// Protected routes - auth required
app.post('/articles',
  authenticate,
  authorize('admin', 'editor'),
  validate({
    title: { required: true, minLength: 3 },
    content: { required: true, minLength: 10 }
  }),
  (req, res) => {
    const article = {
      id: articleId++,
      title: req.body.title,
      content: req.body.content,
      author: req.user.name,
      createdAt: new Date().toISOString()
    };
    articles.push(article);
    res.status(201).json({ article });
  }
);

// Route using async handler pattern
app.get('/articles/:id', asyncHandler(async (req, res) => {
  // Simulate async DB call
  await new Promise(resolve => setTimeout(resolve, 100));
  const article = articles.find(a => a.id === parseInt(req.params.id));
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json({ article });
}));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

---

## 四、执行预览

```bash
# 启动v2版本
$ node v2-modular-routes.js
Server running at http://localhost:3000

# GET 列表
$ curl http://localhost:3000/users
{"users":[{"id":1,"name":"Alice","email":"alice@example.com"},{"id":2,"name":"Bob","email":"bob@example.com"}]}

# POST 创建
$ curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie","email":"charlie@example.com"}'
{"user":{"id":3,"name":"Charlie","email":"charlie@example.com"}}

# 查询过滤
$ curl "http://localhost:3000/users?name=alice"
{"users":[{"id":1,"name":"Alice","email":"alice@example.com"}]}

# GET 单个用户
$ curl http://localhost:3000/users/1
{"user":{"id":1,"name":"Alice","email":"alice@example.com"}}

# DELETE
$ curl -X DELETE http://localhost:3000/users/2 -w "\nHTTP %{http_code}\n"
HTTP 204

# 404 处理
$ curl http://localhost:3000/unknown
{"error":"Not Found"}
```

v3版本需要认证：

```bash
# 无token访问 - 401
$ curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Hello world content"}'
{"error":"Unauthorized"}

# 带token访问 - 成功
$ curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret-token" \
  -d '{"title":"My Article","content":"This is the article content here"}'
{"article":{"id":1,"title":"My Article","content":"This is the article content here","author":"Admin","createdAt":"2026-04-29T00:00:00.000Z"}}
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 中间件顺序 | Express按注册顺序执行 | `express.json()` 放路由前，404/错误处理放最后 |
| next()调用 | 忘记调用next()会挂起请求 | 每个中间件必须调用next()或发送响应 |
| 路由参数类型 | `req.params.id` 是字符串 | 用 `parseInt()` 转换 |
| 错误处理中间件 | 必须4个参数 | 即使不用next也要声明 `(err, req, res, next)` |
| 异步错误 | 普通中间件不捕获async错误 | 用 `asyncHandler` 包装或手动 `next(err)` |
| express.json() | 不调用则 `req.body` 为 undefined | 解析body的中间件必须在路由之前 |

---

## 六、避坑指南

### ❌ 忘记调用 next()
```javascript
// ❌ 请求会永远挂起
app.use((req, res, next) => {
  console.log('Logging...');
  // Forgot to call next()!
});
```
```javascript
// ✅ 必须调用 next() 或发送响应
app.use((req, res, next) => {
  console.log('Logging...');
  next();
});
```

### ❌ 错误处理中间件参数不足
```javascript
// ❌ Express认为这是普通中间件，不是错误处理
app.use((err, req, res) => {
  res.status(500).json({ error: err.message });
});
```
```javascript
// ✅ 必须声明4个参数
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```

### ❌ 异步路由中的未捕获错误
```javascript
// ❌ async错误不会被错误处理中间件捕获
app.get('/data', async (req, res) => {
  const data = await fetchData(); // If this throws, server crashes
  res.json(data);
});
```
```javascript
// ✅ 用 try/catch 或 asyncHandler 包装
app.get('/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));
```

### ❌ 中间件顺序错误
```javascript
// ❌ 静态文件放在路由之后，路由可能先匹配
app.get('/about', (req, res) => res.send('About'));
app.use(express.static('public')); // Too late!
```
```javascript
// ✅ 静态文件和body解析放最前面
app.use(express.json());
app.use(express.static('public'));
app.get('/about', (req, res) => res.send('About'));
```

---

## 七、练习题

### 🟢 初级
1. 创建一个Express应用，包含 GET `/` 返回 "Hello World"，GET `/time` 返回当前时间
2. 编写一个中间件，记录每个请求的IP地址和User-Agent
3. 创建 GET `/greet/:name` 路由，返回 `Hello, {name}!`

### 🟡 中级
4. 使用 `express.Router()` 创建 `/api/todos` 模块化路由，支持 CRUD 操作
5. 编写一个请求耗时统计中间件，在响应头中添加 `X-Response-Time`
6. 实现一个简单的API Key认证中间件（检查 `x-api-key` 请求头）

### 🔴 高级
7. 实现一个限流中间件，每个IP每分钟最多100个请求
8. 编写一个可配置的请求校验中间件工厂函数，支持 required、type、minLength 等规则
9. 实现洋葱模型的请求计时：分别记录进入和离开每个中间件的时间戳

---

## 八、知识点总结

```
Express路由与中间件
├── 1. 路由基础
│   ├── app.METHOD(path, handler)
│   ├── req.params / req.query / req.body
│   └── app.route().get().post() 链式写法
├── 2. 模块化路由
│   ├── express.Router() 创建子路由
│   ├── router.use() 挂载子路由
│   └── 按功能拆分文件
├── 3. 中间件类型
│   ├── 应用级 app.use()
│   ├── 路由级 router.use()
│   ├── 内置 express.json() / express.static()
│   ├── 第三方 morgan / cors / helmet
│   └── 错误处理 (err, req, res, next)
├── 4. 中间件模式
│   ├── 工厂函数 → 返回中间件（authorize(roles)）
│   ├── asyncHandler → 包装异步路由
│   └── 条件中间件 → 根据路径/方法决定是否执行
└── 5. 最佳实践
    ├── 中间件顺序很重要
    ├── 永远处理错误
    ├── 验证输入数据
    └── 关注性能影响
```

---

## 九、举一反三

| 场景 | 路由设计 | 中间件选择 |
|------|----------|------------|
| 博客系统 | `/posts`, `/posts/:id`, `/categories` | auth, validate, paginate |
| 电商API | `/products`, `/orders`, `/cart` | auth, rateLimit, cache |
| 聊天应用 | `/rooms`, `/messages`, `/users` | auth, websocket upgrade |
| 文件上传 | `/upload`, `/files/:id` | multer, fileSize limit |
| 实时仪表盘 | `/metrics`, `/alerts` | auth, rateLimit, SSE |
| 多租户SaaS | `/api/:tenantId/resources` | tenantResolver, auth, quota |

---

## 十、参考资料

- [Express.js 官方文档 - Routing](https://expressjs.com/en/guide/routing.html)
- [Express.js 官方文档 - Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [Express.js API Reference](https://expressjs.com/en/4x/api.html)
- [MDN - HTTP 请求方法](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods)

---

## 十一、代码演进路线

```
v1 基础路由与中间件
├── 单文件，所有路由写在一起
├── 自定义日志中间件
├── express.json() 解析请求体
└── 适合：学习基本概念，快速原型
        ↓
v2 模块化路由
├── express.Router() 拆分路由模块
├── 第三方中间件（morgan, cors）
├── app.route() 链式写法
├── 404 + 错误处理中间件
└── 适合：中小型项目，团队协作
        ↓
v3 高级中间件模式
├── 认证中间件（authenticate）
├── 授权中间件工厂（authorize）
├── 参数校验中间件工厂（validate）
├── asyncHandler 异步错误包装
├── 中间件组合：auth → authorize → validate → handler
└── 适合：生产级API，复杂业务逻辑
```

**关键演进思路：** 从"能跑"到"好维护"到"可复用"。每一步都解决上一个版本的真实痛点。
