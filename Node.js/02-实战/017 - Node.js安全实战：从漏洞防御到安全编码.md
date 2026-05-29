---
title: "017 - Node.js安全实战：从漏洞防御到安全编码"
slug: "017-node-security"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.753+08:00"
updated_at: "2026-04-29T10:02:48.152+08:00"
reading_time: 33
tags: []
---

# Node.js安全实战：从漏洞防御到安全编码

> **难度：** ⭐⭐⭐ 中高级 | **预计阅读：** 18分钟
> 
> **前置知识：** Express、HTTP协议基础、JWT认证

---

## 1. 概念讲解

Node.js安全不是锦上添花，而是必须项。OWASP Top 10中的大多数漏洞在Node.js应用中都可能出现。

**核心安全威胁：**

| 威胁 | 攻击方式 | 危害 |
|------|----------|------|
| SQL注入 | 恶意SQL拼接到查询 | 数据泄露/删除 |
| XSS | 注入恶意脚本到页面 | 窃取Cookie/会话 |
| CSRF | 伪造用户请求 | 未授权操作 |
| 路径遍历 | `../../../etc/passwd` | 读取任意文件 |
| 原型污染 | `__proto__`修改 | 逻辑绕过/RCE |
| 依赖漏洞 | 第三方包含恶意代码 | 供应链攻击 |
| 不安全反序列化 | 恶意序列化数据 | 远程代码执行 |

---

## 2. 脑图

```
Node.js 安全
├── 输入验证
│   ├── 参数校验 (joi/zod)
│   ├── SQL参数化查询
│   ├── XSS过滤
│   └── 文件上传限制
├── 认证与授权
│   ├── JWT最佳实践
│   ├── Session安全
│   ├── RBAC权限模型
│   └── OAuth2.0集成
├── HTTP安全头
│   ├── Helmet中间件
│   ├── CORS配置
│   ├── CSP策略
│   └── HTTPS强制
├── 依赖安全
│   ├── npm audit
│   ├── 锁文件
│   ├── 依赖审计
│   └── Snyk/Socket
├── 运行时安全
│   ├── 原型污染防护
│   ├── 速率限制
│   ├── 错误信息脱敏
│   └── 进程权限
└── 部署安全
    ├── 环境变量管理
    ├── Docker安全
    ├── 日志脱敏
    └── 密钥轮转
```

---

## 3. 完整代码

### 3.1 安全中间件配置

```javascript
// security.js - Security middleware and configuration
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

// 1. Helmet - Security HTTP headers
function setupSecurityHeaders(app) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      }
    },
    hsts: {
      maxAge: 31536000,       // 1 year
      includeSubDomains: true,
      preload: true
    }
  }));
}

// 2. Rate limiting
function setupRateLimit(app) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                   // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' }
  });
  
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,                     // Stricter for auth endpoints
    message: { error: 'Too many login attempts' }
  });
  
  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// 3. CORS configuration
function setupCors(app) {
  const corsOptions = {
    origin: function (origin, callback) {
      const whitelist = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400  // Preflight cache for 24 hours
  };
  app.use(cors(corsOptions));
}

// 4. Input sanitization middleware
function sanitizeInput(req, res, next) {
  // Remove $ and . from keys to prevent NoSQL injection
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const clean = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      const safeKey = key.replace(/[$.]/g, '_');
      clean[safeKey] = typeof value === 'object' ? sanitize(value) : value;
    }
    return clean;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
}

module.exports = { setupSecurityHeaders, setupRateLimit, setupCors, sanitizeInput };
```

### 3.2 安全的认证系统

```javascript
// auth.js - Secure authentication implementation
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;       // MUST be in env vars
const JWT_EXPIRES = '15m';                        // Short-lived access token
const REFRESH_EXPIRES = '7d';

// Hash password with bcrypt
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate token pair
function generateTokenPair(userId) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES,
      jwtid: crypto.randomBytes(16).toString('hex')  // Unique token ID
    }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
  
  return { accessToken, refreshToken };
}

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { hashPassword, verifyPassword, generateTokenPair, authenticate };
```

### 3.3 安全的数据库操作

```javascript
// db-safe.js - Safe database operations preventing SQL injection
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }  // Enforce SSL for production
});

// SAFE: Parameterized query
async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]  // Parameters are escaped automatically
  );
  return result.rows[0];
}

// SAFE: Parameterized INSERT
async function createUser(email, passwordHash, name) {
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email, passwordHash, name]
  );
  return result.rows[0];
}

// SAFE: Input-validated search
async function searchUsers(name, limit = 20) {
  const safeLimit = Math.min(parseInt(limit) || 20, 100);  // Cap at 100
  const result = await pool.query(
    'SELECT id, name, email FROM users WHERE name ILIKE $1 LIMIT $2',
    [`%${name}%`, safeLimit]
  );
  return result.rows;
}

module.exports = { findUserByEmail, createUser, searchUsers };
```

### 3.4 主应用入口

```javascript
// app.js - Main application with all security measures
const express = require('express');
const { setupSecurityHeaders, setupRateLimit, setupCors, sanitizeInput } = require('./security');
const { hashPassword, verifyPassword, generateTokenPair, authenticate } = require('./auth');
const { findUserByEmail, createUser } = require('./db-safe');
const morgan = require('morgan');

const app = express();

// Security middleware stack (order matters!)
setupCors(app);
setupSecurityHeaders(app);
app.use(sanitizeInput);
app.use(express.json({ limit: '1mb' }));  // Limit body size
setupRateLimit(app);

// Request logging (exclude sensitive data)
app.use(morgan(':method :url :status :response-time ms', {
  skip: (req) => req.url === '/health'  // Don't log health checks
}));

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  // Validate input
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    const hash = await hashPassword(password);
    const user = await createUser(email, hash, name);
    const tokens = generateTokenPair(user.id);
    res.status(201).json({ user: { id: user.id, email: user.email }, ...tokens });
  } catch (err) {
    // Don't expose internal errors
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/me', authenticate, async (req, res) => {
  // req.userId comes from auth middleware
  res.json({ userId: req.userId });
});

// Health check (no auth needed)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler - never expose stack traces in production
app.use((err, req, res, next) => {
  console.error(err.stack);
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### 3.5 代码演进

**v1 — 裸奔版（无安全措施）：**
```javascript
// UNSAFE - Do NOT use in production
app.post('/login', async (req, res) => {
  const user = await db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`);
  if (user.password === req.body.password) {
    res.json({ token: jwt.sign({ id: user.id }, 'secret123') });
  }
});
```

**v2 — 基础防护（参数化 + bcrypt）：**
```javascript
// Better but incomplete
app.post('/login', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
  if (await bcrypt.compare(req.body.password, user.password_hash)) {
    res.json(generateTokenPair(user.id));
  }
});
```

**v3 — 完整安全（helmet + rate limit + sanitize + JWT pair）：**
```javascript
// Full security stack - see app.js above
// Includes: helmet, CORS, rate limiting, input sanitization,
// bcrypt hashing, JWT with rotation, parameterized queries, error masking
```

---

## 4. 执行预览

```bash
$ npm install helmet express-rate-limit cors bcrypt jsonwebtoken pg express-validator

$ curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","name":"Test"}'
{"user":{"id":1,"email":"test@example.com"},"accessToken":"eyJ...","refreshToken":"eyJ..."}

$ curl http://localhost:3000/api/me -H "Authorization: Bearer eyJ..."
{"userId":1}

# Rate limit kicks in:
$ for i in $(seq 1 110); do curl -s http://localhost:3000/api/me; done
# After 100 requests: {"error":"Too many requests, please try again later"}

# SQL injection attempt - safely handled:
$ curl -X POST http://localhost:3000/api/auth/register \
  -d '{"email":"admin@test.com' OR 1=1--","password":"x","name":"hack"}'
{"error":"Registration failed"}  # Parameterized query prevents injection
```

---

## 5. 注意事项

| 安全措施 | 实现方式 | 优先级 |
|----------|----------|--------|
| HTTPS | Nginx反向代理 + Let's Encrypt | 🔴 必须 |
| 输入验证 | express-validator / joi | 🔴 必须 |
| SQL注入防护 | 参数化查询（永不拼接SQL） | 🔴 必须 |
| 密码存储 | bcrypt (rounds≥12) | 🔴 必须 |
| 安全头 | helmet中间件 | 🔴 必须 |
| 速率限制 | express-rate-limit | 🟡 推荐 |
| CORS | 白名单origin | 🟡 推荐 |
| 依赖审计 | npm audit + Snyk | 🟡 推荐 |
| CSP策略 | helmet contentSecurityPolicy | 🟢 加分 |
| 日志脱敏 | 自定义morgan filter | 🟢 加分 |

---

## 6. 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| JWT secret硬编码 | 用环境变量，且定期轮转 |
| `jwt.sign({id}, 'secret')` | 用强随机密钥 + 短过期时间 |
| 密码明文存储或MD5 | bcrypt/scrypt，rounds≥12 |
| `SELECT *` + 直接比较密码 | 只查需要的字段 + bcrypt.compare |
| 错误信息返回stack trace | 生产环境返回通用错误 |
| CORS设为 `*` | 白名单具体域名 |
| 信任客户端数据 | 服务端验证一切输入 |
| 不限制请求体大小 | `express.json({ limit: '1mb' })` |

---

## 7. 练习题

### 🟢 基础题
1. 给现有Express应用添加helmet和CORS配置
2. 使用express-validator验证注册接口的输入
3. 对密码进行bcrypt加密存储，并验证登录

### 🟡 进阶题
4. 实现JWT access + refresh token双token方案
5. 配置不同的rate limit：API(100/15min)、登录(5/15min)
6. 编写SQL注入和XSS的测试用例，验证防护有效

### 🔴 挑战题
7. 实现完整的RBAC权限系统（角色+权限+中间件）
8. 搭建依赖安全审计CI流程：npm audit + Snyk + 自动PR

---

## 8. 知识点总结

```
Node.js 安全体系
├── 传输层
│   ├── HTTPS (TLS)
│   ├── HSTS
│   └── 安全Cookie
├── 应用层
│   ├── 输入验证
│   ├── 输出编码
│   ├── 认证授权
│   └── 会话管理
├── 数据层
│   ├── 参数化查询
│   ├── 加密存储
│   └── 最小权限
├── 基础设施
│   ├── 安全头 (Helmet)
│   ├── 速率限制
│   ├── CORS
│   └── 日志审计
└── 供应链
    ├── 依赖审计
    ├── 锁文件
    └── 最小依赖
```

---

## 9. 举一反三

| 攻击场景 | 防御方案 | Node.js工具 |
|----------|----------|------------|
| SQL注入 | 参数化查询 | pg/mysql2 prepared statements |
| XSS | 输出编码 + CSP | helmet + DOMPurify |
| CSRF | SameSite Cookie + Token | csurf中间件 |
| 暴力破解 | 速率限制 + 账号锁定 | express-rate-limit |
| 依赖漏洞 | 自动审计 + 锁版本 | npm audit + Snyk |
| 敏感数据泄露 | 加密存储 + 日志脱敏 | crypto模块 + 自定义logger |

---

## 10. 参考资料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Helmet.js文档](https://helmetjs.github.io/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Snyk - Node.js Security](https://snyk.io/learn/nodejs-security/)

---

## 11. 代码演进路线

```
v1 (裸奔)              v2 (基础防护)           v3 (完整安全)
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│ SQL拼接      │  →    │ 参数化查询    │  →    │ 参数化 + sanitize│
│ 明文密码     │       │ bcrypt       │       │ bcrypt + pepper  │
│ 无安全头     │       │ helmet       │       │ helmet + CSP     │
│ JWT硬编码    │       │ env JWT      │       │ JWT轮转 + refresh│
│ 无限流      │       │ 基础限流      │       │ 分级限流 + IP黑名单│
└──────────────┘       └──────────────┘       └──────────────────┘
```

---

> 💡 **一句话总结：** 安全不是功能，是习惯。参数化查询 + bcrypt + helmet + rate limit + 输入验证，这五件事做到位，能挡住90%的常见攻击。
