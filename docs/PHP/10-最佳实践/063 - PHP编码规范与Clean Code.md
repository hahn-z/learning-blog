---
title: "PHP编码规范与Clean Code"
slug: "php-coding-standards-clean-code"
category: "最佳实践"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "编码规范", "Clean Code"]
---

# PHP编码规范与Clean Code

好的代码不仅要能运行，更要人能读。编码规范保证团队一致性，Clean Code原则保证代码可维护性。

## PSR-12规则详解

```php
<?php

declare(strict_types=1);

namespace Vendor\Package;

use Vendor\Package\ClassA;
use Vendor\Package\ClassB;

// 类的大括号另起一行
class ClassName extends ParentClass implements InterfaceA, InterfaceB
{
    // 常量
    public const VERSION = '1.0';

    // 属性：先static，再常规；先public，再protected，再private
    private static int $instanceCount = 0;
    private string $name;
    private int $age;

    // 构造函数
    public function __construct(string $name, int $age)
    {
        $this->name = $name;
        $this->age = $age;
    }

    // 方法：public → protected → private
    public function getName(): string
    {
        return $this->name;
    }

    // 抽象/尾部分号
    abstract protected function doProcess(): void;

    // 长参数列表：每行一个参数
    public function create(
        string $name,
        int $age,
        string $email,
        array $roles = [],
    ): self {
        // ...
    }
}

// 匿名类
$obj = new class extends SomeClass {
    public function execute(): void
    {
    }
};
```

### 格式化规则速查

- 缩进：4个空格
- 行宽：建议120字符硬限制
- 大括号：类/方法的`{`另起一行，控制结构的`{`在同一行
- 空格：控制结构关键字后空格，函数调用无空格
- 空行：`use`块后空一行，属性和方法之间空一行

## 命名约定

```php
<?php
// 类名：StudlyCaps（大驼峰）
class UserService {}
class HttpRequestHandler {}

// 接口名：StudlyCaps，不加I前缀
interface Renderable {}
interface LoggerInterface {}  // 可加Interface后缀

// Trait名：StudlyCaps
trait HasTimestamps {}

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 方法：camelCase（小驼峰）
function calculateTotalPrice(): float {}

// 变量/属性：camelCase
$userName = 'John';
private int $orderCount = 0;

// 函数参数：camelCase
function processOrder(int $orderId, string $customerName): void {}

// Boolean变量/方法：is/has/can/should前缀
function isValid(): bool {}
function hasPermission(): bool {}
private bool $isPublished = false;

// 私有属性：不加下划线前缀（PSR-12不建议）
// 好
private string $name;
// 差
private string $_name;
```

## 函数长度原则

```php
<?php
// 坏：一个函数做太多事（100行+）
function processOrder(array $data): array {
    // 验证数据 (20行)
    if (empty($data['items'])) { ... }
    if (!isset($data['customer_id'])) { ... }
    
    // 计算价格 (30行)
    $total = 0;
    foreach ($data['items'] as $item) { ... }
    $tax = $total * 0.1;
    
    // 保存订单 (20行)
    $order = new Order();
    $order->total = $total + $tax;
    // ...
    
    // 发通知 (15行)
    $mailer = new Mailer();
    $mailer->send(...);
    
    // 返回结果
    return ['order_id' => $order->id];
}

// 好：拆分为小函数，每个做一件事
class OrderProcessor {
    public function process(array $data): array {
        $this->validate($data);
        $order = $this->createOrder($data);
        $this->notifyCustomer($order);
        return $this->formatResponse($order);
    }
    
    private function validate(array $data): void { /* 10行 */ }
    private function createOrder(array $data): Order { /* 15行 */ }
    private function notifyCustomer(Order $order): void { /* 8行 */ }
    private function formatResponse(Order $order): array { /* 5行 */ }
}
```

**原则**：函数不超过20行，最多不超过40行。一个函数只做一件事（单一职责）。

## SOLID原则在PHP中的实践

### S: 单一职责原则（SRP）

```php
<?php
// 坏：User类既管数据又管邮件又管日志
class User {
    public function save(): void { /* DB操作 */ }
    public function sendWelcomeEmail(): void { /* 邮件操作 */ }
    public function logActivity(): void { /* 日志操作 */ }
}

// 好：分离关注点
class User {
    public function __construct(
        public readonly string $name,
        public readonly string $email,
    ) {}
}

class UserRepository {
    public function save(User $user): void { /* DB操作 */ }
}

class UserNotifier {
    public function sendWelcome(User $user): void { /* 邮件操作 */ }
}
```

### O: 开放封闭原则（OCP）

```php
<?php
// 坏：每加一种折扣就要修改PriceCalculator
class PriceCalculator {
    public function calculate(Order $order, string $discountType): float {
        if ($discountType === 'percentage') { /* ... */ }
        if ($discountType === 'fixed') { /* ... */ }
        // 新增类型要改这里
    }
}

// 好：通过接口扩展，不修改已有代码
interface Discount {
    public function apply(float $price): float;
}

class PercentageDiscount implements Discount {
    public function __construct(private float $rate) {}
    public function apply(float $price): float {
        return $price * (1 - $this->rate);
    }
}

class FixedDiscount implements Discount {
    public function __construct(private float $amount) {}
    public function apply(float $price): float {
        return max(0, $price - $this->amount);
    }
}

class PriceCalculator {
    public function calculate(float $price, Discount $discount): float {
        return $discount->apply($price);
    }
}
```

### L: 里氏替换原则（LSP）

```php
<?php
// 坏：Square继承Rectangle但行为不一致
class Rectangle {
    public function setWidth(int $w): void { $this->width = $w; }
    public function setHeight(int $h): void { $this->height = $h; }
    public function getArea(): int { return $this->width * $this->height; }
}

class Square extends Rectangle {
    public function setWidth(int $w): void {
        $this->width = $w;
        $this->height = $w; // 违反预期！
    }
}

// 好：正方形和矩形用共同的Shape接口
interface Shape {
    public function getArea(): int;
}
```

### I: 接口隔离原则（ISP）

```php
<?php
// 坏：胖接口
interface Worker {
    public function work(): void;
    public function eat(): void;
    public function sleep(): void;
}
// Robot不需要eat和sleep，但被迫实现

// 好：拆分为小接口
interface Workable { public function work(): void; }
interface Eatable { public function eat(): void; }

class Human implements Workable, Eatable {
    public function work(): void { /* ... */ }
    public function eat(): void { /* ... */ }
}

class Robot implements Workable {
    public function work(): void { /* ... */ }
}
```

### D: 依赖反转原则（DIP）

```php
<?php
// 坏：高层直接依赖低层具体实现
class UserService {
    private MySQLDatabase $db; // 具体依赖
    
    public function __construct() {
        $this->db = new MySQLDatabase('localhost');
    }
}

// 好：高层依赖抽象
interface UserRepository {
    public function findById(int $id): ?User;
}

class UserService {
    public function __construct(
        private UserRepository $repository // 抽象依赖
    ) {}
}
```

## 代码坏味道清单

| 坏味道 | 表现 | 修复方法 |
|--------|------|----------|
| 过长函数 | >40行 | 提取方法 |
| 过长参数列表 | >4个参数 | 引入参数对象 |
| 重复代码 | 复制粘贴 | 提取公共方法 |
| 魔法数字 | `if ($status === 3)` | 定义常量 |
| 嵌套过深 | if嵌套>3层 | 提前返回 |
| 注释解释怎么做 | 代码不够清晰 | 重构代码，删注释 |
| 死代码 | 未使用的变量/方法 | 删除 |
| 过度耦合 | A改了B也坏 | 依赖注入 |

## 面试常见追问

**Q: PSR-12和PSR-2有什么区别？**
A: PSR-12是PSR-2的继任者，增加了PHP 7+新语法的规范（declare(strict_types)、分组use、匿名类、trait使用规则等）。新项目用PSR-12。

**Q: 函数真的不能超过20行吗？**
A: 是指导原则不是硬规则。关键是"一个函数只做一件事"。如果确实无法拆分且逻辑连贯，40行也可以接受。超过50行几乎一定有问题。

**Q: 注释是好还是坏？**
A: 解释"为什么"的注释是好的（设计决策、业务原因）。解释"做什么"的注释说明代码不够清晰，应该重构代码而非加注释。"怎么做"的注释通常多余。

**Q: 为什么要用依赖注入而不是直接new？**
A: 1) 可测试（Mock依赖）；2) 可替换（MySQL→PostgreSQL只需换绑定）；3) 松耦合（高层不知道底层细节）；4) 生命周期管理（单例vs每次新建）。
