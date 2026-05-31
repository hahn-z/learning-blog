---
title: "008 - Todo CRUD 完整实现"
slug: "008-gin-crud"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T22:58:06.948+08:00"
updated_at: "2026-04-29T10:02:45.617+08:00"
reading_time: 34
tags: []
---

# 008 - Todo CRUD 完整实现

> **难度标注：** ⭐⭐⭐（中级）
>
> **前置知识：** Gin 路由、GORM 模型、RESTful 概念
>
> **学习目标：** 实现一个完整的 RESTful Todo API，包括分页、排序、筛选、统一响应、请求验证

---

## 一、概念讲解

**RESTful API** 是一种设计风格，用 HTTP 方法来表示对资源的操作：

| HTTP 方法 | 路径 | 操作 | 说明 |
|-----------|------|------|------|
| GET | /todos | 列表 | 获取所有 Todo（支持分页/筛选） |
| GET | /todos/:id | 详情 | 获取单个 Todo |
| POST | /todos | 创建 | 新建 Todo |
| PUT | /todos/:id | 更新 | 更新 Todo（全量） |
| DELETE | /todos/:id | 删除 | 删除 Todo |

### 统一响应格式

```json
// Success
{"code": 0, "message": "success", "data": {...}}

// Error
{"code": 40001, "message": "invalid parameter", "data": null}

// List with pagination
{"code": 0, "message": "success", "data": {"items": [...], "total": 100, "page": 1, "page_size": 10}}
```

---

## 二、脑图（ASCII）

```
                 Todo CRUD 完整实现
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     路由设计        核心功能       工程规范
        │              │              │
   ┌────┴────┐   ┌────┼────┐   ┌────┴────┐
   │         │   │    │    │   │         │
  RESTful  分页 CRUD 验证  统一响应   错误处理
   5个API  排序  增删改查  binding  Response  middleware
   筛选
```

---

## 三、完整 Go 代码

### v1：最小可用 CRUD

```go
// main.go - Minimal Todo CRUD
package main

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Todo model
type Todo struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Title       string    `gorm:"size:200;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Completed   bool      `gorm:"default:false" json:"completed"`
	Priority    string    `gorm:"size:20;default:medium" json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

var db *gorm.DB

func main() {
	var err error
	db, err = gorm.Open(sqlite.Open("todos.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&Todo{})

	r := gin.Default()

	// RESTful routes
	r.GET("/todos", listTodos)
	r.GET("/todos/:id", getTodo)
	r.POST("/todos", createTodo)
	r.PUT("/todos/:id", updateTodo)
	r.DELETE("/todos/:id", deleteTodo)

	r.Run(":8080")
}

func listTodos(c *gin.Context) {
	var todos []Todo
	db.Find(&todos)
	c.JSON(http.StatusOK, todos)
}

func getTodo(c *gin.Context) {
	var todo Todo
	id := c.Param("id")
	if err := db.First(&todo, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	c.JSON(http.StatusOK, todo)
}

func createTodo(c *gin.Context) {
	var todo Todo
	if err := c.ShouldBindJSON(&todo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Create(&todo)
	c.JSON(http.StatusCreated, todo)
}

func updateTodo(c *gin.Context) {
	var todo Todo
	if err := db.First(&todo, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	if err := c.ShouldBindJSON(&todo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Save(&todo)
	c.JSON(http.StatusOK, todo)
}

func deleteTodo(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	db.Delete(&Todo{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
```

**执行预览：**

```bash
# Create
$ curl -X POST http://localhost:8080/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Gin","priority":"high"}'
{"id":1,"title":"Learn Gin","description":"","completed":false,"priority":"high",...}

# List
$ curl http://localhost:8080/todos
[{"id":1,"title":"Learn Gin",...}]

# Update
$ curl -X PUT http://localhost:8080/todos/1 \
  -d '{"title":"Learn Gin Framework","completed":true}'
{"id":1,"title":"Learn Gin Framework","completed":true,...}

# Delete
$ curl -X DELETE http://localhost:8080/todos/1
{"message":"Deleted"}
```

### v2：统一响应 + 分页 + 筛选 + 验证

```go
// main.go - Production Todo CRUD with pagination and validation
package main

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ========== Models ==========
type Todo struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Title       string     `gorm:"size:200;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Completed   bool       `gorm:"default:false;index" json:"completed"`
	Priority    string     `gorm:"size:20;default:medium;index" json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ========== Request/Response structs ==========
// Unified response format
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// Paginated response
type PaginatedData struct {
	Items    []Todo `json:"items"`
	Total    int64  `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// Create request with validation
type CreateTodoRequest struct {
	Title       string     `json:"title" binding:"required,min=1,max=200"`
	Description string     `json:"description" binding:"max=1000"`
	Priority    string     `json:"priority" binding:"omitempty,oneof=low medium high"`
	DueDate     *time.Time `json:"due_date"`
}

// Update request (all optional)
type UpdateTodoRequest struct {
	Title       *string    `json:"title" binding:"omitempty,min=1,max=200"`
	Description *string    `json:"description" binding:"omitempty,max=1000"`
	Completed   *bool      `json:"completed"`
	Priority    *string    `json:"priority" binding:"omitempty,oneof=low medium high"`
	DueDate     *time.Time `json:"due_date"`
}

// List query parameters
type ListQuery struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Completed *bool  `form:"completed"`
	Priority  string `form:"priority" binding:"omitempty,oneof=low medium high"`
	Sort      string `form:"sort" binding:"omitempty,oneof=created_at title priority due_date"`
	Order     string `form:"order" binding:"omitempty,oneof=asc desc"`
	Search    string `form:"search"`
}

// Helper functions
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{Code: 0, Message: "created", Data: data})
}

func Error(c *gin.Context, status int, code int, msg string) {
	c.JSON(status, Response{Code: code, Message: msg, Data: nil})
}

var db *gorm.DB

func main() {
	var err error
	db, err = gorm.Open(sqlite.Open("todos.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&Todo{})

	r := gin.Default()

	// Todo routes group
	todos := r.Group("/todos")
	{
		todos.GET("", listTodos)
		todos.GET("/:id", getTodo)
		todos.POST("", createTodo)
		todos.PUT("/:id", updateTodo)
		todos.DELETE("/:id", deleteTodo)
	}

	log.Println("Server starting on :8080")
	r.Run(":8080")
}

func listTodos(c *gin.Context) {
	var query ListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	// Defaults
	if query.Page == 0 {
		query.Page = 1
	}
	if query.PageSize == 0 {
		query.PageSize = 10
	}

	q := db.Model(&Todo{})

	// Filter: completed
	if query.Completed != nil {
		q = q.Where("completed = ?", *query.Completed)
	}

	// Filter: priority
	if query.Priority != "" {
		q = q.Where("priority = ?", query.Priority)
	}

	// Search: title or description
	if query.Search != "" {
		q = q.Where("title LIKE ?", "%"+query.Search+"%")
	}

	// Count total
	var total int64
	q.Count(&total)

	// Sort
	sortField := "created_at"
	if query.Sort != "" {
		sortField = query.Sort
	}
	order := "desc"
	if query.Order == "asc" {
		order = "asc"
	}
	q = q.Order(sortField + " " + order)

	// Paginate
	var todos []Todo
	offset := (query.Page - 1) * query.PageSize
	q.Offset(offset).Limit(query.PageSize).Find(&todos)

	Success(c, PaginatedData{
		Items:    todos,
		Total:    total,
		Page:     query.Page,
		PageSize: query.PageSize,
	})
}

func getTodo(c *gin.Context) {
	var todo Todo
	if err := db.First(&todo, c.Param("id")).Error; err != nil {
		Error(c, http.StatusNotFound, 40401, "Todo not found")
		return
	}
	Success(c, todo)
}

func createTodo(c *gin.Context) {
	var req CreateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	todo := Todo{
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
	}
	if todo.Priority == "" {
		todo.Priority = "medium"
	}

	if err := db.Create(&todo).Error; err != nil {
		Error(c, http.StatusInternalServerError, 50001, "Failed to create todo")
		return
	}

	Created(c, todo)
}

func updateTodo(c *gin.Context) {
	var todo Todo
	if err := db.First(&todo, c.Param("id")).Error; err != nil {
		Error(c, http.StatusNotFound, 40401, "Todo not found")
		return
	}

	var req UpdateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	// Partial update using pointers
	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Completed != nil {
		updates["completed"] = *req.Completed
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.DueDate != nil {
		updates["due_date"] = req.DueDate
	}

	db.Model(&todo).Updates(updates)
	db.First(&todo, todo.ID) // Reload

	Success(c, todo)
}

func deleteTodo(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		Error(c, http.StatusBadRequest, 40001, "Invalid ID")
		return
	}

	result := db.Delete(&Todo{}, id)
	if result.RowsAffected == 0 {
		Error(c, http.StatusNotFound, 40401, "Todo not found")
		return
	}

	Success(c, gin.H{"deleted": true})
}
```

### v3：项目分层 + 中间件 + 配置化

```go
// config/config.go
package config

import "os"

type Config struct {
	Port     string
	DBPath   string
	PageSize int
}

func Load() *Config {
	return &Config{
		Port:     getEnv("PORT", "8080"),
		DBPath:   getEnv("DB_PATH", "todos.db"),
		PageSize: 10,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

```go
// middleware/logger.go - Request logging middleware
package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		log.Printf("[%s] %s %d %v",
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			duration,
		)
	}
}
```

---

## 四、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| binding 标签 | `required` vs `omitempty` | Create 用 required，Update 用 omitempty+指针 |
| 分页默认值 | page/page_size 可能为 0 | 代码中设置合理默认值 |
| 排序字段 | 用户传入的字段可能不安全 | 用 binding 白名单限制可选值 |
| 部分更新 | `Updates(struct)` 忽略零值 | 用 `map[string]interface{}` 或指针 |
| 响应格式 | 前端依赖统一格式 | 封装 Success/Error/Created 函数 |
| 并发安全 | SQLite 不支持高并发写 | 生产环境换 MySQL/PostgreSQL |

---

## 五、避坑指南

### ❌ Update 用 struct 导致零值不更新
```go
type UpdateReq struct {
    Completed bool `json:"completed"` // false is zero value!
}
db.Model(&todo).Updates(req) // completed: false won't update!
```
### ✅ 用指针区分"未传"和"传了零值"
```go
type UpdateReq struct {
    Completed *bool `json:"completed"` // nil = not provided, false = explicitly set
}
if req.Completed != nil {
    updates["completed"] = *req.Completed
}
```

### ❌ 不验证排序字段
```go
sortBy := c.Query("sort") // User could inject SQL!
db.Order(sortBy)           // DANGEROUS
```
### ✅ 白名单验证
```go
// Use binding validation
type ListQuery struct {
    Sort string `form:"sort" binding:"omitempty,oneof=created_at title priority"`
}
```

### ❌ 忘记处理"记录不存在"
```go
db.Delete(&Todo{}, 99999) // Silently succeeds, nothing deleted
c.JSON(200, gin.H{"message": "Deleted"}) // Misleading!
```
### ✅ 检查 RowsAffected
```go
result := db.Delete(&Todo{}, id)
if result.RowsAffected == 0 {
    c.JSON(404, gin.H{"error": "Not found"})
    return
}
```

---

## 六、练习题

### 🟢 初级
1. 为 Todo 添加一个 `Category` 字段，支持按分类筛选。
2. 实现一个 `GET /todos/stats` 接口，返回总数、已完成数、各优先级数量。

### 🟡 中级
3. 实现 Todo 的软删除和 `GET /todos/trash` 查看已删除项。
4. 添加 JWT 认证中间件，每个用户只能看到自己的 Todo。

### 🔴 高级
5. 实现批量操作接口：`POST /todos/batch` 支持批量创建、批量删除、批量更新状态。
6. 添加 Redis 缓存层，对 `GET /todos` 做列表缓存，过期时间 30 秒。

---

## 七、知识点总结

```
Todo CRUD 完整实现
├── RESTful 设计
│   ├── GET /todos (列表) / GET /todos/:id (详情)
│   ├── POST /todos (创建)
│   ├── PUT /todos/:id (更新)
│   └── DELETE /todos/:id (删除)
├── 统一响应
│   ├── Response{code, message, data}
│   ├── Success() / Created() / Error()
│   └── PaginatedData{items, total, page, page_size}
├── 请求验证
│   ├── binding:"required,min=1,max=200"
│   ├── binding:"oneof=low medium high" (枚举)
│   └── 指针字段区分"未传"和"零值"
├── 分页排序筛选
│   ├── Offset/Limit 分页
│   ├── Order 排序
│   └── Where 筛选 + LIKE 搜索
└── 工程实践
    ├── 配置化 (config package)
    ├── 中间件 (logging)
    └── 错误码设计 (code + message)
```

---

## 八、举一反三

| 本文学到 | 可应用到 | 示例 |
|----------|---------|------|
| RESTful 路由设计 | 任何资源 CRUD | 用户管理、文章管理、订单管理 |
| 统一响应格式 | 所有 API 项目 | 前后端分离项目的标准响应 |
| 分页/排序/筛选 | 任何列表接口 | 商品列表、搜索结果、数据报表 |
| 请求验证 | 所有输入场景 | 注册表单、订单提交、设置修改 |
| 指针部分更新 | 编辑类接口 | 个人资料编辑、文章修改 |

---

## 九、参考资料

- [Gin 绑定与验证](https://gin-gonic.com/docs/custom-validation/)
- [RESTful API 设计指南](https://restfulapi.net/)
- [Go validator 标签](https://pkg.go.dev/github.com/go-playground/validator/v10)
- [GORM CRUD](https://gorm.io/docs/create.html)

---

## 十、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| **v1** | 最小 CRUD，直连 DB | 原型验证、学习 |
| **v2** | 统一响应 + 分页 + 验证 | 生产级单文件 |
| **v3** | 配置化 + 中间件 + 分层 | 可扩展的项目基础 |
