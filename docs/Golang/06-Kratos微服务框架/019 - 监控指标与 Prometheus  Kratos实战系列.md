---
title: "019 - 监控指标与 Prometheus | Kratos实战系列"
slug: "019-kratos-metrics"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:01:48.743+08:00"
updated_at: "2026-04-29T10:02:45.424+08:00"
reading_time: 24
tags: []
---

# 监控指标与 Prometheus

> **难度：** ⭐⭐⭐ | **预计阅读：** 16 分钟
>
> 在 Kratos 微服务中集成 Prometheus 监控：指标暴露、自定义业务指标、Grafana 可视化看板、告警规则和 SLI/SLO 设计。

---

## 1. 概念讲解

### 可观测性三支柱

| 支柱 | 工具 | 关注点 |
|------|------|-------|
| Metrics（指标） | Prometheus | 系统健康、性能趋势 |
| Traces（追踪） | Jaeger | 请求链路、瓶颈定位 |
| Logs（日志） | Loki/ELK | 事件记录、故障排查 |

本文聚焦 **Metrics**。

### Prometheus 指标类型

| 类型 | 说明 | 示例 |
|------|------|------|
| Counter | 单调递增计数器 | 请求总数、错误总数 |
| Gauge | 可增可减的仪表盘 | 当前在线用户、CPU 使用率 |
| Histogram | 分布统计（分位数） | 请求延迟分布 |
| Summary | 客户端计算分位数 | 请求延迟（精确但不可聚合） |

### Kratos metrics 集成

Kratos 提供 `metrics` 中间件接口，默认支持 Prometheus。核心流程：

```
Request → metrics Middleware → Handler → Record metrics (latency, status, etc.)
                                        → /metrics endpoint for Prometheus scrape
```

---

## 2. 脑图

```
Prometheus 监控
├── 指标类型
│   ├── Counter (递增计数)
│   ├── Gauge (仪表盘)
│   ├── Histogram (分布直方图)
│   └── Summary (客户端分位数)
├── Kratos 集成
│   ├── metrics 中间件
│   ├── prometheus Provider
│   └── /metrics 暴露端点
├── 自定义业务指标
│   ├── 注册指标
│   ├── 在 Service 层埋点
│   └── 标签设计 (Labels)
├── Grafana 可视化
│   ├── 数据源配置
│   ├── Dashboard 模板
│   └── 变量/过滤
├── 告警规则
│   ├── Prometheus AlertManager
│   ├── 告警规则编写
│   └── 告警路由/收敛
└── SLI/SLO
    ├── 可用性 SLI
    ├── 延迟 SLI
    └── 错误率 SLI
```

---

## 3. 完整 Go 代码

### v1 — Kratos + Prometheus 基础集成

```go
// cmd/server/main.go
package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/middleware/metrics"
	"github.com/go-kratos/kratos/v2/transport/http"
	promMetrics "github.com/go-kratos/kratos/v2/middleware/metrics/prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// Create Prometheus registry
	registry := prometheus.NewRegistry()

	// Create metrics middleware
	m, err := promMetrics.NewMetrics(
		promMetrics.WithRegistry(registry),
	)
	if err != nil {
		panic(err)
	}

	// Business HTTP server with metrics middleware
	httpSrv := http.NewServer(
		http.Address(":8000"),
		http.Middleware(
			metrics.Server(
				metrics.WithSeconds(m.Histogram("kratos_http_seconds")),
				metrics.WithRequests(m.Counter("kratos_http_requests_total")),
			),
		),
	)

	// Separate metrics server for Prometheus scrape
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.HandlerFor(
		registry,
		promhttp.HandlerOpts{},
	))
	metricsSrv := &http.Server{Addr: ":9000", Handler: metricsMux}
	go metricsSrv.ListenAndServe()

	app := kratos.New(kratos.Server(httpSrv))
	app.Run()
}
```

### v2 — 自定义业务指标

```go
// internal/pkg/metrics/business.go
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	// Order metrics
	OrdersCreated = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "business_orders_created_total",
		Help: "Total number of orders created",
	}, []string{"product_type", "channel"})

	OrderAmount = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "business_order_amount",
		Help:    "Order amount distribution",
		Buckets: []float64{10, 50, 100, 500, 1000, 5000},
	}, []string{"product_type"})

	// User metrics
	ActiveUsers = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "business_active_users",
		Help: "Current number of active users",
	}, []string{"platform"})

	// Payment metrics
	PaymentDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "business_payment_duration_seconds",
		Help:    "Payment processing duration",
		Buckets: prometheus.DefBuckets,
	}, []string{"payment_method"})
)

func RegisterBusinessMetrics(reg prometheus.Registerer) {
	reg.MustRegister(
		OrdersCreated,
		OrderAmount,
		ActiveUsers,
		PaymentDuration,
	)
}
```

```go
// internal/service/order.go — record business metrics
package service

import (
	"time"

	"your-project/internal/pkg/metrics"
)

func (s *OrderService) CreateOrder(ctx context.Context, req *v1.CreateOrderReq) (*v1.CreateOrderReply, error) {
	// ... business logic

	// Record metrics
	metrics.OrdersCreated.WithLabelValues(req.ProductType, req.Channel).Inc()
	metrics.OrderAmount.WithLabelValues(req.ProductType).Observe(float64(req.Amount))

	return reply, nil
}

func (s *OrderService) ProcessPayment(ctx context.Context, req *v1.PaymentReq) (*v1.PaymentReply, error) {
	start := time.Now()
	defer func() {
		duration := time.Since(start).Seconds()
		metrics.PaymentDuration.WithLabelValues(req.Method).Observe(duration)
	}()

	// ... payment logic
	return reply, nil
}
```

### v3 — Grafana 看板 + 告警规则

```yaml
# docker-compose.yml — full monitoring stack
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  alertmanager:
    image: prom/alertmanager:v0.26.0
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'user-service'
    static_configs:
      - targets: ['host.docker.internal:9000']
        labels:
          service: 'user-service'

# Alert rules
rule_files:
  - 'alert_rules.yml'
```

```yaml
# alert_rules.yml — SLI/SLO based alerting
groups:
  - name: slo-alerts
    rules:
      # Availability: error rate > 1% in 5 min
      - alert: HighErrorRate
        expr: |
          sum(rate(kratos_http_requests_total{code=~"5.."}[5m]))
          /
          sum(rate(kratos_http_requests_total[5m]))
          > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate exceeds 1% SLO"
          description: "Current error rate: {{ $value | humanizePercentage }}"

      # Latency: P99 > 500ms in 5 min
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(kratos_http_seconds_bucket[5m])) by (le)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency exceeds 500ms SLO"
```

```json
// Grafana Dashboard JSON (simplified)
{
  "dashboard": {
    "title": "Kratos Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{"expr": "sum(rate(kratos_http_requests_total[5m])) by (method)"}]
      },
      {
        "title": "P95/P99 Latency",
        "targets": [
          {"expr": "histogram_quantile(0.95, sum(rate(kratos_http_seconds_bucket[5m])) by (le))"},
          {"expr": "histogram_quantile(0.99, sum(rate(kratos_http_seconds_bucket[5m])) by (le))"}
        ]
      },
      {
        "title": "Error Rate",
        "targets": [{"expr": "sum(rate(kratos_http_requests_total{code=~\"5..\"}[5m])) / sum(rate(kratos_http_requests_total[5m]))"}]
      }
    ]
  }
}
```

---

## 4. 执行预览

```bash
# Start monitoring stack
$ docker compose up -d

# Start service
$ go run cmd/server/main.go
INFO msg=metrics server addr=:9000

# Generate traffic
$ for i in $(seq 100); do curl -s http://localhost:8000/user/1 > /dev/null; done

# Check metrics
$ curl http://localhost:9000/metrics | grep kratos_http
kratos_http_requests_total{method="GET",path="/user/1",code="200"} 100
kratos_http_seconds_bucket{method="GET",path="/user/1",le="0.005"} 85
kratos_http_seconds_bucket{method="GET",path="/user/1",le="0.01"} 95

# Grafana → http://localhost:3000 (admin/admin)
# Prometheus → http://localhost:9090
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| 指标端口分离 | 业务端口和 metrics 端口分开，避免暴露内部数据 |
| Histogram Buckets | 根据实际延迟分布调整，默认桶未必合适 |
| Label 基数 | Label 值不能是高基数的（如 user_id），否则内存爆炸 |
| 命名规范 | `namespace_subsystem_name_unit`（如 `kratos_http_requests_total`） |
| scrape 间隔 | 15s-30s 合适，太短增加 Prometheus 压力 |

---

## 6. 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| Label 用 user_id 等 `高` 基数值 | Label 用低基数值（method/status/path） |
| 用 Summary 代替 Histogram | 用 Histogram（可在服务端聚合分位数） |
| 把 metrics 暴露在业务端口 | 分离端口，业务 8000，metrics 9000 |
| Counter 值会减少？ | Counter 只能递增，波动值用 Gauge |
| 不设告警静默时间 | 告警要加 `for` 持续时间，避免抖动误报 |

---

##  7. 练习题

### 🟢 Easy
1. 在 Kratos 服务中添加 Prometheus metrics 中间件
2. 用 `curl /metrics` 查看默认指标

### 🟡 Medium
3. 实现自定义业务指标（订单数、支付金额分布）
4. 配置 Grafana Dashboard 展示 QPS/P95/P99

### 🔴 Hard
5. 设计 SLI/SLO 并实现基于错误率的自动告警
6. 实现 RED 方法（Rate/Errors/Duration）的完整监控体系

---

## 8. 知识点总结

```
Prometheus 监控
├── 指标类型
│   ├── Counter (请求总数)
│   ├── Gauge (实时状态)
│   ├── Histogram (延迟分布)
│   └── Summary (客户端分位数)
├── Kratos 集成
│   ├── metrics 中间件
│   ├── /metrics 端点
│   └── 分离 metrics 端口
├── 自定义指标
│   ├── 注册到 Registry
│   ├── Service 层埋点
│   └── Label 设计原则
├── 可视化
│   ├── Grafana Dashboard
│   ├── PromQL 查询
│   └── 变量/模板
├── 告警
│   ├── AlertManager
│   ├── 规则编写
│   └── 路由/收敛
└── SLI/SLO
    ├── 可用性 (成功率)
    ├── 延迟 (P99 < Xms)
    └── 吞吐量 (QPS)
```

---

## 9. 举一反三

| 本文学到的 | 可应用到 |
|-----------| ---------|
| Prometheus 指标埋点 | 任何 Go/Java/Python 服务 |
| Histogram 分位数 | 任何延迟/大小分布统计 |
| 告警规则 | 所有生产服务 |
| SLI/SLO 设计 | SRE 实践的核心方法论 |
| 分离 metrics 端口 | 内部监控与外部 API 隔离 |

---

## 10. 参考资料

- [Prometheus 官方文档](https://prometheus.io/docs/)
- [Kratos metrics 中间件](https://github.com/go-kratos/kratos/tree/main/middleware/metrics)
- [Grafana Dashboard 最佳实践](https://grafana.com/docs/grafana/latest/dashboards/)
- [Google SRE — SLI/SLO](https://sre.google/sre-book/service-level-objectives/)

---

## 11. 代码演进

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | Kratos + Prometheus 中间件 + /metrics 端点 | 快速接入监控 |
| v2 | 自定义业务指标 + Service 层埋点 | 业务监控需求 |
| v3 | Grafana 看板 + 告警规则 + SLI/SLO | 生产运维体系 |

---

_没有监控的服务，就是盲人开夜车。_ 📊
