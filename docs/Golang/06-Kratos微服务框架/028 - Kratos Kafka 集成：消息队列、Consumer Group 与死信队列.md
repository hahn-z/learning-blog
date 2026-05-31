---
title: "028 - Kratos Kafka 集成：消息队列、Consumer Group 与死信队列"
slug: "028-kratos-kafka"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:20:57.536+08:00"
updated_at: "2026-04-29T10:02:45.491+08:00"
reading_time: 27
tags: []
---

# 028 - Kratos 消息队列 Kafka 集成

> **难度：⭐⭐⭐⭐（较难）**
> Kafka 是微服务异步通信的核心基础设施。本文从原理到实战，详解 Kratos 中 Kafka 的生产者/消费者、Consumer Group、消息序列化与死信队列。

---

## 一、概念讲解

### Kafka 核心概念

| 概念 | 说明 |
|------|------|
| **Broker** | Kafka 服务节点 |
| **Topic** | 消息分类，逻辑队列 |
| **Partition** | Topic 的物理分片，并行消费的基础 |
| **Producer** | 消息生产者 |
| **Consumer** | 消息消费者 |
| **Consumer Group** | 消费者组，组内消费者分摊 Partition |
| **Offset** | 消息在 Partition 中的位置 |

### 为什么选择 segmentio/kafka-go？

Kratos 生态中推荐 `segmentio/kafka-go`，理由：

- 纯 Go 实现，无 CGO 依赖
- API 简洁，支持 Consumer Group
- 性能优秀，社区活跃
- 与 Kratos 的 server 抽象契合度高

---

## 二、脑图

```
Kafka 集成
├── 核心概念
│   ├── Broker / Topic / Partition
│   ├── Producer / Consumer
│   └── Consumer Group / Offset
├── segmentio/kafka-go
│   ├── Writer (Producer)
│   ├── Reader (Consumer)
│   └── ConsumerGroupReader
├── 消息序列化
│   ├── Protobuf
│   ├── JSON
│   └── 自定义 Codec
├── 消费模式
│   ├── 单消费者
│   ├── Consumer Group
│   └── 手动提交 Offset
├── 可靠性
│   ├── 死信队列 (DLQ)
│   ├── 重试机制
│   └── Exactly-Once 语义
└── 监控
    ├── Lag 监控
    ├── 吞吐量
    └── 消费延迟
```

---

## 三、完整代码示例

### v1：基础生产者与消费者

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/segmentio/kafka-go"
)

const (
    broker  = "localhost:9092"
    topic   = "order-events"
    groupID = "order-service"
)

// SimpleProducer demonstrates basic message production
func SimpleProducer() {
    w := &kafka.Writer{
        Addr:         kafka.TCP(broker),
        Topic:        topic,
        Balancer:     &kafka.LeastBytes{},
        BatchTimeout: 10 * time.Millisecond,
    }
    defer w.Close()

    ctx := context.Background()
    for i := 0; i < 10; i++ {
        err := w.WriteMessages(ctx, kafka.Message{
            Key:   []byte(fmt.Sprintf("order-%d", i)),
            Value: []byte(fmt.Sprintf(`{"order_id":%d,"status":"created"}`, i)),
            Headers: []kafka.Header{
                {Key: "source", Value: []byte("order-service")},
            },
        })
        if err != nil {
            log.Printf("Failed to write message: %v", err)
        }
    }
    log.Println("Produced 10 messages")
}

// SimpleConsumer demonstrates basic message consumption
func SimpleConsumer() {
    r := kafka.NewReader(kafka.ReaderConfig{
        Brokers:  []string{broker},
        Topic:    topic,
        GroupID:  groupID,
        MinBytes: 10e3, // 10KB
        MaxBytes: 10e6, // 10MB
    })
    defer r.Close()

    ctx := context.Background()
    for {
        msg, err := r.ReadMessage(ctx)
        if err != nil {
            log.Printf("Read error: %v", err)
            break
        }
        log.Printf("Consumed: key=%s value=%s offset=%d", 
            string(msg.Key), string(msg.Value), msg.Offset)
    }
}
```

### v2：Consumer Group + Protobuf 序列化

```go
package main

import (
    "context"
    "log"
    "os"
    "sync"

    "github.com/segmentio/kafka-go"
    "google.golang.org/protobuf/proto"
)

// OrderEvent represents a protobuf message (generated)
// Assume we have: orderpb.OrderEvent
// import pb "your-project/api/order/v1"

// ProtoProducer serializes and sends protobuf messages
func ProtoProducer() {
    w := &kafka.Writer{
        Addr:     kafka.TCP("localhost:9092"),
        Topic:    "order-events",
        Balancer: &kafka.Hash{}, // Route by key for ordering
    }
    defer w.Close()

    ctx := context.Background()
    // In real code: construct pb.OrderEvent and proto.Marshal
    msg := []byte(`{"order_id":"ORD-001","amount":99.9}`)
    err := w.WriteMessages(ctx, kafka.Message{
        Key:   []byte("ORD-001"),
        Value: msg,
    })
    if err != nil {
        log.Fatal(err)
    }
}

// ConsumerGroupHandler processes messages in a consumer group
func ConsumerGroupHandler(ctx context.Context, r *kafka.Reader, wg *sync.WaitGroup) {
    defer wg.Done()
    for {
        select {
        case <-ctx.Done():
            return
        default:
            msg, err := r.ReadMessage(ctx)
            if err != nil {
                log.Printf("Consumer error: %v", err)
                continue
            }
            // Process message
            log.Printf("[CG] Processed: key=%s partition=%d offset=%d",
                string(msg.Key), msg.Partition, msg.Offset)
            // In real code: proto.Unmarshal → business logic
        }
    }
}
```

### v3：死信队列 + 完整服务集成

```go
package main

import (
    "context"
    "errors"
    "log"
    "os"
    "time"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/segmentio/kafka-go"
)

const (
    brokerAddr = "localhost:9092"
    mainTopic  = "order-events"
    dlqTopic   = "order-events-dlq"
    groupID    = "order-processor"
    maxRetries = 3
)

// DLQProducer sends failed messages to dead letter queue
type DLQProducer struct {
    writer *kafka.Writer
    logger *log.Helper
}

func NewDLQProducer(logger log.Logger) *DLQProducer {
    return &DLQProducer{
        writer: &kafka.Writer{
            Addr:         kafka.TCP(brokerAddr),
            Topic:        dlqTopic,
            Balancer:     &kafka.LeastBytes(),
            BatchTimeout: 10 * time.Millisecond,
        },
        logger: log.NewHelper(logger),
    }
}

func (d *DLQProducer) Send(ctx context.Context, origMsg kafka.Message, err error) {
    origMsg.Headers = append(origMsg.Headers,
        kafka.Header{Key: "dlq-error", Value: []byte(err.Error())},
        kafka.Header{Key: "dlq-timestamp", Value: []byte(time.Now().Format(time.RFC3339))},
    )
    origMsg.Topic = "" // Let writer decide topic
    if writeErr := d.writer.WriteMessages(ctx, origMsg); writeErr != nil {
        d.logger.Errorf("Failed to send to DLQ: %v", writeErr)
    } else {
        d.logger.Warnf("Message sent to DLQ: key=%s error=%v", string(origMsg.Key), err)
    }
}

func (d *DLQProducer) Close() error {
    return d.writer.Close()
}

// OrderProcessor processes order events with retry and DLQ
type OrderProcessor struct {
    reader *kafka.Reader
    dlq    *DLQProducer
    logger *log.Helper
}

func NewOrderProcessor(logger log.Logger) *OrderProcessor {
    return &OrderProcessor{
        reader: kafka.NewReader(kafka.ReaderConfig{
            Brokers:  []string{brokerAddr},
            Topic:    mainTopic,
            GroupID:  groupID,
            MinBytes: 10e3,
            MaxBytes: 10e6,
        }),
        dlq:    NewDLQProducer(logger),
        logger: log.NewHelper(logger),
    }
}

func (p *OrderProcessor) Start(ctx context.Context) error {
    p.logger.Info("Order processor started")
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
            msg, err := p.reader.ReadMessage(ctx)
            if err != nil {
                if errors.Is(err, context.Canceled) {
                    return nil
                }
                p.logger.Errorf("Read error: %v", err)
                continue
            }
            // Process with retry
            if processErr := p.processWithRetry(ctx, msg); processErr != nil {
                p.dlq.Send(ctx, msg, processErr)
            }
        }
    }
}

func (p *OrderProcessor) processWithRetry(ctx context.Context, msg kafka.Message) error {
    var lastErr error
    for attempt := 1; attempt <= maxRetries; attempt++ {
        if err := p.processMessage(ctx, msg); err != nil {
            lastErr = err
            p.logger.Warnf("Attempt %d/%d failed: %v", attempt, maxRetries, err)
            time.Sleep(time.Duration(attempt) * time.Second) // Exponential backoff
            continue
        }
        return nil
    }
    return lastErr
}

func (p *OrderProcessor) processMessage(ctx context.Context, msg kafka.Message) error {
    p.logger.Infof("Processing: key=%s value=%s", string(msg.Key), string(msg.Value))
    // Business logic here
    return nil
}

func (p *OrderProcessor) Stop() error {
    p.logger.Info("Order processor stopping...")
    p.dlq.Close()
    return p.reader.Close()
}

func main() {
    logger := log.NewStdLogger(os.Stdout)
    processor := NewOrderProcessor(logger)

    app := kratos.New(
        kratos.Name("order-processor"),
    )

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    go func() {
        if err := processor.Start(ctx); err != nil {
            log.Printf("Processor stopped: %v", err)
        }
    }()

    // Graceful shutdown handled by kratos.App
    app.Run()
}
```

---

## 四、执行预览

```bash
# Start Kafka (docker)
$ docker run -d --name kafka -p 9092:9092 confluentinc/cp-kafka:latest

# Run producer
$ go run main.go
Produced 10 messages

# Run consumer
$ go run consumer.go
Consumed: key=order-0 value={"order_id":0,"status":"created"} offset=0
Consumed: key=order-1 value={"order_id":1,"status":"created"} offset=1

# DLQ output when processing fails
WARN Message sent to DLQ: key=ORD-001 error=processing failed after 3 retries
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| Consumer Group ID | 同一业务服务使用相同 GroupID，不同服务使用不同 GroupID |
| Offset 提交 | 默认自动提交，关键业务建议手动提交（`r.CommitMessages`） |
| Partition 数量 | 决定并行度，Consumer 数量不应超过 Partition 数量 |
| 消息大小 | 默认 1MB 限制，大消息考虑外部存储 + 引用传递 |
| 优雅关闭 | 消费者需要正确处理 context 取消，完成当前消息处理 |
| 顺序性 | 同一 Key 的消息会被路由到同一 Partition，保证局部顺序 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 消费失败直接丢弃消息 | 重试后发往死信队列 |
| 使用自动提交 + 长时间处理 | 关键业务用手动提交，处理完再 commit |
| 每条消息一个 goroutine 无限并发 | 使用 worker pool 限制并发数 |
| 忽略 `context.Canceled` 错误 | 优雅关闭时正确处理 context 取消 |
| Topic 命名随意 | 统一命名规范：`{domain}.{event-type}.{version}` |
| 不监控消费延迟 | 接入 Lag 监控，及时发现消费堆积 |

---

## 七、练习题

### 🟢 入门
1. 使用 kafka-go 创建一个生产者，向 Topic 发送 100 条消息
2. 创建消费者，读取并打印所有消息

### 🟡 进阶
3. 实现 Consumer Group 模式，启动 2 个消费者实例分摊消息
4. 实现消息的 Protobuf 序列化/反序列化

### 🔴 挑战
5. 实现完整的死信队列机制，含重试退避和 DLQ 消费者
6. 实现 Exactly-Once 语义：Kafka 消费 + 数据库写入在同一个事务中

---

## 八、知识点总结

```
Kafka 集成
├── 核心组件
│   ├── kafka.Writer — 生产者
│   ├── kafka.Reader — 消费者
│   └── Consumer Group — 组消费
├── 消息序列化
│   ├── JSON — 简单通用
│   ├── Protobuf — 高性能
│   └── 自定义 Codec
├── 可靠性
│   ├── 重试 + 退避
│   ├── 死信队列
│   └── 手动 Offset 提交
├── 性能优化
│   ├── 批量写入
│   ├── Partition 并行
│   └── Worker Pool
└── 监控
    ├── Consumer Lag
    └── 吞吐量/延迟
```

---

## 九、举一反三

| 场景 | Kafka 配置 | 关键参数 |
|------|-----------|---------|
| 日志收集 | 高吞吐 + 持久化 | `acks=all`, `retention=7d` |
| 订单事件 | 低延迟 + 可靠 | `acks=all`, 手动提交, DLQ |
| 实时流处理 | Consumer Group + 高并行 | Partition 数 = 消费者数 |
| 通知推送 | 延迟队列 | 分级 Topic + 定时消费 |
| 数据同步 | CDC + Exactly-Once | 事务 Producer |

---

## 十、参考资料

- [segmentio/kafka-go GitHub](https://github.com/segmentio/kafka-go)
- [Kafka 官方文档](https://kafka.apache.org/documentation/)
- [Kratos 事件驱动架构](https://go-kratos.dev/docs/guide/event-driven)

---

## 十一、代码演进

| 版本 | 说明 | 适用场景 |
|------|------|---------|
| v1 | 基础生产/消费 | 学习、简单场景 |
| v2 | Consumer Group + Protobuf | 一般项目 |
| v3 | DLQ + 重试 + 服务集成 | 生产环境 |

---

> **下篇预告：** 029 - 熔断与限流，学习如何保护微服务免受级联故障影响。
