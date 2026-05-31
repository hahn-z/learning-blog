---
title: "020 - 指针进阶：new 与 make ⭐⭐⭐"
slug: "020-new-make"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.796+08:00"
updated_at: "2026-04-29T10:02:44.571+08:00"
reading_time: 21
tags: ["Go基础"]
---

# 020 - 指针进阶：new 与 make ⭐⭐⭐

> **难度：** ⭐⭐⭐（中等）
> **适合人群：** 理解指针基础，想掌握 Go 内存分配机制的读者
> **阅读时间：** 约 20 分钟

---

## 一、概念讲解

### new(T)：分配零值内存

`new(T)` 是一个内置函数，它：
1. **分配一块内存**，大小为类型 T 的零值大小
2. **将内存初始化为零值**
3. **返回指向这块内存的指针** `*T`

```go
p := new(int)    // *int, 值为 0
s := new(string) // *string, 值为 ""
```

关键点：**new 只分配并零值化，不做任何额外初始化**。

### make(T, ...)：初始化引用类型

`make` 只用于三种类型：**slice、map、channel**。它返回的是**已初始化的值**（不是指针），可以直接使用。

```go
s := make([]int, 5)       // 长度5的切片，已分配底层数组
m := make(map[string]int) // 空map，已初始化，可写入
c := make(chan int)       // 无缓冲channel
```

### 为什么需要 make？

因为这三种类型在使用前**必须初始化内部数据结构**：

| 类型 | 内部结构 | 零值状态 |
|------|----------|----------|
| slice | 指向底层数组的指针 + len + cap | nil，不能 append |
| map | 哈希表 | nil，不能写入 |
| channel | 环形队列 + 锁 | nil，收发阻塞 |

`new` 只给你一个 `nil` 的指针，`make` 才会真正构建内部结构。

### 逃逸分析入门

Go 编译器会决定变量分配在**栈**还是**堆**上：

- **栈分配**：快，函数返回自动回收
- **堆分配**：需要 GC 回收，有额外开销

```go
func createOnStack() int {
    x := 42    // 可能分配在栈上
    return x   // 返回值，不是指针，不逃逸
}

func createOnHeap() *int {
    x := 42    // 逃逸到堆上
    return &x  // 返回指针，编译器必须保证 x 存活
}
```

用 `go build -gcflags="-m"` 可以查看逃逸分析结果。

---

## 二、脑图（ASCII）

```
new 与 make
├── new(T)
│   ├── 分配零值内存
│   ├── 返回 *T（指针）
│   ├── 适用所有类型
│   └── 用得少（一般用 &T{} 代替）
├── make(T, size...)
│   ├── 初始化内部结构
│   ├── 返回 T（值，非指针）
│   ├── 只适用 slice/map/chan
│   └── 用得多
├── 对比
│   ├── new → *T, 零值
│   └── make → T, 已初始化
└── 逃逸分析
    ├── 栈 vs 堆
    ├── go build -gcflags="-m"
    └── 返回指针 → 逃逸到堆
```

---

## 三、完整 Go 代码

```go
package main

import "fmt"

// Demo: new with different types
func newBasics() {
    // new(int) returns *int with zero value 0
    pInt := new(int)
    fmt.Printf("new(int): %d, type: %T\n", *pInt, pInt)

    // new(string) returns *string with zero value ""
    pStr := new(string)
    fmt.Printf("new(string): %q, type: %T\n", *pStr, pStr)

    // new(bool) returns *bool with zero value false
    pBool := new(bool)
    fmt.Printf("new(bool): %v, type: %T\n", *pBool, pBool)

    // new with struct
    type Point struct{ X, Y int }
    pPoint := new(Point)
    fmt.Printf("new(Point): %+v\n", pPoint) // &{X:0 Y:0}
}

// Demo: make with slice, map, channel
func makeBasics() {
    // make slice: type, len, cap
    s := make([]int, 3, 10)
    fmt.Printf("make([]int,3,10): len=%d cap=%d %v\n", len(s), cap(s), s)

    // make map
    m := make(map[string]int)
    m["go"] = 1
    fmt.Printf("make(map): %v\n", m)

    // make channel
    ch := make(chan int, 3) // buffered channel
    ch <- 42
    fmt.Printf("make(chan): %d\n", <-ch)
}

// Demo: why new doesn't work well for slice/map/chan
func newVsMakeProblem() {
    // new gives a pointer to nil slice — NOT usable
    ps := new([]int)
    fmt.Printf("new([]int): %v, isNil=%v\n", *ps, *ps == nil)
    // *ps = append(*ps, 1) // Works but awkward — first dereference

    // make gives ready-to-use slice
    ms := make([]int, 0)
    ms = append(ms, 1)
    fmt.Printf("make([]int): %v\n", ms)

    // new gives a pointer to nil map — NOT writable
    pm := new(map[string]int)
    fmt.Printf("new(map): %v\n", *pm) // map[]
    // (*pm)["key"] = 1 // panic! assignment to entry in nil map

    // make gives ready-to-use map
    mm := make(map[string]int)
    mm["key"] = 1
    fmt.Printf("make(map): %v\n", mm)
}

// Demo: when to use & instead of new
func ampersandVsNew() {
    // These are equivalent:
    p1 := new(int)
    *p1 = 42

    v := 42
    p2 := &v

    // But & is more flexible — can initialize with value
    type Config struct {
        Host string
        Port int
    }

    // new — then set fields
    c1 := new(Config)
    c1.Host = "localhost"
    c1.Port = 8080

    // & with composite literal — cleaner
    c2 := &Config{Host: "localhost", Port: 8080}

    fmt.Printf("new: %+v\n", c1)
    fmt.Printf("&composite: %+v\n", c2)
}

// Demo: escape analysis
func escapeAnalysis() *int {
    // x will escape to heap because we return its address
    x := 42
    return &x
}

func noEscape() int {
    // x stays on stack — no pointer escapes
    x := 42
    return x
}

// Demo: practical patterns
func practicalNew() {
    // Pattern 1: new for zero-value struct pointer
    type Counter struct{ count int }
    c := new(Counter) // *Counter, count=0
    c.count++
    fmt.Printf("Counter: %+v\n", c)

    // Pattern 2: new for atomic pointer (sync/atomic)
    // (conceptual — real usage with atomic.Pointer[T])

    // Pattern 3: new bool for "flag set" pattern
    visited := new(bool)
    fmt.Printf("visited: %v\n", *visited) // false
}

func main() {
    fmt.Println("=== new 基础 ===")
    newBasics()

    fmt.Println("\n=== make 基础 ===")
    makeBasics()

    fmt.Println("\n=== new vs make 对比 ===")
    newVsMakeProblem()

    fmt.Println("\n=== & vs new ===")
    ampersandVsNew()

    fmt.Println("\n=== 实用模式 ===")
    practicalNew()
}
```

---

## 四、执行预览

```
=== new 基础 ===
new(int): 0, type: *int
new(string): "", type: *string
new(bool): false, type: *bool
new(Point): &{X:0 Y:0}

=== make 基础 ===
make([]int,3,10): len=3 cap=10 [0 0 0]
make(map): map[go:1]
make(chan): 42

=== new vs make 对比 ===
new([]int): [], isNil=true
make([]int): [1]
new(map): map[]
make(map): map[key:1]

=== & vs new ===
new: &{Host:localhost Port:8080}
&composite: &{Host:localhost Port:8080}

=== 实用模式 ===
Counter: &{count:1}
visited: false
```

---

## 五、注意事项

| 项目 | new | make |
|------|-----|------|
| 适用类型 | 所有类型 T | slice、map、channel |
| 返回值 | `*T`（指针） | `T`（值） |
| 初始化 | 零值 | 完整初始化（可用） |
| 使用频率 | 较少 | 非常频繁 |
| 等价写法 | `new(T)` ≈ `&T{}` | 无等价写法 |

---

## 六、避坑指南

### ❌ 用 new 创建 map 然后写入
```go
// ❌ new 返回 *map，底层是 nil map
m := new(map[string]int)
(*m)["key"] = 1 // panic!

// ✅ 用 make 初始化
m := make(map[string]int)
m["key"] = 1
```

### ❌ 混淆 new 和 make 的返回类型
```go
// ❌ make 返回值类型，不是指针
var p *[]int = make([]int, 5)  // 编译错误！

// ✅ make 返回 []int
var s []int = make([]int, 5)   // 正确

// ✅ 如果需要指针，取地址
var p *[]int = &[]int{1, 2, 3}
```

### ❌ 用 new 初始化 slice 后直接用
```go
// ❌ new([]int) 返回的是 nil slice 的指针
s := new([]int)
s[0] = 1  // panic! index out of range

// ✅ 用 make 或字面量
s := make([]int, 1)
s[0] = 1  // OK
```

### ❌ 过度关注逃逸分析
```go
// ❌ 为了"优化"到处避免指针
// ✅ 先写正确的代码，有性能问题再用 -gcflags="-m" 分析

// 实用建议：Profile first, optimize second
```

---

## 七、练习题

### 🟢 入门：用 new 创建结构体指针
用 `new` 创建一个 `Student` 结构体指针，设置字段并打印。

```go
type Student struct {
    Name string
    Age  int
}
// 用 new 创建，设置 Name="Tom", Age=18
```

### 🟡 进阶：实现一个用 make 初始化的缓存
实现一个简单的内存缓存，用 `make` 创建 map，支持 Get/Set 操作。

```go
type Cache struct {
    data map[string]string
}
func NewCache() *Cache {
    // 用 make 初始化 data
}
func (c *Cache) Set(key, val string) { /* ... */ }
func (c *Cache) Get(key string) (string, bool) { /* ... */ }
```

### 🔴 挑战：分析逃逸行为
写一个程序，包含 3 个函数：一个变量留在栈上，一个逃逸到堆，一个边界情况。用 `go build -gcflags="-m"` 验证你的判断。

---

## 八、知识点总结

```
new 与 make
├── new(T)
│   ├── 返回 *T
│   ├── 零值初始化
│   ├── 适用所有类型
│   └── 少用，一般用 &T{}
├── make(T)
│   ├── 返回 T
│   ├── 完整初始化
│   ├── 只适用 slice/map/chan
│   └── 常用
├── 核心区别
│   ├── new → 指针 + 零值
│   └── make → 值 + 可用
└── 逃逸分析
    ├── go build -gcflags="-m"
    ├── 返回指针 → 可能逃逸
    └── 接口赋值 → 可能逃逸
```

---

## 九、举一反三

| 需求 | 用 new | 用 make | 用 &T{} |
|------|--------|---------|---------|
| 创建 int 指针 | ✅ `new(int)` | ❌ | ✅ `v:=0; &v` |
| 创建空 slice | ❌ | ✅ `make([]T,0)` | ✅ `[]T{}` |
| 创建空 map | ❌ | ✅ `make(map[K]V)` | ✅ `map[K]V{}` |
| 创建 channel | ❌ | ✅ `make(chan T)` | ❌ |
| 创建结构体指针 | ✅ `new(Struct)` | ❌ | ✅ `&Struct{}` |

---

## 十、参考资料

1. [Go 官方文档 - Allocation with new](https://go.dev/doc/effective_go#allocation_new)
2. [Go 官方文档 - Constructors and composite literals](https://go.dev/doc/effective_go#composite_literals)
3. [Go 语言规范 - Making slices, maps, channels](https://go.dev/ref/spec#Making_slices_maps_and_channels)
4. [Go Blog - Escape Analysis](https://go.dev/blog/ismmkeynote)

---

## 十一、代码演进

### v1 — 用 new 分配基本类型
```go
p := new(int)
*p = 42
fmt.Println(*p)
```

### v2 — new vs make 对比
```go
// new: pointer to nil slice (not usable)
ps := new([]int)

// make: initialized slice (usable)
ms := make([]int, 3)
```

### v3 — 实战：构造函数模式
```go
type Server struct {
    Host string
    Port int
}

// Constructor using composite literal (preferred over new)
func NewServer(host string, port int) *Server {
    return &Server{Host: host, Port: port}
}

s := NewServer("localhost", 8080)
```

---

**上一篇：** [019 - 指针基础](/posts/019-pointers)
**下一篇：** [021 - 结构体 Struct](/posts/021-struct)
