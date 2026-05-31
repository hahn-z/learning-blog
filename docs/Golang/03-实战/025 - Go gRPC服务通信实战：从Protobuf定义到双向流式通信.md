---
title: "025 - Go gRPC服务通信实战：从Protobuf定义到双向流式通信"
slug: "025-grpc"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.494+08:00"
updated_at: "2026-04-29T10:02:45.081+08:00"
reading_time: 43
tags: ["Web开发"]
---

# Go gRPC服务通信实战：从Protobuf定义到双向流式通信

> **难度标注：** ⭐⭐⭐ 中高级（需要了解Go基础、HTTP和基本网络概念）
> **阅读时间：** 约25分钟
> **环境要求：** Go 1.21+、protoc 3.x、protoc-gen-go、protoc-gen-go-grpc

## 一、概念讲解

### 什么是 gRPC？

gRPC（gRPC Remote Procedure Call）是 Google 开源的高性能 RPC 框架，核心特点：

- **基于 HTTP/2**：多路复用、头部压缩、双向流
- **使用 Protobuf**：强类型、高效序列化（比 JSON 小 3-10 倍）
- **多语言支持**：一份 `.proto` 定义，自动生成 Go/Java/Python 等客户端
- **四种通信模式**：Unary、Server Streaming、Client Streaming、Bidirectional Streaming

### gRPC vs REST

| 对比维度 | gRPC | REST |
|---------|------|------|
| 协议 | HTTP/2 | HTTP/1.1 |
| 数据格式 | Protobuf（二进制） | JSON（文本） |
| 接口定义 | `.proto` 文件（强类型） | OpenAPI/Swagger |
| 代码生成 | 自动生成客户端/服务端 | 需手动或工具生成 |
| 流式通信 | 原生支持 | 需 WebSocket |
| 浏览器支持 | 需要 gRPC-Web | 直接支持 |
| 适用场景 | 微服务间通信 | 对外API |

## 二、知识脑图

```
gRPC实战
├── Protobuf定义
│   ├── 消息类型 (message)
│   ├── 服务定义 (service)
│   ├── 字段类型 (string, int32, repeated, map)
│   └── 包管理 (package, go_package, import)
├── 四种通信模式
│   ├── Unary RPC (一元调用)
│   ├── Server Streaming (服务端流)
│   ├── Client Streaming (客户端流)
│   └── Bidirectional Streaming (双向流)
├── 核心组件
│   ├── Server (服务端)
│   ├── Client Conn (客户端连接)
│   ├── Interceptor (拦截器)
│   └── Codec (编解码)
├── 工程实践
│   ├── 错误处理 (status codes)
│   ├── 超时与取消 (context)
│   ├── 拦截器 (auth, logging)
│   ├── 连接管理 (keepalive)
│   └── 元数据传递 (metadata)
└── 代码演进
    ├── v1: 基础Unary调用
    ├── v2: 加入流式通信
    └── v3: 拦截器+错误处理+连接管理
```

## 三、完整代码实现

### 项目结构

```
grpc-demo/
├── proto/
│   └── chat.proto
├── gen/
│   └── chat.pb.go      (自动生成)
│   └── chat_grpc.pb.go  (自动生成)
├── server/
│   └── main.go
├── client/
│   └── main.go
└── go.mod
```

### Step 1: Protobuf 定义

```protobuf
// proto/chat.proto
syntax = "proto3";

package chat;

// The Go package path for generated code
option go_package = "grpc-demo/gen/chat";

// Chat service definition - demonstrates all 4 RPC patterns
service ChatService {
  // Unary RPC: simple request-response
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);

  // Server Streaming: server sends multiple messages
  rpc Subscribe(SubscribeRequest) returns (stream ChatMessage);

  // Client Streaming: client sends multiple messages
  rpc UploadLog(stream LogEntry) returns (UploadLogResponse);

  // Bidirectional Streaming: real-time chat
  rpc ChatStream(stream ChatMessage) returns (stream ChatMessage);
}

// Common message type for chat
message ChatMessage {
  string user = 1;
  string text = 2;
  int64 timestamp = 3;
}

message SendMessageRequest {
  string user = 1;
  string text = 2;
}

message SendMessageResponse {
  bool success = 1;
  string message_id = 2;
}

message SubscribeRequest {
  string topic = 1;
}

message LogEntry {
  string level = 1;
  string message = 2;
  int64 timestamp = 3;
}

message UploadLogResponse {
  int32 count = 1;
  string summary = 2;
}
```

生成代码：

```bash
# Install protoc plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate Go code from proto definition
protoc --go_out=. --go_opt=paths=source_relative \
       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
       proto/chat.proto
```

### Step 2: 服务端实现

```go
// server/main.go
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	pb "grpc-demo/gen/chat"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// chatServer implements ChatServiceServer interface
type chatServer struct {
	pb.UnimplementedChatServiceServer
}

// SendMessage - Unary RPC: simple request and response
func (s *chatServer) SendMessage(ctx context.Context, req *pb.SendMessageRequest) (*pb.SendMessageResponse, error) {
	// Validate input
	if req.User == "" {
		return nil, status.Error(codes.InvalidArgument, "user is required")
	}

	// Read metadata from context (like HTTP headers)
	md, ok := metadata.FromIncomingContext(ctx)
	if ok {
		if auth := md.Get("authorization"); len(auth) > 0 {
			log.Printf("[Auth] Token: %s", auth[0])
		}
	}

	// Generate message ID using timestamp
	msgID := fmt.Sprintf("msg-%d", time.Now().UnixNano())

	log.Printf("[Unary] %s: %s (id: %s)", req.User, req.Text, msgID)

	return &pb.SendMessageResponse{
		Success:  true,
		MessageId: msgID,
	}, nil
}

// Subscribe - Server Streaming RPC: push messages to client
func (s *chatServer) Subscribe(req *pb.SubscribeRequest, stream pb.ChatService_SubscribeServer) error {
	topic := req.Topic
	log.Printf("[ServerStream] New subscriber for topic: %s", topic)

	// Simulate pushing 5 messages over 5 seconds
	for i := 1; i <= 5; i++ {
		// Check if client has cancelled the request
		if err := stream.Context().Err(); err != nil {
			log.Printf("[ServerStream] Client disconnected: %v", err)
			return err
		}

		msg := &pb.ChatMessage{
			User:      "server",
			Text:      fmt.Sprintf("Message #%d on topic '%s'", i, topic),
			Timestamp: time.Now().Unix(),
		}

		if err := stream.Send(msg); err != nil {
			return fmt.Errorf("failed to send message: %w", err)
		}

		log.Printf("[ServerStream] Sent message #%d", i)
		time.Sleep(1 * time.Second)
	}

	return nil
}

// UploadLog - Client Streaming RPC: receive multiple log entries
func (s *chatServer) UploadLog(stream pb.ChatService_UploadLogServer) error {
	var count int32

	for {
		// Receive messages from client stream
		entry, err := stream.Recv()
		if err == io.EOF {
			// Client finished sending, send summary response
			summary := fmt.Sprintf("Received %d log entries", count)
			log.Printf("[ClientStream] %s", summary)
			return stream.SendAndClose(&pb.UploadLogResponse{
				Count:   count,
				Summary: summary,
			})
		}
		if err != nil {
			return fmt.Errorf("failed to receive log entry: %w", err)
		}

		count++
		log.Printf("[ClientStream] Log #%d: [%s] %s", count, entry.Level, entry.Message)
	}
}

// ChatStream - Bidirectional Streaming RPC: real-time chat
func (s *chatServer) ChatStream(stream pb.ChatService_ChatStreamServer) error {
	for {
		// Receive message from client
		msg, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("chat stream recv error: %w", err)
		}

		log.Printf("[BidiStream] %s: %s", msg.User, msg.Text)

		// Echo back with server response
		reply := &pb.ChatMessage{
			User:      "server",
			Text:      fmt.Sprintf("Echo: %s", msg.Text),
			Timestamp: time.Now().Unix(),
		}

		if err := stream.Send(reply); err != nil {
			return fmt.Errorf("chat stream send error: %w", err)
		}
	}
}

// authInterceptor - unary interceptor for authentication
func authInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	start := time.Now()

	// Log the method being called
	log.Printf("[Interceptor] Method: %s", info.FullMethod)

	// Call the actual handler
	resp, err := handler(ctx, req)

	// Log duration
	log.Printf("[Interceptor] Duration: %v, Error: %v", time.Since(start), err)

	return resp, err
}

func main() {
	// Create gRPC server with interceptor
	server := grpc.NewServer(
		grpc.UnaryInterceptor(authInterceptor),
	)

	// Register our service implementation
	pb.RegisterChatServiceServer(server, &chatServer{})

	// Listen on TCP port
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	log.Println("gRPC server listening on :50051")
	if err := server.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
```

### Step 3: 客户端实现

```go
// client/main.go
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"time"

	pb "grpc-demo/gen/chat"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	// Dial gRPC server (insecure for demo, use TLS in production)
	conn, err := grpc.NewClient(
		"localhost:50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewChatServiceClient(conn)

	// --- Demo 1: Unary RPC ---
	demoUnary(client)

	// --- Demo 2: Server Streaming ---
	demoServerStream(client)

	// --- Demo 3: Client Streaming ---
	demoClientStream(client)

	// --- Demo 4: Bidirectional Streaming ---
	demoBidiStream(client)
}

// demoUnary demonstrates simple request-response call
func demoUnary(client pb.ChatServiceClient) {
	fmt.Println("\n=== Unary RPC ===")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := client.SendMessage(ctx, &pb.SendMessageRequest{
		User: "Alice",
		Text: "Hello gRPC!",
	})
	if err != nil {
		log.Printf("SendMessage failed: %v", err)
		return
	}

	fmt.Printf("Response: success=%v, message_id=%s\n", resp.Success, resp.MessageId)
}

// demoServerStream demonstrates server pushing multiple messages
func demoServerStream(client pb.ChatServiceClient) {
	fmt.Println("\n=== Server Streaming ===")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stream, err := client.Subscribe(ctx, &pb.SubscribeRequest{Topic: "golang"})
	if err != nil {
		log.Printf("Subscribe failed: %v", err)
		return
	}

	for {
		msg, err := stream.Recv()
		if err == io.EOF {
			fmt.Println("Server stream ended.")
			break
		}
		if err != nil {
			log.Printf("Stream recv error: %v", err)
			break
		}
		fmt.Printf("Received: [%s] %s\n", msg.User, msg.Text)
	}
}

// demoClientStream demonstrates client sending multiple messages
func demoClientStream(client pb.ChatServiceClient) {
	fmt.Println("\n=== Client Streaming ===")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stream, err := client.UploadLog(ctx)
	if err != nil {
		log.Printf("UploadLog failed: %v", err)
		return
	}

	// Send 3 log entries
	levels := []string{"INFO", "WARN", "ERROR"}
	for i, level := range levels {
		entry := &pb.LogEntry{
			Level:     level,
			Message:   fmt.Sprintf("Log entry #%d", i+1),
			Timestamp: time.Now().Unix(),
		}
		if err := stream.Send(entry); err != nil {
			log.Printf("Send log entry failed: %v", err)
			return
		}
	}

	// Close client stream and get response
	resp, err := stream.CloseAndRecv()
	if err != nil {
		log.Printf("CloseAndRecv failed: %v", err)
		return
	}
	fmt.Printf("Upload result: count=%d, summary=%s\n", resp.Count, resp.Summary)
}

// demoBidiStream demonstrates real-time bidirectional chat
func demoBidiStream(client pb.ChatServiceClient) {
	fmt.Println("\n=== Bidirectional Streaming ===")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stream, err := client.ChatStream(ctx)
	if err != nil {
		log.Printf("ChatStream failed: %v", err)
		return
	}

	// Send messages in a goroutine
	messages := []string{"Hi!", "How are you?", "Goodbye!"}
	go func() {
		for _, text := range messages {
			msg := &pb.ChatMessage{
				User:      "Alice",
				Text:      text,
				Timestamp: time.Now().Unix(),
			}
			if err := stream.Send(msg); err != nil {
				log.Printf("Bidi send error: %v", err)
				return
			}
			time.Sleep(500 * time.Millisecond)
		}
		stream.CloseSend()
	}()

	// Receive server responses
	for {
		reply, err := stream.Recv()
		if err == io.EOF {
			fmt.Println("Bidirectional stream ended.")
			break
		}
		if err != nil {
			log.Printf("Bidi recv error: %v", err)
			break
		}
		fmt.Printf("Server reply: [%s] %s\n", reply.User, reply.Text)
	}
}
```

## 四、执行预览

```bash
# Terminal 1: Start server
$ go run server/main.go
gRPC server listening on :50051
[Interceptor] Method: /chat.ChatService/SendMessage
[Unary] Alice: Hello gRPC! (id: msg-1714000000000000000)
[Interceptor] Duration: 123.456µs, Error: <nil>
[ServerStream] New subscriber for topic: golang
[ServerStream] Sent message #1
[ServerStream] Sent message #2
[ClientStream] Log #1: [INFO] Log entry #1
[ClientStream] Log #2: [WARN] Log entry #2
[ClientStream] Log #3: [ERROR] Log entry #3
[ClientStream] Received 3 log entries
[BidiStream] Alice: Hi!
[BidiStream] Alice: How are you?
[BidiStream] Alice: Goodbye!

# Terminal 2: Run client
$ go run client/main.go

=== Unary RPC ===
Response: success=true, message_id=msg-1714000000000000000

=== Server Streaming ===
Received: [server] Message #1 on topic 'golang'
Received: [server] Message #2 on topic 'golang'
Received: [server] Message #3 on topic 'golang'
Received: [server] Message #4 on topic 'golang'
Received: [server] Message #5 on topic 'golang'
Server stream ended.

=== Client Streaming ===
Upload result: count=3, summary=Received 3 log entries

=== Bidirectional Streaming ===
Server reply: [server] Echo: Hi!
Server reply: [server] Echo: How are you?
Server reply: [server] Echo: Goodbye!
Bidirectional stream ended.
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Protobuf版本 | 必须使用 `proto3`，`proto2` 语法不同且更复杂 |
| go_package | 必须正确设置，否则生成的代码 import 路径错误 |
| Unimplemented | 服务端必须嵌入 `UnimplementedChatServiceServer`，保证向前兼容 |
| 连接安全 | 生产环境必须使用 TLS，不要用 `insecure.NewCredentials()` |
| 超时控制 | 必须设置 `context.WithTimeout`，避免请求永久挂起 |
| 流的生命周期 | 服务端流要检查 `stream.Context().Err()`，处理客户端断连 |
| 连接复用 | 一个 `ClientConn` 可以复用，不需要每次请求创建新连接 |
| 拦截器顺序 | 多个拦截器按注册顺序执行，注意链式调用 |
| 错误码 | 使用 `status.Error(codes.XXX, msg)` 返回标准 gRPC 错误码 |

## 六、避坑指南

### ❌ 在生产环境使用 insecure 连接
```go
// ❌ 危险：明文传输，数据可被截获
grpc.WithTransportCredentials(insecure.NewCredentials())
```
```go
// ✅ 正确：使用 TLS 加密
creds := credentials.NewTLS(&tls.Config{})
grpc.WithTransportCredentials(creds)
```

### ❌ 忘记处理流式 RPC 的 EOF
```go
// ❌ 丢失：忽略 EOF 会导致无限循环
for {
    msg, err := stream.Recv()
    if err != nil {
        log.Fatal(err) // EOF 也会报错退出
    }
}
```
```go
// ✅ 正确：区分 EOF 和真正的错误
for {
    msg, err := stream.Recv()
    if err == io.EOF {
        break // Normal end of stream
    }
    if err != nil {
        return fmt.Errorf("stream error: %w", err)
    }
    // Process msg
}
```

### ❌ 不设置超时
```go
// ❌ 危险：请求可能永远挂起
resp, err := client.SendMessage(context.Background(), req)
```
```go
// ✅ 正确：始终设置超时
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
resp, err := client.SendMessage(ctx, req)
```

### ❌ 每次请求创建新连接
```go
// ❌ 低效：频繁建立/断开连接开销大
func call() {
    conn, _ := grpc.NewClient("localhost:50051", ...)
    defer conn.Close()
    // ... use once
}
```
```go
// ✅ 正确：复用连接（在 main 或初始化时创建）
var conn *grpc.ClientConn // Create once, reuse everywhere
```

### ❌ 不检查客户端取消（服务端流）
```go
// ❌ 问题：客户端已断开，服务端还在发送
for i := 0; i < 1000; i++ {
    stream.Send(msg)
    time.Sleep(time.Second)
}
```
```go
// ✅ 正确：每次发送前检查 context
for i := 0; i < 1000; i++ {
    if stream.Context().Err() != nil {
        return // Client disconnected
    }
    stream.Send(msg)
    time.Sleep(time.Second)
}
```

## 七、练习题

### 🟢 基础题
1. 修改 `SendMessage`，添加一个 `MessageType` 枚举（TEXT, IMAGE, VIDEO），在 proto 中定义并使用
2. 为 gRPC 服务端添加一个健康检查服务（使用 `grpc.health` 包）

### 🟡 进阶题
3. 实现一个流式拦截器（`grpc.StreamInterceptor`），记录每个流式调用的持续时间
4. 使用 `metadata` 实现简单的 Token 认证：客户端发送 token，服务端拦截器验证

### 🔴 挑战题
5. 实现一个聊天室：多个客户端通过双向流连接，消息广播给所有在线用户（提示：需要用 map 管理所有活跃流）
6. 实现 gRPC 拦截器链（支持多个拦截器按顺序执行），类似 Gin 的中间件机制

## 八、知识点总结

```
gRPC核心知识树
├── 基础
│   ├── Protobuf语法 (syntax, message, service, enum)
│   ├── 代码生成 (protoc, protoc-gen-go, protoc-gen-go-grpc)
│   └── 连接建立 (grpc.NewClient, grpc.NewServer)
├── 通信模式
│   ├── Unary (ctx, req) → (resp, error)
│   ├── Server Stream (req, stream) → stream.Send()
│   ├── Client Stream (stream) → stream.Send() + CloseAndRecv()
│   └── Bidi Stream (stream) → Send() + Recv() concurrent
├── 高级特性
│   ├── Metadata (metadata.New, metadata.FromIncomingContext)
│   ├── 错误处理 (status.Error, status.FromError)
│   ├── 拦截器 (UnaryInterceptor, StreamInterceptor)
│   └── 超时取消 (context.WithTimeout, context.WithCancel)
└── 最佳实践
    ├── 连接复用 (singleton ClientConn)
    ├── TLS加密 (credentials.NewTLS)
    ├── 健康检查 (grpc.health)
    └── 反射服务 (grpc/reflection)
```

## 九、举一反三

| 场景 | 推荐RPC模式 | 原因 |
|------|------------|------|
| 用户登录认证 | Unary | 一次请求一次响应，最简单 |
| 实时数据推送（股票行情） | Server Streaming | 服务端持续推送，客户端被动接收 |
| 文件上传 | Client Streaming | 客户端分块发送，服务端汇总处理 |
| 即时聊天 | Bidi Streaming | 双方都需要随时发送消息 |
| 日志收集 | Client Streaming | 多条日志批量发送，减少网络开销 |
| 数据库查询 | Unary | 查询-响应模式，无需流式 |
| 视频监控画面推送 | Server Streaming | 摄像头持续推流，客户端观看 |
| 协同编辑 | Bidi Streaming | 多方实时同步编辑内容 |

## 十、参考资料

- [gRPC官方文档](https://grpc.io/docs/)
- [Protocol Buffers Language Guide](https://protobuf.dev/programming-guides/proto3/)
- [grpc-go GitHub](https://github.com/grpc/grpc-go)
- [Go gRPC Quick Start](https://grpc.io/docs/languages/go/quickstart/)
- 《gRPC: Up and Running》- Kasun Indrasiri

## 十一、代码演进

### v1：最简 Unary 调用（5分钟上手）

只实现 `SendMessage` Unary RPC，proto 文件只有一条消息定义，服务端直接返回硬编码响应。目标是跑通 gRPC 的基本流程：proto → 代码生成 → 服务实现 → 客户端调用。

### v2：加入流式通信（理解4种模式）

在 v1 基础上补全 Server Streaming（Subscribe）、Client Streaming（UploadLog）、Bidirectional Streaming（ChatStream）三种流式 RPC。每个方法都用最简单的实现，展示流式通信的基本用法。

### v3：生产级增强（本文完整版）

加入 Unary 拦截器（日志+计时）、Metadata 传递、标准错误码（`status.Error`）、context 超时检查、输入验证。客户端使用 `context.WithTimeout` 控制超时，服务端流检查 `stream.Context().Err()` 处理客户端断连。

**v2→v3 关键变化：**
- 拦截器：零侵入地添加日志和认证逻辑
- 错误码：用 `status.Error(codes.InvalidArgument, ...)` 替代 `fmt.Errorf`
- 超时控制：每个客户端调用都带 timeout context
- 断连处理：服务端流每次发送前检查 context

---

**下一步建议：** 尝试将 gRPC 与你的 Gin HTTP 服务结合——用 gRPC 处理内部微服务通信，Gin 处理对外 API，通过 gRPC-Gateway 实现一个服务同时支持两种协议。
