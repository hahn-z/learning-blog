# Pydantic v2数据验证：AI应用的基石

> 分类：数据验证 | Pydantic | 难度：⭐⭐⭐ | 预估用时：40 分钟

---

## 🎯 学习目标

1. ✅ 能够用 Pydantic BaseModel 定义数据模型并进行验证（应用）
2. ✅ 能够使用 field_validator、model_validator 编写自定义验证逻辑（应用）
3. ✅ 能够在 AI 应用中用 Pydantic 解析 LLM 响应和验证工具参数（评价）
4. ✅ 能够定位并修复常见的数据验证错误（分析）

---

## 📋 前置知识自检

1. **你了解 Python 类型注解吗（如 `name: str`、`age: int`）？**（答不上来？→ 先学 Python 类型注解）
2. **你知道 JSON 是什么格式吗？**（答不上来？→ 先了解 JSON 基础）
3. **你用过 FastAPI 或其他 Web 框架吗？**（非必须，但有助于理解集成场景）

---

## 💡 概念讲解

### Pydantic

- **一句话定义**：用 Python 类型注解自动验证和序列化数据的库。
- **现实类比**：你寄快递，Pydantic 就是快递柜——你放进去的东西必须符合规格（长宽高、重量），不符合就拒收，并告诉你哪里不对。
- **技术场景**：API 请求参数验证、配置文件解析、LLM 输出解析、数据库模型转换。
- **⚠️ 常见误解**：Pydantic 不是 ORM！它只负责数据验证和序列化，不负责数据库操作（那是 SQLAlchemy 的事）。

---

## 🧠 实时脑图

```text
[Pydantic v2] 🔴
    ||
    ├──→ [BaseModel] 🔴 — 定义数据模型
    │       ├── 字段类型 + 默认值
    │       ├── @field_validator — 单字段验证
    │       └── @model_validator — 多字段联合验证
    ├──→ [嵌套模型] 🟡 — 模型套模型
    ├──→ [序列化] 🔴
    │       ├── model_dump() → dict
    │       └── model_dump_json() → JSON str
    ├──→ [AI 应用] 🔴
    │       ├── LLM 响应解析
    │       └── Tool 参数验证
    └──→ [FastAPI 集成] 🟡 — 自动 OpenAPI 文档
```

---

## 💻 完整代码

> 运行环境：Python 3.10+, `pip install pydantic`

```python
"""
pydantic_basics.py - Pydantic v2 数据验证 + AI 应用场景
Python 3.10+ | pip install pydantic
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
import json


# ============================================
# 1. 基础：定义模型
# ============================================

class User(BaseModel):
    """用户模型 — 最基本的数据验证"""
    name: str
    age: int
    email: str
    is_active: bool = True  # 默认值
    bio: Optional[str] = None  # 可选字段


# 基本使用
user = User(name="铁蛋", age=25, email="tiedan@example.com")
print(f"✅ 创建成功: {user.name}, {user.age}岁")
print(f"   序列化dict: {user.model_dump()}")
print(f"   序列化JSON: {user.model_dump_json()}")

# 类型自动转换
user2 = User(name="汉哥", age="30", email="hahn@example.com")
print(f"✅ 字符串'30'自动转int: {user2.age} (type: {type(user2.age).__name__})")

# 验证失败
try:
    User(name="铁蛋", age="not_a_number", email="bad")
except Exception as e:
    print(f"❌ 验证失败: {e}")


# ============================================
# 2. Field：字段约束
# ============================================

class Product(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="产品名称")
    price: float = Field(gt=0, description="价格，必须大于0")
    stock: int = Field(ge=0, description="库存，不能为负")
    tags: list[str] = Field(default_factory=list, description="标签列表")


product = Product(name="AI课程", price=99.9, stock=100, tags=["Python", "AI"])
print(f"\n✅ 产品: {product.name}, ¥{product.price}")

try:
    Product(name="", price=-1, stock=-5)
except Exception as e:
    print(f"❌ 约束验证失败: {e}")


# ============================================
# 3. @field_validator：单字段验证
# ============================================

class RegisterForm(BaseModel):
    username: str
    password: str
    age: int

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("用户名只能包含字母和数字")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码至少8位")
        if not any(c.isupper() for c in v):
            raise ValueError("密码必须包含大写字母")
        return v


try:
    RegisterForm(username="铁蛋!", password="123", age=20)
except Exception as e:
    print(f"\n❌ 自定义验证失败: {e}")


# ============================================
# 4. @model_validator：多字段联合验证
# ============================================

class Event(BaseModel):
    title: str
    start_date: str
    end_date: str

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date > self.end_date:
            raise ValueError("开始日期不能晚于结束日期")
        return self


event = Event(title="AI峰会", start_date="2025-01-01", end_date="2025-01-03")
print(f"\n✅ 活动验证通过: {event.title}")

try:
    Event(title="bug", start_date="2025-12-01", end_date="2025-01-01")
except Exception as e:
    print(f"❌ 日期验证失败: {e}")


# ============================================
# 5. 嵌套模型
# ============================================

class Address(BaseModel):
    city: str
    street: str
    zip_code: str

class Company(BaseModel):
    name: str
    address: Address  # 嵌套模型
    employees: int


company = Company(
    name="铁蛋科技",
    address={"city": "深圳", "street": "科技路1号", "zip_code": "518000"},
    employees=10
)
print(f"\n✅ 嵌套模型: {company.name} @ {company.address.city}")
print(f"   JSON: {company.model_dump_json(indent=2)}")


# ============================================
# 6. AI 应用场景：LLM 响应解析
# ============================================

class LLMToolCall(BaseModel):
    """LLM 工具调用 — 解析 LLM 返回的结构化数据"""
    tool_name: str = Field(description="工具名称")
    arguments: dict = Field(description="工具参数")
    confidence: float = Field(ge=0, le=1, description="置信度 0-1")


class LLMResponse(BaseModel):
    """LLM 完整响应"""
    content: str = Field(description="文本回复内容")
    tool_calls: list[LLMToolCall] = Field(default_factory=list)
    finish_reason: str = Field(description="结束原因: stop | tool_calls")


# 模拟 LLM 返回的 JSON
llm_json = """
{
    "content": "我来帮你查一下深圳的天气",
    "tool_calls": [
        {
            "tool_name": "get_weather",
            "arguments": {"city": "深圳", "unit": "celsius"},
            "confidence": 0.95
        }
    ],
    "finish_reason": "tool_calls"
}
"""

# 解析并验证
response = LLMResponse.model_validate_json(llm_json)
print(f"\n✅ LLM响应解析成功:")
print(f"   回复: {response.content}")
print(f"   工具调用: {response.tool_calls[0].tool_name}")
print(f"   参数: {response.tool_calls[0].arguments}")


# ============================================
# 7. AI 应用场景：Function Calling 参数验证
# ============================================

class SearchParams(BaseModel):
    """搜索工具的参数定义 — 可直接转为 OpenAI function schema"""
    query: str = Field(description="搜索关键词")
    max_results: int = Field(default=10, ge=1, le=50, description="最大结果数")
    language: str = Field(default="zh", description="语言代码")


# 从 OpenAI function calling 返回的参数验证
tool_args = {"query": "Python异步编程", "max_results": 5}
params = SearchParams.model_validate(tool_args)
print(f"\n✅ 工具参数验证: query='{params.query}', max={params.max_results}")

# 自动生成 JSON Schema（可直接用于 OpenAI function definition）
print(f"\n📋 JSON Schema:")
print(json.dumps(params.model_json_schema(), indent=2, ensure_ascii=False))


# ============================================
# 8. 与 FastAPI 集成示例（伪代码）
# ============================================

"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class CreatePostRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

@app.post("/posts")
async def create_post(req: CreatePostRequest):  # FastAPI 自动验证！
    return {"id": 1, **req.model_dump()}
"""
```

---

## 👀 执行预览

```bash
$ python pydantic_basics.py

✅ 创建成功: 铁蛋, 25岁
   序列化dict: {'name': '铁蛋', 'age': 25, 'email': 'tiedan@example.com', 'is_active': True, 'bio': None}
   序列化JSON: {"name":"铁蛋","age":25,"email":"tiedan@example.com","is_active":true,"bio":null}
✅ 字符串'30'自动转int: 30 (type: int)

✅ 产品: AI课程, ¥99.9

❌ 约束验证失败: 2 validation errors for Product...

❌ 自定义验证失败: 2 validation errors for RegisterForm...

✅ 活动验证通过: AI峰会

✅ 嵌套模型: 铁蛋科技 @ 深圳

✅ LLM响应解析成功:
   回复: 我来帮你查一下深圳的天气
   工具调用: get_weather
   参数: {'city': '深圳', 'unit': 'celsius'}

✅ 工具参数验证: query='Python异步编程', max=5

📋 JSON Schema:
{
  "properties": {
    "query": {"description": "搜索关键词", "title": "Query", "type": "string"},
    "max_results": {"default": 10, ...},
    "language": {"default": "zh", ...}
  },
  "title": "SearchParams",
  "type": "object"
}
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ v2 不兼容 v1 的部分 API | `__fields__` → `model_fields` 等 | 🟡 |
| ⚠️ `model_validate` 替代 v1 的 `parse_obj` | 用旧 API 会报错 | 🔴 |
| ⚠️ `Optional[X]` 要给默认值 `= None` | 不给默认值仍是必填字段 | 🟡 |
| ⚠️ `model_dump()` 替代 v1 的 `dict()` | 旧方法已废弃 | 🟢 |

---

## 🕳️ 避坑指南

### 坑1：Optional 字段忘了给默认值

```python
# ❌ Optional 但没默认值 → 仍然是必填！
class Bad(BaseModel):
    bio: Optional[str]  # 必须传！

# ✅ 给默认值才是真正可选
class Good(BaseModel):
    bio: Optional[str] = None  # 可以不传
```

### 坑2：mutable 默认值

```python
# ❌ 直接用 [] 作为默认值（Python 经典坑）
class Bad(BaseModel):
    tags: list[str] = []  # 所有实例共享同一个 list！

# ✅ 用 default_factory
class Good(BaseModel):
    tags: list[str] = Field(default_factory=list)
```

### 坑3：v1 → v2 API 变更

```python
# ❌ v1 写法
user.dict()
user.json()
User.parse_obj(data)
User.parse_raw(json_str)

# ✅ v2 写法
user.model_dump()
user.model_dump_json()
User.model_validate(data)
User.model_validate_json(json_str)
```

---

## 🔍 调试排查

### 故障场景1：ValidationError 不知道哪个字段出错

**症状**：收到一大坨 ValidationError 信息，找不到重点
**排查思路**：
1. 看 `e.errors()` 而非 `str(e)`，结构化输出更清晰
2. 每个 error 包含 `loc`（字段路径）+ `msg`（错误信息）+ `type`（错误类型）

```python
from pydantic import ValidationError
try:
    User(name="铁蛋", age="abc", email="x")
except ValidationError as e:
    for err in e.errors():
        print(f"字段: {err['loc']}, 错误: {err['msg']}")
```

### 故障场景2：嵌套模型验证不通过

**症状**：嵌套的 dict 数据验证失败
**排查思路**：
1. 确认嵌套字段传的是 dict 而非 JSON 字符串
2. 如果是 JSON 字符串，用 `model_validate_json` 而非 `model_validate`

---

## 📝 练习题

### 🟢 基础题

1. 定义一个 `Book` 模型：title(str)、author(str)、price(float, >0)、isbn(Optional[str]=None)，创建一个实例并序列化为 JSON。（考察点：BaseModel 基础 → 目标 #1）

### 🟡 进阶题

2. 定义 `UserRegistration` 模型，用 `@field_validator` 验证 email 必须包含 `@`，密码至少 8 位且包含数字和字母。（考察点：自定义验证器 → 目标 #2）

3. 定义 `ChatMessage(role: str, content: str)` 和 `ChatRequest(messages: list[ChatMessage], model: str)`，模拟解析一个 AI 聊天请求。（考察点：嵌套模型 → 目标 #3）

### 🔴 开放题

4. 设计一个 `ToolDefinition` 模型，可以描述 LLM Function Calling 的工具定义（name、description、parameters schema），并自动生成 OpenAI 兼容的 JSON Schema。（考察点：AI 工具参数验证 → 目标 #3）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
Pydantic v2
├── BaseModel — 定义数据模型
│   ├── Field — 字段约束（gt/lt/min_length/max_length）
│   ├── @field_validator — 单字段验证
│   └── @model_validator — 多字段联合验证
├── 序列化
│   ├── model_dump() → dict
│   ├── model_dump_json() → JSON
│   ├── model_validate() — 从 dict 验证
│   └── model_validate_json() — 从 JSON 验证
├── AI 应用
│   ├── LLM 响应解析
│   ├── Function Calling 参数验证
│   └── model_json_schema() — 生成 JSON Schema
└── FastAPI 集成 — 自动验证请求体
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| API 请求参数验证 | 定义 Request/Response BaseModel，FastAPI 自动验证 |
| 配置文件解析 | `BaseModel` + `model_validate` 解析 YAML/JSON 配置 |
| LLM 流式输出解析 | 用 `model_validate_json` 逐块验证流式 JSON |

---

## 🗺️ 学习路径

```
[Python类型注解] → **📍 你在这里：Pydantic v2** → [FastAPI入门] → [AI Agent开发]
```

**下一篇建议**：
- → [《HTTP协议全解析》](11-http-协议全解析.md)：理解 Web 通信基础
- → [《FastAPI入门》]：Pydantic + 异步 Web 框架

**相关主题**：
- [《httpx：比requests更好的HTTP客户端》](13-httpx-比requests更好的HTTP客户端.md)：HTTP 请求 + Pydantic 验证响应

---

## ⚔️ 横向对比

| 维度 | Pydantic v2 | dataclasses | marshmallow |
|------|-------------|-------------|-------------|
| 性能 | ⭐⭐⭐⭐⭐ (Rust核心) | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 类型验证 | 自动 | 无 | 手动定义 |
| JSON序列化 | 内置 | 需要额外库 | 内置 |
| FastAPI集成 | 原生支持 | 支持 | 不推荐 |
| 学习成本 | 低 | 最低 | 中 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**铁蛋建议**：Python 项目数据验证首选 Pydantic v2，性能好、生态好、与 FastAPI 完美配合。

---

## 📦 版本兼容性

- ✅ 适配版本：Pydantic v2（2.0+）
- ⚠️ v1 → v2 破坏性变更：
  - `.dict()` → `.model_dump()`
  - `.json()` → `.model_dump_json()`
  - `.parse_obj()` → `.model_validate()`
  - `__fields__` → `model_fields`
  - `@validator` → `@field_validator`

---

## 📚 参考资料

- [Pydantic v2 官方文档](https://docs.pydantic.dev/latest/) [等级：官方]
- [Pydantic v1 → v2 迁移指南](https://docs.pydantic.dev/latest/migration/) [等级：官方] — 版本升级必读

---

## 附录：练习题参考答案

**题1**：
```python
from pydantic import BaseModel, Field
from typing import Optional

class Book(BaseModel):
    title: str
    author: str
    price: float = Field(gt=0)
    isbn: Optional[str] = None

book = Book(title="Python编程", author="铁蛋", price=59.9)
print(book.model_dump_json())
```

**题2**：
```python
from pydantic import BaseModel, field_validator

class UserRegistration(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        if "@" not in v:
            raise ValueError("邮箱必须包含@")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        if len(v) < 8:
            raise ValueError("密码至少8位")
        if not (any(c.isalpha() for c in v) and any(c.isdigit() for c in v)):
            raise ValueError("密码必须包含字母和数字")
        return v
```

**题3**：
```python
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str

req = ChatRequest.model_validate({
    "messages": [
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "你好！有什么可以帮你？"}
    ],
    "model": "gpt-4"
})
print(f"模型: {req.model}, 消息数: {len(req.messages)}")
```
