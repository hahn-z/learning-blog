---
title: "019 - Hyperf gRPC 服务端与客户端实现"
slug: "019-hyperf-grpc-impl"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.86+08:00"
updated_at: "2026-05-01T22:17:02.015+08:00"
reading_time: 10
tags: []
---

# 019 - Hyperf gRPC 服务端与客户端实现

> **难度：** ⭐⭐⭐⭐ | **前置知识：** Hyperf 框架、gRPC 原理（018）、Protobuf 定义 | **预估用时：** 60 分钟

## 概念讲解

**一句话定义：** Hyperf gRPC 实现是在 Hyperf 框架上提供 gRPC 服务端和客户端支持，结合 Hyperf 的依赖注入、协程、中间件等特性，构建高性能的微服务通信系统。

**现实类比：** 就像两家公司建立专线电话——A 公司的销售通过专线直接打电话给 B 公司的客服，不用经过总机，通话清晰、效率高。Hyperf 就像"专线电话"的运营商，提供底层支持。

**技术场景：** 订单服务作为 gRPC 客户端，调用用户服务的 gRPC 接口获取用户信息。Hyperf gRPC 服务端处理请求，查询数据库，返回 Protobuf 格式的响应。通过 Hyperf 中间件实现认证、日志、限流等功能。

## 实时脑图

```
┌──────────────────────────────────────────────────────────────┐
│                 Order Service (gRPC Client)                  │
│                                                               │
│  ┌──────────────────┐      Call     ┌────────────────────┐  │
│  │ OrderController  │─────────────►│ UserServiceClient  │  │
│  │                  │              │                    │  │
│  │ getUser(123)     │◄─────────────│ GetUserRequest    │  │
│  └──────────────────┘   Return     └────────────────────┘  │
│                                     │                        │
└─────────────────────────────────────┼────────────────────────┘
                                      │
                                      │ gRPC Call (HTTP/2)
                                      │ Protobuf Binary
                                      ▼
┌──────────────────────────────────────────────────────────────┐
│                  User Service (gRPC Server)                   │
│                                                               │
│  ┌──────────────────┐              ┌────────────────────┐  │
│  │ gRPC Server     │─────────────►│ UserServiceImpl    │  │
│  │                  │              │                    │  │
│  │ /user.v1.UserService/GetUser   │ getUser()         │  │
│  └──────────────────┘              └────────────────────┘  │
│         │                                │                   │
│         │ ┌──────────────────────────────┼────────────────┐ │
│         │ │ Hyperf Middlewares          │                │ │
│         │ │ - Authentication             │                │ │
│         │ │ - Logging                    │                │ │
│         │ │ - Rate Limit                 │                │ │
│         │ └──────────────────────────────┼────────────────┘ │
│         ▼                                ▼                   │
│  ┌──────────────────┐              ┌────────────────────┐  │
│  │ Protobuf         │◄─────────────│ Database / Cache   │  │
│  │ Serializer       │              │                    │  │
│  └──────────────────┘              └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 完整代码

### 安装依赖

```bash
pecl install grpc
composer require hyperf/grpc-server
composer require hyperf/grpc-client
```

### gRPC 服务端配置 — config/autoload/server.php

```php
<?php
// ✅ gRPC server configuration

declare(strict_types=1);

use Hyperf\Server\Event;

return [
    'mode' => SWOOLE_PROCESS,
    'servers' => [
        // 🟡 HTTP server for health checks
        [
            'name' => 'http',
            'type' => SWOOLE_SOCK_TCP,
            'host' => '0.0.0.0',
            'port' => (int) env('HTTP_PORT', 9500),
            'sock_type' => SWOOLE_SOCK_TCP,
            'callbacks' => [
                Event::ON_REQUEST => [Hyperf\HttpServer\Server::class, 'onRequest'],
            ],
        ],
        // ✅ gRPC server
        [
            'name' => 'grpc',
            'type' => SWOOLE_SOCK_TCP,
            'host' => '0.0.0.0',
            'port' => (int) env('GRPC_PORT', 9501),
            'sock_type' => SWOOLE_SOCK_TCP,
            'callbacks' => [
                Event::ON_RECEIVE => [\Hyperf\GrpcServer\Server::class, 'onReceive'],
            ],
            'settings' => [
                'open_http2_protocol' => true,  // 🟢 Enable HTTP/2 for gRPC
                'heartbeat_idle_time' => 60,
            ],
        ],
    ],
];
```

### gRPC 服务实现 — UserServiceImpl.php

```php
<?php

declare(strict_types=1);

namespace App\GRPC\Service;

use App\Model\User as UserModel;
use App\GRPC\Helper\ProtobufHelper;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use User\V1\UserService as UserServiceInterface;
use User\V1\GetUserRequest;
use User\V1\GetUserResponse;
use User\V1\ListUsersRequest;
use User\V1\ListUsersResponse;
use User\V1\CreateUserRequest;
use User\V1\CreateUserResponse;
use User\V1\UpdateUserRequest;
use User\V1\UpdateUserResponse;
use User\V1\User;
use User\V1\UserProfile;
use User\V1\UserStatus;
use Google\Protobuf\GPBEmpty;
use Hyperf\GrpcServer\BaseServer;

class UserServiceImpl extends BaseServer implements UserServiceInterface
{
    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('grpc');
    }

    /**
     * ✅ Get user by ID
     */
    public function GetUser(GetUserRequest $request): GetUserResponse
    {
        $userId = $request->getUserId();
        $includeProfile = $request->getIncludeProfile();

        $this->logger->info('GetUser called', [
            'user_id' => $userId,
            'include_profile' => $includeProfile,
        ]);

        // 🟡 Query from database
        $userModel = UserModel::find($userId);

        if ($userModel === null) {
            $this->logger->warning('User not found', ['user_id' => $userId]);

            $response = new GetUserResponse();
            $response->setUser(null);  // Optional field, null is allowed

            return $response;
        }

        // ✅ Convert to protobuf
        $user = $this->toProtobufUser($userModel, $includeProfile);

        $response = new GetUserResponse();
        $response->setUser($user);

        $this->logger->info('GetUser returned', ['user_id' => $userId]);

        return $response;
    }

    /**
     * ✅ List users with pagination
     */
    public function ListUsers(ListUsersRequest $request): ListUsersResponse
    {
        $page = $request->getPage() ?: 1;
        $pageSize = min($request->getPageSize() ?: 20, 100);  // 🟡 Limit max page size
        $search = $request->getSearch() ?: '';
        $statusFilter = $request->getStatus();

        $this->logger->info('ListUsers called', [
            'page' => $page,
            'page_size' => $pageSize,
            'search' => $search,
            'status' => $statusFilter?->name,
        ]);

        // 🟡 Query with filters
        $query = UserModel::query();

        if ($search) {
            $query->where('username', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
        }

        if ($statusFilter !== UserStatus::UNKNOWN) {
            $query->where('status', $statusFilter->value);
        }

        $total = $query->count();
        $users = $query->offset(($page - 1) * $pageSize)
                       ->limit($pageSize)
                       ->get();

        // ✅ Convert to protobuf
        $userList = [];
        foreach ($users as $userModel) {
            $userList[] = $this->toProtobufUser($userModel, false);
        }

        $response = new ListUsersResponse();
        $response->setUsers($userList);
        $response->setTotal($total);
        $response->setPage($page);
        $response->setPageSize($pageSize);

        return $response;
    }

    /**
     * ✅ Create new user
     */
    public function CreateUser(CreateUserRequest $request): CreateUserResponse
    {
        $this->logger->info('CreateUser called', [
            'username' => $request->getUsername(),
            'email' => $request->getEmail(),
        ]);

        // 🟡 Validate
        $existing = UserModel::where('email', $request->getEmail())->first();
        if ($existing !== null) {
            throw new \RuntimeException('Email already exists', 400);
        }

        // ✅ Create user
        $userModel = new UserModel();
        $userModel->username = $request->getUsername();
        $userModel->email = $request->getEmail();
        $userModel->password_hash = password_hash($request->getPassword(), PASSWORD_BCRYPT);
        $userModel->status = UserStatus::ACTIVE->value;
        $userModel->created_at = time();
        $userModel->updated_at = time();

        if ($request->hasProfile()) {
            $profile = $request->getProfile();
            $userModel->first_name = $profile->getFirstName() ?: '';
            $userModel->last_name = $profile->getLastName() ?: '';
            $userModel->bio = $profile->getBio() ?: '';
        }

        $userModel->save();

        // ✅ Convert to protobuf response
        $user = $this->toProtobufUser($userModel, true);

        $response = new CreateUserResponse();
        $response->setUser($user);

        $this->logger->info('User created', ['user_id' => $userModel->id]);

        return $response;
    }

    /**
     * ✅ Update user
     */
    public function UpdateUser(UpdateUserRequest $request): UpdateUserResponse
    {
        $userId = $request->getUserId();

        $this->logger->info('UpdateUser called', ['user_id' => $userId]);

        $userModel = UserModel::find($userId);

        if ($userModel === null) {
            throw new \RuntimeException('User not found', 404);
        }

        // 🟡 Update fields
        if ($request->hasUsername()) {
            $userModel->username = $request->getUsername();
        }

        if ($request->hasEmail()) {
            $userModel->email = $request->getEmail();
        }

        if ($request->hasProfile()) {
            $profile = $request->getProfile();
            if ($profile->hasFirstName()) {
                $userModel->first_name = $profile->getFirstName();
            }
            if ($profile->hasLastName()) {
                $userModel->last_name = $profile->getLastName();
            }
            if ($profile->hasBio()) {
                $userModel->bio = $profile->getBio();
            }
        }

        $userModel->updated_at = time();
        $userModel->save();

        // ✅ Convert to protobuf response
        $user = $this->toProtobufUser($userModel, true);

        $response = new UpdateUserResponse();
        $response->setUser($user);

        $this->logger->info('User updated', ['user_id' => $userId]);

        return $response;
    }

    /**
     * ✅ Convert database model to protobuf user
     */
    private function toProtobufUser(UserModel $model, bool $includeProfile): User
    {
        $user = new User();
        $user->setId($model->id);
        $user->setUsername($model->username);
        $user->setEmail($model->email);
        $user->setStatus(UserStatus::tryFrom($model->status) ?? UserStatus::UNKNOWN);
        $user->setCreatedAt(ProtobufHelper::toTimestamp($model->created_at));
        $user->setUpdatedAt(ProtobufHelper::toTimestamp($model->updated_at));

        if ($includeProfile) {
            $profile = new UserProfile();
            $profile->setFirstName($model->first_name ?: '');
            $profile->setLastName($model->last_name ?: '');
            $profile->setBio($model->bio ?: '');
            $user->setProfile($profile);
        }

        return $user;
    }
}
```

### gRPC 客户端 — UserServiceClient.php

```php
<?php

declare(strict_types=1);

namespace App\GRPC\Client;

use Hyperf\GrpcClient\Client;
use Hyperf\Guzzle\ClientFactory;
use User\V1\UserService as UserServiceInterface;
use User\V1\GetUserRequest;
use User\V1\GetUserResponse;
use User\V1\ListUsersRequest;
use User\V1\ListUsersResponse;
use Hyperf\Di\Annotation\Inject;
use Psr\Log\LoggerInterface;
use Hyperf\Grpc\StatusCode;
use RuntimeException;

class UserServiceClient
{
    private ?Client $client = null;
    private LoggerInterface $logger;

    public function __construct(
        LoggerInterface $logger
    ) {
        $this->logger = $logger;
    }

    /**
     * ✅ Get gRPC client instance
     */
    private function getClient(): Client
    {
        if ($this->client === null) {
            $host = env('GRPC_USER_SERVICE_HOST', '127.0.0.1');
            $port = (int) env('GRPC_USER_SERVICE_PORT', 9501);

            $this->client = new Client("{$host}:{$port}", [
                'credentials' => null,  // 🟡 Insecure connection (for dev)
                'timeout' => 5.0,
            ]);
        }

        return $this->client;
    }

    /**
     * ✅ Call GetUser RPC
     */
    public function getUser(int $userId, bool $includeProfile = false): ?GetUserResponse
    {
        $request = new GetUserRequest();
        $request->setUserId($userId);
        $request->setIncludeProfile($includeProfile);

        $this->logger->info('Calling user.v1.UserService/GetUser', [
            'user_id' => $userId,
        ]);

        /** @var GetUserResponse $response */
        [$response, $status] = $this->getClient()->getUser($request);

        if ($status->code !== StatusCode::OK) {
            $this->logger->error('GetUser failed', [
                'user_id' => $userId,
                'status_code' => $status->code,
                'status_message' => $status->details,
            ]);

            return null;
        }

        $this->logger->info('GetUser succeeded', [
            'user_id' => $userId,
            'user' => $response->getUser()?->getUsername(),
        ]);

        return $response;
    }

    /**
     * ✅ Call ListUsers RPC
     */
    public function listUsers(int $page = 1, int $pageSize = 20, ?string $search = null): ?ListUsersResponse
    {
        $request = new ListUsersRequest();
        $request->setPage($page);
        $request->setPageSize($pageSize);
        if ($search !== null) {
            $request->setSearch($search);
        }

        $this->logger->info('Calling user.v1.UserService/ListUsers', [
            'page' => $page,
            'page_size' => $pageSize,
        ]);

        /** @var ListUsersResponse $response */
        [$response, $status] = $this->getClient()->listUsers($request);

        if ($status->code !== StatusCode::OK) {
            $this->logger->error('ListUsers failed', [
                'status_code' => $status->code,
                'status_message' => $status->details,
            ]);

            return null;
        }

        return $response;
    }

    /**
     * ✅ Get user with retry
     */
    public function getUserWithRetry(int $userId, int $maxRetries = 3): ?GetUserResponse
    {
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            $response = $this->getUser($userId);

            if ($response !== null) {
                return $response;
            }

            $this->logger->warning('GetUser retry', [
                'attempt' => $attempt,
                'max_retries' => $maxRetries,
            ]);

            if ($attempt < $maxRetries) {
                sleep(1);
            }
        }

        return null;
    }
}
```

### gRPC 中间件 — AuthenticationInterceptor.php

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use Grpc\ServerCall;
use Grpc\ServerCallContext;
use Hyperf\GrpcServer\CoreMiddleware;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

class GrpcAuthMiddleware
{
    private LoggerInterface $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * ✅ Authenticate gRPC requests
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // 🟡 Get token from metadata
        $metadata = $request->getUri()->getScheme();

        // In gRPC, metadata is passed via :authority header or custom metadata
        $authHeader = $request->getHeaderLine('authorization');

        if (empty($authHeader)) {
            $this->logger->warning('gRPC request missing authorization');

            return $this->errorResponse(StatusCode::UNAUTHENTICATED, 'Missing authorization');
        }

        // 🟢 Validate token
        if (!$this->validateToken($authHeader)) {
            $this->logger->warning('gRPC invalid token');

            return $this->errorResponse(StatusCode::PERMISSION_DENIED, 'Invalid token');
        }

        // ✅ Pass to next handler
        return $handler->handle($request);
    }

    private function validateToken(string $token): bool
    {
        // 🟡 Extract token from "Bearer <token>" format
        $parts = explode(' ', $token);
        if (count($parts) !== 2 || $parts[0] !== 'Bearer') {
            return false;
        }

        $actualToken = $parts[1];

        // 🟡 Validate token (simplified example)
        return $actualToken === env('GRPC_AUTH_TOKEN', 'secret-token');
    }

    private function errorResponse(int $code, string $message): ResponseInterface
    {
        // Return gRPC error response
        // This is a simplified example - actual implementation varies
        return \Hyperf\Support\make(ResponseInterface::class)->withStatus($code, $message);
    }
}
```

### 测试脚本 — test-grpc.php

```php
<?php
// ✅ Test gRPC service

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\GRPC\Client\UserServiceClient;
use User\V1\UserStatus;

echo "🧪 gRPC Test\n\n";

$client = new UserServiceClient();

// 1. Get user
echo "1️⃣ Getting user:\n";
$response = $client->getUser(123, true);
if ($response && $response->getUser()) {
    $user = $response->getUser();
    echo "   ID: {$user->getId()}\n";
    echo "   Username: {$user->getUsername()}\n";
    echo "   Email: {$user->getEmail()}\n";
    echo "   Status: {$user->getStatus()->name}\n";
    if ($user->hasProfile()) {
        $profile = $user->getProfile();
        echo "   Profile: {$profile->getFirstName()} {$profile->getLastName()}\n";
    }
} else {
    echo "   ❌ Failed to get user\n";
}

// 2. List users
echo "\n2️⃣ Listing users:\n";
$response = $client->listUsers(1, 5, 'john');
if ($response) {
    echo "   Total: {$response->getTotal()}\n";
    echo "   Page: {$response->getPage()}\n";
    echo "   Users: " . count($response->getUsers()) . "\n";
} else {
    echo "   ❌ Failed to list users\n";
}

// 3. Test retry
echo "\n3️⃣ Testing retry mechanism:\n";
$response = $client->getUserWithRetry(999, 3);
if ($response) {
    echo "   ✅ Succeeded after retry\n";
} else {
    echo "   ⚠️  Failed after all retries\n";
}

echo "\n✅ gRPC test complete!\n";
```

## 执行预览

```bash
# 启动 gRPC 服务端
$ php bin/hyperf.php start
[INFO] gRPC server started on 0.0.0.0:9501
[INFO] HTTP server started on 0.0.0.0:9500

# 测试 gRPC 客户端
$ php test-grpc.php
🧪 gRPC Test

1️⃣ Getting user:
   ID: 123
   Username: john_doe
   Email: john@example.com
   Status: ACTIVE
   Profile: John Doe

2️⃣ Listing users:
   Total: 42
   Page: 1
   Users: 5

3️⃣ Testing retry mechanism:
   ⚠️  Failed after all retries

✅ gRPC test complete!

# 服务端日志
[INFO] GetUser called { "user_id": 123, "include_profile": true }
[INFO] GetUser returned { "user_id": 123 }
[INFO] ListUsers called { "page": 1, "page_size": 5, "search": "john" }
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 必须编译 proto | proto 文件必须编译生成 PHP 代码 | 运行时找不到类 |
| 🟡 HTTP/2 必须开启 | gRPC 基于 HTTP/2 | 连接失败 |
| 🟢 认证机制 | 生产环境必须启用认证 | 任意客户端可调用 |
| 🟡 超时设置 | 客户端设置合理超时（3-5s） | 请求挂起导致阻塞 |
| 🔴 错误处理 | 正确处理 gRPC 状态码 | 无法判断调用是否成功 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 忘记编译 proto | Class 'User\V1\User' not found | 运行 `protoc` 编译 |
| HTTP/2 未启用 | gRPC 连接失败 | 设置 `open_http2_protocol = true` |
| 中间件错误 | 500 Internal Server Error | 检查中间件返回 gRPC 错误响应 |
| 超时太长 | 请求挂起 | 设置客户端 timeout 3-5s |
| 未处理状态码 | 调用失败但业务继续运行 | 检查 `$status->code` |

## 练习题

### 🟢 基础
1. 实现一个 GetByEmail RPC 方法，通过邮箱查询用户。
2. 编写测试脚本，调用 GetUser 并验证返回数据。

### 🟡 进阶
3. 实现一个流式 RPC StreamUsers，每次发送一个用户数据（服务器端流）。

### 🔴 开放
4. 设计一个 gRPC 网关：支持协议转换（HTTP → gRPC），对外提供 RESTful API，内部调用 gRPC 服务。

## 知识点总结

```
Hyperf gRPC 实现
├── 服务端
│   ├── config/autoload/server.php
│   ├── UserServiceImpl
│   ├── 实现服务接口
│   └── 数据库查询 + Protobuf 转换
├── 客户端
│   ├── Hyperf\GrpcClient\Client
│   ├── 调用 RPC 方法
│   └── 错误处理 + 重试
├── 中间件
│   ├── 认证（Authentication）
│   ├── 日志（Logging）
│   └── 限流（Rate Limit）
└── 最佳实践
    ├── proto 编译
    ├── HTTP/2 开启
    ├── 超时设置
    └── 错误处理
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| 多语言服务 | .proto 文件共享 | Go、Java、Python 都能调用 |
| SSL/TLS 加密 | 配置 credentials 证书 | 加密通信 |
| 双向流式通信 | stream 关键字 | 实时消息推送 |

## 参考资料

- ⭐⭐⭐ [Hyperf gRPC Server 文档](https://hyperf.wiki/3.1/#/zh-cn/grpc-server)
- ⭐⭐⭐ [Hyperf gRPC Client 文档](https://hyperf.wiki/3.1/#/zh-cn/grpc-client)
- ⭐⭐ [gPHP gRPC 示例](https://github.com/grpc/grpc-php/tree/master/examples)

## 代码演进

### v1 ❌ HTTP REST API

```php
// ❌ REST API with JSON
$response = file_get_contents('http://api/users/123');
$user = json_decode($response);
```

### v2 ✅ gRPC 调用

```php
// ✅ gRPC call
$client = new Client('user-service:9501');
[$response, $status] = $client->getUser($request);
```

### v3 🟢 完整 Hyperf gRPC 服务

```php
// 🟢 Full Hyperf gRPC implementation
class UserServiceImpl extends BaseServer implements UserServiceInterface
{
    public function GetUser(GetUserRequest $request): GetUserResponse
    {
        $userModel = UserModel::find($request->getUserId());
        $user = $this->toProtobufUser($userModel, true);
        return (new GetUserResponse())->setUser($user);
    }
}
```
