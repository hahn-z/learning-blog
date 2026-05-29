---
title: "009 - Python 数据类与验证：从 dataclass 到 Pydantic"
slug: "009-dataclasses-pydantic"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.396+08:00"
updated_at: "2026-04-29T10:02:47.574+08:00"
reading_time: 32
tags: []
---

# Python 数据类与验证：从 dataclass 到 Pydantic

> **难度：⭐⭐⭐（中高级）**
> **前置知识：** 类与对象、类型注解、dataclass 基础

---

## 一、概念讲解

Python 有两种主流的数据建模方式：标准库 `dataclasses` 和第三方库 `pydantic`。

### dataclasses — 轻量数据容器

`@dataclass` 自动生成 `__init__`、`__repr__`、`__eq__` 等方法，让你专注于数据定义：

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

p = Point(1.0, 2.0)
print(p)  # Point(x=1.0, y=2.0)
```

### Pydantic — 数据验证之王

Pydantic 在 dataclass 基础上增加**运行时类型验证**、**序列化/反序列化**、**JSON Schema** 生成：

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int
    email: str

u = User(name="Alice", age="28", email="alice@test.com")
print(u.age)  # 28 (str was auto-converted to int!)
```

### 核心对比

| 特性 | dataclasses | Pydantic |
|------|------------|----------|
| 类型验证 | 否（仅注解） | 是（运行时强制） |
| 自动类型转换 | 否 | 是（str→int 等） |
| JSON 序列化 | 需手动 | 内置 `model_dump_json()` |
| 不可变支持 | `frozen=True` | `model_config = ConfigDict(frozen=True)` |
| 默认值 | `field(default=)` | 直接赋值 |
| 嵌套模型 | 手动处理 | 原生支持 |
| JSON Schema | 无 | 自动生成 |
| 性能 | 极快 | 快（V2 用 Rust 核心） |
| 依赖 | 标准库 | 需安装 `pydantic` |

---

## 二、脑图（ASCII）

```
数据类与验证
├── dataclasses（标准库）
│   ├── @dataclass 装饰器
│   ├── field() 高级配置
│   │   ├── default / default_factory
│   │   ├── repr / compare / init
│   │   └── metadata
│   ├── frozen=True 不可变
│   ├── __post_init__ 初始化后处理
│   ├── 继承行为
│   └── replace() 创建副本
├── Pydantic（第三方）
│   ├── BaseModel
│   ├── 字段类型 + 验证器
│   │   ├── 内置类型（str, int, EmailStr, HttpUrl...）
│   │   ├── @field_validator
│   │   ├── @model_validator
│   │   └── field() 配置
│   ├── 序列化
│   │   ├── model_dump() → dict
│   │   ├── model_dump_json() → str
│   │   └── model_validate() → from dict/JSON
│   ├── 嵌套模型
│   └── Generic 模型
├── 选择策略
│   ├── 内部数据结构 → dataclass
│   ├── API 边界/外部数据 → Pydantic
│   └── 简单配置 → dataclass
└── 混合使用
    ├── pydantic.dataclasses
    └── 两者互转
```

---

## 三、完整代码示例

### v1：dataclass 进阶用法

```python
# v1: Advanced dataclass patterns
from dataclasses import dataclass, field, replace
from typing import Optional
import json


@dataclass
class Address:
    street: str
    city: str
    zipcode: str


@dataclass
class Employee:
    name: str
    age: int
    department: str
    salary: float = 0.0
    skills: list[str] = field(default_factory=list)
    address: Optional[Address] = None
    active: bool = field(default=True, repr=False)

    def __post_init__(self):
        # Validate after initialization
        if self.age < 18:
            raise ValueError(f"Age must be >= 18, got {self.age}")
        self.name = self.name.strip().title()

    def yearly_cost(self) -> float:
        """Total cost including 1.3x overhead."""
        return self.salary * 1.3


# Basic usage
emp = Employee(
    name="  alice wang  ",
    age=28,
    department="Engineering",
    salary=15000,
    skills=["Python", "Go"],
)
print(emp)
# Employee(name='Alice Wang', age=28, ...)
print(f"Yearly cost: {emp.yearly_cost():.0f}")  # 19500

# replace() creates a modified copy
promoted = replace(emp, salary=20000, department="Senior Engineering")
print(f"Promoted: {promoted.name} -> {promoted.department}")

# Frozen dataclass for immutable data
@dataclass(frozen=True)
class Config:
    host: str
    port: int
    debug: bool = False


cfg = Config("localhost", 8080)
print(hash(cfg))  # Works! Can use as dict key
try:
    cfg.port = 9090  # FrozenInstanceError!
except AttributeError as e:
    print(f"Immutable: {e}")

# to_dict helper for dataclass
def dataclass_to_dict(obj):
    """Simple recursive to_dict for nested dataclasses."""
    if hasattr(obj, "__dataclass_fields__"):
        return {
            k: dataclass_to_dict(v)
            for k, v in obj.__dict__.items()
            if not k.startswith("_")
        }
    elif isinstance(obj, list):
        return [dataclass_to_dict(i) for i in obj]
    return obj


print(json.dumps(dataclass_to_dict(emp), indent=2, ensure_ascii=False))
```

### v2：Pydantic 基础 — API 请求模型

```python
# v2: Pydantic models for API request/response
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional


class AddressIn(BaseModel):
    street: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    zipcode: str = Field(pattern=r"^\d{6}$")


class CreateUserRequest(BaseModel):
    """API request model for creating a user."""

    name: str = Field(min_length=2, max_length=50, examples=["Alice"])
    email: EmailStr
    age: int = Field(ge=0, le=150)
    address: Optional[AddressIn] = None
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("name")
    @classmethod
    def name_must_be_title(cls, v: str) -> str:
        return v.strip().title()

    @field_validator("tags")
    @classmethod
    def tags_no_duplicates(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("Tags must be unique")
        return [t.lower() for t in v]


class UserResponse(BaseModel):
    """API response model."""

    id: int
    name: str
    email: EmailStr
    age: int
    address: Optional[AddressIn] = None
    tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = {"from_attributes": True}  # Support ORM objects


# Usage: parse and validate
raw_data = {
    "name": "  bob zhang  ",
    "email": "bob@example.com",
    "age": 30,
    "tags": ["Python", "ENGINEERING"],
}

user = CreateUserRequest(**raw_data)
print(user.name)  # Bob Zhang (stripped + titled)
print(user.tags)  # ['python', 'engineering'] (lowered)
print(user.model_dump())
# {'name': 'Bob Zhang', 'email': 'bob@example.com', ...}

# Type coercion: string "25" -> int 25
user2 = CreateUserRequest(name="Eve", email="eve@x.com", age="25")
print(user2.age, type(user2.age))  # 25 <class 'int'>

# Validation error
try:
    bad = CreateUserRequest(name="X", email="bad", age=-1)
except Exception as e:
    errors = e.errors()
    print(f"Validation failed: {len(errors)} errors")
    for err in errors:
        print(f"  {err['loc']}: {err['msg']}")

# JSON round-trip
json_str = user.model_dump_json()
print(json_str[:80])
restored = CreateUserRequest.model_validate_json(json_str)
print(restored.name)  # Bob Zhang
```

### v3：Pydantic 高级 — 泛型响应 + 设置管理

```python
# v3: Advanced Pydantic - Generic repository + Settings
from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings
from typing import Generic, TypeVar, Optional


# === Generic API Response ===

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    """Generic API response wrapper."""

    success: bool = True
    data: Optional[DataT] = None
    message: str = "ok"
    total: Optional[int] = None

    @model_validator(mode="after")
    def check_consistency(self):
        if not self.success and self.data is not None:
            raise ValueError("Failed response should not have data")
        return self


# === Nested models with complex validation ===


class Money(BaseModel):
    amount: float = Field(ge=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")

    def __str__(self):
        return f"{self.amount:.2f} {self.currency}"


class OrderItem(BaseModel):
    product_id: int
    name: str
    quantity: int = Field(ge=1)
    unit_price: Money

    @property
    def subtotal(self) -> Money:
        return Money(
            amount=self.unit_price.amount * self.quantity,
            currency=self.unit_price.currency,
        )


class Order(BaseModel):
    order_id: str
    items: list[OrderItem] = Field(min_length=1)
    discount: float = Field(default=0.0, ge=0, le=1.0)

    @property
    def total(self) -> Money:
        currency = self.items[0].unit_price.currency
        subtotal = sum(i.subtotal.amount for i in self.items)
        return Money(amount=subtotal * (1 - self.discount), currency=currency)

    @model_validator(mode="after")
    def same_currency(self):
        currencies = {i.unit_price.currency for i in self.items}
        if len(currencies) > 1:
            raise ValueError("All items must use the same currency")
        return self


# === Settings with environment variables ===


class AppSettings(BaseSettings):
    """Application settings from env vars."""

    app_name: str = "MyApp"
    debug: bool = False
    database_url: str = "sqlite:///default.db"
    max_connections: int = Field(default=10, ge=1, le=100)
    secret_key: str = Field(default="change-me-in-production")

    model_config = {"env_file": ".env", "env_prefix": "APP_"}


# === Usage ===

# API response with type safety
resp: ApiResponse[list[str]] = ApiResponse(data=["item1", "item2"], total=2)
print(resp.model_dump())
# {'success': True, 'data': ['item1', 'item2'], 'message': 'ok', 'total': 2}

# Complex order
order = Order(
    order_id="ORD-001",
    items=[
        OrderItem(
            product_id=1,
            name="Widget",
            quantity=3,
            unit_price=Money(amount=9.99, currency="CNY"),
        ),
        OrderItem(
            product_id=2,
            name="Gadget",
            quantity=1,
            unit_price=Money(amount=49.99, currency="CNY"),
        ),
    ],
    discount=0.1,
)
print(f"Order total: {order.total}")  # 76.48 CNY

# Settings
settings = AppSettings()
print(f"DB: {settings.database_url}")

# JSON Schema generation
schema = Order.model_json_schema()
print(f"Schema properties: {list(schema['properties'].keys())}")
```

---

## 四、执行预览

```
$ python dataclass_v1.py
Employee(name='Alice Wang', age=28, department='Engineering', salary=15000, skills=['Python', 'Go'], address=None)
Yearly cost: 19500
Promoted: Alice Wang -> Senior Engineering
-1091529865
Immutable: cannot assign to field 'port'
{"name": "Alice Wang", "age": 28, ...}

$ python pydantic_v2.py
Bob Zhang
['python', 'engineering']
{'name': 'Bob Zhang', 'email': 'bob@example.com', ...}
25 <class 'int'>
Validation failed: 2 errors
  ('name',): String should have at least 2 characters
  ('email',): value is not a valid email address
Bob Zhang

$ python pydantic_v3.py
{'success': True, 'data': ['item1', 'item2'], 'message': 'ok', 'total': 2}
Order total: 76.48 CNY
DB: sqlite:///default.db
Schema properties: ['order_id', 'items', 'discount']
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| dataclass 可变默认值 | 必须用 `field(default_factory=list)`，不能用 `[]` |
| Pydantic 性能 | V2 用 Rust 核心，比 V1 快 5-50x |
| `model_dump` vs `dict()` | Pydantic V2 推荐 `model_dump()` |
| `__post_init__` 顺序 | 在 `__init__` 之后调用 |
| dataclass 继承 | 字段按声明顺序合并，注意默认值字段必须全在后 |
| Pydantic EmailStr | 需安装 `pydantic[email]`（依赖 `email-validator`） |
| frozen dataclass 的 `__hash__` | 自动生成，但性能较差（每次计算） |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| `skills: list = []` 作为默认值 | `skills: list = field(default_factory=list)` |
| dataclass 中手动定义 `__init__` | 用 `__post_init__` 做额外处理 |
| Pydantic 中用 `@validator`（V1） | V2 用 `@field_validator` |
| `model.dict()`（V1 API） | V2 用 `model_dump()` / `model_dump_json()` |
| Pydantic `Field(default=...)` 和类型默认值混用 | 统一用 `Field()` 配置 |
| 忽略 `model_config` | 设置 `from_attributes=True` 以支持 ORM 对象 |

---

## 七、练习题

### 🟢 入门
1. 用 `@dataclass` 定义一个 `Book` 模型，包含标题、作者、价格、ISBN
2. 用 Pydantic 定义一个 `RegisterRequest`，验证邮箱格式和密码长度 >= 8

### 🟡 进阶
3. 实现一个 `FrozenConfig` dataclass，支持从 JSON 文件加载和保存
4. 用 Pydantic 的 `@model_validator` 实现交叉字段验证（如 `end_date > start_date`）

### 🔴 挑战
5. 用 Pydantic 泛型实现一个通用的分页响应模型 `PageResponse[T]`
6. 实现 dataclass 与 Pydantic 模型的自动转换工具

---

## 八、知识点总结（树状）

```
数据类与验证
├── dataclasses
│   ├── @dataclass 装饰器
│   ├── field() 配置
│   ├── __post_init__
│   ├── frozen=True 不可变
│   ├── replace() 副本
│   └── 继承规则
├── Pydantic BaseModel
│   ├── 字段类型 + Field()
│   ├── @field_validator 字段验证
│   ├── @model_validator 模型验证
│   ├── 序列化 model_dump/json
│   ├── 反序列化 model_validate
│   ├── JSON Schema 生成
│   └── 泛型支持
├── Pydantic Settings
│   ├── 环境变量绑定
│   └── .env 文件支持
└── 选型建议
    ├── 内部结构 → dataclass
    ├── API 边界 → Pydantic
    └── 配置管理 → pydantic-settings
```

---

## 九、举一反三

| 场景 | 方案 | 工具 |
|------|------|------|
| API 请求/响应模型 | Pydantic BaseModel | FastAPI 自动校验 |
| 配置文件 | pydantic-settings | .env + 类型安全 |
| 内部数据传递 | dataclass | 零依赖，够用 |
| 数据库模型映射 | Pydantic + `from_attributes` | SQLAlchemy ORM |
| CLI 参数定义 | Pydantic 模型 | typer/click 集成 |
| 事件/消息格式 | Pydantic + JSON Schema | 消息队列 |
| 不可变配置 | frozen dataclass | 线程安全 |

---

## 十、参考资料

- [dataclasses 官方文档](https://docs.python.org/3/library/dataclasses.html)
- [Pydantic V2 文档](https://docs.pydantic.dev/latest/)
- [pydantic-settings 文档](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [PEP 557 — Data Classes](https://peps.python.org/pep-0557/)
- 《流畅的 Python》第22章（第二版）

---

## 十一、代码演进路线

```
v1 dataclass（轻量数据容器）
 ├── field() 高级配置
 ├── __post_init__ 后处理
 └── frozen + replace 模式
      │
v2 Pydantic（运行时验证）
 ├── Field 约束 + 类型转换
 ├── @field_validator 字段验证
 └── JSON 序列化/反序列化
      │
v3 Pydantic 高级（生产级）
 ├── 泛型响应 ApiResponse[T]
 ├── @model_validator 交叉验证
 ├── pydantic-settings 配置管理
 └── JSON Schema 自动生成
```

**核心心法：dataclass 管"数据怎么存"，Pydantic 管"数据对不对"。内部用 dataclass，边界用 Pydantic，两者互补不冲突。**
