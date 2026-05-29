---
title: "001 - Hyperf 框架入门与环境搭建"
slug: "001-hyperf-intro-setup"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.698+08:00"
updated_at: "2026-05-01T22:22:55.768+08:00"
reading_time: 5
tags: []
---

# Hyperf 框架入门与环境搭建

> **难度：** ⭐⭐
> **前置知识：** PHP 基础、Composer 包管理、Linux 命令行
> **预估用时：** 45 分钟

---

## 一、概念讲解

**一句话定义：** Hyperf 是基于 Swoole 5.0+ 协程引擎的高性能企业级 PHP 框架。

**现实类比：** 想象一家餐厅——传统 PHP 框架（如 Laravel）就像一个服务员同时只服务一桌客人，客人点完菜等上菜期间服务员就傻站着；Hyperf 则像同一个服务员能同时照看 10 桌客人，哪桌菜好了就端过去，效率翻倍。

**技术场景：** 当你的用户服务需要处理上万并发连接、WebSocket 长连接、或微服务间高频 RPC 调用时，传统 PHP-FPM 模型会成为瓶颈。Hyperf 基于 Swoole 协程，让 PHP 可以像 Go 一样高效处理并发，同时保留 PHP 的开发效率。在我们即将构建的用户服务中，Hyperf 将作为核心框架承载注册、登录、JWT 鉴权等全部功能。

---

## 二、实时脑图

```
┌─────────────────────────────────────────────────────┐
│                Hyperf 架构全景                        │
├─────────────┬───────────────┬───────────────────────┤
│   请求入口   │    协程调度     │      组件生态          │
├─────────────┼───────────────┼───────────────────────┤
│ HTTP Server │ Coroutine     │ DI Container          │
│ gRPC Server │ Channel       │ Annotation System     │
│ WebSocket   │ WaitGroup     │ Config Center         │
│ TCP/UDP     │ Parallel      │ Service Governance    │
└──────┬──────┴───────┬───────┴───────────┬───────────┘
       │              │                   │
       ▼              ▼                   ▼
┌────────────┐  ┌───────────┐    ┌──────────────┐
│  Router     │  │ Swoole    │    │  User Service│
│  Dispatch   │  │ Runtime   │    │  (实战项目)   │
└────────────┘  └───────────┘    └──────────────┘
```

---

## 三、完整代码

### 3.1 环境搭建脚本

```php
#!/bin/bash
# ✅ Environment setup script for Hyperf development

# Step 1: Install Swoole extension
pecl install swoole

# Step 2: Verify Swoole installation
php --ri swoole | grep "Version"

# Step 3: Create Hyperf project via Composer
composer create-project hyperf/hyperf-skeleton user-service

# Step 4: Enter project directory
cd user-service
```

### 3.2 第一个 Hyperf 控制器

```php
<?php
// ✅ app/Controller/UserController.php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\HttpServer\Annotation\AutoController;
use Hyperf\HttpServer\Contract\RequestInterface;

#[AutoController(prefix: "user")]
class UserController
{
    // 🟢 Health check endpoint
    public function index(RequestInterface $request): array
    {
        return [
            'service' => 'user-service',
            'version' => '1.0.0',
            'status' => 'running',
            'timestamp' => time(),
        ];
    }

    // 🟢 Simple greeting endpoint for testing
    public function greet(RequestInterface $request): array
    {
        $name = $request->input('name', 'World');
        return [
            'message' => "Hello, {$name}! Welcome to Hyperf.",
        ];
    }
}
```

### 3.3 配置文件

```php
<?php
// ✅ config/autoload/server.php

declare(strict_types=1);

use Hyperf\Server\Event;
use Hyperf\Server\Server;

return [
    'mode' => SWOOLE_BASE,
    'servers' => [
        [
            'name' => 'http',
            'type' => Server::SERVER_HTTP,
            'host' => '0.0.0.0',
            'port' => 9501,
            'sock_type' => SWOOLE_SOCK_TCP,
            'callbacks' => [
                Event::ON_REQUEST => [Hyperf\HttpServer\Server::class, 'onRequest'],
            ],
        ],
    ],
    'settings' => [
        // ✅ Enable coroutine for maximum performance
        'enable_coroutine' => true,
        'worker_num' => swoole_cpu_num(),
        'pid_file' => BASE_PATH . '/runtime/hyperf.pid',
        'open_tcp_nodelay' => true,
        'max_coroutine' => 100000,
        'open_http2_protocol' => true,
        'max_request' => 100000,
        'socket_buffer_size' => 2 * 1024 * 1024,
    ],
];
```

---

## 四、执行预览

```bash
# 启动 Hyperf 服务
$ php bin/hyperf.php start

[2026-05-01 21:00:00] Server started successfully
[2026-05-01 21:00:00] HTTP Server listening at 0.0.0.0:9501
[2026-05-01 21:00:00] Worker#0 started
[2026-05-01 21:00:00] Worker#1 started

# 测试接口
$ curl http://127.0.0.1:9501/user/index
{"service":"user-service","version":"1.0.0","status":"running","timestamp":1746100800}

$ curl http://127.0.0.1:9501/user/greet?name=铁蛋
{"message":"Hello, 铁蛋! Welcome to Hyperf."}
```

---

## 五、注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| PHP 版本 ≥ 8.1 | Hyperf 3.x 要求 PHP 8.1+ | 安装失败，类型系统不兼容 |
| Swoole ≥ 5.0 | 协程引擎基础 | 缺少协程支持，性能退化 |
| 禁用 `exit/die` | Swoole 常驻内存，exit 会杀掉 Worker 进程 | 服务直接中断，所有连接断开 |
| 不能使用阻塞 I/O | 如 `file_get_contents`、`sleep` | 阻塞协程调度，拖垮整个 Worker |
| 开发环境用 Docker | 保持环境一致性 | 本地环境差异导致难以复现 Bug |

---

## 六、避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 在控制器中使用 `var_dump` | 输出到终端而非 HTTP 响应 | 使用 `return` 返回数组/Response |
| ❌ 安装后未重启服务 | 修改代码不生效 | Hyperf 需重启（或安装热更新插件） |
| ❌ 使用 `file_get_contents` 做 HTTP 请求 | 阻塞整个 Worker | 使用 Hyperf 协程 HTTP 客户端 |
| ❌ 在构造函数中注入非单例 | 每次请求拿到旧数据 | 使用 `#[Inject]` 注解 +代理工厂 |
| ❌ 忽略 `declare(strict_types=1)` | 类型约束不生效，隐性 Bug | 每个 PHP 文件顶部都加上 |

---

## 七、练习题

🟢 **基础题 1：** 创建一个 `PingController`，实现 `/ping` 接口返回 `{"pong": true, "time": "当前时间"}`。

🟢 **基础题 2：** 修改 `server.php` 配置，将 HTTP 服务端口改为 `9502`，并添加一个 TCP Server 监听 `9503`。

🟡 **进阶题：** 实现一个 `/user/info/{id}` 路由，根据 ID 返回模拟用户数据（不需要数据库，用数组模拟）。

🔴 **开放题：** 研究 Hyperf 的热更新方案（watcher），对比文件监听和 Docker 挂载两种开发方式的优劣，输出你的技术选型建议。

---

## 八、知识点总结

```
Hyperf 入门
├── 基础概念
│   ├── 常驻内存（不同于 PHP-FPM）
│   ├── 协程并发（Swoole Coroutine）
│   └── 注解驱动（#[AutoController] 等）
├── 环境搭建
│   ├── PHP 8.1+ & Swoole 5.0+
│   ├── Composer 项目创建
│   └── Docker 开发环境（推荐）
├── 项目结构
│   ├── app/Controller — 控制器
│   ├── config/ — 配置文件
│   └── bin/hyperf.php — 入口文件
└── 核心组件
    ├── HTTP Server（默认 9501 端口）
    ├── 注解系统（路由定义）
    └── 依赖注入容器
```

---

## 九、举一反三

| 变种场景 | 关键差异 | 适配方式 |
|----------|----------|----------|
| 多端口监听 | HTTP + WebSocket + gRPC 同时运行 | `config/autoload/server.php` 配置多个 server |
| Docker 部署 | Swoole 扩展需在镜像内编译 | 使用 `hyperf/hyperf` 官方镜像 |
| API 网关模式 | Hyperf 仅做后端服务，前面加 Nginx | Nginx 反向代理到 9501，处理 SSL/静态资源 |

---

## 十、参考资料

| 资料 | 权威等级 | 链接 |
|------|----------|------|
| Hyperf 官方文档 | ⭐⭐⭐⭐⭐ | https://hyperf.wiki |
| Swoole 官方文档 | ⭐⭐⭐⭐⭐ | https://wiki.swoole.com |
| Hyperf GitHub 仓库 | ⭐⭐⭐⭐ | https://github.com/hyperf/hyperf |
| PHP 8.1 新特性 | ⭐⭐⭐⭐ | https://www.php.net/releases/8.1 |

---

## 十一、代码演进

### v1 ❌ 传统 PHP 思维写 Hyperf

```php
<?php
// ❌ Wrong: Using PHP-FPM style in Hyperf
class UserController
{
    public function index()
    {
        // ❌ Blocking I/O - kills coroutine scheduling
        $data = file_get_contents('https://api.example.com/users');
        echo json_encode($data); // ❌ echo goes to stdout, not HTTP response
    }
}
```

### v2 ✅ 正确的 Hyperf 写法

```php
<?php
// ✅ Correct: Return data, use coroutine HTTP client
declare(strict_types=1);

namespace App\Controller;

use Hyperf\HttpServer\Annotation\AutoController;

#[AutoController(prefix: "user")]
class UserController
{
    public function index(): array
    {
        return [
            'service' => 'user-service',
            'status' => 'running',
        ];
    }
}
```

### v3 🟢 生产级优化

```php
<?php
// 🟢 Optimized: With response wrapper, logging, and error handling
declare(strict_types=1);

namespace App\Controller;

use Hyperf\HttpServer\Annotation\AutoController;
use Hyperf\Di\Annotation\Inject;
use Psr\Log\LoggerInterface;
use Throwable;

#[AutoController(prefix: "user")]
class UserController
{
    #[Inject]
    private LoggerInterface $logger;

    public function index(): array
    {
        try {
            return $this->success([
                'service' => 'user-service',
                'version' => '1.0.0',
                'status' => 'running',
                'timestamp' => time(),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Index endpoint failed', [
                'error' => $e->getMessage(),
            ]);
            return $this->error('Service unavailable', 503);
        }
    }

    private function success(array $data, int $code = 0): array
    {
        return ['code' => $code, 'data' => $data];
    }

    private function error(string $msg, int $code = 500): array
    {
        return ['code' => $code, 'message' => $msg];
    }
}
```

---

**下一篇预告：** [002 - Swoole 协程核心原理与 Hyperf 底层机制](/post/002-swoole-coroutine-core)
