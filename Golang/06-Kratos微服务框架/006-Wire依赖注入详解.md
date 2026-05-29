---
title: "006-Wire依赖注入详解"
slug: "006-kratos-wire"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:23:43.796+08:00"
updated_at: "2026-04-29T10:02:45.33+08:00"
reading_time: 30
tags: []
---

# 006-Wire依赖注入详解

> 难度：⭐⭐⭐⭐（高级）
> 前置知识：Go接口、依赖注入概念、Kratos项目结构

## 一、概念讲解

### 什么是依赖注入？

依赖注入（Dependency Injection, DI）是一种设计模式，核心思想是：**不自己创建依赖，由外部注入依赖**。

```go
// ❌ 不用DI：自己创建依赖
func NewOrderService() *OrderService {
    db := database.Connect()       // 硬编码
    repo := data.NewOrderRepo(db)  // 硬编码
    return &OrderService{repo: repo}
}

// ✅ 用DI：依赖从外部传入
func NewOrderService(repo biz.OrderRepo) *OrderService {
    return &OrderService{repo: repo}
}
```

### 为什么选择Wire？

| 特性 | Wire | dig/fx |
|------|------|--------|
| 注入时机 | **编译时** | 运行时 |
| 错误发现 | 编译期报错 | 运行时panic |
| 性能 | 零运行时开销 | 反射开销 |
| 调试性 | 生成可读Go代码 | 调用栈难追踪 |
| 适合场景 | 微服务、高性能 | 快速原型 |

Wire是**编译时依赖注入**工具，通过代码生成在编译期完成依赖图构建，零运行时开销。

## 二、脑图

```
Wire 依赖注入
├── 核心概念
│   ├── Provider   → 提供者，创建具体对象
│   ├── Bind       → 接口绑定，接口→实现映射
│   ├── Set        → Provider集合，模块化组织
│   └── Injector   → 注入器，组装完整依赖图
├── 工作流程
│   ├── 1. 编写 wire.go (build tag)
│   ├── 2. 定义 Provider Set
│   ├── 3. 编写 Injector 函数签名
│   ├── 4. wire generate 生成 wire_gen.go
│   └── 5. go build 编译验证
├── Wire vs 其他
│   ├── vs dig   → 编译时 vs 运行时
│   ├── vs fx    → 轻量 vs 重型框架
│   └── vs 手动  → 自动生成 vs 手动接线
└── 大型项目组织
    ├── 按层分 Set (data/service/biz)
    ├── 按模块分 Set (order/user/product)
    └── NewSet 嵌套组合
```

## 三、完整代码示例

### 3.1 项目结构

```
order-service/
├── cmd/
│   └── order/
│       ├── main.go
│       ├── wire.go        # Wire 定义文件
│       └── wire_gen.go    # Wire 生成文件
├── internal/
│   ├── conf/
│   │   └── conf.proto
│   ├── data/
│   │   ├── data.go        # Provider: NewData
│   │   └── order.go       # Provider: NewOrderRepo
│   ├── biz/
│   │   ├── biz.go         # Provider: NewOrderUsecase
│   │   └── order.go       # OrderUsecase + Repo interface
│   └── service/
│       ├── service.go     # Provider: NewOrderService
│       └── order.go
├── server/
│   ├── server.go          # Provider: NewServer
│   ├── http.go
│   └── grpc.go
└── third_party/
```

### 3.2 各层 Provider 定义

```go
// internal/data/data.go
package data

import (
    "github.com/go-kratos/kratos/v2/log"
    "entgo.io/ent/dialect/sql"
    _ "github.com/go-sql-driver/mysql"
)

// Data holds the database connection and logger.
type Data struct {
    db  *sql.Client
    log *log.Helper
}

// NewData creates a new Data instance (Provider).
func NewData(c *conf.Data, logger log.Logger) (*Data, func(), error) {
    db, err := sql.Open("mysql", c.GetDatabase().GetSource())
    if err != nil {
        return nil, nil, err
    }
    cleanup := func() {
        log.NewHelper(logger).Info("closing database connection")
        db.Close()
    }
    return &Data{db: db, log: log.NewHelper(logger)}, cleanup, nil
}

// ProviderSet is data layer providers.
var ProviderSet = wire.NewSet(NewData, NewOrderRepo)
```

```go
// internal/data/order.go
package data

import (
    "context"
    "myapp/internal/biz"
)

type orderRepo struct {
    data *Data
}

// NewOrderRepo creates a new order repository (Provider).
func NewOrderRepo(data *Data, logger log.Logger) biz.OrderRepo {
    return &orderRepo{data: data, log: log.NewHelper(logger)}
}

func (r *orderRepo) Create(ctx context.Context, order *biz.Order) (*biz.Order, error) {
    // Database insert logic here
    return order, nil
}

func (r *orderRepo) GetByID(ctx context.Context, id int64) (*biz.Order, error) {
    // Database query logic here
    return &biz.Order{ID: id}, nil
}
```

```go
// internal/biz/biz.go
package biz

import "github.com/google/wire"

// ProviderSet is biz layer providers.
var ProviderSet = wire.NewSet(NewOrderUsecase)
```

```go
// internal/biz/order.go
package biz

import (
    "context"
    "github.com/go-kratos/kratos/v2/log"
)

// Order is a domain model.
type Order struct {
    ID     int64
    UserID int64
    Status string
    Amount float64
}

// OrderRepo defines the repository interface (owned by biz layer).
type OrderRepo interface {
    Create(ctx context.Context, order *Order) (*Order, error)
    GetByID(ctx context.Context, id int64) (*Order, error)
    Update(ctx context.Context, order *Order) (*Order, error)
    List(ctx context.Context, page, size int) ([]*Order, error)
}

// OrderUsecase handles business logic for orders.
type OrderUsecase struct {
    repo OrderRepo
    log  *log.Helper
}

// NewOrderUsecase creates a new OrderUsecase (Provider).
func NewOrderUsecase(repo OrderRepo, logger log.Logger) *OrderUsecase {
    return &OrderUsecase{repo: repo, log: log.NewHelper(logger)}
}

func (uc *OrderUsecase) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
    uc.log.WithContext(ctx).Infof("Creating order for user %d", order.UserID)
    return uc.repo.Create(ctx, order)
}
```

```go
// internal/service/service.go
package service

import "github.com/google/wire"

// ProviderSet is service layer providers.
var ProviderSet = wire.NewSet(NewOrderService)
```

```go
// internal/service/order.go
package service

import (
    "context"
    pb "myapp/api/order/v1"
    "myapp/internal/biz"
)

type OrderService struct {
    pb.UnimplementedOrderServiceServer
    uc *biz.OrderUsecase
}

// NewOrderService creates a new OrderService (Provider).
func NewOrderService(uc *biz.OrderUsecase) *OrderService {
    return &OrderService{uc: uc}
}

func (s *OrderService) CreateOrder(ctx context.Context, req *pb.CreateOrderRequest) (*pb.CreateOrderReply, error) {
    order := &biz.Order{
        UserID: req.GetUserId(),
        Amount: req.GetAmount(),
        Status: "pending",
    }
    created, err := s.uc.CreateOrder(ctx, order)
    if err != nil {
        return nil, err
    }
    return &pb.CreateOrderReply{Id: created.ID}, nil
}
```

### 3.3 Wire 注入器定义

```go
// cmd/order/wire.go
//go:build wireinject

package main

import (
    "myapp/internal/biz"
    "myapp/internal/conf"
    "myapp/internal/data"
    "myapp/internal/service"
    "myapp/server"
    "github.com/google/wire"
    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
)

// initApp wires up the entire application.
// wire.Build will be replaced by generated code.
func initApp(*conf.Data, *conf.Server, log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        data.ProviderSet,
        biz.ProviderSet,
        service.ProviderSet,
        server.ProviderSet,
    ))
}
```

### 3.4 生成的 wire_gen.go（示例）

```go
// cmd/order/wire_gen.go
// Code generated by Wire. DO NOT EDIT.

//go:generate go run -mod=mod github.com/google/wire/cmd/wire
//go:build !wireinject
// +build !wireinject

package main

import (
    "myapp/internal/biz"
    "myapp/internal/conf"
    "myapp/internal/data"
    "myapp/internal/service"
    "myapp/server"
    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
)

func initApp(dataConf *conf.Data, serverConf *conf.Server, logger log.Logger) (*kratos.App, func(), error) {
    // Wire automatically resolves the dependency graph:
    // Data → OrderRepo → OrderUsecase → OrderService → Server → App
    dataData, cleanup, err := data.NewData(dataConf, logger)
    if err != nil {
        return nil, nil, err
    }
    orderRepo := data.NewOrderRepo(dataData, logger)
    orderUsecase := biz.NewOrderUsecase(orderRepo, logger)
    orderService := service.NewOrderService(orderUsecase)
    app, cleanup2, err := server.NewApp(serverConf, orderService, logger)
    if err != nil {
        cleanup()
        return nil, nil, err
    }
    return app, func() {
        cleanup2()
        cleanup()
    }, nil
}
```

### 3.5 main.go

```go
// cmd/order/main.go
package main

import (
    "flag"
    "os"
    "myapp/internal/conf"
    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/kratos/v2/transport/http"
)

var (
    flagconf string
)

func init() {
    flag.StringVar(&flagconf, "conf", "../../configs/config.yaml", "config path")
}

func main() {
    flag.Parse()
    logger := log.With(log.NewStdLogger(os.Stdout))
    c := conf.MustLoadConfig(flagconf)

    // initApp is generated by Wire
    app, cleanup, err := initApp(c.Data, c.Server, logger)
    if err != nil {
        panic(err)
    }
    defer cleanup()

    if err := app.Run(); err != nil {
        panic(err)
    }
}
```

## 四、执行预览

```bash
# 1. 安装 wire 工具
go install github.com/google/wire/cmd/wire@latest

# 2. 在 cmd/order 目录执行生成
cd cmd/order && wire

# 输出：
# wire: [cmd/order] wrote wire_gen.go

# 3. 编译运行
go build -o ./order . && ./order -conf ../../configs/config.yaml

# 输出：
# INFO msg=server started http=:8080 grpc=:9000
```

## 五、注意事项

| 事项 | 说明 | 影响 |
|------|------|------|
| wire.go 必须有 build tag | `//go:build wireinject` | 否则 wire 命令无法识别 |
| wire_gen.go 不要手动编辑 | 每次wire会覆盖 | 手动修改会丢失 |
| Provider 签名灵活性 | 可返回 (T, error) 或 (T, func(), error) | cleanup函数需要正确处理 |
| 接口绑定 | 需要显式 wire.Bind | 否则Wire无法将接口映射到实现 |
| 循环依赖 | Wire无法处理循环依赖 | 编译报错，需重新设计 |
| 文件命名 | wire.go 和 wire_gen.go 同目录 | 这是约定 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 手动编辑 wire_gen.go | 修改 wire.go 后重新 wire generate |
| Provider 不导出（小写开头） | Provider 函数必须导出（大写开头） |
| 接口没有 wire.Bind | 在 ProviderSet 中加 `wire.Bind(new(Interface), new(Impl))` |
| wire.go 缺少 build tag | 确保 `//go:build wireinject` 在文件顶部 |
| 两个 Provider 返回相同类型 | 用 `wire.FieldsOf` 或 `wire.Value` 区分 |
| 忘记 import wire 包 | wire.go 需要 `import "github.com/google/wire"` |
| cleanup 函数不调用 | 使用 wire.Build 中的 cleanup 确保资源释放 |

## 七、练习题

### 🟢 初级
1. 编写一个简单的 Provider，创建 `*log.Helper`，并注入到 Usecase 中。
2. 创建一个只包含两个 Provider 的 `wire.NewSet`，观察生成的代码。

### 🟡 中级
3. 在 Kratos 项目中新增一个 `UserRepo` 接口及其实现，修改 Wire 配置完成注入。
4. 使用 `wire.Bind` 将接口绑定到结构体指针，并处理接口注入。

### 🔴 高级
5. 设计一个多数据源场景（MySQL + Redis），用 Wire 管理两个 Data 实例的注入。
6. 重构一个现有的手动依赖注入项目为 Wire 方式，确保所有 cleanup 函数正确链式调用。

## 八、知识点总结

```
Wire 依赖注入
├── Provider（提供者）
│   ├── 函数签名：func(...) (*T, func(), error)
│   ├── 返回值：目标对象 + cleanup + error
│   └── 规则：必须导出、类型唯一
├── wire.Bind（接口绑定）
│   ├── wire.Bind(new(Interface), new(Impl))
│   └── 解决接口→实现的映射
├── wire.NewSet（集合）
│   ├── 组织相关 Provider
│   └── 支持嵌套 Set
├── wire.Build（构建）
│   ├── 在 Injector 函数中使用
│   └── 自动解析依赖图
├── wire.Injector（注入器）
│   ├── 带 wireinject build tag
│   └── 函数体只有 panic(wire.Build(...))
└── 生成流程
    ├── wire generate → wire_gen.go
    └── 编译时验证所有依赖
```

## 九、举一反三

| 场景 | Wire 方案 | 关键点 |
|------|----------|--------|
| 多数据库（MySQL+PgSQL） | 两个 NewData Provider + wire.FieldsOf | 用 FieldsOf 区分不同 DB |
| 外部 API Client | NewAPIClient Provider | 可加 wire.Value 注入配置 |
| 插件化架构 | 按模块分 ProviderSet | 运行时选择加载哪个 Set |
| 测试替换 | 替换 ProviderSet 中的 Provider | 测试用 mock Provider |
| 条件注入 | 多个 Injector 函数 | 不同环境用不同注入器 |

## 十、参考资料

- [Wire 官方文档](https://github.com/google/wire)
- [Kratos 官方 Wire 指南](https://go-kratos.dev/docs/getting-started/usage)
- [Go 依赖注入最佳实践](https://dagger.dev/)
- [Wire vs dig 对比分析](https://engage.software/blog/wire-vs-dig)

## 十一、代码演进

### v1: 手动依赖注入

```go
// cmd/order/main.go - everything manual
func main() {
    db := database.Connect(config)
    repo := data.NewOrderRepo(db, logger)
    uc := biz.NewOrderUsecase(repo, logger)
    svc := service.NewOrderService(uc)
    srv := server.New(config, svc, logger)
    srv.Run()
}
```

**问题**：依赖多时手动接线繁琐，容易遗漏 cleanup。

### v2: 引入 Wire（基础版）

```go
// cmd/order/wire.go
func initApp(c *conf.Data, logger log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        data.NewData,
        data.NewOrderRepo,
        biz.NewOrderUsecase,
        service.NewOrderService,
        server.NewApp,
    ))
}
```

**改进**：自动解析依赖图，编译时检查。**但**所有 Provider 平铺。

### v3: Wire 模块化组织（生产级）

```go
// internal/data/data.go
var ProviderSet = wire.NewSet(NewData, NewOrderRepo, wire.Bind(new(biz.OrderRepo), new(*orderRepo)))

// internal/biz/biz.go
var ProviderSet = wire.NewSet(NewOrderUsecase)

// cmd/order/wire.go
func initApp(c *conf.Data, s *conf.Server, logger log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        data.ProviderSet,
        biz.ProviderSet,
        service.ProviderSet,
        server.ProviderSet,
        newApp,
    ))
}
```

**最终形态**：按层/按模块组织 ProviderSet，接口绑定内聚，大型项目清晰可维护。
