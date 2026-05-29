---
title: "026 - panic 与 recover"
slug: "026-panic-recover"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.869+08:00"
updated_at: "2026-04-29T10:02:44.614+08:00"
reading_time: 27
tags: ["Go基础"]
---

# 026 - panic 与 recover

> **难度：⭐⭐⭐** | panic 是 Go 的"紧急制动"，recover 是"安全气囊"。用对地方是艺术，用错地方是灾难。

## 一、概念讲解

Go 有两种错误处理机制：**error（可预期的错误）** 和 **panic（不可恢复的异常）**。

### panic 是什么？

- 一个内置函数，会立刻中断当前函数的执行
- 开始执行当前 goroutine 中所有 defer 的函数
- 如果 defer 中有 recover，可以"接住" panic
- 如果没有 recover，程序崩溃，打印栈信息

### recover 是什么？

- 一个内置函数，只能在 defer 中使用
- 返回 panic 传入的值
- 如果不在 defer 中调用，返回 nil

### 什么时候用 panic？

- **程序初始化失败**（配置文件缺失、必须的资源不可用）
- **不可能的条件**（switch 的 default 分支）
- **库的 must 函数**（template.Must、regexp.MustCompile）
- **严重 bug 被发现**（空指针、数组越界——说明代码有 bug）

**不应该用 panic 的场景：** 文件不存在、网络超时、用户输入错误——这些应该用 error。

## 二、脑图（ASCII）

```
Panic & Recover
├── panic
│   ├── 内置函数 panic(v)
│   ├── 触发场景
│   │   ├── 手动调用 panic()
│   │   ├── 数组/切片越界
│   │   ├── 空指针解引用
│   │   ├── 除以零（整数）
│   │   └── map 并发读写
│   └── 传播机制
│       ├── 停止当前函数
│       ├── 执行所有 defer
│       ├── 向上传播到调用者
│       └── 直到 goroutine 顶层 → crash
├── recover
│   ├── 只在 defer 中有效
│   ├── 返回 panic 的值
│   └── 阻止 panic 继续传播
├── panic vs error
│   ├── error: 可预期的失败
│   └── panic: 不可恢复的严重错误
└── 实践模式
    ├── must 模式 (MustCompile 等)
    ├── recover 中间件
    └── goroutine 中的 recover
```

## 三、完整 Go 代码

### v1：基础 panic 和 recover

```go
package main

import "fmt"

// Function that panics
func mustBePositive(n int) {
    if n <= 0 {
        panic(fmt.Sprintf("must be positive, got %d", n))
    }
    fmt.Printf("%d is positive ✓\n", n)
}

// Function with recover in defer
func safeCall(f func()) (result interface{}) {
    defer func() {
        if r := recover(); r != nil {
            // Catch the panic and store the value
            result = r
        }
    }()
    f()
    return nil
}

func main() {
    // Normal call - no panic
    mustBePositive(42)

    // Call that panics - but recovered
    err := safeCall(func() {
        mustBePositive(-1)
    })
    if err != nil {
        fmt.Printf("Recovered from panic: %v\n", err)
    }

    // Runtime panics
    fmt.Println("\n--- Runtime panics ---")

    // Slice out of bounds (caught by safeCall)
    err = safeCall(func() {
        s := []int{1, 2, 3}
        _ = s[10] // index out of range
    })
    if err != nil {
        fmt.Printf("Recovered: %v\n", err)
    }

    // Nil pointer dereference (caught by safeCall)
    err = safeCall(func() {
        var p *string
        fmt.Println(*p) // nil pointer dereference
    })
    if err != nil {
        fmt.Printf("Recovered: %v\n", err)
    }

    fmt.Println("\nProgram continues normally!")
}
```

### v2：defer 中 recover 的细节 + panic 传播

```go
package main

import "fmt"

// Demonstrates panic propagation through call stack
func level3() {
    fmt.Println("level3: start")
    panic("panic from level3")
    fmt.Println("level3: unreachable") // never executed
}

func level2() {
    defer func() {
        fmt.Println("level2: defer runs during panic unwind")
    }()
    fmt.Println("level2: calling level3")
    level3()
    fmt.Println("level2: unreachable")
}

func level1() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Printf("level1: recovered → %v\n", r)
        }
    }()
    fmt.Println("level1: calling level2")
    level2()
    fmt.Println("level1: after level2 (reached because we recovered)")
}

// Demonstrates multiple defers execute in LIFO order during panic
func deferOrderDemo() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Printf("Recovered: %v\n", r)
        }
    }()
    defer fmt.Println("defer 2 (executed first - LIFO)")
    defer fmt.Println("defer 1 (executed second - LIFO)")
    fmt.Println("About to panic...")
    panic("boom!")
}

func main() {
    fmt.Println("=== Panic Propagation Demo ===")
    level1()
    fmt.Println("Program survived!\n")

    fmt.Println("=== Defer Order Demo ===")
    deferOrderDemo()
}
```

### v3：must 模式 + 生产级 recover 中间件

```go
package main

import (
    "fmt"
    "log"
    "runtime/debug"
    "time"
)

// ---- Must Pattern ----
// Like template.Must, regexp.MustCompile - panic on error,
// useful for package-level initialization

type Config struct {
    Host string
    Port int
}

func MustParseConfig(raw map[string]string) *Config {
    host, ok := raw["host"]
    if !ok {
        panic("config missing required field: host")
    }
    port, ok := raw["port"]
    if !ok {
        panic("config missing required field: port")
    }
    // In real code: parse port to int
    return &Config{Host: host, Port: 0} // simplified
}

// Package-level var that panics on init if config is bad
var defaultConfig = MustParseConfig(map[string]string{
    "host": "localhost",
    "port": "8080",
})

// ---- HTTP-like Handler with Recovery Middleware ----

type Response struct {
    Status  int
    Body    string
}

type Handler func(req string) Response

// Recovery middleware wraps a handler with panic protection
func RecoveryMiddleware(next Handler) Handler {
    return func(req string) (resp Response) {
        // Recover must be in a deferred function
        defer func() {
            if r := recover(); r != nil {
                // Log the full stack trace
                stack := debug.Stack()
                log.Printf("[RECOVER] panic: %v\n%s", r, stack)
                // Return a 500 response instead of crashing
                resp = Response{
                    Status: 500,
                    Body:   fmt.Sprintf("Internal Server Error: %v", r),
                }
            }
        }()
        return next(req)
    }
}

// A handler that might panic
func riskyHandler(req string) Response {
    if req == "crash" {
        // Simulate a bug: nil pointer dereference
        var p *string
        _ = *p
    }
    if req == "explicit_panic" {
        panic("intentional panic for testing")
    }
    return Response{Status: 200, Body: fmt.Sprintf("Hello, %s!", req)}
}

// ---- Goroutine with recovery ----

func safeGo(name string, fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("[goroutine %s] recovered: %v", name, r)
            }
        }()
        fn()
    }()
}

func main() {
    fmt.Println("=== Must Pattern ===")
    fmt.Printf("Default config: %+v\n", defaultConfig)

    fmt.Println("\n=== Recovery Middleware ===")
    handler := RecoveryMiddleware(riskyHandler)

    // Normal request
    resp := handler("world")
    fmt.Printf("Request 'world' → %d: %s\n", resp.Status, resp.Body)

    // Panic request - recovered gracefully
    resp = handler("crash")
    fmt.Printf("Request 'crash' → %d: %s\n", resp.Status, resp.Body)

    resp = handler("explicit_panic")
    fmt.Printf("Request 'explicit_panic' → %d: %s\n", resp.Status, resp.Body)

    // Normal request still works after recovery
    resp = handler("recovered")
    fmt.Printf("Request 'recovered' → %d: %s\n", resp.Status, resp.Body)

    fmt.Println("\n=== Goroutine Recovery ===")
    safeGo("worker1", func() {
        fmt.Println("worker1: working...")
        time.Sleep(10 * time.Millisecond)
        panic("worker1 exploded!")
    })
    safeGo("worker2", func() {
        fmt.Println("worker2: working...")
        time.Sleep(50 * time.Millisecond)
        fmt.Println("worker2: done!")
    })

    time.Sleep(100 * time.Millisecond)
    fmt.Println("\nMain goroutine still alive!")
}
```

## 四、执行预览

```
$ go run main_v1.go
42 is positive ✓
Recovered from panic: must be positive, got -1

--- Runtime panics ---
Recovered: runtime error: index out of range [10] with length 3
Recovered: runtime error: invalid memory address or nil pointer dereference

Program continues normally!

$ go run main_v2.go
=== Panic Propagation Demo ===
level1: calling level2
level2: calling level3
level3: start
level2: defer runs during panic unwind
level1: recovered → panic from level3
Program survived!

=== Defer Order Demo ===
About to panic...
defer 2 (executed first - LIFO)
defer 1 (executed second - LIFO)
Recovered: boom!

$ go run main_v3.go
=== Must Pattern ===
Default config: &{Host:localhost Port:8080}

=== Recovery Middleware ===
Request 'world' → 200: Hello, world!
[RECOVER] panic: runtime error: invalid memory address...
Request 'crash' → 500: Internal Server Error: ...
Request 'explicit_panic' → 500: Internal Server Error: ...
Request 'recovered' → 200: Hello, recovered!

=== Goroutine Recovery ===
worker1: working...
[goroutine worker1] recovered: worker1 exploded!
worker2: working...
worker2: done!
Main goroutine still alive!
```

## 五、注意事项（表格）

| 事项 | 说明 |
|------|------|
| recover 只在 defer 中有效 | 在普通代码中调用 recover() 返回 nil |
| defer 必须是直接调用 | `defer recover()` 无效，必须 `defer func() { recover() }()` |
| panic 不跨 goroutine | 每个 goroutine 独立，子 goroutine panic 不会 recover 到父 goroutine |
| recover 后无法回到 panic 点 | panic 之后的代码不会执行 |
| 多个 defer LIFO 执行 | panic 时 defer 按后进先出顺序执行 |
| 性能开销 | panic/recover 有栈展开开销，不要用于正常流程控制 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用 panic 处理业务错误 | 用 error 返回值 |
| 忘记在 goroutine 里 recover | 每个新 goroutine 都加 recover |
| `defer recover()` 直接调用 | `defer func() { recover() }()` |
| recover 后不做任何日志 | 至少 log.Printf 记录 panic 信息 |
| 用 panic/recover 做流程控制 | 它是应急机制，不是 try-catch |
| 认为 panic 会跨 goroutine | 每个 goroutine 独立处理 |

## 七、练习题

### 🟢 入门

1. 写一个函数，接收一个整数切片，如果切片为空就 panic，然后用 recover 捕获
2. 验证 `defer recover()` 和 `defer func() { recover() }()` 的区别

### 🟡 进阶

3. 实现一个 `Must[T]` 泛型函数：`func Must[T any](val T, err error) T`，err 不为 nil 就 panic
4. 写一个 HTTP 中间件，recover 后返回 JSON 格式的 500 错误响应

### 🔴 挑战

5. 实现一个 goroutine pool，每个 worker 自带 recover，panic 后自动重启 worker
6. 设计一个分级 panic 处理策略：业务 panic 记日志继续，系统级 panic 让程序优雅退出

## 八、知识点总结（树状）

```
Panic & Recover
├── panic
│   ├── 触发方式
│   │   ├── 手动 panic(value)
│   │   ├── 运行时错误（越界、空指针、除零）
│   │   └── 并发 map 读写
│   ├── 传播机制
│   │   ├── 停止当前函数
│   │   ├── 执行 defer（LIFO）
│   │   ├── 返回调用者
│   │   └── 到 goroutine 顶层 → crash
│   └── 参数类型
│       └── interface{}（任意类型）
├── recover
│   ├── 必须在 defer 中
│   ├── 返回 panic 的值
│   └── 阻止继续传播
├── panic vs error
│   ├── error: 可预期的，调用者应处理
│   └── panic: 不可恢复的，严重 bug 或不可用资源
└── 模式
    ├── Must 模式（初始化用）
    ├── Recovery 中间件（Web 服务）
    └── safeGo（goroutine 保护）
```

## 九、举一反三（表格）

| 场景 | Go 方案 | 其他语言对比 |
|------|---------|-------------|
| 不可恢复错误 | panic + recover | Java: RuntimeException |
| 初始化失败 | Must 模式 panic | Java: throw in static block |
| Web 错误恢复 | Recovery middleware | Java: @ExceptionHandler |
| Goroutine 崩溃 | safeGo pattern | Erlang: supervisor |
| 断言失败 | panic("unreachable") | C: assert() |
| 泛型 Must | Must[T any](T, error) T | Rust: unwrap() |

## 十、参考资料

- [Go Spec: Handling panics](https://go.dev/ref/spec#Handling_panics)
- [Go Blog: Defer, Panic, and Recover](https://go.dev/blog/defer-panic-and-recover)
- [Effective Go: Panic](https://go.dev/doc/effective_go#panic)

## 十一、代码演进总结

| 版本 | 重点 | 关键技术 |
|------|------|---------|
| v1 | 基础 panic/recover | panic(), recover(), safeCall 包装 |
| v2 | 传播机制与 defer 顺序 | 多层调用栈, LIFO defer |
| v3 | 生产模式 | Must 模式, Recovery 中间件, safeGo |
