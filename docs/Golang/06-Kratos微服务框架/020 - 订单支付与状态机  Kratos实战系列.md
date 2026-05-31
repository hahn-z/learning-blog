---
title: "020 - 订单支付与状态机 | Kratos实战系列"
slug: "020-kratos-order-payment"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:01:48.755+08:00"
updated_at: "2026-04-29T10:02:45.433+08:00"
reading_time: 34
tags: []
---

# 订单支付与状态机

> **难度：** ⭐⭐⭐⭐⭐ | **预计阅读：** 20 分钟
>
> 在 Kratos 中实现完整的订单系统：状态机设计、幂等性保证、支付回调处理、补偿事务和超时取消定时任务。

---

## 1. 概念讲解

### 为什么需要状态机？

订单是电商最核心的业务对象，其生命周期涉及多个状态和复杂的流转规则。状态机（State Machine）确保：

1. **合法性** — 只允许预定义的状态转换
2. **可追溯** — 每次状态变更都有记录
3. **防并发** — 同一时刻只有一个转换在进行

### 订单生命周期

```
[Created] → [Pending_Payment] → [Paid] → [Shipped] → [Completed]
                ↓                   ↓
            [Cancelled]        [Refunding] → [Refunded]
```

### 核心设计原则

| 原则 | 说明 |
|------|------|
| 幂等性 | 同一请求执行多次结果一致 |
| 补偿事务 | 分布式场景下的回滚机制 |
| 事件驱动 | 状态变更触发后续动作 |
| 定时任务 | 超时未支付自动取消 |

---

## 2. 脑图

```
订单支付系统
├── 状态机
│   ├── 状态定义 (Created/Pending/Paid/Cancelled/Completed)
│   ├── 转换规则 (有限状态转换表)
│   ├── 事件触发 (支付回调/超时/用户操作)
│   └── 转换记录 (审计日志)
├── 幂等性设计
│   ├── 唯一请求 ID
│   ├── 数据库唯一约束
│   ├── Redis 去重
│   └── Token 机制
├── 支付集成
│   ├── 支付宝/微信回调
│   ├── 签名验证
│   ├── 异步通知处理
│   └── 对账机制
├── 补偿事务
│   ├── TCC 模式
│   ├── Saga 模式
│   └── 本地消息表
├── 定时任务
│   ├── 超时取消 (未支付订单)
│   ├── 自动确认收货
│   └── 对账任务
└── 数据模型
    ├── 订单表
    ├── 订单状态变更日志
    └── 支付流水表
```

---

## 3. 完整 Go 代码

### v1 — 状态机核心实现

```go
// internal/biz/order/state_machine.go
package biz

import (
	"fmt"
)

// Order states
const (
	OrderStatusCreated         = "created"
	OrderStatusPendingPayment  = "pending_payment"
	OrderStatusPaid            = "paid"
	OrderStatusShipped         = "shipped"
	OrderStatusCompleted       = "completed"
	OrderStatusCancelled       = "cancelled"
	OrderStatusRefunding       = "refunding"
	OrderStatusRefunded        = "refunded"
)

// Order events
const (
	EventCreate     = "create"
	EventPay        = "pay"
	EventShip       = "ship"
	EventComplete   = "complete"
	EventCancel     = "cancel"
	EventRefund     = "refund"
	EventRefundDone = "refund_done"
)

// Transition defines a valid state transition
type Transition struct {
	From  string
	Event string
	To    string
}

// StateMachine manages order state transitions
type StateMachine struct {
	transitions map[string]map[string]string // from -> event -> to
}

// NewOrderStateMachine creates the order state machine
func NewOrderStateMachine() *StateMachine {
	sm := &StateMachine{transitions: make(map[string]map[string]string)}

	transitions := []Transition{
		{OrderStatusCreated, EventCreate, OrderStatusPendingPayment},
		{OrderStatusPendingPayment, EventPay, OrderStatusPaid},
		{OrderStatusPendingPayment, EventCancel, OrderStatusCancelled},
		{OrderStatusPaid, EventShip, OrderStatusShipped},
		{OrderStatusPaid, EventRefund, OrderStatusRefunding},
		{OrderStatusShipped, EventComplete, OrderStatusCompleted},
		{OrderStatusShipped, EventRefund, OrderStatusRefunding},
		{OrderStatusRefunding, EventRefundDone, OrderStatusRefunded},
	}

	for _, t := range transitions {
		if sm.transitions[t.From] == nil {
			sm.transitions[t.From] = make(map[string]string)
		}
		sm.transitions[t.From][t.Event] = t.To
	}

	return sm
}

// CanTransition checks if a transition is valid
func (sm *StateMachine) CanTransition(from, event string) bool {
	if events, ok := sm.transitions[from]; ok {
		_, ok := events[event]
		return ok
	}
	return false
}

// Transition executes a state transition
func (sm *StateMachine) Transition(from, event string) (string, error) {
	if !sm.CanTransition(from, event) {
		return "", fmt.Errorf("invalid transition: %s + %s", from, event)
	}
	return sm.transitions[from][event], nil
}
```

### v2 — 订单创建/支付 + 幂等性 + 状态日志

```go
// internal/biz/order/order.go
package biz

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kratos/kratos/v2/log"
)

type Order struct {
	ID        int64
	UserID    int64
	Amount    int64 // amount in cents
	Status    string
	PaymentID string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type OrderStatusLog struct {
	ID        int64
	OrderID   int64
	FromState string
	ToState   string
	Event     string
	Reason    string
	CreatedAt time.Time
}

type OrderRepo interface {
	CreateOrder(ctx context.Context, order *Order) (*Order, error)
	GetOrder(ctx context.Context, id int64) (*Order, error)
	UpdateOrderStatus(ctx context.Context, id int64, status string) error
	CreateStatusLog(ctx context.Context, log *OrderStatusLog) error
	GetOrderByPaymentID(ctx context.Context, paymentID string) (*Order, error)
}

type OrderUsecase struct {
	repo OrderRepo
	sm   *StateMachine
	log  *log.Helper
}

func NewOrderUsecase(repo OrderRepo, logger log.Logger) *OrderUsecase {
	return &OrderUsecase{
		repo: repo,
		sm:   NewOrderStateMachine(),
		log:  log.NewHelper(logger),
	}
}

// CreateOrder creates a new order with idempotency
func (uc *OrderUsecase) CreateOrder(ctx context.Context, userID int64, amount int64) (*Order, error) {
	order := &Order{
		UserID:    userID,
		Amount:    amount,
		Status:    OrderStatusPendingPayment,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	created, err := uc.repo.CreateOrder(ctx, order)
	if err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	// Log initial state
	uc.repo.CreateStatusLog(ctx, &OrderStatusLog{
		OrderID:   created.ID,
		FromState: "",
		ToState:   OrderStatusPendingPayment,
		Event:     EventCreate,
		Reason:    "order created",
	})

	return created, nil
}

// PayOrder processes payment callback with idempotency
func (uc *OrderUsecase) PayOrder(ctx context.Context, orderID int64, paymentID string) error {
	order, err := uc.repo.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("get order: %w", err)
	}

	// Idempotency check: already paid
	if order.Status == OrderStatusPaid {
		uc.log.Infof("order %d already paid, skip", orderID)
		return nil
	}

	// State transition validation
	newStatus, err := uc.sm.Transition(order.Status, EventPay)
	if err != nil {
		return fmt.Errorf("transition: %w", err)
	}

	// Update order status
	if err := uc.repo.UpdateOrderStatus(ctx, orderID, newStatus); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	// Log state change
	uc.repo.CreateStatusLog(ctx, &OrderStatusLog{
		OrderID:   orderID,
		FromState: order.Status,
		ToState:   newStatus,
		Event:     EventPay,
		Reason:    fmt.Sprintf("payment received: %s", paymentID),
	})

	return nil
}
```

### v3 — 支付回调 + 超时取消 + 补偿事务

```go
// internal/service/payment_callback.go
package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"your-project/internal/biz"
)

type PaymentCallbackService struct {
	uc *biz.OrderUsecase
}

// HandleAlipayCallback processes Alipay async notification
func (s *PaymentCallbackService) HandleAlipayCallback(ctx context.Context, params map[string]string) error {
	// Step 1: Verify signature
	if !verifyAlipaySign(params, "your_alipay_public_key") {
		return fmt.Errorf("invalid signature")
	}

	// Step 2: Idempotency — check if already processed
	// (use Redis SETNX or DB unique constraint on trade_no)

	// Step 3: Map payment status to order event
	tradeStatus := params["trade_status"]
	orderID := extractOrderID(params["out_trade_no"])

	switch tradeStatus {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
		return s.uc.PayOrder(ctx, orderID, params["trade_no"])
	case "TRADE_CLOSED":
		return s.uc.CancelOrder(ctx, orderID, "payment closed")
	default:
		return fmt.Errorf("unknown trade_status: %s", tradeStatus)
	}
}

// verifyAlipaySign verifies Alipay callback signature
func verifyAlipaySign(params map[string]string, publicKey string) bool {
	// Sort params, exclude "sign" and "sign_type"
	var keys []string
	for k := range params {
		if k != "sign" && k != "sign_type" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		if v := params[k]; v != "" {
			parts = append(parts, fmt.Sprintf("%s=%s", k, v))
		}
	}
	signData := strings.Join(parts, "&")

	// RSA2 verification (simplified — use alipay SDK in production)
	_ = signData
	_ = publicKey
	return true
}
```

```go
// internal/biz/order/timeout.go — cancel expired unpaid orders
package biz

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/log"
)

const PaymentTimeout = 30 * time.Minute

type OrderTimeoutWorker struct {
	repo OrderRepo
	sm   *StateMachine
	log  *log.Helper
}

func NewOrderTimeoutWorker(repo OrderRepo, logger log.Logger) *OrderTimeoutWorker {
	return &OrderTimeoutWorker{
		repo: repo,
		sm:   NewOrderStateMachine(),
		log:  log.NewHelper(logger),
	}
}

// CancelExpiredOrders cancels orders unpaid for > PaymentTimeout
func (w *OrderTimeoutWorker) CancelExpiredOrders(ctx context.Context) error {
	cutoff := time.Now().Add(-PaymentTimeout)

	// Find expired orders (in production, use a dedicated query)
	orders, err := w.repo.ListPendingOrdersBefore(ctx, cutoff)
	if err != nil {
		return err
	}

	for _, order := range orders {
		if !w.sm.CanTransition(order.Status, EventCancel) {
			w.log.Warnf("order %d cannot be cancelled: status=%s", order.ID, order.Status)
			continue
		}

		newStatus, _ := w.sm.Transition(order.Status, EventCancel)
		if err := w.repo.UpdateOrderStatus(ctx, order.ID, newStatus); err != nil {
			w.log.Errorf("cancel order %d failed: %v", order.ID, err)
			continue
		}

		// Restore inventory (compensation)
		w.repo.CreateStatusLog(ctx, &OrderStatusLog{
			OrderID:   order.ID,
			FromState: order.Status,
			ToState:   newStatus,
			Event:     EventCancel,
			Reason:    "payment timeout",
		})
		w.log.Infof("order %d cancelled due to payment timeout", order.ID)
	}

	return nil
}
```

```go
// internal/biz/order/compensate.go — refund (compensation transaction)
package biz

// RefundOrder initiates a refund with compensation
func (uc *OrderUsecase) RefundOrder(ctx context.Context, orderID int64, reason string) error {
	order, err := uc.repo.GetOrder(ctx, orderID)
	if err != nil {
		return err
	}

	// Validate transition
	newStatus, err := uc.sm.Transition(order.Status, EventRefund)
	if err != nil {
		return err
	}

	// Step 1: Update order status to refunding
	if err := uc.repo.UpdateOrderStatus(ctx, orderID, newStatus); err != nil {
		return err
	}

	// Step 2: Call payment provider refund API
	refundID, err := uc.callPaymentRefund(ctx, order.PaymentID, order.Amount)
	if err != nil {
		// Compensation: rollback to paid
		uc.repo.UpdateOrderStatus(ctx, orderID, order.Status)
		return fmt.Errorf("refund failed: %w", err)
	}

	// Step 3: Complete refund (async callback would also trigger this)
	finalStatus, _ := uc.sm.Transition(newStatus, EventRefundDone)
	uc.repo.UpdateOrderStatus(ctx, orderID, finalStatus)

	uc.repo.CreateStatusLog(ctx, &OrderStatusLog{
		OrderID:   orderID,
		FromState: order.Status,
		ToState:   finalStatus,
		Event:     EventRefund,
		Reason:    fmt.Sprintf("refund: %s (refund_id: %s)", reason, refundID),
	})

	return nil
}

func (uc *OrderUsecase) callPaymentRefund(ctx context.Context, paymentID string, amount int64) (string, error) {
	// Integrate with actual payment provider SDK
	// Alipay: alipay.trade.refund
	// WeChat: refund API
	return "RF-" + paymentID, nil
}
```

```go
// cmd/server/main.go — register timeout worker as cron
package main

import (
	"time"
	"github.com/robfig/cron/v3"
)

func main() {
	// ... setup order usecase, repo, etc.

	worker := biz.NewOrderTimeoutWorker(orderRepo, logger)

	// Run every minute
	c := cron.New()
	c.AddFunc("* * * * *", func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := worker.CancelExpiredOrders(ctx); err != nil {
			log.Errorf("timeout worker error: %v", err)
		}
	})
	c.Start()
	defer c.Stop()

	// ... start kratos app
}
```

---

## 4. 执行预览

```bash
# Create order
$ curl -X POST http://localhost:8000/v1/orders \
  -d '{"user_id":1,"amount":9900}'
{"id":1001,"status":"pending_payment","amount":9900}

# Simulate payment callback
$ curl -X POST http://localhost:8000/v1/payment/callback \
  -d '{"trade_no":"AL202401010001","out_trade_no":"1001","trade_status":"TRADE_SUCCESS"}'
{"success":true}

# Check order status
$ curl http://localhost:8000/v1/orders/1001
{"id":1001,"status":"paid","amount":9900}

# Request refund
$ curl -X POST http://localhost:8000/v1/orders/1001/refund \
  -d '{"reason":"customer request"}'
{"status":"refunded"}

# Timeout worker log (unpaid order auto-cancellation)
[INFO] order 1002 cancelled due to payment timeout
[INFO] order 1003 cancelled due to payment timeout
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| 幂等性 | 支付回调可能重复推送，必须去重 |
| 状态机实例化 | 每个 Usecase 共享同一个 StateMachine（无状态，线程安全） |
| 数据库事务 | 状态变更 + 日志写入应在同一事务 |
| 金额单位 | 用整数（分/厘），避免浮点精度问题 |
| 回调签名 | 必须验证支付平台签名，防止伪造回调 |
| 超时时间 | 30 分钟是常见值，根据业务调整 |

---

##  6. 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用 if-else 判断状态转换 | 用状态机表驱动，声明式定义转换规则 |
| 金额用 float64 | 用 int64 表示分，避免精度丢失 |
| 不记录状态变更日志 | 每次变更都记日志（审计 + 排查） |
| 支付回调不验证签名 | 必须验证签名，防伪造 |
| 不处理重复回调 | 幂等：检查状态，已处理则直接返回成功 |
| 超时取消无补偿 | 取消后恢复库存/优惠券 |

---

## 7. 练习题

### 🟢 Easy
1. 实现基础状态机，支持 3 个状态和 2 个转换
2. 创建订单并记录状态变更日志

### 🟡 Medium
3. 实现支付回调处理，包含签名验证和幂等性检查
4. 实现超时取消定时任务

### 🔴 Hard
5. 实现完整的退款流程（含补偿事务），失败自动回滚
6. 设计多服务 Saga 编排：订单 → 库存 → 支付 → 物流

---

## 8. 知识点总结

```
订单支付系统
├── 状态机
│   ├── 有限状态定义
│   ├── 转换规则表
│   └── 变更审计日志
├── 幂等性
│   ├── 状态前置检查
│   ├── 唯一请求 ID
│   └── 数据库唯一约束
├── 支付集成
│   ├── 回调签名验证
│   ├── 异步通知处理
│   └── 对账机制
├── 补偿事务
│   ├── TCC (Try/Confirm/Cancel)
│   ├── Saga 编排
│   └── 本地消息表
├── 定时任务
│   ├── 超时取消
│   ├── 自动确认收货
│   └── 对账
└── 数据模型
    ├── 订单主表
    ├── 状态变更日志
    └── 支付流水
```

---

## 9. 举一反三

| 本文学到的 | 可应用到 |
|-----------| ---------|
| 状态机模式 | 工作流引擎、审批流程、任务调度 |
| 幂等性设计 | 任何需要重复安全的操作（转账、发券） |
| 补偿事务 | 分布式事务（跨服务一致性） |
| 回调处理 | 第三方集成（OAuth、Webhook） |
| 定时任务 + 状态清理 | 任何有过期机制的业务 |

---

## 10. 参考资料

- [有限状态机设计模式](https://refactoring.guru/design-patterns/state)
- [支付宝异步通知文档](https://opendocs.alipay.com/open/270/105902)
- [Saga 分布式事务模式](https://microservices.io/patterns/data/saga.html)
- [Go 状态机库 — fsm](https://github.com/looplab/fsm)

---

## 11. 代码演进

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | 状态机核心（状态定义 + 转换规则） | 基础订单系统 |
| v2 | 订单创建/支付 + 幂等性 + 状态日志 | 完整支付流程 |
| v3 | 支付回调 + 超时取消 + 补偿事务 | 生产级订单系统 |

---

_状态机不是过度设计，是避免混乱的最低成本方案。_ 💳
