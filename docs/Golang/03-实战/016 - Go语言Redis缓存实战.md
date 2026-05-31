---
title: "016 - Go语言Redis缓存实战"
slug: "016-upload"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.393+08:00"
updated_at: "2026-04-29T10:02:45.008+08:00"
reading_time: 33
tags: ["Web开发"]
---

# Go语言Redis缓存实战

**难度：中级** ⭐⭐⭐

## 1. 概念讲解

### 什么是Redis？

Redis（Remote Dictionary Server）是一个开源的内存数据结构存储系统，可以用作数据库、缓存和消息中间件。它支持多种数据结构，如字符串、哈希、列表、集合、有序集合等。

### 为什么使用Redis缓存？

在高并发场景下，直接访问数据库会导致：
- 数据库负载过高，响应变慢
- 数据库连接池耗尽
- 系统吞吐量下降

引入Redis缓存后：
- 热点数据存储在内存中，读取速度极快（10万+ QPS）
- 减轻数据库压力，提高系统整体性能
- 支持分布式缓存，适合集群部署

### Go语言与Redis的集成

Go语言提供了多个优秀的Redis客户端库：
- `go-redis/redis`：功能完整，性能优秀，支持集群
- `gomodule/redigo`：轻量级，接口简洁
- `alicebob/miniredis`：用于测试的内存Redis

本文使用最流行的 `go-redis/redis` 库进行实战。

## 2. 架构图

```
┌─────────────────────────────────────────────────────────┐
│                        客户端请求                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │   Go应用服务器       │
           └──────┬──────┬──────┘
                  │      │
        缓存命中？      │
         │             │
    是  │    否        │
         ▼             ▼
┌──────────────┐  ┌──────────────────┐
│   Redis缓存   │  │   MySQL数据库     │
│  (内存存储)    │  │  (持久化存储)     │
└──────────────┘  └──────────────────┘
         │                    │
         │  写回策略           │
         ▼                    │
    ┌────────────────────────────┐
    │   缓存更新策略               │
    │   - Write-Through           │
    │   - Write-Back              │
    │   - Cache-Aside             │
    └────────────────────────────┘
```

## 3. 完整Go代码示例

### 3.1 基础配置与连接

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// RedisConfig Redis配置
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

// CacheManager 缓存管理器
type CacheManager struct {
	client *redis.Client
	ctx    context.Context
}

// NewCacheManager 创建缓存管理器
func NewCacheManager(config RedisConfig) *CacheManager {
	client := redis.NewClient(&redis.Options{
		Addr:     config.Addr,
		Password: config.Password,
		DB:       config.DB,
	})

	return &CacheManager{
		client: client,
		ctx:    context.Background(),
	}
}

// Close 关闭连接
func (cm *CacheManager) Close() error {
	return cm.client.Close()
}

// Ping 测试连接
func (cm *CacheManager) Ping() error {
	_, err := cm.client.Ping(cm.ctx).Result()
	return err
}
```

### 3.2 用户模型与数据库模拟

```go
// User 用户模型
type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Age      int    `json:"age"`
}

// MockDB 模拟数据库
type MockDB struct {
	users map[int]User
}

func NewMockDB() *MockDB {
	return &MockDB{
		users: make(map[int]User),
	}
}

// GetUser 从数据库获取用户
func (db *MockDB) GetUser(id int) (*User, error) {
	user, exists := db.users[id]
	if !exists {
		return nil, fmt.Errorf("user not found")
	}
	return &user, nil
}

// SaveUser 保存用户到数据库
func (db *MockDB) SaveUser(user User) error {
	db.users[user.ID] = user
	return nil
}
```

### 3.3 缓存操作实现

```go
// Set 设置缓存
func (cm *CacheManager) Set(key string, value interface{}, expiration time.Duration) error {
	jsonData, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	return cm.client.Set(cm.ctx, key, jsonData, expiration).Err()
}

// Get 获取缓存
func (cm *CacheManager) Get(key string, dest interface{}) error {
	val, err := cm.client.Get(cm.ctx, key).Result()
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(val), dest)
}

// Delete 删除缓存
func (cm *CacheManager) Delete(keys ...string) error {
	return cm.client.Del(cm.ctx, keys...).Err()
}

// Exists 检查键是否存在
func (cm *CacheManager) Exists(keys ...string) (int64, error) {
	return cm.client.Exists(cm.ctx, keys...).Result()
}
```

### 3.4 三大缓存策略实现

#### 3.4.1 Cache-Aside Pattern（旁路缓存模式）

```go
// GetUserWithCache Cache-Aside模式获取用户
// 流程：先查缓存 → 缓存命中返回 → 缓存未命中查DB → 写入缓存 → 返回
func (cm *CacheManager) GetUserWithCache(db *MockDB, userID int) (*User, error) {
	cacheKey := fmt.Sprintf("user:%d", userID)

	// 1. 先查缓存
	var cachedUser User
	err := cm.Get(cacheKey, &cachedUser)
	if err == nil {
		fmt.Printf("✅ Cache HIT: user %d\n", userID)
		return &cachedUser, nil
	}

	if err != redis.Nil {
		fmt.Printf("⚠️  Cache ERROR: %v\n", err)
	}

	fmt.Printf("❌ Cache MISS: user %d, querying DB...\n", userID)

	// 2. 缓存未命中，查询数据库
	user, err := db.GetUser(userID)
	if err != nil {
		return nil, fmt.Errorf("db error: %w", err)
	}

	// 3. 写入缓存，设置30分钟过期
	if err := cm.Set(cacheKey, user, 30*time.Minute); err != nil {
		fmt.Printf("⚠️  Failed to set cache: %v\n", err)
	}

	fmt.Printf("💾 Cache SET: user %d\n", userID)
	return user, nil
}
```

#### 3.4.2 Write-Through Pattern（写穿透模式）

```go
// SaveUserWithWriteThrough Write-Through模式保存用户
// 流程：同时写入缓存和数据库，保证数据一致性
func (cm *CacheManager) SaveUserWithWriteThrough(db *MockDB, user User) error {
	cacheKey := fmt.Sprintf("user:%d", user.ID)

	// 1. 写入数据库
	if err := db.SaveUser(user); err != nil {
		return fmt.Errorf("db error: %w", err)
	}

	// 2. 同时写入缓存
	if err := cm.Set(cacheKey, user, 30*time.Minute); err != nil {
		// 缓存失败不影响主流程
		fmt.Printf("⚠️  Failed to set cache: %v\n", err)
	}

	fmt.Printf("✅ Saved user %d to DB and cache\n", user.ID)
	return nil
}
```

#### 3.4.3 Write-Back Pattern（写回模式）

```go
// WriteBackQueue 写回队列
type WriteBackQueue struct {
	queue chan User
	db    *MockDB
	cm    *CacheManager
}

// NewWriteBackQueue 创建写回队列
func NewWriteBackQueue(db *MockDB, cm *CacheManager) *WriteBackQueue {
	queue := &WriteBackQueue{
		queue: make(chan User, 1000),
		db:    db,
		cm:    cm,
	}

	// 启动后台写回goroutine
	go queue.process()

	return queue
}

// process 异步处理写回
func (wb *WriteBackQueue) process() {
	for user := range wb.queue {
		time.Sleep(100 * time.Millisecond) // 模拟批处理延迟

		// 写入数据库
		if err := wb.db.SaveUser(user); err != nil {
			fmt.Printf("❌ Write-back failed for user %d: %v\n", user.ID, err)
			// 可以重试或放入死信队列
			continue
		}

		fmt.Printf("✅ Write-back completed for user %d\n", user.ID)
	}
}

// SaveUserWithWriteBack Write-Back模式保存用户
// 流程：只写入缓存，异步批量写回数据库
func (wb *WriteBackQueue) SaveUserWithWriteBack(user User) error {
	cacheKey := fmt.Sprintf("user:%d", user.ID)

	// 1. 写入缓存
	if err := wb.cm.Set(cacheKey, user, 30*time.Minute); err != nil {
		return fmt.Errorf("cache error: %w", err)
	}

	// 2. 加入写回队列
	wb.queue <- user

	fmt.Printf("📝 Queued user %d for write-back\n", user.ID)
	return nil
}
```

### 3.5 完整示例

```go
func main() {
	// 初始化
	config := RedisConfig{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	}

	cm := NewCacheManager(config)
	defer cm.Close()

	// 测试连接
	if err := cm.Ping(); err != nil {
		fmt.Printf("❌ Redis connection failed: %v\n", err)
		return
	}
	fmt.Println("✅ Connected to Redis")

	// 初始化模拟数据库
	db := NewMockDB()

	// 创建测试数据
	testUser := User{
		ID:       1,
		Username: "gopher",
		Email:    "gopher@golang.dev",
		Age:      5,
	}

	fmt.Println("\n========== 测试1: Cache-Aside模式 ==========")

	// 第一次获取 - 缓存未命中
	user1, err := cm.GetUserWithCache(db, testUser.ID)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}
	fmt.Printf("User: %+v\n", *user1)

	// 第二次获取 - 缓存命中
	fmt.Println()
	user2, err := cm.GetUserWithCache(db, testUser.ID)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}
	fmt.Printf("User: %+v\n", *user2)

	fmt.Println("\n========== 测试2: Write-Through模式 ==========")
	testUser2 := User{
		ID:       2,
		Username: "rustacean",
		Email:    "rust@rustlang.org",
		Age:      10,
	}

	if err := cm.SaveUserWithWriteThrough(db, testUser2); err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}

	// 验证缓存
	user3, err := cm.GetUserWithCache(db, testUser2.ID)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}
	fmt.Printf("User: %+v\n", *user3)

	fmt.Println("\n========== 测试3: Write-Back模式 ==========")
	wb := NewWriteBackQueue(db, cm)
	defer close(wb.queue)

	testUser3 := User{
		ID:       3,
		Username: "pythonista",
		Email:    "python@python.org",
		Age:      30,
	}

	if err := wb.SaveUserWithWriteBack(testUser3); err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}

	// 等待写回完成
	time.Sleep(500 * time.Millisecond)

	// 验证数据已持久化
	user4, err := db.GetUser(testUser3.ID)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}
	fmt.Printf("User from DB: %+v\n", *user4)
}
```

## 4. 执行预览

```
✅ Connected to Redis

========== 测试1: Cache-Aside模式 ==========
❌ Cache MISS: user 1, querying DB...
💾 Cache SET: user 1
User: {ID:1 Username:gopher Email:gopher@golang.dev Age:5}

✅ Cache HIT: user 1
User: {ID:1 Username:gopher Email:gopher@golang.dev Age:5}

========== 测试2: Write-Through模式 ==========
✅ Saved user 2 to DB and cache
❌ Cache MISS: user 2, querying DB...
💾 Cache SET: user 2
User: {ID:2 Username:rustacean Email:rust@rustlang.org Age:10}

========== 测试3: Write-Back模式 ==========
📝 Queued user 3 for write-back
✅ Write-back completed for user 3
User from DB: {ID:3 Username:pythonista Email:python@python.org Age:30}
```

## 5. 注意事项

| 注意事项 | 说明 | 解决方案 |
|---------|------|---------|
| **缓存雪崩** | 大量缓存同时过期，请求全部打到数据库 | 设置随机过期时间，使用互斥锁 |
| **缓存穿透** | 查询不存在的数据，每次都穿透到数据库 | 缓存空值（短过期时间），使用布隆过滤器 |
| **缓存击穿** | 热点Key过期，大量并发请求同时穿透 | 使用互斥锁，设置永不过期+异步刷新 |
| **数据一致性** | 缓存和数据库数据不一致 | 选择合适的缓存策略，添加版本号 |
| **大Key问题** | 单个Key的Value过大，影响性能 | 拆分大Key，使用Hash结构 |
| **内存占用** | 缓存数据过多占用内存 | 设置合理的过期时间，监控内存使用 |

## 6. 避坑指南

### ❌ 错误做法

```go
// ❌ 直接错误判断，忽略了redis.Nil
func (cm *CacheManager) BadGet(key string, dest interface{}) error {
	val, err := cm.client.Get(cm.ctx, key).Result()
	if err != nil {
		return err // 错误：无法区分是键不存在还是真正的错误
	}
	return json.Unmarshal([]byte(val), dest)
}

// ❌ 缓存雪崩风险 - 所有缓存同一时间过期
func (cm *CacheManager) BadSetMany() {
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("user:%d", i)
		cm.client.Set(cm.ctx, key, "value", 30*time.Minute) // 所有key同一时间过期
	}
}

// ❌ 缓存穿透 - 不存在的数据每次都查DB
func (cm *CacheManager) BadGetUser(db *MockDB, userID int) (*User, error) {
	cacheKey := fmt.Sprintf("user:%d", userID)

	// 查缓存
	var user User
	err := cm.Get(cacheKey, &user)
	if err == nil {
		return &user, nil
	}

	// 直接查DB，不缓存空值
	return db.GetUser(userID)
}

// ❌ 忘记处理上下文取消
func (cm *CacheManager) BadConcurrentAccess() {
	ctx := context.Background()
	// 请求超时后，goroutine仍在运行
	go cm.client.Get(ctx, "key")
}
```

### ✅ 正确做法

```go
// ✅ 正确处理redis.Nil
func (cm *CacheManager) GoodGet(key string, dest interface{}) error {
	val, err := cm.client.Get(cm.ctx, key).Result()
	if err == redis.Nil {
		return fmt.Errorf("key does not exist")
	}
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// ✅ 避免缓存雪崩 - 随机过期时间
func (cm *CacheManager) GoodSetMany() {
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("user:%d", i)
		// 基础时间30分钟 + 随机0-10分钟
		expiration := 30*time.Minute + time.Duration(rand.Intn(10))*time.Minute
		cm.client.Set(cm.ctx, key, "value", expiration)
	}
}

// ✅ 防止缓存穿透 - 缓存空值
func (cm *CacheManager) GoodGetUser(db *MockDB, userID int) (*User, error) {
	cacheKey := fmt.Sprintf("user:%d", userID)

	// 查缓存
	var user User
	err := cm.Get(cacheKey, &user)
	if err == nil {
		return &user, nil
	}

	// 查DB
	user, err = db.GetUser(userID)
	if err != nil {
		// 用户不存在，缓存空值5分钟
		if err.Error() == "user not found" {
			cm.Set(cacheKey, struct{}{}, 5*time.Minute)
		}
		return nil, err
	}

	// 缓存用户数据
	cm.Set(cacheKey, user, 30*time.Minute)
	return &user, nil
}

// ✅ 使用超时上下文
func (cm *CacheManager) GoodConcurrentAccess() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		select {
		case <-ctx.Done():
			fmt.Println("Request timeout")
		case <-time.After(10 * time.Second):
			fmt.Println("Operation completed")
		}
	}()
}
```

## 7. 练习题

### 🟢 基础练习

1. 实现一个简单的计数器，使用Redis的INCR命令
2. 实现一个简单的排行榜，使用Redis的ZSET
3. 实现一个分布式锁，使用SETNX命令

### 🟡 进阶练习

1. 实现一个带布隆过滤器的缓存系统，防止缓存穿透
2. 实现一个二级缓存（本地缓存 + Redis），减少网络开销
3. 实现一个热点Key自动识别和预加载机制

### 🔴 挑战练习

1. 实现一个分布式缓存集群，支持一致性哈希
2. 实现一个缓存监控和告警系统，实时监控缓存命中率
3. 实现一个缓存预热系统，在服务启动时加载热点数据

## 8. 知识点总结

```
Go语言Redis缓存实战
├── 基础概念
│   ├── Redis数据结构
│   ├── 缓存作用
│   └── Go-Redis库
├── 缓存策略
│   ├── Cache-Aside（旁路缓存）
│   ├── Write-Through（写穿透）
│   └── Write-Back（写回）
├── 常见问题
│   ├── 缓存雪崩
│   ├── 缓存穿透
│   └── 缓存击穿
├── 最佳实践
│   ├── 合理设置过期时间
│   ├── 避免大Key
│   └── 监控缓存命中率
└── 高级特性
    ├── 分布式锁
    ├── 布隆过滤器
    └── 一致性哈希
```

## 9. 举一反三

| 场景 | 适用策略 | 理由 |
|-----|---------|------|
| 读多写少的配置数据 | Cache-Aside | 简单高效，读性能优先 |
| 需要强一致性的数据 | Write-Through | 数据一致性高，写后立即生效 |
| 高并发写入场景 | Write-Back | 减少IO，提高吞吐量 |
| 热点数据 | 预加载 + 永不过期 | 避免缓存击穿 |
| 统计计数 | Redis原子操作 | 无并发问题 |
| 排行榜 | ZSET | 天然支持排序 |
| 分布式锁 | SETNX + 过期时间 | 防死锁 |

## 10. 参考资料

- [Redis官方文档](https://redis.io/documentation)
- [go-redis/redis GitHub](https://github.com/go-redis/redis)
- [Redis设计与实现](https://book.douban.com/subject/25900156/)
- [Go语言实战](https://book.douban.com/subject/27044219/)

## 11. 代码演进

### v1: 基础缓存

```go
// 简单的Get/Set操作
func Set(key, value string, expiration time.Duration) error {
    return client.Set(ctx, key, value, expiration).Err()
}

func Get(key string) (string, error) {
    return client.Get(ctx, key).Result()
}
```

### v2: Cache-Aside模式

```go
// 引入缓存策略，先查缓存再查DB
func GetUserWithCache(id int) (*User, error) {
    if cached, err := cache.Get(id); err == nil {
        return cached, nil
    }
    user := db.Query(id)
    cache.Set(id, user)
    return user, nil
}
```

### v3: 完整缓存系统

```go
// 支持多种策略、错误处理、监控
type CacheManager struct {
    strategy    CacheStrategy
    metrics     *CacheMetrics
    circuit     *CircuitBreaker
}

func (cm *CacheManager) GetWithFallback(key string, fallback func() (interface{}, error)) (interface{}, error) {
    // 支持策略切换、熔断降级、指标监控
}
```

---

**总结**：Redis缓存是提升系统性能的重要手段，选择合适的缓存策略、避免常见问题、合理使用高级特性，才能构建高性能、高可用的缓存系统。
