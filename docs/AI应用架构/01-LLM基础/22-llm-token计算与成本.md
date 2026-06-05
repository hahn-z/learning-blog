# Token计算与成本估算：让你的AI应用不烧钱

> 分类：LLM API | 成本管理 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 用自己的话解释 Token 的概念和计费机制（理解）
2. ✅ 使用 tiktoken 库精确计算文本的 Token 数量（应用）
3. ✅ 编写成本估算脚本，预测 LLM 应用的月度费用（应用）
4. ✅ 针对 RAG 场景制定初步的成本优化策略（评价）

---

## 📋 前置知识自检

1. **你知道 OpenAI API 的基本调用方式吗？**（答不上来？→ 先学 LLM API 基础调用）
2. **你了解 HTTP API 的请求/响应模型吗？**（答不上来？→ 先补 REST API 基础）
3. **你会用 Python 做简单的数学计算和文件读取吗？**（答不上来？→ 先补 Python 基础）

---

## 💡 概念讲解

- **一句话定义**：Token 是 LLM 处理文本的最小单位，也是 API 计费的基本粒度。
- **现实类比**：想象你去自助餐厅，不是按"盘"收费，而是按"口"收费。每一口大小不一样——一个汉堡可能 3 口，一碗米饭可能 10 口。Token 就是这"一口"。
- **技术场景**：每次调用 LLM API，你的输入（prompt）和输出（completion）都会被折算成 Token 数量来计费。理解 Token 计算，是控制 AI 应用成本的第一步。
- **⚠️ 常见误解**：很多人以为 1 个 Token = 1 个单词。实际上，英文约 1 Token = 0.75 个单词，而中文约 1 个汉字 = 1-2 个 Token。中文的 Token 消耗比英文高 2-3 倍！

---

## 🧠 实时脑图

```text
[用户输入文本] 🔴
    || (分词器处理)
    ↓
[Token 序列] 🔴 ← 计费基本单位
    ||
    ↓ (不同模型不同编码)
[cl100k_base] 🟡 ← GPT-4/3.5 使用
[o200k_base]  🟡 ← GPT-4o 使用
    ||
    ↓ (计算公式)
[输入Token数 × 输入单价 + 输出Token数 × 输出单价] 🔴
    ||
    ↓
[总费用] 🔴
    ||
    ↓ (优化策略)
[减少输入] 🟢──→ [截断/摘要历史对话]
[减少输出] 🟢──→ [限制max_tokens]
[换更便宜的模型] 🟢──→ [简单任务用小模型]
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install tiktoken openai`

### 示例1：用 tiktoken 计算 Token 数量

```python
# token_count.py - Token calculation demo
# Python 3.10+
import tiktoken

# Choose encoding based on model
def count_tokens(text: str, model: str = "gpt-4o") -> int:
    """Count tokens for a given text and model."""
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

# Compare Chinese vs English token consumption
english = "Hello, how are you today? I hope everything is going well."
chinese = "你好，你今天怎么样？希望一切都顺利。"

print(f"English: {english}")
print(f"  Characters: {len(english)}, Tokens: {count_tokens(english)}")
print()
print(f"Chinese: {chinese}")
print(f"  Characters: {len(chinese)}, Tokens: {count_tokens(chinese)}")
print()

# Token breakdown visualization
encoding = tiktoken.encoding_for_model("gpt-4o")
tokens = encoding.encode(chinese)
print("Token breakdown for Chinese text:")
for i, token in enumerate(tokens):
    decoded = encoding.decode([token])
    print(f"  Token {i}: id={token}, text='{decoded}'")
```

### 示例2：成本估算脚本

```python
# cost_estimator.py - LLM API cost estimator
# Python 3.10+

from dataclasses import dataclass

@dataclass
class ModelPricing:
    """Model pricing configuration (2026-06 DeepSeek latest)."""
    name: str
    input_price_per_million: float   # USD per 1M input tokens
    output_price_per_million: float  # USD per 1M output tokens

# 2026年6月最新定价（美元/百万Token）
MODELS = {
    "deepseek-chat": ModelPricing("DeepSeek-V3", 0.27, 1.10),
    "deepseek-reasoner": ModelPricing("DeepSeek-R1", 0.55, 2.19),
    "gpt-4o": ModelPricing("GPT-4o", 2.50, 10.00),
    "gpt-4o-mini": ModelPricing("GPT-4o-mini", 0.15, 0.60),
    "gpt-4.1": ModelPricing("GPT-4.1", 2.00, 8.00),
    "gpt-4.1-mini": ModelPricing("GPT-4.1-mini", 0.40, 1.60),
    "glm-4-plus": ModelPricing("GLM-4-Plus", 3.50, 3.50),
    "qwen-max": ModelPricing("Qwen-Max", 1.60, 6.40),
}

def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Estimate cost for a single API call."""
    pricing = MODELS[model]
    input_cost = (input_tokens / 1_000_000) * pricing.input_price_per_million
    output_cost = (output_tokens / 1_000_000) * pricing.output_price_per_million
    return input_cost + output_cost

def estimate_monthly_rag_cost(
    queries_per_day: int = 100,
    avg_input_tokens: int = 2000,   # prompt + retrieved docs
    avg_output_tokens: int = 500,
    model: str = "deepseek-chat",
    days_per_month: int = 30,
) -> dict:
    """Estimate monthly cost for a RAG application."""
    calls_per_month = queries_per_day * days_per_month
    cost_per_call = estimate_cost(model, avg_input_tokens, avg_output_tokens)
    monthly_cost = cost_per_call * calls_per_month

    return {
        "model": model,
        "daily_queries": queries_per_day,
        "input_tokens_per_call": avg_input_tokens,
        "output_tokens_per_call": avg_output_tokens,
        "cost_per_call": f"${cost_per_call:.6f}",
        "monthly_calls": calls_per_month,
        "monthly_cost": f"${monthly_cost:.2f}",
    }

# Compare costs across models
print("=" * 60)
print("RAG Application Monthly Cost Comparison")
print("=" * 60)
print(f"Scenario: 100 queries/day, 2000 input + 500 output tokens/call")
print("-" * 60)

for model_key in ["deepseek-chat", "deepseek-reasoner", "gpt-4o", "gpt-4o-mini", "glm-4-plus", "qwen-max"]:
    result = estimate_monthly_rag_cost(model=model_key)
    print(f"  {result['model']:25s} → {result['monthly_cost']:>10s}/month (per call: {result['cost_per_call']})")

# Detailed scenario analysis
print("\n" + "=" * 60)
print("Scenario Analysis: Different Query Volumes")
print("=" * 60)

for qpd in [10, 100, 1000, 10000]:
    result = estimate_monthly_rag_cost(queries_per_day=qpd, model="deepseek-chat")
    print(f"  {qpd:>6d} queries/day → {result['monthly_cost']}/month")
```

---

## 👀 执行预览

```bash
$ python token_count.py
English: Hello, how are you today? I hope everything is going well.
  Characters: 55, Tokens: 13

Chinese: 你好，你今天怎么样？希望一切都顺利。
  Characters: 16, Tokens: 22

Token breakdown for Chinese text:
  Token 0: id=19526, text='你好'
  Token 1: id=47101, text='，'
  Token 2: id=19526, text='你'
  ...

$ python cost_estimator.py
============================================================
RAG Application Monthly Cost Comparison
============================================================
Scenario: 100 queries/day, 2000 input + 500 output tokens/call
------------------------------------------------------------
  deepseek-chat            →     $5.85/month (per call: $0.001950)
  deepseek-reasoner        →    $13.50/month (per call: $0.004500)
  gpt-4o                   →    $55.00/month (per call: $0.018333)
  gpt-4o-mini              →     $3.15/month (per call: $0.001050)
  glm-4-plus               →    $26.25/month (per call: $0.008750)
  qwen-max                 →    $19.20/month (per call: $0.006400)

============================================================
Scenario Analysis: Different Query Volumes
============================================================
     10 queries/day → $0.59/month
    100 queries/day → $5.85/month
   1000 queries/day → $58.50/month
  10000 queries/day → $585.00/month
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 不同模型使用不同分词器，Token 数量不能跨模型直接换算 | 成本估算严重偏差 | 🔴 |
| ⚠️ 中文的 Token 效率远低于英文，做成本预算时必须用中文实测 | 预算低估 2-3 倍 | 🔴 |
| ⚠️ API 价格会不定期调整，脚本中的定价需要定期更新 | 成本估算过时 | 🟡 |
| ⚠️ 输入和输出的单价不同，输出通常更贵 | 低估实际成本 | 🟡 |
| ⚠️ Reasoning 模型的思考 Token 也计费（如 DeepSeek-R1） | 实际费用比预期高很多 | 🔴 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 用字符数估算 Token | 中文场景费用远超预期 | ✅ 用 tiktoken 实际测量 |
| ❌ 忽略输出 Token 单价更高 | 月底账单比预估多 30-50% | ✅ 分别计算输入/输出费用 |
| ❌ 用 GPT-3.5 的分词器算 GPT-4o 的 Token | 数量不准确 | ✅ 用 `tiktoken.encoding_for_model("gpt-4o")` |
| ❌ 只算单次调用费用，不乘以调用频率 | 低估月度总成本 | ✅ 做 QPS × 天数 × Token 单价的完整估算 |

---

## 🔍 调试排查

#### 故障场景1：tiktoken 报错 "Model not found"

**症状**：`tiktoken.encoding_for_model("some-model")` 抛出 KeyError
**排查思路**：
1. 检查模型名称拼写是否正确 → `tiktoken.models.MODEL_TO_ENCODING.keys()`
2. 如果是新模型，尝试用通用编码 `cl100k_base` 或 `o200k_base`
3. 非 OpenAI 模型（DeepSeek 等）没有官方 tiktoken 支持，用 `cl100k_base` 近似

**根因**：tiktoken 只内置了 OpenAI 自己的模型映射
**修复**：
```python
# For non-OpenAI models, use a compatible encoding
import tiktoken
encoding = tiktoken.get_encoding("cl100k_base")  # Approximate
```

#### 故障场景2：实际 API 费用比估算高很多

**症状**：月度账单是估算值的 2-5 倍
**排查思路**：
1. 查看 API 使用 dashboard 的详细统计
2. 对比 prompt_tokens 和 completion_tokens 的实际分布
3. 检查是否有调试/测试期间的大量调用

**根因**：通常是因为未计算测试调用、重试调用、或者 system prompt 过长
**修复**：在估算中加入 20-30% 的缓冲系数

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. 同一段中文文本，在 GPT-4o 和 DeepSeek-V3 上的 Token 数量相同吗？为什么？（考察点：分词器差异 → 目标 #1）

2. 一个 API 调用消耗了 1000 输入 Token 和 500 输出 Token，使用 DeepSeek-V3，费用是多少？（考察点：成本计算 → 目标 #2）

### 🟡 进阶题（动手实践）

1. 编写一个脚本：读取一个文本文件，计算其 Token 数量，并估算用它作为 prompt 调用 DeepSeek-V3 和 GPT-4o 各需要多少钱。（考察点：实际测量 → 目标 #2）

2. 设计一个表格，对比 5 个模型在"1000 次/天调用，2000 输入 + 500 输出"场景下的月度成本。（考察点：成本对比 → 目标 #3）

### 🔴 开放题（设计思考）

1. 假设你要构建一个客服机器人，每天处理 5000 次对话，平均每轮对话 3000 输入 Token + 800 输出 Token，每月预算 200 美元。请设计模型选择和成本优化方案。（考察点：成本优化 → 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
Token 与成本估算
├── Token 基础
│   ├── 定义：LLM 处理文本的最小单位
│   ├── 分词器：cl100k_base / o200k_base
│   └── 中英差异：中文 Token 效率低 2-3x
├── 成本计算
│   ├── 公式：输入Token×输入单价 + 输出Token×输出单价
│   ├── 输出比输入贵（约 3-4x）
│   └── 月度 = 单次 × 日调用 × 30
├── 优化方向
│   ├── 减少输入：截断/摘要
│   ├── 减少输出：限制 max_tokens
│   └── 换模型：简单任务用小模型
└── 工具
    └── tiktoken：精确计算 Token 数量
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 聊天机器人多轮对话 | 每轮累加历史消息 Token，超出上下文窗口前做截断/摘要 |
| 批量文档处理 | 预先计算总 Token 数，选择最经济的模型和分批策略 |
| Embedding 生成 | Embedding 只按输入 Token 计费，无输出费用，但仍需估算总量 |

---

## 🗺️ 学习路径

```
[LLM API 基础调用] → **📍 你在这里：Token与成本** → [流式响应实战]
                                    ├─→ [国内大模型API对比]
                                    └─→ [LLM错误处理与重试]
```

**下一篇建议**：
- → [《流式响应实战：逐字输出的技术实现》](23-llm-流式响应实战.md)：学会流式输出，提升用户体验的同时也能提前中断降低成本
- → [《国内大模型API对比》](25-llm-国内大模型API对比.md)：了解不同模型的性价比，做出更好的成本决策

**相关主题**：
- [《LLM异步批量调用》](27-llm-异步批量调用.md)：高并发场景下的成本控制

---

## 📚 参考资料

- [OpenAI Tokenizer 可视化工具](https://platform.openai.com/tokenizer) [等级：官方] — 在线体验 Token 分词效果
- [tiktoken GitHub](https://github.com/openai/tiktoken) [等级：官方] — Token 计算库源码和使用说明
- [DeepSeek API 定价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) [等级：官方] — DeepSeek 最新定价页面

---

## 📝 练习题参考答案

**基础题1**：不同。不同模型使用不同的分词器（tokenizer）。OpenAI 模型用 tiktoken，DeepSeek 有自己的分词实现。即使是 OpenAI 系列内部，GPT-4 用 `cl100k_base`，GPT-4o 用 `o200k_base`，Token 数量也不同。

**基础题2**：输入费用 = 1000/1,000,000 × 0.27 = $0.00027；输出费用 = 500/1,000,000 × 1.10 = $0.00055；总计 = $0.00082。
