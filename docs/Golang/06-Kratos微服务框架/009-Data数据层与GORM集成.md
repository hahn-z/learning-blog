---
title: "009-Data数据层与GORM集成"
slug: "009-kratos-data-layer"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:31:37.264+08:00"
updated_at: "2026-04-29T10:02:45.358+08:00"
reading_time: 38
tags: []
---

# 009-Data数据层与GORM集成

> 难度：⭐⭐⭐⭐（高级）
> 前置知识：GORM基础、数据库连接池、Redis缓存、Kratos biz层

## 一、概念讲解

### data 层的职责

data 层是 Kratos 项目中**数据访问**的唯一层，负责：

1. **实现 biz 层定义的 Repository 接口**
2. **管理数据库连接和生命周期**
3. **处理数据转换**：DO（Data Object）↔ BO（Business Object）
4. **管理缓存策略**
5. **管理数据库迁移**

data 层**不应该**包含任何业务逻辑，它只是数据的"搬运工"。

### DO 与 BO 的区别

| 概念 | 全称 | 所在层 | 特点 |
|------|------|--------|------|
| BO | Business Object | biz 层 | 纯业务模型，无 ORM 标签 |
| DO | Data Object | data 层 | 数据库映射模型，有 ORM 标签 |

## 二、脑图

```
Data 数据层
├── 核心职责
│   ├── 实现 Repository 接口
│   ├── 管理数据库连接
│   ├── DO ↔ BO 转换
│   └── 缓存管理
├── GORM 集成
│   ├── 连接配置
│   ├── 连接池参数
│   ├── 日志集成
│   └── GORM 插件
├── Repository 实现
│   ├── CRUD 操作
│   ├── 复杂查询构建
│   ├── 分页封装
│   └── 软删除
├── 事务管理
│   ├── Transaction 接口实现
│   ├── Context 传递 *gorm.DB
│   └── 嵌套事务（SavePoint）
├── 缓存策略
│   ├── Cache-Aside 模式
│   ├── Redis 集成
│   ├── 缓存 Key 设计
│   └── 缓存失效策略
├── 数据转换
│   ├── DO → BO (toEntity)
│   ├── BO → DO (toModel)
│   └── 转换函数集中管理
└── 迁移管理
    ├── AutoMigrate
    ├── golang-migrate
    └── 版本化迁移文件
```

## 三、完整代码示例

### 3.1 数据对象（DO）

```go
// internal/data/model/order.go
package model

import (
    "time"
    "gorm.io/gorm"
)

// OrderDO is the database model for orders (Data Object)
type OrderDO struct {
    ID              int64          `gorm:"primaryKey;autoIncrement"`
    UserID          int64          `gorm:"index;not null"`
    Status          string         `gorm:"type:varchar(20);not null;default:'pending'"`
    TotalAmount     float64        `gorm:"type:decimal(10,2);not null"`
    Remark          string         `gorm:"type:varchar(500)"`
    ReceiverName    string         `gorm:"type:varchar(50);not null"`
    ReceiverPhone   string         `gorm:"type:varchar(20);not null"`
    ReceiverAddress string         `gorm:"type:varchar(200);not null"`
    PaidAt          *time.Time     `gorm:"index"`
    ShippedAt       *time.Time
    DeletedAt       gorm.DeletedAt `gorm:"index"`
    CreatedAt       time.Time
    UpdatedAt       time.Time
}

// OrderItemDO is the database model for order items
type OrderItemDO struct {
    ID          int64   `gorm:"primaryKey;autoIncrement"`
    OrderID     int64   `gorm:"index;not null"`
    ProductID   int64   `gorm:"not null"`
    ProductName string  `gorm:"type:varchar(100);not null"`
    Quantity    int32   `gorm:"not null"`
    UnitPrice   float64 `gorm:"type:decimal(10,2);not null"`
}

// TableName overrides the table name
func (OrderDO) TableName() string {
    return "orders"
}

func (OrderItemDO) TableName() string {
    return "order_items"
}
```

### 3.2 Data 初始化（GORM + Redis）

```go
// internal/data/data.go
package data

import (
    "context"
    "fmt"
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "github.com/redis/go-redis/v9"
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
    "gorm.io/gorm/logger"

    "myapp/internal/biz"
    "myapp/internal/conf"
    "myapp/internal/data/model"

    "github.com/google/wire"
)

// ProviderSet is data layer providers
var ProviderSet = wire.NewSet(
    NewData,
    NewTransaction,
    NewOrderRepo,
    wire.Bind(new(biz.OrderRepo), new(*orderRepo)),
    wire.Bind(new(biz.Transaction), new(*contextTransaction)),
)

// Data holds database and cache connections
type Data struct {
    db  *gorm.DB
    rdb *redis.Client
    log *log.Helper
}

// NewData creates a new Data instance with GORM and Redis
func NewData(c *conf.Data, logger log.Logger) (*Data, func(), error) {
    helper := log.NewHelper(logger)

    // Initialize GORM with MySQL
    gormLogger := logger.NewGormLogger(logger)
    db, err := gorm.Open(mysql.Open(c.Database.Source), &gorm.Config{
        Logger: gormLogger,
    })
    if err != nil {
        return nil, nil, fmt.Errorf("failed to connect database: %w", err)
    }

    // Configure connection pool
    sqlDB, _ := db.DB()
    sqlDB.SetMaxIdleConns(int(c.Database.GetMaxIdleConns()))   // default: 10
    sqlDB.SetMaxOpenConns(int(c.Database.GetMaxOpenConns()))   // default: 100
    sqlDB.SetConnMaxLifetime(time.Duration(c.Database.GetConnMaxLifetime())) // default: 1h

    // Auto-migrate (dev only, use migrations in production)
    if err := db.AutoMigrate(&model.OrderDO{}, &model.OrderItemDO{}); err != nil {
        return nil, nil, fmt.Errorf("failed to migrate: %w", err)
    }

    // Initialize Redis
    rdb := redis.NewClient(&redis.Options{
        Addr:     c.Redis.GetAddr(),
        Password: c.Redis.GetPassword(),
        DB:       int(c.Redis.GetDb()),
    })

    // Verify Redis connection
    if err := rdb.Ping(context.Background()).Err(); err != nil {
        return nil, nil, fmt.Errorf("failed to connect redis: %w", err)
    }

    cleanup := func() {
        helper.Info("closing data connections")
        sqlDB.Close()
        rdb.Close()
    }

    return &Data{db: db, rdb: rdb, log: helper}, cleanup, nil
}

// DB returns the gorm.DB instance, respecting transaction context
func (d *Data) DB(ctx context.Context) *gorm.DB {
    tx, ok := ctx.Value(txKey{}).(*gorm.DB)
    if ok {
        return tx
    }
    return d.db.WithContext(ctx)
}
```

### 3.3 事务管理

```go
// internal/data/transaction.go
package data

import (
    "context"

    "gorm.io/gorm"
)

type txKey struct{}

// contextTransaction implements biz.Transaction
type contextTransaction struct {
    data *Data
}

// NewTransaction creates a new transaction manager
func NewTransaction(data *Data) *contextTransaction {
    return &contextTransaction{data: data}
}

// ExecTx executes fn within a database transaction
func (t *contextTransaction) ExecTx(ctx context.Context, fn func(ctx context.Context) error) error {
    return t.data.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        // Inject transaction DB into context
        txCtx := context.WithValue(ctx, txKey{}, tx)
        return fn(txCtx)
    })
}
```

### 3.4 Repository 实现

```go
// internal/data/order.go
package data

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/go-kratos/kratos/v2/log"
    "gorm.io/gorm"

    "myapp/internal/biz"
    "myapp/internal/data/model"
)

type orderRepo struct {
    data *Data
    log  *log.Helper
}

// NewOrderRepo creates a new order repository
func NewOrderRepo(data *Data, logger log.Logger) *orderRepo {
    return &orderRepo{data: data, log: log.NewHelper(logger)}
}

// Save creates or updates an order
func (r *orderRepo) Save(ctx context.Context, order *biz.Order) (*biz.Order, error) {
    orderDO := toOrderDO(order)

    // Create order with items in a single transaction (caller manages tx)
    if err := r.data.DB(ctx).Create(orderDO).Error; err != nil {
        return nil, fmt.Errorf("save order failed: %w", err)
    }

    // Create order items
    itemDOs := toItemDOs(order.Items, orderDO.ID)
    if err := r.data.DB(ctx).Create(&itemDOs).Error; err != nil {
        return nil, fmt.Errorf("save order items failed: %w", err)
    }

    // Cache the new order
    r.cacheOrder(ctx, orderDO)

    return toOrderBO(orderDO, itemDOs), nil
}

// FindByID retrieves an order by ID with cache-aside pattern
func (r *orderRepo) FindByID(ctx context.Context, id int64) (*biz.Order, error) {
    // Step 1: Try cache first
    cached, err := r.getCachedOrder(ctx, id)
    if err == nil && cached != nil {
        return cached, nil
    }

    // Step 2: Query database
    var orderDO model.OrderDO
    err = r.data.DB(ctx).First(&orderDO, id).Error
    if err != nil {
        if err == gorm.ErrRecordNotFound {
            return nil, nil
        }
        return nil, fmt.Errorf("find order failed: %w", err)
    }

    // Query order items
    var itemDOs []model.OrderItemDO
    if err := r.data.DB(ctx).Where("order_id = ?", id).Find(&itemDOs).Error; err != nil {
        return nil, fmt.Errorf("find order items failed: %w", err)
    }

    // Step 3: Cache the result
    result := toOrderBO(&orderDO, itemDOs)
    r.cacheOrder(ctx, &orderDO)

    return result, nil
}

// FindByUser retrieves orders by user ID with pagination
func (r *orderRepo) FindByUser(ctx context.Context, userID int64, page, size int) ([]*biz.Order, int64, error) {
    var orders []model.OrderDO
    var total int64

    db := r.data.DB(ctx).Model(&model.OrderDO{}).Where("user_id = ?", userID)

    // Count total
    if err := db.Count(&total).Error; err != nil {
        return nil, 0, fmt.Errorf("count orders failed: %w", err)
    }

    // Paginated query
    offset := (page - 1) * size
    if err := db.Order("created_at DESC").Offset(offset).Limit(size).Find(&orders).Error; err != nil {
        return nil, 0, fmt.Errorf("list orders failed: %w", err)
    }

    // Convert to BO
    result := make([]*biz.Order, 0, len(orders))
    for _, o := range orders {
        result = append(result, toOrderBO(&o, nil)) // Items not loaded in list view
    }

    return result, total, nil
}

// UpdateStatus updates order status
func (r *orderRepo) UpdateStatus(ctx context.Context, id int64, status biz.OrderStatus) error {
    updates := map[string]interface{}{
        "status": string(status),
    }
    if status == biz.StatusPaid {
        now := time.Now()
        updates["paid_at"] = &now
    }

    err := r.data.DB(ctx).Model(&model.OrderDO{}).Where("id = ?", id).Updates(updates).Error
    if err != nil {
        return fmt.Errorf("update status failed: %w", err)
    }

    // Invalidate cache
    r.invalidateCache(ctx, id)
    return nil
}

// ========== Cache helpers ==========

func (r *orderRepo) cacheOrder(ctx context.Context, order *model.OrderDO) {
    key := fmt.Sprintf("order:%d", order.ID)
    data, _ := json.Marshal(order)
    r.data.rdb.Set(ctx, key, data, 30*time.Minute)
}

func (r *orderRepo) getCachedOrder(ctx context.Context, id int64) (*biz.Order, error) {
    key := fmt.Sprintf("order:%d", id)
    data, err := r.data.rdb.Get(ctx, key).Bytes()
    if err != nil {
        return nil, err
    }
    var orderDO model.OrderDO
    if err := json.Unmarshal(data, &orderDO); err != nil {
        return nil, err
    }
    return toOrderBO(&orderDO, nil), nil
}

func (r *orderRepo) invalidateCache(ctx context.Context, id int64) {
    key := fmt.Sprintf("order:%d", id)
    r.data.rdb.Del(ctx, key)
}

// ========== DO ↔ BO conversion ==========

func toOrderDO(o *biz.Order) *model.OrderDO {
    return &model.OrderDO{
        ID:              o.ID,
        UserID:          o.UserID,
        Status:          string(o.Status),
        TotalAmount:     o.TotalAmount,
        Remark:          o.Remark,
        ReceiverName:    o.ShippingAddress.Name,
        ReceiverPhone:   o.ShippingAddress.Phone,
        ReceiverAddress: o.ShippingAddress.FullAddr,
        PaidAt:          o.PaidAt,
        ShippedAt:       o.ShippedAt,
    }
}

func toOrderBO(o *model.OrderDO, items []model.OrderItemDO) *biz.Order {
    order := &biz.Order{
        ID:          o.ID,
        UserID:      o.UserID,
        Status:      biz.OrderStatus(o.Status),
        TotalAmount: o.TotalAmount,
        Remark:      o.Remark,
        ShippingAddress: &biz.Address{
            Name:     o.ReceiverName,
            Phone:    o.ReceiverPhone,
            FullAddr: o.ReceiverAddress,
        },
        PaidAt:    o.PaidAt,
        ShippedAt: o.ShippedAt,
        CreatedAt: o.CreatedAt,
        UpdatedAt: o.UpdatedAt,
    }
    for _, item := range items {
        order.Items = append(order.Items, &biz.OrderItem{
            ID:          item.ID,
            ProductID:   item.ProductID,
            ProductName: item.ProductName,
            Quantity:    item.Quantity,
            UnitPrice:   item.UnitPrice,
        })
    }
    return order
}

func toItemDOs(items []*biz.OrderItem, orderID int64) []model.OrderItemDO {
    result := make([]model.OrderItemDO, 0, len(items))
    for _, item := range items {
        result = append(result, model.OrderItemDO{
            OrderID:     orderID,
            ProductID:   item.ProductID,
            ProductName: item.ProductName,
            Quantity:    item.Quantity,
            UnitPrice:   item.UnitPrice,
        })
    }
    return result
}
```

## 四、执行预览

```bash
# Run data layer tests (requires testcontainers or real DB)
$ go test ./internal/data/... -v

# Check database migration
$ mysql -u root -e "SHOW TABLES; DESCRIBE orders; DESCRIBE order_items;" myapp

# +------------+--------------+------+-----+---------+
# | Field      | Type         | Null | Key | Default |
# +------------+--------------+------+-----+---------+
# | id         | bigint       | NO   | PRI | NULL    |
# | user_id    | bigint       | NO   | MUL | NULL    |
# | status     | varchar(20)  | NO   |     | pending |
# | total_amount| decimal(10,2)| NO  |     | NULL    |
# +------------+--------------+------+-----+---------+

# Test Redis cache
$ redis-cli GET order:1
# "{\"id\":1,\"user_id\":1,\"status\":\"pending\",...}"
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| DO/BO 转换必须完整 | 不要跳过字段 | 写完转换函数后逐字段核对 |
| 连接池参数要调优 | 默认值不一定合适 | 根据并发量调整 |
| 缓存过期时间 | 不能太长也不能太短 | 热点数据 30min，冷数据 5min |
| 软删除一致性 | GORM 软删除影响查询 | 列表查询注意过滤条件 |
| 事务不要嵌套 | 避免在事务中再开事务 | 用 SavePoint 或设计好边界 |
| N+1 查询 | 列表查询关联数据 | 用 Preload 或 JOIN |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| Repository 直接返回 DO 给 biz 层 | 用 toBO() 转换后再返回 |
| 在 Repository 里写业务逻辑 | Repository 只做数据存取 |
| 每个 Repository 自己管理连接 | 统一在 Data 层管理，通过 Context 传递 |
| 缓存和数据库更新不一致 | 先更新数据库，再删除缓存 |
| 用 AutoMigrate 上生产 | 生产用版本化迁移工具 |
| 不处理 gorm.ErrRecordNotFound | 区分"不存在"和"查询失败" |

## 七、练习题

### 🟢 初级
1. 为 `OrderItemDO` 添加一个 `Discount` 字段，并更新 DO↔BO 转换函数。
2. 修改 `FindByUser` 方法，增加按状态过滤的条件。

### 🟡 中级
3. 实现一个通用分页函数 `Paginate(db *gorm.DB, page, size int) *gorm.DB`。
4. 为 Repository 添加批量操作方法：`BatchCreate` 和 `BatchUpdateStatus`。

### 🔴 高级
5. 实现多级缓存（本地缓存 + Redis），使用 `singleflight` 防止缓存击穿。
6. 设计一个基于 `gorm.Plugin` 的数据变更审计日志，自动记录修改前后差异。

## 八、知识点总结

```
Data 数据层
├── 数据对象（DO）
│   ├── ORM 标签映射
│   ├── TableName 覆盖
│   └── 软删除支持
├── GORM 集成
│   ├── 连接配置 (MySQL/PostgreSQL)
│   ├── 连接池 (MaxIdle/MaxOpen/MaxLifetime)
│   └── 日志集成
├── Repository 实现
│   ├── CRUD 操作
│   ├── 分页查询
│   ├── 条件构建
│   └── 预加载关联
├── 事务管理
│   ├── Context 传递 *gorm.DB
│   ├── Transaction 方法
│   └── 嵌套事务 SavePoint
├── 缓存策略
│   ├── Cache-Aside 模式
│   ├── Redis GET/SET/DEL
│   └── 过期时间设置
├── 数据转换
│   ├── toBO (DO → BO)
│   ├── toDO (BO → DO)
│   └── 集中管理
└── 迁移管理
    ├── AutoMigrate (开发)
    └── golang-migrate (生产)
```

## 九、举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 读写分离 | GORM DB Resolver 插件 | 配置主从数据源 |
| 分库分表 | Sharding 中间件 | 路由键选择 |
| 多租户 | Context 传递 TenantID | 全局 Scope 过滤 |
| 数据加密 | GORM Serializer | 敏感字段透明加解密 |
| 审计日志 | GORM Callback | BeforeUpdate/AfterCreate |

## 十、参考资料

- [GORM 官方文档](https://gorm.io/docs/)
- [Kratos Data 层规范](https://go-kratos.dev/docs/getting-started/usage)
- [go-redis 文档](https://redis.uptrace.dev/)
- [golang-migrate](https://github.com/golang-migrate/migrate)

## 十一、代码演进

### v1: 直接在 biz 层操作 GORM

```go
// biz/order.go - BAD: biz directly uses GORM
func (uc *OrderUsecase) CreateOrder(ctx context.Context, order *Order) (*Order, error) {
    result := uc.db.Create(&order) // biz 层耦合 GORM
    return order, result.Error
}
```

**问题**：biz 层耦合 ORM，无法替换、无法测试。

### v2: 引入 Repository 模式

```go
// data/order.go
func (r *orderRepo) Save(ctx context.Context, order *biz.Order) (*biz.Order, error) {
    orderDO := toOrderDO(order)
    r.data.db.Create(orderDO)
    return toOrderBO(orderDO, nil), nil
}
```

**改进**：biz 层通过接口解耦。**但**没有缓存、没有事务传递。

### v3: 生产级（缓存 + 事务 + 连接池 + 转换）

```go
// 完整的 Cache-Aside、Context 事务传递、连接池配置、DO↔BO 转换
// 如本文完整代码所示
```

**最终形态**：生产级 data 层，缓存命中率高、事务安全、代码清晰。
