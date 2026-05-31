---
title: "001 - Python 高级数据结构：heapq / bisect / collections 完全指南"
slug: "001-advanced-data-structures"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.349+08:00"
updated_at: "2026-04-29T10:02:47.5+08:00"
reading_time: 22
tags: []
---

> **难度标注**：⭐⭐⭐ 中高级 | 预计阅读时间：20 分钟
> **前置知识**：Python 基础数据类型、列表操作、基本算法复杂度概念

---

## 一、概念讲解

Python 标准库藏着三把利器：`heapq`、`bisect`、`collections`。它们不是炫技工具，而是解决实际性能瓶颈的关键。

### 1.1 heapq — 堆队列

堆是一种特殊的完全二叉树，满足**父节点 ≤ 子节点**（最小堆）。Python 的 `heapq` 模块在**列表**上实现最小堆，时间复杂度：插入 O(log n)，取最小 O(1)，弹出最小 O(log n)。

**核心场景**：Top-K 问题、优先队列、合并有序序列、流式数据中位数。

### 1.2 bisect — 二分查找

`bisect` 在**已排序列表**上做二分查找，时间复杂度 O(log n)。本质是维护有序序列的利器。

**核心场景**：有序插入、区间查找、成绩等级划分、时间线事件管理。

### 1.3 collections — 特殊容器

`collections` 提供了五大特种容器：

| 容器 | 一句话说明 |
|------|-----------|
| `defaultdict` | 带默认值的字典，告别 KeyError |
| `Counter` | 计数器，统计频率的终极武器 |
| `deque` | 双端队列，两端 O(1) 操作 |
| `namedtuple` | 不可变命名元组，轻量级数据类 |
| `OrderedDict` | 有序字典（3.7+ 普通 dict 已有序） |

---

## 二、脑图

```
高级数据结构
├── heapq (堆)
│   ├── heapify — 列表转堆 O(n)
│   ├── heappush / heappop — O(log n)
│   ├── nlargest / nsmallest — Top-K
│   ├── merge — 合并有序序列
│   └── 技巧: 取反实现最大堆
├── bisect (二分)
│   ├── bisect_left / bisect_right — 查找插入点
│   ├── insort_left / insort_right — 插入并保持有序
│   └── 经典: 等级划分、区间匹配
└── collections (容器)
    ├── defaultdict — 工厂函数默认值
    ├── Counter — 统计 + 运算
    ├── deque — 旋转/滑动窗口
    ├── namedtuple — 轻量结构体
    └── ChainMap — 多字典合并视图
```

---

## 三、完整代码

### 3.1 heapq 实战

```python
import heapq
import random

# --- Top-K problem: find top 5 scores ---
scores = [random.randint(0, 100) for _ in range(100)]

# Method 1: nlargest (simple)
top5 = heapq.nlargest(5, scores)
print(f"Top 5: {top5}")

# Method 2: manual heap (more control)
heap = []
for s in scores:
    heapq.heappush(heap, s)
sorted_asc = [heapq.heappop(heap) for _ in range(len(heap))]
print(f"Sorted (asc): {sorted_asc[:5]}...")

# --- Max heap trick: negate values ---
max_heap = [-x for x in scores[:10]]
heapq.heapify(max_heap)
print(f"Max: {-heapq.heappop(max_heap)}")

# --- Priority Queue with tuples ---
tasks = [(3, "write docs"), (1, "fix bug"), (2, "code review")]
heapq.heapify(tasks)
while tasks:
    priority, task = heapq.heappop(tasks)
    print(f"Priority {priority}: {task}")

# --- Merge sorted streams ---
a = [1, 3, 5, 7]
b = [2, 4, 6, 8]
merged = list(heapq.merge(a, b))
print(f"Merged: {merged}")
```

### 3.2 bisect 实战

```python
import bisect

# --- Grade classification ---
def get_grade(score):
    # Map numeric score to letter grade using bisect
    breakpoints = [60, 70, 80, 90]
    grades = ["F", "D", "C", "B", "A"]
    return grades[bisect.bisect_right(breakpoints, score)]

for s in [55, 65, 72, 88, 95]:
    print(f"Score {s} -> Grade {get_grade(s)}")

# --- Maintain sorted list ---
data = [1, 3, 5, 7, 9]
bisect.insort(data, 4)
print(f"After insort(4): {data}")

# --- Find insertion point ---
idx = bisect.bisect_left(data, 5)
print(f"bisect_left(5) = {idx}")  # index of 5

# --- Event timeline: find events in time range ---
events = [(1, "login"), (3, "purchase"), (5, "logout"), (8, "login")]
times = [t for t, _ in events]
start, end = 2, 6
lo = bisect.bisect_left(times, start)
hi = bisect.bisect_right(times, end)
print(f"Events in [{start},{end}]: {events[lo:hi]}")
```

### 3.3 collections 实战

```python
from collections import defaultdict, Counter, deque, namedtuple

# --- defaultdict: group by key ---
words = ["apple", "ant", "bat", "bear", "cat", "apple"]
groups = defaultdict(list)
for w in words:
    groups[w[0]].append(w)
print(dict(groups))

# --- Counter: frequency analysis ---
counter = Counter(words)
print(f"Most common: {counter.most_common(2)}")
print(f"apple count: {counter['apple']}")
print(f"banana count (missing): {counter['banana']}")  # 0, no KeyError!

# Counter arithmetic
c1 = Counter(a=3, b=1)
c2 = Counter(a=1, b=2)
print(f"c1 + c2 = {c1 + c2}")
print(f"c1 - c2 = {c1 - c2}")

# --- deque: sliding window max ---
def sliding_max(nums, k):
    # Find max in each sliding window of size k
    dq = deque()  # stores indices
    result = []
    for i, num in enumerate(nums):
        # Remove elements out of window
        while dq and dq[0] <= i - k:
            dq.popleft()
        # Remove smaller elements (they can't be max)
        while dq and nums[dq[-1]] < num:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result

print(f"Sliding max: {sliding_max([1,3,-1,-3,5,3,6,7], 3)}")

# --- namedtuple: lightweight record ---
Point = namedtuple("Point", ["x", "y"])
p = Point(3, 4)
print(f"Point: {p}, distance: {(p.x**2 + p.y**2)**0.5:.2f}")
```

---

## 四、执行预览

```
Top 5: [100, 99, 97, 96, 95]
Sorted (asc): [0, 1, 1, 2, 3]...
Max: 100
Priority 1: fix bug
Priority 2: code review
Priority 3: write docs
Merged: [1, 2, 3, 4, 5, 6, 7, 8]

Score 55 -> Grade F
Score 65 -> Grade D
Score 72 -> Grade C
Score 88 -> Grade B
Score 95 -> Grade A
After insort(4): [1, 3, 4, 5, 7, 9]
bisect_left(5) = 3
Events in [2,6]: [(3, 'purchase'), (5, 'logout')]

{'a': ['apple', 'ant'], 'b': ['bat', 'bear'], 'c': ['cat', 'apple']}
Most common: [('apple', 2), ('ant', 1)]
apple count: 2
banana count (missing): 0
c1 + c2 = Counter({'a': 4, 'b': 3})
c1 - c2 = Counter({'a': 2})
Sliding max: [3, 3, 5, 5, 6, 7]
Point: Point(x=3, y=4), distance: 5.00
```

---

## 五、注意事项

| 模块 | 注意点 | 说明 |
|------|--------|------|
| heapq | 最小堆 | Python 只提供最小堆，最大堆需取反 |
| heapq | 原地操作 | `heapify` 直接修改原列表 |
| heapq | 元组比较 | 元组按第一元素比较，可用于优先队列 |
| bisect | 前提有序 | 输入必须已排序，否则结果无意义 |
| bisect | left vs right | `bisect_left` 相等插左边，`bisect_right` 插右边 |
| Counter | 缺失返回 0 | 访问不存在的 key 返回 0，不报错 |
| defaultdict | 工厂函数 | 传入的是类型/函数，不是值 |
| deque | maxlen | 设置 maxlen 后自动丢弃溢出元素，适合固定窗口 |

---

## 六、避坑指南

### ❌ 用 sort() 取 Top-K → ✅ 用 heapq.nlargest

```python
# ❌ O(n log n) sort entire list
top5 = sorted(data, reverse=True)[:5]

# ✅ O(n log k) only maintain k elements
top5 = heapq.nlargest(5, data)
```

### ❌ 手写二分查找 → ✅ 用 bisect

```python
# ❌ Error-prone manual binary search
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

# ✅ battle-tested stdlib
idx = bisect.bisect_left(arr, target)
```

### ❌ dict 嵌套初始化繁琐 → ✅ defaultdict

```python
# ❌ Verbose null check every time
d = {}
for word in words:
    key = word[0]
    if key not in d:
        d[key] = []
    d[key].append(word)

# ✅ One-liner initialization
d = defaultdict(list)
for word in words:
    d[word[0]].append(word)
```

### ❌ deque 当列表随机访问 → ✅ 只做两端操作

```python
# ❌ O(n) random access in deque
dq = deque(range(100000))
x = dq[50000]  # slow!

# ✅ Use list for random access, deque for ends
lst = list(range(100000))
x = lst[50000]  # O(1)
```

---

## 七、练习题

### 🟢 基础题

**题目 1**：用 `heapq` 实现一个数据流的中位数计算器。
- 提示：维护一个最大堆（左半）和最小堆（右半）。

**题目 2**：用 `Counter` 统计一段英文文本中每个单词的出现频率，输出 Top 10。

### 🟡 进阶题

**题目 3**：用 `bisect` 实现一个 `TimeMap` 数据结构，支持 `set(key, value, timestamp)` 和 `get(key, timestamp)` 操作。
- `get` 返回 timestamp ≤ 给定时间的最新值。

**题目 4**：用 `deque` 实现 LRU 缓存（不使用 `functools.lru_cache`）。

### 🔴 挑战题

**题目 5**：用 `heapq` + `defaultdict` 实现一个任务调度器：每个任务有优先级和类别，支持按类别过滤后取最高优先级任务。

---

## 八、知识点总结

```
高级数据结构
├── heapq
│   ├── heapify(list) → O(n) 建堆
│   ├── heappush/heappop → O(log n)
│   ├── nlargest/nsmallest → O(n log k)
│   ├── merge(*iterables) → 惰性合并
│   └── 最大堆 = 对元素取反
├── bisect
│   ├── bisect_left/right → 插入位置
│   ├── insort_left/right → 插入并保持有序
│   └── 适用: 等级映射、区间查询
└── collections
    ├── defaultdict(factory) → 自动初始化
    ├── Counter → most_common, +, -, &, |
    ├── deque → popleft, appendleft, rotate, maxlen
    ├── namedtuple → 不可变, 可索引, 可 .attr
    └── ChainMap → 多字典只读合并
```

---

## 九、举一反三

| 场景 | 用什么 | 为什么 |
|------|--------|--------|
| 合并 K 个有序文件 | heapq.merge | 惰性合并，内存友好 |
| 实时排行榜 Top 10 | heapq.nlargest | O(n log k) 比 sort 快 |
| 插入数据保持有序 | bisect.insort | O(log n) 查找 + O(n) 插入 |
| 词频统计 | Counter | 一行搞定统计 + 排序 |
| 滑动窗口 / BFS | deque | 两端 O(1) 操作 |
| 多层配置合并 | ChainMap | 不复制，只读视图 |
| 轻量数据记录 | namedtuple | 比 class 轻量，比 tuple 可读 |
| 定长日志缓冲 | deque(maxlen=N) | 自动淘汰最老记录 |

---

## 十、参考资料

- [Python heapq 官方文档](https://docs.python.org/3/library/heapq.html)
- [Python bisect 官方文档](https://docs.python.org/3/library/bisect.html)
- [Python collections 官方文档](https://docs.python.org/3/library/collections.html)
- 《算法导论》第 6 章：堆排序
- LeetCode 239 题：滑动窗口最大值（deque 经典应用）

---

## 十一、代码演进

### 需求：统计文本词频并找 Top-K

```python
# v1: Manual approach — works but verbose
def top_words_v1(text, k):
    freq = {}
    for word in text.split():
        freq[word] = freq.get(word, 0) + 1
    return sorted(freq.items(), key=lambda x: -x[1])[:k]

# v2: Counter simplifies counting
def top_words_v2(text, k):
    from collections import Counter
    return Counter(text.split()).most_common(k)

# v3: For massive files, use heap to save memory
def top_words_v3(filepath, k):
    from collections import Counter
    import heapq
    counter = Counter()
    with open(filepath) as f:
        for line in f:
            counter.update(line.split())
    return heapq.nlargest(k, counter.items(), key=lambda x: x[1])
```

**演进说明**：v1 手动计数排序 → v2 Counter 一行搞定 → v3 流式处理大文件 + heap 优化内存。
