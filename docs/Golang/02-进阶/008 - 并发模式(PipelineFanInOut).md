---
title: "008 - 并发模式(Pipeline/FanInOut)"
slug: "008-sync-once"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.036+08:00"
updated_at: "2026-04-29T10:02:44.715+08:00"
reading_time: 26
tags: ["并发"]
---

# 038 - 并发模式（Pipeline / Fan-In-Out）

> 难度：⭐⭐⭐⭐（进阶）
>
> 本文系统讲解 Go 语言经典并发模式：Pipeline、Fan-Out/Fan-In、Worker Pool、Semaphore 以及 errgroup 并发错误收集。

---

## 一、概念讲解

Go 的 goroutine + channel 天然适合构建并发数据流。以下是几种核心模式：

### Pipeline（管道模式）
数据像流水线一样经过多个阶段（stage），每个阶段是一个 goroutine，阶段之间通过 channel 连接。上一个阶段的输出是下一个阶段的输入。

### Fan-Out / Fan-In（扇出扇入）
- **Fan-Out**：一个 channel 的数据分发给多个 goroutine 并行处理
- **Fan-In**：多个 goroutine 的结果合并到一个 channel

### Worker Pool（工作池）
固定数量的 goroutine 从任务 channel 中取任务执行，控制并发度。

### Semaphore（信号量）
用带缓冲的 channel 控制最大并发数。

### errgroup
`golang.org/x/sync/errgroup` 包：并发执行多个任务，任何一个失败则取消所有任务。

---

## 二、脑图（ASCII）

```
并发模式
├── Pipeline
│   ├── stage = func(in <-chan T) <-chan T
│   ├── 串联：gen → square → print
│   └── 可随时加 context 取消
├── Fan-Out / Fan-In
│   ├── Fan-Out: 1 ch → N workers
│   ├── Fan-In:  N channels → 1 ch (select/reflect)
│   └── 适用：CPU 密集 + 可分割任务
├── Worker Pool
│   ├── 固定 N 个 goroutine
│   ├── task chan → worker → result chan
│   └── 控制资源消耗
├── Semaphore
│   ├── buffered chan (capacity = maxConcurrency)
│   ├── acquire = ch <- struct{}{}
│   └── release = <-ch
└── errgroup
    ├── Group.Go(func() error)
    ├── Group.Wait() error
    └── WithContext → 自动取消
```

---

## 三、完整 Go 代码

### v1：Pipeline 模式

```go
package main

import "fmt"

// generate emits numbers to a channel.
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

// square reads from input channel, squares each value, outputs to new channel.
func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

// double reads from input channel, doubles each value.
func double(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * 2
        }
        close(out)
    }()
    return out
}

func main() {
    // Pipeline: generate → square → double → print
    ch := generate(1, 2, 3, 4, 5)
    ch = square(ch)
    ch = double(ch)

    for result := range ch {
        fmt.Println(result) // (n*n)*2
    }
}
```

**执行预览：**

```
2
8
18
32
50
```

### v2：Fan-Out/Fan-In + Worker Pool + Semaphore

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// fanOut distributes work from one channel to N workers.
func fanOut(in <-chan int, workers int) []<-chan int {
    channels := make([]<-chan int, workers)
    for i := 0; i < workers; i++ {
        channels[i] = worker(i, in)
    }
    return channels
}

// worker processes items from input channel.
func worker(id int, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            // Simulate work
            time.Sleep(100 * time.Millisecond)
            result := n * n
            fmt.Printf("  Worker %d: %d → %d\n", id, n, result)
            out <- result
        }
        close(out)
    }()
    return out
}

// fanIn merges multiple channels into one.
func fanIn(channels ...<-chan int) <-chan int {
    merged := make(chan int)
    var wg sync.WaitGroup

    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                merged <- v
            }
        }(ch)
    }

    // Close merged channel once all input channels are drained
    go func() {
        wg.Wait()
        close(merged)
    }()

    return merged
}

// semaphore controls max concurrency using a buffered channel.
func semaphoreDemo(tasks int, maxConcurrent int) {
    sem := make(chan struct{}, maxConcurrent)
    var wg sync.WaitGroup

    for i := 0; i < tasks; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            sem <- struct{}{}        // acquire
            defer func() { <-sem }() // release

            fmt.Printf("  Task %d started\n", id)
            time.Sleep(200 * time.Millisecond)
            fmt.Printf("  Task %d done\n", id)
        }(i)
    }
    wg.Wait()
}

func main() {
    fmt.Println("=== Fan-Out / Fan-In ===")
    in := generate(1, 2, 3, 4, 5, 6, 7, 8)
    channels := fanOut(in, 3)
    merged := fanIn(channels...)
    for v := range merged {
        fmt.Printf("Result: %d\n", v)
    }

    fmt.Println("\n=== Semaphore (max 3 concurrent) ===")
    semaphoreDemo(10, 3)
}

func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}
```

**执行预览：**

```
=== Fan-Out / Fan-In ===
  Worker 0: 1 → 1
  Worker 1: 2 → 4
  Worker 2: 3 → 9
Result: 1
Result: 4
...

=== Semaphore (max 3 concurrent) ===
  Task 0 started
  Task 1 started
  Task 2 started
  Task 0 done
  Task 3 started
  ...
```

### v3：errgroup + 爬虫实战

```go
package main

import (
    "context"
    "fmt"
    "net/http"
    "sync"
    "time"

    "golang.org/x/sync/errgroup"
)

// fetchURL fetches a URL and returns its status code.
func fetchURL(ctx context.Context, url string) (int, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil {
        return 0, fmt.Errorf("creating request for %s: %w", url, err)
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return 0, fmt.Errorf("fetching %s: %w", url, err)
    }
    defer resp.Body.Close()
    return resp.StatusCode, nil
}

// batchFetch fetches multiple URLs concurrently with errgroup.
// If any fetch fails, all others are canceled via context.
func batchFetch(urls []string) (map[string]int, error) {
    g, ctx := errgroup.WithContext(context.Background())
    mu := sync.Mutex{}
    results := make(map[string]int)

    for _, url := range urls {
        url := url // capture loop variable
        g.Go(func() error {
            code, err := fetchURL(ctx, url)
            if err != nil {
                return err
            }
            mu.Lock()
            results[url] = code
            mu.Unlock()
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, fmt.Errorf("batch fetch failed: %w", err)
    }
    return results, nil
}

// workerPool processes tasks with a fixed number of workers.
func workerPool(tasks []string, maxWorkers int, fn func(string) (string, error)) {
    taskCh := make(chan string, len(tasks))
    resultCh := make(chan string, len(tasks))

    // Start workers
    var wg sync.WaitGroup
    for i := 0; i < maxWorkers; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            for task := range taskCh {
                result, err := fn(task)
                if err != nil {
                    result = fmt.Sprintf("ERROR: %v", err)
                }
                resultCh <- fmt.Sprintf("[W%d] %s → %s", id, task, result)
            }
        }(i)
    }

    // Feed tasks
    for _, t := range tasks {
        taskCh <- t
    }
    close(taskCh)

    // Wait and close results
    go func() {
        wg.Wait()
        close(resultCh)
    }()

    // Collect results
    for r := range resultCh {
        fmt.Println(r)
    }
}

func main() {
    fmt.Println("=== errgroup Batch Fetch ===")
    urls := []string{
        "https://httpbin.org/status/200",
        "https://httpbin.org/status/404",
        "https://httpbin.org/delay/1",
    }
    results, err := batchFetch(urls)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        for url, code := range results {
            fmt.Printf("  %s → %d\n", url, code)
        }
    }

    fmt.Println("\n=== Worker Pool ===")
    tasks := []string{"task-A", "task-B", "task-C", "task-D", "task-E"}
    process := func(t string) (string, error) {
        time.Sleep(100 * time.Millisecond)
        return t + "-done", nil
    }
    workerPool(tasks, 3, process)
}
```

**执行预览：**

```
=== errgroup Batch Fetch ===
  https://httpbin.org/status/200 → 200
  https://httpbin.org/status/404 → 404
  https://httpbin.org/delay/1 → 200

=== Worker Pool ===
[W0] task-A → task-A-done
[W1] task-B → task-B-done
[W2] task-C → task-C-done
...
```

---

## 四、注意事项

| 项目 | 说明 |
|------|------|
| channel 方向 | 用 `<-chan` 和 `chan<-` 标记方向，增强可读性 |
| 关闭时机 | 只有发送方关闭 channel，接收方永远不关 |
| goroutine 泄漏 | 如果 consumer 不消费，producer goroutine 会永远阻塞 |
| errgroup 上下文 | `WithContext` 返回的 ctx 会在任一 goroutine 返回错误时被取消 |
| Worker 数量 | Worker Pool 大小 = GOMAXPROCS × 某个系数（CPU 密集）或按 I/O 并发需求（I/O 密集） |
| 缓冲区大小 | 适当缓冲 channel 可减少 goroutine 切换开销 |

---

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 在 Fan-Out 中复用同一个 channel 给多个消费者 | 每个 worker 有自己的 channel，或用同一 channel 但多个消费者竞争读取 |
| 忘记 `close(out)` 导致下游 `range` 死锁 | 发送完毕立即 `close(out)` |
| `g.Go` 里直接用循环变量 `url` | `url := url` 捕获副本 |
| Semaphore 用 `WaitGroup` 加到 buffer 之外 | `sem <- struct{}{}` 在 goroutine 内部，释放用 `defer` |
| Worker Pool 无超时保护 | 加 `context.WithTimeout` 或 `time.After` |

---

## 六、练习题

### 🟢 入门：Pipeline 过滤器
构建 Pipeline：`generate → filter(偶数) → square → print`。

### 🟡 中级：Fan-In 多路合并
创建 3 个 channel 各发 5 个数，用 Fan-In 合并，输出所有 15 个数（顺序不重要）。

### 🔴 高级：并发爬虫 + 限速
用 Worker Pool + errgroup 实现：爬取 20 个 URL，最多 5 个并发，每个域名每秒最多 2 个请求（用 time.Ticker 限速）。

---

## 七、知识点总结（树状）

```
并发模式
├── Pipeline
│   ├── 每个阶段 = goroutine + channel
│   ├── 串联 compose
│   └── 可取消 (context)
├── Fan-Out / Fan-In
│   ├── Fan-Out: 1 → N (并行分发)
│   ├── Fan-In: N → 1 (合并结果)
│   └── select 多路复用
├── Worker Pool
│   ├── task channel
│   ├── result channel
│   └── 固定 goroutine 数
├── Semaphore
│   ├── buffered channel
│   ├── acquire/release
│   └── 控制最大并发
└── errgroup
    ├── 并发执行
    ├── 首个错误取消全部
    └── WithContext
```

---

## 八、举一反三

| 场景 | 模式 | 说明 |
|------|------|------|
| 日志处理流水线 | Pipeline | 读取 → 解析 → 过滤 → 聚合 → 输出 |
| 图片处理 | Fan-Out/Fan-In | 缩略图、水印、格式转换并行 |
| API 批量请求 | Worker Pool | 控制并发，避免被限流 |
| 文件下载 | Semaphore | 限制同时下载 N 个文件 |
| 微服务聚合调用 | errgroup | 并行调多个服务，任一失败则返回 |
| 数据导入 | Pipeline + Worker Pool | 读取 → 校验 → 批量写入 |

---

## 九、参考资料

1. [Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines)
2. [Advanced Go Concurrency](https://go.dev/blog/io2013-talk-concurrency)
3. [errgroup 包文档](https://pkg.go.dev/golang.org/x/sync/errgroup)
4. 《Concurrency in Go》— Katherine Cox-Buday

---

## 十、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | Pipeline 基础 | 数据流处理 |
| v2 | Fan-Out/In + Semaphore | CPU 密集并行 |
| v3 | errgroup + Worker Pool | 生产级爬虫/批量处理 |

---

_并发模式不是银弹，选对模式比写对代码更重要。_ ⚡
