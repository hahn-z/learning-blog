---
title: "006 - Swoole实战教程006：WebSocket服务器"
slug: "006-websocket-server"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:42.631+08:00"
updated_at: "2026-04-29T10:02:46.9+08:00"
reading_time: 49
tags: ["Swoole", "PHP"]
---

## 难度标注

> **难度等级：⭐⭐⭐ 中等**
> 前置知识：PHP基础、Swoole HTTP Server、TCP/IP概念
> 预计学习时间：45-60分钟

## 概念讲解

### 什么是 WebSocket？

WebSocket 是一种在单个 TCP 连接上进行全双工通信的协议。与 HTTP 的"请求-响应"模式不同，WebSocket 建立连接后，客户端和服务器可以随时互相推送数据。

**HTTP vs WebSocket 对比：**

| 特性 | HTTP | WebSocket |
|------|------|-----------|
| 通信模式 | 请求-响应 | 全双工 |
| 连接生命周期 | 短连接 | 持久连接 |
| 服务器主动推送 | ❌ 不支持 | ✅ 支持 |
| 数据格式 | 文本为主 | 文本+二进制 |
| 握手方式 | 一次请求 | HTTP升级协议 |

### Swoole WebSocket Server 的核心能力

Swoole 内置了完整的 WebSocket 服务器支持，底层用 C 实现，性能远超 PHP 原生方案：

- **自动握手**：处理 WebSocket 升级协议（Upgrade handshake）
- **帧解析**：自动解析/组装 WebSocket 数据帧
- **多进程管理**：Master + Manager + Worker 进程模型
- **连接管理**：内置 fd（文件描述符）管理机制
- **广播支持**：通过 fd 实现消息广播

### 工作流程

```
客户端                        Swoole WebSocket Server
  |                                    |
  |--- HTTP Upgrade Request --------->|  onOpen 事件触发
  |<--- 101 Switching Protocols ------|
  |                                    |
  |--- WebSocket Frame (text) ------->|  onMessage 事件触发
  |<--- WebSocket Frame (text) -------|
  |                                    |
  |--- WebSocket Frame (close) ------>|  onClose 事件触发
  |                                    |
```

## 脑图（ASCII）

```
Swoole WebSocket Server
├── 生命周期事件
│   ├── onOpen    → 新连接建立，获取 $request
│   ├── onMessage → 收到消息，处理业务逻辑
│   └── onClose   → 连接关闭，清理资源
├── 消息推送 API
│   ├── push()     → 向单个 fd 发送消息
│   ├── exist()    → 检查 fd 是否存在
│   └── disconnect() → 主动断开连接
├── 进程架构
│   ├── Master   → 监听端口，Accept 连接
│   ├── Manager  → 管理 Worker 进程
│   └── Worker   → 处理 WebSocket 事件
├── 应用场景
│   ├── 即时聊天 IM
│   ├── 实时数据推送（股票/行情）
│   ├── 协同编辑
│   └── 游戏服务器
└── 进阶功能
    ├── 自定义握手 onHandshake
    ├── Ping/Pong 心跳
    └── Redis/Table 连接映射
```

## 完整代码

### v1：基础 WebSocket 聊天服务器

```php
<?php
// v1_basic_ws_server.php
// A minimal WebSocket echo server

use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\WebSocket\Frame;

$server = new Server("0.0.0.0", 9502);

// Track connected clients
$clients = [];

$server->on('open', function (Server $server, Request $request) use (&$clients) {
    $clients[$request->fd] = [
        'fd' => $request->fd,
        'connect_time' => date('Y-m-d H:i:s'),
    ];
    echo "[Open] New connection fd={$request->fd}, total=" . count($clients) . "\n";

    // Notify all clients about new user
    foreach ($clients as $client) {
        $server->push($client['fd'], json_encode([
            'type' => 'system',
            'message' => "User #{$request->fd} joined the chat",
            'online' => count($clients),
        ]));
    }
});

$server->on('message', function (Server $server, Frame $frame) use (&$clients) {
    echo "[Message] fd={$frame->fd}, data={$frame->data}\n";

    // Broadcast message to all connected clients
    foreach ($clients as $client) {
        $server->push($client['fd'], json_encode([
            'type' => 'chat',
            'from' => $frame->fd,
            'message' => $frame->data,
            'time' => date('H:i:s'),
        ]));
    }
});

$server->on('close', function (Server $server, int $fd) use (&$clients) {
    unset($clients[$fd]);
    echo "[Close] fd={$fd}, remaining=" . count($clients) . "\n";

    // Notify remaining clients
    foreach ($clients as $client) {
        $server->push($client['fd'], json_encode([
            'type' => 'system',
            'message' => "User #{$fd} left the chat",
            'online' => count($clients),
        ]));
    }
});

echo "WebSocket Server started at ws://0.0.0.0:9502\n";
$server->start();
```

### v2：带用户认证和房间功能的聊天服务器

```php
<?php
// v2_room_chat_server.php
// WebSocket server with room support and user nicknames

use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\WebSocket\Frame;
use Swoole\Table;

// Create shared memory table for cross-worker user tracking
$userTable = new Table(1024);
$userTable->column('fd', Table::TYPE_INT);
$userTable->column('nickname', Table::TYPE_STRING, 32);
$userTable->column('room', Table::TYPE_STRING, 32);
$userTable->column('join_time', Table::TYPE_INT);
$userTable->create();

// Room management
$rooms = ['lobby' => '大厅', 'tech' => '技术交流', 'random' => '随便聊聊'];

$server = new Server("0.0.0.0", 9502);

// Handle HTTP Upgrade with nickname parameter
$server->on('request', function ($request, $response) use ($server) {
    // Serve a simple chat client HTML
    if ($request->server['request_uri'] === '/') {
        $response->header('Content-Type', 'text/html; charset=utf-8');
        $response->end(getChatHtml());
        return;
    }
    $response->status(404);
    $response->end('Not Found');
});

$server->on('open', function (Server $server, Request $request) use ($userTable) {
    // Default nickname based on fd
    $nickname = "User#{$request->fd}";

    // Parse nickname from query string
    if (!empty($request->get['name'])) {
        $nickname = substr(trim($request->get['name']), 0, 32);
    }

    $userTable->set($request->fd, [
        'fd' => $request->fd,
        'nickname' => $nickname,
        'room' => 'lobby',
        'join_time' => time(),
    ]);

    // Welcome message to the new user
    $server->push($request->fd, json_encode([
        'type' => 'welcome',
        'nickname' => $nickname,
        'room' => 'lobby',
        'rooms' => ['lobby', 'tech', 'random'],
    ]));

    broadcastToRoom($server, $userTable, 'lobby', [
        'type' => 'system',
        'message' => "{$nickname} joined the lobby",
    ], $request->fd);

    echo "[Open] fd={$request->fd} nickname={$nickname}\n";
});

$server->on('message', function (Server $server, Frame $frame) use ($userTable) {
    $data = json_decode($frame->data, true);
    if (!$data || !isset($data['type'])) {
        $server->push($frame->fd, json_encode([
            'type' => 'error',
            'message' => 'Invalid message format. JSON required.',
        ]));
        return;
    }

    $user = $userTable->get($frame->fd);
    if (!$user) {
        return;
    }

    switch ($data['type']) {
        case 'chat':
            // Regular chat message in current room
            broadcastToRoom($server, $userTable, $user['room'], [
                'type' => 'chat',
                'nickname' => $user['nickname'],
                'message' => htmlspecialchars($data['message'] ?? ''),
                'time' => date('H:i:s'),
            ]);
            break;

        case 'join_room':
            // Switch to a different room
            $newRoom = $data['room'] ?? 'lobby';
            if (!in_array($newRoom, ['lobby', 'tech', 'random'])) {
                $server->push($frame->fd, json_encode([
                    'type' => 'error',
                    'message' => 'Room does not exist',
                ]));
                break;
            }

            // Leave old room
            broadcastToRoom($server, $userTable, $user['room'], [
                'type' => 'system',
                'message' => "{$user['nickname']} left the room",
            ], $frame->fd);

            // Update room
            $userTable->set($frame->fd, [
                'fd' => $frame->fd,
                'nickname' => $user['nickname'],
                'room' => $newRoom,
                'join_time' => $user['join_time'],
            ]);

            // Enter new room
            broadcastToRoom($server, $userTable, $newRoom, [
                'type' => 'system',
                'message' => "{$user['nickname']} joined the room",
            ], $frame->fd);

            $server->push($frame->fd, json_encode([
                'type' => 'room_changed',
                'room' => $newRoom,
            ]));
            break;

        case 'nickname':
            // Change nickname
            $oldName = $user['nickname'];
            $newName = substr(trim($data['nickname'] ?? ''), 0, 32);
            if (empty($newName)) break;

            $userTable->set($frame->fd, [
                'fd' => $frame->fd,
                'nickname' => $newName,
                'room' => $user['room'],
                'join_time' => $user['join_time'],
            ]);

            broadcastToRoom($server, $userTable, $user['room'], [
                'type' => 'system',
                'message' => "{$oldName} renamed to {$newName}",
            ]);
            break;

        default:
            $server->push($frame->fd, json_encode([
                'type' => 'error',
                'message' => 'Unknown message type',
            ]));
    }
});

$server->on('close', function (Server $server, int $fd) use ($userTable) {
    $user = $userTable->get($fd);
    if ($user) {
        broadcastToRoom($server, $userTable, $user['room'], [
            'type' => 'system',
            'message' => "{$user['nickname']} disconnected",
        ], $fd);
        $userTable->del($fd);
    }
    echo "[Close] fd={$fd}\n";
});

echo "Room Chat Server started at ws://0.0.0.0:9502\n";
$server->start();

/**
 * Broadcast message to all users in a specific room
 */
function broadcastToRoom(Server $server, Table $userTable, string $room, array $msg, ?int $excludeFd = null): void
{
    $payload = json_encode($msg, JSON_UNESCAPED_UNICODE);
    foreach ($userTable as $fd => $user) {
        if ($user['room'] === $room && $fd !== $excludeFd) {
            if ($server->exist($fd)) {
                $server->push($fd, $payload);
            }
        }
    }
}

/**
 * Simple chat client HTML
 */
function getChatHtml(): string
{
    return <<<'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Swoole Chat</title>
<style>
body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}
#messages{border:1px solid #ccc;height:400px;overflow-y:auto;padding:10px;margin:10px 0}
.system{color:#888;font-style:italic}.chat b{color:#0066cc}
input[type=text]{padding:8px;width:70%}button{padding:8px 16px}
</style></head><body>
<h1>Swoole WebSocket Chat</h1>
<div id="messages"></div>
<input id="msg" type="text" placeholder="Type a message..." autocomplete="off">
<button onclick="sendMsg()">Send</button>
<script>
const ws = new WebSocket('ws://' + location.host);
const msgs = document.getElementById('messages');
ws.onmessage = e => {
    const d = JSON.parse(e.data);
    const div = document.createElement('div');
    if(d.type==='system') div.className='system', div.textContent=d.message;
    else if(d.type==='chat') div.innerHTML=`<span class="chat"><b>${d.nickname}</b> [${d.time}]: ${d.message}</span>`;
    else div.textContent=JSON.stringify(d);
    msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
};
function sendMsg(){const m=document.getElementById('msg');if(m.value.trim()){ws.send(JSON.stringify({type:'chat',message:m.value}));m.value='';}}
document.getElementById('msg').addEventListener('keydown',e=>{if(e.key==='Enter')sendMsg();});
</script></body></html>
HTML;
}
```

### v3：生产级 WebSocket 服务器（心跳检测 + 认证 + Redis 发布订阅）

```php
<?php
// v3_production_ws_server.php
// Production-grade WebSocket server with heartbeat, auth, and Redis pub/sub

use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\WebSocket\Frame;
use Swoole\Table;
use Swoole\Timer;

// ─── Configuration ────────────────────────────────────────────
define('WS_HOST', '0.0.0.0');
define('WS_PORT', 9502);
define('HEARTBEAT_INTERVAL', 30000);   // 30s check interval
define('HEARTBEAT_TIMEOUT', 60000);    // 60s no ping = disconnect
define('AUTH_SECRET', 'your-jwt-secret-key');

// ─── Shared Memory Tables ─────────────────────────────────────
// Connection table: track heartbeat across workers
$connTable = new Table(65536);
$connTable->column('fd', Table::TYPE_INT);
$connTable->column('user_id', Table::TYPE_INT);
$connTable->column('nickname', Table::TYPE_STRING, 64);
$connTable->column('room', Table::TYPE_STRING, 32);
$connTable->column('last_heartbeat', Table::TYPE_INT);
$connTable->create();

// ─── Redis Connection (per-worker, lazy init) ─────────────────
$redis = null;

function getRedis() {
    global $redis;
    if ($redis === null) {
        $redis = new Redis();
        $redis->connect('127.0.0.1', 6379);
        $redis->setOption(Redis::OPT_READ_TIMEOUT, -1);
    }
    return $redis;
}

// ─── Simple JWT Verification ──────────────────────────────────
function verifyToken(string $token): ?array
{
    // Simplified JWT verification — use firebase/php-jwt in production
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;

    return $payload;
}

// ─── Server Setup ─────────────────────────────────────────────
$server = new Server(WS_HOST, WS_PORT);
$server->set([
    'worker_num' => 4,
    'heartbeat_check_interval' => 30,     // Swoole built-in heartbeat check
    'heartbeat_idle_time' => 60,          // Idle 60s = disconnect
    'max_conn' => 10000,
    'dispatch_mode' => 2,                 // Fixed mode: same fd → same worker
    'package_max_length' => 2 * 1024 * 1024,  // 2MB max message
]);

// ─── Worker Start: subscribe to Redis channel ─────────────────
$server->on('workerStart', function (Server $server, int $workerId) use ($connTable) {
    // Start heartbeat timer in worker 0
    if ($workerId === 0) {
        Timer::tick(HEARTBEAT_INTERVAL, function () use ($server, $connTable) {
            $now = time();
            foreach ($connTable as $fd => $conn) {
                if ($now - $conn['last_heartbeat'] > HEARTBEAT_TIMEOUT / 1000) {
                    echo "[Heartbeat] Disconnecting fd={$fd} (timeout)\n";
                    $server->disconnect($fd, 4000, 'Heartbeat timeout');
                    $connTable->del($fd);
                }
            }
        });
        echo "[Worker {$workerId}] Heartbeat monitor started\n";
    }

    // Each worker subscribes to Redis pub/sub for cross-server messaging
    go(function () use ($server, $connTable, $workerId) {
        $sub = new Swoole\Coroutine\Redis();
        $sub->connect('127.0.0.1', 6379);

        $channel = 'ws:broadcast';
        $sub->subscribe([$channel]);

        while ($msg = $sub->recv()) {
            if ($msg[0] === 'message' && $msg[1] === $channel) {
                $payload = $msg[2];
                $data = json_decode($payload, true);
                if (!$data) continue;

                // Broadcast to local connections in target room
                $targetRoom = $data['room'] ?? '*';
                foreach ($connTable as $fd => $conn) {
                    if ($targetRoom === '*' || $conn['room'] === $targetRoom) {
                        if ($server->exist($fd)) {
                            $server->push($fd, $data['payload']);
                        }
                    }
                }
            }
        }
    });

    echo "[Worker {$workerId}] Started\n";
});

// ─── onOpen: Authenticate and register ────────────────────────
$server->on('open', function (Server $server, Request $request) use ($connTable) {
    // Token from query string: ws://host:port?token=xxx
    $token = $request->get['token'] ?? '';
    $user = verifyToken($token);

    if (!$user) {
        $server->push($request->fd, json_encode([
            'type' => 'error',
            'message' => 'Authentication failed',
        ]));
        $server->close($request->fd);
        return;
    }

    $connTable->set($request->fd, [
        'fd' => $request->fd,
        'user_id' => $user['uid'] ?? 0,
        'nickname' => $user['nickname'] ?? "User#{$request->fd}",
        'room' => 'lobby',
        'last_heartbeat' => time(),
    ]);

    $server->push($request->fd, json_encode([
        'type' => 'welcome',
        'nickname' => $user['nickname'] ?? "User#{$request->fd}",
        'room' => 'lobby',
    ]));

    echo "[Open] fd={$request->fd} user_id={$user['uid']} nickname={$user['nickname']}\n";
});

// ─── onMessage: Handle incoming frames ────────────────────────
$server->on('message', function (Server $server, Frame $frame) use ($connTable) {
    // Update heartbeat timestamp
    if ($connTable->exists($frame->fd)) {
        $conn = $connTable->get($frame->fd);
        $conn['last_heartbeat'] = time();
        $connTable->set($frame->fd, $conn);
    }

    // Handle Ping (text or opcode)
    if ($frame->data === 'ping' || $frame->opcode === WEBSOCKET_OPCODE_PING) {
        $server->push($frame->fd, 'pong', WEBSOCKET_OPCODE_PONG);
        return;
    }

    $data = json_decode($frame->data, true);
    if (!$data) return;

    $conn = $connTable->get($frame->fd);
    if (!$conn) return;

    switch ($data['type'] ?? '') {
        case 'chat':
            $msg = [
                'type' => 'chat',
                'nickname' => $conn['nickname'],
                'message' => htmlspecialchars($data['message'] ?? ''),
                'time' => date('H:i:s'),
            ];
            $payload = json_encode($msg, JSON_UNESCAPED_UNICODE);

            // Broadcast locally
            foreach ($connTable as $fd => $c) {
                if ($c['room'] === $conn['room'] && $server->exist($fd)) {
                    $server->push($fd, $payload);
                }
            }

            // Publish to Redis for cross-server broadcast
            getRedis()->publish('ws:broadcast', json_encode([
                'room' => $conn['room'],
                'payload' => $payload,
            ]));
            break;

        case 'join_room':
            $newRoom = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['room'] ?? 'lobby');
            $connTable->set($frame->fd, [
                'fd' => $frame->fd,
                'user_id' => $conn['user_id'],
                'nickname' => $conn['nickname'],
                'room' => $newRoom,
                'last_heartbeat' => time(),
            ]);
            $server->push($frame->fd, json_encode([
                'type' => 'room_changed',
                'room' => $newRoom,
            ]));
            break;
    }
});

// ─── onClose: Cleanup ─────────────────────────────────────────
$server->on('close', function (Server $server, int $fd) use ($connTable) {
    $connTable->del($fd);
    echo "[Close] fd={$fd}\n";
});

echo "Production WebSocket Server started at ws://" . WS_HOST . ":" . WS_PORT . "\n";
$server->start();
```

## 执行预览

```
$ php v1_basic_ws_server.php
WebSocket Server started at ws://0.0.0.0:9502

# 另一个终端用 wscat 测试
$ wscat -c ws://127.0.0.1:9502
Connected (press CTRL+C to quit)
> Hello everyone!
< {"type":"chat","from":1,"message":"Hello everyone!","time":"22:30:15"}
< {"type":"system","message":"User #2 joined the chat","online":2}
> 

# 服务器输出
[Open] New connection fd=1, total=1
[Open] New connection fd=2, total=2
[Message] fd=1, data=Hello everyone!
[Message] fd=2, data=Hi there!
```

## 注意事项

| 注意点 | 说明 |
|--------|------|
| fd 不是用户ID | fd 是连接标识，同一用户重连后 fd 会变，需要映射表 |
| Worker 进程间共享 | 普通变量不跨 Worker 共享，用 `Swoole\Table` 或 Redis |
| dispatch_mode | 默认轮询（1），聊天室建议用固定模式（2），同一 fd 始终到同一 Worker |
| 心跳机制 | 必须实现，否则断网后僵尸连接会泄漏资源 |
| 连接数上限 | `ulimit -n` 和 `max_conn` 都要调整 |
| 编码问题 | `push()` 发送的必须是 UTF-8 编码文本 |
| Opcode 区分 | 注意区分文本帧（opcode=1）和二进制帧（opcode=2） |
| 内存泄漏 | 长连接场景下注意 `$clients` 数组要及时清理 |

## 避坑指南

### ❌ 错误：用全局数组管理跨 Worker 连接

```php
// ❌ 每个 Worker 进程有独立的内存空间
$clients = [];  // 只在当前 Worker 可见
```

### ✅ 正确：使用 Swoole\Table 跨 Worker 共享

```php
// ✅ Swoole\Table 基于共享内存，所有 Worker 可见
$table = new Swoole\Table(1024);
$table->column('nickname', Swoole\Table::TYPE_STRING, 64);
$table->create();
```

### ❌ 错误：不检查 fd 是否存在就 push

```php
// ❌ 连接可能已关闭，push 会报错
$server->push($fd, $message);
```

### ✅ 正确：push 前检查连接

```php
// ✅ 先检查再发送
if ($server->exist($fd)) {
    $server->push($fd, $message);
}
```

### ❌ 错误：忽略 WebSocket 帧过大

```php
// ❌ 默认包大小限制 2MB，大消息可能被截断
```

### ✅ 正确：配置 package_max_length

```php
// ✅ 根据业务调整
$server->set([
    'package_max_length' => 2 * 1024 * 1024,
]);
```

## 练习题

### 🟢 入门级

1. 修改 v1 代码，实现一个 Echo 服务器（只回复发送者，不广播）
2. 给 v1 添加用户计数功能，每分钟自动广播当前在线人数

### 🟡 进阶级

3. 实现"私聊"功能：消息格式 `{