---
title: "031-API网关与BFF模式"
slug: "031-kratos-api-gateway"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:31:43.495+08:00"
updated_at: "2026-04-29T10:02:45.521+08:00"
reading_time: 31
tags: []
---

# 031-API网关与BFF模式

> 难度：⭐⭐⭐⭐⭐（高级架构篇）
> 适用：微服务架构师、后端高级工程师、DevOps工程师
> 前置知识：Kratos基础、gRPC、HTTP协议、微服务基本概念

---

## 一、概念讲解

### 1.1 什么是API网关？

API网关是微服务架构中的**统一入口**，所有外部请求都经过网关再路由到后端服务。它不是简单的反向代理，而是承担了路由分发、协议转换、认证鉴权、限流熔断、日志监控等横切关注点。

**核心职责：**

| 职责 | 说明 |
|------|------|
| 路由分发 | 根据URL/Header将请求路由到不同微服务 |
| 协议转换 | HTTP ↔ gRPC、JSON ↔ Protobuf |
| 认证鉴权 | JWT验证、OAuth2、API Key校验 |
| 限流熔断 | 保护后端服务不被流量打垮 |
| 聚合查询 | 多个后端服务的数据聚合为一个响应 |
| 日志追踪 | 统一请求日志、链路追踪ID注入 |

### 1.2 什么是BFF模式？

BFF（Backend for Frontend）是**为特定前端类型定制的后端层**。不同于通用API网关，BFF针对不同客户端（Web、App、小程序）提供差异化的API。

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  Web端   │     │ iOS App │     │ 小程序   │
└────┬─────┘     └────┬────┘     └────┬────┘
     │                │               │
     v                v               v
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Web BFF │     │ App BFF │     │ Mini BFF│
└────┬─────┘     └────┬────┘     └────┬────┘
     │                │               │
     └────────────────┼───────────────┘
                      v
              ┌───────────────┐
              │  微服务集群     │
              │ User/Order/...│
              └───────────────┘
```

### 1.3 Kratos在网关架构中的定位

Kratos本身**不是网关**，而是网关后端的微服务框架。常见架构：

- **网关层**：Kong / APISIX / Envoy（处理路由、限流、认证）
- **BFF层**：Kratos服务或Node.js/Go BFF（数据聚合、格式适配）
- **服务层**：Kratos微服务（业务逻辑）

---

## 二、脑图

```
API网关与BFF
├── API网关
│   ├── 核心职责
│   │   ├── 路由分发
│   │   ├── 协议转换 (HTTP↔gRPC)
│   │   ├── 认证鉴权 (JWT/OAuth2)
│   │   ├── 限流熔断
│   │   └── 日志追踪
│   ├── 选型对比
│   │   ├── Kong (Lua/Go插件)
│   │   ├── APISIX (Apache, 高性能)
│   │   ├── Envoy (xDS, Service Mesh)
│   │   └── 自研 (Go/Gin)
│   └── 网关模式
│       ├── 单网关
│       └── 多网关 (按业务域拆分)
├── BFF模式
│   ├── 按客户端拆分
│   │   ├── Web BFF
│   │   ├── App BFF
│   │   └── Mini BFF
│   ├── 核心价值
│   │   ├── 数据裁剪
│   │   ├── 接口聚合
│   │   └── 协议适配
│   └── 注意事项
│       ├── 不要堆积业务逻辑
│       └── 保持薄层
├── Kratos集成
│   ├── 作为BFF服务
│   ├── 作为后端服务
│   ├── HTTP/gRPC双协议
│   └── 多服务聚合查询
└── 实战模式
    ├── 聚合查询
    ├── 扇出请求
    └── 缓存策略
```

---

## 三、完整Go代码

### 3.1 BFF聚合服务

```go
// bff/main.go - BFF service that aggregates multiple backend services
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	pbUser "bff/api/user"
	pbOrder "bff/api/order"
	pbProduct "bff/api/product"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
)

// UserProfileResponse aggregates user, orders, and recommendations
type UserProfileResponse struct {
	User          *pbUser.UserReply   `json:"user"`
	RecentOrders  []*pbOrder.OrderReply `json:"recent_orders"`
	Recommendations []*pbProduct.ProductReply `json:"recommendations"`
}

// BFFService handles aggregation logic
type BFFService struct {
	userClient    pbUser.UserClient
	orderClient   pbOrder.OrderClient
	productClient pbProduct.ProductClient
}

// GetUserProfile aggregates data from multiple services concurrently
func (s *BFFService) GetUserProfile(ctx context.Context, req *pbUser.GetUserRequest) (*pbUser.UserProfileReply, error) {
	// Fan-out: call multiple services in parallel using errgroup
	g, gCtx := errgroup.WithContext(ctx)
	g.SetLimit(3) // max 3 concurrent calls

	var (
		user          *pbUser.UserReply
		orders        *pbOrder.ListOrdersReply
		recommendations *pbProduct.ListProductsReply
	)

	// Call user service
	g.Go(func() error {
		var err error
		user, err = s.userClient.GetUser(gCtx, req)
		return err
	})

	// Call order service for recent orders
	g.Go(func() error {
		var err error
		orders, err = s.orderClient.ListOrders(gCtx, &pbOrder.ListOrdersRequest{
			UserId: req.Id,
			Limit:  5,
		})
		return err
	})

	// Call product service for recommendations
	g.Go(func() error {
		var err error
		recommendations, err = s.productClient.ListProducts(gCtx, &pbProduct.ListProductsRequest{
			CategoryId: 0, // 0 means all categories
			Limit:      10,
		})
		return err
	})

	// Wait for all goroutines to complete
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("aggregation failed: %w", err)
	}

	// Build aggregated response
	return &pbUser.UserProfileReply{
		User:            user,
		RecentOrders:    orders.Orders,
		Recommendations: recommendations.Products,
	}, nil
}

func main() {
	// Connect to backend gRPC services
	userConn, err := grpc.DialInsecure(
		context.Background(),
		grpc.WithEndpoint("localhost:9001"),
	)
	if err != nil {
		log.Fatal(err)
	}

	orderConn, err := grpc.DialInsecure(
		context.Background(),
		grpc.WithEndpoint("localhost:9002"),
	)
	if err != nil {
		log.Fatal(err)
	}

	productConn, err := grpc.DialInsecure(
		context.Background(),
		grpc.WithEndpoint("localhost:9003"),
	)
	if err != nil {
		log.Fatal(err)
	}

	// Create BFF service
	bff := &BFFService{
		userClient:    pbUser.NewUserClient(userConn),
		orderClient:   pbOrder.NewOrderClient(orderConn),
		productClient: pbProduct.NewProductClient(productConn),
	}

	// Create HTTP server for BFF (external facing)
	httpSrv := http.NewServer(
		http.Address(":8000"),
		http.Middleware(
			recovery.Recovery(),
			logging.Server(nil),
		),
	)

	// Create internal gRPC server
	grpcSrv := grpc.NewServer(
		grpc.Address(":9000"),
		grpc.Middleware(
			recovery.Recovery(),
			logging.Server(nil),
		),
	)

	// Register BFF service on both HTTP and gRPC
	pbUser.RegisterUserHTTPServer(httpSrv, bff)
	pbUser.RegisterUserServer(grpcSrv, bff)

	app := kratos.New(
		kratos.Name("bff"),
		kratos.Server(httpSrv, grpcSrv),
	)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

### 3.2 APISIX网关配置

```yaml
# apisix_routes.yaml - Route configuration for APISIX gateway
routes:
  # Route to BFF for user profile aggregation
  - uri: /api/v1/user/profile/*
    upstream:
      type: roundrobin
      nodes:
        "bff-service:8000": 1
    plugins:
      limit-count:
        count: 100
        time_window: 60
        rejected_code: 429
      jwt-auth:
        secret: "your-jwt-secret"

  # Route directly to user service
  - uri: /api/v1/users/*
    upstream:
      type: roundrobin
      nodes:
        "user-service:8000": 1
    plugins:
      key-auth:
        header: X-API-Key

  # Route to order service
  - uri: /api/v1/orders/*
    upstream:
      type: roundrobin
      nodes:
        "order-service:8000": 1

  # gRPC proxy for internal services
  - uri: /grpc/*
    upstream:
      type: roundrobin
      scheme: grpc
      nodes:
        "grpc-backend:9000": 1
```

### 3.3 请求聚合中间件

```go
// pkg/middleware/aggregation.go - Request aggregation middleware
package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	khttp "github.com/go-kratos/kratos/v2/transport/http"
)

// AggregatedResult holds results from multiple service calls
type AggregatedResult struct {
	mu      sync.Mutex
	results map[string]json.RawMessage
	errors  map[string]error
}

// NewAggregatedResult creates a new aggregation context
func NewAggregatedResult() *AggregatedResult {
	return &AggregatedResult{
		results: make(map[string]json.RawMessage),
		errors:  make(map[string]error),
	}
}

// Fetch calls a service and stores the result
func (a *AggregatedResult) Fetch(key string, fn func() (json.RawMessage, error)) {
	result, err := fn()
	a.mu.Lock()
	defer a.mu.Unlock()
	if err != nil {
		a.errors[key] = err
		return
	}
	a.results[key] = result
}

// AggregateHTTPHandler creates a middleware that aggregates responses
func AggregateHTTPHandler(timeout time.Duration) khttp.ServerOption {
	return khttp.Middleware(
		func(handler khttp.Handler) khttp.Handler {
			return func(ctx context.Context, req interface{}) (interface{}, error) {
				return handler(ctx, req)
			}
		},
	)
}

// RequestContext injects timeout and trace info
func RequestContext(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			// Inject trace ID if not present
			traceID := r.Header.Get("X-Trace-ID")
			if traceID == "" {
				traceID = generateTraceID()
			}

			ctx = context.WithValue(ctx, "traceID", traceID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func generateTraceID() string {
	return fmt.Sprintf("trace-%d", time.Now().UnixNano())
}
```

---

## 四、执行预览

```bash
# Start backend services
$ docker-compose up -d user-service order-service product-service

# Start BFF service
$ go run bff/main.go
INFO msg=server started addr=[::]:8000
INFO msg=server started addr=[::]:9000

# Call BFF aggregation endpoint
$ curl http://localhost:8000/api/v1/user/profile/1
{
  "user": {
    "id": "1",
    "name": "张三",
    "email": "zhangsan@example.com"
  },
  "recent_orders": [
    {"id": "101", "product": "Go编程", "amount": 99.9},
    {"id": "102", "product": "Kratos实战", "amount": 129.0}
  ],
  "recommendations": [
    {"id": "201", "name": "微服务设计", "price": 89.0},
    {"id": "202", "name": "DDD实战", "price": 79.0}
  ]
}

# Through APISIX gateway
$ curl http://localhost:9080/api/v1/user/profile/1 \
  -H "Authorization: Bearer <jwt-token>"
# Same response with rate limiting and auth

# Check rate limiting
$ for i in $(seq 1 110); do curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:9080/api/v1/user/profile/1; done
200
200
...
429  # Rate limited after 100 requests
```

---

## 五、注意事项

| 注意点 | 说明 | 影响 |
|--------|------|------|
| BFF不写业务逻辑 | BFF只做聚合、裁剪、适配，不实现业务规则 | 否则变成单体 |
| 聚合超时控制 | 每个子请求必须有独立超时 | 防止级联超时 |
| 网关单点风险 | 网关挂了全挂，必须高可用部署 | 生产必备 |
| 缓存策略 | 聚合数据要合理缓存，避免N+1查询 | 性能关键 |
| 版本管理 | API版本化，网关路由支持多版本 | 平滑升级 |
| 监控告警 | 网关是咽喉要道，必须有完善的监控 | 运维必须 |
| 序列化开销 | HTTP JSON → gRPC Protobuf 转换有性能损耗 | 高并发需优化 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| BFF里写业务逻辑 | BFF只做聚合和适配，业务逻辑留在领域服务 |
| 所有客户端共用一个BFF | 按客户端类型拆分BFF（Web/App/Mini） |
| 网关直接暴露gRPC | 网关做协议转换，内部用gRPC通信 |
| 聚合请求串行调用 | 使用errgroup并发调用，设置总超时 |
| 网关不做限流 | 网关必须配置限流、熔断、降级策略 |
| 不设链路追踪 | 网关注入TraceID，全链路透传 |
| 一个网关管所有路由 | 大规模时按业务域拆分多个网关实例 |

---

## 七、练习题

### 🟢 初级

1. **概念理解**：API网关和反向代理（Nginx）的核心区别是什么？
2. **配置实践**：使用Docker部署一个Kong网关，配置一条路由规则。
3. **BFF理解**：为什么移动端和Web端需要不同的BFF？

### 🟡 中级

4. **聚合实现**：实现一个BFF接口，同时调用用户服务和订单服务，聚合返回。
5. **限流配置**：在APISIX中配置基于IP的限流，每分钟最多60次请求。
6. **错误处理**：BFF聚合时，如果其中一个服务超时，如何优雅降级？

### 🔴 高级

7. **全链路实现**：实现从APISIX网关到BFF到后端服务的完整链路追踪（OpenTelemetry）。
8. **动态路由**：实现基于请求Header的动态路由，将灰度用户路由到v2服务。
9. **性能优化**：BFF层实现多级缓存（本地缓存 + Redis），对比缓存命中率和延迟。

---

## 八、知识点总结

```
API网关与BFF知识点
├── API网关
│   ├── 职责：路由/转换/认证/限流/聚合/监控
│   ├── 选型：Kong vs APISIX vs Envoy
│   └── 部署：高可用、多实例、健康检查
├── BFF模式
│   ├── 定义：为特定客户端定制的后端适配层
│   ├── 原则：薄层、聚合、裁剪、不写业务
│   └── 拆分：按客户端类型 / 按业务域
├── Kratos集成
│   ├── HTTP/gRPC双协议服务
│   ├── errgroup并发聚合
│   ├── 中间件链（recovery/logging/tracing）
│   └── 服务发现与负载均衡
└── 最佳实践
    ├── 超时控制（总超时 + 子请求超时）
    ├── 降级策略（缓存兜底/默认值）
    ├── 灰度发布（网关路由规则）
    └── 可观测性（metrics/traces/logs）
```

---

## 九、举一反三

| 场景 | 网关方案 | BFF方案 | 关键技术 |
|------|---------|---------|---------|
| 电商首页 | APISIX路由+限流 | 聚合商品/广告/推荐 | errgroup+缓存 |
| 社交Feed流 | Kong认证+限流 | 聚合用户动态/评论/点赞 | 流式聚合+游标分页 |
| SaaS多租户 | 网关租户路由 | 租户数据隔离+聚合 | Header路由+租户ID |
| IoT设备接入 | MQTT网关(EMQX) | 设备数据聚合+规则引擎 | WebSocket+协议转换 |
| 开放平台 | API网关+开发者门户 | 开放API聚合+沙箱 | OAuth2+限流+计量 |

---

## 十、参考资料

1. [Kong官方文档](https://docs.konghq.com/)
2. [Apache APISIX文档](https://apisix.apache.org/docs/apisix/getting-started/)
3. [Sam Newman - Building Microservices (BFF模式)](https://samnewman.io/patterns/architectural/bff/)
4. [Kratos官方文档 - HTTP Server](https://go-kratos.dev/docs/component/transport/http)
5. [Envoy Proxy文档](https://www.envoyproxy.io/docs/envoy/latest/)

---

## 十一、代码演进

### v1：单服务直连
```go
// v1: Direct HTTP call to user service - simplest approach
func GetUser(ctx context.Context, id int64) (*User, error) {
    resp, err := http.Get(fmt.Sprintf("http://user-service:8000/users/%d", id))
    // No gateway, no BFF, direct coupling
}
```

### v2：引入API网关
```go
// v2: Through API gateway with auth and rate limiting
func GetUser(ctx context.Context, id int64) (*User, error) {
    req, _ := http.NewRequest("GET", "http://gateway:9080/api/v1/users/"+strconv.FormatInt(id, 10), nil)
    req.Header.Set("Authorization", "Bearer "+token)
    // Gateway handles: auth, rate limit, routing
}
```

### v3：BFF聚合 + 网关
```go
// v3: BFF aggregation with errgroup, gateway handles cross-cutting
func GetUserProfile(ctx context.Context, id int64) (*UserProfile, error) {
    g, gCtx := errgroup.WithContext(ctx)
    // Concurrent calls to user/order/product services
    // BFF aggregates, gateway routes and protects
    // Full observability with trace propagation
}
```

**演进路线**：单服务直连 → API网关统一入口 → BFF聚合 + 网关分层
