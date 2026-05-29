---
title: "020 - Node.js项目实战：从零搭建完整RESTful API服务"
slug: "020-node-project"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.772+08:00"
updated_at: "2026-04-29T10:02:48.177+08:00"
reading_time: 53
tags: []
---

# Node.js项目实战：从零搭建完整RESTful API服务

> **难度：** ⭐⭐⭐ 中高级 | **预计阅读：** 20分钟
> 
> **前置知识：** Express、PostgreSQL、JWT、Docker基础

---

## 1. 概念讲解

这是前面所有知识的综合应用。我们搭建一个完整的博客API服务，包含：用户系统、文章CRUD、评论系统、标签分类。

**项目技术栈：**

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| Web框架 | Express 4 | 成熟稳定，生态丰富 |
| 数据库 | PostgreSQL | 关系型，JSON支持好 |
| ORM | 原生SQL(pg) | 性能透明，学习成本低 |
| 认证 | JWT + bcrypt | 无状态，易扩展 |
| 验证 | express-validator | Express原生集成 |
| 日志 | winston | 生产级日志库 |
| 测试 | jest + supertest | Node.js标配 |
| 部署 | Docker + PM2 | 容器化 + 进程管理 |

**项目结构：**

```
blog-api/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   └── tags.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── post.service.js
│   │   └── comment.service.js
│   ├── utils/
│   │   └── logger.js
│   └── app.js
├── tests/
│   ├── auth.test.js
│   └── posts.test.js
├── migrations/
│   └── 001_init.sql
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js
├── package.json
└── .env.example
```

---

## 2. 脑图

```
Blog API 项目
├── 用户系统
│   ├── 注册 / 登录
│   ├── JWT认证
│   ├── 个人信息
│   └── 密码修改
├── 文章系统
│   ├── CRUD操作
│   ├── 分页查询
│   ├── 草稿/发布
│   └── 全文搜索
├── 评论系统
│   ├── 发表评论
│   ├── 评论列表
│   └── 删除评论
├── 标签系统
│   ├── 创建标签
│   ├── 文章打标签
│   └── 按标签查询
├── 基础设施
│   ├── 错误处理
│   ├── 日志系统
│   ├── 请求验证
│   └── 分页封装
└── 部署
    ├── Dockerfile
    ├── docker-compose
    └── PM2配置
```

---

## 3. 完整代码

### 3.1 数据库初始化

```sql
-- migrations/001_init.sql - Database schema
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_comments_post_id ON comments(post_id);
```

### 3.2 应用入口

```javascript
// src/app.js - Application entry point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { pool, testConnection } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const tagRoutes = require('./routes/tags');

const app = express();

// Security & performance middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { ip: req.ip });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/tags', tagRoutes);

// Health check
app.get('/health', async (req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;

// Start server if called directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
}
```

### 3.3 数据库配置

```javascript
// src/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

// Helper for transactions
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection, transaction };
```

### 3.4 中间件

```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
```

```javascript
// src/middleware/errorHandler.js
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(err.message, { stack: err.stack, url: req.url });
  
  const status = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message;
  
  res.status(status).json({ error: message });
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };
```

### 3.5 Post路由和服务

```javascript
// src/services/post.service.js
const { pool, transaction } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

async function createPost(userId, { title, content, excerpt, tags, status = 'draft' }) {
  const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
  
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO posts (user_id, title, slug, content, excerpt, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, title, slug, content, excerpt || content.substring(0, 200), status]
    );
    
    const post = result.rows[0];
    
    // Handle tags
    if (tags?.length) {
      for (const tagName of tags) {
        const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        // Upsert tag
        const tagResult = await client.query(
          `INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = $1 RETURNING id`,
          [tagName, tagSlug]
        );
        await client.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [post.id, tagResult.rows[0].id]
        );
      }
    }
    
    return post;
  });
}

async function getPosts({ page = 1, limit = 20, status, tag }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let paramIdx = 1;
  
  if (status) {
    conditions.push(`p.status = $${paramIdx++}`);
    params.push(status);
  }
  if (tag) {
    conditions.push(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.slug = $${paramIdx++})`);
    params.push(tag);
  }
  
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const countResult = await pool.query(`SELECT COUNT(*) FROM posts p ${where}`, params);
  const total = parseInt(countResult.rows[0].count);
  
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT p.*, u.name as author_name,
     (SELECT COALESCE(json_agg(json_build_object('name', t.name, 'slug', t.slug)), '[]')
      FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id) as tags
     FROM posts p JOIN users u ON p.user_id = u.id
     ${where} ORDER BY p.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    params
  );
  
  return {
    posts: result.rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getPostBySlug(slug) {
  const result = await pool.query(
    `SELECT p.*, u.name as author_name,
     (SELECT COALESCE(json_agg(json_build_object('name', t.name, 'slug', t.slug)), '[]')
      FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = p.id) as tags
     FROM posts p JOIN users u ON p.user_id = u.id WHERE p.slug = $1`,
    [slug]
  );
  if (!result.rows[0]) throw new AppError('Post not found', 404);
  return result.rows[0];
}

async function updatePost(postId, userId, data) {
  const result = await pool.query(
    `UPDATE posts SET title = COALESCE($1, title), content = COALESCE($2, content),
     excerpt = COALESCE($3, excerpt), status = COALESCE($4, status), updated_at = NOW()
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [data.title, data.content, data.excerpt, data.status, postId, userId]
  );
  if (!result.rows[0]) throw new AppError('Post not found or not authorized', 404);
  return result.rows[0];
}

async function deletePost(postId, userId) {
  const result = await pool.query(
    'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
    [postId, userId]
  );
  if (!result.rows[0]) throw new AppError('Post not found or not authorized', 404);
}

module.exports = { createPost, getPosts, getPostBySlug, updatePost, deletePost };
```

```javascript
// src/routes/posts.js
const router = require('express').Router();
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const postService = require('../services/post.service');

// Public: list published posts
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
  async (req, res, next) => {
    try {
      const result = await postService.getPosts({
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        status: 'published',
        tag: req.query.tag
      });
      res.json(result);
    } catch (err) { next(err); }
  }
);

// Public: get single post
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await postService.getPostBySlug(req.params.slug);
    res.json(post);
  } catch (err) { next(err); }
});

// Auth required: create post
router.post('/',
  authenticate,
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('content').trim().isLength({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const post = await postService.createPost(req.user.userId, req.body);
      res.status(201).json(post);
    } catch (err) { next(err); }
  }
);

// Auth required: update post
router.put('/:id',
  authenticate,
  param('id').isInt(),
  validate,
  async (req, res, next) => {
    try {
      const post = await postService.updatePost(req.params.id, req.user.userId, req.body);
      res.json(post);
    } catch (err) { next(err); }
  }
);

// Auth required: delete post
router.delete('/:id',
  authenticate,
  param('id').isInt(),
  validate,
  async (req, res, next) => {
    try {
      await postService.deletePost(req.params.id, req.user.userId);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

module.exports = router;
```

### 3.6 验证中间件 + 日志

```javascript
// src/middleware/validate.js
const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array().map(e => e.msg).join(', '), 400);
  }
  next();
}

module.exports = { validate };
```

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json()
    })
  ]
});

module.exports = logger;
```

### 3.7 测试

```javascript
// tests/posts.test.js
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/database');

let token;
let postId;

beforeAll(async () => {
  // Create test user and get token
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `test${Date.now()}@example.com`, password: 'test1234', name: 'Tester' });
  token = res.body.token;
});

afterAll(async () => {
  await pool.end();
});

describe('Posts API', () => {
  test('POST /api/posts - create a post', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Post',
        content: 'This is test content for the blog post.',
        tags: ['nodejs', 'testing'],
        status: 'published'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Post');
    expect(res.body.slug).toBe('test-post');
    postId = res.body.id;
  });

  test('GET /api/posts - list posts', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body.posts).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
  });

  test('GET /api/posts/:slug - get single post', async () => {
    const res = await request(app).get('/api/posts/test-post');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test Post');
  });

  test('PUT /api/posts/:id - update post', async () => {
    const res = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Post' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Post');
  });

  test('DELETE /api/posts/:id - delete post', async () => {
    const res = await request(app)
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});
```

### 3.8 Dockerfile + docker-compose

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/blog
      - JWT_SECRET=${JWT_SECRET:-change-me-in-production}
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: blog
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db-data:
```

### 3.9 代码演进

**v1 — 最小可用（单文件）：**
```javascript
// server.js - Everything in one file
const express = require('express');
const app = express();
app.use(express.json());
let posts = [];
app.get('/posts', (req, res) => res.json(posts));
app.post('/posts', (req, res) => { posts.push(req.body); res.status(201).json(req.body); });
app.listen(3000);
```

**v2 — 分层架构（MVC）：**
```javascript
// Split into routes + services + middleware
// Add validation, error handling, JWT auth
// See project structure above
```

**v3 — 生产就绪（完整工程化）：**
```javascript
// Add: PostgreSQL, Docker, tests, logging, pagination, transactions
// See complete code above
```

---

## 4. 执行预览

```bash
# Start the stack
$ docker compose up -d

# Run migrations (auto via docker-entrypoint-initdb.d)

# Register
$ curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blog.com","password":"secure123","name":"Admin"}'
{"id":1,"email":"admin@blog.com","name":"Admin","token":"eyJ..."}

# Create a post
$ curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello World","content":"My first post!","tags":["intro","nodejs"],"status":"published"}'
{"id":1,"title":"Hello World","slug":"hello-world","status":"published",...}

# List posts
$ curl http://localhost:3000/api/posts
{"posts":[{"id":1,"title":"Hello World","slug":"hello-world","tags":[{"name":"intro",...}]}],
 "pagination":{"page":1,"limit":20,"total":1,"pages":1}}

# Health check
$ curl http://localhost:3000/health
{"status":"ok","uptime":45.2,"timestamp":"2024-01-15T10:30:00.000Z"}

# Run tests
$ npm test
PASS  tests/posts.test.js
  Posts API
    ✓ POST /api/posts - create a post (45ms)
    ✓ GET /api/posts - list posts (12ms)
    ✓ GET /api/posts/:slug - get single post (8ms)
    ✓ PUT /api/posts/:id - update post (15ms)
    ✓ DELETE /api/posts/:id - delete post (10ms)
```

---

## 5. 注意事项

| 关注点 | 实现方式 | 优先级 |
|--------|----------|--------|
| 输入验证 | express-validator每个路由 | 🔴 必须 |
| 错误处理 | 统一errorHandler中间件 | 🔴 必须 |
| 认证授权 | JWT + authenticate中间件 | 🔴 必须 |
| SQL安全 | 参数化查询（永不拼接） | 🔴 必须 |
| 分页 | 统一分页参数 + 响应格式 | 🟡 推荐 |
| 日志 | winston + 结构化日志 | 🟡 推荐 |
| 测试 | jest + supertest | 🟡 推荐 |
| Docker | 多阶段构建 + healthcheck | 🟡 推荐 |
| CI/CD | GitHub Actions | 🟢 加分 |
| API文档 | Swagger/OpenAPI | 🟢 加分 |

---

## 6. 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 所有代码写在一个文件 | 按职责分层：routes/services/middleware |
| 不写测试 | 至少覆盖核心CRUD + 认证 |
| console.log当日志 | 用winston，结构化输出 |
| 没有统一错误处理 | errorHandler中间件兜底 |
| 直接用环境变量不验证 | 启动时检查必要的环境变量 |
| Dockerfile用latest标签 | 指定具体Node版本 |
| 不做分页 | 列表接口必须分页 |
| 忘记数据库索引 | 根据查询模式建索引 |

---

## 7. 练习题

### 🟢 基础题
1. 搭建项目骨架，实现User注册/登录功能
2. 实现Post的CRUD，使用参数化SQL查询
3. 给API添加分页查询（page + limit + total）

### 🟡 进阶题
4. 实现评论系统：发表评论、评论列表、删除评论
5. 添加JWT认证中间件，保护写操作
6. 编写完整的CRUD测试用例

### 🔴 挑战题
7. 实现全文搜索（PostgreSQL tsvector + tsquery）
8. 添加Redis缓存层，对热门文章做缓存，设定合理的失效策略

---

## 8. 知识点总结

```
Blog API 项目
├── 架构
│   ├── 分层设计 (routes/services/middleware)
│   ├── 错误处理链
│   ├── 认证中间件
│   └── 请求验证
├── 数据库
│   ├── Schema设计
│   ├── 参数化查询
│   ├── 事务管理
│   ├── 索引优化
│   └── 分页查询
├── 工程化
│   ├── 结构化日志
│   ├── 单元测试
│   ├── Docker容器化
│   ├── 环境变量管理
│   └── PM2进程管理
└── API设计
    ├── RESTful规范
    ├── 统一响应格式
    ├── HTTP状态码
    └── 版本管理
```

---

## 9. 举一反三

| 项目类型 | 核心差异 | 关键技术 |
|----------|----------|----------|
| 电商API | 商品/SKU/订单/支付 | 事务 + 状态机 + 支付网关 |
| 社交API | 关注/动态/消息 | Feed流 + WebSocket + Redis |
| CMS系统 | 内容/媒体/权限 | RBAC + 文件存储 + 版本控制 |
| SaaS平台 | 多租户/计费/用量 | 租户隔离 + Stripe + 配额 |
| IoT后端 | 设备/数据/告警 | MQTT + 时序数据库 + 规则引擎 |

---

## 10. 参考资料

- [Express.js最佳实践](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PostgreSQL Node.js教程](https://node-postgres.com/)
- [jest测试框架](https://jestjs.io/)
- [Docker Node.js最佳实践](https://nodejs.org/en/docs/guides/nodejs-docker-webapp)
- [RESTful API设计指南](https://restfulapi.net/)

---

## 11. 代码演进路线

```
v1 (MVP)                v2 (分层)               v3 (生产就绪)
┌──────────────┐       ┌──────────────┐        ┌──────────────────┐
│ 单文件       │  →    │ routes/      │   →    │ routes/          │
│ 内存数组     │       │ services/    │        │ services/        │
│ 无认证       │       │ middleware/  │        │ middleware/      │
│ 无验证       │       │ PostgreSQL   │        │ PostgreSQL + Redis│
│ 无错误处理   │       │ JWT认证      │        │ JWT + refresh    │
│ 无测试       │       │ 基础测试     │        │ 完整测试覆盖      │
│              │       │              │        │ Docker + PM2     │
└──────────────┘       └──────────────┘        └──────────────────┘
```

---

> 💡 **一句话总结：** 一个完整的Node.js项目 = 分层架构 + PostgreSQL参数化查询 + JWT认证 + 统一错误处理 + 结构化日志 + Docker部署 + 自动化测试。把这七件事做到位，项目就能上生产。
