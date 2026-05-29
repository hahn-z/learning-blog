---
title: "018 - Python 行为型设计模式详解：策略、观察者、命令、迭代器、状态、责任链"
slug: "018-patterns-behavioral"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.447+08:00"
updated_at: "2026-04-29T10:02:47.646+08:00"
reading_time: 25
tags: []
---

# 行为型设计模式

> **难度：★★★☆☆ 中高级**
> Python 行为型模式：策略、观察者、命令、迭代器、状态、模板方法、责任链七大模式。

## 一、概念讲解

行为型模式关注"对象之间的通信和职责分配"，解决"谁做什么、何时做、怎么做"的问题。

| 模式 | 核心思想 | 适用场景 |
|------|---------|---------|
| 策略(Strategy) | 封装算法，可互换 | 排序策略、支付方式 |
| 观察者(Observer) | 一对多依赖通知 | 事件系统、消息推送 |
| 命令(Command) | 请求封装为对象 | 撤销/重做、任务队列 |
| 迭代器(Iterator) | 顺序访问集合元素 | 自定义遍历、懒加载 |
| 状态(State) | 状态驱动的行为变化 | 状态机、工作流 |
| 模板方法(Template) | 算法骨架，子类填充 | 框架钩子、数据处理流水线 |
| 责任链(Chain) | 请求沿链传递处理 | 中间件、审批流 |

## 二、脑图

```
行为型模式
├── 策略 Strategy
│   ├── 策略接口
│   └── 上下文切换
├── 观察者 Observer
│   ├── Subject
│   └── Observer
├── 命令 Command
│   ├── Command
│   ├── Invoker
│   └── Receiver
├── 迭代器 Iterator
│   └── __iter__ + __next__
├── 状态 State
│   └── 状态转换
├── 模板方法 Template
│   └── 钩子方法
└── 责任链 Chain
    └── handler 链
```

## 三、完整代码

### 3.1 策略模式

```python
"""Strategy pattern - interchangeable algorithms."""

from abc import ABC, abstractmethod
from typing import Callable


class SortStrategy(ABC):
    @abstractmethod
    def sort(self, data: list) -> list: pass


class BubbleSort(SortStrategy):
    def sort(self, data: list) -> list:
        result = data.copy()
        n = len(result)
        for i in range(n):
            for j in range(0, n - i - 1):
                if result[j] > result[j + 1]:
                    result[j], result[j + 1] = result[j + 1], result[j]
        return result


class QuickSort(SortStrategy):
    def sort(self, data: list) -> list:
        if len(data) <= 1:
            return data.copy()
        pivot = data[len(data) // 2]
        left = [x for x in data if x < pivot]
        mid = [x for x in data if x == pivot]
        right = [x for x in data if x > pivot]
        return self.sort(left) + mid + self.sort(right)


class Sorter:
    """Context that uses a sorting strategy."""

    def __init__(self, strategy: SortStrategy | None = None):
        self._strategy = strategy or QuickSort()

    def set_strategy(self, strategy: SortStrategy):
        self._strategy = strategy

    def sort(self, data: list) -> list:
        return self._strategy.sort(data)


# Pythonic alternative: use plain functions
def sort_with(data: list, key: Callable = sorted) -> list:
    return key(data)
```

### 3.2 观察者模式

```python
"""Observer pattern - publish/subscribe event system."""

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class EventEmitter:
    """Simple event bus using observer pattern."""

    _listeners: dict[str, list[Callable]] = field(default_factory=dict)

    def on(self, event: str, callback: Callable) -> "EventEmitter":
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)
        return self

    def off(self, event: str, callback: Callable) -> None:
        if event in self._listeners:
            self._listeners[event].remove(callback)

    def emit(self, event: str, *args, **kwargs) -> None:
        for callback in self._listeners.get(event, []):
            callback(*args, **kwargs)
```

### 3.3 命令模式

```python
"""Command pattern - encapsulate requests as objects."""

from dataclasses import dataclass, field


class Editor:
    """Receiver - knows how to perform operations."""

    def __init__(self):
        self.text = ""
        self._clipboard = ""

    def copy(self) -> str:
        self._clipboard = self.text
        return f"Copied: {self._clipboard!r}"

    def paste(self) -> str:
        self.text += self._clipboard
        return f"Pasted. Text: {self.text!r}"

    def delete_last(self, n: int = 1) -> str:
        removed = self.text[-n:]
        self.text = self.text[:-n]
        return f"Deleted: {removed!r}"


@dataclass
class CommandHistory:
    """Undo stack."""
    _stack: list = field(default_factory=list)

    def push(self, command):
        self._stack.append(command)

    def pop(self):
        return self._stack.pop() if self._stack else None


class CopyCommand:
    def __init__(self, editor: Editor):
        self.editor = editor
        self._backup = ""

    def execute(self) -> str:
        self._backup = self.editor.text
        return self.editor.copy()

    def undo(self) -> str:
        self.editor.text = self._backup
        return "Undo copy"
```

### 3.4 迭代器模式

```python
"""Iterator pattern - custom traversal."""


class BinaryTree:
    """Binary tree with multiple traversal strategies."""

    def __init__(self, value, left=None, right=None):
        self.value = value
        self.left = left
        self.right = right


class InOrderIterator:
    """Left -> Root -> Right traversal."""

    def __init__(self, root: BinaryTree):
        self._stack = []
        self._current = root

    def __iter__(self):
        return self

    def __next__(self):
        while self._current or self._stack:
            while self._current:
                self._stack.append(self._current)
                self._current = self._current.left
            self._current = self._stack.pop()
            value = self._current.value
            self._current = self._current.right
            return value
        raise StopIteration
```

### 3.5 状态模式 + 责任链

```python
"""State pattern - state machine for order processing."""


class OrderState:
    """Base state."""

    def pay(self, order) -> str:
        return f"Cannot pay in {self.__class__.__name__}"

    def ship(self, order) -> str:
        return f"Cannot ship in {self.__class__.__name__}"

    def deliver(self, order) -> str:
        return f"Cannot deliver in {self.__class__.__name__}"


class PendingState(OrderState):
    def pay(self, order) -> str:
        order.state = PaidState()
        return "Order paid"


class PaidState(OrderState):
    def ship(self, order) -> str:
        order.state = ShippedState()
        return "Order shipped"


class ShippedState(OrderState):
    def deliver(self, order) -> str:
        order.state = DeliveredState()
        return "Order delivered"


class DeliveredState(OrderState):
    pass  # Terminal state


class Order:
    def __init__(self):
        self.state: OrderState = PendingState()

    def pay(self) -> str:
        return self.state.pay(self)

    def ship(self) -> str:
        return self.state.ship(self)

    def deliver(self) -> str:
        return self.state.deliver(self)


# Chain of Responsibility
class Handler:
    """Base handler in the chain."""

    def __init__(self):
        self._next: "Handler | None" = None

    def set_next(self, handler: "Handler") -> "Handler":
        self._next = handler
        return handler

    def handle(self, request: dict) -> str | None:
        if self._next:
            return self._next.handle(request)
        return None


class AuthHandler(Handler):
    def handle(self, request: dict) -> str | None:
        if not request.get("token"):
            return "Auth failed: no token"
        return super().handle(request)


class RateLimitHandler(Handler):
    def handle(self, request: dict) -> str | None:
        if request.get("requests", 0) > 100:
            return "Rate limit exceeded"
        return super().handle(request)


class BusinessHandler(Handler):
    def handle(self, request: dict) -> str | None:
        return f"Processed: {request.get('action', 'unknown')}"
```

## 四、执行预览

```text
# Strategy
>>> sorter = Sorter(BubbleSort())
>>> sorter.sort([3, 1, 2])
[1, 2, 3]

# Observer
>>> bus = EventEmitter()
>>> bus.on("login", lambda name: print(f"Welcome {name}"))
>>> bus.emit("login", "Alice")
Welcome Alice

# Command
>>> editor = Editor()
>>> editor.text = "Hello"
>>> cmd = CopyCommand(editor)
>>> cmd.execute()
"Copied: 'Hello'"

# Iterator
>>> tree = BinaryTree(4, BinaryTree(2, BinaryTree(1), BinaryTree(3)), BinaryTree(5))
>>> list(InOrderIterator(tree))
[1, 2, 3, 4, 5]

# State
>>> order = Order()
>>> order.pay()
'Order paid'
>>> order.deliver()  # Skip ship!
'Cannot deliver in PaidState'
>>> order.ship()
'Order shipped'
>>> order.deliver()
'Order delivered'

# Chain
>>> auth = AuthHandler()
>>> auth.set_next(RateLimitHandler()).set_next(BusinessHandler())
>>> auth.handle({"token": "abc", "requests": 5, "action": "create"})
'Processed: create'
```

## 五、注意事项

| 要点 | 说明 |
|-----|------|
| Python 函数即策略 | 策略模式在 Python 中可用函数替代类 |
| 观察者内存泄漏 | 及时 `off` 取消订阅，避免回调堆积 |
| 命令模式开销 | 每个操作都封装为对象，简单场景不必用 |
| 迭代器协议 | 实现 `__iter__` + `__next__` 即可，优先用生成器 |
| 责任链顺序 | 链的顺序很重要，先快筛再慢处理 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 策略用 if-else 硬编码 | 用字典或注册表映射策略 |
| 观察者同步阻塞 | 耗时操作用 `asyncio` 或线程池 |
| 状态机用大量 if-else | 每个状态一个类，利用多态 |
| 责任链不设终点 | 最后一个 handler 返回默认结果 |
| 模板方法暴露太多钩子 | 只开放必要的抽象方法 |

## 七、练习题

### 🟢 入门
1. 实现一个策略模式的折扣计算器（满减、打折、无折扣）
2. 用观察者模式实现温度传感器，温度变化时通知多个显示器

### 🟡 进阶
3. 实现命令模式的完整文本编辑器（输入、删除、撤销、重做）
4. 用状态模式实现红绿灯（红→绿→黄循环）

### 🔴 挑战
5. 实现一个支持优先级的责任链，可以动态插入和移除 handler
6. 用迭代器模式实现图的 BFS 和 DFS 遍历

## 八、知识点总结

```
行为型模式
├── 策略 ✓ 高频
│   └── 函数替代类
├── 观察者 ✓ 高频
│   └── 事件总线
├── 命令
│   └── 撤销/重做
├── 迭代器
│   └── Python 协议
├── 状态
│   └── 有限状态机
├── 模板方法
│   └── 框架钩子
└── 责任链
    └── 中间件 ✓ Web高频
```

## 九、举一反三

| 模式 | Python / 框架实例 | 实际应用 |
|-----|------------------|---------|
| 策略 | `sorted(key=...)` | 支付方式选择、排序策略 |
| 观察者 | `blinker` 库、Django signals | 实时通知、消息推送 |
| 命令 | Celery tasks | 任务队列、事务操作 |
| 迭代器 | `range()`, 生成器表达式 | 流式处理、分页 |
| 状态 | Django FSM | 订单流程、审批流 |
| 模板方法 | `sklearn` estimators | 数据处理管道 |
| 责任链 | Django/Flask middleware | 认证链、过滤器链 |

## 十、参考资料

- 《Design Patterns》- GoF
- 《Python 设计模式》- Dusty Phillips
- [Refactoring Guru - Behavioral Patterns](https://refactoring.guru/design-patterns/behavioral-patterns)
- 《Fluent Python》第2版

## 十一、代码演进：事件系统的进化

```python
# v1: Direct coupling - observer hardcoded
class Sensor:
    def update(self, temp):
        self.temp = temp

# Must manually call each display
sensor = Sensor()
display1 = Display()
display2 = Display()


# v2: Observer pattern
bus = EventEmitter()
bus.on("temp", display1.show)
bus.on("temp", display2.show)
bus.emit("temp", 25.5)


# v3: Async event bus with priority
import asyncio

class AsyncEventBus:
    def __init__(self):
        self._handlers: dict[str, list] = {}

    async def emit(self, event: str, data):
        tasks = [h(data) for h in self._handlers.get(event, [])]
        await asyncio.gather(*tasks)
```
