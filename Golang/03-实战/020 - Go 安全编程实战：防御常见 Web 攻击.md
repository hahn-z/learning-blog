---
title: "020 - Go 安全编程实战：防御常见 Web 攻击"
slug: "020-docker-compose"
category: "Golang实战"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.44+08:00"
updated_at: "2026-04-29T10:02:45.043+08:00"
reading_time: 29
tags: ["部署"]
---

## 难度标注

> 🟡 **中级** | 需要了解 Go Web 开发、HTTP 协议基础

## 概念讲解

### Web 安全全景图

Go Web 应用面临的主要安全威胁：

- **SQL 注入**：恶意 SQL 通过输入参数注入到查询中
- **XSS（跨站脚本）**：恶意脚本注入到页面中执行
- **CSRF（跨站请求伪造）**：诱导用户执行非预期操作
- **命令注入**：恶意系统命令通过输入参数执行
- **路径遍历**：非法访问文件系统中的敏感文件

Go 的 `net/http` 标准库和常见框架（Gin、Echo）提供了一定的安全保障，但开发者仍需主动防御。

### 防御核心原则

1. **永不信任用户输入**：所有输入都必须验证和净化
2. **参数化查询**：数据库操作永远用占位符
3. **输出编码**：根据上下文对输出进行 HTML/JS/URL 编码
4. **最小权限**：进程和数据库用户只授予必要权限

## 脑图

```
Go Web 安全
├── SQL 注入防御
│   ├── 参数化查询 (database/sql)
│   ├── ORM 使用
│   └── 输入验证
├── XSS 防御
│   ├── HTML 模板自动转义
│   ├── CSP 头
│   └── 输入过滤
├── CSRF 防御
│   ├── Token 验证
│   ├── SameSite Cookie
│   └── Origin 检查
├── 命令注入防御
│   ├── exec.Command 参数化
│   ├── 输入白名单
│   └── 沙箱执行
├── 路径遍历防御
│   ├── filepath.Clean
│   ├── 白名单目录
│   └── 路径前缀检查
└── 安全中间件
    ├── Rate Limiting
    ├── HTTPS 强制
    └── 安全响应头
```

## 完整 Go 代码：安全防护中间件

```go
// Package main demonstrates common web security defenses in Go.
package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// ============================================================
// 1. SQL Injection Defense
// ============================================================

// UserDB wraps database operations with safe query methods.
type UserDB struct {
	db *sql.DB
}

// SafeLogin uses parameterized queries to prevent SQL injection.
func (udb *UserDB) SafeLogin(username, password string) (string, error) {
	var userID string
	// SAFE: parameterized query with placeholders
	err := udb.db.QueryRow(
		"SELECT id FROM users WHERE username = ? AND password = ?",
		username, password,
	).Scan(&userID)
	if err != nil {
		return "", fmt.Errorf("invalid credentials")
	}
	return userID, nil
}

// UnsafeLogin demonstrates VULNERABLE code - NEVER do this!
func (udb *UserDB) UnsafeLogin(username, password string) (string, error) {
	// DANGEROUS: string concatenation allows SQL injection
	query := fmt.Sprintf(
		"SELECT id FROM users WHERE username = '%s' AND password = '%s'",
		username, password,
	)
	var userID string
	err := udb.db.QueryRow(query).Scan(&userID)
	return userID, err
}

// ============================================================
// 2. XSS Defense
// ============================================================

// XSSSafeHandler uses html/template which auto-escapes by default.
func XSSSafeHandler(w http.ResponseWriter, r *http.Request) {
	userInput := r.URL.Query().Get("name")

	// html/template auto-escapes HTML entities
	tmpl := template.Must(template.New("greet").Parse(
		`<html><body><h1>Hello, {{.Name}}!</h1></body></html>`,
	))

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(w, struct{ Name string }{Name: userInput})
}

// SanitizeString provides basic input sanitization.
func SanitizeString(input string) string {
	// Remove script tags and event handlers
	re := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	input = re.ReplaceAllString(input, "")
	re = regexp.MustCompile(`(?i)on\w+\s*=`)
	input = re.ReplaceAllString(input, "")
	return input
}

// ============================================================
// 3. CSRF Defense
// ============================================================

var csrfSecret = generateSecret()

func generateSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// GenerateCSRFToken creates a new CSRF token.
func GenerateCSRFToken(sessionID string) string {
	h := hmac.New(sha256.New, []byte(csrfSecret))
	timestamp := time.Now().Unix()
	h.Write([]byte(fmt.Sprintf("%s:%d", sessionID, timestamp)))
	return fmt.Sprintf("%x:%d", h.Sum(nil), timestamp)
}

// ValidateCSRFToken checks if a CSRF token is valid.
func ValidateCSRFToken(sessionID, token string) bool {
	parts := strings.SplitN(token, ":", 2)
	if len(parts) != 2 {
		return false
	}

	var timestamp int64
	fmt.Sscanf(parts[1], "%d", &timestamp)

	// Token expires after 1 hour
	if time.Now().Unix()-timestamp > 3600 {
		return false
	}

	h := hmac.New(sha256.New, []byte(csrfSecret))
	h.Write([]byte(fmt.Sprintf("%s:%d", sessionID, timestamp)))
	expected := fmt.Sprintf("%x", h.Sum(nil))

	return hmac.Equal([]byte(parts[0]), []byte(expected))
}

// CSRFMiddleware validates CSRF tokens on state-changing requests.
func CSRFMiddleware(sessionID string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete {
			token := r.Header.Get("X-CSRF-Token")
			if token == "" {
				token = r.FormValue("csrf_token")
			}
			if !ValidateCSRFToken(sessionID, token) {
				http.Error(w, "Invalid CSRF token", http.StatusForbidden)
				return
			}
		}
		next(w, r)
	}
}

// ============================================================
// 4. Command Injection Defense
// ============================================================

// SafeLookup uses exec.Command with separate arguments (no shell injection).
func SafeLookup(domain string) (string, error) {
	// Validate domain format with whitelist regex
	validDomain := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}$`)
	if !validDomain.MatchString(domain) {
		return "", fmt.Errorf("invalid domain format")
	}

	// SAFE: arguments passed separately, no shell interpretation
	cmd := exec.Command("nslookup", domain)
	output, err := cmd.Output()
	return string(output), err
}

// UnsafeLookup demonstrates VULNERABLE code.
func UnsafeLookup(domain string) (string, error) {
	// DANGEROUS: shell interprets the full string
	cmd := exec.Command("sh", "-c", "nslookup "+domain)
	output, err := cmd.Output()
	return string(output), err
}

// ============================================================
// 5. Path Traversal Defense
// ============================================================

// SafeFileRead prevents path traversal attacks.
func SafeFileRead(baseDir, filename string) ([]byte, error) {
	// Clean the path to remove ../ etc.
	cleanPath := filepath.Clean(filepath.Join(baseDir, filename))

	// Ensure the resolved path is still within baseDir
	absBase, _ := filepath.Abs(baseDir)
	absPath, _ := filepath.Abs(cleanPath)

	if !strings.HasPrefix(absPath, absBase+string(filepath.Separator)) {
		return nil, fmt.Errorf("access denied: path traversal detected")
	}

	return nil, fmt.Errorf("file reading disabled in demo")
}

// ============================================================
// 6. Security Headers Middleware
// ============================================================

// SecurityHeaders adds common security headers to responses.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

// ============================================================
// 7. Rate Limiter (simple token bucket)
// ============================================================

// RateLimiter provides a simple in-memory rate limiter.
type RateLimiter struct {
	tokens    map[string]int
	lastRefill map[string]time.Time
	mu        sync.Mutex
	limit     int
	interval  time.Duration
}

func NewRateLimiter(limit int, interval time.Duration) *RateLimiter {
	return &RateLimiter{
		tokens:    make(map[string]int),
		lastRefill: make(map[string]time.Time),
		limit:     limit,
		interval:  interval,
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	last, exists := rl.lastRefill[key]
	if !exists || now.Sub(last) >= rl.interval {
		rl.tokens[key] = rl.limit
		rl.lastRefill[key] = now
	}

	if rl.tokens[key] > 0 {
		rl.tokens[key]--
		return true
	}
	return false
}

// ============================================================
// Demo Main
// ============================================================

func main() {
	mux := http.NewServeMux()

	// XSS safe handler
	mux.HandleFunc("/greet", XSSSafeHandler)

	// CSRF protected endpoint
	mux.HandleFunc("/api/update", CSRFMiddleware("demo-session", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"status":"ok"}`)
	}))

	// Safe command execution
	mux.HandleFunc("/lookup", func(w http.ResponseWriter, r *http.Request) {
		domain := r.URL.Query().Get("domain")
		result, err := SafeLookup(domain)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fmt.Fprintf(w, "<pre>%s</pre>", result)
	})

	// Apply security headers to all routes
	handler := SecurityHeaders(mux)

	fmt.Println("Security demo server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
```

## 执行预览

```bash
# Test XSS defense - input is auto-escaped
curl "http://localhost:8080/greet?name=<script>alert(1)</script>"
# Output: <h1>Hello, &lt;script&gt;alert(1)&lt;/script&gt;!</h1>

# Test CSRF - missing token
curl -X POST http://localhost:8080/api/update
# Output: Invalid CSRF token

# Test path traversal defense
# SafeFileRead("/data", "../../etc/passwd") → "access denied"
```

## 注意事项

| 安全威胁 | Go 防御方式 | 关键函数/包 |
|----------|------------|-------------|
| SQL 注入 | 参数化查询 | `database/sql` 占位符 `?` |
| XSS | 模板自动转义 | `html/template` |
| CSRF | HMAC Token | `crypto/hmac` |
| 命令注入 | 参数分离 | `exec.Command` |
| 路径遍历 | 路径清洗 | `filepath.Clean` |
| 中间人 | HTTPS | `crypto/tls` |

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| `fmt.Sprintf` 拼接 SQL | `db.Query("... WHERE x=?", val)` |
| `template/html` 的 `template.JS` 直接输出 | 使用 `html/template` 自动转义 |
| `exec.Command("sh", "-c", cmd+input)` | `exec.Command("tool", input)` |
| 直接拼接文件路径 | `filepath.Clean` + 前缀检查 |
| 明文存储密码 | `bcrypt.GenerateFromPassword` |
| HTTP 明文传输 | 强制 HTTPS + HSTS |

## 练习题

### 🟢 基础题
1. 为什么 `database/sql` 的占位符能防止 SQL 注入？
2. `html/template` 和 `text/template` 的安全区别是什么？

### 🟡 进阶题
3. 实现一个基于 Redis 的分布式 Rate Limiter。
4. 为上面的 CSRF 防护添加 Double Submit Cookie 模式。

### 🔴 挑战题
5. 实现一个完整的 JWT 认证中间件，支持 Token 刷新和黑名单。
6. 设计一个安全审计日志系统，记录所有敏感操作。

## 知识点总结

```
Go Web 安全防御
├── 输入层
│   ├── 参数验证 (正则/长度/类型)
│   ├── SQL 参数化
│   └── 命令参数分离
├── 处理层
│   ├── CSRF Token (HMAC)
│   ├── Rate Limiting
│   └── 权限检查
├── 输出层
│   ├── HTML 转义 (template)
│   ├── CSP 响应头
│   └── JSON 编码
└── 传输层
    ├── HTTPS (TLS)
    ├── HSTS
    └── Cookie Secure flag
```

## 举一反三

| 攻击类型 | Go 防御库 | 框架集成 |
|----------|-----------|---------|
| SQL 注入 | `database/sql` | GORM/Echo |
| XSS | `html/template` | Gin/ego |
| CSRF | `gorilla/csrf` | 中间件 |
| 暴力破解 | `golang.org/x/time/rate` | Rate Limiter |
| 密码泄露 | `golang.org/x/crypto/bcrypt` | 认证模块 |

## 参考资料

1. [OWASP Top 10](https://owasp.org/www-project-top-ten/)
2. [Go Security Checklist](https://github.com/guardrailsio/awesome-golang-security)
3. [gorilla/csrf](https://github.com/gorilla/csrf)
4. [Go Secure Coding Practices](https://checkmarx.gitbooks.io/go-scp/)

## 代码演进

### v1：基础参数化查询

```go
// Basic SQL injection defense only
db.QueryRow("SELECT id FROM users WHERE name = ?", username)
```

### v2：全面安全防护（本文代码）

加入 XSS、CSRF、命令注入、路径遍历、安全头、Rate Limiting 全链路防护。

### v3：生产级安全框架

```go
// Production-grade security:
// 1. JWT with RS256 (asymmetric)
// 2. OAuth2 / OpenID Connect integration
// 3. Content-Security-Policy with nonce
// 4. CORS with strict origin validation
// 5. Audit logging with tamper-proof storage
// 6. Dependency vulnerability scanning (govulncheck)
```
