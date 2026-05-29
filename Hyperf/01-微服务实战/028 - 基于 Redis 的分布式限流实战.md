---
title: "028 - 基于 Redis 的分布式限流实战"
slug: "028-redis-rate-limit"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.949+08:00"
updated_at: "2026-05-01T22:17:27.345+08:00"
reading_time: 4
tags: []
---

# 基于 Redis 的分布式限流实战

## 难度标注

⭐⭐⭐⭐（中高级）

**前置知识：** 限流算法基础、Redis、Hyperf 中间件

**预估用时：** 50-60 分钟

---

## 概念讲解

**分布式限流** 是在多实例部署环境下，通过集中式存储（如 Redis）共享限流状态，确保所有服务实例遵循统一的限流规则。与单机限流不同，分布式限流需要处理网络延迟、时钟偏差和原子性等问题。

**现实类比：** 游乐园的过山车限流。如果是单机限流，就是每个入口各自数人数——东门放 50 个，南门也放 50 个，总共进来 100 个，超了。分布式限流就是所有入口共享一块电子计数板（Redis），总数到 50 就所有入口同时停。

**技术场景：** 用户服务部署了 3 个实例，注册接口限流 50 QPS。如果每个实例各自限 50，总共可能 150 QPS 打到数据库。需要用 Redis 集中计数，3 个实例共享 50 QPS 的总额度。

---

## 实时脑图

```
         Instance A ───┐
         Instance B ───┼──► Redis (Shared State) ──► Lua Script
         Instance C ───┘         │
                                │
                    ┌───────────▼───────────┐
                    │   Token Bucket State  │
                    │   tokens: 45          │
                    │   last_refill: 1234.5 │
                    │                       │
                    │   Sliding Window      │
                    │   ZSET: timestamps    │
                    │   count: 32           │
                    └───────────────────────┘
                          │
                    ┌─────▼──────┐
                    │  Allow /   │
                    │  Deny      │
                    │  (atomic)  │
                    └────────────┘
```

---

## 完整代码

### 1. 分布式限流服务

```php
<?php
// app/Service/RateLimit/DistributedRateLimiter.php

declare(strict_types=1);

namespace App\Service\RateLimit;

use Hyperf\Redis\Redis;
use Hyperf\Redis\RedisFactory;

class DistributedRateLimiter
{
    private const KEY_PREFIX = 'ratelimit:';

    public function __construct(
        private RedisFactory $redisFactory
    ) {}

    /**
     * ✅ Distributed sliding window with Lua atomicity
     * Uses Redis Sorted Set for precise time-based counting
     */
    public function slidingWindow(
        string $resource,
        string $identity,
        int $limit,
        int $windowSeconds
    ): RateLimitResult {
        $redis = $this->redisFactory->get('default');
        $key = self::KEY_PREFIX . "sw:{$resource}:{$identity}";
        $now = time();
        $windowStart = $now - $windowSeconds;

        // ✅ Atomic Lua script: cleanup + count + add
        $script = <<<'LUA'
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, window_start * -1 + now + 1)
    return count + 1
else
    return -1
end
LUA;

        // ✅ Unique member: timestamp + random to avoid collision
        $member = "{$now}:" . bin2hex(random_bytes(4));

        $result = $redis->eval($script, [$key, $limit, $windowStart, $now, $member], 1);

        if ((int)$result === -1) {
            // 🔴 Rate limit exceeded
            $ttl = $redis->ttl($key);
            return new RateLimitResult(
                allowed: false,
                remaining: 0,
                limit: $limit,
                retryAfter: max($ttl, 1),
            );
        }

        // ✅ Request allowed
        return new RateLimitResult(
            allowed: true,
            remaining: max(0, $limit - (int)$result),
            limit: $limit,
            retryAfter: 0,
        );
    }

    /**
     * ✅ Distributed token bucket with Lua atomicity
     */
    public function tokenBucket(
        string $resource,
        string $identity,
        int $maxTokens,
        int $refillPerSecond,
        int $cost = 1
    ): RateLimitResult {
        $redis = $this->redisFactory->get('default');
        $key = self::KEY_PREFIX . "tb:{$resource}:{$identity}";
        $now = sprintf('%.3f', microtime(true));

        $script = <<<'LUA'
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_time')
local tokens = tonumber(data[1])
local last_time = tonumber(data[2])

-- Initialize if not exists
if tokens == nil then
    tokens = max_tokens
    last_time = now
end

-- ✅ Refill tokens based on elapsed time
local elapsed = math.max(0, now - last_time)
tokens = math.min(max_tokens, tokens + elapsed * refill_rate)
last_time = now

local allowed = 0
local remaining = tokens

if tokens >= cost then
    tokens = tokens - cost
    remaining = tokens
    allowed = 1
end

-- Save state
redis.call('HMSET', key, 'tokens', tokens, 'last_time', now)
redis.call('EXPIRE', key, math.ceil(max_tokens / refill_rate) + 2)

return {allowed, math.floor(remaining)}
LUA;

        $result = $redis->eval($script, [$key, $maxTokens, $refillPerSecond, $cost, $now], 1);

        $allowed = (int)$result[0] === 1;
        $remaining = (int)$result[1];

        return new RateLimitResult(
            allowed: $allowed,
            remaining: $remaining,
            limit: $maxTokens,
            retryAfter: $allowed ? 0 : (int)ceil(($cost - $remaining) / $refillPerSecond),
        );
    }
}
```

### 2. 限流结果对象

```php
<?php
// app/Service/RateLimit/RateLimitResult.php

declare(strict_types=1);

namespace App\Service\RateLimit;

readonly class RateLimitResult
{
    public function __construct(
        public bool $allowed,
        public int $remaining,
        public int $limit,
        public int $retryAfter,
    ) {}

    /**
     * ✅ Convert to HTTP response headers
     */
    public function toHeaders(): array
    {
        return [
            'X-RateLimit-Limit' => (string)$this->limit,
            'X-RateLimit-Remaining' => (string)$this->remaining,
            'Retry-After' => $this->retryAfter > 0 ? (string)$this->retryAfter : '',
        ];
    }
}
```

### 3. 限流中间件

```php
<?php
// app/Middleware/DistributedRateLimitMiddleware.php

declare(strict_types=1);

namespace App\Middleware;

use App\Service\RateLimit\DistributedRateLimiter;
use Hyperf\HttpMessage\Exception\TooManyRequestsHttpException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class DistributedRateLimitMiddleware implements MiddlewareInterface
{
    // ✅ Rate limit rules per route pattern
    private const RULES = [
        ['pattern' => '#^/api/users/register#', 'algorithm' => 'sliding_window', 'limit' => 50, 'window' => 1],
        ['pattern' => '#^/api/users/login#', 'algorithm' => 'sliding_window', 'limit' => 30, 'window' => 1],
        ['pattern' => '#^/api/users/\d+$#', 'algorithm' => 'token_bucket', 'max' => 200, 'refill' => 50],
        ['pattern' => '#^/api/users#', 'algorithm' => 'token_bucket', 'max' => 500, 'refill' => 100],
    ];

    public function __construct(
        private DistributedRateLimiter $limiter
    ) {}

    public function process(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler
    ): ResponseInterface {
        $path = $request->getUri()->getPath();
        $rule = $this->matchRule($path);

        if ($rule === null) {
            return $handler->handle($request);
        }

        // ✅ Build identity: user_id > API key > IP
        $identity = $this->resolveIdentity($request);

        // Apply rate limit
        $result = match ($rule['algorithm']) {
            'sliding_window' => $this->limiter->slidingWindow(
                $path, $identity, $rule['limit'], $rule['window']
            ),
            'token_bucket' => $this->limiter->tokenBucket(
                $path, $identity, $rule['max'], $rule['refill']
            ),
        };

        if (!$result->allowed) {
            // 🔴 Return 429 with rate limit headers
            throw new TooManyRequestsHttpException(
                $result->retryAfter > 0 ? $result->retryAfter : null,
                'Rate limit exceeded. Please retry later.'
            );
        }

        // ✅ Continue processing
        $response = $handler->handle($request);

        // 🟢 Add rate limit info headers to response
        foreach ($result->toHeaders() as $name => $value) {
            if ($value !== '') {
                $response = $response->withHeader($name, $value);
            }
        }

        return $response;
    }

    private function matchRule(string $path): ?array
    {
        foreach (self::RULES as $rule) {
            if (preg_match($rule['pattern'], $path)) {
                return $rule;
            }
        }
        return null;
    }

    private function resolveIdentity(ServerRequestInterface $request): string
    {
        // ✅ Priority: authenticated user > API key > client IP
        $userId = $request->getAttribute('user_id');
        if ($userId) {
            return "user:{$userId}";
        }

        $apiKey = $request->getHeaderLine('x-api-key');
        if ($apiKey) {
            return "key:" . md5($apiKey);
        }

        $ip = $request->getServerParams()['remote_addr'] ?? 'unknown';
        return "ip:{$ip}";
    }
}
```

### 4. 注册中间件

```php
<?php
// config/autoload/middlewares.php

declare(strict_types=1);

return [
    'http' => [
        \App\Middleware\TracePropagationMiddleware::class,
        // ✅ Rate limiting before auth (for public endpoints)
        \App\Middleware\DistributedRateLimitMiddleware::class,
        \App\Middleware\AuthMiddleware::class,
    ],
];
```

---

## 执行预览

```bash
# Normal request - rate limit headers in response
$ curl -v http://localhost:9501/api/users/1 2>&1 | grep -i rate
< X-RateLimit-Limit: 200
< X-RateLimit-Remaining: 199

# Burst 50 register requests
$ for i in $(seq 1 55); do
  curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:9501/api/users/register
  echo
done
200 200 200 ... 200 429 429 429 429 429
# 50 succeed, 5 get 429

# Check rate limit with remaining count
$ curl -v http://localhost:9501/api/users/1 2>&1 | grep -E "RateLimit|Retry"
< X-RateLimit-Limit: 200
< X-RateLimit-Remaining: 150
< Retry-After: 

# When limited:
$ curl -v http://localhost:9501/api/users/register 2>&1 | grep Retry
< Retry-After: 1
```

---

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| Lua 脚本必须原子 | EVAL 是 Redis 原子操作 | 并发竞态导致超限 |
| Key 必须设过期 | ZSET/HSET 都要设 TTL | Redis 内存无限增长 |
| 时钟偏差容忍 | 多实例时钟可能有毫秒级偏差 | 限流不精确 |
| Redis 高可用 | 限流依赖 Redis 可用性 | Redis 挂了限流失效 |
| 降级策略 | Redis 不可用时的兜底 | 要么全放行要么全拒绝 |

---

## 避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| ZSET member 不唯一 | 同一秒的请求互相覆盖 | member 加随机后缀 |
| HMSET 不设过期 | 数据永久残留 | 每次 eval 后设 EXPIRE |
| refillRate 算错 | 令牌生成速度不符合预期 | 单位统一：tokens/second |
| 多实例用不同 Redis | 限流状态不共享 | 所有实例连同一个 Redis |
| Redis 超时不处理 | 限流请求卡住 | 设 Redis 超时 + 降级逻辑 |

---

## 练习题

### 🟢 基础题

1. **压测验证**：用 wrk 对注册接口压测，验证限流是否精确在 50 QPS。

2. **多实例测试**：启动 3 个 Hyperf 实例共享同一个 Redis，验证总限流生效。

### 🟡 进阶题

3. **分级限流**：实现 IP 级 1000 QPS + 用户级 100 QPS 的双层限流，先检查 IP 再检查用户。

### 🔴 开放题

4. **Redis 集群限流**：设计一个支持 Redis Cluster 的分布式限流方案，处理 hash slot 迁移和跨 slot 的问题。

---

## 知识点总结

```
Redis 分布式限流
├── 核心依赖
│   ├── Redis EVAL（Lua 原子执行）
│   ├── Sorted Set（滑动窗口）
│   └── Hash + 过期时间（令牌桶）
├── 实现
│   ├── DistributedRateLimiter
│   ├── RateLimitResult（结果对象）
│   ├── DistributedRateLimitMiddleware
│   └── 路由规则匹配
├── Identity 策略
│   ├── 用户 ID（已认证）
│   ├── API Key
│   └── 客户端 IP
└── 运维
    ├── Rate Limit Headers（标准）
    ├── Redis 高可用
    └── 降级策略
```

---

## 举一反三

| 场景 | 变种说明 | 关键差异 |
|------|----------|----------|
| Redis → Memcached | 不同存储引擎 | Memcached 不支持 Lua |
| 单 Redis → Redis Cluster | 分布式存储 | Key hash slot 必须相同 |
| 限流 → 配额管理 | 按月/按天的配额 | 时间窗口更大，持久化要求高 |

---

## 参考资料

| 资料 | 链接 | 权威等级 |
|------|------|----------|
| Redis EVAL 命令 | https://redis.io/commands/eval/ | ⭐⭐⭐⭐⭐ |
| Redis 限流模式 | https://redis.io/commands/INCR/#pattern-rate-limiter-3 | ⭐⭐⭐⭐ |
| HTTP Rate Limit Headers | https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers | ⭐⭐⭐⭐⭐ |
| Hyperf Redis 组件 | https://hyperf.wiki/3.0/#/zh-cn/redis | ⭐⭐⭐⭐ |

---

## 代码演进

### v1 ❌ 每个实例各自计数

```php
// ❌ Each instance has its own counter
// 3 instances × 50 QPS = 150 QPS actual (exceeds 50 limit!)
static $count = 0;
$count++;
if ($count > 50) {
    throw new TooManyRequestsHttpException();
}
```

### v2 ✅ Redis 集中计数 + Lua 原子

```php
// ✅ All instances share Redis state
// Lua script ensures atomicity
$result = $redis->eval($luaScript, [$key, $limit, $window, $now, $member], 1);
return new RateLimitResult(allowed: (int)$result !== -1, ...);
```

### v3 🟢 标准化中间件 + Headers + 降级

```php
// + Rate limit response headers (X-RateLimit-*)
// + Identity resolution (user > key > IP)
// + Redis timeout + fallback on failure
// + Prometheus metrics for denied requests
```
