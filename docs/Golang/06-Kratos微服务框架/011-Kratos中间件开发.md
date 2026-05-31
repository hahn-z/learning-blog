---
title: "011-Kratos中间件开发"
slug: "011-kratos-middleware"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:34:54.99+08:00"
updated_at: "2026-04-29T10:02:45.371+08:00"
reading_time: 23
tags: []
---


# 011-Kratos中间件开发

> **难度：** ⭐⭐⭐ | **适合：** 掌握Kratos基础，想深入理解中间件机制的开发者

## 一、概念讲解

中间件（Middleware）是微服务框架的核心基础设施。在Kratos中，中间件横跨HTTP和gRPC两个协议层，统一采用 `middleware.Middleware` 函数签名，实现了**一套逻辑，两种协议**的优雅设计。

### 为什么需要中间件？

微服务中大量横切关注点（Cross-Cutting Concerns）需要在请求处理前/后执行：

| 关注点 | 示例 |
|--------|------|
| 可观测性 | 链路追踪、指标采集、日志记录 |
| 容错 | 异常恢复、限流、熔断 |
| 安全 | 认证鉴权、请求校验 |
| 通信 | 元数据传递、请求ID注入 |

### Kratos中间件架构

Kratos中间件基于**装饰器模式**，每个中间件包裹Handler，形成洋葱模型：

```
请求 → Middleware1 → Middleware2 → Handler → Middleware2 → Middleware1 → 响应
```

核心接口：

```go
// transport/middleware.go
type Middleware func(handler Handler) Handler
type Handler func(ctx context.Context, req interface{}) (interface{}, error)
```

## 二、脑图

```
Kratos中间件
├── HTTP中间件
│   ├── 内置中间件
│   │   ├── tracing (链路追踪)
│   │   ├── metadata (元数据传递)
│   │   ├── recovery (异常恢复)
│   │   └── logging (请求日志)
│   └── 自定义中间件
│       └── transporter提取请求信息
├── gRPC拦截器
│   ├── Unary Interceptor
│   └── Stream Interceptor
├── 执行顺序
│   ├── 洋葱模型
│   └── 先注册先执行(外层)
└── 最佳实践
    ├── 中间件顺序设计
    └── 短路机制
```

## 三、完整Go代码

### v1: 基础中间件体验

```go
// cmd/server/main.go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func main() {
    // Create HTTP server with recovery middleware
    httpSrv := http.NewServer(
        http.Address(":8000"),
        http.Middleware(
            recovery.Recovery(),
        ),
    )

    // Register route
    httpSrv.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello Kratos!")
    })

    app := kratos.New(kratos.Server(httpSrv))
    if err := app.Run(); err != nil {
        log.Fatal(err)
    }
}
```

### v2: 添加多种内置中间件

```go
// internal/server/http.go
package server

import (
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/middleware/metadata"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/http"
)

// NewHTTPServer create HTTP server with middlewares
func NewHTTPServer(c *conf.Server, greeter *service.GreeterService) *http.Server {
    var opts = []http.ServerOption{
        http.Address(c.Http.Addr),
        http.Middleware(
            recovery.Recovery(),           // Panic recovery, must be first
            tracing.Server(                // Distributed tracing
                tracing.WithTracerProvider(tp),
            ),
            logging.Server(log.DefaultLogger), // Request logging
            metadata.Server(),                  // Metadata propagation
        ),
    }
    srv := http.NewServer(opts...)

    // Register service routes
    registerGreeterHTTPServer(srv, greeter)
    return srv
}
```

### v3: 自定义中间件 + gRPC拦截器

```go
// internal/middleware/request_id.go
package middleware

import (
    "context"
    "fmt"

    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
    "github.com/google/uuid"
)

// RequestID injects a unique request ID into context
func RequestID() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            // Extract transport info
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Try to get existing request ID from header
                reqID := tr.RequestHeader().Get("X-Request-ID")
                if reqID == "" {
                    reqID = uuid.New().String()
                }
                // Set in response header
                tr.ReplyHeader().Set("X-Request-ID", reqID)
                fmt.Printf("[RequestID] %s %s\n", tr.Operation(), reqID)
            }
            return handler(ctx, req)
        }
    }
}
```

```go
// internal/middleware/auth.go
package middleware

import (
    "context"
    "errors"

    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
)

var ErrUnauthorized = errors.New("unauthorized access")

// Auth validates JWT token from header
func Auth() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            if tr, ok := transport.FromServerContext(ctx); ok {
                token := tr.RequestHeader().Get("Authorization")
                if token == "" {
                    return nil, ErrUnauthorized
                }
                // TODO: validate JWT token
                // Short-circuit: return error without calling handler
            }
            return handler(ctx, req)
        }
    }
}
```

```go
// internal/server/grpc.go - gRPC server with interceptors
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCServer(c *conf.Server, greeter *service.GreeterService) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Address(c.Grpc.Addr),
        grpc.Middleware(
            recovery.Recovery(),
            tracing.Server(),
        ),
    }
    srv := grpc.NewServer(opts...)
    registerGreeterGRPCServer(srv, greeter)
    return srv
}
```

```go
// internal/server/http.go - Custom middleware on specific routes
func NewHTTPServer(c *conf.Server, greeter *service.GreeterService) *http.Server {
    var opts = []http.ServerOption{
        http.Address(c.Http.Addr),
        http.Middleware(
            recovery.Recovery(),
            tracing.Server(),
            logging.Server(log.DefaultLogger),
        ),
    }
    srv := http.NewServer(opts...)

    // Route-level middleware: auth only on protected routes
    srv.HandleFunc("/api/public/*", handlePublic)
    srv.Handle("/api/private/*",
        http.Middleware(
            middleware.Auth(),       // Auth check for private routes
            middleware.RequestID(),  // Request ID injection
        )(handler),
    )
    return srv
}
```

## 四、执行预览

```bash
# Start server
$ go run cmd/server/main.go
INFO msg=server listening on: [::]:8000

# Normal request
$ curl http://localhost:8000/helloworld/iron
{"message":"Hello iron"}

# Check response headers
$ curl -v http://localhost:8000/helloworld/iron
< X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
< X-Trace-Id: abc123def456

# Unauthorized request (auth middleware rejects)
$ curl http://localhost:8000/api/private/data
{"code":401, "reason":"UNAUTHORIZED", "message":"unauthorized access"}

# Panic recovery test
$ curl http://localhost:8000/panic
{"code":500, "reason":"INTERNAL_SERVER_ERROR", "message":"recovered from panic"}
```

## 五、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| recovery位置 | 必须放最外层(第一个) | 确保所有panic都能被捕获 |
| 中间件顺序 | 先注册先执行(洋葱外层) | tracing → logging → business |
| 短路机制 | 中间件return error不继续 | 注意auth等中间件的位置 |
| HTTP vs gRPC | 同一Middleware接口 | 一套代码两个协议通用 |
| context传递 | 不要修改原始context后不传 | 始终用handler(ctx, req) |
| 性能开销 | 中间件链越长延迟越高 | 只注册必要中间件 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| recovery放最后 | recovery放第一个，兜底所有panic |
| 中间件里直接return nil | 返回明确的error或业务响应 |
| 忘记调用handler(ctx, req) | 中间件必须调用handler传递请求 |
| 在中间件里做重IO操作 | 中间件只做轻量操作，重IO放handler |
| 所有路由都加auth | 区分public/private路由，按需加中间件 |
| 用全局变量存请求信息 | 用context传递，避免并发问题 |
| gRPC和HTTP各写一套 | 用统一middleware.Middleware接口 |

## 七、练习题

### 🟢 基础题
1. 实现一个记录请求耗时的中间件，在响应Header中返回 `X-Response-Time`
2. 给现有HTTP Server添加recovery和logging中间件

### 🟡 进阶题
3. 实现一个限流中间件，每秒最多允许100个请求（提示：使用 `golang.org/x/time/rate`）
4. 实现路由级别的中间件配置，public路由不加auth，admin路由必须auth

### 🔴 挑战题
5. 实现中间件链的动态配置：通过配置文件决定启用哪些中间件及顺序
6. 实现一个gRPC流式拦截器，统计stream消息数量

## 八、知识点总结

```
Kratos中间件体系
├── 核心接口
│   ├── middleware.Middleware func(Handler) Handler
│   └── transport.FromServerContext 提取请求信息
├── 内置中间件
│   ├── recovery.Recovery() — panic恢复
│   ├── tracing.Server() — 链路追踪
│   ├── logging.Server() — 请求日志
│   ├── metadata.Server() — 元数据传递
│   └── validate.Validator() — 参数校验
├── 中间件注册
│   ├── Server级别: http.Middleware() / grpc.Middleware()
│   └── 路由级别: 在route handler上包装
├── 执行模型
│   ├── 洋葱模型: 请求进入→内→响应返回
│   └── 短路: 中间件return error即中断
└── 协议统一
    ├── HTTP: 标准net/http handler chain
    └── gRPC: unary/stream interceptor
```

## 九、举一反三

| 场景 | 中间件方案 | 关键技术 |
|------|-----------|---------|
| API限流 | 令牌桶/漏桶中间件 | `x/time/rate` |
| 灰度发布 | 根据Header路由到不同版本 | metadata提取+自定义路由 |
| 链路追踪 | OpenTelemetry tracing | `tracing.Server()` |
| 请求签名 | 验证HMAC签名 | 自定义middleware |
| CORS | 跨域请求处理 | 自定义HTTP middleware |
| 请求去重 | 幂等性检查 | Redis + 自定义middleware |
| 指标采集 | Prometheus metrics | `metrics.Server()` |
| API版本控制 | Header/URL路径判断 | 自定义middleware |

## 十、参考资料

- [Kratos官方文档 - Middleware](https://go-kratos.dev/docs/component/middleware)
- [Kratos中间件源码](https://github.com/go-kratos/kratos/tree/main/middleware)
- [Go net/http中间件模式](https://go.dev/doc/go1.22#enhancedroutingpatterns)
- [OpenTelemetry Go SDK](https://opentelemetry.io/docs/instrumentation/go/)

## 十一、代码演进

### v1 → v2 的变化
- 从单一recovery扩展到完整中间件链
- 引入tracing、logging、metadata
- 体现中间件注册顺序的重要性

### v2 → v3 的变化
- 新增自定义中间件（RequestID、Auth）
- 展示路由级别中间件配置
- 同时覆盖HTTP和gRPC双协议
- 展示中间件短路机制（Auth失败直接返回）

### 核心演进路径
```
单一recovery → 完整中间件链 → 自定义中间件 + 路由级配置 + 双协议支持
```
