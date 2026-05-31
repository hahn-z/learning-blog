---
title: "011 - Python functools 工具库：函数式编程的瑞士军刀"
slug: "011-functools"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.408+08:00"
updated_at: "2026-04-29T10:02:47.589+08:00"
reading_time: 23
tags: []
---


# Python functools 工具库：函数式编程的瑞士军刀

> **难度：⭐⭐⭐ 中高级** | **阅读时间：约 15 分钟**

---

## 一、概念讲解

`functools` 是 Python 标准库中操作**高阶函数**的模块。高阶函数就是**操作函数的函数**——接收函数作为参数或返回函数。

核心功能分四类：

- **缓存**：`lru_cache`, `cache` — 自动记忆函数结果，加速重复调用
- **函数变换**：`partial`, `reduce` — 固定参数、累积归约
- **装饰器工具**：`wraps`, `singledispatch` — 装饰器基础设施
- **比较排序**：`total_ordering`, `cmp_to_key` — 简化比较逻辑

```
┌────────────────────────────────────────────────┐
│              functools 全景脑图                  │
├──────────────┬──────────────┬──────────────────┤
│    缓存       │  函数变换     │  装饰器/比较      │
├──────────────┼──────────────┼──────────────────┤
│ lru_cache()  │ partial()    │ wraps()          │
│ cache()      │ reduce()     │ singledispatch() │
│              │              │ total_ordering() │
│              │              │ cmp_to_key()     │
└──────────────┴──────────────┴──────────────────┘
```

---

## 二、代码演进

### v1：无缓存递归（初级）

```python
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

print(fib(35))  # Takes seconds! O(2^n) exponential
```

问题：重复计算同一子问题，指数级时间。

### v2：手动字典缓存

```python
_cache = {}
def fib(n):
    if n in _cache: return _cache[n]
    if n < 2: return n
    _cache[n] = fib(n-1) + fib(n-2)
    return _cache[n]

print(fib(100))  # Fast, but boilerplate for every function
```

问题：每个函数都写缓存逻辑，样板代码多。

### v3：lru_cache 装饰器（终极）

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

print(fib(100))       # Instant!
print(fib.cache_info())  # CacheInfo(hits=98, misses=101, ...)
```

一行装饰器，自动缓存 + 统计信息。**这就是 functools 的魅力。**

---

## 三、核心函数详解

### 3.1 lru_cache — LRU 缓存

```python
from functools import lru_cache, cache
import time

@lru_cache(maxsize=128)
def expensive_query(user_id):
    time.sleep(1)  # Simulate slow DB query
    return f"Data for user {user_id}"

# First call: miss (~1s)
start = time.time()
r1 = expensive_query(42)
print(f"Miss: {time.time()-start:.2f}s")

# Second call: HIT (instant)
start = time.time()
r2 = expensive_query(42)
print(f"Hit: {time.time()-start:.4f}s")

print(expensive_query.cache_info())
# CacheInfo(hits=1, misses=1, maxsize=128, currsize=1)

# Clear when data changes
expensive_query.cache_clear()

# Python 3.9+ shortcut: unlimited cache
@cache  # Same as @lru_cache(maxsize=None)
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)
```

### 3.2 partial — 偏函数（固定参数）

```python
from functools import partial

def power(base, exponent):
    return base ** exponent

# Create specialized versions
square = partial(power, exponent=2)
cube = partial(power, exponent=3)
print(square(5))  # 25
print(cube(3))    # 27

# Real-world: customize int() for different bases
hex_to_int = partial(int, base=16)
bin_to_int = partial(int, base=2)
print(hex_to_int("FF"))   # 255
print(bin_to_int("1010"))  # 10

# Real-world: logging shortcuts
import logging
error = partial(logging.log, logging.ERROR)
error("Something went wrong!")
```

### 3.3 wraps — 保留装饰器函数元信息

```python
from functools import wraps
import time

def timer(func):
    @wraps(func)  # Preserves __name__, __doc__, __module__, etc.
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time()-start:.4f}s")
        return result
    return wrapper

@timer
def slow_add(a, b):
    """Add two numbers with delay."""
    time.sleep(0.1)
    return a + b

print(slow_add(1, 2))     # slow_add took 0.10s → 3
print(slow_add.__name__)   # "slow_add" (NOT "wrapper"!)
print(slow_add.__doc__)    # "Add two numbers..." (preserved!)
```

**不加 @wraps：** `__name__` 变 `"wrapper"`，`__doc__` 丢失，调试和文档生成出问题。

### 3.4 singledispatch — 泛型函数（类型分发）

```python
from functools import singledispatch

@singledispatch
def serialize(data):
    raise TypeError(f"Unsupported: {type(data)}")

@serialize.register
def _(data: str):
    return f'"{data}"'

@serialize.register
def _(data: list):
    items = ", ".join(serialize(x) for x in data)
    return f"[{items}]"

@serialize.register
def _(data: dict):
    pairs = [f"{serialize(k)}: {serialize(v)}" for k, v in data.items()]
    return "{" + ", ".join(pairs) + "}"

@serialize.register
def _(data: int):
    return str(data)

print(serialize("hello"))           # "hello"
print(serialize([1, "two", 3]))     # [1, "two", 3]
print(serialize({"a": 1, "b": 2})) # {"a": 1, "b": 2}

# Register custom types
class User:
    def __init__(self, name): self.name = name

@serialize.register
def _(data: User):
    return f'User(name="{data.name}")'

print(serialize(User("Alice")))  # User(name="Alice")
```

### 3.5 total_ordering — 自动补全比较方法

```python
from functools import total_ordering

@total_ordering
class Student:
    def __init__(self, name, score):
        self.name = name
        self.score = score

    def __eq__(self, other):
        return self.score == other.score

    def __lt__(self, other):
        return self.score < other.score
    # total_ordering auto-generates: __le__, __gt__, __ge__

students = [Student("Alice", 85), Student("Bob", 92), Student("Charlie", 78)]
students.sort()
for s in students:
    print(f"{s.name}: {s.score}")
# Charlie: 78 / Alice: 85 / Bob: 92
```

### 3.6 reduce — 累积归约

```python
from functools import reduce
import operator

nums = [1, 2, 3, 4, 5]
print(reduce(operator.add, nums, 0))         # 15 (sum)
print(reduce(operator.mul, nums, 1))         # 120 (product)
print(reduce(lambda a,b: a if a>b else b, nums))  # 5 (max)

# Flatten nested list
nested = [[1,2],[3,4],[5,6]]
print(reduce(operator.concat, nested))  # [1,2,3,4,5,6]

# Pipeline: apply a chain of functions
def pipeline(data, *funcs):
    return reduce(lambda d, f: f(d), funcs, data)

result = pipeline(" hello world ",
                  str.strip,
                  str.title,
                  lambda s: s.replace("World", "Python"))
print(result)  # Hello Python
```

---

## 四、执行预览

```
$ python functools_demo.py
Miss: 1.00s
Hit: 0.0001s
CacheInfo(hits=1, misses=1, maxsize=128, currsize=1)
25
27
255
10
slow_add took 0.10s
3
slow_add
Add two numbers with delay.
"hello"
[1, "two", 3]
{"a": 1, "b": 2}
User(name="Alice")
Charlie: 78
Alice: 85
Bob: 92
15
120
5
[1, 2, 3, 4, 5, 6]
Hello Python
```

---

## 五、注意事项

| 函数 | 注意点 | 风险 |
|------|--------|------|
| `lru_cache` | 参数必须可哈希（不能传 list/dict/set） | 🔴 TypeError |
| `lru_cache` | 缓存不会自动失效，数据变更需 `cache_clear()` | ⚠️ 过期数据 |
| `cache` | 无大小限制，可能内存泄漏 | ⚠️ 内存 |
| `partial` | 返回的不是真正函数，inspect 可能异常 | 💡 低 |
| `reduce` | 空序列无初始值会 TypeError | ⚠️ 中 |
| `total_ordering` | 必须定义 `__eq__` + 一个比较方法 | ⚠️ 中 |
| `singledispatch` | 只根据**第一个参数类型**分发 | 💡 设计限制 |

---

## 六、避坑指南

### ❌ 坑1：lru_cache 传不可哈希参数

```python
# ❌ Wrong: list is unhashable
@lru_cache
def process(items):
    return sum(items)

process([1, 2, 3])  # TypeError: unhashable type: 'list'
```

```python
# ✅ Correct: convert to tuple (hashable)
@lru_cache
def process(items):
    return sum(items)

process(tuple([1, 2, 3]))  # OK! → 6
```

### ❌ 坑2：忘记 cache_clear 导致脏数据

```python
# ❌ Wrong: stale cache after data update
@lru_cache
def get_user(uid):
    return db.query(uid)

get_user(1)  # Cached
db.update(1, name="New Name")
print(get_user(1))  # Still returns OLD data!
```

```python
# ✅ Correct: clear cache after mutations
db.update(1, name="New Name")
get_user.cache_clear()  # Force refresh
print(get_user(1))  # Returns new data
```

### ❌ 坑3：reduce 空序列无初始值

```python
# ❌ Wrong: empty sequence without initializer
from functools import reduce
reduce(lambda a,b: a+b, [])  # TypeError!
```

```python
# ✅ Correct: always provide initializer
reduce(lambda a,b: a+b, [], 0)  # 0 — safe default
```

---

## 七、练习题

### 🟢 基础题

**题目1：** 用 `lru_cache` 实现阶乘函数 `factorial(n)`，打印 `cache_info()` 对比缓存命中情况。

**题目2：** 用 `partial` 创建一个 `double` 函数（`partial(operator.mul, 2)`）。

### 🟡 进阶题

**题目3：** 用 `singledispatch` 实现 `to_json(data)` 函数，支持 str/int/list/dict 四种类型的 JSON 序列化。

**题目4：** 用 `reduce` 实现列表去重（保持顺序）：`dedup([1,2,3,2,1,4]) → [1,2,3,4]`。

### 🔴 挑战题

**题目5：** 实现一个带 TTL（过期时间）的缓存装饰器，在 `lru_cache` 基础上增加时间过期机制。

**题目6：** 用 `partial` + `singledispatch` 实现一个简易的 Web 路由框架，支持按 HTTP 方法和路径分发。

---

## 八、知识点总结

```
functools
├── 缓存
│   ├── lru_cache(maxsize) — LRU缓存装饰器
│   │   ├── cache_info() — 查看命中统计
│   │   └── cache_clear() — 清空缓存
│   └── cache — 无限缓存(Python 3.9+)
├── 函数变换
│   ├── partial(func, *args, **kwargs) — 固定部分参数
│   └── reduce(func, iterable, init) — 累积归约
├── 装饰器工具
│   ├── wraps(func) — 保留函数元信息
│   └── singledispatch — 按首参数类型分发
│       └── .register(type) — 注册类型处理器
└── 比较排序
    ├── total_ordering — 自动补全比较方法
    └── cmp_to_key(cmp_func) — cmp转key函数
```

---

## 九、举一反三

| 场景 | 推荐工具 | 优势 |
|------|----------|------|
| 递归加速 | `@lru_cache` | 一行消除重复计算 |
| API 请求缓存 | `@lru_cache` + TTL | 减少 HTTP 调用 |
| 参数固定/预设 | `partial` | 创建特化函数 |
| 装饰器编写 | `@wraps` | 保留元信息 |
| 多类型处理 | `singledispatch` | 替代 if/elif 类型判断 |
| 对象排序 | `@total_ordering` | 只写2个方法得6个 |
| 函数链/管道 | `reduce` | 数据处理管道 |
| 旧式 cmp 排序 | `cmp_to_key` | 兼容 Python 2 代码 |

---

## 十、参考资料

- [Python 官方文档 — functools](https://docs.python.org/3/library/functools.html)
- [PEP 443 — Single-dispatch generic functions](https://peps.python.org/pep-0443/)
- [PEP 318 — Decorators](https://peps.python.org/pep-0318/)
- 《Fluent Python》第 9 章：装饰器和闭包
