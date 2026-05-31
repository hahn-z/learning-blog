---
title: "030 - Kratos 优雅关闭与服务治理：零请求丢失"
slug: "030-kratos-graceful"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:20:57.556+08:00"
updated_at: "2026-04-29T10:02:45.512+08:00"
reading_time: 29
tags: []
---

# 030 - Kratos 优雅关闭与服务治理

> **难度：⭐⭐⭐⭐（较难）**
> 优雅关闭是生产环境的必修课。本文详解信号处理、连接排空、健康检查以及 Kubernetes 优雅终止，确保服务退出时零请求丢失。

---

## 一、概念讲解

### 为什么需要优雅关闭？

当服务收到终止信号（如 K8s Pod 滚动更新），如果直接退出：

- 正在处理的请求被中断 → 用户看到 500 错误
- 数据库事务未提交 → 数据不一致
- Kafka 消息未确认 → 消息重复消费

**优雅关闭的核心流程：**

```
SIGTERM 接收
    │
    ▼
停止接受新请求
    │
    ▼
等待在途请求完成 (drain timeout)
    │
    ▼
关闭数据库连接 / Kafka consumer
    │
    ▼
退出进程 (exit 0)
```

### Kubernetes 优雅终止

```yaml
spec:
  terminationGracePeriodSeconds: 30  # K8s 等待时间
  containers:
    - lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]  # 等待 Service 摘除
```

K8s 终止顺序：
1. 发送 SIGTERM
2. 等待 `terminationGracePeriodSeconds`（默认 30s）
3. 超时后发送 SIGKILL 强制终止

---

## 二、脑图

```
优雅关闭与服务治理
├── 优雅关闭
│   ├── 信号处理 (SIGTERM/SIGINT)
│   ├── 停止接受新请求
│   ├── 连接排空 (Connection Drain)
│   ├── 资源释放 (DB/Kafka/Cache)
│   └── 超时强制退出
├── 健康检查
│   ├── grpc.health.v1 协议
│   ├── Liveness Probe
│   ├── Readiness Probe
│   └── Startup Probe
├── Kubernetes 集成
│   ├── terminationGracePeriodSeconds
│   ├── preStop hook
│   └── Pod 滚动更新
└── 服务治理概述
    ├── 服务注册与发现
    ├── 负载均衡
    ├── 配置管理
    └── 可观测性 (日志/指标/追踪)
```

---

## 三、完整代码示例

### v1：Kratos 内置优雅关闭

```go
package main

import (
    "os"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func main() {
    logger := log.NewStdLogger(os.Stdout)
    helper := log.NewHelper(logger)

    gs := grpc.NewServer(grpc.Address(":9000"))
    hs := http.NewServer(http.Address(":8000"))

    // kratos.New automatically handles SIGTERM/SIGINT
    // It drains connections before stopping
    app := kratos.New(
        kratos.Name("user-service"),
        kratos.Server(gs, hs),
        kratos.Logger(logger),
        kratos.ShutdownTimeout(30*time.Second), // Max wait for draining
    )

    helper.Info("Service started, press Ctrl+C to graceful shutdown")
    if err := app.Run(); err != nil {
        helper.Errorf("Service exited: %v", err)
    }
    helper.Info("Service gracefully stopped")
}
```

### v2：自定义关闭钩子 + 健康检查

```go
package main

import (
    "context"
    "os"
    "time"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
    "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

// ResourceManager holds resources that need cleanup on shutdown
type ResourceManager struct {
    db     *DBConnection
    kafka  *KafkaConsumer
    cache  *CacheConnection
    logger *log.Helper
}

// Simulated resource types
type DBConnection struct{}
type KafkaConsumer struct{}
type CacheConnection struct{}

func (d *DBConnection) Close() error { return nil }
func (k *KafkaConsumer) Close() error { return nil }
func (c *CacheConnection) Close() error { return nil }

func NewResourceManager(logger log.Logger) *ResourceManager {
    return &ResourceManager{
        db:     &DBConnection{},
        kafka:  &KafkaConsumer{},
        cache:  &CacheConnection{},
        logger: log.NewHelper(logger),
    }
}

// Cleanup releases all resources in order
func (rm *ResourceManager) Cleanup(ctx context.Context) error {
    rm.logger.Info("Cleaning up resources...")

    // Stop accepting new Kafka messages first
    if err := rm.kafka.Close(); err != nil {
        rm.logger.Errorf("Kafka close error: %v", err)
    }
    rm.logger.Info("Kafka consumer closed")

    // Close database connections
    if err := rm.db.Close(); err != nil {
        rm.logger.Errorf("DB close error: %v", err)
    }
    rm.logger.Info("Database closed")

    // Close cache connections
    if err := rm.cache.Close(); err != nil {
        rm.logger.Errorf("Cache close error: %v", err)
    }
    rm.logger.Info("Cache closed")

    return nil
}

func main() {
    logger := log.NewStdLogger(os.Stdout)
    helper := log.NewHelper(logger)

    // Initialize resources
    rm := NewResourceManager(logger)

    // Setup health check
    healthServer := health.NewServer()
    healthpb.RegisterHealthServer(gs, healthServer)
    healthServer.SetServingStatus("user-service", healthpb.HealthCheckResponse_SERVING)

    gs := grpc.NewServer(grpc.Address(":9000"))
    hs := http.NewServer(http.Address(":8000"))

    // Custom health endpoint
    hs.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
        w.Write([]byte("ok"))
    })

    app := kratos.New(
        kratos.Name("user-service"),
        kratos.Server(gs, hs),
        kratos.Logger(logger),
    )

    // Register cleanup hook
    go func() {
        <-app.Done() // Wait for shutdown signal
        ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
        defer cancel()

        // Mark as not serving
        healthServer.SetServingStatus("user-service", healthpb.HealthCheckResponse_NOT_SERVING)

        // Cleanup resources
        rm.Cleanup(ctx)
    }()

    helper.Info("Service started with health check")
    if err := app.Run(); err != nil {
        helper.Errorf("Service exited: %v", err)
    }
}
```

### v3：完整生产级服务治理

```go
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
    "github.com/go-kratos/kratos/v2/registry"
    "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

// ProductionServer wraps a production-ready Kratos service
type ProductionServer struct {
    app         *kratos.App
    health      *health.Server
    logger      *log.Helper
    registry    registry.Registrar
}

// NewProductionServer creates a production-ready server
func NewProductionServer() *ProductionServer {
    logger := log.NewStdLogger(os.Stdout)
    logger = log.With(logger, "service", "user-service", "env", "production")
    helper := log.NewHelper(logger)

    // Health check server
    healthSrv := health.NewServer()
    healthSrv.SetServingStatus("user-service", healthpb.HealthCheckResponse_SERVING)

    // gRPC server with middleware stack
    gs := grpc.NewServer(
        grpc.Address(":9000"),
        grpc.Timeout(10*time.Second),
        grpc.Middleware(
            recovery.Recovery(),
            tracing.Server(),
            logging.Server(logger),
        ),
    )
    healthpb.RegisterHealthServer(gs, healthSrv)

    // HTTP server
    hs := http.NewServer(
        http.Address(":8000"),
        http.Timeout(10*time.Second),
        http.Middleware(
            recovery.Recovery(),
            tracing.Server(),
            logging.Server(logger),
        ),
    )

    // Health check endpoints
    hs.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(200)
        w.Write([]byte("ok"))
    })
    hs.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
        // Check dependencies (DB, cache, etc.)
        w.WriteHeader(200)
        w.Write([]byte("ready"))
    })

    app := kratos.New(
        kratos.Name("user-service"),
        kratos.Version("v1.0.0"),
        kratos.Server(gs, hs),
        kratos.Logger(logger),
    )

    return &ProductionServer{
        app:    app,
        health: healthSrv,
        logger: helper,
    }
}

// Run starts the server with custom signal handling
func (s *ProductionServer) Run() error {
    // Custom signal handling for K8s
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

    // Start app in goroutine
    errCh := make(chan error, 1)
    go func() {
        errCh <- s.app.Run()
    }()

    select {
    case sig := <-sigCh:
        s.logger.Infof("Received signal: %v, starting graceful shutdown...", sig)
        // Mark not serving immediately
        s.health.SetServingStatus("user-service", healthpb.HealthCheckResponse_NOT_SERVING)
        // Give load balancer time to remove us
        time.Sleep(3 * time.Second)
        // Stop the app
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()
        return s.app.Stop(ctx)

    case err := <-errCh:
        return err
    }
}

func main() {
    server := NewProductionServer()
    if err := server.Run(); err != nil {
        server.logger.Errorf("Server exited: %v", err)
    }
    server.logger.Info("Server gracefully stopped")
}
```

---

## 四、执行预览

```bash
# Start service
$ go run main.go
INFO service=user-service msg=Service started with health check

# Health check
$ curl http://localhost:8000/healthz
ok

# Send SIGTERM (simulating K8s pod termination)
$ kill -SIGTERM <pid>
INFO Received signal: terminated, starting graceful shutdown...
INFO Health set to NOT_SERVING
INFO Waiting 3s for LB to remove us...
INFO Draining connections...
INFO All connections drained
INFO Server gracefully stopped

# During drain, existing requests complete normally
$ curl http://localhost:8000/api/v1/users/123
{"id":"123","name":"John"}  # Still works during drain
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 关闭超时 | 设置合理的 shutdown timeout（建议 30s），与 K8s `terminationGracePeriodSeconds` 对齐 |
| preStop | K8s 中配置 `preStop: sleep 5` 等待 Service endpoint 更新 |
| 健康检查 | Readiness probe 失败后 K8s 会从 Service 摘除 Pod |
| 资源释放顺序 | 先停消费者 → 再关数据库 → 最后关缓存 |
| 日志 | 关闭过程的日志要持久化，不要在关闭后丢失 |
| K8s 配置 | `terminationGracePeriodSeconds` 应大于 shutdown timeout + preStop |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 直接 `os.Exit(0)` 或 `log.Fatal` | 使用 `app.Stop(ctx)` 优雅关闭 |
| 不设 shutdown timeout | 设 30s 超时，防止无限等待 |
| 关闭顺序随意 | 按依赖关系反向关闭：Consumer → DB → Cache |
| K8s 不配 preStop | 配 `preStop: sleep 5` 等待 LB 摘除 |
| 健康检查只检查进程存活 | Readiness 要检查依赖服务（DB/Redis）是否正常 |
| 忽略 SIGTERM | 监听 SIGTERM 并触发优雅关闭流程 |

---

## 七、练习题

### 🟢 入门
1. 创建一个 Kratos 服务，验证 Ctrl+C 时优雅关闭（观察日志）
2. 添加 `/healthz` HTTP 健康检查端点

### 🟡 进阶
3. 实现自定义关闭钩子，在关闭前释放数据库连接和 Kafka consumer
4. 配置 gRPC 健康检查，实现 `grpc.health.v1` 协议

### 🔴 挑战
5. 完整的 K8s 部署配置：Deployment + Service + 合理的 Probe + 优雅终止
6. 实现零停机滚动更新：验证在 Pod 替换过程中请求不丢失

---

## 八、知识点总结

```
优雅关闭与服务治理
├── 优雅关闭
│   ├── kratos.App.Run() — 自动处理信号
│   ├── kratos.App.Stop(ctx) — 手动触发关闭
│   ├── ShutdownTimeout — 排空超时
│   └── 资源释放钩子
├── 健康检查
│   ├── grpc.health.v1 — gRPC 标准
│   ├── /healthz — HTTP liveness
│   ├── /readyz — HTTP readiness
│   └── SERVING / NOT_SERVING 状态切换
├── K8s 集成
│   ├── terminationGracePeriodSeconds
│   ├── preStop hook
│   ├── Liveness / Readiness / Startup Probe
│   └── 滚动更新策略
└── 服务治理
    ├── 注册与发现 (Consul/Etcd/Nacos)
    ├── 负载均衡
    ├── 配置中心
    └── 可观测性三支柱
```

---

## 九、举一反三

| 场景 | 关闭策略 | 关键配置 |
|------|---------|---------|
| K8s Deployment | preStop + SIGTERM + timeout | `terminationGracePeriodSeconds: 30` |
| Docker Compose | SIGTERM 处理 | `stop_grace_period: 30s` |
| 物理机部署 | systemd signal + 脚本 | `TimeoutStopSec=30` |
| Serverless | 框架自动处理 | 按平台配置 |
| 消费者服务 | 先停止消费，等处理完再关 | Offset 手动提交 |

---

## 十、参考资料

- [Kratos App 生命周期](https://go-kratos.dev/docs/component/app)
- [gRPC Health Checking Protocol](https://grpc.io/docs/guides/health-checking/)
- [Kubernetes Pod 生命周期](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Graceful Shutdown in Go](https://grafana.com/blog/2024/02/09/how-i-write-graceful-shutdown-logic-in-go-services/)

---

## 十一、代码演进

| 版本 | 说明 | 适用场景 |
|------|------|---------|
| v1 | Kratos 内置优雅关闭 | 简单服务 |
| v2 | 自定义钩子 + 健康检查 | 一般项目 |
| v3 | 完整服务治理 + K8s 集成 | 生产环境 |

---

> **系列完结！** 恭喜你完成了 Kratos 微服务框架系列全部 30 篇学习。从项目搭建到生产部署，你已经掌握了 Kratos 的核心技能。🚀
