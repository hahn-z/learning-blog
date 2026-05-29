---
title: "002 - 第一个Go程序Hello World"
slug: "002-hello-world"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.571+08:00"
updated_at: "2026-04-29T10:02:44.426+08:00"
reading_time: 23
tags: ["Go基础"]
---

# 002 - 第一个Go程序 Hello World

> **难度：** ⭐ | **前置知识：** Go 环境已安装、基本命令行操作 | **预估用时：** 30分钟

---

## 一句话定义

Go 程序由包（package）组成，程序从 `main` 包的 `main` 函数开始执行——这是每个 Go 程序的入口。

**现实类比：** `package main` 就像是公司的总部大楼，`func main()` 是前台接待——所有人（代码执行流）都从这里进入。

**技术场景：** 理解 Go 程序的基本结构是写任何 Go 代码的前提，包括 CLI 工具、Web 服务、系统工具。

---

## 脑图

```
                        ┌─────────────────────┐
                        │   Hello World 深入   │
                        └──────────┬──────────┘
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
    ┌────────────┐          ┌────────────┐          ┌────────────┐
    │ 程序结构    │          │ 标准输出    │          │ 构建命令    │
    └─────┬──────┘          └─────┬──────┘          └─────┬──────┘
          │                       │                       │
    ┌─────┼─────┐           ┌─────┼─────┐          ┌─────┼─────┐
    ▼     ▼     ▼           ▼     ▼     ▼          ▼     ▼     ▼
  package import func    Print Println  Printf   run   build  install
   main             main
```

---

## 程序结构详解

```go
// hello.go - Complete program structure
package main          // 1. Package declaration: must be "main" for executables

import (              // 2. Import block: bring in external packages
    "fmt"             //    fmt = formatted I/O
    "os"              //    os = operating system functionality
)

func main() {         // 3. Entry point: program starts here
    fmt.Println("Hello, World!")
}
```

### 关键概念

| 概念 | 说明 |
|------|------|
| `package main` | 声明当前文件属于 main 包，Go 编译器会将其编译为可执行文件 |
| `import` | 导入其他包，未使用的导入会导致编译错误 |
| `func main()` | 程序入口，无参数无返回值 |
| `{` 必须在同行 | Go 强制左花括号不能换行，否则编译错误 |

---

## fmt 包详解

```go
// fmt_demo.go - Common fmt functions
package main

import "fmt"

func main() {
    // Println: print with newline, spaces between args
    fmt.Println("Hello", "World", 2024)
    // Output: Hello World 2024

    // Printf: formatted print (no auto newline)
    name := "Go"
    version := 1.22
    fmt.Printf("Language: %s, Version: %.2f\n", name, version)
    // Output: Language: Go, Version: 1.22

    // Print: print without newline
    fmt.Print("Waiting")
    fmt.Print("...")
    fmt.Println("Done!")
    // Output: Waiting...Done!

    // Sprintf: format to string (no printing)
    s := fmt.Sprintf("Welcome to %s!", name)
    fmt.Println(s)
    // Output: Welcome to Go!
}
```

**常用格式化动词：**

| 动词 | 用途 | 示例 |
|------|------|------|
| `%s` | 字符串 | `fmt.Printf("%s", "hello")` |
| `%d` | 十进制整数 | `fmt.Printf("%d", 42)` |
| `%f` | 浮点数 | `fmt.Printf("%.2f", 3.14)` |
| `%v` | 默认格式（万能） | `fmt.Printf("%v", anything)` |
| `%+v` | 带字段名的结构体 | `fmt.Printf("%+v", struct)` |
| `%#v` | Go 语法表示 | `fmt.Printf("%#v", value)` |
| `%T` | 类型名 | `fmt.Printf("%T", x)` |
| `%p` | 指针地址 | `fmt.Printf("%p", &x)` |
| `%%` | 输出 % | `fmt.Printf("100%%")` |

---

## Go 命令行工具

### go run — 编译并运行

```bash
# Compile and run immediately (temp binary, auto-deleted)
go run main.go

# Run multiple files
go run main.go utils.go

# Run with arguments
go run main.go arg1 arg2 arg3
```

### go build — 编译

```bash
# Build current directory, output binary named after directory
go build

# Build with custom output name
go build -o myapp main.go

# Build for different platforms
GOOS=linux GOARCH=amd64 go build -o myapp-linux
GOOS=windows GOARCH=amd64 go build -o myapp.exe
```

### go install — 编译并安装

```bash
# Compile and install binary to $GOPATH/bin (or $HOME/go/bin)
go install

# Now you can run it from anywhere (if $GOPATH/bin is in PATH)
myapp
```

### 其他常用命令

```bash
go test       # Run tests
go fmt        # Format code
go vet        # Report suspicious code
go mod tidy   # Clean up dependencies
go doc fmt    # View documentation
```

---

## 命令行参数 os.Args

```go
// args.go - Working with command line arguments
package main

import (
    "fmt"
    "os"
)

func main() {
    // os.Args holds all command line arguments
    // os.Args[0] is the program name itself
    // os.Args[1:] are the actual arguments

    fmt.Printf("Program name: %s\n", os.Args[0])
    fmt.Printf("Total args: %d\n", len(os.Args))

    if len(os.Args) > 1 {
        fmt.Println("Arguments:")
        for i, arg := range os.Args[1:] {
            fmt.Printf("  [%d] %s\n", i+1, arg)
        }
    } else {
        fmt.Println("No arguments provided.")
    }
}
```

### 使用 flag 包（更强大的参数解析）

```go
// flags.go - Using flag package for CLI arguments
package main

import (
    "flag"
    "fmt"
)

func main() {
    // Define flags with name, default value, and description
    name := flag.String("name", "World", "Name to greet")
    times := flag.Int("times", 1, "Number of times to greet")
    loud := flag.Bool("loud", false, "Use uppercase output")

    // Parse all flags
    flag.Parse()

    // Use the flag values (they are pointers!)
    greeting := fmt.Sprintf("Hello, %s!", *name)
    if *loud {
        greeting = fmt.Sprintf("HELLO, %s!", *name)
    }

    for i := 0; i < *times; i++ {
        fmt.Println(greeting)
    }

    // Remaining non-flag arguments
    fmt.Printf("Extra args: %v\n", flag.Args())
}
```

```bash
$ go run flags.go -name Go -times 3 -loud
HELLO, GO!
HELLO, GO!
HELLO, GO!
Extra args: []
```

---

## 执行预览

```bash
$ go run args.go hello world
Program name: /tmp/go-build123456/b001/exe/args
Total args: 3
Arguments:
  [1] hello
  [2] world

$ go run flags.go -name Gopher -times 2
Hello, Gopher!
Hello, Gopher!
Extra args: []
```

---

## 注意事项

| 事项 | 说明 |
|------|------|
| 左花括号 | `{` 必须和 `func` 在同一行，不能换行 |
| 未使用的导入 | 导入了包但不使用会编译错误，删除或用 `_` 忽略 |
| 未使用的变量 | 声明了变量但不使用会编译错误 |
| 大小写 | 大写开头 = 导出（public），小写开头 = 未导出（private） |
| `:=` vs `=` | `:=` 只能在函数内使用（短变量声明） |
| 分号 | Go 不需要手动加分号，编译器自动添加 |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `import` 了包但没用 | 删除未使用的 import，或用 `_` 占位 |
| 左花括号换行 `func main()\n{` | `func main() {` 保持同行 |
| 直接用 `os.Args` 不做边界检查 | 先检查 `len(os.Args)` 再访问 |
| 用 `flag.String()` 返回值当字符串用 | `flag` 返回的是指针，需要 `*name` 解引用 |
| 在 `package main` 外写 `func main()` | `main()` 必须在 `package main` 中 |

---

## 练习题

### 🟢 基础

1. 编写程序，用 `fmt.Printf` 输出你的姓名、年龄和爱好（使用不同格式化动词）
2. 编写程序，接收命令行参数并用 `os.Args` 打印所有参数
3. 使用 `go build` 编译程序，比较不同 GOOS 产出的二进制文件

### 🟡 进阶

4. 使用 `flag` 包编写一个程序，支持 `-width` 和 `-height` 参数，计算矩形面积
5. 编写程序，用 `fmt.Sprintf` 构建一个简单的 Markdown 格式输出

### 🔴 开放

6. 阅读 `flag` 包源码，理解其实现原理
7. 设计一个支持子命令的 CLI 程序结构（如 `git add`、`git commit`）

---

## 知识点总结

```
Hello World 深入
├── 程序结构
│   ├── package main（可执行程序入口包）
│   ├── import（导入标准库/第三方包）
│   ├── func main()（程序入口函数）
│   └── 大小写可见性规则
├── fmt 包
│   ├── Println（带换行，空格分隔）
│   ├── Printf（格式化输出）
│   ├── Print（原样输出）
│   ├── Sprintf（格式化到字符串）
│   └── 格式化动词（%s/%d/%f/%v/%T）
├── Go 命令
│   ├── go run（编译运行）
│   ├── go build（编译二进制）
│   ├── go install（编译安装）
│   └── go test / go fmt / go vet
└── 命令行参数
    ├── os.Args（原始参数切片）
    └── flag 包（结构化参数解析）
```

---

## 举一反三

| 场景 | Go 实现 | 其他语言对比 |
|------|---------|------------|
| 程序入口 | `func main()` | `if __name__ == "__main__"` (Python) / `public static void main` (Java) |
| 格式化输出 | `fmt.Printf("%s", s)` | `printf("%s", s)` (C) / `System.out.printf` (Java) |
| 命令行参数 | `os.Args` / `flag` | `sys.argv` / `argparse` (Python) |
| 包管理 | `import "fmt"` | `#include` (C) / `require` (Node.js) |
| 字符串拼接 | `fmt.Sprintf` / `+` | f-string (Python) / template literals (JS) |

---

## 参考资料

- [Go fmt 包文档](https://pkg.go.dev/fmt)
- [Go flag 包文档](https://pkg.go.dev/flag)
- [Go os 包文档](https://pkg.go.dev/os)
- [Go Command Documentation](https://pkg.go.dev/cmd/go)

---

## 代码演进

### v1: 最简 Hello World

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

### v2: 支持命令行参数

```go
// main.go - with os.Args
package main

import (
    "fmt"
    "os"
    "strings"
)

func main() {
    name := "World"
    if len(os.Args) > 1 {
        // Join all args as the name
        name = strings.Join(os.Args[1:], " ")
    }
    fmt.Printf("Hello, %s!\n", name)
}
```

### v3: 使用 flag 包 + 结构化参数

```go
// main.go - production-style CLI
package main

import (
    "flag"
    "fmt"
    "os"
    "strings"
)

func main() {
    name := flag.String("name", "World", "Name to greet")
    shout := flag.Bool("shout", false, "Uppercase the greeting")
    help := flag.Bool("help", false, "Show usage")
    flag.Parse()

    if *help {
        fmt.Println("Usage: hello [options] [extra args]")
        fmt.Println("Options:")
        flag.PrintDefaults()
        os.Exit(0)
    }

    // Combine -name flag with remaining positional args
    parts := []string{*name}
    parts = append(parts, flag.Args()...)
    full := strings.Join(parts, " ")

    greeting := fmt.Sprintf("Hello, %s!", full)
    if *shout {
        greeting = strings.ToUpper(greeting)
    }
    fmt.Println(greeting)
}
```

```bash
# v3 运行示例
$ go run main.go
Hello, World!

$ go run main.go -name Gopher
Hello, Gopher!

$ go run main.go -name Gopher -shout
HELLO, GOPHER!

$ go run main.go -help
Usage: hello [options] [extra args]
Options:
  -name string
        Name to greet (default "World")
  -shout
        Uppercase the greeting
  -help
        Show usage
```

---

*上一篇：[001-Go语言简介与环境搭建](/posts/001-go-intro-setup) | 下一篇：[003-Go基本数据类型](/posts/003-basic-types) →*
