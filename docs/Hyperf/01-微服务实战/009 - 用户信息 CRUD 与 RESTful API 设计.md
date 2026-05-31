---
title: "009 - 用户信息 CRUD 与 RESTful API 设计"
slug: "009-user-crud-restful"
category: "Hyperf微服务实战"
tech_stack: "Hyperf"
created_at: "2026-05-01T21:52:08.76+08:00"
updated_at: "2026-05-01T22:22:55.92+08:00"
reading_time: 9
tags: []
---

# 用户信息 CRUD 与 RESTful API 设计

> **难度：** ⭐⭐⭐
> **前置知识：** JWT 认证（008）、数据库模型（006）、HTTP 方法语义
> **预估用时：** 65 分钟

---

## 一、概念讲解

**一句话定义：** CRUD（Create、Read、Update、Delete）是数据操作的标准模式，RESTful API 用 HTTP 动词映射 CRUD 操作，构建语义化的资源接口。

**现实类比：** 管理用户资料像图书馆借书——借书（Create）、查书（Read）、更新借阅状态（Update）、还书（Delete）。RESTful API 把每种操作映射到 HTTP 方法，用 URL 资源路径表达操作对象，清晰易懂。

**技术场景：** 用户服务需要提供完整的用户信息管理 API：创建用户（POST）、获取用户详情（GET）、更新用户资料（PUT）、删除用户（DELETE）。遵循 RESTful 规范让 API 接口语义清晰，便于前端调用和第三方集成。

---

## 二、实时脑图

```
RESTful API 设计
┌──────────────────────────────────────────────┐
│              HTTP 方法 → CRUD                │
├──────────────────────────────────────────────┤
│ GET    /users          → List   (分页查询)   │
│ GET    /users/{id}     → Read   (获取详情)   │
│ POST   /users          → Create (创建用户)   │
│ PUT    /users/{id}     → Update (全量更新)   │
│ PATCH  /users/{id}     → Update (部分更新)   │
│ DELETE /users/{id}     → Delete (删除用户)   │
└──────────────────────────────────────────────┘

参数过滤与分页:
GET /users?status=active&page=1&size=20&sort=created_at:desc
```

---

## 三、完整代码

### 3.1 用户 Controller（完整 CRUD）

```php
<?php
// ✅ app/Controller/UserController.php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserService;
use Hyperf\Context\Context;
use Hyperf\HttpServer\Annotation\AutoController;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Di\Annotation\Inject;
use Psr\Http\Message\ResponseInterface;

#[AutoController(prefix: "users")]
class UserController
{
    #[Inject]
    private UserService $userService;

    // ✅ GET /users - List users (paginated, filtered)
    public function index(RequestInterface $request): array
    {
        $page = (int) $request->input('page', 1);
        $size = (int) $request->input('size', 20);
        $status = $request->input('status');
        $keyword = $request->input('keyword');

        if ($size > 100) {
            return ['code' => 400, 'message' => 'Size cannot exceed 100'];
        }

        return $this->userService->listUsers($page, $size, $status, $keyword);
    }

    // ✅ GET /users/{id} - Get user by ID
    public function show(RequestInterface $request): array
    {
        $id = (int) $request->input('id', 0);

        if ($id <= 0) {
            return ['code' => 400, 'message' => 'Invalid user ID'];
        }

        return $this->userService->getUser($id);
    }

    // ✅ POST /users - Create new user (admin only)
    public function store(RequestInterface $request): array
    {
        $data = $request->all();

        return $this->userService->createUser($data);
    }

    // ✅ PUT /users/{id} - Update user (full update)
    public function update(RequestInterface $request): array
    {
        $id = (int) $request->input('id', 0);
        $data = $request->all();

        if ($id <= 0) {
            return ['code' => 400, 'message' => 'Invalid user ID'];
        }

        return $this->userService->updateUser($id, $data);
    }

    // ✅ PATCH /users/{id} - Partial update user
    public function patch(RequestInterface $request): array
    {
        $id = (int) $request->input('id', 0);
        $data = $request->all();

        if ($id <= 0) {
            return ['code' => 400, 'message' => 'Invalid user ID'];
        }

        return $this->userService->updateUser($id, $data, true);
    }

    // ✅ DELETE /users/{id} - Delete user (soft delete)
    public function destroy(RequestInterface $request): array
    {
        $id = (int) $request->input('id', 0);

        if ($id <= 0) {
            return ['code' => 400, 'message' => 'Invalid user ID'];
        }

        return $this->userService->deleteUser($id);
    }

    // ✅ GET /users/me - Get current user profile
    public function me(RequestInterface $request): array
    {
        $userId = Context::get('user_id', 0);

        if ($userId === 0) {
            return ['code' => 401, 'message' => 'Unauthorized'];
        }

        return $this->userService->getUser($userId);
    }

    // ✅ PUT /users/me - Update current user profile
    public function updateMe(RequestInterface $request): array
    {
        $userId = Context::get('user_id', 0);

        if ($userId === 0) {
            return ['code' => 401, 'message' => 'Unauthorized'];
        }

        $data = $request->only(['nickname', 'avatar', 'bio', 'gender', 'birthday']);

        return $this->userService->updateUserProfile($userId, $data);
    }
}
```

### 3.2 UserService（CRUD 业务逻辑）

```php
<?php
// ✅ app/Service/UserService.php

declare(strict_types=1);

namespace App\Service;

use App\Model\User;
use App\Model\UserProfile;
use App\Validator\UserValidator;
use Hyperf\DbConnection\Db;
use Hyperf\Paginator\LengthAwarePaginator;
use Hyperf\Di\Annotation\Inject;
use Psr\Log\LoggerInterface;

class UserService
{
    #[Inject]
    private LoggerInterface $logger;

    // ✅ List users with pagination and filtering
    public function listUsers(
        int $page = 1,
        int $size = 20,
        ?string $status = null,
        ?string $keyword = null
    ): array {
        $query = User::query();

        // 🟢 Filter by status
        if ($status !== null && in_array($status, ['active', 'inactive', 'banned'])) {
            $query->where('status', $status);
        }

        // 🟢 Search by keyword (username or email)
        if ($keyword !== null) {
            $query->where(function ($q) use ($keyword) {
                $q->where('username', 'like', "%{$keyword}%")
                  ->orWhere('email', 'like', "%{$keyword}%");
            });
        }

        // 🟢 Pagination
        $paginator = $query->with('profile')
            ->orderBy('created_at', 'desc')
            ->paginate($size, ['*'], 'page', $page);

        return [
            'code' => 0,
            'data' => $paginator->items(),
            'pagination' => [
                'page' => $paginator->currentPage(),
                'size' => $paginator->perPage(),
                'total' => $paginator->total(),
                'pages' => $paginator->lastPage(),
            ],
        ];
    }

    // ✅ Get user by ID with profile
    public function getUser(int $id): array
    {
        $user = User::with('profile')->find($id);

        if (!$user) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        return [
            'code' => 0,
            'data' => [
                'id' => $user->id,
                'username' => $user->username,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status,
                'created_at' => $user->created_at->toDateTimeString(),
                'profile' => $user->profile ? [
                    'nickname' => $user->profile->nickname,
                    'avatar' => $user->profile->avatar,
                    'bio' => $user->profile->bio,
                    'gender' => $user->profile->gender,
                    'birthday' => $user->profile->birthday?->toDateString(),
                ] : null,
            ],
        ];
    }

    // ✅ Create new user (admin operation)
    public function createUser(array $data): array
    {
        // 🟢 Validate input
        $errors = UserValidator::validateCreate($data);
        if (!empty($errors)) {
            return ['code' => 400, 'message' => 'Validation failed', 'errors' => $errors];
        }

        try {
            return Db::transaction(function () use ($data) {
                // Check duplicate
                $exists = User::where('email', $data['email'] ?? null)
                    ->orWhere('phone', $data['phone'] ?? null)
                    ->exists();

                if ($exists) {
                    return ['code' => 409, 'message' => 'Email or phone already exists'];
                }

                // Create user
                $user = User::create([
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'] ?? null,
                    'username' => $data['username'],
                    'password' => $data['password'] ?? 'Password123',  // Default password
                    'status' => $data['status'] ?? 'active',
                ]);

                // Create profile
                UserProfile::create([
                    'user_id' => $user->id,
                    'nickname' => $data['nickname'] ?? $user->username,
                ]);

                $this->logger->info('User created by admin', ['user_id' => $user->id]);

                return ['code' => 0, 'data' => ['user_id' => $user->id]];
            });
        } catch (\Throwable $e) {
            $this->logger->error('Create user failed', ['error' => $e->getMessage()]);
            return ['code' => 500, 'message' => 'Create user failed'];
        }
    }

    // ✅ Update user (admin operation)
    public function updateUser(int $id, array $data, bool $partial = false): array
    {
        $user = User::find($id);

        if (!$user) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        try {
            // 🟢 Prepare update data
            $updateData = $partial ? $data : array_filter($data, fn($v) => $v !== null);

            // Validate if updating sensitive fields
            if (isset($updateData['email']) || isset($updateData['phone'])) {
                $duplicate = User::where(function ($q) use ($updateData, $id) {
                    if (isset($updateData['email'])) {
                        $q->orWhere('email', $updateData['email']);
                    }
                    if (isset($updateData['phone'])) {
                        $q->orWhere('phone', $updateData['phone']);
                    }
                })->where('id', '!=', $id)->exists();

                if ($duplicate) {
                    return ['code' => 409, 'message' => 'Email or phone already exists'];
                }
            }

            // Update user
            $user->update($updateData);

            $this->logger->info('User updated', ['user_id' => $id]);

            return ['code' => 0, 'message' => 'User updated'];
        } catch (\Throwable $e) {
            $this->logger->error('Update user failed', ['error' => $e->getMessage()]);
            return ['code' => 500, 'message' => 'Update user failed'];
        }
    }

    // ✅ Update user profile (user self)
    public function updateUserProfile(int $userId, array $data): array
    {
        $profile = UserProfile::where('user_id', $userId)->first();

        if (!$profile) {
            // Create profile if not exists
            $profile = UserProfile::create(['user_id' => $userId] + $data);
        } else {
            // Update profile
            $profile->update($data);
        }

        $this->logger->info('User profile updated', ['user_id' => $userId]);

        return ['code' => 0, 'message' => 'Profile updated'];
    }

    // ✅ Delete user (soft delete)
    public function deleteUser(int $id): array
    {
        $user = User::find($id);

        if (!$user) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        try {
            // 🔴 Soft delete
            $user->delete();

            $this->logger->info('User deleted', ['user_id' => $id]);

            return ['code' => 0, 'message' => 'User deleted'];
        } catch (\Throwable $e) {
            $this->logger->error('Delete user failed', ['error' => $e->getMessage()]);
            return ['code' => 500, 'message' => 'Delete user failed'];
        }
    }

    // ✅ Restore deleted user
    public function restoreUser(int $id): array
    {
        $user = User::withTrashed()->find($id);

        if (!$user) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        if (!$user->trashed()) {
            return ['code' => 400, 'message' => 'User is not deleted'];
        }

        $user->restore();

        $this->logger->info('User restored', ['user_id' => $id]);

        return ['code' => 0, 'message' => 'User restored'];
    }
}
```

### 3.3 路由配置（RESTful）

```php
<?php
// ✅ config/routes.php

use Hyperf\HttpServer\Router\Router;

// 🟢 Public routes (no auth required)
Router::addGroup('/users', function () {
    Router::post('/', 'App\Controller\UserController@store');    // Admin only in practice
});

// 🟢 Protected routes (JWT auth required)
Router::addGroup('/users', function () {
    Router::get('/', 'App\Controller\UserController@index');
    Router::get('/{id}', 'App\Controller\UserController@show');
    Router::put('/{id}', 'App\Controller\UserController@update');
    Router::patch('/{id}', 'App\Controller\UserController@patch');
    Router::delete('/{id}', 'App\Controller\UserController@destroy');
    
    // Current user
    Router::get('/me', 'App\Controller\UserController@me');
    Router::put('/me', 'App\Controller\UserController@updateMe');
}, ['middleware' => [\App\Middleware\JwtAuthMiddleware::class]]);
```

---

## 四、执行预览

```bash
# ✅ List users (paginated)
$ curl "http://127.0.0.1:9501/users?page=1&size=10&status=active" \
  -H "Authorization: Bearer <token>"
{
  "code": 0,
  "data": [
    {"id": 1, "username": "hahn", "email": "hahn@example.com", "status": "active"},
    {"id": 2, "username": "test", "email": "test@example.com", "status": "active"}
  ],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 2,
    "pages": 1
  }
}

# ✅ Get user by ID
$ curl "http://127.0.0.1:9501/users/1" \
  -H "Authorization: Bearer <token>"
{
  "code": 0,
  "data": {
    "id": 1,
    "username": "hahn",
    "email": "hahn@example.com",
    "profile": {"nickname": "hahn", "avatar": null, "bio": null}
  }
}

# ✅ Update user profile (PATCH)
$ curl -X PATCH "http://127.0.0.1:9501/users/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"铁蛋","bio":"全栈开发工程师"}'
{
  "code": 0,
  "message": "User updated"
}

# ✅ Delete user
$ curl -X DELETE "http://127.0.0.1:9501/users/1" \
  -H "Authorization: Bearer <token>"
{
  "code": 0,
  "message": "User deleted"
}

# ✅ Update current user profile
$ curl -X PUT "http://127.0.0.1:9501/users/me" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"avatar":"https://example.com/avatar.jpg","bio":"Hello world"}'
{
  "code": 0,
  "message": "Profile updated"
}
```

---

## 五、注意事项

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| HTTP 方法语义正确 | GET 查询、POST 创建、PUT 更新、DELETE 删除 | API 语义混乱，难以维护 |
| 资源路径用复数 | `/users` 而非 `/user` | 不符合 RESTful 规范 |
| 软删除代替硬删除 | 用 `deleted_at` 标记删除 | 数据永久丢失 |
| 分页参数限制 | 最大 size 100 | 恶意请求导致数据库压力 |
| 鉴权中间件保护 | 敏感操作需要认证 | 未授权访问 |

---

## 六、避坑指南

| 典型错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 用 GET 请求修改数据 | 不安全，可能被浏览器预取 | 用 POST/PUT/PATCH 修改数据 |
| ❌ 忘记返回 HTTP 状态码 | 统一返回 200，前端无法判断 | 成功 200/201，失败 400/404/500 |
| ❌ 硬删除用户 | 无法恢复数据 | 软删除 + restore 接口 |
| ❌ 列表接口不限制 size | 可能导致全表扫描 | 最大 size 100 |
| ❌ 返回敏感信息（密码） | 安全风险 | Model `hidden` 屏蔽字段 |

---

## 七、练习题

🟢 **基础题 1：** 实现 `GET /users/search` 接口，支持按 `username` 或 `email` 精确搜索。

🟢 **基础题 2：** 添加用户列表排序功能：`?sort=username:asc` 或 `?sort=created_at:desc`。

🟡 **进阶题：** 实现批量更新接口 `PUT /users/batch`，支持批量修改用户状态（active/inactive/banned）。

🔴 **开放题：** 设计用户权限系统：给用户分配角色（admin/user），角色分配权限，接口层验证权限。

---

## 八、知识点总结

```
RESTful API
├── HTTP 方法映射
│   ├── GET → Read (查询)
│   ├── POST → Create (创建)
│   ├── PUT → Update (全量更新)
│   ├── PATCH → Update (部分更新)
│   └── DELETE → Delete (删除)
├── 资源设计
│   ├── 复数名词 /users
│   ├── 层级嵌套 /users/{id}/orders
│   └── 版本号 /v1/users
├── 分页过滤排序
│   ├── ?page=1&size=20
│   ├── ?status=active
│   └── ?sort=created_at:desc
└── 响应规范
    ├── 统一响应格式 {code, message, data}
    ├── HTTP 状态码对应业务状态
    └── 软删除支持恢复
```

---

## 九、举一反三

| 变种场景 | 关键差异 | 适配方式 |
|----------|----------|----------|
| HATEOAS 响应 | 返回关联资源的链接 | `_links` 字段包含 API 路径 |
| GraphQL | 查询语言，按需返回字段 | 前端自定义返回字段 |
| gRPC | Protocol Buffers，高性能 | 微服务间 RPC 通信 |

---

## 十、参考资料

| 资料 | 权威等级 | 链接 |
|------|----------|------|
| REST API 设计指南 | ⭐⭐⭐⭐⭐ | https://restfulapi.net |
| HTTP 方法语义 | ⭐⭐⭐⭐ | RFC 9110 |
| Laravel RESTful 资源控制器 | ⭐⭐⭐⭐⭐ | https://laravel.com/docs/controllers |
| API 版本控制最佳实践 | ⭐⭐⭐⭐ | 社区博文 |

---

## 十一、代码演进

### v1 ❌ 非结构化 API

```php
<?php
// ❌ No RESTful patterns, mixed methods
Router::get('/getUser', 'UserController@getUser');
Router::post('/updateUser', 'UserController@updateUser');
Router::post('/deleteUser', 'UserController@deleteUser');

class UserController {
    public function getUser($id) {
        return User::find($id);
    }
}
```

### v2 ✅ RESTful API 结构

```php
<?php
// ✅ Proper RESTful routing
Router::get('/users', 'UserController@index');
Router::get('/users/{id}', 'UserController@show');
Router::post('/users', 'UserController@store');
Router::put('/users/{id}', 'UserController@update');
Router::delete('/users/{id}', 'UserController@destroy');
```

### v3 🟢 生产级 RESTful API

```php
<?php
// 🟢 Full RESTful with pagination, filtering, and soft delete
class UserService {
    public function listUsers(int $page, int $size, ?string $status, ?string $keyword): array {
        $query = User::query();

        // Filtering
        if ($status !== null) {
            $query->where('status', $status);
        }

        // Search
        if ($keyword !== null) {
            $query->where(function ($q) use ($keyword) {
                $q->where('username', 'like', "%{$keyword}%")
                  ->orWhere('email', 'like', "%{$keyword}%");
            });
        }

        // Pagination with size limit
        $size = min($size, 100);
        $paginator = $query->with('profile')
            ->orderBy('created_at', 'desc')
            ->paginate($size, ['*'], 'page', $page);

        return [
            'code' => 0,
            'data' => $paginator->items(),
            'pagination' => [
                'page' => $paginator->currentPage(),
                'size' => $paginator->perPage(),
                'total' => $paginator->total(),
                'pages' => $paginator->lastPage(),
            ],
        ];
    }

    public function deleteUser(int $id): array {
        $user = User::find($id);
        if (!$user) {
            return ['code' => 404, 'message' => 'User not found'];
        }

        // Soft delete
        $user->delete();

        $this->logger->info('User deleted', ['user_id' => $id]);

        return ['code' => 0, 'message' => 'User deleted'];
    }
}
```

---

**上一篇：** [008 - 用户登录与 JWT 认证体系](/post/008-user-login-jwt)
**下一篇：** [010 - 用户服务单元测试与集成测试](/post/010-user-service-testing)
