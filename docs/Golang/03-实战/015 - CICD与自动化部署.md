---
title: "015 - CI/CD与自动化部署"
slug: "015-pagination"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.38+08:00"
updated_at: "2026-04-29T10:02:45.001+08:00"
reading_time: 24
tags: ["数据库"]
---

# 070: CI/CD与自动化部署

> **难度：⭐⭐⭐⭐⭐ 专家级** | CI/CD 是现代软件交付的流水线，本文覆盖 GitHub Actions、Docker 构建、Kubernetes 部署和 Helm 包管理。
>
> **前置知识：** Docker 容器化（069篇）、Git 基础、基本 Linux 运维
>
> **学习目标：** 掌握 GitHub Actions CI 流水线、Docker 镜像自动化构建推送、K8s 部署清单编写和 Helm Chart 管理。

## 概念讲解

CI/CD（Continuous Integration / Continuous Deployment）自动化软件交付流程：

- **CI（持续集成）：** 每次代码提交自动触发：lint → test → build。确保代码质量，尽早发现问题。
- **CD（持续部署）：** CI 通过后自动构建 Docker 镜像、推送到镜像仓库、部署到 K8s 集群。实现从代码到生产的全自动。
- **GitHub Actions：** GitHub 内置的 CI/CD 平台，用 YAML 定义工作流，丰富的社区 Actions 市场。
- **Kubernetes 部署：** 声明式 API 定义应用运行状态，自动滚动更新、故障自愈、弹性伸缩。
- **Helm：** K8s 的包管理器，用模板化方式管理部署清单，支持多环境差异化配置。

### 版本标签策略

```
v1.2.3
│ │ │
│ │ └── Patch: Bug 修复（向后兼容）
│ └──── Minor: 新功能（向后兼容）
└────── Major: 破坏性变更
```

Git Tag → Docker 镜像标签映射：`v1.2.3` → `ghcr.io/app:v1.2.3`, `ghcr.io/app:1.2`, `ghcr.io/app:sha-a1b2c3d`

## 脑图

```
CI/CD与自动化部署
├── GitHub Actions
│   ├── CI 流水线 (lint/test/build)
│   ├── Docker 镜像构建
│   ├── 缓存优化
│   └── 触发条件 (push/tag/PR)
├── Docker 镜像
│   ├── 多架构构建 (buildx)
│   ├── 镜像标签策略
│   └── GHCR 推送
├── Kubernetes
│   ├── Deployment (滚动更新)
│   ├── Service (服务暴露)
│   ├── ConfigMap / Secret
│   ├── 蓝绿部署 vs 滚动更新
│   └── 资源限制 (requests/limits)
└── Helm
    ├── Chart 结构
    ├── values.yaml
    ├── 模板化
    └── 多环境管理
```

## 代码演进

### v1：GitHub Actions CI 流水线

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      # Cache Go modules for faster builds
      - name: Cache Go modules
        uses: actions/cache@v4
        with:
          path: ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
          restore-keys: |
            ${{ runner.os }}-go-

      - name: Lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest

      - name: Test with coverage
        run: |
          go test -race -coverprofile=coverage.out ./...
          go tool cover -func=coverage.out

      - name: Build
        run: CGO_ENABLED=0 go build -ldflags="-s -w" -o app ./cmd/server

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage.out
```

### v2：Docker 镜像构建 + K8s 部署清单

```yaml
# .github/workflows/deploy.yml - Build and push Docker image on tag
name: Build & Deploy

on:
  push:
    tags: ['v*']

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Docker metadata (auto tags)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Kubernetes 部署清单：**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blog-api
  labels:
    app: blog-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blog-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max 1 extra pod during update
      maxUnavailable: 0   # Keep all pods available
  template:
    metadata:
      labels:
        app: blog-api
    spec:
      containers:
        - name: blog-api
          image: ghcr.io/example/blog-api:v1.2.3
          ports:
            - containerPort: 8080
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: blog-config
                  key: db_host
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: blog-secrets
                  key: db_password
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 5
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: blog-api
spec:
  selector:
    app: blog-api
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: blog-config
data:
  db_host: "postgres-service"
  gin_mode: "release"
```

### v3：Helm Chart 多环境管理

```yaml
# helm/blog/Chart.yaml
apiVersion: v2
name: blog-api
version: 1.0.0
appVersion: "1.2.3"
```

```yaml
# helm/blog/values.yaml - Default values (production)
replicaCount: 3
image:
  repository: ghcr.io/example/blog-api
  tag: "1.2.3"
  pullPolicy: IfNotPresent

resources:
  requests:
    memory: 128Mi
    cpu: 100m
  limits:
    memory: 256Mi
    cpu: 500m

service:
  type: ClusterIP
  port: 80
```

```yaml
# helm/blog/values-dev.yaml - Dev overrides
replicaCount: 1
image:
  tag: "main-latest"
  pullPolicy: Always
resources:
  requests:
    memory: 64Mi
    cpu: 50m
  limits:
    memory: 128Mi
    cpu: 250m
```

```yaml
# helm/blog/templates/deployment.yaml - Templated deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: 8080
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

```bash
# Helm commands
helm install blog-api ./helm/blog                      # Install with default (prod)
helm install blog-api ./helm/blog -f values-dev.yaml   # Install with dev overrides
helm upgrade blog-api ./helm/blog                      # Upgrade
helm rollback blog-api 1                               # Rollback to revision 1
helm list                                              # List releases
helm uninstall blog-api                                # Uninstall
```

### 部署策略对比

| 策略 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 滚动更新（默认） | 逐步替换旧 Pod | 资源效率高 | 新旧版本短暂共存 |
| 蓝绿部署 | 两套环境切换 Service | 瞬间切换，回滚快 | 需要双倍资源 |
| 金丝雀发布 | 少量流量先到新版本 | 风险可控 | 需要流量管理工具 |

## 执行预览

```
# Git push triggers CI
$ git push origin main
remote: → CI workflow triggered
Actions: ✅ Lint (12s) → ✅ Test (45s) → ✅ Build (8s)

# Git tag triggers deploy
$ git tag v1.2.3 && git push origin v1.2.3
Actions: ✅ Build Docker → ✅ Push to ghcr.io
  Tags: ghcr.io/example/blog-api:v1.2.3, ghcr.io/example/blog-api:1.2, ghcr.io/example/blog-api:sha-a1b2c3d

# Helm deploy
$ helm upgrade blog-api ./helm/blog
Release "blog-api" has been upgraded. Happy Helming!

$ helm status blog-api
STATUS: deployed
REVISION: 3
```

## 注意事项

| 项目 | 说明 | 严重度 |
|------|------|--------|
| Secret 不明文存 Git | 用 Sealed Secrets 或 External Secrets Operator | 🔴 严重 |
| 镜像拉取策略 | 生产用 `IfNotPresent`，开发用 `Always` | ⚠️ 重要 |
| 资源限制必须设 | 防止一个 Pod 吃光节点资源 | 🔴 严重 |
| CI 缓存加速 | Go module 缓存 + Docker layer 缓存 | 💡 提示 |
| liveness vs readiness | liveness 判死重启，ready 控制流量，不要混淆 | ⚠️ 重要 |
| 测试覆盖率门槛 | 低于阈值 CI 失败，防止质量退化 | 💡 提示 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| Secret 明文写在 YAML 里提交 Git | 用 Sealed Secrets 加密或 External Secrets Operator |
| 不设 resources.limits | 必须设 requests 和 limits，防止资源争抢 |
| livenessProbe 和 readinessProbe 用同一个检查 | liveness 用 `/healthz`，readiness 用 `/ready`，避免误杀 |
| CI 里不缓存依赖 | 利用 `actions/cache` 缓存 Go modules 和 Docker layers |
| `imagePullPolicy: Always` 上生产 | 用 `IfNotPresent` 减少拉取，配合固定版本标签 |
| Helm values 里硬编码所有配置 | 用 `values-dev.yaml`、`values-prod.yaml` 分环境管理 |

## 练习题

**🟢 入门：编写完整 GitHub Actions CI**
为 Go 项目编写 CI 工作流：lint → test → build。要求使用缓存加速，测试覆盖率低于 60% 则失败。

**🟡 进阶：K8s 部署清单全套**
为 Go gRPC 服务编写 Deployment + Service + ConfigMap + Secret。要求包含资源限制、liveness/readiness 双探针。

**🔴 挑战：创建 Helm Chart 多环境管理**
将 K8s 清单转换为 Helm Chart，通过 `values-dev.yaml`、`values-staging.yaml`、`values-prod.yaml` 支持三环境差异化配置（副本数、资源、镜像标签）。

## 知识点总结

```
CI/CD与自动化部署
├── GitHub Actions
│   ├── workflow 触发条件
│   ├── Jobs/Steps 编排
│   ├── Actions 市场 (checkout/setup-go)
│   └── 缓存优化
├── Docker 镜像
│   ├── buildx 多架构
│   ├── metadata-action 标签
│   └── GHCR 推送
├── Kubernetes
│   ├── Deployment (滚动更新)
│   ├── Service (ClusterIP)
│   ├── ConfigMap (配置)
│   ├── Secret (敏感数据)
│   ├── 资源限制 (requests/limits)
│   └── 探针 (liveness/readiness)
└── Helm
    ├── Chart.yaml
    ├── values.yaml + 环境覆盖
    ├── templates/ 模板
    └── install/upgrade/rollback
```

## 举一反三

| 本文学到 | 可迁移到 | 应用场景 |
|---------|---------|---------|
| GitHub Actions | GitLab CI、Jenkins | 任何 CI/CD 平台 |
| Docker 镜像自动化 | 任何语言项目 | 标准化构建发布 |
| K8s Deployment | Docker Swarm、Nomad | 容器编排平台 |
| Helm Chart | Kustomize | K8s 配置管理 |
| 滚动更新策略 | 蓝绿/金丝雀发布 | 零停机部署 |
| 资源限制 | cgroups、systemd | 进程资源隔离 |

## 参考资料

- [GitHub Actions 官方文档](https://docs.github.com/en/actions)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Helm 官方文档](https://helm.sh/docs/)
- [GitHub Actions 市场](https://github.com/marketplace?type=actions)

---

_从 Git Push 到生产部署，CI/CD 让交付自动化、可追溯、可回滚。_ 🚀
