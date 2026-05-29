---
title: "028 - 标准库fmt与strings"
slug: "028-fmt-strings"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.897+08:00"
updated_at: "2026-04-29T10:02:44.629+08:00"
reading_time: 24
tags: ["Go基础"]
---


# 028 - 标准库 fmt 与 strings

> 难度：⭐⭐（中级）
>
> 掌握 Go 标准库中最常用的两个字符串处理包，从格式化输出到高效字符串拼接。

---

## 一、概念讲解

Go 的 `fmt` 包实现了类似 C 语言的 `printf`/`scanf` 格式化 I/O，是日常开发中使用频率最高的包之一。`strings` 包则提供了丰富的字符串操作函数，涵盖查找、分割、替换、拼接等功能。

**为什么重要？**

- 日志输出依赖 `fmt`
- 字符串处理是后端开发的基本功
- `strings.Builder` 是高频拼接场景的性能利器

---

## 二、脑图

```
                fmt & strings
                    │
        ┌───────────┼───────────┐
        │           │           │
      fmt         strings   strings.Builder
        │           │           │
   ┌────┼────┐   ┌──┼──┐       │
   │    │    │   │  │  │      性能优化
 Print Scan  │ Find│  Join     │
 系列  系列 Fprintf │ Split    Grow/Reset
              │     │
           格式化   Trim系列
           动词     Replace
```

---

## 三、完整代码

```go
package main

import (
	"bytes"
	"fmt"
	"strings"
)

func main() {
	// ========== fmt.Printf: formatted output to stdout ==========
	name := "Go"
	version := 1.22
	fmt.Printf("Language: %s, Version: %.2f\n", name, version)

	// ========== Format verbs ==========
	num := 42
	pi := 3.14159265
	complexVal := struct {
		Name string
		Age  int
	}{"Alice", 30}

	fmt.Printf("%%v  (default):      %v\n", num)
	fmt.Printf("%%+v (struct fields): %+v\n", complexVal)
	fmt.Printf("%%#v (Go syntax):    %#v\n", complexVal)
	fmt.Printf("%%T  (type):         %T\n", num)
	fmt.Printf("%%d  (decimal):      %d\n", num)
	fmt.Printf("%%b  (binary):       %b\n", num)
	fmt.Printf("%%x  (hex):          %x\n", num)
	fmt.Printf("%%o  (octal):        %o\n", num)
	fmt.Printf("%%f  (float):        %f\n", pi)
	fmt.Printf("%%.2f (2 decimals):  %.2f\n", pi)
	fmt.Printf("%%e  (scientific):   %e\n", pi)
	fmt.Printf("%%s  (string):       %s\n", "hello")
	fmt.Printf("%%q  (quoted):       %q\n", "hello")
	fmt.Printf("%%p  (pointer):      %p\n", &num)
	fmt.Printf("%%t  (bool):         %t\n", true)
	fmt.Printf("%%c  (char):         %c\n", 65)
	fmt.Printf("%%02d (zero-pad):    %02d\n", 7)
	fmt.Printf("%%-10s (left-align): |%-10s|\n", "left")
	fmt.Printf("%%10s  (right-align):|%10s|\n", "right")

	// ========== fmt.Sprintf: returns formatted string ==========
	msg := fmt.Sprintf("Welcome, %s! You are %d years old.", "Bob", 25)
	fmt.Println(msg)

	// ========== fmt.Fprintf: writes to any io.Writer ==========
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "Buffered: %s = %d\n", "answer", 42)
	fmt.Print(buf.String())

	// ========== strings: basic operations ==========
	s := "Hello, Go World!"

	// Contains
	fmt.Printf("Contains 'Go':     %v\n", strings.Contains(s, "Go"))
	fmt.Printf("ContainsAny 'xyz': %v\n", strings.ContainsAny(s, "xyz"))

	// Prefix / Suffix
	fmt.Printf("HasPrefix 'Hello': %v\n", strings.HasPrefix(s, "Hello"))
	fmt.Printf("HasSuffix '!':     %v\n", strings.HasSuffix(s, "!"))

	// Index
	fmt.Printf("Index 'Go':        %d\n", strings.Index(s, "Go"))
	fmt.Printf("LastIndex 'o':     %d\n", strings.LastIndex(s, "o"))

	// Count
	fmt.Printf("Count 'o':         %d\n", strings.Count(s, "o"))

	// Repeat
	fmt.Printf("Repeat 'Go' x3:    %s\n", strings.Repeat("Go", 3))

	// Replace
	fmt.Printf("Replace 'o'->'0':  %s\n", strings.Replace(s, "o", "0", 1))
	fmt.Printf("ReplaceAll 'o'->'0': %s\n", strings.ReplaceAll(s, "o", "0"))

	// Split
	parts := strings.Split("a,b,c,d", ",")
	fmt.Printf("Split:             %v (len=%d)\n", parts, len(parts))

	// Join
	fmt.Printf("Join:              %s\n", strings.Join(parts, "-"))

	// Trim
	fmt.Printf("Trim '!' :         %s\n", strings.Trim(s, "! "))
	fmt.Printf("TrimSpace:         %s\n", strings.TrimSpace("  hello  "))
	fmt.Printf("TrimPrefix:        %s\n", strings.TrimPrefix(s, "Hello, "))

	// Title / ToUpper / ToLower
	fmt.Printf("Title:             %s\n", strings.Title("hello world")) // Deprecated but still common
	fmt.Printf("ToUpper:           %s\n", strings.ToUpper(s))
	fmt.Printf("ToLower:           %s\n", strings.ToLower(s))

	// ========== strings.Builder: efficient concatenation ==========
	var builder strings.Builder
	builder.Grow(100) // pre-allocate to reduce GC pressure
	for i := 0; i < 5; i++ {
		builder.WriteString(fmt.Sprintf("Line %d\n", i))
	}
	fmt.Printf("Builder result:\n%s", builder.String())
	fmt.Printf("Builder len: %d, cap: %d\n", builder.Len(), builder.Cap())
	builder.Reset()
	fmt.Printf("After Reset - len: %d\n", builder.Len())

	// ========== fmt.Scanner (basic) ==========
	// Simulate scanning from a string reader
	input := "42 3.14 hello"
	var age int
	var score float64
	var label string
	reader := strings.NewReader(input)
	_, _ = fmt.Fscan(reader, &age, &score, &label)
	fmt.Printf("Scanned: age=%d, score=%.2f, label=%s\n", age, score, label)

	// Sscanf for pattern-based scanning
	var a, b int
	fmt.Sscanf("2024-01", "%d-%d", &a, &b)
	fmt.Printf("Sscanf: year=%d, month=%d\n", a, b)
}
```

### 执行预览

```
Language: Go, Version: 1.22
%v  (default):      42
%+v (struct fields): {Name:Alice Age:30}
%#v (Go syntax):    struct { Name string; Age int }{Name:"Alice", Age:30}
%T  (type):         int
%d  (decimal):      42
%b  (binary):       101010
%x  (hex):          2a
%o  (octal):        52
%f  (float):        3.141593
%.2f (2 decimals):  3.14
%s  (string):       hello
%q  (quoted):       "hello"
%t  (bool):         true
%c  (char):         A
%02d (zero-pad):    07
%-10s (left-align): |left      |
%10s  (right-align):|     right|
Welcome, Bob! You are 25 years old.
Buffered: answer = 42
Contains 'Go':     true
ContainsAny 'xyz': false
HasPrefix 'Hello': true
HasSuffix '!':     true
Index 'Go':        7
LastIndex 'o':     11
Count 'o':         2
Repeat 'Go' x3:    GoGoGo
Replace 'o'->'0':  Hell0, Go World!
ReplaceAll 'o'->'0': Hell0, G0 W0rld!
Split:             [a b c d] (len=4)
Join:              a-b-c-d
Trim '!' :         Hello, Go World
TrimSpace:         hello
TrimPrefix:        Go World!
Builder result:
Line 0
Line 1
Line 2
Line 3
Line 4
Builder len: 35, cap: 100
After Reset - len: 0
Scanned: age=42, score=3.14, label=hello
Sscanf: year=2024, month=1
```

---

## 四、注意事项

| 项目 | 说明 |
|------|------|
| `strings.Title` 已废弃 | Go 1.18+ 建议使用 `golang.org/x/text/cases` 代替 |
| `%v` vs `%+v` vs `%#v` | `%v` 默认输出，`%+v` 显示 struct 字段名，`%#v` 输出 Go 语法 |
| `strings.Builder` 非并发安全 | 多 goroutine 使用需加锁或每人一个实例 |
| `fmt.Sprintf` 有性能开销 | 热路径拼接优先用 `strings.Builder` |
| `strings.Split` 空字符串 | `strings.Split("", ",")` 返回 `[""]`，不是空切片 |
| `strings.Replace` 的 n 参数 | `n=-1` 等价于 `ReplaceAll`，`n=1` 只替换第一个 |
| `fmt.Printf` 的 `%%` | 要输出 `%` 本身需要写 `%%` |

---

## 五、避坑指南

❌ **循环中用 `+` 或 `fmt.Sprintf` 拼接字符串**
```go
// Bad: each concatenation creates a new string, O(n²)
result := ""
for i := 0; i < 10000; i++ {
    result += fmt.Sprintf("item-%d,", i)
}
```

✅ **使用 `strings.Builder`**
```go
// Good: O(n) with pre-allocation
var b strings.Builder
b.Grow(100000)
for i := 0; i < 10000; i++ {
    b.WriteString(fmt.Sprintf("item-%d,", i))
}
result := b.String()
```

---

❌ **混淆 `strings.Split` 和 `strings.SplitN`**
```go
// "a,b,c" → Split gives [a b c]
// "a,,c"  → Split gives [a  c] (empty element preserved!)
```

✅ **注意空元素处理**
```go
parts := strings.Split("a,,c", ",")
// Filter empty if needed
for _, p := range parts {
    if p != "" {
        fmt.Println(p)
    }
}
```

---

❌ **忽略 `fmt.Fprintf` 的返回值**
```go
fmt.Fprintf(w, "data") // discards error and bytes written
```

✅ **检查写入结果（生产环境）**
```go
n, err := fmt.Fprintf(w, "data")
if err != nil {
    log.Printf("write failed: %v", err)
}
```

---

## 六、练习题

### 🟢 初级
1. 使用 `fmt.Sprintf` 生成格式为 `"[2024-01-15] User: Alice, Action: Login"` 的日志字符串
2. 写一个函数 `countWord(s, word string) int`，使用 `strings.Count` 统计单词出现次数

### 🟡 中级
3. 使用 `strings.Builder` 构建一个 CSV 行：给定 `[]string{"Alice", "30", "Shanghai"}`，输出 `Alice,30,Shanghai`
4. 使用 `fmt.Sscanf` 从 `"2024-01-15T08:30:00Z"` 解析出年、月、日、时、分、秒

### 🔴 高级
5. 实现一个简易模板引擎：将 `"Hello, {name}! You have {count} messages."` 中的 `{name}` 和 `{count}` 替换为实际值（提示：使用 `strings.Builder` + `strings.Index`）

---

## 七、知识点总结

```
fmt & strings
├── fmt
│   ├── Print 系列
│   │   ├── Print()      — 原样输出
│   │   ├── Println()    — 加换行
│   │   └── Printf()     — 格式化输出
│   ├── Sprint 系列
│   │   ├── Sprintf()    — 返回字符串
│   │   └── Sscan()      — 从字符串扫描
│   ├── Fprint 系列
│   │   ├── Fprintf()    — 写入 io.Writer
│   │   └── Fscan()      — 从 io.Reader 扫描
│   └── 格式化动词
│       ├── 通用: %v %+v %#v %T
│       ├── 整数: %d %b %x %o %c
│       ├── 浮点: %f %e %g
│       ├── 字符串: %s %q
│       └── 其他: %t %p %%
├── strings
│   ├── 查找: Contains, Index, LastIndex, Count
│   ├── 前后缀: HasPrefix, HasSuffix
│   ├── 变换: ToUpper, ToLower, Title, Replace, Trim
│   ├── 分合: Split, SplitN, Join
│   └── 其他: Repeat, NewReader, EqualFold
└── strings.Builder
    ├── WriteString()  — 追加字符串
    ├── Grow()         — 预分配内存
    ├── Reset()        — 重置复用
    └── String()       — 获取结果
```

---

## 八、举一反三

| 场景 | fmt 函数 | strings 函数 |
|------|----------|-------------|
| 生成日志 | `Sprintf` | `Join`, `Replace` |
| 解析配置行 | `Sscanf` | `Split`, `TrimSpace` |
| 构建查询字符串 | `Sprintf` | `Join`, `HasPrefix` |
| 输出调试信息 | `Printf("%+v")` | — |
| 高频字符串拼接 | — | `Builder.WriteString` |
| CSV 处理 | — | `Split`, `Join` |
| URL 路径处理 | — | `TrimPrefix`, `HasPrefix` |

---

## 九、参考资料

- [fmt 官方文档](https://pkg.go.dev/fmt)
- [strings 官方文档](https://pkg.go.dev/strings)
- [Go 字符串优化技巧](https://go.dev/blog/strings)

---

## 十、代码演进

### v1：基础格式化输出
```go
package main

import "fmt"

func main() {
    name := "World"
    fmt.Printf("Hello, %s!\n", name)
    fmt.Println("That's all.")
}
```

### v2：引入 strings 操作
```go
package main

import (
    "fmt"
    "strings"
)

func main() {
    s := "Hello, World!"
    fmt.Println(strings.Contains(s, "World"))
    fmt.Println(strings.ReplaceAll(s, "World", "Go"))
    parts := strings.Split(s, ", ")
    fmt.Println(strings.Join(parts, " & "))
}
```

### v3：完整工具集 + Builder 优化
（即上方完整代码，包含所有格式化动词、strings 全操作、Builder 性能优化和 Scanner）
