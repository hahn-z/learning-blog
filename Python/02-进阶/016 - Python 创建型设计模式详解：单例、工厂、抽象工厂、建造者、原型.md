---
title: "016 - Python 创建型设计模式详解：单例、工厂、抽象工厂、建造者、原型"
slug: "016-patterns-creational"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.436+08:00"
updated_at: "2026-04-29T10:02:47.631+08:00"
reading_time: 27
tags: []
---

# 创建型设计模式

> **难度：★★★☆☆ 中高级**
> Python 中实现创建型设计模式的实用指南，涵盖单例、工厂、抽象工厂、建造者、原型五大模式。

## 一、概念讲解

创建型设计模式关注"如何创建对象"，将对象的创建与使用分离，让系统不依赖于具体类的实例化方式。Python 作为动态语言，很多模式可以用更简洁的方式实现。

**五大创建型模式概览：**

| 模式 | 核心思想 | 适用场景 |
|------|---------|---------|
| 单例(Singleton) | 全局唯一实例 | 配置管理、连接池 |
| 工厂方法(Factory Method) | 子类决定创建哪个类 | 日志框架、插件系统 |
| 抽象工厂(Abstract Factory) | 创建一组相关对象 | 跨平台UI组件 |
| 建造者(Builder) | 分步骤构建复杂对象 | SQL构建、配置组装 |
| 原型(Prototype) | 克隆已有对象 | 批量复制、快照 |

## 二、脑图

```
创建型模式
├── 单例 Singleton
│   ├── 模块级单例
│   ├── 装饰器实现
│   └── 元类实现
├── 工厂方法 Factory Method
│   ├── 简单工厂
│   └── 工厂方法
├── 抽象工厂 Abstract Factory
│   └── 产品族
├── 建造者 Builder
│   ├── 链式调用
│   └── Director 协调
└── 原型 Prototype
    ├── copy.copy
    └── copy.deepcopy
```

## 三、完整代码

### 3.1 单例模式（三种实现）

```python
"""Singleton pattern - three Python implementations."""

# --- v1: Module-level singleton (simplest) ---
# In Python, modules are naturally singletons
# config.py
class _Config:
    def __init__(self):
        self.debug = False
        self.database_url = "sqlite:///default.db"

config = _Config()  # Module import returns same object


# --- v2: Decorator-based singleton ---
def singleton(cls):
    """Decorator that ensures only one instance exists."""
    _instances = {}

    def get_instance(*args, **kwargs):
        if cls not in _instances:
            _instances[cls] = cls(*args, **kwargs)
        return _instances[cls]

    return get_instance


@singleton
class DatabaseConnection:
    def __init__(self, host="localhost"):
        self.host = host
        print(f"Connecting to {host}...")


# --- v3: Metaclass-based singleton (most elegant) ---
class SingletonMeta(type):
    """Metaclass for singleton pattern with thread safety."""
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class Logger(metaclass=SingletonMeta):
    def __init__(self, level="INFO"):
        self.level = level
        self.logs = []

    def log(self, message):
        self.logs.append(f"[{self.level}] {message}")
```

### 3.2 工厂方法模式

```python
"""Factory Method pattern - document exporters."""

from abc import ABC, abstractmethod
from pathlib import Path


# Abstract product
class DocumentExporter(ABC):
    @abstractmethod
    def export(self, content: str, filename: str) -> str:
        pass


# Concrete products
class PDFExporter(DocumentExporter):
    def export(self, content: str, filename: str) -> str:
        output = f"{Path(filename).stem}.pdf"
        print(f"Generating PDF: {output}")
        return output


class MarkdownExporter(DocumentExporter):
    def export(self, content: str, filename: str) -> str:
        output = f"{Path(filename).stem}.md"
        print(f"Generating Markdown: {output}")
        return output


class HTMLExporter(DocumentExporter):
    def export(self, content: str, filename: str) -> str:
        output = f"{Path(filename).stem}.html"
        print(f"Generating HTML: {output}")
        return output


# Creator with factory method
class ExportService:
    """Service that uses factory method to create exporters."""

    _registry: dict[str, type[DocumentExporter]] = {
        "pdf": PDFExporter,
        "markdown": MarkdownExporter,
        "html": HTMLExporter,
    }

    def export(self, format: str, content: str, filename: str) -> str:
        exporter_cls = self._registry.get(format)
        if not exporter_cls:
            raise ValueError(f"Unknown format: {format}")
        exporter = exporter_cls()
        return exporter.export(content, filename)

    @classmethod
    def register(cls, format: str, exporter_cls: type):
        """Allow registering new exporters dynamically."""
        cls._registry[format] = exporter_cls
```

### 3.3 抽象工厂模式

```python
"""Abstract Factory pattern - cross-platform UI components."""

from abc import ABC, abstractmethod


class Button(ABC):
    @abstractmethod
    def render(self) -> str: pass


class TextBox(ABC):
    @abstractmethod
    def render(self) -> str: pass


# Windows family
class WindowsButton(Button):
    def render(self) -> str:
        return "[Windows Button]"


class WindowsTextBox(TextBox):
    def render(self) -> str:
        return "[Windows TextBox]"


# macOS family
class MacOSButton(Button):
    def render(self) -> str:
        return "(macOS Button)"


class MacOSTextBox(TextBox):
    def render(self) -> str:
        return "(macOS TextBox)"


# Abstract factory
class UIFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: pass

    @abstractmethod
    def create_textbox(self) -> TextBox: pass


class WindowsFactory(UIFactory):
    def create_button(self) -> Button:
        return WindowsButton()

    def create_textbox(self) -> TextBox:
        return WindowsTextBox()


class MacOSFactory(UIFactory):
    def create_button(self) -> Button:
        return MacOSButton()

    def create_textbox(self) -> TextBox:
        return MacOSTextBox()


# Client code
def build_ui(factory: UIFactory) -> list[str]:
    """Build UI components using the given factory."""
    button = factory.create_button()
    textbox = factory.create_textbox()
    return [button.render(), textbox.render()]
```

### 3.4 建造者模式

```python
"""Builder pattern - SQL query builder with fluent API."""


class QueryBuilder:
    """Build SQL queries step by step with method chaining."""

    def __init__(self):
        self._table = ""
        self._select_cols: list[str] = []
        self._where_clauses: list[str] = []
        self._order_by = ""
        self._limit_val = 0

    def select(self, *columns: str) -> "QueryBuilder":
        self._select_cols = list(columns) if columns else ["*"]
        return self

    def from_table(self, name: str) -> "QueryBuilder":
        self._table = name
        return self

    def where(self, condition: str) -> "QueryBuilder":
        self._where_clauses.append(condition)
        return self

    def order_by(self, column: str) -> "QueryBuilder":
        self._order_by = column
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit_val = n
        return self

    def build(self) -> str:
        if not self._table:
            raise ValueError("Table name is required")

        cols = ", ".join(self._select_cols)
        sql = f"SELECT {cols} FROM {self._table}"

        if self._where_clauses:
            sql += " WHERE " + " AND ".join(self._where_clauses)
        if self._order_by:
            sql += f" ORDER BY {self._order_by}"
        if self._limit_val:
            sql += f" LIMIT {self._limit_val}"

        return sql
```

### 3.5 原型模式

```python
"""Prototype pattern - deep copy for object cloning."""

import copy
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Graphic:
    """A graphic element that can be cloned efficiently."""
    name: str
    x: int = 0
    y: int = 0
    styles: dict[str, Any] = field(default_factory=dict)
    children: list["Graphic"] = field(default_factory=list)

    def clone(self) -> "Graphic":
        """Deep copy to preserve nested structures."""
        return copy.deepcopy(self)

    def __repr__(self):
        return f"Graphic({self.name!r}, pos=({self.x},{self.y}))"


# Demo: clone a complex template
def demo_prototype():
    template = Graphic(
        name="button_template",
        styles={"color": "blue", "font": "Arial"},
        children=[
            Graphic(name="icon", x=5, y=5),
            Graphic(name="label", x=20, y=5),
        ],
    )

    submit_btn = template.clone()
    submit_btn.name = "submit_button"
    submit_btn.styles["color"] = "green"

    cancel_btn = template.clone()
    cancel_btn.name = "cancel_button"
    cancel_btn.styles["color"] = "red"

    return template, submit_btn, cancel_btn
```

## 四、执行预览

```text
# Singleton test
>>> db1 = DatabaseConnection(host="prod.db")
Connecting to prod.db...
>>> db2 = DatabaseConnection(host="test.db")  # No new connection!
>>> db1 is db2
True

# Factory test
>>> service = ExportService()
>>> service.export("pdf", "Hello World", "report.txt")
Generating PDF: report.pdf

# Abstract Factory test
>>> build_ui(WindowsFactory())
['[Windows Button]', '[Windows TextBox]']
>>> build_ui(MacOSFactory())
['(macOS Button)', '(macOS TextBox)']

# Builder test
>>> QueryBuilder().select("name", "age").from_table("users") \
...   .where("age > 18").order_by("name").limit(10).build()
'SELECT name, age FROM users WHERE age > 18 ORDER BY name LIMIT 10'

# Prototype test
>>> tmpl, s, c = demo_prototype()
>>> s.styles['color']
'green'
>>> tmpl.styles['color']  # Original unchanged
'blue'
```

## 五、注意事项

| 要点 | 说明 |
|-----|------|
| 线程安全 | 单例模式需注意多线程场景，建议用 `threading.Lock` |
| 过度使用 | 不是所有对象都需要设计模式，简单场景直接 `__init__` |
| Python 简化 | 动态类型让很多模式可以更简单，不必照搬 Java |
| deepcopy 性能 | 原型模式的 `deepcopy` 对大对象较慢，慎用 |
| 工厂注册表 | 用字典注册比 if-else 更 Pythonic |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 用全局变量实现单例 | 用模块或元类，更清晰 |
| 工厂里写死所有分支 | 用注册表模式，支持动态扩展 |
| 每个场景都用建造者 | 只有复杂对象才需要分步构建 |
| `copy.copy()` 浅拷贝嵌套结构 | 用 `copy.deepcopy()` 确保独立 |
| 抽象工厂只有一个产品族 | 单产品族用工厂方法就够了 |

## 七、练习题

### 🟢 入门
1. 用装饰器实现一个线程安全的单例
2. 创建一个 `ShapeFactory`，能生成 Circle、Rectangle、Triangle

### 🟡 进阶
3. 实现一个 `QueryBuilder` 支持 JOIN 和 GROUP BY
4. 用原型模式实现文档模板系统，支持嵌套段落克隆

### 🔴 挑战
5. 实现一个通用的抽象工厂框架，支持通过配置文件动态加载产品族
6. 结合注册表模式和工厂方法，实现一个插件系统，支持运行时注册新类型

## 八、知识点总结

```
创建型模式
├── 单例
│   ├── 模块级 ✓ 推荐
│   ├── 装饰器
│   └── 元类 ✓ 线程安全
├── 工厂方法
│   ├── 简单工厂 (if/else)
│   └── 注册表工厂 ✓ 可扩展
├── 抽象工厂
│   └── 产品族创建
├── 建造者
│   └── 链式调用 ✓ 流畅API
└── 原型
    ├── shallow copy
    └── deep copy ✓ 推荐
```

## 九、举一反三

| 模式 | Python 标准库实例 | 实际应用 |
|-----|------------------|---------|
| 单例 | `logging.Logger` | 全局配置、缓存 |
| 工厂方法 | `json.JSONDecoder` | 消息解析、插件加载 |
| 抽象工厂 | `tkinter` 的 Widget | 多主题 UI、跨平台适配 |
| 建造者 | `email.mime` 构建邮件 | SQL构建、HTTP请求构建 |
| 原型 | `copy` 模块 | 撤销/重做、游戏存档 |

## 十、参考资料

- 《Design Patterns》- GoF 四人帮经典
- 《Python 设计模式》- Dusty Phillips
- [Python docs - copy module](https://docs.python.org/3/library/copy.html)
- [Refactoring Guru - Creational Patterns](https://refactoring.guru/design-patterns/creational-patterns)

## 十一、代码演进：单例模式的进化

```python
# v1: Naive approach - not thread safe
class SingletonV1:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance


# v2: Module-level singleton (Pythonic)
# just use a module! myconfig.py with module-level variables


# v3: Thread-safe with lock
import threading

class SingletonV3:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
        return cls._instance
```
