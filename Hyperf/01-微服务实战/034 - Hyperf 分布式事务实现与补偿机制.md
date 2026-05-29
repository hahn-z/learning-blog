---
title: "034 - Hyperf 分布式事务实现与补偿机制"
slug: "034-hyperf-distributed-tx"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09.008+08:00"
updated_at: "2026-05-01T22:08:21.053+08:00"
reading_time: 5
tags: []
---

# Hyperf 分布式事务实现与补偿机制

> **难度：** ⭐⭐⭐⭐⭐
> **前置知识：** 分布式事务理论（033篇）、Hyperf 框架、数据库事务
> **预估用时：** 60-80 分钟

## 1. 概念讲解

在 Hyperf 中实现分布式事务，核心思路是基于 **Saga 编排模式**：将跨服务的业务操作拆分为多个本地事务步骤，每个步骤配有补偿操作，通过编排器协调执行和回滚。

类比理解：组织一场婚礼需要订酒店、请司仪、买鲜花，每个环节都能取消（补偿）。婚礼策划师（编排器）按顺序执行，如果司仪来不了，策划师就取消酒店和鲜花预订（逆向补偿），保证不会出现"酒店订了但没有司仪"的尴尬局面。

在用户服务中，注册流程涉及用户创建、积分初始化、通知发送三个步骤，通过 Hyperf 的协程特性和数据库事务，我们可以实现一个轻量但可靠的 Saga 编排器。

## 2. 实时脑图

```
┌─────────────────────────────────────────────────┐
│      Hyperf Saga Implementation Flow             │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Controller] ──► SagaOrchestrator               │
│                       │                          │
│              ┌────────┼────────┐                 │
│              ▼        ▼        ▼                 │
│         Step1      Step2     Step3               │
│        (User)    (Points)   (Email)              │
│              │        │        │                 │
│              ▼        ▼        ▼                 │
│         [DB Tx]   [DB Tx]   [API Call]           │
│                                                  │
│  On Failure -> Compensation (reverse order):     │
│         Step3.compensate <- Step2.compensate     │
│                           <- Step1.compensate    │
│                                                  │
│  State Machine:                                  │
│  PENDING -> RUNNING -> COMPLETED                 │
│                   -> COMPENSATING -> COMPENSATED │
│                                        -> FAILED │
└─────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 Saga 状态机 `app/Saga/SagaState.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga;

// ✅ Saga state machine constants
enum SagaState: string
{
    case PENDING = 'pending';
    case RUNNING = 'running';
    case COMPLETED = 'completed';
    case COMPENSATING = 'compensating';
    case COMPENSATED = 'compensated';
    case FAILED = 'failed';
}
```

### 3.2 Saga 步骤接口 `app/Saga/SagaStepInterface.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga;

interface SagaStepInterface
{
    /** ✅ Execute the step forward */
    public function execute(array $context): array;

    /** ✅ Compensate (undo) the step */
    public function compensate(array $context): void;

    /** ✅ Step name for tracking */
    public function getName(): string;
}
```

### 3.3 Saga 编排器 `app/Saga/SagaOrchestrator.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga;

use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;
use Throwable;

class SagaOrchestrator
{
    #[Inject]
    private Db $db;

    #[Inject]
    private LoggerInterface $logger;

    /**
     * ✅ Execute a saga with automatic compensation on failure
     * @param SagaStepInterface[] $steps
     */
    public function execute(string $sagaType, array $steps, array $initialContext): SagaResult
    {
        $sagaId = uniqid('saga_', true);
        $context = array_merge($initialContext, ['saga_id' => $sagaId]);
        $completedSteps = [];

        $this->persistSagaState($sagaId, $sagaType, SagaState::RUNNING, $context);
        $this->logger->info('Saga started', ['saga_id' => $sagaId, 'type' => $sagaType]);

        try {
            foreach ($steps as $step) {
                $this->logger->info("Executing step: {$step->getName()}", ['saga_id' => $sagaId]);
                $context = $step->execute($context);
                $completedSteps[] = ['step' => $step, 'context' => $context];
                $this->persistStepState($sagaId, $step->getName(), 'completed');
            }

            $this->persistSagaState($sagaId, $sagaType, SagaState::COMPLETED, $context);
            return SagaResult::success($sagaId, $context);

        } catch (Throwable $e) {
            $this->logger->error('Saga failed, compensating', [
                'saga_id' => $sagaId, 'error' => $e->getMessage(),
            ]);
            $this->persistSagaState($sagaId, $sagaType, SagaState::COMPENSATING, $context);
            $this->compensate($completedSteps, $sagaId);
            $this->persistSagaState($sagaId, $sagaType, SagaState::COMPENSATED, $context);
            return SagaResult::failure($sagaId, $e->getMessage());
        }
    }

    private function compensate(array $completedSteps, string $sagaId): void
    {
        foreach (array_reverse($completedSteps) as $record) {
            try {
                $record['step']->compensate($record['context']);
                $this->persistStepState($sagaId, $record['step']->getName(), 'compensated');
            } catch (Throwable $e) {
                // 🔴 Critical: needs manual intervention
                $this->logger->critical('Compensation failed!', [
                    'saga_id' => $sagaId, 'step' => $record['step']->getName(),
                ]);
                $this->persistStepState($sagaId, $record['step']->getName(), 'compensation_failed');
            }
        }
    }

    private function persistSagaState(string $sagaId, string $type, SagaState $state, array $context): void
    {
        $this->db->table('saga_instances')->updateOrInsert(
            ['saga_id' => $sagaId],
            ['type' => $type, 'state' => $state->value, 'context' => json_encode($context), 'updated_at' => date('c')]
        );
    }

    private function persistStepState(string $sagaId, string $stepName, string $state): void
    {
        $this->db->table('saga_steps')->updateOrInsert(
            ['saga_id' => $sagaId, 'step_name' => $stepName],
            ['state' => $state, 'updated_at' => date('c')]
        );
    }
}
```

### 3.4 用户创建步骤 `app/Saga/Steps/CreateUserStep.php`

```php
<?php
declare(strict_types=1);

namespace App\Saga\Steps;

use App\Saga\SagaStepInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;

class CreateUserStep implements SagaStepInterface
{
    #[Inject]
    private Db $db;

    public function getName(): string { return 'create_user'; }

    public function execute(array $context): array
    {
        $id = $this->db->table('users')->insertGetId([
            'username' => $context['username'],
            'email' => $context['email'],
            'password' => password_hash($context['password'], PASSWORD_BCRYPT),
            'status' => 'pending',
            'created_at' => date('c'),
        ]);
        return array_merge($context, ['user_id' => $id]);
    }

    public function compensate(array $context): void
    {
        if (isset($context['user_id'])) {
            $this->db->table('users')->where('id', $context['user_id'])
                ->update(['status' => 'cancelled', 'updated_at' => date('c')]);
        }
    }
}

class InitPointsStep implements SagaStepInterface
{
    #[Inject]
    private Db $db;

    public function getName(): string { return 'init_points'; }

    public function execute(array $context): array
    {
        $this->db->table('user_points')->insert([
            'user_id' => $context['user_id'], 'points' => 100, 'created_at' => date('c'),
        ]);
        return $context;
    }

    public function compensate(array $context): void
    {
        if (isset($context['user_id'])) {
            $this->db->table('user_points')->where('user_id', $context['user_id'])->delete();
        }
    }
}
```

### 3.5 控制器使用

```php
<?php
declare(strict_types=1);

namespace App\Controller;

use App\Saga\SagaOrchestrator;
use App\Saga\Steps\CreateUserStep;
use App\Saga\Steps\InitPointsStep;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\PostMapping;

#[Controller(prefix: '/api/users')]
class UserController
{
    #[Inject] private SagaOrchestrator $saga;
    #[Inject] private CreateUserStep $createUserStep;
    #[Inject] private InitPointsStep $initPointsStep;

    #[PostMapping('/register')]
    public function register(): array
    {
        $result = $this->saga->execute('user_registration', [
            $this->createUserStep,
            $this->initPointsStep,
        ], ['username' => 'zhangsan', 'email' => 'zhang@example.com', 'password' => 'secret123']);

        if ($result->success) {
            return ['code' => 0, 'message' => 'OK', 'data' => $result->data];
        }
        return ['code' => 500, 'message' => 'Failed: ' . $result->error];
    }
}
```

## 4. 执行预览

```bash
$ php bin/hyperf.php start

# Success:
# [INFO] Saga started {"saga_id":"saga_662f...","type":"user_registration"}
# [INFO] Executing step: create_user
# [INFO] Executing step: init_points
# [INFO] Saga completed

# Failure:
# [ERROR] Saga failed, compensating {"error":"Points initialization error"}
# [INFO] Compensating step: create_user
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 每个步骤必须幂等 | 网络重试可能重复执行 | 重复创建数据 |
| compensate 也必须幂等 | 补偿可能被多次触发 | 误删其他数据 |
| saga_id 唯一索引 | 防止重复创建 | 同一操作执行多次 |
| 补偿失败必须告警 | 需人工介入 | 数据永久不一致 |
| context 传递数据 | 不依赖全局状态 | 并发 saga 数据错乱 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 步骤内用全局变量 | 并发请求数据串 | context 数组传递 |
| compensate 硬删除 | 审计记录丢失 | 软删除/状态标记 |
| 不记录 saga 状态 | 失败后无法恢复 | 持久化到 DB |
| 步骤间隐式依赖 | 调整顺序后崩溃 | 显式通过 context |
| 无超时控制 | 步骤卡死 saga 阻塞 | 每步设超时 |

## 7. 练习题

🟢 **基础题 1：** 添加第 3 个步骤：发送欢迎邮件。

🟢 **基础题 2：** 编写 API 查询 saga 状态。

🟡 **进阶题：** 实现 Saga 超时机制：步骤超过 30 秒自动补偿。

🔴 **开放题：** 设计 saga_recovery 命令，扫描 FAILED 状态的 saga 重新执行补偿。

## 8. 知识点总结

```
Hyperf Distributed Transaction
├── SagaState enum (PENDING/RUNNING/COMPLETED/COMPENSATING/COMPENSATED/FAILED)
├── SagaStepInterface (execute/compensate/getName)
├── SagaOrchestrator (sequential execution + reverse compensation + state persistence)
├── Steps: CreateUserStep, InitPointsStep
└── Best: idempotent, context-based, soft-delete, alerting
```

## 9. 举一反三

| 场景 | 步骤设计 | 补偿策略 |
|------|----------|----------|
| 订单创建 | 创建订单->扣库存->扣余额 | 取消订单->恢复库存->恢复余额 |
| 资料变更 | 更新用户表->同步ES->清缓存 | 回滚用户表->重建索引->刷新缓存 |
| 权限分配 | 创建角色->绑定权限->通知用户 | 删除角色->解绑权限->发送撤销通知 |

## 10. 参考资料

- 🏆 [Hyperf 数据库事务文档](https://hyperf.wiki/3.1/#/zh-cn/db/transaction)
- 🏆 [Saga 原始论文](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf)
- ⭐ [Microservices.io - Saga Pattern](https://microservices.io/patterns/data/saga.html)

## 11. 代码演进

### v1 ❌ 无事务管理
```php
$user = $this->createUser($data);
$this->initPoints($user->id); // May fail, no rollback
```

### v2 ✅ Try-Catch 手动回滚
```php
try {
    $user = $this->createUser($data);
    $this->initPoints($user->id);
} catch (\Throwable $e) {
    if (isset($user)) $this->deleteUser($user->id);
    throw $e;
}
```

### v3 🟢 Saga 编排器
```php
$result = $this->saga->execute('user_registration', $steps, $context);
// Auto-compensation, state persistence, idempotency
```
