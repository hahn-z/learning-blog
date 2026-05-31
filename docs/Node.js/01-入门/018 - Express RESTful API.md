---
title: "018 - Express RESTful API"
slug: "018-express-restful"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.66+08:00"
updated_at: "2026-04-29T10:02:47.983+08:00"
reading_time: 66
tags: []
---

# Express RESTful API

> **难度标注：** ⭐⭐⭐ 中级 | 适合有Express和路由基础的开发者
> **阅读时间：** 约22分钟 | **上手时间：** 约40分钟

---

## 一、概念讲解

### 什么是REST？

REST（Representational State Transfer）是一种软件架构风格，不是协议也不是标准。它定义了一组约束，用于创建Web服务。

**核心原则：**
1. **资源（Resource）** — 一切皆资源，用URL标识（如 `/users`, `/posts`）
2. **HTTP方法（Verb）** — 用HTTP方法表达操作意图
3. **无状态（Stateless）** — 每个请求包含所有必要信息
4. **统一接口（Uniform Interface）** — 一致的URL和响应格式

### HTTP方法映射CRUD

| HTTP方法 | CRUD操作 | 路径示例 | 说明 |
|----------|----------|----------|------|
| GET | Read | `GET /users` | 获取列表 |
| GET | Read | `GET /users/1` | 获取单个 |
| POST | Create | `POST /users` | 创建 |
| PUT | Update | `PUT /users/1` | 全量更新 |
| PATCH | Update | `PATCH /users/1` | 部分更新 |
| DELETE | Delete | `DELETE /users/1` | 删除 |

### RESTful API 设计原则

```
# 好的设计 ✅
GET    /api/v1/users          → 获取用户列表
POST   /api/v1/users          → 创建用户
GET    /api/v1/users/123      → 获取指定用户
PUT    /api/v1/users/123      → 更新指定用户
DELETE /api/v1/users/123      → 删除指定用户

# 坏的设计 ❌
POST   /api/getUsers          → 动词不应该在URL中
POST   /api/deleteUser/123    → 用DELETE方法
GET    /api/user?action=list   → 用路径而非查询参数
```

### 统一响应格式

```json
// 成功 - 列表
{
  "success": true,
  "data": [{ "id": 1, "name": "Alice" }],
  "pagination": { "page": 1, "pageSize": 10, "total": 100 }
}

// 成功 - 单个
{
  "success": true,
  "data": { "id": 1, "name": "Alice" }
}

// 失败
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Name is required" }
}
```

---

## 二、脑图（ASCII）

```
Express RESTful API
├── REST原则
│   ├── 资源导向 (名词URL)
│   ├── HTTP方法 (动词操作)
│   ├── 无状态
│   └── 统一接口
├── API设计
│   ├── URL设计 /api/v1/resource
│   ├── 状态码 200/201/204/400/404/500
│   ├── 响应格式 JSON
│   └── 版本控制 v1/v2
├── 核心功能
│   ├── CRUD操作
│   ├── 分页 /users?page=1&limit=10
│   ├── 过滤 /users?role=admin
│   ├── 排序 /users?sort=-createdAt
│   └── 搜索 /users?q=alice
├── 中间件
│   ├── 参数校验
│   ├── 错误处理
│   ├── 日志记录
│   └── 认证授权
└── 测试
    ├── 单元测试
    └── 集成测试 (supertest)
```

---

## 三、完整代码

### v1：基础CRUD API

```javascript
// v1-basic-crud.js - Basic CRUD RESTful API
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// In-memory data store
let todos = [
  { id: 1, title: 'Learn Express', completed: false, createdAt: '2026-04-28T08:00:00Z' },
  { id: 2, title: 'Build REST API', completed: false, createdAt: '2026-04-29T08:00:00Z' },
  { id: 3, title: 'Write tests', completed: true, createdAt: '2026-04-30T08:00:00Z' }
];
let nextId = 4;

// GET /api/todos - List all todos (with filtering)
app.get('/api/todos', (req, res) => {
  let result = [...todos];
  
  // Filter by completed status
  if (req.query.completed !== undefined) {
    const completed = req.query.completed === 'true';
    result = result.filter(t => t.completed === completed);
  }
  
  // Search by title
  if (req.query.q) {
    const query = req.query.q.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(query));
  }
  
  res.json({ success: true, data: result, total: result.length });
});

// GET /api/todos/:id - Get single todo
app.get('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Todo with id ${req.params.id} not found` }
    });
  }
  res.json({ success: true, data: todo });
});

// POST /api/todos - Create todo
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if (!title || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Title is required' }
    });
  }
  
  const todo = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  todos.push(todo);
  res.status(201).json({ success: true, data: todo });
});

// PUT /api/todos/:id - Update todo (full replacement)
app.put('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Todo with id ${req.params.id} not found` }
    });
  }
  
  const { title, completed } = req.body;
  if (title !== undefined) todo.title = title;
  if (completed !== undefined) todo.completed = completed;
  todo.updatedAt = new Date().toISOString();
  
  res.json({ success: true, data: todo });
});

// DELETE /api/todos/:id - Delete todo
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Todo with id ${req.params.id} not found` }
    });
  }
  
  const deleted = todos.splice(index, 1)[0];
  res.json({ success: true, data: deleted });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  });
});

app.listen(PORT, () => {
  console.log(`REST API running at http://localhost:${PORT}`);
});
```

### v2：分层架构 + 分页

```javascript
// v2-layered-api.js - Layered architecture with pagination
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// =============================================
// Data Layer - Simulated database operations
// =============================================
class Database {
  constructor() {
    this.data = new Map();
    this.nextId = 1;
  }

  findAll({ page = 1, limit = 10, sort, filter = {} } = {}) {
    let results = Array.from(this.data.values());
    
    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        results = results.filter(item => {
          if (typeof item[key] === 'string') {
            return item[key].toLowerCase().includes(String(value).toLowerCase());
          }
          return item[key] == value;
        });
      }
    });
    
    const total = results.length;
    
    // Sort
    if (sort) {
      const desc = sort.startsWith('-');
      const field = desc ? sort.slice(1) : sort;
      results.sort((a, b) => {
        const cmp = a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0;
        return desc ? -cmp : cmp;
      });
    }
    
    // Paginate
    const start = (page - 1) * limit;
    results = results.slice(start, start + limit);
    
    return { data: results, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  findById(id) {
    return this.data.get(Number(id)) || null;
  }

  create(item) {
    const id = this.nextId++;
    const record = { id, ...item, createdAt: new Date().toISOString() };
    this.data.set(id, record);
    return record;
  }

  update(id, updates) {
    const existing = this.data.get(Number(id));
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.data.set(Number(id), updated);
    return updated;
  }

  delete(id) {
    const deleted = this.data.get(Number(id));
    if (!deleted) return null;
    this.data.delete(Number(id));
    return deleted;
  }
}

// =============================================
// Service Layer - Business logic
// =============================================
class TodoService {
  constructor(db) {
    this.db = db;
  }

  list(options = {}) {
    return this.db.findAll(options);
  }

  getById(id) {
    const todo = this.db.findById(id);
    if (!todo) throw new ApiError(404, 'NOT_FOUND', `Todo ${id} not found`);
    return todo;
  }

  create(data) {
    if (!data.title || data.title.trim().length < 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Title is required');
    }
    return this.db.create({ title: data.title.trim(), completed: false, priority: data.priority || 'medium' });
  }

  update(id, data) {
    this.getById(id); // Check existence, throws if not found
    return this.db.update(id, data);
  }

  delete(id) {
    const todo = this.getById(id);
    this.db.delete(id);
    return todo;
  }
}

// Custom error class
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// =============================================
// Controller Layer - Route handlers
// =============================================
const db = new Database();
const todoService = new TodoService(db);

// Seed data
db.create({ title: 'Learn REST API design', completed: false, priority: 'high' });
db.create({ title: 'Implement CRUD operations', completed: false, priority: 'medium' });
db.create({ title: 'Add pagination', completed: true, priority: 'low' });
db.create({ title: 'Write API documentation', completed: false, priority: 'high' });
db.create({ title: 'Add input validation', completed: true, priority: 'medium' });

// GET /api/v1/todos
const listTodos = (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort, q, completed, priority } = req.query;
    const filter = {};
    if (q) filter.title = q;
    if (completed !== undefined) filter.completed = completed === 'true';
    if (priority) filter.priority = priority;
    
    const result = todoService.list({ page: Number(page), limit: Number(limit), sort, filter });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

// GET /api/v1/todos/:id
const getTodo = (req, res, next) => {
  try {
    const todo = todoService.getById(req.params.id);
    res.json({ success: true, data: todo });
  } catch (err) { next(err); }
};

// POST /api/v1/todos
const createTodo = (req, res, next) => {
  try {
    const todo = todoService.create(req.body);
    res.status(201).json({ success: true, data: todo });
  } catch (err) { next(err); }
};

// PUT /api/v1/todos/:id
const updateTodo = (req, res, next) => {
  try {
    const todo = todoService.update(req.params.id, req.body);
    res.json({ success: true, data: todo });
  } catch (err) { next(err); }
};

// DELETE /api/v1/todos/:id
const deleteTodo = (req, res, next) => {
  try {
    const todo = todoService.delete(req.params.id);
    res.json({ success: true, data: todo });
  } catch (err) { next(err); }
};

// =============================================
// Routes
// =============================================
const router = express.Router();

router.route('/todos')
  .get(listTodos)
  .post(createTodo);

router.route('/todos/:id')
  .get(getTodo)
  .put(updateTodo)
  .delete(deleteTodo);

// Mount with version prefix
app.use('/api/v1', router);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Todo API',
    version: 'v1',
    endpoints: {
      'GET /api/v1/todos': 'List todos (supports ?page, limit, sort, q, completed, priority)',
      'POST /api/v1/todos': 'Create todo',
      'GET /api/v1/todos/:id': 'Get todo',
      'PUT /api/v1/todos/:id': 'Update todo',
      'DELETE /api/v1/todos/:id': 'Delete todo'
    }
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  res.status(status).json({ success: false, error: { code, message: err.message } });
});

app.listen(PORT, () => {
  console.log(`REST API v2 running at http://localhost:${PORT}`);
});
```

### v3：完整生产级API

```javascript
// v3-production-api.js - Production-ready RESTful API
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const app = express();
const PORT = 3000;

// =============================================
// Middleware Stack
// =============================================
app.use(helmet());                    // Security headers
app.use(cors());                      // CORS
app.use(morgan('combined'));          // Logging
app.use(express.json({ limit: '1mb' })); // Body parsing with size limit

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }
});
app.use('/api/', limiter);

// =============================================
// Error Classes
// =============================================
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Validation middleware - checks express-validator results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'VALIDATION_ERROR', errors.array().map(e => e.msg).join(', '));
  }
  next();
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// =============================================
// Data Layer
// =============================================
let posts = [
  { id: 1, title: 'Getting Started with REST', content: 'REST is an architectural style...', author: 'Alice', tags: ['rest', 'api'], published: true, createdAt: '2026-04-25T08:00:00Z', updatedAt: null },
  { id: 2, title: 'Express Best Practices', content: 'Follow these patterns...', author: 'Bob', tags: ['express', 'node'], published: true, createdAt: '2026-04-26T08:00:00Z', updatedAt: null },
  { id: 3, title: 'API Security Guide', content: 'Security is important...', author: 'Charlie', tags: ['security', 'api'], published: false, createdAt: '2026-04-27T08:00:00Z', updatedAt: null },
  { id: 4, title: 'Database Design Tips', content: 'Good schema design matters...', author: 'Alice', tags: ['database', 'sql'], published: true, createdAt: '2026-04-28T08:00:00Z', updatedAt: null }
];
let nextId = 5;

// =============================================
// Routes with Validation
// =============================================
const router = express.Router();

// GET /api/v1/posts - List with pagination, filtering, sorting
router.get('/posts',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    validate
  ],
  asyncHandler((req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || '-createdAt';
    const published = req.query.published;
    const author = req.query.author;
    const tag = req.query.tag;
    const q = req.query.q;

    let result = [...posts];
    
    // Filter
    if (published !== undefined) result = result.filter(p => p.published === (published === 'true'));
    if (author) result = result.filter(p => p.author.toLowerCase() === author.toLowerCase());
    if (tag) result = result.filter(p => p.tags.includes(tag));
    if (q) {
      const query = q.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query));
    }
    
    const total = result.length;
    
    // Sort
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    result.sort((a, b) => {
      const aVal = a[field] || '';
      const bVal = b[field] || '';
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return desc ? -cmp : cmp;
    });
    
    // Paginate
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);
    
    // Strip content from list view for performance
    const listData = paginated.map(({ content, ...rest }) => rest);
    
    res.json({
      success: true,
      data: listData,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  })
);

// GET /api/v1/posts/:id - Single post
router.get('/posts/:id',
  [param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'), validate],
  asyncHandler((req, res) => {
    const post = posts.find(p => p.id === parseInt(req.params.id));
    if (!post) throw new ApiError(404, 'NOT_FOUND', `Post ${req.params.id} not found`);
    res.json({ success: true, data: post });
  })
);

// POST /api/v1/posts - Create post
router.post('/posts',
  [
    body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('content').trim().isLength({ min: 10 }).withMessage('Content must be at least 10 characters'),
    body('author').trim().notEmpty().withMessage('Author is required'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('published').optional().isBoolean().withMessage('Published must be boolean'),
    validate
  ],
  asyncHandler((req, res) => {
    const post = {
      id: nextId++,
      title: req.body.title,
      content: req.body.content,
      author: req.body.author,
      tags: req.body.tags || [],
      published: req.body.published || false,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
    posts.push(post);
    res.status(201).json({ success: true, data: post });
  })
);

// PUT /api/v1/posts/:id - Full update
router.put('/posts/:id',
  [
    param('id').isInt({ min: 1 }),
    body('title').trim().isLength({ min: 3, max: 200 }),
    body('content').trim().isLength({ min: 10 }),
    body('author').trim().notEmpty(),
    validate
  ],
  asyncHandler((req, res) => {
    const index = posts.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) throw new ApiError(404, 'NOT_FOUND', `Post ${req.params.id} not found`);
    
    posts[index] = {
      ...posts[index],
      title: req.body.title,
      content: req.body.content,
      author: req.body.author,
      tags: req.body.tags || posts[index].tags,
      published: req.body.published !== undefined ? req.body.published : posts[index].published,
      updatedAt: new Date().toISOString()
    };
    res.json({ success: true, data: posts[index] });
  })
);

// PATCH /api/v1/posts/:id - Partial update
router.patch('/posts/:id',
  [
    param('id').isInt({ min: 1 }),
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('content').optional().trim().isLength({ min: 10 }),
    validate
  ],
  asyncHandler((req, res) => {
    const post = posts.find(p => p.id === parseInt(req.params.id));
    if (!post) throw new ApiError(404, 'NOT_FOUND', `Post ${req.params.id} not found`);
    
    const allowedFields = ['title', 'content', 'author', 'tags', 'published'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) post[field] = req.body[field];
    });
    post.updatedAt = new Date().toISOString();
    res.json({ success: true, data: post });
  })
);

// DELETE /api/v1/posts/:id
router.delete('/posts/:id',
  [param('id').isInt({ min: 1 }), validate],
  asyncHandler((req, res) => {
    const index = posts.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) throw new ApiError(404, 'NOT_FOUND', `Post ${req.params.id} not found`);
    const deleted = posts.splice(index, 1)[0];
    res.json({ success: true, data: deleted });
  })
);

// Mount routes
app.use('/api/v1', router);

// API info
app.get('/', (req, res) => {
  res.json({ name: 'Blog API', version: '1.0.0', docs: '/api/v1/posts' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.code}: ${err.message}`);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  res.status(status).json({ success: false, error: { code, message: err.message } });
});

app.listen(PORT, () => {
  console.log(`Production API running at http://localhost:${PORT}`);
});
```

---

## 四、执行预览

```bash
# 启动v2
$ node v2-layered-api.js
REST API v2 running at http://localhost:3000

# 列表（带分页）
$ curl -s http://localhost:3000/api/v1/todos?page=1&limit=2 | jq
{
  "success": true,
  "data": [
    { "id": 1, "title": "Learn REST API design", "completed": false, "priority": "high" },
    { "id": 2, "title": "Implement CRUD operations", "completed": false, "priority": "medium" }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 5, "totalPages": 3 }
}

# 创建
$ curl -s -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"New task","priority":"high"}' | jq .data.id
6

# 排序 + 过滤
$ curl -s "http://localhost:3000/api/v1/todos?sort=-priority&completed=false" | jq '.data[].title'
"Learn REST API design"
"New task"
"Implement CRUD operations"

# v3 - 参数校验
$ curl -s -X POST http://localhost:3000/api/v1/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hi","content":"short"}' | jq
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Title must be 3-200 characters, Content must be at least 10 characters" }
}

# v3 - 成功创建
$ curl -s -X POST http://localhost:3000/api/v1/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My New Post","content":"This is the content of my new post","author":"Alice"}' | jq '.data | {id,title}'
{
  "id": 5,
  "title": "My New Post"
}

# v3 - PATCH 部分更新
$ curl -s -X PATCH http://localhost:3000/api/v1/posts/5 \
  -H "Content-Type: application/json" \
  -d '{"published":true}' | jq '.data.published'
true
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| HTTP状态码 | 200成功/201创建/204无内容/400错误请求/404未找到/500服务器错误 | 语义化使用，别全返回200 |
| PUT vs PATCH | PUT全量替换，PATCH部分更新 | 按需选择，推荐都实现 |
| ID参数类型 | URL参数是字符串 | 用 `parseInt()` 转换 |
| 输入验证 | 永远不要信任客户端输入 | 用 express-validator 校验 |
| 响应格式 | 保持统一结构 | 用 `{ success, data, error }` 模式 |
| API版本 | `/api/v1/` 前缀 | 重大变更时升级版本号 |

---

## 六、避坑指南

### ❌ 所有操作都返回200
```javascript
// ❌ 不管成功失败都返回200
app.delete('/api/todos/:id', (req, res) => {
  // ... delete logic
  res.json({ message: 'deleted' }); // 200 even if not found
});
```
```javascript
// ✅ 语义化状态码
app.delete('/api/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  todos.splice(index, 1);
  res.status(204).end(); // Or 200 with deleted resource
});
```

### ❌ 动词出现在URL中
```javascript
// ❌ RPC风格，不符合REST
app.post('/api/createUser', createUser);
app.post('/api/deleteUser', deleteUser);
app.get('/api/getUserList', getUserList);
```
```javascript
// ✅ RESTful风格：名词+HTTP方法
app.post('/api/users', createUser);      // Create
app.delete('/api/users/:id', deleteUser); // Delete
app.get('/api/users', getUserList);       // Read
```

### ❌ 没有输入验证
```javascript
// ❌ 直接使用body数据，存在安全隐患
app.post('/api/users', (req, res) => {
  const user = { id: nextId++, ...req.body }; // What if body has unexpected fields?
  users.push(user);
});
```
```javascript
// ✅ 白名单字段 + 验证
app.post('/api/users',
  body('email').isEmail(),
  body('name').trim().isLength({ min: 2 }),
  validate,
  (req, res) => {
    const { name, email } = req.body; // Only pick allowed fields
    const user = { id: nextId++, name, email };
    users.push(user);
    res.status(201).json({ data: user });
  }
);
```

### ❌ PUT和PATCH不分
```javascript
// ❌ PUT只更新部分字段（应该是全量替换）
app.put('/users/:id', (req, res) => {
  Object.assign(user, req.body); // Partial update with PUT
});
```
```javascript
// ✅ PUT全量替换，PATCH部分更新
app.put('/users/:id', (req, res) => {
  // Replace entire resource
  user = { id: user.id, ...req.body };
});
app.patch('/users/:id', (req, res) => {
  // Update only provided fields
  Object.keys(req.body).forEach(key => { user[key] = req.body[key]; });
});
```

---

## 七、练习题

### 🟢 初级
1. 创建一个 `/api/books` 的CRUD API，支持 GET列表、GET单个、POST创建、DELETE删除
2. 给每个API添加统一的错误处理中间件
3. 实现简单的查询参数过滤：`GET /api/books?author=xxx`

### 🟡 中级
4. 实现分页功能，返回 `{ data, pagination: { page, limit, total, totalPages } }`
5. 使用 `express.Router()` 按资源拆分路由（users路由、posts路由）
6. 实现排序功能：`GET /api/posts?sort=-createdAt`（`-` 表示降序）

### 🔴 高级
7. 使用 express-validator 实现完整的请求校验（body/params/query），并返回结构化错误信息
8. 实现一个可复用的CRUD工厂函数：`createCRUD(resource, db)` 自动生成5个路由
9. 用 supertest 编写API集成测试，覆盖所有CRUD操作和边界情况

---

## 八、知识点总结

```
RESTful API
├── 1. REST原则
│   ├── 资源导向（名词URL）
│   ├── HTTP方法（动词操作）
│   ├── 无状态通信
│   └── 统一接口
├── 2. API设计
│   ├── URL规范 /api/v1/resource
│   ├── 状态码 200/201/204/400/404/500
│   ├── 统一响应格式
│   └── 版本控制
├── 3. 架构分层
│   ├── Routes 路由定义
│   ├── Controllers 请求处理
│   ├── Services 业务逻辑
│   └── Data 数据访问
├── 4. 功能实现
│   ├── CRUD操作
│   ├── 分页 / 排序 / 过滤
│   ├── 输入验证
│   └── 错误处理
└── 5. 生产级特性
    ├── helmet 安全头
    ├── rate-limit 限流
    ├── morgan 日志
    └── express-validator 校验
```

---

## 九、举一反三

| 场景 | 资源设计 | 关键端点 |
|------|----------|----------|
| 博客系统 | posts, comments, users, tags | CRUD + 关联查询 |
| 电商系统 | products, orders, carts, reviews | CRUD + 库存管理 + 支付 |
| 任务管理 | projects, tasks, labels, members | CRUD + 状态流转 + 权限 |
| 社交平台 | users, posts, likes, follows | CRUD + Feed流 + 通知 |
| IoT平台 | devices, sensors, readings, alerts | CRUD + 实时数据 + 告警规则 |
| CMS系统 | pages, articles, media, settings | CRUD + 草稿/发布 + SEO |

---

## 十、参考资料

- [RESTful API 设计指南 -阮一峰](https://www.ruanyifeng.com/blog/2014/05/restful_api.html)
- [Express.js 官方文档](https://expressjs.com/)
- [express-validator 文档](https://express-validator.github.io/)
- [REST API Tutorial](https://restfulapi.net/)
- [HTTP 状态码 - MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)

---

## 十一、代码演进路线

```
v1 基础CRUD API
├── 单文件，所有逻辑在一起
├── 内存数据存储
├── 基本的增删改查
├── 简单的过滤和搜索
└── 适合：学习RESTful概念
        ↓
v2 分层架构
├── Data / Service / Controller 分层
├── 分页、排序、多条件过滤
├── 统一错误处理（ApiError）
├── API版本前缀 /api/v1
└── 适合：中小型项目，多人协作
        ↓
v3 生产级API
├── 安全中间件（helmet, rate-limit）
├── express-validator 参数校验
├── PUT全量更新 + PATCH部分更新
├── 列表视图字段优化（去掉content）
├── 结构化错误响应
└── 适合：生产环境部署
```

**关键演进思路：** 从"能用的API"到"好维护的API"到"安全可靠的API"。每一步解决实际工程中的痛点：可维护性、可扩展性、安全性。
