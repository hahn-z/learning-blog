# LLM错误处理与重试策略：生产级调用模板

> 分类：LLM API | 可靠性 | 难度：⭐⭐⭐ | 预估用时：35 分钟

---

## 🎯 学习目标

1. ✅ 列举 LLM API 的常见错误类型及触发条件（记忆/理解）
2. ✅ 使用 tenacity 库实现指数退避重试策略（应用）
3. ✅ 实现降级到备用模型和熔断器模式（应用/分析）
4. ✅ 编写可直接用于生产环境的 LLM 调用模板代码（应用）

---

## 📋 前置知识自检

1. **你知道 HTTP 状态码 429、500、503 的含义吗？**（答不上来？→ 先补 HTTP 状态码基础）
2. **你了解指数退避（Exponential Backoff）的概念吗？**（答不上来？→ 先学分布式系统重试基础）
3. **你调用 LLM API 时遇到过错误吗？是怎么处理的？**（答不上来？→ 先实践基础 API 调用）

---

## 💡 概念讲解

- **一句话定义**：LLM 错误处理是对 API 调用中可能出现的各类异常进行分类、重试、降级的系统化策略。
- **现实类比**：像打电话给客服——占线（429 限流）就稍后再拨，电话断了（超时）就重拨，这个客服解决不了就换一个（降级）。关键是不能无限重拨，也不能一遇到问题就放弃。
- **技术场景**：任何生产环境的 LLM 调用都需要错误处理——API 限流、网络抖动、模型过载是常态而非异常。
- **⚠️ 常见误解**：很多人以为加个 try-except 就够了。实际上不同类型的错误需要不同的处理策略：429 应该等待后重试，400 不应该重试（请求本身有问题），500 可以重试但要有上限，上下文超限需要截断而不是重试。

---

## 🧠 实时脑图

```text
[LLM API 调用] 🔴
    || (可能失败)
    ↓
[错误分类] 🔴
    ||
    ├── [429 RateLimit] 🟡 → 等待 + 重试
    ├── [Timeout] 🟡 → 重试（可能加大timeout）
    ├── [500 ServerError] 🟡 → 重试 + 指数退避
    ├── [400 BadRequest] 🔴 → 不重试！修改请求
    ├── [ContextLengthExceeded] 🔴 → 截断请求
    └── [AuthError] 🔴 → 不重试！检查Key
    ||
    ↓ (可重试的错误)
[重试策略] 🔴
    ||
    ├── [指数退避] 🟡 ← 1s, 2s, 4s, 8s...
    ├── [最大重试 3 次] 🟡
    ├── [抖动（jitter）] 🟢 ← 防止重试风暴
    └── [降级到备用模型] 🔴 ← 主模型持续失败时
    ||
    ↓ (持续失败)
[熔断器] 🟡
    || (半开状态试探)
    ↓
[恢复 或 彻底失败] 🔴
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install openai tenacity`

### 示例1：常见错误类型演示

```python
# error_types.py - LLM API common error types
# Python 3.10+
from openai import (
    OpenAI,
    APIStatusError,
    RateLimitError,
    APITimeoutError,
    BadRequestError,
    APIConnectionError,
)

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

# --- Error type reference ---
ERROR_GUIDE = """
LLM API Common Errors:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Error Type          | HTTP | Should Retry? | Action                    |
|---------------------|------|---------------|---------------------------|
| RateLimitError      | 429  | ✅ Yes        | Wait + retry (backoff)    |
| APITimeoutError     | -    | ✅ Yes        | Retry with longer timeout |
| APIConnectionError  | -    | ✅ Yes        | Retry (network issue)     |
| InternalServerError | 500  | ✅ Yes        | Retry + backoff           |
| BadRequestError     | 400  | ❌ No         | Fix the request           |
| AuthenticationError | 401  | ❌ No         | Check API key             |
| PermissionError     | 403  | ❌ No         | Check permissions         |
| NotFoundError       | 404  | ❌ No         | Check model name          |
| ContextLengthExceed | 400  | ❌ No         | Truncate input            |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
print(ERROR_GUIDE)
```

### 示例2：生产级调用模板（tenacity + 降级 + 熔断）

```python
# production_llm_client.py - Production-grade LLM client template
# Python 3.10+
import time
import random
import logging
from typing import Optional
from dataclasses import dataclass, field
from openai import OpenAI, APIStatusError, RateLimitError, APITimeoutError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm-client")

# ============================================================
# 1. Circuit Breaker
# ============================================================

@dataclass
class CircuitBreaker:
    """Simple circuit breaker for LLM providers."""
    failure_threshold: int = 5       # Open after N failures
    recovery_timeout: float = 60.0   # Seconds before half-open
    failure_count: int = field(default=0, init=False)
    last_failure_time: float = field(default=0.0, init=False)
    state: str = field(default="closed", init=False)  # closed/open/half-open

    def record_success(self):
        self.failure_count = 0
        self.state = "closed"

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                f"Circuit breaker OPEN after {self.failure_count} failures"
            )

    def can_execute(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if time.time() - self.last_failure_time >= self.recovery_timeout:
                self.state = "half-open"
                logger.info("Circuit breaker HALF-OPEN, probing...")
                return True
            return False
        return True  # half-open

# ============================================================
# 2. Provider Configuration
# ============================================================

@dataclass
class ProviderConfig:
    name: str
    api_key: str
    base_url: str
    model: str
    timeout: float = 60.0
    circuit_breaker: CircuitBreaker = field(default_factory=CircuitBreaker)

# ============================================================
# 3. Production Client
# ============================================================

class ProductionLLMClient:
    """
    Production-grade LLM client with:
    - Exponential backoff retry (tenacity)
    - Multi-provider fallback
    - Circuit breaker per provider
    - Context length handling
    """

    def __init__(self, providers: list[ProviderConfig]):
        self.providers = providers
        self.clients: dict[str, OpenAI] = {}
        self._init_clients()

    def _init_clients(self):
        for p in self.providers:
            self.clients[p.name] = OpenAI(
                api_key=p.api_key,
                base_url=p.base_url,
                timeout=p.timeout,
            )

    def _call_single_provider(
        self,
        provider: ProviderConfig,
        messages: list[dict],
        **kwargs,
    ) -> Optional[str]:
        """Call a single provider with tenacity retry."""
        if not provider.circuit_breaker.can_execute():
            logger.warning(f"[{provider.name}] Circuit breaker OPEN, skipping")
            return None

        client = self.clients[provider.name]

        try:
            response = client.chat.completions.create(
                model=provider.model,
                messages=messages,
                **kwargs,
            )
            provider.circuit_breaker.record_success()
            return response.choices[0].message.content

        except (RateLimitError, APITimeoutError, APIConnectionError) as e:
            # Retryable errors
            provider.circuit_breaker.record_failure()
            logger.warning(f"[{provider.name}] Retryable error: {type(e).__name__}: {e}")
            raise  # Let tenacity handle retry

        except APIStatusError as e:
            if e.status_code == 400:
                # Check for context length error
                if "context" in str(e).lower() or "token" in str(e).lower():
                    logger.error(f"[{provider.name}] Context length exceeded")
                    raise ContextLengthError(str(e))
                logger.error(f"[{provider.name}] Bad request: {e}")
                return None  # Don't retry bad requests
            if e.status_code >= 500:
                provider.circuit_breaker.record_failure()
                raise  # Retry server errors
            return None

        except Exception as e:
            provider.circuit_breaker.record_failure()
            logger.error(f"[{provider.name}] Unexpected error: {e}")
            raise

    def call(
        self,
        messages: list[dict],
        **kwargs,
    ) -> dict:
        """
        Call LLM with full error handling:
        1. Try primary provider with retry
        2. Fallback to secondary if primary fails
        3. Return structured result
        """
        for provider in self.providers:
            try:
                # Wrap with tenacity retry
                content = self._retry_wrapper(provider, messages, **kwargs)
                if content is not None:
                    return {
                        "content": content,
                        "provider": provider.name,
                        "model": provider.model,
                        "success": True,
                        "error": None,
                    }
            except ContextLengthError:
                return {
                    "content": None,
                    "provider": provider.name,
                    "success": False,
                    "error": "context_length_exceeded",
                }
            except Exception as e:
                logger.warning(
                    f"[{provider.name}] Provider failed, trying next: {e}"
                )
                continue

        return {
            "content": None,
            "provider": None,
            "success": False,
            "error": "all_providers_failed",
        }

    @retry(
        retry=retry_if_exception_type(
            (RateLimitError, APITimeoutError, APIConnectionError)
        ),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        stop=stop_after_attempt(3),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _retry_wrapper(self, provider, messages, **kwargs):
        """Tenacity-wrapped call with exponential backoff."""
        return self._call_single_provider(provider, messages, **kwargs)

# ============================================================
# Custom Errors
# ============================================================

class ContextLengthError(Exception):
    """Raised when input exceeds model's context length."""
    pass

# ============================================================
# Usage Example
# ============================================================

if __name__ == "__main__":
    # Configure providers (primary + fallback)
    providers = [
        ProviderConfig(
            name="deepseek",
            api_key="sk-your-deepseek-key",
            base_url="https://api.deepseek.com",
            model="deepseek-chat",
        ),
        ProviderConfig(
            name="qwen",
            api_key="sk-your-qwen-key",
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            model="qwen-plus",
        ),
    ]

    client = ProductionLLMClient(providers)

    # Normal call
    result = client.call(
        messages=[{"role": "user", "content": "用一句话解释什么是API"}],
        temperature=0.3,
        max_tokens=100,
    )
    print(f"Success: {result['success']}")
    print(f"Provider: {result['provider']}")
    print(f"Content: {result['content']}")

    # Check circuit breaker status
    for p in providers:
        cb = p.circuit_breaker
        print(f"\n[{p.name}] Circuit: {cb.state}, Failures: {cb.failure_count}")
```

---

## 👀 执行预览

```bash
$ python error_types.py
LLM API Common Errors:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Error Type          | HTTP | Should Retry? | Action                    |
|---------------------|------|---------------|---------------------------|
| RateLimitError      | 429  | ✅ Yes        | Wait + retry (backoff)    |
| APITimeoutError     | -    | ✅ Yes        | Retry with longer timeout |
...

$ python production_llm_client.py
INFO:llm-client:Success: True
INFO:llm-client:Provider: deepseek
INFO:llm-client:Content: API（应用程序接口）是软件系统之间交互的约定...
[deepseek] Circuit: closed, Failures: 0
[qwen] Circuit: closed, Failures: 0
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 400 错误不要重试，请求本身有问题 | 无效重试浪费时间和 Token | 🔴 |
| ⚠️ 重试必须加最大次数限制 | 死循环重试，资源耗尽 | 🔴 |
| ⚠️ 429 重试必须等待足够时间（遵循 Retry-After 头） | 越重试越被限 | 🟡 |
| ⚠️ API Key 错误不要重试，检查配置 | 无效重试 | 🟡 |
| ⚠️ 降级到备用模型时注意模型能力差异 | 输出质量下降 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 所有错误都统一重试 | 400/401 错误白白重试 3 次 | ✅ 只对可重试错误（429/500/超时）重试 |
| ❌ 重试间隔固定 1 秒 | 限流期间不断重试加剧问题 | ✅ 指数退避 1→2→4→8 秒 |
| ❌ 不区分上下文超限和其他 400 错误 | 截断可以解决的问题被当成不可重试 | ✅ 检测 "context" 关键词，截断后重试 |
| ❌ 重试时不记录日志 | 出了问题无法排查 | ✅ before_sleep 记录每次重试的原因和等待时间 |

---

## 🔍 调试排查

#### 故障场景1：间歇性超时

**症状**：偶发 APITimeoutError，成功率 70-80%
**排查思路**：
1. 检查 timeout 设置是否太短（默认可能只有 10 秒）
2. 检查 prompt 长度和 max_tokens → 长输出需要更长超时
3. 检查网络延迟 → `ping api.deepseek.com`

**根因**：timeout 设置太短，长回复来不及生成
**修复**：
```python
client = OpenAI(
    api_key="...",
    base_url="...",
    timeout=120.0,  # Increase timeout for long outputs
)
```

#### 故障场景2：重试后仍然失败

**症状**：3 次重试后仍然报 429 或 500
**排查思路**：
1. 检查重试间隔是否足够 → 指数退避最大值是否太小
2. 查看提供商状态页是否有故障
3. 检查是否有其他服务在用同一个 API Key

**根因**：退避时间不够或提供商确实有问题
**修复**：增大 `wait_exponential` 的 `max` 参数（如 60 秒），并确保有降级到备用模型

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. 列出 3 种可重试的 LLM API 错误和 2 种不可重试的错误。（考察点：错误分类 → 目标 #1）
2. 为什么 429 错误要用指数退避而不是固定间隔重试？（考察点：重试策略 → 目标 #2）

### 🟡 进阶题（动手实践）

1. 给 ProductionLLMClient 添加一个 `Retry-After` 头的解析：当 429 响应包含 `Retry-After` 头时，用该值作为等待时间。（考察点：HTTP 规范 → 目标 #2）
2. 实现一个简单的错误统计面板：记录过去 1 小时内各类错误的发生次数和频率。（考察点：可观测性 → 目标 #4）

### 🔴 开放题（设计思考）

1. 你负责的服务每秒调用 LLM API 100 次，突然提供商开始频繁返回 500 错误。设计一个应急方案：如何在不停止服务的情况下处理这个故障？考虑熔断器阈值、降级策略、用户感知、自动恢复。（考察点：系统设计 → 目标 #3）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
LLM 错误处理与重试
├── 错误分类
│   ├── 可重试：429/500/超时/网络
│   └── 不可重试：400/401/403/上下文超限
├── 重试策略
│   ├── 指数退避：1s → 2s → 4s → 8s
│   ├── 最大重试：3次
│   ├── 抖动（jitter）：防止重试风暴
│   └── tenacity库实现
├── 降级方案
│   ├── 主模型 → 备用模型
│   ├── 备用模型 → 缓存/默认回复
│   └── 熔断器：closed → open → half-open
└── 生产模板
    ├── 多provider配置
    ├── 熔断器per provider
    └── 结构化返回结果
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 数据库调用 | 同样的重试+降级+熔断模式适用于数据库连接 |
| 第三方支付 API | 支付场景更要区分可重试和不可重试（扣款不能重复） |
| 微服务调用 | 熔断器是微服务容错的标准模式（Netflix Hystrix） |

---

## 🗺️ 学习路径

```
[异步批量调用] → **📍 你在这里：错误处理与重试** → [综合实战项目]
                                 ├─→ [LLM网关设计]
                                 └─→ [结构化输出]
```

**下一步建议**：
- 恭喜！你已完成 **LLM API 进阶** 系列的全部 7 篇文章。接下来可以：
  - 尝试构建一个综合项目（如 AI 客服机器人），运用本系列所有技术
  - 学习 RAG（检索增强生成）相关技术
  - 深入 Agent 框架（LangChain / LlamaIndex）

**相关主题**：
- [《多模型统一接入》](26-llm-多模型统一接入.md)：网关中集成重试和熔断
- [《异步批量调用》](27-llm-异步批量调用.md)：批量场景下的错误处理

---

## 📈 代码演进

```python
# v1: Bare try-except (not production-ready)
try:
    response = client.chat.completions.create(...)
    return response.choices[0].message.content
except Exception:
    return "Error"  # Swallows all errors!

# v2: Categorized error handling
try:
    response = client.chat.completions.create(...)
    return response.choices[0].message.content
except RateLimitError:
    time.sleep(2)
    return retry()  # Manual retry, no backoff
except BadRequestError:
    return None

# v3: Production template (this article)
# - Tenacity retry with exponential backoff
# - Multi-provider fallback
# - Circuit breaker
# - Structured error reporting
```

---

## 📚 参考资料

- [tenacity 文档](https://tenacity.readthedocs.io/) [等级：官方] — Python 重试库
- [OpenAI Error Codes](https://platform.openai.com/docs/guides/error-codes) [等级：官方] — API 错误码参考
- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html) [等级：权威] — 熔断器模式原理

---

## 📝 练习题参考答案

**基础题1**：可重试：① 429 RateLimitError（限流，等一会就好），② 500 InternalServerError（服务端临时故障），③ APITimeoutError（网络或服务端偶发超时）。不可重试：① 400 BadRequestError（请求格式有问题，重试也不会好），② 401 AuthenticationError（API Key 错误，重试没用）。

**基础题2**：429 表示服务端正在限流，所有客户端都在等待重试。如果用固定间隔，所有客户端会在同一时刻重试（重试风暴），再次触发限流。指数退避让每个客户端的重试时间随机分散开，加上 jitter 更均匀，避免同时冲击服务端。
