---
title: "033 - 分布式事务理论（CAP/BASE/TCC/Saga）"
slug: "033-distributed-tx-theory"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09+08:00"
updated_at: "2026-05-01T21:59:23.209+08:00"
reading_time: 4
tags: []
---

# 分布式事务理论（CAP/BASE/TCC/Saga）

> **难度：** ⭐⭐⭐⭐⭐
> **前置知识：** 数据库 ACID 事务、微服务基础、网络分区概念
> **预估用时：** 60-90 分钟

## 1. 概念讲解

**分布式事务**是跨越多个服务或数据库的事务操作，需要保证这些操作要么全部成功、要么全部回滚，但在分布式环境下面临网络不可靠、节点故障等挑战。

类比理解：想象三个人在不同银行转账——A 扣款、B 加款、C 记录手续费，三个操作必须同时成功或同时失败。但三家银行是独立的系统，网络可能断、系统可能宕机，这就是分布式事务的核心难题。

理论基石：**CAP 定理**告诉我们分布式系统不可能同时满足一致性(C)、可用性(A)和分区容忍性(P)；**BASE 理论**提出妥协方案：基本可用、软状态、最终一致。常见的分布式事务模式有 **2PC**（两阶段提交）、**TCC**（Try-Confirm-Cancel）和 **Saga**（编排式/协调式长事务）。

## 2. 实时脑图

```
┌────────────────────────────────────────────────────┐
│            Distributed Transaction Patterns          │
├────────────────────────────────────────────────────┤
│                                                     │
│  CAP Theorem (pick 2 of 3)                         │
│  ├── CP → ZooKeeper, etcd                          │
│  ├── AP → Cassandra, DNS                           │
│  └── CA → impossible in distributed system         │
│                                                     │
│  BASE Theory                                        │
│  ├── Basically Available                            │
│  ├── Soft State                                     │
│  └── Eventually Consistent                          │
│                                                     │
│  Patterns                                           │
│  ├── 2PC ──► strong consistency, blocking ❌        │
│  ├── TCC ──► try/confirm/cancel, 3 RPC ✅          │
│  └── Saga ──► chain of local tx + compensations 🟢 │
│       ├── Choreography (event-driven)               │
│       └── Orchestration (central coordinator)       │
│                                                     │
│  Decision: User Registration                        │
│  ├── Strong consistency needed? → TCC               │
│  └── Eventual consistency OK? → Saga 🟢            │
└────────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 Saga 编排器（伪实现）`app/Saga/UserRegistrationSaga.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga;

use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;

/**
 * ✅ Saga Orchestrator for user registration
 * Steps: CreateUser → InitPoints → SendWelcomeEmail
 * Compensation: each step has a reverse operation
 */
class UserRegistrationSaga
{
    #[Inject]
    private LoggerInterface $logger;

    #[Inject]
    private UserStep $userStep;

    #[Inject]
    private PointsStep $pointsStep;

    #[Inject]
    private EmailStep $emailStep;

    /**
     * ✅ Execute saga with automatic compensation on failure
     */
    public function execute(array $userData): SagaResult
    {
        $completedSteps = [];
        $sagaId = uniqid('saga_', true);

        $this->logger->info('Saga started', ['saga_id' => $sagaId]);

        try {
            // Step 1: Create user
            $user = $this->userStep->try($userData);
            $completedSteps[] = 'user';

            // Step 2: Initialize points account
            $this->pointsStep->try($user['id']);
            $completedSteps[] = 'points';

            // Step 3: Send welcome email
            $this->emailStep->try($user['email'], $user['username']);
            $completedSteps[] = 'email';

            $this->logger->info('Saga completed successfully', ['saga_id' => $sagaId]);
            return SagaResult::success($sagaId, $user);

        } catch (\Throwable $e) {
            $this->logger->error('Saga failed, starting compensation', [
                'saga_id' => $sagaId,
                'failed_at_step' => end($completedSteps),
                'error' => $e->getMessage(),
            ]);

            // ✅ Compensate in reverse order
            $this->compensate($completedSteps, $userData, $sagaId);

            return SagaResult::failure($sagaId, $e->getMessage());
        }
    }

    /**
     * ✅ Reverse compensation: undo completed steps in reverse order
     */
    private function compensate(array $completedSteps, array $context, string $sagaId): void
    {
        $reversed = array_reverse($completedSteps);

        foreach ($reversed as $step) {
            try {
                match ($step) {
                    'email' => $this->emailStep->compensate($context),
                    'points' => $this->pointsStep->compensate($context),
                    'user' => $this->userStep->compensate($context),
                };
                $this->logger->info("Compensated step: {$step}", ['saga_id' => $sagaId]);
            } catch (\Throwable $compensateError) {
                // 🔴 Critical: compensation failed — needs manual intervention
                $this->logger->critical('Compensation failed!', [
                    'saga_id' => $sagaId,
                    'step' => $step,
                    'error' => $compensateError->getMessage(),
                ]);
            }
        }
    }
}
```

### 3.2 Saga 步骤定义 `app/Saga/Steps/UserStep.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga\Steps;

use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;

class UserStep
{
    #[Inject]
    private Db $db;

    #[Inject]
    private LoggerInterface $logger;

    /**
     * ✅ Try: create user record
     */
    public function try(array $userData): array
    {
        $id = $this->db->table('users')->insertGetId([
            'username' => $userData['username'],
            'email' => $userData['email'],
            'password' => password_hash($userData['password'], PASSWORD_BCRYPT),
            'status' => 'pending', // ✅ Mark as pending until saga completes
            'created_at' => date('c'),
        ]);

        return array_merge($userData, ['id' => $id]);
    }

    /**
     * ✅ Compensate: soft-delete or mark user as cancelled
     */
    public function compensate(array $context): void
    {
        if (isset($context['id'])) {
            $this->db->table('users')
                ->where('id', $context['id'])
                ->update(['status' => 'cancelled', 'updated_at' => date('c')]);
        }
    }
}

class PointsStep
{
    #[Inject]
    private Db $db;

    public function try(int $userId): void
    {
        $this->db->table('user_points')->insert([
            'user_id' => $userId,
            'points' => 0,
            'created_at' => date('c'),
        ]);
    }

    public function compensate(array $context): void
    {
        if (isset($context['id'])) {
            $this->db->table('user_points')->where('user_id', $context['id'])->delete();
        }
    }
}

class EmailStep
{
    #[Inject]
    private LoggerInterface $logger;

    public function try(string $email, string $username): void
    {
        // 🟢 Simulate email sending
        $this->logger->info("Welcome email queued for {$email}");
    }

    public function compensate(array $context): void
    {
        // Email compensation: typically no-op or send cancellation notice
        $this->logger->info("Email compensation: skip for {$context['email']}");
    }
}
```

### 3.3 Saga 结果值对象 `app/Saga/SagaResult.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga;

class SagaResult
{
    public function __construct(
        public readonly string $sagaId,
        public readonly bool $success,
        public readonly ?string $error = null,
        public readonly ?array $data = null,
    ) {}

    public static function success(string $sagaId, array $data): self
    {
        return new self($sagaId, true, null, $data);
    }

    public static function failure(string $sagaId, string $error): self
    {
        return new self($sagaId, false, $error);
    }
}
```

## 4. 执行预览

```bash
$ php bin/hyperf.php start

# Successful saga:
# [INFO] Saga started {"saga_id":"saga_662f..."}
# [INFO] Saga completed successfully {"saga_id":"saga_662f...","user_id":1001}

# Failed saga (e.g., points service down):
# [ERROR] Saga failed, starting compensation {"saga_id":"saga_662f...","failed_at_step":"user"}
# [INFO] Compensated step: user {"saga_id":"saga_662f..."}
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 补偿操作必须幂等 | 补偿可能被多次调用 | 重复补偿导致数据异常 |
| 补偿顺序必须逆向 | 后执行的先回滚 | 数据状态不一致 |
| 补偿失败要持久化 | 记录 saga 状态供人工介入 | 补偿失败后无法恢复 |
| 避免 Saga 步骤过多 | 每步增加失败概率和延迟 | 复杂度爆炸，难以维护 |
| 理论选型要匹配业务 | 强一致选 TCC，最终一致选 Saga | 选错模式导致过度设计或数据不一致 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 用 2PC 跨微服务 | 锁持有时间长，性能差 | 用 Saga 或 TCC 替代 |
| 补偿操作不做幂等 | 重试时补偿执行两次 | 设计幂等补偿（软删除、状态标记） |
| Saga 没有超时机制 | 卡在某步骤永远等待 | 每步设置超时，超时触发补偿 |
| 忽略补偿失败 | 数据残留不一致 | 补偿失败持久化 + 告警 + 人工兜底 |
| 混用一致性和最终一致 | 同一操作部分同步部分异步 | 明确边界，统一策略 |

## 7. 练习题

🟢 **基础题 1：** 用表格对比 2PC、TCC、Saga 三种模式的优缺点。

🟢 **基础题 2：** 画出一个订单创建的 Saga 流程图，包含 3 个步骤及其补偿操作。

🟡 **进阶题：** 实现 TCC 模式的 Try 阶段：冻结用户余额而非直接扣减。

🔴 **开放题：** 在一个电商系统中，下单涉及库存、支付、物流三个服务，请选择最合适的分布式事务方案并论证。

## 8. 知识点总结

```
Distributed Transaction Theory
├── CAP Theorem
│   ├── Consistency (C)
│   ├── Availability (A)
│   └── Partition Tolerance (P)
├── BASE Theory
│   ├── Basically Available
│   ├── Soft State
│   └── Eventually Consistent
├── 2PC (Two-Phase Commit)
│   ├── Prepare → Commit/Rollback
│   └── Blocking, poor performance
├── TCC (Try-Confirm-Cancel)
│   ├── Try: reserve resources
│   ├── Confirm: finalize
│   └── Cancel: release
└── Saga Pattern
    ├── Choreography (event-driven)
    ├── Orchestration (centralized)
    └── Compensation logic (reverse order)
```

## 9. 举一反三

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 银行跨行转账 | TCC | 资金操作需要强一致性 |
| 电商下单（库存+支付+物流） | Saga 编排 | 步骤多，最终一致可接受 |
| 配置中心同步 | 2PC | 节点少，需要强一致 |
| 用户注册+初始化 | Saga 编排 | 步骤少，最终一致即可 |

## 10. 参考资料

- 🏆 **论文：** [Brewer's CAP Theorem (2000)](https://people.eecs.berkeley.edu/~brewer/cs262b-2004/PODC-keynote.pdf)
- 🏆 **论文：** [Saga Pattern (Hector Garcia-Molina, 1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)
- ⭐ **推荐：** 《Designing Data-Intensive Applications》第 9 章
- 📖 **延伸：** [Seata 分布式事务框架](https://seata.io/)

## 11. 代码演进

### v1 ❌ 无事务管理

```php
// ❌ No transaction boundary across services
$user = $this->userService->create($data);        // Service A
$this->pointsService->init($user->id);             // Service B — may fail
$this->emailService->sendWelcome($user->email);    // Service C
// If B fails, user exists but no points → inconsistency
```

### v2 ✅ Saga 编排模式

```php
// ✅ Orchestrated saga with compensation
$saga = new UserRegistrationSaga();
$result = $saga->execute($userData);
if (!$result->success) {
    // All completed steps are automatically compensated
    return $this->fail($result->error);
}
```

### v3 🟢 持久化 Saga 状态

```php
// 🟢 Persist saga state to DB for recovery
$this->sagaRepository->create($sagaId, 'user_registration', $steps);
foreach ($steps as $step) {
    $this->sagaRepository->markStep($sagaId, $step, 'started');
    $step->execute();
    $this->sagaRepository->markStep($sagaId, $step, 'completed');
}
$this->sagaRepository->markCompleted($sagaId);
```
