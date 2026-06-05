# SSE流式响应：让AI对话实时呈现

> 分类：Web进阶 | 流式响应 | 难度：⭐⭐⭐ | 预估用时：40 分钟

---

## 🎯 学习目标

1. ✅ 能解释 SSE 与 WebSocket 的区别及各自适用场景（理解）
2. ✅ 能独立实现 FastAPI 的 SSE 流式接口 + 前端 EventSource 接收（应用）
3. ✅ 能排查 SSE 连接断开、数据不实时等问题（分析）
4. ✅ 能根据场景选择合适的实时通信方案（评价）

---

## 📋 前置知识自检

1. **你了解 HTTP 请求/响应的基本流程吗？**（答不上来？→ 先学 HTTP 基础）
2. **你会用 FastAPI 写基本路由吗？**（答不上来？→ [《FastAPI入门》](15-fastapi-入门实战.md)）
3. **你知道什么是 EventSource 或 fetch 流式读取吗？**（答不上来？没关系，本文会讲）

---

## 💡 概念讲解

### SSE（Server-Sent Events）
- **一句话定义**：SSE 是基于 HTTP 的单向实时推送协议，服务器可以持续向客户端发送文本事件流。
- **现实类比**：像听广播——你打开收音机（建立连接），电台持续播报（服务端推送），你只需收听（单向），不需要双向通话。
- **技术场景**：LLM 流式输出、实时日志推送、股票行情、通知推送。
- **⚠️ 常见误解**：很多人把 SSE 和 WebSocket 混为一谈。SSE 是单向的（服务端→客户端）、基于 HTTP、自动重连；WebSocket 是双向的、独立协议、需手动重连。

---

## 🧠 实时脑图

```text
实时通信方案对比 🔴
    ├── SSE 🔴 ← 本文重点
    │   ├── 单向（Server → Client）
    │   ├── 基于 HTTP
    │   └── 自动重连
    ├── WebSocket 🟡
    │   ├── 双向
    │   ├── 独立协议 ws://
    │   └── 需手动重连
    └── Long Polling 🟢
        ├── 兼容性最好
        └── 延迟最高

── SSE 数据流 ──
FastAPI StreamingResponse 🔴
    || text/event-stream
    ↓
"data: {json}\n\n" 🟡 ← SSE 协议格式
    || EventSource / fetch
    ↓
前端实时渲染 🔴 ← 逐字/逐块显示
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、FastAPI 0.100+

```python
# sse_demo.py
# Python 3.10+
import asyncio
import json
import time
from typing import AsyncGenerator

from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="SSE Demo")


# ── 1. 基本 SSE 端点 ──────────────────────────────

async def event_generator(count: int, interval: float) -> AsyncGenerator[str, None]:
    """
    Generate SSE events.
    SSE format: "data: <content>\n\n"
    """
    for i in range(count):
        data = json.dumps({
            "id": i,
            "message": f"Event #{i + 1}",
            "timestamp": time.time(),
        })
        # SSE protocol: each event ends with \n\n
        yield f"data: {data}\n\n"
        await asyncio.sleep(interval)
    # Send a final close event
    yield f"data: {json.dumps({'message': 'stream ended'})}\n\n"


@app.get("/sse/events")
async def sse_events(
    count: int = Query(10, ge=1, le=100),
    interval: float = Query(1.0, ge=0.1, le=10),
) -> StreamingResponse:
    """Basic SSE endpoint - pushes N events at given interval"""
    return StreamingResponse(
        event_generator(count, interval),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )


# ── 2. LLM 流式对话模拟 ───────────────────────────

async def llm_stream_generator(prompt: str) -> AsyncGenerator[str, None]:
    """
    Simulate LLM streaming response.
    In production, replace this with actual API call.
    """
    # Simulate token-by-token output
    response = (
        f"收到你的问题：「{prompt}」\n\n"
        "这是一个模拟的流式 LLM 响应。在实际项目中，"
        "你会调用 OpenAI 或 DeepSeek 的流式 API，"
        "逐个 token 转发给前端。\n\n"
        "SSE 的优势在于：实时、简单、自动重连。"
    )
    
    # Split into "tokens" (characters for simulation)
    for i, char in enumerate(response):
        chunk = {
            "id": f"chatcmpl-{i}",
            "object": "chat.completion.chunk",
            "choices": [{
                "index": 0,
                "delta": {"content": char},
                "finish_reason": None,
            }],
        }
        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.02)  # Simulate LLM latency
    
    # Final chunk
    final = {
        "id": "chatcmpl-done",
        "choices": [{"delta": {}, "finish_reason": "stop"}],
    }
    yield f"data: {json.dumps(final)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/sse/chat")
async def sse_chat(prompt: str = Query(..., description="Your prompt")) -> StreamingResponse:
    """Simulated LLM streaming chat via SSE"""
    return StreamingResponse(
        llm_stream_generator(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── 3. 带事件类型和 ID 的 SSE ────────────────────

async def typed_event_generator() -> AsyncGenerator[str, None]:
    """SSE with event type and ID for better client handling"""
    events = [
        {"event": "status", "data": "processing", "id": "1"},
        {"event": "status", "data": "generating", "id": "2"},
        {"event": "content", "data": "Hello, world!", "id": "3"},
        {"event": "status", "data": "done", "id": "4"},
    ]
    for evt in events:
        yield f"id: {evt['id']}\nevent: {evt['event']}\ndata: {evt['data']}\n\n"
        await asyncio.sleep(0.5)


@app.get("/sse/typed")
async def sse_typed() -> StreamingResponse:
    """SSE with custom event types and IDs"""
    return StreamingResponse(
        typed_event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
```

前端接收（HTML + JavaScript）：

```html
<!-- sse_client.html -->
<!DOCTYPE html>
<html>
<head><title>SSE Demo</title></head>
<body>
  <h2>LLM 流式对话</h2>
  <input id="prompt" value="什么是FastAPI？" style="width:300px">
  <button onclick="startChat()">发送</button>
  <div id="output" style="white-space:pre-wrap; margin-top:10px; padding:10px; border:1px solid #ccc;"></div>

  <script>
    function startChat() {
      const prompt = document.getElementById('prompt').value;
      const output = document.getElementById('output');
      output.textContent = '';

      // Method 1: EventSource (GET only, auto-reconnect)
      const url = `/sse/chat?prompt=${encodeURIComponent(prompt)}`;
      const es = new EventSource(url);

      es.onmessage = function(event) {
        if (event.data === '[DONE]') {
          es.close();
          return;
        }
        try {
          const chunk = JSON.parse(event.data);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            output.textContent += content;
          }
        } catch (e) {}
      };

      es.onerror = function() {
        output.textContent += '\n[连接断开]';
        es.close();
      };
    }

    // Method 2: fetch with ReadableStream (POST support, no auto-reconnect)
    async function startChatFetch() {
      const prompt = document.getElementById('prompt').value;
      const output = document.getElementById('output');
      output.textContent = '';

      const resp = await fetch('/sse/chat?prompt=' + encodeURIComponent(prompt));
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        // Parse SSE data lines
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6));
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) output.textContent += content;
            } catch (e) {}
          }
        }
      }
    }
  </script>
</body>
</html>
```

---

## 👀 执行预览

```bash
# 基本事件流
$ curl -N http://localhost:8000/sse/events?count=3&interval=0.5
data: {"id": 0, "message": "Event #1", "timestamp": 1700000000.0}

data: {"id": 1, "message": "Event #2", "timestamp": 1700000000.5}

data: {"id": 2, "message": "Event #3", "timestamp": 1700000001.0}

data: {"message": "stream ended"}

# LLM 流式对话
$ curl -N "http://localhost:8000/sse/chat?prompt=你好"
data: {"id":"chatcmpl-0","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"收"},"finish_reason":null}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"到"},"finish_reason":null}]}

...（逐字输出）

data: [DONE]

# 带类型的事件
$ curl -N http://localhost:8000/sse/typed
id: 1
event: status
data: processing

id: 2
event: status
data: generating

id: 3
event: content
data: Hello, world!
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 每条 SSE 消息必须以 `\n\n` 结尾 | 客户端无法正确解析 | 🔴 |
| ⚠️ `Content-Type` 必须是 `text/event-stream` | 浏览器 EventSource 不触发 | 🔴 |
| ⚠️ 必须设置 `Cache-Control: no-cache` | 代理缓存导致数据不实时 | 🟡 |
| ⚠️ `EventSource` 只支持 GET 请求 | POST 请求需用 fetch + ReadableStream | 🟡 |
| ⚠️ SSE 连接数浏览器有限制（同域 6 个） | 超出后连接挂起 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ yield 普通字符串不加 `\n\n` | 数据堆积不分段 | ✅ `yield f"data: {json}\n\n"` |
| ❌ 用 `json.dumps` 后忘加 `data: ` 前缀 | EventSource 解析失败 | ✅ 严格按 SSE 格式 |
| ❌ Nginx 反代没关 `proxy_buffering` | 流卡住不实时 | ✅ 加 `X-Accel-Buffering: no` 或 Nginx 配置 `proxy_buffering off` |
| ❌ 前端忘记处理 `[DONE]` | 连接不会自动关闭 | ✅ 收到 `[DONE]` 后调用 `es.close()` |

---

## 🔍 调试排查

#### 故障场景1：SSE 数据不实时，延迟很高

**症状**：数据是过了一会儿批量到达的
**排查思路**：
1. 用 curl 直接请求后端 → 确认后端是否实时发出
2. 检查是否有 Nginx/CDN 等中间层缓冲
3. 检查响应头是否有 `X-Accel-Buffering: no`
4. 检查 Nginx 配置是否有 `proxy_buffering on`

**根因**：中间层缓冲
**修复**：Nginx 加 `proxy_buffering off;` 或在响应头加 `X-Accel-Buffering: no`

#### 故障场景2：EventSource 频繁重连

**症状**：浏览器 Network 中看到大量短连接
**排查思路**：
1. 检查服务端是否主动关闭了连接
2. 检查生成器是否正常结束（没有异常退出）
3. 检查超时配置（Nginx proxy_read_timeout 等）

**根因**：服务端异常断开或中间层超时
**修复**：确保生成器正常结束、增大超时时间、发送心跳保活

---

## 📝 练习题

### 🟢 基础题

1. SSE 和 WebSocket 最大的区别是什么？各适合什么场景？（→ 目标 #1）
2. SSE 的 `data:` 行末尾需要什么来分隔不同事件？（→ 目标 #2）

### 🟡 进阶题

1. 给 LLM 流式对话加上"心跳"：每 10 秒发一个 `: keepalive\n\n`（SSE 注释行），防止连接超时断开。（→ 目标 #2）
2. 用 fetch + ReadableStream 实现一个 POST 版本的流式聊天接口。（→ 目标 #2）

### 🔴 开放题

1. 如果要在 SSE 流中传输二进制数据（如图片），你怎么处理？SSE 适合吗？（→ 目标 #4）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
SSE 流式响应
├── 协议格式
│   ├── data: <content>\n\n
│   ├── event: <type>\n
│   ├── id: <id>\n
│   └── : <comment>（心跳）
├── 服务端（FastAPI）
│   ├── StreamingResponse(generator, media_type="text/event-stream")
│   ├── async generator yield 数据
│   └── Headers: Cache-Control, X-Accel-Buffering
├── 客户端
│   ├── EventSource (GET, 自动重连)
│   └── fetch + ReadableStream (POST, 手动处理)
├── vs WebSocket
│   ├── SSE: 单向, HTTP, 简单, 自动重连
│   └── WS: 双向, 独立协议, 复杂, 需手动重连
└── 避坑
    ├── \n\n 结尾
    ├── 关代理缓冲
    └── 心跳保活
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 实时日志查看 | SSE 推送日志行，前端渲染 tail -f 效果 |
| 股票行情推送 | SSE + event type 区分不同股票 |
| 进度通知 | SSE 推送任务进度百分比 |

---

## 🗺️ 学习路径

```
[FastAPI入门] → [LLM API代理] → **📍 本篇：SSE流式响应** → [LLM API初体验]
```

**下一篇建议**：
- → [《大模型API初体验》](19-llm-api-初体验.md)：了解 LLM API 本身，理解为什么需要 SSE 来接收流式输出

**相关主题**：
- [《FastAPI实战：构建LLM API代理服务》](17-fastapi-llm代理服务.md)：SSE 在 LLM 代理中的完整应用

---

## ⚔️ 横向对比

| 维度 | SSE | WebSocket | Long Polling |
|------|-----|-----------|--------------|
| 方向 | 单向（S→C） | 双向 | 单向（S→C） |
| 协议 | HTTP | ws:// | HTTP |
| 自动重连 | ✅ | ❌ 需手动 | ✅ |
| 浏览器支持 | ✅ | ✅ | ✅ |
| 延迟 | 低 | 极低 | 高 |
| 复杂度 | 低 | 中 | 低 |
| 适合 LLM | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**铁蛋建议**：LLM 流式输出场景，SSE 是最佳选择。简单、HTTP 原生、自动重连，而且 LLM 输出本身就是单向的。

## 📦 版本兼容性

- ✅ 所有现代浏览器（IE 除外）
- ⚠️ IE 不支持 EventSource，需要 polyfill（如 `eventsource` npm 包）
- ⚠️ EventSource 不支持自定义 Headers（无法直接带 Authorization），需用 fetch 方案或 URL 参数传 token

## 📚 参考资料

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) [等级：权威]
- [FastAPI StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse) [等级：官方]
- [HTML SSE 规范](https://html.spec.whatwg.org/multipage/server-sent-events.html) [等级：标准]

---

## 附录：练习题参考答案

### 基础题 1
SSE 是单向的（服务端→客户端），基于 HTTP，自动重连，适合 LLM 流式输出、通知推送等单向场景；WebSocket 是双向的，独立协议，需手动重连，适合聊天、协作编辑等双向交互场景。

### 基础题 2
两个换行符 `\n\n`。

### 进阶题 1
```python
async def llm_stream_generator(prompt: str) -> AsyncGenerator[str, None]:
    # ... 原有逻辑 ...
    # Add keepalive every 10 seconds
    last_keepalive = time.time()
    
    for i, char in enumerate(response):
        if time.time() - last_keepalive > 10:
            yield ": keepalive\n\n"  # SSE comment, ignored by EventSource
            last_keepalive = time.time()
        # ... yield data ...
```

### 进阶题 2
将 `/sse/chat` 改为 POST 接口，前端使用 fetch：
```javascript
const resp = await fetch('/sse/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({prompt: '你好'})
});
const reader = resp.body.getReader();
// ... 同前面的 ReadableStream 处理逻辑
```

### 开放题 1 思路
SSE 只支持文本（UTF-8），不适合直接传二进制。可选方案：1) Base64 编码后通过 SSE 传输（体积膨胀 33%）；2) 用单独的 HTTP 请求下载二进制数据，SSE 只传通知/URL。如果是大量二进制数据，应考虑 WebSocket 或独立下载。
