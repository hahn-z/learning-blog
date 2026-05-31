---
title: "007 - 流程控制：if-else"
slug: "007-if-else"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.635+08:00"
updated_at: "2026-04-29T10:02:44.461+08:00"
reading_time: 9
tags: ["Go基础"]
---

# 007 - 流程控制：if-else ⭐⭐

> 难度：⭐⭐ | 预计学习时间：15 分钟

## 一、概念讲解

Go 语言的 `if-else` 是最基本的流程控制语句，用于根据条件执行不同的代码分支。

与 C/Java 不同的是：
- **条件表达式不需要括号**（写括号也不报错，但不推荐）
- **大括号必须写**，且 `{` 必须和 `if` 在同一行
- 支持 **初始化语句**（这是 Go 的特色）

## 二、实时脑图

```
if-else
├── 基本用法
│   ├── if 单分支
│   ├── if-else 双分支
│   └── if-else if-else 多分支
├── 初始化语句 (Go特色)
│   └── if err := doSomething(); err != nil
├── 嵌套 if
│   └── 可读性差，应避免
└── 最佳实践
    ├── 早返回 (guard clause)
    └── 避免深层嵌套
```

## 三、完整 Go 代码

```go
package main

import (
	"fmt"
	"math/rand"
	"errors"
)

func main() {
	// --- 1. Basic if ---
	score := 85
	if score >= 90 {
		fmt.Println("Excellent!")
	} else if score >= 80 {
		fmt.Println("Good!")
	} else if score >= 60 {
		fmt.Println("Pass")
	} else {
		fmt.Println("Fail")
	}

	// --- 2. Init statement (Go specialty) ---
	// Variable 'n' is only visible inside if-else block
	if n := rand.Intn(100); n%2 == 0 {
		fmt.Printf("%d is even\n", n)
	} else {
		fmt.Printf("%d is odd\n", n)
	}
	// fmt.Println(n) // ERROR: n is undefined here

	// --- 3. Multiple conditions with logical operators ---
	age, hasTicket := 20, true
	if age >= 18 && hasTicket {
		fmt.Println("Welcome to the show!")
	}

	// --- 4. Nested if (avoid this style) ---
	x := 15
	if x > 0 {
		if x%2 == 0 {
			fmt.Println("Positive even")
		} else {
			fmt.Println("Positive odd")
		}
	}

	// --- 5. Guard clause pattern (preferred) ---
	val := -5
	if val < 0 {
		fmt.Println("Negative, early return style")
		return
	}
	fmt.Println("This won't print")

	// --- 6. Init statement with error checking ---
	if err := doSomething(); err != nil {
		fmt.Println("Error:", err)
	}
}

func doSomething() error {
	return errors.New("something went wrong")
}
```

## 四、执行预览

```
Good!
15 is odd
Welcome to the show!
Positive odd
Negative, early return style
```

## 五、注意事项

| 要点 | 说明 |
|------|------|
| 条件不加括号 | `if x > 0` ✅，`if (x > 0)` 不推荐但能编译 |
| 大括号必须 | `if x > 0 fmt.Println()` ❌ 编译错误 |
| 左大括号同行 | `{` 必须跟在 `if`/`else` 后面，不能换行 |
| 初始化语句作用域 | `if x := 1; x > 0` 中 `x` 仅在 if-else 块内可见 |
| 条件必须是布尔值 | Go 不接受整数作为条件，`if 1` ❌ |

## 六、避坑指南

| ❌ 错误写法 | ✅ 正确写法 | 原因 |
|------------|-----------|------|
| `if (x > 0) {` | `if x > 0 {` | 括号多余 |
| `if x > 0\n{` | `if x > 0 {` | 左大括号必须同行 |
| `if 1 {` | `if true {` | 条件必须是 bool |
| 嵌套 4 层 if | 用 guard clause 早返回 | 可读性 |
| 初始化变量在 if 外使用 | 提前声明或重新获取 | 作用域限制 |

## 七、练习题

🟢 **基础题：** 写一个程序，判断一个整数是正数、负数还是零。

🟡 **进阶题：** 使用 if 初始化语句，生成随机数并判断是否是 3 的倍数，如果是同时判断是否也是 5 的倍数。

🔴 **挑战题：** 实现一个简单的 BMI 计算器（身高 m，体重 kg），根据 BMI 值输出：偏瘦(<18.5)、正常(18.5-24)、偏胖(24-28)、肥胖(>=28)。使用 guard clause 风格。

## 八、知识点总结

```
if-else 知识树
├── 语法
│   ├── if condition { }
│   ├── if-else { }
│   └── if-else if-else { }
├── 初始化语句
│   └── if stmt; condition { }
│       └── 变量仅在块内可见
├── 条件运算符
│   ├── && (AND)
│   ├── || (OR)
│   └── ! (NOT)
└── 最佳实践
    ├── Guard clause（早返回）
    └── 嵌套不超过 2-3 层
```

## 九、举一反三

| 场景 | 用法 |
|------|------|
| 错误处理 | `if err != nil { return err }` |
| nil 检查 | `if ptr == nil { ... }` |
| map 键存在 | `if v, ok := m[key]; ok { ... }` |
| 类型断言 | `if s, ok := i.(string); ok { ... }` |
| 通道读取 | `if v, ok := <-ch; ok { ... }` |

## 十、参考资料

- [Go 官方文档 - Effective Go - Control structures](https://go.dev/doc/effective_go#control-structures)
- [Go by Example - If/Else](https://gobyexample.com/if-else)

## 十一、代码演进

**v1 — 基础版：**
```go
if score >= 90 {
    fmt.Println("A")
} else if score >= 80 {
    fmt.Println("B")
} else {
    fmt.Println("C")
}
```

**v2 — 加入初始化语句：**
```go
if score := getScore(); score >= 90 {
    fmt.Println("A")
} else if score >= 80 {
    fmt.Println("B")
} else {
    fmt.Println("C")
}
```

**v3 — 提取函数，用 map 替代长 if-else 链：**
```go
func grade(score int) string {
    switch {
    case score >= 90:
        return "A"
    case score >= 80:
        return "B"
    default:
        return "C"
    }
}
```
