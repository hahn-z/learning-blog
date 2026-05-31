---
title: "023-Kratos单元测试"
slug: "023-kratos-testing"
category: "Kratos框架"
tech_stack: "Golang"
created_at: "2026-04-28T20:14:39.543+08:00"
updated_at: "2026-04-29T10:02:45.455+08:00"
reading_time: 22
tags: []
---


# 023-Kratos单元测试

> 难度：⭐⭐⭐（中级）
>
> 本文系统讲解 Kratos 项目各层的单元测试策略，从 biz 层 mock 测试到 data 层集成测试，确保代码质量和可维护性。

---

## 一、概念讲解

### 1.1 DDD 分层与测试策略

Kratos 采用 DDD（领域驱动设计）分层架构，每层职责不同，测试策略也不同：

| 层 | 职责 | 测试方式 |
|----|------|---------|
| service | 协议转换，调用 biz | mock biz 层 |
| biz | 业务逻辑 | mock repo 接口 |
| data | 数据访问 | 集成测试（真实DB或mock） |

测试金字塔：大量单元测试（biz/service）+ 少量集成测试（data）+ 极少E2E测试。

### 1.2 gomock 简介

`gomock` 是 Go 官方维护的 mock 生成工具。通过 `mockgen` 命令根据接口生成 mock 实现，用于在测试中替换真实依赖。

```bash
# Install mockgen
go install go.uber.org/mock/mockgen@latest

# Generate mock for repository interface
mockgen -source=internal/biz/repository.go -destination=internal/biz/mock/repository_mock.go
```

---

## 二、脑图

```
Kratos单元测试
├── biz层测试
│   ├── mock Repository
│   ├── 测试业务逻辑
│   └── 表驱动测试
├── service层测试
│   ├── mock Biz(usecase)
│   └── 请求/响应验证
├── data层测试
│   ├── SQLite内存数据库
│   ├── 真实SQL执行
│   └── 事务测试
├── 工具链
│   ├── gomock
│   ├── testify
│   └── go test
└── 覆盖率
    ├── go test -cover
    └── HTML覆盖率报告
```

---

## 三、完整代码

### v1: biz 层测试

```go
// internal/biz/user.go - Business logic
package biz

import (
	"context"
	"fmt"
)

// UserRepo defines the repository interface (port)
type UserRepo interface {
	GetUser(ctx context.Context, id int64) (*User, error)
	ListUsers(ctx context.Context, page, size int) ([]*User, int64, error)
	CreateUser(ctx context.Context, user *User) (*User, error)
}

// User domain model
type User struct {
	ID       int64
	Username string
	Email    string
	Role     string
}

// UserUsecase implements business logic
type UserUsecase struct {
	repo UserRepo
}

// NewUserUsecase creates a new usecase
func NewUserUsecase(repo UserRepo) *UserUsecase {
	return &UserUsecase{repo: repo}
}

// GetUser returns a user by ID
func (uc *UserUsecase) GetUser(ctx context.Context, id int64) (*User, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid user id: %d", id)
	}
	user, err := uc.repo.GetUser(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user failed: %w", err)
	}
	return user, nil
}

// ListUsers returns paginated user list
func (uc *UserUsecase) ListUsers(ctx context.Context, page, size int) ([]*User, int64, error) {
	if page <= 0 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 10
	}
	return uc.repo.ListUsers(ctx, page, size)
}
```

```go
// internal/biz/user_test.go - biz layer tests
package biz

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"go.uber.org/mock/gomock"
)

//go:generate mockgen -source=user.go -destination=mock/user_repo_mock.go -package=mock

// TestGetUser_Success tests successful user retrieval
func TestGetUser_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock repository
	mockRepo := NewMockUserRepo(ctrl)

	// Set up expectation
	expectedUser := &User{ID: 1, Username: "admin", Email: "admin@test.com"}
	mockRepo.EXPECT().
		GetUser(gomock.Any(), int64(1)).
		Return(expectedUser, nil)

	// Test
	uc := NewUserUsecase(mockRepo)
	user, err := uc.GetUser(context.Background(), 1)

	assert.NoError(t, err)
	assert.Equal(t, "admin", user.Username)
}

// TestGetUser_InvalidID tests validation
func TestGetUser_InvalidID(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := NewMockUserRepo(ctrl)
	uc := NewUserUsecase(mockRepo)

	_, err := uc.GetUser(context.Background(), -1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid user id")

	// Repository should NOT be called
	mockRepo.EXPECT().GetUser(gomock.Any(), gomock.Any()).Times(0)
}

// TestGetUser_RepoError tests repository error handling
func TestGetUser_RepoError(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := NewMockUserRepo(ctrl)
	mockRepo.EXPECT().
		GetUser(gomock.Any(), int64(999)).
		Return(nil, errors.New("not found"))

	uc := NewUserUsecase(mockRepo)
	_, err := uc.GetUser(context.Background(), 999)
	assert.Error(t, err)
}

// Table-driven test for ListUsers pagination
func TestListUsers_Pagination(t *testing.T) {
	tests := []struct {
		name      string
		page      int
		size      int
		wantPage  int
		wantSize  int
	}{
		{"default pagination", 0, 0, 1, 10},
		{"negative values", -1, -5, 1, 10},
		{"oversized page", 1, 200, 1, 100},
		{"valid input", 2, 20, 2, 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			mockRepo := NewMockUserRepo(ctrl)
			mockRepo.EXPECT().
				ListUsers(gomock.Any(), tt.wantPage, tt.wantSize).
				Return([]*User{}, int64(0), nil)

			uc := NewUserUsecase(mockRepo)
			_, _, err := uc.ListUsers(context.Background(), tt.page, tt.size)
			assert.NoError(t, err)
		})
	}
}
```

### v2: service 层测试

```go
// internal/service/user_test.go - Service layer tests
package service

import (
	"context"
	"testing"

	pb "your-project/api/user/v1"
	"github.com/stretchr/testify/assert"
	"go.uber.org/mock/gomock"
)

//go:generate mockgen -source=user.go -destination=mock/user_uc_mock.go -package=mock

func TestGetUser_API(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockUC := mock.NewMockUserUsecase(ctrl)
	svc := &UserService{uc: mockUC}

	// Set up mock expectation
	mockUC.EXPECT().
		GetUser(gomock.Any(), int64(1)).
		Return(&biz.User{ID: 1, Username: "admin", Email: "admin@test.com"}, nil)

	// Call service
	resp, err := svc.GetUser(context.Background(), &pb.GetUserRequest{Id: 1})

	assert.NoError(t, err)
	assert.Equal(t, int64(1), resp.Id)
	assert.Equal(t, "admin", resp.Username)
}
```

### v3: data 层测试（真实数据库）

```go
// internal/data/user_test.go - Data layer integration tests
package data

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// UserRepoTestSuite sets up test database
type UserRepoTestSuite struct {
	suite.Suite
	db   *gorm.DB
	repo *userRepo
}

// SetupTest runs before each test
func (s *UserRepoTestSuite) SetupSuite() {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	s.Require().NoError(err)
	s.db = db
	// AutoMigrate for test
	s.db.AutoMigrate(&User{})
	s.repo = &userRepo{db: db}
}

// TearDownSuite closes database
func (s *UserRepoTestSuite) TearDownSuite() {
	sqlDB, _ := s.db.DB()
	sqlDB.Close()
}

func (s *UserRepoTestSuite) TestCreateUser() {
	user := &User{
		Username: "testuser",
		Email:    "test@test.com",
		Password: "hashedpassword",
	}
	created, err := s.repo.CreateUser(context.Background(), user)
	s.Assert().NoError(err)
	s.Assert().Equal(int64(1), created.ID)
}

func (s *UserRepoTestSuite) TestGetUser_NotFound() {
	_, err := s.repo.GetUser(context.Background(), 999)
	s.Assert().Error(err)
}

// Run the suite
func TestUserRepoSuite(t *testing.T) {
	suite.Run(t, new(UserRepoTestSuite))
}
```

---

## 四、执行预览

```bash
# Run all tests
$ go test ./internal/biz/... -v
=== RUN   TestGetUser_Success
--- PASS: TestGetUser_Success (0.00s)
=== RUN   TestGetUser_InvalidID
--- PASS: TestGetUser_InvalidID (0.00s)
=== RUN   TestListUsers_Pagination
=== RUN   TestListUsers/default_pagination
--- PASS: TestListUsers/default_pagination (0.00s)
PASS

# Coverage report
$ go test ./... -cover -coverprofile=coverage.out
$ go tool cover -html=coverage.out -o coverage.html
```

---

## 五、注意事项

| 事项 | 说明 |
|------|------|
| Mock 生成 | 使用 `//go:generate` 指令，CI 中自动生成 |
| 测试隔离 | 每个测试独立 setup/teardown，不依赖执行顺序 |
| Context | 使用 `context.Background()` 而非 `context.TODO()` |
| 表驱动 | 多场景测试使用 table-driven pattern |
| 构建标签 | 集成测试用 `//go:build integration` 标签区分 |

---

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 测试私有方法 | 通过公共接口间接测试 |
| Mock 返回 nil 不设 EXPECT | 每个 mock 调用都设期望 |
| 不检查 error | `assert.NoError(t, err)` |
| 共享 mock controller | 每个测试创建新 controller |
| 测试中硬编码时间 | 使用接口注入时钟 |
| data 层用 mock | 用 SQLite 内存库做真实 SQL 测试 |

---

## 七、练习题

🟢 **初级：** 为一个简单的 biz 方法编写表驱动测试，覆盖正常和异常场景。

🟡 **中级：** 使用 gomock 生成 mock，测试 service 层的请求转换和错误处理。

🔴 **高级：** 搭建完整的测试流水线，包含单元测试、集成测试、覆盖率门槛（>80%）。

---

## 八、知识点总结

```
Kratos测试体系
├── biz层
│   ├── mock Repository接口
│   ├── 表驱动测试
│   └── 边界条件验证
├── service层
│   ├── mock Usecase接口
│   └── Proto请求/响应验证
├── data层
│   ├── SQLite内存库
│   └── testify suite
├── 工具
│   ├── gomock (mock生成)
│   ├── testify (断言)
│   └── go test -cover (覆盖率)
└── CI集成
    ├── 自动生成mock
    ├── 覆盖率门槛
    └── 构建标签区分
```

---

## 九、举一反三

| 场景 | 方案 |
|------|------|
| 测试中间件 | 创建 mock Transport，验证 header 提取 |
| 测试配置加载 | 使用临时配置文件 |
| 测试并发安全 | `go test -race` 检测竞态 |
| Mock 外部 API | 使用 `httptest.Server` 模拟 |
| E2E 测试 | Docker Compose 启动完整环境 |

---

## 十、参考资料

- [gomock 官方文档](https://github.com/uber-go/mock)
- [testify 断言库](https://github.com/stretchr/testify)
- [Go 测试最佳实践](https://go.dev/doc/tutorial/add-a-test)

---

## 十一、代码演进

| 版本 | 变化 |
|------|------|
| v1 | biz 层 mock 测试 + 表驱动模式 |
| v2 | service 层 mock 测试 + Proto 验证 |
| v3 | data 层集成测试 + SQLite 内存库 + 完整测试套件 |
