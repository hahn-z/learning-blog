---
title: "009 - Service 层架构设计"
slug: "009-gin-service"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T22:58:06.958+08:00"
updated_at: "2026-04-29T10:02:45.625+08:00"
reading_time: 46
tags: []
---

# 009 - Service 层架构设计

> **难度标注：** ⭐⭐⭐（中级）
>
> **前置知识：** Go 接口、Gin Handler、GORM 基础
>
> **学习目标：** 掌握 Handler-Service-Repository 三层架构、依赖注入、接口定义与业务逻辑封装

---

## 一、概念讲解

当项目从"一个 main.go 搞定"进化到"几十个功能"时，代码组织就成了关键问题。**三层架构**是最经典的解决方案。

### 为什么要分层？

| 问题 | 不分层 | 分层后 |
|------|--------|--------|
| 一个 Handler 500 行 | 所有逻辑混在一起 | Handler 只有 20 行 |
| 换数据库 | 改几十个 Handler | 只改 Repository |
| 单元测试 | 需要 HTTP 请求+数据库 | Mock 接口即可 |
| 代码复用 | 复制粘贴 | 调用 Service 方法 |

### 三层职责

```
┌─────────────────────────────────┐
│  Handler 层（控制器）              │  ← 处理 HTTP 请求/响应
│  - 参数绑定、验证                  │
│  - 调用 Service                   │
│  - 返回响应                       │
├─────────────────────────────────┤
│  Service 层（业务逻辑）            │  ← 核心业务规则
│  - 业务规则校验                    │
│  - 数据组装                       │
│  - 调用 Repository                │
├─────────────────────────────────┤
│  Repository 层（数据访问）         │  ← 只管数据库操作
│  - CRUD 封装                      │
│  - 查询构建                       │
│  - 数据库交互                     │
└─────────────────────────────────┘
```

---

## 二、脑图（ASCII）

```
                  三层架构设计
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     目录结构       依赖注入       接口设计
        │              │              │
   ┌────┴────┐    ┌────┴────┐   ┌────┴────┐
   │         │    │         │   │         │
 handlers/ service/ 构造函数 Service接口 Repo接口
 models/  repository/ Wire/Dig  业务方法  数据方法
 config/  middleware/
```

---

## 三、完整 Go 代码

### v1：基础三层架构（手动依赖注入）

**项目结构：**

```
todo-app/
├── main.go
├── config/
│   └── config.go
├── models/
│   └── todo.go
├── repository/
│   └── todo_repository.go
├── service/
│   └── todo_service.go
├── handler/
│   └── todo_handler.go
└── response/
    └── response.go
```

```go
// models/todo.go
package models

import "time"

type Todo struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	Title       string     `gorm:"size:200;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Completed   bool       `gorm:"default:false" json:"completed"`
	Priority    string     `gorm:"size:20;default:medium" json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// DTOs (Data Transfer Objects)
type CreateTodoInput struct {
	Title       string     `json:"title" binding:"required,min=1,max=200"`
	Description string     `json:"description" binding:"max=1000"`
	Priority    string     `json:"priority" binding:"omitempty,oneof=low medium high"`
	DueDate     *time.Time `json:"due_date"`
}

type UpdateTodoInput struct {
	Title       *string    `json:"title" binding:"omitempty,min=1,max=200"`
	Description *string    `json:"description" binding:"omitempty,max=1000"`
	Completed   *bool      `json:"completed"`
	Priority    *string    `json:"priority" binding:"omitempty,oneof=low medium high"`
	DueDate     *time.Time `json:"due_date"`
}

type ListQuery struct {
	Page      int    `form:"page" binding:"omitempty,min=1"`
	PageSize  int    `form:"page_size" binding:"omitempty,min=1,max=100"`
	Completed *bool  `form:"completed"`
	Priority  string `form:"priority" binding:"omitempty,oneof=low medium high"`
	Search    string `form:"search"`
}
```

```go
// response/response.go - Unified response helpers
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{Code: 0, Message: "created", Data: data})
}

func BadRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, Response{Code: 40001, Message: msg, Data: nil})
}

func NotFound(c *gin.Context, msg string) {
	c.JSON(http.StatusNotFound, Response{Code: 40401, Message: msg, Data: nil})
}

func InternalError(c *gin.Context, msg string) {
	c.JSON(http.StatusInternalServerError, Response{Code: 50001, Message: msg, Data: nil})
}
```

```go
// repository/todo_repository.go - Data access layer
package repository

import (
	"myapp/models"

	"gorm.io/gorm"
)

// Interface - defines what the repository can do
type TodoRepository interface {
	Create(todo *models.Todo) error
	FindByID(id uint) (*models.Todo, error)
	FindAll(query models.ListQuery) ([]models.Todo, int64, error)
	Update(todo *models.Todo, updates map[string]interface{}) error
	Delete(id uint) error
}

// Implementation
type todoRepository struct {
	db *gorm.DB
}

// Constructor with dependency injection
func NewTodoRepository(db *gorm.DB) TodoRepository {
	return &todoRepository{db: db}
}

func (r *todoRepository) Create(todo *models.Todo) error {
	return r.db.Create(todo).Error
}

func (r *todoRepository) FindByID(id uint) (*models.Todo, error) {
	var todo models.Todo
	if err := r.db.First(&todo, id).Error; err != nil {
		return nil, err
	}
	return &todo, nil
}

func (r *todoRepository) FindAll(query models.ListQuery) ([]models.Todo, int64, error) {
	var todos []models.Todo
	var total int64

	q := r.db.Model(&models.Todo{})

	// Filters
	if query.Completed != nil {
		q = q.Where("completed = ?", *query.Completed)
	}
	if query.Priority != "" {
		q = q.Where("priority = ?", query.Priority)
	}
	if query.Search != "" {
		q = q.Where("title LIKE ?", "%"+query.Search+"%")
	}

	q.Count(&total)

	// Pagination defaults
	page := query.Page
	pageSize := query.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&todos).Error; err != nil {
		return nil, 0, err
	}

	return todos, total, nil
}

func (r *todoRepository) Update(todo *models.Todo, updates map[string]interface{}) error {
	return r.db.Model(todo).Updates(updates).Error
}

func (r *todoRepository) Delete(id uint) error {
	return r.db.Delete(&models.Todo{}, id).Error
}
```

```go
// service/todo_service.go - Business logic layer
package service

import (
	"errors"
	"fmt"
	"time"

	"myapp/models"
	"myapp/repository"
)

// Interface
type TodoService interface {
	Create(input models.CreateTodoInput) (*models.Todo, error)
	GetByID(id uint) (*models.Todo, error)
	List(query models.ListQuery) ([]models.Todo, int64, error)
	Update(id uint, input models.UpdateTodoInput) (*models.Todo, error)
	Delete(id uint) error
}

type todoService struct {
	repo repository.TodoRepository
}

// Constructor - depends on interface, not concrete type
func NewTodoService(repo repository.TodoRepository) TodoService {
	return &todoService{repo: repo}
}

func (s *todoService) Create(input models.CreateTodoInput) (*models.Todo, error) {
	todo := &models.Todo{
		Title:       input.Title,
		Description: input.Description,
		Priority:    input.Priority,
		DueDate:     input.DueDate,
	}
	if todo.Priority == "" {
		todo.Priority = "medium"
	}

	// Business rule: high priority tasks must have due date
	if todo.Priority == "high" && todo.DueDate == nil {
		return nil, errors.New("high priority tasks must have a due date")
	}

	if err := s.repo.Create(todo); err != nil {
		return nil, fmt.Errorf("failed to create todo: %w", err)
	}
	return todo, nil
}

func (s *todoService) GetByID(id uint) (*models.Todo, error) {
	todo, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("todo not found")
	}
	return todo, nil
}

func (s *todoService) List(query models.ListQuery) ([]models.Todo, int64, error) {
	return s.repo.FindAll(query)
}

func (s *todoService) Update(id uint, input models.UpdateTodoInput) (*models.Todo, error) {
	// Verify exists
	todo, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("todo not found")
	}

	// Build updates map
	updates := map[string]interface{}{}
	if input.Title != nil {
		updates["title"] = *input.Title
	}
	if input.Description != nil {
		updates["description"] = *input.Description
	}
	if input.Completed != nil {
		updates["completed"] = *input.Completed
	}
	if input.Priority != nil {
		updates["priority"] = *input.Priority
	}
	if input.DueDate != nil {
		updates["due_date"] = input.DueDate
	}

	// Business rule: completing a task records the time
	if input.Completed != nil && *input.Completed {
		now := time.Now()
		updates["completed_at"] = &now
	}

	if len(updates) == 0 {
		return todo, nil // Nothing to update
	}

	if err := s.repo.Update(todo, updates); err != nil {
		return nil, fmt.Errorf("failed to update todo: %w", err)
	}

	// Reload
	return s.repo.FindByID(id)
}

func (s *todoService) Delete(id uint) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("todo not found")
	}
	return s.repo.Delete(id)
}
```

```go
// handler/todo_handler.go - HTTP handler layer
package handler

import (
	"net/http"
	"strconv"

	"myapp/models"
	"myapp/response"
	"myapp/service"

	"github.com/gin-gonic/gin"
)

type TodoHandler struct {
	svc service.TodoService
}

func NewTodoHandler(svc service.TodoService) *TodoHandler {
	return &TodoHandler{svc: svc}
}

// RegisterRoutes registers all todo routes
func (h *TodoHandler) RegisterRoutes(rg *gin.RouterGroup) {
	todos := rg.Group("/todos")
	{
		todos.GET("", h.List)
		todos.GET("/:id", h.GetByID)
		todos.POST("", h.Create)
		todos.PUT("/:id", h.Update)
		todos.DELETE("/:id", h.Delete)
	}
}

func (h *TodoHandler) Create(c *gin.Context) {
	var input models.CreateTodoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	todo, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, todo)
}

func (h *TodoHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	todo, err := h.svc.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, todo)
}

func (h *TodoHandler) List(c *gin.Context) {
	var query models.ListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	todos, total, err := h.svc.List(query)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"items":     todos,
		"total":     total,
		"page":      query.Page,
		"page_size": query.PageSize,
	})
}

func (h *TodoHandler) Update(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	var input models.UpdateTodoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	todo, err := h.svc.Update(uint(id), input)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, todo)
}

func (h *TodoHandler) Delete(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	if err := h.svc.Delete(uint(id)); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, gin.H{"deleted": true})
}
```

```go
// main.go - Wire everything together
package main

import (
	"log"

	"myapp/handler"
	"myapp/models"
	"myapp/repository"
	"myapp/service"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 1. Database
	db, err := gorm.Open(sqlite.Open("todos.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	db.AutoMigrate(&models.Todo{})

	// 2. Dependency injection (manual)
	todoRepo := repository.NewTodoRepository(db)          // Repository depends on DB
	todoSvc := service.NewTodoService(todoRepo)            // Service depends on Repository interface
	todoHandler := handler.NewTodoHandler(todoSvc)         // Handler depends on Service interface

	// 3. Router
	r := gin.Default()
	todoHandler.RegisterRoutes(r.Group("/api"))

	log.Println("Server starting on :8080")
	r.Run(":8080")
}
```

**执行预览：**

```bash
$ go run main.go
Server starting on :8080

# Create todo
$ curl -X POST http://localhost:8080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn layered architecture","priority":"high"}'
{"code":40001,"message":"high priority tasks must have a due date","data":null}

# With due date
$ curl -X POST http://localhost:8080/api/todos \
  -d '{"title":"Learn layered architecture","priority":"high","due_date":"2025-12-31T00:00:00Z"}'
{"code":0,"message":"created","data":{"id":1,...}}
```

### v2：使用接口 Mock 进行单元测试

```go
// service/todo_service_test.go
package service

import (
	"errors"
	"testing"
	"time"

	"myapp/models"
)

// Mock repository
type mockTodoRepo struct {
	todos map[uint]*models.Todo
	nextID uint
}

func newMockRepo() *mockTodoRepo {
	return &mockTodoRepo{
		todos:  make(map[uint]*models.Todo),
		nextID: 1,
	}
}

func (m *mockTodoRepo) Create(todo *models.Todo) error {
	todo.ID = m.nextID
	m.nextID++
	m.todos[todo.ID] = todo
	return nil
}

func (m *mockTodoRepo) FindByID(id uint) (*models.Todo, error) {
	todo, ok := m.todos[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return todo, nil
}

func (m *mockTodoRepo) FindAll(query models.ListQuery) ([]models.Todo, int64, error) {
	var result []models.Todo
	for _, t := range m.todos {
		result = append(result, *t)
	}
	return result, int64(len(result)), nil
}

func (m *mockTodoRepo) Update(todo *models.Todo, updates map[string]interface{}) error {
	for k, v := range updates {
		switch k {
		case "title":
			todo.Title = v.(string)
		case "completed":
			todo.Completed = v.(bool)
		}
	}
	m.todos[todo.ID] = todo
	return nil
}

func (m *mockTodoRepo) Delete(id uint) error {
	delete(m.todos, id)
	return nil
}

// Tests
func TestCreate_Success(t *testing.T) {
	svc := NewTodoService(newMockRepo())
	input := models.CreateTodoInput{Title: "Test", Priority: "medium"}

	todo, err := svc.Create(input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if todo.ID != 1 {
		t.Errorf("expected ID=1, got %d", todo.ID)
	}
}

func TestCreate_HighPriorityNoDueDate(t *testing.T) {
	svc := NewTodoService(newMockRepo())
	input := models.CreateTodoInput{Title: "Urgent", Priority: "high"}

	_, err := svc.Create(input)
	if err == nil {
		t.Fatal("expected error for high priority without due date")
	}
}

func TestDelete_NotFound(t *testing.T) {
	svc := NewTodoService(newMockRepo())
	err := svc.Delete(999)
	if err == nil {
		t.Fatal("expected error for non-existent todo")
	}
}
```

### v3：多 Service 协作 + 事务传播

```go
// service/stats_service.go - A second service that depends on TodoService
package service

type StatsService interface {
	GetTodoStats() (map[string]interface{}, error)
}

type statsService struct {
	todoSvc TodoService
}

func NewStatsService(todoSvc TodoService) StatsService {
	return &statsService{todoSvc: todoSvc}
}

func (s *statsService) GetTodoStats() (map[string]interface{}, error) {
	all, total, err := s.todoSvc.List(models.ListQuery{PageSize: 10000})
	if err != nil {
		return nil, err
	}

	completed := 0
	priorityCount := map[string]int{"low": 0, "medium": 0, "high": 0}

	for _, t := range all {
		if t.Completed {
			completed++
		}
		priorityCount[t.Priority]++
	}

	return map[string]interface{}{
		"total":     total,
		"completed": completed,
		"pending":   int(total) - completed,
		"by_priority": priorityCount,
	}, nil
}
```

---

## 四、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 接口 vs 具体类型 | Service 依赖接口而非实现 | 便于测试和替换实现 |
| 构造函数 | 返回接口类型 | `func NewXxxService(repo Repo) Service` |
| Handler 职责 | 只做参数绑定和响应 | 业务逻辑放 Service |
| Repository 职责 | 只做数据库操作 | 不含业务判断 |
| 错误包装 | 用 `fmt.Errorf("...: %w", err)` | 保留错误链 |
| 循环依赖 | Service A 依赖 Service B，反之亦然 | 提取公共逻辑到第三个 Service |

---

## 五、避坑指南

### ❌ Handler 里写业务逻辑
```go
func (h *Handler) Create(c *gin.Context) {
    // 100 lines of business logic here...
    if input.Priority == "high" && input.DueDate == nil {
        c.JSON(400, ...)
        return
    }
}
```
### ✅ Handler 只做参数绑定+调用 Service
```go
func (h *Handler) Create(c *gin.Context) {
    var input CreateInput
    if err := c.ShouldBindJSON(&input); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    result, err := h.svc.Create(input) // All logic in service
    if err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    response.Created(c, result)
}
```

### ❌ Service 直接用 *gorm.DB
```go
type TodoService struct {
    db *gorm.DB // Tightly coupled to GORM!
}
```
### ✅ Service 依赖 Repository 接口
```go
type TodoService struct {
    repo TodoRepository // Can swap to MongoDB, Redis, etc.
}
```

### ❌ 不写测试
```go
// "It works on my machine" is not a test strategy
```
### ✅ 用 Mock Repository 写单元测试
```go
func TestCreate(t *testing.T) {
    svc := NewTodoService(newMockRepo())
    _, err := svc.Create(input)
    assert.NoError(t, err)
}
```

---

## 六、练习题

### 🟢 初级
1. 创建一个 `UserService` 接口及其实现，包含 Register 和 Login 方法。
2. 为 `TodoHandler` 添加一个 `GET /todos/stats` 路由。

### 🟡 中级
3. 实现 `UserService` 的单元测试，Mock `UserRepository` 接口。
4. 添加日志中间件，在 Service 层记录每个方法的执行时间。

### 🔴 高级
5. 使用 Wire 或 Dig 实现自动依赖注入，替代手动组装。
6. 设计一个事件系统：Service 操作后发布事件，其他 Service 订阅处理。

---

## 七、知识点总结

```
Service 层架构设计
├── 三层架构
│   ├── Handler: HTTP 处理（绑定、验证、响应）
│   ├── Service: 业务逻辑（规则、组装）
│   └── Repository: 数据访问（CRUD、查询）
├── 依赖注入
│   ├── 构造函数注入（推荐）
│   ├── 接口依赖（解耦）
│   └── 手动 vs 自动（Wire/Dig）
├── 接口设计
│   ├── Repository 接口: Create/Find/Update/Delete
│   ├── Service 接口: 业务方法
│   └── 面向接口编程
├── 单元测试
│   ├── Mock 实现 Repository
│   ├── 测试业务逻辑
│   └── 不依赖数据库
└── 项目结构
    ├── models/ - 数据模型 + DTO
    ├── repository/ - 数据访问
    ├── service/ - 业务逻辑
    ├── handler/ - HTTP 处理
    └── response/ - 统一响应
```

---

## 八、举一反三

| 本文学到 | 可应用到 | 示例 |
|----------|---------|------|
| 三层架构 | 任何后端项目 | Node.js、Java Spring、Python Django |
| 接口依赖注入 | 微服务设计 | 替换外部服务实现（支付、通知） |
| Mock 测试 | 所有业务逻辑测试 | 用户注册、订单处理、权限校验 |
| DTO 模式 | 前后端数据隔离 | 请求输入、API 响应、内部传输 |
| RegisterRoutes | 路由注册模式 | 版本化 API、模块化路由 |

---

## 九、参考资料

- [Go 依赖注入](https://go.dev/doc/modules/layout)
- [Google Wire](https://github.com/google/wire)
- [Uber Dig](https://github.com/uber-go/dig)
- [Clean Architecture in Go](https://blog.cleancoder.com/uncle-bob/2012/08/08/the-clean-architecture.html)

---

## 十、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| **v1** | 手动 DI + 三层分离 + 接口定义 | 中小型项目 |
| **v2** | Mock 测试 + 单元测试覆盖 | 追求代码质量的项目 |
| **v3** | 多 Service 协作 + 事件系统 | 大型项目、微服务 |
