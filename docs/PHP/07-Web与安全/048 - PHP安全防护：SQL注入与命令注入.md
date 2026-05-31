---
title: "PHP安全防护：SQL注入与命令注入"
slug: "php-sql-injection-command-injection"
category: "Web与安全"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "安全", "SQL注入", "命令注入"]
:v-pre:
---# PHP安全防护：SQL注入与命令注入

SQL注入连续多年位居OWASP Top 10榜首，命令注入则在系统交互场景中威胁巨大。两者都能导致数据泄露甚至服务器被完全控制。

## SQL注入原理

SQL注入的本质是：**用户输入被直接拼接到SQL语句中，改变了SQL的语义**。

```php
<?php
// 危险！经典的注入场景
$id = $_GET['id'];
$sql = "SELECT * FROM users WHERE id = $id";
// 输入 id=1 OR 1=1 → 返回所有用户
// 输入 id=1 UNION SELECT password FROM admin -- → 联合查询泄露数据

// 即使加了引号也不安全
$name = $_GET['name'];
$sql = "SELECT * FROM users WHERE name = '$name'";
// 输入 name=admin' -- → 闭合引号后注释掉后续条件
```

### 预处理语句：唯一的正确方案

PDO预处理分两步：1) 发送SQL结构（含占位符）；2) 发送参数值。**参数值永远不会被解析为SQL语法**。

```php
<?php
$pdo = new PDO('mysql:host=localhost;dbname=test', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,  // 关键！使用真正的预处理
]);

// 位置占位符
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND status = ?');
$stmt->execute([$id, $status]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 命名占位符
$stmt = $pdo->prepare('INSERT INTO orders (user_id, amount, created_at) VALUES (:uid, :amount, NOW())');
$stmt->execute([':uid' => $userId, ':amount' => $amount]);

// 动态IN查询 — 预处理不能直接绑数组，需要动态构建占位符
$ids = [1, 2, 3, 4, 5];
$placeholders = implode(',', array_fill(0, count($ids), '?'));
$stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ($placeholders)");
$stmt->execute($ids);
```

### 为什么必须关闭 emulate_prepares

```php
<?php
// ATTR_EMULATE_PREPARES = true（默认）时：
// PDO在客户端模拟预处理，实际还是拼接SQL字符串发给MySQL
// 某些边界情况下仍可能被绕过

// ATTR_EMULATE_PREPARES = false 时：
// MySQL服务端执行真正的预处理，参数通过二进制协议传输
// 从协议层面杜绝注入可能

$pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
```

### PDO::quote的局限性

```php
<?php
// quote只是字符串转义，不是预处理
$name = $pdo->quote($_GET['name']);
$sql = "SELECT * FROM users WHERE name = $name";  // 仅限字符串值

// 局限1: 不能用于表名、列名、ORDER BY
$column = $pdo->quote($_GET['sort']);  // 错误用法！会被加上引号
$sql = "SELECT * FROM users ORDER BY $column";  // ORDER BY 'name' 无效

// 局限2: 数值型注入
$id = $pdo->quote($_GET['id']);  // '123' 虽然安全但改变了语义
$sql = "SELECT * FROM users WHERE id = $id";  // id = '123' 索引可能失效

// 正确做法：标识符用白名单，值用预处理
$allowedSort = ['name', 'created_at', 'id'];
$sort = in_array($_GET['sort'] ?? 'id', $allowedSort, true) ? $_GET['sort'] : 'id';
$stmt = $pdo->prepare("SELECT * FROM users ORDER BY $sort LIMIT ?");
$stmt->execute([$limit]);
```

## 命令注入

当PHP调用系统命令且包含用户输入时，攻击者可以注入Shell元字符（`; | & ` \` $()`）执行任意命令。

### escapeshellarg 与 escapeshellcmd

```php
<?php
// escapeshellarg: 给整个参数加单引号并转义内部单引号
$file = escapeshellarg($_GET['file']);
$output = shell_exec("grep -r 'keyword' $file");
// 输入: test; rm -rf /
// 转义后: 'test; rm -rf /'  → 作为单个文件名参数

// escapeshellcmd: 转义Shell元字符（#&;|*?~<>^()[]{}$\, \x0A, \xFF）
$cmd = escapeshellcmd($_GET['cmd']);
system($cmd);  // 比shell_exec更危险，直接输出

// 实际最佳实践：尽量避免系统调用
// Bad
system('convert ' . $_GET['file'] . ' output.png');

// Good - 用escapeshellarg包裹每个参数
$file = escapeshellarg($_GET['file']);
system('convert ' . $file . ' ' . escapeshellarg('output.png'));

// Best - 用PHP原生库替代
$imagick = new Imagick($_GET['file']);
$imagick->writeImage('output.png');
```

### 白名单过滤

对于有限的合法选项，白名单是最安全的方案：

```php
<?php
// 命令参数白名单
class SafeCommandExecutor {
    private array $allowedActions = ['resize', 'crop', 'rotate'];
    private array $allowedFormats = ['jpg', 'png', 'gif', 'webp'];

    public function execute(string $action, string $format, int $quality): string {
        if (!in_array($action, $this->allowedActions, true)) {
            throw new InvalidArgumentException("Invalid action: $action");
        }
        if (!in_array($format, $this->allowedFormats, true)) {
            throw new InvalidArgumentException("Invalid format: $format");
        }
        $quality = max(1, min(100, $quality)); // 范围限制

        // 白名单验证后仍然用escapeshellarg
        return shell_exec(sprintf(
            'imagecli %s --format %s --quality %d',
            escapeshellarg($action),
            escapeshellarg($format),
            $quality  // 整数类型安全
        ));
    }
}
```

## 面试常见追问

**Q: 预处理能防所有SQL注入吗？**
A: 不能。预处理只保护值（WHERE/VALUES），不保护SQL结构（表名、列名、ORDER BY、LIMIT）。动态标识符必须用白名单。

**Q: `PDO::ATTR_EMULATE_PREPARES`什么时候必须开？**
A: 某些旧版MySQL（<5.1.17）不支持服务端预处理；使用MySQL Proxy等中间件时可能有兼容问题。正常项目应该关闭。

**Q: 如何防御二次注入？**
A: 数据第一次入库用了预处理所以安全，但存入数据库的数据本身含恶意内容。第二次使用时如果从数据库读取后直接拼接SQL，就会触发。防护：所有SQL都用预处理，无论数据来源。

**Q: 命令注入和SQL注入哪个危害更大？**
A: 命令注入通常更严重，直接获得操作系统级别的执行权限。SQL注入限于数据库操作，但MySQL的`INTO OUTFILE`和`LOAD_FILE`也能间接执行系统命令。

**Q: 为什么不直接禁用system/exec函数？**
A: 生产环境建议`disable_functions = system,exec,shell_exec,passthru`。如果确实需要，用`proc_open`配合白名单，比`system`更可控。
