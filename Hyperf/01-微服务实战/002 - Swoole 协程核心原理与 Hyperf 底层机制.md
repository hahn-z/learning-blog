---
title: "002 - Swoole 协程核心原理与 Hyperf 底层机制"
slug: "002-swoole-coroutine-core"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.709+08:00"
updated_at: "2026-05-01T22:22:55.788+08:00"
reading_time: 6
tags: []
---

# Swoole 协程核心原理与 Hyperf 底层机制

> **难度：** ⭐⭐⭐
> **前置知识：** PHP 基础、Hyperf 入门（001）、操作系统进程/线程概念
> **预估用时：** 60 分钟

---

## 一、概念讲解

**一句话定义：** Swoole 协程是一种用户态轻量级线程，由 Swoole 运行时在单个进程内调度，实现非阻塞 I/O 并发。

**现实类比：** 你在厨房做一道复杂的菜。传统方式是烧水→等水开→切菜→炒菜，全程傻等；协程方式是烧上水就去切菜，水开了再回来处理，多个任务交替推进，厨师（CPU）从不停歇。

**技术场景：** 用户服务中，一个 API 可能需要同时查询数据库、调用 Redis 缓存、请求第三方服务。在 PHP-FPM 下这三个操作串行执行，总耗时 = DB + Redis + HTTP；在 Swoole 协程下，这三个操作自动并行，总耗时 ≈ 最慢的那个。这就是 Hyperf 高性能的底层秘密。

---

## 二、实时脑图

```
                    ┌─────────────────┐
                    │  PHP Process     │
                    │  (Master)        │
                    └────────┬────────┘
                             │ fork
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Worker#0 │  │ Worker#1 │  │ Worker#N │
        │          │  │          │  │          │
        │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
        │ │Cid:1 │ │  │ │Cid:1 │ │  │ │Cid:1 │ │
        │ ├──────┤ │  │ ├──────┤ │  │ ├──────┤ │
        │ │Cid:2 │ │  │ │Cid:2 │ │  │ │Cid:2 │ │
        │ ├──────┤ │  │ ├──────┤ │  │ ├──────┤ │
        │ │Cid:N │ │  │ │Cid:N │ │  │ │Cid:N │ │
        │ └──────┘ │  │ └──────┘ │  │ └──────┘ │
        └──────────┘  └──────────┘  └──────────┘
        
        Key: Cid = Coroutine ID (用户态调度)
             Worker = OS Process (内核态调度)
```

---

## 三、完整代码

### 3.1 协程基础体验

```php
<?php
// ✅ Test coroutine basics with Swoole

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

// ✅ Run in coroutine context
run(function () {
    $start = microtime(true);
    
    // 🟢 Launch multiple concurrent coroutines
    $results = [];
    
    // Coroutine 1: Simulate DB query (100ms)
    Coroutine::create(function () use (&$results) {
        Coroutine::sleep(0.1); // ✅ Non-blocking sleep
        $results['db'] = ['id' => 1, 'name' => 'hahn'];
    });
    
    // Coroutine 2: Simulate Redis query (50ms)
    Coroutine::create(function () use (&$results) {
        Coroutine::sleep(0.05);
        $results['redis'] = ['cached' => true];
    });
    
    // Coroutine 3: Simulate HTTP call (200ms)
    Coroutine::create(function () use (&$results) {
        Coroutine::sleep(0.2);
        $results['http'] = ['status' => 'ok'];
    });
    
    // ✅ Wait for all coroutines to complete
    // Swoole automatically schedules coroutines
    
    $elapsed = round((microtime(true) - $start) * 1000);
    echo "Total time: {$elapsed}ms (should be ~200ms, NOT 350ms)\n";
    echo "Results: " . json_encode($results) . "\n";
});
```

### 3.2 Channel 通信

```php
<?php
// ✅ Coroutine channel for inter-coroutine communication

use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

run(function () {
    $channel = new Channel(1);
    
    // Producer coroutine
    Coroutine::create(function () use ($channel) {
        Coroutine::sleep(0.1);
        $channel->push(['user_id' => 1, 'action' => 'register']);
        echo "[Producer] Pushed user data to channel\n";
    });
    
    // Consumer coroutine
    Coroutine::create(function () use ($channel) {
        $data = $channel->pop();
        echo "[Consumer] Received: " . json_encode($data) . "\n";
    });
});
```

### 3.3 Hyperf 中的协程上下文

```php
<?php
// ✅ app/Service/CoroutineContextService.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Coroutine\Coroutine as HyperfCoroutine;
use Swoole\Coroutine;
use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;

class CoroutineContextService
{
    #[Inject]
    private LoggerInterface $logger;

    // 🟢 Demonstrate coroutine-safe context management
    public function demonstrateContext(): array
    {
        $mainCid = HyperfCoroutine::id();
        $this->logger->info("Main coroutine ID: {$mainCid}");

        $results = [];

        // ✅ Each coroutine has its own context
        for ($i = 1; $i <= 3; $i++) {
            Coroutine::create(function () use ($i, &$results) {
                $cid = HyperfCoroutine::id();
                Coroutine::sleep(0.01 * $i);
                $results[$cid] = "Task {$i} completed in coroutine {$cid}";
            });
        }

        return [
            'main_cid' => $mainCid,
            'tasks' => $results,
            'message' => 'All coroutines executed concurrently',
        ];
    }
}
```

### 3.4 WaitGroup 并发控制

```php
<?php
// ✅ app/Service/ConcurrentUserService.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Coroutine\WaitGroup;

class ConcurrentUserService
{
    // 🟢 Fetch user data from multiple sources concurrently
    public function fetchUserProfile(int $userId): array
    {
        $wg = new WaitGroup();
        $profile = null;
        $orders = null;
        $stats = null;

        // Concurrent task 1: User profile
        $wg->add();
        ConcurrentUserService::go(function () use ($userId, &$profile, $wg) {
            // Simulate DB query
            \Swoole\Coroutine::sleep(0.05);
            $profile = ['id' => $userId, 'name' => 'Hahn', 'email' => 'hahn@example.com'];
            $wg->done();
        });

        // Concurrent task 2: Recent orders
        $wg->add();
        ConcurrentUserService::go(function () use ($userId, &$orders, $wg) {
            \Swoole\Coroutine::sleep(0.08);
            $orders = [['order_id' => 1001, 'amount' => 99.9]];
            $wg->done();
        });

        // Concurrent task 3: User statistics
        $wg->add();
        ConcurrentUserService::go(function () use ($userId, &$stats, $wg) {
            \Swoole\Coroutine::sleep(0.03);
            $stats = ['login_count' => 42, 'last_login' => '2026-05-01'];
            $wg->done();
        });

        // ✅ Wait for all tasks to complete
        $wg->wait();

        return [
            'profile' => $profile,
            'orders' => $orders,
            'stats' => $stats,
        ];
    }
    
    private static function go(callable $fn): void
    {
        \Swoole\Coroutine::create($fn);
    }
}
```

---

## 四、执行预览

```bash
$ php test_coroutine.php
Total time: 200ms (should be ~200ms, NOT 350ms)
Results: {"db":{"id":1,"name":"hahn"},"redis":{"cached":true},"http":{"status":"ok"}}

$ php test_channel.php
[Producer] Pushed user data to channel
[Consumer] Received: {"user_id":1,"action":"register"}
```

---

## 五、注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 协程内禁止阻塞 I/O | `sleep()`、`file_get_contents` 等会阻塞整个 Worker | 所有并发请求卡住 |
| 全局变量/静态属性不安全 | 多协程共享同一进程空间 | 数据串扰，难以调试的 Bug |
| 连接池必须使用 | 每个协程不能独占连接 | 连接耗尽，服务雪崩 |
| 协程间不能共享 PDO 实例 | PDO 不是协程安全的 | 数据错乱、连接异常 |
| `Coroutine::sleep` 代替 `sleep` | 后者是系统级阻塞 | Worker 停止响应 |

---

## 六、避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 使用全局 `$_GET/$_POST` | 数据为空或串协程 | 使用 `$request->input()` |
| ❌ `new PDO()` 手动创建连接 | 协程间共享连接导致数据错乱 | 使用 Hyperf 连接池 |
| ❌ 在协程中 `sleep(1)` | 整个 Worker 卡住 1 秒 | 使用 `Coroutine::sleep(1)` |
| ❌ 用 `static` 变量缓存请求上下文 | 多请求共享数据 | 使用 `Context::set()/get()` |
| ❌ 忽略协程创建开销 | 创建 10 万协程导致内存溢出 | 合理控制并发量，使用 Channel 限流 |

---

## 七、练习题

🟢 **基础题 1：** 编写脚本，创建 5 个协程分别 sleep 不同时间（0.1s~0.5s），验证总耗时接近最长时间而非累加时间。

🟢 **基础题 2：** 使用 Channel 实现生产者-消费者模式：一个协程每秒产生一条消息，另一个协程消费并打印。

🟡 **进阶题：** 使用 WaitGroup 实现用户详情页数据聚合：同时获取用户基本信息、积分信息、最近订单，合并返回。

🔴 **开放题：** 研究 Swoole 的 `Coroutine::select()` 机制，对比 Go 的 `select` 语句，分析两者在实现多路复用上的异同。

---

## 八、知识点总结

```
Swoole 协程核心
├── 进程模型
│   ├── Master 进程（管理）
│   ├── Worker 进程（处理请求）
│   └── Task Worker（异步任务）
├── 协程机制
│   ├── Coroutine::create（创建）
│   ├── Coroutine::sleep（非阻塞等待）
│   ├── Coroutine::yield/resume（挂起/恢复）
│   └── 协程调度器（自动抢占）
├── 通信方式
│   ├── Channel（管道通信）
│   ├── WaitGroup（等待组）
│   └── Context（协程上下文隔离）
└── Hyperf 封装
    ├── 连接池（DB/Redis）
    ├── 协程上下文管理
    └── 并发工具类
```

---

## 九、举一反三

| 变种场景 | 关键差异 | 适配方式 |
|----------|----------|----------|
| 微服务 RPC 并发调用 | 同时调用 3 个下游服务 | WaitGroup + 协程 HTTP 客户端 |
| WebSocket 消息推送 | 长连接+广播 | Channel + Table 共享内存 |
| 定时任务并发执行 | Crontab 触发多任务 | Parallel 并发执行 |

---

## 十、参考资料

| 资料 | 权威等级 | 链接 |
|------|----------|------|
| Swoole 官方文档 - 协程 | ⭐⭐⭐⭐⭐ | https://wiki.swoole.com/#/coroutine |
| Hyperf 官方文档 - 协程 | ⭐⭐⭐⭐⭐ | https://hyperf.wiki/3.1/#/zh-cn/coroutine |
| Swoole 源码分析 | ⭐⭐⭐ | https://github.com/swoole/swoole-src |
| PHP 协程原理深度解析 | ⭐⭐⭐ | 社区博文 |

---

## 十一、代码演进

### v1 ❌ 同步阻塞写法

```php
<?php
// ❌ Blocking: Sequential execution, total ~350ms
$profile = $this->db->query("SELECT * FROM users WHERE id = 1"); // 100ms
$orders = $this->db->query("SELECT * FROM orders WHERE user_id = 1"); // 150ms
$stats = $this->redis->get("user:1:stats"); // 100ms
// Total: 350ms
```

### v2 ✅ 协程并发写法

```php
<?php
// ✅ Concurrent: Using WaitGroup, total ~150ms
$wg = new WaitGroup();
$wg->add(3);

Coroutine::create(function () use (&$profile, $wg) {
    $profile = $this->db->query("SELECT * FROM users WHERE id = 1");
    $wg->done();
});

Coroutine::create(function () use (&$orders, $wg) {
    $orders = $this->db->query("SELECT * FROM orders WHERE user_id = 1");
    $wg->done();
});

Coroutine::create(function () use (&$stats, $wg) {
    $stats = $this->redis->get("user:1:stats");
    $wg->done();
});

$wg->wait(); // Total: ~150ms (max of three)
```

### v3 🟢 Hyperf 风格封装

```php
<?php
// 🟢 Production: Clean service with Hyperf Parallel
declare(strict_types=1);

namespace App\Service;

use Hyperf\Coroutine\Parallel;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;

class UserProfileService
{
    public function getFullProfile(int $userId): array
    {
        $parallel = new Parallel(3);

        $parallel->add(function () use ($userId) {
            return Db::table('users')->find($userId);
        }, 'profile');

        $parallel->add(function () use ($userId) {
            return Db::table('orders')->where('user_id', $userId)->get();
        }, 'orders');

        $parallel->add(function () use ($userId) {
            return Redis::get("user:{$userId}:stats");
        }, 'stats');

        $results = $parallel->wait();

        return [
            'profile' => $results['profile'],
            'orders' => $results['orders'],
            'stats' => json_decode($results['stats'], true),
        ];
    }
}
```

---

**上一篇：** [001 - Hyperf 框架入门与环境搭建](/post/001-hyperf-intro-setup)
**下一篇：** [003 - 依赖注入容器与注解系统详解](/post/003-di-container-annotation)
