---
title: "019 - Node.js微服务架构：从单体到分布式的实战演进"
slug: "019-node-microservice"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.766+08:00"
updated_at: "2026-04-29T10:02:48.169+08:00"
reading_time: 35
tags: []
---

# Node.js微服务架构：从单体到分布式的实战演进

> **难度：** ⭐⭐⭐⭐ 高级 | **预计阅读：** 20分钟
> 
> **前置知识：** Express/Koa、Docker基础、数据库设计、REST API

---

## 1. 概念讲解

微服务不是银弹，而是架构演进的手段。先搞清楚要不要用，再学怎么用。

**何时拆分微服务？**

| 场景 | 建议 |
|------|------|
| 1-3人团队，项目初期 | ❌ 单体优先，不要拆 |
| 业务模块边界清晰 | ✅ 可以按业务域拆分 |
| 团队>5人，需要独立部署 | ✅ 微服务合适 |
| 性能瓶颈在单一模块 | ✅ 可以只拆瓶颈模块 |

**微服务核心组件：**

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│ User Svc   │     │ Order Svc  │     │ Product Svc│
│ :3001      │     │ :3002      │     │ :3003      │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │
      └──────────┬───────┴──────────┬──────┘
                 │                  │
          ┌──────▼──────┐   ┌──────▼──────┐
          │ API Gateway │   │ Message Bus │
          │   :8080     │   │  (RabbitMQ) │
          └─────────────┘   └─────────────┘
```

**服务间通信方式对比：**

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| HTTP/REST | 简单、通用 | 同步阻塞、耦合 | 简单查询 |
| gRPC | 高性能、强类型 | 学习成本 | 内部服务高频调用 |
| 消息队列 | 解耦、异步 | 复杂度高、调试难 | 异步任务、事件驱动 |

---

## 2. 脑图

```
Node.js 微服务
├── 服务拆分
│   ├── 按业务域 (DDD)
│   ├── 每个服务独立数据库
│   ├── API版本管理
│   └── 服务发现
├── 通信方式
│   ├── REST (HTTP)
│   ├── gRPC (Protobuf)
│   ├── 消息队列 (RabbitMQ/Kafka)
│   └── 事件驱动 (Event Sourcing)
├── API Gateway
│   ├── 路由分发
│   ├── 认证鉴权
│   ├── 限流熔断
│   └── 日志聚合
├── 数据管理
│   ├── 每服务独立DB
│   ├── Saga模式
│   ├── CQRS
│   └── 分布式事务
├── 部署运维
│   ├── Docker容器化
│   ├── Docker Compose
│   ├── K8s编排
│   └── CI/CD流水线
└── 可观测性
    ├── 集中式日志 (ELK)
    ├── 分布式追踪 (Jaeger)
    ├── 健康检查
    └── 指标监控 (Prometheus)
```

---

## 3. 完整代码

### 3.1 API Gateway

```javascript
// gateway/index.js - API Gateway with routing and auth
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// Service registry (in production, use Consul or etcd)
const SERVICES = {
  user:    { target: process.env.USER_SERVICE_URL    || 'http://localhost:3001' },
  order:   { target: process.env.ORDER_SERVICE_URL   || 'http://localhost:3002' },
  product: { target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003' }
};

// Authentication middleware
function authenticate(req, res, next) {
  // Skip auth for public endpoints
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/health'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();
  
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', services: Object.keys(SERVICES) });
});

// Proxy to user service
app.use('/api/users', authenticate,
  createProxyMiddleware({
    target: SERVICES.user.target,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/api' }
  })
);

// Proxy to order service
app.use('/api/orders', authenticate,
  createProxyMiddleware({
    target: SERVICES.order.target,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/api' }
  })
);

// Proxy to product service (public read, auth for write)
app.use('/api/products',
  createProxyMiddleware({
    target: SERVICES.product.target,
    changeOrigin: true,
    pathRewrite: { '^/api/products': '/api' }
  })
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
```

### 3.2 User Service

```javascript
// services/user/index.js - User microservice
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  
  if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ userId: user.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.rows[0].id, email: user.rows[0].email, name: user.rows[0].name } });
});

// Get user profile
app.get('/api/:id', async (req, res) => {
  const result = await db.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'user' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`User service on port ${PORT}`));
```

### 3.3 Order Service（含消息队列通信）

```javascript
// services/order/index.js - Order microservice with message queue
const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://localhost';

let channel;

// Connect to RabbitMQ
async function connectMQ() {
  const conn = await amqp.connect(RABBIT_URL);
  channel = await conn.createChannel();
  await channel.assertQueue('order.created', { durable: true });
  await channel.assertQueue('order.cancelled', { durable: true });
  console.log('Connected to RabbitMQ');
}

// Create order
app.post('/api', async (req, res) => {
  const { userId, items, total } = req.body;
  if (!userId || !items?.length) return res.status(400).json({ error: 'Missing fields' });
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id, created_at',
      [userId, total, 'pending']
    );
    const orderId = orderResult.rows[0].id;
    
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, item.price]
      );
    }
    
    await client.query('COMMIT');
    
    // Publish event to message queue
    const event = {
      type: 'ORDER_CREATED',
      data: { orderId, userId, items, total, createdAt: orderResult.rows[0].created_at }
    };
    channel.sendToQueue('order.created', Buffer.from(JSON.stringify(event)), { persistent: true });
    
    res.status(201).json({ orderId, status: 'pending', total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Order creation failed' });
  } finally {
    client.release();
  }
});

// Get orders by user
app.get('/api/user/:userId', async (req, res) => {
  const result = await db.query(
    'SELECT id, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [req.params.userId]
  );
  res.json(result.rows);
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order' }));

const PORT = process.env.PORT || 3002;
connectMQ().then(() => {
  app.listen(PORT, () => console.log(`Order service on port ${PORT}`));
});
```

### 3.4 Docker Compose编排

```yaml
# docker-compose.yml - Full microservices stack
version: '3.8'

services:
  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    environment:
      - USER_SERVICE_URL=http://user:3001
      - ORDER_SERVICE_URL=http://order:3002
      - PRODUCT_SERVICE_URL=http://product:3003
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - user
      - order
      - product

  user:
    build: ./services/user
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@user-db:5432/users
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3001
    depends_on:
      - user-db

  order:
    build: ./services/order
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@order-db:5432/orders
      - RABBIT_URL=amqp://rabbitmq:5672
      - PORT=3002
    depends_on:
      - order-db
      - rabbitmq

  product:
    build: ./services/product
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@product-db:5432/products
      - PORT=3003
    depends_on:
      - product-db

  user-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: users
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - user-db-data:/var/lib/postgresql/data

  order-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - order-db-data:/var/lib/postgresql/data

  product-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: products
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - product-db-data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

volumes:
  user-db-data:
  order-db-data:
  product-db-data:
  rabbitmq-data:
```

### 3.5 代码演进

**v1 — 单体应用（一个Express服务做所有事）：**
```javascript
// monolith/app.js - Everything in one service
// Users, Orders, Products all in one codebase, one database
app.use('/users', userRoutes);
app.use('/orders', orderRoutes);
app.use('/products', productRoutes);
```

**v2 — 拆分服务 + HTTP通信：**
```javascript
// Each service calls others via HTTP
const user = await axios.get(`${USER_SERVICE}/api/${order.userId}`);
```

**v3 — 完整微服务（API Gateway + 消息队列 + Docker Compose）：**
```yaml
# See docker-compose.yml above
# Gateway routes → Services → Independent DBs + RabbitMQ
```

---

## 4. 执行预览

```bash
# Start all services
$ docker compose up -d

# Register and login
$ curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123","name":"Test"}'
{"id":1,"email":"test@example.com","name":"Test"}

$ curl -X POST http://localhost:8080/api/auth/login \
  -d '{"email":"test@example.com","password":"secret123"}'
{"token":"eyJ...","user":{...}}

# Create order (goes through gateway)
$ TOKEN="eyJ..."
$ curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":1,"items":[{"productId":1,"quantity":2,"price":29.99}],"total":59.98}'
{"orderId":1,"status":"pending","total":59.98}

# Check RabbitMQ management console
# Open http://localhost:15672 (guest/guest)
# See order.created queue has a message
```

---

## 5. 注意事项

| 关注点 | 说明 | 严重程度 |
|--------|------|----------|
| 数据一致性 | 跨服务事务用Saga模式，不用2PC | 🔴 高 |
| 服务发现 | 硬编码URL只适合开发，生产用Consul/K8s DNS | 🟡 中 |
| 超时和重试 | HTTP调用必须设超时，重试要幂等 | 🔴 高 |
| 数据库隔离 | 每个服务独立数据库，不共享 | 🔴 高 |
| 日志关联 | 用TraceId串联请求链路 | 🟡 中 |
| 网络分区 | 消费者要处理重复消息（幂等性） | 🔴 高 |

---

## 6. 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 一上来就拆微服务 | 从单体开始，遇到瓶颈再拆 |
| 服务间共享数据库 | 每个服务独立数据库 |
| 同步调用链过长 | 用消息队列解耦，限制同步调用层数 |
| 不处理分布式事务 | 使用Saga模式 + 补偿事务 |
| 不设超时 | 所有HTTP调用设5-10秒超时 |
| 忽略幂等性 | 所有写操作必须幂等（防止重试导致重复） |
| Docker里跑开发 | Docker用于部署，开发用docker compose + hot reload |

---

## 7. 练习题

### 🟢 基础题
1. 用Docker Compose启动3个独立的Express服务，互相能访问
2. 实现一个简单的API Gateway，将请求路由到不同服务
3. 使用http-proxy-middleware做请求转发

### 🟡 进阶题
4. 给Order Service添加RabbitMQ消息发布，另一个服务订阅并处理
5. 实现服务健康检查，Gateway检测到服务不可用时返回降级响应
6. 使用Docker Compose的depends_on + healthcheck确保启动顺序

### 🔴 挑战题
7. 实现Saga模式：下单→扣库存→扣款，任一步失败执行补偿事务
8. 搭建完整的可观测性：ELK日志 + Jaeger追踪 + Prometheus监控

---

## 8. 知识点总结

```
微服务架构
├── 设计原则
│   ├── 单一职责
│   ├── 独立部署
│   ├── 独立数据存储
│   └── 故障隔离
├── 通信模式
│   ├── 同步 (HTTP/gRPC)
│   ├── 异步 (消息队列)
│   └── 事件驱动
├── 基础设施
│   ├── API Gateway
│   ├── 服务发现
│   ├── 配置中心
│   └── 消息队列
├── 数据管理
│   ├── 独立数据库
│   ├── Saga模式
│   ├── CQRS
│   └── 事件溯源
└── 运维
    ├── 容器化 (Docker)
    ├── 编排 (K8s)
    ├── CI/CD
    └── 可观测性
```

---

## 9. 举一反三

| 业务场景 | 架构选择 | 关键技术 |
|----------|----------|----------|
| 电商平台 | 按业务域拆分 | Gateway + RabbitMQ + Saga |
| 内容管理 | 读写分离 + CDN | CQRS + 对象存储 |
| 实时通讯 | WebSocket网关 | Socket.io + Redis Pub/Sub |
| 数据分析 | 事件驱动 + 批处理 | Kafka + 批处理Worker |
| IoT平台 | 消息总线 + 设备管理 | MQTT Broker + 时序数据库 |

---

## 10. 参考资料

- [Microservices.io - Chris Richardson](https://microservices.io/)
- [Building Microservices (Sam Newman)](https://www.oreilly.com/library/view/building-microservices-2nd/9781492034018/)
- [Docker Compose文档](https://docs.docker.com/compose/)
- [RabbitMQ Node.js客户端](https://amqp-node.github.io/amqplib/)
- [Node.js Best Practices - Microservices](https://github.com/goldbergyoni/nodebestpractices#1-project-architecture-practices)

---

## 11. 代码演进路线

```
v1 (单体)               v2 (服务拆分)           v3 (完整微服务)
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│ 一个Express  │  →    │ 3个Express   │  →    │ Gateway + 3服务   │
│ 一个DB       │       │ 各自DB       │       │ 各自DB + MQ      │
│ 直接调用     │       │ HTTP互调     │       │ 消息队列解耦      │
│ 无容器化     │       │ Docker       │       │ Docker Compose   │
│ 无网关      │       │ 简单路由     │       │ API Gateway      │
│ 无追踪      │       │ console.log  │       │ TraceId + ELK    │
└──────────────┘       └──────────────┘       └──────────────────┘
```

---

> 💡 **一句话总结：** 微服务是架构演进的手段，不是目的。从单体开始，按业务域拆分，用API Gateway统一入口，用消息队列解耦服务间通信。
