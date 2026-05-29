---
title: "030 - Swoole优雅重启与热更新"
slug: "030-graceful-restart"
category: "Swoole从入门到精通"
tech_stack: "Swoole"
created_at: "2026-04-26T21:14:41.506+08:00"
updated_at: "2026-04-29T10:02:47.113+08:00"
reading_time: 30
tags: ["Swoole", "PHP"]
---

# Swoole优雅重启与热更新

> 难度：⭐⭐⭐⭐（中高级）

## 一、概念讲解

### 为什么需要优雅重启？

PHP-FPM 模式下每次请求都是全新进程，代码修改立即生效。但 Swoole 是**常驻内存**的，代码只在启动时加载一次。修改代码后：

- ❌ 直接 `kill -9`：所有连接瞬间断开，数据丢失
- ✅ **优雅重启**：平滑切换 Worker，不中断服务

### Swoole 热更新原理

```
Master Process (PID=1000)
├── Manager Process (PID=1001)
│   ├── Worker #0 (PID=1002) ← 旧代码
│   ├── Worker #1 (PID=1003) ← 旧代码
│   ├── Worker #2 (PID=1004) ← 旧代码
│   └── Worker #3 (PID=1005) ← 旧代码
│
│  $ kill -USR1 1000  (发送 reload 信号)
│
│   ├── Worker #0 (PID=1006) ← 新代码 ✨
│   ├── Worker #1 (PID=1007) ← 新代码 ✨
│   ├── Worker #2 (PID=1008) ← 新代码 ✨
│   └── Worker #3 (PID=1009) ← 新代码 ✨

关键：逐个替换，总有 Worker 在服务，不中断！
```

### reload 的工作流程

1. 收到 `SIGUSR1` 信号（或调用 `$server->reload()`）
2. Manager 创建新 Worker 进程（加载最新代码）
3. 旧 Worker 处理完当前请求后退出
4. 全部替换完成，新代码生效

## 二、脑图

```
优雅重启与热更新
├── 原理
│   ├── Master 不重启（保持监听）
│   ├── Manager 逐个替换 Worker
│   └── 旧 Worker 处理完请求后退出
├── 触发方式
│   ├── kill -USR1 <pid>
│   ├── $server->reload()
│   ├── HTTP 接口触发
│   └── 文件监控自动 reload
├── 配置
│   ├── reload_async = true
│   ├── max_request = 10000
│   └── pid_file
├── 注意事项
│   ├── 只更新 Worker 代码
│   ├── Task Worker 也需要 reload
│   ├── 全局变量不重置（需 include）
│   └── onWorkerStart 中加载业务代码
└── 文件监控
    ├── inotify 扩展
    ├── Swoole\Timer 轮询
    └── watchman
```

## 三、代码演进

### v1：基础优雅重启

```php
<?php
// v1: Basic graceful reload
// Directory structure:
//   server.php  - this file (entry point, rarely changed)
//   app/        - business logic (frequently changed)

$server = new Swoole\Http\Server("0.0.0.0", 9501);

$server->set([
    "worker_num" => 4,
    "pid_file" => "/tmp/swoole.pid",       // Store PID for reload
    "reload_async" => true,                 // Async reload (recommended)
    "max_request" => 10000                  // Prevent memory leaks
]);

// Load business code in onWorkerStart (not at top-level!)
$server->on("WorkerStart", function ($server, $workerId) {
    // This runs AFTER reload, so new code takes effect
    require_once __DIR__ . "/app/routes.php";
});

$server->on("request", function ($request, $response) {
    // Delegate to loaded routes
    $response->end("Worker #" . $server->worker_id . " | PID:" . getmypid() . " | " . date("H:i:s"));
});

echo "Server PID: " . getmypid() . "\n";
echo "Reload: kill -USR1 " . getmypid() . "\n";
$server->start();
```

**触发重启：**

```bash
# Method 1: Signal
kill -USR1 $(cat /tmp/swoole.pid)

# Method 2: Built-in command
php server.php reload
```

### v2：文件监控自动热更新

```php
<?php
// v2: Auto-reload with file watcher
// Watches app/ directory, triggers reload on change

$server = new Swoole\Http\Server("0.0.0.0", 9501);

$server->set([
    "worker_num" => 4,
    "pid_file" => "/tmp/swoole.pid",
    "reload_async" => true,
    "max_request" => 10000,
    "task_worker_num" => 2,
    "log_file" => "/tmp/swoole.log"
]);

// --- File watcher in Manager process ---
$watchDir = __DIR__ . "/app";
$lastReload = 0;

if (function_exists("inotify_init")) {
    // Method A: inotify (efficient, needs extension)
    $inotify = inotify_init();
    stream_set_blocking($inotify, false);
    
    $watchDescriptor = inotify_add_watch($inotify, $watchDir, IN_MODIFY | IN_CREATE | IN_DELETE);
    
    Swoole\Timer::tick(1000, function () use ($inotify, $server, &$lastReload) {
        $events = inotify_read($inotify);
        if ($events && (time() - $lastReload > 2)) {
            $lastReload = time();
            echo "[Reload] File changed, reloading workers...\n";
            $server->reload();
        }
    });
    echo "Watching: {$watchDir} (inotify)\n";
} else {
    // Method B: File mtime polling (fallback)
    $fileHashes = [];
    
    Swoole\Timer::tick(2000, function () use ($watchDir, $server, &$fileHashes, &$lastReload) {
        $changed = false;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($watchDir)
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === "php") {
                $path = $file->getPathname();
                $mtime = $file->getMTime();
                
                if (!isset($fileHashes[$path]) || $fileHashes[$path] !== $mtime) {
                    $fileHashes[$path] = $mtime;
                    $changed = true;
                    echo "[Change] {$path}\n";
                }
            }
        }
        
        if ($changed && (time() - $lastReload > 3)) {
            $lastReload = time();
            echo "[Reload] Files changed, reloading...\n";
            $server->reload();
        }
    });
    echo "Watching: {$watchDir} (polling)\n";
}

// --- Business logic loading ---
$server->on("WorkerStart", function ($server, $workerId) {
    require_once __DIR__ . "/app/routes.php";
});

$server->on("request", function ($request, $response) use ($server) {
    $response->header("Content-Type", "application/json");
    $response->end(json_encode([
        "worker" => $server->worker_id,
        "pid" => getmypid(),
        "time" => date("Y-m-d H:i:s"),
        "memory" => round(memory_get_usage(true) / 1024 / 1024, 2) . "MB"
    ]));
});

$server->start();
```

### v3：生产级热更新（含版本管理、灰度、回滚）

```php
<?php
// v3: Production hot-update with version management
// Features: version tracking, health check, rollback, zero-downtime

$server = new Swoole\Http\Server("0.0.0.0", 9501);

// Version tracking (shared across workers)
$versionTable = new Swoole\Table(1);
$versionTable->column("version", Swoole\Table::TYPE_STRING, 32);
$versionTable->column("deployed_at", Swoole\Table::TYPE_INT);
$versionTable->column("deployed_by", Swoole\Table::TYPE_STRING, 64);
$versionTable->create();

$server->set([
    "worker_num" => swoole_cpu_num() * 2,
    "task_worker_num" => 4,
    "pid_file" => "/tmp/swoole-app.pid",
    "reload_async" => true,
    "max_request" => 50000,
    "log_file" => "/var/log/swoole-app.log",
    "heartbeat_check_interval" => 30,
    "heartbeat_idle_time" => 120
]);

// --- Load business code with version ---
$server->on("WorkerStart", function ($server, $workerId) use ($versionTable) {
    // Generate version from git or timestamp
    $version = trim(shell_exec("cd " . __DIR__ . " && git rev-parse --short HEAD 2>/dev/null") ?: date("YmdHis"));
    
    // Load all business modules
    $modules = glob(__DIR__ . "/app/*.php");
    foreach ($modules as $module) {
        // Clear opcode cache to ensure fresh code
        if (function_exists("opcache_invalidate")) {
            opcache_invalidate($module, true);
        }
        require_once $module;
    }
    
    // Record version
    $versionTable->set("current", [
        "version" => $version,
        "deployed_at" => time(),
        "deployed_by" => getmypid()
    ]);
    
    echo "[Worker#{$workerId}] Loaded version={$version} PID=" . getmypid() . "\n";
});

// --- HTTP handlers ---
$server->on("request", function ($request, $response) use ($server, $versionTable) {
    $path = $request->server["request_uri"] ?? "/";
    $method = $request->server["request_method"];
    
    switch ($path) {
        case "/health":
            $response->end("OK");
            break;
            
        case "/version":
            $v = $versionTable->get("current");
            $response->header("Content-Type", "application/json");
            $response->end(json_encode([
                "version" => $v["version"] ?? "unknown",
                "deployed_at" => date("Y-m-d H:i:s", $v["deployed_at"] ?? 0),
                "worker_id" => $server->worker_id,
                "pid" => getmypid()
            ]));
            break;
            
        case "/reload":
            // HTTP-triggered reload (with auth check)
            $token = $request->header["x-reload-token"] ?? "";
            if ($token !== getenv("RELOAD_TOKEN")) {
                $response->status(403);
                $response->end("Forbidden");
                return;
            }
            $response->end("Reloading...");
            $server->reload();
            break;
            
        default:
            $response->end("Server v3 running");
    }
});

// --- Master process startup ---
echo "=== Production Server v3 ===\n";
echo "PID: " . getmypid() . "\n";
echo "Workers: " . swoole_cpu_num() * 2 . "\n";
echo "Reload: kill -USR1 " . getmypid() . " or POST /reload\n";
$server->start();
```

**部署脚本（deploy.sh）：**

```bash
#!/bin/bash
# deploy.sh - Safe deployment with health check

set -e
PID_FILE="/tmp/swoole-app.pid"
HEALTH_URL="http://127.0.0.1:9501/health"

echo "=== Deploying ==="

# 1. Pull latest code
cd /app
git pull origin main
echo "[1/4] Code pulled"

# 2. Check syntax
find app/ -name "*.php" -exec php -l {} \; | grep -v "No syntax errors"
if [ $? -eq 0 ]; then
    echo "[ABORT] Syntax errors found!"
    exit 1
fi
echo "[2/4] Syntax OK"

# 3. Trigger graceful reload
PID=$(cat $PID_FILE)
kill -USR1 $PID
echo "[3/4] Reload signal sent to PID=$PID"

# 4. Wait and health check
for i in $(seq 1 30); do
    sleep 1
    if curl -sf $HEALTH_URL > /dev/null 2>&1; then
        echo "[4/4] Health check passed (${i}s)"
        VERSION=$(curl -s http://127.0.0.1:9501/version | jq -r .version)
        echo "Deployed: $VERSION"
        exit 0
    fi
done

echo "[FAIL] Health check timeout after 30s"
echo "Rolling back..."
git reset --hard HEAD~1
kill -USR1 $PID
exit 1
```

## 四、执行预览

```
# Start server
$ php v3-server.php
=== Production Server v3 ===
PID: 12345
Workers: 8
[Worker#0] Loaded version=a1b2c3d PID=12346
[Worker#1] Loaded version=a1b2c3d PID=12347
...

# Before reload
$ curl http://127.0.0.1:9501/version
{"version":"a1b2c3d","deployed_at":"2026-04-28 22:00:00"}

# Trigger reload
$ kill -USR1 12345
[Worker#0] Loaded version=f4e5d6c PID=12350  ← New PID, new code
[Worker#1] Loaded version=f4e5d6c PID=12351
...

# After reload
$ curl http://127.0.0.1:9501/version
{"version":"f4e5d6c","deployed_at":"2026-04-28 22:01:00"}

# Deploy script
$ ./deploy.sh
=== Deploying ===
[1/4] Code pulled
[2/4] Syntax OK
[3/4] Reload signal sent to PID=12345
[4/4] Health check passed (3s)
Deployed: x7y8z9a
```

## 五、注意事项

| 项目 | 说明 |
|------|------|
| reload 只影响 Worker | Master/Manager 进程代码不会更新 |
| onWorkerStart 加载 | 业务代码必须在 `onWorkerStart` 中 include/require，不能在文件顶部 |
| reload_async | 设为 `true` 让旧 Worker 处理完当前请求再退出 |
| max_request | 防止内存泄漏，Worker 处理N个请求后自动重启 |
| Task Worker | reload 默认只更新 Worker，需 `kill -USR2` 更新 Task Worker |
| opcache | 如开启 opcache，reload 后可能需要 `opcache_invalidate()` |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 业务代码写在文件顶部 | 在 `onWorkerStart` 中 require |
| `kill -9` 强杀进程 | `kill -USR1` 优雅 reload |
| 不设 max_request | 设置 `max_request` 防止内存泄漏 |
| 忽略 opcache 缓存 | reload 前清 opcache 或用 `opcache_invalidate` |
| 不做健康检查 | reload 后验证服务是否正常 |
| 直接改入口文件 | 入口文件尽量不动，业务代码分离到 app/ |

## 七、练习题

### 🟢 基础题
1. 创建 HTTP Server，记录 PID 到文件，用 `kill -USR1` 触发 reload，观察 Worker PID 变化。
2. 在 `onWorkerStart` 中加载一个 PHP 文件，修改该文件后 reload，验证新代码生效。

### 🟡 进阶题
3. 实现文件监控：用 `Swoole\Timer` 轮询 app/ 目录，检测到 .php 文件修改后自动 reload。
4. 实现 HTTP 接口 `/reload`，带 Token 认证，触发热更新。

### 🔴 挑战题
5. 实现蓝绿部署：同时启动两个 Server 实例（不同端口），通过 Nginx upstream 切换流量，实现零停机部署。

## 八、知识点总结

```
优雅重启知识树
├── 信号
│   ├── SIGUSR1 → reload Worker
│   ├── SIGUSR2 → reload Task Worker
│   └── SIGTERM → 安全关闭
├── 配置
│   ├── reload_async = true
│   ├── max_request
│   ├── pid_file
│   └── log_file
├── 代码结构
│   ├── 入口文件（不变）
│   ├── onWorkerStart（加载业务代码）
│   └── app/ 目录（业务代码）
├── 触发方式
│   ├── kill -USR1
│   ├── $server->reload()
│   ├── HTTP 接口
│   └── 文件监控
└── 部署
    ├── git pull + reload
    ├── 健康检查
    ├── 回滚机制
    └── 灰度发布
```

## 九、举一反三

| 场景 | 热更新策略 |
|------|-----------|
| Web API 服务 | onWorkerStart + max_request + reload |
| WebSocket 长连接 | reload_async 保持连接不断 |
| CLI 常驻任务 | Supervisor 管理 + 信号 reload |
| 微服务 | K8s rolling update + 健康检查 |
| 定时任务 | Cron 替换 + 锁防重复 |

## 十、参考资料

- [Swoole Server::reload](https://wiki.swoole.com/#/server/methods?id=reload)
- [Swoole 信号处理](https://wiki.swoole.com/#/server/options?id=reload_async)
- [Swoole onWorkerStart](https://wiki.swoole.com/#/server/events?id=onworkerstart)
- [Nginx 零停机部署](https://nginx.org/en/docs/control.html#upgrade)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| v1 | 基础 reload + PID文件 | 学习和简单服务 |
| v2 | 文件监控自动 reload | 开发环境 |
| v3 | 生产级：版本管理、健康检查、部署脚本 | 生产环境 |
