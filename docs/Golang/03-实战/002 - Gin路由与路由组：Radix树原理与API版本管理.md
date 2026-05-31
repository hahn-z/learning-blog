---
title: "002 - Gin路由与路由组：Radix树原理与API版本管理"
slug: "002-gin-router"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.215+08:00"
updated_at: "2026-04-29T10:02:44.9+08:00"
reading_time: 18
tags: ["Web开发"]
---

## 难度标注

> 🟡 中级 | 需要掌握 Gin 基础用法，了解 RESTful API 设计

## 概念讲解

Gin 的路由基于 **httprouter**，底层使用 **Radix 树**（压缩前缀树）实现，路由查找时间复杂度为 O(k)，k 为路径长度。

**路由类型：**
- **静态路由**：`/users/profile` — 精确匹配
- **参数路由**：`/users/:id` — 捕获路径段
- **通配路由**：`/files/*filepath` — 捕获剩余路径

**路由组（RouterGroup）** 是 Gin 的核心组织机制：
- 共享前缀路径
- 共享中间件
- 支持嵌套组合

**Radix 树原理简述：**
Gin 启动时将所有路由构建成一棵 Radix 树。请求到来时，从根节点按路径逐字符匹配，时间复杂度与路由数量无关，只与路径长度有关。

## 脑图

```
Gin 路由与路由组
├── 路由类型
│   ├── 静态路由 /hello
│   ├── 参数路由 /users/:id
│   └── 通配路由 /static/*filepath
├── 路由组
│   ├── 创建 r.Group("/api")
│   ├── 嵌套 v1.Group("/admin")
│   ├── 共享中间件
│   └── 共享前缀
├── 路由特性
│   ├── NoRoute 处理
│   ├── NoMethod 处理
│   ├── 重定向
│   └── 路由冲突检测
└── 底层原理
    ├── Radix 树
    ├── O(k) 查找
    └── 路由优先级
```

## 完整 Go 代码

```go
package main

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// ============================================
	// 1. Static routes
	// ============================================
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Welcome!"})
	})

	// ============================================
	// 2. Parameterized routes
	// ============================================
	// /users/:id - captures a single path segment
	r.GET("/users/:id", func(c *gin.Context) {
		id := c.Param("id") // e.g. "42"
		c.JSON(http.StatusOK, gin.H{"user_id": id})
	})

	// Multiple parameters
	r.GET("/users/:uid/posts/:pid", func(c *gin.Context) {
		uid := c.Param("uid")
		pid := c.Param("pid")
		c.JSON(http.StatusOK, gin.H{"user_id": uid, "post_id": pid})
	})

	// ============================================
	// 3. Wildcard routes (catch-all)
	// ============================================
	// /files/*filepath captures everything after /files/
	r.GET("/files/*filepath", func(c *gin.Context) {
		fp := c.Param("filepath") // starts with "/"
		c.JSON(http.StatusOK, gin.H{"filepath": fp})
	})

	// ============================================
	// 4. Router groups - API versioning
	// ============================================
	// Public API
	api := r.Group("/api")
	{
		// v1 endpoints
		v1 := api.Group("/v1")
		{
			v1.GET("/products", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"version": "v1",
					"products": []string{"Apple", "Banana"},
				})
			})
			v1.GET("/products/:id", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"version": "v1",
					"product_id": c.Param("id"),
				})
			})
		}

		// v2 endpoints (new schema)
		v2 := api.Group("/v2")
		{
			v2.GET("/products", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"version": "v2",
					"data": []map[string]any{
						{"id": 1, "name": "Apple", "price": 3.5},
						{"id": 2, "name": "Banana", "price": 2.8},
					},
				})
			})
		}
	}

	// ============================================
	// 5. Group with middleware
	// ============================================
	auth := r.Group("/admin")
	auth.Use(authRequired())
	{
		auth.GET("/dashboard", func(c *gin.Context) {
			user := c.GetString("user")
			c.JSON(http.StatusOK, gin.H{"dashboard": user})
		})

		// Nested group
		settings := auth.Group("/settings")
		{
			settings.GET("/", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"settings": "all"})
			})
			settings.GET("/:key", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"key":   c.Param("key"),
					"value": "demo",
				})
			})
		}
	}

	// ============================================
	// 6. NoRoute and NoMethod handlers
	// ============================================
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "not found",
			"path":    c.Request.URL.Path,
			"method":  c.Request.Method,
		})
	})

	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error": "method not allowed",
		})
	})

	// Enable HandleMethodNotFoundError
	r.HandleMethodNotAllowed = true

	r.Run(":8080")
}

// authRequired is a simple auth middleware for demo.
func authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" || !strings.HasPrefix(token, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "authorization required",
			})
			return
		}
		// Extract user from token (simplified)
		c.Set("user", strings.TrimPrefix(token, "Bearer "))
		c.Next()
	}
}
```

## 执行预览

```bash
$ go run main.go

# 静态路由
$ curl localhost:8080/
{"message":"Welcome!"}

# 参数路由
$ curl localhost:8080/users/42
{"user_id":"42"}

$ curl localhost:8080/users/5/posts/100
{"post_id":"100","user_id":"5"}

# 通配路由
$ curl localhost:8080/files/docs/readme.md
{"filepath":"/docs/readme.md"}

# API 版本
$ curl localhost:8080/api/v1/products
{"products":["Apple","Banana"],"version":"v1"}

$ curl localhost:8080/api/v2/products
{"data":[{"id":1,"name":"Apple","price":3.5},{"id":2,"name":"Banana","price":2.8}],"version":"v2"}

# 带中间件的路由组
$ curl localhost:8080/admin/dashboard
{"error":"authorization required"}

$ curl -H "Authorization: Bearer admin" localhost:8080/admin/dashboard
{"dashboard":"admin"}

# 404 处理
$ curl localhost:8080/nonexistent
{"error":"not found","method":"GET","path":"/nonexistent"}
```

## 注意事项

| 项目 | 说明 |
|------|------|
| 路由冲突 | `:id` 和 `/*name` 不能在同一层级，Gin 启动时会 panic |
| 参数获取 | `c.Param()` 返回的是字符串，需手动转换类型 |
| 通配符 | `*filepath` 只能放在路径末尾，匹配值带前导 `/` |
| 路由注册 | 路由必须在 `r.Run()` 之前注册，之后注册无效 |
| 路由组 | `Group()` 返回的 `*RouterGroup` 可嵌套 |
| 方法匹配 | `r.Handle("GET", ...)` 等价于 `r.GET(...)` |

## 避坑指南

- ❌ 在同一层级混用 `:id` 和 `new`
- ✅ 把特殊路径放在参数路由之前，或用不同前缀区分

- ❌ `c.Param("id")` 不做校验直接用
- ✅ 使用 `strconv.Atoi()` 或正则校验参数格式

- ❌ 路由组嵌套过深（5层以上）
- ✅ 控制在 2-3 层，必要时拆分注册函数

- ❌ 忘记设置 `HandleMethodNotAllowed = true`
- ✅ 需要 405 响应时手动开启

## 练习题

🟢 **基础：** 创建路由 `/hello/:name`，返回 JSON `{"greeting": "Hello, {name}!"}`

🟡 **进阶：** 设计一个博客 API 路由结构：`/api/v1/posts`、`/api/v1/posts/:id/comments`、`/api/v1/admin/*`（需要认证中间件）

🔴 **挑战：** 实现一个支持多版本 API 共存的路由系统，v1 和 v2 共用数据库但响应格式不同，支持通过 Header `Accept-Version` 选择版本。

## 知识点总结

```
路由知识树
├── 路由注册
│   ├── r.GET/POST/PUT/DELETE/PATCH/OPTIONS
│   ├── r.Any(path, handlers) → 匹配所有方法
│   └── r.Handle(method, path, handlers)
├── 参数类型
│   ├── c.Param("id") → /:id 路径参数
│   ├── c.Query("key") → ?key=value 查询参数
│   ├── c.DefaultQuery("key", "default")
│   └── c.GetHeader("Authorization")
├── 路由组
│   ├── r.Group("/prefix") → 创建组
│   ├── group.Use(middleware) → 添加中间件
│   └── 嵌套 group.Group("/sub")
├── 错误处理
│   ├── r.NoRoute(handler) → 404
│   └── r.NoMethod(handler) → 405
└── 底层原理
    ├── Radix 树存储路由
    ├── 路由优先级：静态 > 参数 > 通配
    └── 启动时构建，运行时查找 O(k)
```

## 举一反三

| 场景 | 方案 | 示例 |
|------|------|------|
| API 版本管理 | 路由组前缀 | `/api/v1` vs `/api/v2` |
| 认证区域 | 路由组 + 中间件 | `/admin` 组要求 Bearer Token |
| 多租户 | 路径参数 | `/tenants/:tid/resources` |
| 静态文件服务 | 通配路由或 `r.Static()` | `/static/*filepath` |
| 优雅降级 | 版本路由共存 | v1 deprecated 但仍可用 |

## 参考资料

- [Gin Routing 官方文档](https://gin-gonic.com/docs/examples/routing/)
- [httprouter 路由原理](https://github.com/julienschmidt/httprouter)
- [RESTful API 设计指南](https://restfulapi.net/)
- [Radix Tree 数据结构](https://en.wikipedia.org/wiki/Radix_tree)

## 代码演进

**v1 — 基础路由：**
```go
r := gin.Default()
r.GET("/users/:id", getUser)
r.Run()
```

**v2 — 添加路由组和版本：**
```go
api := r.Group("/api")
v1 := api.Group("/v1")
v1.GET("/users/:id", getUser)
```

**v3 — 完整路由架构（如上方代码）：**
- 路由组嵌套
- 中间件绑定
- NoRoute/NoMethod 处理
- 通配路由
