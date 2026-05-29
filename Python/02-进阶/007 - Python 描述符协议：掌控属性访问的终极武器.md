---
title: "007 - Python 描述符协议：掌控属性访问的终极武器"
slug: "007-descriptors"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.384+08:00"
updated_at: "2026-04-29T10:02:47.56+08:00"
reading_time: 29
tags: []
---

# Python 描述符协议：掌控属性访问的终极武器

> **难度：⭐⭐⭐⭐（高级）**
> **前置知识：** 属性访问机制、`__getattribute__`、装饰器、元类基础

---

## 一、概念讲解

描述符（Descriptor）是 Python 中最强大的协议之一，它是 `property`、`classmethod`、`staticmethod`、`__slots__` 等特性的底层实现机制。

简单来说：**一个实现了 `__get__`、`__set__` 或 `__delete__` 方法的类，其实例可以作为另一个类的属性，并在属性访问时自动触发这些方法。**

### 两种描述符

| 类型 | 实现方法 | 优先级 |
|------|---------|--------|
| **数据描述符** | `__get__` + `__set__`（或 `__delete__`） | 高于实例字典 |
| **非数据描述符** | 仅 `__get__` | 低于实例字典 |

这是 Python 属性查找顺序的核心规则：

```
数据描述符 > 实例 __dict__ > 非数据描述符 > 类 __dict__ > __getattr__
```

### 为什么需要描述符？

- **代码复用**：多个属性共享相同的验证/计算逻辑
- **优雅 API**：隐藏复杂的 get/set 逻辑，暴露简单的属性接口
- **框架基础**：ORM 字段、类型验证器、延迟加载都依赖描述符

---

## 二、脑图（ASCII）

```
描述符协议 Descriptor Protocol
├── 核心协议方法
│   ├── __get__(self, obj, objtype=None) → value
│   ├── __set__(self, obj, value) → None
│   └── __delete__(self, obj) → None
├── 两种类型
│   ├── 数据描述符（Data Descriptor）
│   │   └── 同时定义 __get__ + __set__/__delete__
│   │   └── 优先级高于实例 __dict__
│   └── 非数据描述符（Non-Data Descriptor）
│       └── 仅定义 __get__
│       └── 优先级低于实例 __dict__
├── 属性查找顺序
│   ├── 1. 数据描述符的 __get__
│   ├── 2. 实例 __dict__
│   ├── 3. 非数据描述符的 __get__
│   └── 4. 类的 __getattr__
├── 经典应用
│   ├── property（内置描述符）
│   ├── classmethod / staticmethod
│   ├── ORM 字段（SQLAlchemy, Django）
│   ├── 类型验证
│   └── 延迟加载（Lazy Loading）
└── __set_name__（Python 3.6+）
    └── 自动获取属性名
```

---

## 三、完整代码示例

### v1：基础描述符 — 类型验证

```python
# v1: Basic descriptor for type validation
class TypedField:
    """A descriptor that enforces type checking."""

    def __init__(self, expected_type, name=None):
        self.expected_type = expected_type
        self.name = name

    def __set_name__(self, owner, name):
        # Automatically called when descriptor is assigned to a class attribute
        if self.name is None:
            self.name = name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self  # Access via class returns descriptor itself
        return obj.__dict__.get(self.name)

    def __set__(self, obj, value):
        if not isinstance(value, self.expected_type):
            raise TypeError(
                f"{self.name} expected {self.expected_type.__name__}, "
                f"got {type(value).__name__}"
            )
        obj.__dict__[self.name] = value

    def __delete__(self, obj):
        raise AttributeError(f"Cannot delete {self.name}")


# Usage
class Person:
    name = TypedField(str)
    age = TypedField(int)

    def __init__(self, name, age):
        self.name = name
        self.age = age


p = Person("Alice", 30)
print(p.name)  # Alice
try:
    p.age = "thirty"  # TypeError!
except TypeError as e:
    print(e)
```

### v2：可复用的验证描述符工厂

```python
# v2: Reusable descriptor factory with multiple validators
from functools import partial


class Validated:
    """Base descriptor with validation chain."""

    def __init__(self, *validators, name=None):
        self.validators = validators
        self.name = name

    def __set_name__(self, owner, name):
        if self.name is None:
            self.name = name
        # Store value in private storage key to avoid conflicts
        self.storage_name = f"_validated_{name}"

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.storage_name, None)

    def __set__(self, obj, value):
        for validator in self.validators:
            validator(self.name, value)
        setattr(obj, self.storage_name, value)


# Validator functions
def type_check(name, value, expected_type):
    if not isinstance(value, expected_type):
        raise TypeError(f"{name} must be {expected_type.__name__}")


def min_value(name, value, minimum):
    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")


def max_length(name, value, maximum):
    if len(value) > maximum:
        raise ValueError(f"{name} must be <= {maximum} chars")


# Descriptor factories for convenience
def Typed(expected_type):
    return Validated(partial(type_check, expected_type=expected_type))


def Bounded(expected_type, min_val=None, max_len=None):
    validators = [partial(type_check, expected_type=expected_type)]
    if min_val is not None:
        validators.append(partial(min_value, minimum=min_val))
    if max_len is not None:
        validators.append(partial(max_length, maximum=max_len))
    return Validated(*validators)


class Product:
    name = Bounded(str, max_len=100)
    price = Bounded(int, min_val=0)
    sku = Typed(str)

    def __init__(self, name, price, sku):
        self.name = name
        self.price = price
        self.sku = sku


p = Product("Widget", 999, "W-001")
print(f"{p.name}: ${p.price}")  # Widget: $999
try:
    p.price = -10  # ValueError!
except ValueError as e:
    print(e)
```

### v3：完整 ORM 风格描述符 + 元类

```python
# v3: ORM-style descriptors with metaclass
class Field:
    """Base field descriptor for ORM-like models."""

    _creation_counter = 0  # Track field order

    def __init__(self, *, required=True, default=None):
        self.required = required
        self.default = default
        Field._creation_counter += 1
        self._counter = Field._creation_counter

    def __set_name__(self, owner, name):
        self.name = name
        self.storage_key = f"_field_{name}"

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return getattr(obj, self.storage_key, self.default)

    def __set__(self, obj, value):
        self.validate(value)
        setattr(obj, self.storage_key, value)

    def validate(self, value):
        if value is None and self.required:
            raise ValueError(f"{self.name} is required")


class StringField(Field):
    def __init__(self, min_len=0, max_len=255, **kwargs):
        super().__init__(**kwargs)
        self.min_len = min_len
        self.max_len = max_len

    def validate(self, value):
        super().validate(value)
        if value is not None:
            if not isinstance(value, str):
                raise TypeError(f"{self.name} must be str")
            if len(value) < self.min_len:
                raise ValueError(f"{self.name} too short")
            if len(value) > self.max_len:
                raise ValueError(f"{self.name} too long")


class IntegerField(Field):
    def __init__(self, min_val=None, max_val=None, **kwargs):
        super().__init__(**kwargs)
        self.min_val = min_val
        self.max_val = max_val

    def validate(self, value):
        super().validate(value)
        if value is not None:
            if not isinstance(value, int):
                raise TypeError(f"{self.name} must be int")
            if self.min_val is not None and value < self.min_val:
                raise ValueError(f"{self.name} too small")
            if self.max_val is not None and value > self.max_val:
                raise ValueError(f"{self.name} too large")


class ModelMeta(type):
    """Metaclass that collects field descriptors."""

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        fields = {}
        for key, value in list(namespace.items()):
            if isinstance(value, Field):
                fields[key] = value
        for base in bases:
            if hasattr(base, "_fields"):
                fields.update(base._fields)
        cls._fields = fields
        return cls


class Model(metaclass=ModelMeta):
    """Base model using descriptors."""

    def __init__(self, **kwargs):
        # Set defaults for all fields first
        for name, field in self._fields.items():
            if name not in kwargs:
                if field.default is not None:
                    setattr(self, name, field.default)
                elif not field.required:
                    setattr(self, name, None)
        # Set provided values (triggers validation)
        for key, value in kwargs.items():
            if key in self._fields:
                setattr(self, key, value)
            else:
                raise AttributeError(f"Unknown field: {key}")

    def to_dict(self):
        return {name: getattr(self, name) for name in self._fields}

    def __repr__(self):
        fields = ", ".join(f"{k}={v!r}" for k, v in self.to_dict().items())
        return f"{self.__class__.__name__}({fields})"


# Define a model
class User(Model):
    username = StringField(min_len=3, max_len=50, required=True)
    email = StringField(min_len=5, max_len=255, required=True)
    age = IntegerField(min_val=0, max_val=150, required=False, default=0)


# Usage
u = User(username="alice", email="alice@example.com", age=28)
print(u)
# User(username='alice', email='alice@example.com', age=28)
print(u.to_dict())
# {'username': 'alice', 'email': 'alice@example.com', 'age': 28}

try:
    bad = User(username="x", email="bad")
except (ValueError, TypeError) as e:
    print(f"Validation failed: {e}")
```

---

## 四、执行预览

```
$ python descriptor_v1.py
Alice
age expected int, got str

$ python descriptor_v2.py
Widget: $999
price must be >= 0

$ python descriptor_v3.py
User(username='alice', email='alice@example.com', age=28)
{'username': 'alice', 'email': 'alice@example.com', 'age': 28}
Validation failed: username too short
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| 描述符必须是类属性 | 定义在 `__init__` 里的描述符不会工作 |
| `__set_name__` 仅 3.6+ | 旧版本需手动传 name 参数 |
| 存储位置避免冲突 | 用 `obj.__dict__[private_key]` 而非直接属性 |
| `obj=None` 时返回自身 | 类级别访问应返回描述符对象本身 |
| 非数据描述符可被覆盖 | 实例可以 `obj.attr = x` 覆盖非数据描述符 |
| `__slots__` 与描述符 | `__slots__` 中的描述符行为可能不同 |
| 描述符实例共享 | 同一个描述符实例被所有类实例共享 |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| 在描述符 `__set__` 中用 `setattr(obj, self.name, value)` 导致无限递归 | 用 `obj.__dict__[self.storage_key] = value` |
| 忘记处理 `obj is None` 的情况 | 在 `__get__` 中判断，类访问返回 `self` |
| 用同一个描述符实例在多个类中 | 每个属性用独立的描述符实例 |
| 只定义 `__set__` 不定义 `__get__` | 数据描述符建议两个都实现 |
| 在 `__set_name__` 中做复杂操作 | 保持简单，仅记录名称 |
| 期望描述符在实例字典中可见 | 描述符是类属性，值存储在实例字典的自定义键中 |

---

## 七、练习题

### 🟢 入门
1. 实现一个 `ReadOnly` 描述符，首次赋值后不允许修改
2. 实现一个 `Positive` 描述符，确保数值始终为正数

### 🟡 进阶
3. 实现一个 `Lazy` 描述符，首次访问时才计算值并缓存
4. 用描述符实现一个简单的单位转换（存储时转为基础单位，读取时转为显示单位）

### 🔴 挑战
5. 实现一个 `CachedProperty` 描述符，支持 TTL 过期机制
6. 结合元类，实现一个自动序列化/反序列化的描述符框架

---

## 八、知识点总结（树状）

```
描述符协议
├── 协议方法
│   ├── __get__(self, obj, type) → 被读取时调用
│   ├── __set__(self, obj, value) → 被赋值时调用
│   ├── __delete__(self, obj) → 被 del 时调用
│   └── __set_name__(self, owner, name) → 3.6+ 自动获取属性名
├── 分类
│   ├── 数据描述符：有 __set__ 或 __delete__
│   └── 非数据描述符：只有 __get__
├── 查找优先级
│   ├── 数据描述符 > 实例字典 > 非数据描述符 > 类属性
│   └── 通过 __getattribute__ 实现
├── 实际应用
│   ├── property = 简化的数据描述符
│   ├── classmethod/staticmethod = 非数据描述符
│   ├── ORM 字段映射
│   └── 类型验证/约束
└── 最佳实践
    ├── 用 obj.__dict__ 存储值，避免无限递归
    ├── 处理 obj=None 的类级别访问
    └── 用 __set_name__ 自动获取属性名
```

---

## 九、举一反三

| 场景 | 描述符方案 | 类似技术 |
|------|-----------|---------|
| 属性值验证 | `TypedField` 描述符 | `property` + setter |
| 延迟计算 | `LazyProperty` 描述符 | `functools.cached_property` |
| ORM 字段映射 | `Column` 描述符 | SQLAlchemy `Column` |
| 访问日志 | `Traced` 描述符 | `__getattribute__` 覆写 |
| 单位转换 | `Unit` 描述符 | 自定义 `__set__`/`__get__` |
| 只读属性 | `ReadOnly` 描述符 | `property`（只定义 getter） |
| 缓存+过期 | `TTLCache` 描述符 | `cachetools.TTLCache` |

---

## 十、参考资料

- [Python 官方文档 — Descriptor HowTo Guide](https://docs.python.org/3/howto/descriptor.html)
- [PEP 487 — Simpler customization of class creation](https://peps.python.org/pep-0487/)
- 《流畅的 Python》第20章：属性描述符
- [Python Descriptors Deep Dive — Real Python](https://realpython.com/python-descriptors/)

---

## 十一、代码演进路线

```
v1 TypedField（基础类型检查）
 ├── 学会 __get__/__set__/__set_name__ 协议
 └── 理解数据描述符优先级
      │
v2 Validated（验证器链）
 ├── 组合多个验证器
 └── 用 partial 构建工厂函数
      │
v3 Model（ORM 风格框架）
 ├── 元类收集字段
 ├── 自动验证 + 序列化
 └── 逼近日产框架的架构模式
```

**核心心法：描述符是 Python 属性机制的基石，掌握它就是掌握了 Python 面向对象的精髓。**
