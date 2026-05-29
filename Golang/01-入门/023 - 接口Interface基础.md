---
title: "023 - 接口Interface基础"
slug: "023-interface-basics"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.834+08:00"
updated_at: "2026-04-29T10:02:44.592+08:00"
reading_time: 23
tags: ["Go基础"]
---

# 023 - 接口 Interface 基础

> 难度：⭐⭐⭐⭐ | 预计阅读：18分钟

## 一、概念讲解

接口是 Go 实现**多态**的核心机制。与 Java/C# 的 `implements` 不同，Go 接口是**隐式实现**的——只要类型拥有接口要求的所有方法，它就自动满足该接口。

这就是所谓的**鸭子类型（Duck Typing）**：如果它走起来像鸭子、叫起来像鸭子，那它就是鸭子。

```go
type Speaker interface {
    Speak() string
}
// 任何有 Speak() string 方法的类型，都自动是 Speaker
```

接口值内部由两部分组成：**（类型，值）**。这称为接口的**动态类型**和**动态值**。

## 二、脑图

```
Interface（接口）
├── 基础定义
│   ├── type Name interface { MethodSignatures }
│   └── 隐式实现（无需 implements 关键字）
├── 接口值内部结构
│   ├── 动态类型（type）
│   └── 动态值（value）
├── nil 接口陷阱
│   ├── nil 接口（type=nil, value=nil）
│   └── 非nil接口持有nil值（type!=nil, value=nil）
├── 空接口
│   ├── interface{} / any
│   └── 可接受任意类型的值
├── 类型断言
│   ├── v, ok := i.(T)
│   └── panic 模式：v := i.(T)
├── 接口组合
│   ├── type ReadWriter interface { Reader; Writer }
│   └── 接口嵌入接口
└── io.Reader / io.Writer 实战
    ├── Reader: Read(p []byte) (n int, err error)
    └── Writer: Write(p []byte) (n int, err error)
```

## 三、完整 Go 代码

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"strings"
)

// ---------- 1. Interface Definition & Implicit Implementation ----------

type Shape interface {
	Area() float64
	Perimeter() float64
}

type Circle struct {
	Radius float64
}

// Circle implicitly implements Shape — no "implements" keyword needed
func (c Circle) Area() float64 {
	return math.Pi * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
	return 2 * math.Pi * c.Radius
}

type Rectangle struct {
	Width, Height float64
}

func (r Rectangle) Area() float64 {
	return r.Width * r.Height
}

func (r Rectangle) Perimeter() float64 {
	return 2 * (r.Width + r.Height)
}

// Polymorphism: accepts any Shape
func PrintShapeInfo(s Shape) {
	fmt.Printf("  Area: %.2f, Perimeter: %.2f\n", s.Area(), s.Perimeter())
}

// ---------- 2. Interface Value Internals ----------

func inspectInterface(i interface{}) {
	fmt.Printf("  Value: %v, Type: %T\n", i, i)
}

// ---------- 3. nil Interface Trap ----------

type MyError struct {
	Msg string
}

func (e *MyError) Error() string {
	if e == nil {
		return "nil error" // handle nil receiver gracefully
	}
	return e.Msg
}

func getError() error {
	// DANGER: returns a non-nil interface holding a nil *MyError
	var err *MyError = nil
	return err // interface{type=*MyError, value=nil} — NOT nil!
}

func getErrorFixed() error {
	var err *MyError = nil
	if err == nil {
		return nil // returns a truly nil interface
	}
	return err
}

// ---------- 4. Type Assertions ----------

func describeAnimal(a interface{}) {
	// Safe type assertion with comma-ok pattern
	if dog, ok := a.(string); ok {
		fmt.Printf("  It's a string: %s\n", dog)
		return
	}
	if num, ok := a.(int); ok {
		fmt.Printf("  It's an int: %d\n", num)
		return
	}
	fmt.Printf("  Unknown type: %T\n", a)
}

// ---------- 5. Interface Composition ----------

type Reader interface {
	Read(p []byte) (n int, err error)
}

type Writer interface {
	Write(p []byte) (n int, err error)
}

// Composed interface: must implement both Reader and Writer
type ReadWriter interface {
	Reader
	Writer
}

// ---------- 6. io.Reader / io.Writer in Practice ----------

// A simple type that implements io.Writer to collect output
type LogWriter struct {
	Lines []string
}

func (lw *LogWriter) Write(p []byte) (n int, err error) {
	lw.Lines = append(lw.Lines, string(p))
	return len(p), nil
}

// A type that implements io.Reader from a string
type StringReader struct {
	src string
	pos int
}

func (sr *StringReader) Read(p []byte) (n int, err error) {
	if sr.pos >= len(sr.src) {
		return 0, io.EOF
	}
	n = copy(p, sr.src[sr.pos:])
	sr.pos += n
	return n, nil
}

// ---------- main ----------

func main() {
	fmt.Println("=== 1. Polymorphism with Shape Interface ===")
	shapes := []Shape{
		Circle{Radius: 5},
		Rectangle{Width: 3, Height: 4},
	}
	for _, s := range shapes {
		fmt.Printf("%T:\n", s)
		PrintShapeInfo(s)
	}

	fmt.Println("\n=== 2. Interface Value Internals ===")
	var i interface{}
	inspectInterface(i) // nil
	i = 42
	inspectInterface(i) // int
	i = "hello"
	inspectInterface(i) // string
	i = Circle{Radius: 1}
	inspectInterface(i) // Circle

	fmt.Println("\n=== 3. nil Interface Trap ===")
	err := getError()
	fmt.Printf("  getError() == nil? %v (type: %T)\n", err == nil, err)
	fmt.Printf("  This is a classic Go gotcha!\n")

	fixed := getErrorFixed()
	fmt.Printf("  getErrorFixed() == nil? %v\n", fixed == nil)

	fmt.Println("\n=== 4. Type Assertions ===")
	describeAnimal("Golden Retriever")
	describeAnimal(42)
	describeAnimal(3.14)

	fmt.Println("\n=== 5. Interface Composition ===")
	var rw ReadWriter = &struct {
		*bytes.Buffer
	}{Buffer: bytes.NewBuffer(nil)}
	rw.Write([]byte("composed!"))
	buf := make([]byte, 100)
	n, _ := rw.Read(buf)
	fmt.Printf("  ReadWriter read: %q\n", string(buf[:n]))

	fmt.Println("\n=== 6. io.Reader/io.Writer Practice ===")
	// Use StringReader
	sr := &StringReader{src: "Hello, Go interfaces!"}
	buf2 := make([]byte, 100)
	n2, err2 := sr.Read(buf2)
	fmt.Printf("  Read %d bytes: %q, err: %v\n", n2, string(buf2[:n2]), err2)

	// Use LogWriter
	lw := &LogWriter{}
	fmt.Fprintf(lw, "log entry %d", 1)
	fmt.Fprintf(lw, "another entry")
	fmt.Printf("  LogWriter collected: %v\n", lw.Lines)

	// Use io.Copy to connect reader and writer
	src := strings.NewReader("data to transfer")
	dst := &bytes.Buffer{}
	written, _ := io.Copy(dst, src)
	fmt.Printf("  io.Copy: %d bytes, content: %q\n", written, dst.String())

	// Multiple interfaces on one type
	fmt.Println("\n=== Bonus: Empty Interface & any ===")
	items := []any{42, "str", true, Circle{Radius: 2}}
	for _, item := range items {
		fmt.Printf("  %v (%T)\n", item, item)
	}
}
```

## 四、执行预览

```
=== 1. Polymorphism with Shape Interface ===
main.Circle:
  Area: 78.54, Perimeter: 31.42
main.Rectangle:
  Area: 12.00, Perimeter: 14.00

=== 2. Interface Value Internals ===
  Value: <nil>, Type: <nil>
  Value: 42, Type: int
  Value: hello, Type: string
  Value: {Radius:1}, Type: main.Circle

=== 3. nil Interface Trap ===
  getError() == nil? false (type: *main.MyError)
  This is a classic Go gotcha!
  getErrorFixed() == nil? true

=== 4. Type Assertions ===
  It's a string: Golden Retriever
  It's an int: 42
  Unknown type: float64

=== 5. Interface Composition ===
  ReadWriter read: "composed!"

=== 6. io.Reader/io.Writer Practice ===
  Read 20 bytes: "Hello, Go interfaces!", err: <nil>
  LogWriter collected: [log entry 1 another entry]
  io.Copy: 15 bytes, content: "data to transfer"

=== Bonus: Empty Interface & any ===
  42 (int)
  str (string)
  true (bool)
  {Radius:2} (main.Circle)
```

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 隐式实现 | 不需要 `implements` 关键字，编译器自动检查 |
| 接口值 = (type, value) | 理解内部结构是避免 bug 的关键 |
| nil 接口 ≠ 持有 nil 值的接口 | `var e error = (*MyError)(nil)` → e != nil |
| 空接口 any | 可以接受任何值，但丢失类型安全 |
| 类型断言安全模式 | 始终用 `v, ok := i.(T)` 避免 panic |
| 接口组合 | Go 风格是组合小接口，不建大接口 |
| 方法集 | 赋值给接口时，T 和 *T 的方法集不同 |

## 六、避坑指南

❌ **返回具体类型的 nil 指针当作接口 nil**
```go
func getErr() error {
    var err *MyError = nil
    return err // NOT nil interface!
}
```
✅ 显式返回 nil
```go
func getErr() error {
    return nil // truly nil interface
}
```

❌ **不检查类型断言直接用**
```go
val := i.(string) // panics if i is not a string!
```
✅ 使用 comma-ok 模式
```go
val, ok := i.(string)
if !ok { /* handle */ }
```

❌ **用空接口代替泛型（Go 1.18 前）**
```go
func Add(a, b interface{}) interface{} {
    return a.(int) + b.(int) // panics for non-int
}
```
✅ Go 1.18+ 用泛型
```go
func Add[T int | float64](a, b T) T {
    return a + b
}
```

## 七、练习题

🟢 **基础题：Stringer 接口**
定义 `type Temperature float64`，实现 `fmt.Stringer` 接口，输出格式如 `"25.5°C"`。分别用 `fmt.Println` 和 `fmt.Sprintf` 测试。

🟡 **进阶题：自定义 Writer**
实现一个 `CountingWriter`，包装 `io.Writer`，记录总共写入了多少字节。提示：返回 `*int64` 让调用者可以读取计数。

🔴 **挑战题：nil 接口陷阱实战**
写一个函数 `process(data []byte) error`，在 data 为空时返回 `fmt.Errorf("empty")`，否则返回 nil。然后写测试验证 `process(nil) == nil` 是否为 true，解释原因。

## 八、知识点总结

```
Go Interface（接口）
├── 定义与实现
│   ├── type I interface { Method() }
│   ├── 隐式实现（鸭子类型）
│   └── 接口变量 = (动态类型, 动态值)
├── 核心陷阱
│   ├── nil 接口 vs 持有 nil 的接口
│   └── 接口比较：两者都 nil 才 == nil
├── 类型操作
│   ├── 类型断言 v.(T)
│   ├── 类型选择 switch v := i.(type)
│   └── 空接口 any / interface{}
├── 组合模式
│   ├── 接口嵌入接口
│   └── io.Reader + io.Writer → io.ReadWriter
└── 标准库接口
    ├── fmt.Stringer
    ├── error
    ├── io.Reader / io.Writer
    └── sort.Interface
```

## 九、举一反三

| 语言 | 类似概念 | 差异 |
|------|---------|------|
| Java | interface + implements | Java 需要显式声明实现 |
| Python |鸭子类型 / ABC | Python 无需接口定义即可多态 |
| Rust | trait | Rust trait 类似 Go 接口但可有关联类型 |
| TypeScript | interface | TS 的 interface 是纯类型层面的 |
| C++ | 纯虚函数 / 抽象类 | C++ 用继承实现多态 |

## 十、参考资料

- [Go 官方教程 - Interfaces](https://go.dev/tour/methods/9)
- [Effective Go - Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Go FAQ - nil interface](https://go.dev/doc/faq#nil_error)
- [Go by Example - Interfaces](https://gobyexample.com/interfaces)

## 十一、代码演进

**v1：基础接口定义与多态**
```go
type Speaker interface { Speak() string }
type Dog struct{}
func (d Dog) Speak() string { return "Woof" }
```

**v2：加入类型断言和空接口**
```go
func describe(i any) {
    if s, ok := i.(string); ok {
        fmt.Println("string:", s)
    }
}
```

**v3：接口组合 + io 标准库实战**
```go
type ReadWriter interface { io.Reader; io.Writer }
// 使用 io.Copy 连接 Reader 和 Writer
io.Copy(dst, src)
```
