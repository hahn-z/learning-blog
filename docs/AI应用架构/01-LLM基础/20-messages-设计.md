# Messages设计：system/user/assistant的角色分工

> 分类：LLM API | 消息设计 | 难度：⭐⭐ | 预估用时：25 分钟

---

## 🎯 学习目标

1. ✅ 能解释 system/user/assistant 三种角色的职责和区别（理解）
2. ✅ 能独立设计 system prompt 和多轮对话的 messages 结构（应用）
3. ✅ 能分析上下文窗口溢出的原因并实施管理策略（分析）
4. ✅ 能根据不同场景选择合适的消息设计模式（评价）

---

## 📋 前置知识自检

1. **你能用 openai 库调用一次 Chat Completion 吗？**（答不上来？→ [《大模型API初体验》](19-llm-api-初体验.md)）
2. **你知道 messages 数组的基本结构吗？**（答不上来？→ 同上）

---

## 💡 概念讲解

- **一句话定义**：messages 是发送给 LLM 的对话历史数组，每条消息有 role（角色）和 content（内容），三种角色各司其职。
- **现实类比**：像公司里的三种人——**system** 是老板定规矩（"你是客服，态度要好"），**user** 是客户提问，**assistant** 是你的回答。老板的规矩贯穿全程，客户和你一来一回地对话。
- **技术场景**：角色扮演、任务指令、多轮对话、Few-shot 示例、RAG 上下文注入。
- **⚠️ 常见误解**：很多人把所有指令都塞进 user 消息里。实际上 system 消息的优先级更高，模型会更严格地遵循 system 中的指令，且不会被用户的输入轻易覆盖。

### 三种角色详解

| 角色 | 职责 | 优先级 | 示例 |
|------|------|--------|------|
| `system` | 定义角色、行为规则、输出格式 | 最高 | "你是一个Python专家，只用中文回答" |
| `user` | 用户输入/提问/指令 | 中 | "解释一下什么是装饰器" |
| `assistant` | 模型的回复（历史记录） | 中 | "装饰器是一种设计模式..." |

---

## 🧠 实时脑图

```text
Messages 设计 🔴
    ├── system 消息 🔴 ← 最高优先级
    │   ├── 角色定义："你是XX专家"
    │   ├── 行为约束："只回答XX领域"
    │   ├── 输出格式："用JSON输出"
    │   └── 安全边界："不要透露XX"
    ├── user 消息 🔴 ← 用户输入
    │   ├── 直接提问
    │   ├── Few-shot 示例（伪装成user/assistant对）
    │   └── RAG 上下文注入
    ├── assistant 消息 🟡 ← 模型历史回复
    │   ├── 保持多轮对话连贯性
    │   └── 搭配 Few-shot 使用
    └── 上下文管理 🟡
        ├── Token 限制（4K/8K/128K）
        ├── 截断策略
        └── 摘要压缩
```

---

## 💻 完整代码

> 运行环境：Python 3.10+、openai 库

```python
# messages_design.py
# Python 3.10+
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)


# ── 1. System Prompt 设计原则 ─────────────────────

def demo_system_prompt() -> str:
    """Demonstrate system prompt design patterns"""
    
    # ❌ Bad: vague system prompt
    messages_bad = [
        {"role": "user", "content": "帮我写代码"},
    ]
    
    # ✅ Good: specific system prompt with role + constraint + format
    messages_good = [
        {
            "role": "system",
            "content": (
                "你是一个 Python 高级工程师。\n"
                "规则：\n"
                "1. 只回答 Python 相关问题，其他问题回复'我只擅长Python'\n"
                "2. 代码必须包含类型注解和 docstring\n"
                "3. 先给方案，再给代码，最后给解释\n"
                "4. 使用中文回答"
            ),
        },
        {"role": "user", "content": "帮我写一个读取 CSV 的函数"},
    ]
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages_good,
        temperature=0.3,
    )
    return response.choices[0].message.content


# ── 2. 多轮对话的 Messages 构建 ──────────────────

def multi_turn_conversation() -> None:
    """Build multi-turn conversation history"""
    
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": "你是一个友好的旅行顾问，用中文回答，每次回复不超过100字。",
        },
    ]
    
    # Turn 1
    messages.append({"role": "user", "content": "推荐一个适合冬天去的国内景点"})
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )
    assistant_reply = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_reply})
    print(f"🤖: {assistant_reply}\n")
    
    # Turn 2 - model knows the context from Turn 1
    messages.append({"role": "user", "content": "那里有什么好吃的？"})
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )
    assistant_reply = response.choices[0].message.content
    messages.append({"role": "assistant", "content": assistant_reply})
    print(f"🤖: {assistant_reply}\n")
    
    # Turn 3
    messages.append({"role": "user", "content": "预算大概多少？"})
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
    )
    print(f"🤖: {response.choices[0].message.content}\n")
    
    # Show token usage
    print(f"Token usage: {response.usage.total_tokens}")


# ── 3. Few-shot 示例 ──────────────────────────────

def few_shot_classification() -> str:
    """Use Few-shot to teach model a specific output format"""
    
    messages = [
        {
            "role": "system",
            "content": "你是一个情感分析器。根据用户输入，输出JSON格式的分析结果。",
        },
        # Few-shot example 1
        {"role": "user", "content": "今天天气真好，心情特别棒！"},
        {"role": "assistant", "content": '{"sentiment": "positive", "confidence": 0.95, "keywords": ["天气好", "心情棒"]}'},
        # Few-shot example 2
        {"role": "user", "content": "这个产品太差了，浪费钱"},
        {"role": "assistant", "content": '{"sentiment": "negative", "confidence": 0.92, "keywords": ["差", "浪费钱"]}'},
        # Actual input
        {"role": "user", "content": "还行吧，不功不过"},
    ]
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=0.1,
    )
    return response.choices[0].message.content


# ── 4. 上下文窗口管理 ────────────────────────────

def manage_context_window(messages: list[dict], max_messages: int = 20) -> list[dict]:
    """
    Keep conversation within context window.
    Strategy: always keep system prompt + last N messages.
    """
    if len(messages) <= max_messages:
        return messages
    
    # Always keep system prompt (first message)
    system_msg = messages[0] if messages[0]["role"] == "system" else None
    
    # Keep last N-1 messages (reserve 1 slot for system)
    recent = messages[-(max_messages - 1):]
    
    if system_msg:
        return [system_msg] + recent
    return recent


# ── Run demos ─────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("1. System Prompt 设计")
    print("=" * 50)
    print(demo_system_prompt())
    
    print("\n" + "=" * 50)
    print("2. 多轮对话")
    print("=" * 50)
    multi_turn_conversation()
    
    print("\n" + "=" * 50)
    print("3. Few-shot 分类")
    print("=" * 50)
    print(few_shot_classification())
```

---

## 👀 执行预览

```bash
$ python messages_design.py
==================================================
1. System Prompt 设计
==================================================
**方案：** 使用 pandas 库的 `read_csv()` 函数...

```python
def read_csv_file(file_path: str) -> pd.DataFrame:
    """Read a CSV file into a pandas DataFrame."""
    ...
```

==================================================
2. 多轮对话
==================================================
🤖: 推荐哈尔滨！冬天的冰雪大世界超震撼，还有中央大街的俄式建筑...

🤖: 哈尔滨必吃锅包肉、马迭尔冰棍、红肠...

🤖: 哈尔滨冬季3天游预算约2000-3000元...

Token usage: 487

==================================================
3. Few-shot 分类
==================================================
{"sentiment": "neutral", "confidence": 0.78, "keywords": ["还行", "不功不过"]}
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ system 消息通常放在 messages 第一条 | 位置靠后可能被忽略或效果减弱 | 🟡 |
| ⚠️ 多轮对话必须把 assistant 回复追加到 messages | 模型丢失上下文，答非所问 | 🔴 |
| ⚠️ messages 总量不能超过模型的上下文窗口 | 报错或截断 | 🔴 |
| ⚠️ Few-shot 示例的格式要和期望输出完全一致 | 模型输出格式不一致 | 🟡 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 把所有指令写在第一条 user 消息里 | 用户输入可能覆盖指令 | ✅ 用 system 消息定义行为规则 |
| ❌ 多轮对话只发 user 消息，不发 assistant 历史 | 模型不知道之前聊了什么 | ✅ 每次追加 assistant 回复到 messages |
| ❌ system prompt 写太长（>1000字） | 浪费 token，效果不增反降 | ✅ 精简到核心规则，3-5 条 |
| ❌ Few-shot 示例数量太多 | 浪费 token，可能干扰 | ✅ 2-3 个高质量示例足够 |

---

## 🔍 调试排查

#### 故障场景1：模型忽略 system 指令

**症状**：模型行为不符合 system prompt 的约束
**排查思路**：
1. 检查 system 消息是否在第一条
2. 检查 system 内容是否过于复杂/矛盾
3. 检查 user 输入是否有"忽略之前指令"的 prompt injection
4. 尝试降低 temperature

**根因**：system 指令不明确或被用户输入覆盖
**修复**：精简 system prompt、加强约束措辞、使用"必须"/"绝对不能"等强约束词

#### 故障场景2：多轮对话上下文丢失

**症状**：模型不记得之前说过的话
**排查思路**：
1. 打印 messages 数组，确认是否包含历史 assistant 回复
2. 检查是否触发了上下文截断（messages 太多）
3. 检查 token 数是否接近模型上限

**根因**：messages 数组未正确维护，或超出上下文窗口被截断
**修复**：正确追加历史消息，实施上下文管理策略

---

## 📝 练习题

### 🟢 基础题

1. system、user、assistant 三种角色各自的职责是什么？（→ 目标 #1）
2. 为什么多轮对话中要保留 assistant 的历史回复？（→ 目标 #1）

### 🟡 进阶题

1. 设计一个 system prompt，让模型扮演"只回答 JavaScript 问题、代码必须用 ES6+语法、用英文注释"的前端专家。（→ 目标 #2）
2. 用 Few-shot 设计一个"文本摘要"的消息结构：给 2 个示例，让模型输出固定格式的摘要。（→ 目标 #2）

### 🔴 开放题

1. 如果对话历史有 100 轮，远远超过模型上下文窗口，你会设计怎样的策略来管理上下文？（→ 目标 #3）

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
Messages 设计
├── 三种角色
│   ├── system: 角色定义 + 行为规则 + 输出格式（优先级最高）
│   ├── user: 用户输入/提问
│   └── assistant: 模型历史回复（维持上下文）
├── System Prompt 设计原则
│   ├── 明确角色定位
│   ├── 列出 3-5 条具体规则
│   ├── 指定输出格式
│   └── 精简（避免冗长）
├── 多轮对话
│   ├── 每次请求发完整 messages 数组
│   └── 追加 assistant 回复到历史
├── Few-shot
│   ├── 用 user/assistant 对作为示例
│   └── 2-3 个示例即可
└── 上下文管理
    ├── 截断策略：保留 system + 最近 N 条
    ├── 摘要压缩：用 LLM 总结历史
    └── Token 计数监控
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| RAG 检索增强 | 检索到的文档放入 user 消息作为上下文 |
| 角色扮演游戏 | system 定义角色设定，多轮对话推进剧情 |
| 代码审查工具 | system 定义审查规则，user 放代码，assistant 返回审查意见 |

---

## 🗺️ 学习路径

```
[LLM API初体验] → **📍 本篇：Messages设计** → [LLM参数详解]
```

**下一篇建议**：
- → [《LLM关键参数详解》](21-llm-参数详解.md)：学会调 temperature、top_p 等参数，让输出更可控

**相关主题**：
- [《SSE流式响应》](18-sse-流式响应.md)：流式对话的前后端配合

---

## 📚 参考资料

- [OpenAI Chat Completions Guide](https://platform.openai.com/docs/guides/chat-completions) [等级：官方] — Messages 设计的最佳实践
- [Prompt Engineering Guide](https://www.promptingguide.ai/) [等级：权威] — System prompt 设计原则

---

## 附录：练习题参考答案

### 基础题 1
- system：定义模型的角色和行为规则，优先级最高
- user：用户的输入和指令
- assistant：模型的历史回复，用于维持多轮对话的上下文连贯性

### 基础题 2
因为 LLM 是无状态的——每次调用都是全新的请求。只有把历史 assistant 回复包含在 messages 中，模型才能"看到"之前的对话内容。

### 进阶题 1
```python
system_prompt = (
    "你是一个前端开发专家。\n"
    "规则：\n"
    "1. 只回答 JavaScript/TypeScript 相关问题\n"
    "2. 代码必须使用 ES6+ 语法（箭头函数、解构、async/await等）\n"
    "3. 代码注释使用英文\n"
    "4. 如果不相关，回复'我只擅长前端开发'\n"
    "5. 使用中文解释，英文代码注释"
)
```

### 进阶题 2
```python
messages = [
    {"role": "system", "content": "你是一个文本摘要工具，输出JSON格式：{\"summary\": \"...\", \"keywords\": [...]}"},
    {"role": "user", "content": "Python是一种广泛使用的高级编程语言..."},
    {"role": "assistant", "content": '{"summary": "Python是广泛使用的高级编程语言，以简洁易读著称", "keywords": ["Python", "编程语言", "简洁"]}'},
    {"role": "user", "content": "FastAPI是一个现代、快速的Web框架..."},  # 实际输入
]
```

### 开放题 1 思路
常见策略：1) **滑动窗口**：保留 system + 最近 N 轮对话（简单但有丢失早期上下文的风险）；2) **摘要压缩**：用一个 LLM 调用把早期对话总结成一段摘要，放入 system 或 user 消息（效果好但多一次 API 调用）；3) **向量检索**：把历史对话存入向量数据库，每次检索相关片段注入 user 消息（最灵活但复杂度高）。实际项目通常组合使用。
