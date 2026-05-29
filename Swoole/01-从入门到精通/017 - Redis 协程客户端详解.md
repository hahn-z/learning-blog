---
title: "017 - Redis 协程客户端详解"
slug: "017-coroutine-redis"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:10:21.57+08:00"
updated_at: "2026-04-29T10:02:47.011+08:00"
reading_time: 36
tags: ["Swoole", "PHP"]
---

# Redis 协程客户端详解

> **难度标注：** ⭐⭐⭐ 中级 | 预计阅读时间：20 分钟

## 一、概念讲解

`Swoole\Coroutine\Redis` 是 Swoole 内置的 Redis 协程客户端，基于 Swoole 协程实现**非阻塞 IO**。当你执行 Redis 命令时，当前协程自动挂起，等数据返回后自动恢复，不影响其他协程运行。

### 为什么不用 phpredis？

| 特性 | phpredis (扩展) | Swoole\Coroutine\Redis |
|------|----------------|----------------------|
| 阻塞 | 同步阻塞 | 协程非阻塞 |
| 并发 | 一个连接同时只能一个请求 | 多协程共享，自动调度 |
| 连接池 | 需要外部实现 | 配合 Channel 轻松实现 |
| 协程兼容 | 需要开启 hook | 原生支持 |
| 部署 | 需要编译扩展 | Swoole 内置 |

**核心原理：**

```
协程A: $redis->get('key1') → 挂起 → ... → 恢复 → 拿到结果
协程B: $redis->set('key2','v') → 挂起 → ... → 恢复 → 拿到结果
协程C: 正常执行其他代码...

单线程内，多个 Redis 请求并发执行，互不阻塞！
```

## 二、脑图（ASCII）

```
Coroutine\Redis
├── 连接管理
│   ├── connect() / connect()       # 建立连接
│   ├── close()                     # 关闭连接
│   └── connected()                 # 检查连接状态
├── 数据操作
│   ├── String: get/set/del/incr/decr
│   ├── Hash: hGet/hSet/hMGet/hMGet/hDel
│   ├── List: lPush/rPush/lPop/rPop
│   ├── Set: sAdd/sRem/sMembers
│   └── Sorted Set: zAdd/zRange/zRem
├── 高级功能
│   ├── subscribe/psubscribe        # 发布订阅
│   ├── multi/exec                  # 事务
│   ├── eval                        # Lua 脚本
│   ├── pipeline                    # 管道（原生不支持，需变通）
│   └── scan/hScan/zScan            # 游标遍历
└── 连接池
    ├── Swoole\Coroutine\Channel
    ├── 借出/归还机制
    └── 心跳保活
```

## 三、完整代码

### v1：基础 CRUD 操作

```php
<?php
// Basic Redis Coroutine Operations - v1
Co\run(function () {
    $redis = new Swoole\Coroutine\Redis();
    
    // Connect to Redis
    $connected = $redis->connect('127.0.0.1', 6379);
    if (!$connected) {
        echo "Connect failed: {$redis->errMsg}\n";
        return;
    }
    
    echo "Connected to Redis\n";
    
    // ===== String Operations =====
    $redis->set('user:name', 'Alice');
    $redis->set('user:age', 25);
    $redis->setex('session:abc', 3600, 'token_xyz'); // TTL 1 hour
    
    echo "Name: " . $redis->get('user:name') . "\n";      // Alice
    echo "Age: " . $redis->get('user:age') . "\n";         // 25
    echo "Incr: " . $redis->incr('user:age') . "\n";       // 26
    echo "Exists: " . ($redis->exists('user:name') ? 'yes' : 'no') . "\n"; // yes
    
    // ===== Hash Operations =====
    $redis->hMSet('user:1001', [
        'name' => 'Bob',
        'email' => 'bob@example.com',
        'age' => 30,
    ]);
    
    $user = $redis->hGetAll('user:1001');
    echo "User Hash: " . json_encode($user) . "\n";
    
    echo "Email: " . $redis->hGet('user:1001', 'email') . "\n";
    
    // ===== List Operations =====
    $redis->del('queue:tasks');
    $redis->rPush('queue:tasks', 'task_1');
    $redis->rPush('queue:tasks', 'task_2');
    $redis->rPush('queue:tasks', 'task_3');
    
    echo "Queue length: " . $redis->lLen('queue:tasks') . "\n";  // 3
    echo "Pop: " . $redis->lPop('queue:tasks') . "\n";           // task_1
    
    // ===== Set Operations =====
    $redis->sAdd('tags:article:1', 'php', 'swoole', 'coroutine');
    $redis->sAdd('tags:article:2', 'php', 'redis');
    
    $common = $redis->sInter('tags:article:1', 'tags:article:2');
    echo "Common tags: " . json_encode($common) . "\n"; // ["php"]
    
    // ===== Sorted Set =====
    $redis->zAdd('leaderboard', 100, 'Alice');
    $redis->zAdd('leaderboard', 85, 'Bob');
    $redis->zAdd('leaderboard', 120, 'Charlie');
    
    $top = $redis->zRevRange('leaderboard', 0, 2, true);
    echo "Leaderboard: " . json_encode($top) . "\n";
    
    // ===== Key Management =====
    $keys = $redis->keys('user:*');
    echo "User keys: " . json_encode($keys) . "\n";
    
    // Clean up
    $redis->del('user:name', 'user:age', 'session:abc');
    $redis->del('user:1001', 'queue:tasks');
    $redis->del('tags:article:1', 'tags:article:2', 'leaderboard');
    
    echo "Done!\n";
    $redis->close();
});
```

### v2：连接池实现

```php
<?php
// Redis Connection Pool - v2
class RedisPool
{
    private Swoole\Coroutine\Channel $pool;
    private string $host;
    private int $port;
    private int $maxSize;
    private int $currentSize = 0;
    
    public function __construct(string $host, int $port, int $maxSize = 20)
    {
        $this->host = $host;
        $this->port = $port;
        $this->maxSize = $maxSize;
        $this->pool = new Swoole\Coroutine\Channel($maxSize);
    }
    
    // Get a connection from pool
    public function get(): Swoole\Coroutine\Redis
    {
        // Try to get from pool first
        if (!$this->pool->isEmpty()) {
            $redis = $this->pool->pop(0.001);
            if ($redis && $redis->connected) {
                return $redis;
            }
        }
        
        // Create new connection if under limit
        if ($this->currentSize < $this->maxSize) {
            $this->currentSize++;
            return $this->createConnection();
        }
        
        // Wait for a connection to be returned
        $redis = $this->pool->pop(5.0); // 5s timeout
        if ($redis === false) {
            throw new \RuntimeException("Redis pool exhausted, timeout waiting for connection");
        }
        
        if (!$redis->connected) {
            $this->currentSize--;
            return $this->get(); // Retry
        }
        
        return $redis;
    }
    
    // Return connection to pool
    public function put(Swoole\Coroutine\Redis $redis): void
    {
        if ($redis->connected) {
            $this->pool->push($redis);
        } else {
            $this->currentSize--;
        }
    }
    
    // Create a new Redis connection
    private function createConnection(): Swoole\Coroutine\Redis
    {
        $redis = new Swoole\Coroutine\Redis();
        $redis->setOptions([
            'connect_timeout' => 2,
            'read_timeout' => 3,
            'serialize' => false,
        ]);
        
        $connected = $redis->connect($this->host, $this->port);
        if (!$connected) {
            $this->currentSize--;
            throw new \RuntimeException("Redis connect failed: {$redis->errMsg}");
        }
        
        return $redis;
    }
    
    public function stats(): array
    {
        return [
            'pool_size' => $this->pool->length(),
            'current_size' => $this->currentSize,
            'max_size' => $this->maxSize,
        ];
    }
}

// --- Usage in HTTP Server ---
$pool = new RedisPool('127.0.0.1', 6379, 20);

$server = new Swoole\Http\Server('0.0.0.0', 9501);
$server->set(['worker_num' => 2]);

$server->on('request', function ($request, $response) use ($pool) {
    $uri = $request->server['request_uri'];
    
    try {
        $redis = $pool->get();
        
        switch ($uri) {
            case '/counter':
                $val = $redis->incr('api:counter');
                $response->end("Counter: {$val}\n");
                break;
                
            case '/cache':
                $key = $request->get['key'] ?? 'default';
                $val = $redis->get("cache:{$key}");
                if ($val === false) {
                    $val = 'computed_value_' . time();
                    $redis->setex("cache:{$key}", 60, $val);
                    $response->end("Cache MISS, set: {$val}\n");
                } else {
                    $response->end("Cache HIT: {$val}\n");
                }
                break;
                
            case '/pool-stats':
                $response->end(json_encode($pool->stats()));
                break;
                
            default:
                $response->end("OK\n");
        }
        
        $pool->put($redis); // Always return connection!
    } catch (\Throwable $e) {
        $response->status(500);
        $response->end("Error: " . $e->getMessage());
    }
});

$server->start();
```

### v3：Redis 发布订阅 + Lua 脚本

```php
<?php
// Redis Pub/Sub + Lua Scripting - v3
Co\run(function () {
    // ===== Publisher =====
    go(function () {
        $redis = new Swoole\Coroutine\Redis();
        $redis->connect('127.0.0.1', 6379);
        
        // Publish messages periodically
        for ($i = 0; $i < 5; $i++) {
            Co\System::sleep(1);
            $msg = json_encode(['id' => $i, 'data' => 'hello_' . $i, 'ts' => time()]);
            $redis->publish('channel:events', $msg);
            echo "[Publisher] Sent: hello_{$i}\n";
        }
        
        $redis->close();
    });
    
    // ===== Subscriber =====
    go(function () {
        $redis = new Swoole\Coroutine\Redis();
        $redis->connect('127.0.0.1', 6379);
        
        echo "[Subscriber] Listening on channel:events\n";
        
        // subscribe() blocks and returns messages
        while (true) {
            $msg = $redis->subscribe(['channel:events']);
            if (!$msg) break;
            
            // $msg = ['subscribe', 'channel:events', 1] on first call
            // Then ['message', 'channel:events', '{"id":0,...}']
            if ($msg[0] === 'message') {
                $payload = json_decode($msg[2], true);
                echo "[Subscriber] Received: " . json_encode($payload) . "\n";
            }
            
            // For demo: stop after 5 messages
            static $count = 0;
            if (++$count >= 5) {
                $redis->close();
                break;
            }
        }
    });
    
    // ===== Lua Script Demo =====
    go(function () {
        Co\System::sleep(6); // Wait for pub/sub demo
        
        $redis = new Swoole\Coroutine\Redis();
        $redis->connect('127.0.0.1', 6379);
        
        // Atomic counter with limit using Lua
        // If counter < limit, increment and return new value
        // Otherwise return -1
        $script = <<<LUA
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key) or '0')
if current < limit then
    local new_val = redis.call('INCR', key)
    redis.call('EXPIRE', key, ARGV[2])
    return new_val
else
    return -1
end
LUA;
        
        $redis->del('rate_limit:user:1');
        
        // Simulate rate limiting: max 3 requests per 60s
        for ($i = 0; $i < 5; $i++) {
            $result = $redis->eval($script, ['rate_limit:user:1', 3, 60], 1);
            if ($result === -1) {
                echo "[Lua] Rate limited! Request blocked (#" . ($i + 1) . ")\n";
            } else {
                echo "[Lua] Request allowed, count: {$result}\n";
            }
        }
        
        // ===== Distributed Lock with Lua =====
        $lockScript = <<<'LUA'
local key = KEYS[1]
local value = ARGV[1]
local ttl = tonumber(ARGV[2])
if redis.call('SET', key, value, 'NX', 'EX', ttl) then
    return 1
else
    return 0
end
LUA;
        
        $unlockScript = <<<'LUA'
local key = KEYS[1]
local value = ARGV[1]
if redis.call('GET', key) == value then
    return redis.call('DEL', key)
else
    return 0
end
LUA;
        
        $lockKey = 'lock:order:1001';
        $lockValue = uniqid('lock_', true);
        
        // Acquire lock
        $locked = $redis->eval($lockScript, [$lockKey, $lockValue, 10], 1);
        if ($locked) {
            echo "[Lock] Acquired lock: {$lockKey}\n";
            
            // Do critical work...
            Co\System::sleep(0.5);
            
            // Release lock
            $released = $redis->eval($unlockScript, [$lockKey, $lockValue], 1);
            echo "[Lock] Released: " . ($released ? 'OK' : 'FAIL (not owner)') . "\n";
        } else {
            echo "[Lock] Failed to acquire lock\n";
        }
        
        $redis->close();
    });
});
```

## 四、执行预览

```
$ php redis_v1.php
Connected to Redis
Name: Alice
Age: 25
Incr: 26
Exists: yes
User Hash: {"name":"Bob","email":"bob@example.com","age":"30"}
Email: bob@example.com
Queue length: 3
Pop: task_1
Common tags: ["php"]
Leaderboard: {"Charlie":"120","Alice":"100","Bob":"85"}
User keys: ["user:1001","user:name","user:age"]
Done!

$ php redis_v3.php
[Subscriber] Listening on channel:events
[Publisher] Sent: hello_0
[Subscriber] Received: {"id":0,"data":"hello_0","ts":1714000000}
[Publisher] Sent: hello_1
[Subscriber] Received: {"id":1,"data":"hello_1","ts":1714000001}
...
[Lua] Request allowed, count: 1
[Lua] Request allowed, count: 2
[Lua] Request allowed, count: 3
[Lua] Rate limited! Request blocked (#4)
[Lua] Rate limited! Request blocked (#5)
[Lock] Acquired lock: lock:order:1001
[Lock] Released: OK
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| subscribe 阻塞 | subscribe 会阻塞当前协程，需要用独立的 go() 协程 |
| 连接超时 | 建议设置 connect_timeout 和 read_timeout |
| 序列化 | 默认不序列化，需要自己 json_encode/serialize |
| 错误处理 | 检查返回值 false，用 errMsg 获取错误信息 |
| 连接池大小 | 建议 CPU 核心数 × 2~4，过多浪费 Redis 连接 |
| multi/exec | 支持事务，但注意事务期间不能穿插其他命令 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 每次请求 new Redis + connect | 使用连接池复用连接 |
| subscribe 和普通命令共用连接 | subscribe 用独立连接，不能用同一连接执行其他命令 |
| 不处理 Redis 断线重连 | get() 时检查 connected，断线则重建连接 |
| 用 keys() 扫描大量 key | 用 scan() 渐进遍历，避免阻塞 Redis |
| 忘记归还连接池 | 用 try/finally 确保连接归还 |
| 大 key 直接 get | 用 hScan/sScan 分批读取 |

## 七、练习题

**🟢 基础题：**
1. 使用 Coroutine\Redis 实现一个简单的缓存层：先查 Redis，miss 时"计算"后写入
2. 实现一个排行榜，使用 Sorted Set 存储分数，支持 Top 10 查询

**🟡 进阶题：**
3. 实现一个 Redis 连接池，支持最大连接数限制和等待超时
4. 用 Lua 脚本实现分布式限流器（滑动窗口算法）

**🔴 挑战题：**
5. 实现 Redis 发布订阅 + 连接池，支持多频道订阅和消息分发
6. 实现 Redlock 分布式锁算法（多 Redis 实例）

## 八、知识点总结

```
Coroutine\Redis 知识树
├── 基础操作
│   ├── connect / close
│   ├── String (get/set/del/incr)
│   ├── Hash (hGet/hSet/hMGet/hMSet)
│   ├── List (lPush/rPush/lPop/rPop)
│   ├── Set (sAdd/sRem/sMembers)
│   └── ZSet (zAdd/zRange/zRem)
├── 高级功能
│   ├── subscribe / publish
│   ├── multi / exec (事务)
│   ├── eval (Lua 脚本)
│   └── scan / hScan / zScan
├── 连接池
│   ├── Channel 实现
│   ├── 借出/归还/健康检查
│   └── 断线重连
└── 最佳实践
    ├── 超时配置
    ├── 错误处理
    └── 大 key 处理
```

## 九、举一反三

| 场景 | Redis 数据结构 | 实现思路 |
|------|---------------|---------|
| 验证码存储 | String + SETEX | 设置过期时间，验证后删除 |
| 用户会话 | Hash | hMSet 存储多字段，TTL 管理过期 |
| 消息队列 | List (lPush + brPop) | 或用 Stream (XADD/XREAD) |
| 排行榜 | Sorted Set | zAdd 加分，zRevRange 取排名 |
| 好友关系 | Set | sAdd 添加，sInter 共同好友 |
| 分布式锁 | String + Lua | SET NX EX + Lua 释放 |
| 限流 | Sorted Set / Lua | 滑动窗口或令牌桶 |

## 十、参考资料

- [Swoole Coroutine\Redis](https://wiki.swoole.com/#/coroutine_client/redis)
- [Redis 命令参考](https://redis.io/commands)
- [Redis Lua 脚本](https://redis.io/docs/manual/programmability/eval-intro/)
- [Redlock 算法](https://redis.io/docs/manual/patterns/distributed-locks/)

## 十一、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 基础版 | 全数据类型 CRUD 操作演示 | 学习 Redis 协程客户端 |
| v2 连接池 | Channel 连接池 + HTTP 服务集成 | 生产环境 Web 服务 |
| v3 高级版 | Pub/Sub + Lua 脚本 + 分布式锁 | 消息系统、分布式协调 |
