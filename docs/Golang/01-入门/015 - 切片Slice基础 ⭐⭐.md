---
title: "015 - 切片Slice基础 ⭐⭐"
slug: "015-slice-basics"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.742+08:00"
updated_at: "2026-04-29T10:02:44.525+08:00"
reading_time: 29
tags: ["Go基础"]
---


## 难度标注

> ⭐⭐ 中等 | 切片是 Go 中最常用的数据结构，理解 len/cap 和底层数组是关键

## 概念讲解

### 什么是切片（Slice）？

切片是 Go 语言中对数组的一个**轻量级抽象**。与数组不同，切片的长度是动态的，可以按需增长。切片是 Go 中最常用的数据结构，**99% 的场景用切片而非数组**。

### 切片的内部结构

切片底层是一个包含三个字段的结构体（slice header）：

```
Slice Header (24 bytes on 64-bit)
┌──────────┬──────────┬──────────┐
│  Pointer │   Len    │   Cap    │
│  8 bytes │  8 bytes │  8 bytes │
└────┬─────┴──────────┴──────────┘
     │
     ▼
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ e0 │ e1 │ e2 │ e3 │    │    │    │    │  ← Underlying array
└────┴────┴────┴────┴────┴────┴────┴────┘
      ↑                    ↑
      │←─── Len = 4 ───→│←─ Cap = 8 ─→│
```

- **Pointer**：指向底层数组的指针
- **Len**：当前元素个数（`len(s)`）
- **Cap**：底层数组容量（`cap(s)`），从 slice 开始位置到底层数组末尾

### 切片 vs 数组对比

```go
// Array: length is part of type
var a [5]int    // type: [5]int

// Slice: length is NOT part of type
var s []int     // type: []int (nil slice)
s = []int{1,2,3} // type: still []int
```

### nil 切片 vs 空切片

```go
var s1 []int          // nil slice: pointer=nil, len=0, cap=0
s2 := []int{}         // empty slice: pointer!=nil, len=0, cap=0
s3 := make([]int, 0)  // empty slice: pointer!=nil, len=0, cap=0

fmt.Println(s1 == nil) // true
fmt.Println(s2 == nil) // false
fmt.Println(s3 == nil) // false
```

**实际区别很小**，`len()`、`cap()`、`append()`、`range` 对两者行为一致。推荐使用 nil 切片表示"没有元素"，空切片表示"明确为空集合"。

## 脑图

```
切片 Slice
├── 创建方式
│   ├── var s []T              (nil slice)
│   ├── s := []T{1,2,3}        (literal)
│   ├── s := make([]T, len)    (make with len)
│   ├── s := make([]T, len, cap)(make with cap)
│   └── s := arr[1:3]          (slice from array)
├── 核心概念
│   ├── len(s)  当前长度
│   ├── cap(s)  底层数组容量
│   ├── append  追加元素（可能扩容）
│   └── s[i:j]  切片操作（左闭右开）
├── 底层机制
│   ├── slice header (ptr/len/cap)
│   ├── 共享底层数组
│   ├── 扩容策略 (<1024 ×2, >=1024 ×1.25)
│   └── 3-index slice s[low:high:max]
├── nil vs 空
│   ├── var s []T  → nil
│   ├── []T{}      → empty
│   └── make([]T,0)→ empty
├── copy 函数
│   └── copy(dst, src) 返回拷贝元素数
├── 作为函数参数
│   ├── 传 slice header（引用语义）
│   └── append 可能修改底层数组
└── 常见陷阱
    ├── append 后原 slice 被覆盖
    ├── 大切片的子切片引用不释放
    └── nil slice 可用但要注意 JSON
```

## 完整 Go 代码

### 代码演进 v1：创建与基本操作

```go
package main

import "fmt"

func main() {
    // 1. Nil slice
    var s1 []int
    fmt.Println("Nil slice:", s1, "len:", len(s1), "cap:", cap(s1), "nil:", s1 == nil)

    // 2. Slice literal
    s2 := []int{1, 2, 3, 4, 5}
    fmt.Println("Literal:", s2, "len:", len(s2), "cap:", cap(s2))

    // 3. Make with length
    s3 := make([]int, 3) // len=3, cap=3, all zeros
    fmt.Println("Make(3):", s3, "len:", len(s3), "cap:", cap(s3))

    // 4. Make with length and capacity
    s4 := make([]int, 3, 10) // len=3, cap=10
    fmt.Println("Make(3,10):", s4, "len:", len(s4), "cap:", cap(s4))

    // 5. Slice from array
    arr := [5]int{10, 20, 30, 40, 50}
    s5 := arr[1:4] // elements at index 1, 2, 3
    fmt.Println("From array:", s5, "len:", len(s5), "cap:", cap(s5))
    // Note: cap=4 because underlying array goes from index 1 to end

    // 6. Slice expressions
    fmt.Println("s2[1:3]:", s2[1:3])   // [2 3]
    fmt.Println("s2[:3]:", s2[:3])     // [1 2 3]
    fmt.Println("s2[2:]:", s2[2:])     // [3 4 5]
    fmt.Println("s2[:]:", s2[:])       // [1 2 3 4 5]
}
```

### 代码演进 v2：append、扩容、copy

```go
package main

import "fmt"

func main() {
    // === Append and capacity growth ===
    s := make([]int, 0, 3) // cap=3
    fmt.Printf("Start: len=%d cap=%d %v\n", len(s), cap(s), s)

    for i := 0; i < 10; i++ {
        s = append(s, i)
        fmt.Printf("After append(%2d): len=%d cap=%d %v\n", i, len(s), cap(s), s)
    }

    // === Shared underlying array pitfall ===
    fmt.Println("\n--- Shared array pitfall ---")
    original := []int{1, 2, 3, 4, 5}
    sub := original[1:3] // sub = [2, 3], shares underlying array
    fmt.Println("original:", original)
    fmt.Println("sub:     ", sub)

    sub[0] = 999 // modifies shared array!
    fmt.Println("After sub[0]=999:")
    fmt.Println("original:", original) // [1 999 3 4 5] - CHANGED!
    fmt.Println("sub:     ", sub)      // [999 3]

    // === Fix: use copy or 3-index slice ===
    fmt.Println("\n--- Safe copy ---")
    original2 := []int{1, 2, 3, 4, 5}
    sub2 := make([]int, 2)
    copy(sub2, original2[1:3]) // independent copy
    sub2[0] = 999
    fmt.Println("original2:", original2) // [1 2 3 4 5] - safe!
    fmt.Println("sub2:     ", sub2)      // [999 3]

    // === 3-index slice limits capacity ===
    fmt.Println("\n--- 3-index slice ---")
    base := []int{1, 2, 3, 4, 5}
    limited := base[1:3:3] // len=2, cap=2 (not 4!)
    fmt.Println("limited: len:", len(limited), "cap:", cap(limited))
    // append will create new underlying array
    limited = append(limited, 100)
    fmt.Println("After append: len:", len(limited), "cap:", cap(limited))
    fmt.Println("base (unchanged):", base)
}
```

### 代码演进 v3：实际应用模式

```go
package main

import (
    "encoding/json"
    "fmt"
    "sort"
    "strings"
)

// Filter returns elements that satisfy the predicate
func Filter[T any](s []T, pred func(T) bool) []T {
    result := make([]T, 0, len(s)) // pre-allocate
    for _, v := range s {
        if pred(v) {
            result = append(result, v)
        }
    }
    return result
}

// Map transforms each element
func Map[T, U any](s []T, fn func(T) U) []U {
    result := make([]U, len(s))
    for i, v := range s {
        result[i] = fn(v)
    }
    return result
}

// Contains checks if element exists
func Contains[T comparable](s []T, target T) bool {
    for _, v := range s {
        if v == target {
            return true
        }
    }
    return false
}

// Remove element at index (preserves order)
func RemoveAt[T any](s []T, i int) []T {
    return append(s[:i], s[i+1:]...)
}

// Remove element at index (fast, does NOT preserve order)
func RemoveAtFast[T any](s []T, i int) []T {
    s[i] = s[len(s)-1]
    return s[:len(s)-1]
}

func main() {
    // === Functional patterns ===
    nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

    evens := Filter(nums, func(n int) bool { return n%2 == 0 })
    fmt.Println("Evens:", evens)

    doubled := Map(nums, func(n int) int { return n * 2 })
    fmt.Println("Doubled:", doubled)

    fmt.Println("Contains 5:", Contains(nums, 5))
    fmt.Println("Contains 11:", Contains(nums, 11))

    // === Remove patterns ===
    items := []string{"a", "b", "c", "d", "e"}
    items = RemoveAt(items, 2) // remove "c"
    fmt.Println("After remove:", items)

    // === Sort slice ===
    unsorted := []int{5, 2, 8, 1, 9, 3}
    sort.Ints(unsorted)
    fmt.Println("Sorted:", unsorted)

    // === String splitting ===
    csv := "go,python,rust,java"
    langs := strings.Split(csv, ",")
    fmt.Println("Languages:", langs)
    fmt.Println("Joined:", strings.Join(langs, " | "))

    // === nil slice and JSON ===
    var nilSlice []string
    emptySlice := []string{}

    b1, _ := json.Marshal(nilSlice)
    b2, _ := json.Marshal(emptySlice)
    fmt.Println("nil slice JSON:", string(b1))   // null
    fmt.Println("empty slice JSON:", string(b2)) // []
}
```

## 执行预览

### v1 执行结果

```
Nil slice: [] len: 0 cap: 0 nil: true
Literal: [1 2 3 4 5] len: 5 cap: 5
Make(3): [0 0 0] len: 3 cap: 3
Make(3,10): [0 0 0] len: 3 cap: 10
From array: [20 30 40] len: 3 cap: 4
s2[1:3]: [2 3]
s2[:3]: [1 2 3]
s2[2:]: [3 4 5]
s2[:]: [1 2 3 4 5]
```

### v2 执行结果（扩容部分）

```
Start: len=0 cap=3 []
After append( 0): len=1 cap=3 [0]
After append( 1): len=2 cap=3 [0 1]
After append( 2): len=3 cap=3 [0 1 2]
After append( 3): len=4 cap=6 [0 1 2 3]
After append( 4): len=5 cap=6 [0 1 2 3 4]
After append( 5): len=6 cap=6 [0 1 2 3 4 5]
After append( 6): len=7 cap=12 [0 1 2 3 4 5 6]
...
```

### v3 执行结果

```
Evens: [2 4 6 8 10]
Doubled: [2 4 6 8 10 12 14 16 18 20]
Contains 5: true
Contains 11: false
After remove: [a b d e]
Sorted: [1 2 3 5 8 9]
Languages: [go python rust java]
Joined: go | python | rust | java
nil slice JSON: null
empty slice JSON: []
```

## 注意事项

| 注意点 | 说明 | 严重程度 |
|--------|------|----------|
| append 返回新 slice | 必须用 `s = append(s, x)` 接收返回值 | 🔴 严重 |
| 共享底层数组 | 子切片修改会影响原切片 | 🔴 严重 |
| 扩容策略变化 | Go 1.18+ 扩容规则更复杂，不总是 2 倍 | 🟡 注意 |
| nil slice JSON = null | API 返回 `[]` 需用空切片而非 nil | 🟡 注意 |
| copy 返回拷贝数量 | 以 dst 和 src 中较短的为准 | 🟡 注意 |
| 并发不安全 | 多 goroutine 同时 append 需要 mutex 或 sync.Pool | 🔴 严重 |
| 大切片子切片内存泄漏 | 子切片引用底层数组，GC 无法回收 | 🔴 严重 |

## 避坑指南

### ❌ 忘记接收 append 返回值

```go
// ❌ BAD: append 结果丢失
s := []int{1, 2, 3}
append(s, 4) // s 仍然是 [1,2,3]
```

```go
// ✅ GOOD: 始终接收返回值
s := []int{1, 2, 3}
s = append(s, 4) // s = [1,2,3,4]
```

### ❌ 子切片导致内存泄漏

```go
// ❌ BAD: 大 slice 的一个小子切片，整个大数组无法 GC
var bigData = make([]byte, 1<<30) // 1GB
smallPiece := bigData[:10]         // 只用 10 bytes，但 1GB 无法回收
```

```go
// ✅ GOOD: copy 需要的数据，释放原数组
smallPiece := make([]byte, 10)
copy(smallPiece, bigData[:10])
bigData = nil // now 1GB can be GC'd
```

### ❌ nil slice 在 JSON 中为 null

```go
// ❌ BAD: API 返回 null 而非 []
var items []string
json.NewEncoder(w).Encode(items) // returns "null"
```

```go
// ✅ GOOD: 初始化为空切片
items := make([]string, 0) // or []string{}
json.NewEncoder(w).Encode(items) // returns "[]"
```

## 练习题

### 🟢 基础题

**题目 1：** 写一个函数 `Reverse(s []int) []int`，原地反转切片并返回。

<details>
<summary>参考答案</summary>

```go
func Reverse(s []int) []int {
    for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
        s[i], s[j] = s[j], s[i]
    }
    return s
}
```
</details>

### 🟡 进阶题

**题目 2：** 实现一个函数 `Dedupe(s []string) []string`，去除字符串切片中的重复元素，保持原始顺序。

<details>
<summary>参考答案</summary>

```go
func Dedupe(s []string) []string {
    seen := make(map[string]bool)
    result := make([]string, 0, len(s))
    for _, v := range s {
        if !seen[v] {
            seen[v] = true
            result = append(result, v)
        }
    }
    return result
}
```
</details>

### 🔴 挑战题

**题目 3：** 实现一个 `Chunk[T any](s []T, size int) [][]T` 函数，将切片分成长度为 size 的多个子切片。处理 size ≤ 0 的情况，以及最后一个 chunk 可能不足 size 的情况。

<details>
<summary>参考答案</summary>

```go
func Chunk[T any](s []T, size int) [][]T {
    if size <= 0 {
        return nil
    }
    chunks := make([][]T, 0, (len(s)+size-1)/size)
    for size < len(s) {
        s, chunks = s[size:], append(chunks, s[:size:size])
    }
    chunks = append(chunks, s)
    return chunks
}

func main() {
    nums := []int{1, 2, 3, 4, 5, 6, 7}
    fmt.Println(Chunk(nums, 3)) // [[1 2 3] [4 5 6] [7]]
    fmt.Println(Chunk(nums, 0)) // []
}
```

关键点：`s[:size:size]` 使用 3-index slice 限制子切片容量，避免共享底层数组导致的内存泄漏。
</details>

## 知识点总结

```
切片 Slice
├── 创建
│   ├── var s []T              nil slice
│   ├── s := []T{...}          literal
│   ├── make([]T, len)         指定长度
│   ├── make([]T, len, cap)    长度+容量
│   └── arr[low:high]          从数组切片
├── 操作
│   ├── len(s) / cap(s)        长度/容量
│   ├── append(s, elems...)    追加（返回新slice）
│   ├── s[low:high]            切片（左闭右开）
│   ├── s[low:high:max]        限制容量
│   ├── copy(dst, src)         复制
│   └── range                  遍历
├── 底层
│   ├── SliceHeader{Ptr,Len,Cap}
│   ├── 共享底层数组
│   └── 扩容：< 256 → ×2, ≥ 256 → ~1.25×
├── 特殊
│   ├── nil slice vs empty slice
│   ├── nil → JSON null
│   └── empty → JSON []
└── 最佳实践
    ├── 预分配容量（避免多次扩容）
    ├── copy 避免共享数组
    ├── 3-index slice 限制容量
    └── 始终接收 append 返回值
```

## 举一反三

| 操作 | Go | Python | JavaScript |
|------|-----|--------|------------|
| 创建 | `make([]int, 0)` | `[]` | `[]` |
| 追加 | `s = append(s, x)` | `s.append(x)` | `s.push(x)` |
| 切片 | `s[1:3]` | `s[1:3]` | `s.slice(1,3)` |
| 长度 | `len(s)` | `len(s)` | `s.length` |
| 是否包含 | 手写循环 | `x in s` | `s.includes(x)` |
| 连接 | `append(a, b...)` | `a + b` | `[...a, ...b]` |

## 参考资料

- [Go 语言规范 - Slice types](https://go.dev/ref/spec#Slice_types)
- [Go 博客 - Go Slices: usage and internals](https://go.dev/blog/slices-intro)
- [Go 博客 - Arrays, slices and strings](https://go.dev/blog/slices)
- [Go 1.18 切片扩容规则变化](https://go.dev/doc/go1.18)
