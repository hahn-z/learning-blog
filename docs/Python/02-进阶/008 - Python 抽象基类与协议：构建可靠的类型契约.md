---
title: "008 - Python 抽象基类与协议：构建可靠的类型契约"
slug: "008-abc"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.39+08:00"
updated_at: "2026-04-29T10:02:47.567+08:00"
reading_time: 24
tags: []
---

# Python 抽象基类与协议：构建可靠的类型契约

> **难度：⭐⭐⭐⭐（高级）**
> **前置知识：** 继承、多态、类型注解、鸭子类型

---

## 一、概念讲解

Python 有两种方式定义接口契约：**抽象基类（ABC）** 和 **协议（Protocol）**。

### 抽象基类（ABC）

`abc.ABC` + `@abstractmethod` 定义"必须实现"的方法。子类不实现就**无法实例化**。

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

    @abstractmethod
    def perimeter(self) -> float: ...

# Shape()  → TypeError: Can't instantiate abstract class
# class Circle(Shape): pass
# Circle() → TypeError: area, perimeter not implemented
```

### 协议（Protocol）— 结构化子类型

Python 3.8+ 引入 `typing.Protocol`，基于**结构化类型**（鸭子类型的类型检查版本）：

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...

class MyWidget:  # No inheritance needed!
    def draw(self) -> None:
        print("drawing")

def render(d: Drawable) -> None:
    d.draw()  # Works with MyWidget!
```

### ABC vs Protocol 对比

| 特性 | ABC | Protocol |
|------|-----|----------|
| 类型检查方式 | 名义类型（需继承） | 结构类型（不需继承） |
| 运行时检查 | `isinstance()` 支持 | `isinstance()` 需 `@runtime_checkable` |
| 强制实现 | 不实现无法实例化 | 纯类型提示，不强制 |
| Python 版本 | 全版本 | 3.8+ |
| 适用场景 | 框架/库定义接口 | 函数参数类型约束 |
| 耦合度 | 较高（需显式继承） | 较低（只需实现方法） |

---

## 二、脑图（ASCII）

```
抽象基类与协议
├── 抽象基类（ABC）
│   ├── abc.ABC 基类
│   ├── @abstractmethod
│   ├── @abstractclassmethod / @abstractstaticmethod
│   ├── @abstractproperty
│   ├── 注册虚拟子类 .register()
│   └── __subclasshook__() 自定义 isinstance 行为
├── 协议（Protocol）
│   ├── typing.Protocol（Python 3.8+）
│   ├── 结构化子类型
│   ├── @runtime_checkable
│   ├── Protocol 继承
│   └── 与 ABC 的互操作
├── 核心区别
│   ├── 名义类型 vs 结构类型
│   ├── 显式继承 vs 隐式满足
│   └── 运行时强制 vs 类型提示
└── 选择策略
    ├── 库的公共接口 → ABC
    ├── 内部代码/函数签名 → Protocol
    └── 两者结合 → 灵活运用
```

---

## 三、完整代码示例

### v1：基础 ABC — 定义图形接口

```python
# v1: Basic ABC for shapes
from abc import ABC, abstractmethod
import math


class Shape(ABC):
    """Abstract base class for all shapes."""

    @abstractmethod
    def area(self) -> float:
        """Calculate the area."""
        ...

    @abstractmethod
    def perimeter(self) -> float:
        """Calculate the perimeter."""
        ...

    def describe(self) -> str:
        """Concrete method shared by all shapes."""
        return f"{self.__class__.__name__}: area={self.area():.2f}, perimeter={self.perimeter():.2f}"


class Circle(Shape):
    def __init__(self, radius: float):
        self.radius = radius

    def area(self) -> float:
        return math.pi * self.radius ** 2

    def perimeter(self) -> float:
        return 2 * math.pi * self.radius


class Rectangle(Shape):
    def __init__(self, width: float, height: float):
        self.width = width
        self.height = height

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)


# Usage
shapes = [Circle(5), Rectangle(3, 4)]
for s in shapes:
    print(s.describe())
# Circle: area=78.54, perimeter=31.42
# Rectangle: area=12.00, perimeter=14.00

# isinstance works with ABC
print(isinstance(shapes[0], Shape))  # True
```

### v2：Protocol + 运行时检查

```python
# v2: Protocol-based design with runtime checks
from typing import Protocol, runtime_checkable


@runtime_checkable
class Closeable(Protocol):
    """Anything with a close() method."""

    def close(self) -> None: ...


@runtime_checkable
class Renderable(Protocol):
    """Anything with a render() method returning str."""

    def render(self) -> str: ...


class HtmlDocument:
    def __init__(self, content: str):
        self.content = content

    def render(self) -> str:
        return f"<html><body>{self.content}</body></html>"

    def close(self) -> None:
        print("Document closed")


class PdfReport:
    def __init__(self, data: dict):
        self.data = data

    def render(self) -> str:
        return f"PDF Report: {len(self.data)} items"


def display(obj: Renderable) -> None:
    print(obj.render())


def safe_close(obj: Closeable) -> None:
    obj.close()


# Structural typing - no inheritance needed
doc = HtmlDocument("Hello World")
report = PdfReport({"a": 1, "b": 2})

display(doc)  # <html><body>Hello World</body></html>
display(report)  # PDF Report: 2 items

# Runtime checks
print(isinstance(doc, Renderable))  # True
print(isinstance(doc, Closeable))  # True
print(isinstance(report, Closeable))  # False
```

### v3：混合架构 — ABC + Protocol + 虚拟子类

```python
# v3: Mixed architecture with ABC, Protocol, and virtual subclasses
from abc import ABC, abstractmethod
from typing import Protocol, runtime_checkable, Optional
from dataclasses import dataclass


# === Protocol Layer: Lightweight contracts ===

@runtime_checkable
class Serializable(Protocol):
    def to_dict(self) -> dict: ...


@runtime_checkable
class Validatable(Protocol):
    def validate(self) -> bool: ...


# === ABC Layer: Framework enforcement ===

class StorageBackend(ABC):
    """Abstract base for storage backends."""

    @abstractmethod
    def save(self, key: str, data: dict) -> bool: ...

    @abstractmethod
    def load(self, key: str) -> Optional[dict]: ...

    @abstractmethod
    def delete(self, key: str) -> bool: ...

    # Template method pattern
    def save_validated(self, key: str, obj: Validatable) -> bool:
        """Template: validate before save."""
        if not obj.validate():
            raise ValueError(f"Validation failed for {key}")
        data = obj.to_dict()
        return self.save(key, data)


class MemoryStorage(StorageBackend):
    def __init__(self):
        self._store: dict[str, dict] = {}

    def save(self, key: str, data: dict) -> bool:
        self._store[key] = data
        return True

    def load(self, key: str) -> Optional[dict]:
        return self._store.get(key)

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None


# === Domain Model ===

@dataclass
class User:
    name: str
    email: str
    age: int

    def validate(self) -> bool:
        return (
            len(self.name) >= 2
            and "@" in self.email
            and 0 <= self.age <= 150
        )

    def to_dict(self) -> dict:
        return {"name": self.name, "email": self.email, "age": self.age}

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        return cls(**data)


# === Usage ===

storage = MemoryStorage()
user = User("Alice", "alice@example.com", 28)

# Template method handles validation + serialization
storage.save_validated("user:1", user)
loaded = storage.load("user:1")
print(loaded)
# {'name': 'Alice', 'email': 'alice@example.com', 'age': 28}

# Protocol checks
print(isinstance(user, Validatable))  # True
print(isinstance(user, Serializable))  # True
print(isinstance(storage, StorageBackend))  # True

# Invalid user
bad_user = User("", "bad", 999)
try:
    storage.save_validated("user:2", bad_user)
except ValueError as e:
    print(f"Rejected: {e}")
# Rejected: Validation failed for user:2
```

---

## 四、执行预览

```
$ python abc_v1.py
Circle: area=78.54, perimeter=31.42
Rectangle: area=12.00, perimeter=14.00
True

$ python abc_v2.py
<html><body>Hello World</body></html>
PDF Report: 2 items
True
True
False

$ python abc_v3.py
{'name': 'Alice', 'email': 'alice@example.com', 'age': 28}
True
True
True
Rejected: Validation failed for user:2
```

---

## 五、注意事项

| 注意点 | 说明 |
|--------|------|
| `@abstractmethod` 必须在最内层 | 与 `@classmethod` 等叠放时，`@abstractmethod` 放最内层 |
| ABC 子类必须实现全部抽象方法 | 否则实例化报 `TypeError` |
| Protocol 不强制实现 | 它是类型提示，运行时不检查（除非 `@runtime_checkable`） |
| `@runtime_checkable` 只检查方法存在 | 不检查签名（参数、返回值） |
| `register()` 不检查实现 | 虚拟子类只是让 `isinstance` 返回 `True` |
| Protocol 不能用作运行时约束 | 需要强制约束用 ABC |

---

## 六、避坑指南

| ❌ 常见错误 | ✅ 正确做法 |
|-------------|------------|
| ABC 中抽象方法有实现体 | 抽象方法用 `...` 或 `raise NotImplementedError` |
| 期望 Protocol 运行时强制检查 | 需要强制用 ABC，Protocol 是类型提示工具 |
| `@abstractmethod` 放在 `@classmethod` 外面 | `@abstractmethod` 必须是最内层装饰器 |
| 用 ABC 限制所有接口 | 内部代码用 Protocol 更灵活 |
| `isinstance(x, SomeProtocol)` 不加 `@runtime_checkable` | 加装饰器或改用类型检查器（mypy） |
| 忘记 `super().__init__()` | ABC 的 `__init__` 也应被调用（如有） |

---

## 七、练习题

### 🟢 入门
1. 定义一个 `Logger` ABC，要求实现 `info(msg)` 和 `error(msg)` 方法
2. 定义一个 `Named` Protocol，要求有 `name: str` 属性

### 🟡 进阶
3. 用 `register()` 让一个第三方类虚拟继承你的 ABC
4. 实现一个 `__subclasshook__` 让任何有 `to_json()` 方法的类自动成为 `Jsonable` 的子类

### 🔴 挑战
5. 设计一个插件系统：用 ABC 定义插件接口，用 Protocol 定义扩展点，支持动态加载
6. 用 Protocol + 泛型实现一个类型安全的仓储模式（Repository Pattern）

---

## 八、知识点总结（树状）

```
抽象基类与协议
├── ABC（abc 模块）
│   ├── ABC 基类
│   ├── @abstractmethod
│   ├── .register() 虚拟子类
│   └── __subclasshook__() 自定义子类判断
├── Protocol（typing 模块）
│   ├── 结构化类型
│   ├── @runtime_checkable
│   └── Protocol 继承
├── 设计模式
│   ├── 模板方法（ABC + 具体方法）
│   ├── 接口隔离（多个小 Protocol）
│   └── 依赖倒置（依赖 ABC/Protocol）
└── 类型检查
    ├── isinstance() 运行时
    └── mypy 静态分析
```

---

## 九、举一反三

| 场景 | 推荐方案 | 示例 |
|------|---------|------|
| 框架公共接口 | ABC | Django ORM Model、Flask View |
| 函数参数约束 | Protocol | `def process(s: Serializable)` |
| 运行时类型判断 | ABC + `isinstance` | 插件系统 |
| 静态类型安全 | Protocol + mypy | 代码质量保障 |
| 混合架构 | ABC 核心 + Protocol 扩展 | 微服务接口 |
| 向后兼容 | `register()` 虚拟子类 | 适配旧代码 |

---

## 十、参考资料

- [Python 官方文档 — abc 模块](https://docs.python.org/3/library/abc.html)
- [PEP 544 — Protocols](https://peps.python.org/pep-0544/)
- [typing — Protocol 官方文档](https://docs.python.org/3/library/typing.html#protocols)
- 《流畅的 Python》第13章：接口、协议和 ABC
- [Mypy Protocol 文档](https://mypy.readthedocs.io/en/stable/protocols.html)

---

## 十一、代码演进路线

```
v1 Shape ABC（基础抽象）
 ├── @abstractmethod 强制实现
 └── 具体方法复用（模板方法雏形）
      │
v2 Protocol（结构化类型）
 ├── 不需继承，鸭子类型 + 类型安全
 └── @runtime_checkable 运行时支持
      │
v3 混合架构（实战级）
 ├── ABC 框架层 + Protocol 扩展层
 ├── 模板方法模式
 └── dataclass + Protocol 组合
```

**核心心法：ABC 管的是"你必须是什么"，Protocol 管的是"你能做什么"。两者互补，选对工具是关键。**
