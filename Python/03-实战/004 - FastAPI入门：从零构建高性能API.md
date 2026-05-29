---
title: "004 - FastAPI入门：从零构建高性能API"
slug: "004-fastapi-basics"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.478+08:00"
updated_at: "2026-04-29T10:02:47.692+08:00"
reading_time: 23
tags: []
---

# FastAPI入门：从零构建高性能API

> **难度标注：** ⭐⭐☆☆☆（初级）
> **前置知识：** Python基础、HTTP协议基础概念
> **预计阅读时间：** 25分钟

---

## 一、概念讲解

FastAPI 是一个现代、高性能的 Python Web 框架，用于构建 API。它的核心优势在于：

- **快速**：基于 Starlette 和 Pydantic，性能与 NodeJS 和 Go 相当
- **高效**：开发效率提升约 200%-300%
- **少Bug**：减少约 40% 的人为错误
- **智能**：编辑器支持极佳，自动补全无处不在
- **简单**：设计易于使用和学习
- **简短**：减少代码重复
- **健壮**：生产级别可用的代码，还有自动生成交互式文档

### 核心概念对比

| 特性 | FastAPI | Flask | Django |
|------|---------|-------|--------|
| 异步支持 | ✅ 原生 | ❌ 需扩展 | ✅ 3.1+支持 |
| 自动文档 | ✅ OpenAPI | ❌ 需扩展 | ❌ 需扩展 |
| 类型验证 | ✅ Pydantic | ❌ 手动 | ❌ 手动 |
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 学习曲线 | 低 | 低 | 中高 |

---

## 二、知识脑图

```
FastAPI入门
├── 环境搭建
│   ├── pip install fastapi uvicorn
│   └── ASGI服务器：uvicorn
├── 路由与视图
│   ├── @app.get / @app.post
│   ├── 路径参数 {item_id}
│   ├── 查询参数 ?skip=0&limit=10
│   └── 请求体 Request Body
├── 数据验证
│   ├── Pydantic Model
│   ├── 字段类型与验证
│   └── Optional字段
├── 响应模型
│   ├── response_model
│   ├── 嵌套模型
│   └── 响应状态码
└── 自动文档
    ├── /docs (Swagger UI)
    └── /redoc (ReDoc)
```

---

## 三、代码演进

### v1：最简Hello World

```python
# v1_minimal.py - The simplest FastAPI application
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Hello, FastAPI!"}

# Run: uvicorn v1_minimal:app --reload
```

就这么简单！6行代码就能启动一个API服务。`FastAPI()` 创建应用实例，`@app.get("/")` 定义路由，函数返回值自动转为JSON响应。

### v2：带路径参数和请求体

```python
# v2_crud.py - Adding path params and request body
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Todo API", version="2.0")

# In-memory database simulation
todos_db = {}

class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    completed: bool = False

class TodoResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    completed: bool = False

@app.post("/todos", response_model=TodoResponse, status_code=201)
def create_todo(todo: TodoCreate):
    todo_id = len(todos_db) + 1
    todo_data = todo.model_dump()
    todo_data["id"] = todo_id
    todos_db[todo_id] = todo_data
    return todo_data

@app.get("/todos", response_model=list[TodoResponse])
def list_todos(skip: int = 0, limit: int = 10):
    items = list(todos_db.values())
    return items[skip : skip + limit]

@app.get("/todos/{todo_id}", response_model=TodoResponse)
def get_todo(todo_id: int):
    if todo_id not in todos_db:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todos_db[todo_id]
```

v2 引入了三个关键概念：
- **Pydantic模型**：`TodoCreate` 定义输入数据结构，自动验证类型和必填项
- **路径参数**：`{todo_id}` 在URL中，FastAPI自动提取并验证类型（int）
- **response_model**：声明响应格式，自动过滤多余字段

### v3：完整项目结构

```python
# v3_full/main.py - Full project with validation and docs
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

app = FastAPI(
    title="Todo API Pro",
    description="A production-ready Todo API built with FastAPI",
    version="3.0.0",
)

class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="Todo title")
    description: Optional[str] = Field(None, max_length=500)

class TodoCreate(TodoBase):
    pass

class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    completed: Optional[bool] = None

class TodoResponse(TodoBase):
    id: int
    completed: bool = False
    created_at: datetime
    updated_at: datetime

todos_db: dict[int, dict] = {}
_counter = 0

def _next_id():
    global _counter
    _counter += 1
    return _counter

@app.post("/todos", response_model=TodoResponse, status_code=201)
def create_todo(todo: TodoCreate):
    now = datetime.now()
    data = {"id": _next_id(), **todo.model_dump(), "completed": False, "created_at": now, "updated_at": now}
    todos_db[data["id"]] = data
    return data

@app.get("/todos", response_model=list[TodoResponse])
def list_todos(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    completed: Optional[bool] = Query(None),
):
    items = list(todos_db.values())
    if completed is not None:
        items = [i for i in items if i["completed"] == completed]
    return items[skip : skip + limit]

@app.get("/todos/{todo_id}", response_model=TodoResponse)
def get_todo(todo_id: int):
    if todo_id not in todos_db:
        raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")
    return todos_db[todo_id]

@app.put("/todos/{todo_id}", response_model=TodoResponse)
def update_todo(todo_id: int, todo: TodoUpdate):
    if todo_id not in todos_db:
        raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")
    existing = todos_db[todo_id]
    existing.update(todo.model_dump(exclude_unset=True))
    existing["updated_at"] = datetime.now()
    return existing

@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    if todo_id not in todos_db:
        raise HTTPException(status_code=404, detail=f"Todo {todo_id} not found")
    del todos_db[todo_id]
```

v3 新增：
- **Field验证**：`min_length`、`max_length`、`ge`（大于等于）、`le`（小于等于）
- **模型继承**：`TodoCreate(TodoBase)` 减少重复
- **部分更新**：`exclude_unset=True` 只更新传入的字段
- **分页和筛选**：`Query()` 为查询参数添加验证

---

## 四、执行预览

```bash
# 启动服务器
$ uvicorn v3_full.main:app --reload
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process

# 创建Todo
$ curl -X POST http://localhost:8000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn FastAPI","description":"Build a REST API"}'
{"id":1,"title":"Learn FastAPI","description":"Build a REST API","completed":false,"created_at":"...","updated_at":"..."}

# 获取列表
$ curl http://localhost:8000/todos
[{"id":1,"title":"Learn FastAPI",...}]

# 验证失败 - 标题太短
$ curl -X POST http://localhost:8000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":""}'
{"detail":[{"type":"string_too_short","loc":["body","title"],...}]}

# 自动文档 -> 浏览器访问 http://localhost:8000/docs
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| ASGI服务器 | FastAPI需要ASGI服务器 | 推荐uvicorn |
| 类型注解 | 路径参数必须有类型注解 | `todo_id: int` 自动验证 |
| 返回字典 | 可以直接返回dict | 推荐用response_model |
| 异步函数 | async def和def都支持 | IO密集用async，CPU密集用sync |
| 查询参数 | 函数参数非路径即查询 | 用Query()添加验证 |
| Pydantic v2 | model_dump()替代dict() | 注意版本兼容性 |
| 自动文档 | Swagger/ReDoc自动生成 | 无需额外配置 |

---

## 六、避坑指南

### ❌ 路径参数和函数参数不一致
```python
@app.get("/items/{item_id}")
def get_item(id: int):  # ❌ 参数名不一致
    ...
```
### ✅ 参数名保持一致
```python
@app.get("/items/{item_id}")
def get_item(item_id: int):  # ✅ 与路径中的{item_id}一致
    ...
```

### ❌ 忘记设置类型注解
```python
@app.post("/items")
def create(item):  # ❌ 没有类型注解，FastAPI不知道怎么解析
    ...
```
### ✅ 使用Pydantic模型
```python
@app.post("/items")
def create(item: ItemCreate):  # ✅ 自动解析JSON请求体
    ...
```

### ❌ 不处理404
```python
@app.get("/items/{item_id}")
def get_item(item_id: int):
    return db[item_id]  # ❌ 不存在时KeyError，返回500
```
### ✅ 主动抛HTTPException
```python
@app.get("/items/{item_id}")
def get_item(item_id: int):
    if item_id not in db:
        raise HTTPException(status_code=404, detail="Not found")
    return db[item_id]
```

### ❌ 在Pydantic模型中使用可变默认值
```python
class Item(BaseModel):
    tags: list[str] = []  # ❌ 共享可变对象
```
### ✅ 使用Field(default_factory=...)
```python
class Item(BaseModel):
    tags: list[str] = Field(default_factory=list)  # ✅ 每次创建新列表
```

---

## 七、练习题

### 🟢 入门题
1. 创建 `/health` 端点，返回 `{"status": "ok", "timestamp": "当前时间"}`
2. 创建带路径参数的 `/greet/{name}` 端点，返回个性化问候语

### 🟡 进阶题
3. 实现计算器端点 `/calculator`，接受operation(add/sub/mul/div)和两个数字作为查询参数
4. 为计算器添加输入验证：除数不能为0，数字范围 -1000 到 1000

### 🔴 挑战题
5. 实现完整 `/books` CRUD API，含Pydantic模型、分页、按作者/年份筛选、ISBN格式验证

---

## 八、知识点总结

```
FastAPI入门知识树
├── 基础
│   ├── FastAPI() 实例化
│   ├── 路由装饰器 (@get/@post/@put/@delete)
│   └── uvicorn 启动
├── 参数类型
│   ├── 路径参数 - {param} 在URL路径中
│   ├── 查询参数 - 函数参数，不在路径中
│   ├── 请求体 - Pydantic BaseModel
│   └── Header/Cookie - 专用依赖
├── 数据验证
│   ├── Pydantic BaseModel
│   ├── Field() 字段约束
│   ├── Optional 可选字段
│   └── 自动错误响应 (422)
└── 文档与部署
    ├── /docs (Swagger UI)
    ├── /redoc (ReDoc)
    └── --reload 开发模式
```

---

## 九、举一反三

| 场景 | 核心思路 | 关键代码 |
|------|----------|----------|
| 文件上传 | UploadFile类型 | `file: UploadFile` |
| 表单数据 | Form()依赖 | `username: str = Form()` |
| Cookie操作 | Cookie()依赖 | `session_id: str = Cookie()` |
| 返回HTML | HTMLResponse | `return HTMLResponse(content)` |
| 流式响应 | StreamingResponse | `yield chunk` 生成器 |
| CORS跨域 | CORSMiddleware | `app.add_middleware(CORSMiddleware)` |
| 静态文件 | StaticFiles | `app.mount("/static", StaticFiles(...))` |
| WebSocket | 内置支持 | `@app.websocket("/ws")` |

---

## 十、参考资料

1. **FastAPI官方文档**：https://fastapi.tiangolo.com/ （最权威，教程极佳）
2. **Pydantic文档**：https://docs.pydantic.dev/ （数据验证核心库）
3. **Uvicorn文档**：https://www.uvicorn.org/ （ASGI服务器）
4. **Starlette文档**：https://www.starlette.io/ （FastAPI底层框架）
5. **OpenAPI规范**：https://swagger.io/specification/ （API文档标准）

---

## 十一、代码演进总结

| 版本 | 演进重点 | 新增能力 |
|------|----------|----------|
| v1 | 最小可用 | 单个GET路由，返回JSON |
| v2 | CRUD + 验证 | POST/GET路径参数，Pydantic模型 |
| v3 | 生产级API | Field验证、分页、筛选、完整CRUD、时间戳 |

**下一步学习：** FastAPI进阶 - 依赖注入、中间件、认证鉴权、数据库集成
