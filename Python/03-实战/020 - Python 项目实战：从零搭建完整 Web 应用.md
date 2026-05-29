---
title: "020 - Python 项目实战：从零搭建完整 Web 应用"
slug: "020-python-project"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.564+08:00"
updated_at: "2026-04-29T10:02:47.817+08:00"
reading_time: 48
tags: []
---

## 难度标注

> 🔴 **中高级难度** | 预计学习时间：4-6小时
> 前置要求：Python基础、SQL基础、HTTP协议、命令行操作

## 概念讲解

### 为什么需要完整项目实战？

学了一堆 Python 语法，却不知道怎么组合成一个真正的应用？这是大多数初学者的困境。本篇带你从零搭建一个完整的 **任务管理 Web 应用**，涵盖前端、后端、数据库、部署的全流程。

### 技术栈选择

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| **Web 框架** | FastAPI | 异步、高性能、自动文档 |
| **数据库** | SQLite → PostgreSQL | 开发用 SQLite，生产可迁移 |
| **ORM** | SQLAlchemy 2.0 | Python 生态最成熟的 ORM |
| **前端** | Jinja2 + HTMX | 无需 Node.js，轻量交互 |
| **样式** | Pico CSS | 极简 CSS，零配置 |
| **部署** | Uvicorn + Docker | ASGI 标准，容器化部署 |

### 架构设计

```
浏览器
  ↓ HTTP Request
FastAPI (路由 + 业务逻辑)
  ↓ ORM
SQLite (数据存储)
  ↑ Jinja2 模板渲染
HTML + HTMX (前端交互)
```

**目录结构：**

```
tasker/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app 入口
│   ├── database.py      # 数据库配置
│   ├── models.py        # SQLAlchemy 模型
│   ├── schemas.py       # Pydantic 数据验证
│   ├── routers/
│   │   ├── tasks.py     # 任务路由
│   │   └── pages.py     # 页面路由
│   ├── services/
│   │   └── task_service.py  # 业务逻辑
│   └── templates/
│       ├── base.html
│       ├── index.html
│       └── partials/
│           └── task_list.html
├── tests/
│   └── test_tasks.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## 脑图

```
Python Web 应用实战
├── 1. 项目初始化
│   ├── 创建虚拟环境
│   ├── 安装依赖
│   └── 目录结构规划
├── 2. 数据层
│   ├── SQLAlchemy 配置
│   ├── 模型定义(Task)
│   ├── 数据库迁移
│   └── CRUD 操作封装
├── 3. API 层
│   ├── FastAPI 路由
│   ├── Pydantic 验证
│   ├── 错误处理
│   └── 自动 API 文档
├── 4. 前端层
│   ├── Jinja2 模板
│   ├── HTMX 动态交互
│   ├── 表单处理
│   └── 响应式样式
├── 5. 测试
│   ├── pytest 配置
│   ├── 单元测试
│   └── API 测试
└── 6. 部署
    ├── Docker 镜像
    ├── 环境变量
    └── 生产配置
```

## 完整 Python 代码

### 代码演进 v1：最小可用版本（单文件）

```python
# v1: Minimal task manager - single file, SQLite, FastAPI
# Install: pip install fastapi uvicorn sqlalchemy jinja2 python-multipart

import os
from datetime import datetime
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# --- Database Setup ---
DB_PATH = os.path.join(os.path.dirname(__file__), "tasks.db")
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Task(Base):
    """Task model representing a to-do item."""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000), default="")
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# Create tables
Base.metadata.create_all(bind=engine)

# --- FastAPI App ---
app = FastAPI(title="Tasker", description="A simple task manager")
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    """Render main page with all tasks."""
    db = SessionLocal()
    tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    db.close()
    return templates.TemplateResponse("index.html", {"request": request, "tasks": tasks})


@app.post("/tasks")
def create_task(title: str = Form(...), description: str = Form(default="")):
    """Create a new task."""
    db = SessionLocal()
    task = Task(title=title, description=description)
    db.add(task)
    db.commit()
    db.close()
    return RedirectResponse(url="/", status_code=303)


@app.post("/tasks/{task_id}/toggle")
def toggle_task(task_id: int):
    """Toggle task completion status."""
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        task.done = not task.done
        db.commit()
    db.close()
    return RedirectResponse(url="/", status_code=303)


@app.post("/tasks/{task_id}/delete")
def delete_task(task_id: int):
    """Delete a task."""
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    db.close()
    return RedirectResponse(url="/", status_code=303)
```

**配套的 `templates/index.html`：**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tasker - 任务管理</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
</head>
<body>
    <main class="container" style="max-width: 640px; margin-top: 2rem;">
        <h1>📋 Tasker</h1>

        <!-- Add task form -->
        <form action="/tasks" method="post">
            <input type="text" name="title" placeholder="输入任务标题..." required>
            <textarea name="description" placeholder="描述（可选）" rows="2"></textarea>
            <button type="submit">添加任务</button>
        </form>

        <!-- Task list -->
        {% for task in tasks %}
        <article style="margin-top: 1rem; {% if task.done %}opacity: 0.6;{% endif %}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong {% if task.done %}style="text-decoration: line-through;"{% endif %}>
                        {{ task.title }}
                    </strong>
                    {% if task.description %}
                    <p style="margin: 0.25rem 0; color: #666;">{{ task.description }}</p>
                    {% endif %}
                    <small>{{ task.created_at.strftime("%m-%d %H:%M") }}</small>
                </div>
                <div>
                    <form action="/tasks/{{ task.id }}/toggle" method="post" style="display: inline;">
                        <button type="submit" class="secondary" style="padding: 0.3rem 0.6rem;">
                            {% if task.done %}↩️{% else %}✅{% endif %}
                        </button>
                    </form>
                    <form action="/tasks/{{ task.id }}/delete" method="post" style="display: inline;">
                        <button type="submit" class="contrast" style="padding: 0.3rem 0.6rem;">🗑️</button>
                    </form>
                </div>
            </div>
        </article>
        {% endfor %}

        {% if not tasks %}
        <p style="text-align: center; color: #999; margin-top: 2rem;">暂无任务，添加一个吧！</p>
        {% endif %}
    </main>
</body>
</html>
```

### 代码演进 v2：分层架构 + HTMX 动态交互

```python
# v2: Layered architecture with HTMX, service layer, proper error handling

# --- app/database.py ---
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "tasks.db"))
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency for getting DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    from .models import Task  # noqa: F401
    Base.metadata.create_all(bind=engine)


# --- app/models.py ---
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from .database import Base


class Task(Base):
    """Task model with priority support."""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000), default="")
    done = Column(Boolean, default=False)
    priority = Column(String(10), default="medium")  # low, medium, high
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


# --- app/schemas.py ---
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class TaskCreate(BaseModel):
    """Schema for creating a task."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")


class TaskResponse(BaseModel):
    """Schema for task response."""
    id: int
    title: str
    description: str
    done: bool
    priority: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- app/services/task_service.py ---
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Task
from ..schemas import TaskCreate


class TaskService:
    """Business logic for task operations."""

    @staticmethod
    def list_tasks(db: Session, status: str = "all"):
        """Get tasks filtered by status."""
        query = db.query(Task)
        if status == "pending":
            query = query.filter(Task.done == False)  # noqa: E712
        elif status == "done":
            query = query.filter(Task.done == True)  # noqa: E712
        return query.order_by(Task.created_at.desc()).all()

    @staticmethod
    def create_task(db: Session, data: TaskCreate) -> Task:
        """Create a new task."""
        task = Task(**data.model_dump())
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def toggle_task(db: Session, task_id: int) -> Task | None:
        """Toggle task completion."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            task.done = not task.done
            task.completed_at = datetime.utcnow() if task.done else None
            db.commit()
            db.refresh(task)
        return task

    @staticmethod
    def delete_task(db: Session, task_id: int) -> bool:
        """Delete a task."""
        task = db.query(Task).filter(Task.id == task_id).first()
        if task:
            db.delete(task)
            db.commit()
            return True
        return False

    @staticmethod
    def get_stats(db: Session) -> dict:
        """Get task statistics."""
        total = db.query(Task).count()
        done = db.query(Task).filter(Task.done == True).count()  # noqa: E712
        return {"total": total, "done": done, "pending": total - done}


# --- app/routers/tasks.py ---
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.task_service import TaskService
from ..schemas import TaskCreate, TaskResponse

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def api_list_tasks(status: str = "all", db: Session = Depends(get_db)):
    """REST API: List all tasks."""
    return TaskService.list_tasks(db, status)


@router.post("", response_model=TaskResponse)
def api_create_task(data: TaskCreate, db: Session = Depends(get_db)):
    """REST API: Create a task."""
    return TaskService.create_task(db, data)


@router.get("/stats")
def api_stats(db: Session = Depends(get_db)):
    """REST API: Get task statistics."""
    return TaskService.get_stats(db)


# --- app/routers/pages.py ---
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import os
from ..database import get_db
from ..services.task_service import TaskService
from ..schemas import TaskCreate

router = APIRouter()
templates = Jinja2Templates(
    directory=os.path.join(os.path.dirname(__file__), "..", "templates")
)


@router.get("/", response_class=HTMLResponse)
def page_index(request: Request, status: str = "all", db: Session = Depends(get_db)):
    """Render main page."""
    tasks = TaskService.list_tasks(db, status)
    stats = TaskService.get_stats(db)
    return templates.TemplateResponse("index.html", {
        "request": request, "tasks": tasks, "stats": stats, "current_filter": status
    })


@router.post("/tasks", response_class=HTMLResponse)
def page_create_task(
    request: Request,
    title: str = Form(...),
    description: str = Form(default=""),
    priority: str = Form(default="medium"),
    db: Session = Depends(get_db),
):
    """Create task and return updated list (HTMX)."""
    TaskService.create_task(db, TaskCreate(title=title, description=description, priority=priority))
    tasks = TaskService.list_tasks(db)
    return templates.TemplateResponse("partials/task_list.html", {"request": request, "tasks": tasks})


@router.post("/tasks/{task_id}/delete")
def page_delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete task."""
    TaskService.delete_task(db, task_id)
    return RedirectResponse(url="/", status_code=303)


# --- app/main.py ---
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .database import init_db
from .routers import tasks, pages
import os

app = FastAPI(title="Tasker v2", version="2.0.0")

init_db()

app.include_router(tasks.router)
app.include_router(pages.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
```

### 代码演进 v3：生产就绪 + 测试 + Docker

```python
# v3: Production-ready with testing, Docker, config management

# --- app/config.py ---
import os
from dataclasses import dataclass


@dataclass
class Settings:
    """Application settings from environment variables."""
    db_url: str = os.getenv("DATABASE_URL", "sqlite:///./tasks.db")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))


settings = Settings()


# --- tests/test_tasks.py ---
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

# Use in-memory SQLite for tests
TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=TEST_ENGINE)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create and drop tables for each test."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


client = TestClient(app)


def test_create_task():
    resp = client.post("/api/tasks", json={"title": "Test task", "priority": "high"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test task"
    assert data["done"] is False


def test_list_tasks():
    client.post("/api/tasks", json={"title": "Task 1"})
    client.post("/api/tasks", json={"title": "Task 2"})
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_task_stats():
    client.post("/api/tasks", json={"title": "Task 1"})
    resp = client.get("/api/tasks/stats")
    assert resp.json()["total"] == 1
    assert resp.json()["pending"] == 1


def test_validation_empty_title():
    resp = client.post("/api/tasks", json={"title": ""})
    assert resp.status_code == 422
```

**Dockerfile：**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**requirements.txt：**

```
fastapi>=0.110
uvicorn[standard]>=0.29
sqlalchemy>=2.0
jinja2>=3.1
python-multipart>=0.0.9
pydantic>=2.0
```

## 执行预览

```bash
# 1. 创建项目
$ mkdir tasker && cd tasker
$ python -m venv venv
$ source venv/bin/activate
$ pip install fastapi uvicorn sqlalchemy jinja2 python-multipart

# 2. 运行 v1 单文件版本
$ python app.py
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)

# 3. 浏览器访问 http://localhost:8000
# → 看到 Tasker 界面，可添加、完成、删除任务

# 4. 运行 v3 测试
$ pip install pytest httpx
$ pytest tests/ -v
# test_create_task PASSED
# test_list_tasks PASSED
# test_task_stats PASSED
# test_validation_empty_title PASSED
# 4 passed in 0.15s

# 5. Docker 部署
$ docker build -t tasker .
$ docker run -p 8000:8000 -e SECRET_KEY=my-secret tasker
```

**API 自动文档（FastAPI 自带 Swagger UI）：**

```
访问 http://localhost:8000/docs → 自动生成的交互式 API 文档
GET  /api/tasks       - 列出所有任务
POST /api/tasks       - 创建任务
GET  /api/tasks/stats - 获取统计
```

## 注意事项

| 项目 | 说明 | 重要程度 |
|------|------|----------|
| 虚拟环境 | 每个项目独立 venv，避免依赖冲突 | ⭐⭐⭐ |
| 数据库迁移 | 生产环境用 Alembic 管理迁移 | ⭐⭐⭐ |
| 环境变量 | 敏感信息不放代码，用 .env | ⭐⭐⭐ |
| 错误处理 | API 返回正确的 HTTP 状态码 | ⭐⭐⭐ |
| CSRF 保护 | 表单提交需要 CSRF Token | ⭐⭐ |
| 异步支持 | FastAPI 支持 async，IO 密集场景用异步 | ⭐⭐ |
| 静态文件缓存 | 生产环境用 Nginx 处理静态文件 | ⭐⭐ |

## 避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| 把所有代码写在一个文件 | 按职责分层：models / services / routers |
| 直接拼接 SQL 字符串 | 用 ORM 或参数化查询防注入 |
| 不做数据验证 | 用 Pydantic Schema 验证输入 |
| 不写测试 | 至少覆盖核心 CRUD 和边界情况 |
| 用 print 调试 | 用 logging 模块，分级别输出 |
| 忽略 CORS | API 被前端调用时配置 CORS 中间件 |
| SQLite 写锁冲突 | 生产环境换 PostgreSQL |

## 练习题

### 🟢 基础题

1. **添加用户系统**：在 Task 模型上添加 `owner` 字段，实现简单的多用户任务管理。

2. **导出功能**：添加一个 `/tasks/export` 接口，将任务导出为 CSV 文件下载。

### 🟡 进阶题

3. **任务标签系统**：实现多对多关系——Task 和 Tag，支持按标签筛选任务。

4. **定时提醒**：用 APScheduler 实现任务到期提醒，在 `due_date` 到期时发送通知。

### 🔴 挑战题

5. **WebSocket 实时更新**：用 FastAPI WebSocket 实现——当一个浏览器添加任务时，其他打开的页面自动刷新列表。

6. **完整的 CI/CD**：配置 GitHub Actions，实现 push 后自动运行测试、构建 Docker 镜像、推送到镜像仓库。

## 知识点总结

```
Python Web 应用知识树
├── 项目结构
│   ├── 分层架构(routers/services/models)
│   ├── 配置管理(环境变量)
│   └── 依赖注入(FastAPI Depends)
├── 数据层
│   ├── SQLAlchemy 2.0 ORM
│   ├── 模型定义与关系
│   ├── 数据库会话管理
│   └── 迁移管理(Alembic)
├── API 层
│   ├── RESTful 设计
│   ├── Pydantic 验证
│   ├── 自动文档(Swagger)
│   └── 错误处理
├── 前端层
│   ├── Jinja2 模板
│   ├── HTMX 动态交互
│   └── 表单处理
├── 测试
│   ├── pytest 配置
│   ├── TestClient
│   └── 内存数据库测试
└── 部署
    ├── Uvicorn ASGI
    ├── Docker 容器化
    └── 环境变量管理
```

## 举一反三

| 你学到的 | 可以应用到 | 具体场景 |
|---------|-----------|---------|
| 分层架构 | 任何 Python Web 项目 | Django/Flask 项目也能用同样的分层思路 |
| ORM 模型设计 | 数据库设计 | 任何需要持久化的应用（博客、电商） |
| Pydantic 验证 | API 数据校验 | 配置文件解析、外部 API 响应验证 |
| 依赖注入 | 代码解耦 | 数据库会话、认证、配置都可以注入 |
| HTMX 前端交互 | 快速原型开发 | 不用写 JS 也能做动态页面 |
| Docker 部署 | 任何后端服务 | 统一的部署流程，环境一致性 |

## 参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 文档](https://docs.sqlalchemy.org/en/20/)
- [HTMX 官方文档](https://htmx.org/)
- [Pydantic V2 文档](https://docs.pydantic.dev/)
- [Uvicorn 部署指南](https://www.uvicorn.org/deployment/)

## 代码演进路线

```
v1 单文件 MVP（100行）
 └── 能用：添加、完成、删除任务
     └── v2 分层架构（300行）
         └── routers/services/models 分离 + HTMX
             └── v3 生产就绪（500行+测试+Docker）
                 └── 配置管理、测试套件、容器化
                     └── 下一步：认证系统 + WebSocket + CI/CD
```

**v1 → v2 改进点**：从单文件拆分为分层架构，引入 Service 层封装业务逻辑，使用 HTMX 实现局部刷新，添加 Pydantic 数据验证。

**v2 → v3 改进点**：添加完整的 pytest 测试套件（内存数据库隔离测试），配置管理（环境变量），Dockerfile 容器化，为生产部署做好准备。
