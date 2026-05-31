---
title: "005-Kratos配置管理详解"
slug: "005-kratos-config"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T18:21:03.417+08:00"
updated_at: "2026-04-29T10:02:45.322+08:00"
reading_time: 27
tags: []
---


# 005-Kratos配置管理详解

> **难度：⭐⭐（入门级）**
>
> 需要了解YAML/JSON基本格式。读完本文，你将掌握Kratos配置管理的完整方案，能灵活应对多环境部署需求。

---

## 一、概念讲解

### 1.1 为什么配置管理很重要？

在微服务架构中，配置管理直接影响：

| 维度 | 影响 |
|------|------|
| 开发效率 | 开发/测试/生产环境快速切换 |
| 运维安全 | 敏感信息（密钥、密码）不硬编码 |
| 服务稳定性 | 配置错误是线上事故的常见原因 |
| 弹性伸缩 | 配置热更新，无需重启 |

### 1.2 Kratos配置体系

```
┌────────────────────────────────────────┐
│              kratos config             │
├────────────────────────────────────────┤
│  Config Source (配置源)                 │
│  ├── file     (本地文件: YAML/JSON)    │
│  ├── env      (环境变量)               │
│  ├── config   (远程配置中心: Consul等)  │
│  └── custom   (自定义源)               │
├────────────────────────────────────────┤
│  Config Decoder (解码器)               │
│  ├── YAML Decoder                      │
│  ├── JSON Decoder                      │
│  └── Protobuf Decoder                  │
├────────────────────────────────────────┤
│  Config Merge (合并策略)               │
│  └── 多Source按优先级合并              │
└────────────────────────────────────────┘
```

### 1.3 核心接口

Kratos配置系统围绕两个核心接口：

```go
// Source: Where configs come from
type Source interface {
    Load() ([]*KeyValue, error)
    Watch() (Watcher, error)
}

// Decoder: How to parse config content
type Decoder func(*KeyValue, map[string]interface{}) error
```

---

## 二、脑图（ASCII）

```
              Kratos配置管理
                   │
     ┌─────────────┼─────────────┐
     │             │             │
  配置源         配置格式       高级特性
     │             │             │
  ┌──┼──┐     ┌───┼───┐    ┌────┼────┐
  │  │  │     │       │    │    │    │
文件 环境 远程 YAML JSON PB 热更 多环 自定
     变量 配置                 境   义源
```

---

## 三、完整代码

### 3.1 配置文件定义（Proto）

Kratos推荐用Proto定义配置结构，保证类型安全：

```protobuf
// internal/conf/conf.proto
syntax = "proto3";

package conf;

option go_package = "helloworld/internal/conf";

import "google/protobuf/duration.proto";

// Bootstrap is the root config
message Bootstrap {
    Server server = 1;
    Data data = 2;
    Auth auth = 3;
}

// Server configs
message Server {
    message HTTP {
        string network = 1;
        string addr = 2;
        google.protobuf.Duration timeout = 3;
    }
    message GRPC {
        string network = 1;
        string addr = 2;
        google.protobuf.Duration timeout = 3;
    }
    HTTP http = 1;
    GRPC grpc = 2;
}

// Data source configs
message Data {
    message Database {
        string driver = 1;
        string source = 2;
    }
    message Redis {
        string addr = 1;
        string password = 2;
        int32 db = 3;
    }
    Database database = 1;
    Redis redis = 2;
}

// Auth configs
message Auth {
    string jwt_secret = 1;
    google.protobuf.Duration token_expire = 2;
}
```

### 3.2 YAML配置文件

```yaml
# configs/config.yaml - Default (development)
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s

data:
  database:
    driver: sqlite
    source: helloworld.db
  redis:
    addr: localhost:6379
    db: 0

auth:
  jwt_secret: "dev-secret-key"
  token_expire: 24h
```

```yaml
# configs/config-prod.yaml - Production overrides
server:
  http:
    addr: 0.0.0.0:80
    timeout: 3s
  grpc:
    addr: 0.0.0.0:9090
    timeout: 5s

data:
  database:
    driver: mysql
    source: "user:pass@tcp(mysql.internal:3306)/helloworld?charset=utf8mb4&parseTime=True"
  redis:
    addr: redis.internal:6379
    password: "${REDIS_PASSWORD}"
    db: 0

auth:
  jwt_secret: "${JWT_SECRET}"
  token_expire: 2h
```

### 3.3 配置加载代码

```go
// cmd/helloworld/main.go
package main

import (
    "flag"
    "os"

    "helloworld/internal/conf"

    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/config"
    "github.com/go-kratos/kratos/v2/config/file"
    "github.com/go-kratos/kratos/v2/log"
)

var (
    Name    = "helloworld"
    Version = "1.0.0"
)

func main() {
    // Parse flags: -conf specifies config directory
    flagset := flag.NewFlagSet("", flag.ExitOnError)
    confDir := flagset.String("conf", "configs", "config directory")
    flagset.Parse(os.Args[1:])

    logger := log.NewStdLogger(os.Stdout)

    // Step 1: Create config instance
    c := config.New(
        config.WithSource(
            file.NewSource(*confDir),  // Load all files from directory
        ),
    )

    // Step 2: Load config
    if err := c.Load(); err != nil {
        panic(err)
    }

    // Step 3: Scan into typed struct
    var bc conf.Bootstrap
    if err := c.Scan(&bc); err != nil {
        panic(err)
    }

    // Use config values
    log.NewHelper(logger).Infof("HTTP addr: %s", bc.Server.Http.Addr)
    log.NewHelper(logger).Infof("gRPC addr: %s", bc.Server.Grpc.Addr)
    log.NewHelper(logger).Infof("DB driver: %s", bc.Data.Database.Driver)

    // Build and run app...
    app, cleanup, err := wireApp(bc.Server, bc.Data, logger)
    if err != nil {
        panic(err)
    }
    defer cleanup()

    if err := app.Run(); err != nil {
        panic(err)
    }
}
```

### 3.4 多配置源合并

```go
// Load from file + environment variables
import (
    "github.com/go-kratos/kratos/v2/config"
    "github.com/go-kratos/kratos/v2/config/file"
    "github.com/go-kratos/kratos/v2/config/env"
)

c := config.New(
    config.WithSource(
        // File source (loaded first, lower priority)
        file.NewSource("configs"),
        // Environment variable source (higher priority, overrides file)
        env.NewSource(),
    ),
)
```

环境变量命名规则：将YAML路径用`_`连接，全大写：

```bash
# Override server.http.addr
export SERVER_HTTP_ADDR="0.0.0.0:8080"

# Override data.database.driver
export DATA_DATABASE_DRIVER="mysql"

# Override auth.jwt_secret
export AUTH_JWT_SECRET="my-super-secret-key"
```

### 3.5 配置热更新（Watch）

```go
// Watch for config changes
if err := c.Watch(func(key string, value config.Value) {
    log.Printf("Config changed: %s", key)
    
    // Re-scan updated config
    var newConf conf.Bootstrap
    if err := c.Scan(&newConf); err != nil {
        log.Printf("Failed to scan updated config: %v", err)
        return
    }
    
    // Apply updated config (e.g., update logger level)
    log.Printf("New HTTP addr: %s", newConf.Server.Http.Addr)
}); err != nil {
    log.Printf("Failed to watch config: %v", err)
}
```

### 3.6 自定义配置源

```go
// custom_source.go - Example: Load config from remote API
package config

import (
    "encoding/json"
    "io/ioutil"
    "net/http"

    "github.com/go-kratos/kratos/v2/config"
)

// remoteSource implements config.Source
type remoteSource struct {
    url string
}

// NewRemoteSource creates a config source from remote URL
func NewRemoteSource(url string) config.Source {
    return &remoteSource{url: url}
}

// Load fetches config from remote API
func (s *remoteSource) Load() ([]*config.KeyValue, error) {
    resp, err := http.Get(s.url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    return []*config.KeyValue{
        {
            Key:    "remote.json",
            Value:  body,
            Format: "json",
        },
    }, nil
}

// Watch is not implemented for remote source
func (s *remoteSource) Watch() (config.Watcher, error) {
    return nil, nil
}
```

使用自定义源：

```go
c := config.New(
    config.WithSource(
        file.NewSource("configs"),
        NewRemoteSource("http://config-server.internal/api/config/helloworld"),
    ),
)
```

### 3.7 多环境管理实战

```bash
# Development (default)
kratos run
# Reads: configs/config.yaml

# Production
kratos run -conf configs-prod
# Reads: configs-prod/config.yaml

# Using environment variables
export KRATOS_ENV=production
kratos run
```

```go
// Smart config loading based on environment
func getConfigDir() string {
    env := os.Getenv("KRATOS_ENV")
    switch env {
    case "production", "prod":
        return "configs-prod"
    case "staging":
        return "configs-staging"
    case "test":
        return "configs-test"
    default:
        return "configs"
    }
}
```

---

## 四、执行预览

```
$ kratos run
INFO msg=config loaded format: yaml
INFO msg=HTTP addr: 0.0.0.0:8000
INFO msg=gRPC addr: 0.0.0.0:9000
INFO msg=DB driver: sqlite
INFO msg=server listening on [::]:8000
INFO msg=server listening on [::]:9000

$ KRATOS_ENV=production kratos run -conf configs-prod
INFO msg=config loaded format: yaml
INFO msg=HTTP addr: 0.0.0.0:80
INFO msg=gRPC addr: 0.0.0.0:9090
INFO msg=DB driver: mysql
INFO msg=server listening on [::]:80
INFO msg=server listening on [::]:9090

# Environment variable override
$ SERVER_HTTP_ADDR=0.0.0.0:9999 kratos run
INFO msg=HTTP addr: 0.0.0.0:9999  ← overridden by env var
```

---

## 五、注意事项

| 注意点 | 说明 | 严重度 |
|--------|------|--------|
| 敏感信息 | 密码/密钥不要硬编码在YAML中 | 🔴 高 |
| 配置文件目录 | `-conf`参数指向目录，不是单个文件 | 🟡 中 |
| Proto配置定义 | 修改conf.proto后需重新生成 | 🟡 中 |
| 环境变量覆盖 | 优先级高于文件配置 | 🟡 中 |
| 多源合并顺序 | 后加载的源优先级更高 | 🟡 中 |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 密码明文写在config.yaml | 使用环境变量`${VAR}`或远程配置中心 |
| 只用一个config.yaml不分环境 | 按环境维护独立配置目录 |
| 修改conf.proto后不重新生成 | 执行protoc重新生成Go结构体 |
| 直接用map读配置 | 用Proto定义结构体，类型安全 |
| 忘记`-conf`参数 | 默认读`configs`目录，部署时注意指定 |

---

## 七、练习题

### 🟢 入门题
1. 为你的Kratos项目创建两套配置：development和production，通过`-conf`参数切换。

### 🟡 进阶题
2. 实现配置热更新：修改YAML文件中的HTTP超时时间，服务自动感知并记录日志。

### 🔴 挑战题
3. 实现一个自定义配置源，从Consul/etcd读取配置，并支持Watch实时更新。

---

## 八、知识点总结

```
Kratos配置管理
├── 配置定义
│   ├── conf.proto（类型安全）
│   ├── YAML文件（人类可读）
│   └── JSON格式（可选）
├── 配置加载
│   ├── config.New()
│   ├── file.NewSource()
│   ├── env.NewSource()
│   └── 多源合并（优先级）
├── 配置使用
│   ├── c.Scan(&conf) → 类型安全读取
│   ├── c.Value("key") → 动态读取
│   └── c.Watch() → 热更新
├── 多环境管理
│   ├── -conf 参数切换目录
│   ├── 环境变量覆盖
│   └── 环境变量命名规则（A_B_C）
└── 自定义源
    ├── 实现 config.Source 接口
    ├── Load() 返回 KeyValue
    └── Watch() 返回 Watcher
```

---

## 九、举一反三

| 场景 | 思路 | 关键技术 |
|------|------|---------|
| 敏感信息管理 | 环境变量或远程配置中心 | env.NewSource / Consul |
| 配置版本管理 | 配置文件入Git，环境特定值用环境变量 | GitOps |
| 动态限流配置 | 配置热更新+中间件 | c.Watch() + middleware |
| 配置中心集成 | 实现自定义Source对接Apollo/Nacos | config.Source接口 |
| 多服务共享配置 | 抽取公共配置到独立repo或配置中心 | Git submodule / 配置中心 |

---

## 十、参考资料

| 资源 | 链接 |
|------|------|
| Kratos Config文档 | https://go-kratos.dev/docs/component/config |
| Kratos Config源码 | https://github.com/go-kratos/kratos/tree/main/config |
| Consul配置中心 | https://www.consul.io/ |
| Apollo配置中心 | https://www.apolloconfig.com/ |
| 12-Factor App配置 | https://12factor.net/config |

---

## 十一、代码演进

### v1：单文件配置
```go
c := config.New(
    config.WithSource(
        file.NewSource("configs"),
    ),
)
```

### v2：文件 + 环境变量
```go
c := config.New(
    config.WithSource(
        file.NewSource("configs"),
        env.NewSource(),  // Environment variables override file
    ),
)
```

### v3：远程配置中心 + 热更新
```go
c := config.New(
    config.WithSource(
        file.NewSource("configs"),           // Local fallback
        NewConsulSource("consul:8500", "helloworld"),  // Remote config
    ),
)

// Watch for changes
c.Watch(func(key string, value config.Value) {
    log.Printf("Config updated: %s", key)
    // Apply changes dynamically
})
```

---

**上一篇：** [004-第一个Kratos服务Hello World](/posts/004-kratos-helloworld)
