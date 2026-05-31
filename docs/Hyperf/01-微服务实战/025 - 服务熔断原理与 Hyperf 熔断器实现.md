---
title: "025 - 服务熔断原理与 Hyperf 熔断器实现"
slug: "025-circuit-breaker"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.915+08:00"
updated_at: "2026-05-01T22:17:27.139+08:00"
reading_time: 6
tags: []
---

# 服务熔断原理与 Hyperf 熔断器实现

## 难度标注

⭐⭐⭐⭐（中高级）

**前置知识：** 微服务调用基础、Hyperf 3.x、注解与 AOP

**预估用时：** 50-60 分钟

---

## 概念讲解

**服务熔断（Circuit Breaker）** 是一种保护机制，当下游服务的错误率或响应时间超过阈值时，自动"断开"调用链路，快速失败而非持续等待，避免故障级联扩散到整个系统。经过一段"冷却"后，熔断器会试探性地放行少量请求（半开状态），判断下游是否恢复。

**现实类比：** 家里的保险丝（断路器）。当电流过大时，保险丝自动熔断，保护电器不被烧毁。等你排查完故障、换好保险丝，电力恢复正常。如果刚修好还不确定，你可能先插一个小电器试试（半开），确认没问题再全部通电。

**技术场景：** 用户服务调用订单服务查询用户订单。如果订单服务突然挂了，没有熔断的话，用户服务的每个请求都会等到超时（比如 30 秒），大量线程阻塞，最终用户服务也被拖垮。有了熔断器，前几次失败后直接快速返回错误或兜底数据，不再浪费资源等待。

---

## 实时脑图

```
                    Request → GetUserOrders
                           │
                           ▼
                  ┌─────────────────┐
                  │  Circuit Breaker │
                  │  State Machine   │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌────▼─────┐
        │  CLOSED  │ │   OPEN   │ │ HALF-OPEN│
        │ Normal   │ │  Reject  │ │  Probe   │
        │ Flow     │ │  Fast    │ │  Limited │
        │ Through  │ │  Fail    │ │  Test    │
        └─────┬────┘ └────┬─────┘ └────┬─────┘
              │            │            │
         Failure >    Sleep Window   Probe OK
         Threshold    Expired       → CLOSED
              │            │
              └─────► OPEN ◄── Probe Fail
                          (Reset Timer)
```

---

## 完整代码

### 1. 安装熔断器组件

```bash
# ✅ Install Hyperf circuit breaker component
composer require hyperf/circuit-breaker
```

### 2. 熔断器配置

```php
<?php
// config/autoload/circuit_breaker.php

declare(strict_types=1);

return [
    'default' => [
        'driver' => \Hyperf\CircuitBreaker\Handler\TimeoutHandler::class,
        
        // ✅ Success threshold to close the circuit
        'success_threshold' => 5,
        
        // 🔴 Failure threshold to open the circuit
        'failure_threshold' => 3,
        
        // ✅ How long to stay open before trying half-open (seconds)
        'recovery_time' => 30,
    
        // 🟡 Custom breaker for specific services
        'breakers' => [
            'order-service' => [
                'failure_threshold' => 5,
                'success_threshold' => 3,
                'recovery_time' => 60,
            ],
        ],
    ],
];
```

### 3. 用户服务中使用熔断器

```php
<?php
// app/Service/OrderClientService.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\CircuitBreaker\Annotation\CircuitBreaker;
use Hyperf\Di\Annotation\Inject;
use App\Exception\ServiceUnavailableException;

class OrderClientService
{
    #[Inject]
    private \Hyperf\Guzzle\ClientFactory $clientFactory;

    /**
     * ✅ @CircuitBreaker annotation with fallback
     * - name: unique breaker identifier
     * - failCounter: failures before opening
     * - successCounter: successes before closing
     * - duration: open state duration in seconds
     * - fallback: method to call when circuit is open
     */
    #[CircuitBreaker(
        name: 'order-service',
        failCounter: 3,
        successCounter: 2,
        duration: 30,
        fallback: 'getUserOrdersFallback'
    )]
    public function getUserOrders(int $userId): array
    {
        $client = $this->clientFactory->create([
            'base_uri' => 'http://order-service:9502',
            'timeout' => 5.0,
        ]);

        // ✅ Normal call to order service
        $response = $client->get("/api/orders/user/{$userId}");
        
        return json_decode($response->getBody()->getContents(), true);
    }

    /**
     * ✅ Fallback method - must have same parameters + optional Throwable
     * Called when circuit is OPEN or when the primary method throws
     */
    public function getUserOrdersFallback(int $userId, ?\Throwable $exception = null): array
    {
        // 🟢 Log the fallback event for monitoring
        logger()->warning('Circuit breaker fallback triggered', [
            'service' => 'order-service',
            'user_id' => $userId,
            'error' => $exception?->getMessage(),
        ]);

        // ✅ Return cached/degraded data
        return [
            'user_id' => $userId,
            'orders' => [],
            'message' => 'Order service temporarily unavailable',
            'fallback' => true,
        ];
    }
}
```

### 4. 手动熔断器管理（高级用法）

```php
<?php
// app/Service/CircuitBreakerManager.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\CircuitBreaker\CircuitBreaker;
use Hyperf\CircuitBreaker\CircuitBreakerFactory;
use Hyperf\Di\Annotation\Inject;

class CircuitBreakerManager
{
    #[Inject]
    private CircuitBreakerFactory $factory;

    /**
     * ✅ Get current state of a circuit breaker
     */
    public function getState(string $name): array
    {
        $breaker = $this->factory->get($name);
        
        if ($breaker === null) {
            return ['name' => $name, 'state' => 'unknown'];
        }

        return [
            'name' => $name,
            'state' => $breaker->getState(),       // closed / open / half_open
            'fail_counter' => $breaker->getFailCounter(),
            'success_counter' => $breaker->getSuccessCounter(),
            'last_failure_time' => $breaker->getLastFailureTime(),
        ];
    }

    /**
     * ✅ Manually reset a circuit breaker (admin operation)
     */
    public function reset(string $name): bool
    {
        $breaker = $this->factory->get($name);
        if ($breaker === null) {
            return false;
        }

        // ✅ Force close the circuit
        $breaker->close();
        logger()->info("Circuit breaker manually reset: {$name}");
        return true;
    }

    /**
     * ✅ Get all circuit breaker states for dashboard
     */
    public function getAllStates(): array
    {
        $states = [];
        // In production, track breaker names in config
        foreach (['order-service', 'auth-service', 'notification-service'] as $name) {
            $states[$name] = $this->getState($name);
        }
        return $states;
    }
}
```

### 5. 熔断器状态监控接口

```php
<?php
// app/Controller/CircuitBreakerController.php

declare(strict_types=1);

namespace App\Controller;

use App\Service\CircuitBreakerManager;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\GetMapping;
use Hyperf\HttpServer\Annotation\PostMapping;

#[Controller(prefix: '/api/circuit-breakers')]
class CircuitBreakerController
{
    #[Inject]
    private CircuitBreakerManager $manager;

    // ✅ List all circuit breaker states
    #[GetMapping(path: '')]
    public function list(): array
    {
        return [
            'breakers' => $this->manager->getAllStates(),
        ];
    }

    // ✅ Manually reset a circuit breaker
    #[PostMapping(path: '/{name}/reset')]
    public function reset(string $name): array
    {
        $result = $this->manager->reset($name);
        return [
            'success' => $result,
            'message' => $result ? "Circuit breaker {$name} reset" : "Breaker not found",
        ];
    }
}
```

---

## 执行预览

```bash
# Normal request - circuit CLOSED
$ curl http://localhost:9501/api/users/1/orders
{"user_id":1,"orders":[{"id":101,"amount":99.9}],"fallback":false}

# Simulate order-service down → failures accumulate → circuit OPENS
# After 3 failures:
$ curl http://localhost:9501/api/users/1/orders
{"user_id":1,"orders":[],"message":"Order service temporarily unavailable","fallback":true}

# Check circuit breaker state
$ curl http://localhost:9501/api/circuit-breakers
{
  "breakers": {
    "order-service": {
      "name": "order-service",
      "state": "open",
      "fail_counter": 3,
      "success_counter": 0
    }
  }
}

# After 30s recovery_time → HALF-OPEN → probe request
# If probe succeeds → CLOSED (normal)
# If probe fails → stays OPEN

# Manual reset
$ curl -X POST http://localhost:9501/api/circuit-breakers/order-service/reset
{"success":true,"message":"Circuit breaker order-service reset"}
```

---

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| fallback 方法签名必须匹配 | 参数与原方法一致，可额外加 Throwable | 运行时反射调用失败 |
| recovery_time 要合理 | 太短频繁试探，太长恢复慢 | 系统抖动或恢复不及时 |
| failure_threshold 不宜太小 | 偶发错误不应触发熔断 | 正常波动就熔断，误杀 |
| 熔断器 name 要唯一 | 不同服务/方法用不同 name | 状态互相覆盖 |
| 记录 fallback 事件 | 监控熔断触发频率 | 不知道服务异常，错过告警 |

---

## 避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| fallback 返回异常 | 熔断后仍然报错 | fallback 应返回安全的兜底数据 |
| 熔断器没有 name 区分 | 所有方法共享一个状态 | 每个外部调用用独立 name |
| 没有超时配置 | 请求一直等，熔断器不触发 | 设置合理的 timeout |
| recovery_time 设为 0 | 永远不尝试恢复 | 至少设 10-30 秒 |
| 只熔断不注意日志 | 不知道何时触发熔断 | fallback 中记录日志和指标 |

---

## 练习题

### 🟢 基础题

1. **为认证服务添加熔断器**：在 `AuthService::validateToken` 方法上添加 `@CircuitBreaker` 注解，失败 5 次后熔断，30 秒后恢复。

2. **测试熔断器状态**：手动触发失败请求，通过监控接口观察熔断器从 CLOSED → OPEN → HALF-OPEN → CLOSED 的状态变化。

### 🟡 进阶题

3. **分级熔断策略**：对核心接口（如登录）设置宽松阈值（10 次失败），对非核心接口（如推荐）设置严格阈值（3 次失败），设计配置方案。

### 🔴 开放题

4. **设计熔断器指标面板**：收集熔断器的状态变化、触发次数、恢复时间，设计一个 Prometheus 指标导出方案。

---

## 知识点总结

```
服务熔断
├── 核心概念
│   ├── 三态模型（Closed / Open / Half-Open）
│   ├── 失败计数器
│   ├── 成功计数器
│   └── 恢复时间窗口
├── Hyperf 实现
│   ├── hyperf/circuit-breaker 组件
│   ├── @CircuitBreaker 注解
│   ├── Fallback 方法
│   ├── CircuitBreakerFactory
│   └── 手动状态管理
├── 配置项
│   ├── failure_threshold
│   ├── success_threshold
│   ├── recovery_time
│   └── timeout
└── 监控与运维
    ├── 状态查询接口
    ├── 手动重置
    └── 日志与指标
```

---

## 举一反三

| 场景 | 变种说明 | 关键差异 |
|------|----------|----------|
| HTTP 熔断 → gRPC 熔断 | 不同协议的熔断实现 | gRPC 需要处理 Status Code |
| 单实例熔断 → 分布式熔断 | 多实例共享熔断状态 | 需要 Redis 存储共享状态 |
| 方法级熔断 → 服务级熔断 | 粒度不同 | 服务级需网关或中间件支持 |

---

## 参考资料

| 资料 | 链接 | 权威等级 |
|------|------|----------|
| Martin Fowler - CircuitBreaker | https://martinfowler.com/bliki/CircuitBreaker.html | ⭐⭐⭐⭐⭐ |
| Hyperf 熔断器文档 | https://hyperf.wiki/3.0/#/zh-cn/circuit-breaker | ⭐⭐⭐⭐ |
| Netflix Hystrix | https://github.com/Netflix/Hystrix/wiki | ⭐⭐⭐⭐ |
| Resilience4j | https://resilience4j.readme.io/ | ⭐⭐⭐⭐ |

---

## 代码演进

### v1 ❌ 无熔断，直接调用

```php
public function getUserOrders(int $userId): array
{
    // ❌ No protection, hangs forever if order-service is down
    $response = $this->client->get("/api/orders/user/{$userId}");
    return json_decode($response->getBody()->getContents(), true);
}
```

### v2 ✅ 注解式熔断 + Fallback

```php
#[CircuitBreaker(
    name: 'order-service',
    failCounter: 3,
    duration: 30,
    fallback: 'getUserOrdersFallback'
)]
public function getUserOrders(int $userId): array
{
    $response = $this->client->get("/api/orders/user/{$userId}");
    return json_decode($response->getBody()->getContents(), true);
}

public function getUserOrdersFallback(int $userId, ?\Throwable $e = null): array
{
    return ['user_id' => $userId, 'orders' => [], 'fallback' => true];
}
```

### v3 🟢 手动管理 + 监控面板 + 动态配置

```php
// Dynamic config from Redis/config center
#[CircuitBreaker(
    name: 'order-service',
    failCounter: env('CB_ORDER_FAIL_THRESHOLD', 3),
    duration: env('CB_ORDER_RECOVERY', 30),
    fallback: 'getUserOrdersFallback'
)]
// + CircuitBreakerManager for monitoring
// + Prometheus metrics export
// + Admin API for manual reset
```
