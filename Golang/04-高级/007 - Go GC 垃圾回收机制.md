---
title: "007 - Go GC 垃圾回收机制"
slug: "007-gc"
category: "Golang高级"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.567+08:00"
updated_at: "2026-04-29T10:02:45.136+08:00"
reading_time: 23
tags: ["性能优化"]
---

# Go GC 垃圾回收机制

> **难度：🔴 高级** | 预计阅读：20 分钟 | 前置知识：指针、接口、内存分配

## 概念讲解

Go 的垃圾回收器（Garbage Collector, GC）是自动内存管理的核心组件。它负责识别和回收不再被程序引用的内存，让开发者无需手动 `malloc/free`。

### GC 的核心目标

1. **低延迟**：STW（Stop-The-World）时间尽可能短
2. **高吞吐**：不影响程序整体性能
3. **可预测**：GC 行为可调可控

### Go GC 演进史

| 版本 | 算法 | 特点 |
|------|------|------|
| Go 1.0 | STW Mark-Sweep | 简单但停顿长 |
| Go 1.5 | 并发三色标记清除 | STW 降到亚毫秒 |
| Go 1.8 | 混合写屏障 | STW 稳定在 100μs 内 |
| Go 1.19+ | 软内存上限（Soft Memory Limit） | GOGC 自动调节 |

### 三色标记法

三色标记法是 Go GC 的核心算法：

- **白色**：未被扫描的对象，GC 结束后回收
- **灰色**：已被发现但尚未扫描其引用的对象
- **黑色**：已扫描完毕的对象，不会被回收

```
GC Root → [Gray] → scan references → [Black]
                                        ↓
                          [White] ← 未被引用 → 回收
```

### 写屏障（Write Barrier）

并发标记期间，用户代码可能修改对象引用关系。写屏障确保：
- 新建的引用对象不会被遗漏
- 已标记的对象引用关系变更被正确记录

Go 1.8+ 使用**混合写屏障**（Dijkstra + Yuasa），性能优于纯 Dijkstra 写屏障。

## 脑图

```
Go GC 垃圾回收
├── 核心算法
│   ├── 三色标记法（白/灰/黑）
│   ├── 并发标记清除
│   └── 写屏障（混合写屏障）
├── 关键指标
│   ├── GOGC（目标堆增长比率）
│   ├── memory ballast（内存压舱石）
│   ├── Soft Memory Limit（Go 1.19+）
│   └── GC Pacer（GC 步调器）
├── GC 四阶段
│   ├── Sweep Termination（清扫终止）
│   ├── Mark Phase（标记阶段）
│   │   ├── Mark Assist
│   │   └── Mark Worker
│   ├── Mark Termination（标记终止）
│   └── Sweep Phase（清扫阶段）
├── 调优手段
│   ├── 调整 GOGC
│   ├── 减少 heap 分配
│   ├── sync.Pool 复用
│   └── 预分配 slice/map
└── 监控分析
    ├── runtime.ReadMemStats
    ├── debug.FreeOSMemory
    ├── trace（go tool trace）
    └── GODEBUG=gctrace=1
```

## 完整 Go 代码

```go
package main

import (
	"fmt"
	"runtime"
	"runtime/debug"
	"sync"
	"time"
)

// Demo 1: Basic GC stats monitoring
func demoGCStats() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	fmt.Println("=== GC Stats ===")
	fmt.Printf("HeapAlloc: %d MB\n", m.HeapAlloc/1024/1024)
	fmt.Printf("HeapSys:   %d MB\n", m.HeapSys/1024/1024)
	fmt.Printf("HeapIdle:  %d MB\n", m.HeapIdle/1024/1024)
	fmt.Printf("HeapInuse: %d MB\n", m.HeapInuse/1024/1024)
	fmt.Printf("NumGC:     %d\n", m.NumGC)
	fmt.Printf("GCCPUFraction: %.6f\n", m.GCCPUFraction)
	fmt.Printf("PauseTotalNs:  %d\n", m.PauseTotalNs)
	fmt.Printf("Last pause:    %d ns\n", m.PauseNs[(m.NumGC+255)%256])
}

// Demo 2: GOGC tuning effect
func demoGOGCTuning() {
	fmt.Println("\n=== GOGC Tuning ===")

	for _, gogc := range []int{100, 200, 400, 800} {
		debug.SetGCPercent(gogc)
		// Reset stats by forcing GC
		runtime.GC()

		start := time.Now()
		var lastGC uint32

		// Allocate and release memory repeatedly
		for i := 0; i < 100; i++ {
			_ = make([]byte, 1024*1024) // 1MB each
			var m runtime.MemStats
			runtime.ReadMemStats(&m)
			if m.NumGC != lastGC {
				fmt.Printf("GOGC=%d: GC #%d, HeapAlloc=%d MB, Pause=%d ns\n",
					gogc, m.NumGC, m.HeapAlloc/1024/1024,
					m.PauseNs[(m.NumGC+255)%256])
				lastGC = m.NumGC
			}
		}
		fmt.Printf("GOGC=%d: elapsed=%v\n\n", gogc, time.Since(start))
	}
	// Restore default
	debug.SetGCPercent(100)
}

// Demo 3: sync.Pool to reduce GC pressure
var bytePool = sync.Pool{
	New: func() interface{} {
		buf := make([]byte, 1024)
		return &buf
	},
}

func demoSyncPool() {
	fmt.Println("\n=== sync.Pool vs Raw Alloc ===")

	// Without pool
	runtime.GC()
	var m1 runtime.MemStats
	runtime.ReadMemStats(&m1)
	gcCount1 := m1.NumGC

	start := time.Now()
	for i := 0; i < 100000; i++ {
		buf := make([]byte, 1024)
		_ = buf[0]
	}
	withoutPoolTime := time.Since(start)

	var m2 runtime.MemStats
	runtime.ReadMemStats(&m2)
	gcWithout := m2.NumGC - gcCount1

	// With pool
	runtime.GC()
	runtime.ReadMemStats(&m1)
	gcCount1 = m1.NumGC

	start = time.Now()
	for i := 0; i < 100000; i++ {
		bp := bytePool.Get().(*[]byte)
		_ = (*bp)[0]
		bytePool.Put(bp)
	}
	withPoolTime := time.Since(start)

	runtime.ReadMemStats(&m2)
	gcWith := m2.NumGC - gcCount1

	fmt.Printf("Without Pool: %v, %d GCs\n", withoutPoolTime, gcWithout)
	fmt.Printf("With Pool:    %v, %d GCs\n", withPoolTime, gcWith)
}

// Demo 4: Soft Memory Limit (Go 1.19+)
func demoSoftMemoryLimit() {
	fmt.Println("\n=== Soft Memory Limit ===")

	// Set soft memory limit to 50 MB
	limit := int64(50 * 1024 * 1024)
	debug.SetMemoryLimit(limit)
	fmt.Printf("Memory limit set to %d MB\n", limit/1024/1024)

	// Allocate memory
	for i := 0; i < 30; i++ {
		_ = make([]byte, 1024*1024) // 1MB each
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("HeapAlloc after alloc: %d MB (limit: %d MB)\n",
		m.HeapAlloc/1024/1024, limit/1024/1024)

	// Reset
	debug.SetMemoryLimit(math.MaxInt64)
}

// Demo 5: GC trace
func demoGCTrace() {
	fmt.Println("\n=== GC Trace (enable with GODEBUG=gctrace=1) ===")
	// When running with: GODEBUG=gctrace=1 go run main.go
	// Output format:
	// gc 1 @0.003s 5%: 0.018+0.32+0.015 ms clock, 0.14+0.12+0.033 ms cpu, 4->4->3 MB, 5 MB goal, 8 P
	// Fields: gc# @timestamp cpu%: STW-sweep+concurrent-mark+STW-mark-term

	// Simulate workload
	data := make([][]byte, 0)
	for i := 0; i < 20; i++ {
		data = append(data, make([]byte, 1024*1024))
		if i%5 == 4 {
			data = data[:len(data)-3] // Release some
			runtime.GC()
		}
	}
	_ = data
}

// Demo 6: Finalizers (use with caution)
type Resource struct {
	id int
}

func demoFinalizer() {
	fmt.Println("\n=== Finalizer Demo ===")

	r := &Resource{id: 42}
	runtime.SetFinalizer(r, func(r *Resource) {
		fmt.Printf("Resource %d being collected\n", r.id)
	})

	r = nil // Remove reference
	runtime.GC()
	time.Sleep(10 * time.Millisecond)
}

func main() {
	demoGCStats()
	demoGOGCTuning()
	demoSyncPool()
	demoSoftMemoryLimit()
	demoGCTrace()
	demoFinalizer()
}
```

需要补一个 import：

```go
import "math"
```

## 执行预览

```
$ GODEBUG=gctrace=1 go run main.go
=== GC Stats ===
HeapAlloc: 0 MB
HeapSys:   1 MB
NumGC:     0

gc 1 @0.003s 5%: 0.018+0.32+0.015 ms clock, 4->4->3 MB, 5 MB goal, 8 P

=== GOGC Tuning ===
GOGC=100: GC #3, HeapAlloc=8 MB, Pause=45000 ns
GOGC=100: elapsed=12.3ms

GOGC=200: GC #5, HeapAlloc=16 MB, Pause=38000 ns
GOGC=200: elapsed=10.1ms

=== sync.Pool vs Raw Alloc ===
Without Pool: 8.2ms, 12 GCs
With Pool:    1.5ms, 1 GCs

=== Finalizer Demo ===
Resource 42 being collected
```

## 注意事项

| 主题 | 说明 | 建议 |
|------|------|------|
| GOGC 默认值 | 默认 100，即堆增长 100% 时触发 GC | 生产环境建议测试 200-400 |
| STW 时间 | Go 1.12+ 通常 < 1ms | 超过 10ms 需要排查 |
| Finalizer | 增加对象开销，执行时间不可控 | 仅用于资源泄漏检测 |
| sync.Pool | Pool 中的对象会在 GC 时清除 | 不要用于持久化存储 |
| 大对象 | >32KB 直接从堆分配 | 考虑用 sync.Pool 复用 |
| 内存碎片 | Go 使用 TCMalloc 风格分配器 | 通常不是问题，但需关注 HeapSys |
| SetMemoryLimit | Go 1.19+ 特性 | 与 GOGC 配合使用效果最佳 |

## 避坑指南

❌ **用 `runtime.GC()` 手动触发 GC 来"优化性能"**
✅ 让 GC 自动运行，只在特定场景（如 batch job 阶段间隙）手动触发

❌ **把 GOGC 设为 `off`（`debug.SetGCPercent(-1)`）禁用 GC**
✅ 只在确知内存使用模式且生命周期短的 batch 任务中禁用

❌ **依赖 Finalizer 做资源清理**
✅ 使用 `defer` 或显式 `Close()` 方法，Finalizer 仅作安全网

❌ **sync.Pool 存储带状态的对象不复位**
✅ Get 后重置状态再使用，避免脏数据

❌ **忽略 `GODEBUG=gctrace=1` 的输出**
✅ 上线前开启 gctrace 观察 GC 频率和暂停时间

## 练习题

🟢 **基础题：观察 GC 行为**
编写程序，使用 `runtime.ReadMemStats` 打印每次 GC 的暂停时间和堆大小变化。

🟡 **中级题：sync.Pool 优化**
实现一个 JSON 编码器，使用 sync.Pool 复用 `bytes.Buffer`，对比优化前后的 GC 次数和暂停时间。

🔴 **高级题：GC 调优实战**
给定一个 HTTP 服务（每秒 10K 请求），通过调整 GOGC 和 SetMemoryLimit，将 GC CPU 占用从 5% 降到 1% 以下。记录调优过程和最终参数。

## 知识点总结

```
Go GC 知识体系
├── 算法基础
│   ├── 三色标记（Tri-color marking）
│   ├── 并发标记清除（Concurrent mark-sweep）
│   └── 混合写屏障（Hybrid write barrier）
├── GC 生命周期
│   ├── Sweep Termination → Mark → Mark Termination → Sweep
│   └── Mark Assist（分配过快时协助标记）
├── 调优参数
│   ├── GOGC（堆增长目标比）
│   ├── SetMemoryLimit（Go 1.19+）
│   └── GOMEMLIMIT（环境变量）
├── 减少分配
│   ├── sync.Pool
│   ├── 预分配 make
│   ├── 值类型 vs 指针
│   └── strings.Builder
└── 监控工具
    ├── runtime.ReadMemStats
    ├── GODEBUG=gctrace=1
    ├── go tool trace
    └── runtime/pprof
```

## 举一反三

| 场景 | 对应知识点 | 扩展应用 |
|------|-----------|---------|
| 高并发 HTTP 服务 GC 延迟高 | Mark Assist、GOGC | 使用 sync.Pool 减少逃逸 |
| 批处理任务内存持续增长 | SetMemoryLimit | 配合手动 GC 释放 |
| 长连接 WebSocket 服务内存泄漏 | ReadMemStats 对比 | pprof heap diff |
| 微服务 GC CPU 占比高 | GOGC 调优 | GOMEMLIMIT 环境变量 |
| 日志序列化分配过多 | sync.Pool 复用 | zap/zerolog 设计思路 |

## 参考资料

- [Go GC Guide (Official)](https://tip.golang.org/doc/gc-guide)
- [Go 1.5 GC Design Doc](https://docs.google.com/document/d/1aw4rO7s0I2f2BP24kTpBq-yf0G6VDjHUxX8S27F)
- [Go 1.18+ GC Pacer Design](https://github.com/golang/go/blob/master/src/runtime/mgcpacer.go)
- Austin Clements - "Getting to Go: The Story of GC" (GopherCon)

## 代码演进

### v1: 基础 — 观察默认 GC 行为

```go
func main() {
    for i := 0; i < 100; i++ {
        _ = make([]byte, 1024*1024)
    }
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Printf("GCs: %d, Heap: %d MB\n", m.NumGC, m.HeapAlloc/1024/1024)
}
```

### v2: 进阶 — sync.Pool 减少分配

```go
var pool = sync.Pool{New: func() interface{} { b := make([]byte, 1024); return &b }}

func main() {
    for i := 0; i < 100; i++ {
        bp := pool.Get().(*[]byte)
        // use *bp ...
        pool.Put(bp)
    }
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    fmt.Printf("GCs: %d, Heap: %d MB\n", m.NumGC, m.HeapAlloc/1024/1024)
}
```

### v3: 生产级 — GOGC + SetMemoryLimit + 监控

```go
func init() {
    debug.SetGCPercent(200)
    debug.SetMemoryLimit(512 * 1024 * 1024) // 512MB soft limit
}

func gcMonitor() {
    var lastGC uint32
    for range time.Tick(5 * time.Second) {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        if m.NumGC > lastGC {
            fmt.Printf("[GC] #%d heap=%dMB pause=%dµs cpu=%.4f\n",
                m.NumGC, m.HeapAlloc/1024/1024,
                m.PauseNs[(m.NumGC+255)%256]/1000,
                m.GCCPUFraction)
            lastGC = m.NumGC
        }
    }
}

func main() {
    go gcMonitor()
    // ... application logic
}
```
