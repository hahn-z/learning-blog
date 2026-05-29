---
title: "006 - sync包深入(Once/Map/Pool)"
slug: "006-mutex"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.01+08:00"
updated_at: "2026-04-29T10:02:44.7+08:00"
reading_time: 25
tags: ["并发"]
---

# 036 - sync 包深入：Once/Map/Pool/Cond

> 难度：⭐⭐⭐⭐（中高级）
>
> 本文深入讲解 Go `sync` 包的高级同步原语：`sync.Once`（单次执行）、`sync.Map`（并发安全 map）、`sync.Pool`（对象复用池）、`sync.Cond`（条件变量），以及 WaitGroup 的进阶用法。

---

## 一、概念讲解

### sync.Once

确保某个函数**只执行一次**，无论多少 goroutine 同时调用。底层使用 `sync.Mutex` + 原子标志位实现。

**典型场景：** 单例模式、全局配置初始化、数据库连接建立。

### sync.Map

Go 1.9+ 提供的**并发安全 map**，针对读多写少场景优化。内部使用读写分离（read map + dirty map）减少锁争用。

**方法：** `Load`、`Store`、`Delete`、`LoadOrStore`、`LoadAndDelete`、`Range`

### sync.Pool

**临时对象缓存池**，用于复用对象减少 GC 压力。对象可能随时被 GC 回收，不适合做持久缓存。

**核心：** `Get()` 获取对象，`Put()` 归还对象。

### sync.Cond

**条件变量**，让 goroutine 等待/通知特定条件满足。基于 `sync.Locker`（通常是 `*sync.Mutex` 或 `*sync.RWMutex`）。

**方法：** `Wait()`、`Signal()`（唤醒一个）、`Broadcast()`（唤醒全部）

---

## 二、脑图

```
                   sync 高级原语
                        │
        ┌───────┬───────┼───────┬───────┐
        │       │       │       │       │
     Once     Map     Pool    Cond   WaitGroup
        │       │       │       │       │
     Do(f)   Load    Get    Wait    Add/Done
        │     Store   Put   Signal    Wait
   单次执行  Delete  New    Broadcast 进阶
        │     Range  GC回收  条件等待  用法
   底层:
   Mutex+atomic
```

---

## 三、完整代码示例

### v1：sync.Once 与 sync.Map 基础

```go
package main

import (
    "fmt"
    "sync"
)

// --- sync.Once: thread-safe singleton ---

type DBConnection struct {
    DSN string
}

var (
    db   *DBConnection
    once sync.Once
)

func GetDB(dsn string) *DBConnection {
    once.Do(func() {
        fmt.Println("Connecting to DB:", dsn)
        db = &DBConnection{DSN: dsn}
    })
    return db
}

// --- sync.Map: concurrent-safe map ---

func demoSyncMap() {
    var m sync.Map

    // Store key-value pairs
    m.Store("name", "Golang")
    m.Store("version", "1.22")
    m.Store("year", 2009)

    // Load values
    if v, ok := m.Load("name"); ok {
        fmt.Println("name:", v)
    }

    // LoadOrStore: load if exists, store if not
    actual, loaded := m.LoadOrStore("name", "Rust")
    fmt.Printf("LoadOrStore('name'): value=%v, loaded=%v\n", actual, loaded)

    // Range over all entries
    fmt.Println("--- All entries ---")
    m.Range(func(key, value interface{}) bool {
        fmt.Printf("  %v = %v\n", key, value)
        return true // continue iteration
    })

    // Delete
    m.Delete("year")
    fmt.Println("After delete 'year':")
    m.Range(func(key, value interface{}) bool {
        fmt.Printf("  %v = %v\n", key, value)
        return true
    })
}

func main() {
    // Once demo
    var wg sync.WaitGroup
    for i := 0; i < 3; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            conn := GetDB("postgres://localhost:5432")
            fmt.Printf("Goroutine %d got DB: %s\n", id, conn.DSN)
        }(i)
    }
    wg.Wait()

    fmt.Println()
    demoSyncMap()
}
```

### v2：sync.Pool 对象复用

```go
package main

import (
    "bytes"
    "fmt"
    "sync"
)

// Buffer pool for reducing GC pressure
var bufferPool = sync.Pool{
    New: func() interface{} {
        // Called when pool is empty
        fmt.Println("  (allocating new buffer)")
        return new(bytes.Buffer)
    },
}

func processRequest(id int) {
    // Get a buffer from pool
    buf := bufferPool.Get().(*bytes.Buffer)
    buf.Reset() // Always reset before use!

    // Use the buffer
    buf.WriteString(fmt.Sprintf("Request %d processed", id))
    fmt.Println(buf.String())

    // Return buffer to pool
    bufferPool.Put(buf)
}

func main() {
    fmt.Println("=== First 3 requests (allocate) ===")
    for i := 1; i <= 3; i++ {
        processRequest(i)
    }

    fmt.Println("\n=== Next 3 requests (reuse) ===")
    for i := 4; i <= 6; i++ {
        processRequest(i)
    }

    // Demonstrate Pool stats
    fmt.Println("\n=== Pool behavior ===")
    fmt.Println("Buffers are reused between Get/Put calls")
    fmt.Println("Buffers may be GC'd between GC cycles")
}
```

### v3：sync.Cond + 生产级对象池

```go
package main

import (
    "fmt"
    "sync"
    "time"
)

// --- sync.Cond: blocking queue with condition variable ---

type BlockingQueue struct {
    mu      sync.Mutex
    cond    *sync.Cond
    items   []interface{}
    maxSize int
}

func NewBlockingQueue(size int) *BlockingQueue {
    q := &BlockingQueue{maxSize: size}
    q.cond = sync.NewCond(&q.mu)
    return q
}

func (q *BlockingQueue) Put(item interface{}) {
    q.mu.Lock()
    defer q.mu.Unlock()

    // Wait until queue has space
    for len(q.items) >= q.maxSize {
        q.cond.Wait() // releases mutex, waits for Signal
    }
    q.items = append(q.items, item)
    q.cond.Signal() // wake one consumer
}

func (q *BlockingQueue) Take() interface{} {
    q.mu.Lock()
    defer q.mu.Unlock()

    // Wait until queue has items
    for len(q.items) == 0 {
        q.cond.Wait()
    }
    item := q.items[0]
    q.items = q.items[1:]
    q.cond.Signal() // wake one producer
    return item
}

// --- Advanced: object pool with cond ---

type ObjectPool struct {
    mu    sync.Mutex
    cond  *sync.Cond
    pool  []interface{}
    newFn func() interface{}
}

func NewObjectPool(size int, factory func() interface{}) *ObjectPool {
    p := &ObjectPool{newFn: factory}
    p.cond = sync.NewCond(&p.mu)
    for i := 0; i < size; i++ {
        p.pool = append(p.pool, factory())
    }
    return p
}

func (p *ObjectPool) Acquire() interface{} {
    p.mu.Lock()
    defer p.mu.Unlock()
    for len(p.pool) == 0 {
        p.cond.Wait()
    }
    obj := p.pool[0]
    p.pool = p.pool[1:]
    return obj
}

func (p *ObjectPool) Release(obj interface{}) {
    p.mu.Lock()
    defer p.mu.Unlock()
    p.pool = append(p.pool, obj)
    p.cond.Signal()
}

func main() {
    // --- BlockingQueue demo ---
    queue := NewBlockingQueue(3)

    // Producer
    go func() {
        for i := 0; i < 10; i++ {
            queue.Put(fmt.Sprintf("item-%d", i))
            fmt.Printf("Produced: item-%d\n", i)
            time.Sleep(50 * time.Millisecond)
        }
    }()

    // Consumer
    go func() {
        for i := 0; i < 10; i++ {
            item := queue.Take()
            fmt.Printf("Consumed: %v\n", item)
            time.Sleep(100 * time.Millisecond)
        }
    }()

    time.Sleep(2 * time.Second)

    // --- ObjectPool demo ---
    fmt.Println("\n=== Object Pool ===")
    pool := NewObjectPool(2, func() interface{} {
        fmt.Println("  (creating new connection)")
        return fmt.Sprintf("conn-%d", time.Now().UnixNano()%1000)
    })

    c1 := pool.Acquire()
    c2 := pool.Acquire()
    fmt.Printf("Acquired: %v, %v\n", c1, c2)

    pool.Release(c1)
    fmt.Println("Released c1")

    c3 := pool.Acquire() // reuses c1
    fmt.Printf("Acquired (reused): %v\n", c3)
}
```

---

## 四、执行预览

**v1 输出：**
```
Connecting to DB: postgres://localhost:5432
Goroutine 0 got DB: postgres://localhost:5432
Goroutine 2 got DB: postgres://localhost:5432
Goroutine 1 got DB: postgres://localhost:5432

name: Golang
LoadOrStore('name'): value=Golang, loaded=true
--- All entries ---
  name = Golang
  version = 1.22
  year = 2009
After delete 'year':
  name = Golang
  version = 1.22
```

**v2 输出：**
```
=== First 3 requests (allocate) ===
  (allocating new buffer)
Request 1 processed
  (allocating new buffer)
Request 2 processed
  (allocating new buffer)
Request 3 processed

=== Next 3 requests (reuse) ===
Request 4 processed
Request 5 processed
Request 6 processed
```

**v3 输出示例：**
```
Produced: item-0
Consumed: item-0
Produced: item-1
Produced: item-2
Consumed: item-1
...

=== Object Pool ===
  (creating new connection)
  (creating new connection)
Acquired: conn-123, conn-456
Released c1
Acquired (reused): conn-123
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| Once.Do 不可重置 | `sync.Once` 只能执行一次，没有 Reset 方法 |
| sync.Map 不适合写多场景 | 频繁写入性能不如 `map + Mutex` |
| Pool 对象会被 GC 回收 | 每次 GC 可能清空 Pool，不能用于持久存储 |
| Cond.Wait 必须在循环中 | 用 `for !condition { cond.Wait() }` 防止虚假唤醒 |
| Cond.Signal vs Broadcast | Signal 唤醒一个，Broadcast 唤醒全部 |
| Pool.Get 可能返回 nil | 如果 Pool 为空且没有设置 `New`，返回 nil |
| sync.Map 的 Range 不保证快照 | Range 期间可能有并发修改 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| Pool 存数据库连接 | Pool 存临时可丢弃对象（Buffer、临时对象） |
| Cond.Wait 不在循环中 | `for !cond { c.Wait() }` 防虚假唤醒 |
| 用 `sync.Map` 做高频写入 | 高频写用 `map + RWMutex` |
| 从 Pool Get 后不 Reset | `Get()` 后先 `Reset()` 再用 |
| Once.Do 内调用 panic | Once 保证只执行一次，包括 panic 的情况（Go 1.18+修复） |
| Pool.Put 放大对象 | 只 Put 轻量对象，避免内存膨胀 |

---

## 七、练习题

### 🟢 初级
1. 用 `sync.Once` 实现一个延迟初始化的日志实例。
2. 用 `sync.Map` 实现一个并发安全的用户注册表（Store + Load）。

### 🟡 中级
3. 用 `sync.Pool` 实现一个 JSON 编码 buffer 池，对比有池和无池的内存分配差异。
4. 用 `sync.Cond` 实现一个读写屏障：多个读者等写者完成后同时开始读。

### 🔴 高级
5. 实现一个泛型对象池（Go 1.18+），支持泛型类型参数和自定义工厂函数。
6. 用 `sync.Map` + `sync.Cond` 实现一个并发安全的事件总线（EventBus）。

---

## 八、知识点总结

```
sync 高级原语
├── sync.Once
│   ├── Do(f) — 保证 f 只执行一次
│   ├── 底层：Mutex + atomic uint32
│   └── 适用：单例、初始化、配置加载
├── sync.Map
│   ├── Load / Store / Delete
│   ├── LoadOrStore / LoadAndDelete
│   ├── Range — 遍历（回调式）
│   ├── 底层：read map + dirty map
│   └── 适用：读多写少、key 稳定
├── sync.Pool
│   ├── Get() / Put() — 获取/归还
│   ├── New — 工厂函数
│   ├── GC 时可能清空
│   └── 适用：临时对象、减少分配
└── sync.Cond
    ├── Wait() — 等待（释放锁）
    ├── Signal() — 唤醒一个
    ├── Broadcast() — 唤醒全部
    ├── 必须在循环中 Wait
    └── 适用：生产者-消费者、屏障
```

---

## 九、举一反三

| 场景 | 推荐原语 | 原因 |
|------|----------|------|
| 全局配置初始化 | sync.Once | 只需执行一次 |
| 并发缓存（读多写少） | sync.Map | 内置读写分离优化 |
| 高频写入的并发 map | map + RWMutex | sync.Map 写入开销大 |
| JSON/Buffer 复用 | sync.Pool | 减少内存分配和 GC |
| 连接池 | 自建 Pool + Cond | 需要 size 限制和阻塞等待 |
| 多 goroutine 等待事件 | Cond.Broadcast | 一次性唤醒所有等待者 |
| 单 goroutine 通知 | Cond.Signal | 只唤醒一个 |

---

## 十、参考资料

- [Go 官方文档 - sync 包](https://pkg.go.dev/sync)
- [Go 官方博客 - Go maps in action](https://go.dev/blog/maps)
- [sync.Pool 详解 - Go 语言设计与实现](https://draveness.me/golang/docs/part3-runtime/ch06-concurrency/golang-sync-pool/)
- [sync.Map 源码分析](https://qcrao91.gitbook.io/go/sync/map)
- [Go 1.19 sync.Once 修复](https://go.dev/doc/go1.19)

---

## 十一、代码演进

| 版本 | 演进 | 说明 |
|------|------|------|
| v1 | Once + Map 基础 | 单例模式和并发安全 map 基本操作 |
| v2 | Pool 对象复用 | buffer 池减少内存分配 |
| v3 | Cond + 自定义 Pool | 条件变量实现阻塞队列和对象池 |

> **上一篇：** [035 - sync.WaitGroup 与 Mutex](035-waitgroup) | 掌握这些高级原语，你的并发代码会更优雅！
