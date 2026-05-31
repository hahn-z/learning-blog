---
title: "018 - HTTP客户端编程"
slug: "018-http-client"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.132+08:00"
updated_at: "2026-04-29T10:02:44.801+08:00"
reading_time: 21
tags: ["Web开发"]
---

# 048 - HTTP客户端编程

> 难度：⭐⭐⭐ | 预计学习时间：35分钟

## 一、概念讲解

Go的 `net/http` 包提供了强大的HTTP客户端和服务端支持。客户端方面，`http.Client` 是核心，配合 `http.Request` 可以发送各种HTTP请求。

关键组件：
- **http.Client**：管理连接池、Cookie、超时等
- **http.Request**：封装请求方法、URL、Header、Body
- **http.Transport**：底层传输控制（TLS、代理、Keep-Alive）
- **multipart.Writer**：文件上传

## 二、脑图

```
HTTP客户端编程
├── 基本请求
│   ├── http.Get/Post (DefaultClient)
│   ├── http.NewRequest 自定义请求
│   └── GET/POST/PUT/DELETE/PATCH
├── Client配置
│   ├── Timeout 总超时
│   ├── Transport 底层传输
│   ├── CheckRedirect 重定向控制
│   ├── Jar Cookie管理
│   └── 连接池控制
├── 请求处理
│   ├── Header 设置
│   ├── Body (io.Reader)
│   ├── Query参数
│   ├── Basic Auth
│   └── Bearer Token
├── 文件上传
│   ├── multipart.Writer
│   ├── 多文件上传
│   └── 表单字段混合
├── 高级特性
│   ├── TLS配置
│   ├── 代理设置
│   ├── 请求重试
│   └── Context超时控制
└── 响应处理
    ├── StatusCode
    ├── Header
    ├── Body (io.ReadCloser)
    └── 必须关闭Body!
```

## 三、完整Go代码

### v1: 基本GET/POST + JSON处理

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Post struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	UserId int    `json:"userId"`
}

func main() {
	client := &http.Client{Timeout: 10 * time.Second}

	// GET request
	resp, err := client.Get("https://jsonplaceholder.typicode.com/posts/1")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close() // ALWAYS close body!

	body, _ := io.ReadAll(resp.Body)
	var post Post
	json.Unmarshal(body, &post)
	fmt.Printf("GET: id=%d title=%q\n", post.ID, post.Title)

	// POST with JSON
	newPost := Post{Title: "Test", Body: "Hello Go", UserId: 1}
	jsonData, _ := json.Marshal(newPost)

	resp2, err := client.Post(
		"https://jsonplaceholder.typicode.com/posts",
		"application/json",
		bytes.NewReader(jsonData),
	)
	if err != nil {
		panic(err)
	}
	defer resp2.Body.Close()

	var created Post
	json.NewDecoder(resp2.Body).Decode(&created)
	fmt.Printf("POST: created id=%d\n", created.ID)

	// PUT request
	newPost.Title = "Updated Title"
	jsonData, _ = json.Marshal(newPost)
	req, _ := http.NewRequest("PUT",
		"https://jsonplaceholder.typicode.com/posts/1",
		bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")

	resp3, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp3.Body.Close()
	fmt.Printf("PUT: status=%d\n", resp3.StatusCode)

	// DELETE
	req, _ = http.NewRequest("DELETE",
		"https://jsonplaceholder.typicode.com/posts/1", nil)
	resp4, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp4.Body.Close()
	fmt.Printf("DELETE: status=%d\n", resp4.StatusCode)
}
```

**执行预览：**
```
GET: id=1 title="sunt aut facere repellat provident..."
POST: created id=101
PUT: status=200
DELETE: status=200
```

### v2: 自定义Client + Timeout + Cookie + TLS

```go
package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"time"
)

func main() {
	// Cookie jar for automatic cookie management
	jar, _ := cookiejar.New(nil)

	// Custom Transport with TLS config
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	}

	client := &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
		Jar:       jar,
	}

	// Request with custom headers
	req, _ := http.NewRequest("GET", "https://httpbin.org/headers", nil)
	req.Header.Set("User-Agent", "GoClient/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %d\nBody: %s\n", resp.StatusCode, string(body[:min(len(body), 200)]))

	// Check cookies
	fmt.Printf("Cookies: %v\n", jar.Cookies(req.URL))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
```

**执行预览：**
```
Status: 200
Body: {"headers":{"Accept":"application/json","Host":"httpbin.org","User-Agent":"GoClient/1.0"}}
Cookies: []
```

### v3: 文件上传 + 请求重试

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// RetryHTTP retries a request up to maxAttempts times
func RetryHTTP(client *http.Client, req *http.Request, maxAttempts int) (*http.Response, error) {
	var lastErr error
	for i := 0; i < maxAttempts; i++ {
		// Clone request body if needed
		var bodyBytes []byte
		if req.Body != nil {
			bodyBytes, _ = io.ReadAll(req.Body)
			req.Body.Close()
		}

		// Create a fresh request for each attempt
		newReq := req.Clone(req.Context())
		if bodyBytes != nil {
			newReq.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		}

		resp, err := client.Do(newReq)
		if err != nil {
			lastErr = err
			time.Sleep(time.Second * time.Duration(i+1)) // backoff
			continue
		}
		// Retry on server errors
		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("server error: %d", resp.StatusCode)
			time.Sleep(time.Second * time.Duration(i+1))
			continue
		}
		return resp, nil
	}
	return nil, fmt.Errorf("after %d attempts: %w", maxAttempts, lastErr)
}

func main() {
	// Multipart file upload
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	// Add a file field
	fileWriter, _ := w.CreateFormFile("upload", "test.txt")
	fileWriter.Write([]byte("Hello, this is file content!\nLine 2 of the file.\n"))

	// Add regular form fields
	w.WriteField("username", "gopher")
	w.WriteField("description", "A test upload")
	w.Close()

	req, _ := http.NewRequest("POST",
		"https://httpbin.org/post",
		&buf)
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}

	// Use retry
	resp, err := RetryHTTP(client, req, 3)
	if err != nil {
		fmt.Printf("Upload failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	output := string(body)
	if len(output) > 300 {
		output = output[:300] + "..."
	}
	fmt.Printf("Upload response (%d): %s\n", resp.StatusCode, output)
}
```

**执行预览：**
```
Upload response (200): {"args":{},"data":"","files":{"upload":"Hello, this is file content!\nLine 2 of the file.\n"},"form":{"description":"A test upload","username":"gopher"},...
```

## 四、注意事项

| 要点 | 说明 |
|------|------|
| 必须关闭Body | `defer resp.Body.Close()` 是必须的，否则连接无法复用 |
| DefaultClient无超时 | `http.Get()` 用的DefaultClient没有超时，生产环境危险 |
| 连接池复用 | 同一host的请求应共用Client，复用连接 |
| Context取消 | 用req.WithContext(ctx)支持请求取消 |
| 302重定向 | 默认跟随重定向，可自定义CheckRedirect |
| Body只能读一次 | 需要重试时要保存Body字节并重建Reader |

## 五、避坑指南

❌ 用DefaultClient无超时：
```go
resp, err := http.Get(url) // 可能永远阻塞
```
✅ 自定义Client带超时：
```go
client := &http.Client{Timeout: 10 * time.Second}
```

❌ 忘记关闭Body：
```go
resp, _ := client.Get(url)
// 没有 defer resp.Body.Close()
```
✅ 始终关闭：
```go
resp, err := client.Get(url)
if err != nil { return err }
defer resp.Body.Close()
```

❌ 重试时Body已消耗：
```go
client.Do(req) // Body reader已读完
client.Do(req) // 第二次Body为空
```
✅ 重试前保存并重建Body

❌ 忽略StatusCode：
```go
// 只检查err，不检查 resp.StatusCode
```
✅ 始终检查：
```go
if resp.StatusCode != http.StatusOK { /* handle error */ }
```

## 六、练习题

🟢 **基础题：** 写一个HTTP客户端，访问 https://httpbin.org/get 并打印所有响应头。

🟡 **进阶题：** 实现一个支持重试、超时、日志的HTTP Client封装，提供 GetJSON/PostJSON 方法。

🔴 **挑战题：** 实现并发下载器：给定一个URL列表，使用goroutine并发下载，支持进度显示和断点续传。

## 七、知识点总结

```
HTTP客户端
├── 核心对象
│   ├── http.Client (连接管理)
│   ├── http.Request (请求构造)
│   └── http.Response (响应处理)
├── 请求方法
│   ├── GET 查询
│   ├── POST 创建
│   ├── PUT 更新
│   ├── DELETE 删除
│   └── PATCH 部分更新
├── 高级配置
│   ├── Timeout (总体超时)
│   ├── Transport (底层传输)
│   ├── CookieJar (Cookie)
│   └── TLSConfig (安全)
└── 实战模式
    ├── JSON API调用
    ├── 文件上传 (multipart)
    ├── 请求重试 (backoff)
    └── 并发请求控制
```

## 八、举一反三

| 场景 | 方案 | 关键函数 |
|------|------|----------|
| REST API调用 | JSON序列化 + 自定义Client | json.NewDecoder(resp.Body) |
| 微服务通信 | 连接池 + 超时 + 重试 | Client{Transport, Timeout} |
| 文件下载 | 流式写入文件 + 进度 | io.Copy(file, resp.Body) |
| 文件上传 | multipart.Writer | CreateFormFile |
| 爬虫 | Cookie管理 + 代理 | CookieJar + Transport.Proxy |
| Webhook回调 | POST + JSON + 重试 | RetryHTTP模式 |

## 九、参考资料

- [Go官方文档：net/http](https://pkg.go.dev/net/http)
- [Go HTTP Client最佳实践](https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/)
- [MIME multipart](https://pkg.go.dev/mime/multipart)

## 十、代码演进总结

| 版本 | 重点 | 适用场景 |
|------|------|----------|
| v1 | 基本GET/POST/PUT/DELETE | 简单API调用 |
| v2 | 自定义Client+TLS+Cookie | 生产环境HTTP客户端 |
| v3 | 文件上传+请求重试 | 健壮的API客户端 |
