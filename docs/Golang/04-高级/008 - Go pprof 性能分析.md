---
title: "008 - Go pprof 性能分析"
slug: "008-pprof"
category: "Golang高级"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.578+08:00"
updated_at: "2026-04-29T10:02:45.145+08:00"
reading_time: 24
tags: ["性能优化"]
---

# Go pprof 性能分析

> **难度：🔴 高级** | 预计阅读：25 分钟 | 前置知识：并发、HTTP 服务、性能基础

## 概念讲解

`pprof` 是 Go 内置的性能分析工具，源自 Google 的 `gperftools`。它可以分析 CPU 使用、内存分配、Goroutine 阻塞等关键指标，是 Go 性能调优的第一工具。

### pprof 支持的 Profile 类型

| Profile | 说明 | 开销 |
|---------|------|------|
| cpu | CPU 使用分析 | 中等（SIGPROF 采样） |
| heap | 堆内存分配 | 低 |
| goroutine | Goroutine 栈 | 极低 |
| block | 阻塞操作（锁、channel） | 需显式启用 |
| mutex | 锁竞争 | 需显式启用 |
| threadcreate | 线程创建 | 极低 |
| allocs | 内存分配（累计） | 低 |

### 两种使用方式

1. **runtime/pprof**：手动在代码中埋点，适合 CLI/批量任务
2. **net/http/pprof**：自动注册 HTTP 端点，适合在线服务

## 脑图

```
Go pprof 性能分析
├── Profile 类型
│   ├── CPU（函数耗时）
│   ├── Heap（内存分配）
│   ├── Goroutine（协程泄漏）
│   ├── Block（阻塞分析）
│   ├── Mutex（锁竞争）
│   └── Allocs（分配累计）
├── 使用方式
│   ├── net/http/pprof（在线服务）
│   ├── runtime/pprof（CLI 工具）
│   └── go test -cpuprofile/-memprofile
├── 分析工具
│   ├── go tool pprof（CLI）
│   ├── pprof Web UI（火焰图）
│   ├── go tool trace
│   └── speedscope（第三方）
├── 可视化
│   ├── Top N（文本排行）
│   ├── Flame Graph（火焰图）
│   ├── Call Graph（调用图）
│   └── Source/Disasm（源码级）
└── 常见模式
    ├── 内存泄漏 → heap diff
    ├── CPU 热点 → flame graph
    ├── Goroutine 泄漏 → goroutine profile
    └── 锁竞争 → mutex profile
```

## 完整 Go 代码

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	_ "net/http/pprof" // Auto-register /debug/pprof/*
	"os"
	"runtime"
	"runtime/pprof"
	"sync"
	"time"
)

// ============================================================
// Demo 1: net/http/pprof for online services
// ============================================================
func startPProfServer() {
	// pprof endpoints auto-registered at /debug/pprof/
	// /debug/pprof/           - index page
	// /debug/pprof/profile    - 30s CPU profile
	// /debug/pprof/heap       - heap profile
	// /debug/pprof/goroutine  - goroutine stacks
	// /debug/pprof/block      - blocking profile
	// /debug/pprof/mutex      - mutex profile
	go func() {
		log.Println(http.ListenAndServe(":6060", nil))
	}()
}

// ============================================================
// Demo 2: runtime/pprof for CLI tools
// ============================================================
func cpuProfile() func() {
	f, err := os.Create("cpu.prof")
	if err != nil {
		log.Fatal(err)
	}
	if err := pprof.StartCPUProfile(f); err != nil {
		log.Fatal(err)
	}
	return func() {
		pprof.StopCPUProfile()
		f.Close()
		fmt.Println("CPU profile saved to cpu.prof")
	}
}

func memProfile() {
	f, err := os.Create("mem.prof")
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	runtime.GC() // Force GC before writing
	if err := pprof.WriteHeapProfile(f); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Memory profile saved to mem.prof")
}

// ============================================================
// Demo 3: Simulated workload for profiling
// ============================================================
// CPU-intensive function: compute primes
func countPrimes(n int) int {
	count := 0
	for i := 2; i < n; i++ {
		isPrime := true
		for j := 2; j*j <= i; j++ {
			if i%j == 0 {
				isPrime = false
				break
			}
		}
		if isPrime {
			count++
		}
	}
	return count
}

// Memory-intensive function: build large maps
func buildLargeMap(size int) map[string]string {
	m := make(map[string]string, size)
	for i := 0; i < size; i++ {
		key := fmt.Sprintf("key_%d", i)
		val := fmt.Sprintf("value_%d", i)
		m[key] = val
	}
	return m
}

// Goroutine leak simulation
func leakyGoroutine() {
	ch := make(chan int)
	// This goroutine will never return - channel never closed
	go func() {
		for val := range ch {
			_ = val
		}
	}()
	// ch never closed, goroutine leaks
}

// Mutex contention simulation
var (
	counterMu sync.Mutex
	counter   int
)

func contentiousIncrement(wg *sync.WaitGroup) {
	defer wg.Done()
	for i := 0; i < 10000; i++ {
		counterMu.Lock()
		counter++
		counterMu.Unlock()
	}
}

// ============================================================
// Demo 4: Enable block and mutex profiles
// ============================================================
func enableAdvancedProfiles() {
	// Block profile: record goroutine blocking events
	runtime.SetBlockProfileRate(1)
	// Mutex profile: record mutex contention
	runtime.SetMutexProfileFraction(1)
}

// ============================================================
// Demo 5: Programmatic profile reading
// ============================================================
func readGoroutineProfile() {
	p := pprof.Lookup("goroutine")
	fmt.Printf("Goroutine profile: %d entries\n", p.Count())

	// Write to stdout for inspection
	p.WriteTo(os.Stdout, 1) // debug=1: include stack traces
}

func readHeapProfile() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("Heap: Alloc=%dMB Sys=%dMB NumGC=%d\n",
		m.HeapAlloc/1024/1024, m.HeapSys/1024/1024, m.NumGC)
}

// ============================================================
// Main: run demos
// ============================================================
func main() {
	// Enable advanced profiles
	enableAdvancedProfiles()

	// Start pprof HTTP server for live analysis
	startPProfServer()

	// --- CPU Profile Demo ---
	stop := cpuProfile()
	primes := countPrimes(100000)
	fmt.Printf("Primes below 100000: %d\n", primes)
	stop()

	// --- Memory Profile Demo ---
	data := buildLargeMap(100000)
	fmt.Printf("Map size: %d\n", len(data))
	memProfile()

	// --- Goroutine Leak Demo ---
	for i := 0; i < 50; i++ {
		leakyGoroutine()
	}
	time.Sleep(100 * time.Millisecond)
	readGoroutineProfile()

	// --- Mutex Contention Demo ---
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go contentiousIncrement(&wg)
	}
	wg.Wait()
	fmt.Printf("Counter: %d (expected 80000)\n", counter)

	// --- Heap Stats ---
	readHeapProfile()

	// Keep alive for interactive pprof
	fmt.Println("\nServer running on :6060")
	fmt.Println("Try: go tool pprof http://localhost:6060/debug/pprof/profile")
	fmt.Println("Or:  go tool pprof http://localhost:6060/debug/pprof/heap")
	time.Sleep(5 * time.Minute)
}
```

## 执行预览

```
$ go run main.go &
Primes below 100000: 9592
CPU profile saved to cpu.prof
Map size: 100000
Memory profile saved to mem.prof
Goroutine profile: 53 entries
Counter: 80000 (expected 80000)
Heap: Alloc=18MB Sys=28MB NumGC=5

Server running on :6060

$ go tool pprof cpu.prof
(pprof) top10
Showing nodes accounting for 3.8s, 95% of 4s total
      flat  flat%   sum%  cum   cum%
      3.6s  90%    90%   3.6s   90%  main.countPrimes
      0.1s  2.5%   92%   0.1s   2.5%  runtime.mallocgc

(pprof) web countPrimes  # Opens flame graph in browser

$ go tool pprof http://localhost:6060/debug/pprof/heap
(pprof) top
      flat  flat%   sum%  cum   cum%
     10 MB  55%    55%   10 MB  55%  main.buildLargeMap
```

## 注意事项

| 主题 | 说明 | 建议 |
|------|------|------|
| CPU Profile 采样率 | 默认 100Hz（每秒 100 次 SIGPROF） | 足够大多数场景，无需调高 |
| Heap Profile 含义 | 显示存活对象，不是总分配量 | 用 `allocs` 看累计分配 |
| Block Profile 默认关闭 | 需 `SetBlockProfileRate(1)` | 生产环境用较低采样率 |
| Mutex Profile 默认关闭 | 需 `SetMutexProfileFraction(1)` | 同上 |
| pprof HTTP 安全 | `/debug/pprof` 暴露内部信息 | 生产环境限制访问或使用独立端口 |
| Profile 时长 | CPU profile 默认 30 秒 | 短请求场景可缩短：`?seconds=5` |
| Flame Graph 依赖 | 需要 Graphviz（`dot` 命令） | `apt install graphviz` |

## 避坑指南

❌ **在 CI 中做性能对比，忽略环境噪声**
✅ 使用 `benchstat` 做统计显著性对比，至少跑 5 次 benchmark

❌ **只看 `top` 排行，忽略调用路径**
✅ 使用 `web` 或 `flame graph` 理解完整调用链

❌ **heap profile 显示 "runtime.mallocgc" 就停了**
✅ 用 `pprof -inuse_objects` 或 `-alloc_objects` 切换视角

❌ **忘记关闭 CPU profile 文件**
✅ 用 `defer` 确保 `StopCPUProfile()` 被调用

❌ **在线服务直接暴露 pprof 到公网**
✅ 绑定到 `localhost` 或通过 auth middleware 保护

## 练习题

🟢 **基础题：CPU Profiling**
编写一个程序，包含一个快速函数和一个慢速函数，用 `go tool pprof` 找到慢速函数并确认它占 CPU 的时间比例。

🟡 **中级题：内存泄漏排查**
编写一个 HTTP 服务，故意在全局 slice 中不断 append 数据。用 pprof heap 找到泄漏点并修复。

🔴 **高级题：完整性能调优**
给定一个 JSON 解析服务（吞吐量 5K QPS），使用 pprof 全套工具（CPU + heap + goroutine + mutex）完成一次完整的性能调优，记录每步优化效果。

## 知识点总结

```
pprof 分析体系
├── 数据采集
│   ├── runtime/pprof（手动）
│   ├── net/http/pprof（HTTP 端点）
│   ├── go test -cpuprofile/memprofile
│   └── runtime.SetBlockProfileRate/SetMutexProfileFraction
├── 数据分析
│   ├── go tool pprof [binary] [profile]
│   ├── top / top20 / peek
│   ├── web / svg（调用图）
│   ├── list [func]（源码级）
│   └── disasm [func]（汇编级）
├── 可视化
│   ├── 火焰图（Flame Graph）
│   ├── 调用图（Call Graph）
│   ├── 源码标注（Source Annotation）
│   └── go tool trace（时间线）
└── 分析模式
    ├── CPU 热点 → 优化算法
    ├── 内存分配 → 减少逃逸/复用
    ├── Goroutine 泄漏 → 检查 channel/锁
    └── 锁竞争 → 减小临界区/分片
```

## 举一反三

| 场景 | Profile 类型 | 分析方法 | 典型原因 |
|------|-------------|---------|---------|
| 接口响应慢 | CPU | 火焰图 | 热循环/正则回溯 |
| 内存持续增长 | Heap | `top -cum` | 全局 slice/map 只增不减 |
| Goroutine 数飙升 | Goroutine | 栈对比 | channel 未关/锁未释放 |
| CPU 利用率低但延迟高 | Block + Mutex | `web` | 锁竞争/IO 阻塞 |
| GC 压力大 | Heap + Allocs | 对比优化前后 | 小对象频繁分配 |

## 参考资料

- [Go Diagnostics (Official)](https://golang.org/doc/diagnostics)
- [pprof User Guide](https://github.com/google/pprof/blob/master/doc/README.md)
- [Go Performance Debugging (Dave Cheney)](https://dave.cheney.net/high-performance-go-workshop/dotgo-paris.html)
- [pprof++ with Label](https://eng.uber.com/pprof-go/)

## 代码演进

### v1: 基础 — CLI CPU Profile

```go
func main() {
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()
    defer f.Close()

    countPrimes(100000)
}
```

### v2: 进阶 — HTTP 端点 + 多类型 Profile

```go
import _ "net/http/pprof"

func main() {
    go http.ListenAndServe(":6060", nil)
    // ... app logic
}
// Analyze: go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
```

### v3: 生产级 — 自动化 Profile 采集

```go
func continuousProfile() {
    for range time.Tick(5 * time.Minute) {
        // Save CPU profile
        f, _ := os.Create(fmt.Sprintf("cpu_%d.prof", time.Now().Unix()))
        pprof.StartCPUProfile(f)
        time.Sleep(30 * time.Second)
        pprof.StopCPUProfile()
        f.Close()

        // Save heap profile
        hf, _ := os.Create(fmt.Sprintf("heap_%d.prof", time.Now().Unix()))
        runtime.GC()
        pprof.WriteHeapProfile(hf)
        hf.Close()
    }
}
```
