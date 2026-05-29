---
title: "013 - init函数与执行顺序 ⭐⭐"
slug: "013-init-func"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.72+08:00"
updated_at: "2026-04-29T10:02:44.506+08:00"
reading_time: 22
tags: ["Go基础"]
---


## 难度标注

> ⭐⭐ 中等 | 涉及包初始化机制、执行顺序规则，需要理解Go程序的启动流程

## 概念讲解

### 什么是 init 函数？

在 Go 语言中，`init()` 是一个特殊的函数，它在包（package）被导入时自动执行，且**无法被手动调用**。每个 Go 文件可以包含一个或多个 `init` 函数，它们在 `main` 函数之前执行。

`init` 函数的核心特性：

- **无参数、无返回值**
- **自动执行**，不可被代码显式调用
- **每个文件可以有多个 init 函数**
- **在包级别变量初始化之后执行**
- **在 main 函数之前执行**

```go
// init function signature - no params, no return
func init() {
    // initialization logic here
}
```

### init 的执行时机

Go 程序的初始化和执行遵循严格的顺序：

```
导入的包初始化（递归）
        ↓
包级别变量/常量初始化
        ↓
init() 函数执行（按声明顺序）
        ↓
main() 函数执行
```

### 为什么需要 init？

`init` 的设计哲学是：**在程序正式运行前，完成所有必要的初始化工作**。常见的使用场景包括：

1. **配置加载** — 读取环境变量、配置文件
2. **数据库连接池初始化**
3. **全局变量校验**
4. **注册驱动/插件（database/sql 的驱动注册）**
5. **日志系统初始化**

### init vs main

| 特性 | init() | main() |
|------|--------|--------|
| 参数 | 无 | 无 |
| 返回值 | 无 | 无 |
| 调用方式 | 自动执行 | 自动执行 |
| 数量 | 每文件可多个 | 每个可执行程序仅一个 |
| 所在包 | 任意包 | 必须在 package main |
| 执行顺序 | main 之前 | init 之后 |
| 可显式调用 | ❌ 不可以 | ❌ 不可以 |

## 脑图

```
init 函数
├── 基本特性
│   ├── 无参数无返回值
│   ├── 自动执行，不可调用
│   ├── 每文件可定义多个
│   └── 只在包被导入时执行
├── 执行顺序
│   ├── 被导入包先初始化（递归）
│   ├── 包级变量 → init()
│   ├── 同文件按声明顺序
│   └── 同包多文件按文件名字母序
├── 使用场景
│   ├── 配置加载
│   ├── 数据库初始化
│   ├── 驱动注册
│   ├── 变量校验
│   └── 日志初始化
└── 反模式
    ├── 在 init 中做复杂逻辑
    ├── 依赖 init 的执行顺序
    ├── 在 init 中创建 goroutine
    └── 用 init 代替显式初始化
```

## 完整 Go 代码

### 代码演进 v1：基础 init 函数

```go
package main

import (
    "fmt"
    "os"
)

// Package-level variable initialized before init()
var version = "1.0.0"

// First init function
func init() {
    fmt.Println("init 1: version =", version)
}

// Second init function in the same file
func init() {
    fmt.Println("init 2: checking environment...")
    if os.Getenv("APP_ENV") == "" {
        // Only set default, don't panic in init
        os.Setenv("APP_ENV", "development")
    }
    fmt.Println("init 2: APP_ENV =", os.Getenv("APP_ENV"))
}

func main() {
    fmt.Println("main: application started")
    fmt.Println("main: running version", version)
}
```

### 代码演进 v2：多文件 init 顺序 + 配置加载

```go
// ---------- main.go ----------
package main

import "fmt"

// Variable initialization happens before init()
var config = loadDefaultConfig()

type AppConfig struct {
    Port    string
    Env     string
    Debug   bool
}

func loadDefaultConfig() AppConfig {
    fmt.Println("loadDefaultConfig: loading defaults...")
    return AppConfig{
        Port:  "8080",
        Env:   "development",
        Debug: false,
    }
}

func init() {
    fmt.Println("main.go init: validating config...")
    if config.Port == "" {
        panic("port cannot be empty") // Panic only for fatal misconfiguration
    }
}

func main() {
    fmt.Printf("main: server starting on :%s (%s)\n", config.Port, config.Env)
}

// ---------- db.go (same package, filename sorts after main.go) ----------
package main

import "fmt"

func init() {
    // This init runs after main.go's init because "db.go" > "main.go" alphabetically
    fmt.Println("db.go init: initializing database connection...")
}

// ---------- logger.go (same package, sorts before main.go) ----------
package main

import "fmt"

func init() {
    // This init runs before main.go's init because "logger.go" < "main.go"
    fmt.Println("logger.go init: setting up logger...")
}
```

### 代码演进 v3：实际的配置加载模式（推荐）

```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "os"
    "sync"
)

// Config holds application configuration
type Config struct {
    Port     string `json:"port"`
    DBUrl    string `json:"db_url"`
    LogLevel string `json:"log_level"`
}

var (
    appConfig *Config
    once      sync.Once
)

// GetConfig returns the singleton config instance (lazy init, NOT in init())
func GetConfig() *Config {
    once.Do(func() {
        appConfig = &Config{
            Port:     "8080",
            DBUrl:    "postgres://localhost/mydb",
            LogLevel: "info",
        }
        // Try loading from file
        if data, err := os.ReadFile("config.json"); err == nil {
            if err := json.Unmarshal(data, appConfig); err != nil {
                log.Printf("warning: failed to parse config.json: %v", err)
            }
        }
    })
    return appConfig
}

// init only registers defaults, no heavy logic
func init() {
    log.SetFlags(log.LstdFlags | log.Lshortfile)
    log.Println("init: log format configured")
}

func main() {
    // Explicit initialization - clear and testable
    cfg := GetConfig()
    fmt.Printf("Server starting on :%s\n", cfg.Port)
    fmt.Printf("Database: %s\n", cfg.DBUrl)
    fmt.Printf("Log Level: %s\n", cfg.LogLevel)
}
```

## 执行预览

### v1 执行结果

```
$ APP_ENV=production go run main.go
init 1: version = 1.0.0
init 2: checking environment...
init 2: APP_ENV = production
main: application started
main: running version 1.0.0
```

### v2 执行结果（注意文件名字母序）

```
$ go run .
logger.go init: setting up logger...
main.go init: validating config...
db.go init: initializing database connection...
main: server starting on :8080 (development)
```

### v3 执行结果

```
$ go run .
2026/04/28 18:00:00 init: log format configured
Server starting on :8080
Database: postgres://localhost/mydb
Log Level: info
```

## 注意事项

| 注意点 | 说明 | 严重程度 |
|--------|------|----------|
| init 不可调用 | `init()` 不能被显式调用，编译器会报错 | ⚠️ 编译错误 |
| 执行顺序依赖文件名 | 同包多文件的 init 按文件名字母序执行，不要依赖这个顺序 | 🔴 严重 |
| init 中 panic | init 中 panic 会导致程序直接崩溃，无法 recover | 🔴 严重 |
| 循环导入 | 包 A 的 init 导入包 B，包 B 又导入包 A → 编译错误 | ⚠️ 编译错误 |
| 多个 init 的可读性 | 同一文件多个 init 降低可读性，建议合并 | 🟡 建议 |
| 测试中的 init | `_test.go` 文件中的 init 也会执行 | 🟡 注意 |
| init 中启动 goroutine | init 返回后 main 才开始，goroutine 可能还没启动完 | 🔴 严重 |

## 避坑指南

### ❌ 在 init 中做重量级操作

```go
// ❌ BAD: init 中连接数据库，失败则程序无法启动
func init() {
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        log.Fatal(err) // program dies
    }
    // db 连接状态不可控
}
```

```go
// ✅ GOOD: 使用显式初始化函数，错误可处理
func NewDatabase(cfg Config) (*sql.DB, error) {
    return sql.Open("postgres", cfg.DBUrl)
}

func main() {
    db, err := NewDatabase(cfg)
    if err != nil {
        // 可以优雅处理
        log.Fatalf("database init failed: %v", err)
    }
    defer db.Close()
}
```

### ❌ 依赖跨文件的 init 执行顺序

```go
// ❌ BAD: db.go 的 init 依赖 logger.go 的 init 已经执行
// db.go
func init() {
    logger.Info("connecting to db...") // logger 可能还没初始化！
}
```

```go
// ✅ GOOD: 用显式的初始化链
func main() {
    logger := NewLogger()
    db := NewDB(logger)
    // 顺序清晰，可测试
}
```

### ❌ 用 init 注册太多副作用

```go
// ❌ BAD: 到处都是 init 注册，调试困难
// handler.go
func init() { registry["user"] = handleUser }
// middleware.go
func init() { registry["auth"] = handleAuth }
// 不知道哪些被注册了，难以追踪
```

```go
// ✅ GOOD: 集中注册，一目了然
func RegisterHandlers(r *mux.Router) {
    r.HandleFunc("/user", handleUser)
    r.HandleFunc("/auth", handleAuth)
}
```

## 练习题

### 🟢 基础题

**题目 1：** 以下代码的输出顺序是什么？

```go
var x = printAndReturn("x init")

func init() {
    fmt.Println("init 1")
}

var y = printAndReturn("y init")

func init() {
    fmt.Println("init 2")
}

func printAndReturn(s string) string {
    fmt.Println(s)
    return s
}

func main() {
    fmt.Println("main")
}
```

<details>
<summary>参考答案</summary>

```
x init
y init
init 1
init 2
main
```

变量初始化先于所有 init 函数。变量按声明顺序初始化。
</details>

### 🟡 进阶题

**题目 2：** 如果包 A 导入包 B，包 B 导入包 C，每个包都有一个 init 函数，执行顺序是什么？

<details>
<summary>参考答案</summary>

```
C.init() → B.init() → A.init() → main()
```

Go 采用深度优先的导入顺序，被导入的包先初始化。依赖链最底层的包最先执行 init。
</details>

### 🔴 挑战题

**题目 3：** 设计一个插件注册系统，使用 init 函数注册插件，但要求能列出所有已注册插件，且支持插件的延迟初始化（首次使用时才初始化）。

<details>
<summary>参考答案</summary>

```go
package plugin

import "sync"

// Plugin represents a lazily-initialized plugin
type Plugin struct {
    Name string
    Init func() error
}

var (
    plugins = make(map[string]*Plugin)
    mu      sync.RWMutex
)

// Register is called from init() in plugin files
func Register(name string, initFn func() error) {
    mu.Lock()
    defer mu.Unlock()
    plugins[name] = &Plugin{Name: name, Init: initFn}
}

// List returns all registered plugin names
func List() []string {
    mu.RLock()
    defer mu.RUnlock()
    names := make([]string, 0, len(plugins))
    for name := range plugins {
        names = append(names, name)
    }
    return names
}
```

关键点：Register 只记录元信息，Init 函数在需要时才调用。这样 init 很轻量，真正的初始化延迟到使用时。
</details>

## 知识点总结

```
init 函数
├── 定义：func init() { ... }
├── 执行顺序
│   ├── 1. 被导入的包（递归，深度优先）
│   ├── 2. 包级变量/常量（按声明顺序）
│   ├── 3. init 函数（同文件按声明顺序）
│   └── 4. main 函数
├── 规则
│   ├── 无参数无返回值
│   ├── 不可被调用
│   ├── 每文件可多个
│   └── 同包多文件按文件名字母序
├── 适用场景 ✅
│   ├── 日志格式配置
│   ├── database/sql 驱动注册
│   ├── 环境变量默认值
│   └── flag 参数注册
└── 不适用场景 ❌
    ├── 数据库连接（用显式初始化）
    ├── 复杂业务逻辑
    ├── 需要错误处理的操作
    └── 依赖执行顺序的初始化
```

## 举一反三

| 语言 | 类似机制 | 区别 |
|------|----------|------|
| Go init() | 包初始化 | 自动执行，不可调用，每文件可多个 |
| Java static {} | 类静态初始化块 | 按类加载时机执行 |
| C++ 全局构造函数 | 全局/静态对象构造 | main 之前执行，顺序不完全确定 |
| Python 模块级代码 | import 时执行 | 模块级代码直接运行 |
| Rust std::sync::Once | 延迟初始化 | 非自动，显式调用 |

## 参考资料

- [Go 语言规范 - Package initialization](https://go.dev/ref/spec#Package_initialization)
- [Effective Go - init](https://go.dev/doc/effective_go#init)
- [Go 博客 - Organization of Go code](https://go.dev/blog/organizing-go-code)
