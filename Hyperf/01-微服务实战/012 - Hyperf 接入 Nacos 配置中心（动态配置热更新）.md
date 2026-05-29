---
title: "012 - Hyperf 接入 Nacos 配置中心（动态配置热更新）"
slug: "012-nacos-config-center"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.794+08:00"
updated_at: "2026-05-01T22:16:59.788+08:00"
reading_time: 5
tags: []
---

# 012 - Hyperf 接入 Nacos 配置中心

> **难度：** ⭐⭐ | **前置知识：** Hyperf 框架基础、Nacos 部署（011）| **预估用时：** 40 分钟

## 概念讲解

**一句话定义：** Nacos 配置中心将应用配置从代码中抽离，集中存储在 Nacos Server，支持动态推送和版本管理。

**现实类比：** 就像公司用共享文档（如飞书文档）管理规章制度——所有人看同一份文档，HR 修改后大家立刻看到最新版，还能查看历史版本。不用每个人自己记一份。

**技术场景：** 用户服务的数据库连接、Redis 地址、第三方 API 密钥等配置，不再写死在 `.env` 文件里，而是统一存储在 Nacos。修改配置后无需重新部署，Hyperf 通过长轮询自动感知变化并热更新。

## 实时脑图

```
┌──────────────┐     pull config      ┌─────────────────────┐
│ Hyperf App   │ ◄────────────────── │   Nacos Config       │
│              │                      │   Center             │
│ config/      │  ──── long poll ────►│                      │
│ listener     │  ◄─── change push ───│  DataID: user-svc    │
│              │                      │  Group: DEFAULT      │
│ hot reload   │                      │  Namespace: dev      │
│ without      │                      │                      │
│ restart      │                      │  Version History ✓   │
└──────────────┘                      └─────────────────────┘
       │
       ▼
  ┌──────────┐
  │ .env     │ ← only bootstrap info (nacos address)
  │ fallback │
  └──────────┘
```

## 完整代码

### 安装依赖

```bash
composer require hyperf/config-nacos
```

### config/autoload/nacos.php

```php
<?php
// ✅ Nacos config center client configuration

declare(strict_types=1);

return [
    // ❌ Don't hardcode — use environment variables
    'server' => [
        'host' => env('NACOS_HOST', '127.0.0.1'),
        'port' => (int) env('NACOS_PORT', 8848),
        'username' => env('NACOS_USERNAME', 'nacos'),
        'password' => env('NACOS_PASSWORD', 'nacos'),
    ],

    // 🟡 Only pull the configs your service needs
    'config' => [
        [
            'data_id' => env('NACOS_DATA_ID', 'user-service'),
            'group' => env('NACOS_GROUP', 'DEFAULT_GROUP'),
            'namespace' => env('NACOS_NAMESPACE', ''),
            'type' => 'json',  // ✅ json is easiest to parse
        ],
    ],

    // 🟢 Long polling interval in seconds
    'interval' => 30,
];
```

### config/config_center.php

```php
<?php
// ✅ Enable config center with Nacos driver

declare(strict_types=1);

return [
    'enable' => (bool) env('CONFIG_CENTER_ENABLE', true),
    'driver' => env('CONFIG_CENTER_DRIVER', 'nacos'),
    'drivers' => [
        'nacos' => [
            'driver' => Hyperf\ConfigNacos\NacosDriver::class,
            'merge_mode' => Hyperf\ConfigCenter\Contract\ClientInterface::MERGE_APPEND,
        ],
    ],
];
```

### Nacos 上的配置 — user-service (DataID)

```json
{
    "db": {
        "host": "127.0.0.1",
        "port": 3306,
        "database": "user_service",
        "username": "root",
        "password": "secret",
        "pool": {
            "min_connections": 2,
            "max_connections": 10
        }
    },
    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "auth": "redis_pwd"
    },
    "cache": {
        "default_ttl": 3600,
        "prefix": "user:"
    },
    "third_party": {
        "sms_api_key": "ak-xxx",
        "sms_api_url": "https://sms.example.com/send"
    }
}
```

### 使用配置的 Service — UserService.php

```php
<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Di\Annotation\Inject;
use Psr\Container\ContainerInterface;

class UserService
{
    #[Inject]
    private ContainerInterface $container;

    public function getDbConfig(): array
    {
        // ✅ Config from Nacos is merged into Hyperf config
        $dbConfig = config('db', []);

        if (empty($dbConfig)) {
            // 🟡 Fallback to local config
            $dbConfig = config('database.connections.mysql', []);
        }

        return $dbConfig;
    }

    public function getCacheTtl(): int
    {
        // ✅ Nacos config available via config() helper
        return (int) config('cache.default_ttl', 3600);
    }

    public function getSmsConfig(): array
    {
        return [
            'api_key' => config('third_party.sms_api_key', ''),
            'api_url' => config('third_party.sms_api_url', ''),
        ];
    }
}
```

### 注册配置变更监听器 — ConfigChangeListener.php

```php
<?php

declare(strict_types=1);

namespace App\Listener;

use Hyperf\ConfigCenter\Event\ConfigChanged;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Log\LoggerInterface;

#[Listener]
class ConfigChangeListener implements ListenerInterface
{
    public function __construct(
        private LoggerInterface $logger
    ) {}

    public function listen(): array
    {
        return [ConfigChanged::class];
    }

    public function process(object $event): void
    {
        if ($event instanceof ConfigChanged) {
            $this->logger->info('Config changed', [
                'key' => $event->key,
                'value' => $event->value,
                'old_value' => $event->oldValue ?? null,
            ]);
        }
    }
}
```

## 执行预览

```bash
# 在 Nacos 控制台创建配置
# Data ID: user-service
# Group: DEFAULT_GROUP
# Format: JSON
# Content: { "db": {...}, "redis": {...} }

# 启动 Hyperf
$ php bin/hyperf.php start

# 日志输出
[INFO] Config center is enabled, driver: nacos
[INFO] Fetching config from nacos: user-service@DEFAULT_GROUP
[INFO] Config fetched and merged successfully
[INFO] Hot-reload watcher started, interval: 30s

# 修改 Nacos 配置后，日志自动更新
[INFO] Config changed: db.pool.max_connections → 20
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 Bootstrap 配置 | `.env` 只放 Nacos 连接信息，不放业务配置 | 连 Nacos 都连不上就无法拉取配置 |
| 🟡 配置格式 | JSON/YAML/YAML/Properties 保持统一 | 格式混乱导致解析失败 |
| 🟢 merge_mode | `MERGE_APPEND` 会覆盖本地同名 key | 本地配置被意外覆盖 |
| 🟡 配置大小 | 单个配置建议不超过 100KB | 大配置导致拉取慢、内存占用高 |
| 🔴 敏感信息 | Nacos 配置同样要加密敏感字段 | 明文密码泄露风险 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 未安装 config-nacos | 启动报 Class not found | `composer require hyperf/config-nacos` |
| data_id 写错 | 启动正常但 config() 返回空 | 确保 Data ID 和 Group 与 Nacos 控制台一致 |
| namespace 未配置 | 拉到错误环境的配置 | 开发/测试/生产用不同 namespace |
| JSON 格式错误 | 解析失败，配置不生效 | 用 JSON validator 检查格式 |
| 忘记开 config_center | 配置完全没拉取 | `CONFIG_CENTER_ENABLE=true` |

## 练习题

### 🟢 基础
1. 在 Nacos 控制台创建一个 JSON 格式配置，Data ID 为 `user-service`，包含数据库连接信息。
2. 修改 Nacos 配置中的某个值，观察 Hyperf 日志是否输出变更通知。

### 🟡 进阶
3. 实现一个配置降级策略：当 Nacos 不可用时，自动使用本地 `.env` 文件的配置。

### 🔴 开放
4. 设计一个方案，让配置变更触发指定的回调函数（如数据库连接池重建），而不是仅更新内存中的值。

## 知识点总结

```
Hyperf + Nacos 配置中心
├── 安装与配置
│   ├── composer require hyperf/config-nacos
│   ├── config/autoload/nacos.php
│   └── config/config_center.php
├── 工作原理
│   ├── 启动时拉取全量配置
│   ├── 长轮询监听变更
│   └── 变更后合并到 config()
├── 使用方式
│   ├── config('key') 读取
│   ├── ConfigChanged 事件监听
│   └── fallback 降级策略
└── 最佳实践
    ├── .env 只放 Nacos 连接信息
    ├── JSON 格式统一
    └── namespace 隔离环境
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| Apollo 配置中心 | 使用 hyperf/config-apollo | Apollo 有灰度发布和权限管控 |
| 本地开发调试 | 设置 `CONFIG_CENTER_ENABLE=false` | 跳过远程配置，全部走本地 |
| 多 Data ID | nacos.php 配置多个 config 条目 | 按模块拆分配置，职责清晰 |

## 参考资料

- ⭐⭐⭐ [Hyperf 配置中心文档](https://hyperf.wiki/3.1/#/zh-cn/config-center)
- ⭐⭐⭐ [Nacos 配置管理文档](https://nacos.io/zh-cn/docs/sdk.html)
- ⭐⭐ [hyper/config-nacos 源码](https://github.com/hyperf/config-nacos)

## 代码演进

### v1 ❌ 配置写死在代码中

```php
// ❌ Hardcoded config — can't change without redeploy
class UserService
{
    private string $dbHost = '127.0.0.1';
    private int $dbPort = 3306;
}
```

### v2 ✅ 使用 .env 文件

```php
// ✅ Environment-based but no dynamic update
class UserService
{
    private string $dbHost = env('DB_HOST', '127.0.0.1');
}
```

### v3 🟢 Nacos 配置中心 + 热更新

```php
// 🟢 Dynamic config with hot reload
class UserService
{
    public function getDbConfig(): array
    {
        return config('db', []);
        // Auto-updated when Nacos config changes
    }
}
```
