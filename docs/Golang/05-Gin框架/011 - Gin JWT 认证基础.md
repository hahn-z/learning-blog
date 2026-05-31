---
title: "011 - Gin JWT 认证基础"
slug: "011-gin-jwt"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:05:57.109+08:00"
updated_at: "2026-04-29T10:02:45.641+08:00"
reading_time: 43
tags: []
---

# 011 - Gin JWT 认证基础 ⭐⭐⭐

## 难度标注

| 维度 | 等级 | 说明 |
|------|------|------|
| 理解难度 | ⭐⭐⭐ | 需要理解 JWT 三段结构、签名机制 |
| 实现难度 | ⭐⭐ | golang-jwt 库封装良好，上手快 |
| 生产就绪 | ⭐⭐⭐⭐ | 需要额外处理刷新、黑名单等 |

## 概念讲解

### 什么是 JWT？

JSON Web Token（JWT）是一种开放标准（RFC 7519），用于在各方之间以 JSON 对象安全地传输信息。信息可以被验证和信任，因为它是数字签名的。

JWT 由三部分组成，用 `.` 分隔：`xxxxx.yyyyy.zzzzz`

```
Header.Payload.Signature
```

### 三段结构详解

**1. Header（头部）**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

- `alg`：签名算法，常用 HMAC SHA256（HS256）或 RSA
- `typ`：令牌类型，固定为 JWT

**2. Payload（载荷）**

```json
{
  "user_id": 1,
  "username": "admin",
  "exp": 1703232000,
  "iat": 1703145600
}
```

- 存放有效信息（Claims），包括**注册声明**（Registered Claims）和**自定义声明**
- 注意：Payload 只是 Base64 编码，**不加密**，不要放敏感信息
- 常用注册声明：`iss`（签发者）、`exp`（过期时间）、`sub`（主题）、`iat`（签发时间）

**3. Signature（签名）**

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

签名用于验证消息在传递过程中没有被篡改。

### JWT 认证流程

```
客户端                        服务端
  |                            |
  |--- 1. POST /login ------->|
  |                            |--- 验证用户名密码
  |<-- 2. 返回 JWT Token -----|
  |                            |
  |--- 3. GET /api/user ------>|  Header: Authorization: Bearer <token>
  |                            |--- 解析验证 Token
  |<-- 4. 返回用户数据 --------|
```

### JWT vs Session

| 对比项 | JWT | Session |
|--------|-----|---------|
| 存储位置 | 客户端 | 服务端 |
| 扩展性 | 天然支持分布式 | 需要共享存储 |
| 性能 | 无需查库 | 每次查存储 |
| 注销难度 | 较难（需黑名单） | 简单（删除即可） |
| 安全性 | Token 可能被盗用 | Session ID 更短 |

## 脑图

```
JWT 认证基础
├── 原理
│   ├── Header (算法+类型)
│   ├── Payload (Claims)
│   │   ├── Registered Claims (exp, iat, iss, sub)
│   │   ├── Public Claims
│   │   └── Private Claims (自定义)
│   └── Signature (签名)
│       ├── HS256 (对称)
│       └── RS256 (非对称)
├── golang-jwt 库
│   ├── jwt.NewWithClaims() 生成
│   ├── jwt.ParseWithClaims() 解析
│   └── 自定义 Claims 结构
├── Gin 集成
│   ├── 登录接口 → 生成 Token
│   ├── 中间件 → 验证 Token
│   └── 受保护路由组
├── Token 管理
│   ├── Access Token (短期)
│   ├── Refresh Token (长期)
│   └── 过期与刷新策略
└── 安全实践
    ├── Secret 足够长
    ├── HTTPS 传输
    ├── 不存敏感信息
    └── Token 黑名单
```

## 完整 Go 代码

### 项目结构

```
gin-jwt-demo/
├── main.go
├── middleware/
│   └── auth.go
├── models/
│   └── claims.go
├── handlers/
│   └── auth.go
└── utils/
    └── jwt.go
```

### models/claims.go - 自定义 Claims

```go
package models

import (
    "github.com/golang-jwt/jwt/v5"
)

// CustomClaims extends standard claims with user info
type CustomClaims struct {
    UserID   uint   `json:"user_id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    jwt.RegisteredClaims
}

// TokenPair holds access and refresh tokens
type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    ExpiresIn    int64  `json:"expires_in"`
}
```

### utils/jwt.go - JWT 工具函数

```go
package utils

import (
    "errors"
    "time"

    "gin-jwt-demo/models"

    "github.com/golang-jwt/jwt/v5"
)

var (
    // In production, load from env/config
    accessSecret  = []byte("your-access-secret-key-min-32-chars!!")
    refreshSecret = []byte("your-refresh-secret-key-min-32-chars!!")
)

const (
    AccessTokenDuration  = 2 * time.Hour
    RefreshTokenDuration = 7 * 24 * time.Hour
)

// GenerateAccessToken creates a new access token
func GenerateAccessToken(userID uint, username, role string) (string, error) {
    claims := models.CustomClaims{
        UserID:   userID,
        Username: username,
        Role:     role,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenDuration)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    "gin-jwt-demo",
            Subject:   username,
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(accessSecret)
}

// GenerateRefreshToken creates a new refresh token
func GenerateRefreshToken(userID uint, username string) (string, error) {
    claims := models.CustomClaims{
        UserID:   userID,
        Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(RefreshTokenDuration)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            Issuer:    "gin-jwt-demo",
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(refreshSecret)
}

// GenerateTokenPair creates both access and refresh tokens
func GenerateTokenPair(userID uint, username, role string) (*models.TokenPair, error) {
    accessToken, err := GenerateAccessToken(userID, username, role)
    if err != nil {
        return nil, err
    }

    refreshToken, err := GenerateRefreshToken(userID, username)
    if err != nil {
        return nil, err
    }

    return &models.TokenPair{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        ExpiresIn:    int64(AccessTokenDuration.Seconds()),
    }, nil
}

// ParseAccessToken validates and parses an access token
func ParseAccessToken(tokenString string) (*models.CustomClaims, error) {
    claims := &models.CustomClaims{}
    token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
        // Verify signing method
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return accessSecret, nil
    })

    if err != nil {
        return nil, err
    }

    if !token.Valid {
        return nil, errors.New("invalid token")
    }

    return claims, nil
}

// ParseRefreshToken validates and parses a refresh token
func ParseRefreshToken(tokenString string) (*models.CustomClaims, error) {
    claims := &models.CustomClaims{}
    token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("unexpected signing method")
        }
        return refreshSecret, nil
    })

    if err != nil {
        return nil, err
    }

    if !token.Valid {
        return nil, errors.New("invalid token")
    }

    return claims, nil
}
```

### middleware/auth.go - JWT 鉴权中间件

```go
package middleware

import (
    "net/http"
    "strings"

    "gin-jwt-demo/utils"

    "github.com/gin-gonic/gin"
)

// AuthRequired validates JWT token from Authorization header
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Extract token from Authorization: Bearer <token>
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "error": "Authorization header is required",
            })
            c.Abort()
            return
        }

        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            c.JSON(http.StatusUnauthorized, gin.H{
                "error": "Authorization header format must be Bearer {token}",
            })
            c.Abort()
            return
        }

        tokenString := parts[1]
        claims, err := utils.ParseAccessToken(tokenString)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{
                "error": "Invalid or expired token",
            })
            c.Abort()
            return
        }

        // Store user info in context for downstream handlers
        c.Set("userID", claims.UserID)
        c.Set("username", claims.Username)
        c.Set("role", claims.Role)

        c.Next()
    }
}
```

### handlers/auth.go - 认证处理器

```go
package handlers

import (
    "net/http"

    "gin-jwt-demo/utils"

    "github.com/gin-gonic/gin"
)

// Login handles user authentication and token generation
// POST /auth/login
func Login(c *gin.Context) {
    var req struct {
        Username string `json:"username" binding:"required"`
        Password string `json:"password" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Demo: hardcoded user validation
    // In production, query database and verify bcrypt hash
    if req.Username != "admin" || req.Password != "password123" {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
        return
    }

    tokenPair, err := utils.GenerateTokenPair(1, req.Username, "admin")
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Login successful",
        "data":    tokenPair,
    })
}

// RefreshToken renews access token using refresh token
// POST /auth/refresh
func RefreshToken(c *gin.Context) {
    var req struct {
        RefreshToken string `json:"refresh_token" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    claims, err := utils.ParseRefreshToken(req.RefreshToken)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
        return
    }

    // Generate new token pair
    tokenPair, err := utils.GenerateTokenPair(claims.UserID, claims.Username, claims.Role)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Token refreshed",
        "data":    tokenPair,
    })
}

// GetProfile returns current user profile
// GET /api/profile (protected)
func GetProfile(c *gin.Context) {
    userID := c.GetUint("userID")
    username, _ := c.Get("username")
    role, _ := c.Get("role")

    c.JSON(http.StatusOK, gin.H{
        "data": gin.H{
            "user_id":  userID,
            "username": username,
            "role":     role,
        },
    })
}
```

### main.go - 入口文件

```go
package main

import (
    "gin-jwt-demo/handlers"
    "gin-jwt-demo/middleware"

    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    // Public routes - no auth required
    auth := r.Group("/auth")
    {
        auth.POST("/login", handlers.Login)
        auth.POST("/refresh", handlers.RefreshToken)
    }

    // Protected routes - JWT auth required
    api := r.Group("/api")
    api.Use(middleware.AuthRequired())
    {
        api.GET("/profile", handlers.GetProfile)
    }

    r.Run(":8080")
}
```

## 执行预览

```bash
# 安装依赖
go mod init gin-jwt-demo
go get github.com/gin-gonic/gin
go get github.com/golang-jwt/jwt/v5

# 启动服务
go run main.go

# 1. 登录获取 Token
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# 返回：
# {
#   "message": "Login successful",
#   "data": {
#     "access_token": "eyJhbGciOiJIUzI1NiIs...",
#     "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
#     "expires_in": 7200
#   }
# }

# 2. 访问受保护接口
curl http://localhost:8080/api/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# 返回：
# {
#   "data": {
#     "user_id": 1,
#     "username": "admin",
#     "role": "admin"
#   }
# }

# 3. 刷新 Token
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"eyJhbGciOiJIUzI1NiIs..."}'

# 4. 无 Token 访问（失败）
curl http://localhost:8080/api/profile
# {"error":"Authorization header is required"}

# 5. 无效 Token（失败）
curl http://localhost:8080/api/profile \
  -H "Authorization: Bearer invalid-token"
# {"error":"Invalid or expired token"}
```

## 注意事项

| 事项 | 说明 | 严重度 |
|------|------|--------|
| Secret 管理 | 生产环境必须从配置/环境变量加载，不要硬编码 | 🔴 严重 |
| HTTPS | JWT Token 必须通过 HTTPS 传输 | 🔴 严重 |
| Token 有效期 | Access Token 建议 1-2 小时，Refresh Token 7-30 天 | 🟡 重要 |
| Payload 大小 | Token 越大网络开销越大，Claims 尽量精简 | 🟡 重要 |
| 算法选择 | HS256 足够大多数场景，高安全场景用 RS256 | 🟢 建议 |
| Token 存储 | 前端建议存在 httpOnly Cookie 或内存中 | 🟡 重要 |
| 多设备登录 | 需要额外机制追踪每个设备的 Token | 🟢 建议 |

## 避坑指南

### ❌ 在 Payload 中存储敏感信息
```go
// BAD: Password hash in token
claims := CustomClaims{
    Password: "$2a$10$...", // anyone can decode this!
}
```
✅ **正确做法：** 只存必要的标识信息（user_id, role），敏感数据查库获取。

### ❌ 硬编码 Secret
```go
// BAD: Secret in source code
var secret = []byte("my-secret")
```
✅ **正确做法：** 从环境变量或配置中心加载。

### ❌ 不验证签名算法
```go
// BAD: Trust token header algorithm blindly
token, _, _ := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
    return secret, nil // No algorithm check!
})
```
✅ **正确做法：** 验证 `token.Method` 是否为预期算法。

### ❌ Token 永不过期
```go
// BAD: No expiration
claims := jwt.RegisteredClaims{
    // Missing ExpiresAt!
}
```
✅ **正确做法：** 始终设置合理的过期时间。

### ❌ 仅依赖 Token 过期实现注销
```go
// BAD: Can't invalidate token before expiry
func Logout(c *gin.Context) {
    c.JSON(200, gin.H{"message": "logged out"})
    // Token is still valid until expiry!
}
```
✅ **正确做法：** 维护 Token 黑名单（Redis），注销时加入黑名单。

## 练习题

### 🟢 基础题

1. **生成与解析：** 编写一个程序，生成一个包含 `user_id=42, username="test"` 的 JWT，然后解析并打印 Claims。

2. **中间件基础：** 实现一个简单的 JWT 中间件，只打印解析出的 user_id，不拦截请求。

### 🟡 进阶题

3. **双 Token 刷新：** 实现 Access Token（15分钟） + Refresh Token（7天）的完整刷新流程，确保旧 Refresh Token 只能用一次。

4. **Token 黑名单：** 使用 Redis 实现注销功能，Token 加入黑名单后立即失效。

### 🔴 挑战题

5. **RS256 迁移：** 将 HS256 升级为 RS256（RSA），实现公钥分发、私钥签名的完整方案，支持密钥轮换。

## 知识点总结

```
Gin JWT 认证
├── JWT 基础
│   ├── 三段结构: Header.Payload.Signature
│   ├── Base64URL 编码（非加密）
│   ├── 签名算法: HS256 / RS256
│   └── Claims: Registered + Custom
├── golang-jwt/v5
│   ├── jwt.NewWithClaims() → 生成
│   ├── jwt.ParseWithClaims() → 解析
│   ├── RegisteredClaims → 标准字段
│   └── SigningMethod → 算法选择
├── Gin 集成
│   ├── 中间件提取 Bearer Token
│   ├── c.Set() 传递用户信息
│   └── 路由组统一保护
├── Token 生命周期
│   ├── Access Token (短期, 1-2h)
│   ├── Refresh Token (长期, 7-30d)
│   ├── 刷新流程: old refresh → new pair
│   └── 注销: 黑名单机制
└── 安全要点
    ├── Secret 管理 (env/config)
    ├── HTTPS 传输
    ├── 算法验证
    └── Payload 最小化
```

## 举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 单页应用(SPA) | 登录后存 httpOnly Cookie | 防 XSS 攻击 |
| 移动端 APP | 内存存储 + 静默刷新 | 安全区域存储 refresh token |
| 微服务间调用 | 服务间共享 Secret 或公钥 | 网关统一验证 |
| WebSocket 认证 | 连接时通过 query param 或首个消息传递 | 连接建立后绑定用户 |
| 第三方登录(OAuth) | 颁发自定义 JWT，不存 OAuth Token | OAuth Token 和 JWT 分离 |
| 多租户系统 | Claims 中加入 tenant_id | 中间件校验租户权限 |

## 参考资料

- [JWT 官方文档](https://jwt.io/introduction)
- [golang-jwt GitHub](https://github.com/golang-jwt/jwt)
- [RFC 7519 - JSON Web Token](https://tools.ietf.org/html/rfc7519)
- [Gin 中间件文档](https://gin-gonic.com/docs/examples/custom-middleware/)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

## 代码演进

### v1 - 最简实现（学习用）

```go
// v1: Hardcoded secret, no refresh, basic claims
func generateToken(username string) (string, error) {
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "username": username,
        "exp":      time.Now().Add(time.Hour).Unix(),
    })
    return token.SignedString([]byte("secret"))
}

func authMiddleware(c *gin.Context) {
    tokenString := c.GetHeader("Authorization")
    token, _ := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
        return []byte("secret"), nil
    })
    if token == nil || !token.Valid {
        c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
        return
    }
    c.Next()
}
```

### v2 - 结构化 Claims + 双 Token

```go
// v2: Custom Claims struct, separate access/refresh secrets
type CustomClaims struct {
    UserID   uint   `json:"user_id"`
    Username string `json:"username"`
    jwt.RegisteredClaims
}

func generateTokenPair(userID uint, username string) (*TokenPair, error) {
    // Separate access and refresh tokens with different secrets
    accessClaims := CustomClaims{UserID: userID, Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
        }}
    refreshClaims := CustomClaims{UserID: userID, Username: username,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
        }}
    // ... generate both tokens
}
```

### v3 - 生产级方案（Redis 黑名单 + 配置化）

```go
// v3: Token blacklist, config-driven secrets, proper error handling
type JWTService struct {
    accessSecret  []byte
    refreshSecret []byte
    redis         *redis.Client
}

func (s *JWTService) AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        tokenString := extractBearerToken(c)
        // Check blacklist first
        if s.redis.Exists(c, "blacklist:"+tokenString).Val() > 0 {
            c.AbortWithStatusJSON(401, gin.H{"error": "token revoked"})
            return
        }
        claims, err := s.parseAccessToken(tokenString)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "invalid token"})
            return
        }
        c.Set("userID", claims.UserID)
        c.Set("username", claims.Username)
        c.Next()
    }
}

func (s *JWTService) Logout(tokenString string) error {
    // Add to blacklist with TTL matching token expiry
    return s.redis.Set(c, "blacklist:"+tokenString, "1", 2*time.Hour).Err()
}
```

**演进总结：** v1 快速理解原理 → v2 引入双 Token 和类型安全 → v3 生产级安全（黑名单、配置化、依赖注入）。
