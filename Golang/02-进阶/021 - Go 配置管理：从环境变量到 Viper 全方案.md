---
title: "021 - Go 配置管理：从环境变量到 Viper 全方案"
slug: "021-middleware"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.161+08:00"
updated_at: "2026-04-29T10:02:44.837+08:00"
reading_time: 18
tags: ["Web开发"]
---

# 051 - Go 配置管理：从环境变量到 Viper 全方案

> **难度：⭐⭐** | 配置管理是工程化的第一步，本文从 os.Getenv 到 Viper 全覆盖。

## 一、概念讲解

配置管理解决的问题是：**如何让同一份代码在不同环境（开发、测试、生产）下正确运行？**

12-Factor App 的第三条原则要求：**将配置存储在环境变量中**。但实际项目中，我们往往需要更灵活的方案——支持配置文件、环境变量、命令行参数等多种来源，并且能优雅地合并优先级。

Go 生态中，配置管理的主要方案：

| 方案 | 适用场景 | 复杂度 |
|------|---------|--------|
| `os.Getenv` | 简单环境变量读取 | ⭐ |
| `encoding/json` | JSON 配置文件 | ⭐⭐ |
| `gopkg.in/yaml.v3` | YAML 配置文件 | ⭐⭐ |
| `github.com/BurntSushi/toml` | TOML 配置文件 | ⭐⭐ |
| `github.com/spf13/viper` | 全功能配置管理 | ⭐⭐⭐ |

## 二、脑图

```
配置管理
├── 环境变量
│   ├── os.Getenv
│   ├── os.LookupEnv
│   └── os.Setenv (不推荐)
├── 配置文件
│   ├── JSON
│   ├── YAML
│   └── TOML
├── Viper 库
│   ├── 多来源读取
│   ├── 结构体映射
│   ├── 配置热更新
│   └── 环境变量绑定
└── 多环境配置
    ├── dev / staging / prod
    ├── 配置覆盖优先级
    └── 12-Factor App
```

## 三、代码演进

### v1：原生 os.Getenv 读取

```go
package main

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds application configuration
type Config struct {
	Port     int
	DBHost   string
	DBPort   int
	LogLevel string
}

// LoadConfig reads config from environment variables
func LoadConfig() *Config {
	return &Config{
		Port:     getEnvInt("APP_PORT", 8080),
		DBHost:   getEnv("DB_HOST", "localhost"),
		DBPort:   getEnvInt("DB_PORT", 5432),
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val := getEnv(key, "")
	if n, err := strconv.Atoi(val); err == nil {
		return n
	}
	return fallback
}

func main() {
	cfg := LoadConfig()
	fmt.Printf("Server running on :%d\n", cfg.Port)
	fmt.Printf("DB: %s:%d\n", cfg.DBHost, cfg.DBPort)
	fmt.Printf("LogLevel: %s\n", cfg.LogLevel)
}
```

**执行预览：**
```
$ go run main.go
Server running on :8080
DB: localhost:5432
LogLevel: info

$ APP_PORT=3000 DB_HOST=db.prod.com go run main.go
Server running on :3000
DB: db.prod.com:5432
LogLevel: info
```

### v2：JSON 配置文件 + 环境变量覆盖

```go
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config holds application configuration
type Config struct {
	Port     int    `json:"port"`
	DBHost   string `json:"db_host"`
	DBPort   int    `json:"db_port"`
	LogLevel string `json:"log_level"`
}

// LoadFromFile reads config from a JSON file
func LoadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}
	cfg := &Config{
		Port:     8080,
		DBHost:   "localhost",
		DBPort:   5432,
		LogLevel: "info",
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	return cfg, nil
}

// OverrideFromEnv allows environment variables to override file config
func (c *Config) OverrideFromEnv() {
	if v := os.Getenv("APP_PORT"); v != "" {
		fmt.Sscanf(v, "%d", &c.Port)
	}
	if v := os.Getenv("DB_HOST"); v != "" {
		c.DBHost = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		fmt.Sscanf(v, "%d", &c.DBPort)
	}
	if v := os.Getenv("LOG_LEVEL"); v != "" {
		c.LogLevel = v
	}
}

func main() {
	configPath := filepath.Join("config", "app.json")
	cfg, err := LoadFromFile(configPath)
	if err != nil {
		fmt.Printf("Using defaults: %v\n", err)
		cfg = &Config{Port: 8080, DBHost: "localhost", DBPort: 5432, LogLevel: "info"}
	}
	cfg.OverrideFromEnv()
	fmt.Printf("Config: %+v\n", cfg)
}
```

### v3：Viper 全功能方案

```go
package main

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all application settings
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Log      LogConfig      `mapstructure:"log"`
}

// ServerConfig defines HTTP server settings
type ServerConfig struct {
	Port         int `mapstructure:"port"`
	ReadTimeout  int `mapstructure:"read_timeout"`
	WriteTimeout int `mapstructure:"write_timeout"`
}

// DatabaseConfig defines database connection settings
type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Name     string `mapstructure:"name"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
}

// LogConfig defines logging settings
type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// LoadConfig initializes Viper with multiple config sources
func LoadConfig(env string) (*Config, error) {
	v := viper.New()

	// 1. Set defaults
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.read_timeout", 10)
	v.SetDefault("server.write_timeout", 10)
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.name", "myapp")
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")

	// 2. Config file
	v.SetConfigName(fmt.Sprintf("config.%s", env))
	v.SetConfigType("yaml")
	v.AddConfigPath("./config")
	v.AddConfigPath(".")

	if err := v.ReadInConfig(); err != nil {
		fmt.Printf("Warning: config file not found, using defaults\n")
	}

	// 3. Environment variable override (MYAPP_SERVER_PORT -> server.port)
	v.SetEnvPrefix("MYAPP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// 4. Unmarshal to struct
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return &cfg, nil
}

func main() {
	env := "dev" // could come from os.Args or GO_ENV
	if e := fmt.Sprintf(""); e == "" {
		// just use default
	}
	
	cfg, err := LoadConfig(env)
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return
	}
	fmt.Printf("Server:   :%d\n", cfg.Server.Port)
	fmt.Printf("Database: %s:%d/%s\n", cfg.Database.Host, cfg.Database.Port, cfg.Database.Name)
	fmt.Printf("Log:      %s (%s)\n", cfg.Log.Level, cfg.Log.Format)
}
```

## 四、注意事项

| 项目 | 说明 |
|------|------|
| 敏感配置 | 密码、密钥不要硬编码，使用环境变量或密钥管理服务 |
| 配置验证 | 加载后务必校验必填项，避免运行时空指针 |
| 默认值 | 生产环境不要依赖默认值，显式配置更安全 |
| 配置文件版本 | 配置文件应纳入 Git 管理，敏感值用占位符 |
| 热更新 | Viper 的 `WatchConfig` 有文件系统兼容性问题，生产慎用 |

## 五、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `os.Setenv("PORT", "8080")` 在代码里设置环境变量 | 使用配置文件或真实环境变量 |
| 配置结构体用 `string` 存端口号 | 用 `int` 并做范围校验 |
| 把密码写进 config.yml 提交到 Git | 使用环境变量覆盖或 vault |
| 全局 `viper.Get("key")` 散落各处 | 统一 Unmarshal 到结构体，依赖注入传递 |
| 忽略 `viper.AutomaticEnv` 绑定失败 | 显式绑定 `v.BindEnv("database.host")` |

## 六、练习题

🟢 **基础：** 用 `os.Getenv` 读取 `DATABASE_URL` 环境变量，不存在时 panic。

🟡 **进阶：** 用 Viper 实现一个支持 `config.dev.yaml` / `config.prod.yaml` 的多环境配置加载器，环境由 `GO_ENV` 变量决定。

🔴 **挑战：** 实现配置热更新：监听配置文件变化，通过 channel 通知业务层重新加载配置。

## 七、知识点总结

```
配置管理
├── 基础
│   ├── os.Getenv / LookupEnv
│   └── strconv 类型转换
├── 文件配置
│   ├── JSON (标准库)
│   ├── YAML (gopkg.in/yaml.v3)
│   └── TOML (BurntSushi/toml)
├── Viper 核心概念
│   ├── SetDefault → 配置文件 → 环境变量 (优先级从低到高)
│   ├── mapstructure tag 映射
│   ├── AutomaticEnv 环境变量绑定
│   └── WatchConfig 热更新
└── 最佳实践
    ├── 结构体映射
    ├── 环境隔离
    └── 敏感信息管理
```

## 八、举一反三

| 场景 | 推荐方案 |
|------|---------|
| CLI 小工具 | `os.Getenv` + `flag` 包 |
| Web 服务（简单） | JSON 配置文件 + 环境变量覆盖 |
| Web 服务（生产级） | Viper + YAML + 环境变量 |
| 微服务 / K8s | 环境变量 + ConfigMap + Secret |
| 需要热更新 | Viper WatchConfig 或 etcd/consul |

## 九、参考资料

- [12-Factor App - 配置](https://12factor.net/zh_cn/config)
- [Viper 官方文档](https://github.com/spf13/viper)
- [Go 项目布局参考](https://github.com/golang-standards/project-layout)
