---
title: "039 - Docker 容器化与 docker-compose 编排"
slug: "039-docker-compose"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09.053+08:00"
updated_at: "2026-05-01T22:15:41.592+08:00"
reading_time: 6
tags: []
---

# Docker 容器化与 docker-compose 编排

> **难度：** ⭐⭐⭐
> **前置知识：** Docker 基础命令、Hyperf 项目结构、网络基础
> **预估用时：** 50-70 分钟

## 1. 概念讲解

**Docker 容器化**是将应用及其依赖打包成标准化单元（镜像），在任何环境中一致运行的技术。**docker-compose** 是定义和运行多容器应用的工具，通过一个 YAML 文件编排所有服务。

类比理解：Docker 镜像就像预装好软件的笔记本电脑——无论带到哪里，打开就能用，环境完全一致。docker-compose 就像一个乐队指挥，协调各个乐器（容器）按正确的顺序、正确的音量（资源限制）一起演奏。

在用户服务中，我们需要容器化 Hyperf 应用、MySQL、Redis、Kafka、Elasticsearch 等所有依赖，用 docker-compose 一键启动完整的开发和测试环境。

## 2. 实时脑图

```
┌───────────────────────────────────────────────────┐
│       Docker Compose Architecture                  │
├───────────────────────────────────────────────────┤
│                                                    │
│  [Docker Network: user-service-net]                │
│                                                    │
│  ┌─────────────┐  ┌─────────────┐                 │
│  │ user-service │  │   MySQL     │                 │
│  │ (Hyperf)    │──│   8.0       │                 │
│  │ Port: 9501  │  │ Port: 3306  │                 │
│  └──────┬──────┘  └─────────────┘                 │
│         │                                          │
│  ┌──────┴──────┐  ┌─────────────┐                 │
│  │   Redis     │  │   Kafka     │                 │
│  │ Port: 6379  │  │ Port: 9092  │                 │
│  └─────────────┘  └──────┬──────┘                 │
│                          │                         │
│                   ┌──────┴──────┐                  │
│                   │  ZooKeeper  │                  │
│                   │ Port: 2181  │                  │
│                   └─────────────┘                  │
│                                                    │
│  Build Flow:                                      │
│  Dockerfile -> composer install -> php bin/hyperf  │
└───────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 Dockerfile

```dockerfile
# ✅ Multi-stage build for production optimization
FROM php:8.2-cli AS base

# ✅ Install system dependencies
RUN apt-get update && apt-get install -y \
    git curl zip unzip libzip-dev libpq-dev \
    && docker-php-ext-install pdo_mysql zip pcntl opcache \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean

# ✅ Install Swoole (required by Hyperf)
RUN pecl install swoole && docker-php-ext-enable swoole

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# ✅ Copy dependency files first (Docker layer caching)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --prefer-dist --optimize-autoloader

# ✅ Copy application code
COPY . .

# ✅ Production optimizations
RUN composer dump-autoload --optimize

EXPOSE 9501

# ✅ Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:9501/ || exit 1

# ✅ Start Hyperf server
CMD ["php", "bin/hyperf.php", "start"]
```

### 3.2 Docker Compose `docker-compose.yml`

```yaml
version: '3.8'

services:
  # ✅ Hyperf user service
  user-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "9501:9501"
    environment:
      - APP_ENV=production
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_DATABASE=user_service
      - DB_USERNAME=root
      - DB_PASSWORD=secret
      - REDIS_HOST=redis
      - KAFKA_BROKERS=kafka:9092
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
      kafka:
        condition: service_started
    networks:
      - user-service-net
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'

  # ✅ MySQL 8.0
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: user_service
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - user-service-net

  # ✅ Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - user-service-net

  # ✅ Kafka + ZooKeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    networks:
      - user-service-net

  kafka:
    image: confluentinc/cp-kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper
    networks:
      - user-service-net

networks:
  user-service-net:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
```

### 3.3 开发环境覆盖 `docker-compose.override.yml`

```yaml
# ✅ Development overrides: hot reload + xdebug
version: '3.8'
services:
  user-service:
    build:
      target: base
    volumes:
      - ./:/app  # ✅ Mount source for hot reload
    environment:
      - APP_ENV=development
```

### 3.4 初始化 SQL `docker/mysql/init.sql`

```sql
-- ✅ Database initialization script
CREATE DATABASE IF NOT EXISTS user_service;
USE user_service;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_points (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.5 .dockerignore

```
.git
runtime
vendor
node_modules
.env
docker-compose*.yml
Dockerfile
*.md
```

## 4. 执行预览

```bash
# Build and start all services
$ docker-compose up -d --build

# Check status
$ docker-compose ps
# NAME            STATUS         PORTS
# user-service    Up 30 seconds  0.0.0.0:9501->9501/tcp
# mysql           Up 30 seconds  0.0.0.0:3306->3306/tcp
# redis           Up 30 seconds  0.0.0.0:6379->6379/tcp
# kafka           Up 30 seconds  0.0.0.0:9092->9092/tcp

# Test registration
$ curl -X POST http://localhost:9501/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
{"code":0,"message":"Registration successful"}

# View logs
$ docker-compose logs -f user-service

# Stop all
$ docker-compose down
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 不在镜像中存密码 | 用 environment 或 .env | 镜像泄露密码 |
| 设置资源限制 | memory + cpus limits | 单容器吃光宿主机资源 |
| 健康检查必配 | HEALTHCHECK 或 healthcheck | 无法检测服务异常 |
| .dockerignore 要配好 | 排除 runtime/vendor | 构建慢，镜像大 |
| 生产不用 override | 分离开发/生产配置 | 开发配置带入生产 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 每次都 COPY 全部代码 | 构建缓存失效，极慢 | 先 COPY composer.json，再 COPY . |
| 不设 depends_on | 服务启动顺序混乱 | 用 depends_on + healthcheck |
| 容器内用 root | 安全风险 | Dockerfile 加 USER www-data |
| 不限制日志大小 | 磁盘被日志占满 | 加 logging driver + max-size |
| 端口冲突 | 多项目同时开发端口冲突 | 用不同端口或动态分配 |

## 7. 练习题

🟢 **基础题 1：** 为 docker-compose 添加 Elasticsearch 和 Kibana 服务。

🟢 **基础题 2：** 编写一个 Makefile 封装常用 docker-compose 命令。

🟡 **进阶题：** 实现多阶段构建：dev 阶段含 xdebug，prod 阶段精简。

🔴 **开放题：** 设计一个 CI/CD 流水线，自动构建 Docker 镜像并推送到镜像仓库。

## 8. 知识点总结

```
Docker + Compose
├── Dockerfile
│   ├── Multi-stage build
│   ├── Layer caching (composer first)
│   ├── HEALTHCHECK
│   └── .dockerignore
├── docker-compose.yml
│   ├── Services: user-service, mysql, redis, kafka
│   ├── Networks: user-service-net (bridge)
│   ├── Volumes: mysql_data, redis_data
│   ├── Health checks
│   └── Resource limits
├── Override file
│   └── dev: volume mount for hot reload
└── Best Practices
    ├── Secrets via environment
    ├── depends_on with condition
    ├── Non-root user
    └── Log size limits
```

## 9. 举一反三

| 场景 | 容器设计 | 关键配置 |
|------|----------|----------|
| 多服务共享 DB | 独立 MySQL 容器 | 多数据库 + 独立用户 |
| 前后端分离 | Nginx + API 容器 | Nginx 反向代理到 9501 |
| 定时任务 | 独立 cron 容器 | 挂载同代码 + entrypoint 为 crond |

## 10. 参考资料

- 🏆 [Docker 官方文档](https://docs.docker.com/)
- 🏆 [Docker Compose 文件参考](https://docs.docker.com/compose/compose-file/)
- ⭐ [PHP Docker 最佳实践](https://hub.docker.com/_/php)
- 📖 [Hyperf Docker 部署](https://hyperf.wiki/3.1/#/zh-cn/deploy/docker)

## 11. 代码演进

### v1 ❌ 手动部署
```bash
# ❌ Manual: install PHP, MySQL, Redis, Kafka on server
# No reproducibility, "works on my machine" problems
```

### v2 ✅ 单 Dockerfile
```dockerfile
FROM php:8.2-cli
# Everything in one image, no dependency orchestration
```

### v3 🟢 docker-compose 编排
```yaml
# 🟢 Full stack: app + mysql + redis + kafka
# One command: docker-compose up -d
# Dev/prod separation, health checks, resource limits
```
