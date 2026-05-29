---
title: "036 - Prometheus 指标采集与 Hyperf 集成"
slug: "036-prometheus-metrics"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09.028+08:00"
updated_at: "2026-05-01T22:08:21.077+08:00"
reading_time: 4
tags: []
---

# Prometheus 指标采集与 Hyperf 集成

> **难度：** ⭐⭐⭐
> **前置知识：** Hyperf 中间件、HTTP 基础、Docker 基础
> **预估用时：** 40-55 分钟

## 1. 概念讲解

**Prometheus** 是开源监控和告警系统，通过 HTTP 拉取方式采集服务指标数据，支持 PromQL 查询语言和多维数据模型。

类比理解：Prometheus 像定时巡检员，每 15 秒到各车间（服务）的告示牌（/metrics）抄录数据，存入仓库（TSDB）。需要报表时用 PromQL 查询即可。

在用户服务中，我们采集注册接口的 QPS、响应时间、错误率等关键指标，为 Grafana 可视化和告警提供数据基础。

## 2. 实时脑图

```
┌──────────────────────────────────────────────┐
│     Prometheus + Hyperf Integration           │
├──────────────────────────────────────────────┤
│                                               │
│  [User Service]                               │
│    |-- /api/metrics (exposed endpoint)        │
│    |-- Counter: registrations_total           │
│    |-- Gauge: active_users                    │
│    +-- Histogram: registration_duration       │
│                                               │
│  [Prometheus Server]                          │
│    |-- Scrape: localhost:9501/metrics          │
│    |-- Interval: 15s                          │
│    +-- TSDB storage                           │
│                                               │
│  Metric Types:                                │
│  |-- Counter (monotonic increment)            │
│  |-- Gauge (up and down)                      │
│  |-- Histogram (distribution)                 │
│  +-- Summary (quantiles)                      │
└──────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 安装

```bash
composer require hyperf/metric
```

### 3.2 配置 `config/autoload/metric.php`

```php
<?php
declare(strict_types=1);

return [
    'default' => env('METRIC_DRIVER', 'prometheus'),
    'prometheus' => [
        'path' => '/api/metrics',
        'namespace' => 'user_service',
        'adapter' => \Hyperf\Metric\Adapter\Prometheus\Constants::PROMETHEUS_ADAPTER_APCu,
    ],
    'use_standalone_process' => true,
    'enable_default_metric' => true,
];
```

### 3.3 注册指标 `app/Metrics/RegistrationMetrics.php`

```php
<?php
declare(strict_types=1);

namespace App\Metrics;

use Hyperf\Metric\Contract\MetricFactoryInterface;
use Hyperf\Di\Annotation\Inject;

class RegistrationMetrics
{
    #[Inject]
    private MetricFactoryInterface $metricFactory;

    private $registrationCounter;
    private $activeUsersGauge;
    private $registrationDuration;

    public function __construct()
    {
        // ✅ Counter: total registrations by status
        $this->registrationCounter = $this->metricFactory->makeCounter(
            'user_registrations_total',
            ['status']
        );

        // ✅ Gauge: currently active users
        $this->activeUsersGauge = $this->metricFactory->makeGauge('active_users', []);

        // ✅ Histogram: registration duration distribution
        $this->registrationDuration = $this->metricFactory->makeHistogram(
            'registration_duration_seconds',
            [],
            [0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
        );
    }

    /** ✅ Record a registration attempt */
    public function recordRegistration(string $status, float $duration): void
    {
        $this->registrationCounter->with($status)->inc();
        $this->registrationDuration->observe($duration);
    }

    /** ✅ Update active user count */
    public function setActiveUsers(int $count): void
    {
        $this->activeUsersGauge->set($count);
    }
}
```

### 3.4 控制器使用

```php
<?php
declare(strict_types=1);

namespace App\Controller;

use App\Metrics\RegistrationMetrics;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\PostMapping;
use Hyperf\HttpServer\Contract\RequestInterface;

#[Controller(prefix: '/api')]
class RegisterController
{
    #[Inject] private RegistrationMetrics $metrics;

    #[PostMapping('/register')]
    public function register(RequestInterface $request): array
    {
        $start = microtime(true);
        try {
            // ... registration logic ...
            $this->metrics->recordRegistration('success', microtime(true) - $start);
            return ['code' => 0, 'message' => 'OK'];
        } catch (\Throwable $e) {
            $this->metrics->recordRegistration('error', microtime(true) - $start);
            return ['code' => 500, 'message' => 'Internal error'];
        }
    }
}
```

### 3.5 Prometheus 配置 `prometheus.yml`

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'user-service'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['host.docker.internal:9501']
```

## 4. 执行预览

```bash
$ curl http://localhost:9501/api/metrics
# user_service_user_registrations_total{status="success"} 42
# user_service_user_registrations_total{status="error"} 3
# user_service_registration_duration_seconds_bucket{le="0.1"} 30

# PromQL: rate(user_service_user_registrations_total{status="success"}[5m])
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| 标签名不用高基数 | 如 user_id 做标签 | TSDB 膨胀 |
| metrics 端点访问控制 | 防止暴露内部数据 | 信息泄露 |
| Histogram bucket 合理 | 覆盖 99% 请求 | P99 不准确 |
| 独立进程收集 | standalone_process=true | 影响 Worker 性能 |
| 指标命名遵循规范 | namespace_subsystem_name | 混乱难管理 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| Gauge 当 Counter | 重启归零趋势断崖 | 持续增长用 Counter |
| 标签值太细 | 指标爆炸 | 用低基数值如 status |
| 采集间隔太粗 | 看不到瞬时变化 | 设 15s |
| 端点裸露 | 内部指标泄露 | 加鉴权或内网隔离 |

## 7. 练习题

🟢 **基础题 1：** 添加 `http_requests_total` Counter，按 method 和 path 分类。

🟢 **基础题 2：** 用 PromQL 查最近 1 小时注册成功率。

🟡 **进阶题：** 实现 `SagaExecutionDuration` Histogram。

🔴 **开放题：** 设计用户服务完整监控指标体系（RED + USE 方法论）。

## 8. 知识点总结

```
Prometheus + Hyperf
├── Metric Types: Counter / Gauge / Histogram / Summary
├── Configuration: driver, path, standalone_process
├── Custom Metrics: RegistrationMetrics
├── Labels for dimensionality
└── PromQL queries
```

## 9. 举一反三

| 场景 | 指标类型 | 标签 |
|------|----------|------|
| API 请求 | Counter + Histogram | method, path, status_code |
| 数据库连接池 | Gauge | pool_name, state |
| Kafka 消费延迟 | Gauge | topic, consumer_group |

## 10. 参考资料

- 🏆 [Prometheus 文档](https://prometheus.io/docs/introduction/overview/)
- 🏆 [Hyperf Metric 组件](https://hyperf.wiki/3.1/#/zh-cn/metric)
- ⭐ [Prometheus 命名规范](https://prometheus.io/docs/practices/naming/)

## 11. 代码演进

### v1 ❌ 无监控
```php
public function register() { /* process */ return ['code' => 0]; }
```

### v2 ✅ 日志
```php
$this->logger->info('Registration completed', ['duration' => $duration]);
```

### v3 🟢 Prometheus
```php
$this->metrics->recordRegistration('success', $duration);
// Grafana dashboards, alerting, trend analysis
```
