---
title: "003-Protobuf协议与代码生成"
slug: "003-kratos-protobuf"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:15:56.584+08:00"
updated_at: "2026-04-29T10:02:45.295+08:00"
reading_time: 26
tags: []
---


# 003-Protobuf协议与代码生成

> **难度：⭐⭐⭐（进阶级）**
>
> 需要了解基本的数据序列化概念。读完本文，你将精通Protobuf语法，并能熟练使用kratos的代码生成工具链。

---

## 一、概念讲解

### 1.1 什么是Protobuf？

**Protocol Buffers（Protobuf）** 是Google开发的**语言无关、平台无关**的序列化协议：

| 特性 | Protobuf | JSON | XML |
|------|---------|------|-----|
| 序列化大小 | 极小 | 大 | 很大 |
| 解析速度 | 极快 | 中 | 慢 |
| 可读性 | 二进制（不可读） | 高 | 高 |
| Schema定义 | .proto文件 | 无 | XSD |
| 代码生成 | ✅ 自动 | ❌ | ❌ |
| 类型安全 | ✅ 强类型 | ❌ 弱类型 | ❌ |

### 1.2 为什么Kratos选择Protobuf？

1. **接口即契约**：proto文件是前后端、服务间的API契约
2. **代码生成**：一个proto文件同时生成HTTP和gRPC代码
3. **类型安全**：编译期检查，减少运行时错误
4. **高性能**：gRPC默认使用Protobuf，效率远超JSON
5. **文档即代码**：proto文件本身就是最准确的API文档

### 1.3 Kratos代码生成流程

```
.proto文件 → protoc编译器 → 生成Go代码
                              ├── .pb.go          (消息类型)
                              ├── _grpc.pb.go      (gRPC服务)
                              ├── _http.pb.go      (HTTP路由)
                              └── .pb.validate.go  (校验规则)
```

---

## 二、脑图（ASCII）

```
              Protobuf与代码生成
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  Proto语法     代码生成       组织规范
     │              │              │
  ┌──┼──┐      ┌───┼───┐     ┌───┼───┐
  │  │  │      │   │   │     │   │   │
msg svc rpc  pb.go grpc http ver  目录  命名  版本
            .go  .go  .go sion
```

---

## 三、Protobuf语法详解

### 3.1 基础语法

```protobuf
// api/helloworld/v1/greeter.proto

// Specify syntax version
syntax = "proto3";

// Go package path
package helloworld.v1;

// Go import path option
option go_package = "helloworld/api/helloworld/v1";

// Import common types
import "google/protobuf/empty.proto";

// Service definition
service GreeterService {
    // RPC method: takes HelloRequest, returns HelloReply
    rpc SayHello (HelloRequest) returns (HelloReply) {}
    
    // RPC method: takes no params (Empty), returns HelloList
    rpc ListGreetings (google.protobuf.Empty) returns (HelloList) {}
}

// Message definition (like a struct)
message HelloRequest {
    string name = 1;           // Field number 1
    int32 age = 2;             // Field number 2
    repeated string tags = 3;  // Repeated = slice/array
}

message HelloReply {
    string message = 1;
}

message HelloList {
    repeated HelloReply items = 1;
    int32 total = 2;
}
```

### 3.2 数据类型映射

| Protobuf类型 | Go类型 | 说明 |
|-------------|--------|------|
| string | string | 字符串 |
| int32/int64 | int32/int64 | 整数 |
| uint32/uint64 | uint32/uint64 | 无符号整数 |
| float/double | float32/float64 | 浮点数 |
| bool | bool | 布尔值 |
| bytes | []byte | 字节流 |
| repeated T | []T | 数组/切片 |
| map<K,V> | map[K]V | 映射 |
| optional T | *T | 可选（proto3） |
| oneof | interface{} | 联合类型 |
| enum | int32 (enum type) | 枚举 |

### 3.3 高级语法

```protobuf
// Enum definition
message User {
    enum Status {
        STATUS_UNSPECIFIED = 0;  // First value must be 0
        STATUS_ACTIVE = 1;
        STATUS_INACTIVE = 2;
        STATUS_BANNED = 3;
    }
    
    int64 id = 1;
    string name = 2;
    string email = 3;
    Status status = 4;
    
    // oneof: only one field can be set
    oneof contact {
        string phone = 5;
        string wechat = 6;
    }
    
    // Nested message
    message Address {
        string city = 1;
        string street = 2;
    }
    Address address = 7;
    
    // Timestamp
    google.protobuf.Timestamp created_at = 8;
}
```

### 3.4 HTTP注解（Kratos扩展）

Kratos通过`google/api/annotations.proto`支持HTTP路由映射：

```protobuf
syntax = "proto3";

package helloworld.v1;

option go_package = "helloworld/api/helloworld/v1";

import "google/api/annotations.proto";
import "google/protobuf/empty.proto";

service GreeterService {
    // Map RPC to GET /helloworld/{name}
    rpc SayHello (HelloRequest) returns (HelloReply) {
        option (google.api.http) = {
            get: "/helloworld/{name}"
        };
    }
    
    // Map RPC to POST /greetings
    rpc CreateGreeting (CreateGreetingRequest) returns (HelloReply) {
        option (google.api.http) = {
            post: "/v1/greetings"
            body: "*"
        };
    }
    
    // Map RPC to PUT /greetings/{id}
    rpc UpdateGreeting (UpdateGreetingRequest) returns (HelloReply) {
        option (google.api.http) = {
            put: "/v1/greetings/{id}"
            body: "*"
        };
    }
    
    // Map RPC to DELETE /greetings/{id}
    rpc DeleteGreeting (DeleteGreetingRequest) returns (google.protobuf.Empty) {
        option (google.api.http) = {
            delete: "/v1/greetings/{id}"
        };
    }
    
    // Map RPC to GET /greetings
    rpc ListGreetings (ListGreetingRequest) returns (HelloList) {
        option (google.api.http) = {
            get: "/v1/greetings"
        };
    }
}

message HelloRequest {
    string name = 1;
}

message CreateGreetingRequest {
    string name = 1;
    string message = 2;
}

message UpdateGreetingRequest {
    int64 id = 1;
    string name = 2;
    string message = 3;
}

message DeleteGreetingRequest {
    int64 id = 1;
}

message ListGreetingRequest {
    int32 page = 1;
    int32 page_size = 2;
}
```

---

## 四、代码生成

### 4.1 使用Makefile（推荐）

```makefile
# Makefile
.PHONY: api
api:
	protoc --proto_path=. \
	       --proto_path=./third_party \
	       --go_out=paths=source_relative:. \
	       --go-http_out=paths=source_relative:. \
	       --go-grpc_out=paths=source_relative:. \
	       --go-errors_out=paths=source_relative:. \
	       --validate_out=paths=source_relative:. \
	       $(shell find api -name '*.proto')
```

### 4.2 使用kratos CLI

```bash
# Generate from a single proto file
kratos proto client api/helloworld/v1/greeter.proto

# Generate server stub
kratos proto server api/helloworld/v1/greeter.proto -t internal/service
```

### 4.3 生成文件说明

```
api/helloworld/v1/
├── greeter.proto              # Source: proto definition
├── greeter.pb.go              # Generated: message types (structs)
├── greeter_http.pb.go         # Generated: HTTP routes + handlers
├── greeter_grpc.pb.go         # Generated: gRPC server/client stubs
├── greeter.pb.validate.go     # Generated: validation logic (optional)
└── greeter.pb.errors.go       # Generated: error codes (optional)
```

**greeter.pb.go** — 生成的消息类型：
```go
// Auto-generated by protoc. DO NOT EDIT.
type HelloRequest struct {
    Name string `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
}
```

**greeter_http.pb.go** — 生成的HTTP路由：
```go
// Register route: GET /helloworld/{name}
func RegisterGreeterServiceHTTPServer(s *http.Server, srv GreeterServiceHTTPServer) {
    r := s.Route("/")
    r.GET("/helloworld/{name}", _GreeterService_SayHello0_HTTP_Handler(srv))
}
```

**greeter_grpc.pb.go** — 生成的gRPC存根：
```go
// gRPC service descriptor
func RegisterGreeterServiceServer(s grpc.ServiceRegistrar, srv GreeterServiceServer) {
    s.RegisterService(&_GreeterService_serviceDesc, srv)
}
```

---

## 五、执行预览

```
$ make api
protoc --proto_path=. --proto_path=./third_party \
       --go_out=paths=source_relative:. \
       --go-http_out=paths=source_relative:. \
       --go-grpc_out=paths=source_relative:. \
       api/helloworld/v1/greeter.proto

# Generated files:
#   api/helloworld/v1/greeter.pb.go
#   api/helloworld/v1/greeter_http.pb.go
#   api/helloworld/v1/greeter_grpc.pb.go

$ kratos proto client api/helloworld/v1/greeter.proto
# Same as make api but for a single file
```

---

## 六、注意事项

| 注意点 | 说明 | 严重度 |
|--------|------|--------|
| proto3语法 | 确保第一行声明`syntax = "proto3"` | 🔴 高 |
| go_package选项 | 必须正确设置Go导入路径 | 🔴 高 |
| field number | 已使用的编号永远不要复用 | 🔴 高 |
| third_party目录 | 存放google/api等第三方proto | 🟡 中 |
| import路径 | 确保protoc能找到所有import | 🟡 中 |
| 生成文件不要手动修改 | 每次make api会覆盖 | 🔴 高 |

---

## 七、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 修改已发布proto的field number | 永远用新编号，旧编号废弃 |
| 手动编辑生成的.pb.go文件 | 只编辑.proto文件，重新生成 |
| proto文件放在项目根目录 | 放在`api/`目录下，按版本组织 |
| 不设置go_package | 必须设置，否则生成路径错误 |
| import google/api/annotations找不到 | 确保third_party目录包含所需proto |
| proto中HTTP注解不生效 | 检查是否import了annotations.proto |

---

## 八、练习题

### 🟢 入门题
1. 编写一个`User`消息类型，包含id(int64)、name(string)、email(string)、age(int32)字段。

### 🟡 进阶题
2. 定义一个完整的`UserService`，包含CreateUser、GetUser、UpdateUser、DeleteUser、ListUsers五个RPC方法，并为每个方法添加HTTP注解。

### 🔴 挑战题
3. 定义一个电商订单系统的proto，包含Order（订单）、Product（商品）、User（用户）三个message，以及OrderService（下单、查询、取消、支付）的完整接口定义。使用nested message、enum、oneof等高级特性。

---

## 九、知识点总结

```
Protobuf与代码生成
├── Proto语法
│   ├── syntax = "proto3"
│   ├── message（消息定义）
│   ├── service/rpc（服务定义）
│   ├── import（导入）
│   ├── option go_package
│   └── 高级：enum/oneof/map/repeated/nested
├── HTTP注解
│   ├── get/post/put/delete
│   ├── body: "*"（请求体映射）
│   ├── 路径参数 {name}
│   └── 需import google/api/annotations.proto
├── 代码生成
│   ├── protoc编译器 + Go插件
│   ├── .pb.go（消息类型）
│   ├── _http.pb.go（HTTP路由）
│   ├── _grpc.pb.go（gRPC存根）
│   └── Makefile / kratos CLI
└── 组织规范
    ├── api/<service>/<version>/<name>.proto
    ├── third_party/ 放第三方proto
    ├── 生成文件不入git（或入git，团队约定）
    └── field number不复用
```

---

## 十、举一反三

| 场景 | 思路 | 关键技术 |
|------|------|---------|
| RESTful API设计 | 用HTTP注解映射CRUD到RPC方法 | google.api.http |
| 版本管理 | 按v1/v2组织proto目录 | package versioning |
| 前后端协作 | 共享proto文件，各自生成代码 | protoc多语言支持 |
| 接口文档 | proto本身就是文档，或用protoc-gen-doc生成 | API文档生成 |
| 接口校验 | 使用protoc-gen-validate添加校验规则 | validation rules |

---

## 十一、参考资料

| 资源 | 链接 |
|------|------|
| Protobuf官方文档 | https://protobuf.dev/programming-guides/proto3/ |
| Google HTTP Annotations | https://github.com/googleapis/googleapis/blob/master/google/api/annotations.proto |
| Kratos Proto文档 | https://go-kratos.dev/docs/component/proto |
| protoc-gen-validate | https://github.com/bufbuild/protoc-gen-validate |
| Kratos示例项目 | https://github.com/go-kratos/examples |

---

## 十二、代码演进

### v1：基本消息定义
```protobuf
message HelloRequest {
    string name = 1;
}
message HelloReply {
    string message = 1;
}
```

### v2：添加HTTP注解
```protobuf
service GreeterService {
    rpc SayHello (HelloRequest) returns (HelloReply) {
        option (google.api.http) = {
            get: "/v1/greetings/{name}"
        };
    }
}
```

### v3：完整CRUD + 校验
```protobuf
import "validate/validate.proto";

message CreateGreetingRequest {
    string name = 1 [(validate.rules).string = {min_len: 1, max_len: 100}];
    string message = 2 [(validate.rules).string.min_len = 1];
}

service GreeterService {
    rpc CreateGreeting (CreateGreetingRequest) returns (HelloReply) {
        option (google.api.http) = { post: "/v1/greetings" body: "*" };
    }
    rpc ListGreetings (ListGreetingRequest) returns (HelloList) {
        option (google.api.http) = { get: "/v1/greetings" };
    }
}
```

---

**上一篇：** [002-项目结构与分层架构](/posts/002-kratos-project-structure)
**下一篇：** [004-第一个Kratos服务Hello World](/posts/004-kratos-helloworld)
