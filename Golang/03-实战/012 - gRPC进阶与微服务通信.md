---
title: "012 - gRPC进阶与微服务通信"
slug: "012-redis"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.332+08:00"
updated_at: "2026-04-29T10:02:44.978+08:00"
reading_time: 23
tags: ["数据库"]
---

# 067: gRPC进阶与微服务通信

> **难度：⭐⭐⭐⭐⭐ 专家级** | 深入 TLS 加密、Token 认证、服务发现、负载均衡、gRPC 网关等生产级话题。
>
> **前置知识：** gRPC 基础（066篇）、TLS/SSL 基本概念、JWT 认证
>
> **学习目标：** 掌握 gRPC 生产环境必备技能：安全传输、认证授权、服务发现、REST 网关转换。

## 概念讲解

gRPC 进阶涉及四个生产级话题：

- **TLS 加密：** 生产环境必须启用 TLS，防止数据泄露和中间人攻击。支持单向 TLS（客户端验证服务端）和 mTLS（双向验证）。
- **Token 认证：** 通过拦截器从 metadata（类似 HTTP Header）中提取 JWT Token，验证后才允许调用。
- **服务发现与负载均衡：** 微服务环境下，客户端需要知道服务端地址。方案有 DNS、Consul、etcd 等。gRPC 内置 round-robin 负载均衡。
- **gRPC Gateway：** 将 gRPC 服务暴露为 RESTful HTTP 接口，让浏览器和传统 HTTP 客户端也能访问。

## 脑图

```
gRPC进阶
├── 安全
│   ├── TLS 单向认证
│   ├── mTLS 双向认证
│   └── JWT Token 认证
├── 服务发现
│   ├── DNS Resolver
│   ├── Consul 注册/发现
│   └── etcd Lease/Watch
├── 负载均衡
│   ├── Round-Robin (内置)
│   ├── 自定义 Resolver
│   └── 服务端 LB (Proxy)
├── gRPC Gateway
│   ├── proto HTTP 注解
│   ├── runtime.ServeMux
│   └── 流式请求映射
└── 高级特性
    ├── 超时与重试策略
    ├── Proto3 oneof/map/wrapper
    └── 服务配置 (ServiceConfig)
```

## 代码演进

### v1：TLS 加密 + JWT 认证

```go
// tls_server.go - Server with TLS and JWT auth
package main

import (
    "context"
    "crypto/tls"
    "log"
    "net"
    "strings"

    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/credentials"
    "google.golang.org/grpc/metadata"
    "google.golang.org/grpc/status"
    pb "github.com/example/proto"
)

func main() {
    // Load TLS certificate
    cert, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        log.Fatal(err)
    }
    creds := credentials.NewTLS(&tls.Config{
        Certificates: []tls.Certificate{cert},
    })

    lis, _ := net.Listen("tcp", ":50051")
    s := grpc.NewServer(
        grpc.Creds(creds),
        grpc.UnaryInterceptor(AuthInterceptor),
    )
    pb.RegisterGreeterServer(s, &server{})
    log.Fatal(s.Serve(lis))
}

// AuthInterceptor validates JWT token from metadata
func AuthInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
    // Skip auth for login method
    if info.FullMethod == "/api.Auth/Login" {
        return handler(ctx, req)
    }

    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "missing metadata")
    }

    tokens := md.Get("authorization")
    if len(tokens) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing token")
    }

    token := strings.TrimPrefix(tokens[0], "Bearer ")
    userID, err := validateJWT(token)
    if err != nil {
        return nil, status.Error(codes.Unauthenticated, "invalid token")
    }

    // Inject user info into context for downstream handlers
    ctx = context.WithValue(ctx, "userID", userID)
    return handler(ctx, req)
}

func validateJWT(token string) (string, error) {
    // Real implementation: parse and verify JWT signature
    // Use github.com/golang-jwt/jwt/v5
    return "user123", nil
}
```

**TLS 客户端：**

```go
// tls_client.go
func main() {
    creds := credentials.NewTLS(&tls.Config{
        InsecureSkipVerify: true, // Production: use CA cert pool
    })
    conn, err := grpc.Dial("localhost:50051",
        grpc.WithTransportCredentials(creds),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()
    // ... make calls with metadata
    ctx := metadata.AppendToOutgoingContext(context.Background(),
        "authorization", "Bearer my-jwt-token")
    resp, err := client.SayHello(ctx, &pb.HelloRequest{Name: "TLS"})
    // ...
}
```

### v2：服务发现 + 负载均衡

```go
// consul_register.go - Register service to Consul
package discovery

import (
    "log"
    "github.com/hashicorp/consul/api"
)

func RegisterService(consulAddr, serviceName, serviceAddr string, port int) error {
    config := api.DefaultConfig()
    config.Address = consulAddr
    client, err := api.NewClient(config)
    if err != nil {
        return err
    }

    registration := &api.AgentServiceRegistration{
        ID:      serviceName + "-" + serviceAddr,
        Name:    serviceName,
        Address: serviceAddr,
        Port:    port,
        Check: &api.AgentServiceCheck{
            GRPC:     serviceAddr + "/health",
            Interval: "10s",
            Timeout:  "5s",
        },
    }
    return client.Agent().ServiceRegister(registration)
}

// Client with DNS resolver + round-robin LB
func dialWithLB() *grpc.ClientConn {
    conn, err := grpc.Dial(
        "dns:///my-service:50051", // DNS-based service discovery
        grpc.WithDefaultServiceConfig(`{"loadBalancingConfig":[{"round_robin":{}}]}`),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    return conn
}
```

### v3：gRPC Gateway + 重试策略

```protobuf
// Add HTTP annotation to proto
import "google/api/annotations.proto";

service Greeter {
  rpc SayHello(HelloRequest) returns (HelloResponse) {
    option (google.api.http) = {
      get: "/v1/hello/{name}"
    };
  }
}
```

```go
// gateway.go - REST proxy for gRPC service
package main

import (
    "context"
    "log"
    "net/http"

    "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    pb "github.com/example/proto"
)

func main() {
    ctx := context.Background()
    mux := runtime.NewServeMux()
    opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}

    // Register gateway handler pointing to gRPC server
    err := pb.RegisterGreeterHandlerFromEndpoint(ctx, mux, "localhost:50051", opts)
    if err != nil {
        log.Fatal(err)
    }

    log.Println("Gateway on :8080")
    log.Fatal(http.ListenAndServe(":8080", mux))
}
```

**重试策略配置：**

```go
// Client with retry policy
func dialWithRetry() *grpc.ClientConn {
    serviceConfig := `{
        "methodConfig": [{
            "name": [{"service": "helloworld.Greeter"}],
            "retryPolicy": {
                "maxAttempts": 3,
                "initialBackoff": "0.1s",
                "maxBackoff": "1s",
                "backoffMultiplier": 2,
                "retryableStatusCodes": ["UNAVAILABLE"]
            }
        }]
    }`
    conn, err := grpc.Dial("localhost:50051",
        grpc.WithDefaultServiceConfig(serviceConfig),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil {
        log.Fatal(err)
    }
    return conn
}
```

## 执行预览

```
# Terminal 1: Start gRPC server with TLS
$ go run server.go
2024/01/15 10:00:00 gRPC server on :50051 (TLS enabled)

# Terminal 2: Start gateway
$ go run gateway.go
2024/01/15 10:00:05 Gateway on :8080

# Terminal 3: Test via curl (REST → gRPC)
$ curl http://localhost:8080/v1/hello/World
{"message":"Hello World","timestamp":"1705315205"}

# Terminal 4: gRPC client with auth
$ go run client.go
2024/01/15 10:01:00 Response: Hello TLS

# Without token → UNAUTHENTICATED
$ go run client.go -no-token
rpc error: code = Unauthenticated desc = missing token
```

## 注意事项

| 项目 | 说明 | 严重度 |
|------|------|--------|
| TLS 证书管理 | 生产建议 cert-manager 或 Let's Encrypt 自动管理 | ⚠️ 重要 |
| mTLS 双向认证 | 服务间通信推荐 mTLS，零信任网络必备 | ⚠️ 重要 |
| Gateway 性能开销 | HTTP→gRPC 多一层转换，极致性能场景需评估 | 💡 提示 |
| 服务发现延迟 | Consul/etcd 健康检查有间隔，下线后有短暂不可用窗口 | ⚠️ 注意 |
| 重试放大故障 | 合理设 maxAttempts 和 retryableStatusCodes，避免雪崩 | 🔴 严重 |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `InsecureSkipVerify: true` 上生产 | 使用 CA 证书池验证服务端证书 |
| Token 存 metadata key 随意命名 | 用标准 key `authorization`，遵循 Bearer 规范 |
| 不设重试的 retryableStatusCodes | 只对 UNAVAILABLE 重试，不要对 InvalidArgument 重试 |
| Consul 注册不做健康检查 | 配置 GRPC/HTTP 健康检查，自动摘除不健康节点 |
| Gateway 不设超时 | Gateway 和 gRPC 都设超时，防止级联阻塞 |
| 忽略 grpc.Dial 返回的 error | 始终检查错误，即使 Dial 是异步的 |

## 练习题

**🟢 入门：启用 TLS 单向认证**
用 `openssl` 生成自签名证书，配置 gRPC 服务端和客户端 TLS，验证加密通信。

**🟡 进阶：用 etcd 实现服务注册发现**
使用 `go.etcd.io/etcd/client/v3` 的 Lease + Watch 机制替代 Consul，实现服务注册、心跳续约、服务发现。

**🔴 挑战：gRPC Gateway 全链路**
为一个包含 3 个 RPC 方法的 gRPC 服务添加 grpc-gateway，支持 GET/POST 映射，通过 curl 测试，对比 gRPC 和 HTTP 延迟（用 `ghz` 压测）。

## 知识点总结

```
gRPC进阶
├── TLS安全
│   ├── tls.LoadX509KeyPair
│   ├── credentials.NewTLS
│   └── mTLS (cert pool verify)
├── 认证授权
│   ├── metadata.FromIncomingContext
│   ├── UnaryInterceptor 鉴权
│   └── context.WithValue 注入
├── 服务发现
│   ├── DNS Resolver (dns:///)
│   ├── Consul (注册 + 健康检查)
│   └── etcd (Lease + Watch)
├── 负载均衡
│   ├── round_robin (内置)
│   └── ServiceConfig 配置
├── Gateway
│   ├── proto HTTP 注解
│   ├── runtime.NewServeMux
│   └── RegisterHandlerFromEndpoint
└── 可靠性
    ├── 重试策略 (retryPolicy)
    └── 超时控制 (context)
```

## 举一反三

| 本文学到 | 可迁移到 | 应用场景 |
|---------|---------|---------|
| TLS/mTLS | 任何 RPC 框架 | 服务间零信任通信 |
| JWT 拦截器 | HTTP Middleware | API Gateway 统一认证 |
| 服务注册/发现 | K8s Service、Nginx | 动态扩缩容 |
| Round-Robin LB | Nginx upstream | 请求分发 |
| gRPC Gateway | GraphQL → REST | 多协议适配层 |
| 重试策略 | 任何网络调用 | 弹性容错 |

## 参考资料

- [gRPC Security 最佳实践](https://grpc.io/docs/guides/auth/)
- [grpc-gateway 项目](https://github.com/grpc-ecosystem/grpc-gateway)
- [Consul Service Discovery](https://developer.hashicorp.com/consul/docs/discovery)
- [gRPC-Go Load Balancing](https://github.com/grpc/grpc-go/blob/master/Documentation/load-balancing.md)

---

_TLS 认证、服务发现、负载均衡、REST 网关，gRPC 生产化四件套。_ 🔐
