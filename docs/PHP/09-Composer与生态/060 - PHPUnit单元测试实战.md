---
title: "PHPUnit单元测试实战"
slug: "phpunit-testing-practice"
category: "Composer与生态"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "PHPUnit", "测试"]
:v-pre:
---# PHPUnit单元测试实战

单元测试不是额外负担，而是代码质量的保障网。掌握PHPUnit，让你的代码可测试、可维护、可重构。

## 安装与配置

```bash
composer require --dev phpunit/phpunit ^11.0
```

```xml
<!-- phpunit.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
         failOnRisky="true"
         failOnWarning="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
</phpunit>
```

## 基本测试与断言

```php
<?php
// tests/Unit/CalculatorTest.php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Service\Calculator;

class CalculatorTest extends TestCase
{
    private Calculator $calc;

    // 每个测试方法前执行
    protected function setUp(): void
    {
        $this->calc = new Calculator();
    }

    // 每个测试方法后执行
    protected function tearDown(): void
    {
        // 清理资源
    }

    // 测试方法必须以test开头或使用#[Test]属性
    public function testAddTwoNumbers(): void
    {
        $result = $this->calc->add(2, 3);
        
        // 各种断言方法
        $this->assertEquals(5, $result, '2 + 3 should equal 5');
        $this->assertSame(5, $result);           // 严格比较（类型+值）
        $this->assertGreaterThan(4, $result);
        $this->assertLessThanOrEqual(5, $result);
    }

    public function testDivideByZero(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Division by zero');
        
        $this->calc->divide(10, 0);
    }

    public function testVariousAssertions(): void
    {
        // 数组
        $this->assertCount(3, [1, 2, 3]);
        $this->assertContains(2, [1, 2, 3]);
        $this->assertArrayHasKey('name', ['name' => 'test']);

        // 字符串
        $this->assertStringContainsString('hello', 'hello world');
        $this->assertMatchesRegularExpression('/^\d+$/', '123');

        // 布尔与空值
        $this->assertTrue(true);
        $this->assertNull(null);
        $this->assertEmpty([]);

        // 类型
        $this->assertIsArray([]);
        $this->assertIsString('hello');
        $this->assertInstanceOf(Calculator::class, $this->calc);
    }
}
```

## DataProvider数据驱动测试

```php
<?php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class EmailValidatorTest extends TestCase
{
    // 数据提供器：返回数组的数组
    public static function validEmailProvider(): array
    {
        return [
            'simple email'    => ['user@example.com', true],
            'with subdomain'  => ['user@mail.example.com', true],
            'with plus'       => ['user+tag@gmail.com', true],
            'missing @'       => ['userexample.com', false],
            'missing domain'  => ['user@', false],
            'empty string'    => ['', false],
            'double @'        => ['user@@example.com', false],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('validEmailProvider')]
    public function testEmailValidation(string $email, bool $expected): void
    {
        $validator = new \App\Service\EmailValidator();
        $this->assertSame($expected, $validator->isValid($email));
    }
}
```

## Mock与Prophecy

```php
<?php
namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Repository\UserRepository;
use App\Service\UserService;
use App\Entity\User;

class UserServiceTest extends TestCase
{
    // 方式1: createMock（PHPUnit内置）
    public function testGetUserWithMock(): void
    {
        // 创建模拟对象
        $repository = $this->createMock(UserRepository::class);
        
        // 配置期望：findById被调用一次，参数为1，返回指定对象
        $repository->expects($this->once())
            ->method('findById')
            ->with($this->equalTo(1))
            ->willReturn(new User(1, 'John'));
        
        $service = new UserService($repository);
        $user = $service->getUser(1);
        
        $this->assertEquals('John', $user->getName());
    }

    // 方式2: createStub（不需要验证调用次数，只要返回值）
    public function testGetUserWithStub(): void
    {
        $repository = $this->createStub(UserRepository::class);
        $repository->method('findById')->willReturn(new User(1, 'John'));
        
        $service = new UserService($repository);
        $user = $service->getUser(1);
        
        $this->assertEquals('John', $user->getName());
    }

    // Mock回调函数
    public function testWithCallback(): void
    {
        $repository = $this->createMock(UserRepository::class);
        
        $repository->expects($this->exactly(2))
            ->method('findById')
            ->willReturnCallback(function (int $id) {
                return new User($id, "User_$id");
            });
        
        $service = new UserService($repository);
        $this->assertEquals('User_1', $service->getUser(1)->getName());
        $this->assertEquals('User_2', $service->getUser(2)->getName());
    }

    // Mock接口
    public function testWithInterface(): void
    {
        $mailer = $this->createMock(\App\Contract\MailerInterface::class);
        $mailer->expects($this->once())
            ->method('send')
            ->with(
                $this->equalTo('john@example.com'),
                $this->stringContains('Welcome')
            )
            ->willReturn(true);
        
        $service = new UserService($this->createStub(UserRepository::class), $mailer);
        $service->sendWelcomeEmail(new User(1, 'John', 'john@example.com'));
    }
}
```

## 测试覆盖率

```bash
# 生成HTML覆盖率报告（需要Xdebug或PCOV）
phpunit --coverage-html coverage/

# 终端输出覆盖率摘要
phpunit --coverage-text

# 指定最低覆盖率门槛
phpunit --coverage-text --coverage-min-percentage=80

# 在phpunit.xml中配置
# <source>
#     <include><directory>app</directory></include>
#     <report>
#         <html outputDirectory="coverage"/>
#     </report>
# </source>
```

## setUp/tearDown生命周期

```php
<?php
use PHPUnit\Framework\TestCase;

class LifecycleTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        // 整个测试类开始前执行一次（如创建测试数据库）
        echo "Class setup\n";
    }

    public static function tearDownAfterClass(): void
    {
        // 整个测试类结束后执行一次
        echo "Class teardown\n";
    }

    protected function setUp(): void
    {
        // 每个测试方法前执行
        echo "  Method setup\n";
    }

    protected function tearDown(): void
    {
        // 每个测试方法后执行
        echo "  Method teardown\n";
    }

    protected function assertPreConditions(): void
    {
        // setUp之后、测试方法之前执行
    }

    protected function assertPostConditions(): void
    {
        // 测试方法之后、tearDown之前执行
    }

    public function testA(): void { echo "    Test A\n"; $this->assertTrue(true); }
    public function testB(): void { echo "    Test B\n"; $this->assertTrue(true); }
}

// 执行顺序:
// Class setup
//   Method setup → Test A → Method teardown
//   Method setup → Test B → Method teardown
// Class teardown
```

## 面试常见追问

**Q: 单元测试和集成测试的区别？**
A: 单元测试隔离测试单个函数/类（Mock所有依赖），快速且稳定。集成测试测试多个组件协作（真实数据库、API调用），慢但验证整体行为。项目中两者都需要，比例约7:3。

**Q: 什么是测试金字塔？**
A: 底层大量单元测试（快速、稳定），中间适量集成测试，顶层少量E2E测试（慢、脆弱）。倒金字塔（大量E2E、少量单元）会导致测试反馈慢、维护成本高。

**Q: private方法需要测试吗？**
A: 不需要直接测。private方法通过public方法间接测试。如果private方法逻辑复杂到需要独立测试，说明应该提取为独立的类。

**Q: 代码覆盖率100%够吗？**
A: 不够。覆盖率只衡量"代码被执行过"，不衡量"所有场景都被测试"。100%覆盖率可能漏掉边界条件、异常路径。覆盖率是必要非充分条件。
