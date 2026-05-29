---
title: "014 - Jest 测试框架实战：让 Node.js 代码质量有保障"
slug: "014-jest"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.739+08:00"
updated_at: "2026-04-29T10:02:48.124+08:00"
reading_time: 34
tags: []
---

## 难度标注

> 🟡 **中级难度** | 需要基础 Node.js 经验，了解 JavaScript 异步编程

---

## 概念讲解

### 为什么需要测试？

- **重构安全感**：有测试覆盖的代码，重构时不心慌
- **活文档**：测试用例就是最好的使用文档
- **Bug 预防**：上线前发现问题，远比上线后修复成本低
- **设计反馈**：难测试的代码通常意味着设计有问题

### Jest 核心概念

| 概念 | 作用 | 类比 |
|------|------|------|
| describe | 分组相关测试 | 文件夹 |
| it/test | 单个测试用例 | 文件夹中的文件 |
| expect | 断言结果 | 答案校验 |
| beforeEach/afterEach | 每个测试前后执行 | 课前预习/课后复习 |
| mock | 模拟依赖 | 替身演员 |
| snapshot | 记录 UI/数据快照 | 照片 |

---

## 脑图

```
Jest Testing
├── Basic
│   ├── test / it
│   ├── describe (grouping)
│   ├── expect (assertions)
│   └── Lifecycle (beforeEach, afterEach)
├── Matchers
│   ├── toBe / toEqual
│   ├── toBeNull / toBeUndefined
│   ├── toContain / toHaveLength
│   ├── toThrow (error testing)
│   └── .not (negation)
├── Async Testing
│   ├── Callbacks (done)
│   ├── Promises (return + resolves/rejects)
│   └── async/await
├── Mock
│   ├── jest.fn() (mock function)
│   ├── jest.spyOn() (spy on method)
│   ├── jest.mock() (mock module)
│   └── jest.useFakeTimers()
├── Advanced
│   ├── Snapshot Testing
│   ├── Parameterized Tests (.each)
│   ├── Coverage (--coverage)
│   └── Custom Matchers
└── Integration
    ├── Supertest (HTTP testing)
    ├── Database setup/teardown
    ├── Testcontainers
    └── CI/CD pipeline
```

---

## 完整代码：Jest 测试实战

### v1：基础单元测试

```javascript
// v1-basic/math.js - Module to test
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

// Async function
function fetchData(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id > 0) resolve({ id, name: `Item ${id}` });
      else reject(new Error('Invalid ID'));
    }, 100);
  });
}

module.exports = { add, subtract, multiply, divide, fetchData };
```

```javascript
// v1-basic/__tests__/math.test.js
const { add, subtract, multiply, divide, fetchData } = require('../math');

describe('Math utilities', () => {
  // Basic matchers
  test('add should sum two numbers', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });

  test('subtract should find difference', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  test('multiply should product two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
  });

  // Error testing
  test('divide should throw on zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  // Floating point comparison
  test('divide handles decimals', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 2);
  });

  // Parameterized tests
  test.each([
    [1, 1, 2],
    [2, 3, 5],
    [-1, 1, 0],
    [0, 0, 0],
  ])('add(%i, %i) = %i', (a, b, expected) => {
    expect(add(a, b)).toBe(expected);
  });
});

describe('Async operations', () => {
  // Promise testing
  test('fetchData resolves with valid ID', () => {
    return expect(fetchData(1)).resolves.toEqual({
      id: 1,
      name: 'Item 1',
    });
  });

  test('fetchData rejects with invalid ID', () => {
    return expect(fetchData(-1)).rejects.toThrow('Invalid ID');
  });

  // async/await style
  test('fetchData works with async/await', async () => {
    const result = await fetchData(42);
    expect(result.name).toBe('Item 42');
  });
});
```

### 执行预览

```bash
$ npx jest --verbose
 PASS  __tests__/math.test.js
  Math utilities
    ✓ add should sum two numbers (2 ms)
    ✓ subtract should find difference
    ✓ multiply should product two numbers
    ✓ divide should throw on zero (1 ms)
    ✓ divide handles decimals
    ✓ add(1, 1) = 2
    ✓ add(2, 3) = 5
    ✓ add(-1, 1) = 0
    ✓ add(0, 0) = 0
  Async operations
    ✓ fetchData resolves with valid ID (102 ms)
    ✓ fetchData rejects with invalid ID (100 ms)
    ✓ fetchData works with async/await (101 ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

---

### v2：Mock 和 HTTP 测试

```javascript
// v2-mock/userService.js - Service with external dependency
const axios = require('axios');

class UserService {
  constructor(apiUrl = 'https://api.example.com') {
    this.apiUrl = apiUrl;
  }

  async getUser(id) {
    const { data } = await axios.get(`${this.apiUrl}/users/${id}`);
    return data;
  }

  async createUser(userData) {
    if (!userData.name || !userData.email) {
      throw new Error('Name and email are required');
    }
    const { data } = await axios.post(`${this.apiUrl}/users`, userData);
    return data;
  }

  async deleteUser(id) {
    try {
      await axios.delete(`${this.apiUrl}/users/${id}`);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { UserService };
```

```javascript
// v2-mock/__tests__/userService.test.js
const { UserService } = require('../userService');
const axios = require('axios');

// Mock the entire axios module
jest.mock('axios');

describe('UserService', () => {
  let service;

  beforeEach(() => {
    service = new UserService();
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    test('should fetch user by ID', async () => {
      axios.get.mockResolvedValue({
        data: { id: 1, name: 'Alice' },
      });

      const user = await service.getUser(1);

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.example.com/users/1'
      );
      expect(user).toEqual({ id: 1, name: 'Alice' });
    });

    test('should handle network error', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      await expect(service.getUser(1)).rejects.toThrow('Network Error');
    });
  });

  describe('createUser', () => {
    test('should create user with valid data', async () => {
      axios.post.mockResolvedValue({
        data: { id: 2, name: 'Bob', email: 'bob@test.com' },
      });

      const user = await service.createUser({
        name: 'Bob',
        email: 'bob@test.com',
      });

      expect(user.id).toBe(2);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('should reject missing fields', async () => {
      await expect(service.createUser({ name: 'Bob' }))
        .rejects.toThrow('Name and email are required');
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    test('should return true on success', async () => {
      axios.delete.mockResolvedValue({});
      const result = await service.deleteUser(1);
      expect(result).toBe(true);
    });

    test('should return false on failure', async () => {
      axios.delete.mockRejectedValue(new Error('Not Found'));
      const result = await service.deleteUser(999);
      expect(result).toBe(false);
    });
  });
});
```

```javascript
// v2-mock/__tests__/api.integration.test.js - Integration test with supertest
const express = require('express');
const request = require('supertest');

// Create a test app
function createApp() {
  const app = express();
  app.use(express.json());

  const users = [];

  app.get('/api/users', (req, res) => {
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    const user = { id: String(users.length + 1), name, email };
    users.push(user);
    res.status(201).json(user);
  });

  app.get('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  });

  return app;
}

describe('User API Integration', () => {
  const app = createApp();

  test('POST /api/users creates user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Alice', email: 'alice@test.com' })
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Alice',
      email: 'alice@test.com',
    });
  });

  test('GET /api/users returns list', async () => {
    const res = await request(app)
      .get('/api/users')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST without fields returns 400', async () => {
    await request(app)
      .post('/api/users')
      .send({})
      .expect(400);
  });
});
```

### 执行预览 v2

```bash
$ npx jest --coverage --verbose
 PASS  __tests__/userService.test.js
  UserService
    getUser
      ✓ should fetch user by ID (3 ms)
      ✓ should handle network error (1 ms)
    createUser
      ✓ should create user with valid data
      ✓ should reject missing fields
    deleteUser
      ✓ should return true on success
      ✓ should return false on failure
 PASS  __tests__/api.integration.test.js
  User API Integration
    ✓ POST /api/users creates user (15 ms)
    ✓ GET /api/users returns list (4 ms)
    ✓ POST without fields returns 400 (3 ms)

-----------|---------|----------|---------|---------|
File       | % Stmts | % Branch | % Funcs | % Lines |
-----------|---------|----------|---------|---------|
All files  |     100 |      100 |     100 |     100 |
-----------|---------|----------|---------|---------|
```

---

### v3：完整测试配置 + 高级特性

```javascript
// v3-advanced/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/index.js',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterSetup: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
};
```

```javascript
// v3-advanced/jest.setup.js
const { setTimeout } = require('timers/promises');

// Global test utilities
global.wait = (ms) => setTimeout(ms);

// Mock console in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
};
```

```javascript
// v3-advanced/__tests__/advanced.test.js

describe('Snapshot Testing', () => {
  test('user object matches snapshot', () => {
    const user = {
      id: '1',
      name: 'Alice',
      email: 'alice@test.com',
      role: 'admin',
    };
    expect(user).toMatchSnapshot();
  });
});

describe('Timer Mocking', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useFakeTimersToReal());

  test('debounce delays execution', () => {
    const fn = jest.fn();

    function debounce(callback, delay) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), delay);
      };
    }

    const debounced = debounce(fn, 300);
    debounced('first');
    debounced('second');
    debounced('third');

    // Not called yet
    expect(fn).not.toHaveBeenCalled();

    // Fast-forward time
    jest.advanceTimersByTime(300);

    // Only last call executed
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });
});

describe('Custom Matchers', () => {
  // Extend Jest matchers
  expect.extend({
    toBeWithinRange(received, floor, ceiling) {
      const pass = received >= floor && received <= ceiling;
      return {
        pass,
        message: () =>
          `expected ${received} to be within range ${floor}..${ceiling}`,
      };
    },
  });

  test('custom matcher works', () => {
    expect(50).toBeWithinRange(0, 100);
    expect(150).not.toBeWithinRange(0, 100);
  });
});
```

---

## 注意事项

| 维度 | 说明 | 建议 |
|------|------|------|
| 测试隔离 | 测试之间不应有依赖 | 用 beforeEach 重置状态 |
| 异步测试 | 忘记 return/await 导致假通过 | 始终 return Promise 或使用 async/await |
| Mock 污染 | mock 未清理影响其他测试 | afterEach 中 jest.restoreAllMocks() |
| 超时 | 异步测试默认 5 秒超时 | 合理设置 testTimeout |
| 覆盖率 | 100% 覆盖率 ≠ 无 Bug | 关注边界条件和错误路径 |
| 快照 | 快照变化不一定是错误 | 审查每次快照更新 |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| 测试实现细节（私有方法） | 测试公共行为和输出 |
| 一个测试多个断言 | 一个测试一个明确的行为 |
| 忘记 return Promise | 用 async/await 确保异步完成 |
| 过度 Mock 导致测试无意义 | 只 Mock 外部依赖，测试真实逻辑 |
| 忽略 console.error 输出 | 测试中捕获并验证错误日志 |
| 快照测试超大对象 | 快照只保存关键结构，排除动态字段 |

---

## 练习题

### 🟢 基础题

1. 编写一个 `StringUtils` 模块，包含 `capitalize`、`reverse`、`truncate(str, len)` 方法，并编写完整测试
2. 测试 `divide` 函数的边界情况：除以零、负数、浮点数

### 🟡 进阶题

3. 编写一个 `fetchUsers` 函数调用外部 API，使用 jest.mock 测试成功和失败场景
4. 使用 supertest 对 Express 应用编写完整的 CRUD 集成测试

### 🔴 挑战题

5. 实现自定义 Matcher `toBeValidEmail`，验证字符串是否是合法邮箱格式
6. 编写一个测试套件，覆盖 Redis 缓存命中/未命中/过期三种场景（使用 fake timers）

---

## 知识点总结

```
Jest 测试框架知识树
├── 基础
│   ├── test/it/describe
│   ├── Matchers (toBe, toEqual, toThrow...)
│   ├── Lifecycle Hooks
│   └── Parameterized Tests (.each)
├── 异步测试
│   ├── Callbacks (done)
│   ├── Promises (resolves/rejects)
│   └── async/await
├── Mock 系统
│   ├── jest.fn() (mock function)
│   ├── jest.mock() (mock module)
│   ├── jest.spyOn() (spy)
│   └── jest.useFakeTimers()
├── 进阶
│   ├── Snapshot Testing
│   ├── Custom Matchers
│   ├── Coverage 配置
│   └── 并发测试 (--detectOpenHandles)
└── 集成测试
    ├── Supertest (HTTP)
    ├── Database testing
    └── CI/CD 集成
```

---

## 举一反三

| 场景 | 简单方案 | Jest 方案 | 优势 |
|------|----------|-----------|------|
| 测试纯函数 | console.log 手动验证 | expect + toBe | 自动化、可重复 |
| 测试 API | Postman 手动点 | Supertest 自动化 | 纳入 CI/CD |
| 测试定时器 | 等真实时间流逝 | jest.useFakeTimers | 秒级完成 |
| 测试外部 API | 真实调用（慢且不稳定） | jest.mock 模拟 | 快速、稳定 |
| 回归测试 | 人工检查 | 快照测试 | 自动检测变化 |

---

## 参考资料

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [Testing JavaScript](https://testingjavascript.com/)
- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [Supertest GitHub](https://github.com/visionmedia/supertest)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 基础单元测试 + 异步测试 | 学习入门、工具函数测试 |
| v2 | Mock + HTTP 集成测试 | API 服务测试 |
| v3 | 完整配置 + 快照 + 自定义 Matcher | 生产项目测试体系 |

> 💡 **测试金字塔建议**：70% 单元测试 + 20% 集成测试 + 10% E2E 测试。先保证单元测试覆盖核心逻辑，再逐步补充集成测试。
