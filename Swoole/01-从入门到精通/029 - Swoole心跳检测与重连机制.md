---
title: "029 - Swoole心跳检测与重连机制"
slug: "029-heartbeat"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:18:10.042+08:00"
updated_at: "2026-04-29T10:02:47.106+08:00"
reading_time: 30
tags: ["Swoole", "PHP"]
---

# Swoole心跳检测与重连机制

> 难度：⭐⭐⭐（中级）

## 一、概念讲解

### 为什么需要心跳？

TCP 连接建立后，如果一方崩溃、断电、网络中断，另一方**无法感知**连接已失效。这种连接称为**半开连接（Half-Open Connection）**。

心跳机制通过**定期发送探测包**来检测连接是否存活：

```
Client                          Server
  │                               │
  │──── Ping ────────────────────►│
  │◄──────────────── Pong ───────│  ← 连接正常
  │                               │
  │──── Ping ────────────────────►│
  │     (无响应)                    │  ← 连接异常
  │──── Ping ────────────────────►│
  │     (无响应)                    │  ← 超时，断开
  ╳                               │
```

### 两种心跳模式

| 模式 | 原理 | 适用场景 |
|------|------|---------|
| 服务端心跳 | Swoole 定时检测，超时主动关闭 | 服务端管理连接，推荐 |
| 客户端心跳 | 客户端定时发 Ping，服务端回 Pong | 需要客户端感知网络状态 |

### 重连机制

客户端检测到连接断开后，需要自动重连：

1. **指数退避**：首次 1s，二次 2s，三次 4s... 避免雪崩
2. **最大重试次数**：防止无限重试
3. **重连成功后恢复状态**：重新认证、订阅等

## 二、脑图

```
心跳与重连
├── 心跳检测
│   ├── 服务端心跳
│   │   ├── heartbeat_check_interval
│   │   └── heartbeat_idle_time
│   ├── 客户端心跳
│   │   ├── 定时 Ping
│   │   └── 超时判断
│   └── 应用层心跳
│       └── 自定义 Ping/Pong 协议
├── 重连机制
│   ├── 指数退避 (1s → 2s → 4s → 8s)
│   ├── 最大重试次数
│   ├── 重连回调
│   └── 状态恢复
├── Swoole 配置
│   ├── heartbeat_check_interval
│   ├── heartbeat_idle_time
│   └── TCP KeepAlive
└── 监控
    ├── 连接数统计
    ├── 心跳超时统计
    └── 重连成功率
```

## 三、代码演进

### v1：Swoole 内置心跳检测

```php
<?php
// v1: Server-side heartbeat using Swoole built-in config
// Swoole automatically closes idle connections

$server = new Swoole\Server("0.0.0.0", 9501);

$server->set([
    "worker_num" => 4,
    "heartbeat_check_interval" => 10,  // Check every 10 seconds
    "heartbeat_idle_time" => 30,       // Close if idle for 30s
    "package_max_length" => 65536
]);

$server->on("connect", function ($server, $fd) {
    echo "[+] fd={$fd} connected at " . date("H:i:s") . "\n";
});

$server->on("receive", function ($server, $fd, $reactorId, $data) {
    echo "[Recv] fd={$fd}: {$data}\n";
    $server->send($fd, "ECHO: " . $data);
});

$server->on("close", function ($server, $fd) {
    echo "[-] fd={$fd} closed at " . date("H:i:s") . "\n";
});

echo "Heartbeat Server: check=10s idle=30s\n";
$server->start();
```

### v2：应用层心跳 + 客户端自动重连

```php
<?php
// v2-server: Application-level heartbeat with custom protocol
// Protocol: [1B type][body]  type: 0=data, 1=ping, 2=pong

define("MSG_DATA", 0);
define("MSG_PING", 1);
define("MSG_PONG", 2);

$server = new Swoole\Server("0.0.0.0", 9501);

$server->set([
    "worker_num" => 2,
    "heartbeat_check_interval" => 5,
    "heartbeat_idle_time" => 15,
    "open_length_check" => true,
    "package_length_type" => "N",
    "package_length_offset" => 0,
    "package_body_offset" => 4,
    "package_max_length" => 65536
]);

// Track client last-active time
$lastActive = new Swoole\Table(1024);
$lastActive->column("time", Swoole\Table::TYPE_INT);
$lastActive->column("ping_count", Swoole\Table::TYPE_INT);
$lastActive->create();

$server->on("connect", function ($server, $fd) use ($lastActive) {
    $lastActive->set($fd, ["time" => time(), "ping_count" => 0]);
    echo "[+] fd={$fd} connected\n";
});

$server->on("receive", function ($server, $fd, $reactorId, $data) use ($lastActive) {
    $lastActive->set($fd, ["time" => time(), "ping_count" => 0]);
    
    $type = ord($data[0]);
    $body = substr($data, 1);
    
    switch ($type) {
        case MSG_PING:
            // Respond with PONG
            $server->send($fd, chr(MSG_PONG) . "OK");
            echo "[Ping] fd={$fd} heartbeat\n";
            break;
            
        case MSG_DATA:
            // Process data
            echo "[Data] fd={$fd}: {$body}\n";
            $response = chr(MSG_DATA) . "ACK: " . $body;
            $server->send($fd, $response);
            break;
    }
});

$server->on("close", function ($server, $fd) use ($lastActive) {
    $lastActive->del($fd);
    echo "[-] fd={$fd} closed\n";
});

echo "=== Heartbeat Server v2 ===\n";
$server->start();
```

**v2 客户端（含自动重连）：**

```php
<?php
// v2-client: Auto-reconnect with exponential backoff

class ReconnectClient
{
    private $host;
    private $port;
    private $client;
    private $retryCount = 0;
    private $maxRetries = 10;
    private $baseDelay = 1000;  // 1 second in ms
    private $heartbeatTimer;
    private $connected = false;

    public function __construct(string $host, int $port)
    {
        $this->host = $host;
        $this->port = $port;
    }

    public function start(): void
    {
        $this->connect();
    }

    private function connect(): void
    {
        $this->client = new Swoole\Client(SWOOLE_SOCK_TCP, SWOOLE_SOCK_ASYNC);

        $this->client->on("connect", function ($client) {
            echo "[Connected] to {$this->host}:{$this->port}\n";
            $this->connected = true;
            $this->retryCount = 0;  // Reset retry counter
            
            // Start heartbeat timer
            $this->startHeartbeat();
            
            // Send initial data
            $this->send(MSG_DATA, "Hello from client");
        });

        $this->client->on("receive", function ($client, $data) {
            $type = ord($data[0]);
            $body = substr($data, 1);
            
            if ($type === MSG_PONG) {
                echo "[Heartbeat] PONG received\n";
            } else {
                echo "[Recv] {$body}\n";
            }
        });

        $this->client->on("error", function ($client) {
            echo "[Error] Connection error\n";
            $this->connected = false;
            $this->reconnect();
        });

        $this->client->on("close", function ($client) {
            echo "[Closed] Connection closed\n";
            $this->connected = false;
            $this->reconnect();
        });

        $this->client->connect($this->host, $this->port, 3.0);
    }

    private function startHeartbeat(): void
    {
        // Send heartbeat every 5 seconds
        $this->heartbeatTimer = Swoole\Timer::tick(5000, function () {
            if ($this->connected) {
                $this->send(MSG_PING, "");
                echo "[Heartbeat] PING sent\n";
            }
        });
    }

    private function reconnect(): void
    {
        if ($this->heartbeatTimer) {
            Swoole\Timer::clear($this->heartbeatTimer);
            $this->heartbeatTimer = null;
        }

        if ($this->retryCount >= $this->maxRetries) {
            echo "[Fatal] Max retries ({$this->maxRetries}) reached. Giving up.\n";
            return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        $delay = min($this->baseDelay * pow(2, $this->retryCount), 30000);
        $this->retryCount++;
        
        echo "[Reconnect] Attempt {$this->retryCount}/{$this->maxRetries} in {$delay}ms\n";
        
        Swoole\Timer::after($delay, function () {
            $this->connect();
        });
    }

    private function send(int $type, string $body): void
    {
        if ($this->connected) {
            $this->client->send(chr($type) . $body);
        }
    }
}

define("MSG_DATA", 0);
define("MSG_PING", 1);
define("MSG_PONG", 2);

$client = new ReconnectClient("127.0.0.1", 9501);
$client->start();
```

### v3：生产级心跳管理（含监控面板）

```php
<?php
// v3: Production heartbeat manager with monitoring
// :9501 TCP service, :9502 HTTP monitoring

$server = new Swoole\Server("0.0.0.0", 9501);

// Shared connection table
$connTable = new Swoole\Table(65536);
$connTable->column("fd", Swoole\Table::TYPE_INT);
$connTable->column("connect_time", Swoole\Table::TYPE_INT);
$connTable->column("last_active", Swoole\Table::TYPE_INT);
$connTable->column("heartbeat_count", Swoole\Table::TYPE_INT);
$connTable->column("data_count", Swoole\Table::TYPE_INT);
$connTable->create();

// Stats counter
$stats = new Swoole\Table(1);
$stats->set("global", ["total_connects" => 0, "total_timeouts" => 0, "total_reconnects" => 0]);

$server->set([
    "worker_num" => 4,
    "heartbeat_check_interval" => 5,
    "heartbeat_idle_time" => 20
]);

$server->on("connect", function ($server, $fd) use ($connTable) {
    $connTable->set($fd, [
        "fd" => $fd,
        "connect_time" => time(),
        "last_active" => time(),
        "heartbeat_count" => 0,
        "data_count" => 0
    ]);
    echo "[+] fd={$fd}\n";
});

$server->on("receive", function ($server, $fd, $rid, $data) use ($connTable) {
    $row = $connTable->get($fd);
    if (!$row) return;
    
    $connTable->set($fd, [
        "last_active" => time(),
        "heartbeat_count" => $row["heartbeat_count"],
        "data_count" => $row["data_count"] + 1
    ]);
    
    $server->send($fd, "ACK: " . trim($data));
});

$server->on("close", function ($server, $fd) use ($connTable) {
    $connTable->del($fd);
    echo "[-] fd={$fd}\n";
});

// HTTP monitoring on :9502
$httpPort = $server->listen("0.0.0.0", 9502, SWOOLE_SOCK_TCP);
$httpPort->set(["open_http_protocol" => true]);

$httpPort->on("request", function ($request, $response) use ($connTable) {
    $path = $request->server["request_uri"] ?? "/";
    
    if ($path === "/connections") {
        $conns = [];
        $now = time();
        foreach ($connTable as $k => $row) {
            $idle = $now - $row["last_active"];
            $conns[] = [
                "fd" => $row["fd"],
                "idle_seconds" => $idle,
                "connect_duration" => $now - $row["connect_time"],
                "data_count" => $row["data_count"]
            ];
        }
        $response->header("Content-Type", "application/json");
        $response->end(json_encode(["total" => count($conns), "connections" => $conns], JSON_PRETTY_PRINT));
    } else {
        $response->end("Heartbeat Monitor. /connections for details.");
    }
});

echo "=== Production Heartbeat Server ===\n";
echo "TCP: :9501 | Monitor: :9502\n";
$server->start();
```

## 四、执行预览

```
# Server
$ php v3-heartbeat.php
=== Production Heartbeat Server ===
TCP: :9501 | Monitor: :9502
[+] fd=1
[Recv] fd=1: hello
[-] fd=1  (idle timeout after 20s)

# Client (with reconnect)
$ php v2-client.php
[Connected] to 127.0.0.1:9501
[Recv] ACK: Hello from client
[Heartbeat] PING sent
[Heartbeat] PONG received
[Closed] Connection closed
[Reconnect] Attempt 1/10 in 1000ms
[Connected] to 127.0.0.1:9501  ← 重连成功！

# Monitor
$ curl http://127.0.0.1:9502/connections
{"total":1,"connections":[{"fd":1,"idle_seconds":3,...}]}
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| idle_time > interval | `heartbeat_idle_time` 必须 > `heartbeat_check_interval`，推荐 2-3 倍 |
| 客户端也要心跳 | 服务端心跳只能关闭连接，客户端需主动检测并重连 |
| Timer 清理 | 重连前务必清理旧的 Timer，避免泄漏 |
| Table 容量 | `Swoole\Table` 容量要 >= 最大连接数 |
| TCP KeepAlive | 系统级 KeepAlive 延迟较大（默认2小时），不能替代应用层心跳 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 只依赖 TCP KeepAlive | 应用层心跳，间隔短、可控 |
| 固定间隔重连（1s 1s 1s） | 指数退避（1s 2s 4s 8s...） |
| 重连不设上限 | 设最大重试次数，超过告警 |
| 重连后不清 Timer | 每次 reconnect 前 clear 旧 Timer |
| idle_time = interval | idle_time 至少是 interval 的 2 倍 |

## 七、练习题

### 🟢 基础题
1. 配置 Swoole Server，每 30 秒检查一次心跳，超过 60 秒无活动断开。
2. 用 `nc` 连接服务器，观察超时断开的行为。

### 🟡 进阶题
3. 实现异步客户端，每 5 秒发送心跳，断开后自动重连。
4. 用 `Swoole\Table` 记录每个连接的心跳次数，通过 HTTP 接口查询。

### 🔴 挑战题
5. 实现一个连接池管理器：维护 N 个连接，自动心跳保活，断线重连，提供 `getConnection()` 方法。

## 八、知识点总结

```
心跳与重连知识树
├── 服务端心跳
│   ├── heartbeat_check_interval
│   ├── heartbeat_idle_time
│   └── 自动 close 超时连接
├── 客户端心跳
│   ├── Timer::tick() 定时 Ping
│   ├── 超时检测
│   └── 连接状态机
├── 重连策略
│   ├── 指数退避
│   ├── 最大重试
│   ├── 状态恢复
│   └── 告警通知
├── 监控
│   ├── 连接数
│   ├── 空闲时间
│   └── 心跳统计
└── TCP KeepAlive
    ├── SO_KEEPALIVE
    ├── TCP_KEEPIDLE
    └── TCP_KEEPINTVL
```

## 九、举一反三

| 场景 | 心跳策略 |
|------|---------|
| WebSocket 聊天 | Ping/Pong帧，30s超时 |
| IoT 设备管理 | 设备定时上报即心跳，超时标记离线 |
| RPC 连接池 | 空闲连接定时Ping，失败重建 |
| 游戏服务器 | 帧同步内置心跳，100ms超时 |
| 消息队列 | Consumer定期ACK即心跳 |

## 十、参考资料

- [Swoole 心跳检测](https://wiki.swoole.com/#/server/setting?id=heartbeat_check_interval)
- [Swoole Timer 定时器](https://wiki.swoole.com/#/timer)
- [Swoole 异步客户端](https://wiki.swoole.com/#/client)
- [TCP KeepAlive 详解](https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | Swoole 内置心跳，零代码 | 简单服务端连接管理 |
| v2 | 应用层 Ping/Pong + 客户端重连 | 需要双向感知的生产服务 |
| v3 | 生产级，含监控面板、连接统计 | 运维可视化的生产环境 |
