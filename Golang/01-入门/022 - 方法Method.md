---
title: "022 - 方法Method"
slug: "022-methods"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.817+08:00"
updated_at: "2026-04-29T10:02:44.584+08:00"
reading_time: 20
tags: ["Go基础"]
---

# 022 - 方法 Method

> 难度：⭐⭐⭐ | 预计阅读：15分钟

## 一、概念讲解

Go 的**方法（Method）**就是带**接收者（Receiver）**的函数。接收者出现在 `func` 和方法名之间，把函数"绑定"到特定类型上。

```go
func (p Person) SayHi() string {
    return "Hi, I'm " + p.Name
}
```

核心要点：

- 接收者本质上就是第一个参数，Go 把它放在了前面
- **值接收者**：操作副本，不影响原始值
- **指针接收者**：操作原始值，可以修改
- 方法必须定义在**同一个包**内

## 二、脑图

```
Method（方法）
├── 方法定义
│   ├── 值接收者 (v T)        ← 操作副本
│   └── 指针接收者 (v *T)     ← 操作原件
├── 方法集规则
│   ├── T  → 值接收者方法 ✓
│   ├── T  → 指针接收者方法 ✓（自动取地址）
│   ├── *T → 值接收者方法 ✓（自动解引用）
│   └── *T → 指针接收者方法 ✓
├── 方法值 vs 方法表达式
│   ├── 方法值：p.SayHi   ← 绑定了接收者
│   └── 方法表达式：Person.SayHi ← 需手动传接收者
├── 嵌入与方法提升
│   └── 内嵌字段的方法自动"提升"到外层类型
└── Stringer 接口
    └── String() string ← fmt.Println 自动调用
```

## 三、完整 Go 代码

```go
package main

import (
	"fmt"
	"math"
	"strings"
)

// ---------- 1. Value Receiver vs Pointer Receiver ----------

type Point struct {
	X, Y float64
}

// Value receiver: does NOT modify the original
func (p Point) Distance() float64 {
	return math.Sqrt(p.X*p.X + p.Y*p.Y)
}

// Pointer receiver: CAN modify the original
func (p *Point) Scale(factor float64) {
	p.X *= factor
	p.Y *= factor
}

// ---------- 2. Method Value & Method Expression ----------

type Person struct {
	Name string
	Age  int
}

// A simple method with value receiver
func (p Person) Greet() string {
	return fmt.Sprintf("Hello, I'm %s, age %d", p.Name, p.Age)
}

// Birthday uses pointer receiver to mutate state
func (p *Person) Birthday() {
	p.Age++
}

// ---------- 3. Embedding & Method Promotion ----------

type Animal struct {
	Name string
}

func (a Animal) Speak() string {
	return a.Name + " makes a sound"
}

type Dog struct {
	Animal // embedded struct — methods are promoted
	Breed  string
}

// Dog's own method overrides the promoted one if names match
func (d Dog) Speak() string {
	return d.Name + " barks!"
}

// ---------- 4. Stringer Interface (fmt.Stringer) ----------

type Money struct {
	Amount   float64
	Currency string
}

// Implement fmt.Stringer for pretty printing
func (m Money) String() string {
	return fmt.Sprintf("%.2f %s", m.Amount, m.Currency)
}

// ---------- 5. When to Use Pointer Receiver ----------

type Counter struct {
	count int
}

// Must use pointer receiver — we need to mutate state
func (c *Counter) Inc() {
	c.count++
}

func (c *Counter) Get() int {
	return c.count
}

// ---------- main ----------

func main() {
	fmt.Println("=== Value vs Pointer Receiver ===")
	p := Point{3, 4}
	fmt.Printf("Original: %+v, Distance: %.2f\n", p, p.Distance())

	p.Scale(2) // Go auto takes address: (&p).Scale(2)
	fmt.Printf("After Scale(2): %+v\n", p)

	fmt.Println()
	fmt.Println("=== Method Value & Expression ===")
	alice := Person{"Alice", 30}

	// Method value: bound to alice
	greet := alice.Greet // a closure over alice
	fmt.Println("Method value:", greet())

	// Method expression: unbound, must pass receiver explicitly
	greetExpr := Person.Greet
	fmt.Println("Method expression:", greetExpr(alice))

	// Pointer receiver via method value
	happyBirthday := alice.Birthday
	happyBirthday()
	fmt.Println("After birthday:", alice.Age) // 31

	fmt.Println()
	fmt.Println("=== Embedding & Promotion ===")
	d := Dog{Animal: Animal{Name: "Buddy"}, Breed: "Golden"}
	// Dog.Speak overrides Animal.Speak
	fmt.Println(d.Speak())
	// But we can still call the promoted method directly
	fmt.Println(d.Animal.Speak())

	fmt.Println()
	fmt.Println("=== Stringer Interface ===")
	price := Money{99.5, "USD"}
	fmt.Println("Price:", price) // automatically calls String()

	items := []Money{{12.3, "CNY"}, {45.6, "USD"}}
	for _, item := range items {
		fmt.Println("Item:", item)
	}

	fmt.Println()
	fmt.Println("=== Counter: Pointer Receiver in Action ===")
	c := Counter{}
	for i := 0; i < 5; i++ {
		c.Inc()
	}
	fmt.Printf("Counter: %d\n", c.Get())

	// Method on nil pointer — works if handled carefully
	var cp *Counter = nil
	_ = cp // Avoid using methods on nil unless designed for it
	fmt.Println("Counter pointer is nil, but methods can handle it safely")

	fmt.Println()
	fmt.Println("=== Method Set Rules Demo ===")
	demoMethodSets()
}

// Demonstrates method set rules with interfaces
type Describer interface {
	Describe() string
}

func (p Point) Describe() string {
	return fmt.Sprintf("Point(%v, %v)", p.X, p.Y)
}

func demoMethodSets() {
	p := Point{1, 2}

	// Both T and *T satisfy Describer (value receiver method)
	var d1 Describer = p
	var d2 Describer = &p
	fmt.Println("Value:", d1.Describe())
	fmt.Println("Pointer:", d2.Describe())

	// String manipulation example
	fmt.Println(strings.Repeat("=", 30))
	fmt.Println("Key rule: if you use pointer receivers, be consistent!")
}
```

## 四、执行预览

```
=== Value vs Pointer Receiver ===
Original: {X:3 Y:4}, Distance: 5.00
After Scale(2): {X:6 Y:8}

=== Method Value & Expression ===
Method value: Hello, I'm Alice, age 30
Method expression: Hello, I'm Alice, age 30
After birthday: 31

=== Embedding & Promotion ===
Buddy barks!
Buddy makes a sound

=== Stringer Interface ===
Price: 99.50 USD
Item: 12.30 CNY
Item: 45.60 USD

=== Counter: Pointer Receiver in Action ===
Counter: 5
Counter pointer is nil, but methods can handle it safely

=== Method Set Rules Demo ===
Value: Point(1, 2)
Pointer: Point(1, 2)
==============================
Key rule: if you use pointer receivers, be consistent!
```

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 值接收者 | 方法内操作的是副本，不影响调用者的原始数据 |
| 指针接收者 | 可以修改原始数据；避免大 struct 的拷贝开销 |
| 方法集 | 接口赋值时，T 只有值接收者方法，*T 有全部方法 |
| 自动转换 | `p.Scale(2)` 自动变成 `(&p).Scale(2)`（可取地址时） |
| 嵌入冲突 | 同名方法时，外层覆盖内层；同层冲突则编译报错 |
| nil 接收者 | 指针接收者方法可以接收 nil，但要显式处理 |
| 同包限制 | 方法定义必须与类型在同一个包内 |

## 六、避坑指南

❌ **值接收者试图修改状态**
```go
func (c Counter) Inc() { c.count++ } // modifies copy, useless!
```
✅ 用指针接收者
```go
func (c *Counter) Inc() { c.count++ } // modifies original
```

❌ **T 类型赋给需要指针接收者方法的接口**
```go
type Setter interface { Set(string) }
func (p *Person) Set(name string) { p.Name = name }
var s Setter = Person{} // compile error: Person does not implement Setter
```
✅ 使用指针
```go
var s Setter = &Person{} // OK
```

❌ **在方法内返回接收者指针导致意外**
```go
func (p Point) Shifted(dx float64) *Point {
    p.X += dx
    return &p // returns address of copy — confusing
}
```
✅ 明确用指针接收者或值返回
```go
func (p Point) Shifted(dx float64) Point {
    p.X += dx
    return p // return by value, clear intent
}
```

## 七、练习题

🟢 **基础题：Rectangle 方法**
为 `type Rect struct { W, H float64 }` 实现三个方法：`Area()`、`Perimeter()` 和 `Scale(f float64)`（用指针接收者）。

🟡 **进阶题：实现 Stringer**
定义 `type Student struct { Name string; Scores []int }`，实现 `String() string` 方法，输出格式：`"Alice: [90 85 92] avg=89.0"`。

🔴 **挑战题：方法集与接口**
定义接口 `type Modifier interface { Modify(string) string }`，为 `type Text string` 实现该方法。证明值类型和指针类型在接口赋值时的行为差异，并解释原因。

## 八、知识点总结

```
Go Methods（方法）
├── 基础
│   ├── 语法：func (r Receiver) Name() {}
│   ├── 值接收者 → 副本操作
│   └── 指针接收者 → 原件操作
├── 方法集（Method Sets）
│   ├── T 的方法集 = 值接收者方法
│   ├── *T 的方法集 = 值 + 指针接收者方法
│   └── 接口赋值时严格检查方法集
├── 高级用法
│   ├── 方法值：p.Method（闭包）
│   ├── 方法表达式：Type.Method（函数）
│   ├── 嵌入提升：内嵌字段方法自动可用
│   └── Stringer：fmt.Stringer 接口
└── 最佳实践
    ├── 需要修改 → 指针接收者
    ├── 大 struct → 指针接收者（避免拷贝）
    ├── 一致性 → 同一类型统一用一种接收者
    └── 不可变数据 → 值接收者
```

## 九、举一反三

| 语言 | 类似概念 | 差异 |
|------|---------|------|
| Java | class 方法 | Java 方法默认就是引用传递，无值/指针区别 |
| Python | 绑定方法 `self` | Python 一切引用，类似 Go 指针接收者 |
| Rust &impl 方法 | `&self` vs `&mut self` 类似值/指针接收者 | Rust 编译器强制检查借用规则 |
| C++ | 成员函数 | `const` 方法类似值接收者语义 |
| TypeScript | class 方法 | 原型链方法，无值/指针区分 |

## 十、参考资料

- [Go 官方教程 - Methods](https://go.dev/tour/methods/1)
- [Effective Go - Methods](https://go.dev/doc/effective_go#methods)
- [Go Spec - Method Sets](https://go.dev/ref/spec#Method_sets)
- [Go by Example - Methods](https://gobyexample.com/methods)

## 十一、代码演进

**v1：基础方法定义**
```go
type User struct{ Name string }
func (u User) Hello() string { return "Hi " + u.Name }
```

**v2：加入指针接收者和 Stringer**
```go
func (u *User) Rename(name string) { u.Name = name }
func (u User) String() string { return fmt.Sprintf("User(%s)", u.Name) }
```

**v3：嵌入 + 方法集 + 接口兼容**
```go
type Admin struct {
    User  // promoted: Hello(), String()
    Role  string
}
func (a *Admin) SetRole(role string) { a.Role = role }
// Admin inherits User's methods; *Admin satisfies Stringer
```
