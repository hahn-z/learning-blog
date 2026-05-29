---
title: "002 - Channel通道基础"
slug: "002-channel-basics"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.951+08:00"
updated_at: "2026-04-29T10:02:44.668+08:00"
reading_time: 22
tags: ["并发"]
---

# 032 - Channel 通道基础

> **难度：⭐⭐⭐ 中等**
> 掌握 Channel 是 Go 并发编程的核心，它是 goroutine 之间通信的管道。

---

## 一、概念讲解

### 什么是 Channel？

Channel（通道）是 Go 语言中 goroutine 之间通信的核心机制。遵循 **"不要通过共享内存来通信，而要通过通信来共享内存"** 的哲学。

可以把 Channel 想象成一根管道：一端放数据，另一端取数据。发送方和接收方可以在不同的 goroutine 中安全地传递数据。

### Channel 的核心特性

1. **类型安全**：每个 channel 只能传递一种类型的值
2. **阻塞语义**：无缓冲 channel 的发送和接收会阻塞，直到对端就绪
3. **一等公民**：channel 可以作为参数传递、作为返回值、存储在结构体中
4. **引用类型**：channel 的零值是 nil

### Channel 的方向

- **双向 channel**：可发送也可接收
- **只发送 channel**：`chan<- T`，只能往里放数据
- **只接收 channel**：`<-chan T`，只能从里取数据

---

## 二、脑图（ASCII）

```
Channel 通道基础
├── 创建
│   ├── make(chan T) — 无缓冲
│   ├── make(chan T, n) — 有缓冲
│   └── 零值 nil channel
├── 操作
│   ├── 发送 ch <- value
│   ├── 接收 value := <-ch
│   ├── 关闭 close(ch)
│   └── 长度 len(ch) / 容量 cap(ch)
├── 阻塞行为
│   ├── 无缓冲：发送阻塞直到有接收者
│   ├── 无缓冲：接收阻塞直到有发送者
│   └── 有缓冲：缓冲区满才阻塞发送
├── 关闭 Channel
│   ├── close(ch)
│   ├── 接收返回零值 + false
│   ├── range 遍历直到关闭
│   ├── 不能向已关闭的 channel 发送（panic）
│   └── 不能重复关闭（panic）
├── 单向 Channel
│   ├── chan<- T（只写）
│   ├── <-chan T（只读）
│   └── 用于函数参数约束
├── nil Channel
│   ├── 发送：永久阻塞
│   ├── 接收：永久阻塞
│   └── 用于 select 动态禁用分支
└── 常见模式
    ├── 信号通知（chan struct{}）
    ├── 结果收集
    └── 流式处理（range ch）
```

---

## 三、完整 Go 代码

### v1：基础 - Channel 收发

```go
package main

import "fmt"

func main() {
    // Create an unbuffered channel of int
    ch := make(chan int)

    // Start a goroutine to send data
    go func() {
        fmt.Println("Sender: sending 42...")
        ch <- 42 // Send blocks until someone receives
        fmt.Println("Sender: sent 42")
    }()

    // Receive from channel (blocks until data arrives)
    value := <-ch
    fmt.Printf("Receiver: got %d\n", value)
}
```

### v2：进阶 - 关闭、遍历、单向 Channel

```go
package main

import "fmt"

// producer sends numbers and closes the channel
func producer(ch chan<- int) {
    // Parameter is send-only channel (chan<- int)
    for i := 1; i <= 5; i++ {
        ch <- i
        fmt.Printf("Produced: %d\n", i)
    }
    close(ch) // Signal: no more values
}

// consumer reads from channel using range
func consumer(ch <-chan int) {
    // Parameter is receive-only channel (<-chan int)
    for val := range ch { // Range stops when channel is closed
        fmt.Printf("Consumed: %d\n", val)
    }
    fmt.Println("Consumer: channel closed, exiting")
}

func main() {
    ch := make(chan int)

    go producer(ch) // Pass bidirectional as send-only
    consumer(ch)    // Pass bidirectional as receive-only

    fmt.Println("Main: done")
}
```

### v3：实战 - 多模式 Channel 使用

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// demoNilChannel shows how nil channels can disable select branches
func demoNilChannel() {
    fmt.Println("\n=== Nil Channel Demo ===")
    ch1 := make(chan string, 1)
    ch2 := make(chan string, 1)

    ch1 <- "from ch1"
    ch2 <- "from ch2"

    // Set ch1 to nil to disable it in select
    ch1 = nil

    select {
    case v, ok := <-ch1:
        if ok {
            fmt.Printf("ch1: %s\n", v)
        }
    case v, ok := <-ch2:
        if ok {
            fmt.Printf("ch2: %s\n", v) // This branch wins
        }
    default:
        fmt.Println("No data available")
    }

    // Receiving from nil channel blocks forever
    // Uncommenting the line below causes deadlock
    // <-ch1
    fmt.Println("nil channel: send/recv blocks forever, useful in select")
}

// demoSignal uses chan struct{} for pure signaling (zero memory)
func demoSignal() {
    fmt.Println("\n=== Signal Channel Demo ===")
    done := make(chan struct{})

    go func() {
        fmt.Println("Worker: working...")
        time.Sleep(200 * time.Millisecond)
        fmt.Println("Worker: done")
        close(done) // Signal completion with zero-cost struct{}
    }()

    <-done // Block until worker signals
    fmt.Println("Main: worker completed")
}

// demoFanOut shows fan-out pattern: one producer, multiple consumers
func demoFanOut() {
    fmt.Println("\n=== Fan-Out Demo ===")
    jobs := make(chan int, 10)
    results := make(chan int, 10)

    // Producer
    for i := 1; i <= 5; i++ {
        jobs <- i
    }
    close(jobs)

    // Fan-out: 3 workers
    var wg sync.WaitGroup
    for w := 1; w <= 3; w++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for job := range jobs {
                result := job * 2
                fmt.Printf("Worker %d: %d * 2 = %d\n", id, job, result)
                results <- result
            }
        }(w)
    }

    // Close results after all workers done
    go func() {
        wg.Wait()
        close(results)
    }()

    // Collect results
    total := 0
    for r := range results {
        total += r
    }
    fmt.Printf("Total: %d\n", total)
}

func main() {
    demoNilChannel()
    demoSignal()
    demoFanOut()
}
```

---

## 四、执行预览

**v1 执行结果：**
```
Sender: sending 42...
Receiver: got 42
Sender: sent 42
```

**v2 执行结果：**
```
Produced: 1
Produced: 2
Consumed: 1
Consumed: 2
Produced: 3
Consumed: 3
Produced: 4
Consumed: 4
Produced: 5
Consumed: 5
Consumer: channel closed, exiting
Main: done
```

**v3 执行结果：**
```
=== Nil Channel Demo ===
ch2: from ch2
nil channel: send/recv blocks forever, useful in select

=== Signal Channel Demo ===
Worker: working...
Worker: done
Main: worker completed

=== Fan-Out Demo ===
Worker 1: 1 * 2 = 2
Worker 2: 2 * 2 = 4
Worker 3: 3 * 2 = 6
Worker 1: 4 * 2 = 8
Worker 2: 5 * 2 = 10
Total: 30
```

---

## 五、注意事项

| 注意点 | 说明 | 严重程度 |
|--------|------|----------|
| 向已关闭的 channel 发送 | 会触发 panic | 🔴 严重 |
| 重复关闭 channel | 会触发 panic | 🔴 严重 |
| 关闭 nil channel | 会触发 panic | 🔴 严重 |
| 只有一端的无缓冲 channel | 永久阻塞 → 死锁 | 🔴 严重 |
| channel 零值是 nil | 忘记 make 会导致永久阻塞 | 🟡 常见 |
| goroutine 泄漏 | 接收方不再读取，发送方永久阻塞 | 🟡 常见 |
| 单向 channel 转换 | 可以隐式转换，但不可逆 | 🟢 设计特性 |

---

## 六、避坑指南

### ❌ 忘记 make，直接使用 nil channel
```go
var ch chan int
ch <- 1 // Fatal: nil channel blocks forever → deadlock!
```
### ✅ 使用 make 创建 channel
```go
ch := make(chan int)
ch <- 1 // Works (with a receiver goroutine)
```

### ❌ 向已关闭的 channel 发送数据
```go
ch := make(chan int)
close(ch)
ch <- 1 // Panic: send on closed channel
```
### ✅ 由发送方关闭 channel
```go
// Rule of thumb: only the sender should close the channel
// Receiver checks with: val, ok := <-ch
ch := make(chan int, 1)
ch <- 1
close(ch)
val, ok := <-ch // val=1, ok=true
val, ok = <-ch  // val=0, ok=false (closed)
```

### ❌ 在接收方关闭 channel
```go
func bad(ch chan int) {
    for v := range ch {
        fmt.Println(v)
    }
    close(ch) // Wrong! What if another goroutine is still sending?
}
```
### ✅ 由生产者关闭
```go
func producer(ch chan<- int) {
    for i := 0; i < 10; i++ {
        ch <- i
    }
    close(ch) // Only sender closes → signals "no more data"
}
```

### ❌ 用 channel 传递大量数据
```go
ch := make(chan [1000000]byte) // Copying 1MB on each send!
```
### ✅ 传递指针或使用共享内存
```go
ch := make(chan *BigData) // Only copying a pointer
```

---

## 七、练习题

### 🟢 入门：Ping-Pong
创建一个无缓冲 channel，goroutine A 发送 "ping"，goroutine B 接收后打印，然后发送 "pong" 给 A。来回 3 次。

### 🟡 中级：Pipeline 模式
实现一个三阶段 pipeline：生成 1-20 → 过滤偶数 → 平方。每个阶段一个 goroutine，通过 channel 连接。

### 🔴 高级：Merge 排序通道
实现 merge：从 N 个已排序的 `<-chan int` 中读取数据，合并输出到一个有序的 channel。类似 merge sort 的归并步骤。

---

## 八、知识点总结

```
Channel 知识体系
├── 创建
│   ├── make(chan T) — 无缓冲
│   ├── make(chan T, cap) — 有缓冲
│   └── nil channel（零值）
├── 操作
│   ├── ch <- v（发送）
│   ├── v := <-ch（接收）
│   ├── v, ok := <-ch（检测关闭）
│   ├── close(ch)
│   ├── len(ch) / cap(ch)
│   └── for range ch
├── 类型
│   ├── chan T（双向）
│   ├── chan<- T（只写）
│   └── <-chan T（只读）
├── 语义
│   ├── 阻塞：发送/接收等待对端
│   ├── 关闭：信号通知不再有数据
│   └── nil：永久阻塞（select 技巧）
└── 模式
    ├── 信号：chan struct{}
    ├── Pipeline：链式处理
    ├── Fan-out/Fan-in：分发/汇聚
    └── Cancellation：close 通知退出
```

---

## 九、举一反三

| 场景 | Channel 用法 | 说明 |
|------|-------------|------|
| 任务分发 | `chan Task` | 多 worker 从同一个 channel 取任务 |
| 结果收集 | `chan Result` | 多 goroutine 写入，主 goroutine 读取 |
| 取消信号 | `chan struct{}` 或 `close(ch)` | 零成本信号通知 |
| 超时控制 | channel + `time.After` | `select` 监听超时 |
| 限流 | 有缓冲 channel 当信号量 | `make(chan struct{}, N)` 限制并发 |
| 事件广播 | 关闭 channel | `close` 通知所有等待者 |

---

## 十、参考资料

- [Go Tour - Channels](https://go.dev/tour/concurrency/2)
- [Go Blog: Share Memory By Communicating](https://go.dev/blog/codelab-share)
- [Go Blog: Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines)
- [Effective Go - Channels](https://go.dev/doc/effective_go#channels)
- 《Concurrency in Go》Chapter 3

---

## 十一、代码演进路线

```
v1 基础版
├── make 创建 channel
├── <- 发送和接收
└── 问题：单向使用，没有关闭
│
▼
v2 进阶版
├── close(ch) 关闭通知
├── range ch 遍历
├── 单向 channel 约束
└── 改进：生产者-消费者模式
│
▼
v3 实战版
├── nil channel 技巧（select 动态禁用）
├── chan struct{} 零成本信号
├── Fan-out/Fan-in 模式
├── WaitGroup + channel 配合
└── 特性：生产级并发模式
```

> **上一篇：** [031 - Goroutine 并发基础](/posts/031-goroutine) | **下一篇：** [033 - 无缓冲与有缓冲 Channel](/posts/033-buffered-channel)
