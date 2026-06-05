# Python 生成器与迭代器

> 分类：进阶语法 | 生成器 | 难度：⭐⭐ | 预估用时：30 分钟

---

## 🎯 学习目标

1. ✅ 能够解释迭代器协议（`__iter__`/`__next__`）的工作原理（理解）
2. ✅ 能够独立编写生成器函数和生成器表达式（应用）
3. ✅ 能够利用生成器实现惰性求值和管道模式处理数据（应用）
4. ✅ 能够在处理大数据时选择合适的 itertools 工具（评价）

---

## 📋 前置知识自检

1. **`for x in [1,2,3]` 背后 Python 做了什么？**（答不上来？→ 本文会讲）
2. **你能写一个包含 `__init__` 的类吗？**（答不上来？→ 先补 Python 类基础）
3. **列表推导式 `[x**2 for x in range(10)]` 你用过吗？**（答不上来？→ 先补列表推导式）

---

## 💡 概念讲解

- **一句话定义**：迭代器是实现了 `__iter__` 和 `__next__` 协议的对象；生成器是用 `yield` 关键字定义的懒加载迭代器。
- **现实类比**：迭代器像自助餐 conveyor belt（传送带），每次只给你一道菜，吃完再上下一道；而列表是把所有菜一次性端上桌，桌子放不下就尴尬了。
- **技术场景**：读取大文件、处理海量数据流、构建数据处理管道、无限序列生成。
- **⚠️ 常见误解**：很多人以为生成器就是"省内存的列表"。其实生成器只能遍历一次，不能索引、不能回退，这是用灵活性换来的内存优势。

---

## 🧠 实时脑图

```text
[可迭代对象 Iterable] 🔴
    || has __iter__()
    ↓
[迭代器 Iterator] 🔴
    || has __iter__() + __next__()
    ||
    ├──→ [生成器 Generator] 🔴 ← yield 关键字自动创建
    ||        ||
    ||        ├── 生成器函数 (def + yield)
    ||        └── 生成器表达式 ((x for x in ...))
    ||
    └──→ [自定义迭代器] 🟡 ← 手动实现协议

[itertools 模块] 🟡
    ├── count / cycle / repeat     ← 无限迭代器
    ├── chain / zip_longest        ← 组合迭代器
    ├── islice / takewhile         ← 筛选迭代器
    └── groupby / accumulate       ← 聚合迭代器
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

### 1. 迭代器协议 — 从零理解

```python
"""自定义迭代器：理解 __iter__ 和 __next__ 协议"""

class CountDown:
    """倒计时迭代器"""

    def __init__(self, start: int):
        self.current = start

    def __iter__(self):
        # __iter__ 返回迭代器对象本身
        return self

    def __next__(self):
        # __next__ 返回下一个值，耗尽时抛出 StopIteration
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1


# 使用
for i in CountDown(5):
    print(i, end=" ")  # 5 4 3 2 1
print()
```

### 2. 生成器函数 — yield 的魔力

```python
"""生成器函数：用 yield 实现惰性求值"""

def fibonacci(limit: int):
    """斐波那契数列生成器"""
    a, b = 0, 1
    while a < limit:
        yield a  # 🔴 暂停执行，返回值给调用者
        a, b = b, a + b


# 生成器函数调用时不会执行，返回一个生成器对象
gen = fibonacci(100)
print(type(gen))  # <class 'generator'>

# 惰性求值：每次 next() 才计算下一个值
print(next(gen))  # 0
print(next(gen))  # 1
print(next(gen))  # 1

# 也可以用 for 遍历
for num in fibonacci(50):
    print(num, end=" ")  # 0 1 1 2 3 5 8 13 21 34
print()
```

### 3. 生成器函数 vs 生成器表达式

```python
"""生成器函数 vs 生成器表达式对比"""

# 生成器函数：复杂逻辑
def read_lines(filepath: str):
    """逐行读取大文件，自动去除空白行"""
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped:  # 跳过空行
                yield stripped


# 生成器表达式：简单变换（注意是圆括号，不是方括号）
nums = range(1000000)

# ❌ 列表推导：一次性创建 100 万个元素的列表
# squares_list = [x**2 for x in nums]  # 内存爆炸

# ✅ 生成器表达式：惰性计算，几乎不占内存
squares_gen = (x**2 for x in nums)
print(next(squares_gen))  # 0
print(next(squares_gen))  # 1

# 对比内存占用
import sys
print(f"列表推导大小: {sys.getsizeof([x**2 for x in range(1000)])} bytes")  # ~8KB
print(f"生成器表达式大小: {sys.getsizeof((x**2 for x in range(1000)))} bytes")  # ~200B
```

### 4. 管道模式 — 生成器的杀手级应用

```python
"""管道模式：用生成器构建数据处理流水线"""

# 模拟数据源
def generate_logs(count: int):
    """模拟生成日志数据"""
    import random
    levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    for i in range(count):
        yield f"[{random.choice(levels)}] Log entry {i}"


# 管道各阶段（每个阶段都是生成器）
def filter_errors(logs):
    """过滤 ERROR 级别日志"""
    for log in logs:
        if "[ERROR]" in log or "[CRITICAL]" in log:
            yield log


def parse_log(logs):
    """解析日志，提取级别和内容"""
    for log in logs:
        level = log.split("]")[0].strip("[")
        content = log.split("]")[1].strip()
        yield {"level": level, "content": content}


def format_output(entries):
    """格式化输出"""
    for entry in entries:
        yield f"🚨 [{entry['level']}] {entry['content']}"


# 组装管道 🔴 注意：数据是流式处理的，内存中始终只有当前这一条
pipeline = format_output(
    parse_log(
        filter_errors(
            generate_logs(1000)
        )
    )
)

# 消费管道
for i, result in enumerate(pipeline):
    if i >= 5:  # 只展示前5条
        break
    print(result)
```

### 5. itertools — 标准库里的瑞士军刀

```python
"""itertools 实用工具速览"""
from itertools import (
    count, cycle, repeat,        # 无限迭代器
    chain, zip_longest,          # 组合
    islice, takewhile, dropwhile,  # 切片/筛选
    groupby, accumulate,         # 聚合
    product, permutations, combinations,  # 排列组合
)

# --- chain：拼接多个可迭代对象 ---
list1 = [1, 2, 3]
list2 = ["a", "b", "c"]
print(list(chain(list1, list2)))  # [1, 2, 3, 'a', 'b', 'c']

# --- islice：对任意迭代器切片（不需要转列表） ---
def infinite_numbers():
    n = 0
    while True:
        yield n
        n += 1

# 取第 5 到第 10 个元素
print(list(islice(infinite_numbers(), 5, 10)))  # [5, 6, 7, 8, 9]

# --- groupby：分组（注意：需要先排序！） ---
data = [("fruit", "apple"), ("fruit", "banana"), ("veg", "carrot"), ("veg", "potato")]
for key, group in groupby(data, key=lambda x: x[0]):
    print(f"{key}: {[item[1] for item in group]}")
# fruit: ['apple', 'banana']
# veg: ['carrot', 'potato']

# --- accumulate：累计运算 ---
import operator
scores = [80, 90, 70, 85]
print(list(accumulate(scores, operator.add)))  # [80, 170, 240, 325] 累计总分

# --- product：笛卡尔积 ---
colors = ["red", "blue"]
sizes = ["S", "M"]
print(list(product(colors, sizes)))  # [('red','S'), ('red','M'), ('blue','S'), ('blue','M')]
```

### 6. yield from — 委托给子生成器

```python
"""yield from：委托给子生成器（Python 3.3+）"""

def flatten(nested):
    """递归展平嵌套列表"""
    for item in nested:
        if isinstance(item, (list, tuple)):
            yield from flatten(item)  # 🔴 委托给子生成器
        else:
            yield item


nested = [1, [2, 3], [4, [5, 6]], 7]
print(list(flatten(nested)))  # [1, 2, 3, 4, 5, 6, 7]


# 实际应用：遍历文件目录树
def walk_files(directory: str):
    """递归遍历目录下所有 .py 文件"""
    import os
    for entry in os.scandir(directory):
        if entry.is_file() and entry.name.endswith(".py"):
            yield entry.path
        elif entry.is_dir():
            yield from walk_files(entry.path)  # 🔴 委托给子目录
```

---

## 👀 执行预览

```bash
$ python 06-demo.py
5 4 3 2 1
<class 'generator'>
0
1
1
0 1 1 2 3 5 8 13 21 34
0
1
列表推导大小: 8856 bytes
生成器表达式大小: 200 bytes
🚨 [ERROR] Log entry 12
🚨 [CRITICAL] Log entry 45
🚨 [ERROR] Log entry 78
...
[1, 2, 3, 'a', 'b', 'c']
[5, 6, 7, 8, 9]
fruit: ['apple', 'banana']
veg: ['carrot', 'potato']
[80, 170, 240, 325]
[('red', 'S'), ('red', 'M'), ('blue', 'S'), ('blue', 'M')]
[1, 2, 3, 4, 5, 6, 7]
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| 生成器只能遍历一次 | 第二次遍历为空，无数据 | 🔴 |
| `yield` 使函数变为生成器函数，即使从未执行到 yield | 函数行为完全不同 | 🟡 |
| `itertools.groupby` 需要先按 key 排序 | 相邻但同 key 的元素会被分成两组 | 🟡 |
| 生成器中不要用 `return value`（Python 3.3+ 允许但语义不同） | `return value` 会作为 `StopIteration.value` | 🟢 |
| 生成器表达式用圆括号 `()`，不是方括号 `[]` | 用方括号就变成列表推导了 | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ 对生成器用下标索引 `gen[0]` | `TypeError: 'generator' object is not subscriptable` | ✅ 用 `next(gen)` 或转为列表 |
| ❌ 生成器遍历两次 | 第二次为空 | ✅ 需要多次遍历就 `list(gen)` 转存 |
| ❌ 在生成器中 `return` 了值但期望 yield | 值丢失，函数直接结束 | ✅ 明确区分 `yield`（暂停返回）和 `return`（结束） |
| ❌ `groupby` 没排序就分组 | 同类元素被拆成多组 | ✅ 先 `sorted(data, key=...)` 再 `groupby` |

---

## 🔍 调试排查

#### 故障场景1：生成器没有产出任何值

**症状**：`for x in gen` 循环体从未执行
**排查思路**：
1. 检查生成器函数内部的 `while`/`if` 条件 → 可能一开始就为 False
2. 检查是否之前已经遍历过该生成器 → 生成器耗尽了
3. 加 `print` 在 `yield` 之前确认是否执行到

**根因**：最常见的是生成器已被消费过
**修复**：重新创建生成器，或转为列表保存

#### 故障场景2：管道处理结果不符合预期

**症状**：管道输出少了数据或多了数据
**排查思路**：
1. 分阶段调试：单独测试每个生成器函数
2. 在每个阶段末尾加 `list()` 打印中间结果
3. 检查是否有某个阶段的 `if` 条件过滤掉了不该过滤的数据

**根因**：某个中间阶段的过滤条件有误
**修复**：逐阶段验证，确保每个生成器的输入输出正确

---

## 📝 练习题

### 🟢 基础题（检验理解）

1. **写一个生成器函数 `range_gen(start, stop)`**，模拟 `range()` 的行为（不含 stop）（→ 目标 #1）
2. **解释 `__iter__` 和 `__next__` 各自的职责**，用一句话说明（→ 目标 #1）

### 🟡 进阶题（动手实践）

3. **用生成器管道处理 CSV 数据**：读取 CSV → 过滤空行 → 类型转换 → 输出字典（→ 目标 #3）
4. **用 `itertools` 实现分块（chunk）功能**：将一个长列表按每 N 个元素分组（→ 目标 #4）

### 🔴 开放题（设计思考）

5. **设计一个日志分析系统**：用生成器管道实现"读取 → 过滤 → 聚合 → 输出报告"，要求支持 GB 级日志文件（→ 目标 #3）
6. **比较生成器 vs 列表 vs numpy 数组**在数据处理场景的适用性，给出你的选型建议（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
迭代器与生成器
├── 迭代器协议
│   ├── __iter__() → 返回 self
│   └── __next__() → 返回下一个值 / StopIteration
├── 生成器（自动实现迭代器协议）
│   ├── 生成器函数（yield）
│   ├── 生成器表达式 ((x for x in ...))
│   └── yield from（委托子生成器）
├── 核心特性
│   ├── 惰性求值（按需计算）
│   ├── 只能遍历一次
│   └── 内存占用恒定
├── 管道模式
│   └── 多个生成器串联 → 流式处理
└── itertools 工具集
    ├── 无限：count / cycle / repeat
    ├── 组合：chain / zip_longest
    ├── 切片：islice / takewhile
    ├── 聚合：groupby / accumulate
    └── 排列：product / permutations / combinations
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 读取大文件 | `yield` 逐行读取，内存恒定 |
| 数据库批量查询 | 生成器分页 yield，避免一次加载全部记录 |
| 无限数据流（传感器/日志） | 生成器天然支持无限序列 + `islice` 取窗口 |
| 树形结构遍历 | `yield from` 递归展平 |
| ETL 数据管道 | 多个生成器串联，每步过滤/变换/聚合 |

---

## 🗺️ 学习路径

```
[《05-装饰器》] → **📍 本篇：生成器与迭代器** → [《07-上下文管理器》]
                                    ├─→ [《08-异步编程入门》]
                                    └─→ [《09-异步进阶》]
```

**下一篇**：
- → [《07-Python上下文管理器》](./07-python-上下文管理器.md)：另一个 Python 进阶协议，`with` 语句的底层原理
- → [《08-Python异步编程入门》](./08-python-异步编程入门.md)：生成器是理解 async/await 的前置知识

**相关主题**：
- [《04-Python异常处理》](./04-python-异常处理.md)：`StopIteration` 是迭代器的核心异常
- [《09-Python异步进阶》](./09-python-异步进阶.md)：`async for` 是异步生成器的语法

---

## ⚡ 性能考量

| 方案 | 100万元素 | 内存占用 | 可遍历次数 | 索引访问 |
|------|-----------|----------|-----------|----------|
| 列表 `[x**2 for x in range(N)]` | ~80ms | ~8MB | 无限 | O(1) |
| 生成器 `(x**2 for x in range(N))` | ~90ms | ~200B | 1次 | ❌ |
| NumPy `np.arange(N)**2` | ~5ms | ~8MB | 无限 | O(1) |

**铁蛋建议**：数据量大且只需遍历一次 → 生成器；需要多次访问/索引 → 列表；数值计算 → NumPy。

---

## 📚 参考资料

- [Python 官方文档 - 迭代器类型](https://docs.python.org/3/library/stdtypes.html#iterator-types) [等级：官方] — 理解迭代器协议的标准定义
- [Python 官方文档 - itertools](https://docs.python.org/3/library/itertools.html) [等级：官方] — itertools 全部函数详解 + 食谱
- [PEP 255 — Simple Generators](https://peps.python.org/pep-0255/) [等级：权威] — 生成器最初的设计提案
- [PEP 380 — Syntax for Delegating to a Subgenerator](https://peps.python.org/pep-0380/) [等级：权威] — `yield from` 的设计提案

---

## 📝 练习题参考答案

<details>
<summary>点击展开答案</summary>

**1. range_gen 答案：**
```python
def range_gen(start, stop):
    current = start
    while current < stop:
        yield current
        current += 1
```

**2. 答案：** `__iter__` 返回迭代器对象本身，`__next__` 返回下一个值并在耗尽时抛出 `StopIteration`。

**4. 分块答案：**
```python
from itertools import islice

def chunks(iterable, n):
    it = iter(iterable)
    while batch := list(islice(it, n)):
        yield batch

# 使用
for chunk in chunks(range(10), 3):
    print(chunk)  # [0,1,2] [3,4,5] [6,7,8] [9]
```

</details>
