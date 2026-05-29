---
title: "005 - sync.WaitGroup与Mutex"
slug: "005-waitgroup"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.98+08:00"
updated_at: "2026-04-29T10:02:44.693+08:00"
reading_time: 20
tags: ["并发"]
---

# 035 - sync.WaitGroup 与 Mutex

> 难度：⭐⭐⭐（中级）
>
> 本文系统讲解 Go 并发同步的两大基石：`sync.WaitGroup`（等待一组 goroutine 完成）和 `sync.Mutex`（互斥锁保护共享资源），并涵盖 `sync.Once` 和常见并发错误。

---

## 一、概念讲解

### WaitGroup

`sync.WaitGroup` 用于等待一组 goroutine 完成。它维护一个计数器：

- `Add(delta int)` — 增加计数器
- `Done()` — 计数器减 1（等价于 `Add(-1)`）
- `Wait()` — 阻塞直到计数器归零

### Mutex（互斥锁）

`sync.Mutex` 提供排他锁：同一时刻只有一个 goroutine 能访问临界区。

- `Lock()` — 获取锁（阻塞等待）
- `Unlock()` — 释放锁

### RWMutex（读写锁）

`sync.RWMutex` 允许多个读操作并行，但写操作独占：

- `RLock()` / `RUnlock()` — 共享读锁
- `Lock()` / `Unlock()` — 独占写锁

---

## 二、脑图

```
              并发同步原语
                   │
       ┌───────────┼───────────┐
       │           │           │
   WaitGroup    Mutex       RWMutex
       │           │           │
   ┌───┼───┐   ┌───┼───┐   ┌───┼───┐
   │   │   │   │   │   │   │   │   │
  Add Done Wait Lock UnLock RLock RU Lock
   │                           │
 计数器规则                  读写分离
   │                           │
 ┌─┼──┐                    读多写少
 前置 不得                    场景
Add  为负
```

---

## 三、完整代码示例

### v1：WaitGroup 基础用法

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// Basic WaitGroup: wait for all goroutines to finish
func main() {
    var wg sync.WaitGroup

    tasks := []string{"task-A", "task-B", "task-C", "task-D", "task-E"}

    for _, task := range tasks {
        wg.Add(1) // Must call BEFORE goroutine starts
        go func(name string) {
            defer wg.Done() // Signal completion
            time.Sleep(100 * time.Millisecond)
            fmt.Printf("Completed: %s\n", name)
        }(task)
    }

    wg.Wait() // Block until all Done() calls
    fmt.Println("All tasks finished!")
}
```

### v2：并发安全计数器 + 缓存

```go
package main

import (
    "fmt"
    "sync"
)

// SafeCounter is a thread-safe counter using Mutex
type SafeCounter struct {
    mu sync.Mutex
    v  map[string]int
}

func (c *SafeCounter) Inc(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.v[key]++
}

func (c *SafeCounter) Value(key string) int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.v[key]
}

// SafeCache uses RWMutex for read-heavy access
type SafeCache struct {
    mu   sync.RWMutex
    data map[string]string
}

func NewSafeCache() *SafeCache {
    return &SafeCache{data: make(map[string]string)}
}

func (c *SafeCache) Get(key string) (string, bool) {
    c.mu.RLock() // Multiple readers allowed
    defer c.mu.RUnlock()
    val, ok := c.data[key]
    return val, ok
}

func (c *SafeCache) Set(key, value string) {
    c.mu.Lock() // Exclusive write
    defer c.mu.Unlock()
    c.data[key] = value
}

func main() {
    // --- Concurrent Counter ---
    counter := &SafeCounter{v: make(map[string]int)}
    var wg sync.WaitGroup

    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            counter.Inc("hits")
        }()
    }
    wg.Wait()
    fmt.Printf("Counter: %d (expected 1000)\n", counter.Value("hits"))

    // --- Concurrent Cache ---
    cache := NewSafeCache()
    cache.Set("name", "Golang")

    var wg2 sync.WaitGroup
    for i := 0; i < 5; i++ {
        wg2.Add(1)
        go func(id int) {
            defer wg2.Done()
            if val, ok := cache.Get("name"); ok {
                fmt.Printf("Reader %d: %s\n", id, val)
            }
        }(i)
    }
    wg2.Wait()
}
```

### v3：sync.Once + 生产级并发 Pipeline

```go
package main

import (
    "fmt"
    "sync"
)

// Singleton with sync.Once
type Config struct {
    Host string
    Port int
}

var (
    instance *Config
    once     sync.Once
)

func GetConfig() *Config {
    once.Do(func() {
        fmt.Println("Initializing config (only once)...")
        instance = &Config{Host: "localhost", Port: 8080}
    })
    return instance
}

// Concurrent pipeline with WaitGroup + Mutex
type Pipeline struct {
    mu     sync.Mutex
    stages []func(interface{}) interface{}
    result []interface{}
}

func NewPipeline(stages ...func(interface{}) interface{}) *Pipeline {
    return &Pipeline{stages: stages, result: make([]interface{}, 0)}
}

func (p *Pipeline) Run(inputs []interface{}) []interface{} {
    var wg sync.WaitGroup

    for _, input := range inputs {
        wg.Add(1)
        go func(in interface{}) {
            defer wg.Done()
            out := in
            for _, stage := range p.stages {
                out = stage(out)
            }
            p.mu.Lock()
            p.result = append(p.result, out)
            p.mu.Unlock()
        }(input)
    }

    wg.Wait()
    return p.result
}

func main() {
    // --- sync.Once demo ---
    var wg sync.WaitGroup
    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            cfg := GetConfig()
            fmt.Printf("Goroutine %d: %s:%d\n", id, cfg.Host, cfg.Port)
        }(i)
    }
    wg.Wait()

    // --- Pipeline demo ---
    fmt.Println("\n--- Pipeline ---")
    pipe := NewPipeline(
        func(v interface{}) interface{} { return v.(int) * 2 },
        func(v interface{}) interface{} { return fmt.Sprintf("result=%d", v.(int)) },
    )

    inputs := []interface{}{1, 2, 3, 4, 5}
    results := pipe.Run(inputs)
    for _, r := range results {
        fmt.Println(r)
    }
}
```

---

## 四、执行预览

**v1 输出：**
```
Completed: task-E
Completed: task-A
Completed: task-B
Completed: task-C
Completed: task-D
All tasks finished!
```

**v2 输出：**
```
Counter: 1000 (expected 1000)
Reader 0: Golang
Reader 1: Golang
Reader 2: Golang
Reader 4: Golang
Reader 3: Golang
```

**v3 输出：**
```
Initializing config (only once)...
Goroutine 0: localhost:8080
Goroutine 4: localhost:8080
Goroutine 1: localhost:8080
Goroutine 3: localhost:8080
Goroutine 2: localhost:8080

--- Pipeline ---
result=2
result=4
result=6
result=8
result=10
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| WaitGroup 不可复制 | 必须传指针，或用 `var wg sync.WaitGroup` 共享 |
| Add 必须在 goroutine 外调用 | 否则可能 Wait() 提前返回 |
| 计数器不能为负 | `Done()` 调用次数超过 `Add()` 会 panic |
| Mutex 不要重入 | Go 的 Mutex 不是可重入锁，重复 Lock 会死锁 |
| defer Unlock | 总是用 `defer mu.Unlock()` 避免忘记释放 |
| RWMutex 写饥饿 | 大量读锁可能导致写锁长时间获取不到 |
| WaitGroup 不能复用 | 计数器归零后不能再 Add，需要新建 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| `wg.Add(1)` 放在 goroutine 内部 | 在 `go func()` **之前**调用 `wg.Add(1)` |
| 忘记 `wg.Done()` 导致死锁 | 用 `defer wg.Done()` 确保一定执行 |
| Mutex 加锁后忘记解锁 | 用 `defer mu.Unlock()` |
| 在持有读锁时再加写锁 | 读锁和写锁互斥，会导致死锁 |
| 值传递 WaitGroup/Mutex | 用指针传递或通过结构体指针共享 |
| goroutine 内用 `for range` 的循环变量 | 传参给 goroutine 或用局部变量捕获 |

---

## 七、练习题

### 🟢 初级
1. 启动 10 个 goroutine 并用 WaitGroup 等待全部完成，每个打印自己的编号。
2. 用 Mutex 保护一个全局变量 `count`，1000 个 goroutine 各加 1，确保最终结果为 1000。

### 🟡 中级
3. 实现一个并发安全的 `Set`（集合），支持 Add、Contains、Remove 操作。
4. 用 RWMutex 实现一个并发安全的配置管理器，支持 Get（并发读）和 Update（独占写）。

### 🔴 高级
5. 实现一个简单的 goroutine 池：固定 N 个 worker 从任务 channel 取任务执行，用 WaitGroup 等待所有任务完成。
6. 实现一个带超时的 WaitGroup 包装器：如果超过指定时间还有 goroutine 未完成，返回错误。

---

## 八、知识点总结

```
并发同步原语
├── sync.WaitGroup
│   ├── Add(delta) — 增加计数
│   ├── Done() — 减少计数
│   ├── Wait() — 阻塞等待
│   └── 规则：Add 在 go 之前，计数不能为负
├── sync.Mutex
│   ├── Lock() / Unlock()
│   ├── 互斥访问共享资源
│   └── defer Unlock 防止遗漏
├── sync.RWMutex
│   ├── RLock() / RUnlock() — 共享读
│   ├── Lock() / Unlock() — 独占写
│   └── 适用：读多写少场景
└── sync.Once
    ├── Do(f) — 仅执行一次
    └── 适用：单例、初始化
```

---

## 九、举一反三

| 场景 | 用什么 | 说明 |
|------|--------|------|
| 等待 N 个 goroutine 完成 | WaitGroup | Add → go → Done → Wait |
| 保护共享计数器 | Mutex | 简单互斥 |
| 并发读配置 | RWMutex | 读不阻塞读 |
| 数据库连接初始化 | sync.Once | 确保只初始化一次 |
| HTTP handler 并发安全 | Mutex 包裹共享状态 | 或用 sync.Map |
| 批量任务并行处理 | WaitGroup + channel | WaitGroup 等待 + channel 收集结果 |

---

## 十、参考资料

- [Go 官方文档 - sync 包](https://pkg.go.dev/sync)
- [Go 官方文档 - sync.Mutex](https://pkg.go.dev/sync#Mutex)
- [Effective Go - Concurrency](https://go.dev/doc/effective_go#concurrency)
- [Go 并发编程实战（第2版）](https://book.douban.com/subject/27000535/)

---

## 十一、代码演进

| 版本 | 演进 | 说明 |
|------|------|------|
| v1 | WaitGroup 基础 | 理解 Add/Done/Wait 三件套 |
| v2 | Mutex + RWMutex | 并发安全计数器和缓存，读写锁分离 |
| v3 | Once + Pipeline | 单例初始化 + 生产级并发 pipeline |

> **上一篇：** [034 - Select 多路复用](034-select) | **下一篇：** [036 - sync 包深入](036-mutex) → Once/Map/Pool/Cond 高级用法！
