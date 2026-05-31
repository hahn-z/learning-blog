---
title: "014 - Swoole WaitGroup 与 Barrier 同步：协程协调实战"
slug: "014-waitgroup-barrier"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:07:49.333+08:00"
updated_at: "2026-04-29T10:02:46.989+08:00"
reading_time: 34
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐☆☆☆ 中级入门

**前置知识：** 协程基础、Channel 通信
**预计学习时间：** 40 分钟

---

## 概念讲解

### 什么是 WaitGroup？

WaitGroup 是一种**计数器同步原语**，用于等待一组协程全部完成后再继续执行。类似于 Go 的 `sync.WaitGroup`。

**核心操作：**
- `add($n)` — 计数器 +n（注册 n 个任务）
- `done()` — 计数器 -1（任务完成）
- `wait()` — 阻塞直到计数器归零

**生活类比：**
> 餐厅等位 —— 一桌10个人，到齐了才入座。WaitGroup 就是那个计数器，每来一个人 -1，归零开饭。

### 什么是 Barrier？

Barrier（屏障）是一种**集合点同步**机制，所有协程到达屏障后才能继续执行。类似于 Java 的 `CyclicBarrier`。

**WaitGroup vs Barrier 对比：**

| 特性 | WaitGroup | Barrier |
|------|-----------|--------|
| 用途 | 等待一组任务完成 | 多方在集合点同步 |
| 使用次数 | 一次性 | 可重用 |
| 计数方向 | 递减到零 | 等待 N 方到达 |
| 适用场景 | 并发请求，等结果 | 多阶段流水线 |

### Swoole 中的实现

Swoole 没有内置 WaitGroup/Barrier 类，但可以用 **Channel** 轻松实现：

```php
// WaitGroup with Channel
class WaitGroup {
    private Channel $chan;
    private int $count = 0;
    
    public function add(int $n = 1): void {
        $this->count += $n;
    }
    
    public function done(): void {
        $this->chan->push(true);
    }
    
    public function wait(float $timeout = -1): bool {
        for ($i = 0; $i < $this->count; $i++) {
            if ($this->chan->pop($timeout) === false) return false;
        }
        return true;
    }
}
```

---

## 脑图（ASCII）

```
WaitGroup & Barrier
├── WaitGroup
│   ├── add(n) 计数+N
│   ├── done() 计数-1
│   ├── wait() 阻塞等归零
│   └── 适用：并发请求等结果
├── Barrier
│   ├── 各方到达后同步
│   ├── 可重用
│   └── 适用：多阶段流水线
├── 实现方式
│   ├── Channel 实现
│   ├── 计数器 + Channel
│   └── 闭包引用共享
└── 典型场景
    ├── 并发HTTP+DB+Redis聚合
    ├── MapReduce 协程版
    ├── 多阶段数据处理
    └── 批量任务并行处理
```

---

## 完整代码示例

### 示例 1：WaitGroup 基础实现与使用

```php
<?php
// 014_waitgroup_basic.php
// WaitGroup implementation and basic usage

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class WaitGroup
{
    private Channel $chan;
    private int $count = 0;

    public function __construct()
    {
        $this->chan = new Channel(128);
    }

    public function add(int $n = 1): void
    {
        $this->count += $n;
    }

    public function done(): void
    {
        $this->chan->push(true, 0.001);
    }

    public function wait(float $timeout = 30): bool
    {
        for ($i = 0; $i < $this->count; $i++) {
            if ($this->chan->pop($timeout) === false) {
                return false; // Timeout
            }
        }
        $this->count = 0;
        return true;
    }
}

run(function () {
    $wg = new WaitGroup();
    $results = [];
    
    $tasks = [
        ['name' => 'Fetch Users', 'delay' => 0.1],
        ['name' => 'Fetch Orders', 'delay' => 0.15],
        ['name' => 'Fetch Products', 'delay' => 0.08],
    ];
    
    $wg->add(count($tasks));
    
    foreach ($tasks as $task) {
        go(function () use ($wg, $task, &$results) {
            echo "[Start] {$task['name']}...\n";
            Coroutine::sleep($task['delay']); // Simulate I/O
            $results[$task['name']] = "Data from {$task['name']}";
            echo "[Done] {$task['name']}\n";
            $wg->done();
        });
    }
    
    echo "[Main] Waiting for all tasks...\n";
    $wg->wait();
    
    echo "\n=== All tasks completed ===\n";
    foreach ($results as $name => $data) {
        echo "  {$name}: {$data}\n";
    }
});
```

### 示例 2：Barrier 实现（多阶段流水线）

```php
<?php
// 014_barrier.php
// Barrier: synchronize multiple coroutines at rendezvous points

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class Barrier
{
    private int $parties;
    private Channel $chan;

    public function __construct(int $parties)
    {
        $this->parties = $parties;
        $this->chan = new Channel($parties);
    }

    public function await(float $timeout = 30): bool
    {
        $this->chan->push(true, $timeout);
        // Wait until all parties have arrived
        while ($this->chan->length() < $this->parties) {
            Coroutine::sleep(0.001);
        }
        // Drain for reuse
        while (!$this->chan->isEmpty()) {
            $this->chan->pop(0.001);
        }
        return true;
    }
}

run(function () {
    $workers = 3;
    $barrier = new Barrier($workers);
    
    for ($w = 0; $w < $workers; $w++) {
        go(function () use ($w, $barrier) {
            // Phase 1
            echo "[Worker {$w}] Phase 1 start\n";
            Coroutine::sleep(rand(1, 5) * 0.01); // Variable work time
            echo "[Worker {$w}] Phase 1 done, waiting at barrier\n";
            $barrier->await();
            
            // Phase 2 (all start together)
            echo "[Worker {$w}] Phase 2 start\n";
            Coroutine::sleep(rand(1, 3) * 0.01);
            echo "[Worker {$w}] Phase 2 done, waiting at barrier\n";
            $barrier->await();
            
            // Phase 3
            echo "[Worker {$w}] Phase 3 complete!\n";
        });
    }
    
    Coroutine::sleep(1); // Wait for all phases
});
```

### 示例 3：并发数据聚合（API + DB + Cache）

```php
<?php
// 014_data_aggregation.php
// Real-world: aggregate data from multiple sources concurrently

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class WaitGroup {
    private Channel $chan;
    private int $count = 0;
    public function __construct() { $this->chan = new Channel(128); }
    public function add(int $n = 1): void { $this->count += $n; }
    public function done(): void { $this->chan->push(true); }
    public function wait(float $timeout = 10): bool {
        for ($i = 0; $i < $this->count; $i++) {
            if ($this->chan->pop($timeout) === false) return false;
        }
        return true;
    }
}

run(function () {
    $wg = new WaitGroup();
    $data = new \stdClass();
    $data->users = null;
    $data->orders = null;
    $data->stats = null;
    $data->config = null;
    
    $wg->add(4);
    $start = microtime(true);
    
    // Task 1: Simulate MySQL query
    go(function () use ($wg, $data) {
        Coroutine::sleep(0.05);
        $data->users = ['Alice', 'Bob', 'Charlie'];
        $wg->done();
    });
    
    // Task 2: Simulate Redis query
    go(function () use ($wg, $data) {
        Coroutine::sleep(0.02);
        $data->stats = ['views' => 1234, 'likes' => 567];
        $wg->done();
    });
    
    // Task 3: Simulate HTTP API call
    go(function () use ($wg, $data) {
        Coroutine::sleep(0.08);
        $data->orders = ['order_1', 'order_2'];
        $wg->done();
    });
    
    // Task 4: Simulate file read
    go(function () use ($wg, $data) {
        Coroutine::sleep(0.01);
        $data->config = ['debug' => false, 'cache_ttl' => 3600];
        $wg->done();
    });
    
    $wg->wait();
    $elapsed = round((microtime(true) - $start) * 1000);
    
    echo "All data loaded in {$elapsed}ms:\n";
    echo "  Users:  " . json_encode($data->users) . "\n";
    echo "  Stats:  " . json_encode($data->stats) . "\n";
    echo "  Orders: " . json_encode($data->orders) . "\n";
    echo "  Config: " . json_encode($data->config) . "\n";
    
    // Compare: serial would take 50+20+80+10 = 160ms
    // Concurrent: ~80ms (max of all)
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 014_waitgroup_basic.php
[Start] Fetch Users...
[Start] Fetch Orders...
[Start] Fetch Products...
[Main] Waiting for all tasks...
[Done] Fetch Products
[Done] Fetch Users
[Done] Fetch Orders

=== All tasks completed ===
  Fetch Users: Data from Fetch Users
  Fetch Orders: Data from Fetch Orders
  Fetch Products: Data from Fetch Products
```

### 示例 3 输出

```
$ php 014_data_aggregation.php
All data loaded in 82ms:
  Users:  ["Alice","Bob","Charlie"]
  Stats:  {"views":1234,"likes":567}
  Orders: ["order_1","order_2"]
  Config: {"debug":false,"cache_ttl":3600}
```

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| add() 在 go() 之前调用 | 否则 done() 可能先于 add() 执行 | 🔴 严重 |
| done() 必须与 add() 匹配 | 少调 done() → wait 永久阻塞 | 🔴 严重 |
| wait() 要设超时 | 防止某个协程崩溃导致永久等待 | 🟡 中等 |
| 闭包中的 &$results | 使用引用传值收集结果，注意生命周期 | 🟡 中等 |
| Barrier 的重入问题 | 自定义 Barrier 需正确处理重置逻辑 | 🟡 中等 |

---

## 避坑指南

### ❌ add() 放在 go() 内部
```php
// WRONG: Race condition - done() might execute before add()
$wg = new WaitGroup();
for ($i = 0; $i < 10; $i++) {
    go(function () use ($wg) {
        $wg->add(1); // Too late!
        // If this coroutine finishes fast, done() runs before add()
        $wg->done();
    });
}
$wg->wait();
```

### ✅ 先 add() 再 go()
```php
// CORRECT: Add count first, then start coroutines
$wg = new WaitGroup();
$wg->add(10);
for ($i = 0; $i < 10; $i++) {
    go(function () use ($wg, $i) {
        // Do work
        $wg->done();
    });
}
$wg->wait();
```

---

### ❌ 忘记 done() 导致永久阻塞
```php
// WRONG: Exception skips done()
go(function () use ($wg) {
    throw new \Exception('Oops'); // done() never called!
    $wg->done();
});
```

### ✅ 使用 try/finally 确保 done()
```php
// CORRECT: Always call done() with try/finally
go(function () use ($wg) {
    try {
        throw new \Exception('Oops');
    } finally {
        $wg->done(); // Always executed
    }
});
```

---

## 练习题

### 🟢 初级
1. 使用 WaitGroup 并发请求 3 个 URL，等待所有结果后输出
2. 测量 WaitGroup 并发 vs 串行的性能差异（5个任务，每个 sleep 0.1s）

### 🟡 中级
3. 实现一个可重用的 Barrier，支持 3 个阶段的数据处理流水线
4. 用 WaitGroup 实现一个 MapReduce：Map 阶段并发处理数据，Reduce 阶段汇总

### 🔴 高级
5. 实现一个带超时和错误报告的 EnhancedWaitGroup，某个任务超时时不影响其他任务

<details>
<summary>参考答案（题4 - MapReduce）</summary>

```php
<?php
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class WaitGroup {
    private Channel $chan;
    private int $count = 0;
    public function __construct() { $this->chan = new Channel(128); }
    public function add(int $n = 1): void { $this->count += $n; }
    public function done(): void { $this->chan->push(true); }
    public function wait(float $t = 10): bool {
        for ($i = 0; $i < $this->count; $i++) {
            if ($this->chan->pop($t) === false) return false;
        }
        return true;
    }
}

run(function () {
    $data = range(1, 100);
    $chunks = array_chunk($data, 20);
    $results = new Channel(100);
    $wg = new WaitGroup();
    $wg->add(count($chunks));
    
    // Map phase
    foreach ($chunks as $chunk) {
        go(function () use ($chunk, $wg, $results) {
            $mapped = array_map(fn($x) => $x * $x, $chunk);
            foreach ($mapped as $val) $results->push($val);
            $wg->done();
        });
    }
    
    $wg->wait();
    
    // Reduce phase
    $sum = 0;
    while (!$results->isEmpty()) {
        $sum += $results->pop();
    }
    echo "Sum of squares (1-100): {$sum}\n";
});
```

</details>

---

## 知识点总结（树状）

```
WaitGroup & Barrier
├── WaitGroup
│   ├── 原理：计数器 + Channel
│   ├── add() → done() → wait()
│   ├── 用途：等待一组协程完成
│   └── 关键：add 先于 go，done 在 finally
├── Barrier
│   ├── 原理：N方到达后统一放行
│   ├── 适用：多阶段流水线
│   └── 可重用设计
├── Channel 实现原理
│   ├── push = done 信号
│   ├── pop N 次 = wait
│   └── 超时保护
└── 典型应用
    ├── 并发数据聚合
    ├── MapReduce
    ├── 批量任务并行
    └── 多阶段处理
```

---

## 举一反三

| 场景 | 同步方式 | 说明 |
|------|---------|------|
| 并发HTTP请求等结果 | WaitGroup | add(N), 每个请求 done() |
| API+DB+Cache聚合 | WaitGroup | 3个并发源，等最慢的 |
| 多阶段ETL | Barrier | 每阶段等所有Worker完成 |
| 批量文件处理 | WaitGroup + Channel | WaitGroup等完成，Channel收集结果 |
| 分布式计算 | WaitGroup | Map阶段并发，Reduce汇总 |

---

## 参考资料

- [Go sync.WaitGroup](https://pkg.go.dev/sync#WaitGroup)
- [Java CyclicBarrier](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/CyclicBarrier.html)
- [Swoole Channel 文档](https://wiki.swoole.com/#/coroutine/channel)
- [并发同步原语对比](https://en.wikipedia.org/wiki/Synchronization_(computer_science))

---

## 代码演进

### v1：Channel 直接模拟 WaitGroup
```php
<?php
// v1: Simple Channel-based wait
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $chan = new Channel(3);
    for ($i = 0; $i < 3; $i++) {
        go(function () use ($i, $chan) {
            \Swoole\Coroutine::sleep(0.1);
            $chan->push("result-{$i}");
        });
    }
    for ($i = 0; $i < 3; $i++) {
        echo $chan->pop() . "\n";
    }
});
```

### v2：封装 WaitGroup 类
```php
<?php
// v2: Reusable WaitGroup class
// (See 示例1 above)
```

### v3：生产级数据聚合框架
```php
<?php
// v3: Production data aggregation with timeout and error handling
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class WaitGroup {
    private Channel $chan;
    private int $count = 0;
    public function __construct() { $this->chan = new Channel(128); }
    public function add(int $n = 1): void { $this->count += $n; }
    public function done(): void { $this->chan->push(true); }
    public function wait(float $timeout = 10): bool {
        for ($i = 0; $i < $this->count; $i++) {
            if ($this->chan->pop($timeout) === false) return false;
        }
        return true;
    }
}

run(function () {
    $wg = new WaitGroup();
    $errors = new Channel(32);
    $results = [];
    
    $sources = [
        'api' => fn() => Coroutine::sleep(0.1) ?? ['status' => 'ok'],
        'db' => fn() => Coroutine::sleep(0.05) ?? ['users' => 42],
        'cache' => fn() => Coroutine::sleep(0.02) ?? ['hit_rate' => 0.95],
    ];
    
    $wg->add(count($sources));
    
    foreach ($sources as $name => $fn) {
        go(function () use ($name, $fn, $wg, &$results, $errors) {
            try {
                $results[$name] = $fn();
            } catch (\Throwable $e) {
                $errors->push(['source' => $name, 'error' => $e->getMessage()]);
                $results[$name] = null;
            } finally {
                $wg->done();
            }
        });
    }
    
    $ok = $wg->wait(5.0);
    
    echo "Aggregation " . ($ok ? 'complete' : 'timed out') . ":\n";
    echo json_encode($results, JSON_PRETTY_PRINT) . "\n";
    
    while (!$errors->isEmpty()) {
        $err = $errors->pop();
        echo "ERROR [{$err['source']}]: {$err['error']}\n";
    }
});
```

**演进思路：**
- v1 → Channel 直接实现简单等待
- v2 → 封装 WaitGroup 类，语义清晰
- v3 → 生产级：超时保护、错误处理、多数据源聚合
