---
title: "001 - Goroutine并发基础"
slug: "001-goroutine"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.941+08:00"
updated_at: "2026-04-29T10:02:44.66+08:00"
reading_time: 21
tags: ["并发"]
---

# 031 - Goroutine 并发基础

> **难度：⭐⭐⭐ 中等**
> 适合有一定 Go 基础，想深入理解并发编程的开发者。

---

## 一、概念讲解

### 什么是 Goroutine？

Goroutine 是 Go 语言运行时管理的轻量级线程。只需在函数调用前加上 `go` 关键字，就能让这个函数在新的 goroutine 中并发执行。

```go
go doSomething() // 启动一个 goroutine
```

### 为什么需要 Goroutine？

传统操作系统线程存在几个问题：
- **创建成本高**：每个线程需要分配 1-8MB 栈空间
- **上下文切换慢**：涉及内核态/用户态切换
- **数量受限**：一台机器通常只能创建几千个线程

Goroutine 通过**用户态调度**解决了这些问题：
- 初始栈仅需 **2KB**（可动态增长到 1GB）
- 创建成本接近于一次函数调用
- 单机可轻松创建**百万级** goroutine

---

## 二、脑图（ASCII）

```
Goroutine 并发基础
├── 创建与启动
│   ├── go 关键字
│   ├── 匿名函数 goroutine
│   └── goroutine 是函数级别的并发
├── 调度模型（GMP）
│   ├── G - Goroutine（用户态协程）
│   ├── M - Machine（操作系统线程）
│   ├── P - Processor（逻辑处理器）
│   ├── 全局运行队列
│   ├── 本地运行队列（256个G）
│   ├── work stealing（工作窃取）
│   └── hand off（交接）
├── Goroutine vs 线程
│   ├── 栈大小：2KB vs 1-8MB
│   ├── 创建成本：~0.3μs vs ~10μs
│   ├── 切换成本：用户态 vs 内核态
│   └── 数量上限：百万级 vs 千级
├── runtime.GOMAXPROCS
│   ├── 控制并行度（P 的数量）
│   ├── 默认 = CPU 核心数
│   └── 影响 CPU 密集型任务性能
├── Goroutine 泄漏
│   ├── 什么是泄漏
│   ├── 常见泄漏场景
│   └── 检测与预防
├── sync.WaitGroup
│   ├── Add / Done / Wait
│   └── 计数器管理
└── 并发安全初探
    ├── 竞态条件（Race Condition）
    ├── go run -race
    └── sync.Mutex 简介
```

---

## 三、完整 Go 代码

### v1：基础 - 启动多个 Goroutine

```go
package main

import (
    "fmt"
    "time"
)

// worker simulates a task with a given ID
func worker(id int) {
    for i := 0; i < 3; i++ {
        fmt.Printf("Worker %d: working on task %d\n", id, i)
        time.Sleep(100 * time.Millisecond)
    }
    fmt.Printf("Worker %d: done\n", id)
}

func main() {
    // Start 3 goroutines
    go worker(1)
    go worker(2)
    go worker(3)

    // Problem: main exits before goroutines finish!
    // We need time.Sleep here (bad practice, fixed in v2)
    time.Sleep(1 * time.Second)
    fmt.Println("Main: all done")
}
```

### v2：进阶 - 使用 WaitGroup 等待

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// worker performs work and signals Done to WaitGroup
func worker(id int, wg *sync.WaitGroup) {
    // IMPORTANT: defer wg.Done() to ensure it runs even on panic
    defer wg.Done()

    fmt.Printf("Worker %d: started\n", id)
    time.Sleep(time.Duration(id) * 100 * time.Millisecond)
    fmt.Printf("Worker %d: finished\n", id)
}

func main() {
    var wg sync.WaitGroup

    // Start 5 goroutines
    for i := 1; i <= 5; i++ {
        wg.Add(1) // Increment counter BEFORE starting goroutine
        go worker(i, &wg)
    }

    // Wait for all goroutines to complete
    wg.Wait()
    fmt.Println("Main: all workers completed")
}
```

### v3：实战 - 并发安全 + Goroutine 泄漏防护

```go
package main

import (
    "context"
    "fmt"
    "math/rand"
    "runtime"
    "sync"
    "time"
)

// SafeCounter is a thread-safe counter using Mutex
type SafeCounter struct {
    mu    sync.Mutex
    value int
}

func (c *SafeCounter) Increment() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.value++
}

func (c *SafeCounter) Value() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.value
}

// processWithContext shows proper goroutine lifecycle management
func processWithContext(ctx context.Context, id int, results chan<- int) {
    defer close(results) // Channel cleanup on exit

    for {
        select {
        case <-ctx.Done():
            fmt.Printf("Process %d: cancelled, exiting\n", id)
            return
        default:
            // Simulate work
            n := rand.Intn(100)
            results <- n
            if n > 90 {
                fmt.Printf("Process %d: found target %d, exiting\n", id, n)
                return
            }
        }
    }
}

func main() {
    // --- Part 1: Thread-safe counter ---
    fmt.Println("=== Safe Counter Demo ===")
    counter := &SafeCounter{}
    var wg sync.WaitGroup

    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter.Increment()
        }()
    }
    wg.Wait()
    fmt.Printf("Counter value: %d (expected: 1000)\n", counter.Value())

    // --- Part 2: Context-based cancellation ---
    fmt.Println("\n=== Context Cancellation Demo ===")
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()

    results := make(chan int, 10)
    go processWithContext(ctx, 1, results)

    for v := range results {
        fmt.Printf("Received: %d\n", v)
    }

    // --- Part 3: Monitor goroutine count ---
    fmt.Printf("\nActive goroutines: %d\n", runtime.NumGoroutine())
    fmt.Println("Main: completed successfully")
}
```

---

## 四、执行预览

**v1 执行结果：**
```
Worker 1: working on task 0
Worker 2: working on task 0
Worker 3: working on task 0
Worker 1: working on task 1
Worker 2: working on task 1
Worker 3: working on task 1
Worker 1: working on task 2
Worker 2: working on task 2
Worker 3: working on task 2
Worker 1: done
Worker 2: done
Worker 3: done
Main: all done
```

**v3 执行结果：**
```
=== Safe Counter Demo ===
Counter value: 1000 (expected: 1000)

=== Context Cancellation Demo ===
Received: 37
Received: 82
Received: 45
Received: 93
Process 1: found target 93, exiting

Active goroutines: 1
Main: completed successfully
```

---

## 五、注意事项

| 注意点 | 说明 | 严重程度 |
|--------|------|----------|
| Goroutine 泄漏 | 启动的 goroutine 永远不会退出，导致内存泄漏 | 🔴 严重 |
| WaitGroup 计数错误 | `Add` 和 `Done` 不匹配会 panic | 🔴 严重 |
| 竞态条件 | 多个 goroutine 同时读写共享变量 | 🔴 严重 |
| time.Sleep 等待 | 用 Sleep 等待 goroutine 完成是不可靠的 | 🟡 不推荐 |
| 匿名函数捕获循环变量 | go 1.22 之前会有变量捕获问题 | 🟡 注意 |
| Goroutine 内 panic | 未 recover 的 panic 会导致整个程序崩溃 | 🔴 严重 |
| GOMAXPROCS 设置过大 | 超过 CPU 核心数通常没有好处 | 🟢 轻微 |

---

## 六、避坑指南

### ❌ 用 time.Sleep 等待 goroutine
```go
go doWork()
time.Sleep(2 * time.Second) // Race condition: might not be enough
```
### ✅ 使用 WaitGroup
```go
var wg sync.WaitGroup
wg.Add(1)
go func() {
    defer wg.Done()
    doWork()
}()
wg.Wait() // Guaranteed to wait
```

### ❌ 循环变量捕获（Go 1.21 及之前）
```go
for _, v := range values {
    go func() {
        fmt.Println(v) // Always prints last value!
    }()
}
```
### ✅ 通过参数传递
```go
for _, v := range values {
    go func(val int) {
        fmt.Println(val) // Correct: each goroutine gets its own copy
    }(v)
}
```

### ❌ 忘记 recover 导致程序崩溃
```go
go func() {
    panic("oops") // Crashes entire program!
}()
```
### ✅ 在 goroutine 内 recover
```go
go func() {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("Recovered: %v", r)
        }
    }()
    panic("oops") // Safely recovered
}()
```

### ❌ WaitGroup Add 在 goroutine 内部调用
```go
for i := 0; i < n; i++ {
    go func() {
        wg.Add(1) // Too late! Wait() might already have returned
        defer wg.Done()
        doWork()
    }()
}
```
### ✅ Add 在启动 goroutine 之前调用
```go
for i := 0; i < n; i++ {
    wg.Add(1) // Increment BEFORE go statement
    go func() {
        defer wg.Done()
        doWork()
    }()
}
```

---

## 七、练习题

### 🟢 入门：并发 Hello
编写程序，启动 5 个 goroutine，每个打印 "Hello from goroutine N"，使用 WaitGroup 等待全部完成。

### 🟡 中级：并发计数器
编写一个程序，启动 100 个 goroutine，每个对共享计数器加 1000 次。验证最终结果是否正确。分别用互斥锁和 `sync/atomic` 实现。

### 🔴 高级：Goroutine 池
实现一个简单的 goroutine 池：固定 N 个 worker 从任务 channel 中取任务执行，支持优雅关闭（所有任务完成后才退出）。

---

## 八、知识点总结

```
Goroutine 知识体系
├── 基础
│   ├── go 关键字启动
│   ├── main goroutine
│   └── 匿名函数 goroutine
├── 调度
│   ├── GMP 模型
│   ├── GOMAXPROCS
│   ├── work stealing
│   └── Go 1.14 异步抢占
├── 同步
│   ├── sync.WaitGroup
│   ├── sync.Mutex
│   ├── sync.Once
│   └── context.Context
├── 生命周期管理
│   ├── 通过 channel 通知退出
│   ├── context 超时/取消
│   └── defer + recover
└── 调试
    ├── runtime.NumGoroutine()
    ├── go run -race
    └── pprof goroutine profile
```

---

## 九、举一反三

| 场景 | 类比理解 | 推荐方案 |
|------|----------|----------|
| 批量 HTTP 请求 | 多个快递员同时送快递 | goroutine + WaitGroup + 限流 |
| 并发数据库查询 | 多个窗口同时办理业务 | goroutine 池 + channel |
| 实时日志处理 | 多条流水线并行处理 | fan-out/fan-in 模式 |
| 定时任务 | 闹钟到点就响 | goroutine + time.Ticker |
| WebSocket 连接管理 | 每个连接一个管家 | 每 conn 一个 goroutine + context |
| 文件批量处理 | 多台打印机同时工作 | goroutine + semaphore 控制并发数 |

---

## 十、参考资料

- [Effective Go - Concurrency](https://go.dev/doc/effective_go#concurrency)
- [Go Scheduler Design Doc](https://docs.google.com/document/d/1TTj4T2JO42uD5ID9e89oa0sLKhJYD0Y_kqxDv3I3XMw)
- [Go Blog: Share Memory By Communicating](https://go.dev/blog/codelab-share)
- 《Go 语言设计与实现》- 4.1 调度器
- 《Concurrency in Go》- Katherine Cox-Buday

---

## 十一、代码演进路线

```
v1 基础版
├── go 关键字启动 goroutine
├── time.Sleep 等待（不推荐）
└── 问题：主 goroutine 可能提前退出
│
▼
v2 WaitGroup 版
├── sync.WaitGroup 同步等待
├── defer wg.Done() 确保完成信号
└── 改进：可靠等待所有 goroutine
│
▼
v3 生产版
├── sync.Mutex 并发安全
├── context.Context 生命周期管理
├── runtime.NumGoroutine() 监控
└── 特性：安全 + 可控 + 可观测
```

> **下一篇：** [032 - Channel 通道基础](/posts/032-channel-basics) — 学习 goroutine 之间的通信机制。
