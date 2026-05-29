---
title: "018 - 请求校验与参数绑定 | Kratos实战系列"
slug: "018-kratos-validate"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-25T19:01:48.73+08:00"
updated_at: "2026-04-29T10:02:45.416+08:00"
reading_time: 26
tags: []
---

# 请求校验与参数绑定

> **难度：** ⭐⭐⭐ | **预计阅读：** 14 分钟
>
> 使用 protoc-gen-validate 在 Kratos 中实现 Proto 级别参数校验，自定义校验器，以及错误信息国际化。

---

## 1. 概念讲解

### 为什么需要参数校验？

任何外部输入都不可信。参数校验是 API 安全的第一道防线：

| 攻击类型 | 校验防护 |
|---------|---------|
| SQL 注入 | 字符串格式校验 |
| 缓冲区溢出 | 长度限制 |
| 业务逻辑漏洞 | 范围/枚举约束 |
| XaaS 滥用 | 频率/大小限制 |

### protoc-gen-validate (PGV)

PGV 是 protobuf 生态的校验方案，在 `.proto` 文件中直接定义校验规则，编译时生成 Go 校验代码。优势：

1. **声明式** — 规则与类型定义放在一起
2. **自动生成** — 编译即生成，无需手写
3. **多语言** — Go/Java/Python/TS 等都有实现
4. **Kratos 内置** — `kratos/v2/middleware/validate` 直接集成

### 校验规则分类

| 类型 | 规则示例 | 说明 |
|------|---------|------|
| 字符串 | `string_name = 1 [(validate.rules).string = {min_len: 1, max_len: 100}]` | 长度、正则 |
| 数字 | `int32 age = 2 [(validate.rules).int32 = {gte: 0, lte: 150}]` | 范围 |
| 枚举 | `Status status = 3 [(validate.rules).enum = {defined_only: true}]` | 限定值 |
| 消息 | `(validate.rules).message.required = true` | 必填 |
| 重复 | `repeated string tags = 4 [(validate.rules).repeated = {min_items: 1}]` | 数量 |

---

## 2. 脑图

```
请求校验
├── Proto 校验 (PGV)
│   ├── 字符串规则 (min_len/max_len/pattern)
│   ├── 数值规则 (gte/lte/gt/lt)
│   ├── 枚举规则 (defined_only/in)
│   ├── 消息规则 (required)
│   └── 重复字段 (min_items/max_items)
├── Kratos 集成
│   ├── validate 中间件
│   ├── HTTP 参数绑定
│   └── gRPC 校验拦截器
├── 自定义校验器
│   ├── 自定义规则注册
│   ├── 跨字段校验
│   └── 业务规则校验
├── 错误处理
│   ├── 标准错误码
│   ├── 错误信息国际化
│   └── 字段级错误定位
└── 最佳实践
    ├── 分层校验 (Proto + Service)
    ├── 白名单 > 黑名单
    └── 错误信息脱敏
```

---

## 3. 完整 Go 代码

### v1 — Proto 校验规则 + Kratos 中间件

```protobuf
// api/user/v1/user.proto
syntax = "proto3";
package user.v1;

import "validate/validate.proto";

option go_package = "your-project/api/user/v1;v1";

message CreateUserReq {
  // Username: 2-50 characters, alphanumeric + underscore
  string username = 1 [(validate.rules).string = {
    min_len: 2,
    max_len: 50,
    pattern: "^[a-zA-Z0-9_]+$"
  }];

  // Email: valid email format
  string email = 2 [(validate.rules).string.email = true];

  // Age: 0-150
  int32 age = 3 [(validate.rules).int32 = {gte: 0, lte: 150}];

  // Role: must be defined enum value
  Role role = 4 [(validate.rules).enum = {defined_only: true}];

  // Tags: at least 1, at most 10
  repeated string tags = 5 [(validate.rules).repeated = {
    min_items: 1,
    max_items: 10
  }];
}

enum Role {
  ROLE_UNSPECIFIED = 0;
  ROLE_ADMIN = 1;
  ROLE_USER = 2;
}

message CreateUserReply {
  int64 id = 1;
}

service UserHTTP {
  rpc CreateUser(CreateUserReq) returns (CreateUserReply) {
    option (google.api.http) = {post: "/v1/users"};
  }
}
```

```go
// cmd/server/main.go — enable validate middleware
package main

import (
	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/middleware/validate"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func main() {
	httpSrv := http.NewServer(
		http.Address(":8000"),
		http.Middleware(
			validate.Validator(),  // Auto-validate all proto messages
		),
	)

	app := kratos.New(kratos.Server(httpSrv))
	app.Run()
}
```

### v2 — 自定义校验器 + 错误格式化

```go
// internal/pkg/validator/custom.go
package validator

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/go-kratos/kratos/v2/errors"
)

var (
	phoneRegex  = regexp.MustCompile(`^1[3-9]\d{9}$`)
	idCardRegex = regexp.MustCompile(`^\d{17}[\dXx]$`)
)

// ValidatePhone validates Chinese phone number
func ValidatePhone(phone string) error {
	if !phoneRegex.MatchString(phone) {
		return errors.BadRequest("VALIDATION_ERROR", "invalid phone number format")
	}
	return nil
}

// ValidateIDCard validates Chinese ID card
func ValidateIDCard(id string) error {
	if !idCardRegex.MatchString(id) {
		return errors.BadRequest("VALIDATION_ERROR", "invalid ID card format")
	}
	return nil
}

// ValidationError formats field-level validation errors
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func FormatValidationErr(err error) ([]FieldError, error) {
	if err == nil {
		return nil, nil
	}
	// Parse PGV error message
	msg := err.Error()
	fields := strings.Split(msg, ";")
	var errs []FieldError
	for _, f := range fields {
		f = strings.TrimSpace(f)
		if f == "" {
			continue
		}
		errs = append(errs, FieldError{
			Field:   extractField(f),
			Message: f,
		})
	}
	return errs, nil
}

func extractField(msg string) string {
	parts := strings.SplitN(msg, ":", 2)
	return strings.TrimSpace(parts[0])
}
```

```go
// internal/service/user.go — service-level validation
package service

import (
	"context"
	"your-project/internal/pkg/validator"
	"github.com/go-kratos/kratos/v2/errors"
)

func (s *UserService) CreateUser(ctx context.Context, req *v1.CreateUserReq) (*v1.CreateUserReply, error) {
	// Proto validation runs automatically via middleware
	// Add custom business validation here
	if err := validateBusinessRules(req); err != nil {
		return nil, err
	}

	user, err := s.uc.CreateUser(ctx, &biz.User{
		Username: req.Username,
		Email:    req.Email,
		Age:      req.Age,
	})
	if err != nil {
		return nil, err
	}
	return &v1.CreateUserReply{Id: user.ID}, nil
}

func validateBusinessRules(req *v1.CreateUserReq) error {
	// Cross-field validation: admin must have specific tags
	if req.Role == v1.Role_ROLE_ADMIN {
		hasAdminTag := false
		for _, tag := range req.Tags {
			if tag == "admin-certified" {
				hasAdminTag = true
				break
			}
		}
		if !hasAdminTag {
			return errors.BadRequest("VALIDATION_ERROR",
				"admin users must have 'admin-certified' tag")
		}
	}
	return nil
}
```

### v3 — 错误信息国际化

```go
// internal/pkg/i18n/validator_messages.go
package i18n

import (
	"context"

	"github.com/go-kratos/kratos/v2/metadata"
)

// Validation message translations
var messages = map[string]map[string]string{
	"en": {
		"required":       "This field is required",
		"min_len":        "Must be at least %d characters",
		"max_len":        "Must be at most %d characters",
		"email":          "Invalid email format",
		"pattern":        "Invalid format",
		"gte":            "Must be at least %d",
		"lte":            "Must be at most %d",
		"VALIDATION_ERROR": "Validation failed",
	},
	"zh": {
		"required":       "此字段为必填项",
		"min_len":        "长度不能少于 %d 个字符",
		"max_len":        "长度不能超过 %d 个字符",
		"email":          "邮箱格式不正确",
		"pattern":        "格式不正确",
		"gte":            "不能小于 %d",
		"lte":            "不能大于 %d",
		"VALIDATION_ERROR": "参数校验失败",
	},
}

// GetLang extracts language from context metadata
func GetLang(ctx context.Context) string {
	if md, ok := metadata.FromServerContext(ctx); ok {
		if lang := md.Get("x-lang"); lang != "" {
			return lang
		}
	}
	return "en"
}

// Translate returns localized message
func Translate(lang, key string, args ...interface{}) string {
	if msgs, ok := messages[lang]; ok {
		if msg, ok := msgs[key]; ok {
			return fmt.Sprintf(msg, args...)
		}
	}
	return key
}
```

```go
// internal/middleware/i18n_validate.go — i18n validation error middleware
package middleware

import (
	"context"
	"encoding/json"

	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
	"your-project/internal/pkg/i18n"
)

func I18nValidation() middleware.Middleware {
	return func(handler middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req interface{}) (interface{}, error) {
			reply, err := handler(ctx, req)
			if err != nil {
				lang := i18n.GetLang(ctx)
				// Replace error message with localized version
				// ... translate err based on lang
				_ = lang
			}
			return reply, err
		}
	}
}
```

---

## 4. 执行预览

```bash
# Generate proto with validation
$ protoc --proto_path=. --go_out=. --validate_out=. api/user/v1/user.proto

# Valid request
$ curl -X POST http://localhost:8000/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","age":25,"role":"ROLE_USER","tags":["dev"]}'
{"id":1}

# Invalid request — bad email
$ curl -X POST http://localhost:8000/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"not-an-email","age":25}'
{
  "code": 400,
  "reason": "VALIDATION_ERROR",
  "message": "invalid CreateUserReq.Email: value must be a valid email address"
}

# Invalid request — short username
$ curl -X POST http://localhost:8000/v1/users \
  -d '{"username":"a","email":"a@b.com","age":25}'
{
  "code": 400,
  "reason": "VALIDATION_ERROR",
  "message": "invalid CreateUserReq.Username: value length must be at least 2 runes"
}
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| Proto 生成 | 必须安装 `protoc-gen-validate` 并在 protoc 命令中添加 `--validate_out` |
| 中间件位置 | validate 中间件应放在 recovery 之后、业务逻辑之前 |
| gRPC 同样支持 | gRPC Server 也支持 validate 中间件 |
| 性能 | PGV 生成的代码零反射，性能优秀 |
| 嵌套消息 | 嵌套 message 默认不校验，需加 `required: true` |

---

## 6. 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 只在前端校验 | 前后端都要校验，后端是最终防线 |
| 手写 if-else 校验 | 用 PGV 声明式规则，编译生成 |
| 校验规则散落在各处 | Proto 层面统一规则 + Service 层业务校验 |
| 返回裸 error 字符串 | 返回标准 Kratos error（含 code/reason/message） |
| 忽略枚举的 0 值 | 枚举 0 值是默认值，用 `defined_only` 防止非法值 |
| 错误信息暴露内部细节 | 错误信息脱敏，不暴露字段名/SQL/结构 |

---

## 7. 练习题

### 🟢 Easy
1. 给 proto 文件添加 string/int32/enum 校验规则
2. 在 Kratos HTTP Server 中添加 validate 中间件

### 🟡 Medium
3. 实现跨字段校验（如 `password` 和 `confirm_password` 必须一致）
4. 自定义正则校验手机号和中国身份证号

### 🔴 Hard
5. 实现错误信息国际化（根据 `Accept-Language` 头返回不同语言）
6. 实现自定义 PGV 校验器插件（注册到 protoc-gen-validate）

---

## 8. 知识点总结

```
请求校验
├── Proto 校验 (PGV)
│   ├── 字符串 (min_len/max_len/pattern/email/url)
│   ├── 数值 (gte/lte/gt/lt/const/in)
│   ├── 枚举 (defined_only/in)
│   ├── 消息 (required/skip)
│   └── 集合 (min_items/max_items/unique)
├── Kratos 集成
│   ├── validate.Validator() 中间件
│   ├── 自动校验所有请求消息
│   └── 返回标准 BadRequest 错误
├── 自定义校验
│   ├── Service 层业务规则
│   ├── 跨字段校验
│   └── 自定义正则规则
└── 错误处理
    ├── 标准 Kratos Error
    ├── 字段级错误详情
    └── 国际化 (i18n)
```

---

## 9. 举一反三

| 本文学到的 | 可应用到 |
|-----------| ---------|
| PGV 声明式校验 | 所有 Protobuf 定义的 API |
| 分层校验策略 | 任何多层架构（网关→服务→数据） |
| 自定义校验器 | 业务特定规则（金额、日期范围） |
| 错误格式化 | 统一的 API 错误响应格式 |
| i18n 错误信息 | 多语言产品国际化 |

---

## 10. 参考资料

- [protoc-gen-validate](https://github.com/bufbuild/protovalidate)
- [Kratos validate 中间件](https://github.com/go-kratos/kratos/tree/main/middleware/validate)
- [Protobuf Field Rules](https://protobuf.dev/programming-guides/proto3/)
- [Kratos 错误处理](https://go-kratos.dev/docs/component/error)

---

## 11. 代码演进

| 版本 | 内容 | 适用场景 |
|------|------|---------|
| v1 | PGV Proto 规则 + validate 中间件 | 标准项目快速接入 |
| v2 | 自定义校验器 + 业务规则 + 错误格式化 | 复杂业务场景 |
| v3 | 错误国际化 + i18n 中间件 | 多语言产品 |

---

_校验不是麻烦，是省麻烦。_ 🛡️
