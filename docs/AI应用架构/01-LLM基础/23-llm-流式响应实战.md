# 流式响应实战：逐字输出的技术实现

> 分类：LLM API | 流式处理 | 难度：⭐⭐⭐ | 预估用时：40 分钟

---

## 🎯 学习目标

1. ✅ 解释流式响应的数据格式和工作原理（理解）
2. ✅ 编写同步和异步的流式 API 调用代码（应用）
3. ✅ 构建 SSE 服务端推送，实现前后端联动的流式聊天（应用）
4. ✅ 处理流式响应中的中断和异常情况（分析）

---

## 📋 前置知识自检

1. **你知道 Python 生成器（yield）的用法吗？**（答不上来？→ 先学 Python 生成器基础）
2. **你了解 FastAPI 的基本路由写法吗？**（答不上来？→ 先学 FastAPI 入门）
3. **你理解 HTTP 长连接和 SSE 的概念吗？**（答不上来？→ 先补 HTTP 协议基础）

---

## 💡 概念讲解

- **一句话定义**：流式响应是 LLM API 逐块返回生成内容的技术，而非等待全部完成后一次性返回。
- **现实类比**：传统请求像等快递——打包好才发货。流式响应像看直播——内容边生成边推送，你实时看到。
- **技术场景**：聊天对话中逐字显示 AI 回复、长文本生成时实时预览、减少用户等待的体感时间。
- **⚠️ 常见误解**：流式响应不会让 LLM 生成得更快，只是让你更早看到结果。总生成时间不变，但首字延迟（Time To First Token）大幅降低。

---

## 🧠 实时脑图

```text
[客户端请求 stream=True] 🔴
    || (HTTP连接保持)
    ↓
[API Server] 🔴
    || (逐Token生成)
    ↓
[delta chunk] 🟡 ← 每个chunk包含一小段文本
    || (SSE格式传输)
    ↓
[服务端 → SSE推送] 🔴 ← data: {"choices":[{"delta":{"content":"你"}}]}
    ||
    ↓ (前端EventSource接收)
[逐字渲染到界面] 🟢
    ||
    ↓ (收到 [DONE])
[流结束] 🔴
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install openai fastapi uvicorn sse-starlette`

### 示例1：基础流式调用

```python
# stream_basic.py - Basic streaming with OpenAI SDK
# Python 3.10+
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

def stream_chat(prompt: str) -> None:
    """Basic streaming chat - print tokens as they arrive."""
    stream = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        stream=True,  # The key parameter!
    )

    full_response = ""
    for chunk in stream:
        # Each chunk has a delta with content
        delta = chunk.choices[0].delta
        if delta.content:
            print(delta.content, end="", flush=True)
            full_response += delta.content

        # Check for finish reason
        if chunk.choices[0].finish_reason == "stop":
            print("\n[Stream finished]")

    # Usage info is in the last chunk (some providers)
    print(f"\nTotal characters: {len(full_response)}")

if __name__ == "__main__":
    stream_chat("用三句话解释什么是量子计算")
```

### 示例2：异步流式调用

```python
# stream_async.py - Async streaming for high concurrency
# Python 3.10+
import asyncio
from openai import AsyncOpenAI

async_client = AsyncOpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

async def async_stream_chat(prompt: str) -> str:
    """Async streaming - yields tokens without blocking."""
    stream = await async_client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )

    full_response = ""
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            full_response += delta.content
            # In real app, yield to SSE/WebSocket here
            print(delta.content, end="", flush=True)

        if chunk.choices[0].finish_reason == "stop":
            pass  # Stream complete

    return full_response

async def multi_stream_demo():
    """Run multiple streams concurrently."""
    prompts = [
        "一句话解释Python",
        "一句话解释Rust",
        "一句话解释Go",
    ]
    tasks = [async_stream_chat(p) for p in prompts]
    results = await asyncio.gather(*tasks)
    for p, r in zip(prompts, results):
        print(f"\n--- Q: {p} ---\nA: {r}")

if __name__ == "__main__":
    asyncio.run(multi_stream_demo())
```

### 示例3：FastAPI + SSE 流式聊天服务

```python
# stream_server.py - FastAPI streaming chat server with SSE
# Python 3.10+
# pip install fastapi uvicorn sse-starlette openai

import json
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from openai import AsyncOpenAI

app = FastAPI()
async_client = AsyncOpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

class ChatRequest(BaseModel):
    message: str

async def generate_stream(message: str):
    """Generate SSE events from LLM stream."""
    try:
        stream = await async_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个有帮助的助手。"},
                {"role": "user", "content": message}
            ],
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                # SSE format: data field contains JSON
                yield {
                    "event": "message",
                    "data": json.dumps({"content": delta.content}, ensure_ascii=False)
                }

            if chunk.choices[0].finish_reason == "stop":
                yield {
                    "event": "message",
                    "data": json.dumps({"content": "", "done": True})
                }

    except Exception as e:
        yield {
            "event": "error",
            "data": json.dumps({"error": str(e)})
        }

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """SSE streaming endpoint."""
    return EventSourceResponse(generate_stream(req.message))

# Simple HTML chat frontend
HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Stream Chat</title>
    <style>
        body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }
        #messages { border: 1px solid #ddd; height: 300px; overflow-y: auto; padding: 10px; }
        .msg { margin: 8px 0; padding: 8px; border-radius: 8px; }
        .user { background: #e3f2fd; text-align: right; }
        .assistant { background: #f5f5f5; }
        #input { width: 80%; padding: 8px; }
        #send { padding: 8px 16px; }
    </style>
</head>
<body>
    <h2>Stream Chat Demo</h2>
    <div id="messages"></div>
    <input id="input" placeholder="Type your message..." />
    <button id="send" onclick="sendMessage()">Send</button>
    <button id="stop" onclick="stopStream()" style="display:none">Stop</button>

    <script>
        let eventSource = null;

        function sendMessage() {
            const input = document.getElementById('input');
            const msg = input.value.trim();
            if (!msg) return;
            input.value = '';

            const div = document.getElementById('messages');
            div.innerHTML += `<div class="msg user">${msg}</div>`;

            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'msg assistant';
            assistantDiv.textContent = '';
            div.appendChild(assistantDiv);
            div.scrollTop = div.scrollHeight;

            document.getElementById('send').disabled = true;
            document.getElementById('stop').style.display = 'inline';

            // Use fetch + ReadableStream for POST-based SSE
            eventSource = new EventSource(`/chat/stream?message=${encodeURIComponent(msg)}`);
            // Actually, let's use fetch for POST
            fetch('/chat/stream', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: msg})
            }).then(response => {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                function read() {
                    reader.read().then(({done, value}) => {
                        if (done) {
                            finishStream();
                            return;
                        }
                        buffer += decoder.decode(value, {stream: true});
                        // Parse SSE data lines
                        const lines = buffer.split('\\n');
                        buffer = lines.pop();
                        for (const line of lines) {
                            if (line.startsWith('data:')) {
                                try {
                                    const data = JSON.parse(line.slice(5).trim());
                                    if (data.done) { finishStream(); return; }
                                    if (data.content) {
                                        assistantDiv.textContent += data.content;
                                        div.scrollTop = div.scrollHeight;
                                    }
                                } catch(e) {}
                            }
                        }
                        read();
                    });
                }
                read();
            }).catch(err => {
                assistantDiv.textContent = 'Error: ' + err.message;
                finishStream();
            });
        }

        function stopStream() {
            // AbortController for fetch
            finishStream();
        }

        function finishStream() {
            document.getElementById('send').disabled = false;
            document.getElementById('stop').style.display = 'none';
        }

        document.getElementById('input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
"""

@app.get("/")
async def index():
    return HTMLResponse(HTML_PAGE)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 👀 执行预览

```bash
$ python stream_basic.py
量子计算是一种利用量子力学原理（如叠加态和量子纠缠）进行信息处理的新型计算方式...
[Stream finished]
Total characters: 156

$ python stream_server.py
# Server starts at http://localhost:8000
# Browser shows chat interface, responses stream token by token
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 流式响应的 `usage` 字段可能为空或不完整 | 无法实时获取 Token 统计 | 🟡 |
| ⚠️ SSE 连接可能被代理/CDN 超时断开 | 长回复被截断 | 🔴 |
| ⚠️ `stream=True` 时不能用 `max_tokens=0` 获取仅 Token 计数 | API 报错 | 🟢 |
| ⚠️ 并发流式连接数受限于服务端资源（文件描述符/内存） | 高并发时连接失败 | 🟡 |
| ⚠️ 前端必须处理连接断开和重连 | 用户体验中断 | 🟡 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 在流式回调中做耗时操作 | 后续 chunk 堆积，体验卡顿 | ✅ 只做轻量渲染，重活放异步队列 |
| ❌ 忘记处理 `finish_reason` | 不知道流何时结束，无法清理资源 | ✅ 检查 `chunk.choices[0].finish_reason == "stop"` |
| ❌ 把非流式代码直接改成流式但不改响应处理 | 报错 `str object has no attribute 'choices'` | ✅ 流式返回的是迭代器，逐 chunk 读取 |
| ❌ SSE 不设置正确的 Content-Type | 浏览器无法解析流 | ✅ 使用 `EventSourceResponse` 或手动设 `text/event-stream` |

---

## 🔍 调试排查

#### 故障场景1：流式响应只能看到完整结果，没有逐字效果

**症状**：虽然设了 `stream=True`，但内容还是一次性出现
**排查思路**：
1. 检查是否在循环中用了 `print()` 但没加 `flush=True`
2. 检查中间是否有代理/CDN 做了缓冲 → 查看 HTTP 头 `X-Accel-Buffering`
3. 检查前端是否用了 `fetch().then()` 而不是 `ReadableStream`

**根因**：Nginx/CDN 默认会缓冲 SSE 响应
**修复**：在 Nginx 配置中添加：
```nginx
proxy_buffering off;
proxy_cache off;
add_header X-Accel-Buffering no;
```

#### 故障场景2：异步流中途报错但程序不退出

**症状**：流在中间断开，没有异常抛出，程序卡住
**排查思路**：
1. 添加 try/except 包裹整个 async for 循环
2. 设置合理的超时 → `asyncio.wait_for(stream_coro, timeout=60)`
3. 检查 `finish_reason` 是否为 `"length"`（输出被截断）

**根因**：API 端异常关闭连接，客户端 async for 正常退出但没处理异常
**修复**：
```python
try:
    async for chunk in stream:
        ...
except httpx.RemoteProtocolError:
    print("Stream connection lost")
```

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. 流式响应和非流式响应的返回值类型有什么不同？（考察点：数据格式 → 目标 #1）
2. `delta` 对象和 `message` 对象有什么区别？（考察点：chunk 结构 → 目标 #1）

### 🟡 进阶题（动手实践）

1. 修改示例1的代码，添加一个计时器，统计首字延迟（TTFT）和总耗时。（考察点：性能测量 → 目标 #2）
2. 给示例3的前端添加"停止生成"按钮，点击后中断流式连接。（考察点：中断处理 → 目标 #4）

### 🔴 开放题（设计思考）

1. 在一个多用户在线聊天系统中，如何设计流式响应的连接管理？考虑：100 个用户同时对话，每人平均 30 秒的流式连接，服务端需要什么配置？（考察点：系统设计 → 目标 #3）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
流式响应
├── 核心概念
│   ├── stream=True 参数
│   ├── delta chunk（增量数据块）
│   └── finish_reason（流结束标志）
├── 实现方式
│   ├── 同步：for chunk in stream
│   ├── 异步：async for chunk in stream
│   └── SSE：EventSourceResponse
├── 前后端联动
│   ├── 后端：FastAPI + SSE
│   └── 前端：fetch + ReadableStream
└── 注意事项
    ├── 代理缓冲问题
    ├── 中断处理
    └── usage 统计不完整
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 代码生成助手 | 流式输出代码，配合前端语法高亮实时渲染 |
| 实时翻译 | 逐句翻译并流式推送，减少等待感 |
| AI 写作辅助 | 流式生成文章段落，用户随时中断修改方向 |

---

## 🗺️ 学习路径

```
[Token计算与成本] → **📍 你在这里：流式响应** → [结构化输出]
                              ├─→ [异步批量调用]
                              └─→ [LLM错误处理与重试]
```

**下一篇建议**：
- → [《结构化输出：让LLM返回标准JSON》](24-llm-结构化输出.md)：让 LLM 返回格式化数据，构建更可靠的 AI 应用
- → [《LLM异步批量调用》](27-llm-异步批量调用.md)：结合异步流式实现高并发场景

**相关主题**：
- [《LLM错误处理与重试》](28-llm-错误处理与重试.md)：流式连接中断时的重试策略

---

## ⚡ 性能考量

| 方案 | 首字延迟 | 内存占用 | 适用场景 |
|------|----------|----------|----------|
| 非流式 | 高（等全部生成） | 低（一次性返回） | 后台批处理 |
| 流式 | 低（首 Token 即返回） | 中（维持连接） | 实时对话 |
| 流式+异步 | 低 | 高（连接池） | 高并发生产环境 |

**优化建议**：流式响应的核心价值不是性能提升，而是用户体验提升。在后端批处理场景中，非流式反而更高效。

---

## 📚 参考资料

- [OpenAI Streaming Guide](https://platform.openai.com/docs/api-reference/streaming) [等级：官方] — 流式 API 规范
- [SSE 规范 (W3C)](https://html.spec.whatwg.org/multipage/server-sent-events.html) [等级：官方] — SSE 协议标准
- [sse-starlette](https://github.com/sysid/sse-starlette) [等级：优质] — FastAPI SSE 支持库

---

## 📝 练习题参考答案

**基础题1**：非流式返回单个 `ChatCompletion` 对象，包含完整的 `choices[0].message.content`。流式返回一个迭代器，每次迭代得到一个 `ChatCompletionChunk`，其中 `choices[0].delta.content` 只包含增量文本片段。

**基础题2**：非流式用 `message`（完整消息），流式用 `delta`（增量）。delta 每次只包含新生成的几个 Token，需要累加才是完整回复。
