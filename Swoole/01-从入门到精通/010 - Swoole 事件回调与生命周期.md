---
title: "010 - Swoole 事件回调与生命周期"
slug: "010-event-lifecycle"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:02:17.642+08:00"
updated_at: "2026-04-29T10:02:46.945+08:00"
reading_time: 36
tags: ["Swoole", "PHP"]
---

# Swoole 事件回调与生命周期

> **难度标注：** ⭐⭐⭐⭐ 中高级 | 预计阅读时间：25 分钟

## 一、概念讲解

Swoole 服务器是基于**事件驱动**的架构。整个服务器的运行过程就是一系列事件的触发和回调处理。理解生命周期，就是理解 Swoole 的"心脏跳动"。

### 服务器生命周期全景

```
启动阶段                    运行阶段                    关闭阶段
─────────────────────────────────────────────────────────────────
BeforeStart → Start     →  Connect → Receive → Close     →  Shutdown
     ↓            ↓           ↓        ↓        ↓              ↓
  ManagerStart  WorkerStart  onConnect onReceive onClose  WorkerStop
                            ↑                    
                         Timer/Tick
```

**三大阶段：**

1. **启动阶段**：Master 进程启动 → Manager 派生 → Worker 初始化
2. **运行阶段**：客户端连接、数据收发、定时任务
3. **关闭阶段**：Worker 退出 → Manager 退出 → Master 退出

## 二、脑图（ASCII）

```
Swoole 生命周期
├── Master 进程
│   ├── onStart()           # 主进程启动（仅一次）
│   └── onShutdown()        # 服务器关闭
├── Manager 进程
│   ├── onManagerStart()    # 管理进程启动
│   ├── onManagerStop()     # 管理进程停止
│   ├── onWorkerStart()     # Worker 启动（初始化资源）
│   └── onWorkerStop()      # Worker 停止（清理资源）
├── Worker 进程（运行时）
│   ├── onConnect()         # 新连接建立
│   ├── onReceive()         # 收到数据
│   ├── onClose()           # 连接关闭
│   ├── onPacket()          # UDP 数据包
│   └── onBufferFull/Empty  # 缓冲区事件
├── Task Worker 进程
│   ├── onTask()            # 执行投递任务
│   └── onFinish()          # 任务完成通知
└── 特殊事件
    ├── onPipeMessage()     # 进程间通信
    └── onWorkerError()     # Worker 异常
```

## 三、完整代码

### v1：完整生命周期演示

```php
<?php
// Full Lifecycle Demo - v1
$server = new Swoole\Server('0.0.0.0', 9501);

$server->set([
    'worker_num' => 2,
    'task_worker_num' => 1,
    'daemonize' => false,
]);

// ========== Master Process Events ==========
$server->on('start', function ($server) {
    echo "[Master] Server started at {$server->host}:{$server->port}\n";
    echo "[Master] Master PID: {$server->master_pid}\n";
    echo "[Master] Manager PID: {$server->manager_pid}\n";
});

$server->on('shutdown', function ($server) {
    echo "[Master] Server shutting down\n";
});

// ========== Manager Process Events ==========
$server->on('managerStart', function ($server) {
    echo "[Manager] Manager process started, PID: " . posix_getpid() . "\n";
});

$server->on('managerStop', function ($server) {
    echo "[Manager] Manager process stopped\n";
});

// ========== Worker Process Events ==========
$server->on('workerStart', function ($server, $workerId) {
    $isTaskWorker = $workerId >= $server->setting['worker_num'];
    $type = $isTaskWorker ? 'TaskWorker' : 'Worker';
    echo "[{$type}] #{$workerId} started, PID: " . posix_getpid() . "\n";
    
    if (!$isTaskWorker) {
        // Initialize connection pools, Redis, etc.
        echo "[Worker] #{$workerId} resources initialized\n";
    }
});

$server->on('workerStop', function ($server, $workerId) {
    echo "[Worker] #{$workerId} stopped\n";
});

$server->on('workerError', function ($server, $workerId, $workerPid, $exitCode, $signal) {
    echo "[ERROR] Worker #{$workerId} (PID:{$workerPid}) crashed: exitCode={$exitCode}, signal={$signal}\n";
});

// ========== Runtime Connection Events ==========
$server->on('connect', function ($server, $fd, $reactorId) {
    $workerId = $server->worker_id;
    echo "[Connect] FD:{$fd} assigned to Worker #{$workerId} via Reactor #{$reactorId}\n";
    $server->send($fd, "Welcome! You are FD:{$fd}\n");
});

$server->on('receive', function ($server, $fd, $reactorId, $data) {
    echo "[Receive] FD:{$fd} >> " . trim($data) . "\n";
    
    $cmd = trim($data);
    
    switch ($cmd) {
        case 'stats':
            $stats = $server->stats();
            $server->send($fd, json_encode($stats, JSON_PRETTY_PRINT) . "\n");
            break;
        case 'workers':
            // Send message to all workers via pipe
            $server->sendMessage('ping_from_fd_' . $fd, 0);
            $server->send($fd, "Broadcasted to workers\n");
            break;
        case 'task':
            $taskId = $server->task(['fd' => $fd, 'data' => $cmd]);
            $server->send($fd, "Task #{$taskId} dispatched\n");
            break;
        case 'quit':
            $server->send($fd, "Goodbye!\n");
            $server->close($fd);
            break;
        default:
            $server->send($fd, "Echo: {$cmd}\n");
    }
});

$server->on('close', function ($server, $fd, $reactorId) {
    echo "[Close] FD:{$fd} disconnected from Reactor #{$reactorId}\n";
});

// ========== Task Events ==========
$server->on('task', function ($server, $taskId, $reactorId, $data) {
    echo "[Task] #{$taskId} executing in Worker #{$server->worker_id}\n";
    Co\System::sleep(1); // Simulate work
    $server->finish(['task_id' => $taskId, 'done' => true]);
});

$server->on('finish', function ($server, $taskId, $data) {
    echo "[Finish] Task #{$taskId} completed\n";
});

// ========== IPC Event ==========
$server->on('pipeMessage', function ($server, $fromWorkerId, $message) {
    echo "[PipeMessage] Worker #{$server->worker_id} received: \"{$message}\" from Worker #{$fromWorkerId}\n";
});

echo "Starting server...\n";
$server->start();
```

### v2：HTTP 服务器生命周期

```php
<?php
// HTTP Server Lifecycle - v2
$server = new Swoole\Http\Server('0.0.0.0', 9501);

$server->set([
    'worker_num' => 4,
    'max_request' => 1000, // Auto-restart after 1000 requests
    'enable_static_handler' => true,
    'document_root' => __DIR__ . '/public',
]);

// Track connections per worker
$connections = new Swoole\Table(1024);
$connections->column('fd', Swoole\Table::TYPE_INT);
$connections->column('connect_time', Swoole\Table::TYPE_INT);
$connections->column('requests', Swoole\Table::TYPE_INT);
$connections->create();

$server->on('workerStart', function ($server, $workerId) use ($connections) {
    // This runs ONCE per worker start - ideal for initialization
    global $redis;
    $redis = new Swoole\Coroutine\Redis();
    $redis->connect('127.0.0.1', 6379);
    echo "[Worker #{$workerId}] Redis connected\n";
    
    // Warm up caches, preload configs
    echo "[Worker #{$workerId}] Ready to serve\n";
});

$server->on('open', function ($server, $request) {
    echo "[WebSocket] Handshake from FD:{$request->fd}\n";
});

$server->on('request', function ($request, $response) use ($connections, $server) {
    $fd = $request->fd;
    $uri = $request->server['request_uri'];
    $method = $request->server['request_method'];
    
    echo "[{$method}] {$uri} on Worker #{$server->worker_id}, FD:{$fd}\n";
    
    // Track request count
    if ($connections->exists($fd)) {
        $row = $connections->get($fd);
        $connections->set($fd, ['requests' => $row['requests'] + 1]);
    }
    
    // Route handling
    switch ($uri) {
        case '/':
            $response->end('<h1>Hello Swoole!</h1><p>Worker: ' . $server->worker_id . '</p>');
            break;
        case '/stats':
            $response->header('Content-Type', 'application/json');
            $response->end(json_encode($server->stats()));
            break;
        case '/health':
            $response->end('OK');
            break;
        default:
            $response->status(404);
            $response->end('Not Found');
    }
});

$server->on('close', function ($server, $fd) use ($connections) {
    $connections->del($fd);
    echo "[Close] FD:{$fd}\n";
});

$server->start();
```

### v3：WebSocket 全生命周期 + 心跳

```php
<?php
// WebSocket Full Lifecycle with Heartbeat - v3
$server = new Swoole\WebSocket\Server('0.0.0.0', 9501);

$server->set([
    'worker_num' => 2,
    'heartbeat_check_interval' => 30,  // Check every 30s
    'heartbeat_idle_time' => 60,       // Close if idle 60s
    'max_request' => 5000,
]);

// Room management via Table
$rooms = new Swoole\Table(1024);
$rooms->column('name', Swoole\Table::TYPE_STRING, 64);
$rooms->column('members', Swoole\Table::TYPE_STRING, 2048); // JSON array of fds
$rooms->create();

$userMap = new Swoole\Table(4096);
$userMap->column('username', Swoole\Table::TYPE_STRING, 64);
$userMap->column('room', Swoole\Table::TYPE_STRING, 64);
$userMap->column('last_active', Swoole\Table::TYPE_INT);
$userMap->create();

$server->on('workerStart', function ($server, $workerId) {
    echo "[Worker #{$workerId}] WebSocket server ready\n";
});

$server->on('open', function ($server, $request) use ($userMap) {
    $fd = $request->fd;
    echo "[WS:Open] FD:{$fd} connected\n";
    
    // Send welcome
    $server->push($fd, json_encode([
        'type' => 'welcome',
        'fd' => $fd,
        'message' => 'Please authenticate',
    ]));
});

$server->on('message', function ($server, $frame) use ($userMap, $rooms) {
    $fd = $frame->fd;
    $data = json_decode($frame->data, true);
    
    if (!$data) return;
    
    // Update last active time
    if ($userMap->exists($fd)) {
        $user = $userMap->get($fd);
        $userMap->set($fd, ['last_active' => time()]);
    }
    
    switch ($data['type'] ?? '') {
        case 'auth':
            // Authenticate user
            $username = $data['username'] ?? 'anonymous';
            $userMap->set($fd, [
                'username' => $username,
                'room' => '',
                'last_active' => time(),
            ]);
            $server->push($fd, json_encode(['type' => 'auth_ok', 'username' => $username]));
            echo "[WS:Auth] FD:{$fd} => {$username}\n";
            break;
            
        case 'join':
            $roomName = $data['room'] ?? 'lobby';
            $user = $userMap->get($fd);
            $userMap->set($fd, [
                'username' => $user['username'],
                'room' => $roomName,
                'last_active' => time(),
            ]);
            
            // Broadcast join message
            foreach ($server->connections as $otherFd) {
                if ($otherFd !== $fd && $server->isEstablished($otherFd)) {
                    $otherUser = $userMap->get($otherFd);
                    if ($otherUser && $otherUser['room'] === $roomName) {
                        $server->push($otherFd, json_encode([
                            'type' => 'user_joined',
                            'username' => $user['username'],
                            'room' => $roomName,
                        ]));
                    }
                }
            }
            echo "[WS:Join] {$user['username']} => {$roomName}\n";
            break;
            
        case 'msg':
            $user = $userMap->get($fd);
            if (!$user) break;
            
            $msg = $data['message'] ?? '';
            echo "[WS:Msg] {$user['username']}@{$user['room']}: {$msg}\n";
            
            // Broadcast to same room
            foreach ($server->connections as $otherFd) {
                if ($otherFd !== $fd && $server->isEstablished($otherFd)) {
                    $otherUser = $userMap->get($otherFd);
                    if ($otherUser && $otherUser['room'] === $user['room']) {
                        $server->push($otherFd, json_encode([
                            'type' => 'message',
                            'from' => $user['username'],
                            'message' => $msg,
                            'time' => date('H:i:s'),
                        ]));
                    }
                }
            }
            break;
    }
});

$server->on('close', function ($server, $fd) use ($userMap) {
    if ($userMap->exists($fd)) {
        $user = $userMap->get($fd);
        echo "[WS:Close] {$user['username']} (FD:{$fd}) disconnected\n";
        $userMap->del($fd);
    } else {
        echo "[WS:Close] FD:{$fd} (unauthenticated) disconnected\n";
    }
});

$server->start();
```

## 四、执行预览

```
$ php lifecycle_v1.php
Starting server...
[Master] Server started at 0.0.0.0:9501
[Manager] Manager process started, PID: 12346
[Worker] #0 started, PID: 12347
[Worker] #0 resources initialized
[Worker] #1 started, PID: 12348
[Worker] #1 resources initialized
[TaskWorker] #2 started, PID: 12349

# Client connects:
$ nc localhost 9501
Welcome! You are FD:1
stats
{"start_time":1714000000,"connection_num":1,"worker_num":2,...}
quit
Goodbye!

# Server logs:
[Connect] FD:1 assigned to Worker #0 via Reactor #0
[Receive] FD:1 >> stats
[Receive] FD:1 >> quit
[Close] FD:1 disconnected from Reactor #0
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| onStart 时机 | 仅在 Master 进程中触发一次，不能做 Worker 初始化 |
| onWorkerStart | 每个 Worker 启动时触发，适合初始化连接池、加载配置 |
| Reactor 线程 | fd 固定分配给某个 Reactor 线程，不会跨线程处理 |
| max_request | Worker 处理 N 个请求后自动重启，防止内存泄漏 |
| heartbeat | WebSocket 必须配置心跳，否则断线无法检测 |
| 进程顺序 | Master → Manager → Workers，关闭时反序 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 在 onStart 中初始化数据库连接 | 在 onWorkerStart 中初始化（每个 Worker 独立） |
| 在 onConnect 中发送大量数据 | 检查连接是否 ready，使用 sendQueue 检查缓冲区 |
| 忽略 workerError 事件 | 监听并记录日志，配合 max_request 自动恢复 |
| onClose 中假设 fd 一定存在 | 检查 isset 后再操作，防止竞态条件 |
| 全局变量跨 Worker 共享 | 用 Table/Redis/APCu 做跨进程共享 |
| 忘记处理 pipeMessage | 跨 Worker 通信用 sendMessage + onPipeMessage 配对 |

## 七、练习题

**🟢 基础题：**
1. 创建 TCP 服务器，在 onWorkerStart 中打印 Worker ID 和 PID
2. 记录每个连接的建立时间和关闭时间，输出连接存活时长

**🟡 进阶题：**
3. 实现 WebSocket 聊天室，支持加入/离开房间、广播消息
4. 用 onPipeMessage 实现 Worker 间消息广播

**🔴 挑战题：**
5. 实现优雅关闭：收到 SIGTERM 后停止接受新连接，等待现有请求完成后再退出
6. 设计一个基于 heartbeat + Table 的连接状态监控面板

## 八、知识点总结

```
事件回调知识树
├── 进程级事件（一次性）
│   ├── onStart / onShutdown      # Master
│   ├── onManagerStart / Stop     # Manager
│   └── onWorkerStart / Stop      # Worker/TaskWorker
├── 连接级事件（高频）
│   ├── onConnect / onClose       # 连接生命周期
│   ├── onReceive / onPacket      # 数据到达
│   └── onBufferFull / Empty      # 缓冲区控制
├── 任务事件
│   ├── onTask / onFinish         # Task 系统
│   └── onPipeMessage             # 进程间通信
└── 异常处理
    ├── onWorkerError             # Worker 崩溃
    └── max_request               # 自动重启防泄漏
```

## 九、举一反三

| 服务器类型 | 特有事件 | 典型用途 |
|-----------|---------|---------|
| TCP Server | onReceive | 游戏服务器、物联网 |
| HTTP Server | onRequest | Web API、微服务 |
| WebSocket Server | onOpen/onMessage | 聊天、实时推送 |
| UDP Server | onPacket | DNS、日志采集 |

## 十、参考资料

- [Swoole 事件列表](https://wiki.swoole.com/#/server/events)
- [Swoole 生命周期](https://wiki.swoole.com/#/learn?id=lifecycle)
- [Swoole 进程模型](https://wiki.swoole.com/#/learn?id=process-model)
- [WebSocket Server](https://wiki.swoole.com/#/websocket_server)

## 十一、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 生命周期全览 | 覆盖所有事件回调 + 日志 | 理解 Swoole 运行机制 |
| v2 HTTP 服务器 | onRequest + Table + 静态文件 | Web API 服务 |
| v3 WebSocket | 房间管理 + 心跳 + 身份认证 | 实时聊天 / 推送系统 |
