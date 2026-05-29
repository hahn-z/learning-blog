---
title: "002-路由详解：从基础到RESTful"
slug: "002-gin-routing"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T22:57:26.573+08:00"
updated_at: "2026-04-29T10:02:45.572+08:00"
reading_time: 28
tags: []
---

# 路由详解：从基础到RESTful

> **难度：⭐⭐ 进阶级** | 预计阅读：25分钟 | 适合：已掌握Gin基础，需要系统理解路由机制的开发者

## 一、概念讲解

### 1.1 Gin路由底层原理

Gin使用**基数树(Radix Tree)**实现路由匹配。启动时，所有路由规则被构建成一棵树：

```
注册路由：
GET /users
GET /users/:id
GET /users/:id/posts
GET /users/:id/posts/:postId

基数树结构：
/users
  ├─ (exact match) → handler
  ├─ /:id
  │    ├─ (param match) → handler
  │    └─ /posts
  │         ├─ (exact match) → handler
  │         └─ /:postId → handler
```

匹配时从根节点沿树向下查找，**一次遍历即可确定目标**，不回溯，性能极高。

### 1.2 路由参数 vs 查询参数

| 类型 | 示例 | 获取方式 | 用途 |
|------|------|---------|------|
| 路径参数 | `/users/123` | `c.Param("id")` | 标识资源 |
| 查询参数 | `/users?role=admin` | `c.Query("role")` | 过滤/分页 |
| 表单参数 | `POST form data` | `c.PostForm("name")` | 提交数据 |

**RESTful约定：** 路径参数标识资源，查询参数控制展示。

## 二、脑图

```
Gin路由体系
├── 基础路由
│   ├── GET/POST/PUT/DELETE/PATCH
│   ├── Any (匹配所有方法)
│   └── Handle (指定方法)
├── 参数类型
│   ├── 路径参数 c.Param()
│   ├── 查询参数 c.Query()/c.DefaultQuery()
│   ├── 表单参数 c.PostForm()
│   └── 数组参数 c.QueryArray()
├── 路由分组
│   ├── Group() 前缀分组
│   ├── 嵌套分组
│   └── 分组级中间件
├── 特殊处理
│   ├── NoRoute (404处理)
│   ├── NoMethod (405处理)
│   └── Static (静态文件)
└── RESTful规范
    ├── 资源命名(名词复数)
    ├── HTTP方法语义
    └── 状态码选择
```

## 三、完整代码

### 3.1 HTTP方法与路径参数

```go
package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    // Basic CRUD routes for a "users" resource
    r.GET("/users", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"action": "list all users"})
    })

    r.GET("/users/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(http.StatusOK, gin.H{"action": "get user", "id": id})
    })

    r.POST("/users", func(c *gin.Context) {
        c.JSON(http.StatusCreated, gin.H{"action": "create user"})
    })

    r.PUT("/users/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(http.StatusOK, gin.H{"action": "update user", "id": id})
    })

    r.DELETE("/users/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(http.StatusOK, gin.H{"action": "delete user", "id": id})
    })

    // PATCH for partial update
    r.PATCH("/users/:id", func(c *gin.Context) {
        id := c.Param("id")
        c.JSON(http.StatusOK, gin.H{"action": "partial update user", "id": id})
    })

    r.Run(":8080")
}
```

### 3.2 查询参数与数组参数

```go
// Query parameters demo
r.GET("/search", func(c *gin.Context) {
    // Single value
    q := c.Query("q")               // Get query param, returns "" if missing
    page := c.DefaultQuery("page", "1") // Get with default value
    
    // Array values: ?tags=go&tags=gin
    tags := c.QueryArray("tags")
    
    // Map values: ?filter[status]=active&filter[role]=admin
    filters := c.QueryMap("filter")
    
    c.JSON(http.StatusOK, gin.H{
        "query":   q,
        "page":    page,
        "tags":    tags,
        "filters": filters,
    })
})
```

### 3.3 路由分组

```go
func main() {
    r := gin.Default()
    
    // API v1 group
    v1 := r.Group("/api/v1")
    {
        // /api/v1/users
        v1.GET("/users", listUsers)
        v1.POST("/users", createUser)
        v1.GET("/users/:id", getUser)
        
        // Nested group: /api/v1/admin/*
        admin := v1.Group("/admin")
        admin.Use(AuthMiddleware()) // Group-level middleware
        {
            admin.GET("/dashboard", adminDashboard)
            admin.GET("/settings", adminSettings)
        }
    }
    
    // API v2 group
    v2 := r.Group("/api/v2")
    {
        v2.GET("/users", listUsersV2)
    }
    
    r.Run(":8080")
}
```

### 3.4 NoRoute、NoMethod与Any

```go
func main() {
    r := gin.Default()
    
    // Handle 404 - No matching route
    r.NoRoute(func(c *gin.Context) {
        c.JSON(http.StatusNotFound, gin.H{
            "code":    404,
            "message": "Route not found",
            "path":    c.Request.URL.Path,
        })
    })
    
    // Handle 405 - Method not allowed
    r.NoMethod(func(c *gin.Context) {
        c.JSON(http.StatusMethodNotAllowed, gin.H{
            "code":    405,
            "message": "Method not allowed",
        })
    })
    
    // Match ALL HTTP methods for a path
    r.Any("/ping", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "method": c.Request.Method,
            "message": "pong from Any",
        })
    })
    
    // Explicitly register with Handle
    r.Handle("GET", "/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "healthy"})
    })
    
    r.Run(":8080")
}
```

### 3.5 静态文件服务

```go
// Serve static files
r.Static("/assets", "./public")           // Map directory
r.StaticFile("/favicon.ico", "./favicon.ico") // Single file
r.StaticFS("/docs", gin.Dir("./swagger", false)) // File system
```

## 四、执行预览

```bash
# GET list
$ curl http://localhost:8080/users
{"action":"list all users"}

# GET single with path param
$ curl http://localhost:8080/users/42
{"action":"get user","id":"42"}

# POST create
$ curl -X POST http://localhost:8080/users
{"action":"create user"}

# PUT update
$ curl -X PUT http://localhost:8080/users/42
{"action":"update user","id":"42"}

# DELETE
$ curl -X DELETE http://localhost:8080/users/42
{"action":"delete user","id":"42"}

# Query params
$ curl "http://localhost:8080/search?q=gin&tags=go&tags=web&filter[status]=active"
{"filters":{"role":"","status":"active"},"page":"1","query":"gin","tags":["go","web"]}

# 404 handling
$ curl http://localhost:8080/nonexistent
{"code":404,"message":"Route not found","path":"/nonexistent"}
```

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 参数冲突 | `:id`和`:name`不能同时存在同一层级 | 同一层级只使用一种参数名 |
| 尾斜杠 | `/users`和`/users/`是不同路由 | 统一风格，建议不带尾斜杠 |
| 路由注册顺序 | 注册顺序不影响匹配，基数树自动优化 | 但NoRoute必须放在最后 |
| 参数获取 | `c.Param()`返回值带前缀`/`，需要`strings.Trim` | 或直接用，Gin内部已处理 |
| 大小写 | 路由路径大小写敏感 | `/Users` ≠ `/users` |

## 六、避坑指南

### ❌ 路由参数冲突
```go
// Bad: Panic at startup!
r.GET("/users/:id", getUser)
r.GET("/users/:name", getByName) // Conflict: :id and :name at same level
```
### ✅ 用不同路径或查询参数
```go
r.GET("/users/:id", getUser)           // By ID
r.GET("/users/search", searchByName)   // Search endpoint with query param
// Query: /users/search?name=alice
```

### ❌ PUT当PATCH用
```go
// Bad: PUT should replace the entire resource
r.PUT("/users/:id", func(c *gin.Context) {
    // Only updating one field... but it's PUT
    c.JSON(200, gin.H{"updated": "email only"})
})
```
### ✅ 区分PUT和PATCH语义
```go
// PUT: Full replacement (client sends complete resource)
r.PUT("/users/:id", replaceUser)

// PATCH: Partial update (client sends only changed fields)
r.PATCH("/users/:id", partialUpdateUser)
```

### ❌ 查询参数不做校验
```go
// Bad: page could be "abc", will cause issues downstream
page := c.Query("page")
pageNum, _ := strconv.Atoi(page) // Silently ignores error
```
### ✅ 校验并提供默认值
```go
page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
if err != nil || page < 1 {
    c.JSON(400, gin.H{"error": "invalid page parameter"})
    return
}
```

## 七、练习题

### 🟢 初级：基础CRUD路由
1. 实现一套完整的`/articles` CRUD路由（GET/POST/PUT/DELETE）
2. 为`/articles/:id`路径参数添加数字校验

### 🟡 中级：路由分组与中间件
3. 创建`/api/v1`和`/api/v2`两个分组，v1返回旧格式数据，v2返回新格式
4. 为`/admin`分组添加认证中间件，未认证返回401

### 🔴 高级：RESTful API设计
5. 设计一个博客系统的完整路由表：用户、文章、评论、标签，符合RESTful规范，输出路由表格

## 八、知识点总结

```
Gin路由知识树
├── 路由注册
│   ├── r.GET/POST/PUT/DELETE/PATCH
│   ├── r.Any()
│   └── r.Handle(method, path, handlers)
├── 参数获取
│   ├── c.Param("key")        → 路径参数
│   ├── c.Query("key")        → 查询参数
│   ├── c.DefaultQuery(k, v)  → 带默认值
│   ├── c.QueryArray("key")   → 数组参数
│   └── c.QueryMap("key")     → Map参数
├── 路由分组
│   ├── r.Group("/prefix")
│   ├── 嵌套分组
│   └── 分组.Use() 挂中间件
├── 特殊处理
│   ├── NoRoute → 404
│   ├── NoMethod → 405
│   └── Static/StaticFile
└── RESTful规范
    ├── 资源用名词复数
    ├── GET=查 POST=建 PUT=改 DELETE=删
    └── 正确使用状态码
```

## 九、举一反三

| Gin路由模式 | 其他框架写法 | 关键差异 |
|------------|------------|---------|
| `r.GET("/users/:id", h)` | Echo: `e.GET("/users/:id", h)` | 几乎一样 |
| `r.Group("/api/v1")` | Chi: `r.Route("/api/v1", ...)` | Chi用回调嵌套 |
| `c.Param("id")` | Fiber: `c.Params("id")` | Fiber多一个s |
| `c.DefaultQuery("page","1")` | Echo:没有，需自己判断 | Gin更方便 |
| `r.NoRoute(handler)` | Chi: `r.NotFound(handler)` | 功能相同，命名不同 |

## 十、参考资料

- [Gin路由官方文档](https://gin-gonic.com/docs/examples/routing/)
- [RESTful API设计指南](https://restfulapi.net/)
- [HTTP方法语义RFC](https://www.rfc-editor.org/rfc/rfc9110)

## 十一、代码演进

### v1: 基础路由
```go
r := gin.Default()
r.GET("/users", listUsers)
r.GET("/users/:id", getUser)
r.POST("/users", createUser)
r.Run()
```

### v2: 分组+特殊处理
```go
r := gin.Default()
api := r.Group("/api")
api.GET("/users", listUsers)
api.GET("/users/:id", getUser)

r.NoRoute(func(c *gin.Context) {
    c.JSON(404, gin.H{"error": "not found"})
})
r.Run()
```

### v3: 完整RESTful API路由器
```go
package main

import (
    "net/http"
    "strconv"
    "github.com/gin-gonic/gin"
)

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

// Simulated database
var users = []User{{ID: 1, Name: "Alice"}, {ID: 2, Name: "Bob"}}
var nextID = 3

func listUsers(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"data": users, "total": len(users)})
}

func getUser(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
        return
    }
    for _, u := range users {
        if u.ID == id {
            c.JSON(http.StatusOK, gin.H{"data": u})
            return
        }
    }
    c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
}

func createUser(c *gin.Context) {
    var input struct {
        Name string `json:"name" binding:"required"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    user := User{ID: nextID, Name: input.Name}
    nextID++
    users = append(users, user)
    c.JSON(http.StatusCreated, gin.H{"data": user})
}

func updateUser(c *gin.Context) {
    id, _ := strconv.Atoi(c.Param("id"))
    var input struct {
        Name string `json:"name" binding:"required"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    for i, u := range users {
        if u.ID == id {
            users[i].Name = input.Name
            c.JSON(http.StatusOK, gin.H{"data": users[i]})
            return
        }
    }
    c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
}

func deleteUser(c *gin.Context) {
    id, _ := strconv.Atoi(c.Param("id"))
    for i, u := range users {
        if u.ID == id {
            users = append(users[:i], users[i+1:]...)
            c.JSON(http.StatusOK, gin.H{"message": "deleted"})
            return
        }
    }
    c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
}

func main() {
    gin.SetMode(gin.ReleaseMode)
    r := gin.Default()

    api := r.Group("/api/v1")
    {
        api.GET("/users", listUsers)
        api.GET("/users/:id", getUser)
        api.POST("/users", createUser)
        api.PUT("/users/:id", updateUser)
        api.DELETE("/users/:id", deleteUser)
    }

    r.NoRoute(func(c *gin.Context) {
        c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "Not found"})
    })

    r.Run(":8080")
}
```

---

*上一篇：[Gin框架简介与环境搭建](/posts/001-gin-intro) | 下一篇：[中间件：洋葱模型与请求拦截](/posts/003-gin-middleware) →*
