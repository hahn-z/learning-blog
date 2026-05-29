---
title: "007 - Swoole Task 任务投递系统"
slug: "007-task-system"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:40.709+08:00"
updated_at: "2026-04-29T10:02:46.913+08:00"
reading_time: 29
tags: ["Swoole", "PHP"]
---

# Swoole Task 任务投递系统

> **难度标注：** ⭐⭐⭐ 中级 | 预计阅读时间：20 分钟

## 一、概念讲解

Swoole 的 Task 系统是一个**异步任务投递机制**，允许你将耗时的操作（如发送邮件、生成报表、数据处理）从主进程投递到独立的 Task Worker 进程中执行，不阻塞主业务流程。

### 核心架构

```
┌─────────────┐    task()     ┌──────────────────┐
│ Worker 进程  │ ──────────→  │ Task Worker 进程   │
│ (处理请求)   │              │ (执行耗时任务)     │
└─────────────┘              └──────────────────┘
       ↑                            │
       └──── onFinish() ←───────────┘
              (任务完成回调)
```

**关键角色：**

| 角色 | 说明 |
|------|------|
| Worker 进程 | 接收请求，投递任务，继续处理其他请求 |
| Task Worker 进程 | 专门执行耗时任务，独立于 Worker |
| Task 队列 | 投递和完成队列，使用共享内存通信 |

### 为什么需要 Task？

传统 PHP-FPM 模式下，发送邮件可能需要 2-5 秒，用户必须等待。使用 Swoole Task：

```php
// 传统同步模式 - 用户等待
$mailer->send($to, $subject, $body); // 阻塞 3 秒
return $response; // 3 秒后才返回

// Swoole Task 模式 - 用户立即得到响应
$server->task(['action' => 'sendMail', 'to' => $to, 'body' => $body]);
return $response; // 立即返回，邮件后台发送
```

## 二、脑图（ASCII）

```
Swoole Task 系统
├── 配置
│   ├── task_worker_num          # Task Worker 数量
│   ├── task_ipc_mode            # IPC 通信模式
│   ├── task_max_request         # 最大处理任务数后重启
│   └── task_tmpdir              # 临时文件目录
├── 核心方法
│   ├── task()                   # 投递任务（异步）
│   ├── taskWait()               # 投递并等待结果（同步）
│   ├── taskCo()                 # 并发投递多个任务
│   └── finish()                 # 完成任务，返回结果
├── 回调函数
│   ├── onTask()                 # Task Worker 中执行
│   └── onFinish()               # Worker 中接收结果
└── 投递数据
    ├── 字符串 / 整型            # 简单类型
    ├── 数组                     # 常用方式
    └── 序列化对象               # 复杂数据
```

## 三、完整代码

### v1：基础 Task 投递

```php
<?php
// Basic Task System - v1
$server = new Swoole\Server('0.0.0.0', 9501);

$server->set([
    'worker_num' => 2,
    'task_worker_num' => 4, // 4 dedicated task workers
]);

// Handle incoming connections
$server->on('receive', function ($server, $fd, $reactorId, $data) {
    $payload = json_decode($data, true);
    
    if (!$payload) {
        $server->send($fd, json_encode(['error' => 'Invalid JSON']));
        return;
    }
    
    // Dispatch task, get task ID
    $taskId = $server->task([
        'action' => $payload['action'] ?? 'default',
        'params' => $payload['params'] ?? [],
        'fd' => $fd, // Save client fd for response
    ]);
    
    $server->send($fd, json_encode([
        'status' => 'task_dispatched',
        'task_id' => $taskId,
    ]));
});

// Execute task in Task Worker process
$server->on('task', function ($server, $taskId, $reactorId, $data) {
    echo "[TaskWorker] Processing task #{$taskId}: {$data['action']}\n";
    
    $result = match ($data['action']) {
        'sendMail' => (function () use ($data) {
            // Simulate email sending
            sleep(2);
            return ['sent' => true, 'to' => $data['params']['to'] ?? 'unknown'];
        })(),
        'generateReport' => (function () use ($data) {
            // Simulate report generation
            sleep(3);
            return ['report' => 'report_' . date('YmdHis') . '.pdf', 'size' => '2.3MB'];
        })(),
        default => ['error' => 'Unknown action']
    };
    
    // Return result to Worker via onFinish
    $server->finish([
        'task_id' => $taskId,
        'result' => $result,
        'fd' => $data['fd'],
    ]);
});

// Receive task result in Worker process
$server->on('finish', function ($server, $taskId, $data) {
    echo "[Worker] Task #{$taskId} finished\n";
    // Push result to client via fd
    if (isset($data['fd'])) {
        $server->send($data['fd'], json_encode([
            'status' => 'task_completed',
            'task_id' => $data['task_id'],
            'result' => $data['result'],
        ]));
    }
});

$server->start();
```

### v2：Task 协程并发

```php
<?php
// Concurrent Task with taskCo - v2
$server = new Swoole\Server('0.0.0.0', 9501);

$server->set([
    'worker_num' => 2,
    'task_worker_num' => 4,
]);

$server->on('receive', function ($server, $fd, $reactorId, $data) {
    $payload = json_decode($data, true);
    $action = $payload['action'] ?? '';
    
    if ($action === 'batch') {
        // Use taskCo to run multiple tasks concurrently
        $results = $server->taskCo([
            ['action' => 'fetchUser', 'uid' => 1],
            ['action' => 'fetchOrders', 'uid' => 1],
            ['action' => 'fetchWallet', 'uid' => 1],
        ], 5.0); // 5s timeout
        
        $server->send($fd, json_encode([
            'status' => 'batch_done',
            'results' => $results,
        ]));
    } else {
        $taskId = $server->task($payload);
        $server->send($fd, json_encode(['dispatched' => $taskId]));
    }
});

$server->on('task', function ($server, $taskId, $reactorId, $data) {
    $action = $data['action'];
    
    // Simulate different IO operations
    $result = match ($action) {
        'fetchUser' => (function () {
            Co\System::sleep(1); // Simulate DB query
            return ['id' => 1, 'name' => 'Alice'];
        })(),
        'fetchOrders' => (function () {
            Co\System::sleep(1.5);
            return [['order_id' => 101, 'amount' => 99.9]];
        })(),
        'fetchWallet' => (function () {
            Co\System::sleep(0.5);
            return ['balance' => 1000.00];
        })(),
        default => ['error' => "Unknown: {$action}"]
    };
    
    $server->finish($result);
});

$server->on('finish', function ($server, $taskId, $data) {
    // For taskCo, results are returned directly, this callback won't fire
});

$server->start();
```

### v3：生产级 Task 管理器

```php
<?php
// Production Task Manager - v3
class TaskManager
{
    private Swoole\Server $server;
    private array $taskConfig = [];
    
    public function __construct(Swoole\Server $server)
    {
        $this->server = $server;
    }
    
    // Register task handler
    public function register(string $action, callable $handler, array $options = []): void
    {
        $this->taskConfig[$action] = [
            'handler' => $handler,
            'retry' => $options['retry'] ?? 0,
            'timeout' => $options['timeout'] ?? 10,
        ];
    }
    
    // Dispatch task with retry support
    public function dispatch(string $action, array $params = [], int $fd = null): int
    {
        $taskId = $this->server->task([
            'action' => $action,
            'params' => $params,
            'fd' => $fd,
            'attempt' => 0,
            'created_at' => microtime(true),
        ]);
        return $taskId;
    }
    
    // Handle task execution
    public function handleTask($server, int $taskId, int $reactorId, array $data): void
    {
        $action = $data['action'];
        
        if (!isset($this->taskConfig[$action])) {
            $server->finish(['error' => "Unregistered action: {$action}", 'fd' => $data['fd']]);
            return;
        }
        
        $config = $this->taskConfig[$action];
        
        try {
            $result = ($config['handler'])($data['params']);
            $server->finish([
                'task_id' => $taskId,
                'result' => $result,
                'fd' => $data['fd'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $attempt = ($data['attempt'] ?? 0) + 1;
            
            if ($attempt <= $config['retry']) {
                // Retry: re-dispatch
                $data['attempt'] = $attempt;
                $server->task($data);
                echo "[Retry] Task #{$taskId} attempt {$attempt}\n";
            } else {
                $server->finish([
                    'task_id' => $taskId,
                    'error' => $e->getMessage(),
                    'fd' => $data['fd'] ?? null,
                ]);
            }
        }
    }
}

// --- Usage ---
$server = new Swoole\Server('0.0.0.0', 9501);
$server->set(['worker_num' => 2, 'task_worker_num' => 4]);

$taskManager = new TaskManager($server);

// Register task handlers
$taskManager->register('sendMail', function (array $params) {
    // Real email sending logic here
    Co\System::sleep(1);
    return ['sent' => true, 'to' => $params['to'] ?? 'unknown'];
}, ['retry' => 3, 'timeout' => 30]);

$taskManager->register('processImage', function (array $params) {
    // Image processing logic
    Co\System::sleep(2);
    return ['processed' => true, 'path' => '/uploads/' . ($params['filename'] ?? 'img.jpg')];
}, ['retry' => 1]);

$server->on('receive', function ($server, $fd, $reactorId, $data) use ($taskManager) {
    $payload = json_decode($data, true);
    $taskManager->dispatch($payload['action'] ?? 'unknown', $payload['params'] ?? [], $fd);
    $server->send($fd, json_encode(['status' => 'dispatched']));
});

$server->on('task', function ($server, $taskId, $reactorId, $data) use ($taskManager) {
    $taskManager->handleTask($server, $taskId, $reactorId, $data);
});

$server->on('finish', function ($server, $taskId, $data) {
    if (!empty($data['fd'])) {
        $server->send($data['fd'], json_encode($data));
    }
});

$server->start();
```

## 四、执行预览

```
$ php task_server.php

[TaskWorker] Processing task #0: sendMail
[Worker] Task #0 finished
[TaskWorker] Processing task #1: generateReport
[Worker] Task #1 finished

# Client sends:
$ echo '{"action":"sendMail","params":{"to":"user@example.com"}}' | nc localhost 9501
{"status":"dispatched","task_id":0}
{"status":"task_completed","task_id":0,"result":{"sent":true,"to":"user@example.com"}}

# taskCo batch:
$ echo '{"action":"batch"}' | nc localhost 9501
{"status":"batch_done","results":[{"id":1,"name":"Alice"},[{"order_id":101}],{"balance":1000}]}
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Task Worker 数量 | 建议设为 CPU 核心数的 1-2 倍，过多会浪费内存 |
| 数据大小 | task() 传递数据超过 8KB 会走临时文件，注意 tmpdir 配置 |
| 阻塞操作 | Task Worker 中避免长时间阻塞，会影响其他任务排队 |
| fd 失效 | onFinish 中 fd 可能已断开，需先检查连接状态 |
| 进程隔离 | Task 和 Worker 是不同进程，不能共享变量 |
| 内存泄漏 | task_max_request 设置合理值，防止 Task Worker 内存泄漏 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 在 Task 中直接 return 结果 | 用 `$server->finish()` 返回结果 |
| task() 投递超大对象（>8KB） | 只传必要参数，Task 中查数据库获取详情 |
| Task Worker 中创建 MySQL 连接不复用 | 在 onWorkerStart 中初始化连接池 |
| 忘记设置 task_worker_num | 必须配置，否则 task() 调用报错 |
| onFinish 中直接操作全局变量 | 用 Table 或 Redis 做跨进程数据共享 |
| taskCo 超时不处理 | 设置合理超时，检查返回 false 的情况 |

## 七、练习题

**🟢 基础题：**
1. 创建一个 TCP 服务器，接收字符串并投递 Task，Task 中将字符串转为大写后返回
2. 配置 2 个 Worker + 2 个 Task Worker，观察任务分配情况

**🟡 进阶题：**
3. 使用 `taskCo` 同时投递 3 个任务（模拟查询用户、订单、积分），实现 1.5 秒内完成
4. 实现一个带超时重试的 Task 投递（超时 3 秒自动重试，最多 2 次）

**🔴 挑战题：**
5. 基于共享内存 Table 实现一个任务状态追踪面板，记录每个任务的投递时间、完成时间、状态
6. 实现一个 Task 队列限流器：每秒最多处理 10 个任务，超出排队等待

## 八、知识点总结

```
Swoole Task 知识树
├── 配置项
│   ├── task_worker_num ★★★
│   ├── task_ipc_mode (1=unsock, 2=msgqueue, 3=msgqueue+ipc)
│   └── task_max_request
├── 投递方式
│   ├── task() → 异步投递，返回 taskId
│   ├── taskWait() → 同步等待，适合串行场景
│   └── taskCo() → 并发投递，协程等待全部完成
├── 回调
│   ├── onTask() → 必须调用 finish() 返回
│   └── onFinish() → 接收结果，推送客户端
└── 生产实践
    ├── 重试机制
    ├── 超时控制
    └── 连接池复用
```

## 九、举一反三

| 场景 | 投递方式 | 说明 |
|------|---------|------|
| 发送验证码邮件 | `task()` | 不需要等结果，fire-and-forget |
| 批量导入数据 | `task()` + 重试 | 耗时长，需要容错 |
| 聚合多个 API 数据 | `taskCo()` | 并发请求，缩短总耗时 |
| 顺序处理流水线 | `taskWait()` | 前一步完成再做下一步 |
| 实时通知推送 | `task()` + fd | 完成后通过 fd 推送给用户 |

## 十、参考资料

- [Swoole 官方文档 - Task](https://wiki.swoole.com/#/server/task)
- [Swoole Server::task](https://wiki.swoole.com/#/server/methods?id=task)
- [Swoole Server::taskCo](https://wiki.swoole.com/#/server/methods?id=taskco)
- [Swoole 进程模型](https://wiki.swoole.com/#/learn?id=swoole-process-model)

## 十一、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 基础版 | task() + onTask + onFinish，结构清晰 | 学习理解 Task 机制 |
| v2 并发版 | taskCo() 并发投递多任务 | 批量查询、数据聚合 |
| v3 生产版 | TaskManager 封装 + 重试 + 注册机制 | 生产环境任务管理 |
