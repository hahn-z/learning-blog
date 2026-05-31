---
title: "001-Kratos框架简介与环境搭建"
slug: "001-kratos-intro"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:06:52.432+08:00"
updated_at: "2026-04-29T10:02:45.269+08:00"
reading_time: 18
tags: []
---


# 001-Kratos框架简介与环境搭建

> **难度：⭐⭐（入门级）**
>
> 适合有Go基础、刚接触微服务的开发者。读完本文，你将理解Kratos的定位，并搭好开发环境。

---

## 一、概念讲解：什么是Kratos？

### 1.1 Kratos是什么？

**Kratos** 是 bilibili（哔哩哔哩）开源的 **Go 微服务框架**，基于 **DDD（领域驱动设计）** 理念构建。它不是另一个Web框架，而是一套完整的微服务工具链：

| 特性 | 说明 |
|------|------|
| 语言 | Go（高性能、编译型、天然并发） |
| 定位 | 微服务框架（非Web框架） |
| 设计理念 | DDD分层架构 |
| 维护方 | bilibili开源团队 |
| 协议支持 | HTTP + gRPC 双协议 |
| 生态 | Protobuf代码生成、服务发现、链路追踪、配置中心 |

### 1.2 为什么选择Kratos？

在Go微服务框架生态中，主流选择有三个：

| 维度 | Kratos | go-zero | Go Kit |
|------|--------|---------|--------|
| 设计理念 | DDD分层 | 工具驱动 | 工具包集合 |
| 学习曲线 | 中等 | 较低 | 较高 |
| 代码生成 | ✅ 完善 | ✅ 完善 | ❌ 手动组装 |
| gRPC支持 | ✅ 原生 | ✅ 原生 | ⚠️ 需手动 |
| HTTP+gRPC双协议 | ✅ 同时生成 | ✅ | ⚠️ 手动 |
| DDD架构 | ✅ 内置 | ❌ 自由组织 | ❌ 自由组织 |
| 适合场景 | 中大型项目、团队协作 | 快速开发、中小项目 | 高度定制需求 |

**选型建议：**
- 追求标准化DDD架构 → **Kratos**
- 追求极速开发 → **go-zero**
- 需要极致灵活 → **Go Kit**

### 1.3 Kratos设计理念

Kratos 的核心设计理念来自 **DDD（领域驱动设计）**：

```
┌─────────────────────────────────────┐
│            Service Layer            │  ← 对外暴露服务
├─────────────────────────────────────┤
│             Biz Layer               │  ← 业务逻辑（核心）
├─────────────────────────────────────┤
│            Data Layer               │  ← 数据访问
├─────────────────────────────────────┤
│             API Layer               │  ← 接口定义（Proto）
└─────────────────────────────────────┘
```

关键原则：
1. **依赖倒置**：高层不依赖底层，都依赖抽象
2. **关注点分离**：每层只做自己的事
3. **Proto First**：先定义接口，再生成代码

---

## 二、脑图（ASCII）

```
                    Kratos框架
                        │
        ┌───────────────┼───────────────┐
        │               │               │
    定位与理念      核心组件         工具链
        │               │               │
   ┌────┴────┐    ┌─────┼─────┐    ┌────┴────┐
   │         │    │     │     │    │         │
  DDD    Proto   HTTP  gRPC  Config  kratos  protoc
  分层   First  Server Server 管理    CLI    编译器
        │
   ┌────┼────┐
   │    │    │
  Biz  Data Service
  层   层    层
```

---

## 三、环境搭建

### 3.1 前置条件

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Go | ≥ 1.21 | 编译运行 |
| protoc | ≥ 3.x | Protobuf编译 |
| kratos CLI | latest | 项目脚手架 |
| Git | any | 版本管理 |

### 3.2 安装Go

```bash
# macOS
brew install go

# Linux (推荐使用官方tarball)
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz

# 验证
go version
# go version go1.22.0 linux/amd64
```

### 3.3 安装protoc编译器

```bash
# macOS
brew install protobuf

# Linux
# 从 GitHub releases 下载对应平台
wget https://github.com/protocolbuffers/protobuf/releases/download/v25.3/protoc-25.3-linux-x86_64.zip
unzip protoc-25.3-linux-x86_64.zip -d $HOME/.local
export PATH="$PATH:$HOME/.local/bin"

# 验证
protoc --version
# libprotoc 25.3
```

### 3.4 安装protoc Go插件

```bash
# Install protoc-gen-go and protoc-gen-go-grpc
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Install kratos protoc plugins
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-errors/v2@latest
go install github.com/go-kratos/kratos/cmd/protoc-gen-validate/@latest

# Ensure $GOPATH/bin is in PATH
export PATH="$PATH:$(go env GOPATH)/bin"
```

### 3.5 安装kratos CLI

```bash
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest

# 验证
kratos --version
```

---

## 四、完整代码：Hello World项目

### 4.1 创建项目

```bash
# Create a new kratos project
kratos new helloworld

cd helloworld
```

### 4.2 项目结构概览

```
helloworld/
├── api/                  # Proto files and generated code
│   └── helloworld/
│       └── v1/
│           ├── greeter.proto
│           ├── greeter.pb.go
│           ├── greeter_http.pb.go
│           └── greeter_grpc.pb.go
├── cmd/                  # Entry points
│   └── helloworld/
│       ├── main.go
│       └── wire/
│           ├── wire.go
│           └── wire_gen.go
├── configs/              # Config files
│   └── config.yaml
├── internal/             # Business logic
│   ├── conf/
│   │   └── conf.proto
│   ├── server/
│   │   ├── http.go
│   │   └── grpc.go
│   ├── service/
│   │   └── greeter.go
│   ├── biz/
│   │   └── greeter.go
│   └── data/
│       └── data.go
├── third_party/          # Third-party proto deps
├── go.mod
└── go.sum
```

### 4.3 运行项目

```bash
# Generate proto code
make api

# Download dependencies
go mod tidy

# Run the service
kratos run
```

### 4.4 测试服务

```bash
# Test HTTP endpoint
curl http://localhost:8000/helloworld/test

# Test gRPC endpoint (using grpcurl)
grpcurl -plaintext -d '{"name":"test"}' localhost:9000 helloworld.v1.Greeter/SayHello
```

---

## 五、执行预览

```
$ kratos run
INFO msg=config loaded format: yaml
INFO msg=service listening on [::]:8000  ← HTTP
INFO msg=service listening on [::]:9000  ← gRPC

$ curl http://localhost:8000/helloworld/test
{"message":"Hello test"}

$ grpcurl -plaintext -d '{"name":"Kratos"}' localhost:9000 helloworld.v1.Greeter/SayHello
{
  "message": "Hello Kratos"
}
```

---

## 六、注意事项

| 注意点 | 说明 | 严重度 |
|--------|------|--------|
| Go版本 | 必须≥1.21，否则编译报错 | 🔴 高 |
| PATH配置 | GOPATH/bin必须加入PATH | 🔴 高 |
| protoc版本 | 尽量用最新稳定版，避免兼容问题 | 🟡 中 |
| 依赖下载 | 国内建议设置GOPROXY加速 | 🟡 中 |
| Wire工具 | 项目使用Wire依赖注入，需理解其基本用法 | 🟡 中 |

---

## 七、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 直接`go run main.go`运行 | 使用`kratos run`，它会加载配置文件 |
| 忘记执行`make api`生成代码 | 先生成proto代码再编译 |
| protoc插件没装全导致生成失败 | 按3.4节装齐所有插件 |
| 用Goland直接运行cmd目录 | 确保工作目录在项目根目录 |
| 忽略wire_gen.go的重新生成 | 修改wire依赖后执行`make generate` |

---

## 八、练习题

### 🟢 入门题
1. 使用`kratos new`创建一个名为`myapp`的项目，成功运行并测试HTTP接口。

### 🟡 进阶题
2. 修改默认的`SayHello`方法，让它返回 `"你好, {name}! 欢迎使用Kratos!"`。

### 🔴 挑战题
3. 在项目中新增一个`/health`接口，返回服务状态信息（版本号、运行时间等）。

---

## 九、知识点总结

```
Kratos框架入门
├── 框架定位
│   ├── bilibili开源Go微服务框架
│   ├── 基于DDD设计理念
│   └── HTTP+gRPC双协议支持
├── 框架对比
│   ├── vs go-zero：DDD更规范 vs 开发更快
│   ├── vs Go Kit：开箱即用 vs 高度灵活
│   └── 选型依据：团队规模和项目复杂度
├── 环境搭建
│   ├── Go ≥ 1.21
│   ├── protoc + Go插件
│   ├── kratos CLI
│   └── GOPATH/bin加入PATH
└── 项目创建
    ├── kratos new <name>
    ├── make api（生成代码）
    └── kratos run（运行服务）
```

---

## 十、举一反三

| 场景 | 思路 | 关键技术 |
|------|------|---------|
| 想快速评估Kratos是否适合 | 用`kratos new`创建demo，测试HTTP/gRPC双协议 | kratos CLI |
| 团队已有proto文件 | 将proto放入`api/`目录，用`make api`重新生成 | protoc代码生成 |
| 需要自定义项目模板 | fork官方模板，修改后用`kratos new -t <template>` | 模板定制 |
| 从其他框架迁移到Kratos | 先定义proto接口，逐步迁移业务逻辑到DDD分层 | Proto First |

---

## 十一、参考资料

| 资源 | 链接 |
|------|------|
| Kratos官方文档 | https://go-kratos.dev/ |
| Kratos GitHub | https://github.com/go-kratos/kratos |
| Protobuf官方文档 | https://protobuf.dev/ |
| Go微服务系列教程 | https://go-kratos.dev/docs/getting-started/start |
| DDD领域驱动设计 | 《实现领域驱动设计》Vaughn Vernon |

---

## 十二、代码演进

### v1：最小可运行版本
```bash
kratos new helloworld
cd helloworld && kratos run
# 使用默认生成的SayHello
```

### v2：自定义响应
```go
// internal/service/greeter.go
func (s *GreeterService) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloReply, error) {
    // Add custom greeting logic
    return &pb.HelloReply{
        Message: fmt.Sprintf("你好, %s! 欢迎使用Kratos!", req.Name),
    }, nil
}
```

### v3：多环境配置
```yaml
# configs/config.yaml
server:
  http:
    addr: 0.0.0.0:8000
  grpc:
    addr: 0.0.0.0:9000

# configs/config-prod.yaml (override for production)
server:
  http:
    addr: 0.0.0.0:80
  grpc:
    addr: 0.0.0.0:9090
```

运行时指定配置：
```bash
kratos run -conf configs/config-prod.yaml
```

---

**下一篇：** [002-项目结构与分层架构](/posts/002-kratos-project-structure)
