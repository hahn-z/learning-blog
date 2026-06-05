# Python 异常处理与错误设计模式

> 分类：基础语法 | 错误处理 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 try/except/else/finally 的执行流程和各自用途（理解）
2. ✅ 能够设计自定义异常层次体系并使用 raise from 链接错误（应用）
3. ✅ 能够定位并修复吞掉异常、异常范围过大等常见问题（分析）
4. ✅ 能够在 AI 应用中设计健壮的 API 调用错误处理策略（评价）

---

## 📋 前置知识自检

1. **你能在 Python 中调用一个函数并处理返回值吗？**（答不上来？→ [《数据结构精讲》](02-python-数据结构精讲.md)）
2. **你知道 `None` 和报错的区别吗？**（答不上来？→ 本文会讲）
3. **你见过 `try...except` 的写法吗？**（答不上来？没关系，本文从头讲）

---

## 💡 概念讲解

- **一句话定义**：异常处理是程序遇到错误时的"应急预案"——捕获错误、优雅降级、保留现场信息。
- **现实类比**：就像外卖配送——店家关门（异常）时，平台不会崩溃，而是给你换一家或退款（处理异常）。
- **技术场景**：调用 LLM API 可能遇到网络超时、额度不足、模型过载等情况，异常处理让你的应用不至于直接崩掉。
- **⚠️ 常见误解**：很多人以为 `try/except` 是为了"让代码不报错"，其实是为了"让错误信息有意义，让程序能恢复"。

---

## 🧠 实时脑图

```text
[异常发生] 🔴
    ||
    ↓ try 块执行
[是否抛出异常？]
    ├── 是 → except 块 🟡
    │       ├── 匹配特定异常类型
    │       ├── 处理/记录/重试/上报
    │       └── raise from 可链接原始异常
    ├── 否 → else 块（无异常时执行）🟢
    └── 无论如何 → finally 块 🔴
            ├── 释放资源（关闭连接）
            └── 总是执行

[自定义异常层次] 🟡
    ├── AppError（基类）
    │   ├── LLMError
    │   │   ├── QuotaExceededError
    │   │   └── ModelOverloadedError
    │   └── ConfigError
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

### 场景：LLM API 调用的异常处理

```python
"""Demo: Exception handling patterns for AI applications."""
import time
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ============================================================
# 1. try/except/else/finally 基础
# ============================================================

def safe_divide(a: int, b: int) -> Optional[float]:
    """Basic try/except/else/finally demo."""
    try:
        result = a / b              # 🔴 可能抛出 ZeroDivisionError
    except ZeroDivisionError:
        logger.warning("除以零，返回 None")
        return None
    except TypeError as e:
        logger.error(f"类型错误: {e}")
        return None
    else:
        # 🟢 只有 try 块成功时才执行
        logger.info(f"计算成功: {a}/{b} = {result}")
        return result
    finally:
        # 🔴 无论是否异常，都执行（用于清理资源）
        logger.debug("safe_divide 执行完毕")


# ============================================================
# 2. 自定义异常体系
# ============================================================

class AppError(Exception):
    """Base exception for all application errors."""
    def __init__(self, message: str, details: Optional[dict] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class LLMError(AppError):
    """Errors related to LLM API calls."""
    pass


class QuotaExceededError(LLMError):
    """API quota has been exceeded."""
    pass


class ModelOverloadedError(LLMError):
    """The model is temporarily overloaded."""
    pass


class ConfigError(AppError):
    """Configuration-related errors."""
    pass


# ============================================================
# 3. raise from — 异常链
# ============================================================

def parse_llm_response(raw_json: dict) -> str:
    """Parse LLM response with proper error chaining."""
    try:
        content = raw_json["choices"][0]["message"]["content"]  # 🔴 可能 KeyError
    except (KeyError, IndexError) as e:
        # 🔴 raise from 保留原始异常的堆栈信息
        raise LLMError(
            "Invalid LLM response format",
            details={"raw_keys": list(raw_json.keys())}
        ) from e
    return content


# ============================================================
# 4. 实战：LLM 调用重试机制
# ============================================================

class MockLLMClient:
    """Mock LLM client that simulates failures."""
    def __init__(self):
        self.call_count = 0

    def chat(self, prompt: str) -> str:
        """Simulate API call with random failures."""
        self.call_count += 1

        # Simulate different failure scenarios
        if self.call_count <= 2:
            raise ModelOverloadedError("Model is overloaded", details={"retry_after": 1})
        if self.call_count == 3:
            raise ConnectionError("Network timeout")

        return f"LLM 回复: {prompt[:20]}..."


def call_llm_with_retry(
    client: MockLLMClient,
    prompt: str,
    max_retries: int = 3,
    backoff: float = 0.1,
) -> str:
    """Call LLM with retry logic and proper error handling."""
    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            result = client.chat(prompt)
        except ModelOverloadedError as e:
            last_error = e
            wait_time = backoff * (2 ** (attempt - 1))  # Exponential backoff
            logger.warning(f"模型过载，第 {attempt} 次重试，等待 {wait_time:.1f}s")
            time.sleep(wait_time)
        except QuotaExceededError as e:
            # 🔴 额度不足，不应重试
            logger.error(f"API 额度已耗尽: {e.message}")
            raise
        except ConnectionError as e:
            last_error = e
            logger.warning(f"网络错误，第 {attempt} 次重试")
            time.sleep(backoff)
        except LLMError as e:
            # 🟡 其他 LLM 错误，记录并重试
            last_error = e
            logger.warning(f"LLM 错误: {e.message}，第 {attempt} 次重试")
        else:
            # 🟢 成功，记录并返回
            logger.info(f"调用成功（第 {attempt} 次）")
            return result
        finally:
            logger.debug(f"尝试 {attempt}/{max_retries} 完成")

    # 🔴 所有重试失败
    raise LLMError(
        f"LLM 调用失败，已重试 {max_retries} 次"
    ) from last_error


# ============================================================
# 5. 上下文管理器风格的异常处理
# ============================================================

def process_user_prompt(prompt: str) -> str:
    """Process user prompt with comprehensive error handling."""
    if not prompt.strip():
        raise ValueError("Prompt cannot be empty")

    client = MockLLMClient()
    try:
        response = call_llm_with_retry(client, prompt)
    except LLMError as e:
        logger.error(f"LLM 处理失败: {e.message}, 详情: {e.details}")
        return f"[错误] AI 服务暂时不可用: {e.message}"
    except ValueError as e:
        logger.error(f"输入验证失败: {e}")
        return f"[错误] 输入无效: {e}"
    except Exception as e:
        # 🔴 捕获未预期的异常，避免程序崩溃
        logger.exception(f"未预期的错误: {e}")  # logger.exception 自动记录堆栈
        return "[错误] 发生未知错误，请稍后重试"
    else:
        return response


# ============================================================
# 6. 运行演示
# ============================================================

if __name__ == "__main__":
    # 🟢 正常调用（经过重试后成功）
    result = process_user_prompt("请解释什么是 Python 装饰器")
    print(f"\n结果: {result}")

    # 🔴 测试无效响应解析
    print("\n--- 测试异常链 ---")
    try:
        parse_llm_response({"error": "bad request"})
    except LLMError as e:
        print(f"捕获 LLMError: {e.message}")
        print(f"原因: {e.__cause__}")  # 🔴 通过 __cause__ 访问原始异常

    # 🔴 测试空输入
    print("\n--- 测试输入验证 ---")
    result = process_user_prompt("")
    print(f"结果: {result}")
```

---

## 👀 执行预览

```bash
$ python exception_demo.py
INFO: 调用成功（第 1 次）

结果: LLM 回复: 请解释什么是 Python 装饰器...

--- 测试异常链 ---
捕获 LLMError: Invalid LLM response format
原因: 'choices'

--- 测试输入验证 ---
ERROR: 输入验证失败: Prompt cannot be empty
结果: [错误] 输入无效: Prompt cannot be empty
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 不要用空的 `except:` 或 `except Exception` 吞掉所有异常 | bug 被隐藏，极难排查 | 🔴 |
| ⚠️ `finally` 中的 `return` 会覆盖 try 中的返回值 | 逻辑混乱，返回值不符合预期 | 🔴 |
| ⚠️ 自定义异常应该继承 `Exception` 而非 `BaseException` | 捕获 `Exception` 时会遗漏 | 🟡 |
| ⚠️ `except` 要从具体到宽泛排列 | 宽泛的先写会导致具体的永远匹配不到 | 🟡 |
| ⚠️ `raise from None` 可以抑制异常链，但慎用 | 丢失调试信息 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 裸 `except:` 捕获一切 | 连 `KeyboardInterrupt` 都被吞掉 | ✅ `except SpecificError:` |
| ❌ `except Exception: pass` | 错误被完全忽略，程序静默失败 | ✅ 至少 `logger.exception()` |
| ❌ `except` 块太宽，包了太多代码 | 无关代码的异常被错误处理 | ✅ try 块只包可能出错的代码 |
| ❌ 不用 `raise from` | 丢失原始堆栈，调试时找不到根因 | ✅ `raise CustomError(...) from original_error` |

### ❌ vs ✅ 对比

```python
# ❌ 吞掉异常，出问题无从排查
try:
    response = client.chat(prompt)
except:
    pass  # 🕳️ 黑洞

# ✅ 记录异常，保留信息
try:
    response = client.chat(prompt)
except LLMError as e:
    logger.error(f"LLM 调用失败: {e.message}", exc_info=True)
    raise  # 重新抛出，让调用者决定怎么处理
```

---

## 🔍 调试排查

#### 故障场景1：异常被吞掉，看不到任何错误信息

**症状**：程序行为不符合预期，但没有任何报错
**排查思路**：
1. 搜索代码中的 `except.*pass` 和裸 `except:`
2. 在可疑位置加 `logger.exception()` 看是否有异常被捕获

**根因**：某个 `except` 块吞掉了异常
**修复**：至少加日志，或 `raise` 重新抛出

#### 故障场景2：`finally` 中的 `return` 覆盖了结果

**症状**：函数返回值不是预期的
**排查思路**：
1. 检查 `finally` 块中是否有 `return` 语句
2. `finally` 中的 `return` 会覆盖 `try` 和 `except` 中的返回值

**根因**：`finally` 的 `return` 优先级最高
**修复**：`finally` 块中不要 `return`

---

## 📝 练习题

### 🟢 基础题

1. 写出 `try/except/else/finally` 各部分的执行顺序：当 try 成功时？当 try 抛异常时？（→ 目标 #1）

2. 以下代码输出什么？
```python
try:
    x = 1 / 0
except ZeroDivisionError:
    print("A")
else:
    print("B")
finally:
    print("C")
```
（→ 目标 #1）

### 🟡 进阶题

3. 设计一个异常层次：`AIError` → `PromptError`（prompt 相关）、`ModelError`（模型相关）、`RateLimitError`（限流），并写一个函数处理这三种错误。（→ 目标 #2）

4. 给定一个调用 LLM API 的函数，当遇到 `ConnectionError` 时最多重试 3 次并使用指数退避。（→ 目标 #4）

### 🔴 开放题

5. 你在开发一个批量处理 1000 个 prompt 的系统。讨论：哪些错误应该跳过继续、哪些应该重试、哪些应该立即终止整个批处理？设计你的异常处理策略。（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
异常处理
├── try/except/else/finally
│   ├── try — 可能出错的代码
│   ├── except — 捕获并处理
│   ├── else — 无异常时执行
│   └── finally — 无论如何执行（清理）
├── 自定义异常
│   ├── 继承 Exception（不是 BaseException）
│   ├── 添加 message + details
│   └── 建立异常层次体系
├── raise from（异常链）
│   ├── raise X from Y — 保留根因
│   └── raise X from None — 抑制链
├── 最佳实践
│   ├── 从具体到宽泛排列 except
│   ├── 不要吞异常（至少 log）
│   └── try 块尽量小
└── AI 场景
    ├── API 调用重试
    ├── 响应解析错误
    └── 额度/限流处理
```

---

## 🔄 举一反三

| 场景 | 异常处理策略 |
|------|-------------|
| LLM API 调用失败 | 重试（指数退避）+ 降级（换模型） |
| JSON 解析错误 | 记录原始数据 + 返回默认值或上报 |
| 批量 prompt 处理 | 单个失败跳过，记录到失败队列，不中断批处理 |
| 数据库连接断开 | 重试 + 重连 + 熔断 |

---

## 🗺️ 学习路径

```
[类型注解] → 📍 本篇：异常处理 → 《装饰器》
                          └→ 《上下文管理器》
```

**下一篇建议**：
- → [《Python 装饰器》](05-python-装饰器.md)：用装饰器实现重试、日志等横切关注点
- → [《Python 上下文管理器》](07-python-上下文管理器.md)：用 with 语句管理资源清理

---

## 📚 参考资料

- [Python Errors and Exceptions 官方教程](https://docs.python.org/3/tutorial/errors.html) [等级：官方]
- [PEP 3134 – Exception Chaining](https://peps.python.org/pep-3134/) [等级：官方] — raise from 的设计原理

---

## 📝 参考答案

<details>
<summary>点击展开参考答案</summary>

**基础题 1**：try 成功：try → else → finally。try 抛异常：try（到异常点）→ except → finally。else 不执行。

**基础题 2**：输出 A、C（ZeroDivisionError 被捕获，else 不执行，finally 总执行）。

**进阶题 3**：
```python
class AIError(Exception): pass
class PromptError(AIError): pass
class ModelError(AIError): pass
class RateLimitError(AIError): pass

def handle_ai_call(func):
    try:
        return func()
    except PromptError as e:
        return f"Prompt 错误: {e}"
    except RateLimitError:
        time.sleep(5)
        return func()  # 简单重试一次
    except ModelError as e:
        return f"模型错误: {e}"
```

**进阶题 4**：
```python
def call_with_retry(api_func, max_retries=3, base_delay=1.0):
    for attempt in range(max_retries):
        try:
            return api_func()
        except ConnectionError:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            time.sleep(delay)
```

**开放题 5**：Prompt 格式错误（跳过记录）、网络超时（重试 3 次）、API Key 无效（立即终止）、额度耗尽（暂停批处理，通知用户）、响应格式异常（重试一次，失败则跳过）。核心原则：可恢复的才重试，不可恢复的快速失败。

</details>
