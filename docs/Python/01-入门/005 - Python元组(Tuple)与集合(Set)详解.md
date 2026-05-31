---
title: "005 - Python元组(Tuple)与集合(Set)详解"
slug: "005-tuples-sets"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.231+08:00"
updated_at: "2026-04-29T10:02:47.263+08:00"
reading_time: 29
tags: []
---

# 🟢 Python元组(Tuple)与集合(Set)详解

> **难度：** ⭐⭐ 入门级 | **阅读时间：** 15分钟 | **前置知识：** 列表基础

## 一、概念讲解

### 元组(Tuple)
元组是**有序、不可变**的序列。一旦创建，元素不能增删改。适合存放**不该被修改的数据**。

```python
point = (3, 4)          # Coordinates — shouldn't change
rgb = (255, 128, 0)     # Color — fixed by definition
```

### 集合(Set)
集合是**无序、不重复**的元素集合。天生去重，支持数学集合运算（交集、并集、差集）。

```python
tags = {"python", "code", "fun"}       # Unique tags
letters = set("hello")                   # {'h', 'e', 'l', 'o'}
```

**三者对比速览：**

| 特性 | 列表 List | 元组 Tuple | 集合 Set |
|------|-----------|------------|----------|
| 有序 | ✅ | ✅ | ❌ |
| 可变 | ✅ | ❌ | ✅ |
| 可重复 | ✅ | ✅ | ❌ |
| 可哈希 | ❌ | ✅（元素也可哈希时） | ❌ |
| 语法 | [1,2,3] | (1,2,3) | {1,2,3} |
| 查找速度 | O(n) | O(n) | O(1) |

## 二、知识脑图

```
Tuple & Set
├── Tuple (元组)
│   ├── 创建: (), (1,), tuple()
│   ├── 访问: 索引、切片（同列表）
│   ├── 解包: a, b = (1, 2)
│   ├── 命名元组: namedtuple
│   └── 用途: 不可变数据、字典键、函数返回多值
├── Set (集合)
│   ├── 创建: {1,2,3}, set()
│   ├── 操作: add, remove, discard
│   ├── 运算: | (并), & (交), - (差), ^ (对称差)
│   ├── 方法: union, intersection, difference
│   └── frozenset: 不可变集合
└── 共同点
    ├── 都是内置类型
    ├── 支持迭代
    └── 支持 len(), in
```

## 三、完整代码示例

```python
# ============================================
# Python Tuple & Set Complete Guide
# ============================================

# ==================
# PART 1: TUPLES
# ==================

# --- 1. Creating tuples ---
single = (42,)          # Single element — NOTE the comma!
empty = tuple()
from_list = tuple([1, 2, 3])
no_parens = 1, 2, 3     # Parentheses are optional

print("single:", single, type(single))
print("no_parens:", no_parens, type(no_parens))

# --- 2. Accessing ---
colors = ("red", "green", "blue", "yellow")
print("First:", colors[0])
print("Slice:", colors[1:3])
print("Last:", colors[-1])

# --- 3. Tuple unpacking ---
point = (3, 4)
x, y = point
print(f"Point: x={x}, y={y}")

# Extended unpacking
first, *middle, last = (1, 2, 3, 4, 5)
print(f"first={first}, middle={middle}, last={last}")

# Swap variables (tuple unpacking trick)
a, b = 10, 20
a, b = b, a
print(f"Swapped: a={a}, b={b}")

# --- 4. Tuple as dict key (hashable!) ---
location_map = {
    (35.6895, 139.6917): "Tokyo",
    (40.7128, -74.0060): "New York",
    (31.2304, 121.4737): "Shanghai",
}
print("Shanghai:", location_map[(31.2304, 121.4737)])

# --- 5. Named tuple ---
from collections import namedtuple

Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(f"Point: x={p.x}, y={p.y}")
print("Distance from origin:", (p.x**2 + p.y**2)**0.5)

# --- 6. Tuple methods ---
nums = (1, 2, 3, 2, 4, 2)
print("Count of 2:", nums.count(2))
print("Index of 3:", nums.index(3))

# ==================
# PART 2: SETS
# ==================

# --- 1. Creating sets ---
fruits = {"apple", "banana", "cherry"}
empty_set = set()           # NOT {} — that's an empty dict!
from_string = set("abracadabra")
from_list = set([1, 2, 2, 3, 3, 3])

print("fruits:", fruits)
print("from_string:", from_string)
print("from_list:", from_list)       # {1, 2, 3} — deduplicated

# --- 2. Set operations ---
a = {1, 2, 3, 4, 5}
b = {4, 5, 6, 7, 8}

# Union (并集)
print("Union |:", a | b)
print("Union method:", a.union(b))

# Intersection (交集)
print("Intersection &:", a & b)
print("Intersection method:", a.intersection(b))

# Difference (差集)
print("Difference -:", a - b)
print("a minus b:", a.difference(b))

# Symmetric difference (对称差)
print("Sym diff ^:", a ^ b)

# Subset / Superset checks
small = {1, 2}
print("{1,2} subset of a?", small.issubset(a))
print("a superset of {1,2}?", a.issuperset(small))

# --- 3. Modifying sets ---
colors = {"red", "green", "blue"}
colors.add("yellow")
print("After add:", colors)

colors.discard("green")    # Safe — no error if missing
colors.remove("blue")      # Raises KeyError if missing
print("After remove:", colors)

# --- 4. Practical examples ---
# Remove duplicates from list while preserving order
def dedupe(items):
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
print("Deduplicated (ordered):", dedupe(data))

# Find common elements
team_a_skills = {"Python", "SQL", "Git", "Docker"}
team_b_skills = {"Java", "Git", "AWS", "Python"}
common = team_a_skills & team_b_skills
all_skills = team_a_skills | team_b_skills
unique_to_a = team_a_skills - team_b_skills
print("Common skills:", common)
print("All skills:", all_skills)
print("Unique to A:", unique_to_a)

# --- 5. Frozenset (immutable set) ---
fs = frozenset([1, 2, 3])
# fs.add(4)  # AttributeError — can't modify
print("Frozenset:", fs)

# Use as dict key or set element
graph = {
    frozenset(["A", "B"]): "edge-AB",
    frozenset(["B", "C"]): "edge-BC",
}
print("Graph:", graph)

# --- 6. Set comprehension ---
even_squares = {x**2 for x in range(1, 11) if x % 2 == 0}
print("Even squares set:", even_squares)
```

### 执行预览

```
single: (42,) <class 'tuple'>
no_parens: (1, 2, 3) <class 'tuple'>
First: red
Slice: ('green', 'blue')
Point: x=3, y=4
first=1, middle=[2, 3, 4], last=5
Swapped: a=20, b=10
Shanghai: Shanghai
Point: x=3, y=4
Distance from origin: 5.0
Count of 2: 3
Index of 3: 2
from_string: {'a', 'b', 'r', 'c', 'd'}
from_list: {1, 2, 3}
Union |: {1, 2, 3, 4, 5, 6, 7, 8}
Intersection &: {4, 5}
Difference -: {1, 2, 3}
Sym diff ^: {1, 2, 3, 6, 7, 8}
Deduplicated (ordered): [3, 1, 4, 5, 9, 2, 6]
Common skills: {'Python', 'Git'}
Even squares set: {64, 100, 4, 36, 16}
```

## 四、注意事项

| 注意点 | 说明 | 示例 |
|--------|------|------|
| 单元素元组 | 必须加逗号 | `(42)` 是int，`(42,)` 才是tuple |
| 空集合 | `set()` 不是 `{}` | `{}` 创建的是空字典 |
| 集合元素必须可哈希 | 列表、字典不能放集合里 | `{[1,2]}` → TypeError |
| 元组元素不可变 | 但嵌套的可变对象可以改 | `t = ([1],); t[0].append(2)` 合法 |
| 集合无序 | 不要依赖遍历顺序 | `{1,2,3}` 的迭代顺序不保证 |
| remove vs discard | remove不存在会报错 | discard安全，remove严格 |

## 五、避坑指南

### ❌ 忘记逗号
```python
# ❌ This is NOT a tuple
t = (42)
print(type(t))  # <class 'int'>
```

### ✅ 正确写法
```python
# ✅ Always add comma for single element
t = (42,)
print(type(t))  # <class 'tuple'>
```

### ❌ 用 `{}` 创建空集合
```python
# ❌ This creates an empty DICT
s = {}
print(type(s))  # <class 'dict'>
```

### ✅ 正确写法
```python
# ✅ Use set() for empty set
s = set()
print(type(s))  # <class 'set'>
```

### ❌ 集合里放可变对象
```python
# ❌ List is unhashable
s = {[1, 2, 3]}  # TypeError: unhashable type: 'list'
```

### ✅ 正确写法
```python
# ✅ Use tuple instead
s = {(1, 2, 3)}  # OK — tuples are hashable
```

### ❌ 遍历集合期望固定顺序
```python
# ❌ Set order is NOT guaranteed
s = {3, 1, 2}
for x in s:
    print(x)  # May print in ANY order
```

### ✅ 正确写法
```python
# ✅ Sort if order matters
for x in sorted(s):
    print(x)  # 1, 2, 3 — deterministic
```

## 六、练习题

### 🟢 入门题
1. 创建一个元组存储一周七天，打印周末（最后两天）
2. 用集合找出两个列表的公共元素：`[1,2,3,4,5]` 和 `[4,5,6,7,8]`

### 🟡 进阶题
3. 实现函数 `find_unique(lst1, lst2)` 返回两个列表中各自独有的元素（用集合）
4. 用 namedtuple 定义一个 `Student` 类型（name, age, score），创建3个学生并按分数排序

### 🔴 挑战题
5. 实现一个简单的标签系统：用集合管理文章标签，支持增删、查找交集标签的文章、查找并集标签的文章
6. 用元组实现一个不可变的二维向量类，支持加法和点积运算

**参考答案：**

```python
# 🟢 Q1
week = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
print("Weekend:", week[-2:])

# 🟢 Q2
common = set([1,2,3,4,5]) & set([4,5,6,7,8])
print("Common:", common)

# 🟡 Q3
def find_unique(lst1, lst2):
    s1, s2 = set(lst1), set(lst2)
    return {"only_in_1": s1 - s2, "only_in_2": s2 - s1}

# 🟡 Q4
from collections import namedtuple
Student = namedtuple("Student", ["name", "age", "score"])
students = [Student("Alice", 20, 92), Student("Bob", 21, 85), Student("Carol", 20, 88)]
top = sorted(students, key=lambda s: s.score, reverse=True)
for s in top:
    print(f"  {s.name}: {s.score}")

# 🔴 Q5
class TagSystem:
    def __init__(self):
        self.articles = {}  # id -> set of tags
    
    def add(self, aid, tags):
        self.articles[aid] = set(tags)
    
    def find_intersection(self, tags):
        t = set(tags)
        return {aid for aid, atags in self.articles.items() if t.issubset(atags)}
    
    def find_union(self, tags):
        t = set(tags)
        return {aid for aid, atags in self.articles.items() if t & atags}

# 🔴 Q6
class Vector2D:
    def __init__(self, x, y):
        self._data = (x, y)
    
    @property
    def x(self): return self._data[0]
    
    @property
    def y(self): return self._data[1]
    
    def __add__(self, other):
        return Vector2D(self.x + other.x, self.y + other.y)
    
    def dot(self, other):
        return self.x * other.x + self.y * other.y
    
    def __repr__(self):
        return f"Vector2D({self.x}, {self.y})"

v1, v2 = Vector2D(3, 4), Vector2D(1, 2)
print(v1 + v2)        # Vector2D(4, 6)
print(v1.dot(v2))     # 11
```

## 七、知识点总结

```
Tuple & Set 知识树
├── Tuple
│   ├── 创建: (1,2,3), tuple(), 逗号自动打包
│   ├── 不可变性: 不能增删改（但嵌套可变对象可以改）
│   ├── 解包: a,b = t, a,*b,c = t, 交换 a,b = b,a
│   ├── 可哈希: 可做字典键、集合元素
│   ├── namedtuple: 具名访问 p.x, p.y
│   └── 用途: 配置常量、函数返回多值、字典键
├── Set
│   ├── 创建: {1,2,3}, set()
│   ├── 去重: 天然不重复
│   ├── 运算: | 并, & 交, - 差, ^ 对称差
│   ├── 查找: O(1) — 比列表快
│   ├── frozenset: 不可变集合，可哈希
│   └── 推导式: {expr for x in iter if cond}
└── 选型指南
    ├── 固定数据 → Tuple
    ├── 去重/集合运算 → Set
    ├── 有序可变 → List
    └── 键值对 → Dict
```

## 八、举一反三

| 实际场景 | 推荐类型 | 原因 |
|----------|----------|------|
| 函数返回多个值 | Tuple | `(x, y)` 解包方便 |
| 配置项不可修改 | Tuple | 不可变，防止误改 |
| 去重 | Set | 天然去重，O(1)查找 |
| 权限检查 | Set | `user_roles & required` 一行搞定 |
| 缓存键 | Tuple | 可哈希，能做字典键 |
| 数学集合运算 | Set | 原生支持交并差 |
| 颜色RGB | Tuple | 固定3个值，不该变 |
| 标签系统 | Set | 去重+交集查找 |

## 九、参考资料

- [Python官方文档 - Tuples](https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences)
- [Python官方文档 - Sets](https://docs.python.org/3/tutorial/datastructures.html#sets)
- [Real Python - Sets](https://realpython.com/python-sets/)

## 十、代码演进

### v1 — 基础：简单使用元组和集合
```python
# v1: Basic usage
point = (3, 4)
print(f"Point: {point[0]}, {point[1]}")

numbers = [1, 2, 2, 3, 3, 4]
unique = set(numbers)
print("Unique:", unique)
```

### v2 — 进阶：函数返回元组 + 集合运算
```python
# v2: Functions returning tuples + set operations
def analyze_text(text):
    words = text.lower().split()
    unique = set(words)
    return len(words), len(unique), unique

text = "the cat sat on the mat the cat ate the rat"
total, unique_count, word_set = analyze_text(text)
print(f"Total: {total}, Unique: {unique_count}")
print("Words:", word_set)
```

### v3 — 高级：数据分析管道
```python
# v3: Data pipeline with tuples and sets
from collections import namedtuple

Record = namedtuple("Record", ["id", "tags", "score"])

class DataAnalyzer:
    """Analyze records using tuples and sets."""
    
    def __init__(self):
        self.records = []
    
    def add(self, id, tags, score):
        self.records.append(Record(id, frozenset(tags), score))
    
    def find_by_tags(self, required_tags, mode="and"):
        required = frozenset(required_tags)
        results = []
        for r in self.records:
            if mode == "and" and required.issubset(r.tags):
                results.append(r)
            elif mode == "or" and required & r.tags:
                results.append(r)
        return sorted(results, key=lambda r: r.score, reverse=True)
    
    def tag_stats(self):
        all_tags = set()
        for r in self.records:
            all_tags |= r.tags
        return {tag: sum(1 for r in self.records if tag in r.tags) for tag in all_tags}

da = DataAnalyzer()
da.add(1, ["python", "web", "backend"], 92)
da.add(2, ["python", "data", "ml"], 88)
da.add(3, ["web", "frontend", "css"], 75)
da.add(4, ["python", "ml", "deep-learning"], 95)

print("Python + Web (AND):", da.find_by_tags(["python", "web"], "and"))
print("Python or ML (OR):", [(r.id, r.score) for r in da.find_by_tags(["python", "ml"], "or")])
print("Tag stats:", da.tag_stats())
```
