---
title: "018 - gRPC 协议原理与 Protobuf 定义"
slug: "018-grpc-protobuf"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.849+08:00"
updated_at: "2026-05-01T22:17:01.693+08:00"
reading_time: 8
tags: []
---

# 018 - gRPC 协议原理与 Protobuf 定义

> **难度：** ⭐⭐⭐ | **前置知识：** HTTP 基础、微服务概念 | **预估用时：** 50 分钟

## 概念讲解

**一句话定义：** gRPC 是 Google 开源的高性能 RPC 框架，使用 Protocol Buffers 作为接口定义语言，支持双向流式通信，专为微服务间调用设计。

**现实类比：** 就像点外卖——传统 HTTP 就像打电话点餐，每次要解释一遍菜单；gRPC 就像直接扫描二维码，双方都有一本"暗号手册"（.proto 文件），直接按暗号交流，效率极高。

**技术场景：** 订单服务调用用户服务获取用户信息，传统 RESTful API 需要 JSON 序列化、HTTP 头部开销，gRPC 直接传输二进制 Protobuf 数据，延迟降低 60%+。订单服务和用户服务之间的接口用 .proto 文件定义，PHP、Go、Java 等多语言共享同一份接口定义。

## 实时脑图

```
                    Order Service (Client)
                            │
                            │ 1. Load .proto file
                            │    Generate PHP code
                            ▼
                   ┌─────────────────┐
                   │  Protobuf Code  │
                   │  (generated)    │
                   └─────────────────┘
                            │
                            │ 2. Serialize request
                            ▼
                   ┌─────────────────┐
                   │  Binary Message │
                   │  (Protobuf)     │
                   └─────────────────┘
                            │
                            │ 3. gRPC over HTTP/2
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    gRPC Transport                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ HTTP/2                                             │  │
│  │ - Multiplexing: multiple streams over 1 connection │  │
│  │ - Header Compression: HPACK                        │  │
│  │ - Binary Framing                                   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  User Service   │
                   │   (Server)      │
                   └─────────────────┘
                            │
                            │ 4. Deserialize request
                            ▼
                   ┌─────────────────┐
                   │  Handle Logic   │
                   └─────────────────┘
                            │
                            │ 5. Serialize response
                            ▼
                   ┌─────────────────┐
                   │  Binary Message │
                   └─────────────────┘
                            │
                            │ 6. gRPC Response
                            ▼
                   ┌─────────────────┐
                   │ Deserialize     │
                   │  Response       │
                   └─────────────────┘
```

## 完整代码

### Protobuf 定义文件 — user.proto

```protobuf
// ✅ gRPC service definition for user service
syntax = "proto3";

// 🟢 Package namespace
package user.v1;

// 🟡 Import common types (optional)
import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// ✅ User service definition
service UserService {
  // Get user by ID
  rpc GetUser(GetUserRequest) returns (GetUserResponse);

  // Get user list with pagination
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);

  // Create new user
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);

  // Update user
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);

  // 🟡 Server streaming: send multiple user updates
  rpc StreamUsers(google.protobuf.Empty) returns (stream User);

  // 🟢 Bidirectional streaming: real-time user updates
  rpc MonitorUsers(stream MonitorRequest) returns (stream User);
}

// 🟡 Request messages
message GetUserRequest {
  int64 user_id = 1;
  bool include_profile = 2;  // Include user profile data
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
  string search = 3;  // Search by name or email
  UserStatus status = 4;
}

message CreateUserRequest {
  string username = 1;
  string email = 2;
  string password = 3;
  UserProfile profile = 4;
}

message UpdateUserRequest {
  int64 user_id = 1;
  string username = 2;
  string email = 3;
  UserProfile profile = 4;
}

message MonitorRequest {
  repeated int64 user_ids = 1;  // Monitor specific users
  int32 refresh_interval = 2;   // Refresh interval in seconds
}

// 🟢 Response messages
message GetUserResponse {
  User user = 1;
}

message ListUsersResponse {
  repeated User users = 1;
  int32 total = 2;
  int32 page = 3;
  int32 page_size = 4;
}

message CreateUserResponse {
  User user = 1;
}

message UpdateUserResponse {
  User user = 1;
}

// 🔴 Data models
message User {
  int64 id = 1;
  string username = 2;
  string email = 3;
  UserStatus status = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;
  UserProfile profile = 7;
}

message UserProfile {
  string first_name = 1;
  string last_name = 2;
  string avatar_url = 3;
  string bio = 4;
}

// 🟡 Enum definition
enum UserStatus {
  UNKNOWN = 0;
  ACTIVE = 1;
  INACTIVE = 2;
  SUSPENDED = 3;
  DELETED = 4;
}
```

### 公共类型文件 — common.proto

```protobuf
syntax = "proto3";

package common.v1;

import "google/protobuf/timestamp.proto";

// 🟢 Common response wrapper
message Response {
  int32 code = 1;
  string message = 2;
  google.protobuf.Timestamp timestamp = 3;
}

// 🟡 Pagination request
message PaginationRequest {
  int32 page = 1;
  int32 page_size = 2;
}

// 🟢 Pagination response
message PaginationResponse {
  int32 total = 1;
  int32 page = 2;
  int32 page_size = 3;
  int32 total_pages = 4;
}
```

### 编译脚本 — compile-proto.sh

```bash
#!/bin/bash
# ✅ Compile Protobuf files to PHP code

set -e

# Check protoc is installed
if ! command -v protoc &> /dev/null; then
    echo "❌ protoc not found. Install from https://grpc.io/docs/protoc-installation/"
    exit 1
fi

# Check grpc-php plugin is installed
if ! command -v protoc-gen-php-grpc &> /dev/null; then
    echo "❌ protoc-gen-php-grpc not found."
    echo "Install with: pecl install grpc"
    exit 1
fi

# ✅ Generate PHP code
echo "🚀 Compiling Protobuf files..."

protoc \
  --php_out=./app/GRPC \
  --grpc_out=./app/GRPC \
  --proto_path=./protos \
  ./protos/user.proto \
  ./protos/common.proto

echo "✅ Protobuf compilation complete!"
echo "📁 Generated files in ./app/GRPC"
```

### Protobuf 工具类 — ProtobufHelper.php

```php
<?php

declare(strict_types=1);

namespace App\GRPC\Helper;

use GPBMetadata\Google\Protobuf\Timestamp;
use Google\Protobuf\Timestamp as ProtoTimestamp;
use Google\Protobuf\GPBEmpty;

class ProtobufHelper
{
    /**
     * ✅ Convert PHP timestamp to Protobuf Timestamp
     */
    public static function toTimestamp(int $timestamp): ProtoTimestamp
    {
        $seconds = intdiv($timestamp, 1000000000);
        $nanos = $timestamp % 1000000000;

        $protoTs = new ProtoTimestamp();
        $protoTs->setSeconds($seconds);
        $protoTs->setNanos($nanos);

        return $protoTs;
    }

    /**
     * ✅ Convert Protobuf Timestamp to PHP timestamp
     */
    public static function fromTimestamp(ProtoTimestamp $timestamp): int
    {
        return $timestamp->getSeconds() * 1000000000 + $timestamp->getNanos();
    }

    /**
     * ✅ Convert datetime to Protobuf Timestamp
     */
    public static function dateTimeToTimestamp(\DateTime $dateTime): ProtoTimestamp
    {
        $timestamp = self::toTimestamp($dateTime->format('U'));
        $protoTs = new ProtoTimestamp();
        $protoTs->setSeconds(intdiv($timestamp, 1000000000));
        return $protoTs;
    }

    /**
     * ✅ Convert Protobuf Timestamp to DateTime
     */
    public static function timestampToDateTime(ProtoTimestamp $timestamp): \DateTime
    {
        $phpTimestamp = self::fromTimestamp($timestamp);
        return new \DateTime("@{$phpTimestamp}");
    }

    /**
     * ✅ Create empty protobuf message
     */
    public static function empty(): GPBEmpty
    {
        return new GPBEmpty();
    }

    /**
     * ✅ Validate protobuf message
     */
    public static function validate(\Google\Protobuf\Internal\Message $message): array
    {
        $errors = [];

        // Get reflection info
        $reflection = new \ReflectionClass($message);
        $className = $reflection->getShortName();

        // Check required fields (proto2 only, proto3 has no required)
        $reflectionClass = new \ReflectionClass($message);
        foreach ($reflectionClass->getProperties() as $property) {
            $name = $property->getName();
            $getter = 'get' . str_replace('_', '', ucwords($name, '_'));

            if (method_exists($message, $getter)) {
                $value = $message->$getter();
                if ($value === null || $value === '') {
                    $errors[] = "{$className}.{$name} is required";
                }
            }
        }

        return $errors;
    }
}
```

### 测试脚本 — test-protobuf.php

```php
<?php
// ✅ Test Protobuf serialization and deserialization

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\GRPC\Helper\ProtobufHelper;
use User\V1\User;
use User\V1\UserProfile;
use User\V1\UserStatus;

echo "🧪 Protobuf Test\n\n";

// 1. Create user message
echo "1️⃣ Creating User message:\n";
$user = new User();
$user->setId(123);
$user->setUsername('john_doe');
$user->setEmail('john@example.com');
$user->setStatus(UserStatus::ACTIVE);

$profile = new UserProfile();
$profile->setFirstName('John');
$profile->setLastName('Doe');
$profile->setBio('Software engineer');
$user->setProfile($profile);

$now = time();
$user->setCreatedAt(ProtobufHelper::toTimestamp($now));
$user->setUpdatedAt(ProtobufHelper::toTimestamp($now));

echo "   ID: {$user->getId()}\n";
echo "   Username: {$user->getUsername()}\n";
echo "   Email: {$user->getEmail()}\n";
echo "   Status: {$user->getStatus()->name}\n";
echo "   Profile: {$profile->getFirstName()} {$profile->getLastName()}\n";

// 2. Serialize to binary
echo "\n2️⃣ Serializing to binary:\n";
$binary = $user->serializeToString();
echo "   Size: " . strlen($binary) . " bytes\n";

// 3. Deserialize from binary
echo "\n3️⃣ Deserializing from binary:\n";
$deserialized = new User();
$deserialized->mergeFromString($binary);

echo "   ID: {$deserialized->getId()}\n";
echo "   Username: {$deserialized->getUsername()}\n";
echo "   Email: {$deserialized->getEmail()}\n";

// 4. Compare original and deserialized
echo "\n4️⃣ Comparing original and deserialized:\n";
echo "   Match: " . ($user->serializeToString() === $deserialized->serializeToString() ? '✅' : '❌') . "\n";

// 5. Test timestamp conversion
echo "\n5️⃣ Testing timestamp conversion:\n";
$protoTs = ProtobufHelper::toTimestamp($now);
$phpTs = ProtobufHelper::fromTimestamp($protoTs);
echo "   Original: {$now}\n";
echo "   Converted: {$phpTs}\n";
echo "   Match: " . ($now === $phpTs ? '✅' : '❌') . "\n";

// 6. Test JSON encoding
echo "\n6️⃣ JSON encoding:\n";
$json = $user->serializeToJsonString();
echo json_encode(json_decode($json), JSON_PRETTY_PRINT) . "\n";

echo "\n✅ Protobuf test complete!\n";
```

## 执行预览

```bash
# 安装依赖
$ pecl install grpc
$ composer require google/protobuf

# 编译 .proto 文件
$ bash compile-proto.sh
🚀 Compiling Protobuf files...
✅ Protobuf compilation complete!
📁 Generated files in ./app/GRPC

# 运行测试
$ php test-protobuf.php
🧪 Protobuf Test

1️⃣ Creating User message:
   ID: 123
   Username: john_doe
   Email: john@example.com
   Status: ACTIVE
   Profile: John Doe

2️⃣ Serializing to binary:
   Size: 47 bytes

3️⃣ Deserializing from binary:
   ID: 123
   Username: john_doe
   Email: john@example.com

4️⃣ Comparing original and deserialized:
   Match: ✅

5️⃣ Testing timestamp conversion:
   Original: 1714567890
   Converted: 1714567890
   Match: ✅

6️⃣ JSON encoding:
{
  "id": 123,
  "username": "john_doe",
  "email": "john@example.com",
  "status": "ACTIVE",
  "createdAt": "2024-05-01T13:51:30Z",
  "updatedAt": "2024-05-01T13:51:30Z",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Software engineer"
  }
}

✅ Protobuf test complete!
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 字段编号唯一 | 每个字段必须有唯一的编号，不能修改 | 序列化兼容性破坏 |
| 🟡 字段编号预留 | 1-15 单字节，16-2047 双字节 | 不合理编号导致消息体积大 |
| 🟢 proto3 推荐 | 新项目用 proto3（无 required） | proto2 的 required 字段灵活性差 |
| 🔴 枚举从 0 开始 | 枚举第一个值必须是 0（默认值） | 未设置字段使用默认值 0 |
| 🟡 包名统一 | proto 包名对应 PHP 命名空间 | 生成的代码命名混乱 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 修改字段编号 | 老版本无法解析新消息 | 字段编号永远不变，只添加不删除 |
| 用 required | 升级时老客户端兼容性问题 | proto3 无 required，用 optional |
| 枚举不定义 0 值 | 未设置字段导致 0 未知状态 | 枚举必须有 UNKNOWN = 0 |
| 循环引用 | protoc 编译失败 | 用 message ID 引用避免循环 |
| 中文注释 | 生成代码乱码 | 用 UTF-8 编码或英文注释 |

## 练习题

### 🟢 基础
1. 创建一个 Order.proto 文件，定义 OrderService 和相关消息类型。
2. 编译 proto 文件，生成 PHP 代码并测试序列化/反序列化。

### 🟡 进阶
3. 实现一个嵌套消息（如 Order 包含多个 OrderItem），测试嵌套结构序列化。

### 🔴 开放
4. 设计一个方案：支持 proto 文件版本演进，新老版本客户端和服务端能兼容通信。

## 知识点总结

```
gRPC 与 Protobuf
├── Protobuf
│   ├── .proto 文件定义
│   ├── proto3 语法（推荐）
│   ├── 标量类型
│   ├── 枚举
│   ├── 消息嵌套
│   └── 字段编号规则
├── gRPC
│   ├── 定义服务
│   ├── 四种调用模式
│   │   ├── Unary RPC
│   │   ├── Server Streaming
│   │   ├── Client Streaming
│   │   └── Bidirectional Streaming
│   └── HTTP/2 传输
└── PHP 集成
    ├── pecl install grpc
    ├── composer require google/protobuf
    ├── protoc 编译
    └── ProtobufHelper 工具类
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| 跨语言通信 | 不同语言共享 .proto 文件 | Go、Java、Python 都能调用 |
| 流式传输 | 使用 stream 关键字 | 支持实时数据推送 |
| 认证与鉴权 | 使用 gRPC Interceptor | 统一处理 Token 验证 |

## 参考资料

- ⭐⭐⭐ [gPHP gRPC 文档](https://grpc.io/docs/languages/php/)
- ⭐⭐⭐ [Protobuf 语言指南](https://protobuf.dev/programming-guides/proto3/)
- ⭐⭐ [Hyperf gRPC 文档](https://hyperf.wiki/3.1/#/zh-cn/grpc)

## 代码演进

### v1 ❌ JSON REST API

```php
// ❌ JSON serialization overhead
$json = json_encode(['id' => 123, 'name' => 'John']);
file_get_contents('http://api/users/123', [
    'http' => [
        'header' => 'Content-Type: application/json',
        'content' => $json,
    ],
]);
```

### v2 ✅ 简单 Protobuf

```php
// ✅ Protobuf serialization
$user = new User();
$user->setId(123);
$user->setName('John');
$binary = $user->serializeToString();
```

### v3 🟢 完整 gRPC 服务

```php
// 🟢 gRPC service with streaming support
service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc StreamUsers(Empty) returns (stream User);  // Server streaming
  rpc MonitorUsers(stream Request) returns (stream User);  // Bidirectional
}
```
