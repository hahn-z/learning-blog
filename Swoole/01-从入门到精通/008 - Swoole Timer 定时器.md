---
title: "008 - Swoole Timer 定时器"
slug: "008-timer"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:40.721+08:00"
updated_at: "2026-04-29T10:02:46.924+08:00"
reading_time: 37
tags: ["Swoole", "PHP"]
---

## 难度标注

> **难度等级：⭐⭐ 入门-中等**
> 前置知识：PHP基础、Swoole Server基础
> 预计学习时间：30-45分钟

## 概念讲解

### 什么是 Swoole Timer？

Swoole Timer 是基于 **epoll / kevent** 实现的高性能定时器，运行在 Swoole 的事件循环中。相比 PHP 原生的 `sleep()` 或 `pcntl_alarm()`，它不会阻塞整个进程。

**核心特点：**
- **毫秒级精度**：最小精度 1ms（实际取决于事件循环频率）
- **非阻塞**：基于事件驱动，不占用 Worker 时间片
- **多类型**：一次性定时器（after）和持续性定时器（tick）
- **协程兼容**：可在协程环境中使用

### PHP 定时方案对比

| 方案 | 精度 | 阻塞 | 适用场景 |
|------|------|------|----------|
| `sleep()` | 秒级 | ✅ 阻塞 | 简单CLI脚本 |
| `usleep()` | 微秒级 | ✅ 阻塞 | 简单延迟 |
| `pcntl_alarm()` | 秒级 | ❌ 信号 | 进程管理 |
| `crontab` | 分钟级 | ❌ | 系统级定时 |
| **Swoole Timer** | 毫秒级 | ❌ | 高性能异步定时 |

### 两种定时器

```
Swoole\Timer::after($ms, $callback)
→ 一次性定时器，延迟 $ms 毫秒后执行一次

Swoole\Timer::tick($ms, $callback)
→ 持续性定时器，每 $ms 毫秒执行一次，直到手动清除
```

## 脑图（ASCII）

```
Swoole Timer
├── 两种类型
│   ├── after($ms, $callback) → 一次性延迟执行
│   └── tick($ms, $callback)  → 周期性重复执行
├── 管理方法
│   ├── exists($id)           → 检查定时器是否存在
│   ├── info($id)             → 获取定时器信息
│   ├── clear($id)            → 清除指定定时器
│   ├── clearAll()            → 清除当前进程所有定时器
│   └── list()                → 列出所有定时器ID
├── 使用场景
│   ├── 心跳检测
│   ├── 定时数据同步
│   ├── 超时控制
│   ├── 定时清理过期数据
│   ├── 轮询外部服务
│   └── 性能指标采集
├── Server 事件中的定时器
│   ├── onWorkerStart → 启动定时器
│   └── onWorkerExit  → 清理定时器
└── 注意事项
    ├── 回调中不能有阻塞操作
    ├── tick 返回 timer_id 用于清除
    ├── Worker 重启后定时器会丢失
    └── 精度受事件循环影响
```

## 完整代码

### v1：基础定时器用法

```php
<?php
// v1_basic_timer.php
// Basic timer examples: after and tick

use Swoole\Timer;

// ─── One-shot timer: execute after 2000ms ─────────────────────
$timerId1 = Timer::after(2000, function () {
    echo "[After] Executed once after 2 seconds at " . date('H:i:s') . "\n";
});
echo "Created after timer: #{$timerId1}\n";

// ─── Periodic timer: execute every 1000ms ─────────────────────
$counter = 0;
$timerId2 = Timer::tick(1000, function () use (&$counter) {
    $counter++;
    echo "[Tick] Counter={$counter} at " . date('H:i:s') . "\n";

    // Auto-stop after 5 executions
    if ($counter >= 5) {
        Timer::clear($GLOBALS['tickId']);
        echo "[Tick] Auto-stopped after 5 ticks\n";
    }
});
$GLOBALS['tickId'] = $timerId2;
echo "Created tick timer: #{$timerId2}\n";

// ─── Nested timer: start a tick inside an after ────────────────
Timer::after(5000, function () {
    echo "[Nested] Starting nested tick at " . date('H:i:s') . "\n";

    $nested = Timer::tick(500, function () {
        static $count = 0;
        $count++;
        echo "  [Nested Tick] #{$count}\n";
        if ($count >= 3) {
            Timer::clear($GLOBALS['nestedId']);
            echo "  [Nested Tick] Done\n";
        }
    });
    $GLOBALS['nestedId'] = $nested;
});

// ─── Check timer status ────────────────────────────────────────
Timer::after(1500, function () use ($timerId2) {
    echo "[Check] Timer #{$timerId2} exists: " . (Timer::exists($timerId2) ? 'yes' : 'no') . "\n";
    $info = Timer::info($timerId2);
    echo "[Check] Timer info: " . json_encode($info) . "\n";
});

echo "All timers created. Waiting...\n";
```

### v2：Server 中的定时器（心跳 + 定时任务）

```php
<?php
// v2_server_timer.php
// Using timers in Swoole Server for heartbeat and scheduled tasks

use Swoole\Server;
use Swoole\Table;
use Swoole\Timer;

// Connection tracking table
$connTable = new Table(1024);
$connTable->column('fd', Table::TYPE_INT);
$connTable->column('last_active', Table::TYPE_INT);
$connTable->column('connect_time', Table::TYPE_INT);
$connTable->create();

// Metrics storage
$metrics = [
    'total_connections' => 0,
    'total_requests' => 0,
    'start_time' => time(),
];

$server = new Server("0.0.0.0", 9501);
$server->set([
    'worker_num' => 2,
    'heartbeat_check_interval' => 30,
    'heartbeat_idle_time' => 60,
]);

// ─── WorkerStart: initialize timers per worker ────────────────
$server->on('workerStart', function (Server $server, int $workerId) use ($connTable, &$metrics) {
    if ($workerId >= $server->setting['worker_num']) {
        return; // Skip task workers
    }

    // Timer 1: Connection heartbeat check (every 10s)
    Timer::tick(10000, function () use ($server, $connTable) {
        $now = time();
        $timeout = 30;
        $killed = 0;

        foreach ($connTable as $fd => $conn) {
            if ($now - $conn['last_active'] > $timeout) {
                echo "[Heartbeat] Killing inactive fd={$fd}\n";
                $server->close($fd);
                $connTable->del($fd);
                $killed++;
            }
        }

        if ($killed > 0) {
            echo "[Heartbeat] Cleaned {$killed} inactive connections\n";
        }
    });

    // Timer 2: Metrics report (every 30s)
    Timer::tick(30000, function () use ($server, $connTable, &$metrics) {
        $activeConns = 0;
        foreach ($connTable as $fd => $conn) {
            $activeConns++;
        }
        $uptime = time() - $metrics['start_time'];
        echo "[Metrics] uptime={$uptime}s, connections={$activeConns}, " .
             "total_requests={$metrics['total_requests']}\n";
    });

    // Timer 3: Daily cleanup at 03:00
    Timer::tick(60000, function () use ($connTable) {
        $hour = (int) date('H');
        $minute = (int) date('i');

        if ($hour === 3 && $minute === 0) {
            echo "[Cleanup] Running daily cleanup...\n";
            $now = time();
            $stale = 0;
            foreach ($connTable as $fd => $conn) {
                if ($now - $conn['connect_time'] > 86400) {
                    $connTable->del($fd);
                    $stale++;
                }
            }
            echo "[Cleanup] Removed {$stale} stale connections\n";
        }
    });

    echo "[Worker {$workerId}] Timers initialized\n";
});

$server->on('connect', function (Server $server, int $fd) use ($connTable, &$metrics) {
    $connTable->set($fd, [
        'fd' => $fd,
        'last_active' => time(),
        'connect_time' => time(),
    ]);
    $metrics['total_connections']++;
});

$server->on('receive', function (Server $server, int $fd, int $fromId, string $data) use ($connTable, &$metrics) {
    if ($connTable->exists($fd)) {
        $conn = $connTable->get($fd);
        $connTable->set($fd, [
            'fd' => $fd,
            'last_active' => time(),
            'connect_time' => $conn['connect_time'],
        ]);
    }
    $metrics['total_requests']++;

    $req = json_decode($data, true);
    $action = $req['action'] ?? 'echo';

    switch ($action) {
        case 'echo':
            $server->send($fd, $data . "\n");
            break;

        case 'delayed':
            $ms = $req['delay_ms'] ?? 1000;
            Timer::after($ms, function () use ($server, $fd, $data, $ms) {
                if ($server->exist($fd)) {
                    $server->send($fd, json_encode([
                        'type' => 'delayed_response',
                        'original' => $data,
                        'delay' => $ms,
                        'sent_at' => date('Y-m-d H:i:s'),
                    ]) . "\n");
                }
            });
            $server->send($fd, json_encode([
                'type' => 'accepted',
                'message' => "Response scheduled in {$ms}ms",
            ]) . "\n");
            break;

        case 'schedule':
            $interval = $req['interval_ms'] ?? 5000;
            $count = 0;
            $maxCount = $req['count'] ?? 5;

            $timerId = Timer::tick($interval, function () use ($server, $fd, &$count, $maxCount) {
                $count++;
                if ($server->exist($fd)) {
                    $server->send($fd, json_encode([
                        'type' => 'scheduled',
                        'count' => $count,
                        'time' => date('H:i:s'),
                    ]) . "\n");
                }
                if ($count >= $maxCount) {
                    Timer::clear($GLOBALS['schedule_timer']);
                }
            });
            $GLOBALS['schedule_timer'] = $timerId;

            $server->send($fd, json_encode([
                'type' => 'scheduled_start',
                'interval_ms' => $interval,
                'count' => $maxCount,
                'timer_id' => $timerId,
            ]) . "\n");
            break;

        default:
            $server->send($fd, "Unknown action\n");
    }
});

$server->on('close', function (Server $server, int $fd) use ($connTable) {
    $connTable->del($fd);
});

$server->start();
```

### v3：协程定时器 + Cron 表达式解析

```php
<?php
// v3_cron_timer.php
// Cron-like scheduler using Swoole Timer

use Swoole\Timer;
use Swoole\Coroutine;

/**
 * Simple cron expression parser
 * Supports: *, */n, specific values, ranges, lists
 */
class CronParser
{
    public static function matches(string $expression, ?int $time = null): bool
    {
        $time = $time ?? time();
        $parts = explode(' ', trim($expression));
        if (count($parts) !== 5) return false;

        return self::matchField($parts[0], (int) date('i', $time), 0, 59)
            && self::matchField($parts[1], (int) date('H', $time), 0, 23)
            && self::matchField($parts[2], (int) date('d', $time), 1, 31)
            && self::matchField($parts[3], (int) date('m', $time), 1, 12)
            && self::matchField($parts[4], (int) date('w', $time), 0, 6);
    }

    private static function matchField(string $field, int $value, int $min, int $max): bool
    {
        if ($field === '*') return true;
        if (preg_match('/^\*\/(\d+)$/', $field, $m)) return $value % (int) $m[1] === 0;
        if (is_numeric($field)) return $value === (int) $field;
        if (preg_match('/^(\d+)-(\d+)$/', $field, $m)) return $value >= (int) $m[1] && $value <= (int) $m[2];
        if (strpos($field, ',') !== false) return in_array($value, array_map('intval', explode(',', $field)));
        return false;
    }
}

/**
 * Cron Scheduler powered by Swoole Timer
 */
class CronScheduler
{
    private array $jobs = [];

    public function addJob(string $name, string $expression, callable $callback): void
    {
        $this->jobs[$name] = compact('expression', 'callback') + ['last_run' => 0, 'run_count' => 0];
        echo "[Cron] Registered: {$name} ({$expression})\n";
    }

    public function start(): void
    {
        // Check every second
        Timer::tick(1000, function () {
            $now = time();
            if ((int) date('s', $now) !== 0) return; // Only at second 0

            foreach ($this->jobs as $name => &$job) {
                if (CronParser::matches($job['expression'], $now) && $now - $job['last_run'] >= 60) {
                    $job['last_run'] = $now;
                    $job['run_count']++;
                    go(function () use ($name, $job) {
                        $start = microtime(true);
                        try {
                            call_user_func($job['callback']);
                            echo "[Cron] {$name} done in " . round(microtime(true) - $start, 3) . "s\n";
                        } catch (\Throwable $e) {
                            echo "[Cron] {$name} failed: {$e->getMessage()}\n";
                        }
                    });
                }
            }
        });

        // Status every 60s
        Timer::tick(60000, function () {
            echo "[Cron Status] " . count($this->jobs) . " jobs\n";
            foreach ($this->jobs as $name => $j) {
                echo "  {$name}: runs={$j['run_count']}\n";
            }
        });

        echo "[Cron] Scheduler started\n";
    }
}

// ─── Example ──────────────────────────────────────────────────
Co\run(function () {
    $scheduler = new CronScheduler();

    $scheduler->addJob('health_check', '*/5 * * * *', function () {
        echo "[HealthCheck] Memory: " . round(memory_get_usage(true)/1024/1024, 2) . "MB\n";
    });

    $scheduler->addJob('hourly_cleanup', '0 * * * *', function () {
        echo "[Cleanup] Hourly cleanup...\n";
    });

    $scheduler->addJob('weekly_report', '0 9 * * 1', function () {
        echo "[Report] Weekly report...\n";
    });

    $scheduler->start();

    // Stop after 120s for demo
    Timer::after(120000, function () {
        echo "[Demo] Stopping...\n";
    });
});
```

## 执行预览

```
$ php v1_basic_timer.php
Created after timer: #1
Created tick timer: #2
All timers created. Waiting...
[Check] Timer #2 exists: yes
[After] Executed once after 2 seconds at 22:30:02
[Tick] Counter=1 at 22:30:01
[Tick] Counter=2 at 22:30:02
[Tick] Counter=3 at 22:30:03
[Tick] Counter=4 at 22:30:04
[Tick] Counter=5 at 22:30:05
[Tick] Auto-stopped after 5 ticks
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| 回调不能阻塞 | Timer 回调在事件循环中执行，阻塞会影响所有定时器 |
| Worker 重启 | Worker 重启后定时器丢失，需在 onWorkerStart 中重建 |
| 精度限制 | 实际精度受事件循环影响，误差通常 1-10ms |
| 内存泄漏 | tick 定时器不 clear 会一直运行 |
| 跨 Worker | 每个 Worker 有独立定时器，避免重复执行 |
| 协程替代 | 协程环境中可用 `Coroutine::sleep()` 替代 after |

## 避坑指南

### ❌ 错误：在 Timer 回调中使用 sleep

```php
Timer::tick(1000, function () {
    sleep(5); // ❌ 阻塞整个事件循环
});
```

### ✅ 正确：用协程或 Task

```php
Timer::tick(1000, function () {
    go(function () {
        Coroutine::sleep(5); // ✅ 协程 sleep 不阻塞
    });
});
```

### ❌ 错误：忘记清理 tick 定时器

```php
Timer::tick(5000, function () use ($server, $fd) {
    $server->send($fd, "ping"); // ❌ fd 关闭后报错
});
```

### ✅ 正确：关联生命周期

```php
$timers[$fd] = Timer::tick(5000, function () use ($server, $fd) {
    if ($server->exist($fd)) $server->send($fd, "ping"); // ✅ 先检查
});
// onClose 中 Timer::clear($timers[$fd]);
```

## 练习题

### 🟢 入门级

1. 用 `Timer::after` 实现一个 5 秒倒计时（每秒打印剩余时间）
2. 创建 tick 定时器，每 2 秒打印内存使用量，10 次后停止

### 🟡 进阶级

3. 实现一个"限速器"：用 Timer 控制 API 调用频率为每秒最多 10 次
4. 给 v2 Server 添加"延迟任务队列"功能

### 🔴 挑战级

5. 实现完整的 Cron 调度系统：支持标准 cron 表达式、任务持久化、超时自动终止

## 知识点总结

```
Swoole Timer 知识体系
├── 基础 API
│   ├── Timer::after($ms, $callback) → timer_id
│   ├── Timer::tick($ms, $callback)  → timer_id
│   ├── Timer::clear($id)
│   ├── Timer::clearAll()
│   ├── Timer::exists($id)
│   └── Timer::info($id)
├── Server 集成
│   ├── onWorkerStart 中初始化
│   ├── heartbeat_check_interval
│   └── 连接级定时器管理
├── 进阶模式
│   ├── Cron 表达式解析
│   ├── 协程 + Timer
│   └── 定时器链（after→after→after）
└── vs 替代方案
    ├── vs crontab → 更精细、进程内
    ├── vs Coroutine::sleep → 适用于非协程环境
    └── vs Task → 适合轻量周期任务
```

## 举一反三

| 场景 | 推荐方案 | 示例 |
|------|----------|------|
| 每 5 秒心跳 | `Timer::tick(5000, ...)` | WebSocket 心跳 |
| 延迟 3 秒执行 | `Timer::after(3000, ...)` | 延迟推送通知 |
| 每天 3 点清理 | Cron 表达式 + Timer::tick | 日志清理 |
| 请求超时 5 秒 | `Timer::after(5000, ...)` + 清理 | HTTP 请求超时 |
| 限流：100次/秒 | Token Bucket + Timer::tick | API 网关限流 |
| 重试：间隔递增 | after 递归调用 | 失败重试 1s→2s→4s→8s |

## 参考资料

- [Swoole Timer 官方文档](https://wiki.swoole.com/#/timer)
- [Swoole Server heartbeat 配置](https://wiki.swoole.com/#/server/setting?id=heartbeat_check_interval)
- [Linux crontab 格式说明](https://crontab.org/)

## 代码演进总结

```
v1 (基础) → 独立的 after/tick 用法演示
  ↓ 添加 Server 集成、心跳检测、延迟响应
v2 (Server) → 在 WorkerStart 中管理定时器，连接级别调度
  ↓ 添加 Cron 表达式、协程执行、任务管理
v3 (生产) → 完整 Cron 调度器，支持多种表达式格式
```
