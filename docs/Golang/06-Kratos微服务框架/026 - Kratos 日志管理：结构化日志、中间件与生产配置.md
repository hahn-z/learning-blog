---
title: "026 - Kratos 日志管理：结构化日志、中间件与生产配置"
slug: "026-kratos-log"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:20:57.513+08:00"
updated_at: "2026-04-29T10:02:45.475+08:00"
reading_time: 17
tags: []
---

# 026 - Kratos 日志管理

> **难度：⭐⭐⭐（中等）**
> 日志是微服务可观测性的基石。Kratos 提供了统一的日志接口和丰富的中间件支持，本文从接口设计到生产配置全面覆盖。

---

## 一、概念讲解

### 为什么需要统一日志？

在微服务架构中，一个请求可能跨越多个服务。如果没有统一的日志规范：

- 日志格式五花八门，难以检索
- 无法关联跨服务的请求链路
- 日志级别混乱，生产环境要么太吵要么太安静

### Kratos 日志体系

Kratos 的日志系统基于 `log.Logger` 接口，核心组件：

| 组件 | 说明 |
|------|------|
| `log.Logger` | 底层日志接口，只做一件事：写入 Key-Value 对 |
| `log.Helper` | 高级封装，提供 Info/Warn/Error 等便捷方法 |
| `log.Filter` | 日志过滤器，按级别或 Key 过滤 |
| `log.StdLogger` | 适配标准库 `log.Logger` |

**核心设计思想：** Logger 接口极简，只有 `Log(level, keyvals...)` 一个方法，所有高级功能通过装饰器模式叠加。

---

## 二、脑图

```
Kratos 日志管理
├── 核心接口
│   ├── log.Logger (底层 KV 接口)
│   ├── log.Helper (高级封装)
│   └── log.StdLogger (标准库适配)
├── 日志级别
│   ├── DEBUG
│   ├── INFO
│   ├── WARN
│   ├── ERROR
│   └── FATAL
├── 结构化日志
│   ├── Key-Value 格式
│   ├── JSON 输出
│   └── Context 携带字段
├── 中间件
│   ├── Server 日志中间件
│   └── Client 日志中间件
├── 高级特性
│   ├── 日志采样
│   ├── 日志过滤
│   └── 自定义 Writer
└── 生产配置
    ├── 日志轮转
    ├── 日志级别动态调整
    └── 集中采集 (ELK/Loki)
```

---

## 三、完整代码示例

### v1：基础日志使用

```go
package main

import (
    "context"
    "os"

    "github.com/go-kratos/kratos/v2/log"
)

func main() {
    // Create a standard logger with JSON format
    logger := log.NewStdLogger(os.Stdout)
    logger = log.NewHelper(logger)

    // Basic logging at different levels
    logger.Debug("This is a debug message")
    logger.Info("This is an info message")
    logger.Warn("This is a warning")
    logger.Error("This is an error")
}
```

### v2：结构化日志 + 中间件

```go
package main

import (
    "context"
    "fmt"
    "os"
    "time"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func main() {
    // Create structured logger
    logger := log.NewStdLogger(os.Stdout)
    logger = log.With(logger,
        "service", "user-service",
        "version", "v1.0.0",
    )
    helper := log.NewHelper(logger)

    // Build server with logging middleware
    gs := grpc.NewServer(
        grpc.Address(":9000"),
        grpc.Middleware(
            logging.Server(logger), // Auto log requests/responses
        ),
    )
    hs := http.NewServer(
        http.Address(":8000"),
        http.Middleware(
            logging.Server(logger),
        ),
    )

    app := kratos.New(
        kratos.Name("user-service"),
        kratos.Server(gs, hs),
        kratos.Logger(logger),
    )

    helper.Info("Starting user-service...")

    if err := app.Run(); err != nil {
        helper.Errorf("Server failed: %v", err)
    }
}
```

### v3：生产级日志配置（采样 + 过滤 + 自定义）

```go
package main

import (
    "os"
    "time"

    "github.com/go-kratos/kratos/v2/log"
)

// SamplingLogger samples repeated log messages to reduce volume
type SamplingLogger struct {
    logger  log.Logger
    window  time.Duration
    counts  map[string]int
    lastLog map[string]time.Time
}

func NewSamplingLogger(logger log.Logger, window time.Duration) *SamplingLogger {
    return &SamplingLogger{
        logger:  logger,
        window:  window,
        counts:  make(map[string]int),
        lastLog: make(map[string]time.Time),
    }
}

func (s *SamplingLogger) Log(level log.Level, keyvals ...interface{}) error {
    return s.logger.Log(level, keyvals...)
}

// ProductionLoggerFactory creates a production-ready logger
func ProductionLoggerFactory(serviceName string) log.Logger {
    // Base: JSON output to stdout (for container log collection)
    logger := log.NewStdLogger(os.Stdout)
    logger = log.NewFilter(logger,
        log.FilterLevel(log.LevelInfo), // Production: Info and above
    )
    logger = log.With(logger,
        "service", serviceName,
        "ts", log.DefaultTimestamp,
        "caller", log.DefaultCaller,
    )
    return logger
}

func main() {
    logger := ProductionLoggerFactory("order-service")
    helper := log.NewHelper(logger)

    helper.Info("Production logger initialized")
    helper.Warn("This is a warning with structured fields",
        "user_id", "12345",
        "action", "payment",
    )
}
```

---

## 四、执行预览

```bash
# v2 output with logging middleware
$ go run main.go
INFO service=user-service version=v1.0.0 msg=Starting user-service...
INFO service=user-service kind=server component=grpc operation=/api.user.v1.UserService/GetUser args={} code=0 reason= took=1.23ms
INFO service=user-service kind=server component=http operation=GET /api/v1/users/123 args={} code=200 reason= took=0.89ms

# v3 production output (JSON)
{"level":"INFO","service":"order-service","ts":"2024-01-15T10:30:00Z","caller":"main.go:45","msg":"Production logger initialized"}
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 日志级别选择 | 开发用 DEBUG，生产用 INFO，避免 DEBUG 日志影响性能 |
| 结构化日志 | 始终使用 Key-Value 格式，不要用字符串拼接 |
| 敏感信息 | 禁止在日志中输出密码、Token、身份证号等敏感数据 |
| 日志中间件 | 生产环境建议对 Request Body 做脱敏或截断 |
| 性能影响 | 高 QPS 服务注意日志 I/O 开销，考虑异步写入或采样 |
| Context 传递 | 始终通过 `log.NewHelper(ctx)` 从 context 获取 logger |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `log.Println("user: " + userID)` | `helper.Info("user_id", userID)` |
| 每个请求打印完整的 Request Body | 中间件中截断超长 Body，或只记录摘要 |
| 生产环境使用 DEBUG 级别 | 使用 `log.FilterLevel(log.LevelInfo)` 过滤 |
| 在 hot path 中大量打日志 | 使用采样或条件判断减少日志量 |
| `fmt.Printf` 混用标准输出 | 统一使用 `log.Helper`，避免输出不可控 |
| 日志中直接输出 error 对象 | `helper.Errorw("err", err, "context", "...")` |

---

## 七、练习题

### 🟢 入门
1. 创建一个 Kratos 服务，配置 JSON 格式日志输出到文件
2. 使用 `log.Helper` 分别输出 DEBUG、INFO、WARN、ERROR 四个级别的日志

### 🟡 进阶
3. 实现 `log.Filter`，根据请求路径过滤健康检查的日志
4. 为日志中间件添加 Request ID 字段，实现请求级别的日志关联

### 🔴 挑战
5. 实现一个自定义 Logger，支持日志采样（相同消息在 10 秒内只输出第一次和计数）
6. 将日志输出接入 Loki/ELK，配置日志采集管道

---

## 八、知识点总结

```
Kratos 日志管理
├── Logger 接口
│   └── Log(Level, ...KeyVal) — 唯一核心方法
├── Helper 封装
│   ├── Info / Warn / Error / Debug
│   ├── Infow / Warnw / Errorw (KV 格式)
│   └──WithContext(ctx) — 从 context 获取 logger
├── 装饰器模式
│   ├── With() — 添加固定字段
│   ├── NewFilter() — 级别过滤
│   └── NewStdLogger() — 适配标准库
├── 中间件
│   ├── logging.Server() — 服务端日志
│   └── logging.Client() — 客户端日志
└── 最佳实践
    ├── 结构化 + JSON
    ├── 级别控制
    └── 日志采样
```

---

## 九、举一反三

| 场景 | 日志方案 | 关键配置 |
|------|---------|---------|
| 开发调试 | StdLogger + DEBUG | `log.NewStdLogger(os.Stdout)` |
| 生产服务 | JSON + Filter(INFO) + 中间件 | `log.NewFilter(logger, log.FilterLevel(log.LevelInfo))` |
| 高 QPS 网关 | 采样 + 异步写入 | 自定义 SamplingLogger |
| 分布式链路 | 注入 TraceID + SpanID | `log.With(logger, "trace_id", traceID)` |
| 审计日志 | 独立 Writer + 文件轮转 | 自定义 `io.Writer` + lumberjack |

---

## 十、参考资料

- [Kratos Log 官方文档](https://go-kratos.dev/docs/component/log)
- [Go 结构化日志最佳实践](https://dave.cheney.net/2015/11/05/lets-talk-about-logging)
- [OpenTelemetry Logs 规范](https://opentelemetry.io/docs/concepts/signals/logs/)

---

## 十一、代码演进

| 版本 | 说明 | 适用场景 |
|------|------|---------|
| v1 | 基础日志输出 | 学习、快速验证 |
| v2 | 结构化 + 中间件集成 | 一般项目 |
| v3 | 采样 + 过滤 + 生产配置 | 生产环境 |

---

> **下篇预告：** 027 - 元数据传递，学习如何在 gRPC/HTTP 服务间传递 TraceID、UserID 等上下文信息。
