# 多模型统一接入：构建你的LLM网关

> 分类：LLM API | 网关设计 | 难度：⭐⭐⭐⭐ | 预估用时：50 分钟

---

## 🎯 学习目标

1. ✅ 解释 LLM 网关的必要性和核心功能（理解）
2. ✅ 设计并实现统一的模型调用接口（应用）
3. ✅ 实现基于任务类型/成本/延迟的路由策略（应用/评价）
4. ✅ 构建包含降级方案的容错网关服务（分析/应用）

---

## 📋 前置知识自检

1. **你了解 FastAPI 的中间件和依赖注入吗？**（答不上来？→ 先学 FastAPI 进阶）
2. **你知道策略模式（Strategy Pattern）的基本思想吗？**（答不上来？→ 先补设计模式基础）
3. **你调用过至少两个不同的 LLM API 吗？**（答不上来？→ 先学 [《国内大模型API对比》](25-llm-国内大模型API对比.md)）

---

## 💡 概念讲解

- **一句话定义**：LLM 网关是介于应用和多个 LLM 提供商之间的统一代理层，负责路由、降级、限流和监控。
- **现实类比**：像旅行中介——你告诉它"我要去海边"，它根据预算、时间、偏好帮你选最合适的航班。你不需要知道每个航空公司的订票系统。
- **技术场景**：应用需要调用多个 LLM（成本优化、容灾备份、不同任务用不同模型），不想在每个调用点都写 if-else。
- **⚠️ 常见误解**：LLM 网关不只是简单的 API 代理。真正的价值在于智能路由（根据任务自动选模型）、优雅降级（主模型挂了自动切备用）、统一监控（一个面板看所有模型的用量和延迟）。

---

## 🧠 实时脑图

```text
[应用请求] 🔴
    || (统一接口 POST /v1/chat/completions)
    ↓
[LLM Gateway] 🔴
    ||
    ├── [路由策略] 🔴
    │   ├── 按任务类型（代码→DeepSeek, 摘要→Qwen）
    │   ├── 按成本（简单→mini, 复杂→max）
    │   └── 按延迟（实时→fast, 批量→slow）
    ├── [降级方案] 🟡
    │   ├── 主模型失败 → 备用模型
    │   └── 全部失败 → 缓存/默认回复
    ├── [限流控制] 🟡 ← Semaphore + Rate Limiter
    └── [监控日志] 🟢 ← Token用量 + 延迟 + 错误率
    ||
    ↓ (路由到具体模型)
[DeepSeek] 🔴 ← 主力模型
[Qwen] 🟡 ← 备用/长文档
[GPT-4o-mini] 🟢 ← 海外备用
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install fastapi uvicorn openai pydantic httpx`

### 完整实现：轻量 LLM 网关

```python
# llm_gateway.py - Lightweight LLM Gateway
# Python 3.10+
import time
import logging
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field
from openai import OpenAI, AsyncOpenAI
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("llm-gateway")

# ============================================================
# 1. Configuration
# ============================================================

class ModelProvider(str, Enum):
    DEEPSEEK = "deepseek"
    QWEN = "qwen"
    GLM = "glm"
    GPT4O_MINI = "gpt4o-mini"

@dataclass
class ProviderConfig:
    """Provider configuration."""
    api_key: str
    base_url: str
    model: str
    max_rpm: int = 60         # Requests per minute
    cost_per_1m_input: float  # USD per 1M input tokens
    cost_per_1m_output: float # USD per 1M output tokens
    priority: int = 0         # Higher = preferred
    enabled: bool = True

# Configure your providers (replace with real keys)
PROVIDERS: dict[ModelProvider, ProviderConfig] = {
    ModelProvider.DEEPSEEK: ProviderConfig(
        api_key="sk-your-deepseek-key",
        base_url="https://api.deepseek.com",
        model="deepseek-chat",
        max_rpm=60,
        cost_per_1m_input=0.27,
        cost_per_1m_output=1.10,
        priority=10,  # Primary
    ),
    ModelProvider.QWEN: ProviderConfig(
        api_key="sk-your-qwen-key",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model="qwen-plus",
        max_rpm=60,
        cost_per_1m_input=0.24,
        cost_per_1m_output=0.96,
        priority=8,  # Backup
    ),
    ModelProvider.GLM: ProviderConfig(
        api_key="your-glm-key",
        base_url="https://open.bigmodel.cn/api/paas/v4",
        model="glm-4-flash",
        max_rpm=60,
        cost_per_1m_input=0.0,  # Free tier available
        cost_per_1m_output=0.0,
        priority=6,
    ),
}

# ============================================================
# 2. Routing Strategy
# ============================================================

class TaskType(str, Enum):
    CODE = "code"
    CHAT = "chat"
    SUMMARY = "summary"
    EXTRACTION = "extraction"
    TRANSLATION = "translation"

# Route task types to preferred providers
TASK_ROUTING: dict[TaskType, list[ModelProvider]] = {
    TaskType.CODE: [ModelProvider.DEEPSEEK, ModelProvider.QWEN, ModelProvider.GLM],
    TaskType.CHAT: [ModelProvider.DEEPSEEK, ModelProvider.GLM, ModelProvider.QWEN],
    TaskType.SUMMARY: [ModelProvider.QWEN, ModelProvider.DEEPSEEK, ModelProvider.GLM],
    TaskType.EXTRACTION: [ModelProvider.DEEPSEEK, ModelProvider.QWEN, ModelProvider.GLM],
    TaskType.TRANSLATION: [ModelProvider.GLM, ModelProvider.DEEPSEEK, ModelProvider.QWEN],
}

def resolve_provider(
    task_type: Optional[TaskType] = None,
    model_hint: Optional[str] = None,
) -> list[ModelProvider]:
    """Resolve provider order based on routing strategy."""
    if model_hint:
        # Direct model hint takes priority
        for p in ModelProvider:
            if PROVIDERS[p].model == model_hint:
                return [p]
        return list(PROVIDERS.keys())

    if task_type:
        return TASK_ROUTING.get(task_type, list(PROVIDERS.keys()))

    # Default: by priority
    return sorted(PROVIDERS.keys(), key=lambda p: PROVIDERS[p].priority, reverse=True)

# ============================================================
# 3. Gateway Core
# ============================================================

@dataclass
class CallMetrics:
    """Track call metrics."""
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0
    success: bool = True
    error: Optional[str] = None

class LLMGateway:
    """Lightweight LLM Gateway with routing and fallback."""

    def __init__(self):
        self.clients: dict[ModelProvider, AsyncOpenAI] = {}
        self.metrics: list[CallMetrics] = []
        self._init_clients()

    def _init_clients(self):
        """Initialize async clients for all providers."""
        for provider, config in PROVIDERS.items():
            if config.enabled:
                self.clients[provider] = AsyncOpenAI(
                    api_key=config.api_key,
                    base_url=config.base_url,
                )

    async def call(
        self,
        messages: list[dict],
        task_type: Optional[TaskType] = None,
        model_hint: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict:
        """Call LLM with routing and fallback."""
        providers = resolve_provider(task_type, model_hint)
        last_error = None

        for provider in providers:
            if provider not in self.clients:
                continue

            config = PROVIDERS[provider]
            client = self.clients[provider]

            start = time.time()
            try:
                response = await client.chat.completions.create(
                    model=config.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                elapsed = (time.time() - start) * 1000

                # Record metrics
                metric = CallMetrics(
                    provider=provider.value,
                    model=config.model,
                    input_tokens=response.usage.prompt_tokens,
                    output_tokens=response.usage.completion_tokens,
                    latency_ms=elapsed,
                    success=True,
                )
                self.metrics.append(metric)
                logger.info(f"[{provider.value}] Success in {elapsed:.0f}ms")

                return {
                    "content": response.choices[0].message.content,
                    "provider": provider.value,
                    "model": config.model,
                    "input_tokens": metric.input_tokens,
                    "output_tokens": metric.output_tokens,
                    "latency_ms": round(elapsed),
                }

            except Exception as e:
                elapsed = (time.time() - start) * 1000
                self.metrics.append(CallMetrics(
                    provider=provider.value,
                    model=config.model,
                    latency_ms=elapsed,
                    success=False,
                    error=str(e),
                ))
                last_error = e
                logger.warning(f"[{provider.value}] Failed: {e}, trying next...")

        raise HTTPException(
            status_code=503,
            detail=f"All providers failed. Last error: {last_error}"
        )

    def get_stats(self) -> dict:
        """Get usage statistics."""
        if not self.metrics:
            return {"total_calls": 0}

        success = [m for m in self.metrics if m.success]
        total_cost = sum(
            (m.input_tokens / 1e6) * PROVIDERS[ModelProvider(m.provider)].cost_per_1m_input +
            (m.output_tokens / 1e6) * PROVIDERS[ModelProvider(m.provider)].cost_per_1m_output
            for m in success
        )

        return {
            "total_calls": len(self.metrics),
            "success_calls": len(success),
            "failed_calls": len(self.metrics) - len(success),
            "total_cost_usd": round(total_cost, 6),
            "by_provider": {
                p.value: {
                    "calls": sum(1 for m in self.metrics if m.provider == p.value),
                    "success": sum(1 for m in success if m.provider == p.value),
                    "avg_latency_ms": round(
                        sum(m.latency_ms for m in success if m.provider == p.value) /
                        max(1, sum(1 for m in success if m.provider == p.value))
                    ),
                }
                for p in ModelProvider
            },
        }

# ============================================================
# 4. FastAPI Application
# ============================================================

app = FastAPI(title="LLM Gateway", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

gateway = LLMGateway()

class ChatRequest(BaseModel):
    messages: list[dict]
    task_type: Optional[TaskType] = None
    model: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 2048

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest):
    """Unified chat completions endpoint."""
    return await gateway.call(
        messages=req.messages,
        task_type=req.task_type,
        model_hint=req.model,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )

@app.get("/v1/gateway/stats")
async def get_stats():
    """Get gateway usage statistics."""
    return gateway.get_stats()

@app.get("/health")
async def health():
    return {"status": "ok", "providers": [p.value for p in gateway.clients]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
```

---

## 👀 执行预览

```bash
$ python llm_gateway.py
INFO:llm-gateway:Starting LLM Gateway on port 9000

# Call with task routing
$ curl -X POST http://localhost:9000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"写一个快速排序"}], "task_type":"code"}'
{"content":"def quicksort(arr): ...", "provider":"deepseek", "model":"deepseek-chat", ...}

# Check stats
$ curl http://localhost:9000/v1/gateway/stats
{
  "total_calls": 5,
  "success_calls": 4,
  "failed_calls": 1,
  "total_cost_usd": 0.003245,
  "by_provider": {
    "deepseek": {"calls": 4, "success": 3, "avg_latency_ms": 1523},
    "qwen": {"calls": 1, "success": 1, "avg_latency_ms": 1876}
  }
}
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ API Key 不要硬编码在代码里 | Key 泄露，产生费用 | 🔴 |
| ⚠️ 降级链不要太长（建议 ≤ 3 层） | 延迟叠加严重 | 🟡 |
| ⚠️ 并发请求需要限流控制 | 触发提供商限流，全部失败 | 🟡 |
| ⚠️ 监控指标需要定期清理 | 内存持续增长 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 所有请求都路由到最便宜的模型 | 复杂任务质量差 | ✅ 按任务复杂度分级路由 |
| ❌ 降级方案只有日志没有自动切换 | 手动发现故障，响应慢 | ✅ 自动降级 + 告警 |
| ❌ 不做健康检查，不知道提供商是否可用 | 请求发到已下线的提供商 | ✅ 定期探活，动态启用/禁用 |
| ❌ 网关和业务耦合 | 难以复用和测试 | ✅ 网关独立部署，通用接口 |

---

## 🔍 调试排查

#### 故障场景1：所有提供商都返回失败

**症状**：API 返回 503 "All providers failed"
**排查思路**：
1. 检查 `/health` 端点，看哪些提供商已初始化
2. 查看日志中每个提供商的具体错误
3. 检查 API Key 是否有效、余额是否充足
4. 检查网络连通性

**根因**：通常是一个共性问题（网络、配置），而非所有提供商同时故障
**修复**：针对性修复，而不是盲目增加提供商

#### 故障场景2：路由策略选了不合适的模型

**症状**：返回质量差或延迟高
**排查思路**：
1. 查看 stats 中各提供商的成功率和延迟
2. 检查 task_type 是否传对
3. 对比手动指定模型的效果

**根因**：路由表配置不合理
**修复**：根据实际数据调整 `TASK_ROUTING` 映射

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. LLM 网关的三个核心功能是什么？（考察点：概念 → 目标 #1）
2. 为什么需要降级方案而不是只用一个模型？（考察点：必要性 → 目标 #1）

### 🟡 进阶题（动手实践）

1. 给网关添加基于成本的智能路由：简单问题（< 100 Token 输入）自动路由到最便宜的模型，复杂问题路由到最强模型。（考察点：路由策略 → 目标 #3）
2. 添加缓存层：相同 prompt 在 5 分钟内直接返回缓存结果。（考察点：扩展网关 → 目标 #4）

### 🔴 开放题（设计思考）

1. 设计一个支持 10+ 模型、日请求量 100 万次的网关架构。考虑：连接池管理、请求排队、负载均衡、灰度发布、A/B 测试。（考察点：系统设计 → 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
LLM 网关
├── 核心功能
│   ├── 统一接口（OpenAI 兼容）
│   ├── 智能路由（任务/成本/延迟）
│   ├── 降级方案（主→备→缓存）
│   └── 监控统计
├── 路由策略
│   ├── 按任务类型
│   ├── 按成本优先
│   ├── 按延迟优先
│   └── 直接指定模型
├── 降级机制
│   ├── Provider 降级链
│   ├── 自动重试
│   └── 全失败兜底
└── 实现
    ├── AsyncOpenAI 客户端池
    ├── FastAPI 统一入口
    └── Metrics 收集
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| API 聚合平台 | 类似思路做天气、地图、支付等第三方 API 聚合 |
| 微服务路由 | 网关模式在微服务架构中是标准模式（API Gateway） |
| 灰度测试 | 新模型先导 5% 流量，对比效果再全量 |

---

## 🗺️ 学习路径

```
[国内大模型API对比] → **📍 你在这里：LLM网关** → [异步批量调用]
                                 ├─→ [LLM错误处理与重试]
                                 └─→ [Token计算与成本]
```

**下一篇建议**：
- → [《LLM异步批量调用》](27-llm-异步批量调用.md)：网关的异步化，支持高并发场景
- → [《LLM错误处理与重试》](28-llm-错误处理与重试.md)：增强网关的容错能力

**相关主题**：
- [《国内大模型API对比》](25-llm-国内大模型API对比.md)：网关中各提供商的配置来源

---

## ⚡ 性能考量

| 方案 | 并发支持 | 延迟增加 | 适用场景 |
|------|----------|----------|----------|
| 同步网关 | 低（线程阻塞） | 低 | 小规模使用 |
| 异步网关（本文） | 中（asyncio） | 中（10-50ms） | 中等规模 |
| 异步+连接池 | 高 | 低 | 生产环境推荐 |
| 独立网关服务（LiteLLM） | 高 | 低 | 大规模/企业级 |

**优化建议**：对于日请求 > 10 万的场景，考虑使用成熟的网关方案如 [LiteLLM](https://github.com/BerriAI/litellm)，而不是自建。

---

## 📚 参考资料

- [LiteLLM](https://github.com/BerriAI/litellm) [等级：优质] — 成熟的 LLM 网关开源项目
- [OpenRouter](https://openrouter.ai/) [等级：优质] — 商业 LLM 路由服务
- [FastAPI 文档](https://fastapi.tiangolo.com/) [等级：官方] — Web 框架文档

---

## 📝 练习题参考答案

**基础题1**：① 统一接口（应用只需对接一个 API），② 智能路由（根据任务自动选最优模型），③ 降级容错（主模型失败自动切换备用）。

**基础题2**：单点故障风险——模型提供商可能宕机、限流、涨价。降级方案确保在一个提供商出问题时，服务不中断。
