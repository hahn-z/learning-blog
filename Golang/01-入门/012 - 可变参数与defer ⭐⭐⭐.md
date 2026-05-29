---
title: "012 - 可变参数与defer ⭐⭐⭐"
slug: "012-variadic-defer"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.71+08:00"
updated_at: "2026-04-29T10:02:44.498+08:00"
reading_time: 21
tags: ["Go基础"]
---

# 012 - 可变参数与 defer ⭐⭐⭐

## 难度标注

> ⭐⭐⭐ 中高难度 | 适合：已掌握函数基础，需要理解 Go 高级函数特性的开发者

## 概念讲解

可变参数和 defer 是 Go 函数中两个重要的高级特性。可变参数让函数能接受任意数量的参数；defer 则提供了优雅的资源管理和清理机制。但这两个特性都有微妙的陷阱，需要深入理解。

**核心要点：**

- **可变参数 `...T`**：函数接受零个或多个参数，在函数内部表现为 slice
- **slice 展开 `slice...`**：将 slice 传递给可变参数函数
- **defer 执行顺序**：LIFO（后进先出），像栈一样
- **defer 闭包陷阱**：defer 捕获变量的引用，不是值
- **defer 与 return 交互**：defer 可以修改命名返回值
- **实战应用**：资源释放、计时、日志

## 实时脑图

```
可变参数与 defer
├── 可变参数 ...T
│   ├── 定义: func sum(nums ...int)
│   ├── 内部类型: []int slice
│   ├── 空调用: sum() → 空slice
│   ├── 展开传递: sum(slice...)
│   └── 与固定参数混用: func f(s string, nums ...int)
├── defer 执行顺序
│   ├── LIFO: 后注册先执行
│   ├── 场景: 文件关闭、解锁、日志
│   └── 注册时机: defer语句执行时确定参数
├── defer 闭包陷阱
│   ├── 捕获引用: loop var 被所有 defer 共享
│   ├── 解决: 参数传递 defer fmt.Println(v)
│   └── Go 1.22+ loop var 每次迭代新变量
├── defer 与 return 交互
│   ├── 执行顺序: return → defer → 返回
│   ├── 命名返回值可被 defer 修改
│   └── 匿名返回值 defer 无法修改
└── 实战
    ├── 资源释放: defer file.Close()
    ├── 计时: defer 记录耗时
    └── recover: defer recover() 捕获 panic
```

## 完整 Go 代码

### v1：可变参数基础

```go
package main

import "fmt"

// Variadic parameter: nums becomes []int inside the function
func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

// Variadic with fixed parameters: fixed params come first
func formatList(sep string, items ...string) string {
	if len(items) == 0 {
		return ""
	}
	result := items[0]
	for _, item := range items[1:] {
		result += sep + item
	}
	return result
}

// Pass a slice to variadic function using spread operator
func main() {
	// Direct arguments
	fmt.Println("sum(1,2,3):", sum(1, 2, 3))
	fmt.Println("sum():", sum()) // empty slice

	// Spread a slice
	numbers := []int{10, 20, 30, 40}
	fmt.Println("sum(numbers...):", sum(numbers...))

	// Mixed fixed + variadic
	fmt.Println(formatList(", ", "apple", "banana", "cherry"))
	fmt.Println(formatList(" | ")) // empty items

	// Modify the variadic slice? It's a copy if spread from slice
	// but be careful: it may share underlying array
	original := []int{1, 2, 3}
	_ = sum(original...)
	fmt.Println("original after spread:", original)
}
```

**执行预览：**
```
sum(1,2,3): 6
sum(): 0
sum(numbers...): 100
apple, banana, cherry

original after spread: [1 2 3]
```

### v2：defer 执行顺序与闭包陷阱

```go
package main

import "fmt"

// LIFO order: last deferred is executed first
func demoLIFO() {
	defer fmt.Println("defer 1")
	defer fmt.Println("defer 2")
	defer fmt.Println("defer 3")
	fmt.Println("function body")
}

// Closure trap: defer captures variable reference
func closureTrap() {
	for i := 0; i < 3; i++ {
		defer func() {
			fmt.Println("closure trap:", i)
		}()
	}
}

// Fix 1: pass as defer parameter (evaluated at defer statement time)
func closureFix1() {
	for i := 0; i < 3; i++ {
		defer func(val int) {
			fmt.Println("fix1 param:", val)
		}(i)
	}
}

// Fix 2: create new variable per iteration
func closureFix2() {
	for i := 0; i < 3; i++ {
		i := i // shadow: new variable per iteration
		defer func() {
			fmt.Println("fix2 shadow:", i)
		}()
	}
}

func main() {
	fmt.Println("=== LIFO Demo ===")
	demoLIFO()

	fmt.Println("\n=== Closure Trap ===")
	closureTrap() // prints 3, 3, 3!

	fmt.Println("\n=== Fix 1: Parameter ===")
	closureFix1() // prints 2, 1, 0

	fmt.Println("\n=== Fix 2: Shadow ===")
	closureFix2() // prints 2, 1, 0
}
```

**执行预览：**
```
=== LIFO Demo ===
function body
defer 3
defer 2
defer 1

=== Closure Trap ===
closure trap: 3
closure trap: 3
closure trap: 3

=== Fix 1: Parameter ===
fix1 param: 2
fix1 param: 1
fix1 param: 0

=== Fix 2: Shadow ===
fix2 shadow: 2
fix2 shadow: 1
fix2 shadow: 0
```

### v3：defer 与 return 交互 + 实战模式

```go
package main

import (
	"fmt"
	"time"
)

// Defer can modify named return values!
func deferModifyReturn() (result int) {
	defer func() {
		result++ // modifies the named return!
	}()
	return 10 // sets result=10, then defer runs: result becomes 11
}

// Anonymous return: defer CANNOT modify
func deferCannotModify() int {
	result := 10
	defer func() {
		result++ // this modifies local variable, not the return value!
	}()
	return result // return value is already determined as 10
}

// Practical: timing a function
func timedOperation() (elapsed time.Duration) {
	start := time.Now()
	defer func() {
		elapsed = time.Since(start)
	}()

	// Simulate work
	time.Sleep(100 * time.Millisecond)
	return
}

// Practical: resource cleanup simulation
func processFile(filename string) (err error) {
	fmt.Printf("opening %s\n", filename)
	defer func() {
		if err != nil {
			fmt.Printf("closing %s (with error: %v)\n", filename, err)
		} else {
			fmt.Printf("closing %s (success)\n", filename)
		}
	}()

	if filename == "bad.txt" {
		err = fmt.Errorf("file not found: %s", filename)
		return
	}

	fmt.Printf("processing %s\n", filename)
	return nil
}

// Practical: recover from panic
func safeDivide(a, b int) (result int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic recovered: %v", r)
		}
	}()
	result = a / b // panics if b == 0
	return result, nil
}

func main() {
	// --- Defer modifies named return ---
	fmt.Println("deferModifyReturn:", deferModifyReturn()) // 11
	fmt.Println("deferCannotModify:", deferCannotModify()) // 10

	// --- Timing ---
	elapsed := timedOperation()
	fmt.Printf("operation took: %v\n", elapsed)

	// --- Resource cleanup ---
	fmt.Println("\n--- processFile ---")
	processFile("good.txt")
	processFile("bad.txt")

	// --- Recover from panic ---
	fmt.Println("\n--- safeDivide ---")
	r, err := safeDivide(10, 2)
	fmt.Printf("10/2 = %d, err=%v\n", r, err)

	r, err = safeDivide(10, 0)
	fmt.Printf("10/0 = %d, err=%v\n", r, err)
}
```

**执行预览：**
```
deferModifyReturn: 11
deferCannotModify: 10
operation took: 100.x ms

--- processFile ---
opening good.txt
processing good.txt
closing good.txt (success)
opening bad.txt
closing bad.txt (with error: file not found: bad.txt)

--- safeDivide ---
10/2 = 5, err=<nil>
10/0 = 0, err=panic recovered: runtime error: integer divide by zero
```

## 注意事项

| 项目 | 说明 |
|------|------|
| 可变参数位置 | 只能放在参数列表**最后**，且只能有一个 |
| 可变参数类型 | 内部是 slice，`nil` 也是合法的 |
| defer 参数求值 | defer 语句的参数在**声明时**求值，不是执行时 |
| defer 与 return | 执行顺序：赋值返回值 → 执行 defer → 函数返回 |
| 命名 vs 匿名 | defer 只能修改**命名返回值**，匿名返回值无法修改 |
| defer 性能 | defer 有微小开销，热路径慎用（Go 1.14+ 已大幅优化） |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 | 说明 |
|------------|-----------|------|
| defer 在循环中忘记闭包陷阱 | `defer func(v int) { }(i)` 或 `i := i` | 循环变量被共享 |
| defer 修改匿名返回值期望生效 | 使用命名返回值 | 匿名返回值 defer 无法修改 |
| `defer f.Close()` 不检查错误 | `defer func() { _ = f.Close() }()` | 生产环境应处理关闭错误 |
| 可变参数直接传 slice | 使用 `slice...` 展开 | 类型不匹配会编译错误 |
| 在 defer 中做复杂业务逻辑 | defer 只做清理（释放、日志） | defer 应保持简单 |

## 练习题

### 🟢 入门：可变参数最大值
编写 `max(nums ...int) int`，返回所有参数中的最大值。

```go
func max(nums ...int) int {
    if len(nums) == 0 {
        return 0
    }
    m := nums[0]
    for _, n := range nums[1:] {
        if n > m { m = n }
    }
    return m
}
```

### 🟡 进阶：defer 追踪
编写函数 `trace(name string)`，利用 defer 打印函数进入和退出。

```go
func trace(name string) {
    fmt.Println("entering:", name)
    defer fmt.Println("leaving:", name)
}

func myFunc() {
    trace("myFunc")
    fmt.Println("doing work")
}
```

### 🔴 挑战：defer 实现计时包装器
编写 `measureTime(name string) func()`，返回一个函数，调用时记录开始时间，defer 调用返回的函数打印耗时。

```go
func measureTime(name string) func() {
    start := time.Now()
    return func() {
        fmt.Printf("%s took %v\n", name, time.Since(start))
    }
}

// Usage:
func myTask() {
    defer measureTime("myTask")()
    time.Sleep(50 * time.Millisecond)
}
```

## 知识点总结

```
可变参数与 defer
├── 可变参数
│   ├── ...T 语法
│   ├── 内部为 slice
│   ├── 展开 slice...
│   └── 混合固定参数
├── defer 执行模型
│   ├── LIFO 顺序
│   ├── 参数立即求值
│   ├── return → defer → 返回
│   └── 可修改命名返回值
├── 闭包陷阱
│   ├── 循环变量共享
│   ├── 参数传递解决
│   └── 变量 shadow 解决
└── 实战模式
    ├── 资源释放
    ├── 函数计时
    ├── panic recover
    └── 日志追踪
```

## 举一反三

| Go 特性 | 其他语言等价 | 说明 |
|---------|-------------|------|
| `...T` 可变参数 | Python `*args`, JS `...args` | 语法类似，Go 更严格 |
| `slice...` 展开 | Python `func(*list)`, JS `func(...arr)` | 将集合展开为参数 |
| `defer` | Python `with`, C# `using`, C++ RAII | 资源管理，Go 用 defer |
| `defer` LIFO | C++ 析构函数（反构造顺序） | 类似的栈式清理 |
| `recover()` | Python `except`, Java `catch` | Go 用 recover 捕获 panic |

## 参考资料

- [Effective Go - Defer](https://go.dev/doc/effective_go#defer)
- [Go by Example - Variadic Functions](https://gobyexample.com/variadic-functions)
- [Go by Example - Defer](https://gobyexample.com/defer)
- [Go 1.14 defer 优化](https://go.dev/doc/go1.14#runtime)

## 代码演进总结

```
v1 → 可变参数基础：...T、展开slice、混合参数
v2 → defer LIFO + 闭包陷阱：引用捕获、参数传递修复
v3 → defer 与 return 交互 + 实战：命名返回值修改、计时、资源清理、recover
```
