# RESTful API设计原则与最佳实践

> 分类：Web基础 | API设计 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 REST 的核心约束和设计原则（理解）
2. ✅ 能够设计符合 RESTful 规范的 API URL 结构（应用）
3. ✅ 能够设计合理的分页、错误码、版本管理方案（应用）
4. ✅ 能够评价一个 API 设计的优劣并给出改进建议（评价）

---

## 📋 前置知识自检

1. **你了解 HTTP 方法（GET/POST/PUT/DELETE）和状态码的含义吗？**（答不上来？→ [《HTTP协议全解析》](11-http-协议全解析.md)）
2. **你知道什么是 JSON 格式吗？**（答不上来？→ 先了解 JSON 基础）

---

## 💡 概念讲解

### REST

- **一句话定义**：REST 是一种用 URL 表示资源、用 HTTP 方法表示操作的 API 设计风格。
- **现实类比**：REST 就像图书馆——每本书有唯一编号（URL），你借书（GET）、还书（PUT）、新书上架（POST）、报废（DELETE），操作语义明确。
- **技术场景**：后端 API 设计、微服务间通信、第三方开放平台。
- **⚠️ 常见误解**：REST 不是框架也不是协议，是一种**设计风格**。用 HTTP 不等于 RESTful，关键看是否遵循约束。

### REST 核心约束

1. **资源（Resource）**：URL 表示资源，名词不动词
2. **统一接口**：用 HTTP 方法表达操作语义
3. **无状态**：每个请求自带所有必要信息
4. **分层系统**：客户端不需要知道后面有多少层

---

## 🧠 实时脑图

```text
[RESTful API 设计] 🔴
    ||
    ├──→ [URL设计] 🔴
    │       ├── 名词复数: /users, /posts
    │       ├── 嵌套资源: /users/123/posts
    │       └── 过滤参数: ?status=active&page=2
    ├──→ [HTTP方法语义] 🔴
    │       ├── GET = 查询（幂等）
    │       ├── POST = 创建（非幂等）
    │       ├── PUT = 全量更新（幂等）
    │       ├── PATCH = 部分更新（幂等）
    │       └── DELETE = 删除（幂等）
    ├──→ [版本管理] 🟡
    │       ├── URL路径: /v1/users
    │       └── Header: Accept: application/vnd.api.v1+json
    ├──→ [分页] 🟡
    │       ├── Offset: ?page=1&size=20
    │       └── Cursor: ?cursor=abc123
    ├──→ [错误码] 🔴
    │       └── 结构化错误响应
    └──→ [HATEOAS] 🟢 — 超媒体驱动
```

---

## 💻 完整代码

> 运行环境：Python 3.10+, `pip install fastapi uvicorn`

```python
"""
restful_api_demo.py - RESTful API 设计演示
Python 3.10+ | pip install fastapi uvicorn

运行: uvicorn restful_api_demo:app --reload
"""

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

app = FastAPI(title="RESTful API Demo", version="1.0.0")


# ============================================
# 1. 数据模型
# ============================================

class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

class PostUpdate(BaseModel):
    """PATCH: 所有字段可选"""
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: list[str]
    created_at: str
    updated_at: str


# ============================================
# 2. 模拟数据库
# ============================================

_db: dict[int, dict] = {}
_next_id = 1


# ============================================
# 3. RESTful API 端点
# ============================================

@app.get("/api/v1/posts", response_model=list[PostResponse])
async def list_posts(
    page: int = Query(ge=1, default=1),
    size: int = Query(ge=1, le=100, default=20),
    tag: Optional[str] = None,
):
    """GET /posts — 获取文章列表（分页 + 过滤）"""
    posts = list(_db.values())
    if tag:
        posts = [p for p in posts if tag in p["tags"]]
    # 分页
    start = (page - 1) * size
    return posts[start : start + size]


@app.get("/api/v1/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: int):
    """GET /posts/{id} — 获取单篇文章"""
    if post_id not in _db:
        raise HTTPException(status_code=404, detail="文章不存在")
    return _db[post_id]


@app.post("/api/v1/posts", response_model=PostResponse, status_code=201)
async def create_post(data: PostCreate):
    """POST /posts — 创建文章（201 Created）"""
    global _next_id
    now = datetime.now().isoformat()
    post = {
        "id": _next_id,
        "title": data.title,
        "content": data.content,
        "tags": data.tags,
        "created_at": now,
        "updated_at": now,
    }
    _db[_next_id] = post
    _next_id += 1
    return post


@app.put("/api/v1/posts/{post_id}", response_model=PostResponse)
async def update_post(post_id: int, data: PostCreate):
    """PUT /posts/{id} — 全量更新（必须传所有字段）"""
    if post_id not in _db:
        raise HTTPException(status_code=404, detail="文章不存在")
    now = datetime.now().isoformat()
    post = _db[post_id]
    post.update(
        title=data.title,
        content=data.content,
        tags=data.tags,
        updated_at=now,
    )
    return post


@app.patch("/api/v1/posts/{post_id}", response_model=PostResponse)
async def partial_update_post(post_id: int, data: PostUpdate):
    """PATCH /posts/{id} — 部分更新（只传需要改的字段）"""
    if post_id not in _db:
        raise HTTPException(status_code=404, detail="文章不存在")
    post = _db[post_id]
    update_data = data.model_dump(exclude_none=True)
    post.update(update_data)
    post["updated_at"] = datetime.now().isoformat()
    return post


@app.delete("/api/v1/posts/{post_id}", status_code=204)
async def delete_post(post_id: int):
    """DELETE /posts/{id} — 删除文章（204 No Content）"""
    if post_id not in _db:
        raise HTTPException(status_code=404, detail="文章不存在")
    del _db[post_id]
    return None  # 204 无响应体


# ============================================
# 4. 结构化错误响应
# ============================================

class ErrorResponse(BaseModel):
    """统一的错误响应格式"""
    error: str
    detail: str
    status_code: int

@app.get("/api/v1/error-demo")
async def error_demo():
    """演示结构化错误响应"""
    raise HTTPException(
        status_code=400,
        detail={
            "error": "validation_error",
            "detail": "title 字段不能为空",
            "status_code": 400,
        },
    )


# ============================================
# 启动说明
# ============================================

if __name__ == "__main__":
    print("运行: uvicorn restful_api_demo:app --reload")
    print("文档: http://localhost:8000/docs")
```

---

## 👀 执行预览

```bash
# 创建文章
$ curl -X POST http://localhost:8000/api/v1/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "REST入门", "content": "RESTful API 设计", "tags": ["API"]}'
# → 201 Created
# {"id":1,"title":"REST入门","content":"RESTful API 设计","tags":["API"],...}

# 获取列表
$ curl http://localhost:8000/api/v1/posts?page=1&size=10
# → 200 OK
# [{"id":1,"title":"REST入门",...}]

# 部分更新
$ curl -X PATCH http://localhost:8000/api/v1/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "REST入门（更新）"}'
# → 200 OK

# 删除
$ curl -X DELETE http://localhost:8000/api/v1/posts/1
# → 204 No Content (无响应体)
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ URL 用名词不用动词 | `/getUsers` 不符合 REST 风格 | 🟡 |
| ⚠️ URL 用复数不用单数 | `/user` vs `/users`，统一用复数 | 🟡 |
| ⚠️ GET 请求不能修改数据 | 破坏幂等性和缓存 | 🔴 |
| ⚠️ DELETE 返回 204 而非 200 | 204 表示成功且无内容，语义更准确 | 🟢 |
| ⚠️ 分页必须有上限 | 无限制 size=999999 可能打挂服务 | 🔴 |

---

## 🕳️ 避坑指南

### 坑1：URL 里写动词

```python
# ❌ URL 里写操作
POST /api/createPost
GET  /api/getUserList
POST /api/deletePost/123

# ✅ URL 只写资源，用 HTTP 方法表达操作
POST   /api/posts          # 创建
GET    /api/posts          # 列表
DELETE /api/posts/123      # 删除
```

### 坑2：返回数据不统一

```python
# ❌ 每个接口错误格式不一样
{"error": "not found"}
{"message": "用户不存在", "code": 404}
{"status": "fail", "data": null}

# ✅ 统一错误格式
{
    "error": "not_found",
    "detail": "用户 ID 123 不存在",
    "status_code": 404
}
```

### 坑3：PUT vs PATCH 分不清

```python
# PUT = 全量替换（必须传全部字段）
PUT /posts/123 {"title": "新标题", "content": "新内容", "tags": []}
# 缺了 content → content 被清空！

# PATCH = 部分更新（只传要改的）
PATCH /posts/123 {"title": "新标题"}
# 只改 title，content 不受影响
```

---

## 🔍 调试排查

### 故障场景1：前端调用 API 总是 405 Method Not Allowed

**症状**：URL 正确但返回 405
**排查思路**：
1. 检查请求方法是否与服务端定义一致
2. 检查是否有 CORS 预检（OPTIONS）未处理
3. FastAPI 默认处理 CORS，但需加 `CORSMiddleware`

### 故障场景2：分页数据重复或遗漏

**症状**：翻页时某些数据出现两次或丢失
**排查思路**：
1. Offset 分页在有增删时会出现此问题（数据在翻页间被移动）
2. 解决方案：用 Cursor 分页（基于排序字段的游标）

---

## 📝 练习题

### 🟢 基础题

1. 将以下非 RESTful URL 改写为 RESTful 风格：`/getAllUsers`、`/createPost`、`/deleteComment/5`。（考察点：URL 设计 → 目标 #2）

### 🟡 进阶题

2. 设计一个「待办事项」API，包含：创建任务、获取列表（分页+按状态过滤）、更新任务状态、删除任务。写出 URL + HTTP 方法 + 状态码。（考察点：完整 API 设计 → 目标 #3）

### 🔴 开放题

3. 你的 API 有 v1 和 v2 两个版本，v2 的 `POST /posts` 多了一个 `category` 字段。你会如何设计版本管理？讨论 URL 版本 vs Header 版本的利弊。（考察点：版本管理策略 → 目标 #4）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
RESTful API
├── URL — 名词复数，资源嵌套
│   ├── /users, /users/123, /users/123/posts
│   └── ?page=1&size=20&status=active
├── HTTP 方法
│   ├── GET(查) POST(建) PUT(改全) PATCH(改部) DELETE(删)
│   └── 幂等性: GET/PUT/DELETE幂等, POST非幂等
├── 状态码
│   ├── 200 OK, 201 Created, 204 No Content
│   ├── 400 Bad Request, 401 Unauthorized, 404 Not Found
│   └── 500 Internal Server Error
├── 版本管理: /v1/ vs Header
├── 分页: Offset vs Cursor
├── 错误格式: 统一结构
└── HATEOAS: 响应中包含相关链接
```

---

## 🔄 举一反三

| 场景 | 设计要点 |
|------|----------|
| 电商商品 API | `/products`, `/products/123/reviews`, 过滤排序分页 |
| 社交媒体 API | `/users/123/followers`, `/posts/456/likes` |
| AI 模型服务 API | `/models`, `/models/gpt-4/completions`（非 CRUD，RPC 风格可能更合适） |

---

## 🗺️ 学习路径

```
[HTTP协议] → **📍 你在这里：RESTful API** → [httpx客户端] → [FastAPI实战] → [JWT认证]
```

**下一篇建议**：
- → [《httpx：比requests更好的HTTP客户端》](13-httpx-比requests更好的HTTP客户端.md)：用代码调用 API
- → [《JWT认证：Token原理与实现》](14-jwt-认证.md)：API 安全认证

---

## ⚔️ 横向对比

| 维度 | REST | GraphQL | gRPC |
|------|------|---------|------|
| 学习成本 | 低 | 中 | 高 |
| 灵活性 | 中 | 高 | 中 |
| 性能 | 中 | 中 | 高（二进制） |
| 生态 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 浏览器友好 | ✅ | ✅ | ❌ |
| 适用场景 | 通用 API | 复杂查询 | 微服务内部 |
| **推荐** | ⭐⭐⭐⭐⭐ 通用首选 | ⭐⭐⭐ 前端驱动 | ⭐⭐⭐⭐ 后端间 |

**铁蛋建议**：90% 的项目用 REST 就够了，别过度设计。

---

## 📚 参考资料

- [RESTful API 设计指南](https://restfulapi.net/) [等级：权威]
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines) [等级：权威] — 微软的 REST 设计规范

---

## 附录：练习题参考答案

**题1**：
```
/getAllUsers    → GET    /users
/createPost     → POST   /posts
/deleteComment/5 → DELETE /comments/5
```

**题2**：
```
POST   /api/todos              → 201 创建任务
GET    /api/todos?page=1&size=20&status=pending → 200 获取列表
PATCH  /api/todos/123           → 200 更新状态
DELETE /api/todos/123           → 204 删除
```

**题3**：URL 版本（`/v1/posts`、`/v2/posts`）简单直观，但代码维护需要路由分版本；Header 版本（`Accept: application/vnd.api.v2+json`）URL 更干净，但调试不便。推荐小项目用 URL 版本，大型开放平台考虑 Header 版本。
