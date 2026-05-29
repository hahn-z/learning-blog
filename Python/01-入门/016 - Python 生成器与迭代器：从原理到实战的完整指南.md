---
title: "016 - Python 生成器与迭代器：从原理到实战的完整指南"
slug: "016-generators"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.294+08:00"
updated_at: "2026-04-29T10:02:47.377+08:00"
reading_time: 25
tags: []
---

# Python 生成器与迭代器：从原理到实战的完整指南

> **难度标注**：⭐⭐⭐ 中级 | 预计阅读时间：15 分钟
>
> **前置知识**：Python 基础语法、函数定义、列表推导式、for 循环

---

## 一、概念讲解

### 1.1 什么是迭代器（Iterator）？

迭代器是实现了迭代器协议的对象，即包含 `__iter__()` 和 `__next__()` 两个方法。迭代器让你可以逐个访问集合中的元素，而不需要一次性把所有数据加载到内存。

**核心协议：**
- `__iter__()`：返回迭代器对象本身
- `__next__()`：返回下一个元素，没有更多元素时抛出 `StopIteration`

Python 中所有可迭代对象（list、str、dict 等）都可以通过 `iter()` 函数获得迭代器。

### 1.2 什么是生成器（Generator）？

生成器是创建迭代器的简洁方式。使用 `yield` 关键字的函数会自动变成生成器函数。调用生成器函数不会立即执行，而是返回一个生成器对象，每次调用 `next()` 时执行到下一个 `yield` 处暂停。

**关键特性：**
- **惰性求值**：只在需要时才计算下一个值
- **内存友好**：不会一次性生成所有数据
- **状态保持**：函数的局部变量在 yield 之间保持不变

### 1.3 迭代器 vs 生成器的关系

生成器是一种特殊的迭代器。所有生成器都是迭代器，但并非所有迭代器都是生成器。

```
可迭代对象 (Iterable)
    ├── 序列类型：list, str, tuple
    ├── 集合类型：set, dict
    └── 迭代器 (Iterator)
         ├── 自定义迭代器（手动实现 __iter__, __next__）
         └── 生成器 (Generator)
              ├── 生成器函数（yield）
              └── 生成器表达式（(x for x in ...)）
```

---

## 二、知识脑图

```
Python 生成器与迭代器
├── 迭代器协议
│   ├── __iter__() → 返回 self
│   ├── __next__() → 返回下一个值
│   └── StopIteration 异常
├── 生成器函数
│   ├── yield 关键字
│   ├── yield from 委托
│   ├── send() 双向通信
│   ├── close() 关闭
│   └── throw() 注入异常
├── 生成器表达式
│   ├── (x for x in iterable)
│   └── 惰性求值
├── 内置工具
│   ├── itertools 模块
│   │   ├── count, cycle, repeat
│   │   ├── chain, zip_longest
│   │   └── islice, groupby
│   └── enumerate, reversed
└── 应用场景
    ├── 大文件处理
    ├── 数据流管道
    ├── 无限序列
    └── 协程基础
```

---

## 三、代码演进

### v1：手动实现迭代器

```python
class Countdown:
    """Manual iterator: countdown from n to 1."""

    def __init__(self, n):
        self.n = n
        self.current = n

    def __iter__(self):
        # Return the iterator object itself
        return self

    def __next__(self):
        if self.current <= 0:
            # Signal end of iteration
            raise StopIteration
        value = self.current
        self.current -= 1
        return value


# Usage
for num in Countdown(5):
    print(num, end=" ")  # 5 4 3 2 1
print()
```

**执行预览：**
```
5 4 3 2 1
```

### v2：用生成器函数简化

```python
def countdown(n):
    """Generator version: much simpler."""
    while n > 0:
        # yield pauses the function and returns a value
        yield n
        n -= 1


# Usage is identical
for num in countdown(5):
    print(num, end=" ")  # 5 4 3 2 1
print()

# Generator expression (compact syntax)
squares = (x * x for x in range(10))
print(list(squares))  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

**执行预览：**
```
5 4 3 2 1
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

### v3：高级生成器 — yield from 与数据管道

```python
def read_large_file(filepath, chunk_size=1024):
    """Read a large file line by line without loading all into memory."""
    with open(filepath, "r") as f:
        for line in f:
            # Yield each line lazily
            yield line.strip()


def filter_comments(lines):
    """Filter out comment lines starting with '#'."""
    for line in lines:
        if not line.startswith("#"):
            yield line


def parse_csv_lines(lines):
    """Parse CSV lines into lists of fields."""
    for line in lines:
        yield line.split(",")


def chain_iterables(*iterables):
    """Chain multiple iterables using yield from."""
    for it in iterables:
        # yield from delegates to another iterable
        yield from it


# Pipeline composition
def process_data(filepath):
    raw = read_large_file(filepath)
    no_comments = filter_comments(raw)
    parsed = parse_csv_lines(no_comments)
    return parsed


# Generator with send() for two-way communication
def accumulator():
    """Coroutine-style generator using send()."""
    total = 0
    while True:
        # yield returns current total, receive() gets sent value
        value = yield total
        if value is None:
            break
        total += value


# Usage of accumulator
gen = accumulator()
next(gen)           # Prime the generator → 0
print(gen.send(10))  # → 10
print(gen.send(20))  # → 30
print(gen.send(5))   # → 35
gen.close()

# Chain example
list1 = [1, 2, 3]
list2 = ["a", "b"]
print(list(chain_iterables(list1, list2)))
# [1, 2, 3, 'a', 'b']
```

**执行预览：**
```
10
30
35
[1, 2, 3, 'a', 'b']
```

---

## 四、注意事项

| 要点 | 说明 | 示例 |
|------|------|------|
| 迭代器只能消费一次 | 遍历完后需要重新创建 | `it = iter([1,2]); list(it); list(it)` → 第二次为空 |
| 生成器是单次消费 | yield 出的值不能回退 | `g = countdown(3); list(g); list(g)` → 第二次为空 |
| yield 暂停函数状态 | 局部变量在 yield 间保持 | 函数不会重新执行 |
| yield from 委托 | 简化嵌套生成器 | `yield from sub_generator()` |
| 生成器表达式用圆括号 | 注意和列表推导式的区别 | `(x**2 for x in range(10))` |
| 不要在生成器中 return 值 | return 的值会成为 StopIteration 的参数 | Python 3.x 支持，但容易被忽略 |

---

## 五、避坑指南

### ❌ 坑1：重复消费同一个迭代器

```python
# ❌ Wrong: iterator is exhausted after first use
numbers = iter([1, 2, 3])
print(list(numbers))  # [1, 2, 3]
print(list(numbers))  # [] ← empty!

# ✅ Correct: create a new iterator each time
data = [1, 2, 3]
print(list(iter(data)))  # [1, 2, 3]
print(list(iter(data)))  # [1, 2, 3]
```

### ❌ 坑2：把生成器当列表用

```python
# ❌ Wrong: trying to index a generator
gen = (x * 2 for x in range(10))
# print(gen[5])  # TypeError!

# ✅ Correct: convert to list first, or use islice
from itertools import islice
gen = (x * 2 for x in range(10))
print(list(islice(gen, 5, 6)))  # [10]
```

### ❌ 坑3：忘记 next() 启动 send()

```python
# ❌ Wrong: can't send to unstarted generator
def adder():
    total = 0
    while True:
        val = yield total
        total += val

g = adder()
# g.send(5)  # TypeError!

# ✅ Correct: prime with next() first
g = adder()
next(g)       # Prime → 0
print(g.send(5))  # 5
```

### ❌ 坑4：在 for 循环中手动 next()

```python
# ❌ Wrong: mixing next() with for loop
gen = countdown(3)
for val in gen:
    print(val)
    # print(next(gen))  # Skips values, confuses loop!

# ✅ Correct: use for loop OR next(), not both
gen = countdown(3)
while True:
    try:
        print(next(gen))
    except StopIteration:
        break
```

---

## 六、练习题

### 🟢 初级

1. 编写一个生成器函数 `fibonacci(n)`，生成前 n 个斐波那契数。

```python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(10)))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

2. 使用生成器表达式生成 1-100 中所有偶数的平方。

```python
squares = (x**2 for x in range(2, 101, 2))
print(list(squares)[:5])  # [4, 16, 36, 64, 100]
```

### 🟡 中级

3. 实现一个 `chunked(iterable, size)` 生成器，将可迭代对象按固定大小分组。

```python
def chunked(iterable, size):
    """Yield chunks of the given size."""
    it = iter(iterable)
    while True:
        chunk = []
        try:
            for _ in range(size):
                chunk.append(next(it))
            yield chunk
        except StopIteration:
            if chunk:
                yield chunk
            break

print(list(chunked(range(10), 3)))
# [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]
```

4. 编写一个生成器管道：读取文件 → 过滤空行 → 去除首尾空白 → 统计每行字数。

### 🔴 高级

5. 实现一个支持回溯的迭代器（可以 `undo()` 最近一次 next）。

6. 用生成器实现一个简单的任务调度器，支持任务间的协作式多任务。

---

## 七、知识点总结

```
生成器与迭代器
├── 核心概念
│   ├── 迭代器协议 = __iter__ + __next__
│   ├── 生成器 = yield 自动实现迭代器
│   └── 生成器表达式 = 惰性的列表推导式
├── 关键语法
│   ├── yield → 暂停并返回值
│   ├── yield from → 委托给子生成器
│   ├── send() → 向生成器发送值
│   ├── close() → 关闭生成器
│   └── throw() → 注入异常
├── 内置工具
│   ├── iter() → 获取迭代器
│   ├── next() → 获取下一个值
│   ├── enumerate() → 带索引遍历
│   └── zip() → 并行遍历
└── itertools 模块
    ├── count / cycle / repeat → 无限迭代器
    ├── chain → 串联迭代器
    ├── islice → 切片迭代器
    └── groupby → 分组迭代器
```

---

## 八、举一反三

| 场景 | 传统方式 | 生成器方式 | 优势 |
|------|---------|-----------|------|
| 读取大文件 | `f.readlines()` 全部加载 | `yield line` 逐行 | 内存节省 99%+ |
| 斐波那契数列 | 预先生成列表 | `yield` 按需生成 | 无限序列可行 |
| 数据管道 | 嵌套函数调用 | 生成器链式组合 | 解耦、可复用 |
| CSV 处理 | 全部解析再过滤 | 边读边过滤边处理 | 流式处理 |
| 树形遍历 | 递归 + 列表拼接 | `yield from` 递归 | 避免列表拷贝 |
| 分页数据 | 循环 + 翻页逻辑 | `yield` 每页数据 | 简化调用方代码 |

---

## 九、参考资料

1. [Python 官方文档 - 迭代器类型](https://docs.python.org/3/library/stdtypes.html#iterator-types)
2. [Python 官方文档 - 生成器](https://docs.python.org/3/reference/expressions.html#generator-expressions)
3. [PEP 255 — Simple Generators](https://peps.python.org/pep-0255/)
4. [PEP 380 — Syntax for Delegating to a Subgenerator](https://peps.python.org/pep-0380/)
5. [itertools — Functions creating iterators](https://docs.python.org/3/library/itertools.html)
6. 《Fluent Python》第二版，Luciano Ramalho，第17章

---

## 十、完整示例代码

```python
"""
Complete demo: generators and iterators in Python.
Demonstrates countdown, fibonacci, file pipeline, and itertools.
"""

from itertools import islice, chain, count


# 1. Generator function
def countdown(n):
    """Count down from n to 1."""
    while n > 0:
        yield n
        n -= 1


# 2. Fibonacci generator
def fibonacci():
    """Infinite Fibonacci sequence."""
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


# 3. Data pipeline
def filter_blank(lines):
    """Remove blank lines."""
    for line in lines:
        stripped = line.strip()
        if stripped:
            yield stripped


def add_line_numbers(lines):
    """Add line numbers to each line."""
    for i, line in enumerate(lines, 1):
        yield f"{i:4d} | {line}"


# 4. Tree traversal with yield from
class TreeNode:
    def __init__(self, value, children=None):
        self.value = value
        self.children = children or []

    def depth_first(self):
        """Yield all nodes in depth-first order."""
        yield self.value
        for child in self.children:
            # Delegate to child's iterator
            yield from child.depth_first()


if __name__ == "__main__":
    print("=== Countdown ===")
    print(list(countdown(5)))

    print("\n=== Fibonacci (first 10) ===")
    print(list(islice(fibonacci(), 10)))

    print("\n=== Tree DFS ===")
    tree = TreeNode("root", [
        TreeNode("a", [TreeNode("a1"), TreeNode("a2")]),
        TreeNode("b", [TreeNode("b1")]),
    ])
    print(list(tree.depth_first()))
    # ['root', 'a', 'a1', 'a2', 'b', 'b1']

    print("\n=== Chain example ===")
    c = chain(countdown(3), countdown(2))
    print(list(c))  # [3, 2, 1, 2, 1]
```

**执行预览：**
```
=== Countdown ===
[5, 4, 3, 2, 1]

=== Fibonacci (first 10) ===
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

=== Tree DFS ===
['root', 'a', 'a1', 'a2', 'b', 'b1']

=== Chain example ===
[3, 2, 1, 2, 1]
```

---

> 💡 **一句话总结**：生成器是 Python 中处理数据流和大文件的最佳工具——它用 `yield` 一行代码就实现了迭代器协议的全部功能，让你用最少的内存做最多的事。
