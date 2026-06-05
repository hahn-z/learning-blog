# 大模型API初体验：调用你的第一次Chat Completion

> 分类：LLM API | 入门 | 难度：⭐ | 预估用时：20 分钟

---

## 🎯 学习目标

1. ✅ 能用自己的话解释什么是 LLM API 以及为什么需要它（理解）
2. ✅ 能独立完成从注册到调用 DeepSeek API 的全流程（应用）
3. ✅ 能理解 Chat Completion 返回的 JSON 结构中各字段的含义（理解）

---

## 📋 前置知识自检

1. **你会用 pip 安装 Python 包吗？**（答不上来？→ 先学 Python 包管理基础）
2. **你知道什么是 API 吗？**（答不上来？→ 先了解 REST API 概念）
3. **你了解 JSON 数据格式吗？**（答不上来？→ 先了解 JSON 基础）

---

## 💡 概念讲解

- **一句话定义**：LLM API 是大语言模型厂商提供的 HTTP 接口，你发送文本消息，模型返回生成的回复。
- **现实类比**：就像发短信给一个超级聪明的朋友——你发一段话（prompt），他回你一段话（completion），但这个朋友 24 小时在线、知识面极广、回复速度极快。
- **技术场景**：智能客服、代码助手、内容生成、对话机器人、文本分析。
- **⚠️ 常见误解**：很多人以为调用 LLM API 需要自己部署模型。实际上，你只需要一个 API Key 和几行代码，模型运行在云端。

---

## 🧠 实时脑图

```text
你的代码 🔴
    || HTTP POST
    ↓
LLM API 服务 🔴 ← api.deepseek.com / api.openai.com
    || 处理 prompt
    ↓
大语言模型 🔴 ← DeepSeek-V3 / GPT-4o / ...
    || 生成回复
    ↓
JSON 响应 🟡 ← choices[0].message.content
    ↓
你的应用 🟢 ← 展示/处理回复
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、openai 库

### 第一步：安装依赖

```bash
pip install openai
```

### 第二步：获取 API Key

**DeepSeek（国内推荐）：**
1. 访问 [https://platform.deepseek.com](https://platform.deepseek.com)
2. 注册账号 → 登录
3. 进入「API Keys」页面 → 点击「Create API Key」
4. 复制 `sk-...` 开头的密钥，保存好（只显示一次！）

**OpenAI：**
1. 访问 [https://platform.openai.com](https://platform.openai.com)
2. 注册 → API Keys → Create new secret key

### 第三步：第一次调用

```python
# first_chat.py
# Python 3.10+
# Call DeepSeek Chat Completion API using the openai library

from openai import OpenAI

# Initialize client with DeepSeek API
# DeepSeek is compatible with OpenAI SDK
client = OpenAI(
    api_key="sk-your-deepseek-api-key-here",  # Replace with your key
    base_url="https://api.deepseek.com",        # DeepSeek endpoint
)


def chat(message: str) -> str:
    """Send a message and get AI response"""
    response = client.chat.completions.create(
        model="deepseek-chat",  # DeepSeek's latest model
        messages=[
            {"role": "user", "content": message},
        ],
        temperature=0.7,
        max_tokens=1024,
    )
    return response.choices[0].message.content


# ── Run ────────────────────────────────────────────

if __name__ == "__main__":
    # Your first AI chat!
    reply = chat("用一句话介绍 Python 语言")
    print(f"🤖 AI: {reply}")

    # Multi-turn example
    print("\n--- 多轮对话示例 ---")
    messages = [
        {"role": "user", "content": "什么是 FastAPI？用一句话回答"},
    ]

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )

    assistant_reply = response.choices[0].message.content
    print(f"👤 用户: 什么是 FastAPI？用一句话回答")
    print(f"🤖 AI: {assistant_reply}")

    # Continue the conversation
    messages.append({"role": "assistant", "content": assistant_reply})
    messages.append({"role": "user", "content": "它和 Flask 比有什么优势？"})

    response2 = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )
    print(f"👤 用户: 它和 Flask 比有什么优势？")
    print(f"🤖 AI: {response2.choices[0].message.content}")

    # ── Inspect the response structure ─────────────
    print("\n--- 响应结构分析 ---")
    print(f"模型: {response.model}")
    print(f"回复内容: {response.choices[0].message.content}")
    print(f"结束原因: {response.choices[0].finish_reason}")
    print(f"Prompt tokens: {response.usage.prompt_tokens}")
    print(f"Completion tokens: {response.usage.completion_tokens}")
    print(f"Total tokens: {response.usage.total_tokens}")
```

---

## 👀 执行预览

```bash
$ python first_chat.py
🤖 AI: Python是一种简洁、易学且功能强大的通用编程语言，广泛用于Web开发、数据分析和人工智能等领域。

--- 多轮对话示例 ---
👤 用户: 什么是 FastAPI？用一句话回答
🤖 AI: FastAPI是一个基于Python的高性能异步Web框架，能自动生成交互式API文档。

👤 用户: 它和 Flask 比有什么优势？
🤖 AI: FastAPI原生支持异步、内置API文档自动生成、基于类型注解的自动数据校验，性能也远超Flask。

--- 响应结构分析 ---
模型: deepseek-chat
回复内容: FastAPI是一个...
结束原因: stop
Prompt tokens: 12
Completion tokens: 45
Total tokens: 57
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ API Key 绝不能硬编码提交到 Git | Key 泄露被滥用，产生费用 | 🔴 |
| ⚠️ API Key 以 `sk-` 开头，复制后只显示一次 | 丢失需要重新创建 | 🟡 |
| ⚠️ `base_url` 不要漏，默认是 OpenAI 的地址 | 国内无法直接访问 OpenAI | 🟡 |
| ⚠️ DeepSeek 的模型名是 `deepseek-chat` 不是 `gpt-4` | 模型不存在的错误 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 忘记设 `base_url` | 连接超时或 404（默认指向 OpenAI） | ✅ 设 `base_url="https://api.deepseek.com"` |
| ❌ API Key 写错或多空格 | 401 Authentication Error | ✅ 仔细检查 Key，不含空格换行 |
| ❌ 用 `openai.Completion`（旧版） | 报错或不存在 | ✅ 用 `client.chat.completions.create()` |
| ❌ API Key 直接写在代码里并提交 Git | Key 泄露 | ✅ 用环境变量 `OPENAI_API_KEY` 或 `.env` |

---

## 🔍 调试排查

#### 故障场景1：401 Authentication Error

**症状**：`openai.AuthenticationError: Invalid API key`
**排查思路**：
1. 检查 API Key 是否正确（无多余空格/换行）
2. 确认 Key 对应的服务商（DeepSeek Key 不能用于 OpenAI）
3. 检查 `base_url` 是否匹配

**根因**：Key 不匹配或已过期
**修复**：重新生成 API Key，确认 `base_url` 正确

#### 故障场景2：Connection Error / Timeout

**症状**：`openai.APIConnectionError: Connection error`
**排查思路**：
1. 检查网络是否能访问 `api.deepseek.com`
2. 如果在国内调用 OpenAI，需要代理
3. 检查防火墙是否拦截

**根因**：网络不通
**修复**：换用 DeepSeek（国内直连）或配置网络代理

---

## 📝 练习题

### 🟢 基础题

1. 什么是 LLM API？它和本地部署模型有什么区别？（→ 目标 #1）
2. `response.choices[0].message.content` 中的 `choices[0]` 是什么意思？（→ 目标 #3）

### 🟡 进阶题

1. 把 API Key 改为从环境变量读取，不要硬编码。（提示：`os.getenv` 或 `python-dotenv`）（→ 目标 #2）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
LLM API 初体验
├── 准备工作
│   ├── 注册 DeepSeek/OpenAI 账号
│   ├── 获取 API Key (sk-...)
│   └── pip install openai
├── 调用流程
│   ├── 创建 OpenAI client（设 base_url）
│   ├── client.chat.completions.create()
│   │   ├── model: "deepseek-chat"
│   │   └── messages: [{role, content}]
│   └── 获取回复: response.choices[0].message.content
├── 响应结构
│   ├── model: 使用的模型名
│   ├── choices[0]: 第一条回复
│   │   ├── message.content: 回复文本
│   │   └── finish_reason: stop/length
│   └── usage: token 用量统计
└── 安全
    └── API Key 用环境变量，不硬编码
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 用其他模型（如 GLM） | 改 `base_url` 和 `model` 参数，OpenAI SDK 兼容多家 |
| 批量生成内容 | 循环调用，注意控制请求频率 |
| 加到 Web 应用 | FastAPI 接口封装 LLM 调用 |

---

## 🗺️ 学习路径

```
[Python基础] → **📍 本篇：LLM API初体验** → [Messages设计]
```

**下一篇建议**：
- → [《Messages设计：system/user/assistant的角色分工》](20-messages-设计.md)：学会设计高质量的对话消息，让 LLM 输出更精准
- → [《LLM关键参数详解》](21-llm-参数详解.md)：掌握 temperature 等参数的调优技巧

**相关主题**：
- [《SSE流式响应》](18-sse-流式响应.md)：让 LLM 回复实时呈现，不用等全部生成完

---

## 📦 版本兼容性

- ✅ Python 3.10+、openai 库 1.0+
- ⚠️ openai < 1.0（旧版）：使用 `openai.ChatCompletion.create()`，已弃用
- ⚠️ DeepSeek 兼容 OpenAI SDK，只需改 `base_url`

## ⚔️ 横向对比

| 维度 | DeepSeek | OpenAI (GPT-4o) | GLM |
|------|----------|-----------------|-----|
| 国内直连 | ✅ | ❌ 需代理 | ✅ |
| 价格 | 💰 极低 | 💰💰💰 较高 | 💰💰 适中 |
| 中文能力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 代码能力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| SDK 兼容 | OpenAI SDK | 原生 | OpenAI SDK |
| **入门推荐** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**铁蛋建议**：国内开发者入门首选 DeepSeek——便宜、中文好、OpenAI SDK 直接兼容、无需代理。

## 📚 参考资料

- [DeepSeek API 文档](https://platform.deepseek.com/api-docs) [等级：官方] — API 调用参考
- [OpenAI Chat Completions 文档](https://platform.openai.com/docs/api-reference/chat) [等级：官方] — 标准接口规范

---

## 附录：练习题参考答案

### 基础题 1
LLM API 是通过 HTTP 接口调用云端大语言模型的方式。区别：API 无需自己部署模型、不需要 GPU、按用量付费、调用简单；本地部署需要硬件资源、部署运维复杂，但数据不出本机、无调用限制。

### 基础题 2
`choices` 是一个数组，包含模型生成的所有候选回复。默认只生成一条（`n=1`），所以取 `[0]`。如果设置 `n=3`，会有三条不同的回复。

### 进阶题 1
```python
import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)
```
