---
title: "010-Service服务层与API对接"
slug: "010-kratos-service"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-28T20:16:03.5+08:00"
updated_at: "2026-04-29T10:02:45.364+08:00"
reading_time: 36
tags: []
---

# 010-Service服务层与API对接

> 难度：⭐⭐⭐（中级）
> 前置知识：Proto生成代码、HTTP/gRPC基础、Kratos biz层

## 一、概念讲解

### Service 层的定位

Service 层是 Kratos 项目中的**传输协议适配层**，它是系统的"门面"：

- **向上**：对接 HTTP/gRPC 协议，接收请求、返回响应
- **向下**：调用 biz 层的 Usecase，执行业务逻辑

### Service 薄层原则

Service 层应该**尽可能薄**，只做以下事情：

1. **请求转换**：Proto Request → biz 层领域模型
2. **调用 biz 层**：转发请求到 Usecase
3. **响应转换**：biz 层返回值 → Proto Response
4. **错误映射**：biz 层错误 → gRPC/HTTP 错误
5. **请求验证**：参数基本校验（配合 validate）

**Service 层不应该做的**：
- ❌ 编写业务逻辑
- ❌ 直接操作数据库
- ❌ 包含复杂的数据转换规则

## 二、脑图

```
Service 服务层
├── 核心职责
│   ├── 协议适配（HTTP + gRPC）
│   ├── 请求转换（Proto → BO）
│   ├── 响应转换（BO → Proto）
│   ├── 错误映射
│   └── 请求验证
├── HTTP 实现
│   ├── JSON 请求/响应
│   ├── 路由注册（Proto 生成）
│   ├── Middleware（认证/限流）
│   └── 文件上传等特殊处理
├── gRPC 实现
│   ├── Protobuf 编解码
│   ├── 服务注册（Proto 生成）
│   ├── Interceptor
│   └── 流式 RPC
├── 薄层原则
│   ├── 不写业务逻辑
│   ├── 不直接操作 DB
│   ├── 一个方法 5-15 行
│   └── 复杂逻辑委托 biz 层
└── 验证与错误处理
    ├── Proto validate 规则
    ├── kratos/errors 统一错误
    └── HTTP Status 自动映射
```

## 三、完整代码示例

### 3.1 Service 实现

```go
// internal/service/order.go
package service

import (
    "context"

    pb "myapp/api/order/v1"
    "myapp/internal/biz"

    "github.com/go-kratos/kratos/v2/log"
)

// OrderService implements the order service proto interface
type OrderService struct {
    pb.UnimplementedOrderServiceServer

    uc  *biz.OrderUsecase
    log *log.Helper
}

// NewOrderService creates a new OrderService (thin wrapper)
func NewOrderService(uc *biz.OrderUsecase, logger log.Logger) *OrderService {
    return &OrderService{
        uc:  uc,
        log: log.NewHelper(logger),
    }
}

// CreateOrder handles POST /v1/orders
func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateOrderRequest) (*pb.CreateOrderReply, error) {
    // Step 1: Convert Proto request to domain model
    order := &biz.Order{
        UserID: req.GetUserId(),
        Remark: req.GetRemark(),
        Items:  convertCreateItems(req.GetItems()),
        ShippingAddress: &biz.Address{
            Name:     req.GetShippingAddress().GetName(),
            Phone:    req.GetShippingAddress().GetPhone(),
            FullAddr: formatAddress(req.GetShippingAddress()),
        },
    }

    // Step 2: Delegate to biz layer
    created, err := s.uc.CreateOrder(ctx, order)
    if err != nil {
        return nil, err // kratos errors auto-map to HTTP status
    }

    // Step 3: Convert domain model to Proto response
    return &pb.CreateOrderReply{
        Id:    created.ID,
        Order: toProtoOrder(created),
    }, nil
}

// GetOrder handles GET /v1/orders/{id}
func (s *OrderService) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.GetOrderReply, error) {
    order, err := s.uc.GetOrder(ctx, req.GetId())
    if err != nil {
        return nil, err
    }

    return &pb.GetOrderReply{
        Order: toProtoOrder(order),
    }, nil
}

// UpdateOrder handles PUT /v1/orders/{id}
func (s *OrderService) UpdateOrder(ctx context.Context, req *pb.UpdateOrderRequest) (*pb.UpdateOrderReply, error) {
    order := &biz.Order{
        ID:     req.GetId(),
        Remark: req.GetRemark(),
    }
    if addr := req.GetShippingAddress(); addr != nil {
        order.ShippingAddress = &biz.Address{
            Name:     addr.GetName(),
            Phone:    addr.GetPhone(),
            FullAddr: formatAddress(addr),
        }
    }

    updated, err := s.uc.UpdateOrder(ctx, order)
    if err != nil {
        return nil, err
    }

    return &pb.UpdateOrderReply{
        Order: toProtoOrder(updated),
    }, nil
}

// DeleteOrder handles DELETE /v1/orders/{id}
func (s *OrderService) DeleteOrder(ctx context.Context, req *pb.DeleteOrderRequest) (*pb.DeleteOrderReply, error) {
    err := s.uc.DeleteOrder(ctx, req.GetId())
    if err != nil {
        return nil, err
    }
    return &pb.DeleteOrderReply{}, nil
}

// ListOrders handles GET /v1/orders
func (s *OrderService) ListOrders(ctx context.Context, req *pb.ListOrdersRequest) (*pb.ListOrdersReply, error) {
    orders, total, err := s.uc.ListOrders(ctx, req.GetUserId(), int(req.GetPage()), int(req.GetPageSize()))
    if err != nil {
        return nil, err
    }

    pbOrders := make([]*pb.Order, 0, len(orders))
    for _, o := range orders {
        pbOrders = append(pbOrders, toProtoOrder(o))
    }

    return &pb.ListOrdersReply{
        Orders:   pbOrders,
        Total:    total,
        Page:     req.GetPage(),
        PageSize: req.GetPageSize(),
    }, nil
}

// PayOrder handles POST /v1/orders/{id}/pay
func (s *OrderService) PayOrder(ctx context.Context, req *pb.PayOrderRequest) (*pb.PayOrderReply, error) {
    order, err := s.uc.PayOrder(ctx, req.GetId())
    if err != nil {
        return nil, err
    }

    return &pb.PayOrderReply{
        Order: toProtoOrder(order),
    }, nil
}

// CancelOrder handles POST /v1/orders/{id}/cancel
func (s *OrderService) CancelOrder(ctx context.Context, req *pb.CancelOrderRequest) (*pb.CancelOrderReply, error) {
    order, err := s.uc.CancelOrder(ctx, req.GetId(), req.GetReason())
    if err != nil {
        return nil, err
    }

    return &pb.CancelOrderReply{
        Order: toProtoOrder(order),
    }, nil
}

// ShipOrder handles POST /v1/orders/{id}/ship
func (s *OrderService) ShipOrder(ctx context.Context, req *pb.ShipOrderRequest) (*pb.ShipOrderReply, error) {
    order, err := s.uc.ShipOrder(ctx, req.GetId(), req.GetTrackingNumber())
    if err != nil {
        return nil, err
    }

    return &pb.ShipOrderReply{
        Order: toProtoOrder(order),
    }, nil
}
```

### 3.2 转换辅助函数

```go
// internal/service/convert.go
package service

import (
    pb "myapp/api/order/v1"
    "myapp/internal/biz"
)

// toProtoOrder converts a biz Order to a proto Order
func toProtoOrder(o *biz.Order) *pb.Order {
    if o == nil {
        return nil
    }

    pOrder := &pb.Order{
        Id:     o.ID,
        UserId: o.UserID,
        Amount: o.TotalAmount,
        Status: toProtoStatus(o.Status),
        Remark: o.Remark,
    }

    // Convert items
    for _, item := range o.Items {
        pOrder.Items = append(pOrder.Items, &pb.OrderItem{
            Id:          item.ID,
            ProductId:   item.ProductID,
            ProductName: item.ProductName,
            Quantity:    item.Quantity,
            Price:       item.UnitPrice,
        })
    }

    // Convert address
    if o.ShippingAddress != nil {
        pOrder.ShippingAddress = &pb.Address{
            Name:  o.ShippingAddress.Name,
            Phone: o.ShippingAddress.Phone,
        }
    }

    return pOrder
}

// toProtoStatus converts biz status to proto enum
func toProtoStatus(status biz.OrderStatus) pb.OrderStatus {
    switch status {
    case biz.StatusPending:
        return pb.OrderStatus_ORDER_STATUS_PENDING
    case biz.StatusPaid:
        return pb.OrderStatus_ORDER_STATUS_PAID
    case biz.StatusShipped:
        return pb.OrderStatus_ORDER_STATUS_SHIPPED
    case biz.StatusCompleted:
        return pb.OrderStatus_ORDER_STATUS_COMPLETED
    case biz.StatusCancelled:
        return pb.OrderStatus_ORDER_STATUS_CANCELLED
    default:
        return pb.OrderStatus_ORDER_STATUS_UNSPECIFIED
    }
}

// convertCreateItems converts proto items to biz items
func convertCreateItems(items []*pb.CreateOrderItem) []*biz.OrderItem {
    result := make([]*biz.OrderItem, 0, len(items))
    for _, item := range items {
        result = append(result, &biz.OrderItem{
            ProductID: item.GetProductId(),
            Quantity:  item.GetQuantity(),
        })
    }
    return result
}

// formatAddress formats a proto address into a full address string
func formatAddress(addr *pb.Address) string {
    if addr == nil {
        return ""
    }
    return addr.GetProvince() + addr.GetCity() + addr.GetDistrict() + addr.GetDetail()
}
```

### 3.3 Server 注册

```go
// server/http.go
package server

import (
    pb "myapp/api/order/v1"
    "myapp/internal/conf"
    "myapp/internal/service"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/transport/http"
)

// NewHTTPServer creates a new HTTP server
func NewHTTPServer(c *conf.Server, orderSvc *service.OrderService, logger log.Logger) *http.Server {
    opts := []http.ServerOption{
        http.Address(c.Http.GetAddr()),
        http.Timeout(c.Http.GetTimeout().AsDuration()),
    }

    srv := http.NewServer(opts...)

    // Register HTTP routes (auto-generated from Proto annotations)
    pb.RegisterOrderServiceHTTPServer(srv, orderSvc)

    return srv
}
```

```go
// server/grpc.go
package server

import (
    pb "myapp/api/order/v1"
    "myapp/internal/conf"
    "myapp/internal/service"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

// NewGRPCServer creates a new gRPC server
func NewGRPCServer(c *conf.Server, orderSvc *service.OrderService, logger log.Logger) *grpc.Server {
    opts := []grpc.ServerOption{
        grpc.Address(c.Grpc.GetAddr()),
        grpc.Timeout(c.Grpc.GetTimeout().AsDuration()),
    }

    srv := grpc.NewServer(opts...)

    // Register gRPC service
    pb.RegisterOrderServiceServer(srv, orderSvc)

    return srv
}
```

### 3.4 请求验证 Middleware

```go
// internal/server/middleware.go
package server

import (
    "context"

    "github.com/go-kratos/kratos/v2/errors"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
)

// RequestValidationMiddleware validates incoming requests
func RequestValidationMiddleware() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            // Basic validation: check if request is nil
            if req == nil {
                return nil, errors.BadRequest("REQUEST_nil", "request cannot be nil")
            }

            // Additional transport-level checks
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Log request info
                info := tr.Operation()
                _ = info // Could add request logging here
            }

            return handler(ctx, req)
        }
    }
}
```

## 四、执行预览

```bash
# Start the service
$ go run cmd/order/main.go -conf configs/config.yaml
# INFO msg=server started http=:8080 grpc=:9000

# Test HTTP API
$ curl -X POST http://localhost:8080/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"items":[{"product_id":100,"quantity":2}],"shipping_address":{"name":"张三","phone":"13800138000","province":"广东","city":"深圳","district":"南山","detail":"科技园"}}'
# {"id":1,"order":{"id":1,"userId":1,"amount":0,"status":"ORDER_STATUS_PENDING"}}

# Test gRPC with grpcurl
$ grpcurl -plaintext -d '{"id":1}' localhost:9000 api.order.v1.OrderService/GetOrder
# {"order":{"id":"1","userId":"1","status":"ORDER_STATUS_PENDING"}}

# Test error response
$ curl http://localhost:8080/v1/orders/999
# {"code":404,"reason":"ORDER_NOT_FOUND","message":"order 999 not found","metadata":{}}
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| Service 方法要短 | 每个 RPC 方法 5-15 行 | 超过 20 行说明逻辑下沉不够 |
| 不要在 Service 写 if/else 业务逻辑 | 业务判断放 biz 层 | Service 只做转换和委托 |
| 错误直接返回 | biz 层错误直接 return err | Kratos 自动映射 HTTP 状态码 |
| 转换函数集中管理 | 放在 convert.go | 方便统一维护 |
| Unimplemented 嵌入 | 保留 proto 生成的 Unimplemented | 保证前向兼容 |
| 双协议一致性 | HTTP 和 gRPC 走同一 Service | 不需要写两套逻辑 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| Service 方法里写业务逻辑 | 逻辑放 biz Usecase，Service 只转换 |
| Service 直接操作数据库 | 通过 biz 层间接访问 |
| 每个 Service 方法里重复转换代码 | 抽取 toProtoXxx / toBizXxx 转换函数 |
| 用 Proto 生成的类型做业务逻辑 | biz 层用自己的领域模型 |
| 忘记注册 HTTP/gRPC 路由 | 使用 Proto 生成的 Register 函数 |
| Service 层做权限校验 | 权限校验放 Middleware 或 biz 层 |

## 七、练习题

### 🟢 初级
1. 为 `ShipOrder` 添加请求验证：`tracking_number` 不能为空。
2. 编写一个 `toProtoOrderItem` 单独的转换函数。

### 🟡 中级
3. 实现一个 Service Middleware，记录每个 RPC 方法的耗时和状态码。
4. 在 Service 层添加请求日志，用 `log.Infof` 记录入参和出参摘要。

### 🔴 高级
5. 实现一个通用的 Proto→BO 转换代码生成器，自动从 Proto 文件生成 convert.go。
6. 设计一个 Service 层的请求/响应加密方案，敏感字段在传输层透明加解密。

## 八、知识点总结

```
Service 服务层
├── 核心原则
│   ├── 薄层（5-15行/方法）
│   ├── 只做转换和委托
│   └── 不包含业务逻辑
├── 请求处理流程
│   ├── 1. 接收 Proto Request
│   ├── 2. Proto → BO 转换
│   ├── 3. 调用 biz Usecase
│   ├── 4. BO → Proto 转换
│   └── 5. 返回 Proto Response
├── 协议适配
│   ├── HTTP (JSON)
│   ├── gRPC (Protobuf)
│   └── 同一 Service，双协议
├── 错误处理
│   ├── biz 层错误直接返回
│   ├── kratos/errors 自动映射
│   └── BadRequest→400, NotFound→404, Conflict→409
├── 请求验证
│   ├── Proto validate 规则
│   ├── Service Middleware
│   └── 基本参数检查
└── 代码组织
    ├── service/order.go (RPC 方法)
    ├── service/convert.go (转换函数)
    └── server/http.go, grpc.go (路由注册)
```

## 九、举一反三

| 场景 | Service 处理方式 | 注意事项 |
|------|----------------|---------|
| 文件上传 | HTTP Multipart → 保存路径传给 biz | 文件大小限制 |
| 分页参数 | 直接透传给 biz 层 | biz 层做默认值校正 |
| 批量操作 | 请求中包含数组，Service 循环调用或批量传给 biz | 考虑事务一致性 |
| WebSocket | 不走 Proto，单独处理 | HTTP Upgrade |
| Server Streaming | gRPC Stream，循环推送 | 流控和超时 |
| 认证 Token | Middleware 提取，Context 传递 | Service 层不感知 |

## 十、参考资料

- [Kratos Service 层规范](https://go-kratos.dev/docs/getting-started/usage)
- [gRPC-Gateway HTTP 映射](https://github.com/grpc-ecosystem/grpc-gateway)
- [Kratos 错误处理](https://go-kratos.dev/docs/component/errors)
- [Proto validate](https://github.com/bufbuild/protoc-gen-validate)

## 十一、代码演进

### v1: Service 层包含业务逻辑（反模式）

```go
func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateReq) (*pb.CreateResp, error) {
    // BAD: business logic in service layer
    if len(req.Items) == 0 {
        return nil, errors.BadRequest("EMPTY", "no items")
    }
    total := 0.0
    for _, item := range req.Items {
        total += float64(item.Quantity) * item.Price
    }
    order := &Order{UserID: req.UserId, Total: total, Status: "pending"}
    return s.repo.Save(ctx, order)
}
```

**问题**：业务逻辑混在 Service，不可复用、不可测试。

### v2: Service 调用 Usecase（基本解耦）

```go
func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateReq) (*pb.CreateResp, error) {
    order := toBizOrder(req)
    created, err := s.uc.CreateOrder(ctx, order)
    if err != nil {
        return nil, err
    }
    return toProtoResp(created), nil
}
```

**改进**：Service 层只做转换。**但**转换函数散落各处。

### v3: 生产级（统一转换 + 双协议 + Middleware）

```go
// service/order.go - thin RPC methods
// service/convert.go - centralized conversion
// server/http.go + grpc.go - route registration
// server/middleware.go - validation/logging/auth
// 完整的薄层架构，如本文代码所示
```

**最终形态**：Service 层极薄、转换集中、双协议统一、中间件可插拔。
