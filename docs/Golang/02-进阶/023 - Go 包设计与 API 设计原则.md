---
title: "023 - Go 包设计与 API 设计原则"
slug: "023-gorm"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.181+08:00"
updated_at: "2026-04-29T10:02:44.86+08:00"
reading_time: 21
tags: ["数据库"]
---

# 053 - Go 包设计与 API 设计原则

> **难度：⭐⭐⭐⭐** | 好的包设计让代码自解释，好的 API 让使用者愉悦。这是区分新手与专家的分水岭。

## 一、概念讲解

Go 的包（package）是代码组织的基本单元。一个好的包应该：
1. **高内聚**：包内的类型和函数围绕一个明确的职责
2. **低耦合**：包与包之间通过最小接口交互
3. **小 API 面**：暴露的函数和类型越少越好
4. **不可变优先**：暴露的结构体字段越少越好

### 核心设计模式

**选项模式（Functional Options）** 是 Go 中最流行的 API 设计模式，让构造函数既能有默认值，又能灵活定制：

```go
// Functional Options pattern
type Option func(*Server)

func WithPort(port int) Option {
    return func(s *Server) { s.port = port }
}

func NewServer(opts ...Option) *Server {
    s := &Server{port: 8080} // defaults
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## 二、脑图

```
包设计原则
├── 包的内聚性
│   ├── 按职责划分 (not 按类型)
│   ├── 包名即文档
│   └── 避免 util / common / base
├── 最小 API 面
│   ├── 最少导出符号
│   ├── 内部实现用 internal
│   └── 接口最小化
├── 设计模式
│   ├── Functional Options
│   ├── Builder 模式
│   ├── 接口隔离
│   └── 零值可用
├── 文档
│   ├── go doc
│   ├── Example 测试
│   └── 包注释
└── 反模式
    ├── 暴露 channel / mutex
    ├── 返回具体实现
    └── init() 滥用
```

## 三、代码演进

### v1：反面教材 - 暴露内部实现

```go
// Package user - BAD DESIGN (anti-pattern)
package user

import "sync"

// User represents a system user
type User struct {
	mu     sync.RWMutex  // exported by mistake in bad design
	Name   string
	Email  string
	cache  map[string]string
}

// All exported - violates encapsulation
var AllUsers = make(map[string]*User)
var DefaultClient *http.Client
```

### v2：改进 - 最小 API 面 + 结构体封装

```go
// Package user provides user management.
//
// Basic usage:
//
//	store := user.NewStore(db)
//	u, err := store.Get(ctx, "user-123")
package user

import (
	"context"
	"sync"
)

// User represents a system user.
type User struct {
	id    string
	name  string
	email string
}

// ID returns the user's unique identifier.
func (u *User) ID() string { return u.id }

// Name returns the user's display name.
func (u *User) Name() string { return u.name }

// Email returns the user's email address.
func (u *User) Email() string { return u.email }

// Store manages user persistence.
type Store struct {
	mu     sync.RWMutex
	cache  map[string]*User
	db     Database // interface, not concrete type
}

// Database abstracts the persistence layer.
type Database interface {
	FindOne(ctx context.Context, table, id string, dest interface{}) error
	Insert(ctx context.Context, table string, doc interface{}) error
}

// NewStore creates a user store with the given database.
func NewStore(db Database) *Store {
	return &Store{
		cache: make(map[string]*User),
		db:    db,
	}
}

// Get retrieves a user by ID.
func (s *Store) Get(ctx context.Context, id string) (*User, error) {
	s.mu.RLock()
	if u, ok := s.cache[id]; ok {
		s.mu.RUnlock()
		return u, nil
	}
	s.mu.RUnlock()

	var u User
	if err := s.db.FindOne(ctx, "users", id, &u); err != nil {
		return nil, fmt.Errorf("find user %s: %w", id, err)
	}
	s.mu.Lock()
	s.cache[id] = &u
	s.mu.Unlock()
	return &u, nil
}
```

### v3：Functional Options + Builder + 完整 API 设计

```go
// Package server provides a configurable HTTP server.
//
// Use Functional Options for construction:
//
//	s := server.New(server.WithPort(3000), server.WithTimeout(30))
//	s.Run()
package server

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Option configures a Server using the Functional Options pattern.
type Option func(*Server)

// WithPort sets the listening port.
func WithPort(port int) Option {
	return func(s *Server) { s.port = port }
}

// WithTimeout sets read and write timeouts in seconds.
func WithTimeout(seconds int) Option {
	return func(s *Server) {
		s.readTimeout = time.Duration(seconds) * time.Second
		s.writeTimeout = time.Duration(seconds) * time.Second
	}
}

// WithMiddleware adds HTTP middleware.
func WithMiddleware(mw func(http.Handler) http.Handler) Option {
	return func(s *Server) {
		s.middleware = append(s.middleware, mw)
	}
}

// WithLogger sets a custom logger.
func WithLogger(logger Logger) Option {
	return func(s *Server) { s.logger = logger }
}

// Logger abstracts logging to avoid coupling to a specific library.
type Logger interface {
	Infof(format string, args ...interface{})
	Errorf(format string, args ...interface{})
}

// Server is a configured HTTP server.
type Server struct {
	port         int
	readTimeout  time.Duration
	writeTimeout time.Duration
	middleware   []func(http.Handler) http.Handler
	logger       Logger
	handler      http.Handler
	httpServer   *http.Server
}

// New creates a Server with the given options.
func New(handler http.Handler, opts ...Option) *Server {
	s := &Server{
		port:         8080,
		readTimeout:  10 * time.Second,
		writeTimeout: 10 * time.Second,
		handler:      handler,
		logger:       &defaultLogger{},
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Run starts the server (blocking).
func (s *Server) Run() error {
	// Apply middleware chain
	h := s.handler
	for i := len(s.middleware) - 1; i >= 0; i-- {
		h = s.middleware[i](h)
	}

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      h,
		ReadTimeout:  s.readTimeout,
		WriteTimeout: s.writeTimeout,
	}

	s.logger.Infof("Server starting on :%d", s.port)
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully stops the server.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Infof("Server shutting down...")
	return s.httpServer.Shutdown(ctx)
}

// --- Builder pattern alternative for complex configurations ---

// RequestBuilder demonstrates the Builder pattern for constructing requests.
type RequestBuilder struct {
	method  string
	url     string
	headers map[string]string
	body    []byte
}

// NewRequestBuilder creates a builder for an HTTP request.
func NewRequestBuilder(method, url string) *RequestBuilder {
	return &RequestBuilder{
		method:  method,
		url:     url,
		headers: make(map[string]string),
	}
}

// WithHeader adds a header to the request.
func (b *RequestBuilder) WithHeader(key, value string) *RequestBuilder {
	b.headers[key] = value
	return b
}

// WithBody sets the request body.
func (b *RequestBuilder) WithBody(body []byte) *RequestBuilder {
	b.body = body
	return b
}

// Build constructs the final HTTP request.
func (b *RequestBuilder) Build() (*http.Request, error) {
	req, err := http.NewRequest(b.method, b.url, bytes.NewReader(b.body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	for k, v := range b.headers {
		req.Header.Set(k, v)
	}
	return req, nil
}

// defaultLogger is a minimal logger implementation.
type defaultLogger struct{}

func (d *defaultLogger) Infof(format string, args ...interface{})  {
	fmt.Printf("[INFO] "+format+"\n", args...)
}
func (d *defaultLogger) Errorf(format string, args ...interface{}) {
	fmt.Printf("[ERROR] "+format+"\n", args...)
}
```

**执行预览（Example 测试）：**
```
$ go test -v -run Example
=== RUN   ExampleNew
--- PASS: ExampleNew (0.00s)
=== RUN   ExampleRequestBuilder
--- PASS: ExampleRequestBuilder (0.00s)
```

## 四、注意事项

| 项目 | 说明 |
|------|------|
| 包名用小写单词 | `user` 不 `userModel`，`http` 不 `httpUtil` |
| 避免 `utils` / `common` | 按职责命名，如 `httputil` → `routing` |
| `internal` 目录 | Go 编译器强制限制，外部包无法导入 |
| 导出类型要稳定 | 一旦导出就是 API 契约，改名要谨慎 |
| Example 测试 | 即是测试又是文档，`go doc` 会展示 |

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 包名 `util` / `common` / `helper` | 按职责命名：`jsonutil` → `encoding` |
| 暴露 `sync.Mutex` 字段 | 内部持有，通过方法控制访问 |
| 构造函数用 `Config` 大结构体 | Functional Options：灵活且有默认值 |
| 返回 `*os.File` 等具体类型 | 返回 `io.Reader` 接口 |
| `init()` 里做复杂逻辑 | 显式初始化函数 `NewXxx()` |
| 一个包放所有东西 | 按职责拆分，包不超过 ~20 个导出符号 |

## 六、练习题

🟢 **基础：** 将一个 `utils.go` 文件按职责拆分为 2-3 个有明确命名的包。

🟡 **进阶：** 为一个 HTTP Client 设计 Functional Options API，支持超时、重试、自定义 Transport。

🔴 **挑战：** 设计一个插件系统：定义接口包（只含接口）、内部实现包（`internal/`）、外部使用包，确保使用者只能通过接口交互。

## 七、知识点总结

```
包设计与 API
├── 包设计原则
│   ├── 高内聚低耦合
│   ├── 包名即文档 (小写单词)
│   ├── internal 强制封装
│   └── 最小导出面
├── API 设计模式
│   ├── Functional Options
│   ├── Builder
│   ├── 零值可用
│   └── 接口最小化
├── 文档
│   ├── 包注释
│   ├── go doc
│   └── Example 测试
└── 反模式
    ├── util/common 包
    ├── 暴露内部实现
    └── init() 滥用
```

## 八、举一反三

| 场景 | 推荐模式 |
|------|---------|
| 构造函数有可选参数 | Functional Options |
| 构建复杂对象（SQL 查询等） | Builder 模式 |
| 多种实现可替换 | 接口 + 依赖注入 |
| 插件/扩展系统 | 接口包 + internal 实现 |
| 库的配置项很多 | Functional Options + 合理默认值 |

## 九、参考资料

- [Go 包设计原则 - Dave Cheney](https://dave.cheney.net/2019/01/08/avoid-package-names-like-base-util-or-common)
- [Functional Options - Rob Pike](https://commandcenter.blogspot.com/2014/01/self-referential-functions-and-design.html)
- [Go Doc 官方](https://go.dev/doc/comment)
- [Go 标准库包设计](https://go.dev/blog/package-names)
