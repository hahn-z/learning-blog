---
title: "PHP API设计最佳实践"
slug: "php-api-design-best-practices"
category: "最佳实践"
tech_stack: "PHP"
created_at: "2026-05-31T10:00:00+08:00"
reading_time: 15
tags: ["PHP", "API", "RESTful"]
:v-pre:
---# PHP API设计最佳实践

好的API设计让前端乐意用，让集成方少骂娘。本文从RESTful规范到实际设计决策，覆盖API设计的核心知识。

## RESTful设计规范

### URL设计

```
# 资源用名词复数
GET    /api/users           # 列表
POST   /api/users           # 创建
GET    /api/users/123       # 详情
PUT    /api/users/123       # 全量更新
PATCH  /api/users/123       # 部分更新
DELETE /api/users/123       # 删除

# 嵌套资源
GET    /api/users/123/orders        # 用户的订单
POST   /api/users/123/orders        # 为用户创建订单
GET    /api/users/123/orders/456    # 用户的某个订单

# 过滤/排序/搜索用查询参数
GET    /api/users?status=active&sort=-created_at&page=2&per_page=20
GET    /api/orders?created_after=2026-01-01&total_gt=1000

# 动作转为资源
POST   /api/users/123/activation     # 激活用户
POST   /api/orders/123/cancellation  # 取消订单
DELETE /api/users/123/avatar         # 删除头像
```

### HTTP方法语义

```php
<?php
// GET - 幂等，不修改资源
$router->get('/users', [UserController::class, 'list']);
$router->get('/users/{id}', [UserController::class, 'show']);

// POST - 非幂等，创建资源
$router->post('/users', [UserController::class, 'create']);

// PUT - 幂等，全量替换
$router->put('/users/{id}', [UserController::class, 'update']);

// PATCH - 幂等，部分更新
$router->patch('/users/{id}', [UserController::class, 'partialUpdate']);

// DELETE - 幂等，删除资源
$router->delete('/users/{id}', [UserController::class, 'delete']);
```

## JSON:API标准

```php
<?php
// JSON:API响应格式（jsonapi.org标准）
class JsonApiResponse
{
    // 单个资源响应
    public static function item(object $data, int $statusCode = 200): array
    {
        return [
            'jsonapi' => ['version' => '1.0'],
            'data' => [
                'type' => $data->getResourceType(),  // 'users'
                'id' => (string)$data->getId(),
                'attributes' => $data->getAttributes(),
                'relationships' => $data->getRelationships(),
                'links' => ['self' => "/api/users/{$data->getId()}"],
            ],
        ];
    }

    // 集合响应（含分页）
    public static function collection(array $items, int $total, int $page, int $perPage): array
    {
        $lastPage = (int)ceil($total / $perPage);
        return [
            'jsonapi' => ['version' => '1.0'],
            'data' => array_map(fn($item) => [
                'type' => $item->getResourceType(),
                'id' => (string)$item->getId(),
                'attributes' => $item->getAttributes(),
            ], $items),
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $lastPage,
            ],
            'links' => [
                'self' => "?page=$page",
                'first' => '?page=1',
                'last' => "?page=$lastPage",
                'next' => $page < $lastPage ? '?page=' . ($page + 1) : null,
                'prev' => $page > 1 ? '?page=' . ($page - 1) : null,
            ],
        ];
    }
}
```

## 版本策略

```php
<?php
// 方案1: URL路径版本（最常见）
$router->group(['prefix' => 'api/v1'], function ($router) {
    $router->get('/users', [UserV1Controller::class, 'list']);
});
$router->group(['prefix' => 'api/v2'], function ($router) {
    $router->get('/users', [UserV2Controller::class, 'list']);
});

// 方案2: Header版本（更RESTful）
// Accept: application/vnd.myapi.v2+json
$router->get('/api/users', function ($request) {
    $version = match (true) {
        str_contains($request->header('Accept'), 'v2') => new UserV2Controller(),
        default => new UserV1Controller(),
    };
    return $version->list($request);
});

// 方案3: 查询参数（最简单但不推荐）
// GET /api/users?version=2
```

**建议**：公开API用URL版本（清晰明了），内部API用Header版本（保持URL干净）。

## 分页：游标 vs 偏移

```php
<?php
// 偏移分页（传统，简单但大数据集性能差）
class OffsetPaginator
{
    public function paginate(string $table, int $page, int $perPage): array
    {
        $offset = ($page - 1) * $perPage;
        
        // MySQL: OFFSET在大数据集时很慢（需要扫描offset+limit行）
        $stmt = $this->pdo->prepare("SELECT * FROM $table ORDER BY id LIMIT ? OFFSET ?");
        $stmt->execute([$perPage, $offset]);
        
        $countStmt = $this->pdo->query("SELECT COUNT(*) FROM $table");
        $total = (int)$countStmt->fetchColumn();
        
        return [
            'data' => $stmt->fetchAll(),
            'meta' => ['total' => $total, 'page' => $page, 'per_page' => $perPage],
        ];
    }
}

// 游标分页（大数据集友好，但不能跳页）
class CursorPaginator
{
    public function paginate(string $table, ?int $cursor, int $limit): array
    {
        if ($cursor !== null) {
            $stmt = $this->pdo->prepare("SELECT * FROM $table WHERE id > ? ORDER BY id LIMIT ?");
            $stmt->execute([$cursor, $limit + 1]); // 多取一条判断是否有下一页
        } else {
            $stmt = $this->pdo->prepare("SELECT * FROM $table ORDER BY id LIMIT ?");
            $stmt->execute([$limit + 1]);
        }
        
        $items = $stmt->fetchAll();
        $hasMore = count($items) > $limit;
        if ($hasMore) array_pop($items); // 移除多取的那条
        
        $nextCursor = $hasMore ? (int)end($items)['id'] : null;
        
        return [
            'data' => $items,
            'meta' => ['next_cursor' => $nextCursor, 'has_more' => $hasMore],
        ];
    }
}
```

| 特性 | 偏移分页 | 游标分页 |
|------|----------|----------|
| 跳页 | 可以 | 不可以 |
| 大数据集性能 | 差（OFFSET慢） | 好（索引范围查询） |
| 数据一致性 | 可能有重复/遗漏 | 稳定 |
| 总数 | 需要COUNT查询 | 不提供 |
| 适用场景 | 管理后台、小数据集 | 无限滚动、Feed流 |

## 错误响应格式

```php
<?php
class ApiErrorHandler
{
    // 统一错误格式
    public static function error(
        int $status,
        string $title,
        string $detail,
        ?string $code = null,
        ?array $meta = null,
    ): never {
        http_response_code($status);
        header('Content-Type: application/json');
        
        echo json_encode([
            'errors' => [[
                'status' => (string)$status,
                'title' => $title,
                'detail' => $detail,
                'code' => $code,
                'meta' => $meta,
            ]],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // 使用
    // 400 Bad Request
    ApiErrorHandler::error(400, 'Bad Request', '参数 email 格式不正确', 'INVALID_EMAIL');
    
    // 401 Unauthorized
    ApiErrorHandler::error(401, 'Unauthorized', 'Token已过期', 'TOKEN_EXPIRED');
    
    // 403 Forbidden
    ApiErrorHandler::error(403, 'Forbidden', '无权访问该资源', 'ACCESS_DENIED');
    
    // 404 Not Found
    ApiErrorHandler::error(404, 'Not Found', '用户不存在', 'USER_NOT_FOUND');
    
    // 422 Validation Error
    ApiErrorHandler::error(422, 'Validation Error', '请求参数验证失败', null, [
        'fields' => [
            ['field' => 'email', 'message' => '邮箱格式不正确'],
            ['field' => 'age', 'message' => '必须大于18岁'],
        ],
    ]);
    
    // 500 Internal Server Error（生产环境不暴露细节）
    ApiErrorHandler::error(500, 'Internal Server Error', '服务器内部错误', null, [
        'request_id' => $requestId,  // 方便排查
    ]);
}
```

## 面试常见追问

**Q: PUT和PATCH的区别？**
A: PUT是全量替换（必须传完整资源），PATCH是部分更新（只传要改的字段）。PUT幂等（多次执行结果一致），PATCH不一定幂等（取决于语义）。实际中大多数场景用PATCH。

**Q: HATEOAS是什么？为什么很少用？**
A: HATEOAS是REST的成熟度最高级别——响应中包含相关操作的链接。比如订单响应里有"支付"和"取消"的链接。很少用因为：1) 增加响应体积；2) 前端通常硬编码URL；3) 调试不方便。适合真正需要自发现的公开API。

**Q: API应该用snake_case还是camelCase？**
A: JSON用camelCase（JavaScript惯例），PHP内部用snake_case（数据库字段）。在Controller层做转换。JSON:API标准推荐snake_case。团队统一比选哪个更重要。

**Q: 什么时候该用POST而不是PATCH？**
A: 当操作不是简单的资源更新时用POST。比如"重置密码"、"批量导入"、"发送邮件"——这些是动作不是资源修改。转为资源视角：`POST /password-resets`、`POST /imports`。
