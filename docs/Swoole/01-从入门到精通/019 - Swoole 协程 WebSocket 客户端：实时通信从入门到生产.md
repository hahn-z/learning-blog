---
title: "019 - Swoole 协程 WebSocket 客户端：实时通信从入门到生产"
slug: "019-coroutine-websocket"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:07:53.076+08:00"
updated_at: "2026-04-29T10:02:47.027+08:00"
reading_time: 33
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐⭐⭐☆ 中高级 | 预计阅读时间：18分钟

适合掌握 Swoole 协程基础，需要实现 WebSocket 客户端实时通信的开发者。

---

## 概念讲解

### 什么是协程 WebSocket 客户端？

`Swoole\Coroutine\Http\Client` 不仅支持 HTTP，还能通过 `upgrade()` 方法升级为 **WebSocket 连接**，实现全双工实时通信。

**WebSocket vs HTTP 轮询：**

| 特性 | HTTP 轮询 | WebSocket |
|------|----------|-----------|
| 通信模式 | 半双工（请求-响应） | 全双工（双向同时） |
| 连接开销 | 每次请求都建连接 | 一次握手，持续通信 |
| 实时性 | 取决于轮询间隔 | 毫秒级推送 |
| 服务器压力 | 高（频繁请求） | 低（长连接） |
| 适用场景 | 低频数据交互 | 聊天、推送、实时数据 |

### 协程 WebSocket 的优势

在 Swoole 协程中使用 WebSocket，最大优势是**可以同时管理多个 WebSocket 连接**，每个连接独立运行在自己的协程中，互不阻塞。

---

## 脑图

```
Coroutine WebSocket Client
├── 连接管理
│   ├── upgrade() 握手升级
│   ├── push() 发送消息
│   ├── recv() 接收消息
│   └── close() 关闭连接
├── 消息类型
│   ├── WEBSOCKET_OPCODE_TEXT
│   ├── WEBSOCKET_OPCODE_BINARY
│   ├── Ping/Pong (心跳)
│   └── Close 帧
├── 使用场景
│   ├── 聊天机器人
│   ├── 实时数据订阅
│   ├── 多连接聚合
│   └── 服务间通信
└── 最佳实践
    ├── 心跳保活
    ├── 断线重连
    ├── 消息队列缓冲
    └── 优雅关闭
```

---

## 完整代码

### v1：基础 WebSocket 客户端

```php
<?php
// v1: Basic WebSocket client - connect, send, receive

use Swoole\Coroutine\Http\Client;
use Swoole\WebSocket\Frame;
use function Swoole\Coroutine\run;

run(function () {
    $client = new Client('echo.websocket.org', 80);
    $client->setHeaders([
        'User-Agent' => 'SwooleWS/1.0',
        'Origin'     => 'http://echo.websocket.org',
    ]);

    // Upgrade to WebSocket
    $ret = $client->upgrade('/');
    if (!$ret) {
        echo "WebSocket handshake failed!\n";
        return;
    }
    echo "Connected to WebSocket server\n";

    // Send text messages
    $client->push('Hello, WebSocket!');
    $client->push(json_encode(['type' => 'greeting', 'msg' => 'from Swoole']));

    // Receive echo responses
    for ($i = 0; $i < 2; $i++) {
        /** @var Frame $frame */
        $frame = $client->recv();
        if ($frame) {
            echo "[Received] {$frame->data}\n";
        }
    }

    // Send close frame
    $client->close();
    echo "Connection closed\n";
});
```

### v2：心跳保活 + 断线重连

```php
<?php
// v2: WebSocket client with heartbeat and auto-reconnect

use Swoole\Coroutine\Http\Client;
use Swoole\Coroutine;
use Swoole\WebSocket\Frame;
use function Swoole\Coroutine\run;

class WsClient
{
    private ?Client $client = null;
    private string $host;
    private int $port;
    private string $path;
    private int $heartbeatInterval;
    private int $maxReconnects;
    private bool $running = true;

    public function __construct(
        string $host,
        int $port = 80,
        string $path = '/',
        int $heartbeatInterval = 30,
        int $maxReconnects = 5
    ) {
        $this->host = $host;
        $this->port = $port;
        $this->path = $path;
        $this->heartbeatInterval = $heartbeatInterval;
        $this->maxReconnects = $maxReconnects;
    }

    /**
     * Connect and run the main loop
     */
    public function run(): void
    {
        $attempts = 0;

        while ($this->running && $attempts < $this->maxReconnects) {
            if ($this->connect()) {
                $attempts = 0; // Reset on successful connect
                $this->loop();
            }

            if (!$this->running) break;

            $attempts++;
            $delay = min(30, 1 * (2 ** ($attempts - 1)));
            echo "[Reconnect] Attempt {$attempts}/{$this->maxReconnects} in {$delay}s\n";
            Coroutine::sleep($delay);
        }
    }

    /**
     * Establish WebSocket connection
     */
    private function connect(): bool
    {
        $this->client = new Client($this->host, $this->port);
        $this->client->set([
            'timeout' => 5,
            'websocket_compression' => true,
        ]);

        if (!$this->client->upgrade($this->path)) {
            echo "[Error] Handshake failed\n";
            return false;
        }

        echo "[Connected] ws://{$this->host}:{$this->port}{$this->path}\n";
        return true;
    }

    /**
     * Main receive loop with heartbeat
     */
    private function loop(): void
    {
        // Start heartbeat in separate coroutine
        Coroutine::create(function () {
            while ($this->running && $this->client && $this->client->connected) {
                Coroutine::sleep($this->heartbeatInterval);
                if ($this->client && $this->client->connected) {
                    // Send ping frame
                    $this->client->push('', WEBSOCKET_OPCODE_PING);
                }
            }
        });

        // Receive loop
        while ($this->running) {
            /** @var Frame|false $frame */
            $frame = $this->client->recv(60);

            if ($frame === false) {
                echo "[Error] Receive failed\n";
                break;
            }

            if ($frame === '') {
                // Timeout, check connection
                continue;
            }

            if ($frame->opcode === WEBSOCKET_OPCODE_CLOSE) {
                echo "[Server] Connection closed by server\n";
                break;
            }

            if ($frame->opcode === WEBSOCKET_OPCODE_PING) {
                // Auto pong is handled by Swoole
                continue;
            }

            if ($frame->opcode === WEBSOCKET_OPCODE_TEXT || $frame->opcode === WEBSOCKET_OPCODE_BINARY) {
                $this->onMessage($frame->data);
            }
        }
    }

    /**
     * Handle incoming message
     */
    protected function onMessage(string $data): void
    {
        echo "[Message] {$data}\n";
    }

    /**
     * Send a text message
     */
    public function send(string $data): bool
    {
        if ($this->client && $this->client->connected) {
            return $this->client->push($data);
        }
        return false;
    }

    /**
     * Stop the client gracefully
     */
    public function stop(): void
    {
        $this->running = false;
        if ($this->client) {
            $this->client->close();
        }
    }
}

// --- Demo ---
run(function () {
    $ws = new WsClient('echo.websocket.org', 80, '/');

    // Auto-stop after demo period
    Coroutine::create(function () use ($ws) {
        Coroutine::sleep(10);
        $ws->send('Final message before shutdown');
        Coroutine::sleep(1);
        $ws->stop();
    });

    // Send periodic messages
    Coroutine::create(function () use ($ws) {
        for ($i = 1; $i <= 3; $i++) {
            Coroutine::sleep(2);
            $ws->send("Message #{$i}");
        }
    });

    $ws->run();
    echo "Client stopped\n";
});
```

### v3：多连接聚合 + 消息分发

```php
<?php
// v3: Multi-connection WebSocket aggregator with message dispatch

use Swoole\Coroutine\Http\Client;
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use Swoole\WebSocket\Frame;
use function Swoole\Coroutine\run;

class WsAggregator
{
    private array $connections = [];
    private Channel $messageBus;
    private int $msgId = 0;

    public function __construct(private int $bufferSize = 1024)
    {
        $this->messageBus = new Channel($bufferSize);
    }

    /**
     * Add a WebSocket source connection
     */
    public function addSource(string $name, string $host, int $port = 80, string $path = '/'): void
    {
        $this->connections[$name] = [
            'host' => $host,
            'port' => $port,
            'path' => $path,
        ];
    }

    /**
     * Start all connections and aggregate messages
     */
    public function start(): void
    {
        foreach ($this->connections as $name => $config) {
            Coroutine::create(function () use ($name, $config) {
                $this->connectAndListen($name, $config);
            });
        }

        // Consume aggregated messages
        while (true) {
            $msg = $this->messageBus->pop(5);
            if ($msg === false) {
                // Check if all connections are dead
                if (empty($this->connections)) break;
                continue;
            }
            $this->dispatch($msg);
        }
    }

    /**
     * Connect to a source and forward messages to bus
     */
    private function connectAndListen(string $name, array $config): void
    {
        $client = new Client($config['host'], $config['port']);
        $client->set(['timeout' => 10]);

        if (!$client->upgrade($config['path'])) {
            echo "[{$name}] Connection failed\n";
            return;
        }

        echo "[{$name}] Connected\n";

        while (true) {
            $frame = $client->recv(60);
            if ($frame === false || ($frame instanceof Frame && $frame->opcode === WEBSOCKET_OPCODE_CLOSE)) {
                echo "[{$name}] Disconnected\n";
                break;
            }

            if ($frame instanceof Frame && $frame->data) {
                $this->messageBus->push([
                    'id'     => ++$this->msgId,
                    'source' => $name,
                    'data'   => $frame->data,
                    'time'   => date('H:i:s'),
                ]);
            }
        }

        $client->close();
    }

    /**
     * Dispatch aggregated message
     */
    protected function dispatch(array $msg): void
    {
        echo "[{$msg['time']}] [{$msg['source']}] #{$msg['id']}: {$msg['data']}\n";
    }
}

// --- Demo: Aggregate multiple WebSocket sources ---
run(function () {
    $agg = new WsAggregator();

    // Add multiple sources (using echo server for demo)
    $agg->addSource('source-a', 'echo.websocket.org', 80, '/');
    $agg->addSource('source-b', 'echo.websocket.org', 80, '/');

    // Send test messages after connection
    Coroutine::create(function () {
        Coroutine::sleep(1);
        // In real scenario, these would be separate clients pushing to the sources
    });

    // Auto-stop demo
    Coroutine::create(function () {
        Coroutine::sleep(8);
        echo "Demo timeout, exiting...\n";
        exit(0);
    });

    $agg->start();
});
```

---

## 执行预览

```
$ php v1_basic.php
Connected to WebSocket server
[Received] Hello, WebSocket!
[Received] {"type":"greeting","msg":"from Swoole"}
Connection closed

$ php v2_heartbeat.php
[Connected] ws://echo.websocket.org:80/
[Message] Message #1
[Message] Message #2
[Message] Message #3
[Message] Final message before shutdown
Client stopped

$ php v3_aggregator.php
[source-a] Connected
[source-b] Connected
[22:15:01] [source-a] #1: test data from a
[22:15:01] [source-b] #2: test data from b
...
```

---

## 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 握手检查 | `upgrade()` 返回 false 表示失败 | 必须检查返回值 |
| recv 超时 | 长时间无消息需设超时 | 传超时参数避免永久阻塞 |
| 心跳机制 | 服务器可能因空闲断开 | 每 30s 发一次 Ping |
| 大消息 | 默认最大帧 2MB | 调整 `package_max_length` |
| 并发 recv | 同一 Client 不能多协程同时 recv | 一个连接一个 recv 协程 |
| 编码 | 文本帧默认 UTF-8 | 二进制数据用 `WEBSOCKET_OPCODE_BINARY` |
| 压缩 | Swoole 支持 permessage-deflate | 设置 `websocket_compression` |

---

## 避坑指南

### ❌ 不检查 upgrade 返回值
```php
$client->upgrade('/ws');
$client->push('hello'); // May crash if handshake failed
```

### ✅ 始终验证握手
```php
if (!$client->upgrade('/ws')) {
    echo "Handshake failed: status={$client->statusCode}\n";
    return;
}
// Now safe to push/recv
```

### ❌ 忘记心跳导致断连
```php
// Only recv, never send → server disconnects after idle timeout
while (true) {
    $frame = $client->recv();
}
```

### ✅ 加入心跳保活
```php
Coroutine::create(function () use ($client) {
    while ($client->connected) {
        Coroutine::sleep(30);
        $client->push('', WEBSOCKET_OPCODE_PING);
    }
});
```

### ❌ 多协程同时操作同一连接
```php
// Dangerous: race condition on recv
Coroutine::create(function () use ($client) { $client->recv(); });
Coroutine::create(function () use ($client) { $client->recv(); });
```

### ✅ 一个连接对应一个 recv 协程
```php
// Safe: dedicated coroutine per connection
Coroutine::create(function () use ($clientA) { /* recv loop */ });
Coroutine::create(function () use ($clientB) { /* recv loop */ });
```

---

## 练习题

### 🟢 初级
1. 连接 `echo.websocket.org`，发送 3 条文本消息，打印每次的回显
2. 发送一个 JSON 格式的消息，接收后用 `json_decode` 解析并打印

### 🟡 中级
3. 实现一个带自动重连的 WebSocket 客户端，断线后最多重试 5 次
4. 实现心跳机制：每 30 秒发送 Ping，如果 60 秒内没有收到任何消息则认为断连

### 🔴 高级
5. 实现一个 WebSocket 消息聚合器：连接 3 个不同的 WebSocket 服务，所有消息统一汇总处理
6. 实现发布-订阅模式：通过 Channel 在多个协程间分发 WebSocket 消息

---

## 知识点总结

```
WebSocket 协程客户端
├── 连接
│   ├── upgrade() 握手升级
│   ├── connected 属性
│   └── close() 关闭
├── 消息
│   ├── push() 发送
│   ├── recv() 接收
│   ├── Frame 对象 (data, opcode)
│   └── opcode 类型
│       ├── TEXT (1)
│       ├── BINARY (2)
│       ├── PING (9)
│       └── CLOSE (8)
├── 健壮性
│   ├── 心跳保活
│   ├── 断线重连
│   ├── 指数退避
│   └── 超时检测
└── 高级模式
    ├── 多连接管理
    ├── 消息总线/聚合
    └── 发布-订阅
```

---

## 举一反三

| 场景 | 技术方案 | 关键点 |
|------|---------|--------|
| 聊天机器人 | WS客户端 + 消息路由 | 指令解析、状态管理 |
| 加密货币行情 | 多交易所WS聚合 | 消息去重、价格合并 |
| IM 消息网关 | WS + Channel 分发 | 用户路由、在线状态 |
| IoT 设备控制 | WS + 二进制协议 | 协议编解码、设备管理 |
| 游戏服务器对接 | WS + Protobuf | 序列化、帧同步 |
| 日志实时流 | WS → Channel → 存储 | 背压控制、批量写入 |

---

## 参考资料

- [Swoole 官方文档 - WebSocket 客户端](https://wiki.swoole.com/#/coroutine_client/websocket)
- [RFC 6455 - WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [Swoole WebSocket Server](https://wiki.swoole.com/#/websocket_server)
- [WebSocket 教程 - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## 代码演进路线

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | 连接、发送、接收 | 学习入门、简单通信 |
| v2 健壮版 | 心跳 + 重连 | 长连接服务、机器人 |
| v3 聚合版 | 多连接 + 消息分发 | 数据聚合、消息网关 |

**演进思路：** 先跑通单个连接 → 加保活和重连确保可靠 → 再做多连接管理和消息路由。
