---
title: "025 - Gin Docker 容器化部署"
slug: "025-gin-docker"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:13:51.272+08:00"
updated_at: "2026-04-29T10:02:45.779+08:00"
reading_time: 37
tags: []
---

# 025 - Gin Docker 容器化部署

> **难度：** ⭐⭐⭐（较高）
> **前置知识：** Docker 基础、Dockerfile 语法、docker-compose 基础
> **预计阅读时间：** 25 分钟

---

## 一、概念讲解

Docker 容器化是现代应用部署的标准方式。通过 Docker，我们可以将 Gin 应用和它的所有依赖（MySQL、Redis、Nginx）打包成可移植的容器，确保开发、测试、生产环境完全一致。

**容器化的核心价值：**

| 价值 | 说明 |
|------|------|
| 环境一致 | "在我机器上能跑"永远不再是问题 |
| 快速部署 | 秒级启动，不用装依赖 |
| 资源隔离 | CPU/内存限制，互不影响 |
| 弹性伸缩 | docker-compose scale 或 K8s HPA |
| CI/CD 友好 | 镜像即制品，Pipeline 天然支持 |

**多阶段构建原理：**

```
Stage 1: Builder (Go 编译环境)
├── 安装依赖: go mod download
├── 编译二进制: go build -o app
└── 输出: /app 可执行文件

Stage 2: Runtime (精简运行环境)
├── 从 Builder 复制 /app
├── 复制配置文件、静态资源
├── 设置 ENTRYPOINT
└── 最终镜像: ~20MB (Alpine)
```

---

## 二、脑图

```
Docker 容器化部署
├── Dockerfile
│   ├── 多阶段构建 (builder → runtime)
│   ├── Alpine 基础镜像
│   ├── 非 root 用户
│   └── .dockerignore 优化
├── docker-compose
│   ├── App + MySQL + Redis
│   ├── 服务依赖 (depends_on)
│   ├── 健康检查 (healthcheck)
│   └── 数据卷 (volumes)
├── 环境变量注入
│   ├── .env 文件
│   ├── docker-compose environment
│   └── 运行时覆盖
├── 健康检查
│   ├── HEALTHCHECK 指令
│   ├── curl / wget 探针
│   └── compose healthcheck
├── 镜像优化
│   ├── 多阶段构建减小体积
│   ├── 层缓存利用
│   └── Alpine vs Scratch
└── Docker 网络
    ├── bridge 默认网络
    ├── 自定义网络 DNS
    └── 端口映射策略
```

---

## 三、完整代码

### v1：单容器 Dockerfile

```dockerfile
# Dockerfile - Multi-stage build for Gin application
# Stage 1: Build
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Cache dependency layer
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /app main.go

# Stage 2: Runtime
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

# Create non-root user for security
RUN adduser -D -g '' appuser

WORKDIR /app

# Copy binary and config from builder
COPY --from=builder /app .
COPY --from=builder /build/configs ./configs

# Use non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./app"]
```

```go
// main.go - v1 simple Gin app for Docker
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	mode := os.Getenv("GIN_MODE")
	if mode == "" {
		mode = "release"
	}
	gin.SetMode(mode)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"version": "1.0.0",
		})
	})

	r.GET("/api/hello", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Hello from Docker!",
			"host":    hostname(),
		})
	})

	log.Printf("Server starting on :%s", port)
	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}
```

```bash
# .dockerignore - exclude unnecessary files
/*
!main.go
!go.mod
!go.sum
!configs/
!handlers/
!models/
!middleware/
```

### v2：docker-compose 编排（App + MySQL + Redis）

```yaml
# docker-compose.yml - Full stack deployment
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: myapp-api
    ports:
      - "8080:8080"
    environment:
      - APP_PORT=8080
      - GIN_MODE=release
      - APP_ENV=prod
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=myapp
      - DB_PASSWORD=${DB_PASSWORD:-changeme}
      - DB_NAME=myapp
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD:-}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    networks:
      - app-network

  mysql:
    image: mysql:8.0
    container_name: myapp-mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD:-rootpw}
      - MYSQL_DATABASE=myapp
      - MYSQL_USER=myapp
      - MYSQL_PASSWORD=${DB_PASSWORD:-changeme}
    volumes:
      - mysql-data:/var/lib/mysql
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-}
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

volumes:
  mysql-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

```go
// main.go - v2 with DB and Redis connections
package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

var db *sql.DB
var rdb *redis.Client

func main() {
	// Connect to MySQL
	var err error
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		env("DB_USER", "root"),
		env("DB_PASSWORD", ""),
		env("DB_HOST", "localhost"),
		env("DB_PORT", "3306"),
		env("DB_NAME", "myapp"),
	)
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("DB open failed: %v", err)
	}
	db.SetMaxOpenConns(100)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(time.Hour)
	defer db.Close()

	// Connect to Redis
	rdb = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", env("REDIS_HOST", "localhost"), env("REDIS_PORT", "6379")),
	})
	defer rdb.Close()

	gin.SetMode(env("GIN_MODE", "release"))
	r := gin.Default()

	r.GET("/health", healthCheck)
	r.GET("/api/users", listUsers)

	log.Printf("Starting on :%s", env("APP_PORT", "8080"))
	r.Run(fmt.Sprintf(":%s", env("APP_PORT", "8080")))
}

func healthCheck(c *gin.Context) {
	// Check DB
	dbStatus := "ok"
	if err := db.Ping(); err != nil {
		dbStatus = err.Error()
	}
	// Check Redis
	redisStatus := "ok"
	if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
		redisStatus = err.Error()
	}

	status := http.StatusOK
	if dbStatus != "ok" || redisStatus != "ok" {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"status": "ok",
		"db":     dbStatus,
		"redis":  redisStatus,
	})
}

func listUsers(c *gin.Context) {
	rows, err := db.Query("SELECT id, name, email FROM users LIMIT 10")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type User struct {
		ID    int    `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	var users []User
	for rows.Next() {
		var u User
		rows.Scan(&u.ID, &u.Name, &u.Email)
		users = append(users, u)
	}
	c.JSON(http.StatusOK, users)
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
```

```ini
# .env file (do NOT commit to git)
DB_PASSWORD=my_secure_password
DB_ROOT_PASSWORD=root_secure_password
REDIS_PASSWORD=redis_secure_password
```

### v3：优化镜像 + Nginx 反向代理 + 多环境

```dockerfile
# Dockerfile - v3 optimized production image
# Stage 1: Build with cache mounts
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Dependency cache layer
COPY go.mod go.sum ./
RUN go mod download

# Build with cache mount for faster rebuilds
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X main.version=${VERSION:-dev}" \
    -o /app main.go

# Stage 2: Scratch-based minimal image (no shell, ~10MB)
FROM scratch

# Copy CA certs and timezone from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy binary
COPY --from=builder /app /app
COPY --from=builder /build/configs /app/configs

# Set timezone
ENV TZ=Asia/Shanghai

EXPOSE 8080

ENTRYPOINT ["/app"]
```

```yaml
# docker-compose.yml - v3 with Nginx reverse proxy
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    container_name: myapp-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      app:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - VERSION=${VERSION:-1.0.0}
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
        reservations:
          cpus: "0.1"
          memory: 64M
    environment:
      - APP_PORT=8080
      - GIN_MODE=release
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=myapp
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=myapp
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 15s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    networks:
      - app-network

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: myapp
      MYSQL_USER: myapp
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

volumes:
  mysql-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app_backend {
        server app:8080;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://app_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://app_backend/health;
            access_log off;
        }
    }
}
```

```yaml
# docker-compose.dev.yml - Development overrides
version: "3.8"
services:
  app:
    build:
      target: builder  # stop at build stage for debugging
    volumes:
      - .:/build  # mount source for hot reload
    environment:
      - GIN_MODE=debug
      - APP_ENV=dev
    ports:
      - "8080:8080"
      - "2345:2345"  # Delve debugger port
```

---

## 四、执行预览

```bash
# v1: Single container
$ docker build -t myapp:v1 .
$ docker run -d -p 8080:8080 --name myapp myapp:v1
$ curl http://localhost:8080/health
# {"status":"ok","version":"1.0.0"}
$ docker logs myapp
# Server starting on :8080

# v2: Full stack
$ docker-compose up -d
# Creating myapp-mysql ... done
# Creating myapp-redis ... done
# Creating myapp-api   ... done
$ docker-compose ps
# NAME           STATUS         PORTS
# myapp-api      Up (healthy)   0.0.0.0:8080->8080/tcp
# myapp-mysql    Up (healthy)   0.0.0.0:3306->3306/tcp
# myapp-redis    Up (healthy)   0.0.0.0:6379->6379/tcp

# v3: Production with Nginx
$ VERSION=2.0.0 docker-compose up -d --build
# Creating myapp-nginx ... done
# Creating myapp-app-1 ... done
# Creating myapp-app-2 ... done (2 replicas)
$ curl http://localhost/health
# {"status":"ok","db":"ok","redis":"ok"}

# Check image size
$ docker images myapp
# myapp  latest  ...  12MB  (scratch-based)

# Dev mode with hot reload
$ docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| .env 文件安全 | 包含密码，必须加入 `.gitignore`，提供 `.env.example` |
| 健康检查必要性 | Docker/K8s 依赖健康检查判断服务是否可用 |
| 资源限制 | 生产环境必须设 CPU/内存上限，防止一个容器吃光资源 |
| 时区设置 | 默认 UTC，需要显式设置 Asia/Shanghai |
| 日志输出 | 容器内日志打到 stdout/stderr，由 Docker 日志驱动收集 |
| 数据持久化 | MySQL/Redis 数据必须挂载 volume，否则容器重建数据丢失 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用 `golang:latest` 做最终镜像（1GB+） | 多阶段构建，runtime 用 `alpine` 或 `scratch`（10-20MB） |
| 把密码写死在 docker-compose.yml | 用 `.env` 文件 + `${VAR}` 变量引用 |
| 不设 HEALTHCHECK | 必须配置健康检查，否则编排系统无法判断服务状态 |
| `COPY . .` 不加 `.dockerignore` | 配置 `.dockerignore` 排除 `.git`、`vendor`、`node_modules` 等 |
| 容器内用 root 运行 | 创建非 root 用户 `USER appuser` |
| 不限制容器资源 | `deploy.resources.limits` 设 CPU/内存上限 |

---

## 七、练习题

### 🟢 基础题
1. 编写 Dockerfile，使用多阶段构建，最终镜像基于 Alpine，编译一个简单的 Gin 应用
2. 配置 `.dockerignore`，排除所有非必要文件

### 🟡 进阶题
3. 编写 docker-compose.yml，编排 App + MySQL + Redis，配置健康检查和依赖关系
4. 实现 Nginx 反向代理，负载均衡到 2 个 App 实例

### 🔴 挑战题
5. 实现 CI/CD Pipeline：代码推送 → 自动构建镜像 → 推送到 Registry → 自动部署

---

## 八、知识点总结

```
Gin Docker 容器化
├── 1. Dockerfile
│   ├── 多阶段: builder (golang) → runtime (alpine/scratch)
│   ├── 优化: go mod download 独立层
│   ├── 安全: 非 root 用户
│   └── .dockerignore 减小构建上下文
├── 2. docker-compose
│   ├── services: app + mysql + redis + nginx
│   ├── depends_on: condition service_healthy
│   ├── volumes: 数据持久化
│   └── networks: 服务间通信
├── 3. 环境变量
│   ├── .env 文件
│   ├── ${VAR:-default} 默认值
│   └── docker-compose override
├── 4. 健康检查
│   ├── HEALTHCHECK 指令
│   ├── wget/curl 探针
│   └── interval/timeout/retries
├── 5. 镜像优化
│   ├── 多阶段构建 → 10-20MB
│   ├── 层缓存利用
│   ├── -ldflags="-w -s" 去调试信息
│   └── scratch vs alpine
└── 6. 网络
    ├── bridge 默认网络
    ├── 服务名 DNS 解析
    └── 端口映射策略
```

---

## 九、举一反三

| 场景 | 方案 |
|------|------|
| Kubernetes 部署 | 编写 Deployment + Service + Ingress YAML |
| 自动扩缩容 | K8s HPA 基于 CPU/内存/自定义指标 |
| 镜像安全扫描 | Trivy / Snyk 扫描镜像漏洞 |
| 蓝绿部署 | 双版本镜像 + Nginx 切换 upstream |
| 日志收集 | Fluentd/Filebeat → Elasticsearch → Kibana |
| 多架构镜像 | `docker buildx` 支持 ARM64 + AMD64 |

---

## 十、参考资料

- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [docker-compose 官方文档](https://docs.docker.com/compose/)
- [Docker 最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Alpine Linux Docker 镜像](https://hub.docker.com/_/alpine)

---

## 十一、代码演进

| 版本 | 变化 |
|------|------|
| **v1** | 单容器 Dockerfile + 多阶段构建 + 健康检查 |
| **v2** | docker-compose 编排 App+MySQL+Redis + 环境变量 + 数据卷 |
| **v3** | Scratch 镜像优化 + Nginx 反向代理 + 多副本负载均衡 + 资源限制 + 开发覆盖 |

> **下一步建议：** 编写 Kubernetes Deployment YAML，实现自动化 CI/CD 流水线和蓝绿部署策略。
