---
title: "016 - Swoole MySQL 协程客户端详解：高性能数据库操作"
slug: "016-coroutine-mysql"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:10:21.556+08:00"
updated_at: "2026-04-29T10:02:47.004+08:00"
reading_time: 29
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐⭐☆☆ 中高级

**前置知识：** MySQL 基础、PDO/MySQLi 使用经验、协程基础
**预计学习时间：** 60 分钟

---

## 概念讲解

### 为什么需要 MySQL 协程客户端？

传统 PHP 中，MySQL 查询是**同步阻塞**的。一个查询耗时 100ms，整个进程就被卡住 100ms。在高并发场景下，这是巨大的浪费。

Swoole 的 MySQL 协程客户端在执行查询时**自动挂起当前协程**，让出 CPU 给其他协程使用。查询完成后**自动恢复**执行。代码看起来和同步写法一样，但底层是异步非阻塞的。

```
传统模式（阻塞）：
请求1 → [==DB查询100ms==] → 返回
请求2 →                     等待... → [==DB查询100ms==] → 返回
总耗时：200ms

协程模式（非阻塞）：
请求1 → [==挂起，等待DB==]
请求2 → [==挂起，等待DB==]
         ↓ DB同时处理两个查询 ↓
请求1 → 恢复 → 返回
请求2 → 恢复 → 返回  
总耗时：~100ms
```

### Swoole\Coroutine\MySQL vs PDO

| 特性 | PDO | Swoole Coroutine MySQL |
|------|-----|----------------------|
| 阻塞行为 | 阻塞进程 | 非阻塞，协程自动切换 |
| 并发能力 | 低 | 高 |
| 连接池 | 外部实现 | 配合 Channel 轻松实现 |
| 预处理 | ✅ 原生支持 | ✅ 支持 |
| 事务 | ✅ | ✅ |
| 连接复用 | 需外部管理 | 协程级隔离+连接池 |
| 语法复杂度 | 简单 | 略复杂（回调风格） |

### 核心 API

```php
use Swoole\Coroutine\MySQL;

$db = new MySQL();
$db->connect(['host' => '127.0.0.1', 'port' => 3306, ...]);
$db->query('SELECT ...');         // Direct query
$db->prepare('SELECT ... WHERE id=?');  // Prepared statement
$db->begin();                     // Transaction
$db->commit(); / $db->rollback();
```

---

## 脑图（ASCII）

```
Swoole MySQL 协程客户端
├── 连接管理
│   ├── connect() 连接
│   ├── 自动重连
│   ├── 连接超时
│   └── 字符集设置
├── 查询操作
│   ├── query() 直接查询
│   ├── prepare() 预处理
│   ├── execute() 执行
│   └── affected_rows / insert_id
├── 事务处理
│   ├── begin()
│   ├── commit()
│   └── rollback()
├── 连接池
│   ├── Channel 实现
│   ├── 借出/归还
│   ├── 心跳检测
│   └── 最小/最大连接数
└── 最佳实践
    ├── 协程级连接隔离
    ├── 错误处理
    ├── 超时设置
    └── SQL 注入防护
```

---

## 完整代码示例

### 示例 1：基础 CRUD 操作

```php
<?php
// 016_mysql_crud.php
// Basic CRUD operations with Swoole MySQL coroutine client

use Swoole\Coroutine\MySQL;
use function Swoole\Coroutine\run;

run(function () {
    $db = new MySQL();
    $connected = $db->connect([
        'host' => '127.0.0.1',
        'port' => 3306,
        'user' => 'root',
        'password' => '',
        'database' => 'test',
        'charset' => 'utf8mb4',
        'timeout' => 5.0,
    ]);
    
    if (!$connected) {
        echo "Connection failed: {$db->connect_error}\n";
        return;
    }
    
    echo "Connected! Server info: {$db->serverInfo}\n\n";
    
    // Create table
    $db->query("CREATE TABLE IF NOT EXISTS `users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `email` VARCHAR(255) NOT NULL UNIQUE,
        `age` INT DEFAULT 0,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    // INSERT
    $result = $db->query("INSERT INTO users (name, email, age) VALUES ('Alice', 'alice@example.com', 25)");
    echo "INSERT: affected={$db->affected_rows}, insert_id={$db->insert_id}\n";
    
    // SELECT
    $users = $db->query('SELECT * FROM users ORDER BY id DESC LIMIT 10');
    echo "SELECT: found " . count($users) . " rows\n";
    foreach ($users as $user) {
        echo "  - #{$user['id']} {$user['name']} ({$user['email']})\n";
    }
    
    // UPDATE
    $db->query("UPDATE users SET age = 26 WHERE name = 'Alice'");
    echo "UPDATE: affected={$db->affected_rows}\n";
    
    // DELETE
    $db->query("DELETE FROM users WHERE id > 100");
    echo "DELETE: affected={$db->affected_rows}\n";
});
```

### 示例 2：预处理语句与事务

```php
<?php
// 016_prepare_transaction.php
// Prepared statements and transaction handling

use Swoole\Coroutine\MySQL;
use function Swoole\Coroutine\run;

run(function () {
    $db = new MySQL();
    $db->connect([
        'host' => '127.0.0.1',
        'user' => 'root',
        'password' => '',
        'database' => 'test',
        'charset' => 'utf8mb4',
    ]);
    
    // Prepared statement
    $stmt = $db->prepare('SELECT * FROM users WHERE age > ? AND name LIKE ?');
    if (!$stmt) {
        echo "Prepare failed: {$db->error}\n";
        return;
    }
    
    $result = $stmt->execute([18, '%ali%']);
    echo "Found " . count($result) . " users matching criteria\n";
    
    // Transaction example: transfer money
    $db->query('CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        balance DECIMAL(10,2) DEFAULT 0
    )');
    
    $db->begin();
    try {
        // Deduct from Alice
        $db->query('UPDATE accounts SET balance = balance - 100 WHERE name = "Alice"');
        if ($db->affected_rows === 0) throw new \Exception('Alice not found');
        
        // Add to Bob
        $db->query('UPDATE accounts SET balance = balance + 100 WHERE name = "Bob"');
        if ($db->affected_rows === 0) throw new \Exception('Bob not found');
        
        $db->commit();
        echo "Transfer successful!\n";
    } catch (\Exception $e) {
        $db->rollback();
        echo "Transfer failed: {$e->getMessage()}, rolled back.\n";
    }
});
```

### 示例 3：连接池实现

```php
<?php
// 016_connection_pool.php
// Production-ready MySQL connection pool

use Swoole\Coroutine;
use Swoole\Coroutine\MySQL;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class MySQLPool
{
    private Channel $pool;
    private int $minSize;
    private int $maxSize;
    private array $config;
    private int $created = 0;

    public function __construct(array $config, int $minSize = 2, int $maxSize = 10)
    {
        $this->config = $config;
        $this->minSize = $minSize;
        $this->maxSize = $maxSize;
        $this->pool = new Channel($maxSize);
        
        // Pre-create minimum connections
        for ($i = 0; $i < $minSize; $i++) {
            $this->pool->push($this->createConnection());
        }
    }

    private function createConnection(): MySQL
    {
        $db = new MySQL();
        $db->connect($this->config);
        $this->created++;
        return $db;
    }

    public function get(float $timeout = 5.0): MySQL
    {
        if (!$this->pool->isEmpty()) {
            return $this->pool->pop();
        }
        if ($this->created < $this->maxSize) {
            return $this->createConnection();
        }
        return $this->pool->pop($timeout);
    }

    public function put(MySQL $db): void
    {
        if ($db->connected) {
            $this->pool->push($db);
        } else {
            $this->created--;
        }
    }

    public function stats(): array
    {
        return [
            'created' => $this->created,
            'available' => $this->pool->length(),
        ];
    }
}

run(function () {
    $config = [
        'host' => '127.0.0.1',
        'user' => 'root',
        'password' => '',
        'database' => 'test',
        'charset' => 'utf8mb4',
        'timeout' => 3.0,
    ];
    
    $pool = new MySQLPool($config, 2, 5);
    
    // Concurrent queries using pool
    for ($i = 0; $i < 10; $i++) {
        go(function () use ($i, $pool) {
            $db = $pool->get();
            
            $result = $db->query('SELECT SLEEP(0.01) AS wait, NOW() AS now');
            echo "[Query {$i}] Done: " . json_encode($result[0] ?? []) . "\n";
            
            $pool->put($db);
        });
    }
    
    Coroutine::sleep(1);
    echo "\nPool stats: " . json_encode($pool->stats()) . "\n";
});
```

---

## 执行预览

### 示例 1 输出

```
$ php 016_mysql_crud.php
Connected! Server info: 5.7.xx

INSERT: affected=1, insert_id=1
SELECT: found 1 rows
  - #1 Alice (alice@example.com)
UPDATE: affected=1
DELETE: affected=0
```

### 示例 3 输出（连接池）

```
$ php 016_connection_pool.php
[Query 0] Done: {"wait":"0","now":"2026-04-28 22:00:00"}
[Query 1] Done: {"wait":"0","now":"2026-04-28 22:00:00"}
...
[Query 9] Done: {"wait":"0","now":"2026-04-28 22:00:00"}

Pool stats: {"created":5,"available":5}
```

---

## 注意事项

| 项目 | 说明 | 严重程度 |
|------|------|----------|
| 连接不是协程安全的 | 同一连接不能被多协程同时使用 | 🔴 严重 |
| 连接可能断开 | 长时间闲置需检测 connected 属性 | 🟡 中等 |
| query() 返回值不同 | SELECT 返回数组，INSERT/UPDATE 返回 bool | 🟡 中等 |
| 字符集必须设置 | 不设置可能导致中文乱码 | 🟡 中等 |
| affected_rows 时效 | 被下一条 query 覆盖，需立即读取 | 🟢 一般 |

---

## 避坑指南

### ❌ 多协程共享同一连接
```php
// WRONG: Race condition - data corruption
$db = new MySQL();
$db->connect($config);
go(function () use ($db) { $db->query('...'); });
go(function () use ($db) { $db->query('...'); }); // Conflict!
```

### ✅ 每协程一个连接或使用连接池
```php
// CORRECT: Connection pool
go(function () use ($pool) {
    $db = $pool->get();
    try {
        $db->query('...');
    } finally {
        $pool->put($db);
    }
});
```

---

### ❌ 忽略连接断开
```php
// WRONG: Connection might be stale
$result = $db->query('SELECT 1'); // May throw if disconnected
```

### ✅ 检查连接状态并重连
```php
// CORRECT: Check before use
if (!$db->connected) {
    $db->connect($config);
}
$result = $db->query('SELECT 1');
```

---

### ❌ SQL 拼接导致注入
```php
// WRONG: SQL injection vulnerability
$db->query("SELECT * FROM users WHERE name = '{$_GET['name']}'");
```

### ✅ 使用预处理语句
```php
// CORRECT: Parameterized query
$stmt = $db->prepare('SELECT * FROM users WHERE name = ?');
$result = $stmt->execute([$_GET['name']]);
```

---

## 练习题

### 🟢 初级
1. 使用 Swoole MySQL 协程客户端连接数据库，查询 users 表并输出
2. 使用预处理语句插入 10 条测试数据

### 🟡 中级
3. 实现一个带心跳检测的连接池，定期 ping 检测连接是否存活
4. 使用事务实现一个简单的银行转账操作，包含余额不足检查

### 🔴 高级
5. 实现一个 MySQL 读写分离客户端：写操作走主库，读操作走从库，支持故障自动切换

<details>
<summary>参考答案（题3 - 心跳连接池）</summary>

```php
<?php
use Swoole\Coroutine;
use Swoole\Coroutine\MySQL;
use Swoole\Coroutine\Channel;
use function Swoole\Coroutine\run;

class HeartbeatMySQLPool
{
    private Channel $pool;
    private array $config;
    private int $maxSize;
    
    public function __construct(array $config, int $maxSize = 10)
    {
        $this->config = $config;
        $this->maxSize = $maxSize;
        $this->pool = new Channel($maxSize);
    }
    
    private function create(): MySQL
    {
        $db = new MySQL();
        $db->connect($this->config);
        return $db;
    }
    
    public function get(float $timeout = 5.0): MySQL
    {
        if ($this->pool->isEmpty()) return $this->create();
        
        $db = $this->pool->pop($timeout);
        // Health check
        if (!$db->connected || !$db->query('SELECT 1')) {
            return $this->create(); // Replace broken connection
        }
        return $db;
    }
    
    public function put(MySQL $db): void
    {
        if ($db->connected) {
            $this->pool->push($db);
        }
    }
}
```

</details>

---

## 知识点总结（树状）

```
Swoole MySQL 协程客户端
├── 连接管理
│   ├── connect(config)
│   ├── connected 状态检测
│   ├── 超时设置
│   └── 自动重连
├── 查询
│   ├── query() 直接查询
│   ├── prepare() + execute() 预处理
│   ├── insert_id / affected_rows
│   └── 错误处理 error / errno
├── 事务
│   ├── begin() / commit() / rollback()
│   └── try/finally 保证 rollback
├── 连接池
│   ├── Channel 实现
│   ├── get() / put() 接口
│   ├── 心跳检测
│   └── 最小/最大连接数
└── 最佳实践
    ├── 每协程独立连接
    ├── 预处理防注入
    ├── 连接池复用
    └── 超时保护
```

---

## 举一反三

| 场景 | 传统 PDO | Swoole 协程 MySQL | 提升 |
|------|---------|------------------|------|
| 10个并发查询 | 串行 ~1s | 并发 ~0.1s | ~10x |
| 批量插入 | 逐条 INSERT | 多协程并发+预处理 | ~Nx |
| 事务操作 | 阻塞等待 | 挂起让出CPU | 吞吐量提升 |
| 连接管理 | 每次新建/短连接 | 连接池复用 | 减少连接开销 |

---

## 参考资料

- [Swoole MySQL 协程客户端文档](https://wiki.swoole.com/#/coroutine_client/mysql)
- [MySQL 协议详解](https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol.html)
- [Swoole 连接池最佳实践](https://wiki.swoole.com/#/question/use?id=连接池)

---

## 代码演进

### v1：单次查询
```php
<?php
// v1: Simple query
use Swoole\Coroutine\MySQL;
use function Swoole\Coroutine\run;

run(function () {
    $db = new MySQL();
    $db->connect(['host' => '127.0.0.1', 'user' => 'root', 'password' => '', 'database' => 'test']);
    $result = $db->query('SELECT 1 AS ping');
    var_dump($result);
});
```

### v2：预处理+事务
```php
<?php
// v2: Prepared statements + transactions
// (See 示例2 above)
```

### v3：生产级连接池
```php
<?php
// v3: Production connection pool with health check
// (See 示例3 above)
```

**演进思路：**
- v1 → 基础连接和查询
- v2 → 安全查询（预处理）+ 事务保证数据一致性
- v3 → 生产级连接池：复用连接、健康检查、并发安全
