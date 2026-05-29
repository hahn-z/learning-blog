---
title: "020 - Express 测试：Jest + Supertest 从入门到 Mock"
slug: "020-express-testing"
category: "Node.js入门"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.669+08:00"
updated_at: "2026-04-29T10:02:48.001+08:00"
reading_time: 42
tags: []
---

## 难度标注

> 🟡 **中级难度** | 需要掌握 Express 基础和 JavaScript 异步概念

## 概念讲解

### 为什么要测试？

没有测试的代码就像没有安全网的走钢丝——看起来没问题，直到某天改了一个小东西，整个应用崩了。测试是代码的**安全网**，确保改动不会破坏已有功能。

### 测试金字塔

```
          /\
         /  \        E2E 测试 (少量)
        /────\       启动真实服务器，模拟用户操作
       /      \
      / 集成测试 \    测试路由 + 中间件 + 数据库协作
     /────────────\
    /   单元测试     \  测试单个函数/模块 (最多)
   /──────────────────\
```

- **单元测试**：数量最多，速度最快，测试单个函数
- **集成测试**：测试多个模块协作，比如 API 请求到响应的完整流程
- **E2E 测试**：数量最少，速度最慢，模拟真实用户操作

### 测试工具选择

| 工具 | 用途 | 特点 |
|------|------|------|
| **Jest** | 测试框架 | 零配置，内置断言和 mock |
| **Supertest** | HTTP 测试 | 不需要真正启动服务器 |
| **Mocha** | 测试框架 | 灵活，需配合 chai 使用 |

本篇使用 **Jest + Supertest**，这是 Express 项目中最主流的测试组合。

## 脑图

```
Express 测试
├── 测试类型
│   ├── 单元测试 (函数级别)
│   ├── 集成测试 (API 级别)
│   └── E2E 测试 (用户级别)
├── 工具链
│   ├── Jest — 测试框架
│   ├── Supertest — HTTP 请求模拟
│   └── jest.mock — 依赖模拟
├── 测试结构
│   ├── describe — 分组
│   ├── it/test — 测试用例
│   ├── beforeAll/afterAll — 生命周期
│   └── beforeEach/afterEach — 每个用例前后
├── 断言方法
│   ├── toBe / toEqual
│   ├── toHaveProperty
│   ├── expect(res.status).toBe(200)
│   └── expect(res.body).toMatchObject()
└── Mock 技术
    ├── jest.fn() — 模拟函数
    ├── jest.mock() — 模拟模块
    └── jest.spyOn() — 监视函数调用
```

## 完整代码

### v1：基础 API 测试

```js
// app.js — Application factory: exports app without listening
const express = require('express');
const app = express();

app.use(express.json());

// In-memory data store
let todos = [
  { id: 1, title: 'Learn Express', done: false },
  { id: 2, title: 'Write tests', done: false }
];

// Routes
app.get('/todos', (req, res) => {
  res.json(todos);
});

app.get('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});

app.post('/todos', (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const todo = { id: Date.now(), title, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.put('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  Object.assign(todo, req.body);
  res.json(todo);
});

app.delete('/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  todos.splice(index, 1);
  res.status(204).send();
});

// Export app for testing (do NOT listen here)
module.exports = app;
```

```js
// server.js — Entry point: imports app and starts listening
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
```

```js
// app.test.js — Basic API tests using Jest + Supertest
const request = require('supertest');
const app = require('./app');

describe('Todo API', () => {

  // GET /todos — should return all todos
  test('GET /todos returns todo list', async () => {
    const res = await request(app).get('/todos');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // GET /todos/:id — should return a single todo
  test('GET /todos/1 returns the first todo', async () => {
    const res = await request(app).get('/todos/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('title');
  });

  // GET /todos/:id — 404 for non-existent todo
  test('GET /todos/999 returns 404', async () => {
    const res = await request(app).get('/todos/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  // POST /todos — should create a new todo
  test('POST /todos creates a new todo', async () => {
    const res = await request(app)
      .post('/todos')
      .send({ title: 'Test todo' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('title', 'Test todo');
    expect(res.body).toHaveProperty('done', false);
  });

  // POST /todos — 400 without title
  test('POST /todos returns 400 without title', async () => {
    const res = await request(app)
      .post('/todos')
      .send({});
    expect(res.status).toBe(400);
  });

  // DELETE /todos/:id — should remove a todo
  test('DELETE /todos/2 returns 204', async () => {
    const res = await request(app).delete('/todos/2');
    expect(res.status).toBe(204);
  });
});
```

### v2：结构化测试 + 生命周期 + 覆盖率

```js
// app.v2.js — Enhanced app with service layer
const express = require('express');
const app = express();
app.use(express.json());

// Service layer (separated for testability)
const TodoService = {
  _todos: [],
  _nextId: 1,

  // Reset state (used in tests)
  reset() {
    this._todos = [];
    this._nextId = 1;
  },

  getAll() { return this._todos; },

  getById(id) {
    return this._todos.find(t => t.id === id) || null;
  },

  create(data) {
    if (!data.title) throw new Error('Title is required');
    const todo = { id: this._nextId++, ...data, done: false };
    this._todos.push(todo);
    return todo;
  },

  update(id, data) {
    const todo = this.getById(id);
    if (!todo) return null;
    Object.assign(todo, data);
    return todo;
  },

  delete(id) {
    const index = this._todos.findIndex(t => t.id === id);
    if (index === -1) return false;
    this._todos.splice(index, 1);
    return true;
  }
};

// Routes use the service
app.get('/todos', (req, res) => res.json(TodoService.getAll()));

app.get('/todos/:id', (req, res) => {
  const todo = TodoService.getById(Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});

app.post('/todos', (req, res) => {
  try {
    const todo = TodoService.create(req.body);
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/todos/:id', (req, res) => {
  const todo = TodoService.update(Number(req.params.id), req.body);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});

app.delete('/todos/:id', (req, res) => {
  const ok = TodoService.delete(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

module.exports = { app, TodoService };
```

```js
// app.v2.test.js — Structured tests with lifecycle hooks
const request = require('supertest');
const { app, TodoService } = require('./app.v2');

describe('Todo API v2', () => {

  // Reset data before each test for isolation
  beforeEach(() => {
    TodoService.reset();
  });

  describe('GET /todos', () => {
    test('returns empty array when no todos', async () => {
      const res = await request(app).get('/todos');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns todos after creation', async () => {
      TodoService.create({ title: 'Buy milk' });
      const res = await request(app).get('/todos');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Buy milk');
    });
  });

  describe('POST /todos', () => {
    test('creates todo with valid data', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: 'Write code' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'Write code',
        done: false
      });
    });

    test('rejects empty title', async () => {
      const res = await request(app)
        .post('/todos')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title/i);
    });
  });

  describe('PUT /todos/:id', () => {
    test('updates an existing todo', async () => {
      TodoService.create({ title: 'Old title' });
      const res = await request(app)
        .put('/todos/1')
        .send({ title: 'New title', done: true });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New title');
      expect(res.body.done).toBe(true);
    });
  });

  describe('DELETE /todos/:id', () => {
    test('deletes an existing todo', async () => {
      TodoService.create({ title: 'To delete' });
      const res = await request(app).delete('/todos/1');
      expect(res.status).toBe(204);
    });

    test('returns 404 for non-existent todo', async () => {
      const res = await request(app).delete('/todos/999');
      expect(res.status).toBe(404);
    });
  });
});

// Unit tests for TodoService
describe('TodoService (unit)', () => {
  beforeEach(() => TodoService.reset());

  test('create() assigns incremental IDs', () => {
    const t1 = TodoService.create({ title: 'First' });
    const t2 = TodoService.create({ title: 'Second' });
    expect(t1.id).toBe(1);
    expect(t2.id).toBe(2);
  });

  test('getById() returns null for missing ID', () => {
    expect(TodoService.getById(999)).toBeNull();
  });

  test('delete() returns false for missing ID', () => {
    expect(TodoService.delete(999)).toBe(false);
  });
});
```

### v3：Mock + 异步数据库 + 完整覆盖

```js
// user.service.js — Async service with database dependency
const db = require('./db'); // Database module to be mocked

class UserService {
  async getAll() {
    return db.query('SELECT * FROM users');
  }

  async getById(id) {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!users.length) throw new Error('User not found');
    return users[0];
  }

  async create(data) {
    if (!data.name || !data.email) {
      throw new Error('Name and email are required');
    }
    const result = await db.query('INSERT INTO users SET ?', data);
    return { id: result.insertId, ...data };
  }
}

module.exports = new UserService();
```

```js
// app.v3.js — Express app using async service
const express = require('express');
const userService = require('./user.service');
const app = express();
app.use(express.json());

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/users', asyncHandler(async (req, res) => {
  const users = await userService.getAll();
  res.json(users);
}));

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.getById(Number(req.params.id));
  res.json(user);
}));

app.post('/users', asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json(user);
}));

// Error handler
app.use((err, req, res, next) => {
  const status = err.message.includes('not found') ? 404
    : err.message.includes('required') ? 400 : 500;
  res.status(status).json({ error: err.message });
});

module.exports = app;
```

```js
// app.v3.test.js — Tests with mocked database
const request = require('supertest');

// Mock db module before importing app
jest.mock('./db', () => ({
  query: jest.fn()
}));

const db = require('./db');
const app = require('./app.v3');

// Sample data
const mockUsers = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' }
];

describe('User API v3', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    test('returns all users', async () => {
      db.query.mockResolvedValue(mockUsers);

      const res = await request(app).get('/users');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alice');
    });

    test('handles database error', async () => {
      db.query.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app).get('/users');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB connection failed');
    });
  });

  describe('GET /users/:id', () => {
    test('returns a single user', async () => {
      db.query.mockResolvedValue([mockUsers[0]]);

      const res = await request(app).get('/users/1');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alice');
    });

    test('returns 404 for non-existent user', async () => {
      db.query.mockResolvedValue([]);

      const res = await request(app).get('/users/999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /users', () => {
    test('creates a user successfully', async () => {
      db.query.mockResolvedValue({ insertId: 3 });

      const res = await request(app)
        .post('/users')
        .send({ name: 'Charlie', email: 'charlie@test.com' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(3);
      expect(res.body.name).toBe('Charlie');
    });

    test('rejects missing name', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'no-name@test.com' });
      expect(res.status).toBe(400);
    });
  });
});
```

```json
// package.json — Add Jest config
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": ["*.js", "!*.test.js", "!coverage/**"]
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

## 执行预览

```bash
# 安装依赖
$ npm install --save-dev jest supertest

# 运行测试
$ npx jest
 PASS  ./app.test.js
  Todo API
    ✓ GET /todos returns todo list (15 ms)
    ✓ GET /todos/1 returns the first todo (3 ms)
    ✓ GET /todos/999 returns 404 (2 ms)
    ✓ POST /todos creates a new todo (4 ms)
    ✓ POST /todos returns 400 without title (2 ms)
    ✓ DELETE /todos/2 returns 204 (3 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total

# 带覆盖率
$ npx jest --coverage
---------------------|---------|----------|---------|---------|
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
All files            |     100 |      100 |     100 |     100 |
 app.js              |     100 |      100 |     100 |     100 |
---------------------|---------|----------|---------|---------|
```

## 注意事项

| 事项 | 说明 | 严重度 |
|------|------|--------|
| 导出 app 而非 listen | Supertest 直接调用 app，不需要启动服务器 | 🔴 高 |
| 测试之间相互独立 | 每个测试不应依赖其他测试的数据 | 🔴 高 |
| jest.mock 在 import 前 | mock 声明必须在 require 之前 | 🔴 高 |
| 清理 mock 状态 | afterEach 中 clearAllMocks | 🟡 中 |
| 测试环境变量 | 设置 NODE_ENV=test | 🟡 中 |
| 测试文件命名 | *.test.js 或放 __tests__ 目录 | 🟢 建议 |
| 覆盖率目标 | 核心代码 >80%，不必追求 100% | 🟢 建议 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 在 `app.js` 中直接 `app.listen()` | 导出 app，在 `server.js` 中 listen |
| 测试共享可变状态 | `beforeEach` 重置数据，保证测试独立 |
| `jest.mock()` 写在 require 后面 | mock 必须在导入模块之前声明 |
| 测试只测 happy path | 同时测试正常流程和错误情况 |
| `setTimeout` 等待异步操作 | 用 `async/await` 或 return Promise |
| 忽略测试失败继续部署 | CI 中测试失败必须阻断部署 |
| 所有测试放一个文件 | 按 describe 分组，每个资源一个测试文件 |

## 练习题

### 🟢 入门题

1. 为一个 `GET /health` 路由编写测试，验证返回 `{ status: 'ok' }` 和 200 状态码
2. 编写测试验证 `POST /items` 在缺少必填字段时返回 400

### 🟡 进阶题

3. 重构现有代码：将业务逻辑抽到 Service 层，分别编写单元测试和集成测试
4. 使用 `jest.mock` 模拟一个发送邮件的模块，验证它被正确调用

### 🔴 挑战题

5. 搭建完整的测试体系：Service 层 + 路由层 + Mock 数据库 + 覆盖率 >90% + GitHub Actions CI 自动运行测试

## 知识点总结

```
Express 测试
├── Jest 基础
│   ├── test/it — 定义测试用例
│   ├── describe — 分组
│   ├── expect — 断言
│   └── beforeAll/afterEach — 生命周期钩子
├── Supertest
│   ├── request(app).get/post/put/delete
│   ├── .send() 发送请求体
│   ├── .set() 设置请求头
│   └── 不需要真正启动服务器
├── Mock 技术
│   ├── jest.fn() — 创建 mock 函数
│   ├── jest.mock() — 替换整个模块
│   ├── mockResolvedValue — 模拟成功
│   └── mockRejectedValue — 模拟失败
├── 测试组织
│   ├── 单元测试 — 测试函数
│   ├── 集成测试 — 测试 API
│   ├── 测试隔离 — beforeEach 重置
│   └── 命名规范 — *.test.js
└── 覆盖率
    ├── --coverage 标志
    ├── Stmts / Branch / Funcs / Lines
    └── 目标: 核心代码 >80%
```

## 举一反三

| 场景 | 测试方式 | 关键点 |
|------|----------|--------|
| REST API CRUD | Supertest + Jest | 测试每个状态码 |
| 认证中间件 | Mock JWT，测试 401/403 | 验证 token 过期 |
| 文件上传 | .attach() 发送文件 | 测试大小限制和类型 |
| 分页接口 | 多组参数测试 | 测试边界值 |
| 数据库操作 | jest.mock 模拟 db | 不依赖真实数据库 |
| 第三方 API | nock 或 jest.mock | 模拟外部响应 |
| WebSocket | socket.io-client 测试 | 模拟连接和事件 |
| 定时任务 | jest.useFakeTimers | 控制时间流逝 |

## 参考资料

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [Testing Express.js — ReactP](https://www.robinwieruch.de/node-testing-jest)
- [Jest Mock 详解](https://jestjs.io/docs/mock-functions)

## 代码演进

```
v1: 基础 API 测试
├── app.js 导出 app（不 listen）
├── supertest 直接请求 app
├── 测试 CRUD 的 happy path
└── 问题: 测试共享数据，不够独立

        ↓ 改进

v2: 结构化测试 + Service 层
├── 业务逻辑抽到 TodoService
├── beforeEach 重置数据
├── describe 分组组织测试
├── 单元测试 + 集成测试分离
└── 问题: 数据还是内存模拟

        ↓ 改进

v3: Mock + 异步数据库 + 完整覆盖
├── jest.mock 替换数据库模块
├── mockResolvedValue/rejectedValue
├── 测试数据库错误场景
├── 覆盖率报告
└── CI 集成就绪
```
