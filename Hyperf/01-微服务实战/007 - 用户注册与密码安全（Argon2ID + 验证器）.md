---
title: "007 - 用户注册与密码安全（Argon2ID + 验证器）"
slug: "007-user-register-security"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.747+08:00"
updated_at: "2026-05-01T22:22:55.883+08:00"
reading_time: 5
tags: []
---

# 用户注册与密码安全

> **难度：** ⭐⭐⭐
> **前置知识：** 数据库设计（006）、HTTP 请求处理
> **预估用时：** 60 分钟

---

## 一、概念讲解

**一句话定义：** 用户注册是创建新用户账户的流程，核心是身份验证（邮箱/手机）和密码安全存储。

**现实类比：** 你去银行开户——出示身份证（身份验证）、设置密码（凭证管理）、领取银行卡（账号凭证）。密码像保险箱钥匙，银行不保存钥匙副本，只存储开锁的"特征码"（hash），即使银行被攻破，小偷也无法还原你的钥匙。

**技术场景：** 用户服务需要支持邮箱注册、手机号注册，验证邮箱格式、密码强度，使用 bcrypt 存储密码哈希。注册流程还要考虑：邮箱验证、防刷注册、欢迎邮件发送。

---

## 二、实时脑图

```
用户注册流程
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  请求校验 │───→│ 密码强度 │───→│ 账号查重 │───→│ 存储用户 │
├──────────┤    ├──────────┤    ├──────────┤    ├──────────┤
│邮箱/手机  │    │长度+规则  │    │UNIQUE    │    │password  │
│必填+格式  │    │强度检测  │    │重复检查   │    │hash存储   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                    │
                                                    ▼
                                          ┌──────────────┐
                                          │ 发送欢迎邮件 │
                                          │ (异步队列)    │
                                          └──────────────┘
```

---

## 三、完整代码

### 3.1 密码验证器

```php
<?php
// ✅ app/Validator/PasswordValidator.php

declare(strict_types=1);

namespace App\Validator;

class PasswordValidator
{
    // ✅ Validate password strength
    public static function validate(string $password): array
    {
        $errors = [];

        // 🟢 Check minimum length
        if (strlen($password) < 8) {
            $errors[] = 'Password must be at least 8 characters';
        }

        // 🟢 Check for uppercase letter
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Password must contain at least one uppercase letter';
        }

        // 🟢 Check for lowercase letter
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Password must contain at least one lowercase letter';
        }

        // 🟢 Check for number
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'Password must contain at least one number';
        }

        return $errors;
    }

    // ✅ Calculate password strength score (0-100)
    public static function getStrength(string $password): int
    {
        $score = 0;

        $score += min(strlen($password) * 2, 30);
        $score += preg_match('/[a-z]/', $password) ? 10 : 0;
        $score += preg_match('/[A-Z]/', $password) ? 10 : 0;
        $score += preg_match('/[0-9]/', $password) ? 10 : 0;
        $score += preg_match('/[^A-Za-z0-9]/', $password) ? 20 : 0;
        $score += strlen($password) >= 12 ? 20 : 0;

        return min($score, 100);
    }
}
```

### 3.2 注册 Service

```php
<?php
// ✅ app/Service/UserService.php

declare(strict_types=1);

namespace App\Service;

use App\Model\User;
use App\Model\UserProfile;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Psr\Log\LoggerInterface;

class UserService
{
    #[Inject]
    private LoggerInterface $logger;

    // ✅ Register new user
    public function register(array $data): array
    {
        // 🟢 Validate input
        $errors = $this->validateRegistration($data);
        if (!empty($errors)) {
            return ['code' => 400, 'message' => 'Validation failed', 'errors' => $errors];
        }

        try {
            return Db::transaction(function () use ($data) {
                // Check duplicate email/phone
                $exists = User::query()
                    ->where('email', $data['email'] ?? null)
                    ->orWhere('phone', $data['phone'] ?? null)
                    ->first();

                if ($exists) {
                    return ['code' => 409, 'message' => 'Email or phone already registered'];
                }

                // Create user record
                $user = User::create([
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'] ?? null,
                    'username' => $data['username'] ?? $this->generateUsername(),
                    'password' => $data['password'],
                    'status' => 'active',
                ]);

                // Create user profile
                UserProfile::create([
                    'user_id' => $user->id,
                    'nickname' => $data['username'] ?? $user->username,
                ]);

                $this->logger->info('User registered', ['user_id' => $user->id]);

                return [
                    'code' => 0,
                    'message' => 'Registration successful',
                    'data' => ['user_id' => $user->id],
                ];
            });
        } catch (\Throwable $e) {
            $this->logger->error('Registration failed', ['error' => $e->getMessage()]);
            return ['code' => 500, 'message' => 'Registration failed, please try again'];
        }
    }

    // ✅ Validate registration input
    private function validateRegistration(array $data): array
    {
        $errors = [];

        $hasEmail = !empty($data['email']);
        $hasPhone = !empty($data['phone']);

        if (!$hasEmail && !$hasPhone) {
            $errors[] = 'Email or phone number is required';
        }

        if ($hasEmail && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email format';
        }

        if ($hasPhone && !preg_match('/^1[3-9]\d{9}$/', $data['phone'])) {
            $errors[] = 'Invalid phone number format';
        }

        if (empty($data['password'])) {
            $errors[] = 'Password is required';
        } else {
            $passwordErrors = PasswordValidator::validate($data['password']);
            $errors = array_merge($errors, $passwordErrors);
        }

        if (empty($data['password_confirmation'])) {
            $errors[] = 'Password confirmation is required';
        } elseif ($data['password'] !== $data['password_confirmation']) {
            $errors[] = 'Password confirmation does not match';
        }

        return $errors;
    }

    private function generateUsername(): string
    {
        return 'user_' . strtolower(bin2hex(random_bytes(8)));
    }
}
```

---

## 四、执行预览

```bash
# ✅ Successful registration
$ curl -X POST http://127.0.0.1:9501/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hahn@example.com","username":"hahn","password":"Test1234","password_confirmation":"Test1234"}'
{
  "code": 0,
  "message": "Registration successful",
  "data": {"user_id": 1}
}

# ❌ Weak password
$ curl -X POST http://127.0.0.1:9501/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123","password_confirmation":"123"}'
{
  "code": 400,
  "message": "Validation failed",
  "errors": [
    "Password must be at least 8 characters",
    "Password must contain at least one uppercase letter",
    "Password must contain at least one number"
  ]
}
```

---

## 五、注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 密码必须 bcrypt 存储 | 单向加密，无法破解 | 数据库泄露可还原密码 |
| UNIQUE 约束防重复 | email/phone 唯一 | 重复注册，数据不一致 |
| 事务保证一致性 | user + profile 同时创建 | 孤儿记录，数据损坏 |
| 密码强度检测 | 最小长度 + 字符类型 | 弱密码被暴力破解 |

---

## 六、避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 存储密码明文 | 数据库泄露 = 全盘崩溃 | 始终 `password_hash()` 存储 |
| ❌ 不检查重复注册 | 同一邮箱多账户 | 注册前 UNIQUE 查询 |
| ❌ 事务范围不足 | 用户创建成功，profile 失败 | 整个注册逻辑包在事务里 |

---

## 七、练习题

🟢 **基础题 1：** 实现手机号注册功能，验证中国手机号格式（1开头，第二位3-9，共11位）。

🟢 **基础题 2：** 添加密码强度评分接口，返回 0-100 分和强度等级（弱/中/强）。

🟡 **进阶题：** 实现邮箱验证码注册流程：发送验证码 → 用户输入验证码 → 验证后创建账户。

🔴 **开放题：** 设计防刷注册机制：同一 IP 1 小时内最多注册 3 次，使用 Redis 计数器实现。

---

## 八、知识点总结

```
用户注册
├── 数据验证
│   ├── 邮箱/手机必填选一
│   ├── 格式验证
│   ├── 密码强度规则
│   └── 确认密码匹配
├── 安全存储
│   ├── password_hash() — bcrypt
│   ├── password_verify() — 验证
│   ├── 唯一约束
│   └── 软删除
└── 业务逻辑
    ├── 重复账号检查
    ├── 事务数据一致性
    └── 默认用户名生成
```

---

## 九、举一反三

| 变种场景 | 关键差异 | 适配方式 |
|----------|----------|----------|
| 第三方登录注册 | OAuth2 微信/Google 登录 | 绑定已有账号或自动创建 |
| 邮箱验证码注册 | 输入邮箱 → 发送验证码 → 注册 | 增加验证码验证步骤 |
| 手机号注册（无密码） | 仅用短信验证码 | 验证码作为临时凭证 |

---

## 十、参考资料

| 资料 | 权威等级 | 链接 |
|------|----------|------|
| PHP password 函数 | ⭐⭐⭐⭐⭐ | https://www.php.net/manual/zh/ref.password.php |
| OWASP 密码存储指南 | ⭐⭐⭐⭐⭐ | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |

---

## 十一、代码演进

### v1 ❌ 不安全的注册实现

```php
<?php
// ❌ No validation, plain password storage
public function register(array $data): array
{
    DB::table('users')->insert([
        'email' => $data['email'],
        'password' => $data['password'],  // ❌ Plain text!
    ]);
    return ['success' => true];
}
```

### v2 ✅ 基本验证 + hash

```php
<?php
// ✅ Validation + password hash
public function register(array $data): array
{
    if (empty($data['email']) || empty($data['password'])) {
        return ['error' => 'Email and password required'];
    }

    $hashed = password_hash($data['password'], PASSWORD_BCRYPT);

    DB::table('users')->insert([
        'email' => $data['email'],
        'password' => $hashed,
    ]);

    return ['success' => true];
}
```

### v3 🟢 生产级注册服务

```php
<?php
// 🟢 Full validation + transaction + error handling
public function register(array $data): array
{
    $errors = $this->validateRegistration($data);
    if (!empty($errors)) {
        return ['code' => 400, 'message' => 'Validation failed', 'errors' => $errors];
    }

    try {
        return Db::transaction(function () use ($data) {
            $exists = User::where('email', $data['email'])->exists();
            if ($exists) {
                return ['code' => 409, 'message' => 'Email already registered'];
            }

            $user = User::create([
                'email' => $data['email'],
                'username' => $data['username'] ?? $this->generateUsername(),
                'password' => $data['password'],
                'status' => 'active',
            ]);

            UserProfile::create([
                'user_id' => $user->id,
                'nickname' => $data['username'] ?? $user->username,
            ]);

            $this->logger->info('User registered', ['user_id' => $user->id]);

            return ['code' => 0, 'data' => ['user_id' => $user->id]];
        });
    } catch (\Throwable $e) {
        $this->logger->error('Registration failed', ['error' => $e->getMessage()]);
        return ['code' => 500, 'message' => 'Registration failed'];
    }
}
```

---

**上一篇：** [006 - 用户服务项目初始化与数据库设计](/post/006-user-service-init)
**下一篇：** [008 - 用户登录与 JWT 认证体系](/post/008-user-login-jwt)
