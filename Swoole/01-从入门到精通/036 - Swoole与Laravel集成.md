---
title: "036 - Swoole与Laravel集成"
slug: "036-laravel-integration"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:23:16.472+08:00"
updated_at: "2026-04-29T10:02:47.171+08:00"
reading_time: 26
tags: ["Swoole", "PHP"]
---

---
slug: 036-laravel-integration
title: Swoole与Laravel集成
category: Swoole深度实战
difficulty: ⭐⭐⭐中级
tags: [Swoole, Laravel, Octane, 性能优化, 框架集成]
---

# Swoole与Laravel集成

> **难度：⭐⭐⭐中级** | 预计阅读时间：20分钟

## 一、概念讲解

Laravel是PHP最流行的框架之一，但传统PHP-FPM每次请求都要重新加载框架，性能开销大。通过Swoole，Laravel可以常驻内存运行，**性能提升5-10倍**。

### 集成方案对比

| 方案 | 原理 | 性能提升 | 易用性 | 推荐度 |
|------|------|----------|--------|--------|
| Laravel Octane | 官方包，支持Swoole/RoadRunner | 5-10x | ⭐⭐⭐⭐⭐ | ✅ 首选 |
| LaravelS | 第三方包 | 5-8x | ⭐⭐⭐⭐ | 备选 |
| 手动集成 | 自己引导Laravel | 3-5x | ⭐⭐ | 学习用 |
| Swoole HTTP Server + Lumen | 轻量框架 | 8-12x | ⭐⭐⭐ | 高性能场景 |

### Laravel Octane架构

```
客户端请求 → Swoole HTTP Server（常驻进程）
                ↓
         Laravel App（内存中）
                ↓
         路由 → 中间件 → 控制器 → 响应
```

## 二、脑图

```
Swoole + Laravel
├── Laravel Octane
│   ├── 安装配置
│   ├── Swoole驱动
│   ├── 命令行管理
│   └── 配置优化
├── 内存管理
│   ├── 全局状态污染
│   ├── 静态变量重置
│   ├── 数据库连接池
│   └── 内存泄漏排查
├── 兼容性
│   ├── 全局中间件
│   ├── 静态变量
│   ├── 单例模式
│   └── 第三方包兼容
└── 性能优化
    ├── 预加载配置
    ├── Worker预热
    ├── 缓存策略
    └── 限流配置
```

## 三、代码演进

### v1: 安装Laravel Octane

```bash
# Step 1: Install Laravel Octane
composer require laravel/octane

# Step 2: Publish configuration
php artisan octane:install

# Step 3: Select Swoole as driver (choose from prompt)
# This creates config/octane.php

# Step 4: Start the server
php artisan octane:start --workers=4 --task-workers=2 --max-requests=500
```

```php
<?php
// config/octane.php - Key configuration options

return [
    'server' => 'swoole',
    
    'swoole' => [
        // Number of worker processes
        'options' => [
            'worker_num' => 4,
            'task_worker_num' => 2,
            'max_request' => 500,       // Restart worker after N requests
            'package_max_length' => 10 * 1024 * 1024, // 10MB
            'heartbeat_check_interval' => 30,
            'heartbeat_idle_time' => 60,
        ],
        
        // Tables for shared memory
        'tables' => [
            'sessions' => [
                'size' => 1000,
                'columns' => [
                    'data' => 'string:4096',
                    'expires_at' => 'int',
                ],
            ],
        ],
    ],
    
    // Warm bindings that should be preloaded
    'warm' => [
        ...\Illuminate\Database\ConnectionResolverInterface::class,
        ...\Illuminate\Queue\QueueManager::class,
    ],
    
    // Flush bindings between requests
    'flush' => [
        // Add bindings that need to be reset per request
    ],
];
```

### v2: 适配Laravel应用

```php
<?php
// app/Http/Controllers/UserController.php

namespace App\Http\Controllers;

use App\Models\User;
use Laravel\Octane\Facades\Octane;

class UserController extends Controller
{
    /**
     * List users with concurrent query optimization
     */
    public function index()
    {
        // Octane::concurrently runs tasks in parallel coroutines
        [$users, $count, $roles] = Octane::concurrently([
            fn () => User::select('id', 'name', 'email')->paginate(15),
            fn () => User::count(),
            fn () => \App\Models\Role::all(['id', 'name']),
        ]);
        
        return response()->json([
            'users' => $users,
            'total' => $count,
            'roles' => $roles,
        ]);
    }
    
    /**
     * Get user profile with cache
     */
    public function show(int $id)
    {
        return Octane::cache('user:' . $id, fn () => 
            User::with('profile', 'roles')->findOrFail($id),
        120 // TTL in seconds
        );
    }
}
```

```php
<?php
// app/Http/Middleware/HandleSwooleCompatibility.php

namespace App\Http\Middleware;

use Closure;

/**
 * Fix global state pollution in Swoole workers.
 * IMPORTANT: Register this as the FIRST global middleware.
 */
class HandleSwooleCompatibility
{
    public function handle($request, Closure $next)
    {
        // Reset static caches that may leak between requests
        app('log')->forgetContext();
        
        // Clear any request-specific static state
        \App\Services\PermissionService::clearCache();
        
        $response = $next($request);
        
        // Ensure no leaked state after response
        return $response;
    }
}
```

```php
<?php
// app/Providers/AppServiceProvider.php - Boot method additions

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Laravel\Octane\Events\WorkerStarting;
use Laravel\Octane\Events\RequestReceived;

class AppServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Warm up connections when worker starts
        $this->app['events']->listen(WorkerStarting::class, function () {
            // Pre-warm database connection
            try {
                \Illuminate\Support\Facades\DB::connection()->getPdo();
            } catch (\Throwable $e) {
                // Connection will be retried on first request
            }
            
            // Pre-warm cache connection
            \Illuminate\Support\Facades\Cache::getStore();
            
            echo "[Worker] Warmed up connections.\n";
        });
    }
}
```

### v3: 高级用法与Task Worker

```php
<?php
// app/Services/ReportService.php - Heavy tasks dispatched to Task Workers

namespace App\Services;

use Laravel\Octane\Facades\Octane;

class ReportService
{
    /**
     * Generate monthly report using Task Workers
     */
    public function generateMonthlyReport(int $year, int $month): string
    {
        // Run heavy computation in Task Worker
        return Octane::runInSandbox(function () use ($year, $month) {
            $startDate = \Carbon\Carbon::create($year, $month, 1);
            $endDate = $startDate->copy()->endOfMonth();
            
            // This runs in a separate task worker process
            // Won't block normal request workers
            $orders = \App\Models\Order::whereBetween('created_at', [$startDate, $endDate])
                ->with(['items.product', 'customer'])
                ->get();
            
            $report = [
                'period' => $startDate->format('Y-m'),
                'total_orders' => $orders->count(),
                'total_revenue' => $orders->sum('total_amount'),
                'top_products' => $orders->flatMap->items
                    ->groupBy('product_id')
                    ->map->sum('quantity')
                    ->sortDesc()
                    ->take(10),
            ];
            
            // Store report
            $filename = "reports/{$year}-{$month}.json";
            \Illuminate\Support\Facades\Storage::put($filename, json_encode($report, JSON_PRETTY_PRINT));
            
            return $filename;
        });
    }
}
```

```php
<?php
// app/Console/Commands/OctaneStatusCommand.php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class OctaneStatusCommand extends Command
{
    protected $signature = 'octane:status';
    protected $description = 'Check Octane server status';
    
    public function handle()
    {
        $config = config('octane.swoole.options', []);
        
        $this->info('Octane Swoole Configuration:');
        $this->table(['Parameter', 'Value'], [
            ['Workers', $config['worker_num'] ?? 'auto'],
            ['Task Workers', $config['task_worker_num'] ?? 0],
            ['Max Requests', $config['max_request'] ?? 'unlimited'],
            ['Host', config('octane.host', '127.0.0.1')],
            ['Port', config('octane.port', 8000)],
        ]);
        
        // Test endpoint
        $client = new \GuzzleHttp\Client();
        try {
            $start = microtime(true);
            $response = $client->get('http://127.0.0.1:' . config('octane.port', 8000) . '/api/health');
            $duration = round((microtime(true) - $start) * 1000, 2);
            $this->info("Health check: {$response->getStatusCode()} ({$duration}ms)");
        } catch (\Throwable $e) {
            $this->error('Server not responding: ' . $e->getMessage());
        }
    }
}
```

**执行预览：**
```
$ php artisan octane:start --workers=4 --max-requests=500

   INFO  Server running…

  Local: http://127.0.0.1:8000
  
  Workers: 4
  Max Requests: 500
  Runtime: Swoole 5.1.2

  Press Ctrl+C to stop the server

[Worker] Warmed up connections.
[Worker] Warmed up connections.
[Worker] Warmed up connections.
[Worker] Warmed up connections.
```

## 四、注意事项

| 项目 | 说明 |
|------|------|
| 全局状态 | 静态变量、全局变量在请求间不会重置，需手动清理 |
| 内存泄漏 | 第三方包可能泄漏，用`max_request`定期重启Worker |
| 文件上传 | Swoole的文件上传处理与FPM不同，注意测试 |
| 请求生命周期 | 部分FPM专属功能不可用（如`fastcgi_finish_request`） |
| 数据库连接 | Worker重启后连接可能断开，需要重连机制 |
| Session驱动 | 文件Session可能有问题，建议用Redis/数据库 |

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| 在构造函数中缓存请求相关数据 | 在方法中获取，或使用resolve回调 |
| 使用`$_SERVER`/`$_GET`超全局变量 | 使用Laravel Request对象 |
| 静态变量存储请求数据 | 每次请求从Request对象获取 |
| 忽略第三方包的全局状态 | 测试每个包在常驻内存下的表现 |
| 不设max_request | 设置500-1000防止内存泄漏 |
| 在Provider中绑定一次性数据 | 使用`flush`配置清理绑定 |

## 六、练习题

### 🟢 入门
1. 在现有Laravel项目中安装Octane，启动并测试基本功能
2. 用`wrk`压测对比FPM和Octane的性能差异

### 🟡 进阶
3. 使用`Octane::concurrently`并行查询3个不同的数据源
4. 实现一个内存缓存服务，用Octane Tables存储

### 🔴 挑战
5. 将Laravel队列Worker迁移到Swoole Task Worker
6. 实现Octane的WebSocket支持（基于Swoole WebSocket Server）

## 七、知识点总结

```
Swoole + Laravel集成
├── Laravel Octane
│   ├── 安装与配置
│   ├── Swoole驱动选择
│   ├── Worker/Task Worker
│   └── Tables（共享内存）
├── 关键API
│   ├── Octane::concurrently() → 并发执行
│   ├── Octane::cache() → 内存缓存
│   ├── Octane::runInSandbox() → 隔离执行
│   └── Octane::tick() → 定时任务
├── 内存管理
│   ├── 全局状态重置
│   ├── flush配置
│   ├── max_request重启
│   └── 内存监控
└── 兼容性
    ├── 中间件适配
    ├── 第三方包兼容
    ├── Session/Cache驱动
    └── 文件上传处理
```

## 八、举一反三

| 场景 | 方案 | 备注 |
|------|------|------|
| API服务 | Octane + API Routes | 性能提升最明显 |
| Web应用 | Octane + Blade | 注意Session驱动 |
| 后台任务 | Octane Task Worker | 替代Queue Worker |
| WebSocket | Swoole WS Server + Laravel | 需要自定义集成 |
| 定时任务 | Octane::tick() | 替代部分crontab |
| 微服务 | Octane + gRPC | Swoole gRPC支持 |

## 九、参考资料

- [Laravel Octane 官方文档](https://laravel.com/docs/octane)
- [Swoole + Laravel 最佳实践](https://www.swoole.co.uk/article/laravel)
- [Laravel Octane 源码分析](https://github.com/laravel/octane)
- [Laravel性能优化指南](https://laravel.com/docs/deployment#optimization)

## 十、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 安装配置 | Octane安装、Swoole配置 | 项目接入 |
| v2 应用适配 | 中间件、并发查询、缓存 | 功能开发 |
| v3 高级用法 | Task Worker、监控命令 | 生产优化 |
