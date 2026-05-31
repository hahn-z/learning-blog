---
title: "037 - Grafana 仪表盘搭建与告警配置"
slug: "037-grafana-dashboard"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:09.036+08:00"
updated_at: "2026-05-01T22:15:41.565+08:00"
reading_time: 6
tags: []
---

# Grafana 仪表盘搭建与告警配置

> **难度：** ⭐⭐⭐
> **前置知识：** Prometheus 指标采集（036篇）、Docker 基础
> **预估用时：** 45-60 分钟

## 1. 概念讲解

**Grafana** 是开源的数据可视化和监控平台，支持多种数据源（Prometheus、InfluxDB、MySQL 等），通过仪表盘（Dashboard）将指标数据转化为直观的图表，并支持灵活的告警规则。

类比理解：如果 Prometheus 是仓库里的数据记录员，Grafana 就是前台的大屏展示系统。它把枯燥的数字变成好看的折线图、柱状图、仪表盘，还能在指标异常时自动打电话（告警）通知值班人员。

在用户服务中，我们将搭建注册监控仪表盘，展示 QPS、成功率、P99 延迟、活跃用户数等核心指标，并配置告警规则：当注册失败率超过 5% 时自动通知。

## 2. 实时脑图

```
┌──────────────────────────────────────────────────┐
│        Grafana Dashboard Architecture             │
├──────────────────────────────────────────────────┤
│                                                   │
│  [Prometheus TSDB] --query--> [Grafana]           │
│                                   |               │
│                      ┌────────────┼──────────┐   │
│                      v            v          v   │
│                  [Row: Overview]                    │
│                  |-- QPS Panel (graph)             │
│                  |-- Success Rate (stat)           │
│                  |-- P99 Latency (graph)           │
│                  +-- Active Users (gauge)          │
│                                                   │
│                  [Row: Errors]                     │
│                  |-- Error Rate (graph)            │
│                  +-- Error Log (table)             │
│                                                   │
│                  [Alert Rules]                     │
│                  |-- Error rate > 5% -> webhook    │
│                  |-- P99 > 2s -> email             │
│                  +-- No data > 5m -> pager         │
└──────────────────────────────────────────────────┘
```

## 3. 完整代码

### 3.1 Docker Compose 扩展 `docker-compose.yml`

```yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  # ✅ Grafana service
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### 3.2 Grafana 数据源配置 `grafana/provisioning/datasources/prometheus.yml`

```yaml
# ✅ Auto-configure Prometheus as Grafana data source
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

### 3.3 仪表盘 JSON 配置 `grafana/dashboards/user-service.json`

```json
{
  "dashboard": {
    "title": "User Service Dashboard",
    "tags": ["user-service", "hyperf"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Registration QPS",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "rate(user_service_user_registrations_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "id": 2,
        "title": "Registration Success Rate",
        "type": "stat",
        "gridPos": {"h": 8, "w": 6, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "rate(user_service_user_registrations_total{status=\"success\"}[5m]) / rate(user_service_user_registrations_total[5m]) * 100",
            "legendFormat": "Success %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"value": null, "color": "green"},
                {"value": 95, "color": "yellow"},
                {"value": 99, "color": "green"}
              ]
            }
          }
        }
      },
      {
        "id": 3,
        "title": "Registration P99 Latency",
        "type": "timeseries",
        "gridPos": {"h": 8, "w": 6, "x": 18, "y": 0},
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(user_service_registration_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Users",
        "type": "gauge",
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "user_service_active_users",
            "legendFormat": "Active"
          }
        ]
      }
    ],
    "refresh": "10s"
  },
  "overwrite": true
}
```

### 3.4 告警规则 `grafana/provisioning/alerting/rules.yml`

```yaml
# ✅ Alert rules for user service
groups:
  - name: user_service_alerts
    rules:
      # 🔴 Alert: registration error rate exceeds 5%
      - alert: HighRegistrationErrorRate
        expr: |
          (
            rate(user_service_user_registrations_total{status="error"}[5m])
            / rate(user_service_user_registrations_total[5m])
          ) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Registration error rate is high"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      # 🔴 Alert: P99 latency exceeds 2 seconds
      - alert: HighRegistrationLatency
        expr: |
          histogram_quantile(0.99,
            rate(user_service_registration_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Registration P99 latency is too high"
          description: "P99 latency is {{ $value }}s"
```

### 3.5 Grafana 告警通知渠道 `grafana/provisioning/alerting/notifiers.yml`

```yaml
# ✅ Webhook notification channel for alerts
notifiers:
  - name: webhook-notify
    type: webhook
    uid: webhook-1
    settings:
      url: "http://host.docker.internal:9501/api/alerts/webhook"
      httpMethod: POST

# ✅ Alert notification policy
policies:
  - receiver: webhook-notify
    group_by: ['alertname']
    group_wait: 10s
    group_interval: 5m
    repeat_interval: 1h
```

### 3.6 Webhook 接收端 `app/Controller/AlertController.php`

```php
<?php
declare(strict_types=1);

namespace App\Controller;

use Hyperf\HttpServer\Annotation\Controller;
use Hyperf\HttpServer\Annotation\PostMapping;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Log\LoggerInterface;
use Hyperf\Di\Annotation\Inject;

#[Controller(prefix: '/api/alerts')]
class AlertController
{
    #[Inject]
    private LoggerInterface $logger;

    /**
     * ✅ Receive Grafana alert webhook
     */
    #[PostMapping('/webhook')]
    public function webhook(RequestInterface $request): array
    {
        $payload = $request->all();

        $this->logger->warning('Grafana alert received', [
            'alerts' => $payload,
        ]);

        // ✅ Process alert: send to Slack, DingTalk, etc.
        // $this->notificationService->sendAlert($payload);

        return ['status' => 'ok'];
    }
}
```

## 4. 执行预览

```bash
$ docker-compose up -d

# Access Grafana: http://localhost:3000 (admin/admin)
# Import dashboard or auto-provisioned

# Test alert webhook:
$ curl -X POST http://localhost:9501/api/alerts/webhook \
  -H "Content-Type: application/json" \
  -d '{"title":"High Error Rate","state":"alerting"}'

# Logs:
# [WARNING] Grafana alert received {"alerts":{"title":"High Error Rate","state":"alerting"}}
```

## 5. 注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| Dashboard JSON 版本控制 | 纳入 Git 管理 | 配置丢失无法恢复 |
| 告警阈值要调优 | 基于历史数据设置 | 误报过多导致告警疲劳 |
| 数据源用 provisioning | 不要手动配置 | 重启后配置丢失 |
| 告警分级 | warning/critical 区分 | 所有告警同等对待无法排优先级 |
| 避免仪表盘过载 | 面板不超过 20 个 | 加载慢，信息过载 |

## 6. 避坑指南

| 错误 | 现象 | 正确做法 |
|------|------|----------|
| 告警不设 `for` 持续时间 | 瞬时抖动触发告警 | 设 `for: 2m` 持续后才触发 |
| 只用邮件告警 | 深夜邮件被忽略 | 同时配置 IM/短信/webhook |
| 面板用绝对时间范围 | 看不到最新数据 | 用相对时间如 `now-1h` to `now` |
| 不做仪表盘分类 | 所有图表堆一起 | 用 Row 分组：Overview/Errors/Performance |
| PromQL 写错 | 图表显示 No Data | 先在 Prometheus UI 验证查询 |

## 7. 练习题

🟢 **基础题 1：** 在 Grafana 中创建一个 CPU 使用率面板。

🟢 **基础题 2：** 配置一个告警：当活跃用户数为 0 持续 10 分钟时触发。

🟡 **进阶题：** 使用 Grafana Variables 实现可切换环境的仪表盘（dev/staging/prod）。

🔴 **开放题：** 设计一个完整的 On-Call 告警体系，包含分级、升级、静默机制。

## 8. 知识点总结

```
Grafana Dashboard & Alerting
├── Setup
│   ├── Docker Compose (Prometheus + Grafana)
│   ├── Datasource provisioning
│   └── Dashboard provisioning (JSON)
├── Dashboard Panels
│   ├── timeseries (QPS, latency trends)
│   ├── stat (success rate)
│   └── gauge (active users)
├── PromQL Examples
│   ├── rate() for QPS
│   ├── histogram_quantile() for P99
│   └── ratio for success rate
├── Alerting
│   ├── Prometheus alert rules
│   ├── Notification channels (webhook)
│   └── Alert severity (warning/critical)
└── Best Practices
    ├── Version-controlled JSON
    ├── Provisioning over manual config
    └── Alert threshold tuning
```

## 9. 举一反三

| 场景 | 面板设计 | 告警规则 |
|------|----------|----------|
| API 网关 | QPS/延迟/错误率 by path | 5xx > 1% 触发 critical |
| 数据库 | 连接数/查询延迟/慢查询 | 慢查询 > 100/min |
| Kafka | 消费延迟/消息堆积 | 堆积 > 10000 触发 warning |

## 10. 参考资料

- 🏆 [Grafana 官方文档](https://grafana.com/docs/grafana/latest/)
- 🏆 [Prometheus Alerting 规则](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- ⭐ [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- 📖 [SRE 监控框架](https://sre.google/sre-book/monitoring-distributed-systems/)

## 11. 代码演进

### v1 ❌ 无监控无告警
```php
// ❌ No metrics, no dashboards, no alerts
// Discover issues only when users complain
```

### v2 ✅ 基础仪表盘
```yaml
# ✅ Basic Grafana dashboard with QPS and latency panels
# But no alerting, manual setup
```

### v3 🟢 完整监控体系
```yaml
# 🟢 Auto-provisioned dashboards + Prometheus alert rules
# + webhook notification + alert severity classification
# Version-controlled, reproducible deployment
```
