---
title: "017 - 链路追踪 OpenTelemetry | Kratos实战系列"
slug: "017-kratos-tracing"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:01:48.719+08:00"
updated_at: "2026-04-29T10:02:45.408+08:00"
reading_time: 21
tags: []
---

# 链路追踪 OpenTelemetry

> **难度：** ⭐⭐⭐⭐ | **预计阅读：** 18 分钟
>
> 在 Kratos 微服务中集成 OpenTelemetry，实现全链路追踪：从 HTTP/gRPC 入口到数据库查询，跨服务调用一目了然。

---

## 1. 概念讲解

### 什么是链路追踪？

微服务架构下一个请求可能经过多个服务，链路追踪（Distributed Tracing）记录请求在每个服务的耗时和状态，帮助定位性能瓶颈和故障根因。

核心概念：

| 概念 | 说明 |
|------|------|
| Trace | 一次完整请求链路，包含多个 Span |
| Span | 一个操作单元（如一次 HTTP 请求、一次 DB 查询） |
| Context | 追踪上下文，在服务间传播（TraceID + SpanID） |
| Sampler | 采样策略，控制哪些请求被追踪 |

### 为什么选 OpenTelemetry？

OpenTelemetry 是 CNCF 的可观测性标准，合并了 OpenTracing 和 OpenCensus，提供统一的 API 用于 traces、metrics、logs。它是行业事实标准。

### Kratos + OTel 集成点

```
Client → [Kratos HTTP/gRPC Server] → [Service Layer] → [Data Layer → DB]
              ↑ OTel Middleware              ↑ Manual Span       ↑ Auto Instrument
```

---

## 2. 脑图

```
OpenTelemetry 集成
├── 基础概念
│   ├── Trace / Span / Context
│   ├── W3C TraceContext 传播
│   └── Baggage 机制
├── Kratos 集成
│   ├── kratos/middleware/tracing
│   ├── HTTP Server Provider
│   └── gRPC Server Provider
├── Jaeger 部署
│   ├── All-in-one (开发)
│   ├── Production (Collector + Agent)
│   └── 存储后端 (Elasticsearch)
├── 采样策略
│   ├── AlwaysOn
│   ├── TraceIDRatioBased
│   └── ParentBased
├── 自定义 Span
│   ├── 手动创建 Span
│   ├── 添加 Attributes/Events
│   └── 记录错误
└── 可视化分析
    ├── Jaeger UI
    ├── 服务依赖图
    └── 慢查询定位
```

---

## 3. 完整 Go 代码

### v1 — 基础 OTel + Jaeger 集成

```go
// go.mod dependencies:
// go.opentelemetry.io/otel
// go.opentelemetry.io/otel/exporters/jaeger
// go.opentelemetry.io/otel/sdk/trace
// github.com/go-kratos/kratos/v2/middleware/tracing

// cmd/server/main.go — OTel initialization
package main

import (
	"context"
	"log"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/propagation"
)

// initTracer creates a Jaeger exporter and registers the tracer provider
func initTracer(url string) (func(context.Context), error) {
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(url)))
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithBatcher(exp),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp.Shutdown, nil
}

func main() {
	shutdown, err := initTracer("http://localhost:14268/api/traces")
	if err != nil {
		log.Fatalf("init tracer failed: %v", err)
	}
	defer shutdown(context.Background())

	// Use tracing middleware in Kratos server
	httpSrv := http.NewServer(
		http.Address(":8000"),
		http.Middleware(
			tracing.Server(),
		),
	)

	app := kratos.New(kratos.Server(httpSrv))
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

### v2 — 跨服务追踪 + 自定义 Span

```go
// internal/service/user.go — add custom spans
package service

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type UserService struct {
	v1.UnimplementedUserHTTPServer
	uc *biz.UserUsecase
}

func (s *UserService) GetUser(ctx context.Context, req *v1.GetUserReq) (*v1.GetUserReply, error) {
	// Create custom span for business logic
	ctx, span := otel.Tracer("user-service").Start(ctx, "GetUser")
	defer span.End()

	// Add attributes
	span.SetAttributes(attribute.Int64("user.id", req.Id))

	user, err := s.uc.GetUser(ctx, req.Id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}

	// Add event
	span.AddEvent("user.found", attribute.Int64("user.id", user.ID))
	return &v1.GetUserReply{User: user}, nil
}
```

```go
// internal/data/user.go — trace DB queries
package data

import (
	"context"
	semconv "go.opentelemetry.io/otel/semconv/v1.20.0"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel"
)

func (r *userRepo) GetUser(ctx context.Context, id int64) (*biz.User, error) {
	ctx, span := otel.Tracer("data-layer").Start(ctx, "SELECT user",
		attribute.String("db.system", "mysql"),
		attribute.String("db.statement", "SELECT * FROM users WHERE id = ?"),
	)
	defer span.End()

	var user biz.User
	err := r.data.db.WithContext(ctx).First(&user, id).Error
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	return &user, nil
}
```

### v3 — 采样策略 + gRPC 跨服务传播

```go
// cmd/server/main.go — production-grade tracing setup
func initTracerProd(url string) (func(context.Context), error) {
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(url)))
	if err != nil {
		return nil, err
	}

	// Production sampling: 10% + errors always sampled
	sampler := sdktrace.ParentBased(
		sdktrace.TraceIDRatioBased(0.1),  // Sample 10% of new traces
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sampler),
		sdktrace.WithBatcher(exp,
			sdktrace.WithMaxExportBatchSize(512),
			sdktrace.WithBatchTimeout(5*time.Second),
		),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String("user-service"),
			semconv.ServiceVersionKey.String("1.0.0"),
		)),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp.Shutdown, nil
}
```

```go
// gRPC client with tracing propagation
import (
	grpcTracer "go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

func NewOrderGRPCClient(addr string) v1.OrderServiceClient {
	conn, err := grpc.Dial(addr,
		grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
	)
	if err != nil {
		panic(err)
	}
	return v1.NewOrderServiceClient(conn)
}
```

---

## 4. 执行预览

```bash
# Start Jaeger all-in-one
$ docker run -d --name jaeger \
  -p 16686:16686 -p 14268:14268 \
  jaegertracing/all-in-one:1.52

# Start service
$ JAEGER_URL=http://localhost:14268/api/traces go run cmd/server/main.go

# Make requests
$ curl http://localhost:8000/user/1
{"id":1,"name":"Alice"}

# Open Jaeger UI → http://localhost:16686
# Search by service "user-service" → see full trace with spans:
#   - kratos.Server GetUser (HTTP)
#     ├── GetUser (business logic)
#     │   └── SELECT user (DB query)  2.3ms
#     └── Serialize response
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| Propagator | 必须设置 W3C TraceContext，否则跨服务传播失效 |
| 采样率 | 开发环境 AlwaysSample，生产建议 1%-10% |
| Batch 导出 | 用 Batcher 而非同步导出，避免阻塞请求 |
| Span 命名 | 用 `类名.方法名` 格式，便于搜索 |
| Resource | 标注 service.name 和 version，区分不同服务 |
| 错误记录 | 用 `RecordError` + `SetStatus(Error)` 标记异常 |

---

## 6. 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 生产环境 AlwaysSample | 使用 ParentBased + TraceIDRatioBased 采样 |
| 不设置 TextMapPropagator | 必须设置 W3C TraceContext 传播器 |
| 用 SimpleSpanProcessor 同步导出 | 用 BatchSpanProcessor 批量异步导出 |
| 忘记 `defer span.End()` | 每个 Span 必须 End，否则不会导出 |
| Context 丢失（goroutine 内未传递 ctx） | 所有 goroutine/调用链传递 ctx |
| Resource 为空 | 添加 service.name 等属性标识来源 |

---

## 7. 练习题

### 🟢 Easy
1. 启动 Jaeger，在 Kratos 服务中添加 tracing 中间件，查看 trace
2. 给一个 API 添加自定义 Span，设置 Attributes

### 🟡 Medium
3. 实现两个 gRPC 服务的跨服务追踪，验证 TraceID 一致
4. 配置 ParentBased 采样策略，父 span 被采样时子 span 也采样

### 🔴 Hard
5. 实现自定义 Sampler：对所有错误请求 100% 采样，正常请求 1% 采样
6. 集成 OTel + Prometheus + Loki，实现 Traces ↔ Metrics ↔ Logs 关联

---

## 8. 知识点总结

```
OpenTelemetry 链路追踪
├── 核心概念
│   ├── Trace (一次请求链路)
│   ├── Span (操作单元)
│   └── Context (传播载体)
├── Kratos 集成
│   ├── tracing.Server() 中间件
│   ├── HTTP/gRPC 自动注入
│   └── 自定义 Span 创建
├── 传播机制
│   ├── W3C TraceContext
│   ├── gRPC metadata
│   └── HTTP headers
├── 采样策略
│   ├── AlwaysOn / AlwaysOff
│   ├── TraceIDRatioBased
│   └── ParentBased
└── 可视化
    ├── Jaeger UI
    ├── 服务拓扑图
    └── 延迟热力图
```

---

## 9. 举一反三

| 本文学到的 | 可应用到 |
|-----------| ---------|
| OTel SDK 初始化 | 所有 Go 微服务 |
| Context 传播 | 任何需要链路信息的中间件（日志、鉴权） |
| 自定义 Span | 第三方调用（支付、短信、OSS）追踪 |
| 采样策略 | 日志采样、Metrics 聚合 |
| Batcher 批量导出 | 批量写入 DB/Kafka 等场景 |

---

## 10. 参考资料

- [OpenTelemetry Go SDK](https://github.com/open-telemetry/opentelemetry-go)
- [Kratos tracing 中间件](https://github.com/go-kratos/kratos/tree/main/middleware/tracing)
- [Jaeger 官方文档](https://www.jaegertracing.io/docs/)
- [W3C TraceContext 规范](https://www.w3.org/TR/trace-context/)

---

## 11. 代码演进

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | 基础 OTel + Jaeger + Kratos tracing 中间件 | 开发环境、快速验证 |
| v2 | 自定义 Span + 跨服务追踪 + 错误记录 | 生产环境基础版 |
| v3 | 采样策略 + Resource 标注 + gRPC 传播 | 生产环境完整版 |

---

_没有链路追踪的微服务，就像没有地图的迷宫。_ 🔍
