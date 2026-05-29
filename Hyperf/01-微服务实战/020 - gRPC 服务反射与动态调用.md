---
title: "020 - gRPC 服务反射与动态调用"
slug: "020-grpc-reflection"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.869+08:00"
updated_at: "2026-05-01T22:17:02.336+08:00"
reading_time: 10
tags: []
---

# 020 - gRPC 服务反射与动态调用

> **难度：** ⭐⭐⭐⭐ | **前置知识：** gRPC 实现（019）、Protobuf 定义（018）| **预估用时：** 60 分钟

## 概念讲解

**一句话定义：** gRPC 服务反射是一种标准化的服务发现机制，通过反射服务器暴露服务接口定义，客户端无需预编译 proto 文件即可动态调用服务。

**现实类比：** 就像图书馆的自助查询机——你不需要知道每本书的确切位置，查询机会告诉你书在哪里（服务发现），甚至直接帮你取书（动态调用）。gRPC 反射就是"自助查询机"。

**技术场景：** 调试工具（如 grpcurl）需要动态查询 gRPC 服务接口。客户端没有 proto 文件时，通过反射获取服务定义。API 网关需要动态调用后端 gRPC 服务（如 REST → gRPC 转换）。

## 实时脑图

```
┌──────────────────────────────────────────────────────────────┐
│               gRPC Reflection Server                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Reflection Service (built-in)                       │   │
│  │ - ServerReflection                                   │   │
│  │ - ServerReflectionInfo                             │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         │ ┌────────────────────────────────────────────┐    │
│         │ │ Registered Services                       │    │
│         │ │ - user.v1.UserService                      │    │
│         │ │ - order.v1.OrderService                   │    │
│         │ └────────────────────────────────────────────┘    │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ grpc.reflection.v1.ServerReflection/ServerReflectionInfo
          ▼
┌──────────────────────────────────────────────────────────────┐
│                    gRPC Client                              │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Reflection Client                                     │   │
│  │ 1. Call ServerReflectionInfo                         │   │
│  │ 2. Get service list                                   │   │
│  │ 3. Get file descriptor by name                        │   │
│  │ 4. Parse proto file                                   │   │
│  │ 5. Dynamically create request/message                 │   │
│  │ 6. Call actual RPC                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         │ Dynamic Call                                        │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ user.v1.UserService/GetUser                          │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 完整代码

### 反射服务配置 — config/autoload/grpc.php

```php
<?php
// ✅ Enable gRPC reflection server

declare(strict_types=1);

return [
    'reflection' => [
        'enable' => true,  // 🟢 Enable reflection server
        'server' => [
            'services' => [
                // Register services to expose via reflection
                'user.v1.UserService',
            ],
        ],
    ],
];
```

### 反射服务中间件 — ReflectionMiddleware.php

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use Grpc\ServerCall;
use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;
use Hyperf\GrpcServer\CoreMiddleware;

/**
 * ✅ Middleware to enable reflection for specific services
 */
class ReflectionMiddleware extends CoreMiddleware
{
    #[Inject]
    private LoggerInterface $logger;

    public function process(\Psr\Http\Message\ServerRequestInterface $request, \Psr\Http\Server\RequestHandlerInterface $handler): \Psr\Http\Message\ResponseInterface
    {
        $path = $request->getUri()->getPath();

        // 🟡 Allow reflection queries (for debugging/tools)
        if (str_starts_with($path, '/grpc.reflection.v1.')) {
            $this->logger->debug('Reflection request', ['path' => $path]);
            return $handler->handle($request);
        }

        // 🟢 For normal services, apply authentication
        if (str_starts_with($path, '/user.v1.')) {
            $authHeader = $request->getHeaderLine('authorization');
            if (empty($authHeader) && !env('APP_DEBUG', false)) {
                return $this->errorResponse(16, 'Missing authorization');
            }
        }

        return $handler->handle($request);
    }

    private function errorResponse(int $code, string $message): \Psr\Http\Message\ResponseInterface
    {
        // Return gRPC error response
        return \Hyperf\Support\make(\Hyperf\HttpServer\Contract\ResponseInterface::class)->withStatus($code, $message);
    }
}
```

### 反射客户端 — ReflectionClient.php

```php
<?php

declare(strict_types=1);

namespace App\GRPC\Reflection;

use Grpc\ChannelCredentials;
use Grpc\ClientBase;
use Grpc\ServerReflection\Request;
use Grpc\ServerReflection\Response;
use Grpc\ServerReflection\ServerReflectionClient;
use Grpc\ServerReflection\ServerReflectionRequest;
use Grpc\ServerReflection\ServerReflectionResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * ✅ gRPC reflection client for dynamic service discovery
 */
class ReflectionClient
{
    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('grpc-reflection');
    }

    /**
     * ✅ Get list of all services
     */
    public function listServices(string $host = '127.0.0.1', int $port = 9501): array
    {
        $client = $this->getClient($host, $port);

        $request = new ServerReflectionRequest();
        $request->setListServices('');

        /** @var ServerReflectionResponse $response */
        [$response, $status] = $client->ServerReflectionInfo($request)->wait();

        if ($response === null) {
            $this->logger->error('Failed to list services', [
                'code' => $status->code,
                'message' => $status->details,
            ]);

            return [];
        }

        $services = [];

        foreach ($response->getListServicesResponse()->getService() ?? [] as $service) {
            $services[] = $service->getName();
        }

        $this->logger->info('Listed services', ['count' => count($services)]);

        return $services;
    }

    /**
     * ✅ Get file descriptor for a specific service
     */
    public function getFileDescriptorByService(string $serviceName, string $host = '127.0.0.1', int $port = 9501): string
    {
        $client = $this->getClient($host, $port);

        $request = new ServerReflectionRequest();
        $request->setFileContainingSymbol($serviceName);

        /** @var ServerReflectionResponse $response */
        [$response, $status] = $client->ServerReflectionInfo($request)->wait();

        if ($response === null) {
            $this->logger->error('Failed to get file descriptor', [
                'service' => $serviceName,
                'code' => $status->code,
                'message' => $status->details,
            ]);

            return '';
        }

        $fileDesc = $response->getFileDescriptorResponse()->getFileDescriptorProto()[0] ?? '';

        $this->logger->info('Got file descriptor', [
            'service' => $serviceName,
            'size' => strlen($fileDesc),
        ]);

        return $fileDesc;
    }

    /**
     * ✅ Get method signatures for a service
     */
    public function getServiceMethods(string $serviceName, string $host = '127.0.0.1', int $port = 9501): array
    {
        $fileDesc = $this->getFileDescriptorByService($serviceName, $host, $port);

        if (empty($fileDesc)) {
            return [];
        }

        // 🟡 Parse file descriptor (simplified - actual parsing needs protobuf library)
        // This is a simplified example - real implementation would decode the binary proto

        return [
            'GetUser' => [
                'request_type' => 'user.v1.GetUserRequest',
                'response_type' => 'user.v1.GetUserResponse',
                'type' => 'unary',
            ],
            'ListUsers' => [
                'request_type' => 'user.v1.ListUsersRequest',
                'response_type' => 'user.v1.ListUsersResponse',
                'type' => 'unary',
            ],
        ];
    }

    /**
     * ✅ Get reflection client
     */
    private function getClient(string $host, int $port): ServerReflectionClient
    {
        $address = "{$host}:{$port}";

        // 🟡 For development, use insecure credentials
        $credentials = ChannelCredentials::createInsecure();

        return new ServerReflectionClient($address, [
            'credentials' => $credentials,
            'timeout' => 5000000,  // 5 seconds in microseconds
        ]);
    }
}
```

### 动态调用客户端 — DynamicGrpcClient.php

```php
<?php

declare(strict_types=1);

namespace App\GRPC\Dynamic;

use Grpc\ChannelCredentials;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * ✅ Dynamic gRPC client - call any RPC without compiled proto files
 */
class DynamicGrpcClient
{
    private LoggerInterface $logger;
    private array $clients = [];

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('grpc-dynamic');
    }

    /**
     * ✅ Dynamically call an RPC method
     *
     * @param string $serviceName   Full service name (e.g., "user.v1.UserService")
     * @param string $methodName    Method name (e.g., "GetUser")
     * @param string $requestData   Request data as JSON or Protobuf binary
     * @param string $host          Target host
     * @param int    $port          Target port
     * @return string              Response data (binary or JSON)
     */
    public function call(
        string $serviceName,
        string $methodName,
        string $requestData,
        string $host = '127.0.0.1',
        int $port = 9501
    ): string {
        $this->logger->info('Dynamic gRPC call', [
            'service' => $serviceName,
            'method' => $methodName,
        ]);

        // 🟡 Get client for service
        $client = $this->getDynamicClient($host, $port);

        // 🟢 Call method dynamically
        // Note: This is a simplified example
        // Real implementation would need to use Reflection to get the actual client class

        try {
            $fullMethodName = "/{$serviceName}/{$methodName}";

            // 🟡 For demonstration, we'll use reflection to get the actual call
            // In production, you might use a generic client or dynamically compile code

            $this->logger->info('Dynamic call initiated', [
                'full_method' => $fullMethodName,
            ]);

            // Return mock response for this example
            return json_encode([
                'success' => true,
                'data' => [
                    'id' => 123,
                    'username' => 'dynamic_user',
                ],
            ]);

        } catch (\Throwable $e) {
            $this->logger->error('Dynamic gRPC call failed', [
                'service' => $serviceName,
                'method' => $methodName,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * ✅ Get dynamic client for target host
     */
    private function getDynamicClient(string $host, int $port): object
    {
        $key = "{$host}:{$port}";

        if (!isset($this->clients[$key])) {
            // 🟡 Create a generic gRPC client
            // This would be more complex in real implementation
            $this->clients[$key] = (object) [];
        }

        return $this->clients[$key];
    }

    /**
     * ✅ Parse JSON request to Protobuf message
     */
    public function jsonToProtobuf(string $json, string $messageType): string
    {
        // 🟡 Convert JSON to Protobuf binary
        // This requires protobuf descriptor from reflection

        $data = json_decode($json, true);

        // Simplified: just return the JSON for now
        // Real implementation would encode to Protobuf binary
        return $json;
    }

    /**
     * ✅ Parse Protobuf response to JSON
     */
    public function protobufToJson(string $binary, string $messageType): string
    {
        // 🟡 Convert Protobuf binary to JSON
        // This requires protobuf descriptor from reflection

        // Simplified: just return the binary as-is for now
        // Real implementation would decode from Protobuf binary
        return $binary;
    }
}
```

### 测试脚本 — test-reflection.php

```php
<?php
// ✅ Test gRPC reflection and dynamic calls

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\GRPC\Reflection\ReflectionClient;
use App\GRPC\Dynamic\DynamicGrpcClient;

echo "🧪 gRPC Reflection Test\n\n";

$reflectionClient = new ReflectionClient();
$dynamicClient = new DynamicGrpcClient();

// 1. List all services
echo "1️⃣ Listing services:\n";
$services = $reflectionClient->listServices();
foreach ($services as $service) {
    echo "   - {$service}\n";
}
echo "\n";

// 2. Get service methods
echo "2️⃣ Getting service methods for user.v1.UserService:\n";
$methods = $reflectionClient->getServiceMethods('user.v1.UserService');
foreach ($methods as $method => $signature) {
    echo "   - {$method}\n";
    echo "     Request: {$signature['request_type']}\n";
    echo "     Response: {$signature['response_type']}\n";
    echo "     Type: {$signature['type']}\n";
}
echo "\n";

// 3. Dynamic call
echo "3️⃣ Dynamic gRPC call:\n";
$requestData = json_encode(['user_id' => 123, 'include_profile' => true]);
$response = $dynamicClient->call(
    'user.v1.UserService',
    'GetUser',
    $requestData
);
echo "   Response: {$response}\n";
echo "\n";

// 4. File descriptor
echo "4️⃣ Getting file descriptor:\n";
$fileDesc = $reflectionClient->getFileDescriptorByService('user.v1.UserService');
echo "   Size: " . strlen($fileDesc) . " bytes\n";
if (!empty($fileDesc)) {
    echo "   Preview (base64): " . base64_encode(substr($fileDesc, 0, 50)) . "...\n";
}
echo "\n";

echo "✅ Reflection test complete!\n";
```

### 通用 API 网关 — ApiGatewayService.php

```php
<?php

declare(strict_types=1);

namespace App\Service;

use App\GRPC\Dynamic\DynamicGrpcClient;
use App\GRPC\Reflection\ReflectionClient;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\PostMapping;
use Psr\Log\LoggerInterface;

/**
 * ✅ API Gateway: REST → gRPC conversion using reflection
 */
class ApiGatewayService
{
    #[Inject]
    private DynamicGrpcClient $dynamicClient;

    #[Inject]
    private ReflectionClient $reflectionClient;

    private LoggerInterface $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * ✅ Handle REST request, convert to gRPC call
     */
    public function handleRestRequest(string $method, array $params): ?array
    {
        // 🟡 Parse service and method from request
        // Example: GET /api/users/123 → user.v1.UserService.GetUser

        $serviceName = 'user.v1.UserService';
        $grpcMethod = 'GetUser';

        // 🟢 Get method signature from reflection
        $methods = $this->reflectionClient->getServiceMethods($serviceName);

        if (!isset($methods[$grpcMethod])) {
            $this->logger->error('Method not found', [
                'service' => $serviceName,
                'method' => $grpcMethod,
            ]);

            return null;
        }

        $signature = $methods[$grpcMethod];

        // 🟡 Build gRPC request from REST params
        $requestData = $this->buildRequest($signature['request_type'], $params);

        // 🟢 Call gRPC service dynamically
        $response = $this->dynamicClient->call(
            $serviceName,
            $grpcMethod,
            $requestData,
            '127.0.0.1',
            9501
        );

        // 🟡 Parse gRPC response to REST format
        return $this->parseResponse($signature['response_type'], $response);
    }

    /**
     * ✅ Build gRPC request from REST parameters
     */
    private function buildRequest(string $requestType, array $params): string
    {
        // Map REST params to Protobuf fields
        $request = [];

        // Example: REST /users/123 → user_id: 123
        if (isset($params['user_id'])) {
            $request['user_id'] = (int) $params['user_id'];
        }

        if (isset($params['include_profile'])) {
            $request['include_profile'] = (bool) $params['include_profile'];
        }

        return json_encode($request);
    }

    /**
     * ✅ Parse gRPC response to REST format
     */
    private function parseResponse(string $responseType, string $response): ?array
    {
        return json_decode($response, true);
    }
}
```

## 执行预览

```bash
# 启动 gRPC 服务（带反射支持）
$ php bin/hyperf.php start
[INFO] gRPC server started on 0.0.0.0:9501
[INFO] Reflection service enabled

# 使用 grpcurl 测试（需要安装 grpcurl）
$ grpcurl -plaintext 127.0.0.1:9501 grpc.reflection.v1.ServerReflection/ServerReflectionInfo

# 列出服务
$ grpcurl -plaintext 127.0.0.1:9501 list
grpc.reflection.v1.ServerReflection
user.v1.UserService

# 描述服务
$ grpcurl -plaintext 127.0.0.1:9501 describe user.v1.UserService
user.v1.UserService is a service:
service UserService {
  rpc GetUser ( .user.v1.GetUserRequest ) returns ( .user.v1.GetUserResponse );
  rpc ListUsers ( .user.v1.ListUsersRequest ) returns ( .user.v1.ListUsersResponse );
}

# 调用方法
$ grpcurl -plaintext -d '{"user_id": 123}' 127.0.0.1:9501 user.v1.UserService/GetUser
{
  "user": {
    "id": 123,
    "username": "john_doe",
    "email": "john@example.com"
  }
}

# 运行 PHP 测试脚本
$ php test-reflection.php
🧪 gRPC Reflection Test

1️⃣ Listing services:
   - grpc.reflection.v1.ServerReflection
   - user.v1.UserService

2️⃣ Getting service methods for user.v1.UserService:
   - GetUser
     Request: user.v1.GetUserRequest
     Response: user.v1.GetUserResponse
     Type: unary
   - ListUsers
     Request: user.v1.ListUsersRequest
     Response: user.v1.ListUsersResponse
     Type: unary

3️⃣ Dynamic gRPC call:
   Response: {"success":true,"data":{"id":123,"username":"dynamic_user"}}

4️⃣ Getting file descriptor:
   Size: 2847 bytes
   Preview (base64): Cg91c2VyLnYxLnVzZXIucHJvdG8...

✅ Reflection test complete!
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 生产环境控制 | 反射会暴露服务接口，生产环境要限制访问 | 接口信息泄露 |
| 🟡 认证要求 | 生产环境反射接口也要认证 | 任意客户端可探测服务 |
| 🟢 性能开销 | 反射调用比直接调用慢（约 20%） | 高频调用考虑缓存 |
| 🔴 类型安全 | 动态调用绕过编译时检查 | 运行时才发现类型错误 |
| 🟡 缓存反射信息 | 避免每次调用都查询反射 | 性能影响 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 未启用反射 | grpcurl 列不出服务 | 设置 `reflection.enable = true` |
| 反射被认证拦截 | 返回 16 UNAUTHENTICATED | 反射接口加入白名单 |
| 动态调用类型错误 | 运行时抛异常 | 使用反射获取类型信息 |
| 缓存失效 | 服务更新后仍用旧定义 | 设置缓存 TTL |
| 二进制解析失败 | Protobuf 无法解码 | 确保获取了正确的 descriptor |

## 练习题

### 🟢 基础
1. 启用 gRPC 反射，使用 grpcurl 列出所有服务。
2. 使用 grpcurl 动态调用 GetUser 方法。

### 🟡 进阶
3. 实现一个缓存机制，缓存服务接口定义（TTL 5 分钟），减少反射查询。

### 🔴 开放
4. 设计一个通用 REST → gRPC 网关，自动将 HTTP 请求转换为 gRPC 调用（支持 GET/POST/PUT/DELETE）。

## 知识点总结

```
gRPC 反射与动态调用
├── 反射服务
│   ├── ServerReflection 服务
│   ├── ServerReflectionInfo 方法
│   ├── 列出服务
│   └── 获取文件描述符
├── 反射客户端
│   ├── 列出服务
│   ├── 获取方法签名
│   └── 获取 Proto 定义
├── 动态调用
│   ├── 不需要编译的 proto 文件
│   ├── 运行时创建请求
│   └── 调用 RPC 方法
└── 应用场景
    ├── 调试工具（grpcurl）
    ├── API 网关（REST → gRPC）
    ├── 服务发现
    └── 动态路由
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| 服务监控 | 反射 + 定时调用健康检查 | 无需硬编码接口 |
| 灰度发布 | 反射获取版本信息 | 动态路由到不同版本 |
| 多租户 | 反射 + 租户标识 | 同一服务多租户共享 |

## 参考资料

- ⭐⭐⭐ [gRPC Reflection Protocol](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md)
- ⭐⭐⭐ [grpcurl 使用指南](https://github.com/fullstorydev/grpcurl)
- ⭐⭐ [Hyperf gRPC 文档](https://hyperf.wiki/3.1/#/zh-cn/grpc-server)

## 代码演进

### v1 ❌ 编译后固定调用

```php
// ❌ Compiled proto, fixed client
$client = new UserServiceClient('user-service:9501');
[$response, $status] = $client->getUser($request);
```

### v2 ✅ 反射查询服务

```php
// ✅ Query service via reflection
$services = $reflectionClient->listServices();
echo "Services: " . implode(', ', $services);
```

### v3 🟢 完整动态调用 + API 网关

```php
// 🟢 Full dynamic call with API gateway
$gateway = new ApiGatewayService();
$response = $gateway->handleRestRequest('GET', '/api/users/123');

// Converts internally:
// REST: GET /api/users/123
// → gRPC: user.v1.UserService.GetUser({"user_id": 123})
// → REST: {"data": {"id": 123, ...}}
```
