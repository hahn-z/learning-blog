---
title: "004 - select多路复用"
slug: "004-select"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.97+08:00"
updated_at: "2026-04-29T10:02:44.686+08:00"
reading_time: 19
tags: ["并发"]
---

# 034 - Select 多路复用

> 难度：⭐⭐⭐（中级）
>
> 本文深入讲解 Go 语言中 `select` 语句的用法，包括多 channel 监听、非阻塞模式、超时控制、定时器实现、随机选择机制等核心知识点。

---

## 一、概念讲解

`select` 是 Go 语言中专门用于**channel 多路复用**的控制结构，语法类似 `switch`，但每个 `case` 必须是一个 channel 操作（发送或接收）。

### 核心特性

| 特性 | 说明 |
|------|------|
| 多 channel 监听 | 同时监听多个 channel 的读写操作 |
| 随机选择 | 多个 case 同时就绪时，随机选择一个执行 |
| 阻塞机制 | 无 default 时，所有 case 都不就绪则阻塞 |
| 非阻塞模式 | 有 default 时，所有 case 不就绪则走 default |
| 循环使用 | 通常配合 `for` 循环实现持续监听 |

---

## 二、脑图

```
                    select 多路复用
                         │
         ┌───────────────┼───────────────┐
         │               │               │
     基础语法         典型模式         高级用法
         │               │               │
    ┌────┼────┐    ┌─────┼─────┐    ┌────┼────┐
    │    │    │    │     │     │    │    │    │
  case default 循环  超时  取消  多路  空    随机  定时
  操作  分支  监听  控制  传播  复用  select 选择  器
```

---

## 三、完整代码示例

### v1：基础 select - 多 channel 监听

```go
package main

import (
    "fmt"
    "math/rand"
    "time"
)

// Demonstrates basic select with multiple channels
func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)

    // Start two goroutines sending data
    go func() {
        time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
        ch1 <- "from channel 1"
    }()

    go func() {
        time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
        ch2 <- "from channel 2"
    }()

    // Select waits for the first ready channel
    select {
    case msg := <-ch1:
        fmt.Println("Received:", msg)
    case msg := <-ch2:
        fmt.Println("Received:", msg)
    }
}
```

### v2：超时控制 + 非阻塞

```go
package main

import (
    "context"
    "fmt"
    "time"
)

// Demonstrates timeout and non-blocking patterns
func main() {
    ch := make(chan string, 1)

    // --- Timeout pattern with time.After ---
    go func() {
        time.Sleep(2 * time.Second)
        ch <- "slow result"
    }()

    select {
    case msg := <-ch:
        fmt.Println("Got:", msg)
    case <-time.After(1 * time.Second):
        fmt.Println("Timeout! Operation took too long")
    }

    // --- Non-blocking receive with default ---
    result := make(chan int, 1)
    select {
    case v := <-result:
        fmt.Println("Got value:", v)
    default:
        fmt.Println("No value available (non-blocking)")
    }

    // --- Context cancellation pattern ---
    ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel()

    done := make(chan struct{})
    go func() {
        time.Sleep(500 * time.Millisecond) // simulate long work
        close(done)
    }()

    select {
    case <-done:
        fmt.Println("Work completed")
    case <-ctx.Done():
        fmt.Println("Context cancelled:", ctx.Err())
    }
}
```

### v3：生产级多路复用服务

```go
package main

import (
    "context"
    "fmt"
    "math/rand"
    "sync"
    "time"
)

// FanIn merges multiple channels into one using select
func FanIn(ctx context.Context, channels ...<-chan string) <-chan string {
    out := make(chan string)
    var wg sync.WaitGroup

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan string) {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case v, ok := <-c:
                    if !ok {
                        return
                    }
                    out <- v
                }
            }
        }(ch)
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}

// TickLogger periodically logs using select + time.NewTicker
func TickLogger(ctx context.Context, interval time.Duration) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            fmt.Println("Ticker stopped")
            return
        case t := <-ticker.C:
            fmt.Println("Tick at:", t.Format("15:04:05"))
        }
    }
}

func main() {
    // Create source channels
    sources := make([]<-chan string, 3)
    for i := range sources {
        ch := make(chan string)
        sources[i] = ch
        go func(id int, c chan<- string) {
            defer close(c)
            for j := 0; j < 3; j++ {
                time.Sleep(time.Duration(rand.Intn(300)) * time.Millisecond)
                c <- fmt.Sprintf("source-%d: msg-%d", id, j)
            }
        }(i, ch)
    }

    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()

    // Fan-in all sources
    merged := FanIn(ctx, sources...)

    // Read merged output
    for msg := range merged {
        fmt.Println(msg)
    }
    fmt.Println("All sources exhausted")
}
```

---

## 四、执行预览

**v1 输出示例：**
```
Received: from channel 2
```
（每次运行可能不同，因为随机选择机制）

**v2 输出：**
```
Timeout! Operation took too long
No value available (non-blocking)
Context cancelled: context deadline exceeded
```

**v3 输出示例：**
```
source-1: msg-0
source-0: msg-0
source-2: msg-0
source-1: msg-1
source-0: msg-1
source-2: msg-1
source-1: msg-2
source-0: msg-2
source-2: msg-2
All sources exhausted
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| nil channel 阻塞 | case 中 nil channel 永远不会被选中，可利用此特性动态禁用 case |
| select 空{} 永久阻塞 | `select{}` 永久阻塞当前 goroutine，常用于主 goroutine 保活 |
| for-select 死循环 | 必须有退出条件，否则 goroutine 泄漏 |
| break 只跳出 select | for-select 中 break 只跳出 select，需用 label 或 return 退出外层 for |
| time.After 内存泄漏 | 在 for-select 循环中每次创建 time.After 会导致临时 timer 堆积 |
| closed channel | channel 关闭后可立即读取零值，select 会反复选中该 case |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| `for-select` 中用 `break` 想退出 for | 用 `return` 或带 label 的 `break Loop` |
| 循环中每次用 `time.After` 做超时 | 用 `time.NewTicker` 或 `context.WithTimeout` |
| 忘记检查 `ok` 值，closed channel 反复读 | 用 `v, ok := <-ch`，`!ok` 时设 ch = nil |
| select 内做耗时操作阻塞其他 case | select case 中只做轻量操作，耗时任务交给 worker |
| 用 select 做顺序控制 | select 是**随机**的，不做顺序保证 |
| goroutine 泄漏——consumer 退出但 producer 还在 | 用 context 取消 + producer 检查 `ctx.Done()` |

---

## 七、练习题

### 🟢 初级
1. 写一个程序，创建两个 channel，分别发送 1-5 和 A-E，用 select 接收并打印。
2. 实现一个非阻塞的 channel 读取：有数据就读，没有就打印 "empty"。

### 🟡 中级
3. 实现一个超时模式：从 channel 读取数据，超过 3 秒没收到就打印超时并退出。
4. 用 for-select 实现一个简单的任务调度器，从多个 channel 接收任务并执行。

### 🔴 高级
5. 用 select + channel 实现一个优先级队列：高优先级 channel 优先处理，低优先级在空闲时处理。
6. 实现一个 goroutine 池，用 select 同时监听任务 channel 和取消 channel。

---

## 八、知识点总结

```
select 多路复用
├── 基础语法
│   ├── case <-ch : 接收操作
│   ├── case ch<- : 发送操作
│   ├── default   : 非阻塞分支
│   └── 空 select  : 永久阻塞
├── 核心机制
│   ├── 随机选择（多 case 就绪时）
│   ├── 阻塞等待（无 default 且无就绪 case）
│   └── nil channel 被跳过
├── 典型模式
│   ├── 超时控制：time.After
│   ├── 取消传播：context.Done
│   ├── 定时执行：time.NewTicker
│   ├── Fan-In：多 channel 合并
│   └── 动态开关：设 channel = nil
└── 常见陷阱
    ├── break 只跳出 select
    ├── time.After 循环泄漏
    └── closed channel 热循环
```

---

## 九、举一反三

| 场景 | select 用法 | 关键点 |
|------|-------------|--------|
| API 超时控制 | `case <-time.After(timeout)` | 用 context 更规范 |
| 优雅退出 | `case <-ctx.Done()` | 配合 context 传播 |
| 多数据源聚合 | Fan-In 模式 | 每个 source 一个 goroutine |
| 心跳检测 | `case <-ticker.C` | time.NewTicker 周期触发 |
| 背压控制 | `case out <- v` / `default` | 非阻塞发送，满则丢弃 |
| 动态路由 | 设置 ch = nil 禁用 case | nil channel 不参与 select |

---

## 十、参考资料

- [Go 官方文档 - Select statements](https://go.dev/ref/spec#Select_statements)
- [Effective Go - Concurrency](https://go.dev/doc/effective_go#concurrency)
- [Go 并发编程实战（第2版）](https://book.douban.com/subject/27000535/)
- [Go 语言设计与实现 - Select](https://draveness.me/golang/docs/part3-runtime/ch06-concurrency/golang-select/)

---

## 十一、代码演进

| 版本 | 演进 | 说明 |
|------|------|------|
| v1 | 基础 select | 多 channel 监听，理解随机选择 |
| v2 | 超时 + 非阻塞 + context | 三种常用模式：超时、非阻塞、取消 |
| v3 | 生产级 Fan-In | 多 channel 聚合 + context 取消 + 并发安全 |

> **下一篇：** [035 - sync.WaitGroup 与 Mutex](035-waitgroup) → 并发同步原语，让 goroutine 乖乖排队！
