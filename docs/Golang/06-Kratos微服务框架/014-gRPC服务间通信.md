---
title: "014-gRPC服务间通信"
slug: "014-kratos-grpc-service"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:40:31.458+08:00"
updated_at: "2026-04-29T10:02:45.385+08:00"
reading_time: 29
tags: []
---


# 014-gRPC服务间通信

> **难度：** ⭐⭐⭐⭐ | **适合：** 需要实现微服务间高效通信的开发者

## 一、概念讲解

微服务架构中，服务间通信是核心基础设施。gRPC基于HTTP/2和Protocol Buffers，提供高性能、类型安全的RPC调用，是Go微服务间通信的首选。

### gRPC vs HTTP REST

| 特性 | gRPC | HTTP REST |
|------|------|-----------|
| 协议 | HTTP/2 | HTTP/1.1 |
| 序列化 | Protobuf (binary) | JSON (text) |
| 性能 | 高 (3-10x faster) | 一般 |
| 类型安全 | 强 (protobuf schema) | 弱 (需要手动校验) |
| 流式通信 | 支持 (bidirectional) | 不支持 |
| 代码生成 | 自动生成客户端/服务端 | 手动或OpenAPI |
| 浏览器访问 | 需要gRPC-Web | 直接支持 |

### Kratos中的gRPC通信架构

```
┌────────────┐                   ┌────────────┐
│  Service A │ ──gRPC Call──→    │  Service B │
│  (Client)  │ ←──Response──     │  (Server)  │
├────────────┤                   ├────────────┤
│ Transport  │                   │ Transport  │
│ Middleware │                   │ Middleware │
│ Codec      │                   │ Codec      │
└────────────┘                   └────────────┘
      │                                ↑
      └── Service Discovery ───────────┘
```

## 二、脑图

```
gRPC服务间通信
├── Proto定义
│   ├── Service定义
│   ├── Message定义
│   └── 代码生成(kratos proto)
├── 服务端
│   ├── Service实现
│   ├── gRPC Server注册
│   └── 中间件配置
├── 客户端
│   ├── 连接创建
│   ├── 服务发现集成
│   ├── 超时配置
│   └── 重试策略
├── 错误处理
│   ├── Kratos错误规范
│   ├── gRPC Status Code映射
│   └── 错误详情传递
├── 拦截器链
│   ├── 客户端拦截器
│   └── 服务端拦截器
└── 高级特性
    ├── 流式RPC
    ├── Metadata传递
    └── 连接池管理
```

## 三、完整Go代码

### v1: 基础gRPC调用

```protobuf
// api/user/v1/user.proto
syntax = "proto3";
package user.v1;

option go_package = "kratos-demo/api/user/v1";

service UserService {
    rpc GetUser(GetUserRequest) returns GetUserReply {}
}

message GetUserRequest {
    int64 id = 1;
}

message GetUserReply {
    int64 id = 1;
    string name = 2;
    string email = 3;
}
```

```go
// Generate proto code
// kratos proto client api/user/v1/user.proto
```

```go
// internal/service/user.go - gRPC Server implementation
package service

import (
    "context"

    pb "kratos-demo/api/user/v1"
)

type UserService struct {
    pb.UnimplementedUserServiceServer
}

// GetUser implements UserService gRPC method
func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserReply, error) {
    // Simulate database query
    return &pb.GetUserReply{
        Id:    req.Id,
        Name:  "Kratos User",
        Email: "user@kratos.dev",
    }, nil
}
```

```go
// cmd/user/main.go - Start gRPC server
package main

import (
    "log"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "kratos-demo/internal/service"
    pb "kratos-demo/api/user/v1"
)

func main() {
    userSvc := &service.UserService{}

    grpcSrv := grpc.NewServer(
        grpc.Address(":9000"),
    )
    pb.RegisterUserServiceServer(grpcSrv, userSvc)

    app := kratos.New(kratos.Server(grpcSrv))
    if err := app.Run(); err != nil {
        log.Fatal(err)
    }
}
```

### v2: 客户端调用 + 错误处理 + 超时

```go
// internal/data/user_client.go - gRPC client with timeout
package data

import (
    "context"
    "time"

    "github.com/go-kratos/kratos/v2/transport/grpc"
    pb "kratos-demo/api/user/v1"
)

type UserRepo struct {
    client pb.UserServiceClient
}

// NewUserRepo create user repository with gRPC client
func NewUserRepo() *UserRepo {
    conn, err := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("localhost:9000"),
        grpc.WithTimeout(5*time.Second),      // Connection timeout
    )
    if err != nil {
        panic(err)
    }
    return &UserRepo{client: pb.NewUserServiceClient(conn)}
}

// GetUser fetches user with context timeout
func (r *UserRepo) GetUser(ctx context.Context, id int64) (*pb.GetUserReply, error) {
    // Set per-request timeout
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()

    reply, err := r.client.GetUser(ctx, &pb.GetUserRequest{Id: id})
    if err != nil {
        return nil, fmt.Errorf("user service call failed: %w", err)
    }
    return reply, nil
}
```

```go
// internal/service/order.go - Error handling best practices
package service

import (
    "context"

    "github.com/go-kratos/kratos/v2/errors"
)

var (
    // ErrUserNotFound user not found error
    ErrUserNotFound = errors.NotFound("USER_NOT_FOUND", "user not found")
    // ErrUserTimeout user service timeout
    ErrUserTimeout = errors.Timeout("USER_TIMEOUT", "user service timeout")
)

// CreateOrder creates order with user validation
func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateOrderRequest) (*pb.CreateOrderReply, error) {
    // Validate user exists via gRPC call
    user, err := s.userRepo.GetUser(ctx, req.UserId)
    if err != nil {
        // Map transport errors to domain errors
        if errors.IsTimeout(err) {
            return nil, ErrUserTimeout
        }
        return nil, ErrUserNotFound
    }

    // Business logic...
    return &pb.CreateOrderReply{
        OrderId: "ORD-001",
        Status:  "CREATED",
    }, nil
}
```

### v3: 拦截器链 + 服务发现 + 完整调用链

```go
// internal/server/grpc.go - Server with full interceptor chain
package server

import (
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/middleware/validate"
    "github.com/go-kratos/kratos/v2/registry"
    "github.com/go-kratos/kratos/v2/selector/p2c"
    kgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
    consuld "github.com/go-kratos/kratos/contrib/registry/consul/v2"
    "github.com/hashicorp/consul/api"
)

func NewGRPCServer(c *conf.Server, userSvc *service.UserService) *kgrpc.Server {
    var opts = []kgrpc.ServerOption{
        kgrpc.Address(c.Grpc.Addr),
        kgrpc.Timeout(10 * time.Second),
        kgrpc.Middleware(
            recovery.Recovery(),
            tracing.Server(),
            logging.Server(log.DefaultLogger),
            validate.Validator(),
        ),
    }
    srv := kgrpc.NewServer(opts...)
    pb.RegisterUserServiceServer(srv, userSvc)
    return srv
}
```

```go
// internal/data/user_client.go - Full-featured client
package data

import (
    "context"
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/registry"
    "github.com/go-kratos/kratos/v2/selector"
    "github.com/go-kratos/kratos/v2/selector/p2c"
    kgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
    consuld "github.com/go-kratos/kratos/contrib/registry/consul/v2"
    "github.com/hashicorp/consul/api"
    pb "kratos-demo/api/user/v1"
)

// NewUserClient creates gRPC client with discovery + middleware + load balance
func NewUserClient(r registry.Discovery) pb.UserServiceClient {
    conn, err := kgrpc.DialInsecure(
        context.Background(),
        kgrpc.WithEndpoint("discovery:///user-service"),
        kgrpc.WithDiscovery(r),
        kgrpc.WithSelector(selector.SetGlobalSelector(p2c.New())),
        kgrpc.WithTimeout(5*time.Second),
        // Client-side middleware
        kgrpc.WithMiddleware(
            recovery.Recovery(),
            tracing.Client(),  // Note: Client() not Server()
        ),
    )
    if err != nil {
        panic(err)
    }
    return pb.NewUserServiceClient(conn)
}
```

```go
// internal/service/order.go - Cross-service call with full error chain
package service

import (
    "context"
    "fmt"

    "github.com/go-kratos/kratos/v2/log"
    pb "kratos-demo/api/order/v1"
    userpb "kratos-demo/api/user/v1"
)

type OrderService struct {
    pb.UnimplementedOrderServiceServer
    userClient userpb.UserServiceClient
    log        *log.Helper
}

// CreateOrder demonstrates full cross-service call chain
func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateOrderRequest) (*pb.CreateOrderReply, error) {
    // Step 1: Validate user via gRPC call
    user, err := s.userClient.GetUser(ctx, &userpb.GetUserRequest{Id: req.UserId})
    if err != nil {
        s.log.WithContext(ctx).Errorf("get user failed: %v", err)
        return nil, fmt.Errorf("validate user failed: %w", err)
    }

    // Step 2: Create order
    orderID := fmt.Sprintf("ORD-%d", req.UserId)

    // Step 3: Return response with user info
    return &pb.CreateOrderReply{
        OrderId:  orderID,
        UserName: user.Name,
        Status:   "CREATED",
    }, nil
}
```

## 四、执行预览

```bash
# Generate proto
$ kratos proto client api/user/v1/user.proto
# → api/user/v1/user.pb.go
# → api/user/v1/user_grpc.pb.go

# Start user service
$ go run cmd/user/main.go
INFO msg=server listening on: [::]:9000

# Start order service (calls user service)
$ go run cmd/order/main.go
INFO msg=server listening on: [::]:9001

# Call order service (HTTP → gRPC internal call)
$ curl http://localhost:8000/order -d '{"user_id":1}'
{"order_id":"ORD-001","user_name":"Kratos User","status":"CREATED"}

# Check traces (with Jaeger)
$ open http://localhost:16686
# → See: HTTP Gateway → Order Service gRPC → User Service gRPC

# Error case: user service down
$ curl http://localhost:8000/order -d '{"user_id":1}'
{"code":504,"reason":"USER_TIMEOUT","message":"validate user failed: context deadline exceeded"}
```

## 五、注意事项

| 注意点 | 说明 | 建议 |
|--------|------|------|
| Protobuf版本 | proto2 vs proto3不兼容 | 统一使用proto3 |
| 超时设置 | 没超时=无限等待 | 每层设置合理超时 |
| 连接复用 | 每次请求新建连接浪费 | 客户端连接池复用 |
| 错误映射 | gRPC错误码≠业务错误码 | 使用Kratos errors包 |
| 向后兼容 | 字段变更破坏旧客户端 | 只加字段不删不改编号 |
| 流式场景 | 流式RPC需要特殊处理 | 先掌握Unary，再学Stream |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|------------|
| 直接用 `grpc.Dial` | 用 `kratos.DialInsecure` 封装 |
| 不设超时 | 每个gRPC调用设context timeout |
| 用 `status.Errorf` 返回错误 | 用 `errors.New()` / `errors.NotFound()` 等 |
| proto字段编号随便改 | 编号一旦分配不再变更 |
| 不处理连接断开 | 加recovery中间件 + 重试策略 |
| 客户端不传trace context | 客户端加 `tracing.Client()` |
| 大payload用Unary RPC | 超过1MB考虑用Streaming RPC |

## 七、练习题

### 🟢 基础题
1. 定义一个Product服务的proto文件，包含GetProduct和ListProducts两个RPC
2. 实现Product gRPC Server并启动

### 🟡 进阶题
3. 实现Order服务通过gRPC调用User服务和Product服务，完成下单逻辑
4. 给所有gRPC调用添加链路追踪，在Jaeger中查看完整调用链

### 🔴 挑战题
5. 实现gRPC双向流式通信：实时订单状态推送
6. 实现gRPC调用重试策略：指数退避 + 可重试错误码白名单

## 八、知识点总结

```
gRPC服务间通信
├── Proto定义
│   ├── syntax proto3
│   ├── service / rpc定义
│   ├── message字段编号
│   └── kratos proto client 代码生成
├── 服务端
│   ├── grpc.NewServer()
│   ├── Service实现 UnimplementedXxxServer
│   └── Server中间件
├── 客户端
│   ├── grpc.DialInsecure()
│   ├── discovery:/// scheme
│   ├── Client中间件 (tracing.Client())
│   └── 负载均衡 selector
├── 错误体系
│   ├── errors.New / NotFound / Timeout
│   ├── gRPC status code映射
│   └── errors.Is / As 判断
├── 超时控制
│   ├── 连接级超时
│   ├── 请求级 context.WithTimeout
│   └── 超时传播 (deadline propagation)
└── 可观测性
    ├── tracing (OpenTelemetry)
    ├── logging (请求日志)
    └── metrics (调用指标)
```

## 九、举一反三

| 场景 | 方案 | 技术 |
|------|------|------|
| 同步调用 | Unary RPC | 标准gRPC调用 |
| 流式数据 | Server Streaming | 实时日志/事件推送 |
| 双向通信 | Bidirectional Streaming | 聊天/实时协作 |
| 批量查询 | Unary + repeated字段 | 批量接口设计 |
| 文件传输 | Client Streaming | 分块上传 |
| 事件通知 | gRPC + Pub/Sub | 异步解耦 |

## 十、参考资料

- [Kratos官方文档 - gRPC](https://go-kratos.dev/docs/component/transport/grpc)
- [gRPC Go Quick Start](https://grpc.io/docs/languages/go/quickstart/)
- [Protocol Buffers v3 Guide](https://protobuf.dev/programming-guides/proto3/)
- [Kratos错误处理](https://go-kratos.dev/docs/component/errors)

## 十一、代码演进

### v1 → v2 的变化
- 从单服务到客户端/服务端分离
- 添加超时控制（连接级+请求级）
- 引入Kratos错误体系
- 展示错误映射和处理模式

### v2 → v3 的变化
- 完整拦截器链（客户端+服务端）
- 服务发现集成（discovery:///）
- 负载均衡策略（P2C）
- 跨服务调用链路（Order→User）
- 可观测性（tracing贯穿全链路）

### 核心演进路径
```
基础gRPC调用 → 超时+错误处理 → 服务发现+拦截器链+全链路追踪
```
