---
title: "027 - 包 Package 与模块 Module"
slug: "027-package-module"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.883+08:00"
updated_at: "2026-04-29T10:02:44.622+08:00"
reading_time: 28
tags: ["Go基础"]
---

# 027 - 包 Package 与模块 Module

> **难度：⭐⭐** | 包是代码组织的基本单位，模块是依赖管理的核心。理解它们，才能真正写出可维护的 Go 项目。

## 一、概念讲解

### Package（包）

- 每个 Go 源文件第一行必须声明所属包：`package main`
- 同一个目录下所有 `.go` 文件的 package 声明必须相同
- 包名决定访问控制：**大写开头 = 导出（public），小写开头 = 未导出（private）**
- `main` 包是特殊的——定义了程序的入口点

### Module（模块）

- 一个模块 = 一组相关包的集合，有独立的版本号
- 用 `go mod init` 创建，生成 `go.mod` 文件
- `go.mod` 记录模块路径和依赖版本
- `go.sum` 记录依赖的校验哈希

### 核心概念速查

| 概念 | 说明 |
|------|------|
| `package` | 声明当前文件属于哪个包 |
| `import` | 导入其他包 |
| 大写导出 | 首字母大写的标识符对外可见 |
| `go.mod` | 模块定义文件 |
| `go.sum` | 依赖校验文件 |
| `internal` | 限制包只能被父模块访问 |

## 二、脑图（ASCII）

```
Package & Module
├── Package
│   ├── 声明: package xxx
│   ├── 导入: import "path"
│   ├── 可见性
│   │   ├── 大写 = 导出 (public)
│   │   └── 小写 = 未导出 (private)
│   ├── init() 函数
│   │   ├── 自动执行，不能调用
│   │   └── 多个 init 按文件名排序执行
│   ├── main 包 (程序入口)
│   └── internal 包 (访问限制)
├── Module
│   ├── go mod init
│   ├── go mod tidy
│   ├── go mod vendor
│   ├── go.mod 文件
│   │   ├── module 路径
│   │   ├── go 版本
│   │   └── require 依赖
│   └── go.sum 文件
├── 导入方式
│   ├── 单行: import "fmt"
│   ├── 多行: import ( "fmt"; "os" )
│   ├── 别名: import f "fmt"
│   ├── 点导入: import . "fmt"
│   └── 空导入: import _ "driver"
└── 规范
    ├── 包名小写、短、有意义
    ├── 不用下划线/驼峰
    ├── 避免 util/common 命名
    └── 单数不用复数
```

## 三、完整 Go 代码

### v1：基础包结构、可见性、导入

```go
// ---- mathutil/math.go ----
package mathutil

import "errors"

// Exported: uppercase first letter = public
func Add(a, b int) int {
    return a + b
}

// Exported
func Divide(a, b int) (int, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

// Unexported: lowercase = private to this package
func multiply(a, b int) int {
    return a * b
}

// Exported function using private helper
func Multiply(a, b int) int {
    return multiply(a, b)
}

// Version is a package-level exported variable
var Version = "1.0.0"

// unexported constant
const defaultMax = 1000

// Exported constant
const MaxValue = defaultMax
```

```go
// ---- main.go ----
package main

import (
    "fmt"
    // In real project: "yourmodule/mathutil"
    // For demo, we inline usage
)

// Demonstrate package concepts inline
func main() {
    fmt.Println("=== Package Basics ===")

    // Using exported functions
    fmt.Printf("Add(3, 5) = %d\n", 3+5)
    fmt.Printf("Multiply(4, 6) = %d\n", 4*6)

    // Exported variables
    fmt.Println("Package version: 1.0.0")

    // NOTE: multiply() and defaultMax are NOT accessible
    // from outside the package - compiler error!
    // fmt.Println(multiply(2, 3))  // ERROR: undefined
    // fmt.Println(defaultMax)       // ERROR: undefined

    fmt.Println("\nExported = Uppercase = Public")
    fmt.Println("Unexported = lowercase = Private")
}
```

### v2：init 函数、多种导入方式、go.mod

```go
// ---- config/config.go ----
package config

import "fmt"

// Package-level variables initialized before init
var (
    AppName = "myapp"
    Port    = 8080
)

// init runs automatically when package is imported
func init() {
    fmt.Println("[config] init() called - setting defaults")
    if Port == 0 {
        Port = 3000
    }
}

// Another init in the same file - both run
func init() {
    fmt.Printf("[config] second init() - AppName=%s, Port=%d\n", AppName, Port)
}
```

```go
// ---- greeting/greeting.go ----
package greeting

import "fmt"

// Hello returns a greeting message
func Hello(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}
```

```go
// ---- main.go ----
package main

import (
    "fmt"
    // In real project:
    // "myproject/config"
    // "myproject/greeting"
    // "github.com/google/uuid" // third-party
)

// Simulate imports inline for self-contained demo

func main() {
    fmt.Println("=== Import Styles ===")

    // 1. Standard import
    // import "fmt" → fmt.Println()

    // 2. Alias import (avoid name collision)
    // import f "fmt" → f.Println()

    // 3. Dot import (use without qualifier - rare, for DSLs)
    // import . "fmt" → Println() directly

    // 4. Blank import (side effects only, for init())
    // import _ "github.com/lib/pq" → runs init(), can't use package

    // 5. Grouped import
    // import (
    //     "fmt"
    //     "os"
    //     "net/http"
    // )

    fmt.Println("\n=== go.mod ===")
    fmt.Println(`module myproject
go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/google/uuid v1.6.0
)`)

    fmt.Println("\nKey commands:")
    fmt.Println("  go mod init myproject   → create go.mod")
    fmt.Println("  go mod tidy              → add missing, remove unused")
    fmt.Println("  go mod vendor            → copy deps to vendor/")
    fmt.Println("  go mod download          → download deps to cache")
}
```

### v3：internal 包、项目结构、循环依赖解决

```go
// ==== 完整项目结构演示 ====
// myproject/
// ├── go.mod
// ├── main.go
// ├── internal/
// │   ├── user/
// │   │   └── user.go      (internal package)
// │   └── db/
// │       └── db.go         (internal package)
// ├── pkg/
// │   └── logger/
// │       └── logger.go     (public reusable package)
// └── config/
//     └── config.go

// ---- internal/user/user.go ----
package user

import "fmt"

// User struct - exported
type User struct {
    ID   int
    Name string
    email string // unexported field!
}

// NewUser creates a user (exported constructor)
func NewUser(id int, name, email string) *User {
    return &User{ID: id, Name: name, email: email}
}

// GetName is exported - can access unexported fields from within package
func (u *User) GetEmail() string {
    return u.email
}

func (u *User) String() string {
    return fmt.Sprintf("User{id=%d, name=%s}", u.ID, u.Name)
}

// helper is unexported - only accessible within this package
func helper() string {
    return "internal helper"
}
```

```go
// ---- main.go (项目结构演示) ----
package main

import "fmt"

// Demonstrating internal package concept
func main() {
    fmt.Println("=== Project Structure ===")
    fmt.Println(`
myproject/
├── cmd/
│   └── server/
│       └── main.go        ← entry point
├── internal/
│   ├── user/              ← only myproject can import
│   │   └── user.go
│   ├── db/                ← only myproject can import
│   │   └── db.go
│   └── service/
│       └── service.go
├── pkg/
│   └── logger/            ← anyone can import (public)
│       └── logger.go
├── config/
│   └── config.go
├── go.mod
└── go.sum
`)

    fmt.Println("=== Internal Package Rules ===")
    fmt.Println("internal/ packages can ONLY be imported by:")
    fmt.Println("  - Code in the parent directory tree")
    fmt.Println("  - NOT by external modules")
    fmt.Println()
    fmt.Println("Example: myproject/internal/user")
    fmt.Println("  ✓ myproject/cmd/server can import it")
    fmt.Println("  ✓ myproject/internal/db can import it")
    fmt.Println("  ✗ github.com/other/project CANNOT import it")

    fmt.Println("\n=== Circular Dependency ===")
    fmt.Println("Problem: A imports B, B imports A → compiler error")
    fmt.Println("Solutions:")
    fmt.Println("  1. Extract shared code to C package")
    fmt.Println("  2. Use interfaces to break the cycle")
    fmt.Println("  3. Use dependency injection")

    fmt.Println("\n=== Naming Conventions ===")
    fmt.Println("  ✓ Short, lowercase, no underscores: user, http, json")
    fmt.Println("  ✌ Avoid: util, common, helpers (too generic)")
    fmt.Println("  ✌ Avoid: mypackage, pkg_user (redundant)")
    fmt.Println("  ✌ Don't use plural: strings → string (conflicts with stdlib!)")
}
```

```go
// ---- cmd/server/main.go ----
package main

import (
    "fmt"
    "log"
)

// Simulated dependency injection to avoid circular deps
type UserRepository interface {
    FindByID(id int) (string, error)
}

type Service struct {
    repo UserRepository
}

// mockRepo implements UserRepository (would be in internal/db/)
type mockRepo struct{}

func (m *mockRepo) FindByID(id int) (string, error) {
    if id == 1 {
        return "Alice", nil
    }
    return "", fmt.Errorf("user %d not found", id)
}

func main() {
    // Dependency injection: Service depends on interface, not concrete type
    repo := &mockRepo{}
    svc := &Service{repo: repo}

    name, err := svc.repo.FindByID(1)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found user: %s\n", name)
}
```

## 四、执行预览

```
$ go run main_v1.go
=== Package Basics ===
Add(3, 5) = 8
Multiply(4, 6) = 24
Package version: 1.0.0

Exported = Uppercase = Public
Unexported = lowercase = Private

$ go run main_v2.go
[config] init() called - setting defaults
[config] second init() - AppName=myapp, Port=8080
=== Import Styles ===
=== go.mod ===
module myproject
go 1.21
...

$ go run cmd/server/main.go
Found user: Alice
```

## 五、注意事项（表格）

| 事项 | 说明 |
|------|------|
| 同目录同包名 | 同一目录下所有 .go 文件的 package 必须一致 |
| main 包特殊 | main 包定义 `func main()` 作为程序入口 |
| 导入未使用 | 导入了包但未使用 → 编译错误 |
| internal 限制 | internal/ 只能被其父目录树内的代码导入 |
| init 自动执行 | init() 在包首次被导入时自动执行，且只执行一次 |
| go.sum 不要手动改 | 它是自动生成的依赖校验文件 |
| vendor vs module | module 是现代方式，vendor 用于离线或可控构建 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 包名用 `utils` `common` `helpers` | 用具体名字：`user` `httpclient` `converter` |
| 循环导入 A→B→A | 提取公共部分到 C，或用接口解耦 |
| 导入了不用 | 删掉未使用的 import（或用 `_` 空导入） |
| 包名用下划线 `user_service` | 用小写无分隔 `userservice` 或嵌套包 `user/service` |
| 在 internal 外放业务代码 | internal 放内部实现，pkg 放可复用代码 |
| 手动编辑 go.mod 依赖 | 用 `go mod tidy` 自动管理 |
| 不提交 go.sum | go.sum 必须提交到版本控制 |

## 七、练习题

### 🟢 入门

1. 创建一个 `math` 包，导出 Add、Subtract 函数，写 main 包调用
2. 实验大写/小写：尝试从 main 包访问小写函数，观察编译错误

### 🟡 进阶

3. 创建含 init() 的包，验证 init 执行顺序（多文件多 init）
4. 用 `go mod init` 创建模块，添加第三方依赖并用 `go mod tidy`

### 🔴 挑战

5. 设计一个完整项目结构：cmd/internal/pkg，用 internal 保护核心逻辑
6. 两个包 A 和 B 存在循环依赖，用接口方式解决

## 八、知识点总结（树状）

```
Package & Module
├── Package
│   ├── 声明: package name
│   ├── 可见性: 大写=导出, 小写=私有
│   ├── 导入: import
│   │   ├── 标准导入
│   │   ├── 别名导入
│   │   ├── 点导入(.)
│   │   └── 空导入(_)
│   ├── init() 函数
│   └── internal 包
├── Module
│   ├── go.mod
│   ├── go.sum
│   ├── go mod init
│   ├── go mod tidy
│   └── go mod vendor
├── 项目结构
│   ├── cmd/ (入口)
│   ├── internal/ (私有)
│   ├── pkg/ (公共)
│   └── config/
└── 规范
    ├── 小写短名
    ├── 不用下划线
    ├── 避免 util/common
    └── 单数不用复数
```

## 九、举一反三（表格）

| 场景 | Go 方案 | 其他语言对比 |
|------|---------|-------------|
| 代码组织 | package | Java: package, Python: module |
| 访问控制 | 大写/小写 | Java: public/private, Python: _前缀 |
| 依赖管理 | go.mod + go.sum | Node: package-lock.json, Python: requirements.txt |
| 私有包 | internal/ | Java: package-private (default) |
| 自动初始化 | init() | Java: static {} |
| 别名导入 | import f "fmt" | Python: import numpy as np |
| 循环依赖 | 不允许，用接口解耦 | Python: 允许但不推荐 |

## 十、参考资料

- [Go Modules Reference](https://go.dev/ref/mod)
- [Effective Go: Package names](https://go.dev/doc/effective_go#package-names)
- [Go Blog: Using Go Modules](https://go.dev/blog/using-go-modules)
- [Project Layout](https://github.com/golang-standards/project-layout)
- [Go Package Convention](https://go.dev/doc/effective_go#names)

## 十一、代码演进总结

| 版本 | 重点 | 关键技术 |
|------|------|---------|
| v1 | 基础包与可见性 | package, export/unexport, 基础结构 |
| v2 | init、导入方式、go.mod | init(), import 别名/点/空导入 |
| v3 | 项目结构、internal、解耦 | internal 包, 接口解耦, 依赖注入 |
