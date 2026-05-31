---
title: "004 - Python列表(List)详解：从入门到精通"
slug: "004-lists"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.226+08:00"
updated_at: "2026-04-29T10:02:47.256+08:00"
reading_time: 26
tags: []
---

# 🟢 Python列表(List)详解

> **难度：** ⭐⭐ 入门级 | **阅读时间：** 15分钟 | **前置知识：** 变量、基本数据类型

## 一、概念讲解

列表(List)是Python中最常用的数据结构，它是一个**有序、可变**的元素集合，可以存放任意类型的对象。

**核心特征：**
- **有序**：元素按插入顺序排列，通过索引访问
- **可变**：可以增删改元素
- **异构**：一个列表可以混合存储不同类型
- **动态**：长度不固定，随时伸缩

```python
# List can hold mixed types
a = [1, "hello", 3.14, True, None]
```

## 二、知识脑图

```
List (列表)
├── 创建
│   ├── 字面量: [1, 2, 3]
│   ├── list(): list(range(5))
│   ├── 推导式: [x**2 for x in range(10)]
│   └── 嵌套: [[1,2], [3,4]]
├── 访问
│   ├── 索引: lst[0], lst[-1]
│   ├── 切片: lst[1:3], lst[::2]
│   └── 遍历: for item in lst
├── 修改
│   ├── 追加: append(), extend()
│   ├── 插入: insert()
│   ├── 删除: remove(), pop(), del, clear()
│   └── 修改: lst[i] = new_value
├── 查询
│   ├── in / not in
│   ├── index(), count()
│   └── len(), max(), min(), sum()
└── 排序
    ├── sort() — 原地排序
    ├── sorted() — 返回新列表
    └── reverse()
```

## 三、完整代码示例

```python
# ============================================
# Python List Complete Guide
# ============================================

# --- 1. Creating lists ---
empty_list = []
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", 3.14, True]
nested = [[1, 2], [3, 4], [5, 6]]
from_range = list(range(1, 6))  # [1, 2, 3, 4, 5]

print("numbers:", numbers)
print("mixed:", mixed)
print("nested:", nested)

# --- 2. Indexing and slicing ---
fruits = ["apple", "banana", "cherry", "date", "elderberry"]

# Indexing (0-based, negative from end)
print("First:", fruits[0])        # apple
print("Last:", fruits[-1])        # elderberry

# Slicing: [start:stop:step]
print("First 3:", fruits[:3])           # ['apple','banana','cherry']
print("Last 2:", fruits[-2:])           # ['date','elderberry']
print("Every other:", fruits[::2])      # ['apple','cherry','elderberry']
print("Reversed:", fruits[::-1])        # full reverse

# --- 3. Modifying lists ---
colors = ["red", "green", "blue"]

# Append single element
colors.append("yellow")
print("After append:", colors)

# Extend with multiple elements
colors.extend(["purple", "orange"])
print("After extend:", colors)

# Insert at specific position
colors.insert(1, "cyan")
print("After insert:", colors)

# Modify by index
colors[0] = "crimson"
print("After modify:", colors)

# Remove by value
colors.remove("green")
print("After remove:", colors)

# Remove by index (pop returns the value)
popped = colors.pop(2)
print(f"Popped '{popped}', remaining:", colors)

# --- 4. Searching and counting ---
nums = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]

print("Count of 5:", nums.count(5))   # 3
print("Index of 9:", nums.index(9))   # 5
print("Is 7 in list?", 7 in nums)     # False
print("Length:", len(nums))            # 11
print("Sum:", sum(nums))               # 44
print("Min:", min(nums))               # 1
print("Max:", max(nums))               # 9

# --- 5. Sorting ---
scores = [88, 72, 95, 60, 78, 85]

# sorted() returns new list (original unchanged)
ascending = sorted(scores)
descending = sorted(scores, reverse=True)
print("Original:", scores)
print("Ascending:", ascending)
print("Descending:", descending)

# sort() modifies in place
scores.sort()
print("In-place sorted:", scores)

# Reverse
scores.reverse()
print("Reversed:", scores)

# --- 6. List comprehension ---
# Basic: squares of 1-10
squares = [x**2 for x in range(1, 11)]
print("Squares:", squares)

# With condition: even squares
even_squares = [x**2 for x in range(1, 21) if x % 2 == 0]
print("Even squares:", even_squares)

# Nested: flatten a 2D list
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [num for row in matrix for num in row]
print("Flattened:", flat)

# --- 7. Copying lists ---
original = [1, 2, [3, 4]]

# Shallow copy
copy1 = original.copy()
copy2 = list(original)
copy3 = original[:]

# Demonstrate shallow copy issue
copy1[2].append(5)
print("Original after modifying nested list in copy:", original)
# Original is affected! [1, 2, [3, 4, 5]]

# Deep copy (use copy module)
import copy
original2 = [1, 2, [3, 4]]
deep = copy.deepcopy(original2)
deep[2].append(5)
print("Original2 after deep copy modify:", original2)  # Unchanged

# --- 8. Useful operations ---
# Zip two lists
names = ["Alice", "Bob", "Charlie"]
ages = [25, 30, 35]
pairs = list(zip(names, ages))
print("Zipped:", pairs)

# Enumerate
for i, name in enumerate(names):
    print(f"  {i}: {name}")

# Join strings from list
words = ["Hello", "World"]
sentence = " ".join(words)
print("Joined:", sentence)
```

### 执行预览

```
numbers: [1, 2, 3, 4, 5]
mixed: [1, 'hello', 3.14, True]
First: apple
Last: elderberry
First 3: ['apple', 'banana', 'cherry']
After append: ['red', 'green', 'blue', 'yellow']
After extend: ['red', 'green', 'blue', 'yellow', 'purple', 'orange']
After insert: ['red', 'cyan', 'green', 'blue', 'yellow', 'purple', 'orange']
Count of 5: 3
Index of 9: 5
Squares: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
Flattened: [1, 2, 3, 4, 5, 6, 7, 8, 9]
Original after modifying nested list in copy: [1, 2, [3, 4, 5]]
Original2 after deep copy modify: [1, 2, [3, 4]]
Zipped: [('Alice', 25), ('Bob', 30), ('Charlie', 35)]
Joined: Hello World
```

## 四、注意事项

| 注意点 | 说明 | 示例 |
|--------|------|------|
| 索引越界 | 访问不存在的索引会抛 `IndexError` | `lst[10]` 当列表只有3个元素 |
| 可变默认参数 | 函数默认参数用列表会共享状态 | `def f(x=[])` — 每次调用共享同一列表 |
| 浅拷贝陷阱 | 嵌套列表的浅拷贝共享内部对象 | `copy()[2].append()` 影响原列表 |
| remove只删第一个 | `remove()` 只移除第一个匹配项 | `[1,2,1].remove(1)` 变 `[2,1]` |
| 排序原地修改 | `sort()` 修改原列表，`sorted()` 不修改 | 根据场景选择 |
| 列表乘法引用 | `[[]] * 3` 三个元素是同一对象 | 用 `[[] for _ in range(3)]` |

## 五、避坑指南

### ❌ 错误：遍历时删除元素
```python
# ❌ Skipping elements during iteration
nums = [1, 2, 2, 3, 4, 2]
for n in nums:
    if n == 2:
        nums.remove(n)
print(nums)  # [1, 3, 4, 2] — missed one!
```

### ✅ 正确：使用列表推导式过滤
```python
# ✅ Create new filtered list
nums = [1, 2, 2, 3, 4, 2]
nums = [n for n in nums if n != 2]
print(nums)  # [1, 3, 4]
```

### ❌ 错误：用 `is` 比较值
```python
# ❌ 'is' checks identity, not equality
a = [1, 2, 3]
b = [1, 2, 3]
print(a is b)  # False (different objects)
```

### ✅ 正确：用 `==` 比较值
```python
# ✅ Use '==' for value comparison
print(a == b)  # True
```

### ❌ 错误：`+` 和 `extend` 混淆
```python
# ❌ + creates new list, wastes memory in loop
result = []
for i in range(1000):
    result = result + [i]  # Creates new list each time
```

### ✅ 正确：使用 `append` 或 `extend`
```python
# ✅ append modifies in place
result = []
for i in range(1000):
    result.append(i)
```

## 六、练习题

### 🟢 入门题
1. 创建一个包含1到20的列表，打印其中所有偶数
2. 写一个函数 `remove_duplicates(lst)` 去除列表中的重复元素（保持顺序）

### 🟡 进阶题
3. 用列表推导式生成九九乘法表（二维列表）
4. 实现一个函数 `flatten(nested_list)` 将任意深度的嵌套列表展平为一维列表

### 🔴 挑战题
5. 实现列表的冒泡排序（不使用 `sort()`），并统计比较次数
6. 编写一个函数 `group_by(lst, key_fn)` 实现类似 SQL GROUP BY 的功能

**参考答案（选做后对照）：**

```python
# 🟢 Q1
nums = list(range(1, 21))
evens = [x for x in nums if x % 2 == 0]
print("Even numbers:", evens)

# 🟢 Q2
def remove_duplicates(lst):
    seen = set()
    result = []
    for item in lst:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

# 🟡 Q3
table = [[i*j for j in range(1, i+1)] for i in range(1, 10)]

# 🟡 Q4
def flatten(nested):
    result = []
    for item in nested:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result

# 🔴 Q5
def bubble_sort(lst):
    arr = lst.copy()
    n = len(arr)
    comparisons = 0
    for i in range(n):
        for j in range(0, n-i-1):
            comparisons += 1
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr, comparisons

# 🔴 Q6
def group_by(lst, key_fn):
    groups = {}
    for item in lst:
        key = key_fn(item)
        groups.setdefault(key, []).append(item)
    return groups
```

## 七、知识点总结

```
Python List 知识树
├── 基础操作
│   ├── 创建: [], list(), range()
│   ├── 索引: [0], [-1], [1:3]
│   └── 遍历: for, enumerate, zip
├── 增删改
│   ├── 增: append, extend, insert
│   ├── 删: remove, pop, del, clear
│   └── 改: lst[i] = val, slice assignment
├── 高级特性
│   ├── 列表推导式: [expr for x in iter if cond]
│   ├── 切片赋值: lst[1:3] = [10, 20]
│   ├── 解包: a, *b, c = [1,2,3,4,5]
│   └── 排序: sort() vs sorted()
└── 注意事项
    ├── 可变对象陷阱
    ├── 浅拷贝 vs 深拷贝
    └── 遍历时删除的问题
```

## 八、举一反三

| 场景 | 用列表 | 用元组 | 用集合 | 用字典 |
|------|--------|--------|--------|--------|
| 有序且可变 | ✅ | ❌ | ❌ | ❌ |
| 有序且不可变 | ❌ | ✅ | ❌ | ❌ |
| 去重 | 需手动 | 需手动 | ✅ | — |
| 键值映射 | ❌ | ❌ | ❌ | ✅ |
| 频繁查找 | O(n)慢 | O(n)慢 | O(1)快 | O(1)快 |
| 栈操作 | append+pop ✅ | ❌ | ❌ | ❌ |
| 队列操作 | pop(0)慢，用deque | ❌ | ❌ | ❌ |

## 九、参考资料

- [Python官方文档 - List](https://docs.python.org/3/tutorial/datastructures.html)
- [Python List Methods](https://www.w3schools.com/python/python_lists_methods.asp)
- [Real Python - Lists and Tuples](https://realpython.com/python-lists-tuples/)

## 十、代码演进

### v1 — 基础：手动管理成绩
```python
# v1: Raw list operations
scores = [85, 92, 78, 90, 88]
scores.append(95)
scores.remove(78)
average = sum(scores) / len(scores)
print(f"Average: {average:.1f}")
```

### v2 — 进阶：函数封装
```python
# v2: Encapsulate in functions
def manage_scores():
    scores = []
    
    def add(score):
        scores.append(score)
    
    def remove(score):
        if score in scores:
            scores.remove(score)
    
    def average():
        return sum(scores) / len(scores) if scores else 0
    
    return add, remove, average

add, remove, avg = manage_scores()
for s in [85, 92, 78, 90, 88, 95]:
    add(s)
remove(78)
print(f"Average: {avg():.1f}")
```

### v3 — 高级：面向对象+数据分析
```python
# v3: OOP with statistics
from statistics import mean, median, stdev

class ScoreManager:
    """Manage and analyze student scores."""
    
    def __init__(self):
        self._scores = []
    
    def add(self, *scores):
        self._scores.extend(scores)
    
    def remove(self, score):
        self._scores = [s for s in self._scores if s != score]
    
    @property
    def stats(self):
        if not self._scores:
            return {}
        return {
            "count": len(self._scores),
            "mean": mean(self._scores),
            "median": median(self._scores),
            "min": min(self._scores),
            "max": max(self._scores),
            "stdev": stdev(self._scores) if len(self._scores) > 1 else 0,
        }
    
    def top_n(self, n=3):
        return sorted(self._scores, reverse=True)[:n]
    
    def grade_distribution(self):
        grades = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        for s in self._scores:
            if s >= 90: grades["A"] += 1
            elif s >= 80: grades["B"] += 1
            elif s >= 70: grades["C"] += 1
            elif s >= 60: grades["D"] += 1
            else: grades["F"] += 1
        return grades

sm = ScoreManager()
sm.add(85, 92, 78, 90, 88, 95, 73, 81)
print("Stats:", sm.stats)
print("Top 3:", sm.top_n(3))
print("Grades:", sm.grade_distribution())
```
