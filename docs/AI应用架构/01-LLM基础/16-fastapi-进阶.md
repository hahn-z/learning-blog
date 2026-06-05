# FastAPI进阶：中间件、CORS与生命周期

> 分类：Web框架 | FastAPI进阶 | 难度：⭐⭐⭐ | 预估用时：45 分钟

---

## 🎯 学习目标

1. ✅ 能解释中间件的执行顺序与洋葱模型（理解）
2. ✅ 能独立实现自定义中间件、CORS 配置、后台任务（应用）
3. ✅ 能排查跨域请求失败、依赖注入循环等问题（分析）
4. ✅ 能根据场景选择 lifespan vs startup/shutdown 事件（评价）

---

## 📋 前置知识自检

1. **你能用 FastAPI 写一个带路径参数和请求体的路由吗？**（答不上来？→ [《FastAPI入门》](15-fastapi-入门实战.md)）
2. **你了解 HTTP 中间件的概念吗？**（答不上来？→ 先了解 WSGI/ASGI 中间件概念）
3. **你知道什么是 CORS 吗？**（答不上来？→ 先了解浏览器同源策略）

---

## 💡 概念讲解

### 中间件（Middleware）
- **一句话定义**：中间件是包裹在每个请求处理前后的钩子函数，按洋葱模型依次执行。
- **现实类比**：像地铁安检——所有人（请求）进出都要过一道安检（中间件），可以查包、记录、拦截。
- **技术场景**：请求日志、认证鉴权、CORS、请求耗时统计、限流。
- **⚠️ 常见误解**：以为中间件只处理请求进来，其实它同时处理请求和响应（洋葱模型的内外两层）。

### 生命周期（Lifespan）
- **一句话定义**：应用启动和关闭时执行的异步上下文管理器，用于初始化/清理资源。
- **现实类比**：开店时开灯摆桌（startup），关店时锁门断电（shutdown）。
- **技术场景**：数据库连接池初始化、Redis 连接、加载 ML 模型到内存。

---

## 🧠 实时脑图

```text
请求进入 🔴
    ↓
[中间件A - before] 🟡 ← 日志/计时
    ↓
[中间件B - before] 🔴 ← CORS/认证
    ↓
路由处理 🔴 ← 业务逻辑 + 依赖注入
    ↓
[中间件B - after] 🔴 ← 修改响应头
    ↓
[中间件A - after] 🟡 ← 记录耗时
    ↓
响应返回 🟢

── 应用生命周期 ──
[Lifespan startup] 🔴 ← DB连接池/模型加载
        ↓
   处理请求...
        ↓
[Lifespan shutdown] 🟢 ← 释放资源
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、FastAPI 0.100+

```python
# advanced_app.py
# Python 3.10+
import time
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── 配置日志 ───────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")


# ── 1. Lifespan 生命周期 ───────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / Shutdown lifecycle"""
    # Startup: 初始化资源
    logger.info("🚀 应用启动 - 初始化资源...")
    app.state.db_connected = True
    app.state.start_time = time.time()
    yield
    # Shutdown: 释放资源
    logger.info("👋 应用关闭 - 释放资源...")
    app.state.db_connected = False


app = FastAPI(
    title="FastAPI 进阶示例",
    lifespan=lifespan,
)


# ── 2. CORS 中间件 ────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-frontend.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 3. 自定义中间件：请求耗时统计 ────────────────

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """记录请求耗时并添加到响应头"""
    start = time.time()
    logger.info(f"→ {request.method} {request.url.path}")

    response = await call_next(request)

    elapsed = time.time() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
    logger.info(f"← {request.method} {request.url.path} [{elapsed:.4f}s]")
    return response


# ── 4. 依赖注入 ────────────────────────────────────

def verify_api_key(request: Request) -> str:
    """简单的 API Key 鉴权依赖"""
    api_key = request.headers.get("X-API-Key")
    if api_key != "my-secret-key":
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return api_key


def get_db_status(request: Request) -> bool:
    """获取数据库状态（模拟）"""
    return request.app.state.db_connected


# ── 5. 后台任务 ────────────────────────────────────

def send_notification(task_name: str) -> None:
    """模拟发送通知的后台任务"""
    time.sleep(2)  # Simulate slow work
    logger.info(f"📧 通知已发送：任务 '{task_name}' 完成")


# ── 6. 路由 ────────────────────────────────────────

@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "FastAPI 进阶示例"}


@app.get("/health")
async def health_check(db_ok: bool = Depends(get_db_status)) -> dict:
    """健康检查 - 依赖注入获取 DB 状态"""
    return {
        "status": "ok" if db_ok else "degraded",
        "uptime": f"{time.time() - app.state.start_time:.0f}s",
    }


@app.get("/protected")
async def protected_route(api_key: str = Depends(verify_api_key)) -> dict:
    """需要 API Key 的受保护路由"""
    return {"message": "你已通过认证", "api_key": f"{api_key[:4]}****"}


@app.post("/tasks/{task_name}")
async def create_task(
    task_name: str,
    background_tasks: BackgroundTasks,
    api_key: str = Depends(verify_api_key),
) -> dict:
    """创建任务 + 后台通知"""
    # Add background task
    background_tasks.add_task(send_notification, task_name)
    return {"message": f"任务 '{task_name}' 已创建，通知将在后台发送"}


# ── 7. 全局异常处理 ────────────────────────────────

class BusinessException(Exception):
    """自定义业务异常"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message


@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=exc.code,
        content={"error": exc.message},
    )


@app.get("/test-error")
async def test_error() -> dict:
    raise BusinessException(code=400, message="这是一个测试业务异常")
```

启动：

```bash
uvicorn advanced_app:app --reload --port 8000
```

---

## 👀 执行预览

```bash
# 普通请求 - 注意响应头中的耗时
$ curl -i http://localhost:8000/health
HTTP/1.1 200 OK
x-process-time: 0.0005s
content-type: application/json
{"status":"ok","uptime":"42s"}

# 受保护路由 - 无 Key
$ curl http://localhost:8000/protected
{"detail":"Invalid API Key"}

# 受保护路由 - 有 Key
$ curl -H "X-API-Key: my-secret-key" http://localhost:8000/protected
{"message":"你已通过认证","api_key":"my-s****"}

# 后台任务
$ curl -X POST -H "X-API-Key: my-secret-key" http://localhost:8000/tasks/send-report
{"message":"任务 'send-report' 已创建，通知将在后台发送"}
# 2秒后日志输出：📧 通知已发送：任务 'send-report' 完成

# 自定义异常
$ curl http://localhost:8000/test-error
{"error":"这是一个测试业务异常"}
```

服务端日志：
```
INFO: 🚀 应用启动 - 初始化资源...
INFO: → GET /health
INFO: ← GET /health [0.0005s]
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ CORS 中间件必须加在所有路由之前 | 跨域请求仍然失败 | 🔴 |
| ⚠️ `add_middleware` 按调用顺序逆序执行 | 执行顺序与预期不符 | 🟡 |
| ⚠️ `BackgroundTasks` 中不要做不可回滚操作 | 任务失败无反馈，数据不一致 | 🟡 |
| ⚠️ `lifespan` 中 yield 前后分别对应 startup/shutdown | 资源未正确初始化或释放 | 🟡 |
| ⚠️ 依赖注入函数是同步的不会异步执行 | I/O 密集依赖会阻塞事件循环 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ CORS 配置 `allow_origins=["*"]` 且 `allow_credentials=True` | 浏览器拒绝，CORS 策略不允许 | ✅ 指定具体域名或去掉 `allow_credentials` |
| ❌ `middleware` 中忘记 `await call_next(request)` | 请求被吞掉，无响应 | ✅ 必须调用 `call_next` 并 await |
| ❌ 后台任务函数用 `async def` 但内有阻塞 I/O | 阻塞事件循环 | ✅ 阻塞操作用普通 `def`，FastAPI 自动放线程池 |
| ❌ 多个 `Depends` 中互相依赖形成环 | 启动报错或无限递归 | ✅ 拆解依赖关系，保持单向 |

---

## 🔍 调试排查

#### 故障场景1：CORS 预检请求失败

**症状**：浏览器 Console 报 `Access-Control-Allow-Origin` 错误，但 curl 正常
**排查思路**：
1. 打开浏览器 Network，看是否有 `OPTIONS` 预检请求
2. 检查预检请求的响应头是否包含 CORS 头
3. 检查 `allow_origins` 是否包含前端域名（注意端口号）
4. 检查 `allow_methods` 和 `allow_headers` 是否覆盖了请求使用的方法和头

**根因**：`allow_origins` 未包含前端域名，或未配置 `allow_headers`
**修复**：在 `allow_origins` 中添加精确的前端 URL

#### 故障场景2：依赖注入拿不到预期的值

**症状**：`Depends` 注入的参数是 None 或默认值
**排查思路**：
1. 在依赖函数内加日志，确认函数是否被调用
2. 检查函数参数名是否与路由参数冲突
3. 检查是否 `Depends` 嵌套了多层但中间层返回了 None

**根因**：依赖函数返回值未正确传递
**修复**：确认依赖函数有明确的 return 值

---

## 📝 练习题

### 🟢 基础题

1. 画出 3 个中间件（A、B、C）的执行顺序（洋葱模型）。（→ 目标 #1）
2. CORS 中间件的 `allow_origins=["*"]` 在什么场景下不安全？（→ 目标 #2）

### 🟡 进阶题

1. 写一个限流中间件，限制每个 IP 每分钟最多 60 次请求（提示：用 `collections.defaultdict` 存计数）。（→ 目标 #2）
2. 把 `send_notification` 改成真正的 `async` 版本（用 `asyncio.sleep` 替代 `time.sleep`）。（→ 目标 #2）

### 🔴 开放题

1. 设计一个依赖注入链：`verify_token → get_current_user → check_permission("admin")`，如何避免每次请求都查数据库？（→ 目标 #4）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
FastAPI 进阶
├── 中间件
│   ├── @app.middleware("http") 注册
│   ├── 洋葱模型执行顺序
│   ├── call_next(request) 传递给下一层
│   └── CORSMiddleware 跨域配置
├── 生命周期 Lifespan
│   ├── @asynccontextmanager
│   ├── yield 前 = startup
│   └── yield 后 = shutdown
├── 依赖注入 Depends
│   ├── 函数依赖：def func() → Depends(func)
│   ├── 子依赖嵌套
│   └── 全局依赖：dependencies=[Depends(...)]
├── 后台任务 BackgroundTasks
│   ├── background_tasks.add_task(func, *args)
│   └── 同步函数自动放线程池
└── 异常处理
    └── @app.exception_handler(CustomException)
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| API 网关需要统一鉴权 | 用全局 `dependencies=[Depends(verify_api_key)]` |
| 需要记录所有请求日志 | 自定义中间件写日志，结合结构化日志库 |
| 长时间任务 | `BackgroundTasks` 适合秒级，分钟级考虑 Celery |

---

## 🗺️ 学习路径

```
[FastAPI入门] → **📍 本篇：FastAPI进阶** → [LLM API代理服务]
```

**下一篇建议**：
- → [《FastAPI实战：构建LLM API代理服务》](17-fastapi-llm代理服务.md)：将本篇学的中间件、依赖注入、后台任务综合运用到 LLM 代理服务中

**相关主题**：
- [《SSE流式响应》](18-sse-流式响应.md)：流式 LLM 调用的关键技术

---

## 📈 代码演进

```python
# v1: 用 on_event 注册启动/关闭（已弃用）
@app.on_event("startup")
async def startup(): ...

# v2: 用 lifespan 上下文管理器（推荐）
@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown

app = FastAPI(lifespan=lifespan)
```

## 📦 版本兼容性

- ✅ 适配版本：Python 3.10+、FastAPI 0.100+
- ⚠️ FastAPI < 0.93：使用 `@app.on_event("startup")` / `@app.on_event("shutdown")`（已弃用但可用）
- ⚠️ 推荐统一使用 `lifespan`，`on_event` 未来版本将移除

## 📚 参考资料

- [FastAPI Middleware 文档](https://fastapi.tiangolo.com/tutorial/middleware/) [等级：官方]
- [FastAPI CORS 文档](https://fastapi.tiangolo.com/tutorial/cors/) [等级：官方]
- [FastAPI Lifespan 文档](https://fastapi.tiangolo.com/advanced/events/) [等级：官方]

---

## 附录：练习题参考答案

### 基础题 1
请求阶段：A before → B before → C before → 路由处理
响应阶段：C after → B after → A after

### 进阶题 1
```python
from collections import defaultdict
from time import time

_rate_limit: dict[str, list[float]] = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    now = time()
    # Clean up entries older than 60 seconds
    _rate_limit[client_ip] = [t for t in _rate_limit[client_ip] if now - t < 60]
    
    if len(_rate_limit[client_ip]) >= 60:
        return JSONResponse(status_code=429, content={"detail": "Too many requests"})
    
    _rate_limit[client_ip].append(now)
    response = await call_next(request)
    return response
```

### 进阶题 2
```python
import asyncio

async def send_notification(task_name: str) -> None:
    await asyncio.sleep(2)
    logger.info(f"📧 通知已发送：任务 '{task_name}' 完成")
```

### 开放题 1 思路
用 FastAPI 的 `Request` 状态缓存用户信息：在 `verify_token` 中解析 token 后将 user 存入 `request.state.user`，后续依赖直接从 `request.state` 读取，避免重复查询。
