---
title: "027 - Swoole多端口混合监听"
slug: "027-multi-port"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:18:10.017+08:00"
updated_at: "2026-04-29T10:02:47.091+08:00"
reading_time: 29
tags: ["Swoole", "PHP"]
---

# Swoole多端口混合监听

> 难度：⭐⭐⭐（中级）

## 一、概念讲解

### 什么是多端口混合监听？

在生产环境中，一个服务往往需要同时提供多种协议的支持。比如：

- **HTTP API**：给前端/移动端提供 RESTful 接口
- **WebSocket**：实时推送（聊天、通知、行情）
- **TCP**：物联网设备上报、内部RPC通信

传统方案是启动多个进程，分别监听不同端口。Swoole 的多端口监听允许**一个 Server 进程**同时监听多个端口，每个端口使用不同的协议和事件回调，共享同一组 Worker 进程。

### 核心优势

| 优势 | 说明 |
|------|------|
| 资源复用 | 共享 Worker 进程池，内存占用低 |
| 管理简单 | 一个进程，一套配置，统一监控 |
| 性能提升 | 减少进程间通信和上下文切换 |
| 代码集中 | 业务逻辑在同一代码库，方便维护 |

### 架构示意

```
                    ┌──────────────────────────┐
                    │     Main Server :9501     │
                    │   (HTTP + WebSocket)      │
                    │                           │
Client ──HTTP──►    │  Port 9501 ──► onRequest  │
                    │                           │
Client ──WS────►    │  Port 9501 ──► onMessage  │
                    │                           │
                    ├──────────────────────────┤
                    │   Port 9502 (TCP Server)  │
                    │                           │
Device ──TCP───►    │  Port 9502 ──► onReceive  │
                    │                           │
                    ├──────────────────────────┤
                    │   Port 9503 (UDP Server)  │
                    │                           │
Client ──UDP───►    │  Port 9503 ──► onPacket   │
                    └──────────────────────────┘
                        共享 Worker 进程池
```

## 二、脑图

```
Swoole 多端口监听
├── 基础概念
│   ├── 主服务器 (Main Server)
│   ├── 端口监听器 (Port Listener)
│   └── 协议类型
│       ├── SWOOLE_SOCK_TCP
│       ├── SWOOLE_SOCK_UDP
│       └── SWOOLE_SOCK_TCP6
├── 核心方法
│   ├── $server->listen()  添加监听端口
│   ├── $port->set()       配置端口参数
│   └── $port->on()        注册事件回调
├── 使用场景
│   ├── HTTP + WebSocket 混合
│   ├── TCP + UDP 混合
│   └── 多业务端口隔离
└── 注意事项
    ├── 主 Server 必须是 Base 模式或 Worker 模式
    ├── 子端口不能使用 onTask/onFinish（仅主 Server）
    └── SSL/TLS 需单独配置每个端口
```

## 三、代码演进

### v1：基础多端口监听

```php
<?php
// v1: Basic multi-port server
// Main: HTTP on 9501, Additional: TCP on 9502

$server = new Swoole\Http\Server("0.0.0.0", 9501);

// Main HTTP server handler
$server->on("request", function ($request, $response) {
    $response->header("Content-Type", "application/json");
    $response->end(json_encode([
        "service" => "main-http",
        "port" => 9501,
        "time" => date("Y-m-d H:i:s")
    ]));
});

// Add TCP listener on port 9502
$tcpPort = $server->listen("0.0.0.0", 9502, SWOOLE_SOCK_TCP);

$tcpPort->on("receive", function ($server, $fd, $reactorId, $data) {
    echo "[TCP:9502] Received from fd={$fd}: {$data}\n";
    $server->send($fd, "TCP Echo: " . $data);
});

$tcpPort->on("close", function ($server, $fd) {
    echo "[TCP:9502] Client fd={$fd} closed\n");
});

echo "Server started: HTTP=:9501, TCP=:9502\n";
$server->start();
```

### v2：HTTP + WebSocket + TCP 三合一

```php
<?php
// v2: HTTP + WebSocket + TCP hybrid server
// Port 9501: HTTP + WebSocket, Port 9502: TCP

$server = new Swoole\WebSocket\Server("0.0.0.0", 9501);

// Shared data store (per-worker)
$connections = [];

// --- HTTP Handler ---
$server->on("request", function ($request, $response) {
    $path = $request->server["request_uri"] ?? "/";
    
    if ($path === "/status") {
        $response->header("Content-Type", "application/json");
        $response->end(json_encode([
            "status" => "running",
            "services" => ["http", "websocket", "tcp"],
            "ports" => [9501, 9502],
            "workers" => swoole_cpu_num()
        ]));
    } else {
        $response->end("<h1>Multi-Port Server</h1>
            <p>HTTP: :9501</p>
            <p>WebSocket: ws://:9501</p>
            <p>TCP: :9502</p>");
    }
});

// --- WebSocket Handler ---
$server->on("open", function ($server, $request) {
    global $connections;
    $connections[$request->fd] = [
        "type" => "websocket",
        "connected_at" => time()
    ];
    echo "[WS] New connection fd={$request->fd}\n";
    $server->push($request->fd, json_encode(["msg" => "Welcome!", "fd" => $request->fd]));
});

$server->on("message", function ($server, $frame) {
    global $connections;
    echo "[WS] Message from fd={$frame->fd}: {$frame->data}\n";
    
    $data = json_decode($frame->data, true);
    
    // Broadcast to all WebSocket clients
    foreach ($connections as $fd => $info) {
        if ($info["type"] === "websocket" && $server->isEstablished($fd)) {
            $server->push($fd, json_encode([
                "from" => $frame->fd,
                "msg" => $data["msg"] ?? $frame->data,
                "time" => date("H:i:s")
            ]));
        }
    }
});

$server->on("close", function ($server, $fd) {
    global $connections;
    unset($connections[$fd]);
    echo "[CLOSE] fd={$fd} disconnected\n";
});

// --- TCP Listener on 9502 ---
$tcpPort = $server->listen("0.0.0.0", 9502, SWOOLE_SOCK_TCP);
$tcpPort->set([
    "open_length_check" => true,
    "package_length_type" => "N",
    "package_length_offset" => 0,
    "package_body_offset" => 4,
    "package_max_length" => 81920
]);

$tcpPort->on("receive", function ($server, $fd, $reactorId, $data) {
    global $connections;
    $body = substr($data, 4); // Skip 4-byte length header
    echo "[TCP:9502] fd={$fd} data={$body}\n";
    
    $connections[$fd] = ["type" => "tcp", "connected_at" => time()];
    
    // Echo back with length header
    $response = "ACK: " . $body;
    $server->send($fd, pack("N", strlen($response)) . $response);
});

$tcpPort->on("close", function ($server, $fd) {
    global $connections;
    unset($connections[$fd]);
    echo "[TCP:9502] fd={$fd} closed\n";
});

$server->set([
    "worker_num" => swoole_cpu_num(),
    "daemonize" => false,
    "log_file" => "/tmp/swoole-multi-port.log"
]);

echo "=== Multi-Port Server Started ===\n";
echo "HTTP + WebSocket: :9501\n";
echo "TCP (length-check): :9502\n";
$server->start();
```

### v3：生产级多端口（含UDP、监控、热重启支持）

```php
<?php
// v3: Production-grade multi-port server
// :9501 HTTP+WS | :9502 TCP | :9503 UDP | :9504 Metrics

use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\Http\Response;

$server = new Server("0.0.0.0", 9501);

// --- Global config ---
$server->set([
    "worker_num" => swoole_cpu_num() * 2,
    "task_worker_num" => 4,
    "max_request" => 10000,
    "daemonize" => false,
    "log_file" => "/tmp/swoole-server.log",
    "heartbeat_check_interval" => 60,
    "heartbeat_idle_time" => 300,
    "reload_async" => true,
    "max_coroutine" => 100000
]);

// --- Shared state (Table for cross-worker) ---
$statTable = new Swoole\Table(1024);
$statTable->column("count", Swoole\Table::TYPE_INT);
$statTable->column("last_active", Swoole\Table::TYPE_INT);
$statTable->create();

// --- HTTP routes ---
$server->on("request", function (Request $request, Response $response) use ($statTable) {
    $path = $request->server["request_uri"];
    
    switch ($path) {
        case "/health":
            $response->end("OK");
            break;
        case "/metrics":
            $total = 0;
            foreach ($statTable as $k => $row) { $total += $row["count"]; }
            $response->header("Content-Type", "application/json");
            $response->end(json_encode([
                "total_connections" => $total,
                "workers" => swoole_cpu_num() * 2,
                "memory" => round(memory_get_usage(true) / 1024 / 1024, 2) . "MB"
            ]));
            break;
        default:
            $response->end("Multi-Port Server v3");
    }
});

// --- WebSocket ---
$server->on("open", function ($server, $req) use ($statTable) {
    $statTable->set("ws:" . $req->fd, ["count" => 1, "last_active" => time()]);
    $server->push($req->fd, json_encode(["type" => "connected", "fd" => $req->fd]));
});

$server->on("message", function ($server, $frame) use ($statTable) {
    $statTable->set("ws:" . $frame->fd, ["count" => 1, "last_active" => time()]);
    // Task async processing
    $server->task($frame->data);
});

$server->on("task", function ($server, $taskId, $srcWorkerId, $data) {
    // Process in task worker
    return strtoupper($data);
});

$server->on("finish", function ($server, $taskId, $data) {
    echo "[Task#{$taskId}] Finished: {$data}\n";
});

// --- TCP on :9502 ---
$tcp = $server->listen("0.0.0.0", 9502, SWOOLE_SOCK_TCP);
$tcp->set([
    "open_eof_split" => true,
    "package_eof" => "\r\n",
    "package_max_length" => 65536
]);
$tcp->on("receive", function ($server, $fd, $rid, $data) use ($statTable) {
    $msg = trim($data);
    $statTable->set("tcp:" . $fd, ["count" => 1, "last_active" => time()]);
    $server->send($fd, "ECHO {$msg}\r\n");
});

// --- UDP on :9503 ---
$udp = $server->listen("0.0.0.0", 9503, SWOOLE_SOCK_UDP);
$udp->on("packet", function ($server, $data, $clientInfo) {
    $addr = $clientInfo["address"];
    $port = $clientInfo["port"];
    echo "[UDP:9503] From {$addr}:{$port}: {$data}\n";
    $server->sendto($addr, $port, "UDP OK: " . $data);
});

$server->on("close", function ($server, $fd) use ($statTable) {
    $statTable->del("ws:" . $fd);
    $statTable->del("tcp:" . $fd);
});

echo "=== Production Multi-Port Server ===\n";
echo "HTTP+WS:9501 | TCP:9502 | UDP:9503\n";
$server->start();
```

## 四、执行预览

```
$ php v3-multi-port.php
=== Production Multi-Port Server ===
HTTP+WS:9501 | TCP:9502 | UDP:9503

# Another terminal - HTTP
$ curl http://127.0.0.1:9501/health
OK

$ curl http://127.0.0.1:9501/metrics
{"total_connections":3,"workers":8,"memory":"4.25MB"}

# TCP test
$ echo "hello world" | nc 127.0.0.1 9502
ECHO hello world

# UDP test
$ echo "ping" | nc -u 127.0.0.1 9503
UDP OK: ping
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| onTask/onFinish | 仅主 Server 可注册，子端口不可用 |
| SSL配置 | 每个端口独立配置 `$port->set(["ssl_cert_file"=>...])` |
| 进程共享 | 所有端口共享 Worker 进程池 |
| 协议检测 | 同一端口不能混用多种应用层协议（HTTP和WS除外） |
| 端口冲突 | 确保端口未被占用，`listen()` 会报错 |
| 连接隔离 | 不同端口的 fd 可能相同，通过 server_port 区分 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 在子端口注册 `onTask` | 在主 Server 注册 `onTask`，子端口通过 `$server->task()` 调用 |
| 多个 `new Server()` 监听多端口 | 用 `$server->listen()` 添加子端口 |
| 子端口设置 `worker_num` | worker_num 只在主 Server 设置 |
| 用全局变量存跨 Worker 数据 | 用 `Swoole\Table` 或 Redis 共享 |
| 忽略 fd 冲突 | 用 `server->getClientInfo($fd)` 获取端口信息 |

## 七、练习题

### 🟢 基础题
1. 创建一个 HTTP Server(:9501) + TCP Listener(:9502)，HTTP 返回 "Hello"，TCP 回显收到的消息。
2. 在 TCP Listener 上启用 EOF 分包（`\n` 作为分隔符）。

### 🟡 进阶题
3. 实现 HTTP+WS+TCP 三合一服务器，WebSocket 广播收到的消息给所有客户端。
4. 用 `Swoole\Table` 统计各端口的连接数，通过 HTTP 接口 `/stats` 查询。

### 🔴 挑战题
5. 设计一个网关服务：HTTP(:9501) 接收请求后，通过 TCP(:9502) 转发给后端服务，实现简单的代理转发。

## 八、知识点总结

```
多端口监听知识树
├── 核心API
│   ├── $server->listen($host, $port, $type)
│   ├── $port->set($config)
│   └── $port->on($event, $callback)
├── 协议类型常量
│   ├── SWOOLE_SOCK_TCP
│   ├── SWOOLE_SOCK_UDP
│   ├── SWOOLE_SOCK_TCP6 (IPv6)
│   └── SWOOLE_SOCK_UDP6
├── 限制
│   ├── 子端口无 task/finish
│   ├── 共享 Worker 进程
│   └── fd 可能跨端口重复
└── 最佳实践
    ├── 用 Table 共享状态
    ├── 区分连接来源
    └── 独立配置 SSL
```

## 九、举一反三

| 场景 | 方案 |
|------|------|
| API网关 | HTTP接收请求 → TCP转发后端 → 返回响应 |
| IoT平台 | TCP接设备数据 → HTTP推送通知 → WS实时展示 |
| 游戏服务器 | TCP游戏逻辑 + HTTP管理后台 + WS观战 |
| 微服务代理 | 主端口路由 → 多个内部TCP端口分发 |
| 消息队列 | TCP生产者 + TCP消费者 + HTTP管理接口 |

## 十、参考资料

- [Swoole Server::listen 官方文档](https://wiki.swoole.com/#/server/methods?id=listen)
- [Swoole 多端口监听示例](https://wiki.swoole.com/#/server/port)
- [Swoole WebSocket Server](https://wiki.swoole.com/#/websocket_server)
- [Swoole Table 共享内存](https://wiki.swoole.com/#/memory/table)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | 基础 HTTP+TCP 双端口 | 学习入门 |
| v2 | HTTP+WS+TCP 三合一，含协议分包 | 中小型项目 |
| v3 | 生产级，含UDP、Table共享、Task异步 | 生产环境 |
