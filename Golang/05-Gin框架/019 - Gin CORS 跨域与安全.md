---
title: "019 - Gin CORS 跨域与安全"
slug: "019-gin-cors"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:13:29.389+08:00"
updated_at: "2026-04-29T10:02:45.733+08:00"
reading_time: 31
tags: []
---

# 019 - Gin CORS 跨域与安全

> **难度：⭐⭐⭐** | **预计阅读：15 分钟**
>
> 理解 CORS 原理，在 Gin 中配置跨域中间件，以及 Web 安全头部、输入验证、SQL 注入防护等安全最佳实践。

---

## 一、概念讲解

### CORS（跨域资源共享）

浏览器同源策略限制了不同源之间的 HTTP 请求。CORS 是一组 HTTP 头部，告诉浏览器允许哪些跨域请求。

**同源 = 协议 + 域名 + 端口 都相同**

```
https://example.com:443 → https://api.example.com:443  ❌ 不同域
https://example.com      → https://example.com:8080     ❌ 不同端口
https://example.com      → https://example.com          ✅ 同源
```

**CORS 流程：**

```
简单请求:
  Browser → Request (Origin header) → Server
  Server → Response (Access-Control-Allow-Origin) → Browser ✓

预检请求 (Preflight):
  Browser → OPTIONS request → Server
  Server → 200 + CORS headers → Browser
  Browser → Actual Request → Server → Response → Browser ✓
```

---

## 二、脑图

```
CORS 跨域与安全
├── CORS
│   ├── 简单请求 vs 预检请求
│   ├── Access-Control-* 头部
│   └── gin-contrib/cors 中间件
├── 安全头部
│   ├── X-XSS-Protection
│   ├── X-Content-Type-Options
│   ├── X-Frame-Options
│   ├── Content-Security-Policy
│   └── Strict-Transport-Security
├── 输入安全
│   ├── 参数验证 (binding)
│   ├── SQL 注入防护
│   └── XSS 防护
└── HTTPS
    ├── TLS 配置
    └── 自动证书 (Let's Encrypt)
```

---

## 三、完整代码

### v1：手动 CORS 中间件

```go
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware handles cross-origin requests
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Allowed origins whitelist
		allowed := map[string]bool{
			"http://localhost:3000": true,
			"http://localhost:5173": true,
			"https://example.com":   true,
		}

		if allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		// Handle preflight
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func main() {
	r := gin.Default()
	r.Use(CORSMiddleware())

	r.GET("/api/data", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "data"})
	})

	r.Run(":8080")
}
```

### v2：gin-contrib/cors + 安全头部中间件

```go
package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds common security headers
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")
		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")
		// Enable XSS filter in browsers
		c.Header("X-XSS-Protection", "1; mode=block")
		// HSTS: force HTTPS (only enable with HTTPS)
		// c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// Content Security Policy
		c.Header("Content-Security-Policy", "default-src 'self'")
		// Referrer Policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}

func setupCORS() gin.HandlerFunc {
	config := cors.Config{
		AllowOrigins: []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"https://example.com",
		},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{
			"Origin", "Content-Type", "Accept",
			"Authorization", "X-Requested-With",
		},
		ExposeHeaders:    []string{"Content-Length", "X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	return cors.New(config)
}

// InputValidationMiddleware demonstrates input sanitization
func InputValidationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check Content-Type for POST/PUT
		if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodPut {
			ct := c.ContentType()
			if !strings.HasPrefix(ct, "application/json") &&
				!strings.HasPrefix(ct, "multipart/form-data") {
				c.JSON(http.StatusUnsupportedMediaType, gin.H{
					"error": "Content-Type must be application/json",
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// CreateUserRequest with binding validation
type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func main() {
	r := gin.Default()

	// Apply middleware
	r.Use(setupCORS())
	r.Use(SecurityHeadersMiddleware())
	r.Use(InputValidationMiddleware())

	api := r.Group("/api")
	{
		api.GET("/data", func(c *gin.Context) {
			c.JSON(200, gin.H{"data": "public data"})
		})

		api.POST("/users", func(c *gin.Context) {
			var req CreateUserRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "validation failed",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusCreated, gin.H{
				"username": req.Username,
				"email":    req.Email,
			})
		})
	}

	r.Run(":8080")
}
```

### v3：SQL 注入防护 + HTTPS + 完整安全方案

```go
package main

import (
	"database/sql"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
)

// ===== SQL Injection Prevention =====

// SafeDB wraps database operations with parameterized queries
type SafeDB struct {
	db *sql.DB
}

// GetUserByID uses parameterized query - SAFE from SQL injection
func (s *SafeDB) GetUserByID(id string) (*User, error) {
	var u User
	// ✅ Use placeholders, never concatenate user input
	err := s.db.QueryRow("SELECT id, username, email FROM users WHERE id = ?", id).Scan(&u.ID, &u.Username, &u.Email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// SearchUsers uses LIKE with parameter - SAFE
func (s *SafeDB) SearchUsers(keyword string) ([]User, error) {
	pattern := "%" + keyword + "%"
	rows, err := s.db.Query("SELECT id, username, email FROM users WHERE username LIKE ?", pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		rows.Scan(&u.ID, &u.Username, &u.Email)
		users = append(users, u)
	}
	return users, nil
}

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

// ===== Input Sanitizer =====

var htmlPattern = regexp.MustCompile(`<[^>]*>`)

// SanitizeInput removes potential XSS content
func SanitizeInput(input string) string {
	// Remove HTML tags
	cleaned := htmlPattern.ReplaceAllString(input, "")
	return strings.TrimSpace(cleaned)
}

// ===== CSRF Token Middleware =====

func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		token := c.GetHeader("X-CSRF-Token")
		cookie, err := c.Cookie("csrf_token")
		if err != nil || token == "" || token != cookie {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token mismatch"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ===== Rate Limiting for Sensitive Endpoints =====

func loginRateLimit() gin.HandlerFunc {
	type attempt struct {
		count   int
		lastTry time.Time
	}
	attempts := make(map[string]*attempt)

	return func(c *gin.Context) {
		ip := c.ClientIP()
		a, exists := attempts[ip]
		if !exists || time.Since(a.lastTry) > 15*time.Minute {
			attempts[ip] = &attempt{count: 1, lastTry: time.Now()}
			c.Next()
			return
		}
		if a.count >= 5 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many login attempts"})
			c.Abort()
			return
		}
		a.count++
		a.lastTry = time.Now()
		c.Next()
	}
}

func main() {
	// Initialize database
	db, err := sql.Open("sqlite3", "./app.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	safeDB := &SafeDB{db: db}

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://example.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Security headers
	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self'")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	})

	api := r.Group("/api")
	api.Use(CSRFMiddleware())
	{
		api.GET("/users/:id", func(c *gin.Context) {
			id := c.Param("id")
			user, err := safeDB.GetUserByID(id) // Parameterized query
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.JSON(200, user)
		})

		api.GET("/users/search", func(c *gin.Context) {
			keyword := SanitizeInput(c.Query("q"))
			users, _ := safeDB.SearchUsers(keyword) // Safe LIKE query
			c.JSON(200, users)
		})

		api.POST("/login", loginRateLimit(), func(c *gin.Context) {
			var body struct {
				Username string `json:"username" binding:"required,alphanum"`
				Password string `json:"password" binding:"required,min=8"`
			}
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(400, gin.H{"error": "invalid input"})
				return
			}
			// Login logic...
			c.JSON(200, gin.H{"token": "jwt-token"})
		})
	}

	// HTTPS with auto-generated cert (development only)
	// Production: use nginx/caddy as reverse proxy with Let's Encrypt
	log.Println("Server on :8080")
	r.Run(":8080")
}
```

---

## 四、执行预览

```bash
# CORS 预检请求
curl -X OPTIONS http://localhost:8080/api/data \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" -v
# → 204, 包含 Access-Control-Allow-Origin: http://localhost:3000

# 跨域 GET 请求
curl http://localhost:8080/api/data \
  -H "Origin: http://localhost:3000"
# → {"data":"public data"} + CORS headers

# 安全头部检查
curl -I http://localhost:8080/api/data
# → X-Content-Type-Options: nosniff
# → X-Frame-Options: DENY
# → X-XSS-Protection: 1; mode=block

# 输入验证
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"ab","email":"bad","password":"123"}'
# → {"error":"validation failed","details":"..."}
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| `AllowOrigins` | 不要用 `*` + `AllowCredentials: true`，浏览器会拒绝 |
| 预检缓存 | `MaxAge` 设置 12h 减少 OPTIONS 请求 |
| CSRF | 有 CORS 并不能替代 CSRF 防护，两者独立 |
| SQL 参数化 | 永远用 `?` 占位符，不拼接 SQL |
| HTTPS | 生产环境必须 HTTPS，HSTS 头才有效 |
| CSP | 从 `default-src 'self'` 开始，逐步放宽 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| `Access-Control-Allow-Origin: *` + Credentials | 指定具体域名白名单 |
| 不处理 OPTIONS 预检 | 中间件拦截 OPTIONS 返回 204 |
| 字符串拼接 SQL | 始终用参数化查询 `?` |
| `AllowOrigins: ["*"]` 通配 | 配置白名单 + 正则匹配 |
| 只依赖 CORS 防 XSS | CORS 只管跨域，XSS 需输入过滤 + CSP |
| 忽略 `Content-Type` 校验 | POST/PUT 强制 JSON |

---

## 七、练习题

### 🟢 入门
1. 配置 CORS 允许 `http://localhost:5173` 跨域访问
2. 添加安全头部中间件（X-Frame-Options, X-Content-Type-Options）

### 🟡 进阶
3. 实现 CSRF Token 验证中间件
4. 使用 `binding` 标签实现请求参数校验（用户名3-50字符、邮箱格式）

### 🔴 挑战
5. 实现 Content-Security-Policy 报告端点，收集 CSP 违规报告
6. 配置 HTTPS（自签名证书开发 + Let's Encrypt 生产）

---

## 八、知识点总结

```
CORS 与安全知识树
├── CORS
│   ├── 简单请求 (GET/POST, 无自定义头)
│   ├── 预检请求 (OPTIONS, 自定义头/PUT/DELETE)
│   ├── Access-Control-* 头部
│   └── gin-contrib/cors 配置
├── 安全头部
│   ├── X-Frame-Options (防点击劫持)
│   ├── X-XSS-Protection (XSS 过滤)
│   ├── Content-Security-Policy
│   ├── Strict-Transport-Security
│   └── X-Content-Type-Options
├── 输入安全
│   ├── binding 验证
│   ├── SQL 参数化
│   ├── XSS 过滤
│   └── CSRF Token
└── HTTPS
    ├── TLS 配置
    └── 反向代理 (Nginx/Caddy)
```

---

## 九、举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 前后端分离 | CORS 白名单 + Credentials | 指定前端域名 |
| 第三方 API | API Key + CORS | 不依赖 CORS 做鉴权 |
| 文件上传 | CORS + 文件类型校验 | 限制 Content-Type |
| 嵌入 iframe | X-Frame-Options SAMEORIGIN | 只允许同源嵌入 |
| 移动端 API | 不需要 CORS（非浏览器） | 但需要 API Key 鉴权 |

---

## 十、参考资料

- [gin-contrib/cors](https://github.com/gin-contrib/cors)
- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy Reference](https://content-security-policy.com/)

---

## 十一、代码演进

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| **v1** | 手动 CORS 中间件 | 学习理解原理 |
| **v2** | gin-contrib/cors + 安全头 + 输入验证 | 通用项目 |
| **v3** | 完整安全方案（SQL防护/CSRF/限流/CSP） | 生产环境 |
