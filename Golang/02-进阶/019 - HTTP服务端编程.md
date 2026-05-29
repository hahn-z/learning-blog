---
title: "019 - HTTP服务端编程"
slug: "019-http-server"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.141+08:00"
updated_at: "2026-04-29T10:02:44.812+08:00"
reading_time: 23
tags: ["Web开发"]
---

# 049 - HTTP服务端编程

> 难度：⭐⭐⭐ | 预计学习时间：35分钟

## 一、概念讲解

Go的 `net/http` 包内置了生产级的HTTP服务器。核心接口是 `http.Handler`，配合 `http.ServeMux` 路由器和中间件模式，可以构建灵活的Web服务。

关键组件：
- **http.Handler** 接口：`ServeHTTP(ResponseWriter, *Request)`
- **http.HandleFunc**：将函数转为Handler
- **http.ServeMux**：内置路由器（支持路径前缀匹配）
- **中间件**：包裹Handler实现横切关注点（日志、认证等）
- **http.Server**：服务器配置（超时、TLS等）

## 二、脑图

```
HTTP服务端编程
├── 基础
│   ├── http.HandleFunc 注册路由
│   ├── http.ListenAndServe 启动
│   ├── ResponseWriter 响应写入
│   └── Request 请求解析
├── 路由
│   ├── ServeMux 路由匹配
│   ├── 精确匹配 vs 前缀匹配
│   └── 路由参数(手动解析)
├── 中间件
│   ├── 函数签名: func(Handler) Handler
│   ├── 链式调用
│   └── 常见: 日志/认证/CORS/限流
├── 请求处理
│   ├── Query参数
│   ├── Header
│   ├── Body解析
│   ├── Form/JSON
│   └── Cookie
├── 响应
│   ├── JSON响应
│   ├── 文件下载
│   ├── 重定向
│   └── SSE (Server-Sent Events)
└── 运维
    ├── Graceful Shutdown
    ├── HTTPS/TLS
    ├── 超时配置
    └── http.Server配置
```

## 三、完整Go代码

### v1: 基础路由 + JSON API

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type User struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

func main() {
	mux := http.NewServeMux()

	// Simple handler
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Welcome! Path: %s\n", r.URL.Path)
	})

	// JSON API endpoint
	mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{
			Status: "ok", Message: "Hello, World!",
		})
	})

	// POST endpoint - read JSON body
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var user User
		if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status": "created",
			"user":   user,
		})
	})

	// Query parameters
	mux.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		page := r.URL.Query().Get("page")
		if page == "" {
			page = "1"
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"query": q,
			"page":  page,
		})
	})

	fmt.Println("Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

**执行预览：**
```bash
# curl http://localhost:8080/
Welcome! Path: /

# curl http://localhost:8080/api/hello
{"status":"ok","message":"Hello, World!"}

# curl -X POST http://localhost:8080/api/users -d '{"name":"Alice","email":"alice@test.com"}'
{"status":"created","user":{"name":"Alice","email":"alice@test.com"}}

# curl "http://localhost:8080/api/search?q=go&page=2"
{"page":"2","query":"go"}
```

### v2: 中间件链

```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Middleware type: wraps a handler
type Middleware func(http.Handler) http.Handler

// Chain middlewares: m1(m2(m3(final)))
func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}

// Logging middleware
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

// CORS middleware
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Auth middleware (simple Bearer token check)
func Auth(token string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+token {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "unauthorized",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/public", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"msg": "public endpoint"})
	})

	mux.HandleFunc("/private", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"msg": "secret data"})
	})

	// Apply middleware chain
	handler := Chain(mux, Logging, CORS)

	// For private routes, add auth
	protectedMux := http.NewServeMux()
	protectedMux.HandleFunc("/private", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"msg": "secret data"})
	})

	log.Println("Server on :8080 with middleware")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
```

### v3: Graceful Shutdown + HTTPS

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "running",
			"message": "Server is healthy",
		})
	})

	mux.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(3 * time.Second) // simulate slow work
		w.Write([]byte("Done after delay\n"))
	})

	// Configure server with timeouts
	server := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown: listen for signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		fmt.Println("Server starting on :8080")
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-quit // Wait for interrupt signal
	fmt.Println("\nShutting down gracefully...")

	// Give outstanding requests 5 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	fmt.Println("Server stopped")

	// HTTPS version (commented - needs cert files):
	// server.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	// server.ListenAndServeTLS("cert.pem", "key.pem")
}
```

**执行预览：**
```bash
# Start server
Server starting on :8080

# In another terminal:
curl http://localhost:8080/
{"status":"running","message":"Server is healthy"}

# Send SIGINT (Ctrl+C)
^C
Shutting down gracefully...
Server stopped
```

## 四、注意事项

| 要点 | 说明 |
|------|------|
| ServeMux前缀匹配 | `/api/` 会匹配 `/api/` 及其子路径，`/api` 不含尾部斜杠则精确匹配 |
| 响应顺序 | 先设置Header/StatusCode，再写入Body |
| Body必须读取 | 即使不用Body也要读取或关闭，否则连接无法复用 |
| 超时很重要 | 无超时配置的服务器面对慢客户端会耗尽资源 |
| goroutine安全 | Handler在独立goroutine中运行，注意并发安全 |
| Context传播 | 用r.Context()获取请求context，支持取消 |

## 五、避坑指南

❌ 不设超时：
```go
http.ListenAndServe(":8080", nil) // 默认无超时
```
✅ 使用http.Server配置超时：
```go
&http.Server{
    ReadTimeout:  5*time.Second,
    WriteTimeout: 10*time.Second,
}
```

❌ 写完Body再设状态码：
```go
w.Write(data)
w.WriteHeader(200) // 太晚了！已默认200
```
✅ 先Header后Body：
```go
w.WriteHeader(200)
w.Write(data)
```

❌ 用http.ListenAndServe做Graceful Shutdown：
```go
http.ListenAndServe(":8080", mux) // 无法优雅关闭
```
✅ 用http.Server + Shutdown

❌ 忽略METHOD检查：
```go
func handler(w, r) {
    // 任何方法都响应，不安全
}
```
✅ 检查方法：
```go
if r.Method != http.MethodGet {
    http.Error(w, "Method not allowed", 405)
    return
}
```

## 六、练习题

🟢 **基础题：** 实现一个静态文件服务器，提供当前目录的文件访问，自定义404页面。

🟡 **进阶题：** 实现完整的RESTful CRUD API（内存存储），包含中间件（日志+认证），支持JSON请求/响应。

🔴 **挑战题：** 实现一个支持SSE(Server-Sent Events)的实时推送服务，客户端连接后定期接收服务器时间，支持Graceful Shutdown。

## 七、知识点总结

```
HTTP服务端
├── 核心
│   ├── Handler接口
│   ├── ServeMux路由
│   └── http.Server
├── 请求处理
│   ├── Method判断
│   ├── URL/Query解析
│   ├── Header读取
│   ├── Body解码(JSON/Form)
│   └── Cookie管理
├── 中间件
│   ├── 函数签名
│   ├── 链式组合
│   └── 常见模式
└── 运维
    ├── 超时配置
    ├── Graceful Shutdown
    ├── HTTPS/TLS
    └── 信号处理
```

## 八、举一反三

| 场景 | 方案 | 关键组件 |
|------|------|----------|
| REST API | ServeMux + JSON | HandleFunc + json.Encoder |
| 静态文件 | http.FileServer | mux.Handle("/static/", ...) |
| SPA应用 | 首页fallback | 检查路径→返回index.html |
| API网关 | 反向代理中间件 | httputil.ReverseProxy |
| WebSocket | gorilla/websocket | Upgrade协议 |
| 微服务 | + gRPC gateway | 双协议支持 |

## 九、参考资料

- [Go官方文档：net/http](https://pkg.go.dev/net/http)
- [Writing Web Applications (Go Wiki)](https://go.dev/doc/articles/wiki/)
- [Graceful Shutdown in Go](https://pkg.go.dev/net/http#Server.Shutdown)

## 十、代码演进总结

| 版本 | 重点 | 适用场景 |
|------|------|----------|
| v1 | 基础路由+JSON API | 简单Web服务原型 |
| v2 | 中间件链 | 生产级Web应用 |
| v3 | Graceful Shutdown+HTTPS | 可运维的生产服务 |
