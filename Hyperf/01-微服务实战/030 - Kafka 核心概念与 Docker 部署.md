---
title: "030 - Kafka 核心概念与 Docker 部署"
slug: "030-kafka-intro-docker"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.97+08:00"
updated_at: "2026-05-01T22:17:27.479+08:00"
reading_time: 8
tags: []
---

# Kafka 核心概念与 Docker 部署

## 难度标注

⭐⭐⭐（中级）

**前置知识：** 消息队列基础概念、Docker Compose、PHP 8.2+

**预估用时：** 50-60 分钟

---

## 概念讲解

**Apache Kafka** 是一个分布式的事件流平台，最初由 LinkedIn 开发，现由 Apache 基金会维护。它以高吞吐、低延迟、持久化存储为核心特点，常用于微服务间的异步通信、事件驱动架构和日志聚合。

**现实类比：** Kafka 就像一个超级邮局。生产者（发信人）把信件投到指定信箱（Topic），邮局保证信件按顺序存放且不丢失（持久化）。消费者（收信人）可以随时来取信，也可以多个收信人同时订阅同一个信箱（消费组）。信件会保留一段时间，不同的收信人可以各取各的进度（Offset）。

**技术场景：** 用户服务中，用户注册成功后需要触发多个下游动作：发送欢迎邮件、初始化积分账户、创建用户画像、记录审计日志。如果同步调用这些服务，注册接口的响应时间会是所有服务之和。用 Kafka 解耦：用户服务发一条 `user.registered` 消息到 Kafka，各下游服务各自订阅消费，注册接口只需几十毫秒。

---

## 实时脑图

```
                    User Service (Producer)
                           │
                           ▼
                  ┌─────────────────┐
                  │   Kafka Cluster │
                  │  ┌───────────┐  │
                  │  │  Topic:    │  │
                  │  │ user-events│  │
                  │  │            │  │
                  │  │ P0 P1 P2   │  │  ← Partitions
                  │  │ │  │  │    │  │
                  │  └───────────┘  │
                  │  ┌───────────┐  │
                  │  │ Brokers    │  │
                  │  │ :9092      │  │
                  │  └───────────┘  │
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │Email Svc│ │Points   │ │Audit Svc│
         │Group A  │ │Group B  │ │Group C  │
         │(email)  │ │(points) │ │(audit)  │
         └─────────┘ └─────────┘ └─────────┘
         Consumer Groups (each gets all messages)
```

---

## 完整代码

### 1. Docker Compose 部署 Kafka

```yaml
# docker-compose.kafka.yml
# ✅ Kafka 3.x with KRaft mode (no ZooKeeper needed)

version: '3.8'

services:
  kafka:
    image: bitnami/kafka:3.7
    container_name: kafka
    restart: unless-stopped
    ports:
      # ✅ PLAINTEXT listener for internal clients
      - "9092:9092"
      # 🟡 Controller listener
      - "9093:9093"
    environment:
      # ✅ KRaft mode (no ZooKeeper)
      - KAFKA_CFG_NODE_ID=1
      - KAFKA_CFG_PROCESS_ROLES=broker,controller
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=1@kafka:9093
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
      - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      # ✅ Default replication factor for development
      - KAFKA_CFG_OFFSETS_TOPIC_REPLICATION_FACTOR=1
      - KAFKA_CFG_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1
      - KAFKA_CFG_TRANSACTION_STATE_LOG_MIN_ISR=1
      # ✅ Auto-create topics (development only)
      - KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true
      # ✅ Log retention: 7 days
      - KAFKA_CFG_LOG_RETENTION_HOURS=168
    volumes:
      - kafka_data:/bitnami/kafka
    networks:
      - microservices

  # ✅ Kafka UI for management (optional but recommended)
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: kafka-ui
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - KAFKA_CLUSTERS_0_NAME=local
      - KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092
    depends_on:
      - kafka
    networks:
      - microservices

volumes:
  kafka_data:

networks:
  microservices:
    external: true
```

### 2. Hyperf Kafka 组件安装与配置

```bash
# ✅ Install Hyperf Kafka component (based on longlang/phpkafka)
composer require hyperf/kafka
```

```php
<?php
// config/autoload/kafka.php

declare(strict_types=1);

return [
    'default' => [
        'connect_timeout' => 1.0,
        'send_timeout' => 1.0,
        'recv_timeout' => 1.0,
        'broker' => env('KAFKA_BROKER', 'kafka:9092'),
        'pool' => [
            'min_connections' => 1,
            'max_connections' => 10,
            'connect_timeout' => 5.0,
            'wait_timeout' => 3.0,
            'heartbeat' => -1,
            'max_idle_time' => 60.0,
        ],
    ],
];
```

### 3. 用户事件生产者

```php
<?php
// app/Producer/UserEventProducer.php

declare(strict_types=1);

namespace App\Producer;

use Hyperf\Di\Annotation\Inject;
use Hyperf\Kafka\Producer;

class UserEventProducer
{
    // ✅ Topic name following naming convention: domain.event-type
    private const TOPIC_USER_REGISTERED = 'user-events';
    private const TOPIC_USER_PROFILE_UPDATED = 'user-profile-updates';

    #[Inject]
    private Producer $producer;

    /**
     * ✅ Publish user registered event
     */
    public function publishUserRegistered(int $userId, string $name, string $email): void
    {
        $event = [
            'event_type' => 'user.registered',
            'event_id' => $this->generateEventId(),
            'timestamp' => time(),
            'data' => [
                'user_id' => $userId,
                'name' => $name,
                'email' => $email,
            ],
        ];

        // ✅ Key by user_id for ordering guarantee within partition
        $this->producer->send(self::TOPIC_USER_REGISTERED, [
            new \Hyperf\Kafka\Message(
                topicName: self::TOPIC_USER_REGISTERED,
                key: (string)$userId,
                value: json_encode($event),
                headers: [
                    'event_type' => 'user.registered',
                    'source' => 'user-service',
                ],
            ),
        ]);

        logger()->info('User registered event published', [
            'user_id' => $userId,
            'event_id' => $event['event_id'],
        ]);
    }

    /**
     * ✅ Publish user profile updated event
     */
    public function publishProfileUpdated(int $userId, array $changes): void
    {
        $event = [
            'event_type' => 'user.profile_updated',
            'event_id' => $this->generateEventId(),
            'timestamp' => time(),
            'data' => [
                'user_id' => $userId,
                'changes' => $changes,
            ],
        ];

        $this->producer->send(self::TOPIC_USER_PROFILE_UPDATED, [
            new \Hyperf\Kafka\Message(
                topicName: self::TOPIC_USER_PROFILE_UPDATED,
                key: (string)$userId,
                value: json_encode($event),
            ),
        ]);
    }

    private function generateEventId(): string
    {
        return sprintf('evt-%s-%s', time(), bin2hex(random_bytes(4)));
    }
}
```

### 4. 用户事件消费者

```php
<?php
// app/Consumer/UserEventConsumer.php

declare(strict_types=1);

namespace App\Consumer;

use Hyperf\Kafka\Annotation\Consumer;
use Hyperf\Kafka\Message\ConsumerMessage;

/**
 * ✅ @Consumer annotation configures the consumer
 * - topic: which topics to consume
 * - groupId: consumer group for load balancing
 * - nums: number of concurrent consumers
 */
#[Consumer(
    topic: 'user-events',
    groupId: 'notification-service',
    nums: 1
)]
class NotificationConsumer extends ConsumerMessage
{
    public function consume(\Hyperf\Kafka\Message $message): void
    {
        $payload = json_decode($message->getValue(), true);
        $eventType = $payload['event_type'] ?? 'unknown';

        // ✅ Route to handler based on event type
        match ($eventType) {
            'user.registered' => $this->handleUserRegistered($payload),
            'user.profile_updated' => $this->handleProfileUpdated($payload),
            default => logger()->warning('Unknown event type', ['type' => $eventType]),
        };
    }

    private function handleUserRegistered(array $event): void
    {
        $userId = $event['data']['user_id'];
        $email = $event['data']['email'];
        $name = $event['data']['name'];

        logger()->info('Sending welcome email', [
            'user_id' => $userId,
            'email' => $email,
        ]);

        // ✅ Send welcome email (simulated)
        // $this->emailService->sendWelcome($email, $name);
    }

    private function handleProfileUpdated(array $event): void
    {
        logger()->info('Profile updated notification', [
            'user_id' => $event['data']['user_id'],
            'changes' => $event['data']['changes'],
        ]);
    }
}
```

### 5. 在用户注册流程中集成 Kafka

```php
<?php
// app/Service/UserRegistrationService.php

declare(strict_types=1);

namespace App\Service;

use App\Model\User;
use App\Producer\UserEventProducer;
use Hyperf\Di\Annotation\Inject;
use Hyperf\DbConnection\Db;

class UserRegistrationService
{
    #[Inject]
    private UserEventProducer $eventProducer;

    /**
     * ✅ Register user and publish event atomically
     */
    public function register(string $name, string $email, string $password): array
    {
        // ✅ Validate uniqueness
        if (User::where('email', $email)->exists()) {
            return ['error' => 'Email already registered', 'code' => 409];
        }

        // ✅ Create user in transaction
        $user = Db::transaction(function () use ($name, $email, $password) {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => password_hash($password, PASSWORD_BCRYPT),
                'status' => 'active',
            ]);
            return $user;
        });

        // ✅ Publish event AFTER successful DB commit
        // If Kafka publish fails, user is still created
        // Events can be replayed from CDC (Change Data Capture)
        try {
            $this->eventProducer->publishUserRegistered(
                $user->id,
                $user->name,
                $user->email
            );
        } catch (\Throwable $e) {
            // 🟡 Log but don't fail the registration
            logger()->error('Failed to publish registration event', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
```

---

## 执行预览

```bash
# Start Kafka stack
$ docker compose -f docker-compose.kafka.yml up -d
[+] Running 2/2
 ✔ Container kafka    Started
 ✔ Container kafka-ui Started

# Verify Kafka is running
$ docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
__consumer_offsets

# Start Hyperf with Kafka consumers
$ php bin/hyperf.php start

# Register a new user (triggers Kafka event)
$ curl -X POST http://localhost:9501/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Hahn","email":"hahn@example.com","password":"secret123"}'
{"id":1,"name":"Hahn","email":"hahn@example.com"}

# Check Kafka UI at http://localhost:8080
# Topics > user-events > Messages:
# Key: "1", Value: {"event_type":"user.registered","data":{"user_id":1,...}}

# Consumer logs:
# [INFO] Sending welcome email {"user_id":1,"email":"hahn@example.com"}

# Create topic manually (if auto-create disabled)
$ docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic user-events --partitions 3 --replication-factor 1
Created topic user-events.

# Check consumer group status
$ docker exec kafka kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group notification-service
GROUP            TOPIC        PARTITION  CURRENT-OFFSET  LAG
notification-svc user-events  0          1               0
```

---

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 生产者要在事务提交后发消息 | DB 成功后再发 Kafka | 消息发了但 DB 回滚，数据不一致 |
| 消费要幂等 | 同一消息可能消费两次 | 重复发邮件/重复扣款 |
| Key 决定分区 | 同一 Key 进同一分区保证顺序 | 不同 Key 可能乱序 |
| 消费组要唯一 | 不同服务用不同 groupId | 同组内竞争消费，消息分摊 |
| 开发用 auto-create | 生产环境要预创建 Topic | 自动创建的分区数和副本数不对 |

---

## 避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| 消费者抛异常不重试 | 消息丢失或跳过 | catch 异常 + 重试/死信队列 |
| Topic 名不规范 | 难以管理和监控 | 用 `domain.event-type` 格式 |
| 不设消息过期 | 磁盘满 | 配置 `log.retention.hours` |
| 生产者和 DB 不在同一事务 | 数据不一致 | 先 DB commit 再发消息，或用事务性发件箱 |
| offset 自动提交但处理失败 | 消息丢失 | 手动提交 offset |

---

## 练习题

### 🟢 基础题

1. **部署并验证**：用 Docker Compose 启动 Kafka，用命令行工具创建 Topic 并发一条消息消费。

2. **多消费者组**：创建两个消费者组订阅同一个 Topic，验证每组都能收到所有消息。

### 🟡 进阶题

3. **死信队列**：当消费者处理失败超过 3 次时，将消息发送到死信 Topic（`user-events.DLT`）。

### 🔴 开放题

4. **设计事件溯源架构**：用 Kafka 存储所有用户状态变更事件，实现通过重放事件重建用户状态的能力。

---

## 知识点总结

```
Kafka 核心概念
├── 基础概念
│   ├── Broker（Kafka 服务节点）
│   ├── Topic（消息分类/主题）
│   ├── Partition（分区，并行度）
│   ├── Offset（消费位置）
│   └── Replication（副本，高可用）
├── 生产者（Producer）
│   ├── Key 路由（相同 Key 同分区）
│   ├── ACK 确认（acks=0/1/all）
│   └── 批量发送（提高吞吐）
├── 消费者（Consumer）
│   ├── Consumer Group（负载均衡）
│   ├── Offset 管理（自动/手动提交）
│   ├── Rebalance（组员变动重分配）
│   └── 幂等消费
├── 部署模式
│   ├── KRaft 模式（无 ZooKeeper）
│   ├── 单节点（开发）
│   └── 集群模式（生产）
└── Hyperf 集成
    ├── hyperf/kafka 组件
    ├── Producer 服务
    ├── @Consumer 注解
    └── 连接池配置
```

---

## 举一反三

| 场景 | 变种说明 | 关键差异 |
|------|----------|----------|
| Kafka → RabbitMQ | 不同消息队列 | RabbitMQ 支持路由/优先级，Kafka 支持回放 |
| 单分区 → 多分区 | 并行消费 | 需要考虑 Key 路由和顺序性 |
| 开发单节点 → 生产集群 | 部署复杂度 | 需要考虑副本、ISR、Controller |

---

## 参考资料

| 资料 | 链接 | 权威等级 |
|------|------|----------|
| Apache Kafka 官方文档 | https://kafka.apache.org/documentation/ | ⭐⭐⭐⭐⭐ |
| Hyperf Kafka 组件 | https://hyperf.wiki/3.0/#/zh-cn/kafka | ⭐⭐⭐⭐ |
| Kafka KRaft 模式 | https://developer.confluent.io/learn/kraft/ | ⭐⭐⭐⭐ |
| Confluent Kafka 指南 | https://developer.confluent.io/ | ⭐⭐⭐⭐⭐ |

---

## 代码演进

### v1 ❌ 同步调用所有下游服务

```php
public function register($name, $email, $password) {
    $user = User::create([...]);
    // ❌ Sequential synchronous calls - slow and fragile
    $this->emailService->sendWelcome($email);       // 500ms
    $this->pointsService->initAccount($user->id);    // 300ms
    $this->auditService->log('user.registered');      // 200ms
    // Total: 1s+ for a simple registration
    return $user;
}
```

### v2 ✅ Kafka 异步解耦

```php
public function register($name, $email, $password) {
    $user = User::create([...]);
    // ✅ Publish event, let consumers handle async
    $this->eventProducer->publishUserRegistered($user->id, $name, $email);
    // Registration returns in ~100ms
    return $user;
}
// Consumers: EmailConsumer, PointsConsumer, AuditConsumer
// Each processes independently at their own pace
```

### v3 🟢 事务性发件箱 + CDC + 死信队列

```php
// Transactional outbox pattern:
// 1. DB transaction: insert user + insert outbox event
// 2. CDC (Debezium) reads outbox table → publishes to Kafka
// 3. Guarantees at-least-once delivery
// 4. Dead letter topic for failed processing
// 5. Manual offset commit for exactly-once semantics
Db::transaction(function() use ($user, $event) {
    $user->save();
    OutboxEvent::create(['payload' => json_encode($event)]);
});
```
