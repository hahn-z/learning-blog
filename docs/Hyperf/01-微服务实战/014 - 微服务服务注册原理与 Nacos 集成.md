---
title: "014 - 微服务服务注册原理与 Nacos 集成"
slug: "014-service-registration"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.81+08:00"
updated_at: "2026-05-01T22:17:00.42+08:00"
reading_time: 6
tags: []
---

# 014 - 微服务服务注册原理与 Nacos 集成

> **难度：** ⭐⭐⭐ | **前置知识：** Hyperf 框架、Nacos 基础（011）| **预估用时：** 50 分钟

## 概念讲解

**一句话定义：** 服务注册是指微服务实例启动时，将自己的网络地址（IP + Port）和元数据注册到注册中心，使其他服务能够发现并调用它。

**现实类比：** 就像外卖平台上的餐厅——每家餐厅开业时向平台登记地址、菜单和营业时间（注册），顾客打开 App 就能找到附近所有营业中的餐厅（发现）。餐厅关门了会从列表消失（摘除）。

**技术场景：** 用户服务部署了 3 个实例（10.0.1.11:9501、10.0.1.12:9501、10.0.1.13:9501），每个实例启动时向 Nacos 注册。订单服务需要调用用户服务时，从 Nacos 获取所有可用实例列表，选择一个发起请求。实例宕机后 Nacos 自动将其摘除。

## 实时脑图

```
┌──────────────────────────────────────────────────────────────┐
│                      Nacos Registry                          │
│                                                              │
│  user-service (DEFAULT_GROUP)                                │
│  ├── 10.0.1.11:9501  healthy ✓  weight=1  metadata={v:2.0}  │
│  ├── 10.0.1.12:9501  healthy ✓  weight=1  metadata={v:2.0}  │
│  └── 10.0.1.13:9501  healthy ✓  weight=1  metadata={v:1.0}  │
└──────────┬──────────────────┬──────────────────┬─────────────┘
           │ register         │ register         │ register
           │ heartbeat        │ heartbeat        │ heartbeat
           ▼                  ▼                  ▼
     ┌───────────┐      ┌───────────┐      ┌───────────┐
     │ user-svc  │      │ user-svc  │      │ user-svc  │
     │ instance1 │      │ instance2 │      │ instance3 │
     └───────────┘      └───────────┘      └───────────┘
           ▲                  ▲                  ▲
           │                  │                  │
           └────── subscribe / discover ─────────┘
                              │
                        ┌─────┴─────┐
                        │ order-svc  │
                        │ (consumer) │
                        └───────────┘
```

## 完整代码

### 安装依赖

```bash
composer require hyperf/service-governance-nacos
```

### config/autoload/services.php

```php
<?php
// ✅ Service registration configuration for Nacos

declare(strict_types=1);

return [
    'enable' => [
        'discovery' => true,
        'register' => true,
    ],
    'consumers' => [],
    'providers' => [],
    'drivers' => [
        'nacos' => [
            'host' => env('NACOS_HOST', '127.0.0.1'),
            'port' => (int) env('NACOS_PORT', 8848),
            'username' => env('NACOS_USERNAME', 'nacos'),
            'password' => env('NACOS_PASSWORD', 'nacos'),
            'guzzle' => [
                'config' => [
                    'headers' => [
                        'charset' => 'UTF-8',
                    ],
                ],
            ],
            'group_name' => env('NACOS_SERVICE_GROUP', 'DEFAULT_GROUP'),
            'namespace_id' => env('NACOS_NAMESPACE', ''),
            'heartbeat' => 5000, // 🟡 heartbeat interval in ms
        ],
    ],
];
```

### 服务注册元数据 — 注册到 Nacos 的服务信息

```php
<?php
// config/autoload/server.php — add service metadata

declare(strict_types=1);

use Hyperf\Server\Event;

return [
    'type' => Hyperf\Server\CoroutineServer::class,
    'servers' => [
        [
            'name' => 'http',
            'type' => Server::SERVER_HTTP,
            'host' => '0.0.0.0',
            'port' => (int) env('SERVER_PORT', 9501),
            'sock_type' => SWOOLE_SOCK_TCP,
            'callbacks' => [
                Event::ON_REQUEST => [Hyperf\HttpServer\Server::class, 'onRequest'],
            ],
        ],
    ],
];
```

### 用户服务 HTTP 接口 — UserController.php

```php
<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\GetMapping;

#[Controller(prefix: '/api/users')]
class UserController
{
    #[Inject]
    private UserService $userService;

    #[GetMapping(path: '/{id}')
    public function getUser(int $id): array
    {
        $user = $this->userService->findById($id);

        if ($user === null) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        // 🟢 Include service metadata for tracing
        return [
            'code' => 0,
            'data' => $user,
            'meta' => [
                'service' => 'user-service',
                'instance' => env('APP_INSTANCE_ID', 'unknown'),
                'version' => env('APP_VERSION', '1.0.0'),
            ],
        ];
    }

    #[GetMapping(path: '/health')
    public function health(): array
    {
        return [
            'status' => 'UP',
            'timestamp' => time(),
        ];
    }
}
```

### 自定义注册监听器 — ServiceRegisterListener.php

```php
<?php

declare(strict_types=1);

namespace App\Listener;

use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Framework\Event\AfterServerStart;
use Psr\Log\LoggerInterface;

#[Listener]
class ServiceRegisterListener implements ListenerInterface
{
    public function __construct(
        private LoggerInterface $logger
    ) {}

    public function listen(): array
    {
        return [AfterServerStart::class];
    }

    public function process(object $event): void
    {
        $serviceName = env('APP_NAME', 'user-service');
        $port = env('SERVER_PORT', 9501);
        $instanceId = env('APP_INSTANCE_ID', gethostbyname(gethostname()));

        $this->logger->info('Service registered', [
            'service' => $serviceName,
            'instance' => $instanceId,
            'port' => $port,
            'version' => env('APP_VERSION', '1.0.0'),
            'nacos_namespace' => env('NACOS_NAMESPACE', 'public'),
        ]);
    }
}
```

### 验证注册 — check-registration.php

```php
<?php
// ✅ Verify service registration in Nacos

declare(strict_types=1);

$baseUrl = 'http://127.0.0.1:8848/nacos/v1';

// Login
$loginCtx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query(['username' => 'nacos', 'password' => 'nacos']),
    ],
]);
$token = json_decode(file_get_contents("{$baseUrl}/auth/login", false, $loginCtx), true)['accessToken'] ?? '';

// Query service instances
$url = "{$baseUrl}/ns/instance/list?serviceName=user-service&accessToken={$token}";
$response = json_decode(file_get_contents($url), true);

echo "📋 Service: user-service\n";
echo "   Instances: " . count($response['hosts'] ?? []) . "\n\n";

foreach ($response['hosts'] ?? [] as $host) {
    $status = $host['healthy'] ? '✅' : '❌';
    echo "   {$status} {$host['ip']}:{$host['port']}\n";
    echo "      weight: {$host['weight']}\n";
    echo "      healthy: " . ($host['healthy'] ? 'true' : 'false') . "\n";
    echo "      metadata: " . json_encode($host['metadata'] ?? []) . "\n\n";
}
```

## 执行预览

```bash
# 启动用户服务实例 1
$ APP_INSTANCE_ID=10.0.1.11 SERVER_PORT=9501 php bin/hyperf.php start
[INFO] Service registered: user-service @ 10.0.1.11:9501

# 启动用户服务实例 2
$ APP_INSTANCE_ID=10.0.1.12 SERVER_PORT=9501 php bin/hyperf.php start
[INFO] Service registered: user-service @ 10.0.1.12:9501

# 查询注册信息
$ php check-registration.php
📋 Service: user-service
   Instances: 2

   ✅ 10.0.1.11:9501
      weight: 1
      healthy: true
   ✅ 10.0.1.12:9501
      weight: 1
      healthy: true
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 注册 IP 正确性 | 多网卡环境需指定注册 IP | 注册了内网/回环 IP，其他服务无法调用 |
| 🟡 心跳间隔 | 默认 5 秒，不要设太大 | 心跳超时导致实例被摘除 |
| 🟢 服务名规范 | 统一用小写 + 短横线命名 | 命名不一致导致找不到服务 |
| 🔴 优雅停机 | 停止时必须主动注销 | 实例已停但仍被其他服务调用 |
| 🟡 元数据管理 | 版本号等元数据要准确 | 灰度/路由策略基于错误元数据运行 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 注册 127.0.0.1 | 其他机器无法调用 | 配置正确的宿主机 IP |
| 未开启服务注册 | 消费者发现不了服务 | `services.enable.register = true` |
| 心跳丢失 | 实例频繁上下线 | 检查网络和 Nacos 压力 |
| 端口冲突 | 多实例注册失败 | 每个实例使用不同端口 |
| group 不匹配 | 同名服务不同 group 互相看不到 | 统一 group 命名规范 |

## 练习题

### 🟢 基础
1. 启动两个用户服务实例（不同端口），验证 Nacos 控制台显示两个实例。
2. 停止其中一个实例，观察 Nacos 是否自动将其标记为不健康。

### 🟡 进阶
3. 实现自定义注册 IP 解析策略：优先使用 Docker 网络 IP，fallback 到宿主机 IP。

### 🔴 开放
4. 设计一个方案：当 Nacos 不可用时，服务使用本地缓存的服务列表继续运行（注册中心降级）。

## 知识点总结

```
服务注册
├── 核心概念
│   ├── 服务名 (ServiceName)
│   ├── 实例 (Instance: IP + Port)
│   ├── 元数据 (Metadata)
│   ├── 权重 (Weight)
│   └── 健康状态 (Healthy)
├── 注册流程
│   ├── 启动 → 向 Nacos 注册
│   ├── 运行 → 定时心跳
│   └── 停止 → 主动注销
├── Hyperf 集成
│   ├── hyperf/service-governance-nacos
│   ├── config/autoload/services.php
│   └── 自动注册 + 心跳
└── 关键配置
    ├── 注册 IP
    ├── 心跳间隔
    └── 命名空间
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| Consul 注册 | 使用 hyperf/service-governance-consul | Consul 用 Agent 代理注册 |
| Kubernetes 原生 | Pod 注册为 Service + Nacos 补充 | K8s 自带服务发现 |
| 多网卡环境 | 指定 `ip_type` 或手动设置注册 IP | 自动获取可能选错网卡 |

## 参考资料

- ⭐⭐⭐ [Hyperf 服务注册文档](https://hyperf.wiki/3.1/#/zh-cn/service-governance)
- ⭐⭐⭐ [Nacos 服务发现原理](https://nacos.io/zh-cn/docs/what-is-nacos.html)
- ⭐⭐ [Hyperf Nacos 集成源码](https://github.com/hyperf/service-governance-nacos)

## 代码演进

### v1 ❌ 手动注册（无框架集成）

```php
// ❌ Manual registration — no heartbeat, no auto-deregister
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://nacos:8848/nacos/v1/ns/instance');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'serviceName' => 'user-service',
    'ip' => '127.0.0.1',
    'port' => 9501,
]));
curl_exec($ch);
```

### v2 ✅ Hyperf 自动注册

```php
// ✅ Framework auto-registration with heartbeat
// config/autoload/services.php
return [
    'enable' => ['register' => true],
    'drivers' => [
        'nacos' => [
            'host' => env('NACOS_HOST'),
            'heartbeat' => 5000,
        ],
    ],
];
```

### v3 🟢 注册 + 元数据 + 监听

```php
// 🟢 Full registration with metadata and event listener
#[Listener]
class ServiceRegisterListener implements ListenerInterface
{
    public function process(object $event): void
    {
        $this->logger->info('Service registered', [
            'service' => 'user-service',
            'version' => env('APP_VERSION'),
            'instance' => gethostbyname(gethostname()),
        ]);
    }
}
```
