---
title: "005 - JWT认证实战：Access Token + Refresh Token 双令牌方案"
slug: "005-jwt-auth"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.246+08:00"
updated_at: "2026-04-29T10:02:44.923+08:00"
reading_time: 33
tags: ["Web开发"]
---

## 难度标注

> 🔴 高级 | 需要理解 JWT 原理、Gin 中间件、Go 加密库

## 概念讲解

**JWT（JSON Web Token）** 是一种开放标准（RFC 7519），用于在各方之间安全地传输信息。JWT 由三部分组成，用 `.` 分隔：

```
Header.Payload.Signature
```

**三部分详解：**
1. **Header**：算法和类型 `{ "alg": "HS256", "typ": "JWT" }`
2. **Payload**：声明（Claims）— 用户ID、角色、过期时间等
3. **Signature**：用密钥对 Header + Payload 签名，防篡改

**认证流程：**
```
1. 用户登录 → 服务器验证凭据
2. 服务器生成 JWT → 返回给客户端
3. 客户端存储 JWT（localStorage/Cookie）
4. 后续请求携带 JWT（Authorization: Bearer <token>）
5. 服务器中间件验证 JWT → 放行或拒绝
```

**Access Token vs Refresh Token：**
- **Access Token**：短期有效（15-30分钟），用于 API 访问
- **Refresh Token**：长期有效（7-30天），用于刷新 Access Token

**Go 生态常用库：** `github.com/golang-jwt/jwt/v5`

## 脑图

```
JWT 认证实现
├── JWT 原理
│   ├── Header (算法)
│   ├── Payload (Claims)
│   ├── Signature (签名)
│   └── Base64Url 编码
├── 认证流程
│   ├── 登录 → 颁发 Token
│   ├── 请求 → 携带 Token
│   ├── 中间件 → 验证 Token
│   └── 刷新 → Renew Token
├── Go 实现
│   ├── jwt/v5 库
│   ├── SignedString() 签名
│   ├── ParseWithClaims() 验证
│   └── 自定义 Claims 结构体
├── 安全措施
│   ├── 密钥管理
│   ├── Token 过期
│   ├── 黑名单机制
│   └── HTTPS 传输
└── 实战要点
    ├── Access + Refresh 双 Token
    ├── 中间件集成
    └── 错误处理
```

## 完整 Go 代码

```go
package main

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ============================================
// Configuration
// ============================================

const (
	accessTokenSecret  = "your-access-secret-key-change-in-production"
	refreshTokenSecret = "your-refresh-secret-key-change-in-production"
	accessTokenExpiry  = 15 * time.Minute
	refreshTokenExpiry = 7 * 24 * time.Hour
	issuer             = "myapp"
)

// ============================================
// Custom Claims
// ============================================

// CustomClaims extends the standard JWT claims with user info.
type CustomClaims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// ============================================
// User model (simplified)
// ============================================

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"` // Never expose in JSON
	Role     string `json:"role"`
}

// Mock database
var users = map[string]User{
	"admin": {ID: 1, Username: "admin", Password: "admin123", Role: "admin"},
	"user":  {ID: 2, Username: "user", Password: "user123", Role: "user"},
}

// Token blacklist (in production, use Redis)
var tokenBlacklist = make(map[string]time.Time)

// ============================================
// Token generation
// ============================================

// TokenPair holds access and refresh tokens.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // seconds
}

// generateTokenPair creates both access and refresh tokens.
func generateTokenPair(user User) (*TokenPair, error) {
	now := time.Now()

	// Access token
	accessClaims := CustomClaims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   fmt.Sprintf("%d", user.ID),
			ExpiresAt: jwt.NewNumericDate(now.Add(accessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString([]byte(accessTokenSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token
	refreshClaims := CustomClaims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   fmt.Sprintf("%d", user.ID),
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        fmt.Sprintf("refresh-%d-%d", user.ID, now.Unix()), // jti for blacklist
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString([]byte(refreshTokenSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
		ExpiresIn:    int64(accessTokenExpiry.Seconds()),
	}, nil
}

// ============================================
// Token validation
// ============================================

// parseToken validates a token string and returns the claims.
func parseToken(tokenStr string, secret string) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(t *jwt.Token) (any, error) {
		// Verify signing method
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// ============================================
// Middleware
// ============================================

// AuthRequired is a middleware that validates the access token.
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing authorization header",
			})
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization format, expected: Bearer <token>",
			})
			return
		}

		tokenStr := parts[1]

		// Check blacklist
		if _, blacklisted := tokenBlacklist[tokenStr]; blacklisted {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "token has been revoked",
			})
			return
		}

		// Parse and validate
		claims, err := parseToken(tokenStr, accessTokenSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "invalid or expired token",
				"details": err.Error(),
			})
			return
		}

		// Store claims in context for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// AdminRequired is a middleware that requires admin role.
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("user_role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "admin access required",
			})
			return
		}
		c.Next()
	}
}

// ============================================
// Routes
// ============================================

func main() {
	r := gin.Default()

	// Public routes
	r.POST("/login", loginHandler)
	r.POST("/refresh", refreshHandler)

	// Protected routes
	auth := r.Group("/api")
	auth.Use(AuthRequired())
	{
		auth.GET("/profile", getProfileHandler)
		auth.POST("/logout", logoutHandler)

		// Admin only
		admin := auth.Group("/admin")
		admin.Use(AdminRequired())
		{
			admin.GET("/users", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"users": users})
			})
		}
	}

	r.Run(":8080")
}

// loginHandler authenticates user and returns token pair.
func loginHandler(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username and password required"})
		return
	}

	user, exists := users[req.Username]
	if !exists || user.Password != req.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	tokens, err := generateTokenPair(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// refreshHandler renews the access token using a refresh token.
func refreshHandler(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "refresh_token required"})
		return
	}

	claims, err := parseToken(req.RefreshToken, refreshTokenSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	// Find user and generate new token pair
	for _, user := range users {
		if user.ID == claims.UserID {
			tokens, err := generateTokenPair(user)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate tokens"})
				return
			}
			c.JSON(http.StatusOK, tokens)
			return
		}
	}

	c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
}

// getProfileHandler returns the current user's profile.
func getProfileHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")
	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"role":    userRole,
	})
}

// logoutHandler invalidates the current token.
func logoutHandler(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 {
		tokenBlacklist[parts[1]] = time.Now()
	}
	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}
```

## 执行预览

```bash
$ go run main.go

# 登录获取 Token
$ curl -X POST localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 900
}

# 使用 Access Token 访问受保护资源
$ curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  localhost:8080/api/profile
{"role":"admin","user_id":1}

# 无 Token 访问
$ curl localhost:8080/api/profile
{"error":"missing authorization header"}

# 错误的 Token
$ curl -H "Authorization: Bearer invalid-token" localhost:8080/api/profile
{"details":"...","error":"invalid or expired token"}

# Admin 专属接口
$ curl -H "Authorization: Bearer <admin-token>" localhost:8080/api/admin/users
{"users":{...}}

# 普通用户访问 Admin 接口
$ curl -H "Authorization: Bearer <user-token>" localhost:8080/api/admin/users
{"error":"admin access required"}

# 刷新 Token
$ curl -X POST localhost:8080/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"eyJhbGci..."}'
{"access_token":"new-token...","refresh_token":"new-refresh...","expires_in":900}

# 登出（Token 加入黑名单）
$ curl -X POST -H "Authorization: Bearer <token>" localhost:8080/api/logout
{"message":"logged out successfully"}
```

## 注意事项

| 项目 | 说明 |
|------|------|
| 密钥管理 | 生产环境密钥应从环境变量/密钥管理服务读取，不硬编码 |
| HTTPS | JWT 必须通过 HTTPS 传输，防止中间人攻击 |
| Token 存储 | 前端建议 HttpOnly Cookie，避免 XSS 窃取 |
| 过期时间 | Access Token 短（15min），Refresh Token 长（7d） |
| 签名算法 | 推荐 HS256 或 RS256，避免 `none` 算法 |
| 黑名单 | 生产环境用 Redis，设置 TTL 自动过期清理 |

## 避坑指南

- ❌ 把敏感信息（密码、手机号）放在 JWT Payload 中
- ✅ Payload 只放用户 ID 和角色，敏感信息查数据库

- ❌ JWT 密钥硬编码在源代码中
- ✅ 使用环境变量 `os.Getenv("JWT_SECRET")` 或配置中心

- ❌ Token 不过期或过期时间太长（数天）
- ✅ Access Token 15-30 分钟，配合 Refresh Token

- ❌ 忽略签名算法验证（alg:none 攻击）
- ✅ `jwt.ParseWithClaims` 中显式校验 `SigningMethodHMAC`

- ❌ 登出后 Token 仍可使用
- ✅ 实现 Token 黑名单（短期 token 影响有限，但仍推荐）

## 练习题

🟢 **基础：** 实现一个简单的 JWT 生成和验证，只有一个 `user_id` claim，过期时间 1 小时。

🟡 **进阶：** 实现基于 RS256（非对称加密）的 JWT 认证，私钥签名、公钥验证。

🔴 **挑战：** 实现完整的 OAuth2 Authorization Code Flow，包括授权码生成、state 参数防 CSRF、code 换 token、token 撤销。

## 知识点总结

```
JWT 认证知识树
├── JWT 组成
│   ├── Header → {"alg":"HS256","typ":"JWT"}
│   ├── Payload → Claims (用户数据)
│   └── Signature → HMAC(Header.Payload, secret)
├── Go 实现 (golang-jwt/jwt/v5)
│   ├── jwt.NewWithClaims(method, claims)
│   ├── token.SignedString(secret)
│   ├── jwt.ParseWithClaims(tokenStr, claims, keyFunc)
│   └── claims.Subject / claims.ExpiresAt
├── Gin 集成
│   ├── AuthRequired 中间件
│   ├── c.Set("user_id", ...)
│   ├── 角色校验中间件
│   └── Token 黑名单
├── 安全实践
│   ├── 密钥管理（环境变量/KMS）
│   ├── HTTPS 传输
│   ├── 短期 Access Token
│   ├── Refresh Token 轮转
│   └── Token 黑名单（Redis）
└── 进阶
    ├── RS256 非对称签名
    ├── OAuth2 集成
    └── 多因素认证 (MFA)
```

## 举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 单页应用 (SPA) | Access Token + HttpOnly Cookie | 防 XSS 窃取 Token |
| 移动端 App | Access Token + Secure Storage | Refresh Token 存 Keychain/Keystore |
| 微服务间通信 | 服务间共享密钥或 RS256 | 公钥分发给验证方 |
| 第三方登录 | OAuth2 + JWT | 集成 GitHub/Google Provider |
| API 网关 | 网关统一验签 | 下游服务信任网关 |

## 参考资料

- [JWT 官方网站](https://jwt.io/)
- [RFC 7519 - JSON Web Token](https://tools.ietf.org/html/rfc7519)
- [golang-jwt/jwt GitHub](https://github.com/golang-jwt/jwt)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

## 代码演进

**v1 — 最简 JWT：**
```go
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "user_id": 1,
    "exp":     time.Now().Add(time.Hour).Unix(),
})
tokenStr, _ := token.SignedString([]byte("secret"))
```

**v2 — 自定义 Claims + 双 Token：**
```go
type CustomClaims struct {
    UserID int    `json:"user_id"`
    Role   string `json:"role"`
    jwt.RegisteredClaims
}
// Access Token + Refresh Token 分离
```

**v3 — 生产级方案（如上方代码）：**
- 自定义 Claims 结构体
- Access + Refresh 双 Token 机制
- AuthRequired + AdminRequired 中间件
- Token 黑名单（登出撤销）
- 签名算法验证
- 结构化错误响应
