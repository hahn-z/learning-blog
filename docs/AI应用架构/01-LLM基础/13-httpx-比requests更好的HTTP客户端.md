# httpx：比requests更好的HTTP客户端

> 分类：Web基础 | HTTP客户端 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 能够使用 httpx 发送同步和异步 HTTP 请求（应用）
2. ✅ 能够配置超时、重试、流式响应等高级功能（应用）
3. ✅ 能够在 AI 应用中用 httpx 异步调用 LLM API（评价）
4. ✅ 能够对比 httpx 和 requests 的优劣，做出合理选型（评价）

---

## 📋 前置知识自检

1. **你用 `requests` 发过 HTTP 请求吗？**（答不上来？→ [《HTTP协议全解析》](11-http-协议全解析.md)）
2. **你了解 Python `async/await` 基本语法吗？**（答不上来？→ [《Python异步编程入门》](08-python-异步编程入门.md)）

---

## 💡 概念讲解

### httpx

- **一句话定义**：httpx 是 requests 的下一代替代品，同时支持同步和异步请求。
- **现实类比**：requests 是自行车——简单好骑但只能在路上跑；httpx 是电动自行车——同样的骑行体验，还能上高速（异步）。
- **技术场景**：调用 REST API、爬虫、LLM API 调用、微服务通信。
- **⚠️ 常见误解**：httpx 不是 requests 的升级版，是独立项目。但 API 设计刻意兼容 requests，迁移成本极低。

---

## 🧠 实时脑图

```text
[httpx] 🔴
    ||
    ├──→ [同步模式] 🟡 — 和 requests 一样用
    │       └── httpx.Client() 连接池
    ├──→ [异步模式] 🔴 — 核心优势
    │       └── httpx.AsyncClient() 异步连接池
    ├──→ [高级功能] 🟡
    │       ├── 流式响应 — 处理大文件/SSE
    │       ├── 超时配置 — connect/read/write/pool
    │       └── 重试策略 — httpx + tenacity
    └──→ [AI 应用] 🔴
            ├── 异步调用 LLM API
            └── 流式接收 SSE 响应
```

---

## 💻 完整代码

> 运行环境：Python 3.10+, `pip install httpx`

```python
"""
httpx_demo.py - httpx HTTP 客户端完整示例
Python 3.10+ | pip install httpx
"""

import httpx
import asyncio
import time
import json


# ============================================
# 1. 基本用法（同步，和 requests 一样）
# ============================================

print("=" * 50)
print("1. 基本同步请求")

# 简单 GET
resp = httpx.get("https://httpbin.org/get", params={"name": "铁蛋"})
print(f"  GET 状态码: {resp.status_code}")
print(f"  返回参数: {resp.json()['args']}")

# 简单 POST JSON
resp = httpx.post(
    "https://httpbin.org/post",
    json={"title": "学httpx", "priority": "high"},
)
print(f"  POST JSON: {resp.json()['json']}")


# ============================================
# 2. Client 连接池（推荐）
# ============================================

print("\n" + "=" * 50)
print("2. Client 连接池")

with httpx.Client(base_url="https://httpbin.org", timeout=10) as client:
    # 复用连接，性能更好
    resp1 = client.get("/get", params={"req": 1})
    resp2 = client.get("/get", params={"req": 2})
    print(f"  请求1: {resp1.json()['args']}")
    print(f"  请求2: {resp2.json()['args']}")


# ============================================
# 3. 异步请求（核心优势）
# ============================================

async def demo_async():
    print("\n" + "=" * 50)
    print("3. 异步请求")

    async with httpx.AsyncClient(base_url="https://httpbin.org", timeout=10) as client:
        # 并发 5 个请求
        start = time.perf_counter()
        tasks = [client.get(f"/delay/{i}") for i in [1, 2, 1, 2, 1]]
        responses = await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - start
        print(f"  5个异步请求（延迟1-2s），总耗时: {elapsed:.2f}s")
        print(f"  预期约2秒（最慢那个），而非7秒（串行）")


asyncio.run(demo_async())


# ============================================
# 4. 超时配置
# ============================================

print("\n" + "=" * 50)
print("4. 超时配置")

# 精细超时控制
timeout = httpx.Timeout(
    connect=5.0,   # 连接超时
    read=10.0,     # 读取超时
    write=10.0,    # 写入超时
    pool=5.0,      # 连接池等待超时
)

try:
    httpx.get("https://httpbin.org/delay/3", timeout=1.0)
except httpx.TimeoutException as e:
    print(f"  ✅ 超时捕获: {type(e).__name__}")


# ============================================
# 5. 流式响应（大文件 + SSE）
# ============================================

print("\n" + "=" * 50)
print("5. 流式响应")

with httpx.Client(timeout=10) as client:
    # 流式读取，不一次性加载到内存
    with client.stream("GET", "https://httpbin.org/stream/3") as resp:
        for line in resp.iter_lines():
            if line:
                print(f"  📦 流式数据: {line[:50]}...")


# ============================================
# 6. 重试策略（配合 tenacity）
# ============================================

print("\n" + "=" * 50)
print("6. 重试策略")

# pip install tenacity
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def fetch_with_retry(url: str):
    resp = httpx.get(url, timeout=5)
    resp.raise_for_status()  # 4xx/5xx 抛异常 → 触发重试
    return resp.json()

try:
    data = fetch_with_retry("https://httpbin.org/get")
    print(f"  ✅ 重试请求成功: {data['url']}")
except Exception as e:
    print(f"  ❌ 3次重试后仍失败: {e}")


# ============================================
# 7. 实战：异步调用 LLM API（模拟）
# ============================================

async def call_llm_api(client: httpx.AsyncClient, prompt: str, model: str = "gpt-4") -> dict:
    """模拟调用 OpenAI Chat Completions API"""
    # 实际使用时替换为真实 API URL 和 Key
    resp = await client.post(
        "https://httpbin.org/post",  # 模拟 API 端点
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        },
        headers={"Authorization": "Bearer sk-xxx"},
    )
    return resp.json()


async def demo_llm_batch():
    """批量异步调用 LLM API"""
    print("\n" + "=" * 50)
    print("7. 异步批量调用 LLM API（模拟）")

    prompts = [
        "解释 Python 装饰器",
        "什么是 REST API",
        "async/await 原理",
        "Pydantic 怎么用",
        "JWT 是什么",
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        start = time.perf_counter()
        results = await asyncio.gather(
            *[call_llm_api(client, p) for p in prompts]
        )
        elapsed = time.perf_counter() - start
        print(f"  {len(prompts)} 个 LLM 请求并发完成，总耗时: {elapsed:.2f}s")
        for i, r in enumerate(results):
            print(f"    请求{i+1}: {r['json']['messages'][0]['content'][:20]}...")


asyncio.run(demo_llm_batch())


# ============================================
# 8. 性能对比：httpx 异步 vs requests 同步
# ============================================

import requests as req_lib

def sync_benchmark(n: int) -> float:
    """同步 requests 串行调用"""
    start = time.perf_counter()
    for _ in range(n):
        req_lib.get("https://httpbin.org/delay/1", timeout=5)
    return time.perf_counter() - start

async def async_benchmark(n: int) -> float:
    """异步 httpx 并发调用"""
    async with httpx.AsyncClient(timeout=10) as client:
        start = time.perf_counter()
        await asyncio.gather(
            *[client.get("https://httpbin.org/delay/1") for _ in range(n)]
        )
        return time.perf_counter() - start

async def run_benchmark():
    print("\n" + "=" * 50)
    print("8. ⚡ 性能对比（5个请求，每个延迟1秒）")
    sync_time = sync_benchmark(5)
    async_time = await async_benchmark(5)
    print(f"  requests 同步串行: {sync_time:.2f}s")
    print(f"  httpx 异步并发:    {async_time:.2f}s")
    print(f"  提速: {sync_time/async_time:.1f}x")

asyncio.run(run_benchmark())
```

---

## 👀 执行预览

```bash
$ python httpx_demo.py

==================================================
1. 基本同步请求
  GET 状态码: 200
  返回参数: {'name': '铁蛋'}
  POST JSON: {'title': '学httpx', 'priority': 'high'}

==================================================
2. Client 连接池
  请求1: {'req': '1'}
  请求2: {'req': '2'}

==================================================
3. 异步请求
  5个异步请求（延迟1-2s），总耗时: 2.01s

==================================================
4. 超时配置
  ✅ 超时捕获: ReadTimeout

==================================================
5. 流式响应
  📦 流式数据: {"url":"https://httpbin.org/stream/3"...}...

==================================================
6. 重试策略
  ✅ 重试请求成功: https://httpbin.org/get

==================================================
7. 异步批量调用 LLM API（模拟）
  5 个 LLM 请求并发完成，总耗时: 0.45s

==================================================
8. ⚡ 性能对比（5个请求，每个延迟1秒）
  requests 同步串行: 5.12s
  httpx 异步并发:    1.03s
  提速: 5.0x
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 异步模式必须用 `AsyncClient` | 用 `Client` 在 async 函数中会阻塞 | 🔴 |
| ⚠️ 生产环境必须设超时 | 请求可能永远挂住 | 🔴 |
| ⚠️ 大量请求用连接池（Client） | 每次新建连接开销大 | 🟡 |
| ⚠️ 流式响应要用 `stream()` | 大响应一次性加载到内存 | 🟡 |

---

## 🕳️ 避坑指南

### 坑1：在异步函数中用同步 httpx

```python
# ❌ 在 async 函数中用同步 Client，阻塞事件循环
async def bad():
    resp = httpx.get("https://api.example.com")  # 阻塞！

# ✅ 用 AsyncClient
async def good():
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://api.example.com")
```

### 坑2：忘记 close Client

```python
# ❌ 不用 with，忘记关闭
client = httpx.Client()
resp = client.get(url)
# 忘了 client.close()，连接泄漏

# ✅ 用 with 自动管理
with httpx.Client() as client:
    resp = client.get(url)
```

---

## 🔍 调试排查

### 故障场景1：ConnectTimeout 频繁出现

**症状**：大量请求报 ConnectTimeout
**排查思路**：
1. 检查目标服务器是否可达（`curl` 测试）
2. 检查并发数是否过高（用 Semaphore 限制）
3. 增大 `connect` 超时时间
4. 检查 DNS 解析是否正常

### 故障场景2：响应乱码

**症状**：中文响应显示为乱码
**排查思路**：
1. httpx 默认按响应头解码，检查 `Content-Type` 中的 charset
2. 手动指定：`resp.content.decode('utf-8')`

---

## 📝 练习题

### 🟢 基础题

1. 用 httpx 发一个 GET 请求到 `https://httpbin.org/get`，打印状态码和 JSON 响应。（考察点：基本用法 → 目标 #1）

### 🟡 进阶题

2. 用 `AsyncClient` 并发请求 5 个不同的 `httpbin.org/delay/{n}` URL，打印总耗时。（考察点：异步请求 → 目标 #2）

3. 配置一个带超时（connect=5s, read=30s）和重试（最多3次）的 httpx Client。（考察点：高级配置 → 目标 #2）

### 🔴 开放题

4. 设计一个 LLM API 调用封装：支持异步并发、自动重试、流式响应、Token 限流。你会如何设计接口？（考察点：AI 应用集成 → 目标 #3）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
httpx
├── 同步 — 和 requests 一样
│   └── httpx.Client() 连接池
├── 异步 — 核心优势
│   └── httpx.AsyncClient() + await
├── 高级功能
│   ├── Timeout — connect/read/write/pool
│   ├── Stream — 流式响应
│   └── Retry — 配合 tenacity
└── AI 应用
    ├── 异步批量调用 LLM
    └── 流式 SSE 响应
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 调用 OpenAI API | AsyncClient + 流式 SSE + 重试 |
| 爬虫 | AsyncClient + Semaphore 限流 |
| 微服务通信 | AsyncClient + 超时 + 连接池 |

---

## 🗺️ 学习路径

```
[HTTP协议] → [RESTful API] → **📍 你在这里：httpx** → [JWT认证] → [FastAPI实战]
```

**下一篇建议**：
- → [《JWT认证：Token原理与实现》](14-jwt-认证.md)：API 安全认证

---

## ⚔️ 横向对比

| 维度 | httpx | requests | aiohttp |
|------|-------|----------|---------|
| 同步支持 | ✅ | ✅ | ❌ |
| 异步支持 | ✅ | ❌ | ✅ |
| API兼容requests | ✅ | — | ❌ |
| HTTP/2 | ✅ | ❌ | ❌ |
| 学习成本 | 低 | 最低 | 中 |
| 性能 | 高 | 中 | 高 |
| **推荐** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

**铁蛋建议**：新项目直接用 httpx，既兼容 requests 体验又支持异步，一步到位。

---

## ⚡ 性能对比

| 方案 | 5个请求(各1s延迟) | 10个请求(各1s延迟) |
|------|-------------------|--------------------|
| requests 同步 | ~5s | ~10s |
| httpx 异步 | ~1s | ~1s |
| httpx 异步+Semaphore(3) | ~2s | ~4s |

---

## 📚 参考资料

- [httpx 官方文档](https://www.python-httpx.org/) [等级：官方] — 完整 API 参考
- [httpx vs requests](https://www.python-httpx.org/compatibility/) [等级：官方] — 迁移指南

---

## 附录：练习题参考答案

**题1**：
```python
import httpx
resp = httpx.get("https://httpbin.org/get")
print(f"状态码: {resp.status_code}")
print(f"JSON: {resp.json()}")
```

**题2**：
```python
import httpx, asyncio, time

async def main():
    async with httpx.AsyncClient(timeout=10) as client:
        start = time.perf_counter()
        tasks = [client.get(f"https://httpbin.org/delay/{i}") for i in [1,2,3,1,2]]
        await asyncio.gather(*tasks)
        print(f"总耗时: {time.perf_counter()-start:.2f}s")

asyncio.run(main())
```

**题3**：
```python
import httpx
from tenacity import retry, stop_after_attempt

client = httpx.Client(timeout=httpx.Timeout(connect=5.0, read=30.0))

@retry(stop=stop_after_attempt(3))
def fetch(url):
    resp = client.get(url)
    resp.raise_for_status()
    return resp.json()
```
