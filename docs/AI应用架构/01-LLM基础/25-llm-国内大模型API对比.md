# 国内大模型API对比：DeepSeek、GLM、Qwen接入指南

> 分类：LLM API | 国内模型 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 列举国内主流 LLM API 的特点和定位（记忆/理解）
2. ✅ 使用 OpenAI 兼容格式调用 DeepSeek、GLM、Qwen、Kimi（应用）
3. ✅ 根据场景需求选择合适的模型并说明理由（评价）
4. ✅ 编写兼容多模型的统一调用代码（应用）

---

## 📋 前置知识自检

1. **你知道 OpenAI API 的调用格式（messages、model、temperature）吗？**（答不上来？→ 先学 LLM API 基础）
2. **你了解 API Key 的获取和安全管理方式吗？**（答不上来？→ 先补 API 安全基础）
3. **你能区分 chat completion 和 text completion 接口吗？**（答不上来？→ 先学 API 基础概念）

---

## 💡 概念讲解

- **一句话定义**：国内大模型 API 是国产 LLM 提供的云端推理服务，多数兼容 OpenAI 格式。
- **现实类比**：就像手机支付——支付宝和微信都能扫码付款，接口相似但各家有特色功能。国产 LLM API 也是如此，调用方式接近但能力侧重点不同。
- **技术场景**：国内项目部署快（无需翻墙）、中文能力强、价格有竞争力、数据合规。
- **⚠️ 常见误解**：有人以为国产模型全面不如 GPT-4。实际上在中文理解、代码、数学等特定场景下，部分国产模型已经接近甚至超越 GPT-4 水平，而且成本只有其 1/10。

---

## 🧠 实时脑图

```text
[国内LLM API生态] 🔴
    ||
    ├── DeepSeek 🔴 ← 性价比之王，代码/推理强
    │   ├── deepseek-chat (V3)
    │   └── deepseek-reasoner (R1)
    ├── 智谱 GLM 🟡 ← 学术背景，综合能力强
    │   ├── glm-4-plus
    │   └── glm-4-flash (免费额度)
    ├── 通义千问 Qwen 🟡 ← 阿里系，生态丰富
    │   ├── qwen-max
    │   └── qwen-plus
    └── Kimi (月之暗面) 🟢 ← 长上下文特长
        └── moonshot-v1-128k
    ||
    ↓ (共同特点)
[OpenAI 兼容格式] 🔴 ← base_url 不同，SDK相同
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install openai`

### 示例1：统一接口调用四大模型

```python
# china_llm_compare.py - Unified API call for Chinese LLMs
# Python 3.10+
from openai import OpenAI
import time

# API configurations (fill in your own keys)
PROVIDERS = {
    "DeepSeek": {
        "api_key": "sk-your-deepseek-key",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
    },
    "GLM": {
        "api_key": "your-zhipu-key.zhipu",  # Note: GLM uses different key format
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
    },
    "Qwen": {
        "api_key": "sk-your-qwen-key",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    "Kimi": {
        "api_key": "sk-your-kimi-key",
        "base_url": "https://api.moonshot.cn/v1",
        "model": "moonshot-v1-8k",
    },
}

def call_provider(name: str, prompt: str) -> dict:
    """Call a provider using OpenAI-compatible format."""
    config = PROVIDERS[name]
    client = OpenAI(
        api_key=config["api_key"],
        base_url=config["base_url"],
    )

    start = time.time()
    response = client.chat.completions.create(
        model=config["model"],
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    elapsed = time.time() - start

    return {
        "provider": name,
        "model": config["model"],
        "content": response.choices[0].message.content,
        "tokens_in": response.usage.prompt_tokens,
        "tokens_out": response.usage.completion_tokens,
        "latency": f"{elapsed:.2f}s",
    }

# Run comparison
prompt = "请用一句话解释什么是量子纠缠，要求准确且通俗易懂。"

print(f"Prompt: {prompt}\n")
print("=" * 70)

results = []
for name in PROVIDERS:
    try:
        result = call_provider(name, prompt)
        results.append(result)
        print(f"\n{'='*70}")
        print(f"Provider: {result['provider']} ({result['model']})")
        print(f"Response: {result['content']}")
        print(f"Tokens: {result['tokens_in']} in + {result['tokens_out']} out | Latency: {result['latency']}")
    except Exception as e:
        print(f"\n{name}: ❌ Error - {e}")

# Summary table
print(f"\n{'='*70}")
print("Summary:")
print(f"{'Provider':<12} {'Tokens In':>10} {'Tokens Out':>10} {'Latency':>10}")
print("-" * 45)
for r in results:
    print(f"{r['provider']:<12} {r['tokens_in']:>10} {r['tokens_out']:>10} {r['latency']:>10}")
```

### 示例2：注册与获取 Key 快速指南

```python
# quick_start_guide.py - Quick start for each provider
# This is a reference guide, not runnable code

GUIDE = """
=== 国内大模型 API 注册指南 ===

1. DeepSeek
   - 注册：https://platform.deepseek.com/
   - 充值：支持支付宝/微信，最低 10 元
   - 价格：V3 输入 ¥2/百万Token，输出 ¥8/百万Token
   - 特点：性价比最高，代码/推理能力强
   - Key 格式：sk-xxxxxxxx

2. 智谱 GLM (BigModel)
   - 注册：https://open.bigmodel.cn/
   - 新用户赠送 tokens 额度
   - glm-4-flash 有免费调用额度
   - 特点：学术背景，综合能力强，工具调用支持好
   - Key 格式：xxxxxxxx.zhipu（需要拼接）

3. 通义千问 Qwen (DashScope)
   - 注册：https://dashscope.console.aliyun.com/
   - 阿里云账号，新用户有免费额度
   - 特点：阿里生态集成，支持长上下文，文档理解强
   - Key 格式：sk-xxxxxxxx

4. Kimi (Moonshot)
   - 注册：https://platform.moonshot.cn/
   - 新用户赠送 15 元额度
   - 特点：超长上下文（128K），文档分析强
   - Key 格式：sk-xxxxxxxx
"""

print(GUIDE)
```

---

## 👀 执行预览

```bash
$ python china_llm_compare.py
Prompt: 请用一句话解释什么是量子纠缠，要求准确且通俗易懂。

======================================================================

Provider: DeepSeek (deepseek-chat)
Response: 量子纠缠是指两个粒子无论相隔多远，对其中一个粒子的测量会瞬间影响另一个粒子的状态，就像一对"心灵相通"的骰子。
Tokens: 15 in + 35 out | Latency: 1.23s

Provider: GLM (glm-4-flash)
Response: 量子纠缠是量子力学中的一种现象，两个粒子一旦产生纠缠，无论相隔多远，对一个粒子的操作都会瞬间影响另一个粒子的状态。
Tokens: 18 in + 42 out | Latency: 0.89s

======================================================================
Summary:
Provider      Tokens In  Tokens Out    Latency
---------------------------------------------
DeepSeek            15          35      1.23s
GLM                 18          42      0.89s
Qwen                16          38      1.05s
Kimi                17          40      1.15s
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 各家 API Key 格式不同，不能混用 | 认证失败 | 🔴 |
| ⚠️ GLM 的 Key 需要在后台生成 JWT Token 才能调用 | 直接用 API Key 会报 401 | 🟡 |
| ⚠️ 部分模型有 RPM（每分钟请求）限制 | 高频调用被限流 | 🟡 |
| ⚠️ 并非所有国产模型都完全兼容 OpenAI SDK | 部分参数不支持 | 🟢 |
| ⚠️ 各家价格差异大，切换前确认最新定价 | 成本不可控 | 🟡 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 用 OpenAI 的 base_url 调国产模型 | 连接超时或 404 | ✅ 换成各家的 base_url |
| ❌ GLM 直接用 API Key 调用 | 返回 401 认证失败 | ✅ 用 zhipu SDK 或按文档生成 JWT |
| ❌ 不检查各家支持的参数差异 | 无效参数被忽略或报错 | ✅ 查文档确认支持的参数列表 |
| ❌ 混用各家的模型名 | Model not found 错误 | ✅ 用各家文档中声明的模型 ID |

---

## 🔍 调试排查

#### 故障场景1：连接超时

**症状**：API 调用长时间无响应，最终 timeout
**排查思路**：
1. 确认网络连通性 → `curl -I https://api.deepseek.com`
2. 检查是否需要配置代理
3. 检查 base_url 是否正确（注意末尾有没有 `/v1`）

**根因**：各家 base_url 格式不完全统一
**修复**：严格按照文档的 base_url 设置

#### 故障场景2：认证失败但 Key 正确

**症状**：返回 401/403，但 API Key 复制无误
**排查思路**：
1. 检查 Key 是否过期或余额用完
2. 确认该 Key 是否有对应模型的权限
3. 检查是否需要在 Header 中额外传递参数

**根因**：部分平台（如 GLM）需要额外的认证步骤
**修复**：按各家文档的认证方式配置

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. 列举国内四大 LLM API 提供商，各说一个核心优势。（考察点：了解生态 → 目标 #1）
2. 为什么用 OpenAI SDK 可以调用国产模型？（考察点：兼容性 → 目标 #1）

### 🟡 进阶题（动手实践）

1. 编写代码，对同一个问题（如"解释递归"）分别调用 DeepSeek 和 Qwen，对比响应质量和速度。（考察点：实际调用 → 目标 #2）
2. 封装一个函数 `call_llm(provider, prompt, model=None)`，支持动态切换提供商。（考察点：统一接口 → 目标 #4）

### 🔴 开放题（设计思考）

1. 你的项目需要处理 10 万份中文合同，要求提取关键信息。预算有限，如何选择模型？考虑因素包括：中文理解能力、价格、长上下文支持、JSON 输出能力。（考察点：选型决策 → 目标 #3）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
国内大模型 API
├── 四大提供商
│   ├── DeepSeek ← 性价比、代码、推理
│   ├── 智谱 GLM ← 学术、综合、工具调用
│   ├── 通义千问 ← 阿里生态、长上下文
│   └── Kimi ← 超长上下文、文档分析
├── 共同特点
│   ├── OpenAI 兼容格式
│   ├── 支持中文为主
│   └── 价格比 GPT-4 低很多
├── 接入要点
│   ├── base_url 各家不同
│   ├── API Key 格式不同
│   └── 参数支持有差异
└── 选型因素
    ├── 场景需求（代码/对话/文档）
    ├── 成本预算
    └── 延迟要求
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 海外项目 | 同样技术可以接入 GPT-4o、Claude、Gemini，统一接口设计 |
| 私有化部署 | 开源模型（Qwen、DeepSeek）可本地部署，API 格式相似 |
| 多模型 A/B 测试 | 同一请求并发调用多个模型，对比效果 |

---

## 🗺️ 学习路径

```
[结构化输出] → **📍 你在这里：国内模型对比** → [多模型统一接入]
                              ├─→ [Token计算与成本]
                              └─→ [LLM错误处理与重试]
```

**下一篇建议**：
- → [《多模型统一接入：构建你的LLM网关》](26-llm-多模型统一接入.md)：把多模型接入抽象成统一网关
- → [《LLM异步批量调用》](27-llm-异步批量调用.md)：高并发场景下多模型调用的优化

**相关主题**：
- [《Token计算与成本》](22-llm-token计算与成本.md)：各模型的详细成本对比

---

## ⚔️ 横向对比

| 维度 | DeepSeek V3 | GLM-4-Plus | Qwen-Max | Kimi v1 |
|------|-------------|------------|----------|---------|
| 中文能力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 代码能力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 推理能力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 价格 | ⭐⭐⭐⭐⭐（最便宜） | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 长上下文 | 128K | 128K | 1M | 128K |
| OpenAI兼容 | ✅ 完全 | ✅ 完全 | ✅ 完全 | ✅ 完全 |
| **铁蛋推荐** | 🏆 通用首选 | 工具调用场景 | 超长文档 | 文档分析 |

**铁蛋建议**：日常开发首选 DeepSeek（性价比最高），需要阿里生态集成选 Qwen，超长文档选 Kimi。

---

## 📚 参考资料

- [DeepSeek API 文档](https://api-docs.deepseek.com/) [等级：官方] — DeepSeek 完整 API 文档
- [智谱 BigModel 文档](https://open.bigmodel.cn/dev/api) [等级：官方] — GLM 系列模型 API
- [通义千问 DashScope](https://help.aliyun.com/zh/dashscope/) [等级：官方] — Qwen API 接入文档
- [Moonshot API](https://platform.moonshot.cn/docs) [等级：官方] — Kimi API 文档

---

## 📝 练习题参考答案

**基础题1**：
- DeepSeek：性价比最高，代码和推理能力强
- 智谱 GLM：学术背景，工具调用支持好，综合能力强
- 通义千问：阿里生态集成，超长上下文（1M tokens）
- Kimi：长上下文文档分析是特长

**基础题2**：因为国产模型提供商在设计 API 时主动兼容了 OpenAI 的 `/v1/chat/completions` 接口格式。只需要改 `base_url` 和 API Key，SDK 的调用方式（messages 格式、参数名）完全一样。这是行业事实标准。
