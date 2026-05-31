---
title: "PHP CORS与API安全设计"
slug: "php-cors-api-security"
category: "Web与安全"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "安全", "CORS", "API"]
---

# PHP CORS与API安全设计

前后端分离架构下，CORS（跨域资源共享）配置错误是API安全的高频问题。加上认证授权和限流，构成API安全的三大支柱。

## CORS原理与配置

### 什么是CORS

浏览器的同源策略禁止网页向不同源（协议+域名+端口）发请求。CORS是服务端通过HTTP头告诉浏览器"允许这个跨域"的机制。

### 简单请求 vs 预检请求

- **简单请求**：GET/POST，Content-Type为text/plain、multipart/form-data、application/x-www-form-urlencoded，浏览器直接发送
- **预检请求**：其他情况（自定义Header、PUT/DELETE、application/json），浏览器先发OPTIONS请求询问

### 完整CORS中间件

```php
<?php
class CorsMiddleware {
    private array $allowedOrigins;
    private array $allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    private array $allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'];
    private int $maxAge = 86400;
    
    public function __construct(array $allowedOrigins) {
        $this->allowedOrigins = $allowedOrigins;
    }
    
    public function handle(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        // 动态Origin（不使用通配符*，因为需要携带Cookie）
        if (in_array($origin, $this->allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        } elseif (!empty($origin)) {
            // Origin不在白名单，拒绝跨域
            http_response_code(403);
            exit('CORS origin not allowed');
        }
        
        header('Access-Control-Allow-Methods: ' . implode(', ', $this->allowedMethods));
        header('Access-Control-Allow-Headers: ' . implode(', ', $this->allowedHeaders));
        header("Access-Control-Max-Age: {$this->maxAge}");
        
        // 处理预检请求
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}

// 使用
$cors = new CorsMiddleware(['https://app.example.com', 'https://admin.example.com']);
$cors->handle();
```

### 常见配置错误

```php
<?php
// 错误1: 允许所有Origin + Credentials
// 浏览器会拒绝 Access-Control-Allow-Origin: * + Credentials: true
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true'); // 无效！

// 错误2: 直接反射Origin（相当于允许所有）
header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']); // 危险！

// 错误3: 预检请求不返回204，继续执行业务逻辑
// OPTIONS请求应该直接返回，不要继续路由到控制器
```

## Rate Limiting：令牌桶算法

```php
<?php
class TokenBucketRateLimiter {
    private Redis $redis;
    
    public function __construct(Redis $redis) {
        $this->redis = $redis;
    }
    
    /**
     * 令牌桶限流
     * @param string $key 限流标识（IP或用户ID）
     * @param int $maxTokens 桶容量（最大突发请求数）
     * @param int $refillRate 每秒补充令牌数
     */
    public function allow(string $key, int $maxTokens = 60, int $refillRate = 1): bool {
        $redisKey = "rate_limit:{$key}";
        $now = microtime(true);
        
        // Lua脚本保证原子性
        $script = <<<'LUA'
        local key = KEYS[1]
        local max_tokens = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or max_tokens
        local last_refill = tonumber(bucket[2]) or now
        
        -- 计算补充的令牌数
        local elapsed = now - last_refill
        tokens = math.min(max_tokens, tokens + elapsed * refill_rate)
        
        if tokens >= 1 then
            tokens = tokens - 1
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, max_tokens / refill_rate + 60)
            return 1
        else
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            return 0
        end
        LUA;
        
        $result = $this->redis->eval($script, [$redisKey, $maxTokens, $refillRate, $now], 1);
        
        if (!$result) {
            header('Retry-After: ' . (int)ceil((1 - ($maxTokens - 1) / $refillRate)));
            header('X-RateLimit-Limit: ' . $maxTokens);
            http_response_code(429);
            echo json_encode(['error' => 'Too many requests']);
            exit;
        }
        
        return true;
    }
}

// 使用：按IP限流
$limiter = new TokenBucketRateLimiter($redis);
$limiter->allow($_SERVER['REMOTE_ADDR'], 60, 1); // 60次突发，每秒恢复1次
```

## 认证方案对比

| 方案 | 适用场景 | 复杂度 | 无状态 |
|------|----------|--------|--------|
| API Key | 服务间调用、简单API | 低 | 是 |
| JWT | 前后端分离、移动端 | 中 | 是 |
| OAuth2 | 第三方授权、SSO | 高 | 否 |

```php
<?php
// API Key认证（最简单）
class ApiKeyAuth {
    public function authenticate(): ?array {
        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if (empty($key)) {
            return null;
        }
        // 数据库或Redis查询
        return $this->resolveApiKey($key);
    }
}

// Bearer Token（JWT）
class BearerAuth {
    public function getToken(): ?string {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
            return $matches[1];
        }
        return null;
    }
}
```

## 面试常见追问

**Q: CORS是安全机制还是安全威胁？**
A: CORS是浏览器的**放宽**同源策略的机制，不是安全防护。配置不当（允许所有Origin）反而会降低安全性。真正的安全靠认证和授权。

**Q: 为什么`Access-Control-Allow-Origin: *`不能配合Credentials？**
A: 如果允许任意域名携带Cookie，等于任何网站都能以用户身份访问API。浏览器强制要求明确指定Origin才能带Credentials。

**Q: 令牌桶和漏桶有什么区别？**
A: 令牌桶允许突发流量（桶满时瞬间消费所有令牌），漏桶强制匀速输出。API限流通常用令牌桶（允许合理突发），流量整形用漏桶。

**Q: API Key放在URL还是Header里？**
A: 放Header（`X-API-Key`）更安全。URL会出现在日志、浏览器历史、Referer头中。如果必须放URL（如Webhook回调），使用短期有效的一次性Key。
