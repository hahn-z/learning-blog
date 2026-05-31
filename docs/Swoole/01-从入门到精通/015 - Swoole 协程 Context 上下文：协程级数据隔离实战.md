---
title: "015 - Swoole 协程 Context 上下文：协程级数据隔离实战"
slug: "015-coroutine-context"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:07:49.344+08:00"
updated_at: "2026-04-29T10:02:46.995+08:00"
reading_time: 29
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐☆☆☆ 中级

**前置知识：** 协程基础、协程调度、PHP 作用域
**预计学习时间：** 45 分钟

---

## 概念讲解

### 什么是协程 Context？

协程 Context（上下文）是 Swoole 提供的**协程级别的数据存储机制**。它允许你在每个协程中存储和获取独立的上下文数据，实现**协程间数据隔离**。

**为什么需要 Context？**

在传统 PHP-FPM 中，每个请求独立进程，天然隔离。但在 Swoole 协程环境中，多个请求共享同一进程，全局变量和静态属性会被所有协程共享，导致数据串扰。

```
进程
├── 协程A（请求1）→ 需要独立的: request_id, user_info, trace_id
├── 协程B（请求2）→ 需要独立的: request_id, user_info, trace_id  
└── 协程C（请求3）→ 需要独立的: request_id, user_info, trace_id

❌ 用全局变量 → 数据互相覆盖！
✅ 用 Context → 每个协程独立存储！
```

### Context API

| 方法 | 说明 |
|------|------|
| `Coroutine::getContext()` | 获取当前协程的上下文对象（Swoole\Coroutine\Context）|
| `Coroutine::getContext($cid)` | 获取指定协程的上下文 |
| `$ctx['key'] = $value` | 设置上下文变量 |
| `$ctx['key']` | 获取上下文变量 |
| `isset($ctx['key'])` | 检查是否存在 |

### Context vs 其他存储方式

| 方式 | 作用域 | 协程安全 | 适用场景 |
|------|--------|---------|----------|
| 局部变量 | 单协程函数内 | ✅ 安全 | 临时数据 |
| 全局变量 | 整个进程 | ❌ 不安全 | 进程级配置 |
| static 属性 | 整个进程 | ❌ 不安全 | 进程级共享 |
| Context | 单个协程 | ✅ 安全 | 请求级数据 |
| Swoole Table | 跨进程 | ✅ 安全 | 全局共享数据 |

---

## 脑图（ASCII）

```
Swoole Coroutine Context
├── 核心概念
│   ├── 协程级数据隔离
│   ├── ArrayAccess 接口
│   └── 自动随协程销毁
├── API
│   ├── getContext() 获取上下文
│   ├── $ctx['key'] = $val 设置
│   └── $ctx['key'] 获取
├── 典型用途
│   ├── Request ID 追踪
│   ├── 用户认证信息
│   ├── 日志上下文
│   ├── 数据库连接管理
│   └── 链路追踪 trace_id
├── vs 其他方案
│   ├── vs 全局变量
│   ├── vs static 属性
│   ├── vs Thread Local
│   └── vs Swoole Table
└── 最佳实践
    ├── 请求级数据放 Context
    ├── 进程级数据用 static
    ├── 跨进程数据用 Table
    └── 协程退出自动清理
```

---

## 完整代码示例

### 示例 1：Context 基础使用

```php
<?php
// 015_context_basic.php
// Basic coroutine context usage

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    // Set context in main coroutine
    $ctx = Coroutine::getContext();
    $ctx['request_id'] = 'req-main-001';
    $ctx['user'] = ['id' => 1, 'name' => 'Admin'];
    
    echo "[Main] request_id = {$ctx['request_id']}\n";
    
    go(function () {
        $ctx = Coroutine::getContext();
        $ctx['request_id'] = 'req-child-002';
        $ctx['user'] = ['id' => 2, 'name' => 'Guest'];
        
        echo "[Child-1] request_id = {$ctx['request_id']}\n";
        echo "[Child-1] user = {$ctx['user']['name']}\n";
    });
    
    go(function () {
        $ctx = Coroutine::getContext();
        $ctx['request_id'] = 'req-child-003';
        
        echo "[Child-2] request_id = {$ctx['request_id']}\n";
        // Main's context is NOT affected
    });
    
    Coroutine::sleep(0.01);
    
    // Verify main context is unchanged
    echo "[Main] Still request_id = {$ctx['request_id']}\n";
    echo "[Main] Still user = {$ctx['user']['name']}\n";
});
```

### 示例 2：请求级日志追踪

```php
<?php
// 015_request_tracing.php
// Request-level tracing with context

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

class Logger
{
    public static function log(string $message, array $extra = []): void
    {
        $ctx = Coroutine::getContext();
        $requestId = $ctx['request_id'] ?? 'unknown';
        $traceId = $ctx['trace_id'] ?? 'no-trace';
        $timestamp = date('Y-m-d H:i:s');
        
        $prefix = "[{$timestamp}][{$requestId}][{$traceId}]";
        echo $prefix . " {$message}";
        if ($extra) echo ' ' . json_encode($extra);
        echo "\n";
    }
}

run(function () {
    // Simulate 3 concurrent requests
    for ($i = 1; $i <= 3; $i++) {
        go(function () use ($i) {
            $ctx = Coroutine::getContext();
            $ctx['request_id'] = "REQ-" . str_pad($i, 4, '0', STR_PAD_LEFT);
            $ctx['trace_id'] = bin2hex(random_bytes(8));
            
            Logger::log('Request started');
            
            // Simulate processing steps
            Coroutine::sleep(rand(1, 5) * 0.01);
            Logger::log('Database queried', ['rows' => rand(10, 100)]);
            
            Coroutine::sleep(rand(1, 3) * 0.01);
            Logger::log('Cache hit', ['key' => "user_{$i}"]);
            
            Coroutine::sleep(rand(1, 2) * 0.01);
            Logger::log('Request completed', ['status' => 200]);
        });
    }
    
    Coroutine::sleep(0.5);
});
```

### 示例 3：协程间 Context 访问与 DB 连接管理

```php
<?php
// 015_db_connection.php
// Manage per-coroutine database connections via context

use Swoole\Coroutine;
use function Swoole\Coroutine\run;

class DbContext
{
    private static array $connections = [];
    
    public static function getConnection(): string
    {
        $ctx = Coroutine::getContext();
        
        if (!isset($ctx['db_conn'])) {
            $cid = Coroutine::getCid();
            $ctx['db_conn'] = "mysql_conn_cid_{$cid}";
            echo "[DB] Created connection for CID={$cid}\n";
        }
        
        return $ctx['db_conn'];
    }
    
    public static function query(string $sql): string
    {
        $conn = self::getConnection();
        $cid = Coroutine::getCid();
        echo "[DB] CID={$cid} executing: {$sql} via {$conn}\n";
        Coroutine::sleep(0.01); // Simulate query
        return "result_for_{$sql}";
    }
}

run(function () {
    // Simulate 5 concurrent request handlers
    for ($i = 0; $i < 5; $i++) {
        go(function () use ($i) {
            $ctx = Coroutine::getContext();
            $ctx['request_id'] = "req_{$i}";
            
            // First query creates connection
            DbContext::query("SELECT * FROM users WHERE id = {$i}");
            
            // Subsequent queries reuse connection
            DbContext::query("SELECT * FROM orders WHERE user_id = {$i}");
            DbContext::query("SELECT COUNT(*) FROM logs WHERE user_id = {$i}");
        });
    }
    
    Coroutine::sleep(0.1);
    echo "\nAll requests processed.\n";
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 015_context_basic.php
[Main] request_id = req-main-001
[Child-1] request_id = req-child-002
[Child-1] user = Guest
[Child-2] request_id = req-child-003
[Main] Still request_id = req-main-001
[Main] Still user = Admin
```

### 示例 2 输出（日志追踪）

```
$ php 015_request_tracing.php
[2026-04-28 22:00:00][REQ-0001][a1b2c3d4e5f6g7h8] Request started
[2026-04-28 22:00:00][REQ-0002][1234567890abcdef] Request started
[2026-04-28 22:00:00][REQ-0003][deadbeef12345678] Request started
[2026-04-28 22:00:00][REQ-0003][deadbeef12345678] Database queried {"rows":42}
[2026-04-28 22:00:00][REQ-0001][a1b2c3d4e5f6g7h8] Database queried {"rows":87}
...
```

### 示例 3 输出（DB 连接管理）

```
$ php 015_db_connection.php
[DB] Created connection for CID=2
[DB] CID=2 executing: SELECT * FROM users WHERE id = 0 via mysql_conn_cid_2
[DB] Created connection for CID=3
[DB] CID=3 executing: SELECT * FROM users WHERE id = 1 via mysql_conn_cid_3
...
[DB] CID=2 executing: SELECT * FROM orders WHERE user_id = 0 via mysql_conn_cid_2
(每个协程只创建一次连接，后续复用)
```

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| Context 随协程销毁 | 协程结束后 Context 自动清理，不可再访问 | 🟡 中等 |
| 主协程也有 Context | CID=1 的主协程同样有独立的 Context | 🟢 一般 |
| Context 不跨进程 | 多 Worker 进程各自独立 | 🟡 中等 |
| 不要存大对象 | Context 数据常驻内存直到协程结束 | 🟡 中等 |
| getContext() 仅在协程内有效 | 非协程环境调用返回 null | 🔴 严重 |

---

## 避坑指南

### ❌ 用全局变量存储请求级数据
```php
// WRONG: Shared across all coroutines!
global $currentUserId;
$currentUserId = $request->getUserId();
// Another coroutine might overwrite this!
```

### ✅ 使用 Context 存储
```php
// CORRECT: Each coroutine has its own context
$ctx = Coroutine::getContext();
$ctx['user_id'] = $request->getUserId();
// Safe from other coroutines
```

---

### ❌ 用 static 属性存请求级数据
```php
// WRONG: Static is process-wide, not coroutine-local
class RequestHelper {
    public static ?string $requestId = null;
}
// Coroutines overwrite each other!
```

### ✅ 用 Context 或静态 Map + CID
```php
// CORRECT: Use context or CID-keyed map
class RequestHelper {
    public static function getRequestId(): string {
        return Coroutine::getContext()['request_id'] ?? '';
    }
}
```

---

### ❌ 在协程外获取 Context
```php
// WRONG: Not inside a coroutine
$ctx = Coroutine::getContext(); // null!
$ctx['key'] = 'value'; // Error!
```

### ✅ 确保在协程内获取
```php
// CORRECT: Inside coroutine context
run(function () {
    $ctx = Coroutine::getContext();
    $ctx['key'] = 'value'; // OK
});
```

---

## 练习题

### 🟢 初级
1. 创建 3 个协程，每个协程在 Context 中存储自己的名称和编号，然后输出
2. 验证不同协程的 Context 互不影响：协程A修改数据，协程B不受影响

### 🟡 中级
3. 实现一个基于 Context 的日志类，自动附加 request_id 和时间戳
4. 实现一个协程级的单例模式：每个协程获取同一个对象实例，但不同协程之间隔离

### 🔴 高级
5. 实现一个链路追踪系统：支持嵌套协程间的 trace_id 传递（子协程继承父协程的 trace_id）

<details>
<summary>参考答案（题4 - 协程级单例）</summary>

```php
<?php
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

class CoroutineSingleton
{
    private static string $key = 'singleton_pool';
    
    public static function get(string $class): object
    {
        $ctx = Coroutine::getContext();
        $key = self::$key . '_' . $class;
        
        if (!isset($ctx[$key])) {
            $ctx[$key] = new $class();
        }
        
        return $ctx[$key];
    }
}

class ExpensiveService {
    public int $calls = 0;
    public function work(): void { $this->calls++; }
}

run(function () {
    for ($i = 0; $i < 3; $i++) {
        go(function () use ($i) {
            $svc = CoroutineSingleton::get(ExpensiveService::class);
            $svc->work();
            $svc2 = CoroutineSingleton::get(ExpensiveService::class);
            echo "[Co {$i}] Same instance: " . ($svc === $svc2 ? 'yes' : 'no') . " calls={$svc->calls}\n";
        });
    }
    Coroutine::sleep(0.01);
});
```

</details>

---

## 知识点总结（树状）

```
Swoole Coroutine Context
├── 核心概念
│   ├── 协程级数据隔离
│   ├── ArrayAccess 接口
│   └── 自动生命周期管理
├── 使用场景
│   ├── 请求级数据（request_id, user）
│   ├── 日志上下文
│   ├── 数据库连接管理
│   └── 链路追踪
├── API
│   ├── Coroutine::getContext()
│   ├── $ctx['key'] = $val
│   └── isset($ctx['key'])
└── 注意事项
    ├── 协程内才有效
    ├── 随协程自动销毁
    ├── 不存大对象
    └── 不跨进程
```

---

## 举一反三

| 场景 | 全局变量 | Context | 最佳选择 |
|------|---------|---------|----------|
| 请求ID | ❌ 串扰 | ✅ 隔离 | Context |
| DB连接 | ❌ 串扰 | ✅ 隔离 | Context |
| 应用配置 | ✅ 只读 | ✅ 隔离 | 全局(static) |
| 进程级缓存 | ✅ 共享 | ❌ 不适合 | Swoole Table |
| 链路追踪 | ❌ 串扰 | ✅ 隔离 | Context |

---

## 参考资料

- [Swoole Coroutine Context 文档](https://wiki.swoole.com/#/coroutine/context)
- [Swoole 协程编程须知](https://wiki.swoole.com/#/coroutine/notice)
- [Go Context 包设计哲学](https://pkg.go.dev/context)
- [PHP ArrayAccess 接口](https://www.php.net/manual/zh/class.arrayaccess.php)

---

## 代码演进

### v1：基础 Context 读写
```php
<?php
// v1: Basic context read/write
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

run(function () {
    $ctx = Coroutine::getContext();
    $ctx['name'] = 'hello';
    echo $ctx['name']; // "hello"
});
```

### v2：请求级日志追踪
```php
<?php
// v2: Request-level logging with context
// (See 示例2 above)
```

### v3：协程级服务容器
```php
<?php
// v3: Full coroutine-scoped service container
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

class CoroutineContainer
{
    private static array $resolvers = [];
    
    public static function bind(string $key, callable $resolver): void
    {
        self::$resolvers[$key] = $resolver;
    }
    
    public static function make(string $key): mixed
    {
        $ctx = Coroutine::getContext();
        $ctxKey = '_container_' . $key;
        
        if (!isset($ctx[$ctxKey])) {
            $ctx[$ctxKey] = self::$resolvers[$key]();
        }
        
        return $ctx[$ctxKey];
    }
}

run(function () {
    // Bind services
    CoroutineContainer::bind('db', fn() => new stdClass());
    CoroutineContainer::bind('redis', fn() => new stdClass());
    CoroutineContainer::bind('logger', fn() => new stdClass());
    
    for ($i = 0; $i < 3; $i++) {
        go(function () use ($i) {
            $db = CoroutineContainer::make('db');
            $db2 = CoroutineContainer::make('db');
            echo "[Co {$i}] db singleton: " . ($db === $db2 ? 'yes' : 'no') . "\n";
        });
    }
    
    Coroutine::sleep(0.01);
});
```

**演进思路：**
- v1 → 理解基本 Context 读写
- v2 → 实用场景：请求级日志追踪
- v3 → 进阶：协程级服务容器（DI Container）
