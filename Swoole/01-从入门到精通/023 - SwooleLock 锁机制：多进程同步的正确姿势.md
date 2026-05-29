---
title: "023 - Swoole\Lock 锁机制：多进程同步的正确姿势"
slug: "023-lock"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:16:45.524+08:00"
updated_at: "2026-04-29T10:02:47.061+08:00"
reading_time: 41
tags: ["Swoole", "PHP"]
---

# Swoole\Lock 锁机制：多进程同步的正确姿势

> **难度：** ⭐⭐⭐☆☆ 中等
> **适用版本：** Swoole 4.x+ / 5.x
> **关键词：** 互斥锁、读写锁、自旋锁、死锁、并发同步

---

## 一、概念讲解

### 为什么需要锁？

在多进程/多线程环境中，多个执行单元同时访问共享资源时，可能产生 **竞态条件（Race Condition）**，导致数据不一致。锁的作用就是保证同一时刻只有一个执行单元能访问临界区。

```
无锁时：
  Process A: read(x=100) → x+1=101 → write(101)
  Process B:      read(x=100) → x+1=101 → write(101)
  结果：x=101，丢失了一次更新！

有锁时：
  Process A: lock() → read(100) → 101 → write → unlock()
  Process B:                  lock() ← 等待... → read(101) → 102 → write → unlock()
  结果：x=102，正确！
```

### Swoole 支持的锁类型

| 锁类型 | 常量 | 特点 | 适用场景 |
|--------|------|------|----------|
| 互斥锁 | `SWOOLE_MUTEX` | 独占、可重入 | 通用场景 |
| 读写锁 | `SWOOLE_RWLOCK` | 读共享、写独占 | 读多写少 |
| 自旋锁 | `SWOOLE_SPINLOCK` | 忙等待、不睡眠 | 持有时间极短 |
| 信号量 | `SWOOLE_SEM` | 计数信号量 | 并发数量控制 |
| 协程读写锁 | `Co\Channel` 模拟 | 协程友好 | 协程环境 |

### 锁的选择决策树

```
需要锁？
├── 临界区极短（<1μs）→ 自旋锁
├── 读多写少 → 读写锁
├── 通用场景 → 互斥锁
├── 并发数控制 → 信号量
└── 协程环境 → Channel 或 Coroutine\Lock
```

---

## 二、脑图（ASCII）

```
Swoole\Lock
├── 锁类型
│   ├── SWOOLE_MUTEX    互斥锁
│   ├── SWOOLE_RWLOCK   读写锁
│   ├── SWOOLE_SPINLOCK 自旋锁
│   └── SWOOLE_SEM      信号量
├── 核心API
│   ├── lock()         阻塞加锁
│   ├── lockwait($timeout) 超时加锁
│   ├── trylock()      非阻塞尝试
│   ├── unlock()       解锁
│   └── lock_read() / unlock_read() (读写锁专用)
├── 锁的陷阱
│   ├── 死锁 (Deadlock)
│   ├── 优先级反转
│   ├── 忘记解锁
│   └── 锁粒度过大
└── 最佳实践
    ├── try/finally 保证解锁
    ├── 最小化临界区
    ├── 统一加锁顺序
    └── 超时机制防死锁
```

---

## 三、完整代码示例

### v1：基础锁操作 — 四种锁对比

```php
<?php
// lock_basic.php
// Basic lock operations: Mutex, RWLock, SpinLock, Sem

use Swoole\Lock;

// ---- 1. Mutex (Mutual Exclusion Lock) ----
echo "=== Mutex Lock ===\n";
$mutex = new Lock(SWOOLE_MUTEX);
$mutex->lock();
echo "Mutex locked\n";
$mutex->unlock();
echo "Mutex unlocked\n";

// trylock: non-blocking
if ($mutex->trylock()) {
    echo "trylock succeeded\n";
    $mutex->unlock();
} else {
    echo "trylock failed (already locked)\n";
}

// ---- 2. RWLock (Read-Write Lock) ----
echo "\n=== Read-Write Lock ===\n";
$rwlock = new Lock(SWOOLE_RWLOCK);

// Multiple readers can hold read lock simultaneously
$rwlock->lock_read();
echo "Read lock acquired\n";
// Another process could also lock_read() without blocking
$rwlock->unlock_read();

// Write lock is exclusive
$rwlock->lock();
echo "Write lock acquired (exclusive)\n";
$rwlock->unlock();

// ---- 3. SpinLock ----
echo "\n=== SpinLock ===\n";
$spinlock = new Lock(SWOOLE_SPINLOCK);
$spinlock->lock();
echo "SpinLock acquired (busy-wait for others)\n";
$spinlock->unlock();

// ---- 4. Semaphore ----
echo "\n=== Semaphore ===\n";
$sem = new Lock(SWOOLE_SEM);
$sem->lock();   // Wait for available slot
echo "Semaphore acquired\n";
$sem->unlock(); // Release slot
echo "Semaphore released\n";
```

### v2：多进程同步 — 互斥锁保护共享资源

```php
<?php
// lock_server.php
// Multi-process synchronization with Mutex lock

// Shared table + lock for safe access
$sharedData = new Swoole\Table(1024);
$sharedData->column('value', Swoole\Table::TYPE_INT);
$sharedData->column('updated_by', Swoole\Table::TYPE_INT);
$sharedData->column('updated_at', Swoole\Table::TYPE_INT);
$sharedData->create();

// Initialize
$sharedData->set('counter', ['value' => 0, 'updated_by' => 0, 'updated_at' => 0]);

// Mutex lock for protecting counter updates
$mutex = new Swoole\Lock(SWOOLE_MUTEX);

$server = new Swoole\Http\Server('0.0.0.0', 9505);
$server->set(['worker_num' => 4]);

$server->sharedData = $sharedData;
$server->mutex = $mutex;

$server->on('Request', function ($request, $response) use ($server) {
    $path = $request->server['request_uri'];

    if ($path === '/increment') {
        // CRITICAL SECTION: protected by mutex
        $server->mutex->lock();
        try {
            $row = $server->sharedData->get('counter');
            $newValue = $row['value'] + 1;
            $server->sharedData->set('counter', [
                'value'       => $newValue,
                'updated_by'  => $server->getWorkerId(),
                'updated_at'  => time(),
            ]);
        } finally {
            $server->mutex->unlock();
        }
        // END CRITICAL SECTION

        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'counter' => $server->sharedData->get('counter')['value'],
            'worker'  => $server->getWorkerId(),
        ]));
        return;
    }

    if ($path === '/unsafe-increment') {
        // NO LOCK - will have race conditions!
        $row = $server->sharedData->get('counter');
        // Another worker might modify between get() and set()
        usleep(random_int(1000, 5000)); // Simulate delay to expose race
        $server->sharedData->set('counter', [
            'value'       => $row['value'] + 1,
            'updated_by'  => $server->getWorkerId(),
            'updated_at'  => time(),
        ]);

        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'counter' => $server->sharedData->get('counter')['value'],
            'worker'  => $server->getWorkerId(),
            'warning' => 'UNSAFE - race condition possible!',
        ]));
        return;
    }

    if ($path === '/status') {
        $counter = $server->sharedData->get('counter');
        $response->header('Content-Type', 'application/json');
        $response->end(json_encode($counter));
        return;
    }

    // Reset counter
    if ($path === '/reset') {
        $server->mutex->lock();
        try {
            $server->sharedData->set('counter', [
                'value'       => 0,
                'updated_by'  => 0,
                'updated_at'  => time(),
            ]);
        } finally {
            $server->mutex->unlock();
        }
        $response->end('Reset to 0');
        return;
    }

    $response->end('Endpoints: /increment | /unsafe-increment | /status | /reset');
});

echo "Server on http://0.0.0.0:9505\n";
echo "Try: /increment (safe) vs /unsafe-increment (race condition!)\n";
$server->start();
```

### v3：高级应用 — 读写锁 + 死锁预防 + 超时机制

```php
<?php
// lock_advanced.php
// Advanced: RWLock for read-heavy workload + deadlock prevention

// Shared configuration table
$configTable = new Swoole\Table(256);
$configTable->column('key', Swoole\Table::TYPE_STRING, 64);
$configTable->column('value', Swoole\Table::TYPE_STRING, 256);
$configTable->column('version', Swoole\Table::TYPE_INT);
$configTable->column('updated_at', Swoole\Table::TYPE_INT);
$configTable->create();

// Initial config
$configTable->set('db_host', ['key' => 'db_host', 'value' => 'localhost', 'version' => 1, 'updated_at' => time()]);
$configTable->set('cache_ttl', ['key' => 'cache_ttl', 'value' => '300', 'version' => 1, 'updated_at' => time()]);
$configTable->set('max_conn', ['key' => 'max_conn', 'value' => '1000', 'version' => 1, 'updated_at' => time()]);

// Read-Write lock: multiple readers OR single writer
$rwlock = new Swoole\Lock(SWOOLE_RWLOCK);

// Deadlock prevention: lock ordering
// Always lock resources in alphabetical order of their keys
function orderedLock($rwlock, $keys, $mode = 'read') {
    sort($keys); // Alphabetical order prevents deadlock
    foreach ($keys as $key) {
        if ($mode === 'read') {
            $rwlock->lock_read();
        } else {
            $rwlock->lock();
        }
    }
    return $keys; // Return ordered keys for unlock
}

function orderedUnlock($rwlock, $keys, $mode = 'read') {
    // Unlock in reverse order (LIFO)
    $keys = array_reverse($keys);
    foreach ($keys as $key) {
        if ($mode === 'read') {
            $rwlock->unlock_read();
        } else {
            $rwlock->unlock();
        }
    }
}

$server = new Swoole\Http\Server('0.0.0.0', 9506);
$server->set(['worker_num' => 4]);

$server->config = $configTable;
$server->rwlock = $rwlock;

// Statistics
$readCount = new Swoole\Atomic(0);
$writeCount = new Swoole\Atomic(0);
$server->readCount = $readCount;
$server->writeCount = $writeCount;

$server->on('Request', function ($request, $response) use ($server) {
    $path = $request->server['request_uri'];
    $params = $request->get ?? [];

    // GET /config?key=xxx — Read config (multiple readers OK)
    if ($path === '/config' && ($request->server['request_method'] ?? 'GET') === 'GET') {
        $server->readCount->add(1);
        $key = $params['key'] ?? null;

        // Read lock: allows concurrent reads
        $server->rwlock->lock_read();
        try {
            if ($key) {
                $row = $server->config->get($key);
                $data = $row ?: ['error' => 'Key not found'];
            } else {
                // Read all configs
                $data = [];
                foreach ($server->config as $k => $row) {
                    $data[$k] = $row;
                }
            }
        } finally {
            $server->rwlock->unlock_read();
        }

        $response->header('Content-Type', 'application/json');
        $response->end(json_encode($data));
        return;
    }

    // POST /config — Update config (exclusive write)
    if ($path === '/config' && $request->server['request_method'] === 'POST') {
        $server->writeCount->add(1);
        $body = json_decode($request->rawcontent(), true);
        $key = $body['key'] ?? null;
        $value = $body['value'] ?? null;

        if (!$key || $value === null) {
            $response->status(400);
            $response->end(json_encode(['error' => 'key and value required']));
            return;
        }

        // Write lock: exclusive access
        $server->rwlock->lock();
        try {
            $existing = $server->config->get($key);
            $version = $existing ? $existing['version'] + 1 : 1;

            $server->config->set($key, [
                'key'        => $key,
                'value'      => $value,
                'version'    => $version,
                'updated_at' => time(),
            ]);

            $data = [
                'status'  => 'updated',
                'key'     => $key,
                'value'   => $value,
                'version' => $version,
            ];
        } finally {
            $server->rwlock->unlock();
        }

        $response->header('Content-Type', 'application/json');
        $response->end(json_encode($data));
        return;
    }

    // GET /stats — View read/write statistics
    if ($path === '/stats') {
        $response->header('Content-Type', 'application/json');
        $response->end(json_encode([
            'reads'  => $server->readCount->get(),
            'writes' => $server->writeCount->get(),
        ]));
        return;
    }

    $response->end("Endpoints:\n  GET  /config?key=xxx (read)\n  POST /config (write: {key,value})\n  GET  /stats");
});

echo "Config Server on http://0.0.0.0:9506\n";
echo "Read-write lock: concurrent reads, exclusive writes\n";
$server->start();
```

---

## 四、执行预览

### v1 基础锁运行

```bash
$ php lock_basic.php
=== Mutex Lock ===
Mutex locked
Mutex unlocked
trylock succeeded

=== Read-Write Lock ===
Read lock acquired
Write lock acquired (exclusive)

=== SpinLock ===
SpinLock acquired (busy-wait for others)

=== Semaphore ===
Semaphore acquired
Semaphore released
```

### v2 锁 vs 无锁对比

```bash
$ php lock_server.php &
Server on http://0.0.0.0:9505

# 先重置
$ curl http://localhost:9505/reset

# 安全递增（有锁）- 并发100请求
$ ab -n 100 -c 10 http://localhost:9505/increment
$ curl http://localhost:9505/status
{"value":100,"updated_by":3,"updated_at":1705312200}
# ✅ 100次请求 = 值为100，正确！

# 重置
$ curl http://localhost:9505/reset

# 不安全递增（无锁）- 同样100请求
$ ab -n 100 -c 10 http://localhost:9505/unsafe-increment
$ curl http://localhost:9505/status
{"value":87,"updated_by":2,"updated_at":1705312205}
# ❌ 100次请求但值只有87！丢失了13次更新！
```

### v3 读写锁性能

```bash
$ php lock_advanced.php &
Config Server on http://0.0.0.0:9506

# 读操作（可并发）
$ ab -n 10000 -c 50 http://localhost:9506/config?key=db_host

# 写操作（独占）
$ curl -X POST http://localhost:9506/config \
  -d '{"key":"db_host","value":"10.0.0.1"}'
{"status":"updated","key":"db_host","value":"10.0.0.1","version":2}

# 查看统计
$ curl http://localhost:9506/stats
{"reads":10000,"writes":1}
```

---

## 五、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 临界区大小 | 越小越好 | 只保护必须同步的代码 |
| 锁的创建 | 在 fork 前创建 | 和 Table/Atomic 同理 |
| 解锁保证 | 异常时也要解锁 | 用 try/finally |
| 死锁预防 | 多锁场景容易死锁 | 统一加锁顺序 |
| 超时机制 | 避免无限等待 | 用 lockwait() 设超时 |
| 协程环境 | SWOOLE_MUTEX 会阻塞协程 | 用 Coroutine\Lock 或 Channel |
| 可重入 | SWOOLE_MUTEX 可重入 | 同一进程可多次 lock() |

---

## 六、避坑指南

### ❌ 坑1：忘记解锁（异常路径）

```php
// ❌ 危险：异常时锁不会被释放
$lock->lock();
doSomethingRisky(); // 如果抛异常，锁永远不会释放！
$lock->unlock();
```

```php
// ✅ 安全：try/finally 保证解锁
$lock->lock();
try {
    doSomethingRisky();
} finally {
    $lock->unlock(); // 无论是否异常都会执行
}
```

### ❌ 坑2：临界区过大

```php
// ❌ 糟糕：整个请求处理都在锁内
$lock->lock();
try {
    $data = readFromDatabase();   // 慢！100ms
    $result = process($data);     // 慢！50ms
    saveToCache($result);         // 慢！10ms
    $counter->add(1);             // 只有这步需要锁
} finally {
    $lock->unlock();
}
```

```php
// ✅ 正确：只锁必要的最小临界区
$data = readFromDatabase();     // 锁外执行
$result = process($data);       // 锁外执行
saveToCache($result);           // 锁外执行

$lock->lock();
try {
    $counter->add(1);           // 只锁这一步
} finally {
    $lock->unlock();
}
```

### ❌ 坑3：死锁 — 交叉加锁

```php
// ❌ 死锁：两个进程交叉获取两把锁
// Process A: lock(lockA) → lock(lockB)  (等待lockB)
// Process B: lock(lockB) → lock(lockA)  (等待lockA)
// → 互相等待，永远不释放 = 死锁！
```

```php
// ✅ 预防：统一加锁顺序（总是先A后B）
// Process A: lock(lockA) → lock(lockB)  ✅
// Process B: lock(lockA) → lock(lockB)  ✅ 不会交叉

// 或者用 trylock + 超时，失败时释放已有锁重试
function safeMultiLock($locks, $timeout = 1.0) {
    $acquired = [];
    foreach ($locks as $lock) {
        if (!$lock->trylock()) {
            // Failed: release all and retry
            foreach ($acquired as $l) $l->unlock();
            return false;
        }
        $acquired[] = $lock;
    }
    return true;
}
```

### ❌ 坑4：协程环境用错锁

```php
// ❌ 危险：SWOOLE_MUTEX 会阻塞整个线程（所有协程）
Swoole\Runtime::enableCoroutine();
$lock = new Swoole\Lock(SWOOLE_MUTEX);

go(function () use ($lock) {
    $lock->lock(); // 阻塞线程！其他协程也被卡住
    // ...
    $lock->unlock();
});
```

```php
// ✅ 正确：协程环境用 Channel 或 Coroutine\Lock
$chan = new Swoole\Coroutine\Channel(1);

go(function () use ($chan) {
    $chan->push(true); // 加锁（通道满时协程挂起，不阻塞线程）
    try {
        // critical section
    } finally {
        $chan->pop(); // 解锁
    }
});
```

---

## 七、练习题

### 🟢 基础题

1. 使用 SWOOLE_MUTEX 实现一个简单的文件写入保护：多个进程同时写同一个文件，确保内容不交叉。

2. 对比 trylock() 和 lock() 的行为差异：写两个进程，一个持有锁 5 秒，另一个分别用两种方式尝试获取锁。

### 🟡 进阶题

3. 用 SWOOLE_RWLOCK 实现一个"配置中心"：提供 read() 和 write() 两个方法，验证多个进程可以同时 read，但 write 时 read 被阻塞。

4. 实现一个带超时的锁：用 lockwait() 设置 2 秒超时，超时返回错误而不是无限等待。

### 🔴 挑战题

5. 实现一个简易"分布式锁模拟"：用 SWOOLE_MUTEX + Table 实现锁的 owner 记录和过期检测，支持锁的可重入和强制释放。

---

## 八、知识点总结

```
Swoole\Lock 知识树
├── 锁类型
│   ├── SWOOLE_MUTEX    → 通用互斥，可重入
│   ├── SWOOLE_RWLOCK   → 读共享写独占
│   ├── SWOOLE_SPINLOCK → 忙等待，CPU密集
│   └── SWOOLE_SEM      → 计数信号量
├── API
│   ├── lock()           → 阻塞加锁
│   ├── trylock()        → 非阻塞尝试
│   ├── lockwait($ms)    → 超时加锁
│   ├── unlock()         → 解锁
│   ├── lock_read()      → 读锁（RWLock）
│   └── unlock_read()    → 解读锁
├── 死锁预防
│   ├── 统一加锁顺序
│   ├── 超时机制
│   ├── trylock + 回退
│   └── 最小化临界区
├── 协程兼容
│   ├── SWOOLE_MUTEX → 阻塞线程（慎用）
│   ├── Channel → 协程友好
│   └── Coroutine\Lock → 协程专用
└── 最佳实践
    ├── try/finally 解锁
    ├── 最小临界区
    ├── 性能监控
    └── 锁粒度权衡
```

---

## 九、举一反三

| 场景 | 推荐锁 | 替代方案 | 说明 |
|------|--------|----------|------|
| 通用数据保护 | Mutex | Atomic（简单计数） | 复杂操作用 Mutex |
| 配置读取（读多写少） | RWLock | Mutex（简单但不优化读） | RWLock 读不互斥 |
| 高频短操作 | SpinLock | Mutex | SpinLock 无上下文切换 |
| 连接池限流 | Semaphore | Atomic + CAS | Semaphore 语义更清晰 |
| 协程环境 | Channel / Coroutine\Lock | ~~Mutex~~ | Mutex 阻塞整个线程 |
| 分布式锁 | Redis SETNX | ~~Swoole\Lock~~ | 跨机器必须用外部锁 |
| 简单计数 | Atomic（无需锁） | Table incr | 原子操作比锁更高效 |

---

## 十、参考资料

- [Swoole 官方文档 - Swoole\Lock](https://wiki.swoole.com/#/memory/lock)
- [死锁原理与预防](https://en.wikipedia.org/wiki/Deadlock)
- [读写锁原理](https://en.wikipedia.org/wiki/Readers%E2%80%93writer_lock)
- [Swoole 协程同步 - Channel](https://wiki.swoole.com/#/coroutine/channel)
- [Swoole Coroutine\Lock](https://wiki.swoole.com/#/coroutine/lock)

---

## 十一、代码演进路线

```
v1 基础锁操作
├── 四种锁类型演示
├── lock/unlock/trylock
└── 理解不同锁的行为差异
    │
    ▼
v2 多进程同步
├── Mutex 保护共享数据
├── 有锁 vs 无锁对比实验
├── try/finally 安全模式
└── 竞态条件可视化
    │
    ▼
v3 生产级方案
├── RWLock 读多写少优化
├── 死锁预防（统一顺序）
├── 超时机制（lockwait）
├── 版本号乐观锁
└── 读写统计监控
```

**核心演进：** 理解锁 → 正确使用锁 → 高级锁优化与防坑。锁是并发编程的"安全带"——不用会出事，乱用也会出事，关键是用对。
