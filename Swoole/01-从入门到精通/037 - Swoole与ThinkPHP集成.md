---
title: "037 - Swoole与ThinkPHP集成"
slug: "037-thinkphp-integration"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:29:29.233+08:00"
updated_at: "2026-04-29T10:02:47.18+08:00"
reading_time: 24
tags: ["Swoole", "PHP"]
---

---
slug: 037-thinkphp-integration
title: Swoole与ThinkPHP集成
category: Swoole深度实战
difficulty: ⭐⭐⭐中级
tags: [Swoole, ThinkPHP, 框架集成, 性能优化, topthink/think-swoole]
---

# Swoole与ThinkPHP集成

> **难度：⭐⭐⭐中级** | 预计阅读时间：18分钟

## 一、概念讲解

ThinkPHP从5.1版本开始官方支持Swoole，通过`topthink/think-swoole`扩展包可以无缝集成。与Laravel Octane不同，ThinkPHP的Swoole集成更加深度，支持HTTP、WebSocket、RPC等多种协议。

### ThinkPHP Swoole vs 传统运行

| 维度 | PHP-FPM | think-swoole |
|------|---------|--------------|
| 启动方式 | 每次请求加载框架 | 框架常驻内存 |
| QPS（Hello World） | ~500 | ~5000 |
| 内存占用 | 低（请求结束释放） | 持续占用 |
| 热更新 | 天然支持 | 需要额外配置 |
| WebSocket | 不支持 | 原生支持 |
| 协程 | 不支持 | 完整支持 |

## 二、脑图

```
ThinkPHP + Swoole
├── 基础集成
│   ├── think-swoole安装
│   ├── HTTP Server模式
│   ├── 配置文件
│   └── 启动与管理
├── 进阶功能
│   ├── WebSocket支持
│   ├── RPC服务
│   ├── 定时任务
│   └── 事件监听
├── 适配要点
│   ├── 全局状态管理
│   ├── 数据库重连
│   ├── 文件监听热更新
│   └── 日志处理
└── 性能优化
    ├── Worker配置
    ├── 连接池
    ├── 缓存策略
    └── 静态资源处理
```

## 三、代码演进

### v1: 基础安装与配置

```bash
# Install think-swoole
composer require topthink/think-swoole

# The package will publish config/swoole.php automatically
```

```php
<?php
// config/swoole.php - Swoole configuration for ThinkPHP

return [
    // Server type: http, websocket, socket, rpc
    'server_type' => 'http',
    
    // Server options
    'host' => '0.0.0.0',
    'port' => 9501,
    'options' => [
        'worker_num' => 4,
        'task_worker_num' => 2,
        'max_request' => 1000,
        'daemonize' => false,
        'pid_file' => runtime_path() . 'swoole.pid',
        'log_file' => runtime_path() . 'swoole.log',
        'document_root' => public_path(),
        'enable_static_handler' => true,
        'static_handler_locations' => ['/static'],
        'package_max_length' => 5 * 1024 * 1024,
        'heartbeat_check_interval' => 30,
        'heartbeat_idle_time' => 60,
    ],
    
    // Hot reload (development only!)
    'hot_update' => [
        'enable' => env('APP_DEBUG', false),
        'name' => ['*.php'],
        'include' => [app_path()],
        'exclude' => [],
        'delay' => 3000, // ms
    ],
    
    // Tables for shared memory
    'tables' => [],
];
```

```bash
# Start the server
php think swoole

# Start with custom options
php think swoole --host=0.0.0.0 --port=9501 --daemonize

# Stop the server
php think swoole:stop

# Reload workers
php think swoole:reload
```

### v2: WebSocket与事件监听

```php
<?php
// config/swoole.php - Enable WebSocket
return [
    'server_type' => 'websocket',
    // ... other config
];
```

```php
<?php
// app/event.php - Register WebSocket event listeners

return [
    'bind' => [
        // Map Swoole events to listener classes
        'swoole.websocket.Open' => 'app\listener\WebSocketOpen',
        'swoole.websocket.Message' => 'app\listener\WebSocketMessage',
        'swoole.websocket.Close' => 'app\listener\WebSocketClose',
    ],
];
```

```php
<?php
// app/listener/WebSocketMessage.php

namespace app\listener;

use think\facade\Log;
use think\swoole\Manager;

class WebSocketMessage
{
    public function __construct(protected Manager $manager) {}
    
    public function handle($event)
    {
        [$server, $frame] = $event;
        $data = json_decode($frame->data, true);
        
        if (!$data) {
            $server->push($frame->fd, json_encode(['error' => 'Invalid JSON']));
            return;
        }
        
        $type = $data['type'] ?? 'unknown';
        
        match ($type) {
            'chat' => $this->handleChat($server, $frame, $data),
            'join' => $this->handleJoin($server, $frame, $data),
            'typing' => $this->handleTyping($server, $frame, $data),
            default => $server->push($frame->fd, json_encode(['error' => 'Unknown type'])),
        };
    }
    
    private function handleChat($server, $frame, array $data): void
    {
        $message = [
            'type' => 'chat',
            'from' => $data['user'] ?? 'anonymous',
            'content' => $data['content'] ?? '',
            'room' => $data['room'] ?? 'default',
            'time' => date('H:i:s'),
        ];
        
        // Broadcast to all connections in the same room
        foreach ($server->connections as $fd) {
            if ($server->isEstablished($fd)) {
                $server->push($fd, json_encode($message));
            }
        }
    }
    
    private function handleJoin($server, $frame, array $data): void
    {
        $user = $data['user'] ?? 'anonymous';
        $server->push($frame->fd, json_encode([
            'type' => 'system',
            'content' => "Welcome, {$user}!",
        ]));
    }
    
    private function handleTyping($server, $frame, array $data): void
    {
        // Broadcast typing indicator
        foreach ($server->connections as $fd) {
            if ($fd !== $frame->fd && $server->isEstablished($fd)) {
                $server->push($fd, json_encode([
                    'type' => 'typing',
                    'user' => $data['user'] ?? 'someone',
                ]));
            }
        }
    }
}
```

### v3: RPC服务与协程优化

```php
<?php
// app/service/UserService.php - RPC service

namespace app\service;

class UserService
{
    /**
     * Get user info - can be called via RPC
     */
    public function getInfo(int $userId): array
    {
        return \app\model\User::cache(true, 60)->findOrEmpty($userId)->toArray()
            ?: ['error' => 'User not found'];
    }
    
    /**
     * Batch get users using coroutines
     */
    public function batchGetInfo(array $userIds): array
    {
        $results = [];
        $chan = new \Swoole\Coroutine\Channel(count($userIds));
        
        foreach ($userIds as $id) {
            go(function () use ($id, $chan) {
                $user = \app\model\User::cache(true, 60)->findOrEmpty($id);
                $chan->push([$id => $user->toArray()]);
            });
        }
        
        for ($i = 0; $i < count($userIds); $i++) {
            $result = $chan->pop(5.0);
            if ($result) {
                $results = array_merge($results, $result);
            }
        }
        
        return $results;
    }
}
```

```php
<?php
// app/controller/Api.php - API controller with coroutine optimization

namespace app\controller;

use app\service\UserService;
use think\App;
use think\facade\Cache;

class Api
{
    protected UserService $userService;
    
    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }
    
    /**
     * Dashboard with concurrent data loading
     */
    public function dashboard()
    {
        // Load multiple data sources concurrently
        $chan = new \Swoole\Coroutine\Channel(3);
        
        go(function () use ($chan) {
            $chan->push(['users' => \app\model\User::count()]);
        });
        
        go(function () use ($chan) {
            $chan->push(['orders' => \app\model\Order::whereDay('created_at')->count()]);
        });
        
        go(function () use ($chan) {
            $chan->push(['revenue' => \app\model\Order::whereDay('created_at')->sum('amount')]);
        });
        
        $data = [];
        for ($i = 0; $i < 3; $i++) {
            $data = array_merge($data, $chan->pop(3.0));
        }
        
        return json($data);
    }
}
```

**执行预览：**
```
$ php think swoole
ThinkPHP/Swoole Server started
Listen: 0.0.0.0:9501
Workers: 4
Type: websocket

[2024-01-15 10:00:00] Worker #1 started
[2024-01-15 10:00:00] Worker #2 started
[2024-01-15 10:00:01] WebSocket client #1 connected
[2024-01-15 10:00:02] Message from #1: {"type":"join","user":"Alice"}
```

## 四、注意事项

| 项目 | 说明 |
|------|------|
| 热更新 | 仅在开发环境开启，生产必须关闭 |
| 数据库断线 | MySQL wait_timeout会导致连接断开，配置自动重连 |
| 文件监听 | `hot_update`的`include`路径要精确，避免监听日志目录 |
| Session | 建议使用Redis Session驱动 |
| 全局变量 | Worker进程内全局变量跨请求共享，需注意清理 |
| 静态资源 | 开启`enable_static_handler`由Swoole直接处理静态文件 |

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| 生产环境开`hot_update` | 仅开发环境启用，生产关闭 |
| 用默认MySQL配置不设重连 | 配置`break_reconnect`为true |
| 控制器中用`$_GET`/`$_POST` | 使用ThinkPHP Request对象 |
| 忽略模型缓存的内存占用 | 设置合理TTL，控制缓存数量 |
| WebSocket不做心跳 | 配置heartbeat参数，客户端发ping |
| 不设置`max_request` | 设置500-2000防止内存泄漏 |

## 六、练习题

### 🟢 入门
1. 在ThinkPHP项目中安装think-swoole，启动HTTP服务并测试
2. 配置热更新，验证修改PHP文件后自动生效

### 🟡 进阶
3. 实现WebSocket聊天室（加入房间、发送消息、离开通知）
4. 用协程Channel实现并发数据加载的仪表盘接口

### 🔴 挑战
5. 实现ThinkRPC：用think-swoole的RPC模式实现跨服务调用
6. 实现Swoole Table + WebSocket的在线用户列表实时同步

## 七、知识点总结

```
ThinkPHP + Swoole
├── 集成方式
│   ├── think-swoole扩展包
│   ├── HTTP Server模式
│   ├── WebSocket模式
│   └── RPC模式
├── 核心配置
│   ├── worker_num / task_worker_num
│   ├── hot_update（热更新）
│   ├── enable_static_handler
│   └── daemonize（守护进程）
├── 事件系统
│   ├── WorkerStart / WorkerStop
│   ├── WebSocket Open/Message/Close
│   └── 自定义事件监听
└── 协程优化
    ├── 并发数据加载
    ├── Channel数据聚合
    ├── 协程Redis客户端
    └── 连接池管理
```

## 八、举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 实时通知 | WebSocket + Redis Pub/Sub | 跨Worker消息推送 |
| 在线统计 | Swoole Table + 定时器 | 高性能计数器 |
| 文件上传 | Swoole处理 + OSS存储 | 大文件分片 |
| SSE推送 | HTTP长连接 + EventStream | 轻量级实时方案 |
| 定时任务 | WorkerStart + Timer::tick | 替代系统crontab |
| 队列消费 | Task Worker处理 | 异步任务执行 |

## 九、参考资料

- [think-swoole GitHub](https://github.com/top-think/think-swoole)
- [ThinkPHP6 完全开发手册](https://www.kancloud.cn/manual/thinkphp6_0/)
- [Swoole官方文档](https://wiki.swoole.com/)
- [ThinkPHP Swoole最佳实践](https://www.kancloud.cn/thinkphp/think-swoole)

## 十、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 基础配置 | 安装、HTTP模式、热更新 | 项目接入 |
| v2 WebSocket | 聊天室、事件监听 | 实时应用 |
| v3 协程优化 | RPC、并发加载 | 高性能API |
