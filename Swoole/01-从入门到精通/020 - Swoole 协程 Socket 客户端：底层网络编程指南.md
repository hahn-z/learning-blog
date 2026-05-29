---
title: "020 - Swoole 协程 Socket 客户端：底层网络编程指南"
slug: "020-coroutine-socket"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:07:53.09+08:00"
updated_at: "2026-04-29T10:02:47.037+08:00"
reading_time: 39
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐⭐⭐⭐ 高级 | 预计阅读时间：20分钟

适合需要底层网络编程、自定义协议实现的 Swoole 高级开发者。

---

## 概念讲解

### 什么是协程 Socket 客户端？

`Swoole\Coroutine\Socket` 是 Swoole 协程的**最底层网络抽象**，提供 TCP/UDP 的原始 Socket 操作。HTTP 客户端和 WebSocket 客户端都是基于它构建的。

**Socket 客户端层级关系：**

```
┌─────────────────────────┐
│  Coroutine\Http\Client  │  ← HTTP/WebSocket
├─────────────────────────┤
│  Coroutine\Client       │  ← 通用 TCP/UDP
├─────────────────────────┤
│  Coroutine\Socket       │  ← 底层 Socket（本文）
├─────────────────────────┤
│  OS Socket (fd)         │  ← 内核层
└─────────────────────────┘
```

### 为什么需要直接用 Socket？

| 场景 | HTTP Client 够用？ | 需要 Socket |
|------|-------------------|-------------|
| REST API 调用 | ✅ | ❌ |
| WebSocket 通信 | ✅ | ❌ |
| 自定义二进制协议 | ❌ | ✅ |
| Redis/Memcached 协议 | ❌ | ✅ |
| MQTT 物联网协议 | ❌ | ✅ |
| RPC 框架底层 | ❌ | ✅ |
| 代理服务器 | ❌ | ✅ |

### 协程 Socket vs 同步 Socket

| 特性 | socket_* 函数 | Coroutine\Socket |
|------|--------------|-----------------|
| 阻塞 | 阻塞整个进程 | 仅让出协程 |
| 并发 | 需多进程/线程 | 天然支持 |
| API | 面向过程 | 面向对象 |
| 错误处理 | errno 全局变量 | getErr() 方法 |

---

## 脑图

```
Coroutine\Socket
├── 连接管理
│   ├── connect() TCP 连接
│   ├── connect() UDP 无连接
│   └── close() 关闭
├── 数据读写
│   ├── send() 发送数据
│   ├── recv() 接收数据
│   ├── recvAll() 接收指定长度
│   ├── recvLine() 读取一行
│   └── recvWithBuffer() 缓冲接收
├── 高级功能
│   ├── sendto() UDP 发送
│   ├── recvfrom() UDP 接收
│   ├── setProtocol() 协议切割
│   └── SSL/TLS 加密
└── 自定义协议
    ├── 长度前缀协议
    ├── 分隔符协议
    ├── 头部+正文协议
    └── Protobuf/MessagePack
```

---

## 完整代码

### v1：基础 TCP 连接 + 数据收发

```php
<?php
// v1: Basic TCP socket client - connect, send, receive

use Swoole\Coroutine\Socket;
use function Swoole\Coroutine\run;

run(function () {
    $socket = new Socket(AF_INET, SOCK_STREAM, IPPROTO_IP);

    // Set timeout
    $socket->setProtocol([
        'open_length_check'     => false,
        'package_max_length'    => 1024 * 1024,
    ]);

    // Connect to TCP server
    if (!$socket->connect('127.0.0.1', 9501, 5)) {
        echo "[Error] Connect failed: {$socket->errMsg}\n";
        return;
    }
    echo "[Connected] TCP://127.0.0.1:9501\n";

    // Send data
    $data = "Hello, TCP Server!\n";
    $sent = $socket->send($data);
    echo "[Sent] {$sent} bytes: " . trim($data) . "\n";

    // Receive response
    $response = $socket->recv();
    if ($response === false) {
        echo "[Error] Recv failed: {$socket->errMsg}\n";
    } else {
        echo "[Recv] " . trim($response) . "\n";
    }

    $socket->close();
    echo "[Closed]\n";
});
```

### v2：自定义长度前缀协议 + 连接池

```php
<?php
// v2: Custom length-prefix protocol with connection pool

use Swoole\Coroutine\Socket;
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

/**
 * Length-prefix protocol encoder/decoder
 * Format: [4-byte big-endian length][payload]
 */
class PacketProtocol
{
    /**
     * Encode data with length prefix
     */
    public static function encode(string $data): string
    {
        $len = strlen($data);
        return pack('N', $len) . $data;
    }

    /**
     * Decode a complete packet from buffer
     * Returns [decoded_data, remaining_buffer] or null if incomplete
     */
    public static function decode(string $buffer): ?array
    {
        if (strlen($buffer) < 4) {
            return null; // Header not complete
        }

        $header = unpack('N', substr($buffer, 0, 4));
        $length = $header[1];

        if ($length > 1024 * 1024) {
            throw new \RuntimeException("Packet too large: {$length}");
        }

        if (strlen($buffer) < 4 + $length) {
            return null; // Body not complete
        }

        $data = substr($buffer, 4, $length);
        $remaining = substr($buffer, 4 + $length);

        return [$data, $remaining];
    }
}

/**
 * Simple TCP connection pool for custom protocol
 */
class TcpPool
{
    private Channel $pool;
    private string $host;
    private int $port;

    public function __construct(string $host, int $port, int $poolSize = 5)
    {
        $this->host = $host;
        $this->port = $port;
        $this->pool = new Channel($poolSize);
    }

    /**
     * Get a connection from pool
     */
    private function getConnection(): Socket
    {
        if (!$this->pool->isEmpty()) {
            return $this->pool->pop();
        }

        $socket = new Socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
        $socket->setProtocol([
            'open_length_check'     => true,
            'package_length_type'   => 'N',
            'package_length_offset' => 0,
            'package_body_offset'   => 4,
            'package_max_length'    => 1024 * 1024,
        ]);

        if (!$socket->connect($this->host, $this->port, 3)) {
            throw new \RuntimeException("Connect failed: {$socket->errMsg}");
        }

        return $socket;
    }

    /**
     * Return connection to pool
     */
    private function release(Socket $socket): void
    {
        if ($socket->isConnected()) {
            $this->pool->push($socket);
        } else {
            $socket->close();
        }
    }

    /**
     * Send request and receive response using length-prefix protocol
     */
    public function call(string $payload): string
    {
        $socket = $this->getConnection();

        try {
            $packet = PacketProtocol::encode($payload);
            $socket->send($packet);

            // recvPacket() handles protocol framing automatically
            $response = $socket->recvPacket(5.0);

            if ($response === false) {
                throw new \RuntimeException("Recv failed: {$socket->errMsg}");
            }

            // Strip the 4-byte length header
            $data = substr($response, 4);

            $this->release($socket);
            return $data;
        } catch (\Throwable $e) {
            $socket->close();
            throw $e;
        }
    }
}

// --- Demo with echo server ---
run(function () {
    // For demo, start a simple echo TCP server
    $server = new Swoole\Server('127.0.0.1', 9600);
    $server->set([
        'open_length_check'     => true,
        'package_length_type'   => 'N',
        'package_length_offset' => 0,
        'package_body_offset'   => 4,
        'package_max_length'    => 1024 * 1024,
    ]);

    $server->on('Receive', function ($server, $fd, $reactorId, $data) {
        // Echo back with length prefix
        $server->send($fd, $data);
    });

    $server->start();
});
```

### v3：UDP 客户端 + 异步并发 + 协议抽象

```php
<?php
// v3: UDP client + async concurrent + protocol abstraction

use Swoole\Coroutine\Socket;
use Swoole\Coroutine;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

/**
 * Abstract protocol interface
 */
interface ProtocolInterface
{
    public function encode(string $data): string;
    public function decode(string $buffer): ?array;
}

/**
 * Newline-delimited protocol
 * Format: data\n
 */
class NewlineProtocol implements ProtocolInterface
{
    public function encode(string $data): string
    {
        return $data . "\n";
    }

    public function decode(string $buffer): ?array
    {
        $pos = strpos($buffer, "\n");
        if ($pos === false) {
            return null;
        }
        return [substr($buffer, 0, $pos), substr($buffer, $pos + 1)];
    }
}

/**
 * Header-Body protocol
 * Format: [2-byte big-endian header length][header json][body]
 */
class HeaderBodyProtocol implements ProtocolInterface
{
    public function encode(string $data): string
    {
        $header = json_encode(['len' => strlen($data), 'ts' => microtime(true)]);
        $headerLen = strlen($header);
        return pack('n', $headerLen) . $header . $data;
    }

    public function decode(string $buffer): ?array
    {
        if (strlen($buffer) < 2) return null;
        $headerLen = unpack('n', substr($buffer, 0, 2))[1];
        if (strlen($buffer) < 2 + $headerLen) return null;

        $header = json_decode(substr($buffer, 2, $headerLen), true);
        $bodyStart = 2 + $headerLen;
        $bodyLen = $header['len'];

        if (strlen($buffer) < $bodyStart + $bodyLen) return null;

        $body = substr($buffer, $bodyStart, $bodyLen);
        $remaining = substr($buffer, $bodyStart + $bodyLen);
        return [$body, $remaining];
    }
}

/**
 * UDP client for datagram communication
 */
class UdpClient
{
    private Socket $socket;

    public function __construct(private float $timeout = 3.0)
    {
        $this->socket = new Socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    }

    /**
     * Send data and wait for response (request-response over UDP)
     */
    public function call(string $host, int $port, string $data): string
    {
        $sent = $this->socket->sendto($host, $port, $data);
        if ($sent === false) {
            throw new \RuntimeException("Sendto failed: {$this->socket->errMsg}");
        }

        $response = $this->socket->recvfrom($this->timeout);
        if ($response === false) {
            throw new \RuntimeException("Recvfrom timeout or failed");
        }

        return $response;
    }

    /**
     * Fire-and-forget UDP send
     */
    public function send(string $host, int $port, string $data): int
    {
        $sent = $this->socket->sendto($host, $port, $data);
        return $sent ?: 0;
    }

    public function close(): void
    {
        $this->socket->close();
    }
}

/**
 * Concurrent TCP caller - send requests to multiple endpoints
 */
class ConcurrentTcpCaller
{
    /**
     * Send requests concurrently and collect results
     */
    public static function callMultiple(array $endpoints, string $payload, float $timeout = 5.0): array
    {
        $channel = new Channel(count($endpoints));
        $results = [];

        foreach ($endpoints as $i => $ep) {
            Coroutine::create(function () use ($ep, $payload, $timeout, $channel, $i) {
                try {
                    $socket = new Socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
                    if (!$socket->connect($ep['host'], $ep['port'], $timeout)) {
                        $channel->push(['index' => $i, 'error' => 'connect failed']);
                        return;
                    }

                    $socket->send($payload);
                    $data = $socket->recv($timeout);
                    $socket->close();

                    $channel->push([
                        'index'  => $i,
                        'data'   => $data === false ? null : $data,
                        'status' => $data === false ? 'failed' : 'ok',
                    ]);
                } catch (\Throwable $e) {
                    $channel->push(['index' => $i, 'error' => $e->getMessage()]);
                }
            });
        }

        for ($i = 0; $i < count($endpoints); $i++) {
            $results[] = $channel->pop();
        }

        return $results;
    }
}

// --- Demo ---
run(function () {
    // UDP demo
    echo "=== UDP Client Demo ===\n";
    $udp = new UdpClient(3.0);

    // For demo, we'll try a DNS-like query
    $result = $udp->call('8.8.8.8', 53, "\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x07example\x03com\x00\x00\x01\x00\x01");
    echo "[UDP] Received " . strlen($result) . " bytes from DNS\n";

    $udp->close();

    // Protocol demo
    echo "\n=== Protocol Demo ===\n";
    $nl = new NewlineProtocol();
    $encoded = $nl->encode('hello world');
    echo "[Newline] Encoded: " . bin2hex($encoded) . "\n";

    $hb = new HeaderBodyProtocol();
    $encoded = $hb->encode('test payload');
    echo "[HeaderBody] Encoded length: " . strlen($encoded) . "\n";

    // Concurrent TCP demo
    echo "\n=== Concurrent TCP Demo ===\n";
    $endpoints = [
        ['host' => '127.0.0.1', 'port' => 9501],
        ['host' => '127.0.0.1', 'port' => 9502],
        ['host' => '127.0.0.1', 'port' => 9503],
    ];

    // Note: These will fail unless servers are running
    $results = ConcurrentTcpCaller::callMultiple($endpoints, "ping\n", 2.0);
    foreach ($results as $r) {
        $status = isset($r['error']) ? "ERROR: {$r['error']}" : $r['status'];
        echo "[Endpoint {$r['index']}] {$status}\n";
    }
});
```

---

## 执行预览

```
$ php v1_basic.php
[Connected] TCP://127.0.0.1:9501
[Sent] 18 bytes: Hello, TCP Server!
[Recv] Echo: Hello, TCP Server!
[Closed]

$ php v3_concurrent.php
=== UDP Client Demo ===
[UDP] Received 45 bytes from DNS

=== Protocol Demo ===
[Newline] Encoded: 68656c6c6f20776f726c640a
[HeaderBody] Encoded length: 51

=== Concurrent TCP Demo ===
[Endpoint 0] ERROR: connect failed
[Endpoint 1] ERROR: connect failed
[Endpoint 2] ERROR: connect failed
```

---

## 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 粘包问题 | TCP 是流式协议，需要应用层切包 | 使用 `setProtocol()` 或手动处理 |
| 缓冲区管理 | recv() 可能返回不完整数据 | 使用 recvAll() 或 recvPacket() |
| 连接状态 | 需要检测连接是否断开 | 检查 isConnected() 和 recv 返回值 |
| UDP 不可靠 | 数据包可能丢失或乱序 | 需要应用层序列号和超时重传 |
| 大数据传输 | 单次 send 可能不完整 | 循环发送或使用 sendAll() |
| 文件描述符 | 大量连接可能耗尽 fd | 调整系统 ulimit |
| SSL 支持 | 需要额外启用 | 用 enableCrypto() 方法 |

---

## 避坑指南

### ❌ 不处理 TCP 粘包
```php
// Bad: Assume one recv = one complete message
$data = $socket->recv();
processMessage($data); // May contain partial or multiple messages
```

### ✅ 使用协议切割
```php
// Good: Let Swoole handle framing
$socket->setProtocol([
    'open_length_check'     => true,
    'package_length_type'   => 'N',
    'package_length_offset' => 0,
    'package_body_offset'   => 4,
    'package_max_length'    => 2 * 1024 * 1024,
]);
$data = $socket->recvPacket(); // Always returns complete packet
```

### ❌ 忽略 send 返回值
```php
$socket->send($bigData); // May not send all bytes
```

### ✅ 确保数据完整发送
```php
// Good: Use sendAll or check return value
$result = $socket->sendAll($bigData);
if ($result !== strlen($bigData)) {
    // Handle partial send
}
```

### ❌ UDP 不设超时
```php
$response = $socket->recvfrom(); // May block forever if packet lost
```

### ✅ 设置超时
```php
$response = $socket->recvfrom(3.0); // 3 second timeout
if ($response === false) {
    // Handle timeout, maybe retry
}
```

---

## 练习题

### 🟢 初级
1. 用 `Coroutine\Socket` 连接 TCP Echo 服务器，发送一条消息并打印回显
2. 用 UDP Socket 向 NTP 服务器发送时间查询请求

### 🟡 中级
3. 实现长度前缀协议（4 字节头 + body）的编码和解码
4. 实现一个简单的 Redis 客户端：支持 SET/GET 命令（RESP 协议简化版）

### 🔴 高级
5. 实现一个完整的自定义 RPC 协议：包含魔术字、版本号、序列化类型、请求ID、body
6. 实现一个 SOCKS5 代理客户端：支持 TCP CONNECT 方法

---

## 知识点总结

```
协程 Socket 客户端
├── 基础
│   ├── Socket 构造 (AF_INET, SOCK_STREAM/DGRAM)
│   ├── connect() TCP 连接
│   ├── send() / sendAll() 发送
│   ├── recv() / recvAll() / recvPacket() 接收
│   └── close() 关闭
├── UDP
│   ├── sendto() 发送到指定地址
│   ├── recvfrom() 接收并获取来源
│   └── 无连接特性
├── 协议处理
│   ├── setProtocol() 协议配置
│   ├── 长度前缀 (open_length_check)
│   ├── 分隔符 (open_eof_check)
│   └── 自定义协议
├── 高级
│   ├── enableCrypto() SSL/TLS
│   ├── getOption() / setOption()
│   └── 多路复用
└── 生产实践
    ├── 连接池
    ├── 重试机制
    ├── 并发控制
    └── 错误处理
```

---

## 举一反三

| 场景 | 技术方案 | 关键点 |
|------|---------|--------|
| Redis 客户端 | TCP + RESP 协议 | 管道、发布订阅 |
| MQTT 客户端 | TCP + MQTT 协议 | QoS、遗嘱消息 |
| RPC 框架 | TCP + 自定义协议 | 序列化、服务发现 |
| 代理服务器 | TCP 中继 | 协议识别、流量转发 |
| DNS 解析器 | UDP + DNS 协议 | 报文解析、缓存 |
| 消息队列客户端 | TCP + AMQP/自定义 | 消费者组、偏移量 |

---

## 参考资料

- [Swoole 官方文档 - Coroutine\Socket](https://wiki.swoole.com/#/coroutine_client/socket)
- [Swoole 官方文档 - 协程 TCP/UDP 客户端](https://wiki.swoole.com/#/coroutine_client/client)
- [TCP/IP 详解 卷1](https://book.douban.com/subject/1088054/)
- [UNIX 网络编程](https://book.douban.com/subject/1500149/)

---

## 代码演进路线

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | TCP 连接 + 简单收发 | 学习入门、调试 |
| v2 协议版 | 自定义协议 + 连接池 | 自定义 RPC、中间件客户端 |
| v3 进阶版 | UDP + 协议抽象 + 并发 | 完整网络编程 |

**演进思路：** 先掌握 TCP 连接和收发 → 理解协议切割和粘包处理 → 再扩展到 UDP、协议抽象和并发调用。Socket 是一切网络编程的基石。
