---
title: "PHP HTTP客户端实战"
slug: "php-http-client-practice"
category: "Web与安全"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "cURL", "Guzzle", "PSR-7", "HTTP"]
---

# PHP HTTP客户端实战

## cURL完整选项

cURL是PHP最底层的HTTP客户端，功能最全：

```php
<?php
// GET请求
function curlGet(string $url, array $headers = [], int $timeout = 10): array
{
    $ch = curl_init();

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,      // 返回响应体而非直接输出
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,      // 跟随重定向
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_SSL_VERIFYPEER => true,      // 验证SSL证书
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_USERAGENT      => 'MyApp/1.0',
        CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_2_0, // HTTP/2
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
    $error = curl_error($ch);

    curl_close($ch);

    if ($error) {
        throw new RuntimeException("cURL错误: {$error}");
    }

    return [
        'code' => $httpCode,
        'body' => $response,
        'time' => $totalTime,
    ];
}

// POST JSON
function curlPostJson(string $url, array $data, array $headers = []): array
{
    $ch = curl_init();

    $json = json_encode($data, JSON_UNESCAPED_UNICODE);

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $json,
        CURLOPT_HTTPHEADER     => array_merge([
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json),
        ], $headers),
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new RuntimeException("请求失败: {$error}");
    }

    return [
        'code' => $httpCode,
        'data' => json_decode($response, true),
    ];
}

// 使用
$result = curlGet('https://api.example.com/users', [
    'Authorization: Bearer ' . $token,
    'Accept: application/json',
]);

$result = curlPostJson('https://api.example.com/orders', [
    'product_id' => 123,
    'quantity' => 2,
], [
    'Authorization: Bearer ' . $token,
]);
```

### cURL高级：并发请求

```php
<?php
function curlMultiRequest(array $urls, int $timeout = 10): array
{
    $handles = [];
    $mh = curl_multi_init();

    foreach ($urls as $i => $url) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }

    // 并发执行
    do {
        $status = curl_multi_exec($mh, $active);
        if ($active) {
            curl_multi_select($mh, 1); // 等待1秒
        }
    } while ($active && $status === CURLM_OK);

    // 收集结果
    $results = [];
    foreach ($handles as $i => $ch) {
        $results[$i] = [
            'code' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
            'body' => curl_multi_getcontent($ch),
        ];
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    curl_multi_close($mh);
    return $results;
}

// 使用：并发获取10个API
$responses = curlMultiRequest([
    'https://api.example.com/users/1',
    'https://api.example.com/users/2',
    'https://api.example.com/orders',
    // ...
]);
```

## Guzzle使用

Guzzle是PHP最流行的HTTP客户端，基于PSR-7：

```bash
composer require guzzlehttp/guzzle
```

### 基础用法

```php
<?php
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

$client = new Client([
    'base_uri' => 'https://api.example.com',
    'timeout'  => 10,
    'verify'   => true,          // SSL验证
    'headers'  => [
        'Accept' => 'application/json',
        'Authorization' => 'Bearer ' . $token,
    ],
]);

// GET
$response = $client->get('/users', [
    'query' => ['page' => 1, 'per_page' => 20],
]);
$users = json_decode($response->getBody()->getContents(), true);

// POST JSON
$response = $client->post('/orders', [
    'json' => ['product_id' => 123, 'quantity' => 2],
]);

// POST Form
$response = $client->post('/login', [
    'form_params' => [
        'email' => 'user@test.com',
        'password' => 'secret',
    ],
]);

// 上传文件
$response = $client->post('/upload', [
    'multipart' => [
        [
            'name' => 'file',
            'contents' => fopen('/tmp/image.jpg', 'r'),
            'filename' => 'image.jpg',
        ],
        [
            'name' => 'title',
            'contents' => '我的图片',
        ],
    ],
]);

// 异常处理
try {
    $response = $client->get('/users/999');
} catch (RequestException $e) {
    if ($e->hasResponse()) {
        $error = json_decode($e->getResponse()->getBody(), true);
        echo "错误: " . ($error['message'] ?? '未知错误');
    }
}
```

### 中间件

```php
<?php
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\MessageFormatter;
use Monolog\Logger;

$stack = HandlerStack::create();

// 1. 日志中间件
$logger = new Logger('http');
$stack->push(Middleware::log(
    $logger,
    new MessageFormatter('{method} {uri} → {code} ({req_body})'),
));

// 2. 认证中间件（自动附加Token）
$stack->push(Middleware::mapRequest(function ($request) {
    return $request->withHeader('Authorization', 'Bearer ' . getAccessToken());
}));

// 3. 重试中间件
$stack->push(Middleware::retry(
    function ($retries, $request, $response, $exception) {
        // 最多重试3次
        if ($retries >= 3) return false;
        // 5xx或网络错误重试
        if ($exception) return true;
        if ($response && $response->getStatusCode() >= 500) return true;
        return false;
    },
    function ($retries) {
        return 1000 * (2 ** $retries); // 指数退避: 1s, 2s, 4s
    }
));

$client = new Client(['handler' => $stack, 'base_uri' => 'https://api.example.com']);
```

### 并发请求（Pool）

```php
<?php
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;

$requests = function () use ($userIds) {
    foreach ($userIds as $id) {
        yield new Request('GET', "https://api.example.com/users/{$id}");
    }
};

$pool = new Pool($client, $requests(), [
    'concurrency' => 10,    // 最大并发数
    'fulfilled' => function ($response, $index) {
        // 成功回调
        $data = json_decode($response->getBody(), true);
        echo "用户{$index}: {$data['name']}\n";
    },
    'rejected' => function ($exception, $index) {
        // 失败回调
        echo "用户{$index}请求失败: {$exception->getMessage()}\n";
    },
]);

// 等待所有请求完成
$pool->promise()->wait();
```

## PSR-7接口

PSR-7定义了HTTP消息接口，Guzzle和许多框架都实现了它：

```php
<?php
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Psr7\Uri;

// 创建请求
$request = new Request(
    'POST',
    new Uri('https://api.example.com/orders'),
    ['Content-Type' => 'application/json'],
    json_encode(['product_id' => 123])
);

// Request接口方法
$request->getMethod();                    // 'POST'
$request->getUri();                       // Uri对象
$request->getHeaderLine('Content-Type');  // 'application/json'
$request->getBody()->getContents();       // JSON字符串

// Request是不可变的（immutable）
$newRequest = $request->withHeader('Authorization', 'Bearer xxx')
                      ->withUri(new Uri('https://api.example.com/v2/orders'));

// 创建响应
$response = new Response(
    200,
    ['Content-Type' => 'application/json'],
    json_encode(['id' => 1, 'status' => 'created'])
);

$response->getStatusCode();               // 200
$response->getHeaderLine('Content-Type'); // 'application/json'
$response->getBody()->getContents();      // JSON字符串
```

### PSR-7实战：中间件管道

```php
<?php
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

// 中间件签名: function(Request, callable $next): Response
function loggingMiddleware(RequestInterface $request, callable $next): ResponseInterface
{
    $start = microtime(true);
    error_log("→ {$request->getMethod()} {$request->getUri()}");

    $response = $next($request);

    $elapsed = round((microtime(true) - $start) * 1000);
    error_log("← {$response->getStatusCode()} ({$elapsed}ms)");

    return $response;
}

function retryMiddleware(RequestInterface $request, callable $next): ResponseInterface
{
    $maxRetries = 3;
    $attempt = 0;

    while (true) {
        try {
            return $next($request);
        } catch (RequestException $e) {
            $attempt++;
            if ($attempt >= $maxRetries) throw $e;
            usleep(100000 * $attempt);
        }
    }
}

// 管道组合
class HttpClientPipeline
{
    private array $middlewares = [];

    public function add(callable $middleware): self
    {
        $this->middlewares[] = $middleware;
        return $this;
    }

    public function send(RequestInterface $request): ResponseInterface
    {
        // 核心处理器
        $handler = fn($req) => $this->doSend($req);

        // 从后往前包装中间件
        foreach (array_reverse($this->middlewares) as $middleware) {
            $handler = fn($req) => $middleware($req, $handler);
        }

        return $handler($request);
    }

    private function doSend(RequestInterface $request): ResponseInterface
    {
        // 实际发送逻辑...
    }
}
```

## 面试常见追问

**Q: Guzzle和cURL怎么选？**
A: cURL是底层扩展，性能最好但API难用。Guzzle基于cURL（可切换适配器），提供PSR-7兼容、中间件、异步、并发Pool等高级功能。简单脚本用cURL够用，正式项目推荐Guzzle。PHP 8.1+也可以考虑`Symfony HttpClient`（更轻量）。

**Q: HTTP请求超时怎么设置才合理？**
A: 分两层：`connect_timeout`（TCP连接超时，建议3-5秒）和`timeout`（整个请求超时，建议10-30秒）。内部API可以短一些（5秒），第三方API要长一些（30秒）。关键原则：必须有超时，永远不要无限等待。

**Q: PSR-7为什么要设计成不可变（immutable）？**
A: 不可变性保证请求/响应对象在中间件管道中传递时不会被意外修改。每个`with*`方法返回新对象，原对象不变。这避免了中间件之间的副作用，让调试更容易。代价是内存开销稍大（每次修改创建新对象），但HTTP消息通常很小，影响可忽略。
