---
title: "009 - 流程控制：switch"
slug: "009-switch"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.668+08:00"
updated_at: "2026-04-29T10:02:44.475+08:00"
reading_time: 13
tags: ["Go基础"]
---

# 009 - 流程控制：switch ⭐⭐

> 难度：⭐⭐ | 预计学习时间：15 分钟

## 一、概念讲解

Go 的 `switch` 比 C/Java 更强大、更安全：
- **默认不穿透**：匹配一个 case 后自动跳出，不需要 `break`
- **case 支持多值**：`case 1, 2, 3:`
- **case 支持表达式**：可以写条件表达式
- **无条件 switch**：可以替代 if-else 链，更清晰
- **type switch**：用于接口类型断言

## 二、实时脑图

```
switch
├── 基本用法
│   ├── switch variable { case ... }
│   └── 默认不穿透 (自动break)
├── 多值 case
│   └── case "a", "b", "c":
├── case 表达式
│   └── case x > 0 && x < 10:
├── fallthrough
│   └── 显式穿透到下一个 case
├── 无条件 switch
│   └── switch { case cond1: ... }
├── type switch
│   └── switch v := i.(type) { }
└── 最佳实践
    ├── 替代长 if-else 链
    └── 枚举值匹配
```

## 三、完整 Go 代码

```go
package main

import (
	"fmt"
	"runtime"
)

func main() {
	// --- 1. Basic switch ---
	fmt.Println("=== Basic switch ===")
	day := "Monday"
	switch day {
	case "Monday":
		fmt.Println("Start of work week")
	case "Friday":
		fmt.Println("TGIF!")
	case "Saturday", "Sunday": // Multiple values
		fmt.Println("Weekend!")
	default:
		fmt.Println("Midweek")
	}

	// --- 2. No automatic fallthrough ---
	fmt.Println("=== No fallthrough ===")
	x := 1
	switch x {
	case 1:
		fmt.Println("one")
		// No break needed, exits automatically
	case 2:
		fmt.Println("two")
	}

	// --- 3. Explicit fallthrough ---
	fmt.Println("=== Fallthrough ===")
	num := 1
	switch num {
	case 1:
		fmt.Println("one")
		fallthrough // MUST be last statement in case
	case 2:
		fmt.Println("two") // This also prints!
		fallthrough
	case 3:
		fmt.Println("three") // This too!
	}

	// --- 4. Case with expressions (condition switch) ---
	fmt.Println("=== Expression switch ===")
	score := 85
	switch {
	case score >= 90:
		fmt.Println("A")
	case score >= 80:
		fmt.Println("B")
	case score >= 70:
		fmt.Println("C")
	default:
		fmt.Println("F")
	}

	// --- 5. Switch with init statement ---
	fmt.Println("=== Init statement ===")
	switch os := runtime.GOOS; os {
	case "linux":
		fmt.Println("Linux")
	case "darwin":
		fmt.Println("macOS")
	case "windows":
		fmt.Println("Windows")
	default:
		fmt.Println("Other:", os)
	}

	// --- 6. Type switch ---
	fmt.Println("=== Type switch ===")
	checkType(42)
	checkType("hello")
	checkType(3.14)
	checkType(true)

	// --- 7. Switch in loop with break ---
	fmt.Println("=== Switch in loop ===")
	for i := 0; i < 5; i++ {
		switch i {
		case 2:
			continue // continues the for loop
		case 4:
			break // breaks the for loop
		}
		fmt.Print(i, " ")
	}
	fmt.Println()
}

func checkType(i interface{}) {
	switch v := i.(type) {
	case int:
		fmt.Printf("int: %d\n", v)
	case string:
		fmt.Printf("string: %s\n", v)
	case float64:
		fmt.Printf("float64: %f\n", v)
	default:
		fmt.Printf("unknown: %T\n", v)
	}
}
```

## 四、执行预览

```
=== Basic switch ===
Start of work week
=== No fallthrough ===
one
=== Fallthrough ===
one
two
three
=== Expression switch ===
B
=== Init statement ===
Linux
=== Type switch ===
int: 42
string: hello
float64: 3.140000
unknown: bool
=== Switch in loop ===
0 1 3
```

## 五、注意事项

| 要点 | 说明 |
|------|------|
| 默认不穿透 | 匹配 case 后自动跳出，无需 `break` |
| fallthrough 必须在末尾 | `fallthrough` 必须是 case 块最后一条语句 |
| fallthrough 无条件穿透 | 不检查下一个 case 条件，直接执行 |
| case 不重复 | 同一个 switch 中 case 值不能重复（编译器检查） |
| type switch 很有用 | 处理 `interface{}` 时必备 |
| case 多值用逗号 | `case 1, 2, 3:` 而非多个 case |

## 六、避坑指南

| ❌ 错误写法 | ✅ 正确写法 | 原因 |
|------------|-----------|------|
| 每个 case 末尾写 `break` | 不需要，自动跳出 | Go 默认不穿透 |
| `fallthrough` 在 case 中间 | `fallthrough` 放在 case 最后 | 编译错误 |
| `switch x; x > 0 {}` | `switch x { case ... }` 或无条件 switch | 语法错误 |
| switch 变量用 float | 用整数或字符串 | 浮点精度问题 |
| 忘写 default | 关键场景加 default | 未匹配时静默跳过 |

## 七、练习题

🟢 **基础题：** 用 switch 实现简单计算器（+、-、*、/），根据运算符执行对应操作。

🟡 **进阶题：** 用无条件 switch 判断年份是否为闰年（能被4整除且不能被100整除，或能被400整除）。

🔴 **挑战题：** 实现 type switch，对 `[]interface{}` 中的元素按类型分组统计（int、string、bool、其他），输出每种类型的个数。

## 八、知识点总结

```
switch 知识树
├── 语法形式
│   ├── switch expr { case val: }
│   ├── switch { case cond: }  (无条件)
│   ├── switch init; expr { }  (初始化)
│   └── switch v := i.(type) { } (类型)
├── case 特性
│   ├── 多值: case 1, 2, 3:
│   ├── 表达式: case x > 10:
│   └── fallthrough (显式穿透)
├── 与其他语言对比
│   ├── Go: 默认不穿透
│   ├── C/Java: 默认穿透
│   └── Go: case 不需常量
└── 应用场景
    ├── 替代 if-else 链
    ├── 枚举值匹配
    └── 接口类型判断
```

## 九、举一反三

| 场景 | 用法 |
|------|------|
| 状态机 | `switch state { case "idle": ... }` |
| 命令分发 | `switch cmd { case "start": ... }` |
| HTTP 路由 | `switch r.Method { case "GET": ... }` |
| 错误分类 | `switch { case errors.Is(err, ErrNotFound): ... }` |
| 日志级别 | `switch level { case "debug": ... }` |
| 接口处理 | `switch v := i.(type) { ... }` |

## 十、参考资料

- [Go 官方文档 - Switch statements](https://go.dev/ref/spec#Switch_statements)
- [Go by Example - Switch](https://gobyexample.com/switch)
- [Effective Go - Switch](https://go.dev/doc/effective_go#switch)

## 十一、代码演进

**v1 — if-else 链：**
```go
if day == "Monday" {
    fmt.Println("Work")
} else if day == "Saturday" || day == "Sunday" {
    fmt.Println("Rest")
} else {
    fmt.Println("Work")
}
```

**v2 — switch 改写：**
```go
switch day {
case "Monday":
    fmt.Println("Work")
case "Saturday", "Sunday":
    fmt.Println("Rest")
default:
    fmt.Println("Work")
}
```

**v3 — 无条件 switch + 函数封装：**
```go
func weekdayType(day string) string {
    switch {
    case day == "Saturday" || day == "Sunday":
        return "weekend"
    case day >= "Monday" && day <= "Friday":
        return "weekday"
    default:
        return "unknown"
    }
}
```
