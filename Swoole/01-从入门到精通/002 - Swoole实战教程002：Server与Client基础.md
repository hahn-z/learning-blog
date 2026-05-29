---
title: "002 - Swoole实战教程002：Server与Client基础"
slug: "002-server-client-basics"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:40.709+08:00"
updated_at: "2026-04-29T10:02:46.863+08:00"
reading_time: 30
tags: ["Swoole", "PHP"]
---

# Swoole实战教程002：Server与Client基础

> **难度标注：** 🟡 中级 | 预计学习时间：45分钟

## 一、概念讲解

### Server核心概念

Swoole Server是所有网络服务的基础。它采用**事件驱动**模型，通过注册回调函数来处理各种网络事件。

**核心事件生命周期：**

```
启动 → onStart → 监听端口
                → onManagerStart
                → onWorkerStart
         → 等待连接
         → onConnect (新连接)
         → onReceive (收到数据)
         → onClose (连接关闭)
关闭 → onShutdown
```

**Server类型常量：**

| 常量 | 值 | 说明 |
|------|-----|------|
| SWOOLE_TCP | 1 | TCP服务器 |
| SWOOLE_UDP | 2 | UDP服务器 |
| SWOOLE_HTTP | 3 | HTTP服务器 |
| SWOOLE_WS | 4 | WebSocket服务器 |

### Client核心概念

Swoole Client支持同步和异步两种模式：

- **同步客户端**：`new Swoole\Client(SWOOLE_SOCK_TCP)` — 简单直接
- **协程客户端**：`Swoole\Coroutine\Client` — 推荐方式，以同步写法实现异步效果

### 进程模型详解

```
                    Master Process (主进程)
                         │
                    Reactor Threads (I/O线程)
                    ┌────┼────┐
                    R0   R1   R2  (默认CPU核数)
                         │
                    Manager Process (管理进程)
                    ┌────┼────┐
                    W0   W1   W2  Worker进程
                    │    │    │
                  Task Task Task (可选Task Worker)
```

- **Reactor**：负责接收连接、处理I/O，投递到Worker
- **Worker**：处理业务逻辑，同步阻塞也没关系
- **Task Worker**：处理耗时任务（如发送邮件、文件处理）

## 二、脑图

```
Server与Client基础
├── Server
│   ├── 创建 new Swoole\Server(host, port)
│   ├── 配置 set($config)
│   ├── 事件回调 on(event, callback)
│   │   ├── onStart / onShutdown
│   │   ├── onManagerStart
│   │   ├── onWorkerStart / onWorkerStop
│   │   ├── onConnect / onClose
│   │   ├── onReceive
│   │   └── onTask / onFinish
│   └── 启动 start()
├── Client
│   ├── 同步客户端 Swoole\Client
│   ├── 协程客户端 Coroutine\Client
│   └── 连接管理 connect/send/recv/close
├── 进程模型
│   ├── Master → Reactor → I/O
│   ├── Manager → Worker管理
│   └── Worker → 业务处理
└── 核心配置
    ├── worker_num
    ├── task_worker_num
    ├── daemonize
    ├── log_file
    └── heartbeat_check_interval
```

## 三、完整代码

### 基础TCP Server

```php
<?php
// basic_server.php - Basic TCP Server with all core events

$server = new Swoole\Server('0.0.0.0', 9501, SWOOLE_PROCESS);

// Server configuration
$server->set([
    'worker_num'         => 2,           // Number of worker processes
    'task_worker_num'    => 1,           // Number of task workers
    'daemonize'          => false,       // Run in foreground
    'log_file'           => '/tmp/swoole.log',
    'heartbeat_check_interval' => 30,    // Check every 30s
    'heartbeat_idle_time'     => 60,    // Close idle connections after 60s
]);

// Server start event
$server->on('start', function (Swoole\Server $server) {
    echo "[Master] Server started at 0.0.0.0:9501\n";
    echo "[Master] PID: " . $server->master_pid . "\n";
});

// Manager start event
$server->on('managerStart', function (Swoole\Server $server) {
    echo "[Manager] Manager process started, PID: " . $server->manager_pid . "\n";
});

// Worker start event
$server->on('workerStart', function (Swoole\Server $server, int $workerId) {
    echo "[Worker] Worker #{$workerId} started\n";
});

// New connection event
$server->on('connect', function (Swoole\Server $server, int $fd) {
    echo "[Connect] New connection fd={$fd}\n";
    $server->send($fd, "Welcome! Your fd is {$fd}\n");
});

// Receive data event
$server->on('receive', function (Swoole\Server $server, int $fd, int $reactorId, string $data) {
    $data = trim($data);
    echo "[Receive] fd={$fd} reactor={$reactorId} data={$data}\n";

    // Handle special commands
    switch ($data) {
        case 'stats':
            $stats = $server->stats();
            $server->send($fd, json_encode($stats, JSON_PRETTY_PRINT) . "\n");
            break;
        case 'task':
            // Dispatch async task
            $server->task(['action' => 'heavy_work', 'fd' => $fd]);
            $server->send($fd, "Task dispatched, please wait...\n");
            break;
        case 'close':
            $server->send($fd, "Goodbye!\n");
            $server->close($fd);
            break;
        case 'workers':
            $info = "Workers: {$server->setting['worker_num']}, "
                  . "Tasks: {$server->setting['task_worker_num']}\n";
            $server->send($fd, $info);
            break;
        default:
            $server->send($fd, "Echo: {$data}\n");
            break;
    }
});

// Connection close event
$server->on('close', function (Swoole\Server $server, int $fd) {
    echo "[Close] fd={$fd} disconnected\n";
});

// Async task handler
$server->on('task', function (Swoole\Server $server, int $taskId, int $srcWorkerId, $data) {
    echo "[Task] taskId={$taskId} data=" . json_encode($data) . "\n";
    // Simulate heavy work
    sleep(2);
    return ['result' => 'Task completed', 'fd' => $data['fd']];
});

// Task result handler
$server->on('finish', function (Swoole\Server $server, int $taskId, $data) {
    echo "[Finish] taskId={$taskId} result=" . json_encode($data) . "\n";
    if (isset($data['fd']) && $server->exists($data['fd'])) {
        $server->send($data['fd'], "Task #{$taskId} done!\n");
    }
});

$server->start();
```

### 协程Client

```php
<?php
// coroutine_client.php - Coroutine-based TCP client

Swoole\Coroutine\run(function () {
    $client = new Swoole\Coroutine\Client(SWOOLE_SOCK_TCP);

    // Connect to server
    if (!$client->connect('127.0.0.1', 9501, 5)) {
        echo "Connection failed: {$client->errMsg}\n";
        return;
    }

    // Read welcome message
    $welcome = $client->recv();
    echo "Server: {$welcome}";

    // Send commands and receive responses
    $commands = ['hello', 'stats', 'task', 'workers', 'close'];
    foreach ($commands as $cmd) {
        if ($cmd === 'close') {
            $client->send($cmd . "\n");
            $resp = $client->recv();
            if ($resp) echo "Server: {$resp}";
            break;
        }

        $client->send($cmd . "\n");
        $resp = $client->recv();
        if ($resp === false) {
            echo "Recv failed: {$client->errMsg}\n";
            break;
        }
        echo "Server: {$resp}";
        sleep(1); // Pause between commands
    }

    $client->close();
    echo "Connection closed\n";
});
```

### 多端口监听

```php
<?php
// multi_port_server.php - Server listening on multiple ports

$server = new Swoole\Server('0.0.0.0', 9501);

// Add additional port
$udpPort = $server->listen('0.0.0.0', 9502, SWOOLE_UDP);

$udpPort->on('packet', function (Swoole\Server $server, string $data, array $clientInfo) {
    $addr = $clientInfo['address'];
    $port = $clientInfo['port'];
    echo "[UDP] From {$addr}:{$port} → {$data}\n";
    $server->sendto($addr, $port, "UDP Echo: {$data}");
});

$server->on('receive', function ($server, $fd, $reactorId, $data) {
    $server->send($fd, "TCP Echo: " . trim($data) . "\n");
});

$server->start();
```

## 四、执行预览

**终端1：启动服务器**
```bash
$ php basic_server.php
[Master] Server started at 0.0.0.0:9501
[Master] PID: 12345
[Manager] Manager process started, PID: 12346
[Worker] Worker #0 started
[Worker] Worker #1 started
```

**终端2：用telnet连接**
```bash
$ telnet 127.0.0.1 9501
Welcome! Your fd is 1
hello
Echo: hello
stats
{
    "start_time": 1745856000,
    "connection_num": 1,
    "accept_count": 1,
    "close_count": 0,
    "worker_num": 2,
    "task_worker_num": 1,
    "request_count": 3
}
task
Task dispatched, please wait...
Task #0 done!
close
Goodbye!
Connection closed by foreign host.
```

**终端3：用协程Client**
```bash
$ php coroutine_client.php
Server: Welcome! Your fd is 1
Server: Echo: hello
Server: {"start_time":...}
Server: Task dispatched, please wait...
Server: Task #0 done!
Server: Workers: 2, Tasks: 1
Server: Goodbye!
Connection closed
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| onReceive中的$reactorId | 来自哪个Reactor线程 | 用于调试，一般不关注 |
| $fd文件描述符 | 每个连接唯一，但会复用 | 不要在业务中做fd的长期映射 |
| send()可能失败 | 连接可能已关闭 | 先用exists()检查 |
| task()投递 | 只能投递给Task Worker | 需要配置task_worker_num |
| 进程隔离 | Worker间内存不共享 | 使用Table或Redis共享 |
| 守护进程 | daemonize=true后终端无输出 | 配置log_file记录日志 |

## 六、避坑指南

### ❌ 坑1：在onStart中初始化数据库连接
```php
<?php
// ❌ Wrong: onStart runs in Master process, DB conn not shared to Workers
$server->on('start', function ($server) {
    $db = new PDO('mysql:host=127.0.0.1;dbname=test', 'root', '');
});
```

```php
<?php
// ✅ Correct: Initialize in onWorkerStart (per worker process)
$server->on('workerStart', function ($server, $workerId) {
    $server->db = new PDO('mysql:host=127.0.0.1;dbname=test', 'root', '');
});
```

### ❌ 坑2：阻塞Worker进程
```php
<?php
// ❌ Wrong: sleep() blocks the entire worker process
$server->on('receive', function ($server, $fd, $rid, $data) {
    sleep(10); // All other connections on this worker are blocked!
    $server->send($fd, "Done after 10s\n");
});
```

```php
<?php
// ✅ Correct: Use Task Worker for heavy work
$server->on('receive', function ($server, $fd, $rid, $data) {
    $server->task(['fd' => $fd, 'data' => $data]);
    $server->send($fd, "Processing...\n");
});

$server->on('task', function ($server, $taskId, $srcWorkerId, $data) {
    sleep(10); // This runs in a separate Task Worker
    return $data;
});
```

### ❌ 坑3：忘记检查连接是否存在就send
```php
<?php
// ❌ Wrong: Connection may have already closed
$server->on('finish', function ($server, $taskId, $data) {
    $server->send($data['fd'], "Result: ..."); // May throw warning
});
```

```php
<?php
// ✅ Correct: Check connection existence first
$server->on('finish', function ($server, $taskId, $data) {
    if ($server->exists($data['fd'])) {
        $server->send($data['fd'], "Result: ...");
    }
});
```

## 七、练习题

### 🟢 基础题
1. 创建一个TCP Server，监听9502端口，实现简单的聊天echo功能
2. 编写一个协程Client，连续发送5条消息并打印服务器的响应

### 🟡 进阶题
3. 实现一个多端口Server，TCP(9501)+UDP(9502)同时监听
4. 使用Task Worker实现异步日志写入：收到消息后投递给Task Worker，Task Worker将日志写入文件

### 🔴 挑战题
5. 实现一个简单的连接管理器：用Swoole\Table记录所有在线连接的fd和连接时间，支持广播消息

<details>
<summary>参考答案（基础题1）</summary>

```php
<?php
$server = new Swoole\Server('0.0.0.0', 9502);
$server->on('connect', function ($server, $fd) {
    echo "Client {$fd} connected\n";
});
$server->on('receive', function ($server, $fd, $rid, $data) {
    $server->send($fd, "[Echo] " . trim($data) . "\n");
});
$server->on('close', function ($server, $fd) {
    echo "Client {$fd} closed\n";
});
$server->start();
```
</details>

## 八、知识点总结

```
Server与Client知识树
├── Server生命周期
│   ├── start → onStart → ManagerStart → WorkerStart
│   ├── 运行中 → Connect → Receive → Task → Finish
│   └── 关闭 → onShutdown
├── Client类型
│   ├── 同步Client (Swoole\Client)
│   └── 协程Client (Coroutine\Client) ★推荐
├── 核心方法
│   ├── Server::send(fd, data)
│   ├── Server::close(fd)
│   ├── Server::exist(fd)
│   ├── Server::stats()
│   └── Server::task(data)
└── 配置项
    ├── worker_num (默认CPU核数)
    ├── task_worker_num
    ├── daemonize
    └── heartbeat_*
```

## 九、举一反三

| 功能 | 事件/方法 | 适用场景 |
|------|----------|----------|
| 新连接处理 | onConnect | 身份验证、欢迎消息 |
| 数据处理 | onReceive | 业务逻辑核心 |
| 耗时任务 | onTask + task() | 邮件发送、文件处理 |
| 连接断开 | onClose | 资源清理、状态更新 |
| 状态查询 | stats() | 监控面板 |
| 定时任务 | tick()/after() | 心跳、超时检查 |

## 十、参考资料

- [Swoole Server文档](https://wiki.swoole.com/#/server/tcp)
- [Swoole Client文档](https://wiki.swoole.com/#/client)
- [Swoole进程模型](https://wiki.swoole.com/#/learn?id=swoole-process-model)
- [Swoole事件回调](https://wiki.swoole.com/#/server/events)

## 十一、代码演进

### v1：最简Server
```php
<?php
// v1: Minimal TCP echo server
$server = new Swoole\Server('0.0.0.0', 9501);
$server->on('receive', function ($server, $fd, $rid, $data) {
    $server->send($fd, "Echo: {$data}");
});
$server->start();
```

### v2：增加连接管理和日志
```php
<?php
// v2: Add connection events and logging
$server = new Swoole\Server('0.0.0.0', 9501);
$server->on('connect', function ($server, $fd) {
    echo "[+] fd={$fd} connected\n";
});
$server->on('receive', function ($server, $fd, $rid, $data) {
    echo "[R] fd={$fd}: " . trim($data) . "\n";
    $server->send($fd, "Echo: " . trim($data) . "\n");
});
$server->on('close', function ($server, $fd) {
    echo "[-] fd={$fd} closed\n";
});
$server->start();
```

### v3：完整Server（含Task Worker、配置、命令处理）
见上方「基础TCP Server」完整代码。

---

**下期预告：** 003-TCP服务器，将深入讲解TCP服务器的粘包处理、协议设计、连接池等高级话题。
