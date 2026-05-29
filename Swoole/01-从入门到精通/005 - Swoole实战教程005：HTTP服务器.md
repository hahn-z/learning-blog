---
title: "005 - Swoole实战教程005：HTTP服务器"
slug: "005-http-server"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:01:42.619+08:00"
updated_at: "2026-04-29T10:02:46.891+08:00"
reading_time: 48
tags: ["Swoole", "PHP"]
---

# Swoole实战教程005：HTTP服务器

> **难度标注：** 🟡 中级 | 预计学习时间：50分钟

## 一、概念讲解

### Swoole HTTP Server vs PHP-FPM

| 对比维度 | Nginx + PHP-FPM | Swoole HTTP Server |
|---------|----------------|-------------------|
| 启动 | 每请求加载框架 | 框架常驻内存 |
| 性能 | ~1000 QPS | ~5000-50000 QPS |
| 内存 | 每请求独立 | Worker共享常驻 |
| 热更新 | 自动 | 需reload |
| 生态 | 成熟（Composer全兼容） | 部分库不兼容 |
| 部署 | Nginx + FPM配置 | 单进程启动 |

### Swoole HTTP Server核心对象

```
Swoole\Http\Server (extends Swoole\Server)
├── Swoole\Http\Request
│   ├── $request->get      (GET参数)
│   ├── $request->post     (POST参数)
│   ├── $request->header   (请求头)
│   ├── $request->server   (服务器变量)
│   ├── $request->cookie   (Cookie)
│   ├── $request->files    (上传文件)
│   ├── $request->rawContent() (原始Body)
│   └── $request->getData()    (完整原始请求)
└── Swoole\Http\Response
    ├── $response->header()    (设置响应头)
    ├── $response->cookie()    (设置Cookie)
    ├── $response->status()    (设置状态码)
    ├── $response->write()     (分段写入)
    ├── $response->end()       (发送并结束)
    ├── $response->sendfile()  (发送文件)
    ├── $response->redirect()  (重定向)
    └── $response->detach()    (分离响应对象)
```

### 架构设计思路

在没有框架的情况下，我们需要自己实现：

1. **路由（Router）**：URL → 处理函数映射
2. **中间件（Middleware）**：请求前/后的统一处理
3. **控制器（Controller）**：业务逻辑组织
4. **异常处理（ErrorHandler）**：统一的错误响应

## 二、脑图

```
HTTP服务器
├── 基础
│   ├── Swoole\Http\Server
│   ├── Request对象
│   ├── Response对象
│   └── onRequest事件
├── 路由设计
│   ├── 简单数组映射
│   ├── 正则匹配
│   └── RESTful风格
├── 中间件
│   ├── 认证中间件
│   ├── CORS中间件
│   ├── 日志中间件
│   └── 限流中间件
├── 实用功能
│   ├── JSON API
│   ├── 文件上传
│   ├── 静态文件
│   └── Cookie/Session
└── 性能优化
    ├── keepalive
    ├── gzip压缩
    ├── sendfile
    └── 压测对比
```

## 三、完整代码

### 生产级HTTP服务器（含路由+中间件）

```php
<?php
// http_server.php - Production HTTP server with routing and middleware

// ============================================================
// Router: Simple regex-based router
// ============================================================
class Router
{
    private array $routes = [];
    private array $middleware = [];

    // Register a route: method, pattern, handler
    public function addRoute(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [
            'method'  => strtoupper($method),
            'pattern' => $pattern,
            'regex'   => $this->compilePattern($pattern),
            'handler' => $handler,
        ];
    }

    // Add global middleware
    public function middleware(callable $mw): void
    {
        $this->middleware[] = $mw;
    }

    // Compile route pattern to regex
    private function compilePattern(string $pattern): string
    {
        // Convert {param} to named capture group
        $regex = preg_replace('/\{([a-zA-Z_]+)\}/', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }

    // Dispatch request to matching route
    public function dispatch(string $method, string $uri): ?array
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }
            if (preg_match($route['regex'], $uri, $matches)) {
                // Extract named captures
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                return [
                    'handler'     => $route['handler'],
                    'params'      => $params,
                    'middleware'  => $this->middleware,
                ];
            }
        }
        return null;
    }
}

// ============================================================
// Application: Main HTTP application
// ============================================================
class App
{
    private Router $router;
    private Swoole\Http\Server $server;
    private array $config;

    public function __construct(array $config = [])
    {
        $this->config = array_merge([
            'host'       => '0.0.0.0',
            'port'       => 9501,
            'worker_num' => 4,
            'document_root' => '',
        ], $config);

        $this->router = new Router();
        $this->server = new Swoole\Http\Server(
            $this->config['host'],
            $this->config['port']
        );

        $settings = [
            'worker_num' => $this->config['worker_num'],
            'log_file'   => '/tmp/http_server.log',
            'http_compression'      => true,
            'http_compression_level' => 3,
            'heartbeat_idle_time'   => 30,
            'heartbeat_check_interval' => 15,
        ];

        // Enable static file serving if document_root is set
        if ($this->config['document_root']) {
            $settings['document_root'] = $this->config['document_root'];
            $settings['enable_static_handler'] = true;
        }

        $this->server->set($settings);
    }

    public function getRouter(): Router
    {
        return $this->router;
    }

    public function get(string $path, callable $handler): void
    {
        $this->router->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): void
    {
        $this->router->addRoute('POST', $path, $handler);
    }

    public function middleware(callable $mw): void
    {
        $this->router->middleware($mw);
    }

    public function start(): void
    {
        $router = $this->router;

        $this->server->on('request', function (
            Swoole\Http\Request $request,
            Swoole\Http\Response $response
        ) use ($router) {
            $this->handleRequest($request, $response, $router);
        });

        $this->server->on('workerStart', function ($server, $workerId) {
            echo "[Worker#{$workerId}] HTTP server ready\n";
        });

        $this->server->start();
    }

    private function handleRequest(
        Swoole\Http\Request $req,
        Swoole\Http\Response $res,
        Router $router
    ): void {
        $uri    = $req->server['request_uri'] ?? '/';
        $method = $req->server['request_method'] ?? 'GET';

        // Set default CORS headers
        $res->header('Access-Control-Allow-Origin', '*');
        $res->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $res->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Handle preflight
        if ($method === 'OPTIONS') {
            $res->status(204);
            $res->end();
            return;
        }

        // Dispatch route
        $match = $router->dispatch($method, $uri);

        if (!$match) {
            $this->jsonResponse($res, ['error' => 'Not Found', 'path' => $uri], 404);
            return;
        }

        // Run middleware chain
        $handler = $match['handler'];
        $params  = $match['params'];

        foreach ($match['middleware'] as $mw) {
            $result = $mw($req, $res);
            if ($result === false) {
                return; // Middleware rejected the request
            }
        }

        // Execute handler
        try {
            $handler($req, $res, $params);
        } catch (Throwable $e) {
            $this->jsonResponse($res, [
                'error'   => 'Internal Server Error',
                'message' => $e->getMessage(),
                'file'    => $e->getFile() . ':' . $e->getLine(),
            ], 500);
        }
    }

    private function jsonResponse(
        Swoole\Http\Response $res,
        array $data,
        int $status = 200
    ): void {
        $res->header('Content-Type', 'application/json; charset=utf-8');
        $res->status($status);
        $res->end(json_encode($data, JSON_UNESCAPED_UNICODE));
    }
}

// ============================================================
// Define routes and start server
// ============================================================

$app = new App([
    'worker_num' => 4,
    'document_root' => __DIR__ . '/public',
]);

// Global middleware: request logging
$app->middleware(function ($req, $res) {
    $uri    = $req->server['request_uri'];
    $method = $req->server['request_method'];
    $time   = date('Y-m-d H:i:s');
    echo "[{$time}] {$method} {$uri}\n";
    return true; // Continue to next middleware/handler
});

// Global middleware: API key check for /api/* routes
$app->middleware(function ($req, $res) {
    $uri = $req->server['request_uri'] ?? '/';
    if (str_starts_with($uri, '/api/')) {
        $key = $req->header['x-api-key'] ?? $req->get['api_key'] ?? '';
        if ($key !== 'my-secret-key') {
            $res->status(401);
            $res->header('Content-Type', 'application/json');
            $res->end(json_encode(['error' => 'Unauthorized: Invalid API key']));
            return false;
        }
    }
    return true;
});

// --- Routes ---

// Home
$app->get('/', function ($req, $res) {
    $res->header('Content-Type', 'text/html; charset=utf-8');
    $res->end('<h1>Swoole HTTP Server</h1><p>Server is running!</p>');
});

// JSON API: system info
$app->get('/api/info', function ($req, $res) {
    $res->header('Content-Type', 'application/json');
    $res->end(json_encode([
        'swoole_version' => swoole_version(),
        'php_version'    => PHP_VERSION,
        'workers'        => SWOOLE_CPU_NUM,
        'timestamp'      => time(),
        'memory'         => round(memory_get_usage(true) / 1024 / 1024, 2) . 'MB',
    ]));
});

// JSON API: user profile with path parameter
$app->get('/api/user/{id}', function ($req, $res, $params) {
    $userId = $params['id'];
    $res->header('Content-Type', 'application/json');
    $res->end(json_encode([
        'id'   => $userId,
        'name' => "User {$userId}",
        'email' => "user{$userId}@example.com",
    ]));
});

// POST: create resource
$app->post('/api/echo', function ($req, $res) {
    $body = json_decode($req->rawContent(), true) ?? $req->post ?? [];
    $res->header('Content-Type', 'application/json');
    $res->end(json_encode([
        'echo'      => $body,
        'timestamp' => time(),
        'headers'   => array_map(function($v) { return is_array($v) ? $v : (string)$v; }, $req->header),
    ], JSON_UNESCAPED_UNICODE));
});

// File upload handler
$app->post('/api/upload', function ($req, $res) {
    $files = $req->files ?? [];
    if (empty($files)) {
        $res->status(400);
        $res->header('Content-Type', 'application/json');
        $res->end(json_encode(['error' => 'No files uploaded']));
        return;
    }

    $results = [];
    foreach ($files as $key => $file) {
        $tmpName  = $file['tmp_name'];
        $origName = $file['name'];
        $size     = $file['size'];
        $ext      = pathinfo($origName, PATHINFO_EXTENSION);

        // Save to uploads directory
        $saveDir = __DIR__ . '/uploads';
        if (!is_dir($saveDir)) mkdir($saveDir, 0755, true);
        $savePath = $saveDir . '/' . uniqid() . '.' . $ext;

        move_uploaded_file($tmpName, $savePath);
        $results[] = [
            'name' => $origName,
            'size' => $size,
            'path' => basename($savePath),
        ];
    }

    $res->header('Content-Type', 'application/json');
    $res->end(json_encode(['uploaded' => $results]));
});

// SSE (Server-Sent Events) demo
$app->get('/api/sse', function ($req, $res) {
    $res->header('Content-Type', 'text/event-stream');
    $res->header('Cache-Control', 'no-cache');
    $res->header('Connection', 'keep-alive');

    // Send 5 events with 1 second interval
    for ($i = 1; $i <= 5; $i++) {
        $data = json_encode(['count' => $i, 'ts' => time()]);
        $res->write("event: message\ndata: {$data}\n\n");
        Swoole\Coroutine\System::sleep(1);
    }
    $res->end();
});

echo "HTTP Server starting on http://0.0.0.0:9501\n";
$app->start();
```

### 压测脚本

```php
<?php
// benchmark.php - Simple HTTP benchmark with Swoole coroutines

Swoole\Coroutine\run(function () {
    $concurrency = 100;
    $total       = 10000;
    $perWorker   = intval($total / $concurrency);
    $url         = 'http://127.0.0.1:9501/api/info';

    echo "Benchmark: {$total} requests, {$concurrency} concurrency\n";
    echo "Target: {$url}\n\n";

    $start = microtime(true);
    $errors = 0;

    $wg = new Swoole\Coroutine\WaitGroup();

    for ($i = 0; $i < $concurrency; $i++) {
        $wg->add();
        Swoole\Coroutine::create(function () use ($wg, $perWorker, $url, &$errors) {
            $client = new Swoole\Coroutine\Http\Client('127.0.0.1', 9501);

            for ($j = 0; $j < $perWorker; $j++) {
                $client->get('/api/info');
                if ($client->statusCode !== 200) {
                    $errors++;
                }
                $client->body; // Consume body
            }

            $client->close();
            $wg->done();
        });
    }

    $wg->wait();
    $elapsed = microtime(true) - $start;

    $qps = round($total / $elapsed);
    echo "Results:\n";
    echo "  Total:      {$total} requests\n";
    echo "  Errors:     {$errors}\n";
    echo "  Time:       " . round($elapsed, 2) . "s\n";
    echo "  QPS:        {$qps}\n";
    echo "  Avg Latency: " . round($elapsed / $total * 1000, 2) . "ms\n";
});
```

## 四、执行预览

**启动服务器：**
```bash
$ php http_server.php
HTTP Server starting on http://0.0.0.0:9501
[Worker#0] HTTP server ready
[Worker#1] HTTP server ready
```

**测试API：**
```bash
# Home page
$ curl http://127.0.0.1:9501/
<h1>Swoole HTTP Server</h1><p>Server is running!</p>

# JSON API
$ curl http://127.0.0.1:9501/api/info -H 'X-Api-Key: my-secret-key'
{"swoole_version":"5.1.1","php_version":"8.3.0","workers":4,"timestamp":1745856000,"memory":"2.5MB"}

# Path parameter
$ curl http://127.0.0.1:9501/api/user/42 -H 'X-Api-Key: my-secret-key'
{"id":"42","name":"User 42","email":"user42@example.com"}

# POST JSON
$ curl -X POST http://127.0.0.1:9501/api/echo \
    -H 'X-Api-Key: my-secret-key' \
    -H 'Content-Type: application/json' \
    -d '{"msg":"hello swoole"}'
{"echo":{"msg":"hello swoole"},"timestamp":1745856000,"headers":{...}}

# Auth failure
$ curl http://127.0.0.1:9501/api/info
{"error":"Unauthorized: Invalid API key"}
```

**压测结果：**
```bash
$ php benchmark.php
Benchmark: 10000 requests, 100 concurrency
Target: http://127.0.0.1:9501/api/info

Results:
  Total:      10000 requests
  Errors:     0
  Time:       0.85s
  QPS:        11764
  Avg Latency: 0.08ms
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 内存泄漏 | 全局变量/静态变量不会自动清理 | onRequest结束时手动清理 |
| 连接池 | MySQL/Redis连接在WorkerStart中创建 | 不要在onRequest中创建 |
| 大Body | 默认POST最大2MB | 通过package_max_length调整 |
| 静态文件 | enable_static_handler=true | 生产环境建议Nginx做前置 |
| HTTPS | 需要配置ssl_cert_file | 或用Nginx做TLS终止 |
| 框架兼容 | Laravel/ThinkPHP可运行但需适配 | 使用Swoole专用桥接包 |

## 六、避坑指南

### ❌ 坑1：在onRequest中使用全局/静态变量累积数据
```php
<?php
// ❌ Wrong: Static array grows forever, never cleaned
class Cache {
    static array $data = [];
}
$server->on('request', function ($req, $res) {
    Cache::$data[uniqid()] = $req->post; // Memory leak!
    $res->end('ok');
});
```

```php
<?php
// ✅ Correct: Use Swoole Table with size limit, or clean up
$table = new Swoole\Table(1024);
$table->column('data', Swoole\Table::TYPE_STRING, 1024);
$table->create();

$server->on('request', function ($req, $res) use ($table) {
    $key = uniqid();
    $table->set($key, ['data' => json_encode($req->post)]);
    $res->end('ok');
});
```

### ❌ 坑2：忘记调用end()
```php
<?php
// ❌ Wrong: Response never sent to client
$server->on('request', function ($req, $res) {
    // Processing...
    $data = doSomething();
    // Forgot $res->end($data)! Client hangs until timeout
});
```

```php
<?php
// ✅ Correct: Always call end(), even on error
$server->on('request', function ($req, $res) {
    try {
        $data = doSomething();
        $res->end($data);
    } catch (Throwable $e) {
        $res->status(500);
        $res->end(json_encode(['error' => $e->getMessage()]));
    }
});
```

### ❌ 坑3：在onRequest中创建数据库连接
```php
<?php
// ❌ Wrong: New connection per request = connection pool exhaustion
$server->on('request', function ($req, $res) {
    $pdo = new PDO('mysql:host=127.0.0.1', 'root', '');
    // ... use pdo ...
    $res->end('ok');
});
```

```php
<?php
// ✅ Correct: Create in workerStart, reuse across requests
$server->on('workerStart', function ($server, $workerId) {
    $server->pdo = new PDO('mysql:host=127.0.0.1', 'root', '');
});
$server->on('request', function ($req, $res) use ($server) {
    $stmt = $server->pdo->query('SELECT 1');
    $res->end(json_encode($stmt->fetchAll()));
});
```

## 七、练习题

### 🟢 基础题
1. 创建一个HTTP服务器，提供`/api/time`接口返回当前时间戳（JSON格式）
2. 添加`/api/greet/{name}`路由，返回`{"message": "Hello, {name}!"}`

### 🟡 进阶题
3. 实现一个Rate Limiter中间件：每个IP每分钟最多60次请求，超过返回429
4. 实现一个简单的RESTful CRUD API：内存中用数组存储数据，支持GET/POST/PUT/DELETE

### 🔴 挑战题
5. 实现一个完整的迷你框架：支持路由分组、中间件栈、依赖注入容器、统一错误处理

<details>
<summary>参考答案（基础题1）</summary>

```php
<?php
$server = new Swoole\Http\Server('0.0.0.0', 9501);
$server->on('request', function ($req, $res) {
    if ($req->server['request_uri'] === '/api/time') {
        $res->header('Content-Type', 'application/json');
        $res->end(json_encode(['timestamp' => time(), 'datetime' => date('Y-m-d H:i:s')]));
    } else {
        $res->status(404);
        $res->end('Not Found');
    }
});
$server->start();
```
</details>

## 八、知识点总结

```
HTTP服务器知识树
├── 核心API
│   ├── Http\Server extends Server
│   ├── Request (get/post/header/files/rawContent)
│   └── Response (status/header/cookie/end/write/sendfile)
├── 路由设计
│   ├── 数组映射
│   ├── 正则匹配 ★
│   └── RESTful约定
├── 中间件
│   ├── 认证 (API Key/JWT)
│   ├── CORS
│   ├── 日志
│   └── 限流
├── 实用功能
│   ├── JSON API
│   ├── 文件上传
│   ├── SSE推送
│   └── 静态文件
└── 性能
    ├── http_compression (gzip)
    ├── keepalive
    ├── sendfile
    └── 压测 (ab/wrk/coroutine)
```

## 九、举一反三

| 功能 | 实现方式 | 关键API |
|------|---------|--------|
| RESTful API | 路由+JSON | Request/Response |
| 文件下载 | sendfile() | Response::sendfile() |
| SSE推送 | write() + event-stream格式 | Response::write() |
| 文件上传 | $request->files | move_uploaded_file() |
| Cookie认证 | cookie()/header() | Request::$cookie |
| Gzip压缩 | http_compression=true | Server::set() |
| HTTPS | ssl_cert_file配置 | Server::set() |
| 反向代理 | Nginx前置 | proxy_pass 9501 |

## 十、参考资料

- [Swoole HTTP Server文档](https://wiki.swoole.com/#/http_server)
- [Swoole Http\Request文档](https://wiki.swoole.com/#/http/request)
- [Swoole Http\Response文档](https://wiki.swoole.com/#/http/response)
- [Swoole与Laravel集成](https://laravel.com/docs/10.x/octane)
- [wrk HTTP压测工具](https://github.com/wg/wrk)

## 十一、代码演进

### v1：最简HTTP服务器
```php
<?php
// v1: Minimal HTTP server
$server = new Swoole\Http\Server('0.0.0.0', 9501);
$server->on('request', function ($req, $res) {
    $res->end('<h1>Hello Swoole!</h1>');
});
$server->start();
```

### v2：带简单路由的HTTP服务器
```php
<?php
// v2: HTTP server with basic routing
$server = new Swoole\Http\Server('0.0.0.0', 9501);

$routes = [
    '/'     => fn($r) => '<h1>Home</h1>',
    '/api'  => fn($r) => json_encode(['status' => 'ok']),
];

$server->on('request', function ($req, $res) use ($routes) {
    $uri = $req->server['request_uri'];
    if (isset($routes[$uri])) {
        $res->end($routes[$uri]($req));
    } else {
        $res->status(404);
        $res->end('Not Found');
    }
});
$server->start();
```

### v3：完整HTTP服务器（路由+中间件+错误处理+文件上传+SSE）
见上方「生产级HTTP服务器」完整代码。

---

**恭喜！** 完成了Swoole基础5篇教程。下一篇将进入更高级的话题，如WebSocket、协程、进程管理等。
