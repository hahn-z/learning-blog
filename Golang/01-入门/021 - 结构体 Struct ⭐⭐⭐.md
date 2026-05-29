---
title: "021 - 结构体 Struct ⭐⭐⭐"
slug: "021-struct"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.807+08:00"
updated_at: "2026-04-29T10:02:44.578+08:00"
reading_time: 25
tags: ["Go基础"]
---

# 021 - 结构体 Struct ⭐⭐⭐

> **难度：** ⭐⭐⭐（中等）
> **适合人群：** 有 Go 基础语法经验，准备学习面向对象设计的开发者
> **阅读时间：** 约 25 分钟

---

## 一、概念讲解

### 什么是结构体？

结构体是 Go 中**组织数据的基本方式**——把多个字段打包成一个整体。它是 Go 实现"面向对象"的基石（Go 没有 class，用 struct + method 代替）。

```go
type User struct {
    Name string
    Age  int
}
```

### 四种初始化方式

```go
// 1. 字面量（推荐）
u1 := User{Name: "Alice", Age: 25}

// 2. 顺序赋值（不推荐，维护性差）
u2 := User{"Bob", 30}

// 3. new 函数（返回指针）
u3 := new(User) // *User, 零值

// 4. 取地址 + 字面量
u4 := &User{Name: "Charlie", Age: 35}
```

### 字段标签（Field Tags）

字段标签是附加在字段上的元数据，运行时可通过反射读取。最常见的用途是 JSON 序列化：

```go
type User struct {
    Name string `json:"name"`
    Age  int    `json:"age,omitempty"`
    Pass string `json:"-"`
}
```

### 匿名字段 / 嵌入（Embedding）

Go 通过结构体嵌入实现类似"继承"的效果：

```go
type Animal struct {
    Name string
}

func (a Animal) Speak() string { return a.Name + " speaks" }

type Dog struct {
    Animal  // 匿名嵌入，Dog "继承" Animal 的字段和方法
    Breed string
}
```

### 结构体比较

如果所有字段都是**可比较的**，结构体就可以用 `==` 比较：

```go
p1 := Point{X: 1, Y: 2}
p2 := Point{X: 1, Y: 2}
fmt.Println(p1 == p2) // true
```

包含不可比较字段（slice、map、function）的结构体不能用 `==`。

### 构造函数模式

Go 没有构造函数，但约定 `NewXxx` 函数作为构造器：

```go
func NewUser(name string, age int) *User {
    return &User{Name: name, Age: age}
}
```

### 内存对齐

Go 编译器会自动进行内存对齐优化。字段排列顺序影响结构体大小：

```go
// 24 bytes (poor alignment)
type Bad struct {
    A bool   // 1 byte + 7 padding
    B int64  // 8 bytes
    C int32  // 4 bytes + 4 padding
}

// 16 bytes (good alignment)
type Good struct {
    B int64  // 8 bytes
    C int32  // 4 bytes
    A bool   // 1 byte + 3 padding
}
```

---

## 二、脑图（ASCII）

```
结构体 Struct
├── 定义与初始化
│   ├── type Name struct { ... }
│   ├── 4种初始化方式
│   └── 零值可用
├── 字段标签
│   ├── json:"name"
│   ├── json:"-,omitempty"
│   └── 反射读取 reflect
├── 匿名嵌入
│   ├── 字段提升
│   ├── 方法提升
│   └── 不是继承！是组合
├── 比较与哈希
│   ├── 可比较字段 → == 可用
│   └── 含 slice/map → == 不可用
├── 指针接收者
│   ├── 修改自身用 *T
│   └── 只读可用 T
├── 构造函数
│   └── NewXxx() *Xxx
└── 内存对齐
    ├── unsafe.Sizeof()
    └── 字段排列优化
```

---

## 三、完整 Go 代码

```go
package main

import (
    "encoding/json"
    "fmt"
    "unsafe"
)

// Demo: struct definition and 4 initialization methods
type User struct {
    Name string
    Age  int
}

func initMethods() {
    // Method 1: Named fields (recommended)
    u1 := User{Name: "Alice", Age: 25}
    fmt.Printf("命名初始化: %+v\n", u1)

    // Method 2: Positional (fragile, avoid)
    u2 := User{"Bob", 30}
    fmt.Printf("顺序初始化: %+v\n", u2)

    // Method 3: new() returns pointer
    u3 := new(User) // *User, zero-valued
    u3.Name = "Charlie"
    fmt.Printf("new 初始化: %+v\n", u3)

    // Method 4: & with literal
    u4 := &User{Name: "Diana", Age: 28}
    fmt.Printf("&字面量: %+v\n", u4)
}

// Demo: field tags for JSON
type Product struct {
    ID    int     `json:"id"`
    Name  string  `json:"name"`
    Price float64 `json:"price,omitempty"` // omit if zero
    Internal string `json:"-"`             // excluded from JSON
}

func fieldTags() {
    p := Product{ID: 1, Name: "Go Book", Price: 0, Internal: "secret"}
    data, _ := json.Marshal(p)
    fmt.Printf("JSON: %s\n", data) // no price (omitempty+zero), no internal

    p.Price = 29.9
    data, _ = json.Marshal(p)
    fmt.Printf("JSON with price: %s\n", data)
}

// Demo: anonymous embedding
type Animal struct {
    Name string
}

func (a Animal) Speak() string {
    return a.Name + " makes a sound"
}

type Dog struct {
    Animal        // embedded (not inherited!)
    Breed  string
}

func (d Dog) Bark() string {
    return d.Name + " barks!"
}

func embedding() {
    d := Dog{
        Animal: Animal{Name: "Rex"},
        Breed:  "Labrador",
    }
    // Name field is promoted from Animal
    fmt.Printf("Dog name: %s, breed: %s\n", d.Name, d.Breed)
    // Speak method is promoted from Animal
    fmt.Printf("Speak: %s\n", d.Speak())
    fmt.Printf("Bark: %s\n", d.Bark())
}

// Demo: struct comparison
type Point struct {
    X, Y int
}

func comparison() {
    p1 := Point{X: 1, Y: 2}
    p2 := Point{X: 1, Y: 2}
    p3 := Point{X: 1, Y: 3}

    fmt.Printf("p1 == p2: %v\n", p1 == p2) // true
    fmt.Printf("p1 == p3: %v\n", p1 == p3) // false

    // Structs with maps/slices are NOT comparable
    // type Bad struct { M map[string]int }
    // _ = Bad{} == Bad{} // compile error!
}

// Demo: constructor pattern
type Server struct {
    Host string
    Port int
}

// Constructor: returns pointer, can validate
func NewServer(host string, port int) *Server {
    if port < 0 || port > 65535 {
        panic(fmt.Sprintf("invalid port: %d", port))
    }
    return &Server{Host: host, Port: port}
}

func (s *Server) Address() string {
    return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

func constructorPattern() {
    s := NewServer("localhost", 8080)
    fmt.Printf("Server address: %s\n", s.Address())
}

// Demo: memory alignment
type BadAlign struct {
    A bool   // 1 byte
    B int64  // 8 bytes (needs 8-byte alignment → 7 bytes padding before)
    C int32  // 4 bytes
    // Total: 1 + 7(pad) + 8 + 4 + 4(pad) = 24 bytes
}

type GoodAlign struct {
    B int64  // 8 bytes
    C int32  // 4 bytes
    A bool   // 1 byte + 3(pad)
    // Total: 8 + 4 + 1 + 3(pad) = 16 bytes
}

func memoryAlignment() {
    fmt.Printf("BadAlign size: %d bytes\n", unsafe.Sizeof(BadAlign{}))   // 24
    fmt.Printf("GoodAlign size: %d bytes\n", unsafe.Sizeof(GoodAlign{})) // 16
    fmt.Printf("节省了 %d bytes (33%%)\n",
        unsafe.Sizeof(BadAlign{})-unsafe.Sizeof(GoodAlign{}))
}

// Demo: struct with methods (pointer vs value receiver)
type Counter struct {
    count int
}

// Value receiver: works on copy, cannot modify original
func (c Counter) ValueRead() int {
    return c.count
}

// Pointer receiver: can modify original
func (c *Counter) Increment() {
    c.count++
}

func methodReceivers() {
    c := &Counter{}
    c.Increment()
    c.Increment()
    fmt.Printf("Counter value: %d\n", c.ValueRead())
}

func main() {
    fmt.Println("=== 四种初始化方式 ===")
    initMethods()

    fmt.Println("\n=== 字段标签 JSON ===")
    fieldTags()

    fmt.Println("\n=== 匿名嵌入 ===")
    embedding()

    fmt.Println("\n=== 结构体比较 ===")
    comparison()

    fmt.Println("\n=== 构造函数模式 ===")
    constructorPattern()

    fmt.Println("\n=== 内存对齐 ===")
    memoryAlignment()

    fmt.Println("\n=== 方法接收者 ===")
    methodReceivers()
}
```

---

## 四、执行预览

```
=== 四种初始化方式 ===
命名初始化: {Name:Alice Age:25}
顺序初始化: {Name:Bob Age:30}
new 初始化: &{Name:Charlie Age:0}
&字面量: &{Name:Diana Age:28}

=== 字段标签 JSON ===
JSON: {"id":1,"name":"Go Book"}
JSON with price: {"id":1,"name":"Go Book","price":29.9}

=== 匿名嵌入 ===
Dog name: Rex, breed: Labrador
Speak: Rex makes a sound
Bark: Rex barks!

=== 结构体比较 ===
p1 == p2: true
p1 == p3: false

=== 构造函数模式 ===
Server address: localhost:8080

=== 内存对齐 ===
BadAlign size: 24 bytes
GoodAlign size: 16 bytes
节省了 8 bytes (33%)

=== 方法接收者 ===
Counter value: 2
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 零值可用 | 设计结构体时让零值有意义 | `sync.Mutex` 零值即可用 |
| 字段顺序 | 影响 JSON 序列化和内存大小 | 紧凑排列节省内存 |
| 可比较性 | 含 slice/map/func 不可比较 | 需比较时用 `reflect.DeepEqual` |
| 嵌入 vs 继承 | Go 是组合，不是继承 | 不要当继承用 |
| 指针接收者一致性 | 混用值/指针接收者易混乱 | 选一个，保持一致 |
| 构造函数 | Go 没有 class 构造器 | 用 `NewXxx` 函数约定 |
| 可见性 | 大写 = 导出，小写 = 未导出 | 遵循包级封装 |

---

## 六、避坑指南

### ❌ 顺序初始化
```go
// ❌ 字段顺序变了就出 bug
u := User{"Alice", 25}

// ✅ 用命名初始化
u := User{Name: "Alice", Age: 25}
```

### ❌ 值接收者修改自身
```go
// ❌ 值接收者修改的是副本，原值不变
func (c Counter) Increment() { c.count++ }

// ✅ 指针接收者才能修改
func (c *Counter) Increment() { c.count++ }
```

### ❌ 用继承思维理解嵌入
```go
// ❌ 嵌入不是继承，Dog 不是 Animal 的子类型
// Dog 和 Animal 是 has-a 关系

// ✅ 理解为"组合 + 字段/方法提升"
// Dog has an Animal, and can use its methods directly
```

### ❌ 忽略内存对齐
```go
// ❌ 随意排列字段，浪费内存
type Waste struct {
    A bool
    B int64
    C bool
    D int64
} // 32 bytes!

// ✅ 按大小降序排列
type Compact struct {
    B int64
    D int64
    C bool
    A bool
} // 18 bytes (+6 padding = 24, still better than 32)
```

---

## 七、练习题

### 🟢 入门：定义 Student 结构体
定义 `Student` 结构体（Name、Age、Grade），包含 JSON 标签，实现 `String()` 方法。

### 🟡 进阶：用嵌入实现"多态"
定义 `Shape` 接口（Area 方法），`Circle` 和 `Rectangle` 结构体实现该接口。用切片存储不同形状并计算总面积。

```go
type Shape interface {
    Area() float64
}
// 实现 Circle 和 Rectangle
```

### 🔴 挑战：实现 Option 模式
用 Functional Options 模式实现结构体配置：

```go
type Server struct {
    Host string
    Port int
    TLS  bool
}

type Option func(*Server)

func WithTLS() Option {
    return func(s *Server) { s.TLS = true }
}

func NewServer(opts ...Option) *Server {
    // 初始化 + 应用 options
}
```

---

## 八、知识点总结

```
结构体 Struct
├── 定义 type T struct { ... }
├── 初始化 4 种方式
│   ├── 命名字面量 ✅
│   ├── 顺序字面量 ❌
│   ├── new(T) → *T
│   └── &T{} → *T
├── 字段标签
│   ├── json/xml/db
│   └── 反射读取
├── 匿名嵌入
│   ├── 字段提升
│   ├── 方法提升
│   └── 方法覆盖
├── 方法接收者
│   ├── 值接收者 T（只读）
│   └── 指针接收者 *T（可修改）
├── 构造函数
│   └── NewXxx() 模式
└── 内存对齐
    ├── unsafe.Sizeof
    └── 字段排列优化
```

---

## 九、举一反三

| 场景 | 值类型 struct | 指针 *struct |
|------|---------------|--------------|
| 小结构体 (<64B) | ✅ 传值 | 视情况 |
| 大结构体 | ❌ 复制开销 | ✅ 传指针 |
| 需要修改 | ❌ | ✅ |
| 并发安全 | ⚠️ 各副本独立 | ❌ 需加锁 |
| map/slice 元素 | ✅ 可寻址 | 用指针元素 |
| 方法接收者 | 只读用值 | 修改用指针 |

---

## 十、参考资料

1. [Go 官方文档 - Structs](https://go.dev/tour/moretypes/2)
2. [Effective Go - Structs and interfaces](https://go.dev/doc/effective_go#interfaces)
3. [Go by Example: Structs](https://gobyexample.com/structs)
4. [Go Wiki: Method receiver type](https://github.com/golang/go/wiki/CodeReviewComments#receiver-type)
5. [Ultimate Go - Memory Layout](https://www.ardanlabs.com/blog/2016/10/ultimate-struct-type-analysis.html)

---

## 十一、代码演进

### v1 — 基本结构体
```go
type User struct {
    Name string
    Age  int
}
u := User{Name: "Alice", Age: 25}
fmt.Println(u.Name)
```

### v2 — 方法 + 指针接收者
```go
func (u *User) Birthday() { u.Age++ }
u := &User{Name: "Alice", Age: 25}
u.Birthday()
```

### v3 — 构造函数 + 嵌入 + JSON
```go
type BaseEntity struct {
    ID        int       `json:"id"`
    CreatedAt time.Time `json:"created_at"`
}

type User struct {
    BaseEntity
    Name string `json:"name"`
}

func NewUser(name string) *User {
    return &User{
        BaseEntity: BaseEntity{ID: generateID(), CreatedAt: time.Now()},
        Name:       name,
    }
}
```

---

**上一篇：** [020 - 指针进阶：new 与 make](/posts/020-new-make)
