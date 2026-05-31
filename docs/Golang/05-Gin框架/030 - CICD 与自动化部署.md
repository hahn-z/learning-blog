---
title: "030 - CI/CD 与自动化部署"
slug: "030-gin-ci-cd"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:18:18.914+08:00"
updated_at: "2026-04-29T10:02:45.833+08:00"
reading_time: 28
tags: []
---

# CI/CD 与自动化部署

> 难度：⭐⭐⭐（中级）
> 前置知识：Git 基础、Docker 基础、Linux 命令

## 一、概念讲解

CI/CD 是现代软件开发的标配。对于 Gin 应用，完整的 CI/CD 流水线包括：代码检查 → 测试 → 构建 Docker 镜像 → 推送镜像 → 部署。

**核心概念：**

| 概念 | 全称 | 说明 |
|------|------|------|
| CI | Continuous Integration | 代码合并时自动测试 |
| CD | Continuous Delivery/Deploy | 自动部署到生产环境 |
| Pipeline | 流水线 | CI/CD 的执行流程 |
| Stage | 阶段 | Pipeline 中的步骤 |
| Artifact | 产物 | 构建产生的可部署文件 |
| Registry | 镜像仓库 | Docker 镜像存储 |

**工具链选型：**

| 工具 | 用途 | 特点 |
|------|------|------|
| GitHub Actions | CI/CD 平台 | 免费、生态丰富 |
| Docker | 容器化 | 标准化构建和部署 |
| Docker Hub/GHCR | 镜像仓库 | 存储和分发镜像 |
| Kubernetes | 容器编排 | 自动扩缩、滚动更新 |

## 二、脑图

```
CI/CD for Gin
├── 代码质量
│   ├── go vet (静态检查)
│   ├── golangci-lint
│   ├── go test (单元测试)
│   └── 覆盖率检查
├── Docker
│   ├── Multi-stage build
│   ├── .dockerignore
│   ├── 镜像标签策略
│   └── 最小镜像 (scratch/alpine)
├── GitHub Actions
│   ├── Workflow 配置
│   ├── 触发条件
│   ├── Secrets 管理
│   └── Matrix 构建
├── 部署策略
│   ├── 滚动更新
│   ├── 蓝绿部署
│   ├── 金丝雀发布
│   └── 回滚机制
└── 版本管理
    ├── 语义化版本
    ├── Git Tag
    └── Changelog
```

## 三、完整代码

### v1：基础 Dockerfile + 简单测试

```dockerfile
# Dockerfile - Multi-stage build for Gin app
# Stage 1: Build
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server .

# Stage 2: Runtime (minimal image)
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app

# Run as non-root user
RUN adduser -D -g '' appuser
USER appuser

COPY --from=builder /app/server .
COPY --from=builder /app/configs ./configs

EXPOSE 8080
CMD ["./server"]
```

```dockerignore
# .dockerignore
.git
.github
*.md
tmp/
*.test
```

```go
// main.go - Simple Gin app
package main

import (
	"github.com/gin-gonic/gin"
)

func setupRouter() *gin.Engine {
	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})
	r.GET("/api/users", func(c *gin.Context) {
		c.JSON(200, gin.H{"users": []string{"Alice", "Bob"}})
	})
	return r
}

func main() {
	r := setupRouter()
	r.Run(":8080")
}
```

```go
// main_test.go - Unit tests
package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPingRoute(t *testing.T) {
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/ping", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "pong")
}

func TestUsersRoute(t *testing.T) {
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/users", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
```

### v2：GitHub Actions 完整流水线

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Job 1: Lint and Test
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Cache Go modules
        uses: actions/cache@v4
        with:
          path: ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}

      - name: Vet
        run: go vet ./...

      - name: Lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest

      - name: Test
        run: go test -v -race -coverprofile=coverage.out ./...

      - name: Coverage check
        run: |
          go tool cover -func=coverage.out
          # Fail if coverage below 60%
          COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "Coverage below 60%"
            exit 1
          fi

  # Job 2: Build and Push Docker Image
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=semver,pattern={{version}}
            latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 3: Deploy
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            docker stop gin-app || true
            docker rm gin-app || true
            docker run -d \
              --name gin-app \
              --restart unless-stopped \
              -p 8080:8080 \
              -e GIN_MODE=release \
              ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      - name: Health check
        run: |
          sleep 5
          curl -f http://${{ secrets.DEPLOY_HOST }}:8080/ping || exit 1

      - name: Notify success
        if: success()
        run: echo "Deploy successful!"
```

### v3：Kubernetes 部署 + 回滚策略

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gin-app
  labels:
    app: gin-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gin-app
  # Rolling update strategy
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Allow 1 extra pod during update
      maxUnavailable: 0  # Keep all pods available
  template:
    metadata:
      labels:
        app: gin-app
    spec:
      containers:
      - name: gin-app
        image: ghcr.io/your-org/gin-app:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        # Health checks
        livenessProbe:
          httpGet:
            path: /ping
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ping
            port: 8080
          initialDelaySeconds: 3
          periodSeconds: 5
        env:
        - name: GIN_MODE
          value: "release"
---
apiVersion: v1
kind: Service
metadata:
  name: gin-app-service
spec:
  selector:
    app: gin-app
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

```yaml
# .github/workflows/deploy-k8s.yml
name: Deploy to K8s

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set K8s context
        uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG }}

      - name: Deploy
        run: |
          # Update image tag
          sed -i "s|gin-app:latest|gin-app:${{ github.ref_name }}|g" k8s/deployment.yaml
          kubectl apply -f k8s/
          kubectl rollout status deployment/gin-app --timeout=120s

      - name: Verify
        run: |
          kubectl get pods -l app=gin-app
          kubectl get svc gin-app-service

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/gin-app
          echo "Rolled back to previous version"
```

```yaml
# docker-compose.yml - Local development
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - GIN_MODE=debug
    volumes:
      - ./configs:/app/configs
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/ping"]
      interval: 10s
      timeout: 5s
      retries: 3
```

## 四、执行预览

```bash
# Local test
go test -v ./...
# PASS
# coverage: 85.0% of statements

# Build and run locally
docker build -t gin-app:test .
docker run -p 8080:8080 gin-app:test

# Test running container
curl http://localhost:8080/ping
{"message":"pong"}

# Push to GitHub triggers CI
git tag v1.0.0
git push origin v1.0.0
# → GitHub Actions runs: test → build → deploy

# Check deployment
kubectl get pods
# gin-app-xxx   Running   0          30s

# Rollback if needed
kubectl rollout undo deployment/gin-app
```

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 多阶段构建 | 用 alpine 构建，scratch/alpine 运行，镜像更小 |
| 安全扫描 | CI 中加入 Trivy 等漏洞扫描 |
| Secrets | 永远不要硬编码，用 GitHub Secrets 或 Vault |
| 镜像标签 | 不要只用 latest，用 git sha 或 semver |
| 健康检查 | Dockerfile 和 K8s 都要配置 |
| 缓存 | 利用 Go module 缓存和 Docker layer 缓存加速构建 |

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| Dockerfile 用 `golang:latest` 运行 | 多阶段构建，运行用 alpine/scratch |
| CI 不跑测试 | 先测试再构建，覆盖率达到阈值才通过 |
| 用 `latest` 标签部署 | 用 git sha 或语义化版本 v1.2.3 |
| 没有回滚方案 | K8s `rollout undo` 或保留前一版本镜像 |
| 忽略 `.dockerignore` | 排除 `.git`、`tmp` 等，加速构建 |
| 容器用 root 运行 | 创建非 root 用户，最小权限原则 |

## 七、练习题

🟢 **初级：** 编写 Dockerfile 多阶段构建，镜像大小控制在 20MB 以内

🟡 **中级：** 配置 GitHub Actions：PR 触发测试 + lint，main 分支 push 自动构建推送镜像

🔴 **高级：** 实现 K8s 金丝雀发布：新版本先部署 1 个 Pod，验证通过后再全量发布

## 八、知识点总结

```
CI/CD for Gin
├── 代码质量
│   ├── go vet
│   ├── golangci-lint
│   └── go test + coverage
├── Docker
│   ├── Multi-stage build
│   ├── .dockerignore
│   ├── Non-root user
│   └── 健康检查
├── GitHub Actions
│   ├── Workflow (YAML)
│   ├── Jobs: test → build → deploy
│   ├── Secrets 管理
│   └── 缓存优化
├── 部署
│   ├── Docker run (简单)
│   ├── Docker Compose (本地)
│   ├── K8s Deployment (生产)
│   └── 滚动更新 + 回滚
└── 版本管理
    ├── Git Tag → 触发部署
    ├── 语义化版本 (semver)
    └── Changelog 自动生成
```

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 多环境（dev/staging/prod） | GitHub Environments + 不同 secrets |
| 私有镜像仓库 | Harbor / AWS ECR / Aliyun ACR |
| 自动生成 Changelog | `semantic-release` 或 `conventional-changelog` |
| 镜像漏洞扫描 | CI 中加 Trivy 步骤 |
| 数据库迁移 | CI 中加 migrate 步骤，部署前执行 |

## 十、参考资料

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/)
- [Kubernetes Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [golangci-lint](https://golangci-lint.run/)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | Dockerfile + 基础测试 | 本地开发、手动部署 |
| v2 | GitHub Actions 全流水线 | 中小团队自动化 |
| v3 | K8s + 滚动更新 + 回滚 | 生产级自动部署 |

---

*手动部署一次，后悔一辈子。* 🚀
