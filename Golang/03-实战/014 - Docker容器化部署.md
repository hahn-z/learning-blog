---
title: "014 - Docker容器化部署"
slug: "014-migration"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.357+08:00"
updated_at: "2026-04-29T10:02:44.994+08:00"
reading_time: 20
tags: ["数据库"]
---

# 069: Docker容器化部署

> **难度：⭐⭐⭐⭐ 高级** | Docker 是现代应用部署的标准方式，本文覆盖 Go 应用的 Dockerfile 最佳实践、镜像优化和 Compose 编排。
>
> **前置知识：** Go 编译基础、Linux 基本命令、网络基础
>
> **学习目标：** 掌握多阶段构建、镜像体积优化、docker-compose 多服务编排和环境配置注入。

## 概念讲解

Docker 容器化将应用及其依赖打包为可移植的镜像。对于 Go 应用，关键优势：

- **编译型语言天然适合容器化：** Go 编译产物是单个静态二进制，不需要运行时环境，镜像可以极小。
- **多阶段构建（Multi-stage Build）：** 构建阶段用完整 Go 镜像编译，运行阶段只用精简镜像（alpine/scratch/distroless），最终镜像不包含编译工具。
- **Docker Compose 编排：** 定义多服务（应用+数据库+缓存），一键启动完整开发/测试环境。
- **环境变量注入：** 容器不存储配置，通过环境变量或配置文件挂载注入，12-Factor App 核心原则。

### 基础镜像对比

| 基础镜像 | 大小 | 有Shell | CA证书 | 适用场景 |
|---------|------|--------|--------|---------|
| golang:1.22 | ~1.2GB | ✅ | ✅ | 仅构建阶段 |
| alpine:3.19 | ~7MB | ✅ | ✅ | 需要调试的生产环境 |
| distroless | ~2MB | ❌ | ✅ | 安全性要求高 |
| scratch | 0MB | ❌ | ❌ | 极致体积（需手动加CA） |

## 脑图

```
Docker容器化
├── Dockerfile
│   ├── 多阶段构建
│   ├── 镜像体积优化
│   └── 安全最佳实践
├── 基础镜像
│   ├── alpine (有shell)
│   ├── distroless (无shell)
│   └── scratch (空镜像)
├── Docker Compose
│   ├── 多服务编排
│   ├── 健康检查
│   ├── 依赖管理
│   └── 数据持久化
├── 配置管理
│   ├── 环境变量注入
│   └── .dockerignore
└── 日志与监控
    ├── stdout/stderr 输出
    ├── JSON 日志驱动
    └── 健康检查 (HEALTHCHECK)
```

## 代码演进

### v1：基础多阶段 Dockerfile

```dockerfile
# Dockerfile - Multi-stage build for Go application
# === Build Stage ===
FROM golang:1.22-alpine AS builder

# Set Go proxy for faster dependency download (China mirror)
ENV GOPROXY=https://goproxy.cn,direct

# Copy dependency files first for Docker layer caching
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

# Copy source and compile
COPY . .
# Static compile: no libc dependency, strip debug info
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

# === Runtime Stage ===
FROM alpine:3.19

# Install CA certs (HTTPS requests) and timezone data
RUN apk --no-cache add ca-certificates tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/configs ./configs

# Run as non-root user for security
RUN adduser -D appuser
USER appuser

EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
```

**关键参数说明：**
- `CGO_ENABLED=0`：静态编译，镜像不需要 glibc
- `-ldflags="-s -w"`：去掉符号表和调试信息，减小 20-30% 体积
- 先 COPY go.mod/go.sum 再 COPY 源码：依赖不变时跳过 `go mod download`

### v2：极致优化 + docker-compose

```dockerfile
# distroless version - minimal but secure
FROM gcr.io/distroless/static-debian12 AS runtime
COPY --from=builder /app/server /
EXPOSE 8080
CMD ["/server"]
```

```dockerfile
# scratch version - absolute minimum
FROM scratch
COPY --from=builder /app/server /server
# Must manually copy CA certs for HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/server"]
```

**docker-compose 多服务编排：**

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_USER=blog
      - DB_PASSWORD=blogpass
      - DB_NAME=blog
      - REDIS_ADDR=redis:6379
      - GIN_MODE=release
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 15s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: blog
      POSTGRES_PASSWORD: blogpass
      POSTGRES_DB: blog
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blog"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app

volumes:
  pgdata:
  redisdata:
```

### v3：配置管理 + 结构化日志

```go
// config/config.go - Environment-based configuration
package config

import "os"

type Config struct {
    DBHost     string
    DBUser     string
    DBPassword string
    DBName     string
    Port       string
}

// Load reads config from environment variables with fallbacks
func Load() *Config {
    return &Config{
        DBHost:     getEnv("DB_HOST", "localhost"),
        DBUser:     getEnv("DB_USER", "blog"),
        DBPassword: getEnv("DB_PASSWORD", ""),
        DBName:     getEnv("DB_NAME", "blog"),
        Port:       getEnv("PORT", "8080"),
    }
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}
```

```go
// Structured JSON logging to stdout for container log collection
package main

import (
    "log/slog"
    "os"
)

func main() {
    // JSON format for ELK/Loki collection
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
    slog.SetDefault(logger)

    slog.Info("server started", "port", 8080, "env", "production")
}
```

**.dockerignore：**

```
.git
.gitignore
*.md
vendor/
tmp/
*.test
.env
```

## 执行预览

```
# Build and run
$ docker build -t blog-api .
[+] Building 45.2s
 => [builder 1/5] FROM golang:1.22-alpine
 => [builder 3/5] COPY go.mod go.sum
 => [builder 4/5] RUN go mod download
 => [builder 5/5] RUN CGO_ENABLED=0 go build ...
 => [runtime 1/3] COPY --from=builder /app/server

$ docker images blog-api
REPOSITORY  TAG       SIZE
blog-api    latest    12MB     # alpine runtime
blog-api    scratch   6.2MB    # scratch runtime

# Compose up
$ docker-compose up -d
[+] Running 4/4
 ✔ Container blog-postgres-1  Started
 ✔ Container blog-redis-1     Started
 ✔ Container blog-app-1       Started
 ✔ Container blog-nginx-1     Started

# Check health
$ docker ps
blog-app-1   Up 30s (healthy)   0.0.0.0:8080->8080/tcp
blog-postgres  Up 30s (healthy) 5432/tcp
```

## 注意事项

| 项目 | 说明 | 严重度 |
|------|------|--------|
| 不要存敏感信息到镜像 | 密码密钥用环境变量或 Docker Secrets | 🔴 严重 |
| 利用构建缓存 | 先 COPY go.mod/go.sum 再 COPY 源码 | ⚠️ 重要 |
| .dockerignore 必不可少 | 排除 .git、vendor、*.md 等 | 💡 提示 |
| 固定镜像版本 | 用 alpine:3.19 而非 alpine:latest | ⚠️ 重要 |
| 非 root 运行 | 创建 appuser，不用 root 跑应用 | ⚠️ 重要 |
| 日志输出到 stdout | 容器化应用不要写日志文件 | 💡 提示 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用 `golang:latest` 做运行镜像 | 多阶段构建，运行用 alpine/scratch |
| 把 `.env` 文件 COPY 进镜像 | 用 `env_file` 或 `environment` 注入 |
| 不设 HEALTHCHECK | 编排工具无法判断容器健康状态 |
| `COPY . .` 在 `go mod download` 之前 | 先复制依赖文件利用缓存 |
| 用 `latest` 标签部署生产 | 用语义版本号 `v1.2.3` |
| 日志写文件挂载 volume | 输出到 stdout，用 Docker 日志驱动收集 |

## 练习题

**🟢 入门：编写多阶段 Dockerfile**
为一个使用 SQLite 的 Go Web 应用编写 Dockerfile，要求最终镜像小于 20MB，含 HEALTHCHECK。

**🟡 进阶：docker-compose 三服务编排**
Go 应用 + MySQL + Redis。MySQL 有健康检查，应用等待 MySQL 就绪后启动，数据持久化到 volume。

**🔴 挑战：镜像体积极致优化**
对比 golang:alpine、distroless、scratch 三种基础镜像的构建产物。为每种编写 Dockerfile，分析优缺点和适用场景，最终用 scratch 构建 < 10MB 的镜像。

## 知识点总结

```
Docker容器化
├── Dockerfile
│   ├── FROM ... AS builder (多阶段)
│   ├── CGO_ENABLED=0 (静态编译)
│   ├── -ldflags="-s -w" (去调试)
│   └── COPY --from=builder
├── 基础镜像选择
│   ├── alpine: 有shell可调试
│   ├── distroless: 安全无shell
│   └── scratch: 极致小
├── Docker Compose
│   ├── services 定义
│   ├── depends_on + healthcheck
│   ├── volumes 持久化
│   └── logging 配置
├── 配置
│   ├── 环境变量注入
│   ├── .dockerignore
│   └── 非 root 用户
└── 最佳实践
    ├── HEALTHCHECK
    ├── stdout 日志
    └── 固定版本标签
```

## 举一反三

| 本文学到 | 可迁移到 | 应用场景 |
|---------|---------|---------|
| 多阶段构建 | Rust、C++、Java | 任何编译型语言容器化 |
| 健康检查 | K8s liveness/readiness | 容器编排故障检测 |
| 环境变量注入 | 12-Factor App | 任何云原生应用 |
| docker-compose | K8s Helm | 本地开发环境搭建 |
| 镜像体积优化 | Wasm、静态站点 | 边缘计算、CI/CD 速度 |
| 日志 JSON 格式 | Fluentd/Loki | 集中式日志收集 |

## 参考资料

- [Docker 官方最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [distroless 项目](https://github.com/GoogleContainerTools/distroless)
- [12-Factor App](https://12factor.net/)

---

_多阶段构建 + 精简镜像 + Compose 编排，Go 容器化三部曲。_ 🐳
