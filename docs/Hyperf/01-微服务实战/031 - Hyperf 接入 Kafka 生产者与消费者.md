---
title: "031 - Hyperf 接入 Kafka 生产者与消费者"
slug: "031-hyperf-kafka"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.98+08:00"
updated_at: "2026-05-01T22:15:48.325+08:00"
reading_time: 6
tags: []
---

# Hyperf 接入 Kafka 生产者与消费者

> **难度：** ⭐⭐⭐⭐
> **前置知识：** Hyperf 框架基础、Composer 依赖管理、消息队列概念
> **预估用时：** 45-60 分钟

## 1. 概念讲解

**Kafka** 是一个分布式流处理平台，通过 Topic 将消息从生产者（Producer）传递给消费者（Consumer），支持高吞吐、持久化和分区消费。

类比理解：Kafka 就像一个大型快递分拣中心。生产者是寄件人，把包裹（消息）投递到指定区域（Topic）；消费者是收件人，从各自负责的区域取件。Broker 是分拣中心的中转仓库，Partition 是仓库里的货架，每个快递员（Consumer）只负责特定货架，互不干扰。

在用户服务微架构中，Kafka 承担事件驱动的核心角色：用户注册成功后，生产者发送 `user.registered` 事件到 Kafka，消费者监听该事件完成欢迎邮件发送、积分初始化、数据同步等异步操作，实现服务解耦。

## 2. 实时脑图

```
┌─────────────────────────────────────────────────────┐
│                  Kafka Architecture                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [User Service]──► Producer ──► Topic: user.events   │
│                                      │               │
│                              ┌───────┼───────┐      │
│                              ▼       ▼       ▼      │
│                          P-0       P-1     P-2      │
│                              │       │       │      │
│                    ┌─────────┘       │       └──┐   │
│                    ▼                 ▼          ▼   │
│              [Email Consumer] [Point Consumer] ...  │
│                                                      │
│  Decision Branches:                                  │
│  ├── ack=early  → risk of loss       ❌             │
│  ├── ack=after  → safe, at-least-once ✅             │
│  └── idempotent → exactly-once logic  🟢            │
└─────────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 安装依赖

```bash
# ✅ Install Hyperf Kafka component
composer require hyperf/kafka
```

### 3.2 配置文件 `config/autoload/kafka.php`

```php
<?php
// ✅ Kafka connection configuration
declare(strict_types=1);

return [
    'default' => [
        'bootstrap_servers' => env('KAFKA_BROKERS', '127.0.0.1:9092'),
        'consumer' => [
            'enable_auto_commit' => false, // ✅ Manual commit for reliability
            'group_id' => env('KAFKA_GROUP_ID', 'user-service-group'),
            'auto_offset_reset' => 'earliest',
        ],
        'producer' => [
            'acks' => 'all', // ✅ Wait for all replicas to confirm
        ],
    ],
];
```

### 3.3 生产者服务 `app/Kafka/Producer/UserEventProducer.php`

```php
<?php
declare(strict_types=1);

namespace App\Kafka\Producer;

use Hyperf\Kafka\Producer;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Contract\ConfigInterface;
use Psr\Log\LoggerInterface;

class UserEventProducer
{
    #[Inject]
    private Producer $producer;

    #[Inject]
    private LoggerInterface $logger;

    private const TOPIC_USER_REGISTERED = 'user.registered';

    /**
     * ✅ Publish user registered event to Kafka
     */
    public function publishUserRegistered(int $userId, string $email, string $username): void
    {
        $payload = json_encode([
            'user_id' => $userId,
            'email' => $email,
            'username' => $username,
            'registered_at' => date('c'),
            'event_id' => uniqid('evt_', true), // ✅ Unique event ID for idempotency
        ], JSON_THROW_ON_ERROR);

        $this->producer->send(self::TOPIC_USER_REGISTERED, $payload, (string) $userId);

        $this->logger->info('Kafka event published', [
            'topic' => self::TOPIC_USER_REGISTERED,
            'user_id' => $userId,
        ]);
    }

    /**
     * 🟡 Batch publish for high-throughput scenarios
     */
    public function publishBatch(array $users): void
    {
        foreach ($users as $user) {
            $payload = json_encode($user, JSON_THROW_ON_ERROR);
            $this->producer->send(self::TOPIC_USER_REGISTERED, $payload, (string) $user['user_id']);
        }
    }
}
```

### 3.4 消费者 `app/Kafka/Consumer/UserRegisteredConsumer.php`

```php
<?php
declare(strict_types=1);

namespace App\Kafka\Consumer;

use Hyperf\Kafka\Annotation\Consumer;
use Hyperf\Kafka\AbstractConsumer;
use Hyperf\Di\Annotation\Inject;
use Psr\Log\LoggerInterface;
use longlang\phpkafka\Consumer\ConsumeMessage;

/**
 * ✅ Consumer with manual topic and group configuration
 */
#[Consumer(
    topic: 'user.registered',
    groupId: 'email-service-group',
    autoCommit: false
)]
class UserRegisteredConsumer extends AbstractConsumer
{
    #[Inject]
    private LoggerInterface $logger;

    public function consume(ConsumeMessage $message): void
    {
        $data = json_decode($message->getValue(), true, 512, JSON_THROW_ON_ERROR);

        $this->logger->info('Consuming user.registered event', [
            'event_id' => $data['event_id'] ?? 'unknown',
            'user_id' => $data['user_id'] ?? 'unknown',
        ]);

        try {
            // ✅ Business logic: send welcome email
            $this->sendWelcomeEmail($data['email'], $data['username']);

            // ✅ Manual commit after successful processing
            $message->getConsumer()->ack($message);

            $this->logger->info('Event processed successfully', [
                'user_id' => $data['user_id'],
            ]);
        } catch (\Throwable $e) {
            // ❌ Do NOT ack on failure — message will be redelivered
            $this->logger->error('Failed to process event', [
                'event_id' => $data['event_id'] ?? 'unknown',
                'error' => $e->getMessage(),
            ]);
            throw $e; // ✅ Re-throw to trigger retry mechanism
        }
    }

    private function sendWelcomeEmail(string $email, string $username): void
    {
        // 🟢 Simulate email sending — replace with real mailer in production
        $this->logger->info("Welcome email sent to {$email} ({$username})");
    }
}
```

## 4. 执行预览

```bash
$ php bin/hyperf.php start

# Producer log output:
# [INFO] Kafka event published {"topic":"user.registered","user_id":1001}

# Consumer log output:
# [INFO] Consuming user.registered event {"event_id":"evt_662f...","user_id":1001}
# [INFO] Welcome email sent to user@example.com (zhangsan)
# [INFO] Event processed successfully {"user_id":1001}
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 禁止 `auto_commit=true` | 业务场景必须手动提交 | 消息丢失，消费者未处理完就提交偏移量 |
| Topic 命名规范 | 使用 `服务.事件` 格式如 `user.registered` | Topic 混乱，难以追踪和维护 |
| 消息必须包含 `event_id` | 每条消息携带唯一标识 | 无法实现幂等消费，重复处理风险 |
| 序列化统一用 JSON | 保持生产消费两端一致 | 反序列化失败，消费者异常 |
| Broker 连接配置走 ENV | 不要硬编码 Kafka 地址 | 环境切换时需改代码，部署风险 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| Consumer Group 重复 | 多个服务用同一 group_id，消息被分摊到错误服务 | 每个服务独立 group_id，如 `email-service-group` |
| 不处理消费异常 | 异常被吞掉，消息丢失 | catch 中不 ack，re-throw 让 Kafka 重投 |
| Partition 数过少 | 消费并行度不足，消息积压 | 按 Consumer 实例数设置 Partition，一般 3-6 |
| 大消息体 >1MB | Kafka 默认限制 1MB，发送失败 | 控制消息体大小，大文件走对象存储+引用 |
| 忽略 offset 重置 | 新 group 从 latest 开始，丢失历史消息 | 测试用 `earliest`，生产按需选择 |

## 7. 练习题

🟢 **基础题 1：** 创建一个 `user.profile.updated` Topic 的生产者，发送用户资料更新事件。

🟢 **基础题 2：** 编写一个消费者监听 `user.profile.updated`，打印变更字段。

🟡 **进阶题：** 实现一个多 Topic 消费者，同时监听 `user.registered` 和 `user.activated`，根据事件类型分发处理逻辑。

🔴 **开放题：** 设计一个 Kafka 消费者监控方案，当消费延迟超过阈值时自动告警。

## 8. 知识点总结

```
Kafka in Hyperf
├── Installation
│   └── composer require hyperf/kafka
├── Configuration
│   ├── bootstrap_servers
│   ├── consumer.group_id
│   └── producer.acks
├── Producer
│   ├── Producer::send()
│   ├── Topic design
│   └── Payload serialization
├── Consumer
│   ├── #[Consumer] annotation
│   ├── AbstractConsumer::consume()
│   └── Manual commit (ack)
└── Best Practices
    ├── Event ID for idempotency
    ├── Error handling & retry
    └── Logging & monitoring
```

## 9. 举一反三

| 场景 | Topic 设计 | 消费者逻辑 |
|------|-----------|-----------|
| 订单创建后通知库存 | `order.created` | 库存服务扣减，失败发 `order.stock_failed` |
| 用户登录记录审计日志 | `user.login` | 审计服务写入日志库，含 IP/UA/时间 |
| 文件上传完成触发转码 | `media.uploaded` | 转码服务消费，完成后发 `media.transcoded` |

## 10. 参考资料

- 🏆 **官方文档：** [Hyperf Kafka 组件文档](https://hyperf.wiki/3.1/#/zh-cn/kafka)
- 🏆 **权威：** [Apache Kafka 官方文档](https://kafka.apache.org/documentation/)
- ⭐ **推荐：** [Confluent Kafka 最佳实践](https://developer.confluent.io/)
- 📖 **延伸：** 《Kafka 权威指南》第 2 版

## 11. 代码演进

### v1 ❌ 基础版（问题多）

```php
// ❌ No error handling, auto commit, no event ID
#[Consumer(topic: 'user.registered', groupId: 'default', autoCommit: true)]
class UserConsumer extends AbstractConsumer {
    public function consume(ConsumeMessage $message): void {
        $data = json_decode($message->getValue(), true);
        // ❌ No try-catch, no logging
        $this->sendEmail($data['email']);
        // ❌ Auto committed before processing completes
    }
}
```

### v2 ✅ 可靠版

```php
// ✅ Manual commit + error handling + logging
#[Consumer(topic: 'user.registered', groupId: 'email-service-group', autoCommit: false)]
class UserConsumer extends AbstractConsumer {
    public function consume(ConsumeMessage $message): void {
        $data = json_decode($message->getValue(), true, 512, JSON_THROW_ON_ERROR);
        try {
            $this->sendEmail($data['email']);
            $message->getConsumer()->ack($message); // ✅ Commit after success
        } catch (\Throwable $e) {
            $this->logger->error('Process failed', ['error' => $e->getMessage()]);
            throw $e; // ✅ Re-throw for retry
        }
    }
}
```

### v3 🟢 优化版

```php
// 🟢 With idempotency check + event ID + retry tracking
#[Consumer(topic: 'user.registered', groupId: 'email-service-group', autoCommit: false)]
class UserConsumer extends AbstractConsumer {
    public function consume(ConsumeMessage $message): void {
        $data = json_decode($message->getValue(), true, 512, JSON_THROW_ON_ERROR);
        $eventId = $data['event_id'] ?? throw new \InvalidArgumentException('Missing event_id');

        // 🟢 Idempotency: skip if already processed
        if ($this->eventRepository->isProcessed($eventId)) {
            $message->getConsumer()->ack($message);
            return;
        }

        try {
            $this->sendEmail($data['email'], $data['username']);
            $this->eventRepository->markProcessed($eventId);
            $message->getConsumer()->ack($message);
        } catch (\Throwable $e) {
            $this->logger->error('Process failed', ['event_id' => $eventId, 'error' => $e->getMessage()]);
            throw $e;
        }
    }
}
```
