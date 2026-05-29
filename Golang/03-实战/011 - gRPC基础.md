---
title: "011 - gRPC基础"
slug: "011-di"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.323+08:00"
updated_at: "2026-04-29T10:02:44.968+08:00"
reading_time: 23
tags: ["设计模式"]
---

# 066: gRPC基础

> **难度：⭐⭐⭐⭐ 高级** | gRPC 是 Google 开源的高性能 RPC 框架，基于 Protobuf 序列化和 HTTP/2 传输，是微服务通信的基石。
>
> **前置知识：** Go 基础、HTTP 协议、基本网络编程
>
> **学习目标：** 掌握 gRPC 核心概念，能独立编写 Unary/Streaming RPC 服务，理解 Protobuf 定义和代码生成流程。

## 概念讲解

gRPC（gRPC Remote Procedure Call）让你像调用本地函数一样调用远程服务。核心要素：

- **Protocol Buffers (Protobuf)：** Google 的二进制序列化格式，比 JSON 更小更快。用 `.proto` 文件定义消息结构和服务接口。
- **HTTP/2：** 传输层协议，支持多路复用、头部压缩、双向流。gRPC 天然支持四种通信模式。
- **代码生成：** `protoc` 编译器根据 `.proto` 文件自动生成 Go 客户端和服务端代码。
- **四种 RPC 模式：** Unary（一元调用）、Server Streaming（服务端流）、Client Streaming（客户端流）、Bidirectional Streaming（双向流）。

### gRPC vs REST 对比

| 特性 | gRPC | REST |
|------|------|------|
| 协议 | HTTP/2 | HTTP/1.1 |
| 数据格式 | Protobuf（二进制） | JSON（文本） |
| 接口定义 | .proto 文件 | OpenAPI/Swagger |
| 流式支持 | ✅ 双向流 | ❌ 需 WebSocket |
| 代码生成 | ✅ 自动生成 | ❌ 手动或工具辅助 |
| 性能 | 高（二进制+HTTP/2） | 较低（文本+HTTP/1.1） |
| 浏览器支持 | 需要 grpc-web | ✅ 原生支持 |

## 脑图

```
gRPC基础
├── Protobuf
│   ├── 消息定义 (message)
│   ├── 服务定义 (service/rpc)
│   ├── 字段类型 (scalar/repeated/map/oneof)
│   └── 代码生成 (protoc)
├── 四种RPC模式
│   ├── Unary (一元调用)
│   ├── Server Streaming (服务端流)
│   ├── Client Streaming (客户端流)
│   └── Bidirectional Streaming (双向流)
├── 服务端
│   ├── 注册服务
│   ├── 拦截器 (Interceptor)
│   └── 错误处理 (status codes)
├── 客户端
│   ├── 连接管理 (Dial)
│   ├── 超时控制 (context)
│   └── 流式接收 (Recv)
└── 工程实践
    ├── .proto 文件管理
    ├── 版本兼容性
    └── 拦截器链
```

## 代码演进

### v1：最小 Unary RPC（proto + server + client）

**proto 定义：**

```protobuf
// proto/hello.proto
syntax = "proto3";
package helloworld;
option go_package = "github.com/example/grpcdemo/proto";

message HelloRequest {
  string name = 1;
}

message HelloResponse {
  string message = 1;
}

service Greeter {
  rpc SayHello(HelloRequest) returns (HelloResponse);
}
```

**服务端：**

```go
package main

import (
    "context"
    "log"
    "net"

    pb "github.com/example/grpcdemo/proto"
    "google.golang.org/grpc"
)

// Server implements GreeterServer interface
type Server struct {
    pb.UnimplementedGreeterServer // Must embed for forward compatibility
}

// SayHello handles Unary RPC - like a normal function call
func (s *Server) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloResponse, error) {
    return &pb.HelloResponse{
        Message: "Hello " + req.GetName(),
    }, nil
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatal(err)
    }
    s := grpc.NewServer()
    pb.RegisterGreeterServer(s, &Server{})
    log.Println("gRPC server on :50051")
    log.Fatal(s.Serve(lis))
}
```

**客户端：**

```go
package main

import (
    "context"
    "log"
    "time"

    pb "github.com/example/grpcdemo/proto"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
)

func main() {
    // Dial creates a connection (not immediately connected)
    conn, err := grpc.Dial("localhost:50051",
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := pb.NewGreeterClient(conn)
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    resp, err := client.SayHello(ctx, &pb.HelloRequest{Name: "Go"})
    if err != nil {
        log.Fatal(err)
    }
    log.Println("Response:", resp.GetMessage())
}
```

### v2：添加 Server Streaming + 拦截器

```go
// Add streaming RPC to proto:
// rpc StreamGreetings(HelloRequest) returns (stream HelloResponse);

// Server streaming: server sends multiple responses
func (s *Server) StreamGreetings(req *pb.HelloRequest, stream pb.Greeter_StreamGreetingsServer) error {
    for i := 0; i < 5; i++ {
        if err := stream.Send(&pb.HelloResponse{
            Message:   "Hello " + req.GetName(),
            Timestamp: time.Now().Unix(),
        }); err != nil {
            return err // Transport error, stop streaming
        }
        time.Sleep(time.Second)
    }
    return nil // nil means stream completed successfully
}

// Logging interceptor - middleware for gRPC
func loggingInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    start := time.Now()
    resp, err := handler(ctx, req)
    log.Printf("method=%s duration=%v err=%v", info.FullMethod, time.Since(start), err)
    return resp, err
}

// Register with interceptor
func main() {
    s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
    pb.RegisterGreeterServer(s, &Server{})
    // ...
}

// Client streaming receive
func streamReceive(client pb.GreeterClient) {
    stream, err := client.StreamGreetings(context.Background(), &pb.HelloRequest{Name: "Stream"})
    if err != nil {
        log.Fatal(err)
    }
    for {
        resp, err := stream.Recv()
        if err == io.EOF {
            break // Server finished sending
        }
        if err != nil {
            log.Fatal(err)
        }
        log.Println("Stream:", resp.GetMessage())
    }
}
```

### v3：完整工程化（错误处理 + 参数校验 + metadata）

```go
// Enhanced SayHello with validation and rich error
func (s *Server) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloResponse, error) {
    // Input validation
    if req.GetName() == "" {
        return nil, status.Error(codes.InvalidArgument, "name is required")
    }

    // Read metadata (like HTTP headers)
    md, ok := metadata.FromIncomingContext(ctx)
    if ok {
        log.Printf("client version: %v", md.Get("x-client-version"))
    }

    // Check context cancellation
    select {
    case <-ctx.Done():
        return nil, status.FromContextError(ctx.Err()).Err()
    default:
    }

    return &pb.HelloResponse{
        Message:   fmt.Sprintf("Hello %s! You are visitor #%d", req.GetName(), atomic.AddInt64(&s.counter, 1)),
        Timestamp: time.Now().Unix(),
    }, nil
}

// Bidirectional streaming - chat room style
func (s *Server) Chat(stream pb.Greeter_ChatServer) error {
    for {
        req, err := stream.Recv()
        if err == io.EOF {
            return nil
        }
        if err != nil {
            return err
        }
        // Echo back with server timestamp
        if err := stream.Send(&pb.HelloResponse{
            Message:   "Echo: " + req.GetName(),
            Timestamp: time.Now().Unix(),
        }); err != nil {
            return err
        }
    }
}
```

**编译 Proto 文件：**

```bash
# Install protoc and Go plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate Go code
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       proto/hello.proto
```

## 执行预览

```
# Terminal 1: Start server
$ go run server.go
2024/01/15 10:30:00 gRPC server on :50051
2024/01/15 10:30:05 method=/helloworld.Greeter/SayHello duration=120µs err=<nil>

# Terminal 2: Run client
$ go run client.go
2024/01/15 10:30:05 Response: Hello Go

# Terminal 2: Streaming client
$ go run client/stream.go
2024/01/15 10:31:00 Stream: Hello Stream
2024/01/15 10:31:01 Stream: Hello Stream
2024/01/15 10:31:02 Stream: Hello Stream
2024/01/15 10:31:03 Stream: Hello Stream
2024/01/15 10:31:04 Stream: Hello Stream
```

## 注意事项

| 项目 | 说明 | 严重度 |
|------|------|--------|
| UnimplementedGreeterServer | 必须嵌入，否则编译不过。保证新增 RPC 方法时旧代码不会崩溃 | ⚠️ 必须 |
| Protobuf 字段编号 | 一旦发布不可修改，只能新增。删字段用 `reserved` | 🔴 严重 |
| HTTP/2 依赖 | gRPC 需要 HTTP/2，部分 LB/代理需额外配置 | ⚠️ 注意 |
| 浏览器不支持 | 前端需 grpc-web 或 grpc-gateway 代理 | 💡 提示 |
| 拦截器 = 中间件 | UnaryInterceptor 处理一元调用，StreamInterceptor 处理流式调用 | 💡 提示 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 直接用 `json.Marshal` 序列化 protobuf 消息 | 使用 `protojson.Marshal` 或 `prototext.Marshal` |
| 忽略 `stream.Recv()` 返回的 `io.EOF` | 判断 `err == io.EOF` 表示流结束，正常退出 |
| 不设置客户端超时 | 用 `context.WithTimeout` 设置合理超时 |
| 在 proto 里修改已有字段编号 | 只新增字段，旧编号永远不用 |
| 服务端不检查 `ctx.Done()` | 长时间操作中检查 context 取消 |
| 用 `grpc.Dial` 同步连接 | `grpc.Dial` 是异步的，用 `grpc.WithBlock()` 才同步（已废弃，改用 `WaitForReady`） |

## 练习题

**🟢 入门：实现一个 Calculator gRPC 服务**
定义 `Calculator` 服务，包含 `Add(a, b)` 和 `Multiply(a, b)` 两个 Unary RPC。编写 proto、server、client。

**🟡 进阶：实现双向流聊天**
定义 `ChatService`，客户端持续发送消息，服务端收到后广播给所有连接的客户端。提示：用 `sync.Map` 管理活跃流。

**🔴 挑战：添加 JWT 认证拦截器**
实现 `UnaryInterceptor`，从 metadata 提取 Bearer Token，验证 JWT 签名和过期时间。未认证返回 `codes.Unauthenticated`，登录接口跳过认证。

## 知识点总结

```
gRPC基础
├── Proto3 语法
│   ├── message 定义（字段类型、编号、repeated）
│   ├── service / rpc 定义
│   └── option go_package
├── 代码生成
│   ├── protoc-gen-go（消息类型）
│   └── protoc-gen-go-grpc（服务接口）
├── 四种模式
│   ├── Unary: ctx → req, resp
│   ├── Server Stream: stream.Send() 循环
│   ├── Client Stream: stream.Recv() + SendAndClose()
│   └── Bidi Stream: Recv/Send 并行
├── 错误处理
│   ├── status.Error(codes.XXX, msg)
│   └── status.FromError(err)
├── 拦截器
│   ├── UnaryInterceptor
│   └── StreamInterceptor
└── 元数据
    ├── metadata.FromIncomingContext
    └── metadata.NewOutgoingContext
```

## 举一反三

| 本文学到 | 可迁移到 | 应用场景 |
|---------|---------|---------|
| Unary RPC | Thrift RPC、WCF | 请求-响应式服务调用 |
| Server Streaming | SSE、WebSocket 推送 | 实时日志、股票行情 |
| Client Streaming | 文件分片上传 | 大文件上传、批量数据导入 |
| Bidi Streaming | WebSocket 聊天 | 即时通讯、协作编辑 |
| Interceptor | HTTP Middleware | 认证、日志、限流、链路追踪 |
| Protobuf 定义 | OpenAPI/Swagger | 接口契约管理 |

## 参考资料

- [gRPC 官方文档](https://grpc.io/docs/)
- [Protocol Buffers 语言指南](https://protobuf.dev/programming-guides/proto3/)
- [gRPC-Go 示例代码](https://github.com/grpc/grpc-go/tree/master/examples)
- [Google API 设计指南](https://cloud.google.com/apis/design)

---

_从 Proto 定义到四种 RPC 模式，gRPC 让微服务通信更高效。_ 🔗
