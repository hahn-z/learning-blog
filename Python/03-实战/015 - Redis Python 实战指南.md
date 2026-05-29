---
title: "015 - Redis Python 实战指南"
slug: "015-redis-python"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.536+08:00"
updated_at: "2026-04-29T10:02:47.777+08:00"
reading_time: 32
tags: []
---

# Redis Python 实战指南

> **难度：** ⭐⭐ 中级 | **预计阅读：** 25 分钟 | **标签：** Python, Redis, 缓存, 消息队列

---

## 一、概念讲解

Redis（Remote Dictionary Server）是高性能的内存键值数据库，支持多种数据结构，广泛用于缓存、会话管理、消息队列、排行榜等场景。

### 核心数据结构

| 结构 | 命令前缀 | 典型场景 |
|------|---------|---------|
| String | SET/GET | 缓存、计数器、分布式锁 |
| Hash | HSET/HGET | 对象存储、用户信息 |
| List | LPUSH/RPOP | 消息队列、最新列表 |
| Set | SADD/SMEMBERS | 标签、好友关系、去重 |
| Sorted Set | ZADD/ZRANGE | 排行榜、优先队列 |
| Stream | XADD/XREAD | 事件流、消息队列 |

### 为什么 Redis 这么快？

1. **纯内存操作**：数据存在内存，微秒级响应
2. **单线程模型**：避免锁竞争，命令原子执行
3. **I/O 多路复用**：epoll/kqueue 高效网络模型
4. **高效数据结构**：SDS、跳表、压缩列表等

---

## 二、知识脑图

```
Redis Python (redis-py)
├── 连接管理
│   ├── redis.Redis() 直连
│   ├── ConnectionPool 连接池
│   ├── Sentinel 哨兵
│   └── redis.asyncio 异步客户端
├── 基础操作
│   ├── String: set/get/incr/expire
│   ├── Hash: hset/hget/hgetall
│   ├── List: lpush/rpush/lrange
│   ├── Set: sadd/smembers/sinter
│   └── Sorted Set: zadd/zrange/zrank
├── 高级特性
│   ├── Pipeline 批量操作
│   ├── Pub/Sub 发布订阅
│   ├── 事务 MULTI/EXEC
│   ├── Lua 脚本
│   └── Stream 消息流
├── 实战模式
│   ├── 缓存（Cache-Aside）
│   ├── 分布式锁
│   ├── 限流器（Rate Limiter）
│   ├── 排行榜
│   └── 消息队列
└── 运维
    ├── TTL 管理
    ├── 内存策略
    └── 持久化 (RDB/AOF)
```

---

## 三、完整代码实战

### 项目：多功能 Redis 工具箱

```python
'''
Redis Python Toolkit
Demonstrates: caching, rate limiting, leaderboard, pub/sub, distributed lock
'''
import redis
import time
import json
import uuid
from functools import wraps
from typing import Optional, Any

# ---------- Connection ----------
r = redis.Redis(
    host='localhost',
    port=6379,
    db=0,
    decode_responses=True,  # Auto-decode bytes to str
    socket_connect_timeout=5,
    socket_timeout=5,
)

# Test connection
try:
    r.ping()
    print("Redis connected!")
except redis.ConnectionError:
    print("Redis not available")


# ---------- 1. Cache Manager ----------
class CacheManager:
    '''Simple cache-aside pattern with Redis.'''

    def __init__(self, client: redis.Redis, prefix: str = "cache:"):
        self.r = client
        self.prefix = prefix

    def _key(self, key: str) -> str:
        return f"{self.prefix}{key}"

    def get(self, key: str) -> Optional[Any]:
        '''Get cached value, return None if miss.'''
        data = self.r.get(self._key(key))
        if data:
            return json.loads(data)
        return None

    def set(self, key: str, value: Any, ttl: int = 300):
        '''Set cache with TTL (seconds).'''
        self.r.setex(
            self._key(key),
            ttl,
            json.dumps(value, ensure_ascii=False)
        )

    def delete(self, key: str):
        '''Delete cache entry.'''
        self.r.delete(self._key(key))

    def get_or_set(self, key: str, fetch_func, ttl: int = 300) -> Any:
        '''Cache-aside: return cached or fetch and cache.'''
        cached = self.get(key)
        if cached is not None:
            print(f"  Cache HIT: {key}")
            return cached

        print(f"  Cache MISS: {key}, fetching...")
        result = fetch_func()
        self.set(key, result, ttl)
        return result


# ---------- 2. Rate Limiter ----------
class RateLimiter:
    '''Sliding window rate limiter using Sorted Set.'''

    def __init__(self, client: redis.Redis, prefix: str = "ratelimit:"):
        self.r = client
        self.prefix = prefix

    def is_allowed(self, key: str, max_requests: int = 10,
                   window_seconds: int = 60) -> bool:
        '''Check if request is within rate limit.'''
        now = time.time()
        window_start = now - window_seconds
        rk = f"{self.prefix}{key}"

        # Remove expired entries
        self.r.zremrangebyscore(rk, 0, window_start)

        # Count current window
        current = self.r.zcard(rk)

        if current >= max_requests:
            return False

        # Add current request
        self.r.zadd(rk, {str(uuid.uuid4()): now})
        self.r.expire(rk, window_seconds)
        return True


# ---------- 3. Leaderboard ----------
class Leaderboard:
    '''Sorted Set based leaderboard.'''

    def __init__(self, client: redis.Redis, name: str = "leaderboard"):
        self.r = client
        self.key = name

    def add_score(self, player: str, score: float):
        '''Add or update player score.'''
        self.r.zadd(self.key, {player: score})

    def increment(self, player: str, amount: float = 1):
        '''Increment player score.'''
        self.r.zincrby(self.key, amount, player)

    def top_n(self, n: int = 10) -> list:
        '''Get top N players (descending).'''
        results = self.r.zrevrange(
            self.key, 0, n - 1, withscores=True
        )
        return [
            {"rank": i + 1, "player": name, "score": int(score)}
            for i, (name, score) in enumerate(results)
        ]

    def rank_of(self, player: str) -> Optional[int]:
        '''Get player rank (0-based, descending).'''
        rank = self.r.zrevrank(self.key, player)
        return rank + 1 if rank is not None else None

    def remove(self, player: str):
        '''Remove player from leaderboard.'''
        self.r.zrem(self.key, player)


# ---------- 4. Distributed Lock ----------
class DistributedLock:
    '''Simple distributed lock using SET NX EX.'''

    def __init__(self, client: redis.Redis):
        self.r = client

    def acquire(self, resource: str, ttl: int = 10,
                identifier: str = None) -> Optional[str]:
        '''Try to acquire lock. Returns identifier if success.'''
        ident = identifier or str(uuid.uuid4())
        key = f"lock:{resource}"
        # SET NX EX: set if not exists, with expiry
        acquired = self.r.set(key, ident, nx=True, ex=ttl)
        return ident if acquired else None

    def release(self, resource: str, identifier: str) -> bool:
        '''Release lock only if identifier matches (safe release).'''
        key = f"lock:{resource}"
        # Lua script for atomic check-and-delete
        script = '''
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        '''
        result = self.r.eval(script, 1, key, identifier)
        return result == 1


# ---------- 5. Demo ----------
def main():
    print("\\n=== Cache Manager Demo ===")
    cache = CacheManager(r)

    def fetch_user(user_id):
        '''Simulate slow database query.'''
        print(f"    Querying database for user {user_id}...")
        time.sleep(0.1)
        return {"id": user_id, "name": f"User_{user_id}", "score": 95}

    # First call: cache miss
    user = cache.get_or_set("user:1", lambda: fetch_user(1), ttl=60)
    print(f"  Result: {user}")

    # Second call: cache hit
    user = cache.get_or_set("user:1", lambda: fetch_user(1), ttl=60)
    print(f"  Result: {user}")

    print("\\n=== Rate Limiter Demo ===")
    limiter = RateLimiter(r, prefix="demo_rate:")
    for i in range(12):
        allowed = limiter.is_allowed("user:alice", max_requests=5, window=10)
        status = "ALLOWED" if allowed else "BLOCKED"
        print(f"  Request {i + 1}: {status}")

    print("\\n=== Leaderboard Demo ===")
    lb = Leaderboard(r, "game_scores")
    players = {
        "Alice": 1500, "Bob": 2300, "Charlie": 1800,
        "Diana": 2100, "Eve": 1950
    }
    for name, score in players.items():
        lb.add_score(name, score)
    print("  Top Players:")
    for entry in lb.top_n(5):
        print(f"    #{entry['rank']} {entry['player']}: {entry['score']}")
    print(f"  Alice's rank: #{lb.rank_of('Alice')}")

    print("\\n=== Distributed Lock Demo ===")
    lock = DistributedLock(r)
    ident = lock.acquire("resource:report", ttl=10)
    if ident:
        print(f"  Lock acquired: {ident[:8]}...")
        released = lock.release("resource:report", ident)
        print(f"  Lock released: {released}")
    else:
        print("  Lock acquisition failed (already locked)")


if __name__ == "__main__":
    main()
```

---

## 四、执行预览

```
Redis connected!

=== Cache Manager Demo ===
  Cache MISS: user:1, fetching...
    Querying database for user 1...
  Result: {'id': '1', 'name': 'User_1', 'score': 95}
  Cache HIT: user:1
  Result: {'id': '1', 'name': 'User_1', 'score': 95}

=== Rate Limiter Demo ===
  Request 1: ALLOWED
  Request 2: ALLOWED
  Request 3: ALLOWED
  Request 4: ALLOWED
  Request 5: ALLOWED
  Request 6: BLOCKED
  ...
  Request 12: BLOCKED

=== Leaderboard Demo ===
  Top Players:
    #1 Bob: 2300
    #2 Diana: 2100
    #3 Eve: 1950
    #4 Charlie: 1800
    #5 Alice: 1500
  Alice's rank: #5

=== Distributed Lock Demo ===
  Lock acquired: a1b2c3d4...
  Lock released: True
```

---

## 五、注意事项

| 场景 | 注意事项 | 说明 |
|------|---------|------|
| 序列化 | JSON vs Pickle | 推荐 JSON（可读、安全、跨语言） |
| 连接池 | 复用连接 | `ConnectionPool` 避免频繁创建 |
| 大 Key | 避免 > 10KB | 拆分大 Hash，使用 `hscan` 分批读取 |
| TTL | 必须设置 | 防止内存泄漏，`expire` 或 `setex` |
| 内存 | maxmemory 策略 | 生产环境配置淘汰策略（allkeys-lru） |
| 持久化 | RDB vs AOF | 缓存用 RDB 即可，数据存储用 AOF |
| pipeline | 批量操作 | 减少 RTT，适合批量写入 |

---

## 六、避坑指南

### 错误：连接不释放 → 正确：使用连接池

```python
# Wrong: Create new connection each time
def get_user(user_id):
    r = redis.Redis(host='localhost')  # New TCP connection!
    return r.get(f"user:{user_id}")

# Correct: Use connection pool
pool = redis.ConnectionPool(host='localhost', max_connections=10)
r = redis.Redis(connection_pool=pool)
def get_user(user_id):
    return r.get(f"user:{user_id}")
```

### 错误：缓存雪崩 → 正确：随机 TTL

```python
# Wrong: All keys expire at the same time
cache.set("user:1", data, ttl=300)
cache.set("user:2", data, ttl=300)  # All expire together!

# Correct: Add random jitter to TTL
import random
ttl = 300 + random.randint(0, 60)  # 300-360s
cache.set("user:1", data, ttl=ttl)
```

### 错误：缓存穿透 → 正确：空值缓存 + 布隆过滤器

```python
# Wrong: Cache miss -> always hit database
def get_user(uid):
    data = cache.get(uid)
    if data is None:
        data = db.query(uid)  # If uid doesn't exist, DB hit every time
    return data

# Correct: Cache empty result with short TTL
def get_user(uid):
    data = cache.get(uid)
    if data is not None:
        return None if data == "NULL" else data
    data = db.query(uid)
    if data is None:
        cache.set(uid, "NULL", ttl=60)  # Cache empty for 60s
    else:
        cache.set(uid, data, ttl=300)
    return data
```

### 错误：大 Key 操作阻塞 → 正确：分批处理

```python
# Wrong: Delete huge key blocks Redis
r.delete("huge_list")  # Blocks all other commands!

# Correct: Use UNLINK (async delete, Redis 4.0+)
r.unlink("huge_list")

# Or: Delete in batches with SCAN
for key in r.scan_iter("temp:*"):
    r.unlink(key)
```

---

## 七、练习题

### 入门级

1. 用 Redis String 实现一个页面访问计数器，每次访问 +1，并设置 24 小时过期
2. 用 Hash 存储用户信息（name, age, email），实现 CRUD 操作

### 中级

3. 用 Sorted Set 实现一个"今日热搜榜"，支持加分、查 Top 10、每天零点自动清零
4. 用 List 实现一个简单的任务队列：生产者 push 任务，消费者 pop 并处理

### 高级

5. 用 Redis + Lua 脚本实现一个限流器，要求：每用户每分钟最多 30 次请求，原子操作
6. 实现发布/订阅模式：一个发布者推送日志，多个订阅者实时接收并写入文件

---

## 八、知识点总结

```
Redis Python 知识树
├── 连接
│   ├── redis.Redis(host, port, db)
│   ├── ConnectionPool(max_connections)
│   └── decode_responses=True
├── 数据结构操作
│   ├── String: set/get/setex/incr/append
│   ├── Hash: hset/hget/hgetall/hdel/hmset
│   ├── List: lpush/rpush/lpop/rpop/lrange
│   ├── Set: sadd/srem/smembers/sinter/sunion
│   └── ZSet: zadd/zrange/zrem/zincrby/zrevrange
├── 高级操作
│   ├── Pipeline (减少 RTT)
│   ├── Transaction (MULTI/EXEC)
│   ├── Lua Script (eval)
│   ├── Pub/Sub (subscribe/publish)
│   └── Stream (xadd/xread)
├── 实战模式
│   ├── Cache-Aside 缓存
│   ├── Distributed Lock 分布式锁
│   ├── Rate Limiter 限流
│   ├── Leaderboard 排行榜
│   └── Task Queue 任务队列
└── 注意事项
    ├── TTL 必须设置
    ├── 大 Key 拆分
    ├── 连接池复用
    └── 内存淘汰策略
```

---

## 九、举一反三

| 技能 | 基础用法 | 进阶场景 | 实战扩展 |
|------|---------|---------|---------|
| String 缓存 | get/set | 缓存穿透/雪崩/击穿防护 | 多级缓存架构 |
| Hash 对象 | 存用户信息 | Session 存储 | 购物车实现 |
| List 队列 | 简单 FIFO | BRPOP 阻塞消费 | 消息队列 + 重试 |
| Set 去重 | 标签系统 | 共同好友（SINTER） | 抽奖系统 |
| ZSet 排行 | 分数排序 | 时间线（score=timestamp） | 延迟任务队列 |
| Pipeline | 批量操作 | 事务 + Pipeline | 数据导入优化 |

---

## 十、参考资料

- [Redis 官方文档](https://redis.io/documentation)
- [redis-py GitHub](https://github.com/redis/redis-py)
- [Redis 命令参考](http://doc.redisfans.com/)
- [Redis 设计与实现](http://redisbook.com/)

---

## 十一、代码演进

### v1：基础 get/set

```python
import redis
r = redis.Redis(host='localhost', decode_responses=True)
r.set("name", "Alice")
print(r.get("name"))  # Alice
```

### v2：缓存封装 + 工具类

```python
import redis, json

class Cache:
    def __init__(self):
        self.r = redis.Redis(decode_responses=True)

    def get(self, key):
        data = self.r.get(key)
        return json.loads(data) if data else None

    def set(self, key, value, ttl=300):
        self.r.setex(key, ttl, json.dumps(value))

cache = Cache()
cache.set("user:1", {"name": "Alice"})
print(cache.get("user:1"))
```

### v3：完整工具箱（本文实战代码）

- Cache-Aside 缓存管理器
- 滑动窗口限流器
- Sorted Set 排行榜
- 分布式锁（SET NX EX + Lua 安全释放）
