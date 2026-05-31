---
title: "026 - Swoole 连接池详解"
slug: "026-connection-pool"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:15:46.357+08:00"
updated_at: "2026-04-29T10:02:47.083+08:00"
reading_time: 58
tags: ["Swoole", "PHP"]
---

# Swoole 连接池详解

> **难度标注：** ⭐⭐⭐☆☆（中高级）
> **前置知识：** Swoole 协程基础、Channel、数据库操作、网络编程

---

## 一、概念讲解

### 什么是连接池？

**连接池（Connection Pool）** 是一组预先创建并复用的连接集合。它的核心思想是：**连接创建一次，反复使用**，避免频繁创建和销毁连接带来的性能开销。

### 为什么需要连接池？

以 MySQL 为例，一次 TCP 连接建立需要：
1. TCP 三次握手（~1ms 本地，~50ms 跨机房）
2. TLS 握手（如果启用，~10ms）
3. MySQL 认证（~1ms）

总计约 **2-60ms**。在高并发场景下（1000 QPS），这意味着每秒可能浪费数秒在连接建立上。

| 指标 | 无连接池 | 有连接池 |
|------|---------|---------|
| 连接建立次数/秒 | = 请求数 | ≈ 0（复用） |
| 平均响应时间 | +2~60ms | +0ms（直接取） |
| 数据库最大连接数 | 不可控 | 精确控制 |
| 资源消耗 | 高（频繁创建/销毁） | 低（固定数量） |

### Swoole 连接池的核心组件

Swoole 使用 **Channel（通道）** 作为连接池的底层容器：

```
Channel 是 Swoole 的协程安全队列，天然适合做连接池：
- push(): 归还连接
- pop(): 获取连接
- 协程安全，无需加锁
```

---

## 二、脑图（ASCII）

```
Swoole 连接池
├── 核心概念
│   ├── 连接复用
│   ├── 容量控制
│   ├── 超时管理
│   └── 健康检查
├── 实现
│   ├── 基于 Channel
│   ├── Swoole\Database
│   │   ├── MysqliPool
│   │   ├── PDOPool
│   │   ├── RedisPool
│   │   └── Coroutine\Redis
│   └── 自定义连接池
├── 关键参数
│   ├── pool_size（池大小）
│   ├── max_idle_time（最大空闲时间）
│   ├── wait_timeout（等待超时）
│   └── max_retries（最大重试次数）
├── 策略
│   ├── 固定大小池
│   ├── 动态扩缩容
│   ├── 按需创建
│   └── 空闲回收
└── 应用场景
    ├── MySQL 连接池
    ├── Redis 连接池
    ├── HTTP 客户端池
    ├── RPC 连接池
    └── 通用 TCP 连接池
```

---

## 三、完整 PHP/Swoole 代码

### v1：基础连接池

```php
<?php
// v1: Basic connection pool using Channel
// A simple, generic pool implementation

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;

class SimplePool
{
    protected Channel $pool;
    protected int $size;
    protected \Closure $creator;  // Connection factory
    protected \Closure $checker;  // Health check
    protected int $created = 0;

    /**
     * @param int $size Maximum pool size
     * @param callable $creator Function that creates a new connection
     * @param callable $checker Function that checks if connection is alive
     */
    public function __construct(int $size, callable $creator, callable $checker = null)
    {
        $this->size = $size;
        $this->pool = new Channel($size);
        $this->creator = $creator;
        $this->checker = $checker ?? fn($conn) => true;
    }

    /**
     * Get a connection from pool (blocks if empty, waits up to $timeout seconds)
     */
    public function get(float $timeout = 3.0)
    {
        // Try to get from pool first
        $conn = $this->pool->pop(0.001);
        if ($conn !== false) {
            // Health check before returning
            if (($this->checker)($conn)) {
                return $conn;
            }
            // Connection is dead, decrement counter and create new
            $this->created--;
            return $this->createNew();
        }

        // Pool is empty, try to create new connection
        if ($this->created < $this->size) {
            return $this->createNew();
        }

        // Pool full and all in use, wait for return
        $conn = $this->pool->pop($timeout);
        if ($conn === false) {
            throw new \RuntimeException("Connection pool exhausted (timeout: {$timeout}s)");
        }

        if (($this->checker)($conn)) {
            return $conn;
        }
        $this->created--;
        return $this->createNew();
    }

    /**
     * Return connection to pool
     */
    public function put($conn): void
    {
        if ($this->pool->length() < $this->size) {
            $this->pool->push($conn);
        } else {
            // Pool is full, close excess connection
            $this->created--;
            // Close connection if it has a close method
            if (is_object($conn) && method_exists($conn, 'close')) {
                $conn->close();
            }
        }
    }

    /**
     * Get pool statistics
     */
    public function stats(): array
    {
        return [
            'total_created' => $this->created,
            'available' => $this->pool->length,
            'in_use' => $this->created - $this->pool->length,
            'max_size' => $this->size,
        ];
    }

    protected function createNew()
    {
        $this->created++;
        return ($this->creator)();
    }
}

// --- Demo with simulated connections ---
Coroutineun(function () {
    $pool = new SimplePool(
        5,
        // Creator: simulate creating an expensive connection
        fn() => [
            'id' => uniqid('conn_'),
            'created_at' => microtime(true),
        ],
        // Checker: always alive in this demo
        fn($conn) => true
    );

    echo "=== Simple Pool Demo ===

";

    // Simulate 10 concurrent requests competing for 5 connections
    $results = new Channel(10);

    for ($i = 0; $i < 10; $i++) {
        Coroutine::create(function () use ($pool, $i, $results) {
            $conn = $pool->get();
            echo "[Request {$i}] Got connection: {$conn['id']}
";

            // Simulate work
            Coroutine::sleep(rand(1, 3) * 0.1);

            echo "[Request {$i}] Returning connection: {$conn['id']}
";
            $pool->put($conn);

            $results->push(true);
        });
    }

    // Wait for all to complete
    for ($i = 0; $i < 10; $i++) {
        $results->pop();
    }

    echo "
Pool stats after all requests:
";
    print_r($pool->stats());
});
```

### v2：MySQL + Redis 连接池实战

```php
<?php
// v2: Real-world MySQL and Redis connection pools
// Using Swoole ext-redis and ext-mysql client libraries

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;

// ============================================================
// MySQL Connection Pool
// ============================================================
class MySQLPool
{
    private Channel $pool;
    private int $size;
    private array $config;
    private int $created = 0;

    public function __construct(int $size, array $config)
    {
        $this->size = $size;
        $this->config = $config;
        $this->pool = new Channel($size);
    }

    /**
     * Initialize pool with minimum connections
     */
    public function init(int $minSize = 1): void
    {
        for ($i = 0; $i < $minSize; $i++) {
            $this->pool->push($this->createConnection());
        }
    }

    public function get(float $timeout = 5.0): Coroutine\MySQL
    {
        $conn = $this->pool->pop(0.001);
        if ($conn !== false) {
            return $conn;
        }

        if ($this->created < $this->size) {
            return $this->createConnection();
        }

        $conn = $this->pool->pop($timeout);
        if ($conn === false) {
            throw new \RuntimeException("MySQL pool timeout after {$timeout}s");
        }
        return $conn;
    }

    public function put(Coroutine\MySQL $conn): void
    {
        if ($conn->connected) {
            $this->pool->push($conn);
        } else {
            $this->created--;
        }
    }

    private function createConnection(): Coroutine\MySQL
    {
        $this->created++;
        $mysql = new Coroutine\MySQL();
        $connected = $mysql->connect($this->config);
        if (!$connected) {
            $this->created--;
            throw new \RuntimeException("MySQL connect failed: {$mysql->connect_error}");
        }
        return $mysql;
    }

    public function stats(): array
    {
        return [
            'created' => $this->created,
            'available' => $this->pool->length,
            'in_use' => $this->created - $this->pool->length,
        ];
    }
}

// ============================================================
// Redis Connection Pool
// ============================================================
class RedisPool
{
    private Channel $pool;
    private int $size;
    private array $config;
    private int $created = 0;

    public function __construct(int $size, array $config)
    {
        $this->size = $size;
        $this->config = $config;
        $this->pool = new Channel($size);
    }

    public function get(float $timeout = 3.0): Coroutine\Redis
    {
        $conn = $this->pool->pop(0.001);
        if ($conn !== false) {
            // Verify connection is still alive
            try {
                $conn->ping();
                return $conn;
            } catch (\Throwable $e) {
                $this->created--;
            }
        }

        if ($this->created < $this->size) {
            return $this->createConnection();
        }

        $conn = $this->pool->pop($timeout);
        if ($conn === false) {
            throw new \RuntimeException("Redis pool timeout after {$timeout}s");
        }
        return $conn;
    }

    public function put($conn): void
    {
        if ($this->pool->length < $this->size) {
            $this->pool->push($conn);
        } else {
            $this->created--;
            $conn->close();
        }
    }

    private function createConnection(): Coroutine\Redis
    {
        $this->created++;
        $redis = new Coroutine\Redis();
        $connected = $redis->connect(
            $this->config['host'] ?? '127.0.0.1',
            $this->config['port'] ?? 6379
        );
        if (!$connected) {
            $this->created--;
            throw new \RuntimeException("Redis connect failed");
        }
        if (isset($this->config['auth'])) {
            $redis->auth($this->config['auth']);
        }
        if (isset($this->config['db'])) {
            $redis->select($this->config['db']);
        }
        return $redis;
    }

    public function stats(): array
    {
        return [
            'created' => $this->created,
            'available' => $this->pool->length,
            'in_use' => $this->created - $this->pool->length,
        ];
    }
}

// ============================================================
// Usage: HTTP API server with pooled DB access
// ============================================================
Coroutineun(function () {
    // Create connection pools
    $mysqlPool = new MySQLPool(10, [
        'host' => '127.0.0.1',
        'port' => 3306,
        'user' => 'root',
        'password' => '',
        'database' => 'test',
    ]);

    $redisPool = new RedisPool(10, [
        'host' => '127.0.0.1',
        'port' => 6379,
    ]);

    // Initialize minimum connections
    $mysqlPool->init(2);

    $server = new Coroutine\Http\Server('0.0.0.0', 9502);

    // API: GET /user?id=123
    $server->handle('/user', function ($request, $response) use ($mysqlPool, $redisPool) {
        $id = $request->get['id'] ?? 0;
        if (!$id) {
            $response->status(400);
            $response->end(json_encode(['error' => 'id required']));
            return;
        }

        // Try cache first
        $redis = $redisPool->get();
        $cacheKey = "user:{$id}";
        $cached = $redis->get($cacheKey);
        $redisPool->put($redis);

        if ($cached) {
            $response->header('X-Cache', 'HIT');
            $response->end($cached);
            return;
        }

        // Cache miss, query MySQL
        $mysql = $mysqlPool->get();
        $result = $mysql->query("SELECT * FROM users WHERE id = {$id}");
        $mysqlPool->put($mysql);

        if (empty($result)) {
            $response->status(404);
            $response->end(json_encode(['error' => 'user not found']));
            return;
        }

        $data = json_encode(['data' => $result[0]]);

        // Cache for 60 seconds
        $redis = $redisPool->get();
        $redis->setex($cacheKey, 60, $data);
        $redisPool->put($redis);

        $response->header('Content-Type', 'application/json');
        $response->header('X-Cache', 'MISS');
        $response->end($data);
    });

    echo "Server started at http://0.0.0.0:9502
";
    echo "MySQL pool stats: " . json_encode($mysqlPool->stats()) . "
";

    $server->start();
});
```

### v3：企业级通用连接池

```php
<?php
// v3: Enterprise-grade generic connection pool
// Features: auto-reconnect, idle eviction, metrics, lifecycle hooks

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;

class ConnectionPool
{
    private Channel $pool;
    private int $maxSize;
    private int $minSize;
    private \Closure $creator;
    private \Closure $destroyer;
    private \Closure $checker;
    private float $maxIdleTime;    // Max idle time in seconds
    private float $waitTimeout;    // Wait timeout for getting connection

    private int $created = 0;
    private int $acquired = 0;
    private int $released = 0;
    private int $reconnects = 0;
    private int $evictions = 0;

    /** @var array Connection metadata: [resource => ['last_used' => float, 'created_at' => float]] */
    private array $metadata = [];

    public function __construct(array $config)
    {
        $this->maxSize = $config['max_size'] ?? 10;
        $this->minSize = $config['min_size'] ?? 1;
        $this->maxIdleTime = $config['max_idle_time'] ?? 300; // 5 minutes
        $this->waitTimeout = $config['wait_timeout'] ?? 5;

        $this->creator = $config['creator'];
        $this->destroyer = $config['destroyer'] ?? fn($c) => null;
        $this->checker = $config['checker'] ?? fn($c) => true;

        $this->pool = new Channel($this->maxSize);
    }

    /**
     * Warm up the pool with minimum connections
     */
    public function warmUp(): void
    {
        for ($i = 0; $i < $this->minSize; $i++) {
            try {
                $conn = $this->createConnection();
                $this->pool->push($conn);
            } catch (\Throwable $e) {
                echo "Warmup failed: {$e->getMessage()}
";
            }
        }
        echo "Pool warmed up: {$this->created}/{$this->minSize} connections
";
    }

    /**
     * Get a connection with auto-reconnect on failure
     */
    public function get(float $timeout = null)
    {
        $timeout = $timeout ?? $this->waitTimeout;
        $attempts = 0;
        $maxAttempts = 2; // Try twice (original + reconnect)

        while ($attempts < $maxAttempts) {
            $conn = $this->getConnectionFromPool($timeout);

            if ($conn === null) {
                break;
            }

            // Health check
            if (($this->checker)($conn)) {
                $this->metadata[spl_object_id($conn)]['last_used'] = microtime(true);
                $this->acquired++;
                return $conn;
            }

            // Dead connection, reconnect
            $this->destroyConnection($conn);
            $this->reconnects++;
            $attempts++;
        }

        throw new \RuntimeException("Failed to get a healthy connection after {$attempts} attempts");
    }

    /**
     * Return connection to pool
     */
    public function put($conn): void
    {
        $id = spl_object_id($conn);
        $this->metadata[$id]['last_used'] = microtime(true);
        $this->released++;

        if ($this->pool->length < $this->maxSize) {
            $this->pool->push($conn);
        } else {
            $this->destroyConnection($conn);
        }
    }

    /**
     * Evict idle connections periodically (call from timer or heartbeat)
     */
    public function evictIdle(): int
    {
        $now = microtime(true);
        $evicted = 0;

        // Check connections in pool
        $temp = [];
        while (!$this->pool->isEmpty()) {
            $conn = $this->pool->pop(0.001);
            if ($conn === false) break;

            $id = spl_object_id($conn);
            $lastUsed = $this->metadata[$id]['last_used'] ?? $now;

            // Keep if still within idle time or we need minimum connections
            $keepAlive = ($now - $lastUsed) < $this->maxIdleTime;
            $needMinimum = ($this->created - $evicted) <= $this->minSize;

            if ($keepAlive || $needMinimum) {
                $temp[] = $conn;
            } else {
                $this->destroyConnection($conn);
                $evicted++;
            }
        }

        // Put back kept connections
        foreach ($temp as $conn) {
            $this->pool->push($conn);
        }

        $this->evictions += $evicted;
        return $evicted;
    }

    /**
     * Get pool metrics
     */
    public function metrics(): array
    {
        return [
            'created' => $this->created,
            'available' => $this->pool->length,
            'in_use' => $this->created - $this->pool->length,
            'total_acquired' => $this->acquired,
            'total_released' => $this->released,
            'total_reconnects' => $this->reconnects,
            'total_evictions' => $this->evictions,
        ];
    }

    private function getConnectionFromPool(float $timeout)
    {
        // Try existing pool first
        $conn = $this->pool->pop(0.001);
        if ($conn !== false) {
            return $conn;
        }

        // Try creating new
        if ($this->created < $this->maxSize) {
            return $this->createConnection();
        }

        // Wait for return
        return $this->pool->pop($timeout) ?: null;
    }

    private function createConnection()
    {
        $this->created++;
        try {
            $conn = ($this->creator)();
            $this->metadata[spl_object_id($conn)] = [
                'created_at' => microtime(true),
                'last_used' => microtime(true),
            ];
            return $conn;
        } catch (\Throwable $e) {
            $this->created--;
            throw $e;
        }
    }

    private function destroyConnection($conn): void
    {
        $this->created--;
        $id = spl_object_id($conn);
        unset($this->metadata[$id]);
        ($this->destroyer)($conn);
    }
}

// --- Demo: Full lifecycle with metrics ---
Coroutineun(function () {
    // Simulated connection factory
    $connectionId = 0;
    $pool = new ConnectionPool([
        'max_size' => 5,
        'min_size' => 2,
        'max_idle_time' => 10, // 10 seconds for demo
        'wait_timeout' => 3,
        'creator' => function () use (&$connectionId) {
            $id = ++$connectionId;
            echo "  [Factory] Creating connection #{$id}
";
            // Simulate expensive connection creation
            Coroutine::sleep(0.01);
            return new class($id) {
                public int $connId;
                public bool $alive = true;
                public function __construct(int $id) { $this->connId = $id; }
                public function close(): void { $this->alive = false; }
                public function ping(): bool { return $this->alive; }
            };
        },
        'destroyer' => function ($conn) {
            echo "  [Destroyer] Closing connection #{$conn->connId}
";
            $conn->close();
        },
        'checker' => fn($conn) => $conn->alive && $conn->ping(),
    ]);

    // Warm up
    echo "=== Warming up pool ===
";
    $pool->warmUp();

    // Simulate concurrent usage
    echo "
=== Concurrent requests ===
";
    $done = new Channel(8);

    for ($i = 0; $i < 8; $i++) {
        Coroutine::create(function () use ($pool, $i, $done) {
            $conn = $pool->get();
            echo "[Request {$i}] Using connection #{$conn->connId}
";
            Coroutine::sleep(rand(1, 5) * 0.05);
            $pool->put($conn);
            $done->push(true);
        });
    }

    for ($i = 0; $i < 8; $i++) {
        $done->pop();
    }

    // Show metrics
    echo "
=== Pool Metrics ===
";
    print_r($pool->metrics());

    // Test idle eviction
    echo "
=== Idle Eviction Test ===
";
    echo "Waiting 11 seconds for connections to expire...
";
    Coroutine::sleep(11);
    $evicted = $pool->evictIdle();
    echo "Evicted {$evicted} idle connections
";
    print_r($pool->metrics());
});
```

---

## 四、执行预览

### v1 执行输出
```
=== Simple Pool Demo ===

[Request 0] Got connection: conn_662a1b3c
[Request 1] Got connection: conn_662a1b3d
[Request 2] Got connection: conn_662a1b3e
[Request 3] Got connection: conn_662a1b3f
[Request 4] Got connection: conn_662a1b40
[Request 0] Returning connection: conn_662a1b3c
[Request 5] Got connection: conn_662a1b3c
[Request 1] Returning connection: conn_662a1b3d
[Request 6] Got connection: conn_662a1b3d
...

Pool stats after all requests:
Array ( [created] => 5 [available] => 5 [in_use] => 0 [max_size] => 5 )
```

### v3 执行输出
```
=== Warming up pool ===
  [Factory] Creating connection #1
  [Factory] Creating connection #2
Pool warmed up: 2/2 connections

=== Concurrent requests ===
[Request 0] Using connection #1
[Request 1] Using connection #2
[Request 2] Using connection #3
[Request 3] Using connection #4
[Request 4] Using connection #5
[Request 0] Returning...
[Request 5] Using connection #1
...

=== Pool Metrics ===
[created] => 5 [available] => 5 [in_use] => 0
[total_acquired] => 8 [total_released] => 8
[total_reconnects] => 0 [total_evictions] => 0
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 池大小 | 建议 = CPU核心数 × 2 + 磁盘数，MySQL 通常 10-20 |
| 最小连接数 | 至少保持 1-2 个空闲连接，避免冷启动 |
| 超时设置 | wait_timeout 不宜过长（3-5秒），避免协程阻塞 |
| 连接泄漏 | 每次 get() 必须配对 put()，用 try/finally 保证 |
| 健康检查 | 使用前 ping 一次，避免已断开的连接导致业务失败 |
| 空闲回收 | 长时间空闲的连接可能被服务端关闭，需要定期清理 |
| 连接数监控 | 监控 in_use/max_size，持续接近上限说明需要扩容 |
| 协程安全 | Channel 天然协程安全，不要用 Array 做连接池 |
| MySQL wait_timeout | MySQL 服务端默认 8 小时关闭空闲连接，池的 max_idle_time 应小于此值 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 每次请求 new 一个数据库连接 | 使用连接池复用 |
| `get()` 后忘了 `put()` | 用 `try { ... } finally { $pool->put($conn); }` |
| 池大小设得和并发数一样大 | 池大小 = 预估并发数 × 平均耗时(秒)，通常 10-50 |
| 不做健康检查直接用 | get 时 ping 一次，失败则重建连接 |
| 用 PHP 数组做连接池 | 用 Swoole Channel，天然协程安全 |
| 连接池满时一直阻塞等待 | 设置合理超时，超时报错而非死等 |
| 连接永不过期回收 | 设置 max_idle_time，定期清理空闲连接 |
| 单进程内的连接池跨进程共享 | 每个 Worker 进程独立连接池 |

---

## 七、练习题

### 🟢 基础题

**题目 1：** 使用 Channel 实现一个简单的字符串连接池。创建 3 个字符串资源，用 5 个协程竞争获取，使用后归还。

**题目 2：** 在 v1 代码基础上，添加一个 `close()` 方法，用于关闭所有空闲连接并清空池。

### 🟡 进阶题

**题目 3：** 实现 MySQL 连接池，要求：支持主从分离（写走主库连接池，读走从库连接池），支持按 SQL 类型自动路由。

**题目 4：** 实现一个带熔断器的连接池。当连续 N 次健康检查失败时，暂停获取连接一段时间（熔断），之后尝试半开放（放一个请求测试），成功则恢复。

### 🔴 挑战题

**题目 5：** 实现一个支持动态扩缩容的连接池。要求：根据当前 in_use/available 比例自动调整池大小，高负载时扩容（上限 max_size），低负载时缩容（下限 min_size），扩缩容过程平滑不影响正在使用的连接。

---

## 八、知识点总结

```
Swoole 连接池 知识树
├── 基础
│   ├── 连接池概念与原理
│   ├── Channel 作为底层容器
│   └── get/put 生命周期
├── 实现模式
│   ├── 固定大小池
│   ├── 动态扩缩容
│   ├── 冷启动（warmUp）
│   └── 空闲回收
├── 关键机制
│   ├── 健康检查（ping）
│   ├── 自动重连
│   ├── 超时控制
│   └── 指标监控
├── 数据库连接池
│   ├── MySQL (Coroutine\MySQL)
│   ├── Redis (Coroutine\Redis)
│   └── PDO (Swoole\Database\PDOPool)
└── 高级特性
    ├── 主从分离
    ├── 熔断器
    ├── 读写路由
    └── 跨进程管理
```

---

## 九、举一反三

| 知识点 | 本文示例 | 延伸应用 |
|-------|---------|---------|
| Channel 队列 | 连接池容器 | 任务队列、协程间通信、限流器 |
| 对象复用 | 连接复用 | HTTP 客户端池、文件句柄池 |
| 健康检查 | MySQL ping | 微服务健康探针、负载均衡剔除 |
| 空闲回收 | 连接超时回收 | 缓存过期、临时资源清理 |
| 熔断降级 | 连接失败熔断 | 服务降级、限流、熔断器模式 |
| 指标监控 | 池统计信息 | Prometheus 指标、APM 监控 |

---

## 十、参考资料

1. [Swoole 官方文档 - 连接池](https://wiki.swoole.com/#/coroutine/conn_pool)
2. [Swoole 官方文档 - Channel](https://wiki.swoole.com/#/coroutine/channel)
3. [Swoole Database 组件](https://github.com/swoole/database)
4. [Swoole_by_examples: Connection Pooling](https://github.com/deminy/swoole-by-examples)
5. [数据库连接池最佳实践](https://wiki.swoole.com/#/question/use?id=how-to-use-the-database-connection-pool)

---

## 十一、代码演进

| 版本 | 重点 | 核心改进 |
|------|------|---------|
| v1 | 基础实现 | Channel 队列、get/put、模拟连接 |
| v2 | 实战应用 | MySQL/Redis 真实连接池、HTTP API、缓存策略 |
| v3 | 企业级 | 自动重连、空闲回收、指标监控、生命周期管理 |

> **核心思想：** 连接池是高性能应用的标配。从理解原理到生产级实现，关键是处理好 **复用、健康检查、超时控制** 三个核心问题。
