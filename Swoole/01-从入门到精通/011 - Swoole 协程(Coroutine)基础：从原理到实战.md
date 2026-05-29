---
title: "011 - Swoole 协程(Coroutine)基础：从原理到实战"
slug: "011-coroutine-basics"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:02:17.657+08:00"
updated_at: "2026-04-29T10:02:46.957+08:00"
reading_time: 25
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐☆☆☆ 中级入门

**前置知识：** PHP 基础、同步/异步概念、基础网络编程
**预计学习时间：** 45 分钟

---

## 概念讲解

### 什么是协程？

协程（Coroutine）是一种**用户态的轻量级线程**。与操作系统内核调度的线程不同，协程由程序自身控制调度，切换开销极小。

**类比理解：**
- **进程** = 一个工厂（独立内存空间，创建成本高）
- **线程** = 一条流水线（共享工厂资源，操作系统调度）
- **协程** = 流水线上的工人协作（共享流水线资源，程序自行调度）

### Swoole 协程的核心优势

| 特性 | 传统 PHP-FPM | Swoole 协程 |
|------|-------------|-------------|
| 并发模型 | 多进程阻塞 | 单线程协程 |
| 单进程并发量 | ~100 | ~100,000+ |
| 上下文切换成本 | ~1-10μs | ~0.3μs |
| 内存占用 | ~数MB/进程 | ~数KB/协程 |
| 代码复杂度 | 简单（同步写法） | 简单（同步写法+协程） |

### 协程生命周期

```
创建(crear) → 运行(running) → 挂起(suspended) → 恢复(resume) → 结束(dead)
```

1. **创建**：调用 `Swoole\Coroutine\run()` 或 `go()` 创建协程
2. **运行**：协程获得 CPU 时间片，执行代码
3. **挂起**：遇到 I/O 操作（MySQL查询、HTTP请求等），自动让出 CPU
4. **恢复**：I/O 完成后，调度器恢复协程继续执行
5. **结束**：协程函数执行完毕，自动回收资源

---

## 脑图（ASCII）

```
Swoole 协程基础
├── 核心概念
│   ├── 用户态轻量级线程
│   ├── 协作式调度（非抢占式）
│   └── 同步编码，异步执行
├── 基础 API
│   ├── go() / Coroutine::create()
│   ├── Coroutine::run()
│   ├── Coroutine::sleep()
│   ├── Coroutine::yield() / resume()
│   └── Coroutine::getCid()
├── 协程调度
│   ├── 事件驱动 (EventLoop)
│   ├── I/O 自动挂起/恢复
│   └── 协程切换时机
├── 协程上下文
│   ├── CID（协程ID）
│   ├── 协程栈
│   └── 协程局部存储
└── 实战应用
    ├── 并发 HTTP 请求
    ├── 并发数据库查询
    └── 协程间通信（Channel）
```

---

## 完整代码示例

### 示例 1：协程基本创建与执行

```php
<?php
// 011_coroutine_basics.php
// Basic coroutine creation and execution

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

// Method 1: Using run() as entry point
run(function () {
    echo "[Main] Start\n";
    
    // Get current coroutine ID
    $cid = Coroutine::getCid();
    echo "[Main] CID = {$cid}\n";
    
    // Create child coroutines using go()
    go(function () {
        $cid = Coroutine::getCid();
        echo "[Coroutine-1] Started, CID = {$cid}\n";
        Coroutine::sleep(0.1); // Non-blocking sleep
        echo "[Coroutine-1] Finished\n";
    });
    
    go(function () {
        $cid = Coroutine::getCid();
        echo "[Coroutine-2] Started, CID = {$cid}\n";
        Coroutine::sleep(0.05);
        echo "[Coroutine-2] Finished\n";
    });
    
    echo "[Main] All coroutines launched\n";
});

echo "[Outside] Program ended\n";
```

### 示例 2：协程并发 HTTP 请求

```php
<?php
// 011_concurrent_requests.php
// Concurrent HTTP requests using coroutines

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    $urls = [
        'https://httpbin.org/get?id=1',
        'https://httpbin.org/get?id=2',
        'https://httpbin.org/get?id=3',
    ];
    
    $results = [];
    $startTime = microtime(true);
    
    foreach ($urls as $i => $url) {
        go(function () use ($url, $i, &$results) {
            $client = new Coroutine\Http\Client('httpbin.org', 443, true);
            $client->get('/get?id=' . ($i + 1));
            $results[$i] = $client->body;
            $client->close();
            echo "[Coroutine] Request {$i} completed\n";
        });
    }
    
    // Wait for all coroutines to finish
    Coroutine::sleep(3);
    
    $elapsed = round(microtime(true) - $startTime, 3);
    echo "\n=== Results ===\n";
    echo "Total time: {$elapsed}s\n";
    echo "Completed requests: " . count($results) . "\n";
});
```

### 示例 3：协程调度顺序验证

```php
<?php
// 011_schedule_order.php
// Understanding coroutine scheduling order

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    echo "Step 1: Main coroutine start\n";
    
    go(function () {
        echo "Step 3: Coroutine A start\n";
        Coroutine::sleep(0.01);
        echo "Step 6: Coroutine A resumed\n";
    });
    
    echo "Step 2: After creating Coroutine A\n";
    
    go(function () {
        echo "Step 4: Coroutine B start\n";
        Coroutine::sleep(0.005);
        echo "Step 5: Coroutine B resumed\n";
    });
    
    echo "Step 7: Main coroutine continues\n";
    Coroutine::sleep(0.02); // Let all coroutines finish
    echo "Step 8: Main coroutine end\n";
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 011_coroutine_basics.php
[Main] Start
[Main] CID = 1
[Coroutine-1] Started, CID = 2
[Coroutine-2] Started, CID = 3
[Main] All coroutines launched
[Coroutine-2] Finished
[Coroutine-1] Finished
[Outside] Program ended
```

### 示例 3 输出（调度顺序）

```
$ php 011_schedule_order.php
Step 1: Main coroutine start
Step 3: Coroutine A start
Step 2: After creating Coroutine A
Step 4: Coroutine B start
Step 7: Main coroutine continues
Step 5: Coroutine B resumed
Step 6: Coroutine A resumed
Step 8: Main coroutine end
```

**关键观察：**
1. 协程创建后**立即开始执行**，不是等到当前协程结束
2. 遇到 I/O（`sleep`）时自动挂起，让其他协程运行
3. I/O 完成后按**完成顺序**恢复执行

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| 协程内禁止使用阻塞函数 | `sleep()`, `file_get_contents()` 等会阻塞整个进程 | 🔴 严重 |
| go() 必须在协程环境中调用 | 需要先有 `run()` 或 `Coroutine::create()` 创建环境 | 🟡 中等 |
| 协程间变量共享有风险 | 使用引用传参时需注意竞态条件 | 🟡 中等 |
| 协程数量上限 | 默认最大协程数受 `max_coro_num` 配置限制 | 🟢 一般 |
| 主协程退出 = 进程退出 | 主协程（CID=1）结束，所有子协程被销毁 | 🔴 严重 |

---

## 避坑指南

### ❌ 使用 PHP 原生 sleep
```php
// WRONG: Blocks the entire process
sleep(1); 
echo 'This blocks everything!';
```

### ✅ 使用协程专用 sleep
```php
// CORRECT: Non-blocking, yields to other coroutines
use Swoole\Coroutine;
Coroutine::sleep(1);
echo 'Other coroutines can run during this time!';
```

---

### ❌ 协程外直接调用 go()
```php
// WRONG: No coroutine context
go(function () {
    echo 'This will fail!';
});
```

### ✅ 先创建协程环境
```php
// CORRECT: Create runtime first
use function Swoole\Coroutine\run;
run(function () {
    go(function () {
        echo 'Works perfectly!';
    });
});
```

---

### ❌ 协程间直接共享可变状态
```php
// WRONG: Race condition
$counter = 0;
go(function () use (&$counter) {
    for ($i = 0; $i < 1000; $i++) $counter++;
});
go(function () use (&$counter) {
    for ($i = 0; $i < 1000; $i++) $counter++;
});
// $counter might not be 2000!
```

### ✅ 使用 Channel 或原子操作通信
```php
// CORRECT: Use Channel for communication
use Swoole\Coroutine\Channel;
$chan = new Channel(1);
go(function () use ($chan) {
    $chan->push(1000);
});
go(function () use ($chan) {
    $chan->push(1000);
});
```

---

## 练习题

### 🟢 初级

1. 创建 3 个协程，每个协程打印自己的 CID 和一条消息
2. 使用 `Coroutine::sleep()` 让 3 个协程按不同时间间隔输出，观察执行顺序

### 🟡 中级

3. 实现一个并发的 DNS 解析器：同时解析 5 个域名，收集所有结果后输出
4. 创建一个协程，在协程内使用 `Coroutine::yield()` 手动挂起，然后在另一个协程中使用 `Coroutine::resume()` 恢复它

### 🔴 高级

5. 实现一个简单的协程池：限制最多同时运行 N 个协程，多余的任务排队等待

<details>
<summary>参考答案（题5）</summary>

```php
<?php
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $poolSize = 3;
    $queue = new Channel($poolSize);
    $total = 10;
    $done = new Channel($total);
    
    // Fill the pool semaphore
    for ($i = 0; $i < $poolSize; $i++) {
        $queue->push(true);
    }
    
    for ($i = 0; $i < $total; $i++) {
        go(function () use ($i, $queue, $done) {
            $queue->pop(); // Wait for slot
            echo "Task {$i} started\n";
            Coroutine::sleep(rand(1, 3) * 0.1);
            echo "Task {$i} done\n";
            $queue->push(true); // Release slot
            $done->push($i);
        });
    }
    
    for ($i = 0; $i < $total; $i++) {
        $done->pop();
    }
    echo "All tasks completed!\n";
});
```

</details>

---

## 知识点总结（树状）

```
Swoole 协程基础
├── 什么是协程
│   ├── 用户态轻量级线程
│   ├── 协作式调度
│   └── 对比进程/线程
├── 核心 API
│   ├── run() — 创建协程运行环境
│   ├── go() — 创建新协程
│   ├── Coroutine::getCid() — 获取当前协程ID
│   ├── Coroutine::sleep() — 非阻塞休眠
│   └── Coroutine::yield()/resume() — 手动挂起/恢复
├── 调度机制
│   ├── 事件驱动 (EventLoop)
│   ├── I/O 触发自动挂起
│   └── I/O 完成自动恢复
└── 实战要点
    ├── 替换阻塞函数为协程版本
    ├── 协程间用 Channel 通信
    └── 主协程退出 = 进程退出
```

---

## 举一反三

| 场景 | 传统方式 | 协程方式 | 性能提升 |
|------|---------|---------|----------|
| 10个HTTP请求 | 串行 ~10s | 并发 ~1s | ~10x |
| 100个DB查询 | 连接池+串行 | 协程并发 | ~Nx |
| 文件读取 | file_get_contents阻塞 | Coroutine::readFile | 非阻塞 |
| 定时任务 | sleep循环 | Coroutine::sleep | 不阻塞其他协程 |
| 日志写入 | 直接写磁盘 | Channel+后台协程 | 异步化 |

---

## 参考资料

- [Swoole 官方文档 - 协程](https://wiki.swoole.com/#/coroutine)
- [Swoole Coroutine API](https://wiki.swoole.com/#/coroutine/coroutine)
- [PHP 协程原理详解](https://www.php.net/manual/zh/language.generators.overview.php)
- [Swoole 源码分析 - 协程调度](https://github.com/swoole/swoole-src)

---

## 代码演进

### v1: 最简协程（入门级）
```php
<?php
// v1: Simplest coroutine example
use function Swoole\Coroutine\run;
run(function () {
    echo "Hello Coroutine!\n";
});
```

### v2: 多协程并发（进阶级）
```php
<?php
// v2: Multiple coroutines with sleep
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    go(function () {
        Coroutine::sleep(0.1);
        echo "Task A done\n";
    });
    go(function () {
        Coroutine::sleep(0.05);
        echo "Task B done\n";
    });
});
```

### v3: 生产级协程并发（实战级）
```php
<?php
// v3: Production-ready concurrent requests with error handling
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $tasks = 10;
    $chan = new Channel($tasks);
    
    for ($i = 0; $i < $tasks; $i++) {
        go(function () use ($i, $chan) {
            try {
                $client = new Coroutine\Http\Client('httpbin.org', 443, true);
                $client->setHeaders(['User-Agent' => 'Swoole-Coroutine/1.0']);
                $client->get('/get?task=' . $i);
                
                $chan->push([
                    'task' => $i,
                    'status' => $client->statusCode,
                    'body' => $client->body,
                ]);
                $client->close();
            } catch (\Throwable $e) {
                $chan->push(['task' => $i, 'error' => $e->getMessage()]);
            }
        });
    }
    
    $results = [];
    for ($i = 0; $i < $tasks; $i++) {
        $results[] = $chan->pop();
    }
    
    // Sort by task number
    usort($results, fn($a, $b) => $a['task'] <=> $b['task']);
    
    foreach ($results as $r) {
        echo "Task {$r['task']}: " . ($r['error'] ?? 'status=' . $r['status']) . "\n";
    }
});
```

**演进思路：**
- v1 → 理解协程基本创建
- v2 → 理解并发执行和调度顺序
- v3 → 加入错误处理、结果收集、生产级可靠性
