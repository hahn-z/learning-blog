---
title: "023 - Python 类型注解与 mypy：让动态语言拥有静态类型安全"
slug: "023-type-hints"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.333+08:00"
updated_at: "2026-04-29T10:02:47.463+08:00"
reading_time: 25
tags: []
---

# Python 类型注解与 mypy：让动态语言拥有静态类型安全

> **难度：** 🟡 中级 | **预计阅读：** 25 分钟
> **前置知识：** Python 基础语法、函数定义、面向对象

---

## 一、概念讲解：为什么需要类型注解？

Python 是动态类型语言——变量不需要声明类型，运行时才确定。这带来了灵活性，但也带来了隐患：

```python
def process(data):
    return data.strip().upper()  # data 是 str？还是 int？没人知道...
```

**类型注解（Type Hints）** 解决了这个问题：

1. **代码自文档化** —— 不用猜参数类型
2. **IDE 智能提示** —— 补全更精准
3. **静态检查** —— mypy 在运行前发现 bug
4. **团队协作** —— 接口契约更清晰

> ⚠️ 注意：类型注解是**提示**，不影响运行时行为。Python 仍然是动态类型语言。

### 类型注解 vs 类型检查

| 概念 | 作用 | 时机 |
|------|------|------|
| Type Hints | 标注类型信息 | 写代码时 |
| mypy | 静态检查类型错误 | 运行前（CI/本地） |
| isinstance() | 运行时类型判断 | 程序运行时 |

---

## 二、脑图（ASCII）

```
Type Hints
├── 基础类型
│   ├── int, float, str, bool
│   ├── list[int], dict[str, int]
│   ├── tuple[int, str, ...]
│   └── set[str]
├── 函数注解
│   ├── 参数类型: def f(x: int) -> str
│   ├── 可选参数: Optional[int]
│   └── 默认值: x: int = 0
├── 高级类型
│   ├── Union[int, str]
│   ├── Optional[T] = Union[T, None]
│   ├── Any
│   ├── Callable[[int, str], bool]
│   └── TypeVar / Generic
├── mypy 工具
│   ├── 安装: pip install mypy
│   ├── 运行: mypy src/
│   ├── 配置: mypy.ini / pyproject.toml
│   └── 常见错误码
└── 最佳实践
    ├── 渐进式添加
    ├── 从公共 API 开始
    └── py.typed 标记
```

---

## 三、完整代码示例

### v1：基础类型注解

```python
"""
v1: Basic type annotations
Covering variables, functions, and collections
"""
from typing import Optional

# Variable annotations (Python 3.6+)
name: str = "Alice"
age: int = 30
scores: list[float] = [89.5, 92.0, 78.3]
user_map: dict[str, int] = {"alice": 1, "bob": 2}

def greet(name: str, formal: bool = False) -> str:
    """Greet a person with optional formal mode."""
    if formal:
        return f"Good day, {name}."
    return f"Hi, {name}!"

def find_user(user_id: int) -> Optional[str]:
    """Look up a user by ID. Returns None if not found."""
    database = {1: "Alice", 2: "Bob"}
    return database.get(user_id)

def sum_numbers(numbers: list[float]) -> float:
    """Calculate the sum of a list of numbers."""
    return sum(numbers)

if __name__ == "__main__":
    print(greet("Alice"))
    print(greet("Bob", formal=True))
    print(find_user(1))   # Alice
    print(find_user(99))  # None
    print(sum_numbers([1.5, 2.5, 3.0]))
```

### v2：高级类型 + mypy 配置

```python
"""
v2: Advanced types - Union, Callable, TypeVar, Generic
Requires: pip install mypy
"""
from typing import Union, Callable, TypeVar, Generic, Sequence
from dataclasses import dataclass

# Union: multiple possible types
def process_input(data: Union[str, int]) -> str:
    """Process string or integer input."""
    if isinstance(data, int):
        return f"Number: {data}"
    return f"String: {data}"

# Callable: function as parameter
def apply_operation(
    value: int,
    operation: Callable[[int], int]
) -> int:
    """Apply a function to a value."""
    return operation(value)

# TypeVar: generic type variable
T = TypeVar("T")

def first(items: Sequence[T]) -> T:
    """Get the first element of a sequence."""
    return items[0]

# Generic class
@dataclass
class Stack(Generic[T]):
    """A type-safe stack data structure."""
    _items: list[T]

    def __init__(self) -> None:
        self._items = []

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items.pop()

    def peek(self) -> T:
        if not self._items:
            raise IndexError("Stack is empty")
        return self._items[-1]

    def __len__(self) -> int:
        return len(self._items)

# Dataclass with type annotations
@dataclass
class User:
    name: str
    age: int
    email: str
    active: bool = True

def create_user(name: str, age: int, email: str) -> User:
    """Factory function for creating users."""
    return User(name=name, age=age, email=email)

if __name__ == "__main__":
    # Stack usage
    stack: Stack[str] = Stack()
    stack.push("hello")
    stack.push("world")
    print(stack.pop())  # world

    # Function as parameter
    result = apply_operation(5, lambda x: x * 2)
    print(f"Doubled: {result}")

    # User creation
    user = create_user("Alice", 30, "alice@example.com")
    print(f"User: {user.name}, active: {user.active}")
```

### v3：mypy 严格模式 + Protocol

```python
"""
v3: Strict typing with mypy
Demonstrates production-grade type safety

pyproject.toml config:
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable
from dataclasses import dataclass, field

# Protocol: structural typing (like Go interfaces)
@runtime_checkable
class Printable(Protocol):
    def to_string(self) -> str: ...

@dataclass(frozen=True)
class Product:
    id: int
    name: str
    price: float
    tags: list[str] = field(default_factory=list)

    def to_string(self) -> str:
        return f"{self.name} (${self.price:.2f})"

class ProductCatalog:
    """Type-safe product catalog with strict annotations."""

    def __init__(self) -> None:
        self._products: dict[int, Product] = {}

    def add(self, product: Product) -> None:
        """Add a product to the catalog."""
        if product.id in self._products:
            raise ValueError(f"Product {product.id} already exists")
        self._products[product.id] = product

    def find(self, product_id: int) -> Product | None:
        """Find a product by ID."""
        return self._products.get(product_id)

    def list_by_tag(self, tag: str) -> list[Product]:
        """List all products with a given tag."""
        return [
            p for p in self._products.values()
            if tag in p.tags
        ]

    def total_value(self) -> float:
        """Calculate total value of all products."""
        return sum(p.price for p in self._products.values())

def print_item(item: Printable) -> str:
    """Print any object that implements Printable protocol."""
    return item.to_string()

if __name__ == "__main__":
    catalog = ProductCatalog()

    catalog.add(Product(1, "Python Book", 49.99, ["book", "programming"]))
    catalog.add(Product(2, "Coffee Mug", 12.50, ["drinkware", "fun"]))

    found = catalog.find(1)
    if found:
        print(print_item(found))

    books = catalog.list_by_tag("book")
    print(f"Books: {[b.name for b in books]}")
    print(f"Total value: ${catalog.total_value():.2f}")
```

---

## 四、执行预览

### mypy 检查输出

```bash
$ mypy v3_strict.py
Success: no issues found in 1 source file

$ mypy --strict bad_example.py
bad_example.py:15: error: Argument 1 to "greet" has incompatible type "int";
                        expected "str"  [arg-type]
bad_example.py:20: error: Missing return statement  [return]
Found 2 errors in 1 file (checked 1 source file)
```

### v3 运行输出

```
Python Book ($49.99)
Books: ['Python Book']
Total value: $62.49
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| 运行时不强制 | 类型注解不影响运行 | 用 mypy 做静态检查 |
| 性能开销 | 类型注解几乎无运行时开销 | 可用 `from __future__ import annotations` 延迟求值 |
| 复杂类型可读性 | 嵌套类型注解难以阅读 | 用 TypeAlias 简化 |
| 第三方库无注解 | 旧库没有类型信息 | 安装 `types-*` stub 包 |
| mypy 误报 | 有时报告不准确的错误 | 用 `# type: ignore` 注释（慎用） |
| Python 版本 | 新语法需要新版本 | 3.10+ 支持 `X \| Y`，3.9+ 支持 `list[int]` |

---

## 六、避坑指南

### ❌ 坑 1：混淆 type 和 isinstance

```python
# ❌ type() doesn't handle inheritance
if type(obj) == Animal:  # Misses subclasses
    ...

# ✅ Use isinstance() for runtime checks
if isinstance(obj, Animal):
    ...
```

### ❌ 坑 2：滥用 Any

```python
# ❌ Any disables type checking entirely
def process(data: Any) -> Any:
    return data

# ✅ Use specific types or generics
def process(data: str | int) -> str:
    ...
```

### ❌ 坑 3：忘记 Optional

```python
# ❌ mypy error: missing None possibility
def find(id: int) -> str:  # What if not found?
    return database.get(id)  # Returns None!

# ✅ Explicit Optional
def find(id: int) -> str | None:
    return database.get(id)
```

---

## 七、练习题

### 🟢 入门：基础注解

为以下函数添加类型注解：

```python
def calculate_area(length, width):
    return length * width

def format_name(first, last, uppercase=False):
    name = f"{first} {last}"
    return name.upper() if uppercase else name
```

### 🟡 进阶：泛型与 Protocol

1. 实现一个类型安全的 `Repository[T]` 泛型类，支持 `get`、`save`、`delete` 方法
2. 定义一个 `Serializable` Protocol，要求实现 `to_dict()` 和 `from_dict()` 方法

### 🔴 挑战：mypy 严格模式

1. 创建一个完整的项目结构（`src/`、`tests/`）
2. 配置 `pyproject.toml` 启用 `strict = true`
3. 确保 `mypy src/` 零错误通过
4. 使用 `Protocol` 和 `TypeVar` 实现一个插件系统

---

## 八、知识点总结（树状）

```
Type Hints & mypy
├── 基础类型注解
│   ├── 变量: name: str = "Alice"
│   ├── 函数: def f(x: int) -> str
│   └── 类属性: class C: x: int
├── 容器类型 (3.9+)
│   ├── list[int]
│   ├── dict[str, int]
│   ├── tuple[int, str]
│   └── set[str]
├── 高级类型
│   ├── Union[A, B] / A | B (3.10+)
│   ├── Optional[T] = T | None
│   ├── Any
│   ├── Callable[[Args], Return]
│   ├── TypeVar("T")
│   ├── Generic[T]
│   └── Protocol (结构化类型)
├── mypy 工具
│   ├── 安装: pip install mypy
│   ├── 运行: mypy src/
│   ├── 严格模式: --strict
│   └── 配置: pyproject.toml [tool.mypy]
└── 最佳实践
    ├── 渐进式添加（从公共 API 开始）
    ├── CI 中集成 mypy
    ├── 用 stub 包补充第三方库类型
    └── 避免 Any，用泛型替代
```

---

## 九、举一反三

| 场景 | 推荐方案 | 关键类型 |
|------|----------|----------|
| 函数参数 | 基础注解 + 默认值 | `str`, `int`, `bool` |
| API 响应 | dataclass + TypedDict | `@dataclass`, `TypedDict` |
| 回调函数 | Callable | `Callable[[int], str]` |
| 容器/集合 | 泛型容器 | `list[T]`, `dict[K, V]` |
| 插件系统 | Protocol + TypeVar | 结构化类型 |
| 配置管理 | TypedDict 或 Pydantic | `BaseModel` |
| 事件处理 | Callable + Union | 回调类型签名 |

---

## 十、参考资料

- 📖 [PEP 484 - Type Hints](https://peps.python.org/pep-0484/)
- 📖 [PEP 604 - Union 语法 (X \| Y)](https://peps.python.org/pep-0604/)
- 📖 [mypy 官方文档](https://mypy.readthedocs.io/)
- 📖 [Type Hints Cheatsheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html)
- 🔧 [pydantic](https://docs.pydantic.dev/) - 运行时类型验证
- 🔧 [beartype](https://github.com/beartype/beartype) - 运行时类型检查

---

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 基础注解 | 变量、函数、Optional | 学习、小型脚本 |
| v2 高级类型 | Union、Generic、Protocol | 中型项目 |
| v3 严格模式 | mypy strict、Protocol、完整类型安全 | 生产环境 |

**演进路径：** `基础注解 → 高级类型 → mypy 严格模式 → CI 集成`

> 💡 **一句话总结：** 类型注解不会改变 Python 的动态特性，但能让你的代码更安全、更易维护。渐进式采用，从公共 API 开始。
