---
title: "015 - Docker Node.js 部署实战：从开发环境到生产上线"
slug: "015-docker-node"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.744+08:00"
updated_at: "2026-04-29T10:02:48.133+08:00"
reading_time: 30
tags: []
---

## 难度标注

> 🟡 **中级难度** | 需要基础 Node.js 和 Linux 命令行经验

---

## 概念讲解

### 为什么用 Docker 部署 Node.js？

- **环境一致**：开发、测试、生产环境完全相同，告别"在我机器上能跑"
- **快速部署**：秒级启动，比传统虚拟机快几个数量级
- **资源隔离**：CPU、内存、网络互相隔离，互不影响
- **弹性伸缩**：配合 K8s 或 Docker Compose 轻松扩缩容
- **版本管理**：镜像版本化，回滚只需改一个 tag

### Docker 核心概念

| 概念 | 说明 | 类比 |
|------|------|------|
| Image | 只读模板，包含运行环境和代码 | 安装光盘 |
| Container | Image 的运行实例 | 运行中的程序 |
| Dockerfile | 构建 Image 的脚本 | 安装说明书 |
| Volume | 持久化数据存储 | 外接硬盘 |
| Network | 容器间通信网络 | 局域网 |
| Registry | 镜像仓库（Docker Hub 等） | 应用商店 |

---

## 脑图

```
Docker Node.js
├── Dockerfile
│   ├── Base Image (node:20-alpine)
│   ├── WORKDIR / COPY
│   ├── npm install (production)
│   ├── Multi-stage Build
│   └── CMD / ENTRYPOINT
├── Docker Compose
│   ├── App Service
│   ├── Database (PostgreSQL/MySQL)
│   ├── Redis Cache
│   ├── Nginx Reverse Proxy
│   └── Volumes & Networks
├── Production
│   ├── Non-root User
│   ├── Health Check
│   ├── Memory Limits
│   ├── .dockerignore
│   └── Graceful Shutdown
├── Optimization
│   ├── Layer Caching
│   ├── Multi-stage Build
│   ├── Alpine Base Image
│   └── npm ci vs npm install
└── CI/CD
    ├── GitHub Actions
    ├── Image Tagging
    ├── Registry Push
    └── Rolling Deploy
```

---

## 完整代码：Docker Node.js 部署

### v1：基础 Dockerfile

```dockerfile
# v1-basic/Dockerfile - Simple Node.js Docker image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

```javascript
// v1-basic/server.js - Simple Express server
const express = require('express');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker!',
    hostname: os.hostname(),
    platform: process.platform,
    nodeVersion: process.version,
    uptime: process.uptime(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

```text
# v1-basic/.dockerignore - Exclude unnecessary files
node_modules
npm-debug.log
.git
.gitignore
.env
README.md
.DS_Store
```

### 执行预览

```bash
# Build image
$ docker build -t my-node-app:v1 .

# Run container
$ docker run -d -p 3000:3000 --name my-app my-node-app:v1

# Test
$ curl http://localhost:3000
{
  "message": "Hello from Docker!",
  "hostname": "a1b2c3d4e5f6",
  "platform": "linux",
  "nodeVersion": "v20.11.0",
  "uptime": 2.345
}

# View logs
$ docker logs my-app
Server running on port 3000

# Stop and remove
$ docker stop my-app && docker rm my-app
```

---

### v2：多阶段构建 + 生产优化

```dockerfile
# v2-production/Dockerfile - Multi-stage production build

# === Stage 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# === Stage 2: Production ===
FROM node:20-alpine AS production

# Install security updates
RUN apk update && apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set working directory
WORKDIR /app

# Copy from builder stage
COPY --from=builder --chown=appuser:appgroup /app ./

# Switch to non-root user
USER appuser

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Graceful shutdown support
STOPSIGNAL SIGTERM

# Start application
CMD ["node", "server.js"]
```

```javascript
// v2-production/server.js - Production-ready Express server
const express = require('express');
const graceful = require('./graceful');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Docker!',
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`[${process.env.NODE_ENV}] Server on port ${PORT}`);
});

graceful(server);
```

```javascript
// v2-production/graceful.js - Graceful shutdown handler
function setupGracefulShutdown(server) {
  let isShuttingDown = false;

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[${signal}] Shutting down gracefully...`);

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = setupGracefulShutdown;
```

### 执行预览 v2

```bash
# Build with multi-stage
$ docker build -t my-node-app:v2 .
# Image size reduced from ~400MB to ~120MB

# Run with resource limits
$ docker run -d \
  -p 3000:3000 \
  --memory=512m \
  --cpus=1.0 \
  --name my-app \
  my-node-app:v2

# Check health status
$ docker inspect --format='{{.State.Health.Status}}' my-app
healthy
```

---

### v3：Docker Compose 全栈部署

```yaml
# v3-compose/docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=myapp
      - DB_USER=appuser
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

```nginx
# v3-compose/nginx.conf - Reverse proxy config
upstream node_app {
    server app:3000;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://node_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```javascript
// v3-compose/server.js - Full-stack app with DB and Redis
const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'myapp',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD,
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
redisClient.connect().catch(console.error);

// Cache middleware
async function cache(key, ttl = 60) {
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);
  return null;
}

// Routes
app.get('/api/items', async (req, res) => {
  try {
    // Try cache first
    const cached = await cache('items:all');
    if (cached) return res.json({ source: 'cache', data: cached });

    // Query database
    const { rows } = await pool.query('SELECT * FROM items ORDER BY id');
    await redisClient.setEx('items:all', 60, JSON.stringify(rows));
    res.json({ source: 'db', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    db: 'ok',
    redis: 'ok',
  };
  try { await pool.query('SELECT 1'); } catch { checks.db = 'error'; }
  try { await redisClient.ping(); } catch { checks.redis = 'error'; }
  const status = Object.values(checks).every(v => v === 'ok') ? 200 : 503;
  res.status(status).json(checks);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
```

### 执行预览 v3

```bash
# Start all services
$ docker compose up -d

# Check status
$ docker compose ps
NAME         STATUS          PORTS
app          Up (healthy)    3000/tcp
nginx        Up              0.0.0.0:80->80/tcp
postgres     Up (healthy)    5432/tcp
redis        Up              6379/tcp

# Scale app instances
$ docker compose up -d --scale app=3

# View logs
$ docker compose logs -f app

# Stop everything
$ docker compose down -v
```

---

## 注意事项

| 维度 | 说明 | 建议 |
|------|------|------|
| 镜像大小 | 过大影响拉取速度 | 使用 Alpine 基础镜像 + 多阶段构建 |
| 安全性 | 容器内 root 有风险 | 创建非 root 用户运行应用 |
| 数据持久化 | 容器删除数据丢失 | 使用 Volume 挂载 |
| 环境变量 | 敏感信息不要写死 | 使用 .env 文件或密钥管理 |
| 网络配置 | 默认 bridge 网络 | 自定义网络 + 服务名访问 |
| 日志管理 | 日志写在容器内 | 使用日志驱动或挂载卷 |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| 使用 `node:latest` 基础镜像 | 指定版本如 `node:20-alpine` |
| 把 node_modules COPY 进容器 | 用 .dockerignore 排除，在容器内安装 |
| 一个容器跑多个进程 | 一个容器一个进程 |
| 忘记 HEALTHCHECK | 配置健康检查，方便编排工具监控 |
| 用 `npm start` 启动 | 直接用 `node server.js`，减少进程层数 |
| 构建时不利用缓存 | 先 COPY package.json → npm install → COPY 源码 |

---

## 练习题

### 🟢 基础题

1. 为一个简单的 Express 应用编写 Dockerfile，构建并运行
2. 编写 .dockerignore 文件，排除不必要的文件

### 🟡 进阶题

3. 实现多阶段构建，将镜像大小从 ~400MB 优化到 ~120MB
4. 编写 docker-compose.yml，启动 Node.js + PostgreSQL + Redis 三个服务

### 🔴 挑战题

5. 配置 Nginx 反向代理 + SSL，实现 HTTPS 访问 Node.js 应用
6. 实现 Docker Swarm 或 K8s 部署，包含滚动更新和回滚策略

---

## 知识点总结

```
Docker Node.js 部署知识树
├── Dockerfile
│   ├── FROM (base image)
│   ├── WORKDIR / COPY / ADD
│   ├── RUN (build commands)
│   ├── ENV / EXPOSE
│   ├── CMD / ENTRYPOINT
│   └── HEALTHCHECK
├── 优化策略
│   ├── Multi-stage Build
│   ├── Layer Caching
│   ├── Alpine 镜像
│   ├── .dockerignore
│   └── npm ci vs npm install
├── Docker Compose
│   ├── Services 定义
│   ├── Networks
│   ├── Volumes
│   ├── depends_on + healthcheck
│   └── Environment variables
├── 生产实践
│   ├── Non-root User
│   ├── Graceful Shutdown
│   ├── Resource Limits
│   ├── Log Management
│   └── Security Scanning
└── CI/CD
    ├── GitHub Actions
    ├── Image Registry
    ├── Tagging Strategy
    └── Rolling Deployment
```

---

## 举一反三

| 场景 | 传统部署 | Docker 部署 | 优势 |
|------|----------|-------------|------|
| 环境搭建 | 手动安装 Node/DB/Redis | docker compose up | 一键启动 |
| 版本切换 | nvm 切换 + 重装依赖 | 换个 Image tag | 秒级切换 |
| 扩容 | 手动配置新服务器 | docker compose scale | 自动化 |
| 回滚 | 重新部署旧版本 | docker run old-tag | 快速回滚 |
| 多项目 | 端口冲突、依赖冲突 | 各自隔离的容器 | 零冲突 |

---

## 参考资料

- [Docker 官方文档](https://docs.docker.com/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Docker 安全最佳实践](https://docs.docker.com/engine/security/)
- [Awesome Docker](https://github.com/veggiemonk/awesome-docker)

---

## 代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 基础 Dockerfile + 单容器 | 学习入门、本地开发 |
| v2 | 多阶段构建 + 安全加固 + 健康检查 | 单应用生产部署 |
| v3 | Docker Compose + DB/Redis/Nginx | 全栈生产部署 |

> 💡 **镜像大小优化路径**：node:20（~1GB）→ node:20-slim（~250MB）→ node:20-alpine（~120MB）→ 多阶段 Alpine（~80MB）。每一步都是显著优化。
