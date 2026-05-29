---
title: "023 - Go Swagger API 文档生成：从注解到交互式文档的完整指南"
slug: "023-swagger"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.471+08:00"
updated_at: "2026-04-29T10:02:45.066+08:00"
reading_time: 33
tags: ["测试"]
---

# Swagger API 文档生成

> **难度标注**：⭐⭐⭐（中级）
> **预计阅读时间**：20 分钟
> **适用版本**：Go 1.21+ / swag v1.16+

## 一、概念讲解

### 什么是 Swagger？

Swagger（现已更名为 OpenAPI）是一种 **API 描述规范**，用来定义 RESTful API 的接口文档。它能做到：

1. **自动生成文档** — 从代码注释自动生成美观的 API 文档页面
2. **交互式测试** — 直接在文档页面发送请求测试 API
3. **前后端协作** — 前端根据文档开发，无需等后端完成
4. **标准化** — 统一的 API 描述格式，团队协作更顺畅

### Go 生态的 Swagger 方案

| 工具 | 特点 | 推荐度 |
|------|------|--------|
| **swaggo/swag** | 注解驱动，自动生成，Gin/Echo/Fiber 都支持 | ⭐⭐⭐⭐⭐ |
| **go-swagger** | 功能强大但配置复杂 | ⭐⭐⭐ |
| **protoc-gen-openapi** | gRPC/Protobuf 项目适用 | ⭐⭐⭐⭐ |

**本文选择 swaggo/swag，最主流最好用。**

### 核心工作流程

```
代码注释 → swag init → docs/ 目录 → Swagger UI 展示
```

## 二、脑图（ASCII）

```
Swagger API 文档
├── 核心概念
│   ├── OpenAPI 规范
│   ├── Swagger UI (可视化)
│   └── 注解驱动 (Annotations)
├── swaggo/swag
│   ├── 安装 (swag init)
│   ├── 主注解
│   │   ├── @title
│   │   ├── @version
│   │   ├── @description
│   │   ├── @host
│   │   ├── @BasePath
│   │   └── @securityDefinitions
│   └── API 注解
│       ├── @Summary
│       ├── @Description
│       ├── @Param
│       ├── @Success
│       ├── @Failure
│       ├── @Router
│       └── @Tags
├── 数据模型
│   ├── 结构体 tag
│   ├── @Accept / @Produce
│   └── 嵌套模型
├── 集成框架
│   ├── Gin (gin-swagger)
│   ├── Echo
│   └── net/http
└── 最佳实践
    ├── 文档即代码
    ├── CI 生成检查
    └── 版本管理
```

## 三、完整实战代码

### 3.1 项目初始化

```bash
mkdir swagger-demo && cd swagger-demo
go mod init swagger-demo

# 安装依赖
go get -u github.com/gin-gonic/gin
go get -u github.com/swaggo/swag/cmd/swag
go get -u github.com/swaggo/gin-swagger
go get -u github.com/swaggo/files

# 安装 swag CLI
go install github.com/swaggo/swag/cmd/swag@latest
```

### 3.2 数据模型（model/user.go）

```go
package model

import "time"

// User represents a user in the system
type User struct {
	ID        uint      `json:"id" example:"1"`
	Username  string    `json:"username" example:"zhangsan"`
	Email     string    `json:"email" example:"zhangsan@example.com"`
	Age       int       `json:"age" example:"25"`
	CreatedAt time.Time `json:"created_at" example:"2024-01-15T10:30:00Z"`
	UpdatedAt time.Time `json:"updated_at" example:"2024-01-15T10:30:00Z"`
}

// CreateUserRequest is the request body for creating a user
type CreateUserRequest struct {
	Username string `json:"username" binding:"required" example:"zhangsan"`
	Email    string `json:"email" binding:"required,email" example:"zhangsan@example.com"`
	Age      int    `json:"age" binding:"gte=0,lte=150" example:"25"`
}

// UpdateUserRequest is the request body for updating a user
type UpdateUserRequest struct {
	Username string `json:"username" example:"zhangsan"`
	Email    string `json:"email" example:"zhangsan@example.com"`
	Age      int    `json:"age" example:"25"`
}

// APIResponse is a generic API response wrapper
type APIResponse struct {
	Code    int         `json:"code" example:"200"`
	Message string      `json:"message" example:"success"`
	Data    interface{} `json:"data"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"bad request"`
}
```

### 3.3 API 路由与注解（main.go）

```go
package main

import (
	"net/http"
	"strconv"
	"strings"
	"swagger-demo/model"

	"github.com/gin-gonic/gin"
	_ "swagger-demo/docs"      // Import generated docs
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title           User Management API
// @version         1.0
// @description     A comprehensive user management REST API built with Go and Gin.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1
// @schemes   http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

// @externalDocs.description  OpenAPI
// @externalDocs.url          https://swagger.io/resources/open-api/
func main() {
	r := gin.Default()

	// Swagger documentation endpoint
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API v1 routes
	v1 := r.Group("/api/v1")
	{
		users := v1.Group("/users")
		{
			users.GET("", listUsers)
			users.GET("/:id", getUser)
			users.POST("", createUser)
			users.PUT("/:id", updateUser)
			users.DELETE("/:id", deleteUser)
		}
	}

	r.Run(":8080")
}

// listUsers godoc
// @Summary      List all users
// @Description  Get a paginated list of users with optional filtering
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        page      query    int     false  "Page number"       default(1)
// @Param        pageSize  query    int     false  "Page size"         default(10)
// @Param        keyword   query    string  false  "Search keyword"
// @Success      200       {object} model.APIResponse
// @Failure      500       {object} model.ErrorResponse
// @Router       /users [get]
func listUsers(c *gin.Context) {
	// Mock data for demonstration
	users := []model.User{
		{ID: 1, Username: "zhangsan", Email: "zhangsan@example.com", Age: 25},
		{ID: 2, Username: "lisi", Email: "lisi@example.com", Age: 30},
		{ID: 3, Username: "wangwu", Email: "wangwu@example.com", Age: 28},
	}

	keyword := c.Query("keyword")
	if keyword != "" {
		var filtered []model.User
		for _, u := range users {
			if strings.Contains(u.Username, keyword) || strings.Contains(u.Email, keyword) {
				filtered = append(filtered, u)
			}
		}
		users = filtered
	}

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    200,
		Message: "success",
		Data:    users,
	})
}

// getUser godoc
// @Summary      Get a user by ID
// @Description  Retrieve detailed information of a specific user
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "User ID"
// @Success      200  {object}  model.APIResponse
// @Failure      404  {object}  model.ErrorResponse
// @Router       /users/{id} [get]
func getUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{Code: 400, Message: "invalid user ID"})
		return
	}

	// Mock: only user 1 exists
	if id != 1 {
		c.JSON(http.StatusNotFound, model.ErrorResponse{Code: 404, Message: "user not found"})
		return
	}

	user := model.User{ID: 1, Username: "zhangsan", Email: "zhangsan@example.com", Age: 25}
	c.JSON(http.StatusOK, model.APIResponse{Code: 200, Message: "success", Data: user})
}

// createUser godoc
// @Summary      Create a new user
// @Description  Create a new user with the provided information
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        body  body      model.CreateUserRequest  true  "User creation data"
// @Success      201   {object}  model.APIResponse
// @Failure      400   {object}  model.ErrorResponse
// @Failure      500   {object}  model.ErrorResponse
// @Security     BearerAuth
// @Router       /users [post]
func createUser(c *gin.Context) {
	var req model.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{Code: 400, Message: err.Error()})
		return
	}

	user := model.User{
		ID:       100,
		Username: req.Username,
		Email:    req.Email,
		Age:      req.Age,
	}

	c.JSON(http.StatusCreated, model.APIResponse{Code: 201, Message: "created", Data: user})
}

// updateUser godoc
// @Summary      Update a user
// @Description  Update an existing user's information
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        id    path      int                      true  "User ID"
// @Param        body  body      model.UpdateUserRequest  true  "User update data"
// @Success      200   {object}  model.APIResponse
// @Failure      400   {object}  model.ErrorResponse
// @Failure      404   {object}  model.ErrorResponse
// @Security     BearerAuth
// @Router       /users/{id} [put]
func updateUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{Code: 400, Message: "invalid user ID"})
		return
	}

	var req model.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{Code: 400, Message: err.Error()})
		return
	}

	user := model.User{ID: uint(id), Username: req.Username, Email: req.Email, Age: req.Age}
	c.JSON(http.StatusOK, model.APIResponse{Code: 200, Message: "updated", Data: user})
}

// deleteUser godoc
// @Summary      Delete a user
// @Description  Delete a user by ID
// @Tags         users
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "User ID"
// @Success      200  {object}  model.APIResponse
// @Failure      404  {object}  model.ErrorResponse
// @Security     BearerAuth
// @Router       /users/{id} [delete]
func deleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{Code: 400, Message: "invalid user ID"})
		return
	}

	c.JSON(http.StatusOK, model.APIResponse{
		Code:    200,
		Message: "deleted",
		Data:    map[string]int{"deleted_id": id},
	})
}
```

### 3.4 生成文档并运行

```bash
# 生成 Swagger 文档
swag init -g main.go -o ./docs

# 运行项目
go run main.go

# 访问 Swagger UI
# 浏览器打开 http://localhost:8080/swagger/index.html
```

## 四、执行预览

```bash
$ swag init -g main.go -o ./docs
2024/01/15 10:30:00 Generate swagger docs....
2024/01/15 10:30:00 Generate general API Info
2024/01/15 10:30:00 Generating model.CreateUserRequest
2024/01/15 10:30:00 Generating model.UpdateUserRequest
2024/01/15 10:30:00 Generating model.User
2024/01/15 10:30:00 Creating docs.go successfully
```

```
# 浏览器访问 http://localhost:8080/swagger/index.html
# 可以看到：
# - API 列表按 Tags 分组
# - 每个接口可展开查看参数、返回值
# - "Try it out" 按钮可直接测试 API
# - Models 区域展示数据结构
```

```bash
# 测试 API
$ curl http://localhost:8080/api/v1/users
{"code":200,"message":"success","data":[...]}

$ curl -X POST http://localhost:8080/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"new@test.com","age":22}'
{"code":201,"message":"created","data":{...}}
```

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| docs 导入 | 必须 `_ import "your-module/docs"`，否则 Swagger UI 空白 |
| 重新生成 | 每次修改注解后需运行 `swag init` 重新生成 |
| 路由匹配 | `@Router` 路径要与实际路由完全匹配 |
| 模型注册 | 使用到的 struct 要在某个注解中被引用才会出现在 Models |
| 中文支持 | `swag init --parseDependency` 可处理依赖中的类型 |
| CI 集成 | 建议在 CI 中加入 `swag fmt` + `swag init` 检查注解格式 |
| 多文件项目 | `swag init -g cmd/main.go` 指定入口文件，`--parseDependency` 解析依赖 |

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| Swagger UI 空白页面 | 检查是否 `_ import "module/docs"` 且运行了 `swag init` |
| Model 不显示 | 确保 struct 在注解中被引用（如 `@Success 200 {object} model.User`） |
| `@Router` 路径不匹配 | 确保注解路径和 Gin 路由注册路径一致，注意 `{id}` vs `:id` |
| 参数不显示 | 检查 `@Param` 格式：`名称 位置 类型 必填 描述` |
| 嵌套 struct 不生成 | 添加 `--parseDependency` 参数 |
| 多模块项目找不到类型 | 使用 `--parseInternal` 和 `--parseDepth 3` |
| 注解格式错误无报错 | 使用 `swag fmt` 格式化注解，提前发现语法问题 |

## 七、练习题

### 🟢 初级
1. 为一个 Todo API 添加 Swagger 注解，包含 CRUD 5 个接口
2. 在 Swagger UI 中测试所有接口，截图验证

### 🟡 中级
3. 添加 JWT 认证注解，在 Swagger UI 中输入 Token 测试
4. 为 API 添加分页参数、排序参数的注解

### 🔴 高级
5. 编写 CI 脚本，每次 PR 自动检查 Swagger 注解格式和完整性
6. 实现多版本 API 文档（v1/v2），使用不同 Swagger 分组

## 八、知识点总结

```
Swagger 知识树
├── 核心概念
│   ├── OpenAPI 规范 (OAS 2.0/3.0)
│   ├── Swagger UI (交互式文档)
│   └── 注解驱动开发
├── swaggo/swag 注解
│   ├── 全局注解
│   │   ├── @title @version @description
│   │   ├── @host @BasePath
│   │   ├── @securityDefinitions
│   │   └── @contact @license
│   └── 接口注解
│       ├── @Summary @Description
│       ├── @Param (query/path/body/header)
│       ├── @Success @Failure
│       ├── @Router
│       ├── @Tags
│       └── @Security
├── 数据模型
│   ├── struct tag (json/example)
│   ├── 嵌套结构体
│   └── 泛型响应
└── 工作流
    ├── swag init 生成
    ├── swag fmt 格式化
    └── CI 集成
```

## 九、举一反三

| 场景 | 方案 | 关键注解 |
|------|------|---------|
| JWT 认证 | `@securityDefinitions.apikey` | `@Security BearerAuth` |
| 文件上传 | `@Accept multipart/form-data` | `@Param file formData file true` |
| 分页列表 | `@Param page query int` | `@Param pageSize query int` |
| WebSocket | 不支持自动文档 | 手动补充 `@Description` |
| gRPC-Gateway | protoc-gen-openapi | 从 proto 文件生成 |
| 多版本 API | `swag init --outputTypes go` 分组 | 不同 `@Tags` 区分版本 |

## 十、参考资料

- [swaggo/swag GitHub](https://github.com/swaggo/swag)
- [gin-swagger 集成](https://github.com/swaggo/gin-swagger)
- [OpenAPI 规范](https://swagger.io/specification/)
- [Swag 注解参考](https://swaggo.github.io/swaggo.io/declarative_comments_format/)

## 十一、代码演进

### v1：最小 Swagger 集成

```go
// @title My API
// @version 1.0
// @host localhost:8080
// @BasePath /api

func main() {
    r := gin.Default()
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
    r.GET("/api/hello", helloHandler)
    r.Run()
}
```

### v2：完整 CRUD + 数据模型

添加 model 层、统一响应格式、完整 CRUD 注解、错误处理。每个接口都有详细的 `@Param`、`@Success`、`@Failure` 注解。

### v3：企业级方案

- 添加 JWT 认证注解
- 统一错误码文档
- CI 自动检查注解完整性
- 多版本 API 分组
- Makefile 集成 swag 命令

```makefile
.PHONY: swag run

swag:
	swag fmt
	swag init -g main.go -o ./docs --parseDependency --parseInternal

run: swag
	go run main.go
```
