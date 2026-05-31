---
title: "005 - Go 常量与 iota 枚举"
slug: "005-constants-iota"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.604+08:00"
updated_at: "2026-04-29T10:02:44.447+08:00"
reading_time: 16
tags: ["Go基础"]
---

# 005 - Go 常量与 iota 枚举

## 难度标注

⭐⭐☆☆☆

**前置知识：** 变量声明、基本数据类型

**预估用时：** 30-40 分钟

---

## 概念讲解

**一句话定义：** 常量是编译时就确定的不可变值，`iota` 是 Go 提供的常量生成器，用于创建自增的枚举值。

**现实类比：** 常量就像刻在石头上的数字——一旦刻好就不能改。`iota` 像自动编号机，每行自动递增，省去你手动写数字的麻烦。

**技术场景：** 定义 HTTP 状态码、权限位掩码、枚举类型（如订单状态：待付款、已付款、已发货）、配置常量等。

---

## 实时脑图

```
         Go 常量系统
             │
   ┌─────────┼─────────┐
   │         │         │
 const    iota      高级用法
   │         │         │
 ├── 单个   ├── 自增   ├── 位掩码
 ├── 分组   ├── 跳值   ├── 无类型
 └── 隐式   └── 表达式 └── 编译期计算
```

---

## 完整代码

```go
package main

import (
	"fmt"
	"math"
)

// === 1. Basic const declarations ===
const Pi = 3.14159265358979
const AppName = "GoPlayground"

// === 2. Grouped const with implicit repeat ===
const (
	StatusOK    = 200
	StatusCreated = 201
	StatusBadRequest = 400
	StatusNotFound   = 404
)

// === 3. iota basic auto-increment ===
const (
	Sunday    = iota // 0
	Monday           // 1 (iota implicit)
	Tuesday          // 2
	Wednesday        // 3
	Thursday         // 4
	Friday           // 5
	Saturday         // 6
)

// === 4. iota with expression ===
const (
	_  = iota // skip 0
	KB = 1 << (10 * iota) // 1 << 10 = 1024
	MB                     // 1 << 20
	GB                     // 1 << 30
	TB                     // 1 << 40
)

// === 5. Bitmask with iota (permissions) ===
const (
	ReadPermission   = 1 << iota // 1 (001)
	WritePermission              // 2 (010)
	ExecutePermission            // 4 (100)
)

// === 6. Custom enum with string ===
type OrderStatus int

const (
	Pending   OrderStatus = iota // 0
	Paid                         // 1
	Shipped                      // 2
	Delivered                    // 3
	Cancelled                    // 4
)

// String method for pretty printing
func (s OrderStatus) String() string {
	names := [...]string{"Pending", "Paid", "Shipped", "Delivered", "Cancelled"}
	if s < 0 || int(s) >= len(names) {
		return "Unknown"
	}
	return names[s]
}

// === 7. Typed vs untyped constants ===
const (
	untypedInt   = 42        // untyped int
	untypedFloat = 3.14      // untyped float
	typedInt     int     = 100 // typed int
)

func main() {
	// Basic usage
	fmt.Println("Pi:", Pi)
	fmt.Println("App:", AppName)

	// iota enum
	fmt.Printf("Sunday=%d Friday=%d\n", Sunday, Friday)

	// Size constants
	fmt.Printf("KB=%d MB=%d GB=%d\n", KB, MB, GB)

	// Permission bitmask
	perm := ReadPermission | WritePermission // read + write
	fmt.Printf("Permissions: %b (Read+Write)\n", perm)
	hasRead := perm&ReadPermission != 0
	hasExec := perm&ExecutePermission != 0
	fmt.Printf("Has Read: %v Has Execute: %v\n", hasRead, hasExec)

	// Custom enum with String()
	status := Shipped
	fmt.Printf("Order status: %s (%d)\n", status, status)

	// Untyped constants: flexible
	var f64 float64 = untypedInt // int constant → float64 OK (untyped)
	var i32 int32 = untypedInt   // int constant → int32 OK (untyped)
	fmt.Printf("f64=%v i32=%v\n", f64, i32)

	// Typed constants: strict
	// var f2 float64 = typedInt // compile error! int ≠ float64
	_ = typedInt

	// Untyped float precision
	const VeryLarge = 1e100 // untyped, no overflow at compile time
	// var f float64 = VeryLarge // overflow at runtime assignment
	fmt.Printf("VeryLarge is valid as constant: %v\n", VeryLarge > math.MaxFloat64)

	// Implicit repeat in non-iota group
	const (
		A = "same"
		B                    // B = "same" (implicit repeat)
		C                    // C = "same"
	)
	fmt.Printf("A=%s B=%s C=%s\n", A, B, C)
}
```

## 执行预览

```
Pi: 3.14159265358979
App: GoPlayground
Sunday=0 Friday=5
KB=1024 MB=1048576 GB=1073741824
Permissions: 11 (Read+Write)
Has Read: true Has Execute: false
Order status: Shipped (2)
f64=42 i32=42
VeryLarge is valid as constant: true
A=same B=same C=same
```

---

## 注意事项

| 事项 | 说明 |
|------|------|
| 常量不能取地址 | `&Pi` 编译错误，常量没有内存地址 |
| iota 只在 const 块中有效 | 每个 `const()` 块的 iota 从 0 重新开始 |
| 隐式重复只复制最后一个表达式 | 非 iota 组中，省略的常量复制上一行的值和类型 |
| 无类型常量精度更高 | 无类型常量可以表示任意精度的数值 |
| typed const 有类型约束 | 有类型的常量赋值时必须类型匹配 |
| iota 是行计数器 | 按 const 块中的行号递增，不是按声明数量 |

---

## 避坑指南

**❌ 试图修改常量**
```go
const x = 10
x = 20  // compile error: cannot assign to x
```
**✅ 用变量代替**
```go
x := 10
x = 20  // OK, it's a variable
```

**❌ iota 跨块不连续**
```go
const (
    A = iota // 0
    B        // 1
)
const (
    C = iota // 0 again! not 2
)
```
**✅ 理解每个 const 块独立**
```go
// Each const block has its own iota starting from 0
// Use a single block for continuous values
const (
    A = iota // 0
    B        // 1
    C        // 2
)
```

**❌ 位运算溢出不自知**
```go
const (
    _  = iota
    KB = 1 << (10 * iota) // fine
    MB
    GB
    TB
    PB
    EB
    ZB // overflow on 64-bit! 1 << 70 > max uint64
)
```
**✅ 了解平台限制**
```go
// Stay within platform bit width (usually 64-bit)
// ZB and YB will overflow — don't use them directly as int
```

---

## 练习题

### 🟢 基础

1. 用 `const` 定义一周七天的枚举值（0-6），并打印"今天是周几"。
2. 定义 `Pi = 3.14159`，写程序计算半径为 5 的圆面积。

### 🟡 进阶

3. 用 `iota` 定义文件权限常量（Read=4, Write=2, Execute=1），实现权限组合和检查。
4. 解释以下代码的输出：
```go
const (
    _ = iota
    A
    B
    _
    C
)
fmt.Println(A, B, C)
```

### 🔴 开放

5. 设计一个状态机，用 `iota` 定义所有状态和转换标志。考虑如何用位掩码表示"可从哪些状态转换而来"。

---

## 知识点总结

```
常量与 iota
├── const 声明
│   ├── 单个: const Pi = 3.14
│   ├── 分组: const ( ... )
│   └── 隐式重复: 省略时复制上一行
├── iota 机制
│   ├── 行计数器 (从0开始)
│   ├── 跳值: _ = iota
│   ├── 表达式: 1 << (10 * iota)
│   └── 每个const块独立
├── 常量类型
│   ├── 无类型: 灵活赋值
│   └── 有类型: 严格匹配
└── 高级模式
    ├── 位掩码枚举
    ├── 自定义枚举+String()
    └── 超大数值常量
```

---

## 举一反三

| 概念 | Go | C/Java | 差异 |
|------|-----|--------|------|
| 常量 | `const x = 10` | `#define` / `final` | Go const 必须编译期可确定 |
| 枚举 | `iota` 模式 | `enum` 关键字 | Go 没有 enum 关键字，用 iota 模拟 |
| 位掩码 | `1 << iota` | `1 << 0` 手动 | Go iota 自动递增 |
| 无类型常量 | Go 独有 | C 有隐式转换 | Go 无类型常量更灵活安全 |
| 隐式重复 | Go 独有 | 无 | 减少重复代码 |

---

## 参考资料

- [Go 官方文档 - Constants](https://go.dev/tour/basics/15)
- [Effective Go - Constants](https://go.dev/doc/effective_go#constants)
- [Go 语言规范 - Iota](https://go.dev/ref/spec#Iota)
- [Go by Example - Constants](https://gobyexample.com/constants)

---

## 代码演进

### v1：基础常量

```go
package main

import "fmt"

const Pi = 3.14

func main() {
    fmt.Println("Pi =", Pi)
}
```

### v2：iota 枚举

```go
package main

import "fmt"

const (
    Sunday = iota
    Monday
    Tuesday
)

func main() {
    fmt.Println(Sunday, Monday, Tuesday)
}
```

### v3：完整实践（见上方完整代码）

展示了 const 分组、iota 自增、位掩码、自定义枚举 + String()、无类型常量、隐式重复等完整特性。
