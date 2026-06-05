# Python 数据结构精讲：从 list 到 dataclass

> 分类：基础语法 | 数据结构 | 难度：⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 list、dict、set、tuple 的核心区别与选择依据（理解）
2. ✅ 能够独立使用 dataclass 定义结构化数据（应用）
3. ✅ 能够定位数据结构选型不当导致的性能问题（分析）
4. ✅ 能够在 AI 应用中为 LLM 响应数据选择合适的结构（评价）

---

## 📋 前置知识自检

1. **你知道 `[]`、`{}`、`()` 分别创建什么类型吗？**（答不上来？→ 本文正好讲这个）
2. **你能写出 for 循环遍历一个列表吗？**（答不上来？→ 先学 Python 基础语法）
3. **你听说过"哈希表"这个概念吗？**（答不上来？→ 不影响，本文会讲到 dict 的原理）

---

## 💡 概念讲解

- **一句话定义**：数据结构是组织和存储数据的方式，不同的结构在查找、插入、遍历上有不同的性能特征。
- **现实类比**：list 是排队（有顺序，可插队），dict 是姓名牌（按键查值，一秒找到），set 是去重器（只留唯一），tuple 是封箱（不可改）。
- **技术场景**：处理 LLM 返回的 JSON 时，你需要用 dict 解析响应、用 list 存对话历史、用 dataclass 定义消息结构。
- **⚠️ 常见误解**：很多人以为 tuple 只是"不可变的 list"，其实 tuple 的语义是"固定结构的数据记录"，比如 `(x, y)` 坐标点。

---

## 🧠 实时脑图

```text
[Python 内置数据结构] 🔴
    ├── list [] 🔴 — 有序、可变、允许重复
    │   ├── 适用：对话历史、批量 Prompt
    │   └── O(1) 追加 / O(n) 按值查找
    ├── dict {} 🔴 — 键值对、O(1) 查找
    │   ├── 适用：LLM 响应解析、配置管理
    │   └── Python 3.7+ 保证插入顺序
    ├── set {} 🟡 — 无序、唯一
    │   ├── 适用：去重、集合运算
    │   └── O(1) 成员检查
    ├── tuple () 🟡 — 有序、不可变
    │   ├── 适用：固定结构数据（坐标、配置项）
    │   └── 可作为 dict 的 key
    └── dataclass 🟢 — 结构化数据类
        ├── 自动生成 __init__、__repr__
        ├── 类型注解 + 默认值
        └── 适用：LLM 消息、模型配置
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

### 场景：处理 LLM 对话数据

```python
"""Demo: Data structures in AI application context."""
from dataclasses import dataclass, field
from typing import Optional


# ============================================================
# 1. list — 对话历史管理
# ============================================================
conversation: list[dict[str, str]] = [
    {"role": "system", "content": "你是一个 Python 专家。"},
    {"role": "user", "content": "什么是装饰器？"},
]
# 🔴 追加新消息 — O(1)
conversation.append({"role": "assistant", "content": "装饰器是一种设计模式..."})

# 🟡 列表推导式 — 批量提取用户消息
user_messages = [msg["content"] for msg in conversation if msg["role"] == "user"]
print(f"用户消息: {user_messages}")


# ============================================================
# 2. dict — LLM 响应解析
# ============================================================
llm_response: dict = {
    "id": "chatcmpl-abc123",
    "choices": [
        {"index": 0, "message": {"role": "assistant", "content": "Hello!"}, "finish_reason": "stop"}
    ],
    "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
}

# 🔴 安全取值 — 使用 get() 避免 KeyError
content = llm_response.get("choices", [{}])[0].get("message", {}).get("content", "")
print(f"助手回复: {content}")

# 🟡 字典推导式 — 提取 token 用量
usage = llm_response.get("usage", {})
usage_summary = {k: v for k, v in usage.items() if "tokens" in k}
print(f"Token 用量: {usage_summary}")


# ============================================================
# 3. set — 标签去重
# ============================================================
tags_from_user = {"python", "AI", "LLM", "python", "GPT"}  # 自动去重
tags_from_model = {"python", "machine-learning", "AI", "deep-learning"}

# 🟡 集合运算
common_tags = tags_from_user & tags_from_model       # 交集
all_tags = tags_from_user | tags_from_model           # 并集
unique_user_tags = tags_from_user - tags_from_model   # 差集
print(f"共同标签: {common_tags}")
print(f"用户独有: {unique_user_tags}")


# ============================================================
# 4. tuple — 固定配置（不可变，可做 dict key）
# ============================================================
# 🟡 模型配置用 tuple 保证不被意外修改
model_config = ("gpt-4", 0.7, 4096)  # (model_name, temperature, max_tokens)
model_name, temperature, max_tokens = model_config  # 解包

# 🔴 tuple 作为 dict 的 key
endpoint_registry: dict[tuple[str, str], str] = {
    ("openai", "gpt-4"): "https://api.openai.com/v1/chat/completions",
    ("anthropic", "claude-3"): "https://api.anthropic.com/v1/messages",
}


# ============================================================
# 5. dataclass — 结构化 LLM 消息（推荐 ✅）
# ============================================================
@dataclass
class ChatMessage:
    """Structured representation of a chat message."""
    role: str                           # 🔴 必填字段
    content: str                        # 🔴 必填字段
    model: Optional[str] = None         # 🟡 可选字段
    tokens: int = 0                     # 🟡 带默认值
    metadata: dict[str, str] = field(default_factory=dict)  # 🔴 可变默认值必须用 field

    def is_system(self) -> bool:
        return self.role == "system"


# 🟢 创建实例
msg = ChatMessage(
    role="assistant",
    content="Python 的 dataclass 让代码更清晰！",
    model="gpt-4",
    tokens=12,
)
print(f"消息: {msg}")  # 自动生成的 __repr__
print(f"是否系统消息: {msg.is_system()}")


# ============================================================
# 6. 嵌套数据结构 — 完整对话场景
# ============================================================
@dataclass
class ConversationSession:
    """A complete conversation session with an LLM."""
    session_id: str
    messages: list[ChatMessage] = field(default_factory=list)
    total_tokens: int = 0

    def add_message(self, role: str, content: str, **kwargs) -> None:
        msg = ChatMessage(role=role, content=content, **kwargs)
        self.messages.append(msg)
        self.total_tokens += msg.tokens

    def to_api_format(self) -> list[dict[str, str]]:
        """Convert to OpenAI API format."""
        return [{"role": m.role, "content": m.content} for m in self.messages]

    def get_last_user_message(self) -> Optional[str]:
        for msg in reversed(self.messages):
            if msg.role == "user":
                return msg.content
        return None


# 🔴 使用
session = ConversationSession(session_id="sess-001")
session.add_message("system", "你是 Python 专家。")
session.add_message("user", "什么是 dataclass？", tokens=8)
session.add_message("assistant", "dataclass 是 Python 3.7 引入的装饰器...", tokens=25)

print(f"\nAPI 格式: {session.to_api_format()}")
print(f"总 Token: {session.total_tokens}")
print(f"最后用户消息: {session.get_last_user_message()}")
```

---

## 👀 执行预览

```bash
$ python data_structures_demo.py
用户消息: ['什么是装饰器？']
助手回复: Hello!
Token 用量: {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}
共同标签: {'python', 'AI'}
用户独有: {'GPT', 'LLM'}
消息: ChatMessage(role='assistant', content='Python 的 dataclass 让代码更清晰！', model='gpt-4', tokens=12, metadata={})
是否系统消息: False

API 格式: [{'role': 'system', 'content': '你是 Python 专家。'}, {'role': 'user', 'content': '什么是 dataclass？'}, {'role': 'assistant', 'content': 'dataclass 是 Python 3.7 引入的装饰器...'}]
总 Token: 33
最后用户消息: 什么是 dataclass？
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ `dataclass` 可变默认值必须用 `field(default_factory=...)` | 所有实例共享同一个列表/dict | 🔴 |
| ⚠️ `dict` 的 key 必须是不可变类型（str/int/tuple） | `TypeError: unhashable type` | 🔴 |
| ⚠️ `set` 是无序的，不要依赖遍历顺序 | 不同运行顺序可能不同 | 🟡 |
| ⚠️ `list` 按值查找是 O(n)，大数据量用 `set` | 性能瓶颈 | 🟡 |
| ⚠️ `dataclass` 默认可变，需要 `frozen=True` 才不可变 | 意外修改数据 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ `dataclass` 可变字段用 `[]` 做默认值 | 所有实例共享同一列表 | ✅ 用 `field(default_factory=list)` |
| ❌ 大列表用 `if x in my_list` 查找 | O(n) 查找，10万条数据要几秒 | ✅ 用 `set` 做 O(1) 查找 |
| ❌ 遍历 `dict` 时修改它 | `RuntimeError: dictionary changed size` | ✅ 先 `list(d.items())` 再遍历 |
| ❌ 用 `is` 比较字符串/数字值 | 结果不确定，`is` 比较的是对象身份 | ✅ 用 `==` 比较值 |

### ❌ vs ✅ 对比

```python
# ❌ 可变默认值陷阱
@dataclass
class BadConfig:
    prompts: list[str] = []  # 🔴 所有实例共享同一个 list！

# ✅ 使用 default_factory
@dataclass
class GoodConfig:
    prompts: list[str] = field(default_factory=list)  # 🟢 每个实例独立
```

---

## 🔍 调试排查

#### 故障场景1：`TypeError: unhashable type: 'list'`

**症状**：试图把 `list` 当作 `dict` 的 key 或放入 `set`
**排查思路**：
1. 检查报错行，找到哪里用了 `list` 做 key
2. 将 `list` 改为 `tuple` 即可

**根因**：`dict` 的 key 和 `set` 的元素必须是可哈希（不可变）类型
**修复**：`my_dict[tuple([1, 2, 3])] = value`

#### 故障场景2：`dataclass` 实例之间数据"串了"

**症状**：修改实例 A 的列表字段，实例 B 也跟着变了
**排查思路**：
1. 检查 `dataclass` 定义中是否有 `list`/`dict` 默认值
2. 搜索 `= []` 或 `= {}` 等写法

**根因**：可变默认值被所有实例共享
**修复**：改用 `field(default_factory=list)`

---

## 📝 练习题

### 🟢 基础题

1. 写出 list、dict、set、tuple 的创建语法和核心特征（有序/无序、可变/不可变、允许重复/唯一）。（→ 目标 #1）

2. 给定 `messages = [{"role": "user", "text": "Hi"}, {"role": "bot", "text": "Hello"}]`，用列表推导式提取所有 `text` 值。（→ 目标 #2）

### 🟡 进阶题

3. 定义一个 `PromptTemplate` dataclass，包含 `name: str`、`template: str`、`variables: list[str]`、`model: str = "gpt-4"`，并实现一个 `format(**kwargs)` 方法。（→ 目标 #2）

4. 你有一个包含 10 万条 LLM 对话记录的列表，需要快速判断某个 `session_id` 是否存在。用什么数据结构？为什么？（→ 目标 #3）

### 🔴 开放题

5. 设计一个 `LLMResponse` 数据结构来统一封装来自 OpenAI 和 Anthropic 的响应。要求：能统一获取 content、token usage、model 信息，且不可变（防止下游修改）。（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
Python 数据结构
├── list [] — 有序、可变、允许重复
│   ├── O(1) append / O(n) 搜索
│   └── 适用：对话历史、批量数据
├── dict {} — 键值对、O(1) 查找
│   ├── key 必须可哈希
│   └── 适用：JSON 解析、配置
├── set {} — 无序、唯一、O(1) 成员检查
│   ├── 集合运算：& | -
│   └── 适用：去重、标签系统
├── tuple () — 有序、不可变
│   ├── 可做 dict key
│   └── 适用：固定配置、坐标
└── dataclass — 结构化数据（推荐）
    ├── field(default_factory=...)
    ├── frozen=True → 不可变
    └── 适用：消息、配置、模型
```

---

## 🔄 举一反三

| 场景 | 推荐数据结构 | 原因 |
|------|-------------|------|
| 缓存 LLM 响应（按 prompt 查结果） | `dict[str, str]` | O(1) 按键查找 |
| 存储对话历史（保持顺序） | `list[ChatMessage]` | 有序、可追加 |
| 对用户输入的标签去重 | `set[str]` | 自动去重 |
| LLM API 的固定参数配置 | `dataclass(frozen=True)` | 结构化 + 不可变 |

---

## 🗺️ 学习路径

```
[环境管理] → 📍 本篇：数据结构 → 《类型注解》
                          └→ 《装饰器》
```

**下一篇建议**：
- → [《Python 类型注解》](03-python-类型注解.md)：给 dataclass 加上类型，代码更专业
- → [《Python 装饰器》](05-python-装饰器.md)：理解 `@dataclass` 背后的装饰器原理

---

## 📈 代码演进

```python
# v1: 用 dict 手动管理消息（容易拼错 key）
msg = {"role": "user", "content": "Hi", "tokens": 5}
print(msg["contnet"])  # ❌ KeyError: 拼写错误

# v2: 用 dataclass 自动管理（IDE 会提示拼写错误）
@dataclass
class ChatMessage:
    role: str
    content: str
    tokens: int = 0

msg = ChatMessage(role="user", content="Hi")
print(msg.content)  # ✅ 属性访问，有补全

# v3: 加 frozen=True 防止意外修改
@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str
msg = ChatMessage(role="user", content="Hi")
msg.content = "Bye"  # ❌ FrozenInstanceError
```

---

## 📚 参考资料

- [Python dataclass 官方文档](https://docs.python.org/3/library/dataclasses.html) [等级：官方] — dataclass 完整 API
- [Real Python: Python Data Structures](https://realpython.com/python-data-structures/) [等级：优质] — 内置结构详解

---

## 📝 参考答案

<details>
<summary>点击展开参考答案</summary>

**基础题 1**：list `[]` 有序可变允许重复，dict `{}` 键值对 O(1) 查找，set `{}` 无序唯一 O(1) 成员检查，tuple `()` 有序不可变。

**基础题 2**：`texts = [m["text"] for m in messages]` → `["Hi", "Hello"]`

**进阶题 3**：
```python
@dataclass
class PromptTemplate:
    name: str
    template: str
    variables: list[str] = field(default_factory=list)
    model: str = "gpt-4"

    def format(self, **kwargs) -> str:
        return self.template.format(**kwargs)
```

**进阶题 4**：用 `set` 存所有 `session_id`，因为 `in` 操作是 O(1)。如果需要保留映射关系，用 `dict` 以 `session_id` 为 key。

**开放题 5**：
```python
@dataclass(frozen=True)
class LLMResponse:
    content: str
    prompt_tokens: int
    completion_tokens: int
    model: str

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    @classmethod
    def from_openai(cls, raw: dict) -> "LLMResponse":
        return cls(
            content=raw["choices"][0]["message"]["content"],
            prompt_tokens=raw["usage"]["prompt_tokens"],
            completion_tokens=raw["usage"]["completion_tokens"],
            model=raw["model"],
        )

    @classmethod
    def from_anthropic(cls, raw: dict) -> "LLMResponse":
        return cls(
            content=raw["content"][0]["text"],
            prompt_tokens=raw["usage"]["input_tokens"],
            completion_tokens=raw["usage"]["output_tokens"],
            model=raw["model"],
        )
```

</details>
