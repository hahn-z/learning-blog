---
title: "007 - Context上下文控制"
slug: "007-rwmutex"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.022+08:00"
updated_at: "2026-04-29T10:02:44.707+08:00"
reading_time: 23
tags: ["并发"]
---

# 037 - Context 上下文控制

> 难度：⭐⭐⭐⭐（进阶）
>
> 本文深入讲解 Go 语言 `context` 包的设计哲学、核心 API、取消传播机制以及生产级最佳实践。

---

## 一、概念讲解

`context.Context` 是 Go 1.7 引入的标准接口，用于在 API 边界和 goroutine 之间传递**截止时间（deadline）**、**取消信号（cancel）**和**请求级值（value）**。

### 为什么需要 Context？

在并发场景中，一个 HTTP 请求可能触发数十个 goroutine（数据库查询、RPC 调用、缓存读取……）。如果用户关闭了连接或请求超时，所有下游 goroutine 都应该被及时取消，以释放资源。没有 context，你只能用共享变量 + mutex 手动通知——既丑陋又容易出错。

### Context 接口定义

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}
    Err() error
    Value(key any) any
}
```

| 方法 | 作用 |
|------|------|
| `Deadline()` | 返回截止时间，如果没有设置则 `ok=false` |
| `Done()` | 返回一个 channel，关闭时表示 context 被取消或超时 |
| `Err()` | 返回取消原因（`Canceled` 或 `DeadlineExceeded`） |
| `Value(key)` | 返回绑定到该 key 的值 |

### 根 Context：Background 与 TODO

```go
ctx := context.Background()  // 顶层 context，用于 main、初始化、测试
ctx := context.TODO()        // 暂时不确定用哪个 context，后续重构
```

**规则：** `Background()` 是所有 context 树的根。`TODO()` 是代码审查的标记——看到它就该重构。

---

## 二、脑图（ASCII）

```
context 包
├── 根 Context
│   ├── Background() — 主流程起点
│   └── TODO()       — 临时占位
├── 派生 Context（Derive）
│   ├── WithCancel(parent)       — 手动取消
│   ├── WithTimeout(parent, dur) — 超时自动取消
│   ├── WithDeadline(parent, t)  — 截止时间取消
│   └── WithValue(parent, k, v)  — 传递请求级值
├── 取消传播
│   ├── parent 取消 → children 全部取消
│   └── child 取消 → parent 不受影响
└── 使用模式
    ├── select + ctx.Done()
    ├── context 作为第一个参数
    └── defer cancel() 防泄漏
```

---

## 三、完整 Go 代码

### v1：基础 WithCancel

```go
package main

import (
    "context"
    "fmt"
    "time"
)

// simulateWork simulates a long-running task that respects context cancellation.
func simulateWork(ctx context.Context, id int) {
    for i := 0; ; i++ {
        select {
        case <-ctx.Done():
            fmt.Printf("Worker %d: canceled (%v)\n", id, ctx.Err())
            return
        default:
            fmt.Printf("Worker %d: working step %d\n", id, i)
            time.Sleep(500 * time.Millisecond)
        }
    }
}

func main() {
    // Create a cancellable context derived from Background
    ctx, cancel := context.WithCancel(context.Background())

    // Start 3 workers
    for i := 1; i <= 3; i++ {
        go simulateWork(ctx, i)
    }

    // Cancel after 2 seconds
    time.Sleep(2 * time.Second)
    cancel()

    // Give workers time to print cancellation message
    time.Sleep(100 * time.Millisecond)
    fmt.Println("Main: all workers stopped")
}
```

**执行预览：**

```
Worker 1: working step 0
Worker 2: working step 0
Worker 3: working step 0
Worker 1: working step 1
Worker 2: working step 1
...
Worker 1: canceled (context canceled)
Worker 2: canceled (context canceled)
Worker 3: canceled (context canceled)
Main: all workers stopped
```

### v2：WithTimeout + WithValue + select 模式

```go
package main

import (
    "context"
    "fmt"
    "time"
)

// requestIDKey is a custom type for context keys to avoid collision.
type requestIDKey string

// fetchUserData simulates an API call with timeout.
func fetchUserData(ctx context.Context) (string, error) {
    // Extract request ID from context for logging
    reqID, _ := ctx.Value(requestIDKey("reqID")).(string)
    fmt.Printf("[%s] fetchUserData: started\n", reqID)

    // Simulate slow work
    select {
    case <-time.After(3 * time.Second):
        return "user data loaded", nil
    case <-ctx.Done():
        return "", fmt.Errorf("[%s] fetchUserData: %w", reqID, ctx.Err())
    }
}

// processOrder orchestrates multiple calls, each with its own timeout.
func processOrder(ctx context.Context) error {
    reqID, _ := ctx.Value(requestIDKey("reqID")).(string)

    // Child context with shorter timeout for the DB call
    dbCtx, dbCancel := context.WithTimeout(ctx, 1*time.Second)
    defer dbCancel()

    result, err := fetchUserData(dbCtx)
    if err != nil {
        return fmt.Errorf("[%s] processOrder failed: %w", reqID, err)
    }
    fmt.Printf("[%s] Result: %s\n", reqID, result)
    return nil
}

func main() {
    // Parent context with request-scoped value + overall timeout
    ctx := context.WithValue(context.Background(), requestIDKey("reqID"), "ORD-2024-001")
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    if err := processOrder(ctx); err != nil {
        fmt.Println("Error:", err)
    }
}
```

**执行预览：**

```
[ORD-2024-001] fetchUserData: started
[ORD-2024-001] processOrder failed: [ORD-2024-001] fetchUserData: context deadline exceeded
Error: [ORD-2024-001] processOrder failed: [ORD-2024-001] fetchUserData: context deadline exceeded
```

### v3：WithDeadline + 传播树 + 最佳实践

```go
package main

import (
    "context"
    "fmt"
    "time"
)

// deepCall demonstrates cancellation propagation through nested contexts.
func deepCall(ctx context.Context, depth int) {
    if depth == 0 {
        // Leaf node: wait for cancellation
        <-ctx.Done()
        fmt.Printf("  Leaf: canceled at depth 0, reason=%v\n", ctx.Err())
        return
    }

    // Each level derives its own child context
    childCtx, cancel := context.WithCancel(ctx)
    defer cancel()

    go deepCall(childCtx, depth-1)

    <-ctx.Done()
    fmt.Printf("  Level %d: canceled, reason=%v\n", depth, ctx.Err())
}

// gracefulShutdown demonstrates deadline-based shutdown with cleanup.
func gracefulShutdown(ctx context.Context) {
    deadline, ok := ctx.Deadline()
    if ok {
        fmt.Printf("Shutdown deadline: %v (in %v)\n", deadline, time.Until(deadline))
    }

    // Simulate cleanup phases
    phases := []string{"close DB", "flush cache", "stop workers"}
    for _, phase := range phases {
        select {
        case <-time.After(400 * time.Millisecond):
            fmt.Printf("  ✓ %s done\n", phase)
        case <-ctx.Done():
            fmt.Printf("  ✗ %s aborted: %v\n", phase, ctx.Err())
            return
        }
    }
    fmt.Println("Graceful shutdown completed")
}

func main() {
    fmt.Println("=== Cancellation Propagation Tree ===")
    {
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        go deepCall(ctx, 3)
        time.Sleep(3 * time.Second) // Wait for timeout
    }

    fmt.Println("\n=== Graceful Shutdown with Deadline ===")
    {
        deadline := time.Now().Add(1 * time.Second)
        ctx, cancel := context.WithDeadline(context.Background(), deadline)
        defer cancel()
        gracefulShutdown(ctx)
    }
}
```

**执行预览：**

```
=== Cancellation Propagation Tree ===
  Leaf: canceled at depth 0, reason=context deadline exceeded
  Level 1: canceled, reason=context deadline exceeded
  Level 2: canceled, reason=context deadline exceeded
  Level 3: canceled, reason=context deadline exceeded

=== Graceful Shutdown with Deadline ===
Shutdown deadline: 2024-... (in 999.xxxms)
  ✓ close DB done
  ✗ flush cache aborted: context deadline exceeded
```

---

## 四、注意事项

| 项目 | 说明 |
|------|------|
| cancel 必须调用 | 即使 context 已超时，`cancel()` 也必须调用以释放内部资源。用 `defer cancel()` |
| 不要传递 nil | 如果没有 context，用 `context.Background()`，永远不要传 `nil` |
| context 参数位置 | `func DoSomething(ctx context.Context, arg string)` — 永远第一个参数 |
| WithValue 要克制 | 只用于请求级跨边界数据（request ID、trace ID），不要当全局变量用 |
| 不要存储业务数据 | context value 不是 dependency injection 容器 |
| goroutine 泄漏 | 不处理 `ctx.Done()` 的 goroutine 会永远挂起 |

---

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `ctx = context.WithValue(ctx, "id", 123)` 用字符串做 key | `type myKey string` 自定义类型做 key，避免碰撞 |
| `cancel()` 放在 if 分支里 | `defer cancel()` 放在创建后立即调用 |
| 在 struct 里存 context | context 作为函数参数传递，不要存到 struct 字段 |
| 只创建不取消（`WithCancel` 后不调 `cancel`） | 始终 `defer cancel()`，即使有 timeout |
| 用 WithValue 传数据库连接 | 用显式参数传递依赖 |
| `select` 里不处理 `ctx.Done()` | 每个耗时操作都要 select + `ctx.Done()` |

---

## 六、练习题

### 🟢 入门：超时取消
写一个函数，用 `WithTimeout` 设置 1 秒超时，内部模拟 3 秒操作。打印超时错误。

### 🟡 中级：请求链路追踪
用 `WithValue` 注入 trace ID，经过 3 层函数调用，每层打印 trace ID。注意 key 类型安全。

### 🔴 高级：HTTP 服务器优雅关闭
实现一个 HTTP server，监听 `SIGINT` 信号后用 `context.WithTimeout` 给 5 秒优雅关闭窗口，超时则强制退出。

---

## 七、知识点总结（树状）

```
Context
├── 核心接口
│   ├── Deadline() → 截止时间
│   ├── Done()     → 取消 channel
│   ├── Err()      → 取消原因
│   └── Value()    → 请求级值
├── 派生方式
│   ├── WithCancel    → 手动取消
│   ├── WithTimeout   → 相对超时
│   ├── WithDeadline  → 绝对截止
│   └── WithValue     → 值传递
├── 传播规则
│   ├── 父取消 → 所有子取消
│   └── 子取消 → 父不受影响
└── 最佳实践
    ├── 第一个参数
    ├── defer cancel()
    ├── 自定义 key 类型
    └── 不存 struct
```

---

## 八、举一反三

| 场景 | 派生方式 | 典型用法 |
|------|---------|---------|
| HTTP 请求处理 | `WithTimeout(req.Context(), 10s)` | 防止单请求卡住 |
| gRPC 调用 | `WithDeadline` | 遵循上游截止时间 |
| 数据库查询 | `WithTimeout(ctx, 5s)` | 慢查询保护 |
| 后台任务 | `WithCancel(ctx)` | 手动取消批处理 |
| 链路追踪 | `WithValue(ctx, traceKey, id)` | OpenTelemetry trace ID |
| 定时任务 | `context.Background()` | 不受请求取消影响 |

---

## 九、参考资料

1. [Go 官方 context 包文档](https://pkg.go.dev/context)
2. [Go Blog: Context](https://go.dev/blog/context)
3. [Go Concurrency Patterns: Context](https://go.dev/blog/io2013-talk-concurrency)
4. 《Go 程序设计语言》— Alan Donovan, Brian Kernighan

---

## 十、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | WithCancel 基础取消 | 学习取消机制 |
| v2 | WithTimeout + WithValue + select | HTTP 请求处理 |
| v3 | WithDeadline + 传播树 + 优雅关闭 | 生产级服务 |

---

_Context 不是可选的，是 Go 并发的基石。_ 🚀
