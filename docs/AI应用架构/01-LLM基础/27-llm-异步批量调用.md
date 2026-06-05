# LLM异步批量调用：高并发场景优化

> 分类：LLM API | 高并发 | 难度：⭐⭐⭐⭐ | 预估用时：50 分钟

---

## 🎯 学习目标

1. ✅ 解释异步并发调用 LLM 的必要性和核心原理（理解）
2. ✅ 使用 asyncio.gather + Semaphore 实现可控并发的批量调用（应用）
3. ✅ 实现异步重试和背压处理机制（应用）
4. ✅ 构建批量处理 1000 条文本的完整方案并对比串行 vs 并发性能（应用/分析）

---

## 📋 前置知识自检

1. **你了解 Python asyncio 的基本用法（async/await、事件循环）吗？**（答不上来？→ 先学 Python asyncio 入门）
2. **你知道 Semaphore（信号量）的作用吗？**（答不上来？→ 先补并发控制基础）
3. **你调用过 LLM API 并理解其基本参数吗？**（答不上来？→ 先学 [《国内大模型API对比》](25-llm-国内大模型API对比.md)）

---

## 💡 概念讲解

- **一句话定义**：异步批量调用是通过 asyncio 并发执行多个 LLM API 请求，大幅提升吞吐量的技术。
- **现实类比**：串行调用像在超市排队结账——10 个人排队 1 个收银台。异步并发像开了 5 个收银台同时结账——10 个人分到 5 个窗口，效率翻倍。但不能开太多窗口（并发数），否则服务器会限流。
- **技术场景**：批量文本分类、批量 embedding 生成、批量翻译、批量信息抽取等需要处理大量文本的场景。
- **⚠️ 常见误解**：很多人以为并发数越多越好。实际上 LLM API 有严格的 RPM（每分钟请求数）和 TPM（每分钟 Token 数）限制，并发过高会被限流甚至封号。合理的并发数通常在 5-20 之间。

---

## 🧠 实时脑图

```text
[1000条文本] 🔴
    || (分批处理)
    ↓
[批次1: 文本1-50] 🟡
[批次2: 文本51-100] 🟡
...
    || (每批内并发)
    ↓
[Semaphore(10)] 🔴 ← 控制最大并发数
    ||
    ↓ (asyncio.gather)
[10个并发请求] 🟡 ← 同时在途
    || (各自独立)
    ↓
[请求1 → 响应1] 🟢
[请求2 → 响应2] 🟢
...
    || (失败重试)
    ↓
[异步重试 × 3次] 🟡
    || (收集结果)
    ↓
[结果汇总] 🔴
    ||
    ↓ (性能对比)
[串行: ~5000s] 🔴 vs [并发: ~500s] 🟢 ← 约10x提速
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install openai asyncio tqdm`

### 示例1：串行 vs 并发性能对比

```python
# batch_benchmark.py - Serial vs Concurrent benchmark
# Python 3.10+
import asyncio
import time
import logging
from openai import AsyncOpenAI

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

async_client = AsyncOpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

# Sample texts for batch processing
SAMPLE_TEXTS = [f"请用一句话解释什么是{topic}" for topic in [
    "机器学习", "深度学习", "自然语言处理", "计算机视觉", "强化学习",
    "迁移学习", "生成对抗网络", "注意力机制", "Transformer", "BERT",
]]

async def single_call(text: str, semaphore: asyncio.Semaphore | None = None) -> dict:
    """Single async LLM call with optional semaphore control."""
    async def _call():
        response = await async_client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": text}],
            max_tokens=100,
            temperature=0.3,
        )
        return {
            "input": text,
            "output": response.choices[0].message.content,
            "tokens": response.usage.total_tokens,
        }

    if semaphore:
        async with semaphore:
            return await _call()
    return await _call()

# --- Serial execution ---
async def serial_batch(texts: list[str]) -> tuple[list[dict], float]:
    """Execute calls one by one."""
    results = []
    start = time.time()
    for text in texts:
        result = await single_call(text)
        results.append(result)
    elapsed = time.time() - start
    return results, elapsed

# --- Concurrent execution ---
async def concurrent_batch(
    texts: list[str],
    max_concurrency: int = 10,
) -> tuple[list[dict], float]:
    """Execute calls concurrently with semaphore."""
    semaphore = asyncio.Semaphore(max_concurrency)
    start = time.time()
    tasks = [single_call(text, semaphore) for text in texts]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    elapsed = time.time() - start

    # Handle exceptions
    final = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            final.append({"input": texts[i], "error": str(r)})
        else:
            final.append(r)

    return final, elapsed

# --- Run benchmark ---
async def main():
    print(f"Processing {len(SAMPLE_TEXTS)} texts...\n")

    # Serial
    serial_results, serial_time = await serial_batch(SAMPLE_TEXTS)
    print(f"Serial:   {serial_time:.2f}s ({len(serial_results)} calls)")
    print(f"  Avg per call: {serial_time/len(SAMPLE_TEXTS):.2f}s")

    # Concurrent (5)
    conc5_results, conc5_time = await concurrent_batch(SAMPLE_TEXTS, max_concurrency=5)
    print(f"Concurrent(5):  {conc5_time:.2f}s ({len(conc5_results)} calls)")
    print(f"  Speedup: {serial_time/conc5_time:.1f}x")

    # Concurrent (10)
    conc10_results, conc10_time = await concurrent_batch(SAMPLE_TEXTS, max_concurrency=10)
    print(f"Concurrent(10): {conc10_time:.2f}s ({len(conc10_results)} calls)")
    print(f"  Speedup: {serial_time/conc10_time:.1f}x")

    print(f"\nSample output: {serial_results[0]['output'][:50]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

### 示例2：生产级批量处理器（1000 条文本）

```python
# batch_processor.py - Production-grade batch processor
# Python 3.10+
import asyncio
import json
import time
import logging
from pathlib import Path
from dataclasses import dataclass, field, asdict
from openai import AsyncOpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("batch-processor")

async_client = AsyncOpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

# ============================================================
# Configuration
# ============================================================

@dataclass
class BatchConfig:
    """Batch processing configuration."""
    max_concurrency: int = 10       # Max concurrent requests
    max_retries: int = 3            # Max retries per item
    retry_delay: float = 1.0        # Base retry delay (exponential backoff)
    requests_per_minute: int = 50   # Rate limit target
    batch_size: int = 50            # Items per batch (for progress tracking)
    model: str = "deepseek-chat"
    max_tokens: int = 150
    temperature: float = 0.3

@dataclass
class BatchResult:
    """Result for a single item."""
    index: int
    input_text: str
    output_text: str | None = None
    error: str | None = None
    retries: int = 0
    latency_ms: float = 0

# ============================================================
# Core Processor
# ============================================================

class BatchProcessor:
    """Production-grade async batch processor with rate limiting."""

    def __init__(self, config: BatchConfig | None = None):
        self.config = config or BatchConfig()
        self.semaphore = asyncio.Semaphore(self.config.max_concurrency)
        self.results: list[BatchResult] = []
        self._request_timestamps: list[float] = []

    async def _rate_limit(self):
        """Simple rate limiter based on sliding window."""
        now = time.time()
        # Remove timestamps older than 60 seconds
        self._request_timestamps = [
            t for t in self._request_timestamps if now - t < 60
        ]
        if len(self._request_timestamps) >= self.config.requests_per_minute:
            # Wait until oldest request is > 60s ago
            wait_time = 60 - (now - self._request_timestamps[0]) + 0.1
            logger.warning(f"Rate limit approaching, waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        self._request_timestamps.append(time.time())

    async def _call_with_retry(self, text: str, index: int) -> BatchResult:
        """Single call with exponential backoff retry."""
        result = BatchResult(index=index, input_text=text)

        for attempt in range(self.config.max_retries + 1):
            try:
                async with self.semaphore:
                    await self._rate_limit()
                    start = time.time()

                    response = await async_client.chat.completions.create(
                        model=self.config.model,
                        messages=[{"role": "user", "content": text}],
                        max_tokens=self.config.max_tokens,
                        temperature=self.config.temperature,
                    )

                    result.output_text = response.choices[0].message.content
                    result.latency_ms = (time.time() - start) * 1000
                    return result

            except Exception as e:
                result.retries = attempt + 1
                if attempt < self.config.max_retries:
                    delay = self.config.retry_delay * (2 ** attempt)
                    logger.warning(
                        f"[{index}] Attempt {attempt+1} failed: {e}, "
                        f"retrying in {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
                else:
                    result.error = str(e)
                    logger.error(f"[{index}] All retries exhausted: {e}")

        return result

    async def process_batch(self, texts: list[str]) -> list[BatchResult]:
        """Process a batch of texts concurrently."""
        total = len(texts)
        logger.info(f"Starting batch: {total} texts, concurrency={self.config.max_concurrency}")

        start = time.time()
        tasks = [
            self._call_with_retry(text, i)
            for i, text in enumerate(texts)
        ]
        self.results = await asyncio.gather(*tasks)
        elapsed = time.time() - start

        # Stats
        success = sum(1 for r in self.results if r.output_text)
        failed = sum(1 for r in self.results if r.error)
        avg_latency = (
            sum(r.latency_ms for r in self.results if r.output_text) / max(1, success)
        )

        logger.info(
            f"Batch complete: {success}/{total} success, {failed} failed, "
            f"{elapsed:.1f}s total, avg {avg_latency:.0f}ms/call"
        )

        return list(self.results)

    def save_results(self, path: str):
        """Save results to JSON file."""
        data = [asdict(r) for r in self.results]
        Path(path).write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        logger.info(f"Results saved to {path}")

# ============================================================
# Generate sample data & run
# ============================================================

async def main():
    # Generate 100 sample texts
    topics = [
        "Python", "JavaScript", "Rust", "Docker", "Kubernetes",
        "微服务", "消息队列", "Redis", "PostgreSQL", "GraphQL",
        "React", "Vue", "TypeScript", "Nginx", "Linux",
    ]
    texts = []
    for i in range(100):
        topic = topics[i % len(topics)]
        texts.append(f"用一句话解释{topic}的核心概念")

    # Process
    config = BatchConfig(
        max_concurrency=10,
        max_retries=3,
        requests_per_minute=50,
    )
    processor = BatchProcessor(config)
    results = await processor.process_batch(texts)

    # Save
    processor.save_results("batch_results.json")

    # Print sample
    print("\n--- Sample Results ---")
    for r in results[:3]:
        status = "✅" if r.output_text else "❌"
        print(f"{status} [{r.index}] {r.input_text[:30]}...")
        if r.output_text:
            print(f"   → {r.output_text[:60]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 👀 执行预览

```bash
$ python batch_benchmark.py
Processing 10 texts...

Serial:   15.32s (10 calls)
  Avg per call: 1.53s
Concurrent(5):  3.41s (10 calls)
  Speedup: 4.5x
Concurrent(10): 1.87s (10 calls)
  Speedup: 8.2x

Sample output: 机器学习是一种让计算机通过数据自动学习和改进的技术...

$ python batch_processor.py
2026-06-05 09:30:00 [INFO] Starting batch: 100 texts, concurrency=10
2026-06-05 09:30:02 [WARNING] [15] Attempt 1 failed: Rate limit, retrying in 1.0s
...
2026-06-05 09:30:45 [INFO] Batch complete: 98/100 success, 2 failed, 45.2s total, avg 1250ms/call
2026-06-05 09:30:45 [INFO] Results saved to batch_results.json

--- Sample Results ---
✅ [0] 用一句话解释Python的核心概念...
   → Python是一种简洁易读的通用编程语言，以优雅的语法...
✅ [1] 用一句话解释JavaScript的核心概念...
   → JavaScript是一种运行在浏览器和服务端的动态脚本语言...
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 必须用 Semaphore 控制并发数 | 触发 API 限流，大量请求失败 | 🔴 |
| ⚠️ RPM 限制需要考虑，不能只看并发数 | 1 分钟内请求过多被拒 | 🔴 |
| ⚠️ asyncio.gather 的 return_exceptions=True 必须设置 | 一个失败全部失败 | 🔴 |
| ⚠️ 批量结果要检查 error 字段 | 静默丢失数据 | 🟡 |
| ⚠️ 重试延迟要用指数退避，不能用固定值 | 限流恢复不了 | 🟡 |
| ⚠️ 大批量任务建议分批 + 断点续传 | 中断后从头重来 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 并发数设为 100+ | 大量 429 Rate Limit 错误 | ✅ 并发数 5-20，配合 RPM 限流 |
| ❌ 不做错误隔离，一个异常导致全部中止 | asyncio.gather 抛异常，所有结果丢失 | ✅ `return_exceptions=True` |
| ❌ 重试不用退避，立即重试 | 限流期间越重试越被限 | ✅ 指数退避：1s → 2s → 4s |
| ❌ 不保存中间结果 | 程序中断后 1000 条全部重来 | ✅ 每批保存一次结果文件 |

---

## 🔍 调试排查

#### 故障场景1：大量 429 Rate Limit 错误

**症状**：日志中大量 "Rate limit exceeded"，成功率极低
**排查思路**：
1. 检查并发数 → 是否超过 20？
2. 计算 RPM → 并发数 × 平均 QPS 是否超过提供商限制？
3. 检查是否有其他程序也在用同一个 API Key

**根因**：总请求速率超过了 API Key 的 RPM 限制
**修复**：降低并发数，或增加 `_rate_limit()` 的等待时间

#### 故障场景2：并发没有加速效果

**症状**：并发执行时间和串行差不多
**排查思路**：
1. 检查是否真的在用 `asyncio.gather` → 不是在循环里 `await`
2. 检查 Semaphore 是否设置得太小（如 1）
3. 检查网络带宽是否成为瓶颈

**根因**：最常见的错误是在 for 循环里逐个 await，而不是用 gather
**修复**：
```python
# ❌ Wrong - still serial
for text in texts:
    result = await single_call(text)

# ✅ Correct - truly concurrent
results = await asyncio.gather(*[single_call(t) for t in texts])
```

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. 为什么不能把并发数设为 1000？（考察点：并发限制 → 目标 #1）
2. `asyncio.Semaphore(10)` 的作用是什么？（考察点：Semaphore → 目标 #2）

### 🟡 进阶题（动手实践）

1. 修改示例2，添加进度条显示（使用 tqdm），实时展示完成数量和成功率。（考察点：工程化 → 目标 #2）
2. 实现断点续传：如果中途失败，下次运行跳过已完成的条目。（考察点：容错 → 目标 #3）

### 🔴 开放题（设计思考）

1. 你需要每天处理 10 万条用户评论的情感分析。设计一个方案，考虑：成本控制、处理时间窗口（4 小时内完成）、失败重试、结果一致性。（考察点：系统设计 → 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
异步批量调用
├── 核心技术
│   ├── asyncio.gather（并发执行）
│   ├── asyncio.Semaphore（并发控制）
│   └── return_exceptions=True（错误隔离）
├── 性能对比
│   ├── 串行：N × 单次延迟
│   └── 并发：N/并发数 × 单次延迟 + 调度开销
├── 可靠性
│   ├── 指数退避重试
│   ├── RPM 限流
│   └── 断点续传
└── 生产要点
    ├── 中间结果持久化
    ├── 进度监控
    └── 结果校验
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 批量 Embedding 生成 | 同样模式，Embedding API 通常 RPM 更高，可以更大并发 |
| 批量翻译 | 文本分片后并发翻译，结果按序号重组 |
| 批量数据标注 | LLM 做 zero-shot 标注，并发处理，人工抽检质量 |

---

## 🗺️ 学习路径

```
[多模型统一接入] → **📍 你在这里：异步批量调用** → [LLM错误处理与重试]
                                  ├─→ [流式响应实战]
                                  └─→ [Token计算与成本]
```

**下一篇建议**：
- → [《LLM错误处理与重试策略》](28-llm-错误处理与重试策略.md)：批量调用中重试策略的深入设计
- → [《流式响应实战》](23-llm-流式响应实战.md)：结合异步流式实现批量场景的实时反馈

**相关主题**：
- [《多模型统一接入》](26-llm-多模型统一接入.md)：批量调用中多模型轮询降低单一提供商压力

---

## ⚡ 性能对比

| 方案 | 100条耗时 | 1000条耗时 | 成功率 | 适用场景 |
|------|-----------|------------|--------|----------|
| 串行 | ~150s | ~1500s | 99%+ | 少量、对延迟不敏感 |
| 并发(5) | ~35s | ~350s | 98%+ | 通用推荐 |
| 并发(10) | ~18s | ~180s | 95%+ | 批量处理 |
| 并发(10)+重试 | ~20s | ~200s | 99%+ | 生产推荐 |
| 并发(50) | ~8s | ~80s | 70%↓ | 会被限流，不推荐 |

**优化建议**：生产环境推荐并发 10 + 重试 + RPM 限流的组合方案。并发数不是越高越好，10-20 是大多数 API 的甜蜜区间。

---

## 📚 参考资料

- [Python asyncio 官方文档](https://docs.python.org/3/library/asyncio.html) [等级：官方] — 异步编程基础
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits) [等级：官方] — API 限流策略说明
- [asyncio.Semaphore](https://docs.python.org/3/library/asyncio-sync.html#semaphore) [等级：官方] — 并发控制原语

---

## 📝 练习题参考答案

**基础题1**：① API 有 RPM 限制，1000 并发会在瞬间触发限流，大量请求失败；② 每个并发连接占用内存和文件描述符；③ 即使不被限流，服务端也可能因为过载降低响应质量。

**基础题2**：Semaphore(10) 限制同时执行的任务数最多为 10 个。当第 11 个任务尝试执行时，它会在 `async with semaphore` 处等待，直到有任务完成释放信号量。这是控制并发数、避免压垮 API 的关键机制。
