---
title: "009 - Swoole Process 进程管理"
slug: "009-process"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:40.734+08:00"
updated_at: "2026-04-29T10:02:46.933+08:00"
reading_time: 34
tags: ["Swoole", "PHP"]
---

## 难度标注

> **难度等级：⭐⭐⭐⭐ 较高**
> 前置知识：PHP基础、Linux进程概念、信号机制、管道通信
> 预计学习时间：50-70分钟

## 概念讲解

### 什么是 Swoole Process？

Swoole\Process 是 Swoole 提供的**多进程管理模块**，封装了 `fork`、信号、管道（pipe）等底层操作，让 PHP 也能优雅地编写多进程程序。

**为什么需要多进程？**
- PHP 是单线程语言，一个进程同一时刻只能做一件事
- 多进程可以充分利用多核 CPU
- 进程间隔离，一个崩溃不影响其他

### 进程间通信（IPC）方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| 管道（Pipe） | 双向字节流，默认阻塞读写 | 父子进程简单通信 |
| 消息队列（Queue） | 结构化消息，支持阻塞/非阻塞 | 任务分发 |
| 共享内存（Table） | 固定结构，高性能 | 状态共享 |
| Unix Socket | 本地套接字 | 进程间大量数据传输 |
| 信号（Signal） | 异步通知机制 | 进程控制（重启/停止） |

### Swoole 进程模型

```
                    Master Process
                   /      |       \
              Worker0  Worker1  Worker2
               |         |        |
           [pipe]    [pipe]    [pipe]
               |         |        |
            Task0     Task1    CustomProcess
```

## 脑图（ASCII）

```
Swoole Process
├── 核心类
│   ├── Swoole\Process → 进程管理
│   ├── Swoole\Process\Pool → 进程池
│   └── Swoole\Table → 共享内存
├── Process API
│   ├── __construct($callback, $redirect, $pipe)
│   ├── start() → 启动子进程
│   ├── write() → 写管道
│   ├── read() → 读管道
│   ├── useQueue() → 启用消息队列
│   ├── push() / pop() → 队列操作
│   ├── exit() → 退出进程
│   └── kill() → 发送信号
├── 信号处理
│   ├── Process::signal($signo, $callback)
│   ├── SIGTERM → 优雅退出
│   ├── SIGUSR1 → 自定义信号
│   └── SIGCHLD → 子进程退出
├── 守护进程化
│   └── Process::daemon(true, true)
└── 进程池
    ├── new Pool($workerNum)
    ├── on('WorkerStart')
    ├── on('Message')
    └── start()
```

## 完整代码

### v1：父子进程管道通信

```php
<?php
// v1_pipe_communication.php
// Parent-child process communication via pipe

use Swoole\Process;

// Create child process with pipe enabled (default)
$child = new Process(function (Process $proc) {
    // ─── Child process code ─────────────────────
    echo "[Child] PID=" . getmypid() . " started\n";

    // Read data from parent via pipe
    $data = $proc->read();
    echo "[Child] Received from parent: {$data}\n";

    // Process the data
    $result = strtoupper($data);
    sleep(1);

    // Write result back to parent
    $proc->write("[Child Response] {$result}");
    echo "[Child] Sent response back\n";
});

// Start child process
$pid = $child->start();
echo "[Parent] Forked child PID={$pid}\n";

// Send data to child
$child->write("hello from parent pipe");
echo "[Parent] Sent data to child\n";

// Read response (blocking)
$response = $child->read();
echo "[Parent] Got response: {$response}\n";

// Wait for child to exit
$status = Process::wait();
echo "[Parent] Child exited: " . json_encode($status) . "\n";
```

### v2：多 Worker 进程池 + 消息队列

```php
<?php
// v2_process_pool.php
// Multi-worker process pool with message queue

use Swoole\Process;
use Swoole\Table;

define('WORKER_NUM', 4);

// Shared memory for status tracking
$statusTable = new Table(1024);
$statusTable->column('pid', Table::TYPE_INT);
$statusTable->column('status', Table::TYPE_STRING, 16);
$statusTable->column('tasks_done', Table::TYPE_INT);
$statusTable->column('updated_at', Table::TYPE_STRING, 32);
$statusTable->create();

$workers = [];

// ─── Create worker processes ──────────────────────────────────
for ($i = 0; $i < WORKER_NUM; $i++) {
    $process = new Process(function (Process $proc) use ($i) {
        echo "[Worker {$i}] PID=" . getmypid() . " started\n";

        // Set process name for monitoring
        $proc->name("swoole-worker-{$i}");

        // Enable message queue
        $proc->useQueue(ftok(__FILE__, 'a') + $i);

        while (true) {
            // Try to receive message (blocking)
            $data = $proc->pop();
            if ($data === false) {
                usleep(100000);
                continue;
            }

            $task = json_decode($data, true);
            if (!$task) continue;

            // Handle shutdown signal
            if (($task['type'] ?? '') === 'shutdown') {
                echo "[Worker {$i}] Shutting down\n";
                break;
            }

            // Process task
            echo "[Worker {$i}] Processing task: " . ($task['type'] ?? 'unknown') . "\n";

            $result = processTask($i, $task);

            // Send result back via pipe
            $proc->write(json_encode([
                'worker_id' => $i,
                'task_id' => $task['id'] ?? 0,
                'result' => $result,
            ]));
        }

        echo "[Worker {$i}] Exited\n";
    }, true, true);  // redirect_stdin=true, create_pipe=true

    $pid = $process->start();
    $workers[$i] = $process;
    $statusTable->set("worker_{$i}", [
        'pid' => $pid,
        'status' => 'running',
        'tasks_done' => 0,
        'updated_at' => date('H:i:s'),
    ]);
}

// ─── Signal handler for graceful shutdown ──────────────────────
Process::signal(SIGTERM, function () use ($workers) {
    echo "[Master] Received SIGTERM, shutting down...\n";
    foreach ($workers as $proc) {
        $proc->push(json_encode(['type' => 'shutdown']));
    }
});

Process::signal(SIGCHLD, function () {
    // Reap zombie processes
    while (($ret = Process::wait(false)) !== false) {
        echo "[Master] Child {$ret['pid']} exited with code {$ret['code']}\n";
    }
});

// ─── Dispatch tasks to workers ─────────────────────────────────
$taskId = 0;
for ($batch = 0; $batch < 3; $batch++) {
    for ($i = 0; $i < WORKER_NUM; $i++) {
        $taskId++;
        $task = [
            'id' => $taskId,
            'type' => ['email', 'report', 'image', 'data_sync'][rand(0, 3)],
            'payload' => ['batch' => $batch, 'data' => "Task #{$taskId}"],
        ];
        $workers[$i]->push(json_encode($task));
    }
    echo "[Master] Dispatched batch {$batch} ({$taskId} tasks total)\n";
}

// ─── Collect results ──────────────────────────────────────────
$results = [];
foreach ($workers as $i => $proc) {
    // Read with timeout using select
    $data = $proc->read();
    if ($data) {
        $result = json_decode($data, true);
        $results[] = $result;
        echo "[Master] Result from worker {$i}: " . json_encode($result) . "\n";

        $old = $statusTable->get("worker_{$i}");
        if ($old) {
            $statusTable->set("worker_{$i}", [
                'pid' => $old['pid'],
                'status' => 'idle',
                'tasks_done' => $old['tasks_done'] + 1,
                'updated_at' => date('H:i:s'),
            ]);
        }
    }
}

// ─── Shutdown workers ─────────────────────────────────────────
echo "[Master] Shutting down workers...\n";
foreach ($workers as $proc) {
    $proc->push(json_encode(['type' => 'shutdown']));
}

// Wait for all children
foreach ($workers as $proc) {
    Process::wait(true);
}

echo "[Master] All workers stopped. Total results: " . count($results) . "\n";

function processTask(int $workerId, array $task): array
{
    usleep(rand(100000, 500000)); // 0.1-0.5s
    return [
        'worker' => $workerId,
        'task_id' => $task['id'],
        'processed' => true,
        'time' => date('H:i:s'),
    ];
}
```

### v3：Process\Pool 进程池 + 协程

```php
<?php
// v3_process_pool_coroutine.php
// Production process pool with coroutine support

use Swoole\Process\Pool;
use Swoole\Coroutine;

$workerNum = 4;
$pool = new Pool($workerNum, SWOOLE_IPC_SOCKET, 0, true);

// Shared state via Redis (or Table for single-machine)
$pool->on('WorkerStart', function (Pool $pool, int $workerId) {
    echo "[Pool] Worker #{$workerId} started (PID=" . getmypid() . ")\n";

    // Set up signal handler per worker
    Process::signal(SIGTERM, function () use ($pool, $workerId) {
        echo "[Pool] Worker #{$workerId} received SIGTERM\n";
        $pool->shutdown();
    });
});

$pool->on('Message', function (Pool $pool, string $data) use ($workerNum) {
    $task = json_decode($data, true);
    if (!$task) return;

    $type = $task['type'] ?? 'unknown';
    $taskId = $task['id'] ?? 0;

    echo "[Worker] Processing task #{$taskId} type={$type}\n";

    switch ($type) {
        case 'http_fetch':
            // Use coroutine for concurrent HTTP requests
            go(function () use ($pool, $task, $taskId) {
                $urls = $task['urls'] ?? [];
                $results = [];

                // Concurrent fetch using coroutines
                $wg = new Coroutine\WaitGroup();
                foreach ($urls as $url) {
                    $wg->add();
                    go(function () use ($url, &$results, $wg) {
                        $client = new Coroutine\Http\Client(
                            parse_url($url, PHP_URL_HOST),
                            parse_url($url, PHP_URL_PORT) ?: 80
                        );
                        $client->get(parse_url($url, PHP_URL_PATH) ?: '/');
                        $results[$url] = [
                            'status' => $client->statusCode,
                            'size' => strlen($client->body),
                        ];
                        $client->close();
                        $wg->done();
                    });
                }
                $wg->wait();

                $pool->sendMessage(json_encode([
                    'task_id' => $taskId,
                    'type' => 'http_fetch_result',
                    'results' => $results,
                ]), $pool->getWorkerId());
            });
            break;

        case 'data_process':
            // Heavy data processing in coroutine
            go(function () use ($pool, $task, $taskId) {
                $data = $task['data'] ?? [];
                $processed = [];

                foreach (array_chunk($data, 100) as $chunk) {
                    $processed = array_merge($processed, array_map(function ($item) {
                        return ['processed' => true, 'value' => $item * 2, 'at' => time()];
                    }, $chunk));
                    Coroutine::sleep(0.01); // Yield control
                }

                $pool->sendMessage(json_encode([
                    'task_id' => $taskId,
                    'type' => 'data_result',
                    'count' => count($processed),
                ]), $pool->getWorkerId());
            });
            break;

        case 'ping':
            $pool->sendMessage(json_encode([
                'task_id' => $taskId,
                'type' => 'pong',
                'worker' => $pool->getWorkerId(),
            ]), $pool->getWorkerId());
            break;

        default:
            echo "[Worker] Unknown task type: {$type}\n";
    }
});

$pool->on('WorkerStop', function (Pool $pool, int $workerId) {
    echo "[Pool] Worker #{$workerId} stopped\n";
});

echo "[Pool] Starting with {$workerNum} workers...\n";
$pool->start();
```

## 执行预览

```
# v1 管道通信
$ php v1_pipe_communication.php
[Parent] Forked child PID=12345
[Parent] Sent data to child
[Child] PID=12346 started
[Child] Received from parent: hello from parent pipe
[Child] Sent response back
[Parent] Got response: [Child Response] HELLO FROM PARENT PIPE
[Parent] Child exited: {"pid":12346,"code":0,"signal":0}

# v2 进程池
$ php v2_process_pool.php
[Worker 0] PID=12350 started
[Worker 1] PID=12351 started
[Worker 2] PID=12352 started
[Worker 3] PID=12353 started
[Master] Dispatched batch 0 (4 tasks total)
[Worker 0] Processing task: email
[Worker 1] Processing task: report
[Master] Result from worker 0: {"worker_id":0,"result":{"processed":true}}
...
[Master] All workers stopped. Total results: 4
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| fork 限制 | fork 后子进程继承父进程的文件描述符和内存，注意关闭不需要的 |
| 管道阻塞 | `read()` 默认阻塞，可用 `swoole_select` 实现非阻塞 |
| 僵尸进程 | 必须用 `Process::wait()` 回收，否则产生僵尸进程 |
| 信号处理 | `SIGTERM`/`SIGINT` 需要手动处理退出逻辑 |
| 进程重命名 | `setName()` 方便 `ps aux` 监控 |
| Table 大小 | Table 创建后大小不可变，需提前规划容量 |

## 避坑指南

### ❌ 错误：fork 后不 wait，产生僵尸进程

```php
$proc = new Process(function () { sleep(10); });
$proc->start();
// ❌ 父进程退出，子进程变成孤儿/僵尸
```

### ✅ 正确：注册 SIGCHLD 信号处理

```php
Process::signal(SIGCHLD, function () {
    while (($ret = Process::wait(false)) !== false) {
        echo "Child {$ret['pid']} exited\n";
    }
});
```

### ❌ 错误：在子进程中使用父进程的 PDO 连接

```php
// ❌ fork 后共享的 PDO 连接会导致混乱
$pdo = new PDO(...);
$proc = new Process(function () use ($pdo) {
    $pdo->query(...); // DANGER!
});
```

### ✅ 正确：在子进程中重新创建连接

```php
$proc = new Process(function () {
    $pdo = new PDO(...); // ✅ 每个进程独立连接
    $pdo->query(...);
});
```

## 练习题

### 🟢 入门级

1. 创建 2 个子进程，一个负责生成随机数写入管道，另一个读取并求和
2. 修改 v1 让父子进程交替发送消息（乒乓通信）

### 🟡 进阶级

3. 实现一个简单的任务队列：主进程投递任务，多个 Worker 进程争抢执行
4. 用 Process\Pool 实现一个简单的 TCP 代理，每个 Worker 处理一部分连接

### 🔴 挑战级

5. 实现多进程 Matser-Worker 架构：Manager 进程监控 Worker 健康状态，自动重启崩溃的 Worker

## 知识点总结

```
Swoole Process 知识体系
├── 基础概念
│   ├── fork() → 创建子进程
│   ├── 管道通信 → read/write
│   ├── 消息队列 → push/pop
│   └── 信号处理 → signal()
├── Process 类
│   ├── start() → 启动
│   ├── write()/read() → 管道
│   ├── push()/pop() → 队列
│   ├── exit() → 退出
│   ├── name() → 重命名
│   └── daemon() → 守护进程化
├── Process\Pool 类
│   ├── WorkerStart/Stop 事件
│   ├── Message 事件
│   └── sendMessage() 跨 Worker 通信
├── 共享方案
│   ├── Table → 高性能固定结构
│   ├── Redis → 跨机器共享
│   └── 文件 → 简单但慢
└── 信号
    ├── SIGTERM → 优雅退出
    ├── SIGUSR1/2 → 自定义
    ├── SIGCHLD → 子进程回收
    └── SIGHUP → 重载配置
```

## 举一反三

| 场景 | 推荐方案 | 说明 |
|------|----------|------|
| 并行数据处理 | Process + Table | 多 Worker 分片处理 |
| 后台任务队列 | Process\Pool | 固定数量 Worker 消费队列 |
| 进程监控 | Master-Worker + signal | 自动重启崩溃 Worker |
| 定时任务调度 | Worker + Timer | 每个 Worker 独立调度 |
| 数据管道 | 多级 Process | 读取→解析→写入，流水线 |
| 守护进程 | Process::daemon() | 脱离终端后台运行 |

## 参考资料

- [Swoole Process 官方文档](https://wiki.swoole.com/#/process/process)
- [Swoole Process\Pool 文档](https://wiki.swoole.com/#/process/process_pool)
- [Linux 进程间通信（IPC）](https://man7.org/linux/man-pages/man7/ipc.7.html)
- [PHP pcntl 扩展对比](https://www.php.net/manual/en/book.pcntl.php)

## 代码演进总结

```
v1 (基础) → 父子进程管道通信
  ↓ 添加多 Worker、消息队列、信号处理
v2 (进程池) → 自管理多进程池，任务分发与回收
  ↓ 使用 Process\Pool + 协程
v3 (生产) → 进程池 + 协程并发，支持 HTTP 并发和数据流处理
```
