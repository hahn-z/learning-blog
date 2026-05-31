---
title: "019 - Python 类型系统深入：泛型、Protocol、TypeGuard、overload、ParamSpec"
slug: "019-type-system"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.452+08:00"
updated_at: "2026-04-29T10:02:47.653+08:00"
reading_time: 19
tags: []
---

# Python 类型系统深入

> **难度：★★★★☆ 高级**
> 深入 Python 类型系统：泛型、Protocol、类型体操、TypeVar、overload、TypeGuard 等高级特性。

## 一、概念讲解

Python 3.12+ 的类型系统已经非常强大，结合 `mypy` 或 `pyright` 可以在编译期捕获大量错误，同时保持 Python 的灵活性。

**类型系统层级：**

| 层级 | 特性 | 示例 |
|------|------|------|
| 基础 | 内置类型注解 | `int`, `str`, `list[int]` |
| 中级 | Optional, Union, TypeVar | `int | None`, `T` |
| 高级 | Generic, Protocol, overload | `class Stack(Generic[T])` |
| 专家 | TypeGuard, TypeVarTuple, ParamSpec | 类型缩小、高阶函数类型 |

## 二、脑图

```
类型系统
├── 基础注解
│   ├── 变量注解
│   ├── 函数注解
│   └── ClassVar
├── 泛型
│   ├── TypeVar
│   ├── Generic[T]
│   └── TypeVarTuple
├── 结构化类型
│   ├── Protocol
│   └── @runtime_checkable
├── 高级特性
│   ├── overload
│   ├── TypeGuard / TypeIs
│   ├── Literal
│   ├── Callable
│   └── ParamSpec
└── 工具链
    ├── mypy
    ├── pyright
    └── py.typed
```

## 三、完整代码

### 3.1 泛型与 TypeVar

```python
"""Generics and TypeVar - reusable typed containers."""

from typing import TypeVar, Generic, Iterable
from collections.abc import Iterator

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")


class Stack(Generic[T]):
    """Type-safe stack implementation."""

    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items.pop()

    def peek(self) -> T | None:
        return self._items[-1] if self._items else None

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterator[T]:
        return reversed(self._items).__iter__()


def first(items: Iterable[T]) -> T | None:
    """Get first item from any iterable, return None if empty."""
    for item in items:
        return item
    return None
```

### 3.2 Protocol（结构化子类型）

```python
"""Protocol - structural subtyping (duck typing for type checkers)."""

from typing import Protocol, runtime_checkable


@runtime_checkable
class Drawable(Protocol):
    """Any object with a draw() method satisfies this protocol."""
    def draw(self) -> str: ...


class Circle:
    def draw(self) -> str:
        return "Drawing circle"


class Rectangle:
    def draw(self) -> str:
        return "Drawing rectangle"


def render_all(shapes: list[Drawable]) -> list[str]:
    """Works with any object that has draw()."""
    return [s.draw() for s in shapes]


# Runtime check with isinstance
def check_drawable(obj) -> None:
    if isinstance(obj, Drawable):
        print(f"{obj.__class__.__name__} is Drawable")
```

### 3.3 函数重载与 TypeGuard

```python
"""overload and TypeGuard - precise type narrowing."""

from typing import overload, TypeGuard


@overload
def parse_value(raw: str) -> str: ...


@overload
def parse_value(raw: int) -> int: ...


@overload
def parse_value(raw: None) -> None: ...


def parse_value(raw: str | int | None) -> str | int | None:
    """Parse input with type-specific behavior."""
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw * 2
    return raw.strip().upper()


# TypeGuard: custom type narrowing
def is_list_of_strings(val: list) -> TypeGuard[list[str]]:
    """Narrow list to list[str] at runtime."""
    return all(isinstance(x, str) for x in val)


def process(items: list):
    if is_list_of_strings(items):
        # Type checker now knows items is list[str]
        return "-".join(items)
    return str(len(items))
```

### 3.4 高级：ParamSpec

```python
"""ParamSpec - type-safe decorator signatures."""

from typing import ParamSpec, TypeVar, Callable

P = ParamSpec("P")
R = TypeVar("R")


def log_calls(func: Callable[P, R]) -> Callable[P, R]:
    """Decorator that preserves the original function signature."""

    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}({args}, {kwargs})")
        return func(*args, **kwargs)

    return wrapper


@log_calls
def add(a: int, b: int) -> int:
    return a + b


@log_calls
def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"
```

### 3.5 dataclass 与类型系统结合

```python
"""Typed dataclass patterns."""

from dataclasses import dataclass, field
from typing import Literal, ClassVar


@dataclass(frozen=True, slots=True)
class Point:
    """Immutable point with slots for memory efficiency."""
    x: float
    y: float
    dimensions: ClassVar[int] = 2

    def distance_to(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5


@dataclass
class APIResponse:
    """Typed API response with Literal for status."""
    status: Literal["success", "error", "pending"]
    data: dict | None = None
    error: str | None = None

    @property
    def is_ok(self) -> bool:
        return self.status == "success"


# Type alias for complex types (Python 3.12+)
type Vector = list[float]
type Matrix = list[Vector]
type JSON = str | int | float | bool | None | list["JSON"] | dict[str, "JSON"]
```

## 四、执行预览

```text
# Generics
>>> s = Stack[int]()
>>> s.push(1); s.push(2); s.pop()
2

# Protocol
>>> render_all([Circle(), Rectangle()])
['Drawing circle', 'Drawing rectangle']
>>> isinstance(Circle(), Drawable)
True

# overload
>>> parse_value("  hello  ")
'HELLO'
>>> parse_value(5)
10
>>> parse_value(None) is None
True

# ParamSpec decorator
>>> add(3, 4)
Calling add((3, 4), {})
7

# Frozen dataclass
>>> p = Point(1.0, 2.0)
>>> p.distance_to(Point(4.0, 6.0))
5.0
```

## 五、注意事项

| 要点 | 说明 |
|-----|------|
| 类型注解不强制 | 运行时不检查，需 mypy/pyright |
| performance | 类型注解不影响运行时性能 |
| 版本差异 | Python 3.9+ 才能用 `list[int]`，3.10+ 才有 `T \| None` |
| Protocol vs ABC | Protocol 是隐式接口（结构化），ABC 是显式（规范化） |
| TypeGuard vs TypeIs | TypeIs 更严格，保证输入输出类型一致 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| `List[int]` (from typing) | `list[int]` (Python 3.9+ 内建) |
| `Optional[int]` | `int \| None` (Python 3.10+ 更清晰) |
| 用 ABC 限制接口 | 用 Protocol 实现结构化类型 |
| `Any` 到处用 | 用 `TypeVar` 或 `object` |
| 忘记 `from __future__ import annotations` | 前置导入避免前向引用问题 |

## 七、练习题

### 🟢 入门
1. 为一个 `Queue[T]` 泛型类添加完整类型注解
2. 定义一个 `Comparable` Protocol，要求实现 `__lt__`

### 🟡 进阶
3. 用 `overload` 实现一个 `getattr_safe` 函数，有属性时返回该类型，无则返回默认类型
4. 实现一个 `typed_curry` 装饰器，用 ParamSpec 保持类型签名

### 🔴 挑战
5. 实现一个递归类型：嵌套字典的 JSON 类型别名
6. 用 TypeGuard 实现一个运行时类型验证器，支持 `list[int]`、`dict[str, float]` 等复合类型

## 八、知识点总结

```
类型系统
├── 基础
│   ├── 变量注解 x: int
│   ├── 函数注解 def f(x: int) -> str
│   └── list[int], dict[str, int]
├── 泛型
│   ├── TypeVar T
│   ├── Generic[T]
│   └── bound T: Comparable
├── 结构化
│   └── Protocol ✓ 鸭子类型
├── 高级
│   ├── overload ✓ 多态签名
│   ├── TypeGuard / TypeIs
│   ├── Literal
│   ├── ParamSpec
│   └── TypeVarTuple (3.11+)
└── 工具
    ├── mypy --strict
    └── pyright
```

## 九、举一反三

| 特性 | 标准库实例 | 实际应用 |
|-----|----------|---------|
| TypeVar | `random.sample(population: Sequence[T])` | 泛型容器、工具函数 |
| Protocol | `typing.SupportsInt` | 插件接口、适配器约束 |
| overload | `builtins.open` | 兼容多种参数组合的API |
| TypeGuard | `typing.cast` 的安全替代 | 表单验证、配置校验 |
| ParamSpec | `functools.wraps` | 装饰器、中间件类型保持 |

## 十、参考资料

- [PEP 544 - Protocols](https://peps.python.org/pep-0544/)
- [PEP 612 - ParamSpec](https://peps.python.org/pep-0612/)
- [PEP 646 - TypeVarTuple](https://peps.python.org/pep-0646/)
- [mypy documentation](https://mypy.readthedocs.io/)
- 《Robust Python》- Patrick Viafore

## 十一、代码演进：类型注解的进化

```python
# v1: No annotations (Python 2 style)
def process(data):
    result = []
    for item in data:
        result.append(item.upper())
    return result


# v2: Basic annotations
from typing import List

def process(data: List[str]) -> List[str]:
    return [item.upper() for item in data]


# v3: Modern Python 3.12+ with type alias
type StrList = list[str]

def process(data: StrList) -> StrList:
    return [item.upper() for item in data]
```
