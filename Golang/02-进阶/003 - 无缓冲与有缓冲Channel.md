---
title: "003 - 无缓冲与有缓冲Channel"
slug: "003-buffered-channel"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.962+08:00"
updated_at: "2026-04-29T10:02:44.678+08:00"
reading_time: 28
tags: ["并发"]
---

# 033 - 无缓冲与有缓冲 Channel

> **难度：⭐⭐⭐ 中等**
> 理解无缓冲与有缓冲 Channel 的本质区别，是掌握 Go 并发的关键。

---

## 一、概念讲解

### 无缓冲 Channel（Unbuffered）

无缓冲 channel 没有缓冲区，**发送和接收必须同时就绪才能完成**。这就像面对面交接：发送方必须等接收方准备好，双方"握手"后才完成数据传递。

```go
ch := make(chan int) // 无缓冲
```

**核心特性：同步（Synchronous）**
- 发送操作阻塞，直到有 goroutine 接收
- 接收操作阻塞，直到有 goroutine 发送
- 保证数据被接收时，发送方确认已交付

### 有缓冲 Channel（Buffered）

有缓冲 channel 有一个固定大小的缓冲区。只要缓冲区没满，发送就不会阻塞；只要缓冲区不空，接收就不会阻塞。

```go
ch := make(chan int, 10) // 缓冲区大小为 10
```

**核心特性：异步（Asynchronous）**
- 缓冲区未满时，发送立即返回
- 缓冲区不为空时，接收立即返回
- 缓冲区满时发送阻塞，缓冲区空时接收阻塞

### 关键区别一览

| 特性 | 无缓冲 | 有缓冲 |
|------|--------|--------|
| 创建 | `make(chan T)` | `make(chan T, n)` |
| 缓冲区 | 无 | n 个元素 |
| 发送阻塞条件 | 无接收者 | 缓冲区满 |
| 接收阻塞条件 | 无发送者 | 缓冲区空 |
| 同步/异步 | 同步 | 异步 |
| 容量 | 0 | n |
| 适用场景 | 强同步、信号 | 流量缓冲、解耦 |

---

## 二、脑图（ASCII）

```
无缓冲 vs 有缓冲 Channel
├── 无缓冲 Channel
│   ├── make(chan T)
│   ├── 同步语义（握手式传递）
│   ├── 发送阻塞 ↔ 等待接收者
│   ├── 接收阻塞 ↔ 等待发送者
│   ├── 保证数据已被接收
│   └── 典型场景：信号通知、同步点
├── 有缓冲 Channel
│   ├── make(chan T, n)
│   ├── 异步语义（邮箱式传递）
│   ├── 发送阻塞 ↔ 缓冲区满
│   ├── 接收阻塞 ↔ 缓冲区空
│   ├── 解耦生产速度差异
│   └── 典型场景：生产者-消费者、限流
├── 容量与阻塞关系
│   ├── cap(ch) → 缓冲区大小
│   ├── len(ch) → 当前元素数
│   └── 缓冲区状态：空 → 可用 → 满
├── 生产者-消费者模式
│   ├── 单生产者单消费者
│   ├── 多生产者单消费者
│   └── 多生产者多消费者
├── Channel 选择原则
│   ├── 需要同步 → 无缓冲
│   ├── 需要解耦 → 有缓冲
│   └── 需要限流 → 有缓冲（容量=并发数）
└── 常见死锁场景
    ├── 所有 goroutine 阻塞
    ├── 无接收者的无缓冲发送
    ├── 缓冲区满无消费者
    └── 缺少 goroutine 协作
```

---

## 三、完整 Go 代码

### v1：基础 - 无缓冲 vs 有缓冲对比

```go
package main

import (
    "fmt"
    "time"
)

func main() {
    // --- Unbuffered channel demo ---
    fmt.Println("=== Unbuffered Channel ===")
    unbufCh := make(chan string)

    go func() {
        fmt.Println("Sender: preparing to send...")
        unbufCh <- "hello" // Blocks until receiver is ready
        fmt.Println("Sender: message sent!")
    }()

    time.Sleep(100 * time.Millisecond) // Let sender reach send point
    msg := <-unbufCh                   // This "unblocks" the sender
    fmt.Printf("Receiver: got %q\n", msg)

    // --- Buffered channel demo ---
    fmt.Println("\n=== Buffered Channel ===")
    bufCh := make(chan string, 3) // Buffer size = 3

    // Can send 3 values without any receiver
    bufCh <- "msg1"
    bufCh <- "msg2"
    bufCh <- "msg3"
    fmt.Printf("Buffer: len=%d, cap=%d\n", len(bufCh), cap(bufCh))

    // bufCh <- "msg4" // Would block! Buffer is full

    fmt.Println(<-bufCh) // "msg1"
    fmt.Println(<-bufCh) // "msg2"
    fmt.Println(<-bufCh) // "msg3"
}
```

### v2：进阶 - 生产者-消费者模式

```go
package main

import (
    "fmt"
    "math/rand"
    "sync"
    "time"
)

// producer generates items and sends them to the channel
func producer(id int, ch chan<- int, wg *sync.WaitGroup) {
    defer wg.Done()
    for i := 0; i < 5; i++ {
        n := rand.Intn(100)
        ch <- n
        fmt.Printf("Producer %d → %d (len=%d)\n", id, n, len(ch))
        time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
    }
    fmt.Printf("Producer %d: done\n", id)
}

// consumer reads from channel and processes items
func consumer(id int, ch <-chan int, wg *sync.WaitGroup) {
    defer wg.Done()
    for item := range ch {
        fmt.Printf("  Consumer %d ← %d\n", id, item)
        time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
    }
    fmt.Printf("Consumer %d: channel closed, exiting\n", id)
}

func main() {
    // Buffered channel: acts as a queue between producers and consumers
    ch := make(chan int, 10) // Buffer absorbs speed difference

    var prodWg, consWg sync.WaitGroup

    // Start 3 producers
    for i := 1; i <= 3; i++ {
        prodWg.Add(1)
        go producer(i, ch, &prodWg)
    }

    // Start 2 consumers
    for i := 1; i <= 2; i++ {
        consWg.Add(1)
        go consumer(i, ch, &consWg)
    }

    // Close channel after all producers are done
    go func() {
        prodWg.Wait()
        close(ch)
    }()

    // Wait for consumers to finish
    consWg.Wait()
    fmt.Println("Main: all done")
}
```

### v3：实战 - 完整并发系统 + 死锁演示

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

// demonstrateDeadlock shows common deadlock scenarios
func demonstrateDeadlock() {
    fmt.Println("=== Deadlock Scenario (commented out) ===")

    // Scenario 1: Main goroutine sends on unbuffered channel with no receiver
    // ch := make(chan int)
    // ch <- 1 // DEADLOCK! No goroutine to receive

    // Scenario 2: Circular dependency
    // ch1 := make(chan int)
    // ch2 := make(chan int)
    // go func() { ch1 <- <-ch2 }() // Waits for ch2
    // ch2 <- <-ch1                   // Waits for ch1 → deadlock!

    fmt.Println("(Scenarios commented out to avoid actual deadlock)")
}

// rateLimiter uses buffered channel as a semaphore
func rateLimiter() {
    fmt.Println("\n=== Rate Limiter (Semaphore) ===")
    sem := make(chan struct{}, 3) // Max 3 concurrent operations

    var wg sync.WaitGroup
    for i := 1; i <= 10; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            sem <- struct{}{} // Acquire slot (blocks if 3 already running)
            defer func() { <-sem }() // Release slot

            fmt.Printf("Task %d: started\n", id)
            time.Sleep(100 * time.Millisecond)
            fmt.Printf("Task %d: done\n", id)
        }(i)
    }
    wg.Wait()
    fmt.Println("All tasks completed")
}

// gracefulShutdown demonstrates using buffered channel for result collection
func gracefulShutdown() {
    fmt.Println("\n=== Graceful Shutdown ===")
    ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
    defer cancel()

    results := make(chan string, 5) // Buffered: won't block senders
    var wg sync.WaitGroup

    // Start workers
    for i := 1; i <= 5; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            select {
            case <-ctx.Done():
                results <- fmt.Sprintf("Worker %d: cancelled", id)
                return
            case <-time.After(time.Duration(id*100) * time.Millisecond):
                results <- fmt.Sprintf("Worker %d: completed", id)
            }
        }(i)
    }

    // Closer
    go func() {
        wg.Wait()
        close(results)
    }()

    // Collect all results
    for r := range results {
        fmt.Println(r)
    }
    fmt.Println("Shutdown complete")
}

func main() {
    demonstrateDeadlock()
    rateLimiter()
    gracefulShutdown()

    // Channel selection guidelines
    fmt.Println("\n=== Selection Guidelines ===")
    fmt.Println("• Need synchronization?     → Unbuffered (make(chan T))")
    fmt.Println("• Need speed decoupling?    → Buffered  (make(chan T, N))")
    fmt.Println("• Need concurrency limit?   → Buffered  as semaphore")
    fmt.Println("• Need signal (no data)?    → chan struct{}")
}
```

---

## 四、执行预览

**v1 执行结果：**
```
=== Unbuffered Channel ===
Sender: preparing to send...
Receiver: got "hello"
Sender: message sent!

=== Buffered Channel ===
Buffer: len=3, cap=3
msg1
msg2
msg3
```

**v2 执行结果（示例）：**
```
Producer 1 → 47 (len=1)
  Consumer 1 ← 47
Producer 2 → 81 (len=1)
  Consumer 2 ← 81
Producer 3 → 15 (len=1)
Producer 1 → 62 (len=2)
  Consumer 1 ← 15
...
Producer 1: done
Producer 2: done
Producer 3: done
Consumer 1: channel closed, exiting
Consumer 2: channel closed, exiting
Main: all done
```

**v3 执行结果：**
```
=== Deadlock Scenario (commented out) ===
(Scenarios commented out to avoid actual deadlock)

=== Rate Limiter (Semaphore) ===
Task 1: started
Task 2: started
Task 3: started
Task 1: done
Task 4: started
Task 2: done
Task 5: started
...
All tasks completed

=== Graceful Shutdown ===
Worker 1: completed
Worker 2: completed
Worker 3: completed
Worker 4: completed
Worker 5: completed
Shutdown complete

=== Selection Guidelines ===
• Need synchronization?     → Unbuffered (make(chan T))
• Need speed decoupling?    → Buffered  (make(chan T, N))
• Need concurrency limit?   → Buffered  as semaphore
• Need signal (no data)?    → chan struct{}
```

---

## 五、注意事项

| 注意点 | 说明 | 严重程度 |
|--------|------|----------|
| 死锁 | 所有 goroutine 阻塞在 channel 操作上 | 🔴 严重 |
| Goroutine 泄漏 | 发送到没人接收的 channel，goroutine 永远阻塞 | 🔴 严重 |
| 缓冲区大小选择 | 太小→频繁阻塞；太大→内存浪费 | 🟡 设计考量 |
| 关闭时机 | 只应由发送方关闭 | 🔴 严重 |
| 缓冲区非线程安全计数 | `len(ch)` 只反映某一时刻的值 | 🟢 轻微 |
| 无缓冲 ≠ 慢 | 无缓冲是同步语义，不是性能差 | 🟢 概念澄清 |

---

## 六、避坑指南

### ❌ 主 goroutine 直接发送到无缓冲 channel
```go
func main() {
    ch := make(chan int)
    ch <- 1 // DEADLOCK: no receiver, main blocks forever
}
```
### ✅ 先启动接收 goroutine
```go
func main() {
    ch := make(chan int)
    go func() { fmt.Println(<-ch) }()
    ch <- 1 // OK: goroutine is already waiting
}
```

### ❌ 缓冲区大小随意设很大
```go
ch := make(chan int, 1000000) // Wastes memory, hides backpressure issues
```
### ✅ 根据实际流量设置合理缓冲
```go
ch := make(chan int, 100) // Reasonable: small buffer for burst absorption
// If producers overwhelm consumers, fix the imbalance, don't increase buffer
```

### ❌ 忽略 channel 满导致 goroutine 泄漏
```go
func leaky() {
    ch := make(chan int, 1)
    ch <- 1        // OK, buffer has room
    ch <- 2        // Blocks if no consumer! Goroutine leaks
    fmt.Println("never reached")
}
```
### ✅ 使用 select + default 或 context 防泄漏
```go
func safe(ch chan int) {
    select {
    case ch <- 2:
        fmt.Println("sent")
    default:
        fmt.Println("channel full, dropping") // Non-blocking send
    }
}
```

### ❌ 以为无缓冲 channel 有 1 个缓冲
```go
ch := make(chan int)
ch <- 1 // BLOCKS! Unbuffered = 0 capacity, not 1
```
### ✅ 理解无缓冲是零容量
```go
ch := make(chan int, 1) // THIS has capacity 1
ch <- 1                 // OK, buffered
```

---

## 七、练习题

### 🟢 入门：阻塞观察
分别创建无缓冲和有缓冲(容量3)的 channel。在 main goroutine 中发送 4 个值，观察哪个会阻塞。用 goroutine 接收来验证。

### 🟡 中级：限流下载器
实现一个并发下载器，同时最多 3 个下载任务在运行。使用有缓冲 channel 作为信号量控制并发数。模拟 10 个下载任务，每个随机耗时。

### 🔴 高级：带背压的 Pipeline
实现一个三阶段 pipeline（Generate → Process → Collect），当 Collect 阶段处理慢时，通过有缓冲 channel + select 实现背压（backpressure），丢弃超量数据并记录丢弃数量。

---

## 八、知识点总结

```
Channel 缓冲知识体系
├── 无缓冲 Channel
│   ├── make(chan T)
│   ├── 同步传递（零容量）
│   ├── 发送 = 等待接收者就绪
│   ├── 适用：同步、信号、保证交付
│   └── 风险：无协作者则死锁
├── 有缓冲 Channel
│   ├── make(chan T, n)
│   ├── 异步传递（n 容量）
│   ├── 满→发送阻塞，空→接收阻塞
│   ├── 适用：解耦、缓冲、限流
│   └── 风险：缓冲过大隐藏问题
├── 容量管理
│   ├── cap(ch) — 总容量
│   ├── len(ch) — 当前占用
│   └── 缓冲区是环形队列（FIFO）
├── 死锁场景
│   ├── 单 goroutine 自锁
│   ├── 循环等待
│   ├── 缺少消费者
│   └── 检测：go run -race + 超时
└── 设计选择
    ├── 同步需求 → 无缓冲
    ├── 吞吐需求 → 有缓冲
    ├── 并发限制 → 信号量模式
    └── 优雅关闭 → close + range
```

---

## 九、举一反三

| 场景 | Channel 类型 | 缓冲大小 | 原因 |
|------|-------------|----------|------|
| 函数返回单个结果 | 无缓冲 | 0 | 保证结果被接收 |
| 日志写入队列 | 有缓冲 | 100-1000 | 吸收突发写入 |
| HTTP 请求限流 | 有缓冲（信号量） | N（并发数） | 控制同时运行数 |
| 事件广播 | close channel | 0 | close 通知所有等待者 |
| Worker Pool 任务分发 | 有缓冲 | Worker 数 × 2 | 避免 worker 空闲 |
| 进度通知 | 有缓冲 | 1 | 最新进度，非阻塞 |

---

## 十、参考资料

- [Go Spec: Channel types](https://go.dev/ref/spec#Channel_types)
- [Go Blog: Advanced Go Concurrency Patterns](https://go.dev/blog/io2013-talk-concurrency)
- [Go Blog: Go Concurrency Patterns: Context](https://go.dev/blog/context)
- [50 Shades of Go: Traps, Gotchas, and Common Mistakes](https://golang50shad.es/)
- 《Concurrency in Go》Chapter 4 - Concurrency Patterns at Scale

---

## 十一、代码演进路线

```
v1 基础对比版
├── 无缓冲 vs 有缓冲行为演示
├── cap/len 观察
└── 问题：无实际应用场景
│
▼
v2 生产者-消费者版
├── 多生产者 + 多消费者
├── 有缓冲 channel 解耦
├── WaitGroup 协调生命周期
└── 改进：真实并发模式
│
▼
v3 生产系统版
├── 死锁场景分析
├── 信号量限流模式
├── context 超时 + 优雅关闭
├── 通道选择决策指南
└── 特性：防泄漏 + 可观测 + 背压
```

> **上一篇：** [032 - Channel 通道基础](/posts/032-channel-basics)
