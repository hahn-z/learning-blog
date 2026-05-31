---
title: "005 - FastAPI进阶：依赖注入与中间件实战"
slug: "005-fastapi-advanced"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.483+08:00"
updated_at: "2026-04-29T10:02:47.701+08:00"
reading_time: 29
tags: []
---

# FastAPI进阶：依赖注入与中间件实战

> **难度标注：** ⭐⭐⭐⭐☆（中高级）
> **前置知识：** FastAPI基础、Python装饰器、异步编程概念
> **预计阅读时间：** 30分钟

---

## 一、概念讲解

### 依赖注入（Dependency Injection）

依赖注入是一种设计模式，核心思想是：**组件不自己创建依赖，而是从外部接收依赖**。FastAPI 把这个概念深度集成到了框架中。

```
传统方式：路由函数自己创建数据库连接、验证token、获取配置
依赖注入：框架帮你做完这些，路由函数只关心业务逻辑
```

**FastAPI 依赖注入的三种形式：**
1. **函数依赖**：普通 Python 函数，返回需要的值
2. **类依赖**：用类作为依赖，支持 `__call__`
3. **子依赖**：依赖可以依赖其他依赖，形成依赖链

### 中间件（Middleware）

中间件是一个函数，在每个请求处理前后执行代码。可以理解为"请求流水线上的检查站"。

```
请求 -> 中间件A -> 中间件B -> 路由处理 -> 中间件B -> 中间件A -> 响应
```

**常见用途：** CORS处理、请求日志、认证检查、性能监控、请求ID追踪。

---

## 二、知识脑图

```
FastAPI进阶
├── 依赖注入
│   ├── Depends() 机制
│   ├── 函数依赖
│   ├── 类依赖
│   ├── 子依赖链
│   ├── 全局依赖
│   └── yield依赖（资源管理）
├── 中间件
│   ├── @app.middleware("request")
│   ├── 内置中间件
│   │   ├── CORSMiddleware
│   │   ├── TrustedHostMiddleware
│   │   └── GZipMiddleware
│   ├── 自定义中间件
│   └── 中间件执行顺序
├── 认证与安全
│   ├── OAuth2PasswordBearer
│   ├── JWT Token
│   └── API Key认证
└── 实战模式
    ├── 数据库连接管理
    ├── 请求日志追踪
    └── 统一错误处理
```

---

## 三、代码演进

### v1：基础依赖注入

```python
# v1_dep_injection.py - Basic dependency injection
from fastapi import FastAPI, Depends
from typing import Optional

app = FastAPI()

def pagination_params(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}

@app.get("/items")
def list_items(pagination: dict = Depends(pagination_params)):
    return {"pagination": pagination, "items": []}

@app.get("/users")
def list_users(pagination: dict = Depends(pagination_params)):
    return {"pagination": pagination, "users": []}

# Class-based dependency
class Pagination:
    def __init__(self, skip: int = 0, limit: int = 10):
        self.skip = max(0, skip)
        self.limit = min(100, max(1, limit))

@app.get("/products")
def list_products(page: Pagination = Depends(Pagination)):
    return {"skip": page.skip, "limit": page.limit}
```

v1 要点：
- **函数依赖**：`pagination_params` 返回字典，多个路由复用
- **类依赖**：`Pagination` 类可以做更复杂的验证逻辑
- **Depends()**：告诉 FastAPI "请先执行这个函数，把结果传给我"

### v2：认证 + 中间件

```python
# v2_auth_middleware.py - Authentication and middleware
import time
import secrets
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from typing import Optional

app = FastAPI(title="Secure API", version="2.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom logging middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.time()
    request_id = secrets.token_hex(8)
    request.state.request_id = request_id
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{duration:.3f}s"
    print(f"[{request_id}] {request.method} {request.url.path} - {response.status_code}")
    return response

# Auth dependencies with chaining
API_KEYS = {"admin-key-123": "admin", "user-key-456": "user"}
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_current_user(api_key: str = Depends(api_key_header)):
    if api_key not in API_KEYS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return {"username": API_KEYS[api_key], "api_key": api_key}

async def require_admin(user: dict = Depends(get_current_user)):
    # Chain: require_admin depends on get_current_user
    if user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@app.get("/public")
def public_endpoint():
    return {"message": "This is public"}

@app.get("/protected")
def protected_endpoint(user: dict = Depends(get_current_user)):
    return {"message": f"Hello, {user['username']}!"}

@app.get("/admin")
def admin_endpoint(admin: dict = Depends(require_admin)):
    # Dependency chain: require_admin -> get_current_user -> api_key_header
    return {"message": "Welcome, admin!", "data": "sensitive"}
```

v2 新增：
- **CORS中间件**：处理跨域请求，前后端分离必备
- **自定义中间件**：请求追踪ID + 计时，注入到响应头
- **依赖链**：`require_admin` 依赖 `get_current_user`，自动链式调用

### v3：完整生产级方案

```python
# v3_production.py - Production-grade DI + Middleware
import time
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

logger = logging.getLogger("api")
logging.basicConfig(level=logging.INFO)

fake_users_db = {
    "alice": {"username": "alice", "hashed_password": "fakehash", "role": "admin"},
    "bob": {"username": "bob", "hashed_password": "fakehash", "role": "user"},
}

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    username: str
    role: str

# Lifespan: replaces on_event startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    yield
    logger.info("Shutting down...")

app = FastAPI(title="Production API", version="3.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def request_tracing(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", f"auto-{time.time():.0f}")
    start = time.time()
    response = await call_next(request)
    ms = (time.time() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Duration-Ms"] = f"{ms:.1f}"
    logger.info(f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({ms:.1f}ms)")
    return response

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    username = payload.get("sub")
    if username not in fake_users_db:
        raise HTTPException(status_code=401, detail="User not found")
    ud = fake_users_db[username]
    return User(username=ud["username"], role=ud["role"])

async def require_role(*roles: str):
    # Dependency factory: returns a dependency that checks roles
    async def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {roles}")
        return user
    return checker

@app.post("/token", response_model=Token)
def login(username: str, password: str):
    user = fake_users_db.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": username, "role": user["role"]})
    return Token(access_token=token, token_type="bearer")

@app.get("/me", response_model=User)
def read_current_user(user: User = Depends(get_current_user)):
    return user

@app.get("/admin/dashboard")
async def admin_dashboard(user: User = Depends(require_role("admin"))):
    return {"message": f"Admin dashboard for {user.username}", "stats": {"users": 42}}
```

v3 新增：
- **JWT认证**：完整的token创建/验证流程
- **lifespan**：替代旧版 `on_event`，用 `asynccontextmanager` 管理应用生命周期
- **依赖工厂**：`require_role("admin")` 动态创建带参数的依赖

---

## 四、执行预览

```bash
$ uvicorn v3_production:app --reload
INFO: Starting up...

# 获取Token
$ curl -X POST http://localhost:8000/token -d "username=alice&password=secret"
{"access_token":"eyJ...","token_type":"bearer"}

# 访问受保护端点
$ curl http://localhost:8000/me -H "Authorization: Bearer eyJ..."
{"username":"alice","role":"admin"}

# 普通用户访问admin -> 403
$ curl http://localhost:8000/admin/dashboard -H "Authorization: Bearer <bob_token>"
{"detail":"Requires role: ('admin',)"}

# 管理员访问 -> 200
$ curl http://localhost:8000/admin/dashboard -H "Authorization: Bearer <alice_token>"
{"message":"Admin dashboard for alice","stats":{"users":42}}
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 依赖缓存 | 同一请求内相同依赖只执行一次 | FastAPI自动缓存 |
| 中间件顺序 | 按添加顺序的逆序执行响应 | 先添加的最先处理请求 |
| yield依赖 | 用于资源管理 | 确保finally块释放资源 |
| 异步兼容 | 依赖可以是sync或async | FastAPI自动处理 |
| 全局依赖 | 可添加到整个app或router | 用于全局认证 |
| lifespan | 替代旧版on_event装饰器 | 推荐使用asynccontextmanager |

---

## 六、避坑指南

### ❌ 中间件中直接返回响应绕过后续处理
```python
@app.middleware("http")
async def bad_middleware(request, call_next):
    if not request.headers.get("Authorization"):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)  # ❌
    return await call_next(request)
```
### ✅ 用依赖注入处理认证
```python
async def verify_token(token: str = Depends(oauth2_scheme)):
    ...

@app.get("/protected")
def endpoint(user = Depends(verify_token)):  # ✅ 精确控制
    ...
```

### ❌ 忘记关闭数据库连接
```python
def get_db():
    db = Database()
    return db  # ❌ 连接永远不会关闭
```
### ✅ 使用yield依赖管理资源
```python
async def get_db():
    db = Database()
    try:
        yield db  # ✅ 请求完成后自动执行finally
    finally:
        await db.close()
```

### ❌ 依赖工厂返回非async函数
```python
def require_role(role: str):
    def checker(user = Depends(get_current_user)):  # ❌ 非async
        ...
    return checker
```
### ✅ 正确的依赖工厂
```python
async def require_role(*roles: str):
    async def checker(user: User = Depends(get_current_user)):  # ✅
        if user.role not in roles:
            raise HTTPException(status_code=403)
        return user
    return checker
```

---

## 七、练习题

### 🟢 入门题
1. 创建依赖函数 `get_db_version()` 返回模拟数据库版本，在路由中使用
2. 添加计时中间件，在响应头返回请求处理时间

### 🟡 进阶题
3. 实现RBAC：创建 `require_role()` 依赖工厂，支持多角色检查
4. 实现请求限流中间件：同一IP每分钟最多60个请求，超限返回429

### 🔴 挑战题
5. 实现完整JWT认证系统：注册、登录、token刷新、黑名单，用yield依赖管理数据库

---

## 八、知识点总结

```
FastAPI进阶知识树
├── 依赖注入
│   ├── Depends() 核心机制
│   ├── 函数/类/生成器依赖
│   ├── 子依赖链（自动解析）
│   ├── 全局依赖 (app=FastAPI(dependencies=[]))
│   └── yield依赖（资源生命周期）
├── 中间件
│   ├── @app.middleware("http")
│   ├── CORS（跨域）
│   ├── 自定义（日志/追踪/限流）
│   └── 执行顺序（洋葱模型）
├── 认证模式
│   ├── API Key (Header/Query)
│   ├── OAuth2 + JWT
│   └── 角色工厂
└── 生产实践
    ├── lifespan（启动/关闭）
    ├── 结构化日志
    └── 请求追踪ID
```

---

## 九、举一反三

| 场景 | 方案 | 关键模式 |
|------|------|----------|
| 数据库会话管理 | yield依赖 | get_db() + try/yield/finally |
| 多租户隔离 | 依赖注入 | get_tenant() 从Header提取 |
| 缓存层 | 中间件 | 检查缓存命中则短路返回 |
| 请求日志 | 中间件 | 统一记录请求/响应 |
| 限流 | 中间件+Redis | 滑动窗口计数 |
| 配置管理 | 全局依赖 | get_settings() 单例模式 |
| API版本控制 | 路由+依赖 | /v1/ /v2/ + 不同依赖 |
| 错误处理 | exception_handler | 全局异常转换 |

---

## 十、参考资料

1. **FastAPI依赖注入**：https://fastapi.tiangolo.com/tutorial/dependencies/
2. **FastAPI中间件**：https://fastapi.tiangolo.com/tutorial/middleware/
3. **FastAPI安全**：https://fastapi.tiangolo.com/tutorial/security/
4. **PyJWT文档**：https://pyjwt.readthedocs.io/
5. **Python DI模式**：https://python-dependency-injector.ets-labs.org/

---

## 十一、代码演进总结

| 版本 | 重点 | 新增能力 |
|------|------|----------|
| v1 | 依赖注入基础 | 函数依赖、类依赖、Depends() |
| v2 | 认证+中间件 | API Key认证、CORS、日志中间件、角色依赖链 |
| v3 | 生产级方案 | JWT认证、lifespan、请求追踪、依赖工厂 |
