---
title: "027 - gRPC 与 Gin 共存实战"
slug: "027-gin-grpc"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:17:17.071+08:00"
updated_at: "2026-04-29T10:02:45.798+08:00"
reading_time: 24
tags: []
---

# gRPC 与 Gin 共存实战

> 难度：⭐⭐⭐⭐（高级）
> 前置知识：Gin 基础、HTTP/2、Protocol Buffers

## 一、概念讲解

gRPC 是 Google 开源的高性能 RPC 框架，基于 HTTP/2 和 Protocol Buffers。在微服务架构中，内部服务间用 gRPC 通信（高性能），对外暴露 REST API（兼容性），这是最佳实践。

**为什么需要 Gin + gRPC 共存？**

| 场景 | 说明 |
|------|------|
| 内部高效通信 | 微服务间用 gRPC，二进制序列化，性能比 JSON 高 5-10 倍 |
| 外部兼容接口 | 对 Web/Mobile 暴露 REST，开发者友好 |
| 渐进迁移 | 从 REST 逐步迁移到 gRPC，两种协议并存 |
| API Gateway | Gin 作为网关，gRPC 作为后端 |

**三种共存模式：**
1. **双端口模式**：Gin (HTTP) 和 gRPC 各监听一个端口
2. **grpc-gateway 模式**：gRPC 服务自动生成 REST 代理
3. **Gin 代理模式**：Gin 路由转发到 gRPC 后端

## 二、脑图

```
Gin + gRPC 共存
├── Protobuf
│   ├── .proto 文件定义
│   ├── protoc 编译
│   └── 生成的 Go 代码
├── gRPC 服务
│   ├── Server 实现
│   ├── Unary RPC
│   ├── Streaming RPC
│   └── 拦截器 (Interceptor)
├── 共存模式
│   ├── 双端口 (推荐)
│   ├── grpc-gateway
│   └── Gin 反向代理
├── 服务注册
│   ├── etcd
│   ├── Consul
│   └── 静态配置
└── 选型决策
    ├── 何时用 gRPC
    ├── 何时用 REST
    └── 混合架构
```

## 三、完整代码

### proto/user.proto

```protobuf
syntax = "proto3";
package user;
option go_package = "./proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (UserList);
  rpc CreateUser(CreateUserRequest) returns (User);
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}

message GetUserRequest {
  string id = 1;
}

message ListUsersRequest {
  int32 page = 1;
  int32 size = 2;
}

message UserList {
  repeated User users = 1;
  int32 total = 2;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}
```

### 生成代码

```bash
# Install protoc plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate
protoc --go_out=. --go-grpc_out=. proto/user.proto
```

### v1：双端口模式（推荐）

```go
// main.go - Dual-port: Gin + gRPC side by side
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// === gRPC Server ===

type UserServer struct {
	UnimplementedUserServiceServer
	users []*User
}

func (s *UserServer) GetUser(ctx context.Context, req *GetUserRequest) (*User, error) {
	for _, u := range s.users {
		if u.Id == req.Id {
			return u, nil
		}
	}
	return nil, status.Errorf(codes.NotFound, "user %s not found", req.Id)
}

func (s *UserServer) ListUsers(ctx context.Context, req *ListUsersRequest) (*UserList, error) {
	start := int(req.Page) * int(req.Size)
	if start >= len(s.users) {
		start = 0
	}
	end := start + int(req.Size)
	if end > len(s.users) {
		end = len(s.users)
	}
	return &UserList{Users: s.users[start:end], Total: int32(len(s.users))}, nil
}

func (s *UserServer) CreateUser(ctx context.Context, req *CreateUserRequest) (*User, error) {
	user := &User{
		Id:    fmt.Sprintf("%d", len(s.users)+1),
		Name:  req.Name,
		Email: req.Email,
	}
	s.users = append(s.users, user)
	return user, nil
}

// === Gin REST Server ===

func setupGin(svc *UserServer) *gin.Engine {
	r := gin.Default()

	// REST endpoints that mirror gRPC
	r.GET("/users/:id", func(c *gin.Context) {
		user, err := svc.GetUser(c.Request.Context(), &GetUserRequest{Id: c.Param("id")})
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, user)
	})

	r.GET("/users", func(c *gin.Context) {
		list, err := svc.ListUsers(c.Request.Context(), &ListUsersRequest{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, list)
	})

	r.POST("/users", func(c *gin.Context) {
		var req struct {
			Name  string `json:"name" binding:"required"`
			Email string `json:"email" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		user, err := svc.CreateUser(c.Request.Context(), &CreateUserRequest{Name: req.Name, Email: req.Email})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, user)
	})

	return r
}

func main() {
	// Shared service instance
	svc := &UserServer{
		users: []*User{
			{Id: "1", Name: "Alice", Email: "alice@example.com"},
			{Id: "2", Name: "Bob", Email: "bob@example.com"},
		},
	}

	// Start gRPC server on port 50051
	grpcLis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatal(err)
	}
	grpcSrv := grpc.NewServer()
	RegisterUserServiceServer(grpcSrv, svc)
	go func() {
		log.Println("gRPC server on :50051")
		grpcSrv.Serve(grpcLis)
	}()

	// Start Gin server on port 8080
	ginSrv := setupGin(svc)
	log.Println("Gin server on :8080")
	log.Fatal(ginSrv.Run(":8080"))
}
```

### v2：gRPC 拦截器 + 优雅关闭

```go
// interceptors.go - gRPC interceptors
package main

import (
	"context"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// Logging interceptor
func UnaryLogger() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		resp, err := handler(ctx, req)
		log.Printf("[gRPC] %s %v", info.FullMethod, time.Since(start))
		return resp, err
	}
}

// Auth interceptor
func UnaryAuth() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, fmt.Errorf("missing metadata")
		}
		tokens := md.Get("authorization")
		if len(tokens) == 0 {
			return nil, fmt.Errorf("unauthorized")
		}
		// Validate token...
		return handler(ctx, req)
	}
}
```

```go
// main.go - Graceful shutdown
func main() {
	svc := &UserServer{users: defaultUsers()}

	// gRPC with interceptors
	grpcSrv := grpc.NewServer(
		grpc.UnaryInterceptor(UnaryLogger()),
	)
	RegisterUserServiceServer(grpcSrv, svc)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Start both servers
	grpcLis, _ := net.Listen("tcp", ":50051")
	go grpcSrv.Serve(grpcLis)

	ginSrv := setupGin(svc)
	go ginSrv.Run(":8080")

	<-quit
	log.Println("Shutting down...")
	grpcSrv.GracefulStop()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// ginSrv.Shutdown(ctx) if using http.Server
}
```

### v3：grpc-gateway 自动生成 REST

```go
// main.go - Single port with grpc-gateway
package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	gw "google.golang.org/grpc/gateway"
)

func main() {
	// Start gRPC
	svc := &UserServer{users: defaultUsers()}
	grpcSrv := grpc.NewServer()
	RegisterUserServiceServer(grpcSrv, svc)
	go func() {
		lis, _ := net.Listen("tcp", ":50051")
		grpcSrv.Serve(lis)
	}()

	// grpc-gateway: auto-generates REST from gRPC
	ctx := context.Background()
	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	RegisterUserServiceHandlerFromEndpoint(ctx, mux, "localhost:50051", opts)

	// Gin handles custom routes, gateway handles /v1/*
	r := gin.Default()
	r.Any("/v1/*any", gin.WrapH(mux))

	// Custom Gin routes for non-gRPC features
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.Run(":8080")
}
```

## 四、执行预览

```bash
# Generate protobuf code
protoc --go_out=. --go-grpc_out=. proto/user.proto

# Start server
go run main.go
# gRPC server on :50051
# Gin server on :8080

# Test REST (Gin)
curl http://localhost:8080/users/1
{"id":"1","name":"Alice","email":"alice@example.com"}

# Test gRPC
grpcurl -plaintext -d '{"id":"1"}' localhost:50051 user.UserService/GetUser

# Test via grpc-gateway
curl http://localhost:8080/v1/users/1
```

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 端口规划 | gRPC 默认 50051，Gin 默认 8080，避免冲突 |
| Protobuf 版本 | 使用 proto3，统一团队版本 |
| 共享业务逻辑 | REST 和 gRPC 调用同一 service 实例 |
| 错误码映射 | gRPC status code ↔ HTTP status code 需要转换 |
| 流式 RPC | gRPC streaming 不适合 REST 代理 |
| 超时控制 | gRPC 用 context 超时，Gin 用 middleware |

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| Gin 和 gRPC 监听同一端口 | 双端口模式，各管各的 |
| gRPC 错误直接返回给 REST 客户端 | 映射 gRPC codes 到 HTTP status |
| 不设超时 | gRPC 用 `context.WithTimeout`，Gin 用 middleware |
| 不注册 gRPC health check | 添加 `grpc_health_v1` 供 K8s 探针 |
| 忘记 `UnimplementedUserServiceServer` | 必须嵌入，保证前后兼容 |

## 七、练习题

🟢 **初级：** 给 User 添加一个 `DeleteUser` RPC 和对应的 REST DELETE 端点

🟡 **中级：** 实现 gRPC Server Streaming（服务端推送用户列表，逐条返回）

🔴 **高级：** 实现 grpc-gateway + 自定义 Gin middleware 鉴权，统一 gRPC 和 REST 的认证链路

## 八、知识点总结

```
Gin + gRPC 共存
├── Protobuf
│   ├── Message 定义
│   ├── Service 定义
│   └── protoc 代码生成
├── gRPC Server
│   ├── Service 实现
│   ├── Interceptor (拦截器)
│   ├── Health Check
│   └── Graceful Shutdown
├── 共存模式
│   ├── 双端口 (Gin:gRPC独立)
│   ├── grpc-gateway (自动REST)
│   └── Gin 反向代理
└── 运维
    ├── 服务发现
    ├── 负载均衡
    └── 监控 (gRPC metrics)
```

## 九、举一反三

| 场景 | 方案 |
|------|------|
| K8s 部署，需要健康检查 | gRPC health check + Gin /health |
| 前端也要调用 gRPC | gRPC-Web 或 grpc-gateway |
| 需要链路追踪 | gRPC + Gin 都接 OpenTelemetry |
| 高并发大文件传输 | gRPC streaming + 流控 |

## 十、参考资料

- [gRPC 官方文档](https://grpc.io/docs/)
- [grpc-gateway](https://github.com/grpc-ecosystem/grpc-gateway)
- [Protocol Buffers](https://protobuf.dev/)
- [grpcurl 调试工具](https://github.com/fullstorydev/grpcurl)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 双端口、共享 service、基础功能 | 学习、小型项目 |
| v2 | 拦截器、优雅关闭、日志认证 | 生产环境 |
| v3 | grpc-gateway、单端口暴露 | API Gateway 模式 |

---

*左手 REST，右手 gRPC，全都要。* ⚡
