---
title: "024-Docker容器化部署"
slug: "024-kratos-docker"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:11:07.053+08:00"
updated_at: "2026-04-29T10:02:45.462+08:00"
reading_time: 19
tags: []
---


# 024-Docker容器化部署

> 难度：⭐⭐⭐（中级）
>
> 本文讲解 Kratos 微服务的 Docker 容器化部署，从多阶段构建到 docker-compose 编排，涵盖健康检查、环境配置和 Kubernetes 扩展。

---

## 一、概念讲解

### 1.1 为什么容器化？

- **一致性**：开发、测试、生产环境完全一致
- **隔离性**：服务间互不干扰
- **可扩展**：配合 K8s 实现自动伸缩
- **部署快**：秒级启动，回滚迅速

### 1.2 多阶段构建

Go 编译后的二进制文件是静态链接的，最终镜像可以基于 `scratch` 或 `distroless`，大小仅 10-20MB。构建阶段使用 `golang` 镜像编译，运行阶段只拷贝二进制。

### 1.3 Kratos 健康检查

Kratos 内置 `grpc.health.v1.Health` 服务，Docker 和 K8s 可以通过 gRPC 健康检查探针检测服务状态。

---

## 二、脑图

```
Docker容器化
├── Dockerfile
│   ├── 多阶段构建
│   ├── 静态编译
│   └── scratch/distroless
├── Docker Compose
│   ├── 服务编排
│   ├── 依赖管理
│   └── 网络配置
├── 环境配置
│   ├── 环境变量
│   ├── 配置文件挂载
│   └── .env 文件
├── 健康检查
│   ├── HTTP /healthz
│   ├── gRPC health probe
│   └── readiness/liveness
└── Kubernetes
    ├── Deployment
    ├── Service
    └── ConfigMap/Secret
```

---

## 三、完整代码

### v1: 多阶段 Dockerfile

```dockerfile
# Dockerfile - Multi-stage build for Kratos service

# ============ Build Stage ============
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary with optimizations
# -ldflags: strip debug info and set version
# CGO_ENABLED=0: static linking
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=$(git describe --tags --always)" \
    -o /app/bin/server ./cmd/server

# ============ Runtime Stage ============
FROM gcr.io/distroless/static-debian12:nonroot

# Copy binary and configs from builder
COPY --from=builder /app/bin/server /app/server
COPY --from=builder /app/configs /app/configs

WORKDIR /app

# Expose HTTP and gRPC ports
EXPOSE 8000 9000

# Run as non-root user (distroless includes nonroot user)
USER nonroot:nonroot

ENTRYPOINT ["/app/server"]
CMD ["-conf", "/app/configs"]
```

### v2: Docker Compose 完整编排

```yaml
# docker-compose.yml
version: "3.8"

services:
  # Kratos user service
  user-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"  # HTTP
      - "9000:9000"  # gRPC
    environment:
      - APP_ENV=production
      - DATABASE_HOST=mysql
      - DATABASE_PORT=3306
      - DATABASE_USER=root
      - DATABASE_PASSWORD=secret
      - DATABASE_NAME=kratos_demo
      - REDIS_ADDR=redis:6379
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "grpc_health_probe", "-addr=:9000"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - backend
    restart: unless-stopped

  # MySQL database
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_DATABASE: kratos_demo
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  # Redis cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - backend

  # gRPC health probe (utility container for debugging)
  grpc-health-probe:
    image: grpc_health_probe:latest
    build:
      context: ./docker/grpc-health-probe
    profiles:
      - debug

networks:
  backend:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
```

### v2: 环境配置

```yaml
# configs/config.yaml - Kratos config template
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 10s
  grpc:
    addr: 0.0.0.0:9000
    timeout: 10s

database:
  driver: mysql
  source: "${DATABASE_USER}:${DATABASE_PASSWORD}@tcp(${DATABASE_HOST}:${DATABASE_PORT})/${DATABASE_NAME}?charset=utf8mb4&parseTime=True"

redis:
  addr: "${REDIS_ADDR}"
  read_timeout: 0.2s
  write_timeout: 0.2s
```

### v3: Kubernetes 部署

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: registry.example.com/user-service:latest
          ports:
            - containerPort: 8000  # HTTP
            - containerPort: 9000  # gRPC
          env:
            - name: APP_ENV
              value: production
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
          livenessProbe:
            exec:
              command: ["grpc_health_probe", "-addr=:9000"]
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["grpc_health_probe", "-addr=:9000"]
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - name: http
      port: 8000
    - name: grpc
      port: 9000
  type: ClusterIP
```

```yaml
# k8s/health-check.yaml - Kratos health server config
# In your Kratos server setup, enable health checks:
# grpc_health_v1.RegisterHealthServer(server, health.NewServer())
```

---

## 四、执行预览

```bash
# Build and run with docker-compose
$ docker-compose up -d --build
[+] Building 45.2s
[+] Running 4/4
 ✔ Network backend    Created
 ✔ Container mysql     Healthy
 ✔ Container redis     Started
 ✔ Container user-service  Started

# Check health
$ docker exec user-service grpc_health_probe -addr=:9000
status: SERVING

# View logs
$ docker-compose logs -f user-service
user-service | INFO msg=server started http=:8000 grpc=:9000

# Scale horizontally
$ docker-compose up -d --scale user-service=3
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 镜像大小 | 使用 distroless/scratch，目标 < 30MB |
| 非 root 运行 | 始终使用 `USER nonroot` |
| 构建缓存 | 先 COPY go.mod/go.sum，利用 Docker 层缓存 |
| 健康检查 | 必须配置，否则编排器无法判断服务状态 |
| 敏感信息 | 密码/密钥用 Docker Secret 或 K8s Secret |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 单阶段构建，镜像 1GB+ | 多阶段构建，最终镜像 < 30MB |
| 用 `latest` tag 部署 | 用 Git SHA 或语义版本 tag |
| 配置硬编码在镜像中 | 环境变量 + 挂载配置文件 |
| 不设健康检查 | 配置 liveness + readiness probe |
| 所有服务同一网络 | 按职责划分网络（frontend/backend） |
| 忽略 .dockerignore | 添加 `.dockerignore` 排除 `.git` 等 |

---

## 七、练习题

🟢 **初级：** 编写多阶段 Dockerfile，构建并运行 Kratos 服务。

🟡 **中级：** 编写 docker-compose.yml 编排 Kratos 服务 + MySQL + Redis，配置健康检查。

🔴 **高级：** 编写 Kubernetes Deployment + Service + HPA，实现自动伸缩。

---

## 八、知识点总结

```
容器化部署
├── 构建
│   ├── 多阶段 Dockerfile
│   ├── 静态编译 (CGO_ENABLED=0)
│   └── distroless 基础镜像
├── 编排
│   ├── Docker Compose (开发)
│   └── Kubernetes (生产)
├── 配置
│   ├── 环境变量注入
│   ├── 配置文件挂载
│   └── Secret 管理
├── 健康检查
│   ├── HTTP /healthz
│   └── gRPC health probe
└── 优化
    ├── .dockerignore
    ├── 层缓存优化
    └── 镜像瘦身
```

---

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 多服务编排 | Docker Compose 或 K8s Helm Chart |
| CI/CD 集成 | GitHub Actions 构建 + 推送镜像 |
| 私有镜像仓库 | Harbor / 阿里云 ACR |
| 配置中心 | Nacos / Apollo 集成 |
| 日志收集 | Fluentd + Elasticsearch |

---

## 十、参考资料

- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [gRPC Health Checking Protocol](https://grpc.io/docs/guides/health-checking/)
- [Kratos 部署文档](https://go-kratos.dev/docs/getting-started/usage)

---

## 十一、代码演进

| 版本 | 变化 |
|------|------|
| v1 | 多阶段 Dockerfile，distroless 镜像 |
| v2 | Docker Compose 编排 + 环境配置 + 健康检查 |
| v3 | Kubernetes Deployment + Service + HPA + Secret |
