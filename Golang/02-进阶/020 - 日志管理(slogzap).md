---
title: "020 - 日志管理(slog/zap)"
slug: "020-restful-api"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.153+08:00"
updated_at: "2026-04-29T10:02:44.823+08:00"
reading_time: 26
tags: ["Web开发"]
---

# 050 - 日志管理(slog/zap)

> 难度：⭐⭐⭐ | 预计学习时间：35分钟

## 一、概念讲解

日志是生产系统的生命线。Go提供了从简单到强大的日志方案：
- **log标准库**：最基础，适合简单场景
- **log/slog**（Go 1.21+）：结构化日志，标准库内置
- **zap**（uber-go）：高性能结构化日志，第三方库
- **lumberjack**：日志轮转，配合任何日志库使用

结构化日志 vs 传统日志：
- 传统：`2024/01/15 10:00:00 User 123 logged in`
- 结构化：`{"time":"2024-01-15T10:00:00Z","level":"INFO","msg":"User logged in","user_id":123}`

## 二、脑图

```
日志管理
├── log标准库
│   ├── log.Print/Printf/Println
│   ├── log.Fatal / log.Panic
│   ├── log.SetFlags (日期/时间/文件)
│   └── log.SetOutput (输出目标)
├── slog (Go 1.21+)
│   ├── slog.Info/Debug/Warn/Error
│   ├── slog.With (预设字段)
│   ├── Handler: TextHandler / JSONHandler
│   ├── slog.Attr / slog.Value
│   └── 自定义 Handler
├── zap (uber-go)
│   ├── zap.Logger (高性能)
│   ├── zap.SugarLogger (易用)
│   ├── zap.Config 配置
│   ├── zapcore.Core
│   └── Encoder: JSON / Console
├── lumberjack
│   ├── 日志轮转 (按大小)
│   ├── 按数量保留
│   ├── 按天数保留
│   └── 日志压缩
└── 生产最佳实践
    ├── 日志分级 (Debug/Info/Warn/Error)
    ├── 请求ID追踪
    ├── 敏感信息过滤
    └── 性能考虑 (避免热路径alloc)
```

## 三、完整Go代码

### v1: log标准库 + slog基础

```go
package main

import (
	"encoding/json"
	"log"
	"log/slog"
	"os"
)

func main() {
	// === Standard log ===
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Application started")
	log.Printf("User %s logged in from %s", "Alice", "192.168.1.1")

	// === slog: Text handler (default) ===
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	slog.Debug("Debug message", "key", "value")
	slog.Info("User logged in", "user_id", 123, "ip", "10.0.0.1")
	slog.Warn("Disk usage high", "usage_pct", 85)
	slog.Error("Database connection failed", "err", "timeout", "retries", 3)

	// slog.With: pre-populate fields
	requestLogger := slog.With("request_id", "abc-123", "method", "GET")
	requestLogger.Info("Request received")
	requestLogger.Info("Request completed", "status", 200, "duration_ms", 42)

	// === slog: JSON handler ===
	jsonLogger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	jsonLogger.Info("JSON log entry", "action", "create", "resource", "user")

	// Log a Go struct via slog.Any
	type Request struct {
		Method string `json:"method"`
		Path   string `json:"path"`
	}
	req := Request{Method: "POST", Path: "/api/users"}
	data, _ := json.Marshal(req)
	jsonLogger.Info("Incoming request", "payload", string(data))
}
```

**执行预览：**
```
2024/06/15 10:00:00 main.go:12: Application started
2024/06/15 10:00:00 main.go:13: User Alice logged in from 192.168.1.1
time=2024-06-15T10:00:00.000Z level=DEBUG msg="Debug message" key=value
time=2024-06-15T10:00:00.000Z level=INFO msg="User logged in" user_id=123 ip=10.0.0.1
time=2024-06-15T10:00:00.000Z level=WARN msg="Disk usage high" usage_pct=85
time=2024-06-15T10:00:00.000Z level=ERROR msg="Database connection failed" err=timeout retries=3
time=... level=INFO msg="Request received" request_id=abc-123 method=GET
time=... level=INFO msg="Request completed" request_id=abc-123 method=GET status=200 duration_ms=42
{"time":"2024-06-15T10:00:00Z","level":"INFO","msg":"JSON log entry","action":"create","resource":"user"}
{"time":"2024-06-15T10:00:00Z","level":"INFO","msg":"Incoming request","payload":"{\"method\":\"POST\",\"path\":\"/api/users\"}"}
```

### v2: zap高性能日志

```go
package main

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func main() {
	// === Production logger (JSON, structured) ===
	prodLogger, _ := zap.NewProduction()
	defer prodLogger.Sync()

	prodLogger.Info("Production log",
		zap.String("action", "login"),
		zap.Int("user_id", 42),
		zap.Duration("took", 150000000), // 150ms in ns
	)

	// === Development logger (console, colorized) ===
	devLogger, _ := zap.NewDevelopment()
	defer devLogger.Sync()

	devLogger.Debug("Debug info", zap.String("module", "auth"))
	devLogger.Warn("Something suspicious", zap.String("ip", "10.0.0.99"))
	devLogger.Error("Failed to process", zap.Int("attempt", 3))

	// === Sugar logger (simpler API, slightly slower) ===
	sugar := devLogger.Sugar()
	sugar.Infow("Sugar logging",
		"event", "click",
		"count", 10,
	)
	sugar.Infof("Formatted: user=%s, id=%d", "Bob", 99)

	// === Custom config ===
	config := zap.Config{
		Level:       zap.NewAtomicLevelAt(zapcore.DebugLevel),
		Development: false,
		Encoding:    "json",
		EncoderConfig: zapcore.EncoderConfig{
			TimeKey:        "ts",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "msg",
			StacktraceKey:  "stacktrace",
			EncodeLevel:    zapcore.LowercaseLevelEncoder,
			EncodeTime:     zapcore.ISO8601TimeEncoder,
			EncodeDuration: zapcore.MillisDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		},
		OutputPaths:      []string{"stdout"},
		ErrorOutputPaths: []string{"stderr"},
	}
	customLogger, _ := config.Build()
	defer customLogger.Sync()

	customLogger.Info("Custom configured logger",
		zap.String("env", "staging"),
	)
}
```

**执行预览：**
```
{"level":"info","ts":1718440800.0,"caller":"main/main.go:13","msg":"Production log","action":"login","user_id":42,"took":0.15}
2024-06-15T10:00:00.000+0800	DEBUG	main/main.go:22	Debug info	{"module": "auth"}
2024-06-15T10:00:00.000+0800	WARN	main/main.go:23	Something suspicious	{"ip": "10.0.0.99"}
2024-06-15T10:00:00.000+0800	ERROR	main/main.go:24	Failed to process	{"attempt": 3}
2024-06-15T10:00:00.000+0800	INFO	Sugar logging	{"event": "click", "count": 10}
2024-06-15T10:00:00.000+0800	INFO	Formatted: user=Bob, id=99
{"level":"info","ts":"2024-06-15T10:00:00.000+0800","caller":"main/main.go:59","msg":"Custom configured logger","env":"staging"}
```

### v3: lumberjack日志轮转 + 生产配置

```go
package main

import (
	"io"
	"log/slog"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

func main() {
	// === lumberjack for log rotation ===
	logFile := &lumberjack.Logger{
		Filename:   "/tmp/app.log", // log file path
		MaxSize:    10,              // MB, rotate when exceeded
		MaxBackups: 5,               // keep N old files
		MaxAge:     30,              // days to retain
		Compress:   true,            // compress old files
	}

	// === Production zap + lumberjack ===
	writeSyncer := zapcore.AddSync(logFile)
	encoder := zapcore.NewJSONEncoder(zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		MessageKey:     "msg",
		CallerKey:      "caller",
		StacktraceKey:  "stack",
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.MillisDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	})

	core := zapcore.NewCore(encoder, writeSyncer, zapcore.DebugLevel)
	logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	defer logger.Sync()

	logger.Info("Application started", zap.String("version", "1.0.0"))
	logger.Info("Processing request",
		zap.String("method", "POST"),
		zap.String("path", "/api/users"),
		zap.Int("status", 201),
		zap.Duration("duration", 45000000),
	)
	logger.Warn("Slow query detected", zap.String("query", "SELECT *"), zap.Duration("took", 2000000000))
	logger.Error("Connection pool exhausted",
		zap.Int("active", 100),
		zap.Int("max", 100),
	)

	// === slog + lumberjack ===
	multiWriter := io.MultiWriter(os.Stdout, logFile)
	slogHandler := slog.NewJSONHandler(multiWriter, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slog.SetDefault(slog.New(slogHandler))

	slog.Info("slog + lumberjack", "component", "api", "action", "register")
	slog.Error("something went wrong", "err", "internal", "retry", true)

	// === Simulate rotation: write lots of logs ===
	for i := 0; i < 100; i++ {
		logger.Info("Batch log entry", zap.Int("index", i))
	}
	logger.Info("Check /tmp/app.log for output", zap.String("note", "file will rotate at 10MB"))
}
```

**执行预览：**
```
# Console output (slog):
{"time":"2024-06-15T10:00:00+08:00","level":"INFO","msg":"slog + lumberjack","component":"api","action":"register"}
{"time":"2024-06-15T10:00:00+08:00","level":"ERROR","msg":"something went wrong","err":"internal","retry":true}

# /tmp/app.log (zap):
{"level":"info","ts":"2024-06-15T10:00:00+08:00","caller":"main/main.go:42","msg":"Application started","version":"1.0.0"}
{"level":"info","ts":"2024-06-15T10:00:00+08:00","caller":"main/main.go:43","msg":"Processing request","method":"POST","path":"/api/users","status":201,"duration":45}
...
```

## 四、注意事项

| 要点 | 说明 |
|------|------|
| zap.Logger vs SugarLogger | Logger性能更高（类型安全），Sugar更易用 |
| Sync()刷新 | 程序退出前调用logger.Sync()确保日志写入 |
| 日志级别选择 | Debug=开发调试, Info=关键流程, Warn=可恢复异常, Error=需要关注 |
| 结构化vs字符串 | 结构化日志便于ELK/Grafana检索，避免拼接字符串 |
| 热路径性能 | 高频调用的日志用IsEnabled()检查级别 |
| 敏感信息 | 不要记录密码、token、个人隐私数据 |

## 五、避坑指南

❌ 用fmt.Println做日志：
```go
fmt.Println("user logged in:", userID) // 无时间戳、无级别、无法检索
```
✅ 使用结构化日志：
```go
logger.Info("user logged in", zap.Int("user_id", userID))
```

❌ 高频日志不加级别检查：
```go
for _, item := range items {
    logger.Debug("processing", zap.Any("item", item)) // alloc even when level is INFO
}
```
✅ 使用IsEnabled或zap的延迟版本：
```go
if logger.Core().Enabled(zapcore.DebugLevel) {
    logger.Debug("processing", zap.Any("item", item))
}
```

❌ 日志文件无限增长：
```go
f, _ := os.OpenFile("app.log", os.O_APPEND|os.O_CREATE, 0644)
// 永远不会轮转，磁盘会满
```
✅ 使用lumberjack自动轮转

❌ 在日志中打印敏感数据：
```go
logger.Info("login", zap.String("password", pwd)) // 泄露！
```
✅ 过滤敏感字段或只记录ID

## 六、练习题

🟢 **基础题：** 使用slog实现一个简单的HTTP请求日志中间件，记录method、path、status、duration。

🟡 **进阶题：** 实现一个支持多输出（console+file）的日志初始化函数，开发环境用console格式，生产环境用JSON格式。

🔴 **挑战题：** 实现自定义slog.Handler，支持：按级别分文件输出（info.log/error.log）、日志采样（高频日志每秒最多100条）、敏感字段自动脱敏。

## 七、知识点总结

```
日志管理
├── log标准库
│   ├── 简单场景
│   └── 快速原型
├── slog (Go 1.21+)
│   ├── TextHandler (开发)
│   ├── JSONHandler (生产)
│   ├── slog.With (预设字段)
│   └── 自定义Handler
├── zap
│   ├── Logger (高性能)
│   ├── SugarLogger (易用)
│   ├── zap.Config
│   └── zapcore扩展
├── lumberjack
│   ├── 按大小轮转
│   ├── 按数量/天数保留
│   └── 自动压缩
└── 生产实践
    ├── 级别控制
    ├── 多输出
    ├── 请求追踪
    └── 性能优化
```

## 八、举一反三

| 场景 | 推荐方案 | 配置要点 |
|------|----------|----------|
| CLI工具 | log标准库 | SetFlags + 前缀 |
| Web API服务 | slog/zap JSON | 中间件+请求ID |
| 微服务 | zap + ELK | JSON + trace_id |
| 批处理任务 | slog + 文件 | 分级别输出 |
| 后台Worker | zap + lumberjack | 轮转+按天保留 |
| 调试开发 | zap Development模式 | console+颜色 |

## 九、参考资料

- [Go官方文档：log/slog](https://pkg.go.dev/log/slog)
- [zap GitHub](https://github.com/uber-go/zap)
- [lumberjack GitHub](https://github.com/natefinish/lumberjack)
- [Structured Logging in Go 1.21](https://go.dev/blog/slog)

## 十、代码演进总结

| 版本 | 重点 | 适用场景 |
|------|------|----------|
| v1 | log标准库 + slog基础 | 学习、简单项目 |
| v2 | zap高性能日志 | 对性能有要求的项目 |
| v3 | lumberjack轮转 + 生产配置 | 生产环境完整方案 |
