---
title: "PHP Redis实战指南"
slug: "php-redis-practical-guide"
category: "数据库"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "Redis", "缓存", "分布式锁"]
:v-pre:
---# PHP Redis实战指南

## Redis扩展安装

```bash
# phpredis（C扩展，推荐，性能最好）
pecl install redis
# php.ini: extension=redis.so

# predis（纯PHP，无扩展依赖）
composer require predis/predis
```

### 基础连接

```php
<?php
// phpredis
$redis = new Redis();
$redis->connect('127.0.0.1', 6379, 2.5); // 主机, 端口, 超时(秒)
$redis->auth('your_password');            // Redis 6+ ACL
$redis->select(0);                       // 选择数据库
$redis->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_JSON); // 自动序列化

// predis
$redis = new Predis\Client([
    'scheme' => 'tcp',
    'host' => '127.0.0.1',
    'port' => 6379,
    'password' => 'your_password',
    'database' => 0,
]);

// 连接池（Swoole环境）
$pool = new Swoole\Database\RedisPool(
    (new Swoole\Database\RedisConfig)
        ->withHost('127.0.0.1')
        ->withPort(6379)
        ->withAuth('password')
        ->withDbIndex(0),
    20 // 最大连接数
);
```

## 5种数据结构应用场景

### String — 缓存、计数器、分布式锁

```php
<?php
// 1. 缓存
$redis->set('user:profile:123', json_encode($user), 'EX', 3600); // 1小时过期
$cached = $redis->get('user:profile:123');

// SET NX EX：原子操作（不存在时设置 + 过期时间）
$locked = $redis->set('lock:order:123', 'worker-1', ['NX', 'EX' => 30]);
if ($locked) {
    // 获取锁成功
}

// 2. 计数器
$redis->incr('api:visits:20260531');          // 自增1
$redis->incrBy('api:visits:20260531', 10);    // 自增10
$redis->incrByFloat('user:balance:123', -9.9); // 浮点数

// 3. 限流器（滑动窗口）
function isRateLimited(Redis $redis, string $key, int $maxRequests, int $window): bool
{
    $now = time();
    $pipe = $redis->multi(Redis::PIPELINE);

    // 移除窗口外的记录
    $pipe->zRemRangeByScore($key, 0, $now - $window);
    // 添加当前请求
    $pipe->zAdd($key, $now, $now . ':' . uniqid());
    // 统计窗口内请求数
    $pipe->zCard($key);
    // 设置过期
    $pipe->expire($key, $window);

    $results = $pipe->exec();
    return $results[2] > $maxRequests;
}
```

### Hash — 对象存储

```php
<?php
// 存储用户对象（比String+JSON更灵活，可单独修改字段）
$redis->hMSet('user:123', [
    'name' => '张三',
    'email' => 'z@test.com',
    'age' => 25,
    'score' => 98.5,
]);

// 读取单个字段
$name = $redis->hGet('user:123', 'name');

// 读取所有字段
$user = $redis->hGetAll('user:123');

// 只修改一个字段
$redis->hIncrBy('user:123', 'score', 5); // score += 5

// 检查字段是否存在
$redis->hExists('user:123', 'email'); // true
```

### List — 消息队列、最新列表

```php
<?php
// 消息队列（生产者-消费者模式）
// 生产者
$redis->rPush('queue:email', json_encode([
    'to' => 'user@test.com',
    'subject' => '欢迎注册',
    'body' => '...',
]));

// 消费者（阻塞弹出）
while (true) {
    $message = $redis->blPop(['queue:email'], 30); // 30秒超时
    if ($message) {
        $data = json_decode($message[1], true);
        sendEmail($data);
    }
}

// 最新文章列表（限制长度）
$redis->lPush('latest:articles', $articleId);
$redis->lTrim('latest:articles', 0, 99); // 只保留最新100篇
$latestIds = $redis->lRange('latest:articles', 0, -1);
```

### Set — 标签、关注关系、去重

```php
<?php
// 用户标签
$redis->sAdd('user:123:tags', 'PHP', 'Go', 'MySQL');

// 共同标签
$common = $redis->sInter('user:123:tags', 'user:456:tags');

// 可能认识的人（共同好友）
$redis->sAdd('friends:123', 'A', 'B', 'C');
$redis->sAdd('friends:456', 'B', 'C', 'D');
$mutual = $redis->sInter('friends:123', 'friends:456'); // ['B', 'C']

// 随机抽奖
$winner = $redis->sRandMember('lottery:users'); // 随机取一个
$winners = $redis->sPop('lottery:users', 3);     // 随机取3个并移除
```

### Sorted Set — 排行榜、延迟队列

```php
<?php
// 游戏排行榜
$redis->zAdd('leaderboard:game1', 1500, 'player:A');
$redis->zAdd('leaderboard:game1', 2300, 'player:B');
$redis->zAdd('leaderboard:game1', 1800, 'player:C');

// 获取Top10（分数从高到低）
$top10 = $redis->zRevRange('leaderboard:game1', 0, 9, true);
// ['player:B' => 2300, 'player:C' => 1800, 'player:A' => 1500]

// 获取排名
$rank = $redis->zRevRank('leaderboard:game1', 'player:A'); // 2（第3名）

// 延迟队列（score为执行时间戳）
$redis->zAdd('delay:queue', time() + 300, json_encode(['task' => 'send_email', 'delay' => 300]));

// 消费延迟任务
$now = time();
$tasks = $redis->zRangeByScore('delay:queue', 0, $now);
foreach ($tasks as $task) {
    $redis->zRem('delay:queue', $task);
    processTask(json_decode($task, true));
}
```

## 缓存策略

### 旁路缓存（Cache-Aside）

```php
<?php
class CacheService
{
    public function __construct(
        private Redis $redis,
        private PDO $pdo
    ) {}

    // 读取：先查缓存，miss时查数据库并回填
    public function getUser(int $id): ?array
    {
        $key = "user:{$id}";
        $cached = $this->redis->get($key);

        if ($cached !== false) {
            return json_decode($cached, true);
        }

        // 缓存miss，查数据库
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();

        if ($user) {
            // 回填缓存（随机过期时间防止雪崩）
            $ttl = 3600 + random_int(0, 600);
            $this->redis->set($key, json_encode($user), $ttl);
        }

        return $user ?: null;
    }

    // 更新：先更新数据库，再删除缓存
    public function updateUser(int $id, array $data): bool
    {
        $stmt = $this->pdo->prepare('UPDATE users SET name = ? WHERE id = ?');
        $result = $stmt->execute([$data['name'], $id]);

        // 删除缓存（而不是更新缓存）
        $this->redis->del("user:{$id}");

        return $result;
    }
}
```

### 缓存穿透防护

```php
<?php
// 穿透：查询不存在的数据，缓存无法命中，请求直达数据库
function getWithAntiPenetration(Redis $redis, PDO $pdo, string $key, string $sql, array $params, int $ttl = 3600): ?array
{
    $cacheKey = "cache:{$key}";
    $cached = $redis->get($cacheKey);

    if ($cached !== false) {
        $data = json_decode($cached, true);
        return $data['__null__'] ? null : $data; // 处理空值标记
    }

    // 查数据库
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $result = $stmt->fetch();

    if ($result) {
        $redis->set($cacheKey, json_encode($result), $ttl);
    } else {
        // 缓存空值（防穿透），短过期时间
        $redis->set($cacheKey, json_encode(['__null__' => true]), 60);
    }

    return $result ?: null;
}
```

### 缓存雪崩防护

```php
<?php
// 雪崩：大量缓存同时过期，请求瞬间压垮数据库
// 防护：过期时间加随机偏移
function setWithJitter(Redis $redis, string $key, mixed $value, int $baseTtl): void
{
    $ttl = $baseTtl + random_int(0, (int)($baseTtl * 0.2)); // 0-20%随机偏移
    $redis->set($key, json_encode($value), $ttl);
}

// 多级缓存：L1(本地) + L2(Redis)
function getMultiLevel(string $key, callable $dbLoader): mixed
{
    // L1: 本地缓存（APCu）
    $value = apcu_fetch($key);
    if ($value !== false) return $value;

    // L2: Redis
    $value = $redis->get($key);
    if ($value !== false) {
        apcu_store($key, $value, 60); // 本地缓存60秒
        return json_decode($value, true);
    }

    // DB
    $value = $dbLoader();
    $redis->set($key, json_encode($value), 3600 + random_int(0, 600));
    apcu_store($key, json_encode($value), 60);

    return $value;
}
```

## 分布式锁RedLock

```php
<?php
class RedisDistributedLock
{
    private string $lockId;

    public function __construct(private Redis $redis) {}

    public function lock(string $resource, int $ttl = 10): bool
    {
        $this->lockId = bin2hex(random_bytes(16));
        $startTime = microtime(true);

        // SET NX EX 原子操作
        $acquired = $this->redis->set(
            "lock:{$resource}",
            $this->lockId,
            ['NX', 'EX' => $ttl]
        );

        if (!$acquired) {
            return false;
        }

        return true;
    }

    public function unlock(string $resource): bool
    {
        // Lua脚本保证原子性：只有锁的持有者才能释放
        $script = <<<'LUA'
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
LUA;

        return (bool)$this->redis->eval($script, ["lock:{$resource}", $this->lockId], 1);
    }

    // 自动管理锁的生命周期
    public function withLock(string $resource, callable $callback, int $ttl = 10): mixed
    {
        if (!$this->lock($resource, $ttl)) {
            throw new RuntimeException("无法获取锁: {$resource}");
        }

        try {
            return $callback();
        } finally {
            $this->unlock($resource);
        }
    }
}

// 使用
$lock = new RedisDistributedLock($redis);
try {
    $result = $lock->withLock('order:process:123', function () use ($pdo) {
        // 同一时间只有一个进程执行这段代码
        return $pdo->exec("UPDATE orders SET status = 'processing' WHERE id = 123");
    }, 30);
} catch (RuntimeException $e) {
    echo "获取锁失败: " . $e->getMessage();
}
```

## 面试常见追问

**Q: 为什么是删除缓存而不是更新缓存？**
A: 更新缓存在并发场景下可能导致数据不一致：两个写请求A、B，A先到数据库但B先更新缓存，此时缓存是B的值，但数据库已被A覆盖为旧值。删除缓存则让下次读取时重新加载最新数据。这就是"Cache-Aside Pattern"的核心思路。

**Q: RedLock算法有什么争议？**
A: Martin Kleppmann曾指出RedLock在时钟跳变、GC暂停等场景下不安全。实践中对于"不太严格"的分布式锁（如防止重复下单），单节点Redis锁够用。对严格场景建议用ZooKeeper/etcd。Redis作者Salvatore的回应是：大多数场景下RedLock足够可靠。

**Q: Redis和Memcached怎么选？**
A: Redis支持更多数据结构（Hash/Set/ZSet）、持久化、主从复制、Lua脚本。Memcached更简单、多线程性能更好、纯内存。新项目推荐Redis，除非你只需要最简单的KV缓存且追求极致吞吐。
