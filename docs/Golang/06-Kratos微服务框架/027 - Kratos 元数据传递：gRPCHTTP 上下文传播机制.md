---
title: "027 - Kratos 元数据传递：gRPC/HTTP 上下文传播机制"
slug: "027-kratos-metadata"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:20:57.526+08:00"
updated_at: "2026-04-29T10:02:45.481+08:00"
reading_time: 19
tags: []
---

# 027 - Kratos 元数据传递

> **难度：⭐⭐⭐（中等）**
> 元数据（Metadata）是微服务间传递上下文信息的标准机制。本文详解 Kratos 中 gRPC/HTTP 元数据的注入、提取与跨服务传播。

---

## 一、概念讲解

### 什么是元数据？

元数据是附加在请求中的键值对信息，不属于业务数据本身，但对请求处理至关重要：

- **TraceID**：分布式追踪标识
- **UserID**：经过认证的用户身份
- **RequestID**：请求唯一标识
- **TenantID**：多租户场景下的租户标识

### gRPC vs HTTP 元数据

| 协议 | 元数据载体 | 包名 |
|------|-----------|------|
| gRPC | metadata（HTTP/2 headers） | `google.golang.org/grpc/metadata` |
| HTTP | Headers | `net/http` |

Kratos 通过 `metadata` 包统一了两种协议的元数据操作。

---

## 二、脑图

```
Kratos 元数据传递
├── 核心概念
│   ├── metadata.KeyValue
│   ├── Client 端注入
│   └── Server 端提取
├── 传播机制
│   ├── gRPC metadata
│   ├── HTTP Header
│   └── Kratos metadata 包统一
├── 使用场景
│   ├── TraceID 传播
│   ├── UserID 传递
│   ├── 多租户 TenantID
│   └── 灰度发布标记
├── 自定义中间件
│   ├── Client Metadata Injector
│   └── Server Metadata Extractor
└── 注意事项
    ├── Key 大小写
    ├── 二进制元数据
    └── 元数据大小限制
```

---

## 三、完整代码示例

### v1：基础元数据注入与提取

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/metadata"
    "github.com/go-kratos/kratos/v2/transport"
)

func main() {
    logger := log.NewHelper(log.NewStdLogger(os.Stdout))

    // Simulate client injecting metadata
    ctx := context.Background()
    ctx = metadata.AppendToClientContext(ctx,
        "x-trace-id", "trace-abc-123",
        "x-user-id", "user-456",
    )

    // Server side: extract metadata
    if md, ok := metadata.FromServerContext(ctx); ok {
        traceID := md.Get("x-trace-id")
        userID := md.Get("x-user-id")
        logger.Infow("trace_id", traceID, "user_id", userID)
    }
    _ = fmt.Sprintf("done")
}
```

### v2：中间件实现自动传播

```go
package main

import (
    "context"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/metadata"
    "github.com/go-kratos/kratos/v2/transport"
)

// ClientMDInjector injects metadata into outgoing requests
func ClientMDInjector() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            // Propagate trace-id and user-id from incoming to outgoing
            if tr, ok := transport.FromServerContext(ctx); ok {
                traceID := tr.RequestHeader().Get("x-trace-id")
                userID := tr.RequestHeader().Get("x-user-id")
                if traceID != "" {
                    ctx = metadata.AppendToClientContext(ctx, "x-trace-id", traceID)
                }
                if userID != "" {
                    ctx = metadata.AppendToClientContext(ctx, "x-user-id", userID)
                }
            }
            return handler(ctx, req)
        }
    }
}

// ServerMDExtractor extracts metadata and stores in context
func ServerMDExtractor() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            if md, ok := metadata.FromServerContext(ctx); ok {
                traceID := md.Get("x-trace-id")
                if traceID != "" {
                    // Store in context for downstream use
                    ctx = context.WithValue(ctx, "trace_id", traceID)
                }
            }
            return handler(ctx, req)
        }
    }
}
```

### v3：完整服务间元数据传播

```go
package main

import (
    "context"
    "os"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
)

// TracePropagationMiddleware auto-propagates trace metadata
func TracePropagationMiddleware(logger log.Logger) middleware.Middleware {
    helper := log.NewHelper(logger)
    return func(handler middleware.MiddlewareFunc) middleware.MiddlewareFunc {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            // Extract from incoming request
            if tr, ok := transport.FromServerContext(ctx); ok {
                traceID := tr.RequestHeader().Get("x-trace-id")
                if traceID == "" {
                    traceID = generateTraceID()
                }
                // Inject into outgoing calls
                ctx = metadata.AppendToClientContext(ctx, "x-trace-id", traceID)
                helper.Infow("trace_id", traceID, "method", tr.Operation())
            }
            return handler(ctx, req)
        }
    }
}

func generateTraceID() string {
    // In production, use UUID or snowflake ID
    return "trace-" + "generated"
}

func main() {
    logger := log.NewStdLogger(os.Stdout)

    gs := grpc.NewServer(
        grpc.Address(":9000"),
        grpc.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    )
    hs := http.NewServer(
        http.Address(":8000"),
        http.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    )

    app := kratos.New(
        kratos.Name("user-service"),
        kratos.Server(gs, hs),
    )
    app.Run()
}
```

---

## 四、执行预览

```bash
# Client sends request with metadata
$ curl -H "x-trace-id: trace-abc-123" -H "x-user-id: user-456" http://localhost:8000/api/v1/users/me

# Server log shows extracted metadata
INFO trace_id=trace-abc-123 user_id=user-456 method=/api.user.v1.UserService/GetUser
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Key 规范 | 统一使用小写 + 横线，如 `x-trace-id`，gRPC metadata key 会自动转小写 |
| 大小限制 | HTTP Header 单个值建议 < 4KB，gRPC metadata 总量建议 < 8KB |
| 安全性 | 不要通过 metadata 传递敏感信息（密码等），或做加密处理 |
| 编码 | HTTP Header 只支持 ASCII，非 ASCII 值需要 Base64 编码 |
| 可选性 | 元数据是可选的，服务端不应因缺少元数据而崩溃 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用 `context.Value` 直接传业务数据 | 用 metadata 传上下文信息，业务数据放请求体 |
| gRPC metadata key 用大写 | 统一小写，gRPC 会自动转换 |
| 不处理 metadata 缺失的情况 | 始终检查 `ok` 返回值，提供默认值 |
| 手动在每个 service 传递 metadata | 用中间件自动注入和提取 |
| metadata 传递大 payload | metadata 只传 ID 等轻量信息 |

---

## 七、练习题

### 🟢 入门
1. 实现一个 gRPC 客户端，注入 `x-request-id` metadata
2. 在服务端提取并打印该 metadata

### 🟡 进阶
3. 编写中间件，自动从 HTTP Header 提取 Token 并转为 metadata 传递给下游 gRPC 服务
4. 实现多租户场景下的 TenantID 自动传播

### 🔴 挑战
5. 结合 OpenTelemetry，将 TraceID 和 SpanID 自动注入 metadata 并跨服务传播
6. 实现元数据校验中间件，拒绝包含非法字符的 metadata 值

---

## 八、知识点总结

```
元数据传递
├── 核心包
│   └── github.com/go-kratos/kratos/v2/metadata
├── 操作
│   ├── AppendToClientContext — 注入
│   ├── FromServerContext — 提取
│   └── md.Get(key) — 读取
├── 传播模式
│   ├── HTTP → gRPC (Header → Metadata)
│   ├── gRPC → gRPC (Metadata → Metadata)
│   └── 自动传播中间件
└── 最佳实践
    ├── Key 命名规范 (x-前缀)
    ├── 必须处理缺失
    └── 轻量级信息 only
```

---

## 九、举一反三

| 场景 | 元数据方案 | 关键 Key |
|------|-----------|---------|
| 分布式追踪 | TraceID 自动传播 | `x-trace-id`, `x-span-id` |
| 用户认证 | Token → UserID 传递 | `x-user-id`, `authorization` |
| 多租户 | TenantID 隔离 | `x-tenant-id` |
| 灰度发布 | 灰度标记传播 | `x-gray-tag` |
| A/B 测试 | 实验组标记 | `x-experiment-id` |

---

## 十、参考资料

- [Kratos Metadata 文档](https://go-kratos.dev/docs/component/metadata)
- [gRPC Metadata 规范](https://grpc.io/docs/guides/metadata/)
- [OpenTelemetry Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)

---

## 十一、代码演进

| 版本 | 说明 | 适用场景 |
|------|------|---------|
| v1 | 手动注入/提取 metadata | 学习理解原理 |
| v2 | 中间件自动传播 | 一般项目 |
| v3 | 完整服务集成 + Trace 传播 | 生产环境 |

---

> **下篇预告：** 028 - 消息队列 Kafka 集成，学习在 Kratos 中集成 Kafka 实现异步消息处理。
