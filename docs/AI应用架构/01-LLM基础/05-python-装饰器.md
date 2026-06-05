# Python 装饰器：从原理到实战

> 分类：进阶语法 | 装饰器 | 难度：⭐⭐ | 预估用时：35 分钟

---

## 🎯 学习目标

1. ✅ 能够解释装饰器的原理（闭包 + 高阶函数）和 `@` 语法糖的等价写法（理解）
2. ✅ 能够独立编写带参数的装饰器、类装饰器，并正确使用 `functools.wraps`（应用）
3. ✅ 能够定位装饰器导致的元信息丢失、参数签名错误等问题（分析）
4. ✅ 能够在 AI 应用中实现日志、缓存、重试等实用装饰器（创造）

---

## 📋 前置知识自检

1. **你理解 Python 中"函数是一等公民"（可以赋值给变量）吗？**（答不上来？→ 先理解高阶函数）
2. **你知道什么是闭包（内部函数引用外部变量）吗？**（答不上来？→ 本文会回顾）
3. **你用过 `@staticmethod`、`@property` 等装饰器吗？**（答不上来？→ 没关系，本文从零讲）

---

## 💡 概念讲解

- **一句话定义**：装饰器是一个接收函数作为参数并返回新函数的高阶函数，用于在不修改原函数代码的情况下增强其功能。
- **现实类比**：就像给手机套个壳——手机本身不变，但多了防摔功能。装饰器给函数"套壳"增加功能。
- **技术场景**：AI 应用中，给 LLM 调用函数加日志、缓存结果避免重复调用、自动重试失败请求。
- **⚠️ 常见误解**：很多人以为装饰器"修改了原函数"，其实它创建了一个新函数，只是用同名变量覆盖了原引用。原函数仍在内存中（可通过 `@wraps` 的 `__wrapped__` 访问）。

---

## 🧠 实时脑图

```text
[装饰器原理] 🔴
    ||
    ├── 闭包 Closure 🟡
    │   ├── 外函数定义环境
    │   ├── 内函数引用外函数变量
    │   └── 外函数返回内函数
    ||
    ├── @ 语法糖 🔴
    │   ├── @decorator ≡ func = decorator(func)
    │   └── 多层装饰器：从下往上应用
    ||
    ├── 带参数装饰器 🟡
    │   ├── 三层嵌套：外层接收参数
    │   └── @decorator(arg1, arg2)
    ||
    ├── functools.wraps 🔴
    │   └── 保留原函数元信息
    ||
    └── 实用场景 🟢
        ├── 日志记录
        ├── 结果缓存
        └── 自动重试
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

### 场景：为 LLM 调用添加日志、缓存、重试

```python
"""Demo: Decorators for AI application patterns."""
import time
import functools
import logging
from typing import Any, Callable, TypeVar

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


# ============================================================
# 0. 闭包回顾 — 装饰器的基础
# ============================================================

def make_greeter(greeting: str):
    """Outer function defines the environment."""
    def greet(name: str) -> str:
        # 🔴 Inner function references outer variable (closure)
        return f"{greeting}, {name}!"
    return greet

hello = make_greeter("Hello")
print(hello("World"))  # "Hello, World!"
# 🔴 greeting 变量被"记住"了，即使 make_greeter 已经返回


# ============================================================
# 1. 最简装饰器
# ============================================================

def simple_logger(func: F) -> F:
    """Log function calls — simplest decorator."""
    @functools.wraps(func)  # 🔴 保留原函数元信息
    def wrapper(*args, **kwargs):
        logger.info(f"调用: {func.__name__}")
        result = func(*args, **kwargs)
        logger.info(f"完成: {func.__name__}")
        return result
    return wrapper  # type: ignore[return-value]


# 🔴 @ 语法糖等价于：ask_llm = simple_logger(ask_llm)
@simple_logger
def ask_llm(prompt: str) -> str:
    """Ask LLM a question (mock)."""
    time.sleep(0.1)
    return f"回答: {prompt[:20]}..."

print(f"\n结果: {ask_llm('什么是Python装饰器？')}")
print(f"函数名: {ask_llm.__name__}")  # 🔴 @wraps 保留了原始名称


# ============================================================
# 2. 带参数的装饰器 — 三层嵌套
# ============================================================

def retry(max_retries: int = 3, delay: float = 1.0, backoff: float = 2.0):
    """Retry decorator with configurable parameters.

    🔴 三层结构：
    - 最外层：接收装饰器参数（max_retries, delay...）
    - 中间层：接收被装饰的函数
    - 最内层：实际执行的包装函数
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_error: Exception | None = None
            current_delay = delay

            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    logger.warning(
                        f"{func.__name__} 第 {attempt}/{max_retries} 次失败: {e}"
                    )
                    if attempt < max_retries:
                        time.sleep(current_delay)
                        current_delay *= backoff  # Exponential backoff

            # All retries exhausted
            raise RuntimeError(
                f"{func.__name__} 失败，已重试 {max_retries} 次"
            ) from last_error
        return wrapper  # type: ignore[return-value]
    return decorator


# 🔴 使用带参数的装饰器
class MockAPI:
    def __init__(self):
        self.call_count = 0

    @retry(max_retries=3, delay=0.1, backoff=2.0)
    def call_llm(self, prompt: str) -> str:
        """Mock LLM API that fails twice then succeeds."""
        self.call_count += 1
        if self.call_count <= 2:
            raise ConnectionError(f"API 超时（第 {self.call_count} 次）")
        return f"LLM 回复: {prompt[:20]}..."

api = MockAPI()
result = api.call_llm("解释装饰器")
print(f"\n重试结果: {result}")


# ============================================================
# 3. 缓存装饰器 — 避免重复 LLM 调用
# ============================================================

def cache_llm(ttl_seconds: int = 300):
    """Cache LLM responses with TTL (time-to-live)."""
    def decorator(func: F) -> F:
        cache: dict[str, tuple[float, Any]] = {}

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # 🟡 Build cache key from arguments
            key = f"{args}-{sorted(kwargs.items())}"

            # Check cache
            if key in cache:
                cached_time, cached_result = cache[key]
                if time.time() - cached_time < ttl_seconds:
                    logger.info(f"缓存命中: {func.__name__}")
                    return cached_result

            # Cache miss — call the function
            result = func(*args, **kwargs)
            cache[key] = (time.time(), result)
            return result

        # 🔴 Add cache management methods
        wrapper.clear_cache = lambda: cache.clear()  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]
    return decorator

# 🔴 functools.lru_cache 是标准库自带的缓存装饰器
# @functools.lru_cache(maxsize=128) — 更简单的选择


# ============================================================
# 4. 类装饰器 — 有状态的装饰器
# ============================================================

class RateLimiter:
    """Rate limiter using class decorator pattern."""

    def __init__(self, calls_per_minute: int = 60):
        self.calls_per_minute = calls_per_minute
        self.calls: list[float] = []

    def __call__(self, func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            now = time.time()
            # Remove calls older than 1 minute
            self.calls = [t for t in self.calls if now - t < 60]

            if len(self.calls) >= self.calls_per_minute:
                raise RuntimeError(
                    f"Rate limit exceeded: {self.calls_per_minute} calls/min"
                )

            self.calls.append(now)
            return func(*args, **kwargs)
        return wrapper  # type: ignore[return-value]


# ============================================================
# 5. 综合应用：多层装饰器
# ============================================================

# 🔴 装饰器应用顺序：从下往上（最靠近函数的先应用）
llm_cache: dict[str, str] = {}

@RateLimiter(calls_per_minute=10)  # ← 第 2 个应用
@retry(max_retries=2, delay=0.1)   # ← 第 1 个应用（最靠近函数）
def generate_embedding(text: str) -> list[float]:
    """Generate embedding for text (mock)."""
    if len(text) < 5:
        raise ValueError("Text too short for embedding")
    # Mock embedding
    return [hash(text) % 100 / 100.0] * 128

try:
    emb = generate_embedding("Hello world, this is a test")
    print(f"\nEmbedding 维度: {len(emb)}")
except Exception as e:
    print(f"错误: {e}")


# ============================================================
# 6. functools.wraps 的重要性演示
# ============================================================

def bad_decorator(func):
    """Decorator WITHOUT wraps — loses metadata."""
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

def good_decorator(func):
    """Decorator WITH wraps — preserves metadata."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@bad_decorator
def func_a(): """Original docstring.""" pass

@good_decorator
def func_b(): """Original docstring.""" pass

print(f"\n❌ bad_decorator — 函数名: {func_a.__name__}, 文档: {func_a.__doc__}")
print(f"✅ good_decorator — 函数名: {func_b.__name__}, 文档: {func_b.__doc__}")
```

---

## 👀 执行预览

```bash
$ python decorator_demo.py
Hello, World!
INFO: 调用: ask_llm
INFO: 完成: ask_llm

结果: 回答: 什么是Python装饰器？...
函数名: ask_llm
WARNING: call_llm 第 1/3 次失败: API 超时（第 1 次）
WARNING: call_llm 第 2/3 次失败: API 超时（第 2 次）

重试结果: LLM 回复: 解释装饰器...

Embedding 维度: 128

❌ bad_decorator — 函数名: wrapper, 文档: None
✅ good_decorator — 函数名: func_b, 文档: Original docstring.
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 必须使用 `@functools.wraps` | 函数名、文档、签名全丢失，调试困难 | 🔴 |
| ⚠️ 带参数装饰器是三层嵌套，不是两层 | 写成两层会直接调用被装饰函数 | 🔴 |
| ⚠️ 装饰器会改变函数的调用栈 | 异常堆栈多一层 wrapper，影响调试 | 🟡 |
| ⚠️ 多层装饰器从下往上应用 | 顺序不对导致逻辑错误 | 🟡 |
| ⚠️ 装饰器中的可变默认值（如缓存 dict）会在所有调用间共享 | 这是特性，但要注意内存 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 忘记 `@functools.wraps` | `func.__name__` 变成 `wrapper` | ✅ 始终加 `@functools.wraps(func)` |
| ❌ 带参数装饰器写成两层 | 装饰时函数就被调用了 | ✅ 三层：外层参数→中间层函数→内层包装 |
| ❌ 装饰器不保留返回值 | `return func(...)` 忘了写 | ✅ `result = func(...); return result` |
| ❌ 缓存装饰器没有 TTL | 内存泄漏，缓存永不过期 | ✅ 加 TTL 或使用 `lru_cache(maxsize=...)` |

### ❌ vs ✅ 对比

```python
# ❌ 两层嵌套——这不是带参数装饰器，是直接调用
def retry(max_retries):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper  # 返回的是 wrapper，不是函数！

# ✅ 三层嵌套——正确的带参数装饰器
def retry(max_retries):
    def decorator(func):       # ← 第二层：接收函数
        @functools.wraps(func)
        def wrapper(*args, **kwargs):  # ← 第三层：实际包装
            ...
        return wrapper
    return decorator
```

---

## 🔍 调试排查

#### 故障场景1：装饰后函数签名变了

**症状**：IDE 显示 `*args, **kwargs` 而不是原始参数，`help()` 也看不到参数
**排查思路**：检查是否漏了 `@functools.wraps(func)`
**根因**：wrapper 函数覆盖了原始函数的元信息
**修复**：加 `@functools.wraps(func)`

#### 故障场景2：带参数装饰器"调用就执行"

**症状**：`@retry(3)` 定义时就打印了日志或执行了逻辑
**排查思路**：检查装饰器是否只有两层（缺了中间层接收 `func`）
**根因**：少了一层嵌套
**修复**：确保三层结构 — `def retry(args)` → `def decorator(func)` → `def wrapper(*a, **kw)`

---

## 📝 练习题

### 🟢 基础题

1. 手动将以下代码从 `@` 语法糖改写为等价的函数调用形式：
```python
@logger
def f(): pass
```
（→ 目标 #1）

2. 解释闭包的概念，以及为什么装饰器的 wrapper 函数能"记住"原函数。（→ 目标 #1）

### 🟡 进阶题

3. 编写一个 `@measure_time` 装饰器，记录函数执行时间并打印。（→ 目标 #2）

4. 编写一个 `@retry_on(ValueError, max_retries=3)` 带参数装饰器，只对指定异常重试。（→ 目标 #2）

### 🔴 开放题

5. 设计一个 `@cost_tracker` 装饰器，追踪 LLM 调用的 token 消耗和费用。要求：支持多个函数分别统计、可以导出汇总报告、线程安全。（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
装饰器
├── 原理
│   ├── 闭包：内函数引用外函数变量
│   ├── 高阶函数：接收/返回函数
│   └── @ 语法糖：func = decorator(func)
├── 基本装饰器
│   ├── def decorator(func): → wrapper
│   └── @functools.wraps(func) — 保留元信息
├── 带参数装饰器
│   └── 三层嵌套（参数→函数→包装）
├── 类装饰器
│   └── __call__ 方法
├── 多层装饰器
│   └── 从下往上应用
└── 实用场景
    ├── 日志（记录调用）
    ├── 缓存（避免重复计算）
    └── 重试（自动恢复）
```

---

## 🔄 举一反三

| 场景 | 装饰器方案 |
|------|-----------|
| API 调用需要限流 | `@RateLimiter(calls=60, period=60)` |
| 昂贵的 LLM 调用需要缓存 | `@cache_llm(ttl=300)` 或 `@functools.lru_cache` |
| 函数需要权限检查 | `@require_role("admin")` |
| 数据库操作需要事务 | `@transactional` |

---

## 🗺️ 学习路径

```
[异常处理] → 📍 本篇：装饰器 → 《生成器与迭代器》
                          └→ 《上下文管理器》
```

**下一篇建议**：
- → [《Python 生成器与迭代器》](06-python-生成器与迭代器.md)：另一种"包装"思维——惰性生成数据
- → [《Python 上下文管理器》](07-python-上下文管理器.md)：装饰器的好搭档——with 语句

---

## 📚 参考资料

- [PEP 318 – Decorators for Functions and Methods](https://peps.python.org/pep-0318/) [等级：官方]
- [Real Python: Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/) [等级：优质] — 最全面的装饰器教程

---

## 📝 参考答案

<details>
<summary>点击展开参考答案</summary>

**基础题 1**：
```python
def f(): pass
f = logger(f)
```

**基础题 2**：闭包是指内部函数引用了外部函数的变量，即使外部函数已经返回，这些变量依然存活在内存中。装饰器的 wrapper 函数通过闭包"记住"了 `func` 参数，所以每次调用 wrapper 时都能调用到原函数。

**进阶题 3**：
```python
import functools, time

def measure_time(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} 耗时: {elapsed:.4f}s")
        return result
    return wrapper
```

**进阶题 4**：
```python
def retry_on(exception_type, max_retries=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exception_type as e:
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(0.5 * (attempt + 1))
        return wrapper
    return decorator
```

**开放题 5**：设计要点 — 使用 `threading.Lock` 保证线程安全、用类变量或 closure dict 存储统计、提供 `get_report()` 方法导出。核心结构：`_lock = threading.Lock()`，`_stats: dict[str, dict]` 记录每个函数的 tokens/cost/count。

</details>
