---
title: "016 - Redis缓存集成 | Kratos实战系列"
slug: "016-kratos-redis"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:44:41.129+08:00"
updated_at: "2026-04-29T10:02:45.4+08:00"
reading_time: 24
tags: []
---

# Redis缓存集成

> **难度：** ⭐⭐⭐ | **预计阅读：** 15 分钟
>
> Kratos 数据层集成 Redis，覆盖连接配置、缓存 Repository 模式、分布式锁、旁路缓存策略与穿透防护。

---

## 1. 概念讲解

### 为什么需要 Redis？

微服务架构中，数据库是最大的性能瓶颈。Redis 作为内存级 KV 存储，可以在以下场景显著提升性能：

| 场景 | 说明 |
|------|------|
| 热点数据缓存 | 用户信息、配置项等高频读取数据 |
| 分布式锁 | 防止并发重复操作（如重复下单） |
| Session 存储 | 无状态服务的会话管理 |
| 排行榜/计数器 | 利用 Redis 原子操作 |

### Kratos 中的 Redis 集成方式

Kratos 通过 `contrib` 仓库提供 Redis 支持，核心是 `github.com/go-kratos/kratos/contrib/registry/redis` 的封装。实际项目中，我们直接使用 `go-redis/redis/v9` 配合 Kratos 的 Data 层模式。

### 缓存策略：旁路缓存（Cache-Aside）

```
读：Cache → Miss → DB → Write Cache → Return
写：Update DB → Delete Cache
```

---

## 2. 脑图

```
Redis 集成
├── 连接配置
│   ├── 单节点
│   ├── Sentinel
│   └── Cluster
├── Data 层封装
│   ├── redis.Client 初始化
│   ├── Repository 模式
│   └── 连接池参数
├── 缓存策略
│   ├── 旁路缓存 (Cache-Aside)
│   ├── 穿透防护 (布隆过滤器)
│   ├── 雪崩防护 (随机TTL)
│   └── 击穿防护 (互斥锁)
├── 分布式锁
│   ├── SET NX EX
│   ├── Redisson Go 实现
│   └── 看门狗续期
└── Session 存储
    ├── Cookie + Redis Session
    └── Token 黑名单
```

---

## 3. 完整 Go 代码

### v1 — 基础 Redis 连接与缓存读取

```go
// internal/data/redis.go
package data

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/redis/go-redis/v9"
)

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

// NewRedisClient creates a redis client
func NewRedisClient(cfg RedisConfig, logger log.Logger) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     100,
		MinIdleConns: 10,
	})

	// Verify connection
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.NewHelper(logger).Fatalf("redis connect failed: %v", err)
	}
	return rdb
}
```

```go
// internal/data/user_cache.go
package data

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"your-project/internal/biz"
)

type userCacheRepo struct {
	rdb *redis.Client
	ttl time.Duration
}

// NewUserCacheRepo creates a cached user repository
func NewUserCacheRepo(rdb *redis.Client) biz.UserCacheRepo {
	return &userCacheRepo{rdb: rdb, ttl: 30 * time.Minute}
}

func (r *userCacheRepo) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := r.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		// Cache miss
		return biz.ErrCacheMiss
	}
	if err != nil {
		return fmt.Errorf("redis get: %w", err)
	}
	return json.Unmarshal([]byte(val), dest)
}

func (r *userCacheRepo) Set(ctx context.Context, key string, val interface{}) error {
	data, err := json.Marshal(val)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	return r.rdb.Set(ctx, key, data, r.ttl).Err()
}

func (r *userCacheRepo) Delete(ctx context.Context, key string) error {
	return r.rdb.Del(ctx, key).Err()
}
```

### v2 — 旁路缓存 Repository（穿透防护）

```go
// internal/data/cached_user_repo.go
package data

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"your-project/internal/biz"
)

const (
	userCachePrefix = "user:"
	nullCacheTTL    = 5 * time.Minute // TTL for null cache (anti-penetration)
)

type cachedUserRepo struct {
	db   biz.UserRepo // actual DB repo
	rdb  *redis.Client
	ttl  time.Duration
}

// NewCachedUserRepo wraps a UserRepo with cache-aside pattern
func NewCachedUserRepo(db biz.UserRepo, rdb *redis.Client) biz.UserRepo {
	return &cachedUserRepo{
		db:  db,
		rdb: rdb,
		ttl: 30 * time.Minute,
	}
}

func (r *cachedUserRepo) GetUser(ctx context.Context, id int64) (*biz.User, error) {
	key := fmt.Sprintf("%s%d", userCachePrefix, id)

	// Step 1: Try cache
	val, err := r.rdb.Get(ctx, key).Result()
	if err == nil {
		// Check for null cache marker
		if val == "NULL" {
			return nil, biz.ErrUserNotFound
		}
		var user biz.User
		if err := json.Unmarshal([]byte(val), &user); err == nil {
			return &user, nil
		}
	}

	// Step 2: Cache miss, query DB
	user, err := r.db.GetUser(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		// Anti-penetration: cache null marker with short TTL
		r.rdb.Set(ctx, key, "NULL", nullCacheTTL)
		return nil, biz.ErrUserNotFound
	}

	// Step 3: Write back to cache
	data, _ := json.Marshal(user)
	r.rdb.Set(ctx, key, data, r.ttl)

	return user, nil
}

func (r *cachedUserRepo) CreateUser(ctx context.Context, user *biz.User) error {
	return r.db.CreateUser(ctx, user)
}

func (r *cachedUserRepo) UpdateUser(ctx context.Context, user *biz.User) error {
	err := r.db.UpdateUser(ctx, user)
	if err != nil {
		return err
	}
	// Invalidate cache
	key := fmt.Sprintf("%s%d", userCachePrefix, user.ID)
	r.rdb.Del(ctx, key)
	return nil
}
```

### v3 — 分布式锁 + 完整缓存防击穿

```go
// internal/pkg/distributed/lock.go
package distributed

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisLock struct {
	rdb    *redis.Client
	key    string
	value  string
	expiry time.Duration
}

// NewRedisLock creates a distributed lock instance
func NewRedisLock(rdb *redis.Client, key string, expiry time.Duration) *RedisLock {
	return &RedisLock{rdb: rdb, key: key, expiry: expiry}
}

// TryLock attempts to acquire the lock, returns true on success
func (l *RedisLock) TryLock(ctx context.Context) (bool, error) {
	ok, err := l.rdb.SetNX(ctx, l.key, l.value, l.expiry).Result()
	return ok, err
}

// Unlock releases the lock (should use Lua for atomic check+del in production)
func (l *RedisLock) Unlock(ctx context.Context) error {
	// Use Lua script for atomic unlock
	script := redis.NewScript(`
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`)
	return script.Run(ctx, l.rdb, []string{l.key}, l.value).Err()
}

// WithLock executes fn while holding the lock
func WithLock(ctx context.Context, rdb *redis.Client, key string, expiry time.Duration, fn func() error) error {
	lock := NewRedisLock(rdb, key, expiry)

	// Retry up to 3 times
	for i := 0; i < 3; i++ {
		ok, err := lock.TryLock(ctx)
		if err != nil {
			return err
		}
		if ok {
			defer lock.Unlock(ctx)
			return fn()
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("failed to acquire lock: %s", key)
}
```

```go
// internal/data/cached_user_repo.go — v3 with anti-stampede
func (r *cachedUserRepo) GetUser(ctx context.Context, id int64) (*biz.User, error) {
	key := fmt.Sprintf("%s%d", userCachePrefix, id)

	// Try cache first
	val, err := r.rdb.Get(ctx, key).Result()
	if err == nil {
		if val == "NULL" {
			return nil, biz.ErrUserNotFound
		}
		var user biz.User
		if json.Unmarshal([]byte(val), &user) == nil {
			return &user, nil
		}
	}

	// Anti-stampede: use distributed lock to prevent thundering herd
	lockKey := fmt.Sprintf("lock:%s%d", userCachePrefix, id)
	err = WithLock(ctx, r.rdb, lockKey, 5*time.Second, func() error {
		// Double-check cache after acquiring lock
		val, err := r.rdb.Get(ctx, key).Result()
		if err == nil && val != "NULL" {
			return json.Unmarshal([]byte(val), new(biz.User))
		}

		// Query DB
		user, dbErr := r.db.GetUser(ctx, id)
		if dbErr != nil {
			return dbErr
		}
		if user == nil {
			r.rdb.Set(ctx, key, "NULL", nullCacheTTL)
			return biz.ErrUserNotFound
		}

		data, _ := json.Marshal(user)
		r.rdb.Set(ctx, key, data, r.ttl)
		return nil
	})

	// After lock, re-read from cache
	val, err = r.rdb.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var user biz.User
	json.Unmarshal([]byte(val), &user)
	return &user, nil
}
```

---

## 4. 执行预览

```bash
# Start Redis
$ docker run -d --name redis -p 6379:6379 redis:7-alpine

# Run application
$ go run cmd/server/main.go
INFO msg=redis connected addr=localhost:6379

# API call (first time — cache miss)
$ curl http://localhost:8000/user/1
{"id":1,"name":"Alice"} 
# Log: cache miss, query DB, write cache

# API call (second time — cache hit)
$ curl http://localhost:8000/user/1
{"id":1,"name":"Alice"}
# Log: cache hit, TTL=1798s remaining
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| 序列化 | 推荐 JSON，性能敏感场景用 protobuf/MessagePack |
| TTL | 基础 TTL 30min，加随机偏移防雪崩（如 30±5min） |
| 连接池 | PoolSize 建议 CPU核数×10，MinIdleConns≥5 |
| 空值缓存 | 空结果也要缓存，TTL 设短（5min），防穿透 |
| 分布式锁 | 必须用 Lua 脚本原子释放，防止误删别人的锁 |
| Key 设计 | `业务:实体:ID` 三层命名，如 `user:info:123` |

---

## 6. 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `SET key val` 无过期时间 | 始终设置 TTL，加随机偏移 |
| 先删缓存再更新数据库 | 先更新数据库再删缓存（或用双删策略） |
| 用 `DEL` 释放分布式锁 | 用 Lua 脚本比较 value 后原子删除 |
| 缓存不存在时直接返回空 | 缓存空值标记（"NULL"）防止穿透 |
| 所有数据用相同 TTL | TTL 加随机偏移量防止雪崩 |
| 分布式锁不设超时 | 锁必须设 expiry，防死锁 |

---

## 7. 练习题

### 🟢 Easy
1. 实现一个简单的 `Set/Get/Delete` 缓存封装，TTL 为 10 分钟
2. 在 Kratos Data 层初始化 Redis 连接并添加健康检查

### 🟡 Medium
3. 实现旁路缓存模式，包含空值缓存防穿透
4. 实现分布式锁的加锁/解锁（用 Lua 脚本）

### 🔴 Hard
5. 实现带看门狗自动续期的分布式锁
6. 设计多级缓存方案（本地缓存 + Redis），保证一致性

---

## 8. 知识点总结

```
Redis 缓存集成
├── 连接管理
│   ├── go-redis/v9 客户端
│   ├── 连接池参数调优
│   └── 健康检查 Ping
├── 缓存模式
│   ├── Cache-Aside（旁路）
│   ├── Read-Through / Write-Through
│   └── Write-Behind
├── 缓存问题
│   ├── 穿透 → 空值缓存/布隆过滤器
│   ├── 雪崩 → 随机TTL/多级缓存
│   └── 击穿 → 互斥锁/永不过期
├── 分布式锁
│   ├── SET NX EX 基础实现
│   ├── Lua 原子释放
│   └── 看门狗续期机制
└── Data 层设计
    ├── Repository 模式
    ├── 装饰器模式（缓存包装）
    └── 依赖注入
```

---

## 9. 举一反三

| 本文学到的 | 可应用到 |
|-----------|---------|
| Cache-Aside 模式 | 任何读多写少场景（商品详情、配置） |
| 分布式锁 | 库存扣减、防重复提交、定时任务互斥 |
| 空值缓存 | 防止恶意请求查询不存在的数据 |
| Lua 原子操作 | 限流（滑动窗口）、库存预占 |
| 装饰器模式 | 日志、鉴权、限流等横切关注点 |

---

## 10. 参考资料

- [go-redis 官方文档](https://redis.uptrace.dev/)
- [Kratos contrib 数据层示例](https://github.com/go-kratos/kratos/tree/main/examples)
- [Redis 分布式锁的正确实现](https://redis.io/docs/manual/patterns/distributed-locks/)
- 《Redis 设计与实现》— 黄健宏

---

## 11. 代码演进

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | 基础 Redis 连接 + 简单缓存读写 | 快速原型、小规模项目 |
| v2 | 旁路缓存 + 空值缓存防穿透 | 生产环境标准方案 |
| v3 | 分布式锁 + 防击穿（双重检查） | 高并发核心数据 |

---

_缓存不是银弹，但不用缓存肯定是灾难。_ 🚀
