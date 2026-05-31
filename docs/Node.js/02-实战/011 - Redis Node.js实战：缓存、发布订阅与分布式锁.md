---
title: "011 - Redis Node.js实战：缓存、发布订阅与分布式锁"
slug: "011-redis-node"
category: "Node.js实战"
tech_stack: "Node.js"
created_at: "2026-04-29T06:16:59.725+08:00"
updated_at: "2026-04-29T10:02:48.102+08:00"
reading_time: 41
tags: []
---

## ⚡ 难度标注

**难度：⭐⭐⭐ 中级** | 预计学习时间：50分钟 | 前置知识：Node.js基础、异步编程

---

## 📖 概念讲解

### Redis是什么？

Redis（Remote Dictionary Server）是内存键值数据库，单线程模型保证原子性。核心优势：
- **极快**：内存操作，10万+ QPS
- **丰富数据结构**：String、Hash、 List、Set、Sorted Set、Stream
- **持久化**：RDB快照 + AOF日志，重启不丢数据
- **发布订阅**：内置消息队列能力

### Node.js中用Redis做什么？

| 用途 | 说明 | 数据结构 |
|------|------|----------|
| 缓存 | 热点数据缓存，减轻DB压力 | String（JSON） |
| 会话管理 | 用户登录状态 | String + TTL |
| 排行榜 | 游戏积分、热门文章 | Sorted Set |
| 消息队列 | 异步任务处理 | List / Stream |
| 实时通知 | Pub/Sub消息推送 | Pub/Sub |
| 分布式锁 | 防止并发重复操作 | String + Lua |
| 限流 | API访问频率控制 | String + TTL |

### ioredis vs node-redis？

| 对比 | ioredis | node-redis (v4+) |
|------|---------|-------------------|
| TypeScript | ✅ 完善 | ✅ 完善 |
| Cluster | ✅ 原生支持 | ✅ 支持 |
| Pipeline | ✅ | ✅ |
| Lua脚本 | ✅ 内置 | ✅ 内置 |
| 社区 | 更成熟 | 官方维护 |
| 推荐 | **生产首选** | 官方项目 |

本文使用 **ioredis**。

---

## 🧠 知识脑图

```
Redis + Node.js (ioredis)
├── Connection
│   ├── new Redis() / Redis Cluster
│   ├── Connection Events (connect, error, close)
│   └── Pipeline / Multi
├── Data Structures
│   ├── String: SET/GET/INCR/SETEX
│   ├── Hash: HSET/HGET/HMGET/HDEL
│   ├── List: LPUSH/RPOP/LRANGE
│   ├── Set: SADD/SREM/SMEMBERS
│   └── Sorted Set: ZADD/ZRANGE/ZREVRANK
├── Patterns
│   ├── Cache-Aside (lazy load)
│   ├── Write-Through
│   └── Cache Eviction (TTL + maxmemory)
├── Pub/Sub
│   ├── subscribe / unsubscribe
│   ├── publish
│   └── Pattern subscribe
├── Distributed Lock
│   ├── SET NX EX
│   ├── Redlock algorithm
│   └── Lua script for unlock
├── Rate Limiting
│   ├── Fixed window
│   ├── Sliding window
│   └── Token bucket
└── Queue
    ├── List-based (LPUSH + BRPOP)
    └── Stream (XADD + XREADGROUP)
```

---

## 💻 完整代码：生产级Redis服务封装

### 项目结构

```
project/
├── src/
│   ├── services/
│   │   ├── redis.js
│   │   ├── cache.js
│   │   ├── lock.js
│   │   └── queue.js
│   └── app.js
├── package.json
└── .env
```

### v1 连接管理 + 基础数据结构操作

```javascript
// src/services/redis.js - Redis Connection Manager
const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
  }

  connect(options = {}) {
    const defaultOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        console.log(`Redis retry connection in ${delay}ms (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3
    };

    this.client = new Redis({ ...defaultOptions, ...options });

    this.client.on('connect', () => console.log('Redis connected'));
    this.client.on('error', (err) => console.error('Redis error:', err.message));
    this.client.on('close', () => console.log('Redis connection closed'));

    // Separate connections for pub/sub (required by Redis protocol)
    this.subscriber = new Redis({ ...defaultOptions, ...options });
    this.publisher = new Redis({ ...defaultOptions, ...options });

    return this.client;
  }

  async disconnect() {
    await this.client?.quit();
    await this.subscriber?.quit();
    await this.publisher?.quit();
    console.log('All Redis connections closed');
  }

  async ping() {
    return await this.client.ping();
  }
}

const redisService = new RedisService();
module.exports = redisService;
```

```javascript
// v1: Basic data structure operations
const redisService = require('./services/redis');

async function basicOperations() {
  const redis = redisService.connect();

  // ===== STRING =====
  await redis.set('user:1001', JSON.stringify({ name: 'Zhang San', role: 'admin' }), 'EX', 3600);
  const user = JSON.parse(await redis.get('user:1001'));
  console.log('User:', user);

  // Counter (atomic increment)
  await redis.set('page:home:views', 0);
  await redis.incr('page:home:views');
  await redis.incrby('page:home:views', 10);
  console.log('Page views:', await redis.get('page:home:views'));

  // ===== HASH =====
  await redis.hmset('product:2001', {
    name: 'MacBook Pro', price: '14999', stock: '50', category: 'laptop'
  });
  const product = await redis.hgetall('product:2001');
  console.log('Product:', product);
  await redis.hincrby('product:2001', 'stock', -1);
  console.log('Stock after sale:', await redis.hget('product:2001', 'stock'));

  // ===== LIST =====
  await redis.lpush('queue:emails', JSON.stringify({ to: 'a@test.com', subject: 'Welcome' }));
  await redis.lpush('queue:emails', JSON.stringify({ to: 'b@test.com', subject: 'Verify' }));
  const task = await redis.rpop('queue:emails');
  console.log('Processing:', JSON.parse(task));

  // ===== SET =====
  await redis.sadd('visitors:2026-04-29', 'user1', 'user2', 'user3', 'user1');
  console.log('Unique visitors:', await redis.scard('visitors:2026-04-29'));

  // ===== SORTED SET =====
  await redis.zadd('leaderboard:game1', 1500, 'player1', 2300, 'player2', 1800, 'player3');
  const topPlayers = await redis.zrevrange('leaderboard:game1', 0, 2, 'WITHSCORES');
  console.log('Top players:', topPlayers);

  // Pipeline: batch commands (reduces round trips)
  const pipeline = redis.pipeline();
  pipeline.set('k1', 'v1');
  pipeline.set('k2', 'v2');
  pipeline.get('k1');
  const results = await pipeline.exec();
  console.log('Pipeline results:', results.map(r => r[1]));

  await redisService.disconnect();
}
```

### v2 缓存策略 + 发布订阅

```javascript
// src/services/cache.js - Smart Cache Layer
const redisService = require('./redis');

class CacheService {
  constructor(prefix = 'cache') {
    this.prefix = prefix;
    this.redis = null;
  }

  init() {
    this.redis = redisService.connect();
  }

  _key(key) {
    return `${this.prefix}:${key}`;
  }

  // Cache-Aside pattern: try cache, miss -> fetch -> store
  async getOrFetch(key, fetchFn, ttl = 300) {
    const cached = await this.redis.get(this._key(key));
    if (cached) {
      console.log(`Cache HIT: ${key}`);
      return JSON.parse(cached);
    }

    console.log(`Cache MISS: ${key}, fetching...`);
    const data = await fetchFn();
    await this.redis.set(this._key(key), JSON.stringify(data), 'EX', ttl);
    return data;
  }

  // Invalidate cache by pattern (use SCAN, not KEYS!)
  async invalidatePattern(pattern) {
    const stream = this.redis.scanStream({
      match: `${this.prefix}:${pattern}`, count: 100
    });

    return new Promise((resolve) => {
      const keys = [];
      stream.on('data', (resultKeys) => keys.push(...resultKeys));
      stream.on('end', async () => {
        if (keys.length > 0) {
          await this.redis.del(...keys);
          console.log(`Invalidated ${keys.length} keys matching: ${pattern}`);
        }
        resolve(keys.length);
      });
    });
  }

  // Warm up cache (preload)
  async warmUp(entries) {
    const pipeline = this.redis.pipeline();
    for (const [key, value, ttl] of entries) {
      pipeline.set(this._key(key), JSON.stringify(value), 'EX', ttl || 300);
    }
    await pipeline.exec();
    console.log(`Warmed up ${entries.length} cache entries`);
  }
}

module.exports = new CacheService();
```

```javascript
// v2: Pub/Sub real-time messaging
async function pubSubDemo() {
  redisService.connect();
  const { subscriber, publisher } = redisService;

  subscriber.subscribe('notifications', 'chat:room1');
  subscriber.on('message', (channel, message) => {
    console.log(`[${channel}] Received: ${message}`);
  });

  // Pattern subscription (all chat rooms)
  subscriber.psubscribe('chat:*');
  subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`[Pattern:${pattern}][${channel}] ${message}`);
  });

  // Publish messages
  await publisher.publish('notifications', JSON.stringify({
    type: 'new_order', data: { orderId: 'ORD-001', amount: 299 }
  }));
  await publisher.publish('chat:room1', 'Hello from room 1!');

  // Cache usage
  const cache = require('./services/cache');
  cache.init();

  const user = await cache.getOrFetch('user:1001', async () => {
    console.log('Fetching from database...');
    return { id: 1001, name: 'Zhang San', email: 'zs@example.com' };
  }, 600);

  // Second call - cache hit
  await cache.getOrFetch('user:1001', async () => ({ should: 'not run' }), 600);
}
```

### v3 分布式锁 + 限流 + 消息队列

```javascript
// src/services/lock.js - Distributed Lock with Lua
const redisService = require('./redis');

class DistributedLock {
  constructor() {
    this.redis = null;
    // Lua script: unlock only if value matches (prevents unlocking others' lock)
    this.unlockScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
  }

  init() {
    this.redis = redisService.connect();
  }

  async acquire(key, ttlMs = 10000) {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const lockKey = `lock:${key}`;
    const result = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async release(key, token) {
    const lockKey = `lock:${key}`;
    const result = await this.redis.eval(this.unlockScript, 1, lockKey, token);
    return result === 1;
  }

  // Execute function with lock (auto acquire/release)
  async withLock(key, fn, ttlMs = 10000) {
    const token = await this.acquire(key, ttlMs);
    if (!token) throw new Error(`Failed to acquire lock: ${key}`);
    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}

module.exports = new DistributedLock();
```

```javascript
// src/services/queue.js - Redis Stream-based Queue
const redisService = require('./redis');

class MessageQueue {
  constructor(streamKey) {
    this.streamKey = streamKey;
    this.groupName = 'workers';
    this.consumerName = `worker-${process.pid}`;
    this.redis = null;
  }

  init() {
    this.redis = redisService.connect();
  }

  async enqueue(data) {
    return await this.redis.xadd(this.streamKey, '*',
      'data', JSON.stringify(data), 'createdAt', Date.now().toString());
  }

  async createGroup() {
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.groupName, '$', 'MKSTREAM');
    } catch (err) {
      if (!err.message.includes('BUSYGROUP')) throw err;
    }
  }

  async consume(processFn, { count = 10, block = 5000 } = {}) {
    await this.createGroup();
    const messages = await this.redis.xreadgroup(
      'GROUP', this.groupName, this.consumerName,
      'COUNT', count, 'BLOCK', block, '>', this.streamKey
    );

    if (!messages || messages.length === 0) return [];

    const results = [];
    for (const [, msgs] of messages) {
      for (const [id, fields] of msgs) {
        try {
          await processFn(JSON.parse(fields.data));
          await this.redis.xack(this.streamKey, this.groupName, id);
          results.push({ id, status: 'processed' });
        } catch (error) {
          results.push({ id, status: 'failed', error: error.message });
        }
      }
    }
    return results;
  }
}

module.exports = MessageQueue;
```

```javascript
// v3: Rate limiter (sliding window with sorted set)
class RateLimiter {
  constructor(redis, { windowMs = 60000, maxRequests = 100 } = {}) {
    this.redis = redis;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const rateKey = `rate:${key}`;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(rateKey, 0, windowStart);
    pipeline.zadd(rateKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(rateKey);
    pipeline.pexpire(rateKey, this.windowMs);

    const results = await pipeline.exec();
    const count = results[2][1];

    return {
      allowed: count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - count),
      resetAt: new Date(now + this.windowMs)
    };
  }
}
```

---

## ▶️ 执行预览

```bash
$ npm install ioredis
$ node src/app.js

Redis connected
User: { name: 'Zhang San', role: 'admin' }
Page views: 11
Stock after sale: 49
Processing: { to: 'a@test.com', subject: 'Welcome' }
Unique visitors: 3
Top players: [ 'player2', '2300', 'player3', '1800', 'player1', '1500' ]
Cache MISS: user:1001, fetching...
Fetching from database...
Cache HIT: user:1001
Order created: { orderId: 'ORD-001', status: 'created' }
Request 1: allowed=true, remaining=4
Request 6: allowed=false, remaining=0
```

---

## ⚠️ 注意事项

| 类别 | 要点 | 说明 |
|------|------|------|
| 连接 | Pub/Sub需独立连接 | subscribe后该连接只能pub/sub，不能做其他操作 |
| 连接 | Pipeline批量 | 多条命令一次发送，减少RTT |
| 内存 | KEYS命令 | 生产环境禁用KEYS *，用SCAN替代 |
| 内存 | 大Key | 单个value不要超过10KB，大Value拆分 |
| 内存 | maxmemory策略 | 设置淘汰策略：allkeys-lru推荐 |
| 数据 | 序列化 | JSON.stringify/parse有开销，考虑msgpack |
| 数据 | TTL | 所有缓存必须设TTL，防止内存泄漏 |
| 并发 | 原子操作 | 用Lua脚本保证复合操作原子性 |
| 集群 | 不支持多key事务 | 不同slot的key无法在一个事务中操作 |
| 持久化 | RDB vs AOF | RDB适合备份，AOF适合数据安全，可组合 |

---

## 🚫 避坑指南

❌ **缓存不设TTL**
```javascript
// BAD: Cache lives forever, memory leak
await redis.set('user:1001', JSON.stringify(data));
```
✅ **始终设TTL**
```javascript
// GOOD: Auto-expire after 10 minutes
await redis.set('user:1001', JSON.stringify(data), 'EX', 600);
```

❌ **用KEYS查找键**
```javascript
// BAD: Blocks Redis, O(N) scan all keys
const keys = await redis.keys('user:*');
```
✅ **用SCAN流式扫描**
```javascript
// GOOD: Non-blocking iterative scan
const stream = redis.scanStream({ match: 'user:*', count: 100 });
stream.on('data', keys => { /* process batch */ });
```

❌ **手动解锁被别人的锁**
```javascript
// BAD: Race condition - might delete someone else's lock
await redis.del('lock:order:1001');
```
✅ **Lua脚本原子检查后删除**
```javascript
// GOOD: Only delete if value matches our token
const script = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else return 0 end
`;
await redis.eval(script, 1, 'lock:order:1001', myToken);
```

❌ **在Node.js中阻塞等待锁**
```javascript
// BAD: Blocks event loop
while (!(token = await lock.acquire('key'))) {
  await sleep(100);
}
```
✅ **设重试上限或直接失败**
```javascript
// GOOD: Retry with limit
for (let i = 0; i < 3; i++) {
  token = await lock.acquire('key');
  if (token) break;
  await new Promise(r => setTimeout(r, 200 * (i + 1)));
}
if (!token) throw new Error('Lock acquisition timeout');
```

---

## 🏋️ 练习题

### 🟢 入门级

1. 使用Redis Hash存储用户资料（name、age、email），实现HMSET/HGETALL/HDEL的完整CRUD。

2. 用Sorted Set实现一个"今日热搜"功能，每次浏览文章ZINCRBY +1，ZRANGE取Top10。

### 🟡 进阶级

3. 实现一个Cache-Aside缓存层：先查Redis，未命中则查MySQL并回写Redis（TTL 5分钟）。处理缓存穿透（查询不存在的数据）。

4. 用Pub/Sub实现一个简易聊天室：支持多个客户端加入房间、发送消息、接收其他人的消息。

### 🔴 挑战级

5. 实现一个完整的分布式锁系统：支持可重入锁、锁续期（watchdog）、Redlock算法（多节点）。处理锁超时后自动释放但任务仍在执行的边界情况。

6. 用Redis Stream实现一个可靠消息队列：支持消费者组、消息确认、死信队列（处理失败消息）、消息积压监控。

---

## 📚 知识点总结

```
Redis + Node.js
├── 连接管理
│   ├── ioredis配置 (retryStrategy)
│   ├── Pipeline批量操作
│   └── Pub/Sub独立连接
├── 5大数据结构
│   ├── String: 缓存/计数器/分布式锁
│   ├── Hash: 对象存储
│   ├── List: 队列/栈
│   ├── Set: 去重/交集并集
│   └── Sorted Set: 排行榜/限流
├── 缓存模式
│   ├── Cache-Aside (最常用)
│   ├── Write-Through
│   └── 缓存失效 (TTL/pattern)
├── 高级模式
│   ├── 分布式锁 (SET NX + Lua)
│   ├── 限流器 (Sliding Window)
│   ├── Pub/Sub消息
│   └── Stream队列
└── 生产实践
    ├── SCAN替代KEYS
    ├── maxmemory策略
    ├── 大Key拆分
    └── 持久化 (RDB + AOF)
```

---

## 🔗 举一反三

| 本文学到的 | 延伸场景 | 关键差异 |
|------------|----------|----------|
| 单机Redis | Redis Cluster | 16384 slots分片，跨slot操作需hash tag |
| Cache-Aside | 多级缓存 | L1本地缓存 + L2 Redis + L3 DB |
| 简单限流 | 令牌桶/漏桶 | 支持突发流量、平滑限流 |
| Pub/Sub | Redis Streams | Stream支持持久化和消费者组，Pub/Sub不持久 |
| List队列 | BullMQ/Bull | 完整的Job队列：重试、优先级、延迟、进度 |
| Lua分布式锁 | Redlock | 多节点投票，抗单点故障 |
| Redis缓存 | CDN缓存 | CDN缓存静态资源，Redis缓存动态数据 |

---

## 📖 参考资料

- [ioredis官方文档](https://github.com/redis/ioredis)
- [Redis命令参考](https://redis.io/commands)
- [Redis Streams详解](https://redis.io/docs/data-types/streams/)
- [分布式锁的正确实现](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Redis内存优化](https://redis.io/docs/manual/eviction/)

---

## 🔄 代码演进总结

| 版本 | 主题 | 核心能力 |
|------|------|----------|
| v1 | 连接 + 数据结构 | ioredis连接管理、5大数据结构操作、Pipeline |
| v2 | 缓存 + Pub/Sub | Cache-Aside缓存、SCAN扫描、发布订阅实时消息 |
| v3 | 锁 + 限流 + 队列 | 分布式锁(Lua)、滑动窗口限流、Stream消息队列 |

> 💡 **学习路径**：v1掌握数据结构和基本操作 → v2学会缓存策略和消息模式 → v3理解分布式场景下的高级应用。Redis的精髓在于选对数据结构解决对的问题。
