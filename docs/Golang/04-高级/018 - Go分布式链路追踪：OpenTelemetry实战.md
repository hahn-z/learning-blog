---
title: "018 - Go分布式链路追踪：OpenTelemetry实战"
slug: "018-service-discovery"
category: "Golang高级"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.662+08:00"
updated_at: "2026-04-29T10:02:45.236+08:00"
reading_time: 21
tags: ["微服务"]
---

# Go分布式链路追踪：OpenTelemetry实战

> **难度标注：** ⭐⭐⭐⭐☆ 高级
> **前置知识：** Go HTTP服务、gRPC基础、微服务概念
> **预计用时：** 70分钟

---

## 一、概念讲解

分布式链路追踪是可观测性三大支柱之一（Logging、Metrics、Tracing）。当一个请求跨越多个服务时，你需要一种方式把整个调用链串起来。

### 核心概念

| 概念 | 说明 |
|------|------|
| Trace | 一次完整的请求链路，由一个全局唯一的TraceID标识 |
| Span | 链路中的一个操作单元，有SpanID和ParentSpanID |
| Context | 在服务间传递的追踪上下文（TraceID + SpanID） |
| Exporter | 将追踪数据发送到后端（Jaeger、Zipkin、Tempo等） |

### 为什么用OpenTelemetry？

OpenTelemetry是CNCF的可观测性标准，合并了OpenTracing和OpenCensus。它是厂商无关的，你可以随时切换后端。

---

## 二、脑图（ASCII）

```
              ┌───────────────┐
              │   HTTP Client  │
              └───────┬───────┘
                      │ traceparent header
              ┌───────┴───────┐
              │  API Gateway   │ ← Root Span
              │  (otelhttp)    │
              └───────┬───────┘
                      │ gRPC + metadata
          ┌───────────┼───────────┐
          │           │           │
   ┌──────┴──────┐ ┌─┴────────┐ ┌┴──────────┐
   │ User Service │ │Order Svc │ │Payment Svc│
   │  (otelgrpc)  │ │(otelgrpc)│ │(otelgrpc) │
   └──────┬──────┘ └──┬───────┘ └──┬─────────┘
          │           │            │
   ┌──────┴───────────┴────────────┴──────┐
   │         Jaeger / Tempo               │
   │      (Trace Storage & UI)            │
   └──────────────────────────────────────┘
```

---

## 三、完整Go代码

### v1 基础版本：HTTP服务 + Jaeger导出

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

// initTracer creates and registers the OpenTelemetry tracer provider
func initTracer(serviceName string) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(context.Background(),
		otlptracegrpc.WithEndpoint("localhost:4317"),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, fmt.Errorf("creating exporter: %w", err)
	}

	res, err := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceNameKey.String(serviceName)),
	)
	if err != nil {
		return nil, fmt.Errorf("creating resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	return tp, nil
}

// User represents user data
type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// getUserHandler simulates fetching a user with tracing
func getUserHandler(w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("user-service")
	ctx, span := tracer.Start(r.Context(), "getUserHandler",
		trace.WithAttributes(attribute.String("http.method", r.Method)),
	)
	defer span.End()

	// Simulate DB query as a child span
	_, dbSpan := tracer.Start(ctx, "queryUserDB")
	time.Sleep(20 * time.Millisecond) // simulate DB latency
	dbSpan.SetAttributes(attribute.Int("user.id", 1))
	dbSpan.End()

	user := User{ID: 1, Name: "Alice"}
	span.SetAttributes(attribute.String("user.name", user.Name))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func main() {
	tp, err := initTracer("user-service")
	if err != nil {
		log.Fatalf("Failed to init tracer: %v", err)
	}
	defer tp.Shutdown(context.Background())

	http.HandleFunc("/user", getUserHandler)
	log.Println("User service on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
```

### v2 增强版本：HTTP客户端传播 + 自定义Span

```go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

// GatewayHandler calls user-service with trace propagation
func gatewayHandler(w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("api-gateway")
	ctx, span := tracer.Start(r.Context(), "gateway.getUser")
	defer span.End()

	// HTTP client with automatic trace propagation
	client := http.Client{Transport: otelhttp.NewTransport(http.DefaultTransport)}
	req, _ := http.NewRequestWithContext(ctx, "GET", "http://localhost:8081/user", nil)

	resp, err := client.Do(req)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		http.Error(w, "upstream error", 502)
		return
	}
	defer resp.Body.Close()

	var user map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&user)

	// Add business metadata
	span.SetAttributes(attribute.String("user.found", "true"))
	span.SetAttributes(attribute.String("user.name", fmt.Sprintf("%v", user["name"])))

	json.NewEncoder(w).Encode(user)
}
```

### v3 生产版本：gRPC拦截器 + 采样策略

```go
// gRPC server with OpenTelemetry interceptor
import (
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

func startGRPCServer() {
	tp, _ := initTracer("order-service-grpc")
	defer tp.Shutdown(context.Background())

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	)
	// Register your service...
	lis, _ := net.Listen("tcp", ":50052")
	s.Serve(lis)
}

// gRPC client with tracing
func callOrderService(ctx context.Context) {
	conn, _ := grpc.Dial("localhost:50052",
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
	)
	defer conn.Close()
	// Call methods with ctx to propagate trace...
}

// Custom sampling: sample 10% of health checks, 100% of errors
type customSampler struct{}

func (s *customSampler) ShouldSample(params sdktrace.SamplingParameters) sdktrace.SamplingResult {
	if params.Name == "/health" {
		return sdktrace.SamplingResult{Decision: sdktrace.RecordAndSample} // or Drop
	}
	return sdktrace.SamplingResult{Decision: sdktrace.RecordAndSample}
}
func (s *customSampler) Description() string { return "custom" }
```

---

## 四、执行预览

```bash
# Start Jaeger (all-in-one)
$ docker run -d --name jaeger \
  -p 16686:16686 -p 4317:4317 \
  jaegertracing/all-in-one:latest

# Start user service
$ go run user-service/main.go
User service on :8081

# Start gateway
$ go run gateway/main.go
Gateway on :8080

# Test
$ curl http://localhost:8080/user
{"id":1,"name":"Alice"}

# Open Jaeger UI: http://localhost:16686
# See the full trace: gateway → user-service → queryUserDB
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| 采样率 | 生产环境用概率采样（如10%），避免存储爆炸 |
| Context传播 | 必须把ctx传到每一层，断链就追踪不到 |
| Span命名 | 用"{服务名}.{操作名}"格式，方便检索 |
| 批量导出 | Batcher比同步导出性能好 |
| Shutdown | 程序退出前调用tp.Shutdown()刷出数据 |
| 敏感信息 | 不要在Span Attributes中放密码、Token |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 每个函数都创建Span | 只在关键操作处创建Span |
| 不传context | 每个函数签名都接收ctx context.Context |
| 同步导出追踪数据 | 用WithBatcher异步批量导出 |
| 100%采样 | 生产用概率采样，开发用AlwaysSample |
| 忽略HTTP/gRPC中间件 | 用otelhttp/otelgrpc自动拦截 |
| Span里存大数据 | Attributes只存小量元数据 |

---

## 七、练习题

### 🟢 基础题
1. 在v1基础上添加一个/order接口，创建子Span模拟订单查询
2. 为Span添加自定义Event（记录业务事件）

### 🟡 进阶题
3. 实现两个HTTP服务之间的trace传播（网关→下游）
4. 配置采样策略：错误请求100%采样，正常请求10%采样

### 🔴 挑战题
5. 实现完整的3服务调用链：Gateway → UserService → OrderService，在Jaeger中看到完整链路

---

## 八、知识点总结

```
分布式链路追踪
├── OpenTelemetry
│   ├── Trace Provider
│   ├── Tracer
│   ├── Span (Attributes, Events, Links)
│   └── Context Propagation
├── 集成方式
│   ├── otelhttp (HTTP)
│   ├── otelgrpc (gRPC)
│   └── otelsql (数据库)
├── 后端
│   ├── Jaeger
│   ├── Tempo
│   └── Zipkin
└── 高级
    ├── 采样策略
    ├── Baggage传播
    └── Span Links
```

---

## 九、举一反三

| 场景 | 追踪方案 | Go库 |
|------|---------|------|
| HTTP微服务 | otelhttp中间件 | go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp |
| gRPC服务 | otelgrpc拦截器 | go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc |
| 数据库查询 | otelsql包装 | go.opentelemetry.io/contrib/instrumentation/net/sql/otsql |
| 消息队列 | 手动注入/提取 | carrier + Propagator |
| Redis调用 | otelredis | go.opentelemetry.io/contrib/instrumentation/github.com/redis/go-redis |

---

## 十、参考资料

- [OpenTelemetry Go Docs](https://opentelemetry.io/docs/languages/go/)
- [Jaeger Getting Started](https://www.jaegertracing.io/docs/latest/getting-started/)
- [OpenTelemetry Go Contrib](https://github.com/open-telemetry/opentelemetry-go-contrib)

---

## 十一、代码演进总结

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | 基础HTTP追踪 + Jaeger | 入门，单服务追踪 |
| v2 | HTTP客户端传播 + 网关 | 多服务调用链 |
| v3 | gRPC + 采样 + 生产级 | 生产环境 |

> **核心思想：** 追踪的价值在于跨服务串联。没有context传播的追踪只是"日志plus"，真正的威力在于看到完整的调用链。
