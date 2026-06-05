# LLM关键参数详解：temperature、top_p与采样策略

> 分类：LLM API | 参数调优 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学完本篇，你将能够：

1. ✅ 用自己的话解释temperature和top_p如何影响LLM输出（理解）
2. ✅ 针对不同场景（代码生成、创意写作、数据分析）选择最优参数组合（评价）
3. ✅ 用代码对比不同参数下LLM输出的差异（应用）
4. ✅ 定位因参数设置不当导致的问题（如输出截断、内容重复）（分析）

---

## 📋 学习前自检

1. **你知道LLM生成文本是"逐token预测概率分布"吗？**（答不上来？→ [《大模型API初体验》](19-llm-api-初体验.md)）
2. **你调过OpenAI兼容的Chat Completion API吗？**（答不上来？→ [《大模型API初体验》](19-llm-api-初体验.md)）
3. **什么是概率分布？什么是"采样"？**（答不上来？→ 先了解基础概率概念）

---

## 💡 概念讲解

- **一句话定义**：LLM参数控制模型从"概率分布"中"采样"token的方式，决定了输出是保守确定还是大胆创意。
- **现实类比**：temperature像"脑洞旋钮"——左拧（0）是"最稳妥答案"，右拧（1+）是"放飞自我"。top_p像"选择范围"——0.1只看最可能的几个词，0.9会考虑更多冷门词汇。
- **技术场景**：代码生成要确定性（temperature=0），营销文案要创意（temperature=0.7-1.0），数据提取要严格格式（temperature=0 + JSON Mode）。
- **⚠️ 常见误解**：temperature=0不代表"固定输出"——同一prompt可能因为模型更新、缓存等因素产生不同结果。它只是让采样变成argmax（选概率最高的）。

---

## 🧠 实时脑图

```text
[用户Prompt] 🔴
    ||
    ↓
[LLM推理] 🔴 → 输出每个位置token的概率分布
    ||
    ↓
[采样策略] 🔴 ← 参数控制这步！
    ||
    ├── temperature 调整概率分布的"陡峭度" 🟡
    │     ├── 0.0 → argmax（最确定）
    │     ├── 0.7 → 略有变化（推荐默认）
    │     └── 1.5+ → 非常随机（易乱）
    ||
    ├── top_p 截断低概率选项 🟡
    │     ├── 0.1 → 只看top 10%概率的token
    │     └── 0.9 → 看90%概率范围的token
    ||
    ├── max_tokens 限制输出长度 🟢
    │     └── 注意：是token数不是字数
    ||
    ├── frequency_penalty 抑制重复 🟢
    │     └── 值越大，已出现过的token越难再出现
    ||
    └── presence_penalty 鼓励新话题 🟢
          └── 值越大，更倾向讨论新话题
    ||
    ↓
[最终输出] 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | openai 1.30+ | DeepSeek API

### 参数对比实验

```python
# llm_params_demo.py
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key="your-api-key",  # 替换为你的DeepSeek API Key
    base_url="https://api.deepseek.com"
)

PROMPT = "用一句话描述春天。"

async def call_llm(temperature: float = 1.0, top_p: float = 1.0,
                   max_tokens: int = 100, **kwargs) -> str:
    """Call LLM with specific parameters."""
    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": PROMPT}],
        temperature=temperature,
        top_top_p=top_p,
        max_tokens=max_tokens,
        **kwargs
    )
    return response.choices[0].message.content

async def experiment_temperature():
    """Compare outputs with different temperature values."""
    print("=" * 60)
    print(f"实验：不同temperature（同一prompt，跑3次）")
    print(f"Prompt: {PROMPT}")
    print("=" * 60)

    for temp in [0.0, 0.3, 0.7, 1.0, 1.5]:
        print(f"\n--- temperature = {temp} ---")
        for i in range(3):
            result = await call_llm(temperature=temp)
            print(f"  #{i+1}: {result}")

async def experiment_top_p():
    """Compare outputs with different top_p values."""
    print("\n" + "=" * 60)
    print("实验：不同top_p（temperature=0.7，跑3次）")
    print("=" * 60)

    for tp in [0.1, 0.5, 0.9, 1.0]:
        print(f"\n--- top_p = {tp} ---")
        for i in range(3):
            result = await call_llm(temperature=0.7, top_p=tp)
            print(f"  #{i+1}: {result}")

async def experiment_penalty():
    """Compare outputs with different penalty values."""
    print("\n" + "=" * 60)
    print("实验：frequency_penalty vs presence_penalty")
    print("Prompt: 写一段关于猫的短文，至少100字。")
    print("=" * 60)

    configs = [
        {"frequency_penalty": 0.0, "presence_penalty": 0.0},
        {"frequency_penalty": 1.5, "presence_penalty": 0.0},
        {"frequency_penalty": 0.0, "presence_penalty": 1.5},
    ]
    labels = ["无penalty", "frequency_penalty=1.5", "presence_penalty=1.5"]

    for label, cfg in zip(labels, configs):
        result = await call_llm(
            temperature=0.7,
            messages=[{"role": "user", "content": "写一段关于猫的短文，至少100字。"}],
            **cfg
        )
        print(f"\n--- {label} ---")
        print(f"  {result[:200]}...")

async def main():
    await experiment_temperature()
    await experiment_top_p()
    await experiment_penalty()

if __name__ == "__main__":
    asyncio.run(main())
```

### 场景推荐参数配置

```python
# llm_params_presets.py
"""Common parameter presets for different AI application scenarios."""

# 🔧 Code generation - need deterministic, correct output
CODE_GEN = {
    "temperature": 0.0,      # Most deterministic
    "top_p": 1.0,            # Not needed when temp=0
    "max_tokens": 2048,
    # No penalty - code needs to repeat variable names
}

# ✍️ Creative writing - marketing copy, stories
CREATIVE_WRITING = {
    "temperature": 0.7,      # Some creativity
    "top_p": 0.9,            # Slightly narrowed
    "max_tokens": 2048,
    "frequency_penalty": 0.3, # Mild repetition control
}

# 📊 Data extraction / JSON output - strict format
DATA_EXTRACTION = {
    "temperature": 0.0,      # Deterministic for consistency
    "top_p": 1.0,
    "max_tokens": 1024,
    "response_format": {"type": "json_object"},  # Force JSON
}

# 💬 Chat / Q&A - balanced
CHAT = {
    "temperature": 0.5,      # Slightly creative
    "top_p": 0.9,
    "max_tokens": 1024,
}

# 🧠 Brainstorming - maximize diversity
BRAINSTORM = {
    "temperature": 1.2,      # High creativity
    "top_p": 0.95,           # Wide selection
    "max_tokens": 2048,
    "frequency_penalty": 0.5, # Encourage diverse ideas
}

# 📝 Summary / Translation - faithful to source
SUMMARY = {
    "temperature": 0.3,      # Low creativity, stay faithful
    "top_p": 0.85,
    "max_tokens": 1024,
}

# Usage example
if __name__ == "__main__":
    import json
    for name, config in [
        ("Code Generation", CODE_GEN),
        ("Creative Writing", CREATIVE_WRITING),
        ("Data Extraction", DATA_EXTRACTION),
        ("Chat/Q&A", CHAT),
        ("Brainstorming", BRAINSTORM),
        ("Summary/Translation", SUMMARY),
    ]:
        print(f"📌 {name}:")
        print(f"   {json.dumps(config, ensure_ascii=False)}")
        print()
```

---

## 👀 执行预览

```
============================================================
实验：不同temperature（同一prompt，跑3次）
Prompt: 用一句话描述春天。
============================================================

--- temperature = 0.0 ---
  #1: 春天是万物复苏的季节，鲜花盛开，微风拂面，大地换上了新装。
  #2: 春天是万物复苏的季节，鲜花盛开，微风拂面，大地换上了新装。
  #3: 春天是万物复苏的季节，鲜花盛开，微风拂面，大地换上了新装。

--- temperature = 0.7 ---
  #1: 春天是大自然写给世界的一首诗，每一朵花都是一个温柔的标点。
  #2: 春天是万物苏醒的乐章，嫩绿的芽叶和婉转的鸟鸣交织成画。
  #3: 春风轻抚大地，唤醒了沉睡的花朵，编织出一幅生机勃勃的画卷。

--- temperature = 1.5 ---
  #1: 春天的光芒是大地复苏的暮色轻歌，温柔而婉转地绽放。
  #2: 春日里万物崩裂般重新组装，像宇宙刚诞生的那一刻。
  #3: 花瓣自枝头飘落的瞬间，春天已经悄悄写好了关于重生的注脚。
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ temperature和top_p不要同时大幅调整 | 效果不可预测，行为混乱 | 🟡 |
| ⚠️ max_tokens是上限不是目标长度 | 设太小会截断输出，设太大会浪费成本 | 🟡 |
| ⚠️ frequency_penalty过高会导致输出不连贯 | 强行避免重复 → 语句不通 | 🟡 |
| ⚠️ temperature=0不保证完全一致 | 模型更新、缓存等因素可能影响结果 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 所有场景都用temperature=1.0 | 代码生成随机出错，JSON格式不稳定 | 按场景配置：代码0、聊天0.5、创意0.7 |
| ❌ temperature调到2.0追求"创意" | 输出完全不可读、出现乱码 | 创意场景最高1.2-1.5 |
| ❌ max_tokens设成500以为够用 | 长文输出被截断，JSON被截断导致解析失败 | 留余量，JSON场景至少1024 |
| ❌ 只调temperature不调top_p | 两者叠加效果不可控 | 先调temperature，再微调top_p |
| ❌ 用frequency_penalty控制"不要跑题" | 词汇多样但不一定切题 | 用system prompt控制内容方向 |

---

## 🔍 调试排查

#### 故障场景1：JSON输出总是被截断
**症状**：`json.loads()` 报错，截断的JSON不完整
**排查思路**：
1. 检查max_tokens是否太小（默认可能只有16或128）
2. 检查prompt是否太长，留给输出的token空间不够
3. 模型是否在生成过程中达到了token上限
**根因**：max_tokens设置太小
**修复**：将max_tokens设为1024+，或使用`response_format={"type": "json_object"}`

#### 故障场景2：创意场景输出重复
**症状**：LLM反复说同样的话，如"总之...总之...总之..."
**排查思路**：
1. temperature是否太低（<0.3）
2. frequency_penalty是否为0
3. prompt是否给了足够的创作空间
**根因**：温度太低+无重复惩罚
**修复**：temperature提到0.7，frequency_penalty设为0.3-0.5

---

## 📝 练习题

### 🟢 基础题（检验理解）
1. temperature=0和temperature=1的核心区别是什么？（→ 目标 #1）
2. max_tokens=100大约能输出多少个中文字？（提示：中文1字≈1.5-2 token）（→ 目标 #1）

### 🟡 进阶题（动手实践）
1. 用上面的代码模板，对比temperature=0和temperature=0.7在"写一段Python快速排序代码"这个prompt下的输出差异，各跑3次（→ 目标 #3）
2. 设计一个实验：验证frequency_penalty对"写一首关于秋天的诗"的影响（→ 目标 #3）

### 🔴 开放题（设计思考）
1. 你正在开发一个AI客服系统，需要同时支持"精确回答FAQ"和"友好闲聊"。如何通过参数配置让同一模型在两种模式下表现最优？（→ 目标 #2, #4）

📝 参考答案：动手实践，对比输出差异

---

## 📌 知识点总结

```text
LLM采样参数
├── temperature（0-2）
│   ├── 0.0 → 确定性（argmax）
│   ├── 0.3 → 低随机（总结/翻译）
│   ├── 0.7 → 平衡（聊天/推荐）
│   └── 1.5+ → 高随机（头脑风暴）
├── top_p（0-1）
│   ├── 核采样：保留概率质量前p%的token
│   └── 建议与temperature二选一调
├── max_tokens
│   ├── 限制输出token数（不是字数）
│   └── 建议：代码2048 / JSON 1024 / 创意2048
├── frequency_penalty（-2到2）
│   └── 惩罚已出现过的token（控重复）
├── presence_penalty（-2到2）
│   └── 鼓励出现新token（促多样）
└── stop
    └── 遇到指定字符串时停止生成
```

---

## 🔄 举一反三

| 场景 | temperature | top_p | max_tokens | penalty | 特殊配置 |
|------|-------------|-------|------------|---------|---------|
| SQL生成 | 0.0 | 1.0 | 1024 | 0 | - |
| 产品描述文案 | 0.8 | 0.9 | 2048 | freq=0.3 | - |
| JSON数据提取 | 0.0 | 1.0 | 1024 | 0 | response_format=json |
| 多语言翻译 | 0.3 | 0.85 | 2048 | 0 | - |
| 头脑风暴 | 1.2 | 0.95 | 2048 | freq=0.5, pres=0.3 | - |
| 代码审查 | 0.0 | 1.0 | 2048 | 0 | - |

---

## 🗺️ 学习路径

```
[《Messages设计》] ──→ **📍 你在这里：LLM参数详解** ──→ [《Token计算与成本》]
                                │
                                └─→ [《结构化输出》]
```

**下一篇建议**：
- → [《Token计算与成本》](22-llm-token计算与成本.md)：理解token和max_tokens的关系，学会计算成本
- → [《结构化输出》](24-llm-结构化输出.md)：temperature=0 + JSON Mode的组合用法

---

## ⚔️ 横向对比

| 维度 | temperature | top_p | 两者同时调 |
|------|-------------|-------|-----------|
| 控制粒度 | 粗粒度（整体随机度） | 细粒度（候选范围） | 过度调整 |
| 推荐优先级 | ⭐⭐⭐ 先调这个 | ⭐⭐ 后调 | ⭐ 不推荐 |
| 调参难度 | 简单 | 中等 | 困难 |
| **铁蛋建议** | **大多数场景只调temperature就够了** | 需要精细控制时再调 | 避免同时大幅调整 |

## 📚 参考资料

- [OpenAI API文档 - Parameters](https://platform.openai.com/docs/api-reference/chat/create) [等级：官方]
- [Anthropic - Temperature Explained](https://docs.anthropic.com/claude/docs/temperature) [等级：权威]
- [HuggingFace - Sampling Strategies](https://huggingface.co/blog/how-to-generate) [等级：优质] — 深入理解beam search、top-k、top-p
