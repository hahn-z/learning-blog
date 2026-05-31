---
title: "013 - 多环境配置管理（dev/staging/prod）与灰度策略"
slug: "013-multi-env-config"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.802+08:00"
updated_at: "2026-05-01T22:17:00.103+08:00"
reading_time: 5
tags: []
---

# 013 - 多环境配置管理与灰度策略

> **难度：** ⭐⭐⭐ | **前置知识：** Nacos 配置中心（012）、Hyperf 配置系统 | **预估用时：** 45 分钟

## 概念讲解

**一句话定义：** 多环境配置管理通过命名空间和分组策略，隔离开发、测试、预发、生产环境的配置，灰度策略则控制配置变更只对部分实例生效。

**现实类比：** 就像餐厅有前厅（生产）和后厨测试区（测试）——新品菜谱先在后厨试做（灰度），确认没问题再上菜单（全量发布）。不同分店（命名空间）可以有自己的特色菜（差异化配置）。

**技术场景：** 用户服务在开发环境用本地 MySQL，测试环境用测试库，生产用 RDS。灰度发布时，先让 10% 的用户服务实例使用新数据库连接池配置，观察无异常后再全量推送。

## 实时脑图

```
                    Nacos Server
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    Namespace:dev   Namespace:test  Namespace:prod
         │               │               │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │DEFAULT  │    │DEFAULT  │    │DEFAULT  │
    │GROUP    │    │GROUP    │    │GROUP    │
    │         │    │         │    │         │
    │user-svc │    │user-svc │    │user-svc │
    │config   │    │config   │    │config   │
    └─────────┘    └─────────┘    └─────────┘
                                       │
                                  ┌────┴────┐
                                  │灰度发布  │
                                  │         │
                                  │10%→新配置│
                                  │90%→旧配置│
                                  └─────────┘
```

## 完整代码

### Nacos 命名空间创建脚本 — init-namespaces.php

```php
<?php
// ✅ Initialize Nacos namespaces for multi-environment management

declare(strict_types=1);

$nacosHost = getenv('NACOS_HOST') ?: '127.0.0.1';
$baseUrl = "http://{$nacosHost}:8848/nacos/v1";

// Get access token first
$loginCtx = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query(['username' => 'nacos', 'password' => 'nacos']),
    ],
]);
$token = json_decode(file_get_contents("{$baseUrl}/auth/login", false, $loginCtx), true)['accessToken'] ?? '';

$namespaces = [
    ['id' => 'dev', 'name' => '开发环境'],
    ['id' => 'test', 'name' => '测试环境'],
    ['id' => 'staging', 'name' => '预发环境'],
    ['id' => 'prod', 'name' => '生产环境'],
];

foreach ($namespaces as $ns) {
    $url = "{$baseUrl}/console/namespaces?accessToken={$token}";
    $data = http_build_query([
        'customNamespaceId' => $ns['id'],
        'namespaceName' => $ns['name'],
        'type' => 0, // 0 = private
    ]);
    $ctx = stream_context_create([
        'http' => ['method' => 'POST', 'header' => 'Content-Type: application/x-www-form-urlencoded', 'content' => $data],
    ]);
    $result = file_get_contents($url, false, $ctx);
    echo "Create namespace [{$ns['name']}]: {$result}\n";
}
```

### 多环境 Nacos 配置 — config/autoload/nacos.php

```php
<?php
// ✅ Multi-environment Nacos config driven by APP_ENV

declare(strict_types=1);

// 🟢 Map APP_ENV to Nacos namespace
$envNamespaceMap = [
    'local' => 'dev',
    'develop' => 'dev',
    'test' => 'test',
    'staging' => 'staging',
    'production' => 'prod',
];

$currentEnv = env('APP_ENV', 'local');
$namespace = $envNamespaceMap[$currentEnv] ?? 'dev';

return [
    'server' => [
        'host' => env('NACOS_HOST', '127.0.0.1'),
        'port' => (int) env('NACOS_PORT', 8848),
        'username' => env('NACOS_USERNAME', 'nacos'),
        'password' => env('NACOS_PASSWORD', 'nacos'),
    ],
    'config' => [
        [
            'data_id' => env('NACOS_DATA_ID', 'user-service'),
            'group' => env('NACOS_GROUP', 'DEFAULT_GROUP'),
            'namespace' => $namespace,
            'type' => 'json',
        ],
        // 🟡 Optional: shared config across services
        [
            'data_id' => 'shared-infra',
            'group' => 'SHARED_GROUP',
            'namespace' => $namespace,
            'type' => 'json',
        ],
    ],
    'interval' => 30,
];
```

### 灰度配置服务 — GrayConfigService.php

```php
<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Di\Annotation\Inject;
use Psr\SimpleCache\CacheInterface;

class GrayConfigService
{
    #[Inject]
    private CacheInterface $cache;

    /**
     * ✅ Check if current instance should use gray config
     * Based on instance IP or a percentage rule stored in Nacos
     */
    public function isGrayInstance(): bool
    {
        $instanceIp = env('APP_INSTANCE_IP', '127.0.0.1');
        $grayIps = config('gray.instances', []);

        // Check IP-based gray list
        if (in_array($instanceIp, $grayIps, true)) {
            return true;
        }

        // Check percentage-based gray
        $grayPercent = (float) config('gray.percent', 0);
        if ($grayPercent > 0) {
            $hash = crc32($instanceIp) % 100;
            return $hash < $grayPercent;
        }

        return false;
    }

    /**
     * ✅ Get config value with gray awareness
     */
    public function getConfig(string $key, mixed $default = null): mixed
    {
        if ($this->isGrayInstance()) {
            // Try gray-specific config first
            $grayValue = config("gray.{$key}");
            if ($grayValue !== null) {
                return $grayValue;
            }
        }

        return config($key, $default);
    }
}
```

### 灰度配置示例（Nacos JSON）

```json
{
    "db": {
        "host": "prod-mysql.internal",
        "port": 3306,
        "pool": {
            "min_connections": 5,
            "max_connections": 30
        }
    },
    "gray": {
        "percent": 10,
        "instances": ["10.0.1.15", "10.0.1.16"],
        "db": {
            "pool": {
                "min_connections": 5,
                "max_connections": 50
            }
        }
    }
}
```

## 执行预览

```bash
# 创建命名空间
$ php init-namespaces.php
Create namespace [开发环境]: true
Create namespace [测试环境]: true
Create namespace [预发环境]: true
Create namespace [生产环境]: true

# 启动开发环境
$ APP_ENV=local php bin/hyperf.php start
[INFO] Nacos namespace: dev
[INFO] Config fetched: user-service@DEFAULT_GROUP [dev]

# 启动生产环境
$ APP_ENV=production php bin/hyperf.php start
[INFO] Nacos namespace: prod
[INFO] Config fetched: user-service@DEFAULT_GROUP [prod]

# 灰度检查
$ php bin/hyperf.php
> isGrayInstance() => true (IP: 10.0.1.15 is in gray list)
> getConfig('db.pool.max_connections') => 50 (gray config)
```

## 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 🔴 命名空间隔离 | 不同环境必须用不同 namespace | 开发误操作生产配置 |
| 🟡 APP_ENV 一致性 | 所有服务实例 APP_ENV 必须一致 | 混乱环境导致配置错乱 |
| 🔴 灰度比例控制 | 灰度从 1% 开始逐步放大 | 大比例灰度等于全量发布 |
| 🟢 共享配置 | 跨服务公共配置用单独 Data ID | 每个服务重复维护相同配置 |
| 🟡 回滚预案 | 配置变更前记录旧值 | 无法快速回滚 |

## 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| namespace 写死 | 所有环境拉同一份配置 | 通过 APP_ENV 动态映射 |
| 灰度无开关 | 无法停止灰度 | 提供 gray.percent=0 紧急关闭 |
| 忘记同步配置 | 新环境 Nacos 无配置导致启动失败 | 初始化脚本同步基础配置 |
| 配置漂移 | 各环境配置差异越来越大 | 用 shared-infra 统一基础配置 |
| 无审计日志 | 不知道谁改了配置 | 开启 Nacos 配置变更审计 |

## 练习题

### 🟢 基础
1. 在 Nacos 中创建 `dev` 和 `prod` 两个命名空间，分别创建不同的数据库配置。
2. 通过修改 `APP_ENV` 环境变量，验证 Hyperf 拉取到不同环境的配置。

### 🟡 进阶
3. 实现一个按用户 ID 尾号进行灰度的策略（如尾号为 0-4 的用户使用新配置）。

### 🔴 开放
4. 设计一个配置变更审批流程：开发提交配置变更 → 自动推送到 staging 验证 → 审批后才能推送到 prod。

## 知识点总结

```
多环境配置管理
├── 环境隔离
│   ├── Nacos Namespace
│   ├── APP_ENV 映射
│   └── 配置独立管理
├── 灰度策略
│   ├── IP 白名单灰度
│   ├── 百分比灰度
│   └── 用户特征灰度
├── 共享配置
│   ├── shared-infra Data ID
│   └── 跨服务复用
└── 安全措施
    ├── 灰度紧急关闭
    ├── 配置审计
    └── 回滚预案
```

## 举一反三

| 场景 | 适配方式 | 关键差异 |
|------|----------|----------|
| Kubernetes 部署 | 用 K8s Namespace + Nacos Group | K8s 原生 ConfigMap 补充 |
| Feature Flag | 在 Nacos 配置中加 feature_toggle 字段 | 比 A/B 测试平台更轻量 |
| 金丝雀发布 | 结合 K8s Canary + Nacos 灰度配置 | 双层控制更精细 |

## 参考资料

- ⭐⭐⭐ [Nacos 命名空间文档](https://nacos.io/zh-cn/docs/concepts.html)
- ⭐⭐ [Hyperf 环境变量管理](https://hyperf.wiki/3.1/#/zh-cn/config)
- ⭐⭐ [灰度发布最佳实践](https://nacos.io/zh-cn/blog/nacos-config-gray.html)

## 代码演进

### v1 ❌ 硬编码环境

```php
// ❌ Hardcoded environment — no flexibility
$namespace = 'dev';
if ($_SERVER['HOSTNAME'] === 'prod-server') {
    $namespace = 'prod';
}
```

### v2 ✅ 环境变量驱动

```php
// ✅ Environment-driven namespace mapping
$env = env('APP_ENV', 'local');
$map = ['local' => 'dev', 'production' => 'prod'];
$namespace = $map[$env] ?? 'dev';
```

### v3 🟢 完整灰度体系

```php
// 🟢 Full gray release with config-aware service
class GrayConfigService
{
    public function getConfig(string $key, mixed $default = null): mixed
    {
        if ($this->isGrayInstance()) {
            return config("gray.{$key}") ?? config($key, $default);
        }
        return config($key, $default);
    }
}
```
