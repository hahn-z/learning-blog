---
title: "013 - Swoole Channel 通道详解：协程间通信的利器"
slug: "013-channel"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:07:49.321+08:00"
updated_at: "2026-04-29T10:02:46.98+08:00"
reading_time: 32
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐☆☆☆ 中级入门

**前置知识：** 协程基础、生产者-消费者模式
**预计学习时间：** 50 分钟

---

## 概念讲解

### 什么是 Channel？

Channel 是 Swoole 提供的**协程间通信机制**，类似于 Go 语言的 channel。它是一个**有缓冲的队列**，支持协程间的安全数据传递。

**核心思想：** "不要通过共享内存来通信，而要通过通信来共享内存"（Do not communicate by sharing memory; instead, share memory by communicating.）

### Channel 特性

| 特性 | 说明 |
|------|------|
| 线程安全 | 多协程并发 push/pop 自动加锁 |
| 阻塞语义 | 满时 push 阻塞，空时 pop 阻塞 |
| 容量限制 | 构造时指定缓冲区大小 |
| FIFO | 先进先出队列 |
| 生命周期 | 随进程，协程结束不影响 Channel |

### Channel 工作原理

```
生产者协程 ──push()──→ [││││││││││] ──pop()──→ 消费者协程
                        Channel (容量=N)
                        
push 到满 → 阻塞生产者，等待空间
pop 到空  → 阻塞消费者，等待数据
```

### 关键 API 速览

| 方法 | 说明 | 阻塞行为 |
|------|------|----------|
| `new Channel($size)` | 创建容量为 $size 的通道 | - |
| `push($data, $timeout)` | 推入数据 | 满时阻塞，超时返回 false |
| `pop($timeout)` | 弹出数据 | 空时阻塞，超时返回 false |
| `close()` | 关闭通道 | 唤醒所有等待的协程 |
| `stats()` | 获取状态 | 返回 queue_num, capacity |
| `isEmpty()` | 是否为空 | 非阻塞 |
| `isFull()` | 是否已满 | 非阻塞 |
| `length()` | 当前元素数 | 非阻塞 |

---

## 脑图（ASCII）

```
Swoole Channel
├── 基本操作
│   ├── new Channel(capacity)
│   ├── push(data, timeout)
│   ├── pop(timeout)
│   ├── close()
│   └── stats()
├── 阻塞行为
│   ├── push 满时阻塞
│   ├── pop 空时阻塞
│   ├── 超时返回 false
│   └── close 唤醒等待者
├── 典型模式
│   ├── 生产者-消费者
│   ├── 扇出(Fan-out)
│   ├── 扇入(Fan-in)
│   ├── 信号量(Semaphore)
│   └── 结果收集
├── 与其他通信方式对比
│   ├── vs 全局变量
│   ├── vs yield/resume
│   └── vs Table
└── 最佳实践
    ├── 合理设置容量
    ├── 及时 close
    ├── 超时保护
    └── 错误处理
```

---

## 完整代码示例

### 示例 1：生产者-消费者模型

```php
<?php
// 013_producer_consumer.php
// Classic producer-consumer pattern with Channel

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $bufferSize = 5;
    $channel = new Channel($bufferSize);
    $totalItems = 20;
    
    // Producer coroutine
    go(function () use ($channel, $totalItems) {
        for ($i = 0; $i < $totalItems; $i++) {
            $data = ["id" => $i, "data" => "item-{$i}", "ts" => microtime(true)];
            $channel->push($data);
            echo "[Producer] Pushed item {$i}, queue length: {$channel->length()}\n";
            Coroutine::sleep(0.02); // Simulate production delay
        }
        $channel->close(); // Signal: no more data
        echo "[Producer] Done, channel closed.\n";
    });
    
    // Consumer coroutine
    go(function () use ($channel) {
        while (true) {
            $data = $channel->pop(1.0); // 1s timeout
            if ($data === false) {
                if ($channel->isEmpty()) {
                    echo "[Consumer] Channel empty and closed, exiting.\n";
                    break;
                }
                echo "[Consumer] Pop timeout, retrying...\n";
                continue;
            }
            echo "[Consumer] Processed item {$data['id']}, queue remaining: {$channel->length()}\n";
            Coroutine::sleep(0.05); // Simulate processing delay
        }
    });
});
```

### 示例 2：扇出模式（任务分发）

```php
<?php
// 013_fan_out.php
// Fan-out: distribute tasks to multiple workers

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $taskChannel = new Channel(100);
    $resultChannel = new Channel(100);
    $workerCount = 3;
    $taskCount = 15;
    
    // Start worker pool
    for ($w = 0; $w < $workerCount; $w++) {
        go(function () use ($w, $taskChannel, $resultChannel) {
            while (true) {
                $task = $taskChannel->pop(5.0);
                if ($task === false) break; // Channel closed or timeout
                
                echo "[Worker-{$w}] Processing task {$task['id']}\n";
                Coroutine::sleep(rand(1, 3) * 0.01); // Simulate work
                
                $resultChannel->push([
                    'task_id' => $task['id'],
                    'worker' => $w,
                    'result' => $task['value'] * 2,
                ]);
            }
            echo "[Worker-{$w}] Exiting\n";
        });
    }
    
    // Producer: send tasks
    go(function () use ($taskChannel, $taskCount) {
        for ($i = 0; $i < $taskCount; $i++) {
            $taskChannel->push(['id' => $i, 'value' => rand(1, 100)]);
        }
        $taskChannel->close(); // Signal workers to stop
        echo "[Producer] All tasks dispatched\n";
    });
    
    // Collector: gather results
    for ($i = 0; $i < $taskCount; $i++) {
        $result = $resultChannel->pop();
        echo "[Result] Task {$result['task_id']} → {$result['result']} (by Worker-{$result['worker']})\n";
    }
    
    echo "\nAll tasks completed!\n";
});
```

### 示例 3：Channel 实现信号量

```php
<?php
// 013_semaphore.php
// Using Channel as a semaphore for concurrency control

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $maxConcurrent = 3;
    $sem = new Channel($maxConcurrent);
    for ($i = 0; $i < $maxConcurrent; $i++) $sem->push(true);
    
    $done = new Channel(1);
    $total = 10;
    $completed = 0;
    
    for ($i = 0; $i < $total; $i++) {
        go(function () use ($i, $sem, $done, &$completed, $total) {
            $sem->pop(); // Acquire semaphore
            echo "[Task {$i}] Started (" . ($maxConcurrent - $sem->length()) . " running)\n";
            
            Coroutine::sleep(rand(1, 5) * 0.1);
            
            echo "[Task {$i}] Done\n";
            $sem->push(true); // Release semaphore
            
            $completed++;
            if ($completed === $total) {
                $done->push(true);
            }
        });
    }
    
    $done->pop(); // Wait for all
    echo "\nAll {$total} tasks finished!\n";
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 013_producer_consumer.php
[Producer] Pushed item 0, queue length: 1
[Consumer] Processed item 0, queue remaining: 0
[Producer] Pushed item 1, queue length: 1
[Producer] Pushed item 2, queue length: 2
[Consumer] Processed item 1, queue remaining: 1
[Producer] Pushed item 3, queue length: 2
...
[Producer] Done, channel closed.
[Consumer] Channel empty and closed, exiting.
```

### 示例 3 输出（并发控制）

```
$ php 013_semaphore.php
[Task 0] Started (3 running)
[Task 1] Started (3 running)
[Task 2] Started (3 running)
[Task 2] Done
[Task 3] Started (3 running)
[Task 0] Done
[Task 4] Started (3 running)
...
All 10 tasks finished!
```

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| Channel 不是全局的 | 每个进程有自己的 Channel 实例，多进程不共享 | 🔴 严重 |
| push/pop 超时注意 | 超时返回 false，需区分超时和 close | 🟡 中等 |
| 大容量 Channel 占内存 | Channel 存储的是数据副本，容量大则内存高 | 🟡 中等 |
| close 后不可再 push | close 后 push 返回 false | 🟢 一般 |
| 循环引用内存泄漏 | Channel 中的数据如果互相引用，可能导致泄漏 | 🟡 中等 |

---

## 避坑指南

### ❌ 不设超时导致永久阻塞
```php
// WRONG: If producer crashes, consumer blocks forever
$data = $channel->pop(); // No timeout!
```

### ✅ 设置合理超时
```php
// CORRECT: With timeout protection
$data = $channel->pop(5.0); // 5 second timeout
if ($data === false && $channel->isEmpty()) {
    echo "Channel closed or timed out\n";
}
```

---

### ❌ 多进程共享 Channel
```php
// WRONG: Channel is process-local, not shared across workers
$chan = new Channel(10);
// Worker 0 and Worker 1 each have their own $chan instance!
```

### ✅ 多进程用 Table 或外部存储
```php
// CORRECT: Use Swoole Table for cross-process data
$table = new Swoole\Table(1024);
$table->column('value', Swoole\Table::TYPE_STRING, 64);
$table->create();
// Now all workers share the same table
```

---

### ❌ Channel 中存储大对象
```php
// WRONG: Each push copies the entire data
$bigData = str_repeat('x', 1024 * 1024); // 1MB
$channel->push($bigData); // Memory doubles!
```

### ✅ 传递轻量引用或 ID
```php
// CORRECT: Pass identifiers, not full data
$channel->push(['id' => $documentId]);
// Workers fetch full data from DB/cache by ID
```

---

## 练习题

### 🟢 初级
1. 创建一个容量为 3 的 Channel，用 2 个协程分别 push 和 pop 5 个数字
2. 观察容量为 1 vs 容量为 10 的 Channel 在高并发 push 时的行为差异

### 🟡 中级
3. 用 Channel 实现一个简单的消息广播器：一个发送者，N 个接收者都收到同一消息
4. 实现一个带优先级的任务队列（提示：用两个 Channel 模拟高低优先级）

### 🔴 高级
5. 实现一个协程版的连接池：固定数量的连接，多个协程通过 Channel 获取和归还

<details>
<summary>参考答案（题5 - 连接池）</summary>

```php
<?php
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class ConnectionPool {
    private Channel $pool;
    
    public function __construct(int $size, callable $factory) {
        $this->pool = new Channel($size);
        for ($i = 0; $i < $size; $i++) {
            $this->pool->push($factory($i));
        }
    }
    
    public function get(float $timeout = 5.0) {
        return $this->pool->pop($timeout);
    }
    
    public function put($conn): void {
        $this->pool->push($conn);
    }
}

run(function () {
    $pool = new ConnectionPool(3, fn($i) => "connection-{$i}");
    
    for ($i = 0; $i < 10; $i++) {
        go(function () use ($i, $pool) {
            $conn = $pool->get();
            echo "[Task {$i}] Using {$conn}\n";
            Coroutine::sleep(rand(1, 3) * 0.1);
            echo "[Task {$i}] Returning {$conn}\n";
            $pool->put($conn);
        });
    }
    
    Coroutine::sleep(2);
});
```

</details>

---

## 知识点总结（树状）

```
Swoole Channel
├── 基础概念
│   ├── 协程安全队列
│   ├── 有缓冲 FIFO
│   └── 阻塞式通信
├── 核心 API
│   ├── push(data, timeout)
│   ├── pop(timeout)
│   ├── close()
│   └── stats() / length() / isEmpty()
├── 设计模式
│   ├── 生产者-消费者
│   ├── 扇出（任务分发）
│   ├── 扇入（结果收集）
│   ├── 信号量（并发控制）
│   └── 连接池
└── 注意事项
    ├── 进程内有效
    ├── 超时保护
    ├── 及时 close
    └── 轻量数据传递
```

---

## 举一反三

| 场景 | Channel 配置 | 替代方案 |
|------|-------------|----------|
| HTTP 请求并发 | Channel(results, N) | WaitGroup |
| 数据库连接池 | Channel(pool, maxSize) | 单例+锁 |
| 消息队列 | Channel(buffer, 100) | Redis Queue |
| 速率限制 | Channel(semaphore, rate) | Token Bucket |
| 事件广播 | N个Channel，每消费者一个 | Table + 轮询 |

---

## 参考资料

- [Swoole Channel 官方文档](https://wiki.swoole.com/#/coroutine/channel)
- [Go Channel 设计哲学](https://go.dev/doc/effective_go#channels)
- [ CSP 并发模型](https://en.wikipedia.org/wiki/Communicating_sequential_processes)
- [Swoole 协程间通信](https://wiki.swoole.com/#/coroutine/communication)

---

## 代码演进

### v1：基础 push/pop
```php
<?php
// v1: Basic channel push and pop
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $chan = new Channel(1);
    go(fn() => $chan->push('hello'));
    go(function () use ($chan) {
        echo $chan->pop(); // "hello"
    });
});
```

### v2：生产者-消费者
```php
<?php
// v2: Producer-consumer with graceful shutdown
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $chan = new Channel(10);
    
    go(function () use ($chan) {
        for ($i = 0; $i < 50; $i++) {
            $chan->push($i);
        }
        $chan->close();
    });
    
    go(function () use ($chan) {
        while ($data = $chan->pop()) {
            echo "Processed: {$data}\n";
        }
    });
});
```

### v3：生产级任务分发系统
```php
<?php
// v3: Production task dispatcher with error handling and monitoring
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $taskQueue = new Channel(500);
    $resultQueue = new Channel(500);
    $errorQueue = new Channel(50);
    $workers = 5;
    $tasks = 100;
    
    // Start workers
    for ($w = 0; $w < $workers; $w++) {
        go(function () use ($w, $taskQueue, $resultQueue, $errorQueue) {
            while ($task = $taskQueue->pop(10.0)) {
                try {
                    // Simulate work with potential failure
                    if (rand(1, 10) === 1) {
                        throw new \RuntimeException("Random failure on task {$task['id']}");
                    }
                    Coroutine::sleep(rand(1, 10) / 1000);
                    $resultQueue->push([
                        'task_id' => $task['id'],
                        'worker' => $w,
                        'result' => strtoupper($task['data']),
                        'time' => microtime(true),
                    ]);
                } catch (\Throwable $e) {
                    $errorQueue->push(['task_id' => $task['id'], 'error' => $e->getMessage()]);
                }
            }
        });
    }
    
    // Dispatch tasks
    go(function () use ($taskQueue, $tasks) {
        for ($i = 0; $i < $tasks; $i++) {
            $taskQueue->push(['id' => $i, 'data' => "task-data-{$i}"]);
        }
        $taskQueue->close();
    });
    
    // Collect results
    $successCount = 0;
    $errorCount = 0;
    for ($i = 0; $i < $tasks; $i++) {
        $result = $resultQueue->pop(5.0);
        if ($result) $successCount++;
    }
    
    // Drain errors
    while (!$errorQueue->isEmpty()) {
        $error = $errorQueue->pop(0.01);
        $errorCount++;
        echo "ERROR: {$error['error']}\n";
    }
    
    echo "\nResults: {$successCount} success, {$errorCount} errors\n";
});
```

**演进思路：**
- v1 → 理解基本 push/pop
- v2 → 理解生产者-消费者 + close 机制
- v3 → 生产级任务系统：多 Worker、错误处理、结果收集
