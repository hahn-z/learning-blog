---
title: "003 - Swoole实战教程003：TCP服务器"
slug: "003-tcp-server"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:40.727+08:00"
updated_at: "2026-04-29T10:02:46.874+08:00"
reading_time: 33
tags: ["Swoole", "PHP"]
---

# Swoole实战教程003：TCP服务器

> **难度标注：** 🟡 中级 | 预计学习时间：50分钟

## 一、概念讲解

### TCP协议基础

TCP是面向连接的、可靠的、基于字节流的传输层协议。在Swoole中开发TCP服务器，需要理解几个关键问题：

**1. 粘包问题**

TCP是字节流协议，不保证消息边界。发送方连续发送的两条消息可能被接收方一次性读出：

```
发送：[Hello][World]
接收：[HelloWorld]  ← 粘包！
```

**解决方案：**
- 固定长度包（Fixed Length）
- 分隔符（Delimiter）
- 长度头（Length Header）← 最常用

**2. 长度头协议设计**

```
+--------+--------+----------------+
| Header | Length |      Body      |
| 4 bytes| 4 bytes|  N bytes       |
+--------+--------+----------------+

Header:  固定的魔数 (0xSW01)
Length:  Body的字节长度 (网络字节序)
Body:    实际数据 (JSON/二进制)
```

**3. 心跳机制**

防止僵尸连接，定期检测客户端是否存活：
- 服务端心跳：定时检查，超时关闭
- 客户端心跳：定时发送心跳包
- 双向心跳：两端都发

### Swoole内置协议处理

Swoole提供了`open_length_check`、`open_eof_check`等配置项，内置解决粘包：

| 配置项 | 说明 | 适用场景 |
|--------|------|----------|
| open_length_check | 长度头协议 | 自定义二进制协议 |
| open_eof_check | EOF分隔符 | 简单文本协议 |
| package_length_type | 长度字段类型 | 配合open_length_check |
| package_body_offset | Body偏移量 | 有Header的情况 |

## 二、脑图

```
TCP服务器
├── 粘包处理
│   ├── 固定长度
│   ├── 分隔符 (EOF)
│   └── 长度头 (Length Header) ★
├── 协议设计
│   ├── Header + Length + Body
│   ├── JSON编码
│   └── 二进制编码
├── 心跳机制
│   ├── 服务端心跳
│   ├── 客户端心跳
│   └── 配置项
├── 连接管理
│   ├── 连接认证
│   ├── 连接池
│   └── 广播/组播
└── 高级特性
    ├── SSL/TLS加密
    ├── 多端口监听
    └── 优雅重启
```

## 三、完整代码

### 生产级TCP服务器（长度头协议）

```php
<?php
// tcp_server.php - Production-grade TCP server with length-header protocol

// Protocol constants
define('PACK_HEADER', pack('N', 0x53570100)); // Magic bytes "SW\x01\x00"
define('HEADER_SIZE', 4 + 4); // magic(4) + length(4) = 8 bytes

class TcpServer
{
    private Swoole\Server $server;
    private Swoole\Table $connections;

    public function __construct()
    {
        $this->connections = new Swoole\Table(1024);
        $this->connections->column('fd', Swoole\Table::TYPE_INT);
        $this->connections->column('connect_time', Swoole\Table::TYPE_INT);
        $this->connections->column('auth', Swoole\Table::TYPE_INT);
        $this->connections->column('name', Swoole\Table::TYPE_STRING, 32);
        $this->connections->create();

        $this->server = new Swoole\Server('0.0.0.0', 9501, SWOOLE_PROCESS);
        $this->configure();
        $this->registerEvents();
    }

    private function configure(): void
    {
        // Length-check protocol for automatic packet framing
        $this->server->set([
            'worker_num' => 4,
            'open_length_check'     => true,
            'package_max_length'    => 2 * 1024 * 1024, // 2MB max
            'package_length_type'   => 'N',              // 4-byte big-endian
            'package_length_offset' => 4,                // Length field at offset 4
            'package_body_offset'   => 8,                // Body starts at offset 8
            'heartbeat_check_interval' => 30,
            'heartbeat_idle_time'     => 60,
            'log_file' => '/tmp/tcp_server.log',
        ]);
    }

    private function registerEvents(): void
    {
        $this->server->on('workerStart', [$this, 'onWorkerStart']);
        $this->server->on('connect', [$this, 'onConnect']);
        $this->server->on('receive', [$this, 'onReceive']);
        $this->server->on('close', [$this, 'onClose']);
    }

    public function onWorkerStart(Swoole\Server $server, int $workerId): void
    {
        // Initialize per-worker resources
        echo "[Worker#{$workerId}] Ready\n";
    }

    public function onConnect(Swoole\Server $server, int $fd): void
    {
        $this->connections->set((string)$fd, [
            'fd' => $fd,
            'connect_time' => time(),
            'auth' => 0,
            'name' => '',
        ]);
        echo "[Connect] fd={$fd}, total=" . $this->connections->count() . "\n";

        // Request authentication
        $this->send($fd, ['type' => 'auth_required', 'msg' => 'Please authenticate']);
    }

    public function onReceive(Swoole\Server $server, int $fd, int $rid, string $data): void
    {
        // Swoole has already parsed the packet (open_length_check)
        // $data contains only the body (after package_body_offset)
        $payload = json_decode($data, true);

        if (!$payload || !isset($payload['type'])) {
            $this->send($fd, ['type' => 'error', 'msg' => 'Invalid payload']);
            return;
        }

        // Check authentication for non-auth commands
        $connInfo = $this->connections->get((string)$fd);
        if (!$connInfo['auth'] && $payload['type'] !== 'auth') {
            $this->send($fd, ['type' => 'error', 'msg' => 'Not authenticated']);
            return;
        }

        // Route command
        switch ($payload['type']) {
            case 'auth':
                $this->handleAuth($fd, $payload);
                break;
            case 'ping':
                $this->send($fd, ['type' => 'pong', 'ts' => time()]);
                break;
            case 'broadcast':
                $this->handleBroadcast($fd, $connInfo, $payload);
                break;
            case 'list':
                $this->handleList($fd);
                break;
            default:
                $this->send($fd, ['type' => 'echo', 'data' => $payload]);
        }
    }

    public function onClose(Swoole\Server $server, int $fd): void
    {
        $info = $this->connections->get((string)$fd);
        $name = $info ? $info['name'] : 'unknown';
        $this->connections->del((string)$fd);
        echo "[Close] fd={$fd} name={$name}\n";
    }

    private function handleAuth(int $fd, array $payload): void
    {
        $name = $payload['name'] ?? '';
        $token = $payload['token'] ?? '';

        // Simple token check
        if ($token !== 'secret123') {
            $this->send($fd, ['type' => 'auth_fail', 'msg' => 'Invalid token']);
            return;
        }

        $this->connections->set((string)$fd, ['auth' => 1, 'name' => $name]);
        $this->send($fd, ['type' => 'auth_ok', 'name' => $name]);
        echo "[Auth] fd={$fd} name={$name} authenticated\n";
    }

    private function handleBroadcast(int $fd, array $sender, array $payload): void
    {
        $msg = $payload['msg'] ?? '';
        $count = 0;

        foreach ($this->connections as $row) {
            if ($row['fd'] !== $fd && $row['auth'] && $this->server->exists($row['fd'])) {
                $this->send($row['fd'], [
                    'type' => 'broadcast',
                    'from' => $sender['name'],
                    'msg'  => $msg,
                    'ts'   => time(),
                ]);
                $count++;
            }
        }
        $this->send($fd, ['type' => 'broadcast_sent', 'count' => $count]);
    }

    private function handleList(int $fd): void
    {
        $list = [];
        foreach ($this->connections as $row) {
            if ($row['auth']) {
                $list[] = ['fd' => $row['fd'], 'name' => $row['name']];
            }
        }
        $this->send($fd, ['type' => 'list', 'clients' => $list]);
    }

    /**
     * Encode and send a packet with length-header protocol
     */
    private function send(int $fd, array $data): void
    {
        $body = json_encode($data, JSON_UNESCAPED_UNICODE);
        $packet = PACK_HEADER . pack('N', strlen($body)) . $body;
        $this->server->send($fd, $packet);
    }

    public function start(): void
    {
        $this->server->start();
    }
}

$server = new TcpServer();
$server->start();
```

### 协程TCP Client

```php
<?php
// tcp_client.php - Coroutine TCP client with length-header protocol

define('PACK_HEADER', pack('N', 0x53570100));

function sendPacket(Swoole\Coroutine\Client $client, array $data): void
{
    $body = json_encode($data, JSON_UNESCAPED_UNICODE);
    $packet = PACK_HEADER . pack('N', strlen($body)) . $body;
    $client->send($packet);
}

function recvPacket(Swoole\Coroutine\Client $client): ?array
{
    // Read header (8 bytes)
    $header = $client->recv(8);
    if (!$header || strlen($header) < 8) return null;

    // Parse body length (offset 4, 4 bytes)
    $bodyLen = unpack('N', substr($header, 4, 4))[1];

    // Read body
    $body = '';
    while (strlen($body) < $bodyLen) {
        $chunk = $client->recv($bodyLen - strlen($body));
        if (!$chunk) return null;
        $body .= $chunk;
    }

    return json_decode($body, true);
}

Swoole\Coroutine\run(function () {
    $client = new Swoole\Coroutine\Client(SWOOLE_SOCK_TCP);

    if (!$client->connect('127.0.0.1', 9501, 5)) {
        die("Connect failed: {$client->errMsg}\n");
    }

    // Receive auth_required
    $resp = recvPacket($client);
    echo "← " . json_encode($resp, JSON_UNESCAPED_UNICODE) . "\n";

    // Send auth
    sendPacket($client, ['type' => 'auth', 'name' => 'Client1', 'token' => 'secret123']);
    $resp = recvPacket($client);
    echo "← " . json_encode($resp, JSON_UNESCAPED_UNICODE) . "\n";

    // Send ping
    sendPacket($client, ['type' => 'ping']);
    $resp = recvPacket($client);
    echo "← " . json_encode($resp, JSON_UNESCAPED_UNICODE) . "\n";

    // List clients
    sendPacket($client, ['type' => 'list']);
    $resp = recvPacket($client);
    echo "← " . json_encode($resp, JSON_UNESCAPED_UNICODE) . "\n";

    // Close
    $client->close();
});
```

## 四、执行预览

**服务器端：**
```
$ php tcp_server.php
[Worker#0] Ready
[Worker#1] Ready
[Connect] fd=1, total=1
[Auth] fd=1 name=Client1 authenticated
[Close] fd=1 name=Client1
```

**客户端：**
```
$ php tcp_client.php
← {"type":"auth_required","msg":"Please authenticate"}
← {"type":"auth_ok","name":"Client1"}
← {"type":"pong","ts":1745856000}
← {"type":"list","clients":[{"fd":1,"name":"Client1"}]}
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 粘包 | TCP字节流无消息边界 | 必须使用协议解析 |
| 大包 | package_max_length默认2MB | 根据业务调整 |
| 心跳 | 客户端需定时发ping | 建议间隔30秒以内 |
| fd复用 | 连接关闭后fd可能被新连接使用 | 不要用fd做长期标识 |
| 协议一致性 | Client和Server必须用同一协议 | 封装协议类复用 |
| Table内存 | 预分配固定大小 | 按最大连接数设置 |

## 六、避坑指南

### ❌ 坑1：不处理粘包直接recv
```php
<?php
// ❌ Wrong: Raw TCP recv may merge or split packets
$client->send('hello');
$client->send('world');
$data = $client->recv(); // May get "helloworld"
```

```php
<?php
// ✅ Correct: Use length-header protocol
$body = json_encode(['msg' => 'hello']);
$packet = pack('N', strlen($body)) . $body;
$client->send($packet);
```

### ❌ 坑2：package_body_offset设置错误
```php
<?php
// ❌ Wrong: offset mismatch with actual header format
$server->set([
    'open_length_check' => true,
    'package_length_offset' => 0,  // Wrong if header has magic bytes
    'package_body_offset'   => 4,  // Should be header + length = 8
]);
```

```php
<?php
// ✅ Correct: Match the actual packet structure
// Packet: [magic:4][length:4][body:N]
$server->set([
    'open_length_check'     => true,
    'package_length_type'   => 'N',
    'package_length_offset' => 4,   // Length field at byte 4
    'package_body_offset'   => 8,   // Body starts at byte 8
]);
```

### ❌ 坑3：广播时遍历连接列表发送，部分fd已失效
```php
<?php
// ❌ Wrong: fd may have been closed between check and send
foreach ($connections as $fd) {
    $server->send($fd, $data); // Warning if fd closed
}
```

```php
<?php
// ✅ Correct: Check existence before sending
foreach ($connections as $row) {
    if ($server->exists($row['fd'])) {
        $server->send($row['fd'], $data);
    }
}
```

## 七、练习题

### 🟢 基础题
1. 使用EOF分隔符协议（`open_eof_check`）实现一个简单的TCP Echo服务器
2. 编写一个TCP Client，连接后每5秒发送一次心跳包

### 🟡 进阶题
3. 实现一个简单的IM聊天室：客户端可以发送消息给所有在线用户
4. 为TCP服务器添加TLS加密支持

### 🔴 挑战题
5. 实现一个完整的RPC框架：支持服务注册、发现、调用，使用长度头协议序列化

<details>
<summary>参考答案（基础题1）</summary>

```php
<?php
$server = new Swoole\Server('0.0.0.0', 9501);
$server->set([
    'open_eof_check' => true,
    'package_eof'    => "\r\n",
]);
$server->on('receive', function ($server, $fd, $rid, $data) {
    $server->send($fd, "Echo: " . trim($data) . "\r\n");
});
$server->start();
```
</details>

## 八、知识点总结

```
TCP服务器知识树
├── 粘包处理
│   ├── EOF分隔符 (open_eof_check)
│   ├── 固定长度
│   └── 长度头 (open_length_check) ★
├── 协议设计
│   ├── Magic + Length + Body
│   ├── JSON / 二进制编码
│   └── 大端字节序 (pack N)
├── 连接管理
│   ├── Swoole\Table共享
│   ├── 认证机制
│   └── 广播遍历 + exists检查
├── 心跳机制
│   ├── heartbeat_check_interval
│   └── heartbeat_idle_time
└── 安全
    ├── Token认证
    └── SSL/TLS (ssl_cert_file)
```

## 九、举一反三

| 场景 | 协议选择 | 实现方式 |
|------|---------|----------|
| 简单Echo | EOF分隔符 | open_eof_check + package_eof |
| 游戏服务器 | 长度头+二进制 | open_length_check + 自定义序列化 |
| IoT设备 | 长度头+Protobuf | open_length_check + protobuf解码 |
| IM聊天 | 长度头+JSON | open_length_check + JSON |
| 文件传输 | 长度头+分块 | 按块发送，接收端拼装 |

## 十、参考资料

- [Swoole TCP Server文档](https://wiki.swoole.com/#/server/tcp)
- [Swoole粘包处理](https://wiki.swoole.com/#/learn?id=tcp_sticky_packet)
- [Swoole长度检查协议](https://wiki.swoole.com/#/server/setting?id=open_length_check)
- [pack/unpack格式说明](https://www.php.net/manual/en/function.pack.php)

## 十一、代码演进

### v1：原始TCP Echo（无粘包处理）
```php
<?php
// v1: No protocol, raw echo
$server = new Swoole\Server('0.0.0.0', 9501);
$server->on('receive', function ($s, $fd, $rid, $data) {
    $s->send($fd, $data); // May have sticky packet issues
});
$server->start();
```

### v2：EOF分隔符协议
```php
<?php
// v2: EOF-delimited protocol
$server = new Swoole\Server('0.0.0.0', 9501);
$server->set([
    'open_eof_check' => true,
    'package_eof'    => "\n",
]);
$server->on('receive', function ($s, $fd, $rid, $data) {
    $s->send($fd, "Echo: " . trim($data) . "\n");
});
$server->start();
```

### v3：完整长度头协议（含认证、广播、心跳）
见上方「生产级TCP服务器」完整代码。

---

**下期预告：** 004-UDP服务器，将讲解UDP的特点、适用场景和实现方式。
