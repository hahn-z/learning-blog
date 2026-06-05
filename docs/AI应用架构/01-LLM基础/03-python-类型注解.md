# Python 类型注解：Type Hints 让你的代码更专业

> 分类：基础语法 | 类型系统 | 难度：⭐⭐ | 预估用时：25 分钟

---

## 🎯 学习目标

1. ✅ 能够为函数和变量添加正确的类型注解（应用）
2. ✅ 能够解释 Optional、Union、Literal、Protocol 等高级类型的区别（理解）
3. ✅ 能够使用 mypy 发现并修复类型错误（分析）
4. ✅ 能够在 AI 项目中设计类型安全的 API 接口（评价）

---

## 📋 前置知识自检

1. **你知道 Python 函数参数和返回值的基本写法吗？**（答不上来？→ [《数据结构精讲》](02-python-数据结构精讲.md)）
2. **你理解 `None` 在 Python 中的含义吗？**（答不上来？→ 本文会讲到 `Optional`）
3. **你用过 `dict[str, str]` 这种写法吗？**（答不上来？→ 本文正好讲）

---

## 💡 概念讲解

- **一句话定义**：类型注解是给变量、参数、返回值标注预期类型的语法，让 IDE 和静态检查工具帮你提前发现 bug。
- **现实类比**：就像快递包裹上贴的"易碎品""此面朝上"标签——不贴也能寄，但贴了让处理更安全。
- **技术场景**：AI 应用中，LLM 返回的 JSON 结构复杂，类型注解让解析代码更安全、IDE 自动补全更智能。
- **⚠️ 常见误解**：类型注解不是强制类型检查！Python 运行时不检查类型，它只是"提示"。真正的检查靠 mypy/pyright 等工具。

---

## 🧠 实时脑图

```text
[Python Type Hints] 🔴
    ├── 基础类型 🟡
    │   ├── str, int, float, bool
    │   └── list[int], dict[str, Any], tuple[str, int]
    ├── 函数注解 🔴
    │   ├── def f(x: str) -> int:
    │   └── 参数 + 返回值
    ├── Optional & Union 🟡
    │   ├── Optional[str] = str | None
    │   └── Union[str, int, None]
    ├── Literal 🔴 — 限定具体值
    │   └── Literal["user", "assistant"]
    ├── Protocol 🟢 — 鸭子类型的类型版
    │   └── 定义行为协议
    ├── TypeVar & Generic 🟡
    │   └── 泛型函数/类
    └── 工具链
        ├── mypy — 静态检查 🔴
        └── pyright — 更快的检查器 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+（使用 `X | Y` 语法替代 `Union`）

```python
"""Demo: Type hints in AI application context."""
from typing import Optional, Union, Literal, Protocol, TypeVar, Any
from dataclasses import dataclass


# ============================================================
# 1. 基础类型注解
# ============================================================

# 🔴 变量注解（Python 3.6+）
model_name: str = "gpt-4"
temperature: float = 0.7
max_tokens: int = 4096
is_streaming: bool = True

# 🟡 容器类型注解（Python 3.9+ 可用内置类型）
models: list[str] = ["gpt-4", "claude-3", "gemini-pro"]
model_config: dict[str, Any] = {"temperature": 0.7, "top_p": 0.9}
roles: tuple[str, ...] = ("system", "user", "assistant")  # 固定长度或可变长度元组


# ============================================================
# 2. 函数类型注解
# ============================================================

def count_tokens(text: str, model: str = "gpt-4") -> int:
    """Estimate token count for a given text."""
    # Rough estimation: ~4 chars per token
    return len(text) // 4

def build_prompt(system: str, user: str) -> list[dict[str, str]]:
    """Build a chat completion prompt."""
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

# 🔴 调用时 IDE 会提示参数类型和返回类型
result: list[dict[str, str]] = build_prompt("你是助手", "你好")


# ============================================================
# 3. Optional 和 Union
# ============================================================

# 🟡 Optional[X] 等价于 X | None（Python 3.10+）
def get_last_message(messages: list[dict[str, str]]) -> str | None:
    """Get the last message content, or None if empty."""
    if not messages:
        return None
    return messages[-1].get("content")

# 🟡 Union 用于多种类型（Python 3.10+ 用 | 更简洁）
def parse_token_count(value: int | str) -> int:
    """Parse token count from int or string."""
    if isinstance(value, str):
        return int(value)
    return value


# ============================================================
# 4. Literal — 限定具体值
# ============================================================

# 🔴 限制参数只能取特定值（比 Enum 更轻量）
Role = Literal["system", "user", "assistant"]

def create_message(role: Role, content: str) -> dict[str, str]:
    """Create a chat message with type-safe role."""
    return {"role": role, "content": content}

# ✅ 正确
msg = create_message("user", "Hello!")
# ❌ mypy 会报错：create_message("admin", "Hi")  -- "admin" 不在 Role 中


# ============================================================
# 5. Protocol — 结构化子类型（鸭子类型的类型版）
# ============================================================

# 🟢 定义行为协议，不需要继承
class Tokenizer(Protocol):
    """Any object that can count tokens."""
    def count(self, text: str) -> int: ...

class SimpleTokenizer:
    """A simple tokenizer that estimates token count."""
    def count(self, text: str) -> int:
        return len(text.split())

def estimate_cost(text: str, tokenizer: Tokenizer, price_per_token: float) -> float:
    """Estimate API cost using any tokenizer."""
    tokens = tokenizer.count(text)
    return tokens * price_per_token

# ✅ SimpleTokenizer 自动满足 Tokenizer 协议（无需显式继承）
tokenizer = SimpleTokenizer()
cost = estimate_cost("Hello world", tokenizer, 0.00003)
print(f"预估费用: ${cost:.6f}")


# ============================================================
# 6. TypeVar — 泛型
# ============================================================

# 🟡 让函数保持输入输出类型关联
T = TypeVar("T")

def first_or_default(items: list[T], default: T) -> T:
    """Return the first item or a default value."""
    return items[0] if items else default

# 🔴 类型推断：返回类型与输入一致
name: str = first_or_default(["Alice", "Bob"], "Unknown")  # IDE 知道返回 str
count: int = first_or_default([1, 2, 3], 0)                # IDE 知道返回 int


# ============================================================
# 7. 综合：类型安全的 LLM 客户端接口
# ============================================================

@dataclass
class ChatResponse:
    """Type-safe LLM response."""
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

class LLMClient(Protocol):
    """Protocol for any LLM client."""
    def chat(self, messages: list[dict[str, str]], model: str) -> ChatResponse: ...

def run_chat(client: LLMClient, prompt: str, model: str = "gpt-4") -> str:
    """Run a chat completion with type safety."""
    messages = build_prompt("你是助手", prompt)
    response = client.chat(messages, model)
    print(f"[{response.model}] Tokens: {response.total_tokens}")
    return response.content

# 🔴 使用示例（模拟客户端）
class MockClient:
    def chat(self, messages: list[dict[str, str]], model: str) -> ChatResponse:
        return ChatResponse(
            content="这是模拟回复。",
            model=model,
            prompt_tokens=10,
            completion_tokens=20,
        )

client = MockClient()
reply = run_chat(client, "你好")
print(f"回复: {reply}")
```

---

## 👀 执行预览

```bash
$ python type_hints_demo.py
预估费用: $0.000060
[gpt-4] Tokens: 30
回复: 这是模拟回复。
```

### mypy 检查结果

```bash
$ mypy type_hints_demo.py
Success: no issues found in 1 source file

# 如果有类型错误：
# error: Argument 1 to "create_message" has incompatible type "admin"; expected "Literal['system', 'user', 'assistant']"
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ Python 运行时不强制类型 | 类型写错了也不会报错，必须用 mypy 检查 | 🔴 |
| ⚠️ `Optional[X]` 不设默认值时调用者必须传值 | 与直觉不符，`Optional` 只表示"可以是 None" | 🟡 |
| ⚠️ `Any` 会绕过类型检查 | 用太多 `Any` 等于没加类型 | 🟡 |
| ⚠️ `list` 等内置类型做注解需要 Python 3.9+ | 3.8 及以下需要 `from typing import List` | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ `def f(x: list)` 不标注元素类型 | mypy 无法检查元素操作 | ✅ `def f(x: list[str])` |
| ❌ `x: Optional[str] = None` 后不做 None 检查就调用方法 | `AttributeError` | ✅ 先 `if x is not None:` |
| ❌ 滥用 `Any` | 类型检查形同虚设 | ✅ 尽量用具体类型或 `Protocol` |
| ❌ Python 3.8 用 `list[str]` | `TypeError: 'type' is not subscriptable` | ✅ 用 `from typing import List` 或升级 Python |

### ❌ vs ✅ 对比

```python
# ❌ 无类型注解，IDE 无法补全，bug 容易溜过
def process(data):
    return data["choices"][0]["text"]

# ✅ 有类型注解，IDE 有补全，mypy 能检查
def process(data: dict[str, Any]) -> str:
    return data["choices"][0]["text"]  # mypy 至少知道返回 str
```

---

## 🔍 调试排查

#### 故障场景1：mypy 报 `Any` 类型不安全

**症状**：`error: Returning Any from function declared to return "str"`
**排查思路**：
1. 找到返回值来源，看是否缺少类型注解
2. 如果是第三方库返回 `Any`，用 `assert isinstance()` 窄化类型

**根因**：数据源头没有类型信息（如 `json.loads()` 返回 `Any`）
**修复**：用 `TypedDict` 或 `dataclass` 定义 JSON 结构，或加 `# type: ignore` 并注释原因

#### 故障场景2：Python 3.8 报 `list[str]` 语法错误

**症状**：`TypeError: 'type' object is not subscriptable`
**排查思路**：检查 Python 版本 → `python --version`

**根因**：Python 3.8 不支持 `list[str]`，需要 `from __future__ import annotations` 或 `List[str]`
**修复**：文件顶部加 `from __future__ import annotations`

---

## 📝 练习题

### 🟢 基础题

1. 给以下函数加上类型注解：`def add(a, b): return a + b`，使其接受 `int | float` 返回 `float`。（→ 目标 #1）

2. 解释 `Optional[str]` 和 `str | None` 的区别。（→ 目标 #2）

### 🟡 进阶题

3. 定义一个 `TypedDict` 来描述 OpenAI Chat API 的请求体结构（包含 `model: str`、`messages: list[dict]`、`temperature: float`）。（→ 目标 #1）

4. 定义一个 `Embedder` Protocol，要求有 `embed(text: str) -> list[float]` 方法。然后写一个接受 `Embedder` 的函数。（→ 目标 #2）

### 🔴 开放题

5. 你正在设计一个支持多个 LLM 提供商的 SDK。如何用类型系统确保：用户调用 `client.chat()` 时只能传该提供商支持的参数？（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
Type Hints
├── 基础: str, int, float, bool
├── 容器: list[str], dict[str, Any], tuple[int, str]
├── Optional: X | None（可以是 None）
├── Literal["a", "b"] — 限定具体值
├── Protocol — 鸭子类型 + 类型检查
├── TypeVar — 泛型（保持类型关联）
├── TypedDict — dict 的结构化类型
└── 工具: mypy / pyright 静态检查
```

---

## 🔄 举一反三

| 场景 | 推荐类型工具 |
|------|-------------|
| 函数参数只接受几个固定字符串 | `Literal["a", "b", "c"]` |
| 第三方库对象但有统一接口 | `Protocol` |
| JSON API 响应结构 | `TypedDict` 或 `dataclass` |
| 通用函数（输入类型=输出类型） | `TypeVar` |

---

## 🗺️ 学习路径

```
[数据结构] → 📍 本篇：类型注解 → 《异常处理》
                          └→ 《装饰器》(理解 @dataclass)
```

**下一篇建议**：
- → [《Python 异常处理与错误设计模式》](04-python-异常处理.md)：类型注解让接口清晰，异常处理让代码健壮
- → [《Python 装饰器》](05-python-装饰器.md)：理解 `@dataclass` 等装饰器的类型系统

---

## 📦 版本兼容性

- ✅ 适配版本：Python 3.10+（使用 `X | Y` 语法）
- ⚠️ Python 3.9：`list[str]` 可用，但 `X | Y` 需 `from __future__ import annotations`
- ⚠️ Python 3.8：需要 `from typing import List, Optional, Union`

---

## 📚 参考资料

- [Python typing 官方文档](https://docs.python.org/3/library/typing.html) [等级：官方] — 完整类型系统参考
- [mypy 官方文档](https://mypy.readthedocs.io/) [等级：官方] — 静态类型检查器使用指南
- [Real Python: Python Type Checking](https://realpython.com/python-type-checking/) [等级：优质] — 类型系统全面教程

---

## 📝 参考答案

<details>
<summary>点击展开参考答案</summary>

**基础题 1**：
```python
def add(a: int | float, b: int | float) -> float:
    return float(a + b)
```

**基础题 2**：没有区别。`Optional[str]` 是 `Union[str, None]` 的语法糖，Python 3.10+ 可以用 `str | None`，语义完全相同。

**进阶题 3**：
```python
from typing import TypedDict

class ChatRequest(TypedDict):
    model: str
    messages: list[dict[str, str]]
    temperature: float
```

**进阶题 4**：
```python
from typing import Protocol

class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...

def cosine_similarity(e: Embedder, text_a: str, text_b: str) -> float:
    a = e.embed(text_a)
    b = e.embed(text_b)
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x**2 for x in a) ** 0.5
    norm_b = sum(x**2 for x in b) ** 0.5
    return dot / (norm_a * norm_b)
```

**开放题 5**：可以用 `Literal` + `@overload` 区分不同提供商的参数类型，或用泛型 + Protocol 设计提供商适配器模式。核心思路：编译时就能发现参数错误，而不是运行时。

</details>
