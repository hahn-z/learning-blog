---
title: "003 - Python 异步 Web 编程：FastAPI + aiohttp 实战指南"
slug: "003-async-web"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.361+08:00"
updated_at: "2026-04-29T10:02:47.526+08:00"
reading_time: 33
tags: []
---

> **难度标注**：⭐⭐⭐⭐ 高级 | 预计阅读时间：25 分钟
> **前置知识**：asyncio 基础、HTTP 协议概念、Web 开发基础

---

## 一、概念讲解

异步 Web 编程 = asyncio + Web 框架。核心价值：**单线程处理数千并发连接**，特别适合 I/O 密集的 Web 服务。

### 1.1 为什么需要异步 Web

| 场景 | 同步框架（Flask/Django） | 异步框架 |
|------|------------------------|---------|
| 1000 个并发请求 | 需要 50+ 线程/进程 | 1 个线程搞定 |
| 等待数据库/外部 API | 线程被阻塞 | 协程让出，处理其他请求 |
| WebSocket 长连接 | 需要额外线程 | 原生支持 |
| 资源消耗 | 高（线程栈、GIL 竞争） | 低（协程轻量） |

### 1.2 主流异步 Web 框架对比

| 框架 | 特点 | 适合场景 |
|------|------|---------|
| **FastAPI** | 高性能、自动文档、类型验证 | API 服务（首选） |
| **aiohttp** | 成熟稳定、底层灵活 | 需要精细控制 |
| **Starlette** | 轻量，FastAPI 的底层 | 微服务/中间件 |
| **Sanic** | 类 Flask 风格 | Flask 用户迁移 |

### 1.3 异步 Web 服务架构

```
Client → [aiohttp/FastAPI Server] → Event Loop
              ↓                        ↓
         Route Handler            Schedule I/O
              ↓                        ↓
      await db.query()          await httpx.get()
              ↓                        ↓
         Response ← ← ← ← ← I/O Complete
```

---

## 二、脑图

```
异步 Web 编程
├── 服务端
│   ├── FastAPI
│   │   ├── async def 路由
│   │   ├── 依赖注入
│   │   ├── WebSocket
│   │   └── 中间件
│   ├── aiohttp.web
│   │   ├── web.Application
│   │   ├── web.Request/Response
│   │   └── web.websocket
│   └── 数据库
│       ├── asyncpg (PostgreSQL)
│       ├── motor (MongoDB)
│       └── databases (SQLAlchemy 兼容)
├── 客户端
│   ├── aiohttp.ClientSession
│   ├── httpx.AsyncClient
│   └── 并发请求 + 限流
└── 部署
    ├── uvicorn (ASGI server)
    ├── gunicorn + uvicorn workers
    └── Docker + Nginx
```

---

## 三、完整代码

### 3.1 FastAPI 异步 API 服务

```python
# server.py — Run with: uvicorn server:app --reload
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
import uvicorn

app = FastAPI(title="Async Demo API")

# --- Models ---
class Item(BaseModel):
    name: str
    price: float
    description: str = ""

# --- In-memory store ---
_db: dict = {}
_counter = 0

# --- Routes ---
@app.get("/")
async def root():
    return {"message": "Async API is running"}

@app.post("/items", status_code=201)
async def create_item(item: Item):
    global _counter
    _counter += 1
    await asyncio.sleep(0.1)  # Simulate async DB write
    _db[_counter] = item
    return {"id": _counter, **item.model_dump()}

@app.get("/items/{item_id}")
async def get_item(item_id: int):
    await asyncio.sleep(0.05)  # Simulate async DB read
    if item_id not in _db:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": item_id, **_db[item_id].model_dump()}

@app.get("/items")
async def list_items(skip: int = 0, limit: int = 10):
    await asyncio.sleep(0.05)
    items = [
        {"id": k, **v.model_dump()}
        for k, v in list(_db.items())[skip:skip+limit]
    ]
    return {"items": items, "total": len(_db)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3.2 aiohttp 异步 HTTP 客户端

```python
import asyncio
import aiohttp
import time

async def fetch_one(session, url):
    # Fetch a single URL with error handling
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            return {
                "url": url,
                "status": resp.status,
                "length": len(await resp.text()),
            }
    except Exception as e:
        return {"url": url, "error": str(e)}

async def fetch_many(urls, max_concurrent=5):
    # Fetch multiple URLs concurrently with rate limiting
    sem = asyncio.Semaphore(max_concurrent)

    async def limited_fetch(session, url):
        async with sem:
            return await fetch_one(session, url)

    async with aiohttp.ClientSession() as session:
        tasks = [limited_fetch(session, url) for url in urls]
        return await asyncio.gather(*tasks)

async def main_client():
    urls = [
        "https://httpbin.org/get",
        "https://httpbin.org/delay/1",
        "https://httpbin.org/delay/2",
        "https://httpbin.org/status/404",
        "https://httpbin.org/json",
    ]
    start = time.time()
    results = await fetch_many(urls, max_concurrent=3)
    for r in results:
        print(r)
    print(f"
Total time: {time.time()-start:.1f}s")

asyncio.run(main_client())
```

### 3.3 WebSocket 实时通信

```python
# ws_server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json

app = FastAPI()

class ConnectionManager:
    # Manage active WebSocket connections
    def __init__(self):
        self.active: list = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: str, sender: WebSocket):
        for connection in self.active:
            if connection != sender:
                await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            await manager.broadcast(
                json.dumps({"user": msg["user"], "text": msg["text"]}),
                sender=ws
            )
    except WebSocketDisconnect:
        manager.disconnect(ws)
        await manager.broadcast(
            json.dumps({"system": "A user disconnected"}),
            sender=None
        )
```

### 3.4 异步数据库操作

```python
import asyncio
import asyncpg

async def db_demo():
    # Demo async PostgreSQL operations with asyncpg
    conn = await asyncpg.connect(
        host="localhost", port=5432,
        user="postgres", password="password", database="testdb"
    )

    # Create table
    await conn.execute(
        "CREATE TABLE IF NOT EXISTS users ("
        " id SERIAL PRIMARY KEY,"
        " name VARCHAR(100),"
        " email VARCHAR(255) UNIQUE)"
    )

    # Insert (parameterized, safe from SQL injection)
    await conn.execute(
        "INSERT INTO users (name, email) VALUES ($1, $2)",
        "Alice", "alice@example.com"
    )

    # Batch insert
    users = [("Bob", "bob@test.com"), ("Charlie", "charlie@test.com")]
    await conn.executemany(
        "INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        users
    )

    # Query
    rows = await conn.fetch("SELECT * FROM users")
    for row in rows:
        print(dict(row))

    # Transaction
    async with conn.transaction():
        await conn.execute(
            "UPDATE users SET name = $1 WHERE email = $2",
            "Alice Updated", "alice@example.com"
        )
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
        print(f"Total users: {count}")

    await conn.close()

# asyncio.run(db_demo())
```

---

## 四、执行预览

```bash
# FastAPI server startup
$ uvicorn server:app --reload
INFO:     Uvicorn running on http://0.0.0.0:8000

# Client fetch output
{'url': 'https://httpbin.org/get', 'status': 200, 'length': 308}
{'url': 'https://httpbin.org/delay/1', 'status': 200, 'length': 297}
{'url': 'https://httpbin.org/delay/2', 'status': 200, 'length': 297}
{'url': 'https://httpbin.org/status/404', 'status': 404, 'length': 0}
{'url': 'https://httpbin.org/json', 'status': 200, 'length': 429}

Total time: 2.1s  # 5 requests in ~2s thanks to concurrency

# Database query
{'id': 1, 'name': 'Alice Updated', 'email': 'alice@example.com'}
{'id': 2, 'name': 'Bob', 'email': 'bob@test.com'}
{'id': 3, 'name': 'Charlie', 'email': 'charlie@test.com'}
Total users: 3
```

---

## 五、注意事项

| 要点 | 说明 |
|------|------|
| ASGI vs WSGI | FastAPI/aiohttp 是 ASGI，需要 uvicorn/daphne；Flask 是 WSGI |
| 同步路由 | FastAPI 支持普通 `def` 路由，会自动放线程池，但不如 `async def` |
| 数据库驱动 | 必须用异步驱动：asyncpg、motor、aiosqlite 等 |
| 部署 | 生产环境用 `gunicorn -k uvicorn.workers.UvicornWorker` |
| CORS | FastAPI 需加 `CORSMiddleware` |
| 超时 | 始终设置请求超时 `ClientTimeout(total=30)` |
| 连接池 | `aiohttp.ClientSession()` 复用连接，不要每次请求新建 |

---

## 六、避坑指南

### ❌ 每次请求新建 Session → ✅ 复用 Session

```python
# ❌ New connection per request (slow, resource waste)
async def fetch(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as r:
            return await r.text()

# ✅ Share session across requests
_session = None
async def get_session():
    global _session
    if _session is None:
        _session = aiohttp.ClientSession()
    return _session

async def fetch(url):
    session = await get_session()
    async with session.get(url) as r:
        return await r.text()
```

### ❌ FastAPI 中用同步数据库驱动 → ✅ 用异步驱动

```python
# ❌ Blocks the event loop
@app.get("/users")
def get_users():
    users = psycopg2.query("SELECT * FROM users")  # Blocking!
    return users

# ✅ Async database driver
@app.get("/users")
async def get_users():
    async with asyncpg.create_pool(dsn) as pool:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM users")
            return [dict(r) for r in rows]
```

### ❌ 不处理 WebSocket 异常 → ✅ 用 WebSocketDisconnect

```python
# ❌ Unhandled disconnect crashes the handler
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    while True:
        data = await ws.receive_text()  # Raises on disconnect!

# ✅ Graceful disconnect handling
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            await ws.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        print("Client disconnected normally")
```

### ❌ 单 worker 部署 → ✅ 多 worker + 反向代理

```bash
# ❌ Single worker for production
uvicorn app:app --host 0.0.0.0 --port 8000

# ✅ Multiple workers with gunicorn
gunicorn app:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8000
```

---

## 七、练习题

### 🟢 基础题

**题目 1**：用 FastAPI 创建一个异步 CRUD API，支持 Todo 的增删改查，数据存在内存 dict 中。

**题目 2**：用 `aiohttp.ClientSession` 并发请求 `httpbin.org` 的 5 个不同端点，打印每个响应的状态码。

### 🟡 进阶题

**题目 3**：实现一个异步代理服务器：接收请求，异步转发到目标 URL，返回响应。支持并发限流。

**题目 4**：用 FastAPI WebSocket 实现一个实时聊天室，支持多个用户同时连接和广播消息。

### 🔴 挑战题

**题目 5**：实现一个完整的异步微服务：FastAPI + asyncpg + Redis（aioredis），包含用户注册/登录（JWT）、RESTful API、WebSocket 通知、Docker Compose 部署。

---

## 八、知识点总结

```
异步 Web 编程
├── 服务端框架
│   ├── FastAPI
│   │   ├── async def 路由处理
│   │   ├── Pydantic 模型验证
│   │   ├── 依赖注入系统
│   │   ├── WebSocket 支持
│   │   └── 自动 OpenAPI 文档
│   └── aiohttp.web
│       ├── web.Application / web.RouteTableDef
│       ├── web.Request / web.Response
│       └── web.WebSocketResponse
├── 客户端
│   ├── aiohttp.ClientSession → 连接复用
│   ├── httpx.AsyncClient → requests 风格
│   └── 限流: Semaphore / Token Bucket
├── 数据库
│   ├── asyncpg (PostgreSQL)
│   ├── motor (MongoDB)
│   └── aiosqlite (SQLite)
└── 部署
    ├── uvicorn — ASGI 服务器
    ├── gunicorn + uvicorn workers
    ├── Nginx 反向代理
    └── Docker 容器化
```

---

## 九、举一反三

| 场景 | 技术方案 | 关键点 |
|------|---------|--------|
| REST API 服务 | FastAPI + asyncpg | 自动文档 + 异步数据库 |
| 实时聊天 | FastAPI WebSocket | ConnectionManager 广播 |
| Web 爬虫 | aiohttp + asyncio | Semaphore 限流 + 重试 |
| SSE 推送 | FastAPI StreamingResponse | async generator |
| 文件上传 | FastAPI UploadFile | 异步读写磁盘 |
| 定时任务 | asyncio.create_task + sleep | 后台任务循环 |
| 微服务通信 | httpx.AsyncClient | 服务间异步调用 |
| API 网关 | FastAPI 中间件 | 认证 + 限流 + 日志 |

---

## 十、参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [aiohttp 官方文档](https://docs.aiohttp.org/)
- [uvicorn 文档](https://www.uvicorn.org/)
- [asyncpg 文档](https://magicstack.github.io/asyncpg/)
- [ASGI 规范](https://asgi.readthedocs.io/)
- Real Python: [Async.await Web Scraping](https://realpython.com/python-async-await/)

---

## 十一、代码演进

### 需求：构建一个异步 API 服务

```python
# v1: Flask synchronous — simple but blocks under load
from flask import Flask, jsonify, request

app = Flask(__name__)
_db = {}

@app.route("/items", methods=["POST"])
def create_item():
    data = request.json
    _db[data["name"]] = data
    return jsonify(data), 201

@app.route("/items/<name>")
def get_item(name):
    return jsonify(_db.get(name, {"error": "not found"}))

# v2: FastAPI async — non-blocking, auto docs
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio

app = FastAPI()
_db = {}

class Item(BaseModel):
    name: str
    value: int

@app.post("/items")
async def create_item(item: Item):
    await asyncio.sleep(0.05)  # Simulate async DB
    _db[item.name] = item
    return item

@app.get("/items/{name}")
async def get_item(name: str):
    await asyncio.sleep(0.02)
    if name not in _db:
        raise HTTPException(404, "Not found")
    return _db[name]

# v3: Production-ready with async DB, CORS, middleware
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncpg

pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool("postgres://user:pass@localhost/db")
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

@app.post("/items", status_code=201)
async def create_item(item: Item):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO items (name, value) VALUES ($1, $2)",
            item.name, item.value
        )
    return item
```

**演进说明**：v1 Flask 同步阻塞 → v2 FastAPI 异步 + 自动文档 → v3 生产级：连接池、生命周期、CORS、异步数据库。
