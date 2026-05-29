---
title: "028 - Prometheus 监控集成实战"
slug: "028-gin-prometheus"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:17:17.083+08:00"
updated_at: "2026-04-29T10:02:45.808+08:00"
reading_time: 19
tags: []
---

# Prometheus 监控集成实战

> 难度：⭐⭐⭐（中级）
> 前置知识：Gin 基础、HTTP 中间件概念

## 一、概念讲解

Prometheus 是开源监控告警系统，通过 **拉取（Pull）** 模式采集指标。Gin 应用集成 Prometheus 后，可以实时监控 QPS、延迟、错误率等关键指标。

**四种指标类型：**

| 类型 | 用途 | 示例 |
|------|------|------|
| Counter | 只增不减的计数器 | 请求总数、错误总数 |
| Gauge | 可增可减的仪表盘 | 当前在线用户、goroutine 数 |
| Histogram | 分布统计（分位数） | 请求延迟分布、响应大小 |
| Summary | 客户端计算分位数 | 精确延迟 P50/P99 |

**Histogram vs Summary：**
- Histogram：服务端计算分位数，可聚合，占用资源少 → **推荐**
- Summary：客户端计算分位数，不可聚合 → 特殊场景用

## 二、脑图

```
Prometheus + Gin
├── 指标类型
│   ├── Counter (计数)
│   ├── Gauge (仪表)
│   ├── Histogram (直方图)
│   └── Summary (摘要)
├── 集成方式
│   ├── gin-prometheus 库
│   ├── 手动中间件
│   └── 自定义业务指标
├── 可视化
│   ├── Grafana 看板
│   ├── PromQL 查询
│   └── 常用面板模板
├── 告警
│   ├── AlertManager
│   ├── 告警规则
│   └── 通知渠道
└── 最佳实践
    ├── 指标命名规范
    ├── 标签设计
    └── 采集间隔
```

## 三、完整代码

### v1：快速集成 gin-prometheus

```go
// main.go - Quick Prometheus integration
package main

import (
	"github.com/gin-gonic/gin"
	"github.com/zeitlinger/gin-prometheus"
)

func main() {
	r := gin.Default()

	// Add Prometheus middleware - auto-instrumented!
	p := ginprometheus.NewPrometheus("gin")
	p.Use(r)

	// Your routes
	r.GET("/api/users", func(c *gin.Context) {
		c.JSON(200, gin.H{"users": []string{"Alice", "Bob"}})
	})

	r.GET("/api/posts", func(c *gin.Context) {
		c.JSON(200, gin.H{"posts": []string{"Post 1", "Post 2"}})
	})

	r.Run(":8080")
}
// Metrics available at :8080/metrics
```

### v2：自定义业务指标

```go
// metrics/metrics.go - Custom business metrics
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Business metrics
	UsersRegistered = promauto.NewCounter(prometheus.CounterOpts{
		Name: "app_users_registered_total",
		Help: "Total number of registered users",
	})

	ActiveUsers = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "app_active_users",
		Help: "Current number of active users",
	})

	RequestDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "app_request_duration_seconds",
		Help:    "Request duration distribution",
		Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	})

	OrdersTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "app_orders_total",
		Help: "Total orders by status",
	}, []string{"status"}) // status: success, failed, cancelled
)

// TrackRequest is a helper to track request timing
func TrackRequest() func() {
	timer := prometheus.NewTimer(RequestDuration)
	return func() {
		timer.ObserveDuration()
	}
}
```

```go
// main.go - Using custom metrics
package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"myapp/metrics"
)

func main() {
	r := gin.Default()

	// Expose Prometheus metrics endpoint
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Business routes with metrics
	r.POST("/api/register", func(c *gin.Context) {
		// ... register logic ...
		metrics.UsersRegistered.Inc()
		c.JSON(http.StatusCreated, gin.H{"status": "ok"})
	})

	r.GET("/api/feed", func(c *gin.Context) {
		done := metrics.TrackRequest()
		defer done()

		// ... feed logic ...
		metrics.ActiveUsers.Set(42) // Update gauge
		c.JSON(http.StatusOK, gin.H{"feed": []string{}})
	})

	r.POST("/api/orders", func(c *gin.Context) {
		// ... order logic ...
		success := true // or false
		status := "success"
		if !success {
			status = "failed"
		}
		metrics.OrdersTotal.WithLabelValues(status).Inc()
		c.JSON(http.StatusOK, gin.H{"order_id": "123"})
	})

	r.Run(":8080")
}
```

### v3：中间件 + 优雅封装

```go
// middleware/prometheus.go - Custom metrics middleware
package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}

// PrometheusMiddleware records metrics for each request
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath() // Use route pattern, not actual path
		if path == "" {
			path = "unknown"
		}

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		httpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}
```

```go
// main.go - Production setup
package main

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"myapp/middleware"
)

func main() {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.PrometheusMiddleware())

	// Metrics on separate port for security
	go func() {
		metricsRouter := gin.New()
		metricsRouter.GET("/metrics", gin.WrapH(promhttp.Handler()))
		metricsRouter.Run(":9090") // Internal metrics port
	}()

	// Business routes on main port
	r.GET("/api/users", userHandler)
	r.Run(":8080")
}
```

## 四、执行预览

```bash
# Start server
go run main.go

# Generate some traffic
for i in $(seq 1 100); do
  curl -s http://localhost:8080/api/users > /dev/null
done

# Check metrics
curl http://localhost:9090/metrics | grep http_requests_total
# http_requests_total{method="GET",path="/api/users",status="200"} 100

# Prometheus config (prometheus.yml)
scrape_configs:
  - job_name: 'gin-app'
    static_configs:
      - targets: ['localhost:9090']

# Useful PromQL queries
# QPS by path
rate(http_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

## 五、注意事项

| 事项 | 说明 |
|------|------|
| 指标命名 | 用 `snake_case`，带 namespace 前缀如 `myapp_` |
| 标签基数 | 不要用 user_id 等高基数标签，会炸内存 |
| 采集端口 | 生产环境指标端口与业务端口分离 |
| Histogram buckets | 根据实际延迟范围调整，默认可能不合适 |
| 指标路径 | 用 `c.FullPath()` 而非 `c.Request.URL.Path`，避免高基数 |
| 初始化 | `promauto` 自动注册，`prometheus.NewXxx` 需手动 `MustRegister` |

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 用 URL 做标签（含 ID） | 用路由模板 `/users/:id` 做标签 |
| 所有指标塞一个 Counter | 按维度拆分 CounterVec |
| 忘记 `promhttp.Handler()` | 必须暴露 `/metrics` 给 Prometheus 拉取 |
| 指标端口暴露公网 | 指标端口仅内网可访问 |
| 用 Summary 代替 Histogram | 优先 Histogram，可聚合计算 |

## 七、练习题

🟢 **初级：** 添加一个 Gauge 指标 `app_goroutines`，在 `/metrics` 中展示当前 goroutine 数量

🟡 **中级：** 实现按 HTTP method+path+status 的请求大小（request body bytes）Histogram

🔴 **高级：** 编写 Grafana dashboard JSON，包含 QPS、P99 延迟、错误率三个面板，并配置 AlertManager 告警规则

## 八、知识点总结

```
Prometheus + Gin
├── 指标类型
│   ├── Counter → 请求计数
│   ├── Gauge → 实时状态
│   ├── Histogram → 延迟分布
│   └── Summary → 精确分位数
├── 集成
│   ├── gin-prometheus (开箱即用)
│   ├── 自定义中间件 (灵活)
│   └── 业务指标 (Domain-specific)
├── 查询 (PromQL)
│   ├── rate() 求速率
│   ├── histogram_quantile() 分位数
│   └── 聚合 sum/by/avg
└── 运维
    ├── 分端口部署
    ├── 标签设计
    └── 采集间隔调优
```

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 多实例聚合 | Prometheus + `sum by (instance)` |
| 长期存储 | Prometheus → Thanos / VictoriaMetrics |
| APM 链路追踪 | Prometheus (指标) + Jaeger (链路) |
| 自适应限流 | Prometheus 指标 → 限流中间件动态调整 |

## 十、参考资料

- [Prometheus 官方文档](https://prometheus.io/docs/)
- [gin-prometheus](https://github.com/zeitlinger/gin-prometheus)
- [Prometheus Go Client](https://github.com/prometheus/client_golang)
- [Grafana Dashboard 模板](https://grafana.com/grafana/dashboards/)

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | gin-prometheus 库，开箱即用 | 快速接入 |
| v2 | 自定义业务指标，Counter/Gauge/Histogram | 业务监控 |
| v3 | 自定义中间件、分端口、生产部署 | 生产环境 |

---

*没有监控的系统就是盲人开车。* 📊
