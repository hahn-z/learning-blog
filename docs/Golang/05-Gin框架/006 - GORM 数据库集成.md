---
title: "006 - GORM 数据库集成"
slug: "006-gin-gorm"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T22:58:06.928+08:00"
updated_at: "2026-04-29T10:02:45.602+08:00"
reading_time: 27
tags: []
---

# 006 - GORM 数据库集成

> **难度标注：** ⭐⭐⭐（中级）
>
> **前置知识：** Go 基础、Gin 路由、SQL 基本概念
>
> **学习目标：** 掌握 GORM 安装配置、连接管理、CRUD 操作、链式调用与错误处理

---

## 一、概念讲解

**GORM** 是 Go 语言最流行的 ORM（Object-Relational Mapping）库。它的核心思想是：**用 Go 的结构体（struct）来映射数据库表，用方法调用来替代 SQL 语句**。

### 为什么需要 ORM？

| 方式 | 代码示例 | 问题 |
|------|---------|------|
| 原生 SQL | `db.Query("SELECT * FROM users WHERE id = ?", id)` | SQL 拼接易出错、类型不安全 |
| GORM | `db.Where("id = ?", id).First(&user)` | 类型安全、链式调用、自动映射 |

### GORM 核心特性

- **全功能 ORM**：CRUD、关联、预加载、事务、迁移、SQL 构建器
- **链式 API**：`db.Where().Order().Limit().Find()`
- **钩子（Hooks）**：BeforeCreate、AfterUpdate 等生命周期回调
- **多数据库支持**：MySQL、PostgreSQL、SQLite、SQL Server
- **自动迁移**：根据 struct 定义自动创建/更新表结构

---

## 二、脑图（ASCII）

```
                    GORM 数据库集成
                         │
          ┌──────────────┼──────────────┐
          │              │              │
      安装配置       CRUD操作        高级特性
          │              │              │
     ┌────┴────┐    ┌────┼────┐    ┌───┴────┐
     │         │    │    │    │    │        │
  MySQL    SQLite  C   R   U   D  链式   错误处理
     │         │    │    │    │    │ 调用      │
  连接池   文件DB  Create Find Update Delete  日志模式
```

---

## 三、完整 Go 代码

### v1：基础连接 + SQLite CRUD

```go
// main.go - GORM basic CRUD with SQLite
package main

import (
	"fmt"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// User model maps to "users" table
type User struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `gorm:"size:100;not null" json:"name"`
	Email string `gorm:"size:255;uniqueIndex" json:"email"`
	Age  int    `json:"age"`
}

func main() {
	// Connect to SQLite (file-based)
	db, err := gorm.Open(sqlite.Open("test.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info), // Log all SQL
	})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
	}

	// Auto migrate the schema
	db.AutoMigrate(&User{})

	// --- CREATE ---
	user := User{Name: "Alice", Email: "alice@example.com", Age: 25}
	result := db.Create(&user) // Insert one record
	fmt.Printf("Created: ID=%d, RowsAffected=%d\n", user.ID, result.RowsAffected)

	// Batch create
	users := []User{
		{Name: "Bob", Email: "bob@example.com", Age: 30},
		{Name: "Charlie", Email: "charlie@example.com", Age: 28},
	}
	db.Create(&users)

	// --- READ ---
	var foundUser User
	db.First(&foundUser, 1) // Find by primary key
	fmt.Printf("Found: %+v\n", foundUser)

	var allUsers []User
	db.Find(&allUsers) // Find all
	fmt.Printf("Total users: %d\n", len(allUsers))

	// Query with conditions
	var adults []User
	db.Where("age >= ?", 25).Find(&adults)
	fmt.Printf("Adults: %d\n", len(adults))

	// --- UPDATE ---
	db.Model(&foundUser).Update("Age", 26) // Update single field
	db.Model(&foundUser).Updates(User{Age: 27, Name: "Alice Updated"}) // Update multiple fields

	// --- DELETE ---
	db.Delete(&User{}, 2) // Delete by ID (Bob)
	fmt.Println("Deleted user with ID=2")
}
```

**执行预览：**

```
$ go run main.go
// SQL logs will show:
// CREATE TABLE `users` ...
// INSERT INTO `users` ...
Created: ID=1, RowsAffected=1
Found: {ID:1 Name:Alice Email:alice@example.com Age:25}
Total users: 3
Adults: 3
Deleted user with ID=2
```

### v2：MySQL 连接 + 连接池 + Gin 集成

```go
// main.go - GORM + MySQL + Gin integration
package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Email     string    `gorm:"size:255;uniqueIndex" json:"email"`
	Age       int       `json:"age"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var db *gorm.DB

func initDB() {
	dsn := "root:password@tcp(127.0.0.1:3306)/myapp?charset=utf8mb4&parseTime=True&loc=Local"
	var err error
	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn), // Only log warnings and above
	})
	if err != nil {
		log.Fatal("Failed to connect MySQL:", err)
	}

	// Configure connection pool
	sqlDB, _ := db.DB()
	sqlDB.SetMaxIdleConns(10)           // Max idle connections
	sqlDB.SetMaxOpenConns(100)          // Max open connections
	sqlDB.SetConnMaxLifetime(time.Hour) // Connection max lifetime

	db.AutoMigrate(&User{})
}

func main() {
	initDB()
	r := gin.Default()

	// CRUD endpoints
	r.GET("/users", listUsers)
	r.GET("/users/:id", getUser)
	r.POST("/users", createUser)
	r.PUT("/users/:id", updateUser)
	r.DELETE("/users/:id", deleteUser)

	r.Run(":8080")
}

func listUsers(c *gin.Context) {
	var users []User
	if err := db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func getUser(c *gin.Context) {
	var user User
	if err := db.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func createUser(c *gin.Context) {
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func updateUser(c *gin.Context) {
	var user User
	if err := db.First(&user, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	db.Save(&user)
	c.JSON(http.StatusOK, user)
}

func deleteUser(c *gin.Context) {
	db.Delete(&User{}, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
```

### v3：链式调用 + 高级查询 + 错误处理封装

```go
// repository/user_repo.go - Encapsulated GORM operations
package repository

import (
	"errors"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// QueryParams holds common query parameters
type QueryParams struct {
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
	Search   string `form:"search"`
	OrderBy  string `form:"order_by"`
	Order    string `form:"order"` // "asc" or "desc"
}

// List with pagination, search, and sorting (chain calls)
func (r *UserRepository) List(params QueryParams) ([]User, int64, error) {
	var users []User
	var total int64

	query := r.db.Model(&User{})

	// Search condition (chain call)
	if params.Search != "" {
		query = query.Where("name LIKE ? OR email LIKE ?",
			"%"+params.Search+"%", "%"+params.Search+"%")
	}

	// Count total before pagination
	query.Count(&total)

	// Sorting
	if params.OrderBy != "" {
		order := "asc"
		if params.Order == "desc" {
			order = "desc"
		}
		query = query.Order(params.OrderBy + " " + order)
	}

	// Pagination with default values
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 10
	}
	offset := (params.Page - 1) * params.PageSize

	// Execute query
	if err := query.Offset(offset).Limit(params.PageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// Create with error wrapping
func (r *UserRepository) Create(user *User) error {
	result := r.db.Create(user)
	if result.Error != nil {
		// Check for duplicate key (MySQL error 1062)
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return errors.New("email already exists")
		}
		return result.Error
	}
	return nil
}

// GetByID returns ErrRecordNotFound wrapped
func (r *UserRepository) GetByID(id uint) (*User, error) {
	var user User
	if err := r.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}
```

---

## 四、注意事项

| 项目 | 说明 | 建议 |
|------|------|------|
| 连接池 | 默认无上限，可能耗尽数据库连接 | 生产环境必须设置 MaxOpenConns |
| 日志模式 | `logger.Info` 会打印所有 SQL | 生产用 `logger.Warn`，开发用 `logger.Info` |
| 错误检查 | GORM 链式调用不会 panic | 必须检查 `.Error` 或 `result.Error` |
| 连接关闭 | `gorm.Open` 后记得关闭 `sqlDB.Close()` | 程序退出前调用 `db.DB().Close()` |
| 零值问题 | `Update("age", 0)` 不会更新零值 | 用 `Select("age")` 显式指定或用 map |
| parseTime | MySQL DSN 必须加 `parseTime=True` | 否则 time.Time 字段会报错 |

---

## 五、避坑指南

### ❌ 不检查错误
```go
db.Create(&user)
// If error occurs, you'll never know
```
### ✅ 始终检查 Error
```go
if err := db.Create(&user).Error; err != nil {
    log.Fatal(err)
}
```

### ❌ 直接拼接 SQL
```go
db.Where("name = '" + name + "'")
// SQL injection vulnerability!
```
### ✅ 使用参数化查询
```go
db.Where("name = ?", name)
```

### ❌ 忽略零值更新
```go
db.Model(&user).Updates(User{Age: 0, Name: "Alice"})
// Age: 0 will NOT be updated!
```
### ✅ 使用 Select 或 map
```go
db.Model(&user).Select("Age", "Name").Updates(User{Age: 0, Name: "Alice"})
// Or use map:
db.Model(&user).Updates(map[string]interface{}{"age": 0, "name": "Alice"})
```

### ❌ 忘记关闭数据库连接
```go
db, _ := gorm.Open(...)
// sqlDB leaks
```
### ✅ 程序退出时关闭
```go
db, _ := gorm.Open(...)
defer func() {
    sqlDB, _ := db.DB()
    sqlDB.Close()
}()
```

---

## 六、练习题

### 🟢 初级
1. 使用 GORM + SQLite 创建一个 `Product` 模型（Name, Price, Stock），并实现基本的 Create 和 Find 操作。
2. 配置 GORM 日志模式为 `logger.Info`，观察生成的 SQL 语句。

### 🟡 中级
3. 实现一个带分页的用户列表查询（支持 page、page_size 参数）。
4. 编写一个根据邮箱查找用户的函数，处理 "记录不存在" 的情况。

### 🔴 高级
5. 封装一个通用的 `Paginate()` 作用域函数，可复用于任意模型的分页查询。
6. 实现一个带条件的批量更新：将所有 age > 30 的用户状态设为 "inactive"。

---

## 七、知识点总结

```
GORM 数据库集成
├── 安装配置
│   ├── SQLite: gorm.io/driver/sqlite
│   ├── MySQL: gorm.io/driver/mysql (DSN: user:pass@tcp(host:port)/dbname)
│   └── 连接池: SetMaxIdleConns / SetMaxOpenConns / SetConnMaxLifetime
├── CRUD 操作
│   ├── Create: db.Create(&obj) / db.Create(&slice)
│   ├── Read: db.First() / db.Find() / db.Where()
│   ├── Update: db.Update() / db.Updates() / db.Save()
│   └── Delete: db.Delete(&obj, id)
├── 链式调用
│   ├── Where / Or / Not
│   ├── Select / Omit
│   ├── Order / Limit / Offset
│   └── Joins / Preload
├── 错误处理
│   ├── result.Error
│   ├── gorm.ErrRecordNotFound
│   └── gorm.ErrDuplicatedKey
└── 日志模式
    ├── logger.Silent (无日志)
    ├── logger.Error (仅错误)
    ├── logger.Warn (警告+错误)
    └── logger.Info (全部SQL)
```

---

## 八、举一反三

| 本文学到 | 可应用到 | 示例 |
|----------|---------|------|
| GORM 连接 MySQL | 连接 PostgreSQL | `gorm.Open(postgres.Open(dsn))` |
| Where 条件查询 | 多条件动态查询 | 根据 filter 参数动态拼接链式调用 |
| 连接池配置 | 任何高并发场景 | API 服务、Worker、爬虫 |
| 错误处理模式 | 统一错误响应 | 封装 `HandleDBError(err)` 工具函数 |
| 零值更新技巧 | 所有 struct 更新 | 配置表、状态更新 |

---

## 九、参考资料

- [GORM 官方文档](https://gorm.io/docs/)
- [GORM 中文文档](https://gorm.io/zh_CN/docs/)
- [Gin + GORM 示例项目](https://github.com/go-gorm/gorm#quick-start)
- [Go database/sql 连接池](https://golang.org/pkg/database/sql/)

---

## 十、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|---------|
| **v1** | SQLite + 基础 CRUD | 快速原型、学习、测试 |
| **v2** | MySQL + 连接池 + Gin API | 生产级单文件服务 |
| **v3** | Repository 封装 + 链式查询 + 错误处理 | 多人协作、大型项目 |
