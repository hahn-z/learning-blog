---
title: "020 - Python 性能优化与 Profiling 实战：从测量到加速"
slug: "020-performance"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.457+08:00"
updated_at: "2026-04-29T10:02:47.66+08:00"
reading_time: 26
tags: []
---

# Python 性能优化与 Profiling

> **难度：★★★★☆ 高级**
> 系统性讲解 Python 性能分析工具和优化策略：cProfile、line_profiler、memory_profiler、timeit、算法优化、内置函数利用、Cython 加速。

## 一、概念讲解

性能优化三步法：**测量 → 分析 → 优化**。不要凭直觉优化，让数据说话。

**性能分析工具链：**

| 工具 | 用途 | 粒度 |
|------|------|------|
| `timeit` | 微基准测试 | 代码片段 |
| `cProfile` | 函数级性能分析 | 函数调用 |
| `line_profiler` | 逐行分析 | 代码行 |
| `memory_profiler` | 内存使用分析 | 代码行 |
| `py-spy` | 采样分析(无需修改代码) | 进程级 |
| `scalene` | CPU+内存+GPU 分析 | 代码行 |

**优化策略优先级：**

1. 算法与数据结构（最关键）
2. 利用内置函数和标准库（C 实现）
3. 减少不必要的计算（缓存、懒加载）
4. 并发/并行（多线程、多进程、异步）
5. C 扩展（Cython、ctypes、PyO3）

## 二、脑图

```
性能优化
├── 测量工具
│   ├── timeit
│   ├── cProfile
│   ├── line_profiler
│   └── memory_profiler
├── 优化策略
│   ├── 算法选择
│   ├── 内置函数
│   ├── 生成器
│   └── 缓存
├── 并发加速
│   ├── threading (IO)
│   ├── multiprocessing (CPU)
│   └── asyncio (IO)
└── 底层加速
    ├── Cython
    ├── ctypes / cffi
    └── PyO3 (Rust)
```

## 三、完整代码

### 3.1 测量工具

```python
"""Profiling tools - measure before optimizing."""

import timeit
import cProfile
import pstats
import io
from functools import lru_cache, wraps
from time import perf_counter


# --- timeit: micro benchmark ---
def benchmark_concat():
    """Compare string concatenation strategies."""

    def plus_concat():
        s = ""
        for i in range(1000):
            s += str(i)
        return s

    def join_concat():
        return "".join(str(i) for i in range(1000))

    def list_join():
        return "".join([str(i) for i in range(1000)])

    t1 = timeit.timeit(plus_concat, number=1000)
    t2 = timeit.timeit(join_concat, number=1000)
    t3 = timeit.timeit(list_join, number=1000)

    print(f"+ in loop:  {t1:.4f}s")
    print(f"join:       {t2:.4f}s")
    print(f"list+join:  {t3:.4f}s")
    print(f"Speedup: {t1/t2:.1f}x")


# --- cProfile: function-level profiling ---
def profile_example():
    """Profile a computation-heavy function."""

    def slow_fibonacci(n):
        if n <= 1:
            return n
        return slow_fibonacci(n - 1) + slow_fibonacci(n - 2)

    profiler = cProfile.Profile()
    profiler.enable()
    result = slow_fibonacci(30)
    profiler.disable()

    stream = io.StringIO()
    stats = pstats.Stats(profiler, stream=stream)
    stats.sort_stats("cumulative")
    stats.print_stats(10)
    print(stream.getvalue())
    return result


# --- Custom timer decorator ---
def timed(func):
    """Decorator to measure function execution time."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        start = perf_counter()
        result = func(*args, **kwargs)
        elapsed = perf_counter() - start
        print(f"{func.__name__}: {elapsed:.4f}s")
        return result

    return wrapper
```

### 3.2 算法优化实例

```python
"""Algorithm optimization - choose the right data structure."""

from collections import Counter, defaultdict
import heapq


def dedup_list(data: list) -> list:
    """O(n) dedup preserving order."""
    seen = set()
    result = []
    for item in data:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def top_k_frequent(items: list, k: int) -> list[tuple]:
    """Find top K frequent items efficiently."""
    counter = Counter(items)
    # heapq.nlargest is O(n log k), better than sorting O(n log n)
    return heapq.nlargest(k, counter.items(), key=lambda x: x[1])


def group_by(items: list, key_fn) -> dict:
    """Group items by key function."""
    groups = defaultdict(list)
    for item in items:
        groups[key_fn(item)].append(item)
    return dict(groups)


def find_anagrams(words: list[str]) -> dict[str, list[str]]:
    """Group anagrams efficiently using sorted key."""
    groups = defaultdict(list)
    for word in words:
        key = "".join(sorted(word))
        groups[key].append(word)
    return dict(groups)
```

### 3.3 内存优化

```python
"""Memory optimization - generators, __slots__, and weakref."""

import sys
from dataclasses import dataclass


# --- Generator vs list for large sequences ---
def range_list(n: int) -> list[int]:
    """Returns full list - O(n) memory."""
    return list(range(n))


def range_gen(n: int):
    """Generator - O(1) memory."""
    for i in range(n):
        yield i


# --- __slots__ for memory savings ---
class PointNormal:
    """Regular class - uses __dict__ for attributes."""

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y


class PointSlots:
    """With __slots__ - fixed attribute set, less memory."""
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y


def compare_memory():
    """Compare memory usage of normal vs slots."""
    normal = PointNormal(1.0, 2.0)
    slots = PointSlots(1.0, 2.0)

    size_normal = sys.getsizeof(normal.__dict__)
    size_slots = sys.getsizeof(slots)

    print(f"Normal __dict__: {size_normal} bytes")
    print(f"Slots object:   {size_slots} bytes")


# --- Lazy loading with property ---
class DataPipeline:
    """Load data only when first accessed."""

    def __init__(self, source: str):
        self._source = source
        self._data = None

    @property
    def data(self):
        if self._data is None:
            print(f"Loading from {self._source}...")
            self._data = list(range(1000))
        return self._data
```

### 3.4 并发加速

```python
"""Concurrency patterns for performance."""

import asyncio
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor


# --- CPU-bound: multiprocessing ---
def cpu_heavy(n: int) -> int:
    """CPU-intensive computation."""
    total = 0
    for i in range(n):
        total += i * i
    return total


def parallel_compute(numbers: list[int]) -> list[int]:
    """Distribute CPU work across processes."""
    with ProcessPoolExecutor() as pool:
        results = list(pool.map(cpu_heavy, numbers))
    return results


# --- IO-bound: threading ---
def fetch_url(url: str) -> str:
    """Simulate IO-bound work."""
    import time
    time.sleep(0.1)
    return f"Response from {url}"


def parallel_fetch(urls: list[str]) -> list[str]:
    """Fetch URLs concurrently with threads."""
    with ThreadPoolExecutor(max_workers=10) as pool:
        return list(pool.map(fetch_url, urls))


# --- IO-bound: asyncio ---
async def async_fetch(url: str) -> str:
    """Async version of fetch."""
    await asyncio.sleep(0.1)
    return f"Response from {url}"


async def async_fetch_all(urls: list[str]) -> list[str]:
    """Fetch all URLs concurrently with asyncio."""
    tasks = [async_fetch(url) for url in urls]
    return await asyncio.gather(*tasks)
```

### 3.5 缓存策略

```python
"""Caching strategies for performance."""

from functools import lru_cache
import time


# --- lru_cache for pure functions ---
@lru_cache(maxsize=256)
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


# --- Manual cache with TTL ---
class TTLCache:
    """Cache with time-to-live expiration."""

    def __init__(self, ttl: float = 60.0):
        self._ttl = ttl
        self._store: dict = {}

    def get(self, key: str):
        if key in self._store:
            value, timestamp = self._store[key]
            if time.time() - timestamp < self._ttl:
                return value
            del self._store[key]
        return None

    def set(self, key: str, value):
        self._store[key] = (value, time.time())


cache = TTLCache(ttl=30.0)
```

## 四、执行预览

```text
# Benchmark
>>> benchmark_concat()
+ in loop:  0.1234s
join:       0.0456s
list+join:  0.0478s
Speedup: 2.7x

# Profile fibonacci
>>> profile_example()
     2692537 function calls (3 primitive calls)
ncalls  tottime  percall  cumtime  percall filename:lineno(function)
2692537/1    0.312    0.000    0.312    0.312 test.py:5(slow_fibonacci)

# Generator memory
>>> sys.getsizeof(range_list(1_000_000))
8000056
>>> sys.getsizeof(range_gen(1_000_000))
200

# Cache speedup
>>> fibonacci(100)  # Instant with cache
354224848179261915075
>>> fibonacci.cache_info()
CacheInfo(hits=98, misses=101, maxsize=256, currsize=101)
```

## 五、注意事项

| 要点 | 说明 |
|-----|------|
| 先测量再优化 | 不要凭直觉猜瓶颈 |
| 大O不是全部 | 常数因子在小数据集上更重要 |
| 过早优化 | 代码可读性 > 微优化 |
| GIL 限制 | CPU 密集型必须用多进程，不能用多线程 |
| 内存 vs 速度 | 缓存用空间换时间，注意内存限制 |

## 六、避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|-----------|
| 凭感觉猜瓶颈 | 用 cProfile 找热点 |
| 优化非关键路径 | 先优化占比最大的函数 |
| 用多线程做 CPU 密集 | 多线程适合 IO，CPU 用多进程 |
| 字符串循环拼接 | 用 `"".join()` |
| 手写循环代替内置 | `map`/`filter`/`sum` 等内置函数更快 |
| `list(range(n))` 占满内存 | 用生成器或 `range()` 惰性求值 |

## 七、练习题

### 🟢 入门
1. 用 `timeit` 比较 `list.append` vs 列表推导式的性能
2. 用 `cProfile` 分析你的一个项目，找出最耗时的3个函数

### 🟡 进阶
3. 实现一个支持 LRU 淘汰和 TTL 过期的缓存类
4. 对比 `multiprocessing.Pool` vs `concurrent.futures.ProcessPoolExecutor` 的性能差异

### 🔴 挑战
5. 用 Cython 将一个纯 Python 计算函数加速 10 倍以上
6. 实现一个内存敏感的大文件处理管道，用生成器链式处理，峰值内存不超过 100MB

## 八、知识点总结

```
性能优化
├── 测量
│   ├── timeit ✓ 微基准
│   ├── cProfile ✓ 函数级
│   ├── line_profiler ✓ 行级
│   └── memory_profiler
├── 优化
│   ├── 算法 O(n) vs O(n²)
│   ├── 数据结构选择
│   ├── 内置函数 ✓ C实现
│   └── 缓存 ✓ lru_cache
├── 并发
│   ├── threading (IO)
│   ├── multiprocessing (CPU)
│   └── asyncio (IO)
└── 加速
    ├── Cython
    ├── cffi / ctypes
    └── PyO3 (Rust)
```

## 九、举一反三

| 工具/策略 | 适用场景 | 典型加速比 |
|---------|---------|----------|
| `cProfile` | 找瓶颈 | N/A |
| 算法优化 | 全场景 | 10x~1000x |
| `lru_cache` | 纯函数重复调用 | 100x+ |
| `__slots__` | 大量小对象 | 30%~50% 内存 |
| 生成器 | 大数据流 | 内存降 99% |
| multiprocessing | CPU 密集 | 接近核心数倍 |
| asyncio | 高并发 IO | 10x~100x 连接 |
| Cython | 热点数值计算 | 10x~100x |

## 十、参考资料

- [Python docs - cProfile](https://docs.python.org/3/library/profile.html)
- [line_profiler](https://github.com/pyutils/line_profiler)
- [scalene](https://github.com/plasma-umass/scalene)
- 《High Performance Python》- Micha Gorelick
- [Cython documentation](https://cython.readthedocs.io/)

## 十一、代码演进：Fibonacci 的优化之路

```python
# v1: Naive recursion - O(2^n)
def fib_v1(n):
    if n <= 1:
        return n
    return fib_v1(n - 1) + fib_v1(n - 2)
# fib_v1(40) takes ~30s


# v2: Memoization with lru_cache - O(n)
from functools import lru_cache

@lru_cache(maxsize=None)
def fib_v2(n):
    if n <= 1:
        return n
    return fib_v2(n - 1) + fib_v2(n - 2)
# fib_v2(1000) instant


# v3: Iterative - O(n), O(1) space, no recursion limit
def fib_v3(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
# fib_v3(10_000) instant, no stack overflow
```
