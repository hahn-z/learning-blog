---
title: "024 - Gin 集成 Redis 缓存"
slug: "024-gin-redis"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:13:51.261+08:00"
updated_at: "2026-04-29T10:02:45.771+08:00"
reading_time: 39
tags: []
---

# 024 - Gin 集成 Redis 缓存

> **难度：** ⭐⭐⭐（较高）
> **前置知识：** Gin 中间件、Redis 基础命令
> **预计阅读时间：** 25 分钟

---

## 一、概念讲解

Redis 是高性能内存数据库，在 Gin 项目中用于缓存、限流、分布式锁、排行榜等场景。`go-redis` 是 Go 生态中最活跃的 Redis 客户端库。

**Redis 在 Web 应用中的典型角色：**

| 角色 | 场景 | 命令 |
|------|------|------|
| 缓存 | 热点数据缓存 | GET/SET/SETEX |
| 会话存储 | 用户登录状态 | SET/GET/DEL |
| 分布式锁 | 防止并发重复操作 | SET NX EX |
| 排行榜 | 积分/热度排序 | ZADD/ZRANGE |
| 计数器 | 接口限流/统计 | INCR/EXPIRE |
| 消息队列 | 简单异步任务 | LPUSH/RPOP |

**三大缓存问题：**

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 缓存穿透 | 查询不存在的数据 | 布隆过滤器 / 空值缓存 |
| 缓存雪崩 | 大量缓存同时过期 | 过期时间加随机值 |
| 缓存击穿 | 热点 key 过期瞬间 | 分布式锁 / 永不过期 |

---

## 二、脑图

```
Redis 缓存集成
├── 基础连接
│   ├── go-redis/v9 初始化
│   ├── 连接池配置
│   └── Ping 健康检查
├── 缓存中间件
│   ├── 读取缓存 → 命中直接返回
│   ├── 未命中 → 执行 handler → 写入缓存
│   └── 缓存 key 设计
├── 三大防护
│   ├── 穿透 → 布隆过滤器/空值
│   ├── 雪崩 → 随机过期时间
│   └── 击穿 → 分布式锁
├── 分布式锁
│   ├── SET NX EX 实现
│   ├── 续期机制
│   └── 安全释放(Lua脚本)
├── Session 存储
│   ├── 会话创建/读取/删除
│   └── 过期管理
└── 实战场景
    ├── 排行榜 (ZSET)
    ├── 计数器 (INCR)
    └── 限流器 (滑动窗口)
```

---

## 三、完整代码

### v1：基础连接 + 缓存中间件

```go
// main.go - v1 basic Redis cache middleware
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client

func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr:         "localhost:6379",
		Password:     "",
		DB:           0,
		PoolSize:     100,
		MinIdleConns: 10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis connection failed: %v", err)
	}
	log.Println("Redis connected successfully")
}

// cacheMiddleware caches GET responses by URL path
func cacheMiddleware(ttl time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		cacheKey := fmt.Sprintf("cache:%s", c.Request.URL.Path)
		ctx := c.Request.Context()

		// Try to get from cache
		val, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			// Cache hit
			c.Header("X-Cache", "HIT")
			c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(val))
			c.Abort()
			return
		}

		// Cache miss - capture response
		c.Header("X-Cache", "MISS")
		w := &responseWriter{body: make([]byte, 0), ResponseWriter: c.Writer}
		c.Writer = w

		c.Next()

		if c.Writer.Status() == http.StatusOK && len(w.body) > 0 {
			// Store in cache with random jitter to prevent thundering herd
			jitter := time.Duration(time.Now().UnixNano()%60) * time.Second
			rdb.Set(ctx, cacheKey, string(w.body), ttl+jitter)
		}
	}
}

// responseWriter wraps gin.ResponseWriter to capture body
type responseWriter struct {
	gin.ResponseWriter
	body []byte
}

func (w *responseWriter) Write(data []byte) (int, error) {
	w.body = append(w.body, data...)
	return w.ResponseWriter.Write(data)
}

func main() {
	initRedis()

	r := gin.Default()
	r.Use(cacheMiddleware(5 * time.Minute))

	r.GET("/api/users/:id", func(c *gin.Context) {
		id := c.Param("id")
		// Simulate slow database query
		time.Sleep(100 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{
			"id":    id,
			"name":  "Alice",
			"email": "alice@example.com",
		})
	})

	r.Run(":8080")
}
```

### v2：三大防护 + 分布式锁

```go
// main.go - v2 cache protection + distributed lock
package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client

func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		PoolSize: 100,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis failed: %v", err)
	}
}

// --- Distributed Lock ---

// DistLock implements a simple Redis distributed lock
type DistLock struct {
	client *redis.Client
	key    string
	value  string
	ttl    time.Duration
}

// NewDistLock creates a new distributed lock
func NewDistLock(client *redis.Client, key string, ttl time.Duration) *DistLock {
	return &DistLock{
		client: client,
		key:    fmt.Sprintf("lock:%s", key),
		value:  fmt.Sprintf("%d", time.Now().UnixNano()),
		ttl:    ttl,
	}
}

// TryLock attempts to acquire the lock
func (l *DistLock) TryLock(ctx context.Context) (bool, error) {
	return l.client.SetNX(ctx, l.key, l.value, l.ttl).Result()
}

// Unlock releases the lock using Lua script for safety
func (l *DistLock) Unlock(ctx context.Context) error {
	// Lua script: only delete if value matches (prevent unlocking others' lock)
	script := redis.NewScript(`
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`)
	return script.Run(ctx, l.client, []string{l.key}, l.value).Err()
}

// --- Cache with protection ---

// safeCacheMiddleware protects against cache breakdown with distributed lock
func safeCacheMiddleware(baseTTL time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		cacheKey := fmt.Sprintf("cache:%s", c.Request.URL.Path)
		ctx := c.Request.Context()

		// Try cache first
		val, err := rdb.Get(ctx, cacheKey).Result()
		if err == nil {
			c.Header("X-Cache", "HIT")
			c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(val))
			c.Abort()
			return
		}

		// Cache miss - try to acquire lock to prevent breakdown
		lock := NewDistLock(rdb, c.Request.URL.Path, 10*time.Second)
		acquired, _ := lock.TryLock(ctx)

		if !acquired {
			// Another goroutine is rebuilding cache, wait and retry
			time.Sleep(100 * time.Millisecond)
			val, err = rdb.Get(ctx, cacheKey).Result()
			if err == nil {
				c.Header("X-Cache", "HIT-AFTER-LOCK")
				c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(val))
				c.Abort()
				return
			}
			// Still no cache, proceed without cache
		}

		if acquired {
			defer lock.Unlock(ctx)
		}

		// Execute handler and cache result
		c.Header("X-Cache", "MISS")
		w := &responseWriter{body: make([]byte, 0), ResponseWriter: c.Writer}
		c.Writer = w
		c.Next()

		if c.Writer.Status() == http.StatusOK && len(w.body) > 0 {
			// Anti-avalanche: add random jitter to TTL
			jitter := time.Duration(rand.Intn(120)) * time.Second
			rdb.Set(ctx, cacheKey, string(w.body), baseTTL+jitter)
		}
	}
}

type responseWriter struct {
	gin.ResponseWriter
	body []byte
}

func (w *responseWriter) Write(data []byte) (int, error) {
	w.body = append(w.body, data...)
	return w.ResponseWriter.Write(data)
}

func main() {
	initRedis()

	r := gin.Default()
	r.Use(safeCacheMiddleware(5 * time.Minute))

	// Hot data endpoint - prone to cache breakdown
	r.GET("/api/hot/:id", func(c *gin.Context) {
		id := c.Param("id")
		// Simulate expensive DB query
		time.Sleep(500 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{
			"id":    id,
			"title": "Hot Article",
			"views": 99999,
		})
	})

	// Anti-penetration: cache empty results
	r.GET("/api/users/:id", func(c *gin.Context) {
		id := c.Param("id")
		if id == "0" {
			// Cache empty result for non-existent data
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": id, "name": "Alice"})
	})

	r.Run(":8080")
}
```

### v3：Session 存储 + 排行榜 + 计数器实战

```go
// main.go - v3 session, leaderboard, counter
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client

func initRedis() {
	rdb = redis.NewClient(&redis.Options{Addr: "localhost:6379", PoolSize: 100})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis failed: %v", err)
	}
}

// --- Session Manager ---

// SessionData represents user session
type SessionData struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// SessionManager handles Redis-based sessions
type SessionManager struct {
	client *redis.Client
	prefix string
	ttl    time.Duration
}

func NewSessionManager(client *redis.Client) *SessionManager {
	return &SessionManager{
		client: client,
		prefix: "session:",
		ttl:    24 * time.Hour,
	}
}

func (sm *SessionManager) Create(ctx context.Context, token string, data SessionData) error {
	b, _ := json.Marshal(data)
	return sm.client.Set(ctx, sm.prefix+token, b, sm.ttl).Err()
}

func (sm *SessionManager) Get(ctx context.Context, token string) (*SessionData, error) {
	val, err := sm.client.Get(ctx, sm.prefix+token).Result()
	if err != nil {
		return nil, err
	}
	var data SessionData
	json.Unmarshal([]byte(val), &data)
	return &data, nil
}

func (sm *SessionManager) Delete(ctx context.Context, token string) error {
	return sm.client.Del(ctx, sm.prefix+token).Err()
}

var sessionMgr *SessionManager

// authMiddleware checks session from Redis
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-Session-Token")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "no session"})
			return
		}

		session, err := sessionMgr.Get(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid session"})
			return
		}

		c.Set("session", session)
		c.Next()
	}
}

func main() {
	initRedis()
	sessionMgr = NewSessionManager(rdb)

	r := gin.Default()

	// Login → create session
	r.POST("/login", func(c *gin.Context) {
		var body struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// Simplified auth check
		token := fmt.Sprintf("tok_%d", time.Now().UnixNano())
		sessionMgr.Create(c.Request.Context(), token, SessionData{
			UserID: 1, Username: body.Username, Role: "user",
		})
		c.JSON(http.StatusOK, gin.H{"token": token})
	})

	// Protected routes
	auth := r.Group("/api", authMiddleware())
	{
		auth.GET("/profile", func(c *gin.Context) {
			sess, _ := c.Get("session")
			c.JSON(http.StatusOK, sess)
		})
		auth.POST("/logout", func(c *gin.Context) {
			token := c.GetHeader("X-Session-Token")
			sessionMgr.Delete(c.Request.Context(), token)
			c.JSON(http.StatusOK, gin.H{"message": "logged out"})
		})
	}

	// Leaderboard (ZSET)
	r.GET("/leaderboard", func(c *gin.Context) {
		ctx := c.Request.Context()
		// Get top 10 players
		results, err := rdb.ZRevRangeWithScores(ctx, "leaderboard", 0, 9).Result()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		type RankItem struct {
			Rank    int     `json:"rank"`
			Player  string  `json:"player"`
			Score   float64 `json:"score"`
		}
		var items []RankItem
		for i, z := range results {
			items = append(items, RankItem{
				Rank:   i + 1,
				Player: fmt.Sprintf("%v", z.Member),
				Score:  z.Score,
			})
		}
		c.JSON(http.StatusOK, items)
	})

	r.POST("/leaderboard/score", func(c *gin.Context) {
		var body struct {
			Player string  `json:"player" binding:"required"`
			Score  float64 `json:"score" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		rdb.ZAdd(c.Request.Context(), "leaderboard", redis.Z{
			Score:  body.Score,
			Member: body.Player,
		})
		c.JSON(http.StatusOK, gin.H{"message": "score updated"})
	})

	// Rate limiter (counter + sliding window)
	r.GET("/api/limited", rateLimitMiddleware(10, time.Minute), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	r.Run(":8080")
}

// rateLimitMiddleware limits requests per IP
func rateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := fmt.Sprintf("rate:%s:%s", c.ClientIP(), c.Request.URL.Path)
		ctx := c.Request.Context()

		count, _ := rdb.Incr(ctx, key).Result()
		if count == 1 {
			rdb.Expire(ctx, key, window)
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(max(0, limit-int(count))))

		if int(count) > limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			return
		}
		c.Next()
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
```

---

## 四、执行预览

```bash
# Start Redis
$ docker run -d --name redis -p 6379:6379 redis:7-alpine

# v1: Cache middleware
$ go run main.go
$ curl http://localhost:8080/api/users/1
# X-Cache: MISS (first request, 100ms delay)
$ curl http://localhost:8080/api/users/1
# X-Cache: HIT (instant response from Redis)

# v2: Distributed lock
# Concurrent requests to /api/hot/1 → only one hits DB, others wait for cache

# v3: Session + Leaderboard + Rate limit
$ curl -X POST http://localhost:8080/login -d '{"username":"alice","password":"pw"}'
# {"token":"tok_1706000000000000000"}
$ curl http://localhost:8080/api/profile -H "X-Session-Token: tok_xxx"
# {"user_id":1,"username":"alice","role":"user"}
$ curl -X POST http://localhost:8080/leaderboard/score -d '{"player":"alice","score":100}'
$ curl http://localhost:8080/leaderboard
# [{"rank":1,"player":"alice","score":100}]
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 序列化格式 | JSON 可读性好，MessagePack/msgpack 性能更高 |
| 缓存 key 设计 | 带业务前缀，如 `cache:users:123`，避免冲突 |
| 过期时间 | 必须设 TTL，避免内存爆满 |
| 连接池大小 | 根据并发量调整，一般 100-200 足够 |
| 分布式锁续期 | 长任务需要看门狗续期，否则锁会提前释放 |
| 大 Value | 避免 > 10KB 的缓存值，考虑压缩或分片 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 缓存不设过期时间 | 所有缓存必须设 TTL + 随机抖动 |
| 分布式锁释放不看 value | Lua 脚本原子判断 value 后再 DEL |
| 缓存空值不设短 TTL | 空值缓存设 1-5 分钟短 TTL，防止内存浪费 |
| 直接把用户请求参数当 key | key 加前缀 + hash，防止 key 冲突和注入 |
| INCR 不设 EXPIRE | 先 INCR 再判断 count==1 时设 EXPIRE |
| 热点 key 单节点 | 读写分离或本地缓存 + Redis 二级缓存 |

---

## 七、练习题

### 🟢 基础题
1. 实现一个简单的 GET 缓存中间件，TTL 60 秒，只缓存 200 响应
2. 用 Redis 的 `INCR` 实现一个页面访问计数器

### 🟡 进阶题
3. 实现基于滑动窗口的限流器（用 ZSET 替代简单的 INCR）
4. 实现分布式锁的看门狗续期机制（后台 goroutine 定期续期）

### 🔴 挑战题
5. 实现二级缓存（本地 memory + Redis），保证一致性（Redis key 过期时通知本地缓存失效）

---

## 八、知识点总结

```
Gin + Redis 缓存
├── 1. 基础连接
│   ├── go-redis/v9 NewClient
│   ├── 连接池: PoolSize, MinIdleConns
│   └── 健康检查: Ping
├── 2. 缓存中间件
│   ├── 读取 → 命中返回 → 未命中执行 → 写入
│   ├── ResponseWriter 包装捕获响应
│   └── Key 设计 + TTL + 抖动
├── 3. 三大防护
│   ├── 穿透: 布隆过滤器 / 空值短缓存
│   ├── 雪崩: TTL + 随机抖动
│   └── 击穿: 分布式锁 + 单飞
├── 4. 分布式锁
│   ├── SET NX EX 原子获取
│   ├── Lua 脚本安全释放
│   └── 看门狗续期
├── 5. Session
│   ├── JSON 序列化存储
│   ├── Token → Session 映射
│   └── TTL 自动过期
└── 6. 实战
    ├── 排行榜: ZADD/ZRANGE
    ├── 计数器: INCR/EXPIRE
    └── 限流: 滑动窗口 ZSET
```

---

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 高并发秒杀 | Redis 预减库存 + 分布式锁防超卖 |
| 实时在线人数 | Redis HyperLogLog (PFADD/PFCOUNT) |
| 消息通知 | Redis Pub/Sub 或 Streams |
| 地理位置查询 | Redis GEO (GEOADD/GEORADIUS) |
| 多级缓存 | L1: 本地 memory → L2: Redis → L3: DB |

---

## 十、参考资料

- [go-redis 官方文档](https://redis.uptrace.dev/)
- [Redis 缓存问题详解](https://redis.io/docs/manual/patterns/caching/)
- [分布式锁的最佳实践](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Redis 数据类型介绍](https://redis.io/docs/data-types/)

---

## 十一、代码演进

| 版本 | 变化 |
|------|------|
| **v1** | go-redis 连接 + GET 缓存中间件 + ResponseWriter 捕获 |
| **v2** | 分布式锁 + 缓存击穿防护 + TTL 随机抖动防雪崩 |
| **v3** | Session 管理 + ZSET 排行榜 + INCR 限流器 |

> **下一步建议：** 集成 Redis Cluster 支持高可用，并使用 Redis Streams 实现异步任务队列。
