# FastAPI实战：构建LLM API代理服务

> 分类：Web框架 | LLM集成 | 难度：⭐⭐⭐⭐ | 预估用时：60 分钟

---

## 🎯 学习目标

1. ✅ 能解释 LLM API 代理服务的架构与各组件职责（理解）
2. ✅ 能独立实现包含流式代理、鉴权、限流、多模型路由的完整服务（应用）
3. ✅ 能排查流式响应中断、限流误触发等生产问题（分析）
4. ✅ 能根据业务需求设计合理的 API 代理架构（创造）

---

## 📋 前置知识自检

1. **你会用 FastAPI 写中间件和依赖注入吗？**（答不上来？→ [《FastAPI进阶》](16-fastapi-进阶.md)）
2. **你了解 SSE 流式响应的基本原理吗？**（答不上来？→ [《SSE流式响应》](18-sse-流式响应.md)）
3. **你调用过 OpenAI/DeepSeek 的 Chat API 吗？**（答不上来？→ [《大模型API初体验》](19-llm-api-初体验.md)）

---

## 💡 概念讲解

- **一句话定义**：LLM API 代理是一个中间层服务，统一鉴权、限流、路由后转发请求到不同的大模型供应商。
- **现实类比**：像一个翻译公司的前台——客户（前端）统一对接前台（代理），前台根据需求分派给不同的翻译官（GPT/Claude/DeepSeek），还能控制排队（限流）和核验身份（鉴权）。
- **技术场景**：多模型统一入口、API Key 管理、用量控制、流式响应转发、日志审计。
- **⚠️ 常见误解**：以为代理只是简单的请求转发。实际上生产级的代理要处理流式数据转发、连接管理、超时控制、错误重试等复杂逻辑。

---

## 🧠 实时脑图

```text
客户端请求 🔴
    ↓
[API Key 鉴权] 🔴 ← Depends(verify_api_key)
    ↓
[速率限制] 🟡 ← slowapi 令牌桶
    ↓
[模型路由] 🔴 ← 根据model字段选择upstream
    ↓
[流式代理] 🔴 ← SSE StreamingResponse
    ↓
LLM 供应商 API 🔴 ← OpenAI / DeepSeek / Claude
    ↓
[错误处理] 🟡 ← 重试 + 友好错误信息
    ↓
客户端响应 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、FastAPI 0.100+、httpx、slowapi

```bash
pip install fastapi uvicorn httpx slowapi python-dotenv
```

```python
# llm_proxy.py
# Python 3.10+
import os
import time
import logging
import asyncio
from typing import Optional
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, Request, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm-proxy")


# ── 配置 ───────────────────────────────────────────

LLM_PROVIDERS: dict[str, dict[str, str]] = {
    "deepseek-chat": {
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
    },
    "gpt-4o-mini": {
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
    },
}

# Valid API keys for our proxy (in production, use a database)
PROXY_API_KEYS: set[str] = set(
    os.getenv("PROXY_API_KEYS", "test-key-001,test-key-002").split(",")
)


# ── Rate Limiter ───────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ── Lifespan ───────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage HTTP client lifecycle"""
    app.state.http_client = httpx.AsyncClient(timeout=120.0)
    logger.info("🚀 LLM Proxy started")
    yield
    await app.state.http_client.aclose()
    logger.info("👋 LLM Proxy stopped")


app = FastAPI(
    title="LLM API Proxy",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str = Field(..., description="Model name, e.g. deepseek-chat")
    messages: list[Message]
    stream: bool = False
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: int = Field(2048, ge=1, le=8192)


# ── Auth Dependency ────────────────────────────────

async def verify_api_key(authorization: str = Header(...)) -> str:
    """Verify proxy API key from Authorization header"""
    # Support both "Bearer xxx" and raw key
    key = authorization.removeprefix("Bearer ").strip()
    if key not in PROXY_API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return key


# ── Provider Resolution ───────────────────────────

def resolve_provider(model: str) -> tuple[str, str]:
    """Return (base_url, api_key) for the given model"""
    if model not in LLM_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model: {model}. Available: {list(LLM_PROVIDERS.keys())}",
        )
    provider = LLM_PROVIDERS[model]
    api_key = os.getenv(provider["api_key_env"], "")
    if not api_key:
        raise HTTPException(status_code=500, detail=f"Provider API key not configured for {model}")
    return provider["base_url"], api_key


# ── Streaming Proxy ────────────────────────────────

async def stream_chat(client: httpx.AsyncClient, url: str, headers: dict, payload: dict):
    """Stream SSE chunks from upstream LLM provider"""
    async with client.stream("POST", url, json=payload, headers=headers) as resp:
        if resp.status_code != 200:
            error_body = await resp.aread()
            logger.error(f"Upstream error: {resp.status_code} {error_body.decode()}")
            yield f"data: {{\"error\": \"upstream returned {resp.status_code}\"}}\n\n"
            return
        async for line in resp.aiter_lines():
            if line.strip():
                yield f"{line}\n\n"
    yield "data: [DONE]\n\n"


# ── Routes ─────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "models": list(LLM_PROVIDERS.keys())}


@app.post("/v1/chat/completions")
@limiter.limit("30/minute")
async def chat_completions(
    request: Request,
    body: ChatRequest,
    api_key: str = Depends(verify_api_key),
) -> StreamingResponse | JSONResponse:
    """
    Main chat completions endpoint.
    Supports both streaming and non-streaming responses.
    """
    base_url, provider_key = resolve_provider(body.model)
    url = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {provider_key}",
        "Content-Type": "application/json",
    }
    payload = body.model_dump()

    logger.info(f"→ model={body.model}, stream={body.stream}, messages={len(body.messages)}")

    client: httpx.AsyncClient = request.app.state.http_client

    if body.stream:
        return StreamingResponse(
            stream_chat(client, url, headers, payload),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            logger.error(f"Upstream error: {resp.status_code} {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=resp.json())
        return JSONResponse(content=resp.json())
```

`.env` 文件：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
OPENAI_API_KEY=sk-your-openai-key
PROXY_API_KEYS=test-key-001,test-key-002
```

Dockerfile：

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY llm_proxy.py .
COPY .env .

EXPOSE 8000
CMD ["uvicorn", "llm_proxy:app", "--host", "0.0.0.0", "--port", "8000"]
```

`requirements.txt`：

```
fastapi>=0.100
uvicorn[standard]
httpx
slowapi
python-dotenv
```

启动：

```bash
uvicorn llm_proxy:app --reload --port 8000
```

---

## 👀 执行预览

```bash
# 健康检查
$ curl http://localhost:8000/health
{"status":"ok","models":["deepseek-chat","gpt-4o-mini"]}

# 非流式请求
$ curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer test-key-001" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
# → 标准 OpenAI 格式响应

# 流式请求
$ curl -N -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer test-key-001" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
# → SSE 流式输出：
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"!"}}]}

data: [DONE]

# 无效 API Key
$ curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"hi"}]}'
{"detail":"Invalid API key"}

# 未知模型
$ curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer test-key-001" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5","messages":[{"role":"user","content":"hi"}]}'
{"detail":"Unknown model: gpt-5. Available: ['deepseek-chat', 'gpt-4o-mini']"}
```

服务端日志：
```
INFO: 🚀 LLM Proxy started
INFO: → model=deepseek-chat, stream=True, messages=1
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 流式响应必须设置 `Cache-Control: no-cache` | 代理/CDN 缓存导致流卡住 | 🔴 |
| ⚠️ httpx 超时设够长（LLM 响应可能很慢） | 长文本生成中途断开 | 🔴 |
| ⚠️ `PROXY_API_KEYS` 不能硬编码在生产代码中 | API Key 泄露 | 🔴 |
| ⚠️ slowapi 的 `@limiter.limit` 需要 `request: Request` 作为第一个参数 | 限流不生效 | 🟡 |
| ⚠️ Docker 部署时不要把 `.env` 打进镜像 | 安全风险 | 🟡 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 流式响应用 `JSONResponse` | 客户端等所有内容生成完才收到 | ✅ 用 `StreamingResponse` + SSE |
| ❌ `httpx.stream` 的 `async for` 写在普通函数中 | 报错，不是协程 | ✅ 用 `async def` |
| ❌ 没设置 `X-Accel-Buffering: no`（Nginx 后面） | Nginx 缓冲导致流不实时 | ✅ 加上这个头 |
| ❌ `verify_api_key` 中直接比较明文 Key | 高安全风险 | ✅ 生产用数据库存储+哈希比较 |

---

## 🔍 调试排查

#### 故障场景1：流式响应卡住不动

**症状**：客户端连接建立但没有数据返回
**排查思路**：
1. 用 curl 直接请求上游 LLM API → 确认上游正常
2. 检查中间代理（Nginx/Cloudflare）是否有缓冲配置
3. 检查 `httpx.AsyncClient` 的 timeout 设置是否够长
4. 在 `stream_chat` 中加日志确认是否进入 `aiter_lines`

**根因**：通常是代理缓冲或超时
**修复**：加 `X-Accel-Buffering: no`、增大 timeout、关闭 Nginx proxy_buffering

#### 故障场景2：限流误触发

**症状**：正常频率请求返回 429
**排查思路**：
1. 检查 `get_remote_address` 返回的 IP → 是否因为反向代理都是 127.0.0.1
2. 检查是否 `@limiter.limit` 装饰器位置不对（必须在 `@app.post` 下面）
3. 确认 `request: Request` 参数存在

**根因**：反向代理时所有请求 IP 相同，或装饰器顺序错误
**修复**：从 `X-Forwarded-For` 或 `X-Real-IP` 获取真实 IP

---

## 📝 练习题

### 🟢 基础题

1. 为什么 LLM 代理服务需要"多模型路由"而不是直接调用一个模型？（→ 目标 #1）
2. 流式响应和非流式响应在代理层的实现有什么核心区别？（→ 目标 #1）

### 🟡 进阶题

1. 给代理加上请求日志：记录每个请求的 model、token 用量、耗时。（→ 目标 #2）
2. 添加一个 `/v1/models` 接口，返回当前可用的模型列表及其状态。（→ 目标 #2）

### 🔴 开放题

1. 如果要支持 1000+ 并发用户同时聊天，当前架构的瓶颈在哪？你会怎么优化？（→ 目标 #4）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
LLM API 代理服务
├── 架构
│   ├── 鉴权层：API Key 依赖注入
│   ├── 限流层：slowapi 令牌桶
│   ├── 路由层：model → provider 映射
│   └── 代理层：httpx 异步转发
├── 流式代理
│   ├── httpx.AsyncClient.stream()
│   ├── StreamingResponse + SSE
│   └── X-Accel-Buffering: no
├── 错误处理
│   ├── 上游非 200 → 友好错误
│   └── 自定义异常处理器
└── 部署
    ├── .env 管理 API Key
    └── Dockerfile 打包
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 企业内部多团队共用 LLM | 代理加团队级 API Key + 用量统计 |
| 需要 fallback 机制 | 主模型超时/报错自动切换备用模型 |
| 审计合规 | 中间件记录所有请求/响应用于审计 |

---

## 🗺️ 学习路径

```
[FastAPI进阶] → **📍 本篇：LLM API代理** → [SSE流式响应深入]
```

**下一篇建议**：
- → [《SSE流式响应：让AI对话实时呈现》](18-sse-流式响应.md)：深入理解流式代理底层的 SSE 协议

**相关主题**：
- [《大模型API初体验》](19-llm-api-初体验.md)：了解上游 LLM API 的工作方式
- [《Messages设计》](20-messages-设计.md)：优化发送给 LLM 的消息结构

---

## 📈 代码演进

```python
# v1: 最简代理 - 硬编码一个模型
@app.post("/chat")
async def chat(body: dict):
    resp = await httpx.post("https://api.deepseek.com/v1/chat/completions", json=body)
    return resp.json()

# v2: 加上鉴权 + 模型路由（本文主体）
# v3: 生产级 - 加上 fallback、重试、用量统计（练习方向）
```

## ⚡ 性能考量

| 方案 | 并发能力 | 延迟增加 | 适用场景 |
|------|----------|----------|----------|
| 同步 requests | ~50 | 低 | 开发调试 |
| httpx 异步 | ~500+ | 低 | 生产推荐 |
| httpx + 连接池 | ~2000+ | 极低 | 高并发 |
| + 多实例 + 负载均衡 | 无上限 | 低 | 大规模 |

**优化建议**：单实例用 `httpx.AsyncClient`（连接池复用），高并发水平扩展。

## 🔒 安全考量

| 风险 | 攻击方式 | 防御措施 | 等级 |
|------|----------|----------|------|
| API Key 泄露 | 代码/日志中暴露 Key | 环境变量 + 不打日志 | 🔴 |
| 无限调用 | 恶意刷接口 | slowapi 限流 | 🟡 |
| SSRF | 构造恶意 model 字段 | 白名单校验 model | 🟡 |
| Prompt 注入 | 通过消息注入指令 | 上层业务过滤 | 🟢 |

## 📦 版本兼容性

- ✅ Python 3.10+、FastAPI 0.100+、httpx 0.25+、slowapi 0.1.8+
- ⚠️ slowapi 与 FastAPI 最新版可能有装饰器兼容问题，注意版本锁定

## 📚 参考资料

- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse) [等级：官方]
- [httpx AsyncClient](https://www.python-httpx.org/advanced/#usage) [等级：官方]
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat) [等级：官方]

---

## 附录：练习题参考答案

### 基础题 1
不同模型有不同优势（代码、推理、创意、成本），代理层统一入口让业务代码无需关心底层切换，也方便做灰度和 fallback。

### 进阶题 1
```python
@app.post("/v1/chat/completions")
@limiter.limit("30/minute")
async def chat_completions(request: Request, body: ChatRequest, api_key: str = Depends(verify_api_key)):
    start = time.time()
    # ... 原有逻辑 ...
    elapsed = time.time() - start
    logger.info(f"← model={body.model}, elapsed={elapsed:.2f}s, stream={body.stream}, key={api_key[:4]}****")
```

### 进阶题 2
```python
@app.get("/v1/models")
async def list_models(api_key: str = Depends(verify_api_key)) -> dict:
    models = []
    for name, provider in LLM_PROVIDERS.items():
        configured = bool(os.getenv(provider["api_key_env"]))
        models.append({"id": name, "configured": configured, "status": "available" if configured else "unconfigured"})
    return {"data": models}
```

### 开放题 1 思路
瓶颈分析：1) httpx 单连接池限制 → 配置 `limits=httpx.Limits(max_connections=1000)`；2) GIL 限制 → 多进程部署（gunicorn + uvicorn workers）；3) LLM API 本身的并发限制 → 多 key 轮询 + 排队机制；4) 内存 → 流式转发不需要缓存完整响应，内存开销小。
