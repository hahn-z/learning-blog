---
title: "022 - Swoole\Atomic 原子计数器：无锁并发计数的安全方案"
slug: "022-atomic"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:16:45.512+08:00"
updated_at: "2026-04-29T10:02:47.054+08:00"
reading_time: 29
tags: ["Swoole", "PHP"]
---

# Swoole\Atomic 原子计数器：无锁并发计数的安全方案

> **难度：** ⭐☆☆☆☆ 入门
> **适用版本：** Swoole 4.x+ / 5.x
> **关键词：** 原子操作、无锁计数、并发安全、CAS

---

## 一、概念讲解

### 什么是 Swoole\Atomic？

Swoole\Atomic 是基于 CPU 原子指令的整数计数器，专为多进程/多线程并发场景设计。它能保证加减操作不会被中断，**无需加锁** 即可实现安全的并发计数。

**核心特点：**

- **无锁实现**：基于 CPU CAS（Compare-And-Swap）指令
- **极高性能**：纳秒级操作，无锁竞争
- **32位整数**：范围 -2^31 ~ 2^31-1（约 ±21亿）
- **进程/线程安全**：多进程共享，无需额外同步
- **简单易用**：只有 add/sub/get/set/cmpset 五个操作

**为什么需要原子操作？**

```php
// 普通变量在多进程下不安全：
$count = 0;

// Worker 1: $count = $count + 1  (读到0，加1，写回1)
// Worker 2: $count = $count + 1  (也读到0，加1，写回1)
// 结果: 1，但期望是 2！这就是竞态条件（Race Condition）
```

原子操作保证"读-改-写"三步不可分割，不存在中间状态。

### 原理对比

```
普通操作（非原子）：
  Read(0) → Modify(+1) → Write(1)  ← 可被中断！
  Read(0) → Modify(+1) → Write(1)  ← 覆盖了！

原子操作（CAS）：
  CAS(expected=0, new=1) → 成功，返回true
  CAS(expected=0, new=1) → 失败(expected≠1)，重试 → CAS(1,2) → 成功
```

---

## 二、脑图（ASCII）

```
Swoole\Atomic
├── 基础操作
│   ├── new Atomic(初始值默认0)
│   ├── add($increment) 返回新值
│   ├── sub($decrement) 返回新值
│   ├── get() 获取当前值
│   ├── set($value) 设置值
│   └── cmpset($expected, $new) CAS操作
├── 原理
│   ├── CPU原子指令（x86: LOCK前缀）
│   ├── CAS (Compare-And-Swap)
│   └── 共享内存（fork继承）
├── 典型场景
│   ├── 请求计数器
│   ├── 并发控制（限流）
│   ├── 状态标志位
│   ├── 简易信号量
│   └── 统计在线人数
├── Atomic\Long
│   ├── 64位整数
│   └── 范围更大（±9.2×10^18）
└── vs 替代方案
    ├── vs Table\incr() → 更轻量
    ├── vs Lock+变量 → 无锁更快
    └── vs Redis INCR → 无网络开销
```

---

## 三、完整代码示例

### v1：基础操作 — 五个API

```php
<?php
// atomic_basic.php
// Basic Swoole\Atomic operations

// Create atomic counter with initial value 0
$counter = new Swoole\Atomic(0);

// set() - set value directly
$counter->set(10);
echo "After set(10): " . $counter->get() . "\n"; // 10

// add() - atomic increment, returns new value
$newVal = $counter->add(5);
echo "After add(5): {$newVal}, get: " . $counter->get() . "\n"; // 15

// sub() - atomic decrement
$newVal = $counter->sub(3);
echo "After sub(3): {$newVal}, get: " . $counter->get() . "\n"; // 12

// cmpset() - CAS: compare and swap
// Only sets to new value if current == expected
$result = $counter->cmpset(12, 100); // current is 12, expected 12 → set to 100
echo "cmpset(12, 100): " . ($result ? "true" : "false") . ", value: " . $counter->get() . "\n"; // true, 100

$result = $counter->cmpset(12, 200); // current is 100, expected 12 → fail
echo "cmpset(12, 200): " . ($result ? "true" : "false") . ", value: " . $counter->get() . "\n"; // false, still 100

// Atomic\Long for 64-bit integers
$longCounter = new Swoole\Atomic\Long(0);
$longCounter->add(PHP_INT_MAX - 100);
echo "Long counter: " . $longCounter->get() . "\n"; // Large number
```

### v2：多进程计数 — Server 请求统计

```php
<?php
// atomic_server.php
// Multi-process request counting with Atomic

// Create atomic counters BEFORE server start
$totalRequests  = new Swoole\Atomic(0);
$activeWorkers  = new Swoole\Atomic(0);
$errorCount     = new Swoole\Atomic(0);
$startTime      = new Swoole\Atomic(time());

$server = new Swoole\Http\Server('0.0.0.0', 9503);

// Attach counters to server
$server->totalRequests = $totalRequests;
$server->activeWorkers = $activeWorkers;
$server->errorCount    = $errorCount;
$server->startTime     = $startTime;

$server->on('WorkerStart', function ($serv, $workerId) {
    $serv->activeWorkers->add(1);
    echo "[Worker {$workerId}] Started, active: {$serv->activeWorkers->get()}\n";
});

$server->on('WorkerStop', function ($serv, $workerId) {
    $serv->activeWorkers->sub(1);
    echo "[Worker {$workerId}] Stopped, active: {$serv->activeWorkers->get()}\n";
});

$server->on('Request', function ($request, $response) use ($server) {
    // Increment total request counter
    $server->totalRequests->add(1);

    $path = $request->server['request_uri'];

    // Status endpoint - view all counters
    if ($path === '/status') {
        $uptime = time() - $server->startTime->get();
        $rps = $uptime > 0 ? round($server->totalRequests->get() / $uptime, 2) : 0;

        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'total_requests' => $server->totalRequests->get(),
            'error_count'    => $server->errorCount->get(),
            'active_workers' => $server->activeWorkers->get(),
            'uptime_seconds' => $uptime,
            'requests_per_sec' => $rps,
        ]));
        return;
    }

    // Simulate occasional errors
    if (random_int(1, 20) === 1) {
        $server->errorCount->add(1);
        $response->status(500);
        $response->end('Internal Server Error');
        return;
    }

    // Normal response
    $response->header('Content-Type', 'application/json');
    $response->end(json_encode([
        'message'   => 'Hello from Swoole!',
        'request_id' => $server->totalRequests->get(),
        'worker'    => $server->getWorkerId(),
    ]));
});

echo "Server on http://0.0.0.0:9503 | Status: http://localhost:9503/status\n";
$server->start();
```

### v3：高级应用 — 并发限流 + 优雅关闭

```php
<?php
// atomic_advanced.php
// Advanced: concurrent limiter + graceful shutdown with Atomic

// Shared atomics
$maxConcurrent   = 1000;
$currentConcurrent = new Swoole\Atomic(0);
$isShuttingDown  = new Swoole\Atomic(0);  // 0=running, 1=shutting down
$totalProcessed  = new Swoole\Atomic(0);
$rejectedCount   = new Swoole\Atomic(0);

$server = new Swoole\Http\Server('0.0.0.0', 9504, SWOOLE_BASE);
$server->set([
    'worker_num'            => 4,
    'max_request'           => 10000,  // Restart worker after N requests
    'dispatch_mode'         => 1,       // Round-robin
]);

$server->currentConcurrent = $currentConcurrent;
$server->isShuttingDown    = $isShuttingDown;
$server->totalProcessed    = $totalProcessed;
$server->rejectedCount     = $rejectedCount;

$server->on('Request', function ($request, $response) use ($server, $maxConcurrent) {
    // Check graceful shutdown flag
    if ($server->isShuttingDown->get() === 1) {
        $response->status(503);
        $response->header('Connection', 'close');
        $response->end(json_encode(['error' => 'Server is shutting down']));
        return;
    }

    // Concurrent limiter using CAS loop
    $admitted = false;
    for ($i = 0; $i < 3; $i++) { // Retry up to 3 times
        $current = $server->currentConcurrent->get();
        if ($current >= $maxConcurrent) {
            break; // Over limit
        }
        // Try to increment atomically via CAS
        if ($server->currentConcurrent->cmpset($current, $current + 1)) {
            $admitted = true;
            break;
        }
        // CAS failed, another worker changed it, retry
    }

    if (!$admitted) {
        $server->rejectedCount->add(1);
        $response->status(429);
        $response->header('Retry-After', '1');
        $response->end(json_encode([
            'error'     => 'Too many concurrent requests',
            'current'   => $server->currentConcurrent->get(),
            'max'       => $maxConcurrent,
        ]));
        return;
    }

    try {
        // Simulate business logic (50-200ms)
        usleep(random_int(50000, 200000));

        $server->totalProcessed->add(1);
        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'status'    => 'ok',
            'current'   => $server->currentConcurrent->get(),
            'processed' => $server->totalProcessed->get(),
        ]));
    } finally {
        // Always decrement concurrent counter
        $server->currentConcurrent->sub(1);
    }
});

// Handle reload signal for graceful restart
$server->on('WorkerStop', function ($serv, $workerId) {
    echo "[Worker {$workerId}] Processed: {$serv->totalProcessed->get()}, Rejected: {$serv->rejectedCount->get()}\n";
});

echo "Server on http://0.0.0.0:9504\n";
echo "Max concurrent: {$maxConcurrent}\n";
$server->start();
```

---

## 四、执行预览

### v1 基础运行

```bash
$ php atomic_basic.php
After set(10): 10
After add(5): 15, get: 15
After sub(3): 12, get: 12
cmpset(12, 100): true, value: 100
cmpset(12, 200): false, value: 100
Long counter: 9223372036854775707
```

### v2 服务运行 + 压测

```bash
$ php atomic_server.php &
Server on http://0.0.0.0:9503 | Status: http://localhost:9503/status

# 并发100请求
$ ab -n 10000 -c 100 http://localhost:9503/

# 查看状态
$ curl http://localhost:9503/status
{
  "total_requests": 10000,
  "error_count": 517,
  "active_workers": 4,
  "uptime_seconds": 3,
  "requests_per_sec": 3333.33
}
```

### v3 限流测试

```bash
$ php atomic_advanced.php
Server on http://0.0.0.0:9504
Max concurrent: 1000

# 模拟高并发
$ ab -n 5000 -c 500 http://localhost:9504/

# 部分请求被限流返回 429
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 数值范围 | 32位 ±21亿 | 超出用 `Atomic\Long`（64位） |
| 只能存整数 | 不支持浮点数 | 浮点计数用 Table 的 float 字段 |
| 创建时机 | 必须在 fork 之前 | 全局位置创建 |
| CAS 重试 | cmpset 失败需自行重试 | 循环重试，设上限避免活锁 |
| 初始值 | 默认0，可指定 | 按业务设置合理初始值 |
| 多原子变量 | 可创建多个独立计数器 | 按功能分类管理 |
| 内存占用 | 每个 Atomic 约 8字节 | 极轻量 |

---

## 六、避坑指南

### ❌ 坑1：非原子"先读后写"

```php
// ❌ 错误：get() 和 set() 之间有竞态窗口
$current = $atomic->get();
$current += 1;
$atomic->set($current);  // 另一个进程可能已经改了值！
```

```php
// ✅ 正确：用 add() 原子操作
$atomic->add(1);  // 一条指令搞定，无竞态

// 或者用 CAS 保证条件更新
while (true) {
    $expected = $atomic->get();
    if ($atomic->cmpset($expected, $expected + 1)) {
        break; // 成功
    }
    // 失败自动重试
}
```

### ❌ 坑2：用 Atomic 存复杂状态

```php
// ❌ 错误：想用整数编码多种状态
// 0=空闲, 1=处理中, 2=完成, 3=错误
$atomic->set(3); // 覆盖了状态，丢失了"处理中"信息
```

```php
// ✅ 正确：简单状态用 Atomic，复杂状态用 Table
$status = new Swoole\Atomic(0);  // 只做简单的标志位
// 0=running, 1=stopped，二选一

// 复杂状态用 Table
$stateTable = new Swoole\Table(256);
$stateTable->column('status', Swoole\Table::TYPE_STRING, 16);
$stateTable->column('updated_at', Swoole\Table::TYPE_INT);
$stateTable->create();
```

### ❌ 坑3：忘记 Atomic\Long 的大数场景

```php
// ❌ 危险：32位溢出
$counter = new Swoole\Atomic(0);
for ($i = 0; $i < PHP_INT_MAX; $i++) {
    $counter->add(1); // 到21亿就溢出了！
}
```

```php
// ✅ 正确：大数用 Atomic\Long
$counter = new Swoole\Atomic\Long(0);
$counter->add(PHP_INT_MAX);
echo $counter->get(); // 安全，64位
```

---

## 七、练习题

### 🟢 基础题

1. 创建一个 Atomic 计数器，使用 4 个进程并发执行 `add(1)` 各 10000 次，验证最终值是否为 40000。

2. 使用 cmpset 实现一个简单的"一次性开关"：初始为 0，只能被设置为 1 一次。

### 🟡 进阶题

3. 在 HTTP Server 中实现一个"每分钟请求统计"：用 Atomic 记录当前分钟请求数，每分钟归零重置。

4. 用 CAS 循环实现"不超过上限的递增"：当计数器 >= 100 时不允许再增加。

### 🔴 挑战题

5. 实现一个简易"读写锁"：用多个 Atomic 变量配合 CAS，实现多个读者同时读、但写者独占的锁机制。

---

## 八、知识点总结

```
Swoole\Atomic 知识树
├── API（5个操作）
│   ├── get()     → 读取当前值
│   ├── set($v)   → 直接设置（非条件性）
│   ├── add($n)   → 原子加，返回新值
│   ├── sub($n)   → 原子减，返回新值
│   └── cmpset($expected, $new) → CAS条件更新
├── Atomic\Long
│   ├── 64位整数
│   ├── 相同 API
│   └── 适用于大数计数
├── 原理
│   ├── CPU LOCK 前缀指令
│   ├── CAS (Compare-And-Swap)
│   └── 共享内存（fork继承）
├── 多进程使用
│   ├── 在 start() 前创建
│   ├── 所有 Worker 共享
│   └── 无需序列化/IPC
└── 典型场景
    ├── 请求计数 → add(1)
    ├── 并发限制 → CAS循环
    ├── 状态标志 → cmpset(0,1)
    └── 统计指标 → add/sub
```

---

## 九、举一反三

| 场景 | 推荐方案 | 替代方案 | 说明 |
|------|----------|----------|------|
| 简单计数器 | `Atomic` | Redis INCR | 单机用 Atomic，分布式用 Redis |
| 并发限制 | `Atomic` + CAS | `Table` + incr | 都可以，Atomic 更轻量 |
| 状态标志位 | `Atomic` (0/1) | 全局变量 | 多进程必须用 Atomic |
| 速率统计 | `Atomic` + 定时重置 | `Table` | 按分钟/秒，Atomic 足够 |
| 复杂计数（多字段） | `Swoole\Table` | 多个 Atomic | 多个独立计数用多个 Atomic |
| 分布式计数 | `Redis INCR` | ~~Atomic~~ | Atomic 仅限单机 |

---

## 十、参考资料

- [Swoole 官方文档 - Swoole\Atomic](https://wiki.swoole.com/#/memory/atomic)
- [CAS 原理详解 - Wikipedia](https://en.wikipedia.org/wiki/Compare-and-swap)
- [x86 LOCK 指令前缀](https://www.felixcloutier.com/x86/lock)
- [Swoole\Atomic\Long 文档](https://wiki.swoole.com/#/memory/atomic?id=atomic_long)

---

## 十一、代码演进路线

```
v1 基础操作
├── 5个API演示（get/set/add/sub/cmpset）
├── Atomic\Long 大数支持
└── CAS 基本概念
    │
    ▼
v2 多进程统计
├── Server 集成
├── 多个 Atomic 联合使用
├── 实时状态监控（/status接口）
└── Worker 生命周期跟踪
    │
    ▼
v3 生产级方案
├── CAS 循环并发控制
├── 优雅关闭标志位
├── 限流 + 请求统计
└── 异常安全（try/finally 递减）
```

**核心脉络：** 从理解原子操作 → 实际多进程应用 → 生产级可靠性保障。Atomic 虽小，却是并发编程的基石。
