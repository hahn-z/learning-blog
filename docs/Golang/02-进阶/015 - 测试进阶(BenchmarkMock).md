---
title: "015 - 测试进阶(Benchmark/Mock)"
slug: "015-file-io"
category: "Golang进阶"
tech_stack: "Golang"
created_at: "2026-04-25T11:35:22.109+08:00"
updated_at: "2026-04-29T10:02:44.778+08:00"
reading_time: 36
tags: ["标准库"]
---

# 045 - 测试进阶（Benchmark / Mock）

> **难度：** ⭐⭐⭐（中级）
>
> **前提：** 掌握 Go 单元测试基础（TestXxx、表驱动测试、t.Run）。

---

## 一、概念讲解

单元测试验证正确性，基准测试验证性能，Mock 验证交互。三者结合才能构建完整的测试体系。

### 1.1 BenchmarkXxx 基准测试

基准测试函数以 `Benchmark` 开头，参数为 `*testing.B`。核心是 `b.N`——框架会自动调整迭代次数直到结果稳定。

### 1.2 b.N 机制

`b.N` 不是固定的。`go test -bench` 会逐步增大 `b.N`，直到测量时间达到稳定阈值（默认 1 秒）。你的代码必须能正确处理任意 `b.N` 值。

### 1.3 httptest 测试 HTTP

`net/http/httptest` 提供 `NewRecorder` 和 `NewServer`，无需启动真实服务器就能测试 HTTP 处理函数。

### 1.4 测试替身（Test Doubles）

| 替身类型 | 用途 | 特点 |
|---------|------|------|
| Stub | 返回预设值 | 最简单，不验证交互 |
| Spy | 记录调用信息 | 可验证调用次数和参数 |
| Fake | 简化实现 | 如内存数据库 |
| Mock | 验证交互协议 | 严格验证调用序列 |

### 1.5 Testify 断言库

Go 原生断言很啰嗦（`if got != want { t.Errorf() }`），Testify 提供流畅的断言 API。

---

## 二、脑图（ASCII）

```
Go 测试进阶
├── 基准测试
│   ├── BenchmarkXxx(*testing.B)
│   ├── b.N 自适应迭代
│   ├── b.ReportAllocs()
│   ├── b.ResetTimer()
│   ├── b.StopTimer() / b.StartTimer()
│   └── go test -bench
├── HTTP 测试
│   ├── httptest.NewRecorder()
│   ├── httptest.NewServer()
│   └── httptest.NewRequest()
├── 测试替身
│   ├── Stub（预设返回值）
│   ├── Spy（记录调用）
│   ├── Fake（简化实现）
│   └── Mock（交互验证）
├── Mock 工具
│   ├── 手写 Mock
│   ├── Testify/mock
│   └── golang/mock（gomock）
└── 断言库
    ├── testify/assert
    ├── testify/require
    └── testify/suite
```

---

## 三、完整 Go 代码

### 3.1 基准测试基础

```go
package stringutil

import (
    "strings"
    "testing"
)

// Reverse reverses a string.
func Reverse(s string) string {
    runes := []rune(s)
    for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
        runes[i], runes[j] = runes[j], runes[i]
    }
    return string(runes)
}

// Benchmark for string reverse
func BenchmarkReverse(b *testing.B) {
    s := "Hello, 世界!"
    b.ResetTimer() // Reset timer after setup
    for i := 0; i < b.N; i++ {
        Reverse(s)
    }
}

// Benchmark with different sizes
func BenchmarkReverse_Sizes(b *testing.B) {
    sizes := []int{10, 100, 1000}
    for _, size := range sizes {
        b.Run(fmt.Sprintf("len=%d", size), func(b *testing.B) {
            s := strings.Repeat("a", size)
            b.ResetTimer()
            for i := 0; i < b.N; i++ {
                Reverse(s)
            }
        })
    }
}

// Memory allocation tracking
func BenchmarkReverse_Allocs(b *testing.B) {
    b.ReportAllocs() // Report memory allocations per iteration
    s := "Hello, World"
    for i := 0; i < b.N; i++ {
        Reverse(s)
    }
}

// fmt import needed
import "fmt"
```

### 3.2 HTTP 测试

```go
package handler

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
)

// Response represents a JSON API response.
type Response struct {
    Message string `json:"message"`
    Status  int    `json:"status"`
}

// HelloHandler returns a JSON greeting.
func HelloHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(Response{
        Message: "Hello, World!",
        Status:  200,
    })
}

// Test HelloHandler using httptest.NewRecorder
func TestHelloHandler(t *testing.T) {
    // Create a new HTTP request
    req := httptest.NewRequest(http.MethodGet, "/hello", nil)
    
    // Create a ResponseRecorder (implements http.ResponseWriter)
    rec := httptest.NewRecorder()
    
    // Call the handler
    HelloHandler(rec, req)
    
    // Check status code
    if rec.Code != http.StatusOK {
        t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
    }
    
    // Check Content-Type header
    ct := rec.Header().Get("Content-Type")
    if ct != "application/json" {
        t.Errorf("Content-Type = %s, want application/json", ct)
    }
    
    // Decode response body
    var resp Response
    if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
        t.Fatalf("failed to decode response: %v", err)
    }
    
    if resp.Message != "Hello, World!" {
        t.Errorf("message = %s, want Hello, World!", resp.Message)
    }
}

// Test using httptest.NewServer for full integration
func TestHelloHandler_Server(t *testing.T) {
    // Create a test server
    ts := httptest.NewServer(http.HandlerFunc(HelloHandler))
    defer ts.Close()
    
    // Make a real HTTP request to the test server
    resp, err := http.Get(ts.URL + "/hello")
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
    }
}
```

### 3.3 手写 Stub

```go
package service

import "testing"

// UserRepository defines the interface for user data access.
type UserRepository interface {
    FindByID(id int) (*User, error)
    Save(user *User) error
}

// User represents a user entity.
type User struct {
    ID   int
    Name string
}

// UserService provides business logic for users.
type UserService struct {
    repo UserRepository
}

func NewUserService(repo UserRepository) *UserService {
    return &UserService{repo: repo}
}

// GetUserName returns the name of a user by ID.
func (s *UserService) GetUserName(id int) (string, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        return "", err
    }
    return user.Name, nil
}

// StubUserRepo is a stub that returns preset values.
type StubUserRepo struct {
    User  *User
    Error error
}

func (s *StubUserRepo) FindByID(id int) (*User, error) {
    return s.User, s.Error
}

func (s *StubUserRepo) Save(user *User) error {
    return nil
}

func TestGetUserName_Stub(t *testing.T) {
    stub := &StubUserRepo{
        User: &User{ID: 1, Name: "Alice"},
    }
    svc := NewUserService(stub)
    
    name, err := svc.GetUserName(1)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if name != "Alice" {
        t.Errorf("name = %s, want Alice", name)
    }
}

// Test error case with stub
func TestGetUserName_StubError(t *testing.T) {
    stub := &StubUserRepo{
        Error: errors.New("user not found"),
    }
    svc := NewUserService(stub)
    
    _, err := svc.GetUserName(1)
    if err == nil {
        t.Fatal("expected error, got nil")
    }
}
```

### 3.4 手写 Spy

```go
package service

import "testing"

// SpyUserRepo records method calls.
type SpyUserRepo struct {
    FindByIDCalls []int
    SaveCalls     []*User
    User          *User
    Error         error
}

func (s *SpyUserRepo) FindByID(id int) (*User, error) {
    s.FindByIDCalls = append(s.FindByIDCalls, id)
    return s.User, s.Error
}

func (s *SpyUserRepo) Save(user *User) error {
    s.SaveCalls = append(s.SaveCalls, user)
    return nil
}

func TestGetUserName_Spy(t *testing.T) {
    spy := &SpyUserRepo{
        User: &User{ID: 42, Name: "Bob"},
    }
    svc := NewUserService(spy)
    
    svc.GetUserName(42)
    
    // Verify FindByID was called with correct ID
    if len(spy.FindByIDCalls) != 1 {
        t.Fatalf("FindByID called %d times, want 1", len(spy.FindByIDCalls))
    }
    if spy.FindByIDCalls[0] != 42 {
        t.Errorf("FindByID called with %d, want 42", spy.FindByIDCalls[0])
    }
}
```

### 3.5 Fake 实现

```go
package service

import (
    "errors"
    "testing"
)

// FakeUserRepo is an in-memory implementation of UserRepository.
type FakeUserRepo struct {
    users map[int]*User
}

func NewFakeUserRepo() *FakeUserRepo {
    return &FakeUserRepo{
        users: make(map[int]*User),
    }
}

func (f *FakeUserRepo) FindByID(id int) (*User, error) {
    user, ok := f.users[id]
    if !ok {
        return nil, errors.New("user not found")
    }
    return user, nil
}

func (f *FakeUserRepo) Save(user *User) error {
    f.users[user.ID] = user
    return nil
}

func TestUserService_Integration(t *testing.T) {
    // Use fake for more realistic testing
    fake := NewFakeUserRepo()
    fake.Save(&User{ID: 1, Name: "Alice"})
    fake.Save(&User{ID: 2, Name: "Bob"})
    
    svc := NewUserService(fake)
    
    name, err := svc.GetUserName(1)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if name != "Alice" {
        t.Errorf("name = %s, want Alice", name)
    }
    
    // Test not found
    _, err = svc.GetUserName(999)
    if err == nil {
        t.Fatal("expected error for non-existent user")
    }
}
```

### 3.6 Testify 断言库

```go
package service

import (
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestGetUserName_Testify(t *testing.T) {
    fake := NewFakeUserRepo()
    fake.Save(&User{ID: 1, Name: "Alice"})
    svc := NewUserService(fake)

    // assert: continues on failure (like t.Error)
    name, err := svc.GetUserName(1)
    assert.NoError(t, err)
    assert.Equal(t, "Alice", name)

    // require: stops on failure (like t.Fatal)
    _, err = svc.GetUserName(999)
    require.Error(t, err)
    assert.Contains(t, err.Error(), "not found")
}
```

### 3.7 Testify Mock

```go
package service

import (
    "testing"

    "github.com/stretchr/testify/mock"
    "github.com/stretchr/testify/assert"
)

// MockUserRepo uses testify's mock package.
type MockUserRepo struct {
    mock.Mock
}

func (m *MockUserRepo) FindByID(id int) (*User, error) {
    args := m.Called(id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*User), args.Error(1)
}

func (m *MockUserRepo) Save(user *User) error {
    args := m.Called(user)
    return args.Error(0)
}

func TestGetUserName_Mock(t *testing.T) {
    mockRepo := new(MockUserRepo)
    
    // Set up expectation
    mockRepo.On("FindByID", 1).Return(&User{ID: 1, Name: "Alice"}, nil)
    
    svc := NewUserService(mockRepo)
    name, err := svc.GetUserName(1)
    
    assert.NoError(t, err)
    assert.Equal(t, "Alice", name)
    
    // Verify all expectations were met
    mockRepo.AssertExpectations(t)
}

func TestGetUserName_MockError(t *testing.T) {
    mockRepo := new(MockUserRepo)
    
    mockRepo.On("FindByID", 999).Return(nil, errors.New("not found"))
    
    svc := NewUserService(mockRepo)
    _, err := svc.GetUserName(999)
    
    assert.Error(t, err)
    mockRepo.AssertExpectations(t)
}
```

---

## 四、执行预览

```bash
# Run benchmarks
$ go test -bench=. -benchmem
BenchmarkReverse-8                  8732446    136 ns/op    32 B/op    1 allocs/op
BenchmarkReverse_Sizes/len=10-8    18234567     65.2 ns/op    16 B/op    1 allocs/op
BenchmarkReverse_Sizes/len=100-8    6234512    192 ns/op    32 B/op    1 allocs/op
BenchmarkReverse_Sizes/len=1000-8   1234567    960 ns/op   256 B/op    1 allocs/op
BenchmarkReverse_Allocs-8           8732446    136 ns/op    32 B/op    1 allocs/op
PASS

# Run all tests with verbose
$ go test -v ./...
=== RUN   TestHelloHandler
--- PASS: TestHelloHandler (0.00s)
=== RUN   TestGetUserName_Stub
--- PASS: TestGetUserName_Stub (0.00s)
=== RUN   TestGetUserName_Spy
--- PASS: TestGetUserName_Spy (0.00s)
=== RUN   TestUserService_Integration
--- PASS: TestUserService_Integration (0.00s)
=== RUN   TestGetUserName_Testify
--- PASS: TestGetUserName_Testify (0.00s)
=== RUN   TestGetUserName_Mock
--- PASS: TestGetUserName_Mock (0.00s)
PASS
```

---

## 五、注意事项

| 项目 | 说明 |
|------|------|
| b.N 不可修改 | `b.N` 由框架控制，不要手动修改 |
| 基准测试耗时 | 基准测试默认运行时间较长，用 `-benchtime` 控制 |
| ResetTimer | 如果 setup 有耗时操作，用 `b.ResetTimer()` 排除 |
| 并发基准 | `-cpu` 参数测试不同 GOMAXPROCS 下的性能 |
| Mock 过度 | 不要 Mock 一切，优先用 Fake 或真实实现 |
| Testify 依赖 | 引入 Testify 意味着项目依赖第三方库，评估是否值得 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 基准测试中包含 setup 耗时 | 用 `b.ResetTimer()` 排除初始化 |
| `b.N` 固定为某值循环 | 用 `for i := 0; i < b.N; i++` 标准模式 |
| Mock 所有依赖导致测试脆弱 | 优先 Fake，只在边界处 Mock |
| 忘记 `defer ts.Close()` | httptest.Server 必须关闭 |
| 只测 Happy Path | 覆盖错误路径、边界条件、并发场景 |
| 断言 error 后继续用返回值 | 用 `require.NoError` 失败即停 |

---

## 七、练习题

### 🟢 简单

为 `strings.Contains` 编写基准测试，对比不同长度字符串的性能。使用 `b.ReportAllocs()`。

### 🟡 中等

实现一个 HTTP Handler `GET /users/:id`，返回 JSON。用 `httptest.NewRecorder` 测试以下场景：
- 正常返回 200
- 用户不存在返回 404
- 无效 ID 返回 400

### 🔴 困难

为一个依赖外部 API 的服务编写测试：
1. 定义接口抽象外部调用
2. 用 Fake 实现（内存缓存模拟）
3. 用 Mock 验证调用次数和参数
4. 编写基准测试对比 Fake vs Mock 的测试执行速度

---

## 八、知识点总结

```
Go 测试进阶
├── 基准测试
│   ├── func BenchmarkXxx(*testing.B)
│   ├── b.N 自适应
│   ├── b.ReportAllocs()
│   ├── b.ResetTimer()
│   └── go test -bench -benchmem
├── HTTP 测试
│   ├── httptest.NewRecorder
│   ├── httptest.NewRequest
│   ├── httptest.NewServer
│   └── httptest.NewUnstartedServer
├── 测试替身
│   ├── Stub（预设值）
│   ├── Spy（记录调用）
│   ├── Fake（简化实现）
│   └── Mock（交互验证）
└── 工具库
    ├── testify/assert
    ├── testify/require
    ├── testify/mock
    └── testify/suite
```

---

## 九、举一反三

| 测试需求 | 方案 | 适用场景 |
|---------|------|---------|
| 验证函数正确性 | 单元测试 + 表驱动 | 纯函数、工具类 |
| 测量函数性能 | Benchmark + benchmem | 热路径、优化前后对比 |
| 测试 HTTP API | httptest.Recorder | 单个 Handler |
| 测试 HTTP 客户端 | httptest.Server | 调用外部 API 的代码 |
| 隔离外部依赖 | Stub/Fake | 数据库、文件系统 |
| 验证调用交互 | Spy/Mock | 确认某个方法被调用 |
| 测试套件管理 | testify/suite | 多个相关测试共享 setup |

---

## 十、参考资料

1. [Go testing 包文档](https://pkg.go.dev/testing)
2. [Go httptest 包文档](https://pkg.go.dev/net/http/httptest)
3. [Testify GitHub](https://github.com/stretchr/testify)
4. [Go Mock (gomock)](https://github.com/golang/mock)
5. [Testing in Go - YouTube](https://www.youtube.com/watch?v=8hQG7QlcLBk)

---

## 十一、代码演进

### v1：Stub 最简实现

```go
type StubRepo struct {
    user *User
}

func (s *StubRepo) FindByID(id int) (*User, error) {
    return s.user, nil
}

// Simple but inflexible: always returns the same value.
```

### v2：Spy + Fake 结合

```go
type FakeRepo struct {
    users map[int]*User
    calls []string
}

func (f *FakeRepo) FindByID(id int) (*User, error) {
    f.calls = append(f.calls, "FindByID")
    return f.users[id], nil
}

// Better: realistic behavior + call tracking.
```

### v3：Testify Mock 生产级

```go
type MockRepo struct {
    mock.Mock
}

func (m *MockRepo) FindByID(id int) (*User, error) {
    args := m.Called(id)
    return args.Get(0).(*User), args.Error(1)
}

// In test:
mockRepo.On("FindByID", 1).Return(&User{Name: "Alice"}, nil).Once()
mockRepo.AssertCalled(t, "FindByID", 1)
mockRepo.AssertExpectations(t)

// Full control: return values, call count, order verification.
```

---

## 十二、总结

基准测试用 `b.N` 自适应迭代，配合 `-benchmem` 可以精确定位性能瓶颈。HTTP 测试用 `httptest` 包，不需要真实服务器。Mock 方面，Go 社区推崇**接口 + 手写替身**胜过 Mock 框架——简单的 Stub/Fake 往往比 gomock 更清晰。Testify 的断言库能减少样板代码，但不要让它替代思考。记住：**测试的价值在于捕获 bug，不在于覆盖率数字。**
