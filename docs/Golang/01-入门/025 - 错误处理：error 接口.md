---
title: "025 - 错误处理：error 接口"
slug: "025-error-handling"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.858+08:00"
updated_at: "2026-04-29T10:02:44.606+08:00"
reading_time: 22
tags: ["Go基础"]
---

# 025 - 错误处理：error 接口

> **难度：⭐⭐⭐** | 错误处理是 Go 的核心价值观之一，掌握它就掌握了 Go 的灵魂。

## 一、概念讲解

Go 语言没有 try-catch，没有异常机制。错误就是一个普通的值，类型是 `error` 接口：

```go
type error interface {
    Error() string
}
```

就这么简单——任何实现了 `Error() string` 方法的类型，都是 error。

### 为什么 Go 选择显式错误处理？

- **代码可读性**：你能在每一行看到错误是否被处理
- **可控性**：不会出现意外的异常跳转
- **性能**：没有异常栈展开的开销
- **简单性**：error 就是个值，跟 int、string 没本质区别

## 二、脑图（ASCII）

```
Go Error Handling
├── 基础
│   ├── error 接口 (Error() string)
│   ├── errors.New()
│   ├── fmt.Errorf()
│   └── sentinel errors
├── 错误检查
│   ├── if err != nil
│   ├── errors.Is()  (链式比较)
│   └── errors.As()  (类型断言)
├── 错误包装
│   ├── fmt.Errorf("%w", err)
│   └── errors.Unwrap()
├── 自定义错误
│   ├── 自定义类型
│   └── 实现 error 接口
└── 最佳实践
    ├── 及时处理
    ├── 只处理一次
    ├── 添加上下文
    └── 错误包装而非替换
```

## 三、完整 Go 代码

### v1：基础错误创建与检查

```go
package main

import (
    "errors"
    "fmt"
)

// Basic error creation and checking
func divide(a, b float64) (float64, error) {
    if b == 0 {
        // errors.New creates a simple error with a message
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

// fmt.Errorf for formatted error messages
func findUser(id int) (string, error) {
    if id <= 0 {
        return "", fmt.Errorf("invalid user id: %d", id)
    }
    if id > 100 {
        return "", fmt.Errorf("user %d not found", id)
    }
    return fmt.Sprintf("user_%d", id), nil
}

func main() {
    // Basic error checking
    result, err := divide(10, 3)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Printf("10 / 3 = %.2f\n", result)
    }

    // Error with division by zero
    _, err = divide(10, 0)
    if err != nil {
        fmt.Println("Error:", err)
    }

    // Formatted error
    name, err := findUser(-1)
    if err != nil {
        fmt.Println("Error:", err)
    } else {
        fmt.Println("Found:", name)
    }
}
```

### v2：错误包装与 errors.Is/errors.As

```go
package main

import (
    "errors"
    "fmt"
)

// Sentinel errors - predefined error values
var (
    ErrNotFound   = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrBadRequest = errors.New("bad request")
)

// Custom error type with extra context
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on field %q: %s", e.Field, e.Message)
}

// Function that wraps errors with context
func getUser(id int) (string, error) {
    if id <= 0 {
        // Wrap error with additional context using %w
        return "", fmt.Errorf("getUser(%d): %w", id, ErrBadRequest)
    }
    if id > 100 {
        return "", fmt.Errorf("getUser(%d): %w", id, ErrNotFound)
    }
    return fmt.Sprintf("user_%d", id), nil
}

// Function demonstrating custom error type
func validateAge(age int) error {
    if age < 0 || age > 150 {
        return &ValidationError{
            Field:   "age",
            Message: fmt.Sprintf("age %d is out of valid range [0, 150]", age),
        }
    }
    return nil
}

func main() {
    // Test error wrapping + errors.Is
    _, err := getUser(999)
    if errors.Is(err, ErrNotFound) {
        fmt.Println("Caught: user not found (via errors.Is)")
    }

    // Test custom error + errors.As
    err = validateAge(-5)
    var ve *ValidationError
    if errors.As(err, &ve) {
        fmt.Printf("Validation error on field: %s\n", ve.Field)
        fmt.Printf("Message: %s\n", ve.Message)
    }

    // Unwrap to see the chain
    _, err = getUser(-1)
    fmt.Printf("Full error: %v\n", err)
    fmt.Printf("Unwrapped: %v\n", errors.Unwrap(err))
}
```

### v3：生产级错误处理模式

```go
package main

import (
    "errors"
    "fmt"
    "strings"
)

// ---- Sentinel errors grouped by domain ----
var (
    ErrUserNotFound   = errors.New("user not found")
    ErrUserDuplicate  = errors.New("user already exists")
    ErrInvalidInput   = errors.New("invalid input")
)

// ---- Custom error with stack-friendly structure ----
type AppError struct {
    Code    string // machine-readable code, e.g. "USER_001"
    Message string // human-readable message
    Err     error  // wrapped underlying error
}

func (e *AppError) Error() string {
    if e.Err != nil {
        return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
    }
    return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error {
    return e.Err
}

// Helper: wrap any error into AppError
func WrapError(code, msg string, err error) *AppError {
    return &AppError{Code: code, Message: msg, Err: err}
}

// ---- Business logic ----
type User struct {
    ID   int
    Name string
}

var users = map[int]User{
    1: {ID: 1, Name: "Alice"},
    2: {ID: 2, Name: "Bob"},
}

func FindUser(id int) (*User, error) {
    if id <= 0 {
        return nil, WrapError("USER_001", "invalid user id", ErrInvalidInput)
    }
    u, ok := users[id]
    if !ok {
        return nil, WrapError("USER_002", fmt.Sprintf("user %d", id), ErrUserNotFound)
    }
    return &u, nil
}

// ---- Error handler: central place for logging/metrics ----
func HandleError(err error) {
    var appErr *AppError
    if errors.As(err, &appErr) {
        fmt.Printf("[APP ERROR] code=%s msg=%s\n", appErr.Code, appErr.Message)
    } else {
        fmt.Printf("[GENERIC ERROR] %v\n", err)
    }

    // Check sentinel chain
    if errors.Is(err, ErrUserNotFound) {
        fmt.Println("  → Action: return 404 to client")
    } else if errors.Is(err, ErrInvalidInput) {
        fmt.Println("  → Action: return 400 to client")
    }
}

func main() {
    fmt.Println(strings.Repeat("=", 40))

    _, err := FindUser(999)
    HandleError(err)

    fmt.Println(strings.Repeat("-", 40))

    _, err = FindUser(-1)
    HandleError(err)

    fmt.Println(strings.Repeat("-", 40))

    user, err := FindUser(1)
    if err != nil {
        HandleError(err)
    } else {
        fmt.Printf("Found user: %s\n", user.Name)
    }
}
```

## 四、执行预览

```
$ go run main_v1.go
10 / 3 = 3.33
Error: division by zero
Error: invalid user id: -1

$ go run main_v2.go
Caught: user not found (via errors.Is)
Validation error on field: age
Message: age -5 is out of valid range [0, 150]
Full error: getUser(-1): bad request
Unwrapped: bad request

$ go run main_v3.go
========================================
[APP ERROR] code=USER_002 msg=user 999
  → Action: return 404 to client
----------------------------------------
[APP ERROR] code=USER_001 msg=invalid user id
  → Action: return 400 to client
----------------------------------------
Found user: Alice
```

## 五、注意事项（表格）

| 事项 | 说明 |
|------|------|
| `errors.Is` vs `==` | `==` 只比较顶层，`errors.Is` 会遍历 wrap 链 |
| `errors.As` vs 类型断言 | `errors.As` 遍历 wrap 链，类型断言只看顶层 |
| `%w` vs `%v` | `%w` 包装错误（可 Unwrap），`%v` 只是格式化字符串 |
| 多次 `%w` | Go 1.20+ 支持 `fmt.Errorf("%w + %w", e1, e2)` |
| `nil` error | 函数返回 `nil` 即表示无错误 |
| error 是接口 | 任何实现 `Error() string` 的类型都是 error |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `if err != nil { log.Println(err) }` 然后继续执行 | 要么 return，要么真的能处理 |
| `fmt.Errorf("failed: %v", err)` | `fmt.Errorf("failed: %w", err)` 用 %w 保留链 |
| 用 `==` 比较错误 | 用 `errors.Is()` 比较错误 |
| 用类型断言 `err.(*MyError)` | 用 `errors.As(err, &target)` |
| 吞掉错误 `_ = doSomething()` | 至少记录日志 |
| 在循环里反复 wrap | wrap 一次，带足上下文 |

## 七、练习题

### 🟢 入门

1. 写一个函数 `sqrt(x float64) (float64, error)`，当 x < 0 时返回错误
2. 用 `errors.New` 和 `fmt.Errorf` 各创建一个错误，打印看看区别

### 🟡 进阶

3. 定义一个自定义错误类型 `HTTPError` 包含 StatusCode 和 Message，实现 error 接口
4. 写一个函数用 `%w` 包装错误，然后用 `errors.Is` 和 `errors.Unwrap` 验证链路

### 🔴 挑战

5. 实现一个简单的错误收集器：能收集多个错误，统一返回；提供 `HasErrors()` 和 `AllErrors()` 方法
6. 设计一个分层错误体系：Repository 层 → Service 层 → Handler 层，每层包装不同上下文

## 八、知识点总结（树状）

```
Go Error Handling
├── error 接口
│   └── Error() string
├── 创建错误
│   ├── errors.New() — 简单字符串
│   └── fmt.Errorf() — 格式化字符串
├── 检查错误
│   ├── err != nil — 基本判空
│   ├── errors.Is() — 链式相等比较
│   └── errors.As() — 链式类型匹配
├── 包装错误
│   ├── fmt.Errorf("%w", err)
│   └── errors.Unwrap()
├── 自定义错误
│   ├── 结构体实现 Error()
│   ├── 可携带额外字段
│   └── 可实现 Unwrap()
└── 模式
    ├── Sentinel Error (预定义)
    ├── Custom Error Type (结构体)
    └── AppError (Code + Message + Err)
```

## 九、举一反三（表格）

| 场景 | Go 方案 | 其他语言对比 |
|------|---------|-------------|
| 函数返回错误 | `(value, error)` 返回值 | Java: throws Exception |
| 错误链追踪 | `fmt.Errorf("%w")` + `errors.Is/As` | Java: exception.getCause() |
| 自定义错误 | struct + `Error()` 方法 | Python: class MyError(Exception) |
| 错误码体系 | AppError{Code, Message, Err} | HTTP Status Code |
| 多错误聚合 | `errors.Join()` (Go 1.20+) | Java: Suppressed exceptions |

## 十、参考资料

- [Go Blog: Error handling](https://go.dev/blog/error-handling-and-go)
- [Go Blog: Working with Errors](https://go.dev/blog/go1.13-errors)
- [Go Blog: Error wrapping](https://go.dev/blog/go1.20)
- [Effective Go: Errors](https://go.dev/doc/effective_go#errors)

## 十一、代码演进总结

| 版本 | 重点 | 关键技术 |
|------|------|---------|
| v1 | 基础创建与检查 | `errors.New`, `fmt.Errorf`, `if err != nil` |
| v2 | 包装与类型判断 | `%w`, `errors.Is`, `errors.As`, 自定义类型 |
| v3 | 生产级模式 | AppError, 错误码, 集中处理, 分层架构 |
