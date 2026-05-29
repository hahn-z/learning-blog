---
title: "018 - Swoole 协程 HTTP 客户端详解：从基础到连接池实战"
slug: "018-coroutine-http"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:10:21.583+08:00"
updated_at: "2026-04-29T10:02:47.02+08:00"
reading_time: 28
tags: ["Swoole", "PHP"]
---

## 难度标注

> ⭐⭐⭐☆☆ 中级 | 预计阅读时间：15分钟

适合有 Swoole 协程基础，想深入掌握 HTTP 客户端用法的开发者。

---

## 概念讲解

### 什么是协程 HTTP 客户端？

Swoole 的 `Coroutine\Http\Client` 是基于协程的 HTTP 客户端，与传统的 `curl` 或 `file_get_contents` 不同，它**完全运行在协程空间**，不会阻塞工作进程。

**传统 HTTP 请求 vs 协程 HTTP 请求：**

| 特性 | curl | Swoole HTTP Client |
|------|------|-------------------|
| 阻塞行为 | 阻塞当前进程 | 仅让出当前协程 |
| 并发能力 | 需要多线程/curl_multi | 天然支持协程并发 |
| 连接复用 | 需手动管理 | 自动 keep-alive |
| 超时控制 | 全局设置 | 精确到每次请求 |
| WebSocket | 不支持 | 原生支持 |

### 核心优势

1. **非阻塞 I/O**：等待响应时自动让出协程，不浪费 CPU
2. **连接池友好**：同一 host:port 复用 TCP 连接
3. **完整 HTTP 支持**：GET/POST/PUT/DELETE、上传下载、Cookie、Header
4. **SSL/TLS 支持**：内置 SSL，无需额外扩展

---

## 脑图

```
Coroutine\Http\Client
├── 基础用法
│   ├── GET 请求
│   ├── POST 请求
│   ├── 自定义 Header
│   └── 超时设置
├── 进阶功能
│   ├── 文件上传
│   ├── 大文件下载
│   ├── Cookie 管理
│   └── HTTPS 支持
├── 并发请求
│   ├── 多协程并发
│   ├── 连接复用
│   └── 并发控制
└── 最佳实践
    ├── 超时策略
    ├── 错误重试
    └── 连接池
```

---

## 完整代码

### v1：基础 GET/POST 请求

```php
<?php
// v1: Basic HTTP GET and POST with Swoole coroutine client

use Swoole\Coroutine\Http\Client;
use function Swoole\Coroutine\run;

run(function () {
    // --- GET Request ---
    $client = new Client('httpbin.org', 80);
    $client->setHeaders([
        'User-Agent' => 'SwooleCoroutine/1.0',
        'Accept'     => 'application/json',
    ]);
    $client->set(['timeout' => 5]);

    $client->get('/get?name=swoole&version=5.0');
    echo "[GET] Status: {$client->statusCode}\n";
    echo "[GET] Body: {$client->body}\n";
    $client->close();

    // --- POST Request with JSON ---
    $client = new Client('httpbin.org', 80);
    $client->setHeaders([
        'Content-Type' => 'application/json',
        'User-Agent'   => 'SwooleCoroutine/1.0',
    ]);

    $data = json_encode(['action' => 'test', 'payload' => 'hello']);
    $client->post('/post', $data);
    echo "[POST] Status: {$client->statusCode}\n";
    echo "[POST] Body: {$client->body}\n";
    $client->close();
});
```

### v2：并发请求 + 超时 + 重试

```php
<?php
// v2: Concurrent requests with timeout and retry

use Swoole\Coroutine\Http\Client;
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

/**
 * Fetch a URL with retry logic
 */
function fetchWithRetry(string $host, string $path, int $port = 80, int $maxRetries = 3): ?string
{
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $client = new Client($host, $port);
        $client->set([
            'timeout'      => 3,
            'connect_timeout' => 2,
        ]);
        $client->setHeaders(['User-Agent' => 'SwooleBot/2.0']);
        $client->get($path);

        if ($client->statusCode === 200) {
            $body = $client->body;
            $client->close();
            return $body;
        }

        echo "[Retry {$attempt}/{$maxRetries}] Status: {$client->statusCode}\n";
        $client->close();

        // Exponential backoff
        if ($attempt < $maxRetries) {
            Coroutine::sleep(0.1 * (2 ** $attempt));
        }
    }
    return null;
}

run(function () {
    $urls = [
        ['host' => 'httpbin.org', 'path' => '/get?id=1'],
        ['host' => 'httpbin.org', 'path' => '/get?id=2'],
        ['host' => 'httpbin.org', 'path' => '/get?id=3'],
        ['host' => 'httpbin.org', 'path' => '/delay/2'],  // slow response
        ['host' => 'httpbin.org', 'path' => '/status/404'], // 404 error
    ];

    $results = [];
    $wg = new Swoole\Coroutine\WaitGroup();

    foreach ($urls as $i => $url) {
        $wg->add();
        Coroutine::create(function () use ($url, $i, &$results, $wg) {
            $results[$i] = fetchWithRetry($url['host'], $url['path']);
            $wg->done();
        });
    }

    $wg->wait();

    foreach ($results as $i => $body) {
        echo "[{$i}] " . ($body ? substr($body, 0, 80) . '...' : 'FAILED') . "\n";
    }
    echo "Total: " . count($results) . " requests completed\n";
});
```

### v3：生产级连接池 + 文件上传/下载

```php
<?php
// v3: Production-grade HTTP client with connection pool and file operations

use Swoole\Coroutine\Http\Client;
use Swoole\Coroutine\WaitGroup;
use Swoole\Coroutine;
use function Swoole\Coroutine\run;

class HttpPool
{
    private array $pool = [];
    private int $maxIdle;
    private string $host;
    private int $port;
    private bool $ssl;

    public function __construct(string $host, int $port = 443, bool $ssl = true, int $maxIdle = 10)
    {
        $this->host    = $host;
        $this->port    = $port;
        $this->ssl     = $ssl;
        $this->maxIdle = $maxIdle;
    }

    /**
     * Get a client from pool or create new one
     */
    private function getClient(): Client
    {
        if (!empty($this->pool)) {
            return array_pop($this->pool);
        }
        $client = new Client($this->host, $this->port, $this->ssl);
        $client->set([
            'timeout'         => 10,
            'connect_timeout' => 5,
            'keep_alive'      => true,
        ]);
        $client->setHeaders([
            'User-Agent' => 'SwoolePool/3.0',
            'Accept'     => 'application/json',
        ]);
        return $client;
    }

    /**
     * Return client to pool
     */
    private function release(Client $client): void
    {
        if (count($this->pool) < $this->maxIdle) {
            $this->pool[] = $client;
        } else {
            $client->close();
        }
    }

    /**
     * Execute a GET request
     */
    public function get(string $path): array
    {
        $client = $this->getClient();
        $client->get($path);
        $result = [
            'status' => $client->statusCode,
            'body'   => $client->body,
            'headers' => $client->getHeaders(),
        ];
        $this->release($client);
        return $result;
    }

    /**
     * Execute a POST request
     */
    public function post(string $path, array $data, array $files = []): array
    {
        $client = $this->getClient();

        if (!empty($files)) {
            // multipart/form-data with file upload
            foreach ($files as $name => $file) {
                $client->addFile($file, $name);
            }
            $client->post($path, $data);
        } else {
            $client->setHeaders(['Content-Type' => 'application/json']);
            $client->post($path, json_encode($data));
        }

        $result = [
            'status' => $client->statusCode,
            'body'   => $client->body,
        ];
        $this->release($client);
        return $result;
    }

    /**
     * Download a file
     */
    public function download(string $path, string $saveTo): bool
    {
        $client = $this->getClient();
        $client->download($path, $saveTo);
        $ok = $client->statusCode === 200;
        $this->release($client);
        return $ok;
    }

    public function __destruct()
    {
        foreach ($this->pool as $client) {
            $client->close();
        }
    }
}

// --- Usage Demo ---
run(function () {
    $pool = new HttpPool('httpbin.org', 80, false);

    // Concurrent API calls with connection pool
    $wg = new WaitGroup();
    $results = [];

    for ($i = 0; $i < 5; $i++) {
        $wg->add();
        Coroutine::create(function () use ($pool, $i, &$results, $wg) {
            $results[$i] = $pool->get("/get?request={$i}");
            $wg->done();
        });
    }

    $wg->wait();

    foreach ($results as $i => $r) {
        echo "[{$i}] Status: {$r['status']}, Body length: " . strlen($r['body']) . "\n";
    }

    // POST with JSON
    $res = $pool->post('/post', ['message' => 'hello from pool', 'id' => 42]);
    echo "[POST] Status: {$res['status']}\n";

    echo "Pool demo complete.\n";
});
```

---

## 执行预览

```
$ php v1_basic.php
[GET] Status: 200
[GET] Body: {"args":{"name":"swoole","version":"5.0"},...}
[POST] Status: 200
[POST] Body: {"json":{"action":"test","payload":"hello"},...}

$ php v2_concurrent.php
[Retry 1/3] Status: 404
[Retry 2/3] Status: 404
[Retry 3/3] Status: 404
[0] {"args":{"id":"1"},...}...
[1] {"args":{"id":"2"},...}...
[2] {"args":{"id":"3"},...}...
[3] {"args":{},...}...
[4] FAILED
Total: 5 requests completed

$ php v3_pool.php
[0] Status: 200, Body length: 312
[1] Status: 200, Body length: 312
[2] Status: 200, Body length: 312
[3] Status: 200, Body length: 312
[4] Status: 200, Body length: 312
[POST] Status: 200
Pool demo complete.
```

---

## 注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 超时设置 | 默认无超时，可能永久挂起 | 始终设置 `timeout` 和 `connect_timeout` |
| 连接关闭 | 用完不 close 会泄露 | 使用连接池或在 finally 中 close |
| DNS 解析 | 协程中 DNS 解析可能阻塞 | 使用 `Swoole\Coroutine::gethostbyname()` |
| HTTPS | 需要 SSL 支持 | 构造函数第三个参数传 `true` |
| 并发控制 | 无限制并发可能压垮目标 | 使用 Channel 控制并发数 |
| Header 大小 | 默认限制 8KB | 大 Header 需调整 `header_package_max_size` |
| Cookie | 客户端级别自动管理 | 注意 Cookie 作用域和安全性 |

---

## 避坑指南

### ❌ 忘记设置超时
```php
// Bad: No timeout, may hang forever
$client = new Client('slow-api.example.com', 80);
$client->get('/slow-endpoint');
```

### ✅ 始终设置超时
```php
// Good: Set reasonable timeouts
$client = new Client('slow-api.example.com', 80);
$client->set([
    'timeout' => 10,
    'connect_timeout' => 5,
]);
$client->get('/slow-endpoint');
```

### ❌ 循环中反复创建连接
```php
// Bad: New connection per iteration
for ($i = 0; $i < 100; $i++) {
    $c = new Client('api.example.com', 80);
    $c->get("/items/{$i}");
    $c->close();
}
```

### ✅ 复用连接或使用连接池
```php
// Good: Reuse single connection
$client = new Client('api.example.com', 80);
for ($i = 0; $i < 100; $i++) {
    $client->get("/items/{$i}");
    echo $client->body;
}
$client->close();
```

### ❌ 忽略 SSL 证书验证
```php
// Bad: Disabling verification blindly
$client->set(['ssl_verify_peer' => false]);
```

### ✅ 正确配置 SSL
```php
// Good: Use proper CA bundle
$client->set([
    'ssl_verify_peer' => true,
    'ssl_cafile' => '/etc/ssl/certs/ca-certificates.crt',
]);
```

---

## 练习题

### 🟢 初级
1. 使用 `Coroutine\Http\Client` 发送一个 GET 请求到 `httpbin.org/get`，打印响应状态码和 body
2. 发送一个 POST 请求，携带 JSON 数据 `{"name": "swoole"}`，并解析响应

### 🟡 中级
3. 实现一个并发抓取器：同时请求 10 个 URL，收集所有结果，统计成功/失败数
4. 为 HTTP 客户端添加指数退避重试机制（最多重试 3 次）

### 🔴 高级
5. 实现一个通用连接池类，支持 GET/POST，带最大空闲连接数限制和健康检查
6. 实现一个限速下载器：使用 `download()` 方法下载大文件，并用 Channel 控制同时下载数不超过 3

---

## 知识点总结

```
Swoole HTTP 协程客户端
├── 基础
│   ├── Coroutine\Http\Client 构造函数
│   ├── setHeaders() 设置请求头
│   ├── set() 设置超时等参数
│   ├── get() / post() 发送请求
│   ├── statusCode 响应状态码
│   └── body 响应体
├── 进阶
│   ├── addFile() 文件上传
│   ├── download() 文件下载
│   ├── setCookies() Cookie 管理
│   ├── upgrade() WebSocket 升级
│   └── getHeaders() 响应头
├── 并发
│   ├── Coroutine::create() 创建协程
│   ├── WaitGroup 协程同步
│   └── Channel 并发控制
└── 生产实践
    ├── 连接池复用
    ├── 重试与退避
    ├── 超时策略
    └── SSL/TLS 配置
```

---

## 举一反三

| 场景 | 技术方案 | 关键点 |
|------|---------|--------|
| 微服务间 HTTP 调用 | 连接池 + 超时 + 重试 | 服务发现、负载均衡 |
| API 网关聚合 | WaitGroup 并发请求 | 合并响应、超时裁剪 |
| 爬虫/数据抓取 | Channel 控制并发 + 连接池 | 限速、去重、代理 |
| 文件同步服务 | download() + 分块传输 | 断点续传、进度回调 |
| Webhook 投递 | 异步队列 + 重试 | 指数退避、死信队列 |
| 第三方 API 对接 | JSON POST + 签名 | 鉴权、日志、监控 |

---

## 参考资料

- [Swoole 官方文档 - Coroutine\Http\Client](https://wiki.swoole.com/#/coroutine_client/http)
- [Swoole 官方文档 - 协程](https://wiki.swoole.com/#/coroutine)
- [httpbin.org](https://httpbin.org/) - HTTP 请求测试服务
- [PSR-7 HTTP Message Interfaces](https://www.php-fig.org/psr/psr-7/)

---

## 代码演进路线

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | GET/POST 单次请求 | 学习入门、简单调用 |
| v2 并发版 | 协程并发 + 重试 | 批量抓取、API 批量调用 |
| v3 生产版 | 连接池 + 文件操作 | 微服务、生产环境 |

**演进思路：** 先掌握基础请求 → 加并发和容错 → 再做连接池和完整封装。每一步都是前一步的自然延伸。
