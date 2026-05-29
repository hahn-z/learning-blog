---
title: "017 - Python 结构型设计模式详解：适配器、装饰器、代理、组合、外观"
slug: "017-patterns-structural"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.443+08:00"
updated_at: "2026-04-29T10:02:47.639+08:00"
reading_time: 20
tags: []
---

# 结构型设计模式

> **难度：★★★☆☆ 中高级**
> Python 结构型模式：适配器、装饰器(Decorator)、代理、组合、外观、桥接、享元七大模式实战。

## 一、概念讲解

结构型模式关注"如何组合类和对象"来形成更大的结构，同时保持灵活性和可扩展性。

| 模式 | 核心思想 | 关键词 |
|------|---------|-------|
| 适配器(Adapter) | 接口转换，让不兼容的类协同工作 | 兼容 |
| 装饰器(Decorator) | 动态添加职责，不改原类 | 增强 |
| 代理(Proxy) | 控制对对象的访问 | 控制 |
| 组合(Composite) | 树形结构，统一对待个体和组合 | 层级 |
| 外观(Facade) | 简化复杂子系统的接口 | 简化 |
| 桥接(Bridge) | 分离抽象和实现 | 解耦 |
| 享元(Flyweight) | 共享细粒度对象，节省内存 | 共享 |

## 二、脑图

```
结构型模式
├── 适配器 Adapter
│   ├── 类适配器
│   └── 对象适配器 ✓
├── 装饰器 Decorator
│   ├── 函数装饰器
│   └── 类装饰器
├── 代理 Proxy
│   ├── 虚拟代理
│   ├── 保护代理
│   └── 缓存代理
├── 组合 Composite
│   ├── 叶子节点
│   └── 组合节点
├── 外观 Facade
├── 桥接 Bridge
└── 享元 Flyweight
```

## 三、完整代码

### 3.1 适配器模式

```python
"""Adapter pattern - make incompatible interfaces work together."""


class USPlug:
    """American plug - 110V."""

    def connect_110v(self) -> str:
        return "Power: 110V"


class EUPlug:
    """European plug - 220V."""

    def connect_220v(self) -> str:
        return "Power: 220V"


class USAdapter:
    """Adapter that lets EU plugs work with US sockets."""

    def __init__(self, eu_plug: EUPlug):
        self._plug = eu_plug

    def connect_110v(self) -> str:
        return self._plug.connect_220v().replace("220V", "110V (converted)")


class FunctionAdapter:
    """Generic adapter that maps method calls."""

    def __init__(self, obj, **method_map):
        self._obj = obj
        self._method_map = method_map

    def __getattr__(self, name):
        if name in self._method_map:
            return getattr(self._obj, self._method_map[name])
        return getattr(self._obj, name)
```

### 3.2 装饰器模式（非 Python @decorator）

```python
"""Decorator pattern - dynamic responsibility extension."""


class Coffee:
    """Base component."""

    def cost(self) -> float:
        return 5.0

    def description(self) -> str:
        return "Coffee"


class CoffeeDecorator:
    """Base decorator that wraps a Coffee object."""

    def __init__(self, coffee: Coffee):
        self._coffee = coffee

    def cost(self) -> float:
        return self._coffee.cost()

    def description(self) -> str:
        return self._coffee.description()


class MilkDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return self._coffee.cost() + 1.5

    def description(self) -> str:
        return self._coffee.description() + " + Milk"


class SugarDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return self._coffee.cost() + 0.5

    def description(self) -> str:
        return self._coffee.description() + " + Sugar"


class WhipDecorator(CoffeeDecorator):
    def cost(self) -> float:
        return self._coffee.cost() + 2.0

    def description(self) -> str:
        return self._coffee.description() + " + Whip"
```

### 3.3 代理模式

```python
"""Proxy pattern - lazy loading and caching."""

import time
from functools import lru_cache


class HeavyImage:
    """Expensive resource to load."""

    def __init__(self, filename: str):
        self.filename = filename
        print(f"Loading image: {filename} ...")
        time.sleep(1)  # Simulate slow loading
        self.data = f"<pixel data for {filename}>"

    def display(self) -> str:
        return f"Displaying: {self.filename}"


class ImageProxy:
    """Virtual proxy - load image only when needed."""

    def __init__(self, filename: str):
        self._filename = filename
        self._image: HeavyImage | None = None

    def display(self) -> str:
        if self._image is None:
            self._image = HeavyImage(self._filename)
        return self._image.display()


class APIProxy:
    """Caching proxy for API calls."""

    @lru_cache(maxsize=128)
    def fetch_user(self, user_id: int) -> dict:
        print(f"Fetching user {user_id} from API...")
        time.sleep(0.5)
        return {"id": user_id, "name": f"User_{user_id}"}
```

### 3.4 组合模式

```python
"""Composite pattern - tree structure for UI components."""

from abc import ABC, abstractmethod


class UIComponent(ABC):
    @abstractmethod
    def render(self, indent: int = 0) -> str: pass


class Leaf(UIComponent):
    """Simple element with no children."""

    def __init__(self, name: str):
        self.name = name

    def render(self, indent: int = 0) -> str:
        return "  " * indent + f"- {self.name}"


class Composite(UIComponent):
    """Container that holds child components."""

    def __init__(self, name: str):
        self.name = name
        self.children: list[UIComponent] = []

    def add(self, component: UIComponent):
        self.children.append(component)
        return self

    def render(self, indent: int = 0) -> str:
        lines = ["  " * indent + f"+ {self.name}"]
        for child in self.children:
            lines.append(child.render(indent + 1))
        return "\n".join(lines)
```

### 3.5 外观模式

```python
"""Facade pattern - simplify complex subsystems."""


class CPU:
    def freeze(self) -> str:
        return "CPU: Freeze"

    def jump(self, position: int) -> str:
        return f"CPU: Jump to {position}"

    def execute(self) -> str:
        return "CPU: Execute"


class Memory:
    def load(self, data: str) -> str:
        return f"Memory: Load {data}"


class HardDrive:
    def read(self, sector: int) -> str:
        return f"HDD: Read sector {sector}"


class ComputerFacade:
    """Simplified interface to the computer subsystem."""

    def __init__(self):
        self.cpu = CPU()
        self.memory = Memory()
        self.hdd = HardDrive()

    def start(self) -> list[str]:
        return [
            self.cpu.freeze(),
            self.memory.load("BIOS"),
            self.cpu.jump(0),
            self.hdd.read(0),
            self.cpu.execute(),
        ]
```

## 四、执行预览

```text
# Adapter
>>> eu = EUPlug()
>>> adapted = USAdapter(eu)
>>> adapted.connect_110v()
'Power: 110V (converted)'

# Decorator
>>> coffee = MilkDecorator(WhipDecorator(Coffee()))
>>> coffee.description()
'Coffee + Whip + Milk'
>>> coffee.cost()
7.0

# Proxy
>>> proxy = ImageProxy("huge_photo.png")
>>> proxy.display()  # First call triggers load
Loading image: huge_photo.png ...
'Displaying: huge_photo.png'

# Composite
>>> panel = Composite("Panel")
>>> panel.add(Leaf("Button")).add(Leaf("Label"))
>>> panel.render()
'+ Panel\n  - Button\n  - Label'

# Facade
>>> ComputerFacade().start()
['CPU: Freeze', 'Memory: Load BIOS', 'CPU: Jump to 0', 'HDD: Read sector 0', 'CPU: Execute']
```

## 五、注意事项

| 要点 | 说明 |
|-----|------|
| 装饰器 vs Python @decorator | 设计模式的装饰器是结构型，Python的 @decorator 是语法糖 |
| 代理 vs 装饰器 | 代理控制访问，装饰器增加功能 |
| 组合递归 | 组合模式的 render 容易递归过深，注意限制深度 |
| 享元 vs 缓存 | 享元关注共享内部状态，缓存关注避免重复计算 |
| 外观不封装 | 外观提供便捷接口，子系统仍可直接使用 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 适配器里加业务逻辑 | 适配器只做接口转换 |
| 继承来扩展功能（类爆炸） | 用装饰器模式动态组合 |
| 代理和真实对象接口不一致 | 两者实现相同接口 |
| 组合里用 isinstance 判断类型 | 统一用 Component 接口 |
| 外观变成"上帝类" | 外观只做委托，不写业务逻辑 |

## 七、练习题

### 🟢 入门
1. 实现一个适配器，让 `list` 的 `append` 方法适配为 `add` 方法
2. 用组合模式实现文件系统（文件/文件夹）

### 🟡 进阶
3. 实现一个带权限检查的保护代理，控制对文件的读写
4. 用装饰器模式实现一个支持多层嵌套的日志增强器

### 🔴 挑战
5. 实现享元模式的重型应用：一个文本编辑器，大量字符共享字体样式对象
6. 用桥接模式实现一个绘图系统，将形状（圆、矩形）与渲染器（SVG、Canvas）解耦

## 八、知识点总结

```
结构型模式
├── 适配器 → 接口兼容
├── 装饰器 → 动态增强 ✓ 最常用
├── 代理 → 访问控制
│   ├── 虚拟代理(懒加载)
│   ├── 缓存代理
│   └── 保护代理
├── 组合 → 树形结构
├── 外观 → 简化接口 ✓ 高频
├── 桥接 → 抽象与实现分离
└── 享元 → 对象共享
```

## 九、举一反三

| 模式 | Python 标准库 / 框架实例 | 实际应用 |
|-----|------------------------|---------|
| 适配器 | `os` vs `pathlib` 风格转换 | 第三方SDK集成 |
| 装饰器 | `functools.lru_cache` | 中间件、权限、日志 |
| 代理 | `weakref.proxy` | ORM懒加载、图片占位 |
| 组合 | `xml.etree.ElementTree` | 菜单系统、组织架构 |
| 外观 | `subprocess.run()` 封装底层 | SDK封装、微服务客户端 |

## 十、参考资料

- 《Design Patterns》- GoF
- [Refactoring Guru - Structural Patterns](https://refactoring.guru/design-patterns/structural-patterns)
- 《Fluent Python》第2版 - Luciano Ramalho

## 十一、代码演进：装饰器模式的进化

```python
# v1: Inheritance explosion
class CoffeeWithMilk(Coffee): ...
class CoffeeWithSugar(Coffee): ...
class CoffeeWithMilkAndSugar(Coffee): ...  # N * M classes!

# v2: Decorator pattern - compose dynamically
coffee = MilkDecorator(SugarDecorator(Coffee()))

# v3: Pythonic approach - use closures
def with_milk(cost_func):
    def wrapper(*args, **kwargs):
        return cost_func(*args, **kwargs) + 1.5
    return wrapper
```
