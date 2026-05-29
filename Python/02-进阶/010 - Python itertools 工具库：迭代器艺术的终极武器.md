---
title: "010 - Python itertools 工具库：迭代器艺术的终极武器"
slug: "010-itertools"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.401+08:00"
updated_at: "2026-04-29T10:02:47.581+08:00"
reading_time: 20
tags: []
---


# Python itertools 工具库：迭代器艺术的终极武器

> **难度：⭐⭐⭐ 中高级** | **阅读时间：约 15 分钟**

---

## 一、概念讲解

`itertools` 是 Python 标准库中处理**迭代器**的模块。三大类工具：

- **无限迭代器**：`count`, `cycle`, `repeat` — 永不停止
- **有限迭代器**：`chain`, `islice`, `zip_longest`, `groupby` 等 — 组合操作
- **组合生成器**：`product`, `permutations`, `combinations` — 排列组合

四个字概括：**快、省、雅**。C 实现快、惰性求值省内存、一行顶十行。

核心思想：**把数据处理变成流水线，数据像水流通过管道，不需一次性加载到内存。**

```
┌──────────────────────────────────────────────────┐
│                itertools 全景脑图                  │
├──────────────┬───────────────┬────────────────────┤
│  无限迭代器   │  有限迭代器    │   组合生成器        │
├──────────────┼───────────────┼────────────────────┤
│ count()      │ chain()       │ product()          │
│ cycle()      │ islice()      │ permutations()     │
│ repeat()     │ zip_longest() │ combinations()     │
│              │ groupby()     │ combinations_with_ │
│              │ accumulate()  │   replacement()    │
│              │ starmap()     │                    │
│              │ filterfalse() │                    │
│              │ dropwhile()   │                    │
│              │ takewhile()   │                    │
└──────────────┴───────────────┴────────────────────┘
```

---

## 二、代码演进：从手写到 itertools

### v1：手写循环（初级）

```python
# Task: flatten nested list, take first 5 even numbers
nested = [[1, 2, 3], [4, 5, 6], [7, 8, 9, 10], [11, 12]]
result = []
for sublist in nested:
    for item in sublist:
        if item % 2 == 0:
            result.append(item)
            if len(result) >= 5:
                break
    if len(result) >= 5:
        break
print(result)  # [2, 4, 6, 8, 10]
```

问题：嵌套循环、手动计数、重复 break。

### v2：列表推导式

```python
flat = [item for sublist in nested for item in sublist]
evens = [x for x in flat if x % 2 == 0]
result = evens[:5]
# Works but creates intermediate lists
```

问题：创建中间列表，大数据浪费内存。

### v3：itertools 流水线

```python
from itertools import chain, filterfalse, islice

evens = filterfalse(lambda x: x % 2 != 0, chain.from_iterable(nested))
result = list(islice(evens, 5))
print(result)  # [2, 4, 6, 8, 10]
```

零中间列表，惰性求值，内存友好。

---

## 三、核心函数详解

### 3.1 无限迭代器

```python
from itertools import count, cycle, repeat

# count: infinite arithmetic progression
for val in count(10, 2):
    if val > 20: break
    print(val, end=" ")  # 10 12 14 16 18 20

# cycle: repeat sequence forever
import itertools
colors = itertools.cycle(["R", "G", "B"])
print([next(colors) for _ in range(7)])  # ['R','G','B','R','G','B','R']

# repeat: repeat a value N times
print(list(repeat("Hi", 3)))  # ['Hi', 'Hi', 'Hi']
```

### 3.2 chain — 拼接迭代器

```python
from itertools import chain

# Merge multiple iterables
print(list(chain([1,2], ["x","y"], [True])))  # [1,2,'x','y',True]

# Flatten one level of nesting
nested = [[1,2],[3,4],[5,6]]
print(list(chain.from_iterable(nested)))  # [1,2,3,4,5,6]
```

### 3.3 islice — 迭代器切片

```python
from itertools import islice

def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

print(list(islice(fibonacci(), 10)))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

print(list(islice(fibonacci(), 5, 15, 2)))
# [5, 21, 89, 377, 1597]

# Pagination on infinite stream
from itertools import count
stream = count(1)
for page in range(3):
    print(f"Page {page+1}: {list(islice(stream, 5))}")
```

### 3.4 groupby — 分组

```python
from itertools import groupby

# MUST sort first! Only groups consecutive elements
students = [
    {"name": "Alice", "grade": "A"},
    {"name": "Bob", "grade": "B"},
    {"name": "Charlie", "grade": "A"},
    {"name": "Diana", "grade": "B"},
]
students.sort(key=lambda s: s["grade"])
for grade, group in groupby(students, key=lambda s: s["grade"]):
    names = [s["name"] for s in group]
    print(f"Grade {grade}: {names}")
# Grade A: ['Alice', 'Charlie']
# Grade B: ['Bob', 'Diana']

# Count consecutive runs
for char, grp in groupby("AABBBCCAA"):
    print(f"{char}×{len(list(grp))}", end=" ")
# A×2 B×3 C×2 A×2
```

### 3.5 accumulate — 累积运算

```python
from itertools import accumulate
import operator

nums = [1, 2, 3, 4, 5]
print(list(accumulate(nums)))             # [1,3,6,10,15] cumulative sum
print(list(accumulate(nums, operator.mul)))  # [1,2,6,24,120] factorial-like
print(list(accumulate([3,1,4,1,5,9], max)))  # [3,3,4,4,5,9] running max
```

### 3.6 组合生成器

```python
from itertools import product, permutations, combinations

print(list(product("AB", "12")))
# [('A','1'),('A','2'),('B','1'),('B','2')]

print(list(permutations("ABC", 2)))
# All orderings of 2 from ABC

print(list(combinations("ABC", 2)))
# [('A','B'),('A','C'),('B','C')]

# Find all 2-sum pairs
nums = [2, 7, 11, 15, 1, 8]
pairs = [(a,b) for a,b in combinations(nums, 2) if a+b == 9]
print(pairs)  # [(2, 7), (1, 8)]
```

---

## 四、执行预览

```
$ python itertools_demo.py
10 12 14 16 18 20
['R', 'G', 'B', 'R', 'G', 'B', 'R']
['Hi', 'Hi', 'Hi']
[1, 2, 'x', 'y', True]
[1, 2, 3, 4, 5, 6]
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
[5, 21, 89, 377, 1597]
Page 1: [1, 2, 3, 4, 5]
Page 2: [6, 7, 8, 9, 10]
Page 3: [11, 12, 13, 14, 15]
Grade A: ['Alice', 'Charlie']
Grade B: ['Bob', 'Diana']
A×2 B×3 C×2 A×2
[1, 3, 6, 10, 15]
[1, 2, 6, 24, 120]
[3, 3, 4, 4, 5, 9]
[(2, 7), (1, 8)]
```

---

## 五、注意事项

| 函数 | 注意点 | 风险 |
|------|--------|------|
| `groupby()` | **必须先排序**，只对连续相同元素分组 | 🔴 易错 |
| 无限迭代器 | 必须设退出条件，否则死循环 | 🔴 死循环 |
| `product()` | 结果集指数增长，repeat=6 就百万级 | 🔴 内存爆炸 |
| `islice()` | 不支持负索引和负步长 | ⚠️ 中 |
| 迭代器 | 只能消费一次，消费后为空 | ⚠️ 中 |
| `chain()` vs `chain.from_iterable` | 前者接受多个参数，后者接受一个嵌套可迭代 | ⚠️ 易混 |

---

## 六、避坑指南

### ❌ 坑1：groupby 不排序

```python
# ❌ Wrong: unsorted → wrong groups
for k, g in groupby(["A","B","A"]):
    print(k, list(g))  # A ['A'] / B ['B'] / A ['A'] → 没真正分组
```

```python
# ✅ Correct: sort first
for k, g in groupby(sorted(["A","B","A"])):
    print(k, list(g))  # A ['A','A'] / B ['B']
```

### ❌ 坑2：迭代器用完为空

```python
# ❌ Wrong: consumed iterator
it = islice(range(10), 3)
print(list(it))  # [0,1,2]
print(list(it))  # [] ← gone!
```

```python
# ✅ Correct: convert to list for reuse
result = list(islice(range(10), 3))
print(result)  # [0,1,2]
print(result)  # [0,1,2] ← still works
```

### ❌ 坑3：product 组合爆炸

```python
# ❌ Wrong: 10**6 tuples in memory
list(product(range(10), repeat=6))  # MemoryError!
```

```python
# ✅ Correct: lazy iteration with islice
for combo in islice(product(range(10), repeat=6), 1000):
    process(combo)
```

---

## 七、练习题

### 🟢 基础题

**题目1：** 用 `chain` 将 `["H","e"]`, `["l","l"]`, `["o"]` 拼成 `['H','e','l','l','o']`。

**题目2：** 用 `islice` 从 `count(1)` 取前 20 个奇数（提示：start=1, step=2）。

### 🟡 进阶题

**题目3：** 用 `groupby` 统计 `"hello world"` 每个字母出现次数（忽略空格，不区分大小写）。

**题目4：** 用 `accumulate` 计算 `[100, -20, 30, -50, 80]` 的账户余额变化过程。

### 🔴 挑战题

**题目5：** 用 `combinations` 找出扑克牌中所有同花顺组合（5张同花色连续数字）。

**题目6：** 用 `islice` + `iter` 实现 `batched(iterable, n)` 分批函数（Python 3.12+ 已内置）。

---

## 八、知识点总结

```
itertools
├── 无限迭代器
│   ├── count(start, step) — 等差数列
│   ├── cycle(iterable) — 循环重复
│   └── repeat(obj, times) — 重复单值
├── 有限迭代器
│   ├── chain(*iterables) — 拼接
│   ├── chain.from_iterable() — 展平一层
│   ├── islice(iter, stop) — 迭代器切片
│   ├── zip_longest(*iter, fillvalue) — 不等长zip
│   ├── groupby(iter, key) — 连续分组
│   ├── accumulate(iter, func) — 累积运算
│   ├── starmap(func, iter) — 解包映射
│   ├── filterfalse(pred, iter) — 反向过滤
│   ├── dropwhile(pred, iter) — 丢弃满足前缀
│   └── takewhile(pred, iter) — 保留满足前缀
└── 组合生成器
    ├── product(*iter, repeat) — 笛卡尔积
    ├── permutations(iter, r) — 排列 P(n,r)
    ├── combinations(iter, r) — 组合 C(n,r)
    └── combinations_with_replacement(iter, r) — 可重组合
```

---

## 九、举一反三

| 场景 | 推荐函数 | 替代手写 |
|------|----------|---------|
| 展平嵌套列表 | `chain.from_iterable` | 双重 for |
| 分页读取大数据 | `islice` | 手动计数 break |
| 分组统计 | `groupby` + `sorted` | 字典+循环 |
| 运行总和/最值 | `accumulate` | 手动累加 |
| 多层嵌套循环 | `product` | 3+层 for |
| 密码/组合生成 | `product(..., repeat=n)` | 递归 |
| 排列/组合 | `permutations`/`combinations` | 递归回溯 |
| 过滤/截取 | `filterfalse`/`takewhile` | if 推导 |

---

## 十、参考资料

- [Python 官方文档 — itertools](https://docs.python.org/3/library/itertools.html)
- [itertools Recipes（官方配方）](https://docs.python.org/3/library/itertools.html#itertools-recipes)
- 《Python Cookbook》第 4 章：迭代器与生成器
- [Real Python — itertools 指南](https://realpython.com/python-itertools/)
