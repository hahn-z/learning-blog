---
title: "015 - 装饰器详解：掌握 Python 最优雅的语法糖"
slug: "015-decorators"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.287+08:00"
updated_at: "2026-04-29T10:02:47.367+08:00"
reading_time: 23
tags: []
---

# 装饰器详解：掌握 Python 最优雅的语法糖

> **难度：** ⭐⭐⭐☆☆（中级）
> **前置知识：** 函数是一等公民、`*args/**kwargs`、闭包基础
> **阅读时间：** 约 30 分钟

---

## 1. 概念讲解

### 什么是装饰器？

装饰器（Decorator）是一个**接收函数作为参数并返回新函数**的高阶函数。它在不修改原函数代码的前提下，**增强函数的行为**。

```
类比：
  装饰器 = 给手机套个壳
  手机本身没变（原函数不变）
  但多了防摔功能（新增功能）
```

### 核心原理：函数是一等公民

```python
# Functions can be assigned to variables
def greet(name):
    return f"Hello, {name}"

say_hello = greet          # function as variable
print(say_hello("World"))  # Hello, World

# Functions can be passed as arguments
def apply(func, value):
    return func(value)

print(apply(str.upper, "hello"))  # HELLO

# Functions can be returned from other functions
def make_multiplier(n):
    def multiply(x):
        return x * n
    return multiply

double = make_multiplier(2)
print(double(5))  # 10
```

### 装饰器的本质

```python
@decorator
def func():
    pass

# 等价于：
func = decorator(func)
```

`@decorator` 就是语法糖——把原函数传给装饰器，用返回的新函数替换原函数。

---

## 2. 知识脑图

```
装饰器详解
├── 基础
│   ├── 函数是一等公民
│   ├── 高阶函数（接收/返回函数）
│   ├── 闭包（inner function 记住外层变量）
│   └── @语法糖 → func = decorator(func)
├── 装饰器类型
│   ├── 无参数装饰器
│   ├── 带参数装饰器（三层嵌套）
│   ├── 类装饰器（__call__）
│   ├── 装饰器堆叠（从下往上执行）
│   └── functools.wraps（保留元信息）
├── 常用标准库装饰器
│   ├── @property / @staticmethod / @classmethod
│   ├── @functools.lru_cache
│   ├── @functools.singledispatch
│   └── @dataclasses.dataclass
└── 实战场景
    ├── 日志记录 @log
    ├── 性能计时 @timer
    ├── 权限校验 @require_auth
    ├── 重试机制 @retry
    └── 缓存 @cache
```

---

## 3. 代码演进

### v1：基础装饰器（无参数）

```python
# v1: Basic decorator - no arguments

import functools
import time

def timer(func):
    """Measure execution time of a function."""
    @functools.wraps(func)  # preserve original function metadata
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"[{func.__name__}] took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_add(a, b):
    time.sleep(0.1)
    return a + b

print(slow_add(1, 2))
# [slow_add] took 0.1005s
# 3

print(slow_add.__name__)  # "slow_add" (preserved by @wraps)
```

### v2：带参数的装饰器

```python
# v2: Decorator with arguments (3-level nesting)

import functools

def retry(max_attempts: int = 3, delay: float = 1.0):
    """Retry a function on failure, with configurable attempts and delay."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import time
            last_error = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    print(f"  Attempt {attempt}/{max_attempts} failed: {e}")
                    if attempt < max_attempts:
                        time.sleep(delay)
            raise last_error
        return wrapper
    return decorator

@retry(max_attempts=3, delay=0.5)
def fetch_data(url: str):
    import random
    if random.random() < 0.7:
        raise ConnectionError(f"Failed to connect: {url}")
    return f"Data from {url}"

# fetch_data("https://api.example.com")
# May retry up to 3 times before succeeding or raising
```

### v3：完整版（类装饰器 + 堆叠 + 实用工具库）

```python
# v3: Class decorator, stacking, and a utility library

import functools
import time
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# --- 1. Class-based decorator ---
class RateLimiter:
    """Limit how often a function can be called."""
    def __init__(self, calls_per_second: float = 1.0):
        self.min_interval = 1.0 / calls_per_second
        self.last_call = 0.0

    def __call__(self, func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.perf_counter() - self.last_call
            if elapsed < self.min_interval:
                wait = self.min_interval - elapsed
                print(f"  Rate limited, waiting {wait:.2f}s")
                time.sleep(wait)
            self.last_call = time.perf_counter()
            return func(*args, **kwargs)
        return wrapper

# --- 2. Stackable decorators ---
def log(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger.info(f"→ Calling {func.__name__}({args}, {kwargs})")
        result = func(*args, **kwargs)
        logger.info(f"← {func.__name__} returned {result!r}")
        return result
    return wrapper

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"  ⏱ {func.__name__}: {elapsed:.4f}s")
        return result
    return wrapper

# --- 3. Memoization decorator ---
def memoize(func):
    cache = {}
    @functools.wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    wrapper.cache = cache  # expose cache for inspection
    return wrapper

# --- Demo: stacking and class decorator ---
@log
@timer
@memoize
def fibonacci(n: int) -> int:
    """Recursive fibonacci (memoized to avoid exponential blowup)."""
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@RateLimiter(calls_per_second=2)
def ping(host: str):
    return f"pong from {host}"

if __name__ == "__main__":
    # Stacked decorators: log → timer → memoize → fibonacci
    print(fibonacci(10))
    print(f"Cache entries: {len(fibonacci.cache)}")

    # Rate limiter
    for i in range(3):
        print(ping(f"host-{i}"))
```

---

## 4. 执行预览

```
→ Calling wrapper(10,)
  ⏱ wrapper: 0.0001s
← wrapper returned 55
55
Cache entries: 11
pong from host-0
  Rate limited, waiting 0.50s
pong from host-1
  Rate limited, waiting 0.50s
pong from host-2
```

---

## 5. 注意事项

| 项目 | 说明 |
|------|------|
| `@functools.wraps` 必须用 | 否则原函数的 `__name__`、`__doc__` 会丢失 |
| 装饰器堆叠顺序 | `@A @B def f` 等价于 `f = A(B(f))`，从下往上包裹 |
| 带参数装饰器三层 | 最外层接收参数，中间层是真正装饰器，最内层是 wrapper |
| 类装饰器用 `__call__` | 让实例可以像函数一样被调用 |
| `lru_cache` 代替手写 memoize | 标准库自带，线程安全，支持 `cache_info()` |

---

## 6. 避坑指南

| ❌ 错误 | ✅ 正确 | 原因 |
|--------|--------|------|
| 不加 `@wraps` | 始终加 `@functools.wraps(func)` | 调试时看到的是 `wrapper` 而非原函数名 |
| `@retry(3)` 少了一层 | `@retry(max_attempts=3)` 带参数要三层嵌套 | `@retry(3)` 会把 `3` 当成 `func` 传入 |
| 装饰器不返回结果 | wrapper 里必须 `return func(...)` | 否则原函数返回值被吞掉 |
| 在 wrapper 里硬编码参数 | 用 `*args, **kwargs` 透传 | 保持装饰器的通用性 |
| `lru_cache` 对可变参数 | 只能缓存可哈希的参数 | 列表、字典做参数会报错 |

---

## 7. 练习题

### 🟢 入门：写一个 @debug 装饰器

打印函数名、参数和返回值。

<details><summary>参考答案</summary>

```python
import functools

def debug(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}({args}, {kwargs})")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result!r}")
        return result
    return wrapper

@debug
def add(a, b):
    return a + b

add(1, 2)
# Calling add((1, 2), {})
# add returned 3
```

</details>

### 🟡 中级：@validate 类型检查装饰器

创建 `@validate` 装饰器，接收参数类型，运行时检查参数类型是否匹配。

<details><summary>参考答案</summary>

```python
import functools

def validate(**expected_types):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(**kwargs):
            for name, expected in expected_types.items():
                if name in kwargs and not isinstance(kwargs[name], expected):
                    raise TypeError(
                        f"{name} must be {expected.__name__}, "
                        f"got {type(kwargs[name]).__name__}"
                    )
            return func(**kwargs)
        return wrapper
    return decorator

@validate(name=str, age=int)
def create_user(name, age):
    return f"User({name}, {age})"

print(create_user(name="Alice", age=20))   # OK
# create_user(name="Alice", age="20")      # TypeError!
```

</details>

### 🔴 挑战：@async_retry 异步重试装饰器

为 `async def` 函数写一个带指数退避的重试装饰器。

<details><summary>提示</summary>

需要用 `async def wrapper`，`await func(...)`，`asyncio.sleep(delay)`。指数退避：`delay *= backoff`。

</details>

---

## 8. 知识点总结

```
装饰器详解
├── 原理
│   ├── 函数是一等公民 → 可赋值、传参、返回
│   ├── 闭包 → 内函数记住外函数的变量
│   └── @语法糖 → func = decorator(func)
├── 装饰器模式
│   ├── 基础装饰器 → 2层（decorator + wrapper）
│   ├── 带参数装饰器 → 3层（参数层 + decorator + wrapper）
│   ├── 类装饰器 → __call__ 方法
│   └── 堆叠 → 从下往上包裹
├── 关键工具
│   ├── @functools.wraps → 保留函数元信息
│   ├── @functools.lru_cache → 自动缓存
│   └── functools.singledispatch → 泛型函数
└── 实战模式
    ├── 横切关注点 → 日志、计时、权限
    ├── 重试/限流 → 提升健壮性
    └── 缓存 → 提升性能
```

---

## 9. 举一反三

| 场景 | 装饰器设计 |
|------|----------|
| Web 路由 | `@app.route("/api/users")` 注册路由 |
| 权限控制 | `@require_role("admin")` 检查用户角色 |
| 数据库事务 | `@transactional` 自动 commit/rollback |
| 输入验证 | `@validate(schema)` 校验请求参数 |
| 性能监控 | `@trace` 记录到 APM 系统 |
| 单例模式 | `@singleton` 确保只创建一个实例 |

---

## 10. 参考资料

- [PEP 318 - Decorators for Functions and Methods](https://peps.python.org/pep-0318/)
- [Real Python - Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/)
- [Fluent Python, 2nd Ed](https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/) — Chapter 9

---

## 11. 代码演进回顾

| 版本 | 特性 | 复杂度 |
|------|------|--------|
| v1 基础装饰器 | `@timer`，`@wraps`，无参数 | ⭐⭐ |
| v2 带参数 | `@retry(max_attempts=3)`，三层嵌套 | ⭐⭐⭐ |
| v3 完整版 | 类装饰器 + 堆叠 + memoize 工具库 | ⭐⭐⭐⭐ |

**核心认知：** 装饰器 = 高阶函数 + 闭包 + 语法糖。掌握它，你就掌握了 Python 中最优雅的代码复用模式。

---

*上一篇：[面向对象进阶](014-oop-advanced)*
