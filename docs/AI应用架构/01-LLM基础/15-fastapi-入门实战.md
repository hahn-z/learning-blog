# FastAPI入门：构建你的第一个API

> 分类：Web框架 | FastAPI | 难度：⭐⭐ | 预估用时：40 分钟

---

## 🎯 学习目标

1. ✅ 能用自己的话解释 FastAPI 的核心优势与异步机制（理解）
2. ✅ 能独立编写包含路径参数、查询参数、请求体的完整 API（应用）
3. ✅ 能定位并修复 Pydantic 校验相关的常见错误（分析）
4. ✅ 能根据场景选择合适的参数传递方式（评价）

---

## 📋 前置知识自检

1. **你知道 HTTP 的 GET/POST 区别吗？**（答不上来？→ 先学 HTTP 基础）
2. **你了解 Python 的 type hints 语法吗？**（答不上来？→ 先学 Python 类型注解）
3. **你知道什么是 JSON 吗？**（答不上来？→ 先了解 JSON 数据格式）

---

## 💡 概念讲解

- **一句话定义**：FastAPI 是一个基于 Python 类型注解的高性能异步 Web 框架，自带 API 文档生成。
- **现实类比**：就像一家快餐店——你只需要在菜单（类型注解）上写清楚要什么，服务员（FastAPI）自动帮你检查、上菜、还能打印出菜单说明（Swagger 文档）。
- **技术场景**：构建 RESTful API、LLM 服务代理、数据处理接口、微服务后端。
- **⚠️ 常见误解**：很多人以为 FastAPI 必须用 async，其实同步函数也完全支持，只是异步能在高并发 I/O 场景下表现更好。

---

## 🧠 实时脑图

```text
客户端请求 🔴
    || HTTP GET/POST
    ↓
FastAPI 路由层 🔴 ← 路径参数 / 查询参数 / 请求体
    || 自动校验
    ↓
Pydantic 模型 🔴 ← 类型转换 + 数据校验
    || 业务处理
    ↓
响应序列化 🟡 ← response_model 过滤
    || 自动生成
    ↓
Swagger 文档 🟢 ← /docs /redoc
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、FastAPI 0.100+、uvicorn

```python
# app.py - FastAPI 入门完整示例
# Python 3.10+
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

app = FastAPI(
    title="我的第一个 FastAPI",
    description="入门示例 API",
    version="1.0.0",
)


# ── 1. Pydantic 模型定义 ──────────────────────────

class ItemCategory(str, Enum):
    """商品分类枚举"""
    electronics = "electronics"
    books = "books"
    clothing = "clothing"


class ItemCreate(BaseModel):
    """创建商品 - 请求体模型"""
    name: str = Field(..., min_length=1, max_length=100, description="商品名称")
    price: float = Field(..., gt=0, description="价格，必须大于0")
    description: Optional[str] = Field(None, max_length=500, description="商品描述")
    category: ItemCategory = Field(..., description="商品分类")


class ItemResponse(BaseModel):
    """商品响应模型"""
    id: int
    name: str
    price: float
    description: Optional[str] = None
    category: ItemCategory


# ── 2. 模拟数据库 ─────────────────────────────────

fake_db: dict[int, dict] = {}
_counter: int = 0


def _next_id() -> int:
    global _counter
    _counter += 1
    return _counter


# ── 3. 路由定义 ────────────────────────────────────

@app.get("/")
async def root() -> dict[str, str]:
    """Hello World"""
    return {"message": "Hello, FastAPI! 🚀"}


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int) -> ItemResponse:
    """
    路径参数示例：根据 ID 获取商品
    - item_id 会自动转为 int，非法值返回 422
    """
    if item_id not in fake_db:
        raise HTTPException(status_code=404, detail=f"商品 {item_id} 不存在")
    return ItemResponse(id=item_id, **fake_db[item_id])


@app.get("/items/", response_model=list[ItemResponse])
async def list_items(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(10, ge=1, le=100, description="每页数量"),
    category: Optional[ItemCategory] = Query(None, description="按分类筛选"),
) -> list[ItemResponse]:
    """
    查询参数示例：分页 + 筛选商品列表
    """
    results = [
        ItemResponse(id=i, **data)
        for i, data in fake_db.items()
        if category is None or data.get("category") == category.value
    ]
    return results[skip : skip + limit]


@app.post("/items/", response_model=ItemResponse, status_code=201)
async def create_item(item: ItemCreate) -> ItemResponse:
    """
    请求体示例：创建商品
    - Pydantic 自动校验 name/price/category
    """
    item_id = _next_id()
    fake_db[item_id] = item.model_dump()
    return ItemResponse(id=item_id, **item.model_dump())


@app.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: int, item: ItemCreate) -> ItemResponse:
    """路径参数 + 请求体：更新商品"""
    if item_id not in fake_db:
        raise HTTPException(status_code=404, detail=f"商品 {item_id} 不存在")
    fake_db[item_id] = item.model_dump()
    return ItemResponse(id=item_id, **item.model_dump())


@app.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: int) -> None:
    """删除商品"""
    if item_id not in fake_db:
        raise HTTPException(status_code=404, detail=f"商品 {item_id} 不存在")
    del fake_db[item_id]
```

启动服务：

```bash
pip install fastapi uvicorn
uvicorn app:app --reload --port 8000
```

---

## 👀 执行预览

```bash
# 创建商品
$ curl -X POST http://localhost:8000/items/ \
  -H "Content-Type: application/json" \
  -d '{"name":"MacBook Pro","price":12999,"category":"electronics"}'
{"id":1,"name":"MacBook Pro","price":12999.0,"description":null,"category":"electronics"}

# 获取商品
$ curl http://localhost:8000/items/1
{"id":1,"name":"MacBook Pro","price":12999.0,"description":null,"category":"electronics"}

# 列表查询（带分页）
$ curl "http://localhost:8000/items/?skip=0&limit=5"
[{"id":1,"name":"MacBook Pro","price":12999.0,"description":null,"category":"electronics"}]

# 自动生成的 Swagger 文档
# 浏览器访问 → http://localhost:8000/docs
```

Swagger 文档效果：
- 自动列出所有路由
- 支持 "Try it out" 在线测试
- Schema 展示请求/响应结构

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 路径参数用 `{param}`，不是 `:param` | 路由匹配失败 | 🔴 |
| ⚠️ Pydantic v2 用 `model_dump()` 而非 `.dict()` | v2 中 `.dict()` 已弃用 | 🟡 |
| ⚠️ `response_model` 会过滤掉模型中没有的字段 | 返回数据缺失但不报错 | 🟡 |
| ⚠️ 查询参数有默认值才是可选的，否则必填 | 缺参返回 422 | 🟢 |
| ⚠️ POST 路由末尾加 `/` 和不加是不同路由 | 路由 307 重定向 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 路径参数类型写成字符串但期望数字 | `item_id` 传入 `abc` 返回 422 | FastAPI 自动做类型转换，定义时用 `int` 即可 |
| ❌ 请求体用 `dict` 接收 | 丢失自动校验和文档 | ✅ 用 Pydantic `BaseModel` 定义请求体 |
| ❌ `Optional[str]` 不给默认值 | 参数仍然必填 | ✅ 写成 `name: Optional[str] = None` |
| ❌ 忘记 `await` 异步调用 | 并发退化甚至报错 | ✅ `result = await some_async_func()` |

---

## 🔍 调试排查

#### 故障场景1：422 Unprocessable Entity

**症状**：请求返回 422，body 里有 `detail` 字段列出校验错误
**排查思路**：
1. 查看返回的 `detail` 字段 → 定位哪个字段校验失败
2. 对比请求 JSON 和 Pydantic 模型的类型/约束
3. 常见原因：类型不匹配、缺少必填字段、数值超范围

**根因**：请求数据不符合 Pydantic 模型定义
**修复**：根据 `detail` 提示修正请求参数

#### 故障场景2：405 Method Not Allowed

**症状**：请求返回 405
**排查思路**：
1. 检查请求方法（GET/POST/PUT/DELETE）是否与路由装饰器一致
2. 检查 URL 路径是否正确（注意末尾 `/`）

**根因**：HTTP 方法不匹配
**修复**：确认 `@app.get` / `@app.post` 和实际请求方法一致

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. FastAPI 的自动文档默认在哪个路径访问？它底层使用什么规范？（→ 目标 #1）
2. 路径参数和查询参数的声明方式有什么区别？举例说明。（→ 目标 #4）

### 🟡 进阶题（动手实践）

1. 为上面的示例添加一个 `search` 查询参数，支持按商品名称模糊搜索。（→ 目标 #2）
2. 创建一个 `UserCreate` 模型，包含 `email`（带格式校验）和 `age`（18-120），写一个注册接口。（→ 目标 #2）

### 🔴 开放题（设计思考）

1. 如果要给 API 加上版本管理（v1/v2），你会怎么设计路由结构？为什么？（→ 目标 #4）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
FastAPI 入门
├── 核心概念
│   ├── 路由装饰器：@app.get / @app.post / @app.put / @app.delete
│   ├── 参数类型
│   │   ├── 路径参数：{param} → 函数参数
│   │   ├── 查询参数：?key=value → Query()
│   │   └── 请求体：JSON body → Pydantic BaseModel
│   └── 响应模型：response_model 自动过滤+文档
├── Pydantic v2
│   ├── Field() 约束：min_length, gt, le...
│   ├── model_dump() 替代 .dict()
│   └── Optional[str] = None 表示可选
├── 自动文档
│   ├── /docs → Swagger UI
│   └── /redoc → ReDoc
└── 启动：uvicorn app:app --reload
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 要给 API 加认证 | 用 `Depends` + API Key / OAuth2 依赖注入（见下一篇） |
| 要做分页查询 | `skip` + `limit` 查询参数 + `response_model=list[X]` |
| 要做文件上传 | `UploadFile` 类型参数，FastAPI 内置支持 |

---

## 🗺️ 学习路径

```
[Python基础] → **📍 本篇：FastAPI入门** → [下一篇：FastAPI进阶]
```

**下一篇建议**：
- → [《FastAPI进阶：中间件、CORS与生命周期》](16-fastapi-进阶.md)：学会中间件、依赖注入等进阶特性，为实战打基础

**相关主题**：
- [《SSE流式响应》](18-sse-流式响应.md)：FastAPI 处理流式数据的核心技术

---

<!-- 推荐维度 -->

## 📈 代码演进

```python
# v1: 最简单的 Hello World
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def root():
    return {"msg": "hello"}

# v2: 加上类型注解和 Pydantic 模型 → 自动校验 + 文档
@app.get("/items/{item_id}")
def get_item(item_id: int) -> dict: ...

# v3: 加上 response_model + HTTPException → 规范的 REST API（本文最终版）
@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int) -> ItemResponse: ...
```

## 📦 版本兼容性

- ✅ 适配版本：Python 3.10+、FastAPI 0.100+
- ⚠️ Python 3.9 及以下：需要 `from typing import Optional` 替代 `X | None`，`list[X]` 改为 `List[X]`
- ⚠️ Pydantic v1（FastAPI < 0.100）：用 `.dict()` 而非 `.model_dump()`，`Field` 用法略有不同

## ⚔️ 横向对比

| 维度 | FastAPI | Flask | Django |
|------|---------|-------|--------|
| 学习成本 | 低 | 低 | 高 |
| 异步支持 | ✅ 原生 | ❌ 需扩展 | ✅ 3.1+ |
| 自动文档 | ✅ 内置 | ❌ 需扩展 | ❌ 需扩展 |
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 适合场景 | API服务 | 小型应用/原型 | 全功能Web应用 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

**铁蛋建议**：做 API 服务（尤其是 LLM 相关），FastAPI 是当前最佳选择，没有之一。

## 📚 参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/) [等级：官方] — 最权威的学习资料，中文友好
- [Pydantic v2 文档](https://docs.pydantic.dev/) [等级：官方] — 深入理解数据校验

---

## 附录：练习题参考答案

### 基础题 1
`/docs`（Swagger UI）和 `/redoc`（ReDoc），底层使用 OpenAPI（Swagger）规范。

### 基础题 2
路径参数在 URL 路径中定义，如 `@app.get("/items/{item_id}")`，函数参数 `item_id: int`；查询参数在 URL `?` 之后，如 `?skip=0&limit=10`，函数参数 `skip: int = 0`。

### 进阶题 1
```python
@app.get("/items/", response_model=list[ItemResponse])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[ItemCategory] = Query(None),
    search: Optional[str] = Query(None, description="按名称搜索"),
) -> list[ItemResponse]:
    results = []
    for i, data in fake_db.items():
        if category and data.get("category") != category.value:
            continue
        if search and search.lower() not in data["name"].lower():
            continue
        results.append(ItemResponse(id=i, **data))
    return results[skip : skip + limit]
```

### 进阶题 2
```python
from pydantic import EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    age: int = Field(..., ge=18, le=120)

@app.post("/users/", status_code=201)
async def register(user: UserCreate):
    return {"message": f"用户 {user.email} 注册成功"}
# 注意：EmailStr 需要安装 email-validator：pip install email-validator
```
