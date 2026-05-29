---
title: "004-第一个Kratos服务Hello World"
slug: "004-kratos-helloworld"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:15:15.402+08:00"
updated_at: "2026-04-29T10:02:45.312+08:00"
reading_time: 28
tags: []
---


# 004-第一个Kratos服务Hello World

> **难度：⭐⭐（入门级）**
>
> 需要已完成环境搭建（001篇）。读完本文，你将独立创建并运行一个完整的Kratos微服务。

---

## 一、概念讲解

### 1.1 本文目标

我们要构建一个完整的Kratos服务，具备以下功能：

```
┌──────────────┐     HTTP      ┌─────────────────────┐
│   curl /     │──────────────→│                     │
│   浏览器      │               │   Kratos Service    │
└──────────────┘               │                     │
                               │  ┌───────────────┐  │
┌──────────────┐    gRPC       │  │ Service Layer  │  │
│  grpcurl /   │──────────────→│  ├───────────────┤  │
│  Go Client   │               │  │   Biz Layer    │  │
└──────────────┘               │  ├───────────────┤  │
                               │  │  Data Layer    │  │
                               │  └───────────────┘  │
                               └─────────────────────┘
```

### 1.2 开发流程

```
1. kratos new 创建项目
2. 编写 proto 文件（定义接口）
3. make api（生成代码）
4. 实现 Service 层（业务编排）
5. 实现 Biz 层（业务逻辑）
6. 实现 Data 层（数据存储）
7. kratos run（启动服务）
8. 测试 HTTP + gRPC 接口
```

---

## 二、脑图（ASCII）

```
               Kratos Hello World
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   项目创建       核心开发        测试验证
      │              │              │
  kratos new    ┌────┼────┐    ┌───┼───┐
      │         │    │    │    │       │
  项目结构     Proto Service curl grpcurl
  依赖下载     编写  实现     HTTP  gRPC
              生成  Biz/Data 测试  测试
```

---

## 三、完整代码

### 3.1 创建项目

```bash
# Step 1: Create project
kratos new helloworld
cd helloworld

# Step 2: Download dependencies
go mod tidy
```

### 3.2 编写Proto文件

```protobuf
// api/helloworld/v1/greeter.proto
syntax = "proto3";

package helloworld.v1;

option go_package = "helloworld/api/helloworld/v1";

import "google/api/annotations.proto";

// Greeter service definition
service GreeterService {
    // SayHello returns a greeting message
    rpc SayHello (HelloRequest) returns (HelloReply) {
        option (google.api.http) = {
            get: "/helloworld/{name}"
        };
    }
    
    // BatchHello processes multiple names
    rpc BatchHello (BatchHelloRequest) returns (BatchHelloReply) {
        option (google.api.http) = {
            post: "/v1/helloworld/batch"
            body: "*"
        };
    }
}

// Request with a single name
message HelloRequest {
    string name = 1;
}

// Response with greeting message
message HelloReply {
    string message = 1;
    int64 timestamp = 2;
}

// Request with multiple names
message BatchHelloRequest {
    repeated string names = 1;
}

// Response with multiple greetings
message BatchHelloReply {
    repeated HelloReply replies = 1;
}
```

### 3.3 生成代码

```bash
# Generate protobuf code
make api
```

生成后文件结构：
```
api/helloworld/v1/
├── greeter.proto
├── greeter.pb.go          # Message structs
├── greeter_http.pb.go     # HTTP route registration
└── greeter_grpc.pb.go     # gRPC stubs
```

### 3.4 实现Biz层（业务逻辑）

```go
// internal/biz/greeter.go
package biz

import (
    "context"
    "fmt"
    "time"

    "github.com/go-kratos/kratos/v2/log"
)

// GreeterUsecase holds business logic
type GreeterUsecase struct {
    log *log.Helper
}

// NewGreeterUsecase creates a new usecase
func NewGreeterUsecase(logger log.Logger) *GreeterUsecase {
    return &GreeterUsecase{
        log: log.NewHelper(logger),
    }
}

// Greet generates a greeting for a single name
func (uc *GreeterUsecase) Greet(ctx context.Context, name string) (string, int64, error) {
    // Business rule: default name
    if name == "" {
        name = "World"
    }
    
    // Business rule: add time-based greeting
    hour := time.Now().Hour()
    var prefix string
    switch {
    case hour < 6:
        prefix = "🌙 Good night"
    case hour < 12:
        prefix = "🌅 Good morning"
    case hour < 18:
        prefix = "☀️ Good afternoon"
    default:
        prefix = "🌆 Good evening"
    }
    
    greeting := fmt.Sprintf("%s, %s!", prefix, name)
    uc.log.WithContext(ctx).Infof("Generated greeting: %s", greeting)
    
    return greeting, time.Now().Unix(), nil
}

// BatchGreet generates greetings for multiple names
func (uc *GreeterUsecase) BatchGreet(ctx context.Context, names []string) ([]struct {
    Message   string
    Timestamp int64
}, error) {
    results := make([]struct {
        Message   string
        Timestamp int64
    }, 0, len(names))
    
    for _, name := range names {
        msg, ts, err := uc.Greet(ctx, name)
        if err != nil {
            return nil, err
        }
        results = append(results, struct {
            Message   string
            Timestamp int64
        }{Message: msg, Timestamp: ts})
    }
    
    return results, nil
}
```

### 3.5 实现Service层

```go
// internal/service/greeter.go
package service

import (
    "context"

    pb "helloworld/api/helloworld/v1"
    "helloworld/internal/biz"

    "github.com/go-kratos/kratos/v2/log"
)

// GreeterService implements the proto-defined service
type GreeterService struct {
    pb.UnimplementedGreeterServiceServer
    
    uc  *biz.GreeterUsecase
    log *log.Helper
}

// NewGreeterService creates service with dependency injection
func NewGreeterService(uc *biz.GreeterUsecase, logger log.Logger) *GreeterService {
    return &GreeterService{
        uc:  uc,
        log: log.NewHelper(logger),
    }
}

// SayHello handles a single greeting request
func (s *GreeterService) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloReply, error) {
    s.log.WithContext(ctx).Infof("SayHello: name=%s", req.Name)
    
    // Delegate to biz layer
    message, timestamp, err := s.uc.Greet(ctx, req.Name)
    if err != nil {
        return nil, err
    }
    
    return &pb.HelloReply{
        Message:   message,
        Timestamp: timestamp,
    }, nil
}

// BatchHello handles multiple greeting requests
func (s *GreeterService) BatchHello(ctx context.Context, req *pb.BatchHelloRequest) (*pb.BatchHelloReply, error) {
    s.log.WithContext(ctx).Infof("BatchHello: %d names", len(req.Names))
    
    results, err := s.uc.BatchGreet(ctx, req.Names)
    if err != nil {
        return nil, err
    }
    
    replies := make([]*pb.HelloReply, 0, len(results))
    for _, r := range results {
        replies = append(replies, &pb.HelloReply{
            Message:   r.Message,
            Timestamp: r.Timestamp,
        })
    }
    
    return &pb.BatchHelloReply{Replies: replies}, nil
}
```

### 3.6 更新Wire注入

```go
// internal/biz/biz.go
package biz

import "github.com/google/wire"

// ProviderSet is biz layer dependency providers
var ProviderSet = wire.NewSet(NewGreeterUsecase)
```

```go
// internal/service/service.go
package service

import "github.com/google/wire"

// ProviderSet is service layer dependency providers
var ProviderSet = wire.NewSet(NewGreeterService)
```

### 3.7 配置文件

```yaml
# configs/config.yaml
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s
```

---

## 四、执行预览

```
$ make api
# Generating protobuf code...
# Done.

$ make generate  
# Generating wire code...
# Done.

$ kratos run
INFO msg=config loaded format: yaml
INFO msg=server listening on [::]:8000    ← HTTP
INFO msg=server listening on [::]:9000    ← gRPC

# Test HTTP GET
$ curl http://localhost:8000/helloworld/Kratos
{"message":"☀️ Good afternoon, Kratos!","timestamp":"1714032000"}

# Test HTTP POST batch
$ curl -X POST http://localhost:8000/v1/helloworld/batch \
  -H "Content-Type: application/json" \
  -d '{"names":["Alice","Bob","Charlie"]}'
{
  "replies": [
    {"message":"☀️ Good afternoon, Alice!","timestamp":"1714032000"},
    {"message":"☀️ Good afternoon, Bob!","timestamp":"1714032000"},
    {"message":"☀️ Good afternoon, Charlie!","timestamp":"1714032000"}
  ]
}

# Test gRPC
$ grpcurl -plaintext -d '{"name":"Kratos"}' localhost:9000 helloworld.v1.GreeterService/SayHello
{
  "message": "☀️ Good afternoon, Kratos!",
  "timestamp": "1714032000"
}
```

### Go客户端调用

```go
// client/main.go
package main

import (
    "context"
    "fmt"
    "log"

    pb "helloworld/api/helloworld/v1"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

func main() {
    // Connect to gRPC server
    conn, err := grpc.Dial("localhost:9000",
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // Create client
    client := pb.NewGreeterServiceClient(conn)

    // Call SayHello
    reply, err := client.SayHello(context.Background(), &pb.HelloRequest{
        Name: "Go Client",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Reply: %s (timestamp: %d)\n", reply.Message, reply.Timestamp)
}
```

---

## 五、注意事项

| 注意点 | 说明 | 严重度 |
|--------|------|--------|
| 生成顺序 | 先`make api`再`make generate` | 🔴 高 |
| proto修改后必须重新生成 | 否则代码和接口定义不一致 | 🔴 高 |
| Unimplemented前缀 | 新增RPC后需重新生成并实现 | 🟡 中 |
| HTTP路径冲突 | 多个RPC不要映射到相同路径 | 🟡 中 |
| Wire注入循环依赖 | 检查ProviderSet是否正确 | 🔴 高 |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 修改proto后不重新make api | 每次修改proto都执行`make api && make generate` |
| 新增RPC方法后忘记实现 | 编译会报错，根据错误实现新方法 |
| Service层直接返回硬编码 | 通过Biz层处理逻辑 |
| 配置文件路径不对 | 使用`-conf`参数指定路径 |
| gRPC客户端连不上 | 检查端口是否一致，是否使用plaintext |

---

## 七、练习题

### 🟢 入门题
1. 运行本文的Hello World项目，成功调用HTTP和gRPC接口。

### 🟡 进阶题
2. 新增一个`Goodbye` RPC方法，路径为`GET /goodbye/{name}`，返回`"Goodbye, {name}!"`。

### 🔴 挑战题
3. 实现一个完整的`UserService`（CRUD），使用内存map存储数据，支持HTTP和gRPC双协议访问。要求：CreateUser、GetUser、UpdateUser、DeleteUser、ListUsers。

---

## 八、知识点总结

```
Kratos Hello World
├── 项目创建
│   ├── kratos new <name>
│   ├── go mod tidy
│   └── 目录结构理解
├── Proto编写
│   ├── message定义
│   ├── service + rpc定义
│   └── HTTP注解映射
├── 代码生成
│   ├── make api → proto代码
│   └── make generate → wire代码
├── 业务实现
│   ├── Service层（请求转换）
│   ├── Biz层（业务逻辑）
│   └── Data层（数据存储）
└── 测试验证
    ├── curl测试HTTP
    ├── grpcurl测试gRPC
    └── Go客户端调用
```

---

## 九、举一反三

| 场景 | 思路 | 关键技术 |
|------|------|---------|
| 添加新的微服务 | 重复创建流程，定义新的proto | kratos new |
| 对接前端 | 前端调用HTTP接口（JSON） | HTTP注解 |
| 服务间调用 | 使用gRPC客户端调用另一个服务 | gRPC client |
| 添加中间件 | 在server层注册recovery/logging等中间件 | kratos middleware |
| Docker部署 | 编写Dockerfile，多阶段构建 | Docker multi-stage |

---

## 十、参考资料

| 资源 | 链接 |
|------|------|
| Kratos快速开始 | https://go-kratos.dev/docs/getting-started/start |
| Kratos Examples | https://github.com/go-kratos/examples |
| gRPCurl工具 | https://github.com/fullstorydev/grpcurl |
| Wire依赖注入 | https://github.com/google/wire |

---

## 十一、代码演进

### v1：默认模板
```bash
kratos new helloworld
# 默认只有SayHello，返回硬编码字符串
```

### v2：添加业务逻辑
```go
// Biz层添加时间问候逻辑
func (uc *GreeterUsecase) Greet(ctx context.Context, name string) (string, int64, error) {
    // Time-based greeting
    prefix := getTimeBasedGreeting()
    return fmt.Sprintf("%s, %s!", prefix, name), time.Now().Unix(), nil
}
```

### v3：完整CRUD服务
```go
// v3: Add batch operations, CRUD endpoints
service UserService {
    rpc CreateUser (CreateUserRequest) returns (User) {
        option (google.api.http) = { post: "/v1/users" body: "*" };
    }
    rpc GetUser (GetUserRequest) returns (User) {
        option (google.api.http) = { get: "/v1/users/{id}" };
    }
    rpc ListUsers (ListUsersRequest) returns (ListUsersReply) {
        option (google.api.http) = { get: "/v1/users" };
    }
}
```

---

**上一篇：** [003-Protobuf协议与代码生成](/posts/003-kratos-protobuf)
**下一篇：** [005-Kratos配置管理详解](/posts/005-kratos-config)
