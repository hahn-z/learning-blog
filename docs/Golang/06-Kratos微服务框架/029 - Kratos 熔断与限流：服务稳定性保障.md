---
title: "029 - Kratos 熔断与限流：服务稳定性保障"
slug: "029-kratos-circuit-breaker"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:20:57.546+08:00"
updated_at: "2026-04-29T10:02:45.503+08:00"
reading_time: 22
tags: []
---

# 029 - Kratos 熔断与限流

> **难度：⭐⭐⭐⭐（较难）**
> 熔断与限流是微服务稳定性的两大核心保障。本文详解熔断器原理、Kratos 熔断中间件、限流策略以及降级方案。

---

## 一、概念讲解

### 熔断器原理（三态模型）

熔断器借鉴了电路保险丝的思想，有三个状态：

```
         成功率恢复               连续失败达到阈值
    ┌─────────────────┐      ┌──────────────────────┐
    │                 │      │                      │
    ▼                 │      ▼                      │
┌───────┐     失败达阈值    ┌──────────┐    超时     │
│ CLOSED│───────────────▶│   OPEN   │──────────┐    │
└───────┘                └──────────┘           │    │
    ▲                                          │    │
    │               ┌─────────────┐            │    │
    └───────────────│ HALF-OPEN   │◀───────────┘    │
        成功        └─────────────┘    探测请求       │
                    半开：放少量请求探测               │
```

| 状态 | 行为 |
|------|------|
| **CLOSED** | 正常放行，统计失败率 |
| **OPEN** | 直接拒绝，返回降级响应 |
| **HALF-OPEN** | 放少量请求探测，成功则关闭，失败则继续打开 |

### 限流策略对比

| 算法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **令牌桶** | 固定速率往桶里放令牌 | 允许突发流量 | 实现稍复杂 |
| **滑动窗口** | 统计时间窗口内请求数 | 平滑限流 | 内存占用较高 |
| **漏桶** | 固定速率处理请求 | 输出均匀 | 无法应对突发 |

---

## 二、脑图

```
熔断与限流
├── 熔断器
│   ├── 三态模型 (Closed/Open/Half-Open)
│   ├── 失败率统计
│   ├── 超时探测
│   └── Kratos circuitbreaker 中间件
├── 限流
│   ├── 令牌桶 (Token Bucket)
│   ├── 滑动窗口 (Sliding Window)
│   ├── 自适应限流
│   └── Kratos ratelimit 中间件
├── 降级策略
│   ├── 返回默认值
│   ├── 返回缓存数据
│   └── 服务降级提示
└── 组合使用
    ├── 熔断 + 限流 + 重试
    └── 中间件顺序
```

---

## 三、完整代码示例

### v1：基础熔断器配置

```go
package main

import (
    "context"
    "os"
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func main() {
    logger := log.NewStdLogger(os.Stdout)

    // gRPC client with circuit breaker
    conn, err := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("localhost:9000"),
        grpc.WithMiddleware(
            circuitbreaker.Client(),
        ),
        grpc.WithTimeout(5*time.Second),
    )
    if err != nil {
        log.NewHelper(logger).Fatal(err)
    }
    defer conn.Close()

    // When circuit opens, requests fail fast with error
    // circuitbreaker.ErrNotAllowed
}
```

### v2：熔断 + 限流 + 降级

```go
package main

import (
    "context"
    "errors"
    "os"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/kratos/v2/middleware/ratelimit"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
)

// FallbackMiddleware provides degraded responses when circuit is open
func FallbackMiddleware(fallbackFn func(ctx context.Context, req interface{}) (interface{}, error)) middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            reply, err := handler(ctx, req)
            if err != nil {
                // Check if circuit breaker rejected the request
                if errors.Is(err, circuitbreaker.ErrNotAllowed) {
                    log.NewHelper(nil).Warn("Circuit open, using fallback")
                    return fallbackFn(ctx, req)
                }
                return nil, err
            }
            return reply, nil
        }
    }
}

// Example fallback: return cached/default user profile
func userFallback(ctx context.Context, req interface{}) (interface{}, error) {
    // Return a default/cached response
    return map[string]interface{}{
        "id":    "default",
        "name":  "Service Unavailable",
        "cache": true,
    }, nil
}

func main() {
    logger := log.NewStdLogger(os.Stdout)
    helper := log.NewHelper(logger)

    // Server with rate limiting
    gs := grpc.NewServer(
        grpc.Address(":9000"),
        grpc.Middleware(
            ratelimit.Server(), // Rate limit incoming requests
        ),
    )

    hs := http.NewServer(
        http.Address(":8000"),
        http.Middleware(
            ratelimit.Server(),
        ),
    )

    // Client with circuit breaker + fallback
    _ = conn := func() {
        c, _ := grpc.DialInsecure(
            context.Background(),
            grpc.WithEndpoint("localhost:9000"),
            grpc.WithMiddleware(
                circuitbreaker.Client(),            // Circuit breaker
                FallbackMiddleware(userFallback),    // Degradation
            ),
        )
        defer c.Close()
    }

    helper.Info("Server started with rate limiting and circuit breaker")
}
```

### v3：自定义限流策略 + 自适应限流

```go
package main

import (
    "context"
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/aegis/pkg/ratelimit"
    "github.com/go-kratos/aegis/pkg/ratelimit/bbr"
)

// BBRLimiter uses BBR (Bottleneck Bandwidth and RTT) adaptive rate limiting
func BBRLimiter() (middleware.Middleware, func()) {
    limiter := bbr.NewLimiter(
        bbr.WithWindow(10*time.Second),
        bbr.WithBucketSize(100),
        bbr.WithCpuUsage(0.8), // Trigger at 80% CPU
    )
    done := func() { limiter.Close() }

    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            doneFunc, err := limiter.Allow()
            if err != nil {
                return nil, ratelimit.ErrLimitExceed
            }
            reply, err := handler(ctx, req)
            doneFunc(ratelimit.DoneInfo{Err: err})
            return reply, err
        }
    }, done
}

// SlidingWindowLimiter implements a simple sliding window rate limiter
type SlidingWindowLimiter struct {
    limit  int
    window time.Duration
}

func NewSlidingWindowLimiter(limit int, window time.Duration) *SlidingWindowLimiter {
    return &SlidingWindowLimiter{limit: limit, window: window}
}

func (s *SlidingWindowLimiter) Allow() bool {
    // Simplified: in production use redis or atomic counters
    return true
}

// MiddlewareStack returns the recommended middleware chain
func MiddlewareStack(logger log.Logger) ([]middleware.Middleware, func()) {
    bbrMiddleware, bbrDone := BBRLimiter()

    middlewares := []middleware.Middleware{
        bbrMiddleware,            // Adaptive rate limiting (first)
        circuitbreaker.Server(),  // Circuit breaker
    }

    return middlewares, bbrDone
}

func main() {
    // Usage: apply MiddlewareStack to your server
    middlewares, cleanup := MiddlewareStack(log.DefaultLogger)
    defer cleanup()

    _ = middlewares // Use in grpc.NewServer(grpc.Middleware(middlewares...))
}
```

---

## 四、执行预览

```bash
# Normal request
$ curl http://localhost:8000/api/v1/users/123
{"id":"123","name":"John"}

# Rate limited (too many requests)
$ for i in $(seq 1 200); do curl -s http://localhost:8000/api/v1/users/123; done
{"id":"123","name":"John"}
...
HTTP 429 Too Many Requests

# Circuit breaker open (downstream failing)
WARN Circuit open, using fallback
{"id":"default","name":"Service Unavailable","cache":true}
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 中间件顺序 | 限流 → 熔断 → 业务逻辑，限流在外层保护系统 |
| 熔断粒度 | 按服务/接口粒度配置，不要一个熔断器覆盖所有接口 |
| 降级方案 | 降级不是返回 error，而是返回有意义的兜底数据 |
| 限流阈值 | 需要压测确定，不要拍脑袋定值 |
| 自适应限流 | BBR 基于 CPU 和 inflight 请求数自动调节，适合网关 |
| 监控告警 | 熔断器状态变化和限流触发都需要告警 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 熔断打开后直接返回 500 | 返回降级数据或友好提示 |
| 限流阈值设得太高等于没限 | 基于压测数据设置合理阈值 |
| 只在客户端加熔断 | 服务端也要加限流，双向保护 |
| 熔断超时设太短，频繁试探 | 根据下游恢复时间设置合理超时 |
| 限流用固定阈值不调优 | 使用自适应限流(BBR)或定期调整 |
| 忽略限流错误的日志和监控 | 限流触发是重要信号，要告警 |

---

## 七、练习题

### 🟢 入门
1. 为一个 gRPC 服务配置熔断中间件，模拟下游故障观察熔断效果
2. 使用 `ratelimit.Server()` 限制 HTTP 服务 QPS 为 100

### 🟡 进阶
3. 实现自定义降级中间件，对不同接口返回不同的兜底数据
4. 组合使用熔断 + 限流 + 超时三个中间件，验证正确的行为链

### 🔴 挑战
5. 基于 CPU 利用率和 inflight 请求数实现自适应限流器
6. 实现分布式限流（基于 Redis），支持跨实例的统一限流

---

## 八、知识点总结

```
熔断与限流
├── 熔断器
│   ├── 三态: Closed → Open → Half-Open
│   ├── circuitbreaker.Client() — 客户端熔断
│   ├── circuitbreaker.Server() — 服务端熔断
│   └── ErrNotAllowed — 熔断拒绝错误
├── 限流
│   ├── ratelimit.Server() — 内置限流
│   ├── BBR 自适应限流 (aegis)
│   └── 分布式限流 (Redis)
├── 降级
│   ├── Fallback 中间件
│   └── 缓存/默认值
└── 组合策略
    └── 限流 → 熔断 → 重试 → 业务
```

---

## 九、举一反三

| 场景 | 保护策略 | 推荐方案 |
|------|---------|---------|
| API 网关 | 高并发入口限流 | BBR 自适应限流 |
| 下游服务不稳定 | 防止级联故障 | 熔断器 + 降级 |
| 第三方 API 调用 | 防止超时拖垮 | 熔断 + 超时 + 重试 |
| 核心交易链路 | 确保可用性 | 限流 + 降级 + 队列缓冲 |
| 秒杀/抢购 | 瞬时高并发 | 令牌桶限流 + 排队 |

---

## 十、参考资料

- [Kratos Circuit Breaker](https://go-kratos.dev/docs/component/middleware/circuitbreaker)
- [Kratos Rate Limit](https://go-kratos.dev/docs/component/middleware/ratelimit)
- [Kratos Aegis 自适应限流](https://github.com/go-kratos/aegis)
- [Google BBR 算法论文](https://research.google/pubs/pub46264/)

---

## 十一、代码演进

| 版本 | 说明 | 适用场景 |
|------|------|---------|
| v1 | 基础熔断配置 | 学习理解 |
| v2 | 熔断 + 限流 + 降级 | 一般项目 |
| v3 | 自适应限流 + 自定义策略 | 生产环境 |

---

> **下篇预告：** 030 - 优雅关闭与服务治理，学习如何让服务安全退出并保障零丢请求。
