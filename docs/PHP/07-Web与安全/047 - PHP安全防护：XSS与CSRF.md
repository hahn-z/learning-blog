---
title: "PHP安全防护：XSS与CSRF"
slug: "php-xss-csrf-protection"
category: "Web与安全"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "安全", "XSS", "CSRF"]
:v-pre:
---# PHP安全防护：XSS与CSRF

XSS（跨站脚本攻击）和CSRF（跨站请求伪造）是Web应用中最常见的两种攻击手段。理解其原理并在PHP中正确防护，是每个开发者的基本功。

## XSS攻击原理与防护

### 什么是XSS

XSS的本质是：**攻击者将恶意脚本注入到页面中，在其他用户的浏览器上执行**。有三种类型：

- **存储型XSS**：恶意脚本存入数据库，所有访问该页面的用户都会执行
- **反射型XSS**：恶意脚本通过URL参数反射到页面，通常需要诱导用户点击
- **DOM型XSS**：前端JavaScript直接读取URL参数并渲染，不经过服务端

### 输出转义：htmlspecialchars

这是防护XSS的核心手段。**原则：在输出时转义，而非输入时过滤。**

```php
<?php
// 正确的转义方式
function safeEcho(string $value, int $flags = ENT_QUOTES | ENT_HTML5): string {
    return htmlspecialchars($value, $flags, 'UTF-8');
}

// 不同上下文的转义
$userInput = '<script>alert("xss")</script>';

// HTML正文上下文
echo '<p>' . safeEcho($userInput) . '</p>';
// 输出: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

// HTML属性上下文（同样用htmlspecialchars）
echo '<input value="' . safeEcho($userInput) . '">';

// JavaScript上下文 → 需要用json_encode，不是htmlspecialchars
echo '<script>var name = ' . json_encode($userInput, JSON_HEX_TAG) . ';</script>';

// URL上下文
echo '<a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">链接</a>';
```

**为什么选在输出时转义？** 因为数据可能用于不同的上下文（HTML、JS、URL、CSS），每个上下文的转义规则不同。输入时统一过滤会丢失原始数据，且无法覆盖所有场景。

### Content Security Policy（CSP）

CSP是浏览器层面的XSS防护机制，通过HTTP头告诉浏览器哪些资源可以加载：

```php
<?php
// 基本CSP配置
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");

// 报告模式（不阻断，只报告违规）
header("Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report");

// nonce方案 - 为内联脚本添加唯一令牌
$nonce = base64_encode(random_bytes(16));
header("Content-Security-Policy: script-src 'self' 'nonce-{$nonce}'");

// 页面中使用
echo "<script nonce='{$nonce}'>console.log('合法脚本');</script>";
```

## CSRF攻击原理与防护

### 什么是CSRF

CSRF利用浏览器自动携带Cookie的特性：**用户已登录A站，访问恶意B站时，B站向A站发起请求，浏览器自动带上A站的Cookie**。

### CSRF Token机制

最经典的防护方案——每个表单生成一个随机Token，服务端验证：

```php
<?php
session_start();

// 生成CSRF Token
function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

// 验证CSRF Token（使用时间常量比较防止时序攻击）
function verifyCsrfToken(string $token): bool {
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

// 表单中输出隐藏字段
// <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">

// 提交时验证
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCsrfToken($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        die('CSRF token验证失败');
    }
    // 处理业务逻辑...
}
```

### SameSite Cookie属性

现代浏览器支持SameSite属性，是最简单的CSRF防护：

```php
<?php
// SameSite=Strict: 完全禁止跨站携带Cookie（最安全但影响体验）
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,      // HTTPS only
    'httponly' => true,     // JS无法读取
    'samesite' => 'Lax'    // 合理的平衡点
]);

// Lax: 从外部链接跳转过来的GET请求会带Cookie，POST不带
// Strict: 任何跨站请求都不带Cookie
// None: 关闭SameSite（必须配合secure=true）
```

### 双重Cookie验证

适用于AJAX请求的CSRF防护方案：

```php
<?php
// 原理：攻击者无法读取跨域Cookie的值，所以无法在请求参数中带上
// 1. 设置一个CSRF Cookie
function setDoubleSubmitCookie(): void {
    $token = bin2hex(random_bytes(32));
    setcookie('csrf_cookie', $token, [
        'path' => '/',
        'secure' => true,
        'httponly' => false,  // 允许JS读取
        'samesite' => 'Strict'
    ]);
}

// 2. 前端JS读取Cookie，放到请求头
// fetch('/api/action', {
//     headers: { 'X-CSRF-Token': getCookie('csrf_cookie') }
// })

// 3. 后端验证Cookie和Header一致
function verifyDoubleSubmit(): bool {
    $cookie = $_COOKIE['csrf_cookie'] ?? '';
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($cookie) || empty($header)) {
        return false;
    }
    return hash_equals($cookie, $header);
}
```

## 多层防护策略

实际项目中应该**组合使用**多种防护：

| 防护层 | 防御目标 | 实现难度 |
|--------|----------|----------|
| htmlspecialchars输出转义 | XSS | 低 |
| CSP响应头 | XSS兜底 | 中 |
| CSRF Token | CSRF | 低 |
| SameSite Cookie | CSRF兜底 | 极低 |
| HTTPS + HttpOnly | Cookie安全 | 低 |

## 面试常见追问

**Q: htmlspecialchars的flags参数为什么要用ENT_QUOTES？**
A: 默认只转义双引号，不转义单引号。在`<input value='$var'>`这种单引号属性中，攻击者可以用`' onmouseover='alert(1)`绕过。ENT_QUOTES同时转义两种引号。

**Q: CSP的nonce和hash方案有什么区别？**
A: nonce每次请求生成随机值，灵活但需要服务端参与；hash是对脚本内容计算SHA256，固定但脚本内容不能变。nonce适合动态内容，hash适合静态脚本。

**Q: 为什么hash_equals比`===`更安全？**
A: `===`是逐字节比较，遇到不匹配立即返回（时间不恒定）。攻击者可以通过大量请求测量响应时间，逐字节猜测Token值。hash_equals无论是否匹配都执行相同时间。

**Q: SameSite=Lax够用吗？**
A: 大部分场景够用。Lax允许顶级导航的GET请求带Cookie，所以如果关键操作用GET方法就不安全。最佳实践是SameSite + CSRF Token双重防护。

**Q: 如何防护DOM型XSS？**
A: DOM型XSS发生在前端，后端转义无效。需要：1) 避免直接用innerHTML，用textContent；2) 不从location.hash/URL参数直接渲染；3) 使用CSP限制脚本来源。
