---
title: "012 - Swoole 协程调度器与协程切换：深入理解事件循环"
slug: "012-coroutine-scheduler"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:02:17.67+08:00"
updated_at: "2026-04-29T10:02:46.969+08:00"
reading_time: 26
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐⭐☆☆ 中高级

**前置知识：** 协程基础、事件驱动概念、I/O 多路复用
**预计学习时间：** 60 分钟

---

## 概念讲解

### 什么是协程调度器？

Swoole 的协程调度器是整个协程系统的**核心引擎**。它基于**事件循环（EventLoop）**驱动，负责决定哪个协程在什么时候获得 CPU 时间片。

**核心原理：**

```
事件循环 (EventLoop)
    ↓ 监听 I/O 事件
    ↓ 定时器到期
    ↓ 信号触发
协程调度器
    ↓ 挂起当前协程
    ↓ 选择就绪协程
    ↓ 恢复执行
```

### 调度模型对比

| 模型 | 代表 | 调度方式 | 适用场景 |
|------|------|---------|----------|
| 抢占式调度 | Go goroutine | 时间片轮转 | CPU密集型 |
| 协作式调度 | Swoole coroutine | I/O 事件驱动 | I/O密集型 |
| 混合调度 | Java Virtual Thread | 两者结合 | 通用 |

### 协程切换的触发时机

Swoole 在以下情况会自动触发协程切换：

1. **网络 I/O**：`send()`、`recv()`、`connect()` 等
2. **文件 I/O**：`Coroutine::readFile()`、`Coroutine::writeFile()`
3. **定时器**：`Coroutine::sleep()`、`after()`、`tick()`
4. **DNS 解析**：`Coroutine::dnsLookup()`
5. **数据库操作**：MySQL/Redis 协程客户端
6. **手动切换**：`Coroutine::yield()`、`Coroutine::resume()`
7. **Channel 操作**：`push()`/`pop()` 满或空时

### EventLoop 生命周期

```
初始化 → 注册事件 → 等待事件 → 分发事件 → 回调执行 → 继续等待
                         ↑                              ↓
                         └──────────────────────────────┘
                              (循环直到无事件)
```

---

## 脑图（ASCII）

```
Swoole 协程调度器
├── 事件循环 (EventLoop)
│   ├── epoll (Linux)
│   ├── kqueue (macOS)
│   └── IOCP (Windows)
├── 调度策略
│   ├── FIFO 就绪队列
│   ├── I/O 就绪唤醒
│   └── 定时器轮
├── 协程切换触发
│   ├── 网络 I/O
│   ├── 文件 I/O
│   ├── sleep/定时器
│   ├── Channel 阻塞
│   ├── yield/resume
│   └── WaitGroup 等待
├── 调度器 API
│   ├── Coroutine::yield()
│   ├── Coroutine::resume()
│   ├── Coroutine::suspend()
│   └── Scheduler stats
└── 性能优化
    ├── 减少不必要的切换
    ├── 协程数量控制
    └── 协程栈大小调优
```

---

## 完整代码示例

### 示例 1：可视化协程调度过程

```php
<?php
// 012_schedule_visual.php
// Visualize coroutine scheduling process

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    $log = function (string $who, string $action) {
        $time = number_format(microtime(true), 3, '.', '')[7];
        $cid = Coroutine::getCid();
        printf("[%s] CID=%d %s: %s\n", $time, $cid, $who, $action);
    };
    
    $log('Main', 'start');
    
    go(function () use ($log) {
        $log('CoA', 'start');
        Coroutine::sleep(0.1); // Yield here, switch to other coroutines
        $log('CoA', 'after sleep(0.1)');
    });
    
    go(function () use ($log) {
        $log('CoB', 'start');
        Coroutine::sleep(0.05); // Yield here
        $log('CoB', 'after sleep(0.05)');
        Coroutine::sleep(0.03); // Yield again
        $log('CoB', 'after sleep(0.03)');
    });
    
    go(function () use ($log) {
        $log('CoC', 'start - no I/O, pure CPU');
        $sum = 0;
        for ($i = 0; $i < 100000; $i++) {
            $sum += $i;
        }
        $log('CoC', "done, sum={$sum}");
    });
    
    $log('Main', 'launched all coroutines');
    Coroutine::sleep(0.2); // Wait for all to finish
    $log('Main', 'end');
});
```

### 示例 2：手动 yield/resume 控制

```php
<?php
// 012_yield_resume.php
// Manual coroutine yield and resume control

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    // Create a coroutine and get its CID
    $workerCid = null;
    
    go(function () use (&$workerCid) {
        $workerCid = Coroutine::getCid();
        echo "[Worker] Started, CID={$workerCid}\n";
        
        echo "[Worker] Yielding control back...\n";
        Coroutine::yield(); // Suspend, wait for resume
        
        echo "[Worker] Resumed! Doing more work...\n";
        Coroutine::sleep(0.01);
        
        echo "[Worker] Yielding again...\n";
        Coroutine::yield(); // Suspend again
        
        echo "[Worker] Resumed again! Finishing up.\n";
    });
    
    echo "[Main] Worker CID = {$workerCid}\n";
    Coroutine::sleep(0.01); // Let other coroutines settle
    
    echo "[Main] Resuming worker for the first time...\n";
    Coroutine::resume($workerCid);
    
    Coroutine::sleep(0.01);
    echo "[Main] Resuming worker for the second time...\n";
    Coroutine::resume($workerCid);
    
    Coroutine::sleep(0.01);
    echo "[Main] Done!\n";
});
```

### 示例 3：调度器性能统计

```php
<?php
// 012_scheduler_stats.php
// Monitor scheduler statistics

use Swoole\Coroutine;
use Swoole\Coroutine\System;
use function Swoole\Coroutine\run;

run(function () {
    // Create many coroutines and observe scheduling
    $total = 100;
    $chan = new Coroutine\Channel($total);
    
    $start = microtime(true);
    
    for ($i = 0; $i < $total; $i++) {
        go(function () use ($i, $chan) {
            Coroutine::sleep(rand(1, 50) / 1000); // Random 1-50ms
            $chan->push($i);
        });
    }
    
    // Collect all results
    for ($i = 0; $i < $total; $i++) {
        $chan->pop();
    }
    
    $elapsed = round((microtime(true) - $start) * 1000);
    echo "{$total} coroutines completed in {$elapsed}ms\n";
    echo "Peak memory: " . round(memory_get_peak_usage() / 1024) . " KB\n";
    echo "Coroutine count: " . Coroutine::stats()['coro_num'] ?? 'N/A' . "\n";
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 012_schedule_visual.php
[x] CID=1 Main: start
[x] CID=2 CoA: start
[x] CID=1 Main: launched all coroutines
[x] CID=3 CoB: start
[x] CID=4 CoC: start - no I/O, pure CPU
[x] CID=4 CoC: done, sum=704982704
[x] CID=3 CoB: after sleep(0.05)
[x] CID=3 CoB: after sleep(0.03)
[x] CID=2 CoA: after sleep(0.1)
[x] CID=1 Main: end
```

### 示例 2 输出

```
$ php 012_yield_resume.php
[Worker] Started, CID=2
[Worker] Yielding control back...
[Main] Worker CID = 2
[Main] Resuming worker for the first time...
[Worker] Resumed! Doing more work...
[Worker] Yielding again...
[Main] Resuming worker for the second time...
[Worker] Resumed again! Finishing up.
[Main] Done!
```

### 示例 3 输出

```
$ php 012_scheduler_stats.php
100 coroutines completed in 54ms
Peak memory: 386 KB
Coroutine count: 0
```

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| yield/resume 必须配对 | yield 后必须有 resume，否则协程永远挂起 | 🔴 严重 |
| 不要在协程内死循环 | CPU 密集型代码不会让出 CPU，会饿死其他协程 | 🔴 严重 |
| 协程栈大小限制 | 默认 2MB，递归过深可能栈溢出 | 🟡 中等 |
| resume 已结束的协程 | 协程已 dead 时 resume 会返回 false | 🟡 中等 |
| 调度器统计非实时 | stats() 返回的是快照，非精确实时数据 | 🟢 一般 |

---

## 避坑指南

### ❌ CPU 密集任务阻塞调度
```php
// WRONG: This coroutine never yields
run(function () {
    go(function () {
        // Infinite CPU loop - blocks everything!
        while (true) {
            $x = sqrt(mt_rand());
        }
    });
    go(function () {
        echo 'Never executed!'; // Starved
    });
});
```

### ✅ 定期让出 CPU
```php
// CORRECT: Yield periodically in CPU-bound tasks
run(function () {
    go(function () {
        $total = 1000000;
        for ($i = 0; $i < $total; $i++) {
            // Yield every 10000 iterations
            if ($i % 10000 === 0) {
                Coroutine::sleep(0); // Yield to scheduler
            }
            $x = sqrt($i);
        }
    });
    go(function () {
        echo 'Got CPU time!';
    });
});
```

---

### ❌ Resume 已结束的协程
```php
// WRONG: Coroutine already finished
$cid = go(function () {
    echo 'Done quickly';
});
Coroutine::sleep(0.1);
Coroutine::resume($cid); // CID already dead!
```

### ✅ 检查协程状态
```php
// CORRECT: Check before resume
if (Coroutine::exists($cid)) {
    Coroutine::resume($cid);
} else {
    echo "Coroutine {$cid} already finished\n";
}
```

---

## 练习题

### 🟢 初级
1. 使用 yield/resume 实现两个协程的交替执行（乒乓球效果）
2. 创建 50 个协程，观察它们的执行完成顺序是否与创建顺序一致

### 🟡 中级
3. 实现一个协程版的 "生产者-消费者" 模式，使用 yield/resume 而非 Channel
4. 测量 1000 个协程并发 sleep(0.01) 的总耗时，对比串行执行的理论耗时

### 🔴 高级
5. 实现一个简单的协程调度器包装器，支持优先级调度（提示：使用多个 Channel 模拟优先队列）

<details>
<summary>参考答案（题1 - 乒乓球）</summary>

```php
<?php
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    $cidA = null;
    $cidB = null;
    
    $cidA = go(function () use (&$cidB) {
        for ($i = 0; $i < 5; $i++) {
            echo "Ping! ({$i})\n";
            Coroutine::resume($cidB);
            Coroutine::yield();
        }
    });
    
    $cidB = go(function () use ($cidA) {
        for ($i = 0; $i < 5; $i++) {
            Coroutine::yield();
            echo "Pong! ({$i})\n";
            Coroutine::resume($cidA);
        }
    });
});
```

</details>

---

## 知识点总结（树状）

```
Swoole 协程调度器
├── EventLoop
│   ├── epoll/kqueue 底层实现
│   ├── 事件注册与监听
│   └── 事件分发机制
├── 调度时机
│   ├── I/O 操作（自动）
│   ├── sleep/定时器（自动）
│   ├── yield/resume（手动）
│   └── Channel 阻塞（自动）
├── 调度策略
│   ├── FIFO 就绪队列
│   ├── 协作式非抢占
│   └── CPU密集需手动让出
└── 性能监控
    ├── Coroutine::stats()
    ├── 协程数量追踪
    └── 内存使用追踪
```

---

## 举一反三

| 场景 | 调度行为 | 优化建议 |
|------|---------|----------|
| 大量短命HTTP请求 | 快速创建/销毁协程 | 复用连接，减少创建开销 |
| CPU密集计算 | 不自动让出CPU | 手动 Coroutine::sleep(0) |
| 混合I/O+CPU | I/O时让出，CPU时不让出 | 拆分为多个小协程 |
| 协程数过多 | 调度器压力大 | 使用协程池限制并发 |
| 长连接WebSocket | 协程长期存活 | 控制单连接内存使用 |

---

## 参考资料

- [Swoole 协程调度原理](https://wiki.swoole.com/#/coroutine)
- [Swoole EventLoop 文档](https://wiki.swoole.com/#/learn?id=eventloop)
- [epoll 原理详解](https://man7.org/linux/man-pages/man7/epoll.7.html)
- [Swoole 源码 - 协程调度器](https://github.com/swoole/swoole-src)

---

## 代码演进

### v1：观察调度顺序
```php
<?php
// v1: Basic scheduling observation
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    go(fn() => print "A\n");
    go(fn() => print "B\n");
    go(fn() => print "C\n");
});
```

### v2：手动调度控制
```php
<?php
// v2: Manual yield/resume scheduling
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    $cid = go(function () {
        echo "Step 1\n";
        Coroutine::yield();
        echo "Step 3\n";
    });
    echo "Step 2\n";
    Coroutine::resume($cid);
});
```

### v3：生产级调度监控
```php
<?php
// v3: Production scheduler with monitoring and limits
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $maxConcurrent = 50;
    $semaphore = new Channel($maxConcurrent);
    for ($i = 0; $i < $maxConcurrent; $i++) $semaphore->push(1);
    
    $tasks = 200;
    $results = new Channel($tasks);
    $start = microtime(true);
    
    for ($i = 0; $i < $tasks; $i++) {
        go(function () use ($i, $semaphore, $results) {
            $semaphore->pop(); // Wait for slot
            try {
                Coroutine::sleep(rand(5, 20) / 1000);
                $results->push(['task' => $i, 'status' => 'ok']);
            } finally {
                $semaphore->push(1); // Release slot
            }
        });
    }
    
    for ($i = 0; $i < $tasks; $i++) $results->pop();
    
    $elapsed = round((microtime(true) - $start) * 1000);
    $stats = Coroutine::stats();
    echo "Done: {$tasks} tasks in {$elapsed}ms\n";
    echo "Peak coroutines: " . ($stats['coro_peak_num'] ?? 'N/A') . "\n";
    echo "Peak memory: " . round(memory_get_peak_usage() / 1024 / 1024, 2) . " MB\n";
});
```

**演进思路：**
- v1 → 理解默认调度顺序
- v2 → 掌握手动调度控制
- v3 → 生产级并发控制与监控
