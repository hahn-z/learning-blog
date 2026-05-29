---
title: "023 - Jaeger 部署与 Hyperf 集成"
slug: "023-jaeger-hyperf"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.896+08:00"
updated_at: "2026-05-01T22:02:57.432+08:00"
reading_time: 6
tags: []
---

# Jaeger 部署与 Hyperf 集成

## 难度标注

⭐⭐⭐（中级）

**前置知识：** Docker 基础、分布式链路追踪概念、Hyperf 3.x

**预估用时：** 50-60 分钟

---

## 概念讲解

**Jaeger** 是一款开源的端到端分布式链路追踪系统，由 Uber 开发并捐赠给 CNCF。它负责收集、存储和可视化微服务的调用链路数据，是 OpenTelemetry 数据的常见后端之一。

**现实类比：** 如果说链路追踪是物流追踪系统，那 Jaeger 就是顺丰的物流管理平台——它不仅记录每个包裹的流转信息，还提供查询界面让你可视化查看，并支持按运单号、时间、目的地等条件搜索。Jaeger 把分散在各服务的 Span 数据汇聚到一起，形成完整的调用图。

**技术场景：** 用户微服务已经通过 OpenTelemetry 产生了 Span 数据，现在需要把这些数据发送到一个集中的存储后端。Jaeger 提供了完整的收集→存储→查询→可视化链路，是 Hyperf 项目最常用的追踪后端。

---

## 实时脑图

```
  Hyperf User Service          Jaeger Infrastructure
  ┌──────────────┐            ┌─────────────────────┐
  │ PHP App      │            │                     │
  │ ┌──────────┐ │  OTLP/HTTP │  ┌───────────────┐  │
  │ │ OTel SDK │ ├───────────►│  │ Jaeger Agent  │  │
  │ └──────────┘ │            │  └───────┬───────┘  │
  │ ┌──────────┐ │            │          │           │
  │ │ Tracer   │ │            │  ┌───────▼───────┐  │
  │ │ Provider │ │            │  │ Jaeger Collector│ │
  │ └──────────┘ │            │  └───────┬───────┘  │
  └──────────────┘            │          │           │
                              │  ┌───────▼───────┐  │
                              │  │    Storage     │  │
                              │  │  (Badger/ES)   │  │
                              │  └───────┬───────┘  │
                              │          │           │
                              │  ┌───────▼───────┐  │
                              │  │     Jaeger     │  │
                              │  │      UI        │  │
                              │  │  :16686        │  │
                              │  └───────────────┘  │
                              └─────────────────────┘
```

---

## 完整代码

### 1. Docker Compose 部署 Jaeger

```yaml
# docker-compose.jaeger.yml
# ✅ All-in-One mode for development, use production mode for production

version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:1.54
    container_name: jaeger
    restart: unless-stopped
    ports:
      # ✅ Jaeger UI
      - "16686:16686"
      # ✅ OTLP HTTP receiver (for OpenTelemetry SDK)
      - "4318:4318"
      # 🟡 gRPC receiver (alternative)
      - "4317:4317"
      # 🟡 Jaeger native protocols (legacy)
      - "6831:6831/udp"
      - "14268:14268"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
      - LOG_LEVEL=info
    networks:
      - microservices

networks:
  microservices:
    external: true
```

### 2. Hyperf 安装追踪组件

```bash
# ✅ Install OpenTelemetry integration for Hyperf
composer require hyperf/tracer

# 🟢 Optional: install OpenTelemetry auto-instrumentation
composer require open-telemetry/opentelemetry-auto-hyperf
```

### 3. Hyperf 追踪配置

```php
<?php
// config/autoload/opentracing.php

declare(strict_types=1);

return [
    'enable' => env('TRACER_ENABLE', true),
    
    // ✅ Use Jaeger as tracing backend via OTLP
    'driver' => \Hyperf\Tracer\Adapter\JaegerTracerFactory::class,
    
    'driver_config' => [
        'name' => env('APP_NAME', 'user-service'),
        'endpoint' => env('JAEGER_ENDPOINT', 'http://jaeger:4318/v1/traces'),
        'sampler' => [
            'type' => 'probabilistic',
            // 🟢 10% sampling rate for production, adjust as needed
            'param' => env('TRACER_SAMPLE_RATE', 0.1),
        ],
        // ✅ Tags to identify this service in Jaeger UI
        'tags' => [
            'service.version' => env('APP_VERSION', '1.0.0'),
            'service.env' => env('APP_ENV', 'development'),
        ],
    ],

    // ✅ Auto-trace these components
    'middleware' => [
        // Trace HTTP requests
        \Hyperf\Tracer\Middleware\TraceMiddleware::class,
    ],

    // 🟢 Trace specific method calls via annotation
    'aspect' => [
        \Hyperf\Tracer\Aspect\MethodAspect::class,
    ],

    // ✅ Propagation format: W3C Trace Context
    'propagation' => [
        'format' => 'tracecontext',
    ],
];
```

### 4. 用户服务追踪集成

```php
<?php
// app/Controller/UserController.php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\GetMapping;
use Hyperf\Tracer\Annotation\Tag;
use Hyperf\Tracer\Annotation\Trace;

#[Controller(prefix: '/api/users')]
class UserController
{
    #[Inject]
    private UserService $userService;

    #[GetMapping(path: '/{id}')]
    public function getUser(int $id): array
    {
        // ✅ TraceMiddleware automatically creates root span
        // Additional business spans via @Trace annotation
        return $this->userService->getUserDetail($id);
    }
}

// app/Service/UserService.php
<?php

declare(strict_types=1);

namespace App\Service;

use App\Model\User;
use Hyperf\Tracer\Annotation\Trace;
use Hyperf\Tracer\Annotation\Tag;

class UserService
{
    /**
     * ✅ @Trace creates a child span automatically
     * ✅ @Tag adds key-value tags to the span
     */
    #[Trace]
    #[Tag(key: 'user.id', value: '#{id}')]
    public function getUserDetail(int $id): array
    {
        $user = User::find($id);
        
        if ($user === null) {
            return ['error' => 'User not found', 'code' => 404];
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
        ];
    }
}
```

### 5. 自定义 Span（手动埋点）

```php
<?php
// app/Service/OrderClientService.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Context\Context;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\StatusCode;

class OrderClientService
{
    public function getUserOrders(int $userId): array
    {
        // ✅ Get current span from context
        $tracer = \OpenTelemetry\API\Globals::tracerProvider()
            ->getTracer('user-service', '1.0.0');

        // ✅ Create child span for external call
        $span = $tracer->spanBuilder('OrderClient.getUserOrders')
            ->setAttribute('rpc.system', 'http')
            ->setAttribute('rpc.service', 'order-service')
            ->setAttribute('user.id', $userId)
            ->startSpan();

        $scope = $span->activate();

        try {
            $orders = $this->callOrderService($userId);
            $span->setStatus(StatusCode::STATUS_OK);
            return $orders;
        } catch (\Throwable $e) {
            // 🔴 Record exception in span
            $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());
            $span->recordException($e);
            throw $e;
        } finally {
            // ✅ Always end span and detach scope
            $scope->detach();
            $span->end();
        }
    }

    private function callOrderService(int $userId): array
    {
        // Simulate HTTP call
        return [
            ['order_id' => 101, 'amount' => 99.90],
            ['order_id' => 102, 'amount' => 199.00],
        ];
    }
}
```

---

## 执行预览

```bash
# Start Jaeger
$ docker compose -f docker-compose.jaeger.yml up -d
[+] Running 1/1
 ✔ Container jaeger  Started

# Start Hyperf user service
$ php bin/hyperf.php start

# Make a request
$ curl http://localhost:9501/api/users/1
{"id":1,"name":"Hahn","email":"hahn@example.com","status":"active"}

# Open Jaeger UI → http://localhost:16686
# Select service: "user-service"
# Find traces, click to see span details:
# ┌─ GET /api/users/1 (45ms)
# │  └─ UserService.getUserDetail (30ms)
# │     └─ MySQL Query (15ms)

# Check Jaeger health
$ curl http://localhost:16686/api/services
{"data":["user-service"],"total":1,"limit":0,"offset":0,"errors":null}
```

---

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 采样率不要设 100% | 生产环境会产生大量数据 | 存储爆满，服务性能下降 |
| Span 必须配对 end() | 每个startSpan必须有end | 内存泄漏，不完整的 Span |
| All-in-One 不适合生产 | 单点故障，无持久化 | 数据丢失，服务不可用 |
| OTLP 端口要一致 | Hyperf 配置的端口要匹配 Jaeger | 数据发不出去，无追踪 |
| Docker 网络要通 | 服务和 Jaeger 在同一网络 | 连接超时 |

---

## 避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| 用旧版 Jaeger Client 直接上报 | 已废弃，不支持 OTel | 用 OTLP 协议 + OTel SDK |
| Span scope 不 detach | 上下文混乱 | finally 块中 detach + end |
| 采样率为 0 | 追踪完全不工作 | 至少设 0.01（1%） |
| Jaeger 容器 OOM | 大流量下崩溃 | 调整内存限制或用 Elasticsearch 存储 |
| 时区不一致 | Jaeger UI 时间显示错误 | 统一 UTC 或配置时区 |

---

## 练习题

### 🟢 基础题

1. **部署 Jaeger 并验证**：用 Docker 部署 Jaeger All-in-One，通过 UI 创建并查询一条测试追踪。

2. **添加 @Trace 注解**：在 UserService 的三个方法上添加 `@Trace` 和 `@Tag` 注解，观察 Jaeger UI 中的 Span 层级。

### 🟡 进阶题

3. **多服务追踪**：部署两个 Hyperf 服务，通过 HTTP 相互调用，在 Jaeger 中看到跨服务的完整链路。

### 🔴 开放题

4. **生产级 Jaeger 架构**：设计一个使用 Elasticsearch 作为存储后端、Collector 独立部署、支持采集器水平扩展的 Jaeger 生产架构。

---

## 知识点总结

```
Jaeger 部署与 Hyperf 集成
├── Jaeger 架构
│   ├── Agent（Sidecar 模式）
│   ├── Collector（数据处理与存储）
│   ├── Query（查询 API）
│   ├── UI（可视化界面）
│   └── Storage（内存/Badger/Elasticsearch/Cassandra）
├── 部署模式
│   ├── All-in-One（开发环境）
│   ├── Production（组件独立部署）
│   └── Kubernetes（DaemonSet + Collector）
├── Hyperf 集成
│   ├── hyperf/tracer 组件
│   ├── TraceMiddleware（HTTP 自动追踪）
│   ├── @Trace + @Tag 注解
│   ├── 手动埋点（Tracer API）
│   └── 配置项（采样率、端点、标签）
└── OTLP 协议
    ├── HTTP 传输（4318）
    ├── gRPC 传输（4317）
    └── W3C Trace Context 传播
```

---

## 举一反三

| 场景 | 变种说明 | 关键差异 |
|------|----------|----------|
| Jaeger → Zipkin | 另一个流行的追踪后端 | API 和数据模型不同，Zipkin 更轻量 |
| OTLP HTTP → gRPC | 传输协议选择 | gRPC 更高效但需要额外端口 |
| Docker → Kubernetes 部署 | 容器编排平台不同 | K8s 用 Sidecar 或 DaemonSet 注入 Agent |

---

## 参考资料

| 资料 | 链接 | 权威等级 |
|------|------|----------|
| Jaeger 官方文档 | https://www.jaegertracing.io/docs/ | ⭐⭐⭐⭐⭐ |
| Hyperf Tracer 组件 | https://hyperf.wiki/3.0/#/zh-cn/tracer | ⭐⭐⭐⭐ |
| OpenTelemetry PHP SDK | https://github.com/open-telemetry/opentelemetry-php | ⭐⭐⭐⭐ |
| OTLP 规范 | https://opentelemetry.io/docs/specs/otlp/ | ⭐⭐⭐⭐⭐ |

---

## 代码演进

### v1 ❌ 直接使用 Jaeger Client（已废弃）

```php
// ❌ Old Jaeger client, no longer maintained
$tracer = new Jaeger\Tracer(
    'user-service',
    new Jaeger\Transport\UdpTransport('jaeger:6831')
);
```

### v2 ✅ 使用 Hyperf Tracer 组件 + OTLP

```php
// config/autoload/opentracing.php
return [
    'enable' => true,
    'driver' => \Hyperf\Tracer\Adapter\JaegerTracerFactory::class,
    'driver_config' => [
        'endpoint' => 'http://jaeger:4318/v1/traces',
    ],
];
// ✅ Automatic HTTP tracing via middleware
```

### v3 🟢 手动 Span + 异常追踪 + 自定义属性

```php
$span = $tracer->spanBuilder('UserService.getDetail')
    ->setAttribute('db.system', 'mysql')
    ->setAttribute('db.operation', 'SELECT')
    ->startSpan();

$scope = $span->activate();
try {
    $result = $this->repository->find($id);
    $span->setAttribute('result.count', count($result));
    return $result;
} catch (\Throwable $e) {
    $span->recordException($e);
    throw $e;
} finally {
    $scope->detach();
    $span->end();
}
```
