---
title: "004 - Swoole实战教程004：UDP服务器"
slug: "004-udp-server"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:42.608+08:00"
updated_at: "2026-04-29T10:02:46.883+08:00"
reading_time: 33
tags: ["Swoole", "PHP"]
---

# Swoole实战教程004：UDP服务器

> **难度标注：** 🟡 中级 | 预计学习时间：40分钟

## 一、概念讲解

### UDP vs TCP

UDP（User Datagram Protocol）是面向无连接的传输层协议：

| 对比维度 | TCP | UDP |
|---------|-----|-----|
| 连接 | 面向连接（三次握手） | 无连接 |
| 可靠性 | 可靠传输 | 不保证送达 |
| 顺序 | 保证顺序 | 不保证 |
| 速度 | 较慢（握手/确认） | 快速 |
| 头部 | 20字节 | 8字节 |
| 适用 | 文件传输、Web | DNS、视频流、游戏 |

### UDP适用场景

- **DNS服务**：查询快、无状态
- **日志采集**：允许少量丢失，追求吞吐
- **实时监控**：指标上报，不需要确认
- **音视频流**：实时性 > 可靠性
- **游戏同步**：位置更新，允许丢帧
- **服务发现**：广播/多播通知

### Swoole UDP Server特点

- 事件：`onPacket`（而非onReceive）
- 每个数据包独立，无连接概念
- 使用`sendto()`发送（而非send）
- 不需要心跳机制（无连接）
- 可以和TCP Server共享同一个Swoole\Server实例

## 二、脑图

```
UDP服务器
├── 核心概念
│   ├── 无连接 (connectionless)
│   ├── 不可靠 (unreliable)
│   └── 数据报 (datagram)
├── Swoole实现
│   ├── SWOOLE_UDP 模式
│   ├── onPacket 事件
│   ├── sendto() 方法
│   └── 多端口监听 (TCP+UDP)
├── 典型应用
│   ├── DNS服务模拟
│   ├── 日志采集 Agent
│   ├── 监控指标上报
│   └── 广播/多播
└── 注意事项
    ├── 包大小限制 (64KB)
    ├── 不保证送达
    └── MTU分片问题
```

## 三、完整代码

### 基础UDP服务器

```php
<?php
// udp_server.php - Basic UDP echo server

$server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);

$server->set([
    'worker_num' => 2,
    'log_file'   => '/tmp/udp_server.log',
]);

// UDP uses onPacket event, not onReceive
$server->on('packet', function (Swoole\Server $server, string $data, array $clientInfo) {
    $addr = $clientInfo['address'];
    $port = $clientInfo['port'];
    $msg  = trim($data);

    echo "[Packet] From {$addr}:{$port} → {$msg}\n";

    // Echo back
    $server->sendto($addr, $port, "UDP Echo: {$msg}\n");
});

$server->start();
```

### 完整监控指标服务

```php
<?php
// metrics_server.php - UDP metrics collection server

class MetricsServer
{
    private Swoole\Server $server;
    private Swoole\Table $metrics;

    // Supported metric types
    private const TYPE_COUNTER = 'counter';
    private const TYPE_GAUGE   = 'gauge';
    private const TYPE_HISTOGRAM = 'histogram';

    public function __construct()
    {
        // Shared metrics storage
        $this->metrics = new Swoole\Table(1024);
        $this->metrics->column('name', Swoole\Table::TYPE_STRING, 64);
        $this->metrics->column('type', Swoole\Table::TYPE_STRING, 16);
        $this->metrics->column('value', Swoole\Table::TYPE_FLOAT);
        $this->metrics->column('count', Swoole\Table::TYPE_INT);
        $this->metrics->column('updated', Swoole\Table::TYPE_INT);
        $this->metrics->create();

        // Create TCP+UDP hybrid server
        $this->server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);
        $this->server->set([
            'worker_num' => 2,
            'log_file'   => '/tmp/metrics_server.log',
        ]);

        $this->registerEvents();
    }

    private function registerEvents(): void
    {
        $this->server->on('packet', [$this, 'onPacket']);

        // Add a TCP port for querying metrics
        $tcpPort = $this->server->listen('0.0.0.0', 9503, SWOOLE_TCP);
        $tcpPort->set([
            'open_eof_check' => true,
            'package_eof'    => "\n",
        ]);
        $tcpPort->on('receive', [$this, 'onTcpReceive']);
    }

    public function onPacket(Swoole\Server $server, string $data, array $clientInfo): void
    {
        $payload = json_decode(trim($data), true);

        if (!$payload || !isset($payload['name'])) {
            $server->sendto(
                $clientInfo['address'],
                $clientInfo['port'],
                json_encode(['error' => 'Invalid payload'])
            );
            return;
        }

        $name  = $payload['name'];
        $type  = $payload['type'] ?? self::TYPE_COUNTER;
        $value = (float)($payload['value'] ?? 1);

        $this->updateMetric($name, $type, $value);

        // Optional acknowledgment
        if (!empty($payload['ack'])) {
            $server->sendto(
                $clientInfo['address'],
                $clientInfo['port'],
                json_encode(['status' => 'ok', 'name' => $name])
            );
        }
    }

    public function onTcpReceive(Swoole\Server $server, int $fd, int $rid, string $data): void
    {
        $cmd = trim($data);

        switch ($cmd) {
            case 'all':
                $result = [];
                foreach ($this->metrics as $row) {
                    $result[] = $row;
                }
                $server->send($fd, json_encode($result, JSON_PRETTY_PRINT) . "\n");
                break;

            case 'count':
                $server->send($fd, json_encode(['count' => $this->metrics->count()]) . "\n");
                break;

            default:
                // Query specific metric: "get:metric_name"
                if (str_starts_with($cmd, 'get:')) {
                    $name = substr($cmd, 4);
                    $row = $this->metrics->get($name);
                    $server->send($fd, json_encode($row ?: ['error' => 'Not found']) . "\n");
                } else {
                    $server->send($fd, "Commands: all, count, get:<name>\n");
                }
                break;
        }
    }

    private function updateMetric(string $name, string $type, float $value): void
    {
        $existing = $this->metrics->get($name);

        if ($existing) {
            $newValue = match ($type) {
                self::TYPE_COUNTER => $existing['value'] + $value,
                self::TYPE_GAUGE   => $value,
                self::TYPE_HISTOGRAM => $existing['value'] + $value,
                default => $existing['value'] + $value,
            };
            $this->metrics->set($name, [
                'value'   => $newValue,
                'count'   => $existing['count'] + 1,
                'updated' => time(),
            ]);
        } else {
            $this->metrics->set($name, [
                'name'    => $name,
                'type'    => $type,
                'value'   => $value,
                'count'   => 1,
                'updated' => time(),
            ]);
        }
    }

    public function start(): void
    {
        echo "Metrics UDP server on :9502, TCP query on :9503\n";
        $this->server->start();
    }
}

$server = new MetricsServer();
$server->start();
```

### UDP指标上报Client

```php
<?php
// metrics_client.php - UDP metrics reporting client

Swoole\Coroutine\run(function () {
    // Create UDP client
    $client = new Swoole\Coroutine\Client(SWOOLE_SOCK_UDP);
    $client->connect('127.0.0.1', 9502, 5);

    // Report various metrics
    $metrics = [
        ['name' => 'api.requests', 'type' => 'counter', 'value' => 1, 'ack' => true],
        ['name' => 'api.latency_ms', 'type' => 'gauge', 'value' => 42.5],
        ['name' => 'api.errors', 'type' => 'counter', 'value' => 1],
        ['name' => 'cpu.usage', 'type' => 'gauge', 'value' => 65.3],
        ['name' => 'memory.mb', 'type' => 'gauge', 'value' => 512],
    ];

    foreach ($metrics as $metric) {
        $payload = json_encode($metric);
        $client->send($payload);
        echo "Sent: {$metric['name']} = {$metric['value']}\n";

        // Wait for ack if requested
        if (!empty($metric['ack'])) {
            $resp = $client->recv(2);
            if ($resp) echo "  Ack: " . trim($resp) . "\n";
        }

        Swoole\Coroutine\System::sleep(0.1);
    }

    $client->close();
    echo "\nAll metrics sent!\n";
});
```

### DNS服务模拟

```php
<?php
// dns_simulator.php - Simple DNS-like UDP service

$server = new Swoole\Server('0.0.0.0', 9504, SWOOLE_PROCESS, SWOOLE_UDP);

// Simulated DNS records
$records = [
    'example.com'  => ['A' => '93.184.216.34', 'TTL' => 300],
    'google.com'   => ['A' => '142.250.80.46', 'TTL' => 300],
    'localhost'    => ['A' => '127.0.0.1', 'TTL' => 60],
    'test.local'   => ['A' => '192.168.1.100', 'TTL' => 60],
];

$server->on('packet', function ($server, $data, $clientInfo) use ($records) {
    $query = trim($data);
    echo "[DNS Query] {$query} from {$clientInfo['address']}:{$clientInfo['port']}\n";

    // Parse query: "example.com A" or just "example.com"
    $parts = explode(' ', $query);
    $domain = strtolower($parts[0]);
    $type   = $parts[1] ?? 'A';

    if (isset($records[$domain])) {
        $record = $records[$domain];
        $response = json_encode([
            'domain' => $domain,
            'type'   => $type,
            'ip'     => $record['A'],
            'ttl'    => $record['TTL'],
        ]);
    } else {
        $response = json_encode([
            'domain' => $domain,
            'error'  => 'NXDOMAIN',
        ]);
    }

    $server->sendto($clientInfo['address'], $clientInfo['port'], $response);
});

$server->start();
```

## 四、执行预览

**终端1：启动监控服务**
```bash
$ php metrics_server.php
Metrics UDP server on :9502, TCP query on :9503
```

**终端2：上报指标**
```bash
$ php metrics_client.php
Sent: api.requests = 1
  Ack: {"status":"ok","name":"api.requests"}
Sent: api.latency_ms = 42.5
Sent: api.errors = 1
Sent: cpu.usage = 65.3
Sent: memory.mb = 512

All metrics sent!
```

**终端3：查询指标**
```bash
$ echo "all" | nc 127.0.0.1 9503
[
    {"name":"api.requests","type":"counter","value":1,"count":1,"updated":1745856000},
    {"name":"api.latency_ms","type":"gauge","value":42.5,"count":1,"updated":1745856000}
]

$ echo "get:cpu.usage" | nc 127.0.0.1 9503
{"name":"cpu.usage","type":"gauge","value":65.3,"count":1,"updated":1745856000}
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 包大小 | UDP最大64KB（实际建议<1400字节避免分片） | 超过MTU会分片，增加丢包率 |
| 可靠性 | UDP不保证送达 | 关键数据加ACK或用TCP |
| 顺序 | 数据包可能乱序到达 | 加序列号处理 |
| 安全 | UDP易被伪造源地址 | 生产环境加认证 |
| 缓冲区 | 系统UDP缓冲区有限 | 调整net.core.rmem_max |
| 事件名 | UDP用onPacket，不是onReceive | 注意区分 |

## 六、避坑指南

### ❌ 坑1：用UDP发送大量数据
```php
<?php
// ❌ Wrong: Large UDP packets will fragment and likely fail
$data = str_repeat('x', 60000);
$client->send($data); // Likely lost or truncated
```

```php
<?php
// ✅ Correct: Keep UDP payloads under 1400 bytes (safe MTU)
$maxPayload = 1400;
$chunks = str_split($data, $maxPayload);
foreach ($chunks as $i => $chunk) {
    $packet = json_encode(['seq' => $i, 'total' => count($chunks), 'data' => $chunk]);
    $client->send($packet);
}
```

### ❌ 坑2：用onReceive接收UDP数据
```php
<?php
// ❌ Wrong: UDP server uses onPacket, not onReceive
$server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);
$server->on('receive', function (...) { }); // Never triggered!
$server->start();
```

```php
<?php
// ✅ Correct: Use onPacket for UDP
$server->on('packet', function ($server, $data, $clientInfo) {
    // $clientInfo contains 'address' and 'port'
});
```

### ❌ 坑3：UDP客户端不connect也能发，但recv需要connect
```php
<?php
// ❌ Wrong: recv() without connect() will not work as expected
$client = new Swoole\Coroutine\Client(SWOOLE_SOCK_UDP);
$client->sendto('127.0.0.1', 9502, 'hello');
$resp = $client->recv(); // May fail
```

```php
<?php
// ✅ Correct: connect() first for bidirectional communication
$client = new Swoole\Coroutine\Client(SWOOLE_SOCK_UDP);
$client->connect('127.0.0.1', 9502, 5);
$client->send('hello');
$resp = $client->recv(2); // 2 second timeout
```

## 七、练习题

### 🟢 基础题
1. 创建一个UDP Echo服务器，监听9502端口，将收到的消息原样返回
2. 编写一个UDP客户端，向服务器发送10条消息并接收回复

### 🟡 进阶题
3. 实现一个简单的Syslog收集器：通过UDP接收日志，按级别（INFO/WARN/ERROR）分类存储
4. 实现一个心跳检测工具：客户端定时发UDP包，服务端统计丢包率

### 🔴 挑战题
5. 实现一个简单的服务发现系统：服务启动时通过UDP广播注册，客户端通过UDP多播查询可用服务

<details>
<summary>参考答案（基础题1）</summary>

```php
<?php
$server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);
$server->on('packet', function ($server, $data, $info) {
    $server->sendto($info['address'], $info['port'], $data);
});
$server->start();
```
</details>

## 八、知识点总结

```
UDP服务器知识树
├── 核心概念
│   ├── 无连接 → onPacket事件
│   ├── sendto(addr, port, data)
│   └── 无序/不可靠
├── Swoole UDP
│   ├── SWOOLE_UDP模式
│   ├── 多端口 TCP+UDP
│   └── Coroutine\Client(SWOOLE_SOCK_UDP)
├── 典型应用
│   ├── 监控指标上报 ★
│   ├── 日志收集
│   ├── DNS模拟
│   └── 服务发现/广播
└── 限制
    ├── 64KB最大包
    ├── MTU分片 (建议<1400B)
    └── 不保证送达
```

## 九、举一反三

| 场景 | UDP适用性 | 实现方式 |
|------|----------|----------|
| 监控指标 | ★★★ 最佳 | fire-and-forget上报 |
| 日志采集 | ★★★ 最佳 | 批量压缩后UDP发送 |
| DNS查询 | ★★★ 标准 | UDP查询+响应 |
| 文件传输 | ★ 不适合 | 用TCP |
| 实时游戏 | ★★★ 常见 | 位置同步用UDP，关键操作用TCP |
| API服务 | ★★ 需ACK | UDP+应用层ACK |

## 十、参考资料

- [Swoole UDP Server文档](https://wiki.swoole.com/#/server/udp)
- [Swoole onPacket事件](https://wiki.swoole.com/#/server/events?id=onpacket)
- [UDP协议RFC 768](https://tools.ietf.org/html/rfc768)
- [Linux UDP性能调优](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/7/html/performance_tuning_guide/network-udp)

## 十一、代码演进

### v1：最简UDP Echo
```php
<?php
// v1: Minimal UDP echo
$server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);
$server->on('packet', function ($server, $data, $info) {
    $server->sendto($info['address'], $info['port'], $data);
});
$server->start();
```

### v2：带JSON解析的UDP服务
```php
<?php
// v2: JSON-based UDP service
$server = new Swoole\Server('0.0.0.0', 9502, SWOOLE_PROCESS, SWOOLE_UDP);
$server->on('packet', function ($server, $data, $info) {
    $payload = json_decode(trim($data), true);
    if (!$payload) {
        $server->sendto($info['address'], $info['port'], '{"error":"invalid JSON"}');
        return;
    }
    $response = json_encode(['echo' => $payload, 'ts' => time()]);
    $server->sendto($info['address'], $info['port'], $response);
});
$server->start();
```

### v3：完整监控服务（TCP查询+UDP上报+指标存储）
见上方「完整监控指标服务」代码。

---

**下期预告：** 005-HTTP服务器，将讲解Swoole HTTP Server的开发、路由设计、性能优化等核心内容。
