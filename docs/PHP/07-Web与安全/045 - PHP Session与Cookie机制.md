---
title: "PHP Session与Cookie机制"
slug: "php-session-and-cookie"
category: "Web与安全"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "Session", "Cookie", "安全"]
---

# PHP Session与Cookie机制

## Session生命周期

PHP Session的完整流程：

1. 客户端首次请求（无Cookie）→ PHP调用`session_start()` → 生成SessionID → 通过Cookie发送给客户端
2. 客户端再次请求（带Cookie）→ PHP读取SessionID → 从存储中加载Session数据 → `$_SESSION`可用
3. 请求结束 → PHP将`$_SESSION`序列化写入存储

```php
<?php
// php.ini关键配置
// session.save_handler = files        — 存储方式
// session.save_path = /tmp            — 存储路径
// session.name = PHPSESSID            — Cookie名称
// session.cookie_lifetime = 0         — Cookie过期时间（0=浏览器关闭）
// session.cookie_httponly = 1         — JS不可访问
// session.cookie_secure = 1           — 仅HTTPS
// session.cookie_samesite = Strict    — CSRF防护
// session.gc_maxlifetime = 1440       — 垃圾回收时间（秒）
// session.use_strict_mode = 1         — 拒绝不存在的SessionID

// 基础使用
session_start(); // 开启session（必须在任何输出之前）

$_SESSION['user_id'] = 123;
$_SESSION['username'] = '张三';
$_SESSION['login_time'] = time();

// 读取
$userId = $_SESSION['user_id'] ?? null;

// 删除单个
unset($_SESSION['user_id']);

// 销毁整个Session
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 3600,
        $params['path'], $params['domain'],
        $params['secure'], $params['httponly']
    );
}
session_destroy();
```

### Session安全配置

```php
<?php
// 推荐的安全Session配置
ini_set('session.cookie_httponly', '1');   // 防XSS窃取Cookie
ini_set('session.cookie_secure', '1');     // 仅HTTPS传输
ini_set('session.cookie_samesite', 'Strict'); // 防CSRF
ini_set('session.use_strict_mode', '1');   // 防Session Fixation
ini_set('session.use_only_cookies', '1');  // 不通过URL传递SessionID
ini_set('session.sid_length', '48');       // SessionID长度
ini_set('session.sid_bits_per_character', '6'); // 每字符信息量

session_start();

// 登录后重新生成SessionID（防Session Fixation攻击）
session_regenerate_id(true); // true=删除旧Session文件
```

## 自定义Session存储

```php
<?php
// 将Session存储到Redis（生产环境必备）
class RedisSessionHandler implements SessionHandlerInterface
{
    private Redis $redis;
    private string $prefix;
    private int $ttl;

    public function __construct(Redis $redis, string $prefix = 'sess:', int $ttl = 3600)
    {
        $this->redis = $redis;
        $this->prefix = $prefix;
        $this->ttl = $ttl;
    }

    public function open(string $path, string $name): bool
    {
        return true; // 连接已在构造函数中建立
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $data = $this->redis->get($this->prefix . $id);
        return $data !== false ? $data : '';
    }

    public function write(string $id, string $data): bool
    {
        return $this->redis->setex($this->prefix . $id, $this->ttl, $data);
    }

    public function destroy(string $id): bool
    {
        $this->redis->del($this->prefix . $id);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        return 0; // Redis通过TTL自动清理，不需要GC
    }
}

// 注册
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

$handler = new RedisSessionHandler($redis, 'app:sess:', 7200);
session_set_save_handler($handler, true); // true=注册shutdown_function

session_start();
$_SESSION['data'] = '存储在Redis中';
```

## 分布式Session

多台Web服务器共享Session的方案：

### 方案1：Redis集中存储（推荐）

```php
<?php
// 所有Web服务器连接同一个Redis集群
// 配置同上，Redis存储天然支持跨服务器共享

// Redis集群配置
$redis = new Redis();
$redis->connect('redis-cluster.internal', 6379);
$redis->auth(getenv('REDIS_PASSWORD'));

// 使用Redis Sentinel实现高可用
// 或者用Redis Cluster（分片）
```

### 方案2：数据库存储

```php
<?php
class DatabaseSessionHandler implements SessionHandlerInterface
{
    public function __construct(private PDO $pdo) {}

    public function read(string $id): string|false
    {
        $stmt = $this->pdo->prepare(
            'SELECT data FROM sessions WHERE id = ? AND expire_at > ?'
        );
        $stmt->execute([$id, time()]);
        return $stmt->fetchColumn() ?: '';
    }

    public function write(string $id, string $data): bool
    {
        $expireAt = time() + ini_get('session.gc_maxlifetime');
        $stmt = $this->pdo->prepare(
            'INSERT INTO sessions (id, data, expire_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = ?, expire_at = ?'
        );
        $stmt->execute([$id, $data, $expireAt, $data, $expireAt]);
        return true;
    }

    public function destroy(string $id): bool
    {
        $this->pdo->prepare('DELETE FROM sessions WHERE id = ?')->execute([$id]);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        return $this->pdo->prepare('DELETE FROM sessions WHERE expire_at < ?')
            ->execute([time()]);
    }

    public function open(string $path, string $name): bool { return true; }
    public function close(): bool { return true; }
}
```

## Cookie机制

### Cookie属性与安全

```php
<?php
// 设置Cookie（完整参数）
setcookie(
    'auth_token',          // 名称
    $token,                // 值
    [
        'expires'  => time() + 86400 * 30,  // 30天
        'path'     => '/',                    // 整站有效
        'domain'   => '.example.com',         // 含子域名
        'secure'   => true,                   // 仅HTTPS
        'httponly'  => true,                   // JS不可读
        'samesite' => 'Lax',                  // CSRF防护
    ]
);

// SameSite属性说明
// Strict — 完全禁止第三方携带（最安全，但从外部链接进入不带Cookie）
// Lax    — GET请求允许携带，POST禁止（推荐默认值）
// None   — 允许第三方携带（必须配合Secure）

// 删除Cookie
setcookie('auth_token', '', [
    'expires' => time() - 3600,
    'path' => '/',
    'domain' => '.example.com',
    'secure' => true,
    'httponly' => true,
]);

// Cookie vs Session选择
// Cookie: 用户偏好、语言、主题等非敏感数据（客户端存储，4KB限制）
// Session: 登录状态、购物车等敏感数据（服务端存储，无大小限制）
```

### JWT vs Session

```php
<?php
// JWT Token认证（无状态，适合API）
function createJwtToken(int $userId, string $role): string
{
    $header = base64_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64_encode(json_encode([
        'sub' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + 3600,
    ]));
    $signature = base64_encode(hash_hmac('sha256', "{$header}.{$payload}", JWT_SECRET, true));

    return "{$header}.{$payload}.{$signature}";
}

// 设置HttpOnly Cookie存储JWT
$token = createJwtToken($user['id'], $user['role']);
setcookie('auth_token', $token, [
    'expires' => time() + 3600,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict',
]);
```

## 面试常见追问

**Q: Session和Cookie有什么区别？**
A: Session存储在服务端，Cookie存储在客户端。Session通过Cookie中的SessionID关联（也可通过URL传递）。Session无大小限制，Cookie约4KB。Session更安全（数据不暴露给客户端），但占用服务端内存/存储。

**Q: Session Fixation攻击是什么？怎么防护？**
A: 攻击者获取一个有效的SessionID，诱导受害者使用这个ID登录。登录后攻击者可以用同一个ID访问受害者的Session。防护：1) 登录成功后调用`session_regenerate_id(true)`；2) 开启`session.use_strict_mode`（拒绝不存在的ID）；3) 绑定IP/UA等额外信息。

**Q: 分布式环境Session一致性怎么保证？**
A: 三种方案：1) **Redis集中存储**（最推荐）— 所有服务器连同一个Redis；2) **Sticky Session**（Nginx IP Hash）— 同一用户始终路由到同一台服务器，但不利于负载均衡；3) **JWT无状态认证**— 不用Session，Token自包含用户信息。
