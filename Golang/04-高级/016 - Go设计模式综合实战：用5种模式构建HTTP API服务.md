---
title: "016 - Go设计模式综合实战：用5种模式构建HTTP API服务"
slug: "016-patterns-summary"
category: "Golang高级"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.647+08:00"
updated_at: "2026-04-29T10:02:45.214+08:00"
reading_time: 32
tags: ["设计模式"]
---

# Go设计模式综合实战：用5种模式构建HTTP API服务

> **难度标注：** ⭐⭐⭐⭐☆ 高级
> **前置知识：** Go基础、HTTP服务、接口、并发
> **预计用时：** 60分钟

---

## 一、概念讲解

设计模式不是教条，而是解决特定问题的工具箱。本文通过一个真实场景——构建一个支持多种认证方式、多种存储后端的HTTP API服务——综合运用5种经典设计模式。

| 模式 | 解决的问题 | 本场景应用 |
|------|-----------|-----------|
| 策略模式 | 算法族切换 | 认证方式（JWT/Session/APIKey） |
| 工厂模式 | 对象创建解耦 | 存储后端（MySQL/Redis/Mongo） |
| 中间件模式 | 横切关注点分离 | 日志、限流、认证链 |
| 单例模式 | 全局唯一实例 | 配置管理、连接池 |
| 观察者模式 | 事件驱动通信 | 操作审计、缓存失效 |

---

## 二、脑图（ASCII）

```
                    ┌──────────────┐
                    │  API Server  │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────┴──────┐ ┌────┴────┐ ┌──────┴──────┐
     │  Middleware  │ │ Handler │ │   Storage   │
     │    Chain    │ │  Router  │ │   Factory   │
     └──────┬──────┘ └────┬────┘ └──────┬──────┘
            │              │              │
     ┌──────┼──────┐      │       ┌──────┼──────┐
     │      │      │      │       │      │      │
   Auth  Logger  Rate   Route   MySQL  Redis  Mongo
  Strategy          Limit  Handler
     │
  ┌──┼──┐
  │  │  │
 JWT Ses Key
```

---

## 三、完整Go代码

### v1 基础版本：策略模式 + 工厂模式

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// ============================================================
// Strategy Pattern: Authentication strategies
// ============================================================

// AuthStrategy defines how to authenticate a request
type AuthStrategy interface {
	Authenticate(r *http.Request) (userID string, err error)
	Name() string
}

// JWTAuth implements token-based authentication
type JWTAuth struct {
	secret string
}

func (j *JWTAuth) Authenticate(r *http.Request) (string, error) {
	token := r.Header.Get("Authorization")
	if token == "" {
		return "", fmt.Errorf("missing authorization header")
	}
	// Simplified JWT validation (use golang-jwt in production)
	if len(token) < 10 {
		return "", fmt.Errorf("invalid token")
	}
	return "user_from_jwt", nil
}

func (j *JWTAuth) Name() string { return "JWT" }

// APIKeyAuth implements API key authentication
type APIKeyAuth struct {
	keys map[string]string // apiKey -> userID
}

func (a *APIKeyAuth) Authenticate(r *http.Request) (string, error) {
	key := r.Header.Get("X-API-Key")
	if key == "" {
		return "", fmt.Errorf("missing API key")
	}
	if uid, ok := a.keys[key]; ok {
		return uid, nil
	}
	return "", fmt.Errorf("invalid API key")
}

func (a *APIKeyAuth) Name() string { return "APIKey" }

// ============================================================
// Factory Pattern: Storage backends
// ============================================================

// Storage defines data persistence interface
type Storage interface {
	Get(key string) (string, error)
	Set(key, value string) error
	Delete(key string) error
	Name() string
}

// MemoryStorage is an in-memory implementation
type MemoryStorage struct {
	mu   sync.RWMutex
	data map[string]string
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{data: make(map[string]string)}
}

func (m *MemoryStorage) Get(key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, ok := m.data[key]
	if !ok {
		return "", fmt.Errorf("key not found: %s", key)
	}
	return v, nil
}

func (m *MemoryStorage) Set(key, value string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = value
	return nil
}

func (m *MemoryStorage) Delete(key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}

func (m *MemoryStorage) Name() string { return "Memory" }

// StorageFactory creates storage by type name
type StorageFactory struct{}

func (f *StorageFactory) Create(storageType string) Storage {
	switch storageType {
	case "memory":
		return NewMemoryStorage()
	default:
		return NewMemoryStorage() // default fallback
	}
}

// ============================================================
// Singleton Pattern: Configuration manager
// ============================================================

type Config struct {
	AuthType    string
	StorageType string
	Port        string
}

var (
	config     *Config
	configOnce sync.Once
)

func GetConfig() *Config {
	configOnce.Do(func() {
		config = &Config{
			AuthType:    "jwt",
			StorageType: "memory",
			Port:        ":8080",
		}
	})
	return config
}

// ============================================================
// Middleware Pattern: Chain of responsibility
// ============================================================

// Middleware is a function that wraps an http.Handler
type Middleware func(http.Handler) http.Handler

// Chain builds a middleware chain
func Chain(middlewares ...Middleware) Middleware {
	return func(final http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// LoggingMiddleware logs request details
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

// AuthMiddleware authenticates requests using the configured strategy
func AuthMiddleware(strategy AuthStrategy) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, err := strategy.Authenticate(r)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			r.Header.Set("X-User-ID", uid)
			next.ServeHTTP(w, r)
		})
	}
}

// ============================================================
// Observer Pattern: Event system
// ============================================================

// Event represents something that happened
type Event struct {
	Type string
	Data map[string]interface{}
}

// Observer listens for events
type Observer interface {
	Notify(event Event)
}

// EventBus distributes events to observers
type EventBus struct {
	mu        sync.RWMutex
	observers map[string][]Observer
}

func NewEventBus() *EventBus {
	return &EventBus{
		observers: make(map[string][]Observer),
	}
}

func (eb *EventBus) Subscribe(eventType string, o Observer) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	eb.observers[eventType] = append(eb.observers[eventType], o)
}

func (eb *EventBus) Publish(event Event) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	for _, o := range eb.observers[event.Type] {
		go o.Notify(event) // async notification
	}
}

// AuditLogger is an observer that logs all events
type AuditLogger struct{}

func (a *AuditLogger) Notify(event Event) {
	log.Printf("[AUDIT] %s: %v", event.Type, event.Data)
}

// ============================================================
// HTTP Handlers
// ============================================================

type API struct {
	storage  Storage
	eventBus *EventBus
}

func (api *API) HandleGet(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	val, err := api.storage.Get(key)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	api.eventBus.Publish(Event{
		Type: "data.access",
		Data: map[string]interface{}{"key": key, "user": r.Header.Get("X-User-ID")},
	})
	json.NewEncoder(w).Encode(map[string]string{"key": key, "value": val})
}

func (api *API) HandleSet(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	api.storage.Set(body.Key, body.Value)
	api.eventBus.Publish(Event{
		Type: "data.update",
		Data: map[string]interface{}{"key": body.Key, "user": r.Header.Get("X-User-ID")},
	})
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ============================================================
// Main: Wire everything together
// ============================================================

func main() {
	cfg := GetConfig()

	// Factory creates storage
	factory := &StorageFactory{}
	storage := factory.Create(cfg.StorageType)

	// Strategy for auth
	var authStrategy AuthStrategy
	switch cfg.AuthType {
	case "jwt":
		authStrategy = &JWTAuth{secret: "my-secret"}
	case "apikey":
		authStrategy = &APIKeyAuth{keys: map[string]string{"test-key": "user1"}}
	default:
		authStrategy = &JWTAuth{secret: "my-secret"}
	}

	// Observer: event bus
	eventBus := NewEventBus()
	eventBus.Subscribe("data.update", &AuditLogger{})
	eventBus.Subscribe("data.access", &AuditLogger{})

	// Build API
	api := &API{storage: storage, eventBus: eventBus}

	mux := http.NewServeMux()
	mux.HandleFunc("/get", api.HandleGet)
	mux.HandleFunc("/set", api.HandleSet)

	// Middleware chain
	handler := Chain(
		LoggingMiddleware,
		AuthMiddleware(authStrategy),
	)(mux)

	log.Printf("Server starting on %s (auth=%s, storage=%s)", cfg.Port, authStrategy.Name(), storage.Name())
	log.Fatal(http.ListenAndServe(cfg.Port, handler))
}
```

### v2 增强版本：加入限流中间件 + 优雅关闭

```go
// Add to v1 code:

// RateLimitMiddleware throttles requests per IP
func RateLimitMiddleware(rps int) Middleware {
	type visitor struct {
		limit  int
		count  int
		window time.Time
	}
	var (
		mu       sync.Mutex
		visitors = make(map[string]*visitor)
	)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			mu.Lock()
			v, ok := visitors[ip]
			if !ok || time.Since(v.window) > time.Second {
				visitors[ip] = &visitor{limit: rps, count: 1, window: time.Now()}
				mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}
			v.count++
			if v.count > v.limit {
				mu.Unlock()
				http.Error(w, `{"error":"rate limited"}`, http.StatusTooManyRequests)
				return
			}
			mu.Unlock()
			next.ServeHTTP(w, r)
		})
	}
}

// Update main() to add graceful shutdown:
func runServer() {
	// ... same setup as v1 ...
	handler := Chain(
		LoggingMiddleware,
		RateLimitMiddleware(100),
		AuthMiddleware(authStrategy),
	)(mux)

	srv := &http.Server{Addr: cfg.Port, Handler: handler}

	// Graceful shutdown on signal
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Fatal(srv.ListenAndServe())
}
```

### v3 生产版本：配置外部化 + 健康检查

```go
// Add health check and config from environment
func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

// In main(), add:
mux.HandleFunc("/health", healthHandler)
// Read config from env:
cfg.AuthType = os.Getenv("AUTH_TYPE")
cfg.StorageType = os.Getenv("STORAGE_TYPE")
```

---

## 四、执行预览

```bash
# Start server
$ go run main.go
Server starting on :8080 (auth=JWT, storage=Memory)

# Set data (with JWT token)
$ curl -X POST http://localhost:8080/set \
  -H "Authorization: Bearer my-jwt-token" \
  -d '{"key":"hello","value":"world"}'
{"status":"ok"}

# Get data
$ curl "http://localhost:8080/get?key=hello" \
  -H "Authorization: Bearer my-jwt-token"
{"key":"hello","value":"world"}

# Server logs
[POST] /set 120µs
[AUDIT] data.update: map[key:hello user:user_from_jwt]
[GET] /get?key=hello 45µs
[AUDIT] data.access: map[key:hello user:user_from_jwt]
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| 接口设计 | 接口要小而专注，遵循ISP原则 |
| 并发安全 | MemoryStorage用sync.RWMutex保护map |
| 内存泄漏 | EventBus的goroutine要有退出机制 |
| 中间件顺序 | 认证应在业务处理之前，限流应在认证之前 |
| 错误处理 | 每层中间件都要处理错误，不要吞掉 |
| 单例初始化 | sync.Once保证只初始化一次，即使并发调用 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用继承实现模式 | Go没有继承，用组合和接口 |
| 把所有逻辑塞进一个handler | 用中间件分层，职责单一 |
| sync.Once里做耗时初始化 | Once只做轻量初始化，重活放init |
| 观察者同步通知 | 用goroutine异步通知避免阻塞 |
| 工厂返回具体类型 | 工厂返回接口类型 |
| 全局变量当单例 | 用sync.Once保证线程安全 |

---

## 七、练习题

### 🟢 基础题
1. 为Storage添加一个Redis实现，使用工厂模式创建
2. 添加一个日志中间件，记录请求体大小

### 🟡 进阶题
3. 实现一个缓存观察者：当data.update事件触发时，自动清除对应缓存
4. 为限流中间件添加滑动窗口算法

### 🔴 挑战题
5. 实现插件机制：通过配置文件动态加载中间件链，无需重新编译

---

## 八、知识点总结

```
设计模式实战
├── 创建型
│   ├── 单例模式（sync.Once）
│   └── 工厂模式（StorageFactory）
├── 行为型
│   ├── 策略模式（AuthStrategy）
│   ├── 观察者模式（EventBus）
│   └── 中间件模式（Chain）
└── Go特色实现
    ├── 接口隐式实现
    ├── 函数类型做中间件
    └── goroutine做异步通知
```

---

## 九、举一反三

| 场景 | 可用模式 | Go实现方式 |
|------|---------|-----------|
| 多种支付方式 | 策略模式 | PaymentStrategy接口 |
| 多种消息推送 | 观察者模式 | channel+select |
| 插件系统 | 工厂+策略 | plugin包或接口注册 |
| 请求处理流水线 | 中间件/责任链 | HandlerFunc嵌套 |
| 全局配置 | 单例模式 | sync.Once |
| 数据库连接池 | 单例+工厂 | sql.DB + init函数 |

---

## 十、参考资料

- [Go Design Patterns (GitHub)](https://github.com/tmrts/go-patterns)
- [Effective Go - Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Go标准库http.Handler设计](https://pkg.go.dev/net/http#Handler)

---

## 十一、代码演进总结

| 版本 | 内容 | 复杂度 |
|------|------|--------|
| v1 | 5种模式基础实现 | ⭐⭐⭐ |
| v2 | 加入限流+优雅关闭 | ⭐⭐⭐⭐ |
| v3 | 配置外部化+健康检查 | ⭐⭐⭐⭐⭐ |

> **核心思想：** 设计模式不是生搬硬套，而是根据问题选择合适的工具。Go的接口和组合让很多模式比传统OOP更简洁。
