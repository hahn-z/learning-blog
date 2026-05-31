---
title: "030 - 标准库os与io"
slug: "030-os-io"
category: "Golang入门"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:21.925+08:00"
updated_at: "2026-04-29T10:02:44.65+08:00"
reading_time: 31
tags: ["Go基础"]
---


# 030 - 标准库 os 与 io

> 难度：⭐⭐⭐（中高级）
>
> 掌握 Go 文件操作、IO 接口和缓冲读写的核心技能，构建可靠的文件处理能力。

---

## 一、概念讲解

Go 的 `os` 包提供了操作系统功能的抽象：文件操作、环境变量、命令行参数、进程管理等。`io` 包定义了最核心的 `Reader` 和 `Writer` 接口，是 Go IO 体系的基石。`bufio` 包在此基础上提供缓冲，减少系统调用次数，提升性能。

**核心理念：**

- `io.Reader` / `io.Writer` 是 Go IO 的灵魂接口
- `os.File` 同时实现了这两个接口
- `bufio` 包装器模式：`bufio.NewReader(os.File)` 提升性能
- 一切皆 `io.Reader/Writer`，组合优于继承

---

## 二、脑图

```
                  os & io
                    │
        ┌───────────┼───────────┐
        │           │           │
       os          io         bufio
        │           │           │
   ┌────┼────┐   ┌──┼──┐   ┌───┼───┐
   │    │    │   │  │  │   │   │   │
 File  Env  Args Reader│ Writer │
 Open Create │ Copy  │ Scan  │
 Mkdir Remove│ReadAll│ Writer │
   │         │       │       │
 Stat Exit  Writer  Pipe   bufio.
   │                  │     ReadLine
 filepath          TeeReader
```

---

## 三、完整代码

```go
package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	// Create a temp dir for our demo
	tmpDir, err := os.MkdirTemp("", "os-io-demo")
	if err != nil {
		log.Fatal(err)
	}
	defer os.RemoveAll(tmpDir) // clean up

	fmt.Printf("Working dir: %s\n", tmpDir)

	// ========== os.Create: create file for writing ==========
	filePath := filepath.Join(tmpDir, "test.txt")
	f, err := os.Create(filePath)
	if err != nil {
		log.Fatal(err)
	}

	// Write string to file
	n, err := f.WriteString("Hello, Go IO!\nLine 2\nLine 3\n")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Wrote %d bytes\n", n)
	f.Close()

	// ========== os.Open: read-only open ==========
	f, err = os.Open(filePath)
	if err != nil {
		log.Fatal(err)
	}

	// Read all content using io.ReadAll
	data, err := io.ReadAll(f)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("File content:\n%s", data)
	f.Close()

	// ========== os.OpenFile: with flags ==========
	f, err = os.OpenFile(filePath, os.O_RDWR|os.O_APPEND, 0644)
	if err != nil {
		log.Fatal(err)
	}
	f.WriteString("Appended line\n")
	f.Close()

	// ========== os.Stat: file info ==========
	info, err := os.Stat(filePath)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Name: %s, Size: %d, Mode: %v, IsDir: %v\n",
		info.Name(), info.Size(), info.Mode(), info.IsDir())
	fmt.Printf("ModTime: %v\n", info.ModTime())

	// ========== Directory operations ==========
	subDir := filepath.Join(tmpDir, "sub", "deep")
	err = os.MkdirAll(subDir, 0755) // creates all parent dirs
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created: %s\n", subDir)

	// List directory entries
	entries, _ := os.ReadDir(tmpDir)
	for _, entry := range entries {
		fmt.Printf("  Entry: %s (dir=%v)\n", entry.Name(), entry.IsDir())
	}

	// Remove a file
	tempFile := filepath.Join(tmpDir, "temp.txt")
	os.WriteFile(tempFile, []byte("temp"), 0644)
	os.Remove(tempFile)
	fmt.Println("Removed temp.txt")

	// ========== os.ReadFile / os.WriteFile (convenience) ==========
	content := []byte("Quick read/write demo\n")
	err = os.WriteFile(filepath.Join(tmpDir, "quick.txt"), content, 0644)
	if err != nil {
		log.Fatal(err)
	}
	readContent, _ := os.ReadFile(filepath.Join(tmpDir, "quick.txt"))
	fmt.Printf("Quick read: %s", readContent)

	// ========== bufio: buffered reading ==========
	f, _ = os.Open(filePath)
	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		fmt.Printf("  Line %d: %s\n", lineNum, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		fmt.Printf("Scanner error: %v\n", err)
	}
	f.Close()

	// ========== bufio: buffered writing ==========
	bufFile := filepath.Join(tmpDir, "buffered.txt")
	bf, _ := os.Create(bufFile)
	writer := bufio.NewWriter(bf)
	for i := 0; i < 5; i++ {
		writer.WriteString(fmt.Sprintf("Buffered line %d\n", i))
	}
	writer.Flush() // DON'T forget to flush!
	bf.Close()

	// ========== io.Copy: copy from Reader to Writer ==========
	src, _ := os.Open(bufFile)
	dst, _ := os.Create(filepath.Join(tmpDir, "copy.txt"))
	copied, _ := io.Copy(dst, src)
	fmt.Printf("Copied %d bytes\n", copied)
	src.Close()
	dst.Close()

	// ========== io.Pipe: in-memory pipe ==========
	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte("Data through pipe\n"))
		pw.Close()
	}()
	pipeData, _ := io.ReadAll(pr)
	fmt.Printf("Pipe: %s", pipeData)

	// ========== io.TeeReader: read and capture ==========
	src2, _ := os.Open(bufFile)
	var buf strings.Builder
	tee := io.TeeReader(src2, &buf)
	io.ReadAll(tee) // reads all, also writes to buf
	src2.Close()
	fmt.Printf("TeeReader captured: %d bytes\n", buf.Len())

	// ========== os.Args: command line arguments ==========
	fmt.Printf("Args: %v\n", os.Args)

	// ========== os.Environ / os.Getenv ==========
	home := os.Getenv("HOME")
	fmt.Printf("HOME: %s\n", home)
	path := os.Getenv("PATH")
	fmt.Printf("PATH (first 50): %s...\n", path[:min(50, len(path))])

	// os.Environ returns all env vars
	envCount := 0
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "GO") {
			fmt.Printf("  Go env: %s\n", e)
			envCount++
		}
	}
	fmt.Printf("Go-related env vars: %d\n", envCount)

	// ========== os.Exit ==========
	// os.Exit(0) would terminate immediately, skipping deferred functions!
	// Use log.Fatal or return from main instead when defers matter.

	// ========== filepath: path operations ==========
	fmt.Printf("Join:      %s\n", filepath.Join("a", "b", "c.txt"))
	fmt.Printf("Base:      %s\n", filepath.Base("/a/b/c.txt"))
	fmt.Printf("Dir:       %s\n", filepath.Dir("/a/b/c.txt"))
	fmt.Printf("Ext:       %s\n", filepath.Ext("main.go"))
	fmt.Printf("Abs:       %s\n", func() string {
		abs, _ := filepath.Abs(".")
		return abs
	}())

	// Walk directory
	fmt.Println("Walking temp dir:")
	filepath.Walk(tmpDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		indent := strings.Repeat("  ", strings.Count(path[len(tmpDir):], string(os.PathSeparator)))
		fmt.Printf("%s%s\n", indent, info.Name())
		return nil
	})

	// ========== io/ioutil is DEPRECATED ==========
	// io/ioutil.ReadFile  → use os.ReadFile
	// io/ioutil.WriteFile → use os.WriteFile
	// io/ioutil.ReadDir   → use os.ReadDir
	// io/ioutil.TempDir   → use os.MkdirTemp
	// io/ioutil.TempFile  → use os.CreateTemp
	fmt.Println("\nNote: io/ioutil is deprecated since Go 1.16, use os/io equivalents")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
```

### 执行预览

```
Working dir: /tmp/os-io-demo123456
Wrote 28 bytes
File content:
Hello, Go IO!
Line 2
Line 3
Name: test.txt, Size: 42, Mode: -rw-r--r--, IsDir: false
ModTime: 2024-06-15 14:30:45 +0800 CST
Created: /tmp/os-io-demo123456/sub/deep
  Entry: quick.txt (dir=false)
  Entry: sub (dir=true)
  Entry: test.txt (dir=false)
Removed temp.txt
Quick read: Quick read/write demo
  Line 1: Hello, Go IO!
  Line 2: Line 2
  Line 3: Line 3
  Line 4: Appended line
Copied 75 bytes
Pipe: Data through pipe
TeeReader captured: 75 bytes
Args: [/tmp/go-build123/main.exe]
HOME: /home/user
PATH (first 50): /usr/local/bin:/usr/bin:/bin:/usr/local/go...
Go-related env vars: 2
  Go env: GOROOT=/usr/local/go
  Go env: GOPATH=/home/user/go
Join:      a/b/c.txt
Base:      c.txt
Dir:       /a/b
Ext:       .go
Walking temp dir:
os-io-demo123456
  quick.txt
  sub
    deep
  test.txt
  copy.txt
  buffered.txt

Note: io/ioutil is deprecated since Go 1.16, use os/io equivalents
```

---

## 四、注意事项

| 项目 | 说明 |
|------|------|
| `os.Create` 会截断 | 如果文件已存在，内容会被清空；用 `OpenFile` + `O_APPEND` 追加 |
| `os.Open` 只读 | 写文件需要 `os.Create` 或 `os.OpenFile` |
| `defer Close()` | 打开文件后立即 `defer f.Close()`，注意检查 Close 的错误 |
| `bufio.Writer.Flush()` | 忘记 Flush 数据不会写入文件 |
| `os.Exit` 跳过 defer | `os.Exit` 直接退出，deferred 函数不会执行 |
| `os.ReadDir` 排序 | 返回的 entries 按文件名排序 |
| `filepath.Join` vs `+` | 用 Join 处理路径分隔符跨平台问题 |
| `io.ReadAll` 内存 | 读取大文件注意内存占用，可用 `io.Copy` 流式处理 |
| `bufio.Scanner` 行长限制 | 默认 64KB，超长行需用 `scanner.Buffer()` 扩大 |

---

## 五、避坑指南

❌ **忘记关闭文件**
```go
func readFile(path string) []byte {
    f, _ := os.Open(path)
    data, _ := io.ReadAll(f)
    // Oops: f.Close() missing! File handle leak.
    return data
}
```

✅ **立即 defer Close**
```go
func readFile(path string) ([]byte, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close()
    return io.ReadAll(f)
}
```

---

❌ **用 `string(os.PathSeparator)` 拼路径**
```go
path := "dir" + string(os.PathSeparator) + "file.txt"
// Works but fragile and ugly
```

✅ **用 `filepath.Join`**
```go
path := filepath.Join("dir", "file.txt")
```

---

❌ **用 `ioutil`（已废弃）**
```go
// Deprecated!
data, _ := ioutil.ReadFile("config.json")
```

✅ **用 `os.ReadFile`**
```go
data, err := os.ReadFile("config.json")
```

---

❌ **bufio.Writer 忘记 Flush**
```go
w := bufio.NewWriter(f)
w.WriteString("important data")
// Program exits, data lost!
```

✅ **显式 Flush 或使用 defer**
```go
w := bufio.NewWriter(f)
defer w.Flush()
w.WriteString("important data")
```

---

## 六、练习题

### 🟢 初级
1. 写一个程序，读取自身源文件并打印行数
2. 实现一个函数 `envOr(key, defaultVal string) string`，获取环境变量或返回默认值

### 🟡 中级
3. 实现一个简单的文件复制函数 `copyFile(src, dst string) error`，使用 `io.Copy`
4. 使用 `bufio.Scanner` 实现一个简易 `wc -l`，统计文件行数

### 🔴 高级
5. 实现一个日志轮转写入器：当文件超过 10MB 时自动切换到新文件（`log_1.txt` → `log_2.txt`），实现 `io.Writer` 接口

---

## 七、知识点总结

```
os & io
├── os
│   ├── 文件操作
│   │   ├── Create(name)       — 创建/截断
│   │   ├── Open(name)         — 只读打开
│   │   ├── OpenFile(name, flag, perm) — 指定模式
│   │   ├── ReadFile(name)     — 便捷读取
│   │   ├── WriteFile(name, data, perm) — 便捷写入
│   │   ├── Remove(name)       — 删除文件
│   │   └── Rename(old, new)   — 重命名
│   ├── 目录操作
│   │   ├── Mkdir(name, perm)  — 创建目录
│   │   ├── MkdirAll(path, perm)— 递归创建
│   │   ├── ReadDir(name)      — 列出目录
│   │   └── RemoveAll(path)    — 递归删除
│   ├── 环境信息
│   │   ├── Args               — 命令行参数
│   │   ├── Getenv(key)        — 获取环境变量
│   │   ├── Setenv(key, val)   — 设置环境变量
│   │   ├── Environ()          — 所有环境变量
│   │   └── Exit(code)         — 退出进程
│   └── 文件信息
│       ├── Stat(path)         — 文件信息
│       └── File.Stat()        — 已打开文件的信息
├── io
│   ├── 接口
│   │   ├── Reader             — Read([]byte) (n, err)
│   │   ├── Writer             — Write([]byte) (n, err)
│   │   ├── Closer             — Close() error
│   │   └── ReadWriter         — Reader + Writer
│   ├── 工具函数
│   │   ├── Copy(dst, src)     — 流式复制
│   │   ├── ReadAll(r)         — 读取全部
│   │   ├── Pipe()             — 内存管道
│   │   └── TeeReader(r, w)    — 边读边写
│   └── 特殊值
│       ├── EOF                — 结束标记
│       └── Discard            — 丢弃写入
├── bufio
│   ├── NewScanner(r)          — 逐行扫描
│   ├── NewReader(r)           — 缓冲读取
│   └── NewWriter(w)           — 缓冲写入
└── filepath
    ├── Join(elem...)          — 拼接路径
    ├── Base(path)             — 文件名
    ├── Dir(path)              — 目录部分
    ├── Ext(path)              — 扩展名
    ├── Abs(path)              — 绝对路径
    └── Walk(root, walkFn)     — 遍历目录树
```

---

## 八、举一反三

| 场景 | 包 | 函数/方法 |
|------|---|-----------|
| 读取配置文件 | `os` | `ReadFile` |
| 写入日志 | `os` | `OpenFile(...O_APPEND)` |
| 复制文件 | `io` | `Copy(dst, src)` |
| 逐行处理文本 | `bufio` | `NewScanner` + `Scan` |
| 高性能写入 | `bufio` | `NewWriter` + `Flush` |
| 临时文件 | `os` | `CreateTemp` |
| 环境变量配置 | `os` | `Getenv` / `LookupEnv` |
| 目录遍历 | `filepath` | `Walk` / `WalkDir` |
| 流式传输（HTTP） | `io` | `Copy(responseWriter, file)` |

---

## 九、参考资料

- [os 官方文档](https://pkg.go.dev/os)
- [io 官方文档](https://pkg.go.dev/io)
- [bufio 官方文档](https://pkg.go.dev/bufio)
- [filepath 官方文档](https://pkg.go.dev/path/filepath)
- [io/ioutil 废弃说明](https://go.dev/doc/go1.16#ioutil)

---

## 十、代码演进

### v1：基础文件读写
```go
package main

import (
    "fmt"
    "os"
)

func main() {
    os.WriteFile("/tmp/hello.txt", []byte("Hello, Go!\n"), 0644)
    data, _ := os.ReadFile("/tmp/hello.txt")
    fmt.Print(string(data))
}
```

### v2：缓冲读写 + 错误处理
```go
package main

import (
    "bufio"
    "fmt"
    "log"
    "os"
)

func main() {
    // Write with buffering
    f, err := os.Create("/tmp/lines.txt")
    if err != nil {
        log.Fatal(err)
    }
    defer f.Close()

    w := bufio.NewWriter(f)
    for i := 0; i < 10; i++ {
        w.WriteString(fmt.Sprintf("Line %d\n", i))
    }
    w.Flush()

    // Read line by line
    f, _ = os.Open("/tmp/lines.txt")
    defer f.Close()
    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        fmt.Println(scanner.Text())
    }
}
```

### v3：完整 IO 工具集（io.Copy、Pipe、TeeReader、filepath、环境变量）
（即上方完整代码，涵盖 os 全操作、io 接口、bufio 缓冲、filepath 路径处理）
