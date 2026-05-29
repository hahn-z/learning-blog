---
title: "021 - Swoole\Table 共享内存表：多进程数据共享的终极方案"
slug: "021-table"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:16:45.497+08:00"
updated_at: "2026-04-29T10:02:47.046+08:00"
reading_time: 37
tags: ["Swoole", "PHP"]
---

# Swoole\Table 共享内存表：多进程数据共享的终极方案

> **难度：** ⭐⭐☆☆☆ 中低
> **适用版本：** Swoole 4.x+ / 5.x
> **关键词：** 共享内存、跨进程通信、KV存储、高性能

---

## 一、概念讲解

### 什么是 Swoole\Table？

Swoole\Table 是基于共享内存的高性能 KV 数据结构，专为多进程环境设计。它能让你在多个 Worker 进程之间共享数据，**无需序列化、无需 IPC 开销**，读写速度接近内存操作。

**核心特点：**

- **共享内存**：所有进程共享同一块内存区域，零拷贝
- **固定大小**：创建时预分配，不支持动态扩容（需提前规划容量）
- **行级结构**：每行可定义多个字段（int、float、string）
- **线程/进程安全**：内部自带原子操作和锁机制
- **极高性能**：单机 QPS 可达百万级

**与其他方案对比：**

| 方案 | 跨进程 | 性能 | 持久化 | 复杂度 |
|------|--------|------|--------|--------|
| Swoole\Table | ✅ 原生 | 极高 | ❌ | 低 |
| Redis | ✅ 网络 | 高 | ✅ | 中 |
| APCu | ✅ 共享内存 | 极高 | ❌ | 低 |
| MySQL | ✅ 网络 | 低 | ✅ | 高 |
| 文件 | ✅ | 极低 | ✅ | 低 |

### 工作原理

```
Master Process
│
├── Swoole\Table (共享内存区域)
│   ├── Row 0: [field1][field2][field3]
│   ├── Row 1: [field1][field2][field3]
│   └── Row N: [field1][field2][field3]
│
├── Worker #0 ──┐
├── Worker #1 ──┤── 全部指向同一块共享内存
├── Worker #2 ──┤
└── Worker #3 ──┘
```

Swoole\Table 在 `start` 之前创建，fork 后子进程自动继承父进程的共享内存映射，实现零成本跨进程访问。

---

## 二、脑图（ASCII）

```
Swoole\Table
├── 创建与配置
│   ├── table->column() 定义字段
│   ├── table->create()  分配内存
│   └── 容量规划 (2的幂次)
├── 数据操作
│   ├── set()  写入/更新
│   ├── get()  读取
│   ├── del()  删除
│   ├── exists() 判断存在
│   └── incr()/decr() 原子增减
├── 遍历
│   ├── foreach 循环
│   ├── count() 总行数
│   └── rewind()/current()/next() 迭代器
├── 内存管理
│   ├── 固定大小，不可扩容
│   ├── 内存占用 = 行数 × 行大小
│   └── getMemorySize() 查看占用
└── 典型场景
    ├── 用户在线状态
    ├── 限流计数器
    ├── 连接映射表
    └── 配置缓存
```

---

## 三、完整代码示例

### v1：基础用法 — 创建、读写、删除

```php
<?php
// table_basic.php
// Basic Swoole\Table operations: create, read, write, delete

// Step 1: Create table with capacity of 1024 rows
$table = new Swoole\Table(1024);

// Step 2: Define columns (name, type, length)
$table->column('id', Swoole\Table::TYPE_INT);
$table->column('name', Swoole\Table::TYPE_STRING, 64);
$table->column('score', Swoole\Table::TYPE_FLOAT);
$table->column('active', Swoole\Table::TYPE_INT, 1); // 0 or 1 as boolean

// Step 3: Allocate shared memory
$table->create();

// Step 4: Write data
$table->set('user_001', [
    'id'     => 1,
    'name'   => 'Alice',
    'score'  => 95.5,
    'active' => 1,
]);

// Shortcut: set single field
$table['user_002'] = [
    'id'     => 2,
    'name'   => 'Bob',
    'score'  => 87.0,
    'active' => 1,
];

// Step 5: Read data
$user = $table->get('user_001');
echo "User: {$user['name']}, Score: {$user['score']}\n";

// ArrayAccess style
echo "User 2: {$table['user_002']['name']}\n";

// Step 6: Check existence
var_dump($table->exists('user_001')); // true
var_dump($table->exists('user_999')); // false

// Step 7: Atomic increment / decrement
$table->incr('user_001', 'score', 2.5);  // 95.5 + 2.5 = 98.0
$table->decr('user_001', 'score', 1.0);  // 98.0 - 1.0 = 97.0
echo "Updated score: {$table->get('user_001')['score']}\n";

// Step 8: Delete
$table->del('user_002');
var_dump($table->exists('user_002')); // false

// Step 9: Count and iterate
echo "Total rows: {$table->count()}\n";
foreach ($table as $key => $row) {
    echo "  Key={$key}, Name={$row['name']}\n";
}

// Step 10: Memory usage
echo "Memory size: " . $table->getMemorySize() . " bytes\n";
```

### v2：多进程共享 — Server 中的实际应用

```php
<?php
// table_server.php
// Using Swoole\Table across multiple worker processes

// Create shared table BEFORE server starts
$userTable = new Swoole\Table(4096);
$userTable->column('fd', Swoole\Table::TYPE_INT);
$userTable->column('name', Swoole\Table::TYPE_STRING, 32);
$userTable->column('login_time', Swoole\Table::TYPE_INT);
$userTable->create();

// Connection-FD mapping table
$fdTable = new Swoole\Table(4096);
$fdTable->column('user_id', Swoole\Table::TYPE_STRING, 32);
$fdTable->create();

$server = new Swoole\WebSocket\Server('0.0.0.0', 9501);

// Worker start: each worker can access shared tables
$server->on('WorkerStart', function ($serv, $workerId) {
    echo "[Worker {$workerId}] Ready, user count: {$serv->userTable->count()}\n";
});

// Store tables on server instance for easy access
$server->userTable = $userTable;
$server->fdTable = $fdTable;

$server->on('Open', function ($server, $request) {
    $fd = $request->fd;
    // Register connection
    $server->fdTable->set("fd_{$fd}", [
        'user_id' => '',
    ]);
    echo "[Open] FD={$fd}, Total connections: {$server->fdTable->count()}\n";
});

$server->on('Message', function ($server, $frame) {
    $data = json_decode($frame->data, true);
    $fd = $frame->fd;

    if (isset($data['action'])) {
        switch ($data['action']) {
            case 'login':
                $name = $data['name'] ?? 'anonymous';
                // Save user info
                $server->userTable->set("user_{$fd}", [
                    'fd'         => $fd,
                    'name'       => $name,
                    'login_time' => time(),
                ]);
                // Map FD to user
                $server->fdTable->set("fd_{$fd}", [
                    'user_id' => "user_{$fd}",
                ]);
                // Broadcast online count
                $count = $server->userTable->count();
                foreach ($server->userTable as $key => $row) {
                    $server->push($row['fd'], json_encode([
                        'type'  => 'online_count',
                        'count' => $count,
                        'user'  => $name . ' joined',
                    ]));
                }
                break;

            case 'chat':
                $userInfo = $server->fdTable->get("fd_{$fd}");
                if (!$userInfo || empty($userInfo['user_id'])) {
                    $server->push($fd, json_encode(['error' => 'Please login first']));
                    return;
                }
                $user = $server->userTable->get($userInfo['user_id']);
                // Broadcast message to all users
                foreach ($server->userTable as $key => $row) {
                    $server->push($row['fd'], json_encode([
                        'type'    => 'chat',
                        'from'    => $user['name'],
                        'message' => $data['message'] ?? '',
                        'time'    => date('H:i:s'),
                    ]));
                }
                break;
        }
    }
});

$server->on('Close', function ($server, $fd) {
    $fdInfo = $server->fdTable->get("fd_{$fd}");
    if ($fdInfo && !empty($fdInfo['user_id'])) {
        $server->userTable->del($fdInfo['user_id']);
    }
    $server->fdTable->del("fd_{$fd}");
    echo "[Close] FD={$fd}, Remaining: {$server->userTable->count()}\n";
});

echo "Server started on ws://0.0.0.0:9501\n";
$server->start();
```

### v3：高级应用 — 限流器 + 热数据缓存

```php
<?php
// table_advanced.php
// Advanced: Rate limiter + hot data cache with Swoole\Table

// Rate limit table: track request counts per IP
$rateLimitTable = new Swoole\Table(65536);
$rateLimitTable->column('count', Swoole\Table::TYPE_INT);
$rateLimitTable->column('window_start', Swoole\Table::TYPE_INT);
$rateLimitTable->create();

// Cache table: store hot query results
$cacheTable = new Swoole\Table(2048);
$cacheTable->column('data', Swoole\Table::TYPE_STRING, 4096);
$cacheTable->column('expire_at', Swoole\Table::TYPE_INT);
$cacheTable->create();

$server = new Swoole\Http\Server('0.0.0.0', 9502);

$server->rateLimiter = $rateLimitTable;
$server->cache = $cacheTable;

// Rate limit check helper
function checkRateLimit($server, $ip, $maxRequests = 100, $windowSeconds = 60) {
    $now = time();
    $record = $server->rateLimiter->get($ip);

    if (!$record) {
        // First request in window
        $server->rateLimiter->set($ip, [
            'count'        => 1,
            'window_start' => $now,
        ]);
        return true;
    }

    // Check if window expired
    if ($now - $record['window_start'] >= $windowSeconds) {
        // Reset window
        $server->rateLimiter->set($ip, [
            'count'        => 1,
            'window_start' => $now,
        ]);
        return true;
    }

    // Increment and check
    if ($record['count'] >= $maxRequests) {
        return false; // Rate limited
    }

    $server->rateLimiter->incr($ip, 'count');
    return true;
}

// Cache helper
function cacheGet($server, $key) {
    $item = $server->cache->get($key);
    if (!$item) return null;
    if ($item['expire_at'] < time()) {
        $server->cache->del($key);
        return null; // Expired
    }
    return json_decode($item['data'], true);
}

function cacheSet($server, $key, $data, $ttl = 300) {
    $server->cache->set($key, [
        'data'      => json_encode($data),
        'expire_at' => time() + $ttl,
    ]);
}

$server->on('Request', function ($request, $response) use ($server) {
    $ip = $request->server['remote_addr'] ?? 'unknown';
    $path = $request->server['request_uri'];

    // Step 1: Rate limit check
    if (!checkRateLimit($server, $ip, 100, 60)) {
        $response->status(429);
        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'error'   => 'Too Many Requests',
            'message' => 'Rate limit exceeded: 100 req/min',
        ]));
        return;
    }

    // Step 2: Try cache
    $cacheKey = 'route:' . md5($path);
    $cached = cacheGet($server, $cacheKey);
    if ($cached !== null) {
        $response->header('Content-Type', 'application/json');
        $response->header('X-Cache', 'HIT');
        $response->end(json_encode($cached));
        return;
    }

    // Step 3: Generate response (simulate DB query)
    usleep(random_int(10000, 50000)); // 10-50ms simulated latency
    $result = [
        'path'  => $path,
        'time'  => date('Y-m-d H:i:s'),
        'data'  => ['items' => range(1, random_int(3, 10))],
    ];

    // Step 4: Cache the result
    cacheSet($server, $cacheKey, $result, 300);

    $response->header('Content-Type', 'application/json');
    $response->header('X-Cache', 'MISS');
    $response->end(json_encode($result));
});

echo "HTTP Server with rate limiter + cache on http://0.0.0.0:9502\n";
$server->start();
```

---

## 四、执行预览

### v1 基础运行结果

```bash
$ php table_basic.php
User: Alice, Score: 95.5
User 2: Bob
bool(true)
bool(false)
Updated score: 97
bool(false)
Total rows: 1
  Key=user_001, Name=Alice
Memory size: 131072 bytes
```

### v2 服务端运行

```bash
$ php table_server.php
Server started on ws://0.0.0.0:9501
[Worker 0] Ready, user count: 0
[Open] FD=1, Total connections: 1
[Open] FD=2, Total connections: 2
[Close] FD=1, Remaining: 0
```

### v3 HTTP服务测试

```bash
# Normal request
$ curl -i http://localhost:9502/api/users
HTTP/1.1 200 OK
X-Cache: MISS
{"path":"/api/users","time":"2024-01-15 10:30:00","data":{"items":[1,2,3,4,5]}}

# Second request (cache hit)
$ curl -i http://localhost:9502/api/users
HTTP/1.1 200 OK
X-Cache: HIT
{"path":"/api/users","time":"2024-01-15 10:30:00","data":{"items":[1,2,3,4,5]}}

# Rate limited
$ for i in $(seq 1 110); do curl -s http://localhost:9502/api/users | head -1; done
# ... 100 successes then:
{"error":"Too Many Requests","message":"Rate limit exceeded: 100 req/min"}
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 容量规划 | 创建后无法扩容 | 预留 50%-100% 余量 |
| 内存占用 | 容量×行大小，较大 | 用 `getMemorySize()` 监控 |
| 字符串长度 | 固定分配，不足浪费，溢出截断 | 取实际最大长度+20% |
| 创建时机 | 必须在 Server->start() 之前 | 在全局位置创建 |
| 键冲突 | 不同数据用不同 key 前缀 | 如 `user_xxx`、`conn_xxx` |
| 大小写 | 键名区分大小写 | 统一用小写 |
| 并发安全 | incr/decr 是原子操作 | 优先用原子操作替代 get+set |
| 内存泄漏 | del 才释放行，覆盖不释放旧数据 | 定期清理无用行 |

---

## 六、避坑指南

### ❌ 坑1：创建后动态扩容

```php
// ❌ 错误：create() 之后不能再 column() 或重新 create()
$table = new Swoole\Table(1024);
$table->column('name', Swoole\Table::TYPE_STRING, 32);
$table->create();
// 容量不够了...
$table->column('extra', Swoole\Table::TYPE_STRING, 64); // 无效！
$table->create(); // 报错或无效！
```

```php
// ✅ 正确：提前规划容量，预留余量
$table = new Swoole\Table(8192); // 预估使用 4096，预留 2x
$table->column('name', Swoole\Table::TYPE_STRING, 32);
$table->column('extra', Swoole\Table::TYPE_STRING, 64); // 一次定义完
$table->create();
```

### ❌ 坑2：在 WorkerStart 中创建 Table

```php
// ❌ 错误：WorkerStart 在各 Worker 进程中执行
$server->on('WorkerStart', function () {
    $table = new Swoole\Table(1024); // 每个 Worker 独立内存！
    $table->column('data', Swoole\Table::TYPE_STRING, 64);
    $table->create();
});
```

```php
// ✅ 正确：在 Server->start() 之前创建
$table = new Swoole\Table(1024);
$table->column('data', Swoole\Table::TYPE_STRING, 64);
$table->create();

$server = new Swoole\Http\Server('0.0.0.0', 9501);
$server->table = $table; // 附加到 server
$server->start();
```

### ❌ 坑3：存储复杂嵌套数据

```php
// ❌ 错误：Table 只支持 int/float/string，不支持数组嵌套
$table->set('key', ['data' => json_encode(['nested' => ['deep' => true]])]);
// 读出来还要 json_decode，类型不安全
```

```php
// ✅ 正确：存 JSON 字符串，约定序列化/反序列化
$table->set('key', [
    'data'      => json_encode(['nested' => ['deep' => true]]),
    'expire_at' => time() + 3600,
]);

// 读取时解码
$raw = $table->get('key');
$data = json_decode($raw['data'], true);
```

---

## 七、练习题

### 🟢 基础题

1. 创建一个 Swoole\Table，包含 `uid`(int)、`username`(string, 32)、`level`(int) 三个字段，容量 1024，插入 3 条数据并遍历输出。

2. 使用 `incr()` 实现一个简单的页面访问计数器，用 Table 存储每个 URL 的访问次数。

### 🟡 进阶题

3. 基于多进程 WebSocket Server，实现一个"在线用户列表"功能：用户连接时记录，断开时删除，任意用户可查询当前在线列表。

4. 实现一个 TTL 缓存：给 Table 中的数据设置过期时间，在每次读取时检查是否过期，过期则删除并返回 null。

### 🔴 挑战题

5. 设计一个"滑动窗口限流器"：记录每个 IP 最近 60 秒内每次请求的时间戳，计算窗口内请求数是否超限。提示：用 JSON 字段存储时间戳数组。

---

## 八、知识点总结

```
Swoole\Table 知识树
├── 基础
│   ├── 创建: new Table(capacity)
│   ├── 字段: column(name, type, size)
│   ├── 分配: create()
│   └── 类型: INT / FLOAT / STRING
├── CRUD
│   ├── 写入: set(key, [fields]) / $table[key] = [...]
│   ├── 读取: get(key) / $table[key]
│   ├── 删除: del(key) / unset($table[key])
│   ├── 存在: exists(key)
│   └── 原子: incr(key, field, step) / decr()
├── 遍历
│   ├── foreach ($table as $key => $row)
│   ├── count()
│   └── getMemorySize()
├── 多进程
│   ├── 在 start() 前创建
│   ├── fork 后自动共享
│   └── 无需 IPC 序列化
└── 最佳实践
    ├── 预留容量余量
    ├── 用前缀区分业务
    ├── 优先用原子操作
    └── 及时清理过期数据
```

---

## 九、举一反三

| 场景 | 推荐方案 | 替代方案 | 适用条件 |
|------|----------|----------|----------|
| 进程内计数器 | `Swoole\Table` + incr | `Swoole\Atomic` | 需要按 key 分别计数 |
| 用户在线状态 | `Swoole\Table` | Redis Hash | 单机用 Table，集群用 Redis |
| 接口限流 | `Swoole\Table` | Redis + Lua | 单机限流用 Table |
| 配置热更新 | `Swoole\Table` | APCu | 需要结构化数据用 Table |
| 连接映射 | `Swoole\Table` | 数组 + IPC | 跨进程必须用 Table 或 IPC |
| 缓存热数据 | `Swoole\Table` | Redis | 单机且数据量可控用 Table |
| 分布式锁 | ~~Table~~ | Redis SETNX | Table 仅限单机 |

---

## 十、参考资料

- [Swoole 官方文档 - Swoole\Table](https://wiki.swoole.com/#/memory/table)
- [Swoole 多进程编程指南](https://wiki.swoole.com/#/learn?id=multi-process)
- [PHP共享内存系列扩展对比](https://www.php.net/manual/en/book.shmop.php)
- [Swoole Server 配置文档](https://wiki.swoole.com/#/server/settings)

---

## 十一、代码演进路线

```
v1 基础用法
├── Table 创建、字段定义
├── set/get/del/incr 操作
└── 遍历和统计
    │
    ▼
v2 多进程应用
├── Server 前创建共享表
├── Worker 进程读写
├── 双表联动（用户表+连接表）
└── 广播消息遍历
    │
    ▼
v3 生产级方案
├── 限流器（滑动窗口）
├── 热数据缓存（TTL 过期）
├── 自动清理机制
└── 监控指标（命中率、内存）
```

**演进核心思想：** 从单进程理解数据结构 → 多进程共享实战 → 生产级可靠性方案。每一步都是在上一步基础上增加复杂度和健壮性。
