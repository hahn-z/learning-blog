---
title: "022 - 分布式链路追踪原理与 OpenTelemetry"
slug: "022-tracing-theory"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.888+08:00"
updated_at: "2026-05-01T22:02:57.365+08:00"
reading_time: 6
tags: []
---

# 分布式链路追踪原理与 OpenTelemetry

## 难度标注

⭐⭐⭐（中级）

**前置知识：** 微服务架构基础、HTTP/gRPC 调用、日志系统

**预估用时：** 40-50 分钟

---

## 概念讲解

**分布式链路追踪（Distributed Tracing）** 是一种通过为每个请求分配唯一标识（Trace ID），并在服务间传递该标识来重建完整调用链路的技术，用于定位微服务架构中的性能瓶颈和故障点。

**现实类比：** 你寄一个快递，快递公司给包裹贴一个运单号（Trace ID）。每到一个中转站，工作人员扫描记录（Span）：到达时间、处理人、耗时。最终你可以查看完整的物流轨迹——哪个环节慢了、卡了、丢了。分布式链路追踪就是微服务的"物流追踪系统"。

**技术场景：** 用户服务调用订单服务查询用户订单，订单服务再调用库存服务检查库存。如果整个链路从 50ms 涨到 2 秒，没有追踪你根本不知道是哪个服务出了问题。链路追踪让你一眼看清每一步的耗时。

---

## 实时脑图

```
                  Client Request
                       │
                       ▼
              ┌────────────────┐
              │  User Service  │ ← Trace ID: abc123
              │  Span: GetUser │   Parent: none
              │  Duration: 45ms│
              └───────┬────────┘
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
   ┌─────────────────┐  ┌─────────────────┐
   │  Order Service   │  │  Auth Service   │
   │  Span: GetOrders │  │  Span: Check    │
   │  Parent: abc123  │  │  Parent: abc123 │
   │  Duration: 120ms │  │  Duration: 15ms │
   └────────┬─────────┘  └─────────────────┘
            │
            ▼
   ┌─────────────────┐
   │  Inventory Svc  │
   │  Span: Check    │
   │  Parent: Order  │
   │  Duration: 80ms │
   └─────────────────┘
```

---

## 完整代码

### 1. Trace Context 上下文管理

```php
<?php
// app/Service/TraceContext.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Context\Context;

class TraceContext
{
    // ✅ W3C Trace Context standard keys
    private const TRACE_PARENT = 'traceparent';
    private const TRACE_STATE = 'tracestate';
    private const TRACE_ID_KEY = 'trace.id';
    private const SPAN_ID_KEY = 'trace.span_id';

    public static function getTraceId(): string
    {
        return Context::get(self::TRACE_ID_KEY, self::generateTraceId());
    }

    public static function setTraceId(string $traceId): void
    {
        Context::set(self::TRACE_ID_KEY, $traceId);
    }

    public static function getSpanId(): string
    {
        return Context::get(self::SPAN_ID_KEY, self::generateSpanId());
    }

    public static function setSpanId(string $spanId): void
    {
        Context::set(self::SPAN_ID_KEY, $spanId);
    }

    // ✅ Generate 128-bit trace ID (32 hex chars)
    private static function generateTraceId(): string
    {
        return bin2hex(random_bytes(16));
    }

    // ✅ Generate 64-bit span ID (16 hex chars)
    private static function generateSpanId(): string
    {
        return bin2hex(random_bytes(8));
    }

    /**
     * ✅ Parse W3C traceparent header format: version-traceid-spanid-flags
     * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
     */
    public static function parseTraceParent(string $header): ?array
    {
        $parts = explode('-', $header);
        if (count($parts) !== 4 || $parts[0] !== '00') {
            return null; // 🟡 Invalid format, will create new trace
        }

        return [
            'trace_id' => $parts[1],
            'parent_span_id' => $parts[2],
            'flags' => $parts[3],
        ];
    }

    /**
     * ✅ Build traceparent header for outgoing requests
     */
    public static function buildTraceParent(): string
    {
        return sprintf(
            '00-%s-%s-01',
            self::getTraceId(),
            self::getSpanId()
        );
    }
}
```

### 2. 简易 Span 记录器

```php
<?php
// app/Service/SpanRecorder.php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Context\Context;

class SpanRecorder
{
    private const SPANS_KEY = 'trace.spans';

    public static function startSpan(string $name, string $service): array
    {
        $span = [
            'name' => $name,
            'service' => $service,
            'trace_id' => TraceContext::getTraceId(),
            'span_id' => TraceContext::getSpanId(),
            'start_time' => microtime(true),
            'tags' => [],
        ];

        // ✅ Store span in context
        $spans = Context::get(self::SPANS_KEY, []);
        $spans[] = $span;
        Context::set(self::SPANS_KEY, $spans);

        return $span;
    }

    public static function finishSpan(array $span, ?string $status = 'OK'): void
    {
        $span['end_time'] = microtime(true);
        $span['duration_ms'] = round(($span['end_time'] - $span['start_time']) * 1000, 2);
        $span['status'] = $status;

        // ✅ Update spans in context
        $spans = Context::get(self::SPANS_KEY, []);
        $index = array_search($span, $spans, true);
        if ($index !== false) {
            $spans[$index] = $span;
        }
        Context::set(self::SPANS_KEY, $spans);

        // 🟢 Log span for collection
        logger()->info('trace_span', $span);
    }

    public static function getSpans(): array
    {
        return Context::get(self::SPANS_KEY, []);
    }
}
```

### 3. 用户服务中集成追踪

```php
<?php
// app/Service/UserService.php

declare(strict_types=1);

namespace App\Service;

use App\Model\User;

class UserService
{
    public function getUserWithOrders(int $userId): array
    {
        // ✅ Start root span for this operation
        $span = SpanRecorder::startSpan('GetUserWithOrders', 'user-service');

        try {
            // ✅ Child span: fetch user
            $userSpan = SpanRecorder::startSpan('FindUser', 'user-service');
            $user = User::find($userId);
            SpanRecorder::finishSpan($userSpan);

            if ($user === null) {
                SpanRecorder::finishSpan($span, 'NOT_FOUND');
                return ['error' => 'User not found'];
            }

            // ✅ Child span: call order service with trace propagation
            $orderSpan = SpanRecorder::startSpan('GetOrders', 'order-service');
            $orders = $this->callOrderService($userId);
            SpanRecorder::finishSpan($orderSpan);

            SpanRecorder::finishSpan($span, 'OK');

            return [
                'user' => $user->toArray(),
                'orders' => $orders,
            ];

        } catch (\Throwable $e) {
            // 🔴 Record error in span
            SpanRecorder::finishSpan($span, 'ERROR');
            throw $e;
        }
    }

    private function callOrderService(int $userId): array
    {
        // ✅ Propagate trace context to downstream service
        $traceParent = TraceContext::buildTraceParent();
        
        // Simulate HTTP call with trace header
        // In production, use Hyperf HTTP client with middleware
        $response = \Hyperf\Support\make(
            \GuzzleHttp\Client::class
        )->get("http://order-service/api/orders/{$userId}", [
            'headers' => [
                'traceparent' => $traceParent,  // ✅ W3C standard propagation
            ],
        ]);

        return json_decode($response->getBody()->getContents(), true);
    }
}
```

---

## 执行预览

```bash
# Request with trace context
$ curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  http://localhost:9501/api/users/1

# Log output shows trace spans:
# [INFO] trace_span {"name":"GetUserWithOrders","service":"user-service","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"a1b2c3d4e5f6a7b8","duration_ms":145.23,"status":"OK"}
# [INFO] trace_span {"name":"FindUser","service":"user-service","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","duration_ms":12.50,"status":"OK"}
# [INFO] trace_span {"name":"GetOrders","service":"order-service","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","duration_ms":120.30,"status":"OK"}

# Response:
{
  "user": {"id": 1, "name": "Hahn", "email": "hahn@example.com"},
  "orders": [{"id": 101, "amount": 99.9}]
}
```

---

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| Trace ID 必须全局唯一 | 128-bit 随机数，碰撞概率极低 | 不同请求混在一起，追踪混乱 |
| Span 必须记录父子关系 | 每个 Span 记录 parent_span_id | 无法还原调用树 |
| 采样率要合理 | 生产环境建议 0.1-1% | 100%采样导致存储和性能压力 |
| 跨服务必须传播 traceparent | W3C 标准格式传递 | 链路断裂，无法跨服务追踪 |
| 异步任务也要传递 Trace Context | 队列消息中携带 traceparent | 异步部分变成追踪盲区 |

---

## 避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| 每个服务独立生成 Trace ID | 链路断裂，各服务独立 | 入口服务生成，后续传播 |
| Span 只记开始不记结束 | 无法计算耗时 | start + finish 配对调用 |
| 用线程 ID 代替 Span ID | 并发场景冲突 | 用随机 64-bit ID |
| 日志不关联 Trace ID | 查日志时无法关联追踪 | MDC/context 注入 trace_id |
| 采样只采集成功请求 | 看不到失败的链路 | 错误请求必须 100% 采集 |

---

## 练习题

### 🟢 基础题

1. **手动构建追踪链路**：在两个方法调用间手动传递 Trace ID，打印完整的 Span 树。

2. **解析 traceparent header**：实现一个函数，从 HTTP 请求中解析 traceparent 并设置到 Context。

### 🟡 进阶题

3. **采样策略实现**：实现一个采样器，支持按百分比采样，但错误请求 100% 采样。

### 🔴 开放题

4. **设计一个轻量级追踪系统**：不依赖 Jaeger/Zipkin，仅用 Redis + 日志实现一个可查询的追踪系统，支持按 Trace ID 查询完整链路。

---

## 知识点总结

```
分布式链路追踪
├── 核心概念
│   ├── Trace（一次完整请求链路）
│   ├── Span（一个操作单元）
│   ├── SpanContext（跨进程传递的上下文）
│   └── Span 关系（ChildOf / FollowsFrom）
├── W3C Trace Context 标准
│   ├── traceparent（version-traceid-spanid-flags）
│   ├── tracestate（厂商自定义扩展）
│   └── 向后兼容 B3 格式
├── OpenTelemetry
│   ├── OTel SDK（API + SDK 分离）
│   ├── OTLP 协议（导出格式）
│   ├── 自动埋点 vs 手动埋点
│   └── 采样策略
├── 数据模型
│   ├── 128-bit Trace ID
│   ├── 64-bit Span ID
│   ├── 时间戳与持续时间
│   └── Tags / Logs / Status
└── 关键设计决策
    ├── 采样策略（头部/尾部）
    ├── 上下文传播方式
    └── 存储与查询
```

---

## 举一反三

| 场景 | 变种说明 | 关键差异 |
|------|----------|----------|
| HTTP 追踪 → gRPC 追踪 | 协议不同，传播方式不同 | gRPC 用 Metadata 而非 HTTP Header |
| 同步调用 → 异步队列追踪 | 消息队列中的上下文传播 | 在消息体中嵌入 traceparent |
| 手动埋点 → 自动埋点 | 框架层面自动生成 Span | 依赖框架中间件或 AOP |

---

## 参考资料

| 资料 | 链接 | 权威等级 |
|------|------|----------|
| OpenTelemetry 官方文档 | https://opentelemetry.io/docs/ | ⭐⭐⭐⭐⭐ |
| W3C Trace Context 规范 | https://www.w3.org/TR/trace-context/ | ⭐⭐⭐⭐⭐ |
| Google Dapper 论文 | https://research.google/pubs/pub36356/ | ⭐⭐⭐⭐⭐ |
| Hyperf 3.x 追踪文档 | https://hyperf.wiki/3.0/#/zh-cn/tracer | ⭐⭐⭐⭐ |

---

## 代码演进

### v1 ❌ 无追踪，只靠日志拼接

```php
public function getUser(int $id): ?User
{
    // ❌ No trace context, only local logs
    Log::info("Fetching user {$id}");
    $user = User::find($id);
    Log::info("User fetched: " . ($user ? $user->name : 'null'));
    return $user;
}
```

### v2 ✅ 手动埋点，Span 记录

```php
public function getUser(int $id): ?User
{
    $span = SpanRecorder::startSpan("GetUser#{$id}", 'user-service');
    $user = User::find($id);
    SpanRecorder::finishSpan($span, $user ? 'OK' : 'NOT_FOUND');
    return $user;
}
```

### v3 🟢 OpenTelemetry 自动埋点 + 传播

```php
// Auto-instrumented via Hyperf tracer component
// Trace context propagation handled by middleware
// Only manual spans for business-critical operations
public function getUser(int $id): ?User
{
    $span = OpenTelemetry::tracer()->spanBuilder("UserService.getUser")
        ->setAttribute('user.id', $id)
        ->startSpan();
    
    $user = User::find($id);
    
    $span->setAttribute('user.found', $user !== null)
        ->setStatus($user ? 'OK' : 'NOT_FOUND')
        ->end();
    
    return $user;
}
```
