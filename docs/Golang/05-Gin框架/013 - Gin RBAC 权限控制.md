---
title: "013 - Gin RBAC 权限控制"
slug: "013-gin-rbac"
category: "Gin框架"
tech_stack: "Golang"
created_at: "2026-04-25T23:05:57.134+08:00"
updated_at: "2026-04-29T10:02:45.659+08:00"
reading_time: 49
tags: []
---

# 013 - Gin RBAC 权限控制 ⭐⭐⭐⭐

## 难度标注

| 维度 | 等级 | 说明 |
|------|------|------|
| 理解难度 | ⭐⭐⭐⭐ | RBAC 模型设计、角色继承需要仔细思考 |
| 实现难度 | ⭐⭐⭐ | 中间件 + 缓存 + 数据库，环节较多 |
| 生产就绪 | ⭐⭐⭐⭐ | 权限缓存一致性是难点 |

## 概念讲解

### 什么是 RBAC？

RBAC（Role-Based Access Control，基于角色的访问控制）是最广泛使用的权限模型。核心思想：**用户 → 角色 → 权限**，用户不直接关联权限，而是通过角色间接获得权限。

### RBAC 模型层级

```
RBAC0 (基础)
  用户 → 角色 → 权限

RBAC1 (角色继承)
  角色可以继承其他角色的权限
  admin 继承 editor 继承 viewer

RBAC2 (约束)
  互斥角色、基数约束
  例如：不能同时拥有 "出纳" 和 "审计" 角色

RBAC3 = RBAC1 + RBAC2
```

本文实现 **RBAC1**（含角色继承），适合大多数 Web 应用。

### 数据库设计

```
┌──────┐     ┌──────────────┐     ┌──────────┐
│ users │────>│ user_roles   │<────│  roles   │
└──────┘     └──────────────┘     └──────────┘
                      │                  │
                      │           ┌──────────────┐
                      │           │ role_perms   │
                      │           └──────────────┘
                      │                  │
                      │           ┌──────────────┐
                      └──────────>│ permissions  │
                                  └──────────────┘

另：role_inheritance (parent_id → child_id)
```

### 权限标识规范

推荐格式：`资源:操作`

```
article:create   文章创建
article:read     文章读取
article:update   文章更新
article:delete   文章删除
user:manage      用户管理
system:config    系统配置
```

## 脑图

```
RBAC 权限控制
├── 模型设计
│   ├── User (用户)
│   ├── Role (角色)
│   ├── Permission (权限)
│   ├── UserRole (用户-角色关联)
│   ├── RolePermission (角色-权限关联)
│   └── RoleInheritance (角色继承)
├── 数据库
│   ├── 5 张表 + 关联表
│   ├── 唯一约束防重复
│   └── 索引优化查询
├── 权限中间件
│   ├── JWT 认证 → 提取用户
│   ├── 查询用户角色
│   ├── 收集所有权限 (含继承)
│   ├── 匹配所需权限
│   └── Pass / Abort
├── 权限缓存
│   ├── Redis 缓存用户权限
│   ├── 角色变更时清除缓存
│   └── TTL 自动过期
├── 角色继承
│   ├── 递归查询父角色
│   ├── 权限合并
│   └── 避免循环继承
└── API 设计
    ├── GET  /api/roles          角色列表
    ├── POST /api/roles          创建角色
    ├── POST /api/roles/:id/perms 绑定权限
    └── GET  /api/users/:id/perms 查询权限
```

## 完整 Go 代码

### 项目结构

```
gin-rbac-demo/
├── main.go
├── models/
│   └── rbac.go
├── middleware/
│   └── rbac.go
├── handlers/
│   └── rbac.go
├── services/
│   └── rbac.go
└── database/
    └── database.go
```

### models/rbac.go

```go
package models

import "time"

// User represents a system user
type User struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    Username  string    `gorm:"uniqueIndex;size:50" json:"username"`
    Password  string    `gorm:"size:255" json:"-"`
    Status    int       `gorm:"default:1" json:"status"`
    CreatedAt time.Time `json:"created_at"`
    Roles     []Role    `gorm:"many2many:user_roles" json:"roles"`
}

// Role represents a user role
type Role struct {
    ID          uint   `gorm:"primaryKey" json:"id"`
    Name        string `gorm:"uniqueIndex;size:50" json:"name"`
    Description string `gorm:"size:200" json:"description"`
    ParentID    *uint  `gorm:"index" json:"parent_id"` // For role inheritance
    Permissions []Permission `gorm:"many2many:role_permissions" json:"permissions"`
    CreatedAt   time.Time    `json:"created_at"`
}

// Permission represents an access permission
type Permission struct {
    ID       uint   `gorm:"primaryKey" json:"id"`
    Resource string `gorm:"size:50;not null" json:"resource"` // e.g., "article"
    Action   string `gorm:"size:50;not null" json:"action"`   // e.g., "create"
    Desc     string `gorm:"size:200" json:"desc"`
}

// Key returns the permission identifier "resource:action"
func (p Permission) Key() string {
    return p.Resource + ":" + p.Action
}

// UserRole is the join table for users and roles
type UserRole struct {
    UserID uint `gorm:"primaryKey"`
    RoleID uint `gorm:"primaryKey"`
}

// RolePermission is the join table for roles and permissions
type RolePermission struct {
    RoleID       uint `gorm:"primaryKey"`
    PermissionID uint `gorm:"primaryKey"`
}
```

### services/rbac.go

```go
package services

import (
    "fmt"
    "sync"

    "gin-rbac-demo/database"
    "gin-rbac-demo/models"

    "gorm.io/gorm"
)

// RBACService handles role and permission operations
type RBACService struct {
    cache sync.Map // Simple in-memory cache; use Redis in production
}

var RBAC = &RBACService{}

// GetUserPermissions retrieves all permissions for a user (including inherited)
func (s *RBACService) GetUserPermissions(userID uint) (map[string]bool, error) {
    // Check cache first
    cacheKey := fmt.Sprintf("perms:%d", userID)
    if cached, ok := s.cache.Load(cacheKey); ok {
        return cached.(map[string]bool), nil
    }

    // Find user's roles
    var user models.User
    if err := database.DB.Preload("Roles").First(&user, userID).Error; err != nil {
        return nil, err
    }

    perms := make(map[string]bool)
    for _, role := range user.Roles {
        s.collectRolePermissions(role.ID, perms)
    }

    // Cache result
    s.cache.Store(cacheKey, perms)
    return perms, nil
}

// collectRolePermissions recursively collects permissions including inherited roles
func (s *RBACService) collectRolePermissions(roleID uint, perms map[string]bool) {
    var role models.Role
    if err := database.DB.Preload("Permissions").First(&role, roleID).Error; err != nil {
        return
    }

    // Add this role's permissions
    for _, p := range role.Permissions {
        perms[p.Key()] = true
    }

    // Recursively collect from parent role
    if role.ParentID != nil {
        s.collectRolePermissions(*role.ParentID, perms)
    }
}

// HasPermission checks if a user has a specific permission
func (s *RBACService) HasPermission(userID uint, resource, action string) bool {
    perms, err := s.GetUserPermissions(userID)
    if err != nil {
        return false
    }
    key := resource + ":" + action
    return perms[key]
}

// AssignRole assigns a role to a user
func (s *RBACService) AssignRole(userID, roleID uint) error {
    return database.DB.Exec(
        "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        userID, roleID,
    ).Error
}

// AssignPermission assigns a permission to a role
func (s *RBACService) AssignPermission(roleID, permID uint) error {
    return database.DB.Exec(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        roleID, permID,
    ).Error
}

// ClearUserCache removes cached permissions for a user
func (s *RBACService) ClearUserCache(userID uint) {
    s.cache.Delete(fmt.Sprintf("perms:%d", userID))
}

// InitDefaultData seeds default roles and permissions
func (s *RBACService) InitDefaultData(db *gorm.DB) {
    // Create permissions
    perms := []models.Permission{
        {Resource: "article", Action: "create", Desc: "Create articles"},
        {Resource: "article", Action: "read", Desc: "Read articles"},
        {Resource: "article", Action: "update", Desc: "Update articles"},
        {Resource: "article", Action: "delete", Desc: "Delete articles"},
        {Resource: "user", Action: "manage", Desc: "Manage users"},
        {Resource: "system", Action: "config", Desc: "System configuration"},
    }
    for i := range perms {
        db.FirstOrCreate(&perms[i], models.Permission{Resource: perms[i].Resource, Action: perms[i].Action})
    }

    // Create roles with inheritance: viewer -> editor -> admin
    viewer := models.Role{Name: "viewer", Description: "Read-only access"}
    db.FirstOrCreate(&viewer, models.Role{Name: "viewer"})

    editor := models.Role{Name: "editor", Description: "Content editor", ParentID: &viewer.ID}
    db.FirstOrCreate(&editor, models.Role{Name: "editor"})

    admin := models.Role{Name: "admin", Description: "Full access", ParentID: &editor.ID}
    db.FirstOrCreate(&admin, models.Role{Name: "admin"})

    // Assign permissions
    // Viewer: article:read
    s.AssignPermission(viewer.ID, perms[1].ID)
    // Editor: article:create, article:update (inherits article:read from viewer)
    s.AssignPermission(editor.ID, perms[0].ID)
    s.AssignPermission(editor.ID, perms[2].ID)
    // Admin: all remaining (inherits editor's perms)
    s.AssignPermission(admin.ID, perms[3].ID)
    s.AssignPermission(admin.ID, perms[4].ID)
    s.AssignPermission(admin.ID, perms[5].ID)
}
```

### middleware/rbac.go

```go
package middleware

import (
    "net/http"
    "strings"

    "gin-rbac-demo/services"
    "gin-rbac-demo/utils"

    "github.com/gin-gonic/gin"
)

// AuthRequired validates JWT token
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
            c.Abort()
            return
        }
        parts := strings.SplitN(authHeader, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
            c.Abort()
            return
        }
        claims, err := utils.ParseToken(parts[1])
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }
        c.Set("userID", claims.UserID)
        c.Set("role", claims.Role)
        c.Next()
    }
}

// RequirePermission creates middleware that checks for a specific permission
func RequirePermission(resource, action string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("userID")
        if userID == 0 {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
            c.Abort()
            return
        }

        if !services.RBAC.HasPermission(userID, resource, action) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": fmt.Sprintf("Permission denied: %s:%s", resource, action),
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### handlers/rbac.go

```go
package handlers

import (
    "net/http"

    "gin-rbac-demo/database"
    "gin-rbac-demo/models"
    "gin-rbac-demo/services"

    "github.com/gin-gonic/gin"
)

// ListRoles returns all roles
// GET /api/roles
func ListRoles(c *gin.Context) {
    var roles []models.Role
    database.DB.Preload("Permissions").Find(&roles)
    c.JSON(http.StatusOK, gin.H{"data": roles})
}

// CreateRole creates a new role
// POST /api/roles
func CreateRole(c *gin.Context) {
    var req struct {
        Name        string `json:"name" binding:"required"`
        Description string `json:"description"`
        ParentID    *uint  `json:"parent_id"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    role := models.Role{
        Name:        req.Name,
        Description: req.Description,
        ParentID:    req.ParentID,
    }
    if err := database.DB.Create(&role).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create role"})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"data": role})
}

// ListPermissions returns all permissions
// GET /api/permissions
func ListPermissions(c *gin.Context) {
    var perms []models.Permission
    database.DB.Find(&perms)
    c.JSON(http.StatusOK, gin.H{"data": perms})
}

// AssignRoleToUser assigns a role to a user
// POST /api/users/:id/roles
func AssignRoleToUser(c *gin.Context) {
    var req struct {
        RoleID uint `json:"role_id" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    userID := c.Param("id")
    var user models.User
    if err := database.DB.First(&user, userID).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    if err := services.RBAC.AssignRole(user.ID, req.RoleID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign role"})
        return
    }

    // Clear permission cache for this user
    services.RBAC.ClearUserCache(user.ID)
    c.JSON(http.StatusOK, gin.H{"message": "Role assigned"})
}

// GetUserPermissions returns all permissions for a user
// GET /api/users/:id/permissions
func GetUserPermissions(c *gin.Context) {
    var user models.User
    if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }

    perms, err := services.RBAC.GetUserPermissions(user.ID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get permissions"})
        return
    }

    // Convert map keys to slice
    var permList []string
    for k := range perms {
        permList = append(permList, k)
    }
    c.JSON(http.StatusOK, gin.H{"data": permList})
}

// CreateArticle is a protected endpoint requiring article:create
// POST /api/articles
func CreateArticle(c *gin.Context) {
    c.JSON(http.StatusCreated, gin.H{"message": "Article created"})
}

// DeleteArticle requires article:delete permission
// DELETE /api/articles/:id
func DeleteArticle(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Article deleted"})
}
```

### main.go

```go
package main

import (
    "gin-rbac-demo/database"
    "gin-rbac-demo/handlers"
    "gin-rbac-demo/middleware"
    "gin-rbac-demo/services"

    "github.com/gin-gonic/gin"
    _ "github.com/mattn/go-sqlite3"
)

func main() {
    db := database.Init("rbac.db")
    services.RBAC.InitDefaultData(db)

    r := gin.Default()

    // Protected routes with RBAC
    api := r.Group("/api")
    api.Use(middleware.AuthRequired())
    {
        // Role management (admin only)
        api.GET("/roles", middleware.RequirePermission("system", "config"), handlers.ListRoles)
        api.POST("/roles", middleware.RequirePermission("system", "config"), handlers.CreateRole)
        api.GET("/permissions", middleware.RequirePermission("system", "config"), handlers.ListPermissions)

        // User role assignment
        api.POST("/users/:id/roles", middleware.RequirePermission("user", "manage"), handlers.AssignRoleToUser)
        api.GET("/users/:id/permissions", middleware.RequirePermission("user", "manage"), handlers.GetUserPermissions)

        // Article CRUD with permission checks
        articles := api.Group("/articles")
        {
            articles.POST("", middleware.RequirePermission("article", "create"), handlers.CreateArticle)
            articles.DELETE("/:id", middleware.RequirePermission("article", "delete"), handlers.DeleteArticle)
        }
    }

    r.Run(":8080")
}
```

## 执行预览

```bash
# 查看所有角色
curl http://localhost:8080/api/roles -H "Authorization: Bearer <admin-token>"
# {"data":[{"id":1,"name":"viewer","description":"Read-only access","permissions":[...]}, ...]}

# 创建新角色
curl -X POST http://localhost:8080/api/roles \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"name":"moderator","description":"Content moderator","parent_id":2}'
# {"data":{"id":4,"name":"moderator",...}}

# 给用户分配角色
curl -X POST http://localhost:8080/api/users/1/roles \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"role_id":3}'
# {"message":"Role assigned"}

# 查看用户权限（含继承）
curl http://localhost:8080/api/users/1/permissions \
  -H "Authorization: Bearer <admin-token>"
# {"data":["article:create","article:read","article:update","article:delete","user:manage","system:config"]}

# 权限不足（viewer 角色无法创建文章）
curl -X POST http://localhost:8080/api/articles \
  -H "Authorization: Bearer <viewer-token>"
# {"error":"Permission denied: article:create"}
```

## 注意事项

| 事项 | 说明 | 严重度 |
|------|------|--------|
| 权限缓存一致性 | 角色权限变更后必须清缓存 | 🔴 严重 |
| 循环继承检测 | parent_id 链不能形成环 | 🔴 严重 |
| 超级管理员 | 建议有绕过权限检查的超级角色 | 🟡 重要 |
| 权限粒度 | 太细维护成本高，太粗不够灵活 | 🟡 重要 |
| 并发安全 | sync.Map 适合读多写少，高并发用 Redis | 🟡 重要 |
| 删除级联 | 删除角色需清理关联表 | 🟢 建议 |

## 避坑指南

### ❌ 用户直接关联权限
```go
// BAD: Direct user-permission mapping, hard to manage
type User struct {
    Permissions []Permission `gorm:"many2many:user_permissions"`
}
```
✅ **正确做法：** 通过角色间接关联，用户 → 角色 → 权限。

### ❌ 不处理角色继承
```go
// BAD: Only check direct role's permissions
func getPerms(roleID uint) []Permission {
    db.Where("role_id = ?", roleID).Find(&perms)
    // Missing parent role's permissions!
}
```
✅ **正确做法：** 递归收集父角色权限。

### ❌ 缓存永不过期
```go
// BAD: Cache forever, stale after role change
var permCache = map[uint][]string{}
```
✅ **正确做法：** 设置 TTL + 主动失效（角色变更时清除）。

### ❌ 不检查循环继承
```go
// BAD: parent_id can create a cycle
// Role A parent = B, Role B parent = A → infinite loop
```
✅ **正确做法：** 设置角色时验证 parent 链不形成环。

## 练习题

### 🟢 基础题

1. **基础 RBAC：** 实现 User → Role → Permission 三表模型，支持简单的权限检查中间件。

2. **权限查询 API：** 实现 `GET /api/me/permissions` 返回当前用户所有权限列表。

### 🟡 进阶题

3. **权限缓存 + Redis：** 用 Redis 替换 sync.Map 缓存，实现 TTL 过期和主动失效。

4. **角色继承可视化：** 实现 API 返回角色继承树，支持可视化展示。

### 🔴 挑战题

5. **ABAC 扩展：** 在 RBAC 基础上加入属性控制，例如"只能编辑自己创建的文章"（基于 owner 属性判断）。

## 知识点总结

```
RBAC 权限控制
├── 模型设计
│   ├── User ↔ Role (多对多)
│   ├── Role ↔ Permission (多对多)
│   ├── Role Inheritance (parent_id)
│   └── 权限标识: resource:action
├── 数据库
│   ├── users, roles, permissions
│   ├── user_roles, role_permissions
│   └── 唯一约束 + 索引
├── 中间件
│   ├── AuthRequired → JWT 解析
│   ├── RequirePermission(resource, action)
│   └── 查缓存 → 查DB → 递归继承 → Pass/Abort
├── 权限缓存
│   ├── sync.Map / Redis
│   ├── 缓存 key: perms:{userID}
│   ├── TTL 自动过期
│   └── 主动失效: 角色变更时
├── 角色继承
│   ├── parent_id 自引用
│   ├── 递归收集权限
│   └── 循环检测
└── 最佳实践
    ├── 超级管理员绕过
    ├── 权限粒度适中
    └── 变更日志审计
```

## 举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| SaaS 多租户 | 每个租户独立角色体系 | tenant_id 隔离 |
| 动态菜单 | 前端根据权限渲染菜单 | permission → menu mapping |
| 数据权限 | 同角色不同数据范围 | organization scope |
| 临时权限 | 限时授权，过期自动回收 | TTL + 定时清理 |
| 审计日志 | 记录每次权限变更 | 谁 → 什么时候 → 改了什么 |

## 参考资料

- [NIST RBAC Model](https://csrc.nist.gov/projects/role-based-access-control)
- [GORM Many2Many 文档](https://gorm.io/docs/many_to_many.html)
- [Go sync.Map](https://pkg.go.dev/sync#Map)
- [RBAC vs ABAC 对比](https://www.okta.com/identity-101/role-based-access-control-vs-attribute-based-access-control/)
- [Casbin - Go 权限库](https://github.com/casbin/casbin)

## 代码演进

### v1 - 硬编码角色判断

```go
// v1: Hardcoded role check in handlers
func CreateArticle(c *gin.Context) {
    role := c.GetString("role")
    if role != "admin" && role != "editor" {
        c.JSON(403, gin.H{"error": "forbidden"})
        return
    }
    // ... create article
}
```

### v2 - 数据库驱动的 RBAC

```go
// v2: Database-driven roles and permissions
func RequirePermission(resource, action string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("userID")
        perms := getPermissionsFromDB(userID) // Query DB
        if !perms[resource+":"+action] {
            c.AbortWithStatusJSON(403, gin.H{"error": "Permission denied"})
            return
        }
        c.Next()
    }
}
```

### v3 - 缓存 + 继承 + 超级管理员

```go
// v3: Full production RBAC with cache, inheritance, superadmin
func (s *RBACService) RequirePermission(resource, action string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("userID")
        
        // Superadmin bypass
        if s.isSuperAdmin(userID) {
            c.Next(); return
        }
        
        // Check cache → DB with inheritance
        perms, _ := s.GetUserPermissions(userID)
        if !perms[resource+":"+action] {
            c.AbortWithStatusJSON(403, gin.H{"error": "Permission denied"})
            return
        }
        c.Next()
    }
}
```

**演进总结：** v1 硬编码快速起步 → v2 数据库驱动灵活管理 → v3 生产级（缓存、继承、超级管理员）。
