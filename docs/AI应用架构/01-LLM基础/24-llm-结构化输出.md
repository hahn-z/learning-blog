# 结构化输出：让LLM返回标准JSON

> 分类：LLM API | 结构化输出 | 难度：⭐⭐⭐ | 预估用时：35 分钟

---

## 🎯 学习目标

1. ✅ 解释为什么 LLM 需要结构化输出以及三种实现方式的区别（理解）
2. ✅ 使用 JSON Mode 和 Structured Output 获取标准 JSON 响应（应用）
3. ✅ 用 Pydantic 模型定义复杂的输出 Schema（应用）
4. ✅ 构建完整的信息抽取 Pipeline，含错误处理和重试（分析/应用）

---

## 📋 前置知识自检

1. **你了解 JSON Schema 的基本概念吗？**（答不上来？→ 先补 JSON Schema 基础）
2. **你用过 Pydantic 做数据验证吗？**（答不上来？→ 先学 Pydantic 入门）
3. **你知道 LLM API 的基本调用参数吗？**（答不上来？→ 先学 LLM API 基础）

---

## 💡 概念讲解

- **一句话定义**：结构化输出是让 LLM 严格按照预定义的 Schema 返回 JSON 格式数据的技术。
- **现实类比**：普通 LLM 回复像口语交流——自由但不好整理。结构化输出像填表——每个字段有固定格式，机器直接用。
- **技术场景**：信息抽取、数据标注、API 管道中 LLM 输出需要直接传给下游系统。
- **⚠️ 常见误解**：很多人以为让 LLM "请用 JSON 格式返回" 就够了。实际上 LLM 经常漏字段、格式错误、甚至返回 JSON 外面的说明文字。需要用 API 级别的约束（JSON Mode / Structured Output）才能保证格式可靠。

---

## 🧠 实时脑图

```text
[用户输入] 🔴
    || (三种方式选一)
    ↓
[方式1: Prompt约束] 🟢 ← 最弱，经常出错
[方式2: JSON Mode] 🟡 ← 保证JSON格式，不保证Schema
[方式3: Structured Output] 🔴 ← 严格Schema约束
    ||
    ↓ (定义Schema)
[Pydantic Model] 🔴 ← 自动转JSON Schema
    || (response_format参数)
    ↓
[API调用] 🔴
    ||
    ↓ (严格验证)
[标准JSON输出] 🔴 ← 可直接json.loads()
    ||
    ↓ (下游处理)
[业务逻辑] 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+ | 需安装：`pip install openai pydantic`

### 示例1：三种方式对比

```python
# structured_comparison.py - Compare 3 approaches
# Python 3.10+
import json
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

# --- Approach 1: Prompt-only (unreliable) ---
def extract_prompt_only(text: str) -> dict:
    """Use prompt to request JSON - NO guarantee."""
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "Extract info and return JSON with keys: name, age, city. Return ONLY valid JSON, no other text."},
            {"role": "user", "content": text}
        ],
        temperature=0,
    )
    raw = response.choices[0].message.content
    print(f"[Prompt-only] Raw: {raw[:100]}...")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("  ⚠️ JSON parse failed!")
        return {}

# --- Approach 2: JSON Mode ---
def extract_json_mode(text: str) -> dict:
    """JSON Mode - guarantees valid JSON, not schema."""
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "Extract: name, age, city as JSON."},
            {"role": "user", "content": text}
        ],
        response_format={"type": "json_object"},  # JSON Mode!
        temperature=0,
    )
    raw = response.choices[0].message.content
    return json.loads(raw)  # Always valid JSON

# --- Approach 3: Structured Output (OpenAI format) ---
from pydantic import BaseModel
from typing import Optional

class PersonInfo(BaseModel):
    name: str
    age: Optional[int] = None
    city: Optional[str] = None

def extract_structured(text: str) -> dict:
    """Structured Output with Pydantic schema - strongest guarantee."""
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "Extract person information from the text."},
            {"role": "user", "content": text}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "person_info",
                "schema": PersonInfo.model_json_schema()
            }
        },
        temperature=0,
    )
    raw = response.choices[0].message.content
    data = json.loads(raw)
    # Validate with Pydantic
    person = PersonInfo(**data)
    return person.model_dump()

# Test all three
test_text = "张三今年28岁，住在上海浦东新区。"

print("=== Approach 1: Prompt-only ===")
print(extract_prompt_only(test_text))

print("\n=== Approach 2: JSON Mode ===")
print(extract_json_mode(test_text))

print("\n=== Approach 3: Structured Output ===")
print(extract_structured(test_text))
```

### 示例2：复杂嵌套结构 + 信息抽取 Pipeline

```python
# extraction_pipeline.py - Complete information extraction pipeline
# Python 3.10+
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = OpenAI(
    api_key="your-api-key",
    base_url="https://api.deepseek.com"
)

# --- Define complex nested schema ---
class Address(BaseModel):
    province: Optional[str] = Field(None, description="Province")
    city: Optional[str] = Field(None, description="City")
    district: Optional[str] = Field(None, description="District/area")
    detail: Optional[str] = Field(None, description="Detailed address")

class WorkExperience(BaseModel):
    company: str = Field(description="Company name")
    position: str = Field(description="Job title")
    duration: Optional[str] = Field(None, description="Duration, e.g. '2020-2023'")

class ResumeInfo(BaseModel):
    """Extract structured resume information from text."""
    name: str = Field(description="Full name")
    age: Optional[int] = Field(None, description="Age")
    phone: Optional[str] = Field(None, description="Phone number")
    email: Optional[str] = Field(None, description="Email")
    address: Optional[Address] = Field(None, description="Address info")
    skills: list[str] = Field(default_factory=list, description="Skill list")
    work_experience: list[WorkExperience] = Field(default_factory=list, description="Work history")
    education: Optional[str] = Field(None, description="Highest education")

# --- Pipeline with retry ---
MAX_RETRIES = 3

def extract_resume(text: str) -> ResumeInfo:
    """Extract resume info with retry on parse failure."""
    schema = ResumeInfo.model_json_schema()

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an information extraction system. "
                            "Extract structured resume data from the user's text. "
                            "Be thorough and accurate."
                        )
                    },
                    {"role": "user", "content": text}
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )

            raw = response.choices[0].message.content
            data = json.loads(raw)
            result = ResumeInfo(**data)  # Pydantic validates
            logger.info(f"Extraction succeeded on attempt {attempt + 1}")
            return result

        except json.JSONDecodeError as e:
            logger.warning(f"Attempt {attempt+1}: JSON parse error - {e}")
        except Exception as e:
            logger.warning(f"Attempt {attempt+1}: {type(e).__name__} - {e}")

    raise RuntimeError(f"Failed after {MAX_RETRIES} retries")

# --- Run pipeline ---
sample_resume = """
李明，32岁，手机号13800138000，邮箱liming@example.com。
家住北京市海淀区中关村南大街5号。

2015年毕业于北京大学计算机科学与技术专业，硕士学位。

工作经历：
- 2019-至今：字节跳动，高级后端工程师，负责推荐系统开发
- 2017-2019：百度，搜索算法工程师

技能：Python, Go, 机器学习, 分布式系统, Kubernetes
"""

result = extract_resume(sample_resume)
print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
```

---

## 👀 执行预览

```bash
$ python structured_comparison.py
=== Approach 1: Prompt-only ===
[Prompt-only] Raw: {"name": "张三", "age": 28, "city": "上海浦东新区"}...
{'name': '张三', 'age': 28, 'city': '上海浦东新区'}

=== Approach 2: JSON Mode ===
{'name': '张三', 'age': 28, 'city': '上海浦东新区'}

=== Approach 3: Structured Output ===
{'name': '张三', 'age': 28, 'city': '上海浦东新区'}

$ python extraction_pipeline.py
INFO:__main__:Extraction succeeded on attempt 1
{
  "name": "李明",
  "age": 32,
  "phone": "13800138000",
  "email": "liming@example.com",
  "address": {
    "province": "北京市",
    "city": "北京市",
    "district": "海淀区",
    "detail": "中关村南大街5号"
  },
  "skills": ["Python", "Go", "机器学习", "分布式系统", "Kubernetes"],
  "work_experience": [
    {"company": "字节跳动", "position": "高级后端工程师", "duration": "2019-至今"},
    {"company": "百度", "position": "搜索算法工程师", "duration": "2017-2019"}
  ],
  "education": "北京大学计算机科学与技术专业硕士学位"
}
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ DeepSeek 目前支持 JSON Mode，Structured Output 支持需确认最新文档 | 可能返回非预期格式 | 🟡 |
| ⚠️ 使用 JSON Mode 时 prompt 中必须提到 "JSON" | API 可能报错或返回非 JSON | 🔴 |
| ⚠️ Schema 中字段越多，LLM 填充准确率越低 | 缺字段或字段值错误 | 🟡 |
| ⚠️ Optional 字段可能被 LLM 填充为 null 字符串而非 null 值 | 类型验证失败 | 🟢 |
| ⚠️ Structured Output 会增加 Token 消耗（Schema 描述占 Token） | 成本略增 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 只用 prompt 约束格式 | 经常解析失败，不稳定 | ✅ 至少用 JSON Mode，最好用 Structured Output |
| ❌ Schema 字段用中文 key | 某些模型处理不稳定 | ✅ 字段名用英文，描述用中文 |
| ❌ 不做 Pydantic 验证直接 json.loads | 隐藏的类型错误 | ✅ 用 Pydantic 模型做二次验证 |
| ❌ 复杂嵌套超过 3-4 层 | LLM 填充质量下降 | ✅ 扁平化 Schema 或分步抽取 |

---

## 🔍 调试排查

#### 故障场景1：JSON Mode 返回的 JSON 缺少字段

**症状**：`json.loads()` 成功但 Pydantic 验证失败，缺少必填字段
**排查思路**：
1. 检查 Schema 中字段是否有清晰的 description
2. 检查原文中是否真的包含该信息
3. 尝试在 system prompt 中明确列出所有必填字段

**根因**：LLM 不确定字段值时倾向于省略，尤其是 Optional 字段
**修复**：在 prompt 中强调"如果信息不确定，填 null 而不是省略字段"

#### 故障场景2：Structured Output API 报错不支持

**症状**：`response_format={"type": "json_schema"}` 返回 400 错误
**排查思路**：
1. 确认模型是否支持 Structured Output（DeepSeek 可能只支持 JSON Mode）
2. 查看错误消息中的具体提示
3. 降级到 JSON Mode + Pydantic 验证方案

**根因**：不是所有模型/提供商都支持 Structured Output
**修复**：使用 `response_format={"type": "json_object"}` + Pydantic 验证作为兼容方案

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. JSON Mode 和 Structured Output 的核心区别是什么？（考察点：概念理解 → 目标 #1）
2. 为什么 Structured Output 仍然需要 Pydantic 做二次验证？（考察点：可靠性 → 目标 #1）

### 🟡 进阶题（动手实践）

1. 定义一个 `ProductInfo` Pydantic 模型（名称、价格、分类、标签列表、规格嵌套对象），并编写从商品描述文本中抽取信息的代码。（考察点：Schema 设计 → 目标 #3）
2. 修改示例2，添加一个 `ExtractionResult` 包装器，包含抽取结果 + 置信度分数 + 处理时间。（考察点：Pipeline 完善 → 目标 #4）

### 🔴 开放题（设计思考）

1. 设计一个多步骤的信息抽取系统：第一步抽取实体，第二步抽取关系，第三步组装知识图谱三元组。如何确保每一步的输出都能可靠地传给下一步？（考察点：系统设计 → 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
结构化输出
├── 三种方式
│   ├── Prompt约束（弱）← 仅提示
│   ├── JSON Mode（中）← 保证JSON格式
│   └── Structured Output（强）← 保证Schema
├── Schema定义
│   ├── Pydantic BaseModel
│   ├── 嵌套结构（嵌套Model）
│   └── Optional字段处理
├── 错误处理
│   ├── JSON解析失败 → 重试
│   ├── Pydantic验证失败 → 重试
│   └── 最大重试次数 → 降级/报错
└── 最佳实践
    ├── 字段名英文 + description中文
    ├── 避免过深嵌套
    └── Pydantic二次验证
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 合同信息提取 | 定义合同要素 Schema（甲乙方、金额、日期、条款） |
| 客服意图分类 | 定义 enum 类型的意图字段 + 参数提取 |
| 论文元数据抽取 | 标题、作者列表、摘要、关键词、发表年份 |

---

## 🗺️ 学习路径

```
[流式响应实战] → **📍 你在这里：结构化输出** → [国内大模型API对比]
                               ├─→ [LLM网关设计]
                               └─→ [LLM错误处理与重试]
```

**下一篇建议**：
- → [《国内大模型API对比》](25-llm-国内大模型API对比.md)：了解各模型对结构化输出的支持情况
- → [《LLM错误处理与重试》](28-llm-错误处理与重试.md)：完善结构化输出的重试和降级策略

**相关主题**：
- [《多模型统一接入》](26-llm-多模型统一接入.md)：不同模型的结构化输出适配

---

## ⚔️ 横向对比

| 维度 | Prompt约束 | JSON Mode | Structured Output |
|------|-----------|-----------|-------------------|
| 格式保证 | ❌ 无 | ✅ 有效JSON | ✅ 有效JSON+Schema |
| 字段完整性 | ❌ 不保证 | ❌ 不保证 | ✅ 保证 |
| 模型支持 | ✅ 所有 | ✅ 大部分 | ⚠️ 部分模型 |
| 实现复杂度 | 低 | 低 | 中 |
| Token消耗 | 低 | 低 | 中（Schema开销） |
| **推荐指数** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**铁蛋建议**：生产环境用 JSON Mode + Pydantic 验证（兼容性最好），模型支持 Structured Output 时直接用。

---

## 📚 参考资料

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) [等级：官方] — Structured Output 官方指南
- [Pydantic V2 文档](https://docs.pydantic.dev/) [等级：官方] — Pydantic 数据验证框架
- [DeepSeek API 文档](https://api-docs.deepseek.com/) [等级：官方] — 确认 JSON Mode 支持情况

---

## 📝 练习题参考答案

**基础题1**：JSON Mode 只保证返回的是有效 JSON（可以 json.loads 解析），但不保证 JSON 包含哪些字段、字段类型是否正确。Structured Output 在 JSON Mode 基础上，额外保证返回的 JSON 严格符合预定义的 JSON Schema（字段名、类型、必填/可选都一致）。

**基础题2**：Structured Output 在 API 层面保证格式，但 LLM 填充的字段值可能有逻辑问题（如年龄填了 "未知" 字符串而非 null）。Pydantic 提供类型、范围、正则等更深层的业务验证，是最后一道防线。
