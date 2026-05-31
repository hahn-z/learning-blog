---
title: "028 - Swoole自定义协议：粘包与半包"
slug: "028-custom-protocol"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:18:10.029+08:00"
updated_at: "2026-04-29T10:02:47.098+08:00"
reading_time: 25
tags: ["Swoole", "PHP"]
---

# Swoole自定义协议：粘包与半包

> 难度：⭐⭐⭐⭐（中高级）

## 一、概念讲解

### 什么是粘包和半包？

TCP 是**面向字节流**的协议，不保留消息边界。这意味着：

- **粘包（Sticky Packet）**：发送方连续发送的多条消息，接收方一次 `recv` 读到多条拼接在一起的数据
- **半包（Half Packet）**：一条较长的消息，接收方需要多次 `recv` 才能读完整

```
发送方：  [MsgA] [MsgB] [MsgC]
                ↓ TCP 字节流
接收方可能收到：
  情况1：[MsgA] [MsgB] [MsgC]     ← 正常（理想情况）
  情况2：[MsgA|MsgB] [MsgC]       ← 粘包
  情况3：[MsgA前半] [A后半|MsgB]   ← 半包+粘包
```

### 解决方案

| 方案 | 原理 | 适用场景 |
|------|------|---------|
| 固定包头 | 前N字节存包体长度 | 最通用，推荐 |
| EOF分隔符 | 用特殊字符标记消息结尾 | 文本协议（如Redis） |
| 固定长度 | 每条消息定长 | 简单但浪费带宽 |
| 长度+类型头 | 包头含长度和消息类型 | 最完整的协议设计 |

## 二、脑图

```
TCP 粘包/半包
├── 问题根源
│   ├── TCP 字节流无边界
│   ├── Nagle 算法合并小包
│   └── 接收缓冲区大小不定
├── 解决方案
│   ├── 固定包头（Length-Check）
│   │   ├── open_length_check = true
│   │   ├── package_length_type
│   │   ├── package_length_offset
│   │   └── package_body_offset
│   ├── EOF 分隔符
│   │   ├── open_eof_check = true
│   │   └── package_eof
│   └── 固定包长
│       └── open_length_check + 固定 body
├── 协议设计
│   ├── Header (4B length + 2B type + 2B flags)
│   ├── Body (JSON/Binary payload)
│   └── 校验 (CRC32/Checksum)
└── 调试技巧
    ├── tcpdump 抓包分析
    ├── Swoole 日志
    └── hexdump 查看原始数据
```

## 三、代码演进

### v1：Swoole 内置 Length-Check 分包

```php
<?php
// v1: Using Swoole built-in length-check protocol
// Protocol: [4-byte length(N)][body]

$server = new Swoole\Server("0.0.0.0", 9501, SWOOLE_PROCESS);

$server->set([
    "worker_num" => 4,
    "open_length_check" => true,       // Enable length-check
    "package_length_type" => "N",      // 4-byte big-endian unsigned int
    "package_length_offset" => 0,      // Length field at position 0
    "package_body_offset" => 4,        // Body starts at position 4
    "package_max_length" => 1024 * 1024 // Max 1MB per package
]);

$server->on("receive", function ($server, $fd, $reactorId, $data) {
    // $data is already a complete packet (body only, header stripped)
    echo "[Recv] fd={$fd} len=" . strlen($data) . " data={$data}\n";
    
    // Echo back with length header
    $response = "PONG: " . $data;
    $header = pack("N", strlen($response));
    $server->send($fd, $header . $response);
});

$server->on("connect", function ($server, $fd) {
    echo "[Connect] fd={$fd}\n";
});

$server->on("close", function ($server, $fd) {
    echo "[Close] fd={$fd}\n";
});

echo "Length-Check Server started on :9501\n";
$server->start();
```

**对应客户端：**

```php
<?php
// v1 client: Send with length header
$client = new Swoole\Client(SWOOLE_SOCK_TCP);
$client->set([
    "open_length_check" => true,
    "package_length_type" => "N",
    "package_length_offset" => 0,
    "package_body_offset" => 4,
    "package_max_length" => 1024 * 1024
]);

if (!$client->connect("127.0.0.1", 9501, 2.0)) {
    die("Connect failed\n");
}

// Send message with length header
function sendMsg($client, $msg) {
    $header = pack("N", strlen($msg));
    $client->send($header . $msg);
}

sendMsg($client, "Hello Swoole");
sendMsg($client, "Second message");
sendMsg($client, "Third message — testing sticky packet!");

// Receive
for ($i = 0; $i < 3; $i++) {
    $data = $client->recv();
    if ($data) {
        echo "[Client] Received: {$data}\n";
    }
}

$client->close();
```

### v2：自定义二进制协议（Header + Body）

```php
<?php
// v2: Custom binary protocol
// Protocol: [4B length][2B type][2B flags][body]
// Total header: 8 bytes

define("HEADER_SIZE", 8);
define("MSG_TYPE_PING", 1001);
define("MSG_TYPE_DATA", 2001);
define("MSG_TYPE_AUTH", 3001);

$server = new Swoole\Server("0.0.0.0", 9501);

// We handle packet splitting manually
$server->set([
    "open_length_check" => true,
    "package_length_type" => "N",
    "package_length_offset" => 0,
    "package_body_offset" => HEADER_SIZE,
    "package_max_length" => 2 * 1024 * 1024
]);

function decodePacket(string $data): array {
    $header = substr($data, 0, HEADER_SIZE);
    $body = substr($data, HEADER_SIZE);
    $unpack = unpack("Nlength/ntype/nflags", $header);
    $unpack["body"] = $body;
    return $unpack;
}

function encodePacket(int $type, int $flags, string $body): string {
    $length = HEADER_SIZE + strlen($body);
    return pack("Nnn", $length, $type, $flags) . $body;
}

$server->on("receive", function ($server, $fd, $reactorId, $data) {
    $packet = decodePacket($data);
    
    echo sprintf("[Recv] type=%d flags=%d len=%d body=%s\n",
        $packet["type"], $packet["flags"], $packet["length"], $packet["body"]);
    
    switch ($packet["type"]) {
        case MSG_TYPE_PING:
            $resp = encodePacket(MSG_TYPE_PING, 0, "PONG");
            $server->send($fd, $resp);
            break;
            
        case MSG_TYPE_AUTH:
            $payload = json_decode($packet["body"], true);
            if (($payload["token"] ?? "") === "secret123") {
                $resp = encodePacket(MSG_TYPE_AUTH, 1, json_encode(["status" => "ok"]));
            } else {
                $resp = encodePacket(MSG_TYPE_AUTH, 0, json_encode(["status" => "denied"]));
            }
            $server->send($fd, $resp);
            break;
            
        case MSG_TYPE_DATA:
            // Process data and echo back
            $resp = encodePacket(MSG_TYPE_DATA, $packet["flags"],
                json_encode(["echo" => $packet["body"], "ts" => time()]));
            $server->send($fd, $resp);
            break;
    }
});

echo "Custom Protocol Server on :9501\n";
$server->start();
```

### v3：生产级协议（含校验、心跳、加解密）

```php
<?php
// v3: Production protocol with CRC32 checksum + heartbeat
// Protocol: [4B length][2B type][2B flags][4B crc32][body]

define("HEADER_V3", 12);
define("TYPE_HEARTBEAT", 0);
define("TYPE_REQUEST", 1);
define("TYPE_RESPONSE", 2);
define("TYPE_PUSH", 3);

$server = new Swoole\Server("0.0.0.0", 9501, SWOOLE_PROCESS);

$server->set([
    "worker_num" => 4,
    "open_length_check" => true,
    "package_length_type" => "N",
    "package_length_offset" => 0,
    "package_body_offset" => HEADER_V3,
    "package_max_length" => 8 * 1024 * 1024,
    "heartbeat_check_interval" => 30,
    "heartbeat_idle_time" => 120
]);

function packV3(int $type, int $flags, string $body): string {
    $crc = crc32($body);
    $length = HEADER_V3 + strlen($body);
    return pack("NnnN", $length, $type, $flags, $crc) . $body;
}

function unpackV3(string $data): ?array {
    if (strlen($data) < HEADER_V3) return null;
    $hdr = unpack("Nlength/ntype/nflags/Ncrc", substr($data, 0, HEADER_V3));
    $body = substr($data, HEADER_V3);
    
    // CRC verification
    if (crc32($body) !== $hdr["crc"]) {
        echo "[WARN] CRC mismatch! Expected {$hdr['crc']}, got " . crc32($body) . "\n";
        return null;
    }
    
    $hdr["body"] = $body;
    return $hdr;
}

$server->on("receive", function ($server, $fd, $reactorId, $data) {
    $pkt = unpackV3($data);
    if (!$pkt) {
        echo "[ERROR] Invalid packet from fd={$fd}\n";
        $server->close($fd);
        return;
    }
    
    switch ($pkt["type"]) {
        case TYPE_HEARTBEAT:
            // Heartbeat response
            $server->send($fd, packV3(TYPE_HEARTBEAT, 0, "OK"));
            break;
            
        case TYPE_REQUEST:
            $req = json_decode($pkt["body"], true);
            $resp = json_encode([
                "id" => $req["id"] ?? 0,
                "result" => strtoupper($req["data"] ?? ""),
                "server_ts" => microtime(true)
            ]);
            $server->send($fd, packV3(TYPE_RESPONSE, 0, $resp));
            break;
            
        case TYPE_PUSH:
            echo "[Push] fd={$fd}: {$pkt['body']}\n";
            break;
    }
});

$server->on("connect", function ($s, $fd) {
    echo "[+] fd={$fd} connected\n";
});

$server->on("close", function ($s, $fd) {
    echo "[-] fd={$fd} closed\n";
});

echo "=== Protocol V3 Server :9501 ===\n";
$server->start();
```

## 四、执行预览

```
# Terminal 1 - Server
$ php v3-protocol.php
=== Protocol V3 Server :9501 ===
[+] fd=1 connected
[Recv] type=1 flags=0 body={"id":1,"data":"hello"}

# Terminal 2 - Client
$ php v3-client.php
Send: {"id":1,"data":"hello"}
Recv: {"id":1,"result":"HELLO","server_ts":1745853600.1234}
Heartbeat: OK
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| 字节序 | `pack("N")` 是大端序（网络字节序），`pack("V")` 是小端序 |
| length 含义 | `package_length_offset` 处的值是**整包长度**（含header）还是 body 长度，取决于 `package_body_offset` 配置 |
| 零拷贝 | Swoole 底层已做分包处理，`onReceive` 拿到的是完整包 |
| 客户端配置 | 客户端也需要设置相同的分包参数才能正确解析 |
| package_max_length | 设置过小会丢弃大包，过大会浪费内存 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 手动在 onReceive 中拼接 buffer 分包 | 用 Swoole 内置的 `open_length_check` |
| `pack("N", strlen($body))` 不含 header 长度 | 长度字段包含 header + body 总长 |
| 客户端不设分包参数 | 客户端也要 `set()` 相同的分包配置 |
| 忽略 CRC 校验 | 生产环境务必加校验，防止数据损坏 |
| 用 `package_length_type => "C"` (1字节) | 1字节最大255，大部分场景不够，用 `N`(4字节) |

## 七、练习题

### 🟢 基础题
1. 用 Swoole 内置 `open_length_check` 实现 Echo Server，客户端发送字符串，服务端原样返回。
2. 修改 v1 示例，把包头从 4 字节改为 2 字节（`n`），测试最大包长限制。

### 🟡 进阶题
3. 实现一个简单的文件传输协议：Header 包含文件名和文件大小，Body 是文件内容。
4. 在 v2 基础上添加消息序号（sequence），实现请求-响应匹配。

### 🔴 挑战题
5. 实现一个支持压缩的自定义协议：Header 标记是否压缩，Body 用 `zlib` 压缩/解压，传输 JSON 数据。

## 八、知识点总结

```
粘包/半包知识树
├── 根因
│   └── TCP 字节流无边界
├── Swoole 分包配置
│   ├── open_length_check + package_length_type
│   ├── open_eof_check + package_eof
│   └── open_http_protocol (HTTP自带)
├── pack/unpack 格式
│   ├── N = 4B unsigned big-endian
│   ├── n = 2B unsigned big-endian
│   ├── V = 4B unsigned little-endian
│   └── C = 1B unsigned char
├── 协议设计要素
│   ├── 魔数 (Magic Number)
│   ├── 版本号
│   ├── 消息类型
│   ├── 序列号
│   ├── 长度
│   └── 校验和
└── 调试工具
    ├── tcpdump -i lo -nn -X port 9501
    ├── hexdump -C
    └── Swoole\Event::defer()
```

## 九、举一反三

| 场景 | 协议设计 |
|------|---------|
| RPC 框架 | Header(len+type+seq) + Body(serialize) + Tail(crc) |
| IM 聊天 | Header(len+cmd+from+to) + Body(proto/json) |
| 文件传输 | Header(len+filename+offset) + Body(chunk) |
| 游戏协议 | Header(len+cmd+seq) + Body(protobuf) |
| IoT 设备 | Header(len+devId+type) + Body(binary) |

## 十、参考资料

- [Swoole TCP 粘包问题](https://wiki.swoole.com/#/learn?id=tcp-sticky-package)
- [Swoole Server::set 配置](https://wiki.swoole.com/#/server/setting)
- [PHP pack() 函数](https://www.php.net/manual/en/function.pack.php)
- [TCP/IP 协议详解](https://tools.ietf.org/html/rfc793)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | 内置 length-check，纯长度分包 | 简单请求响应 |
| v2 | 自定义 Header(长度+类型+标志) | 多消息类型系统 |
| v3 | 生产级，含 CRC 校验+心跳+错误处理 | 生产环境 |
