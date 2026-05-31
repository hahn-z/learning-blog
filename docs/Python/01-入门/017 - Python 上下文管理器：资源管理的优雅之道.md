---
title: "017 - Python 上下文管理器：资源管理的优雅之道"
slug: "017-context-managers"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.299+08:00"
updated_at: "2026-04-29T10:02:47.387+08:00"
reading_time: 29
tags: []
---

# Python 上下文管理器：资源管理的优雅之道

> **难度标注**：⭐⭐⭐ 中级 | 预计阅读时间：15 分钟
>
> **前置知识**：Python 基础语法、类与对象、异常处理、文件操作

---

## 一、概念讲解

### 1.1 什么是上下文管理器？

上下文管理器是实现了上下文管理协议的对象，即定义了 `__enter__()` 和 `__exit__()` 方法。它确保资源的正确获取和释放，即使在发生异常的情况下。

**核心价值：**
- **自动资源管理**：无论是否发生异常，资源都能正确释放
- **代码更清晰**：资源的使用范围一目了然
- **减少遗忘**：不再需要手动 try/finally

### 1.2 with 语句的执行流程

```python
with expression as variable:
    # code block
    pass
```

等价于：

```python
manager = expression
variable = manager.__enter__()
try:
    # code block
    pass
finally:
    manager.__exit__(exc_type, exc_val, exc_tb)
```

### 1.3 `__exit__` 的三个参数

当 with 块中发生异常时，`__exit__` 接收：
- `exc_type`：异常类型
- `exc_val`：异常值
- `exc_tb`：异常追溯

返回 `True` 表示异常已处理（吞掉异常），返回 `False` 或 `None` 则继续传播异常。

---

## 二、知识脑图

```
Python 上下文管理器
├── 协议
│   ├── __enter__() → 进入上下文
│   └── __exit__(exc_type, exc_val, exc_tb) → 退出上下文
├── 实现方式
│   ├── 类实现（__enter__ / __exit__）
│   ├── @contextmanager 装饰器
│   ├── contextlib.suppress()
│   ├── contextlib.closing()
│   ├── contextlib.redirect_stdout()
│   └── contextlib.nullcontext()
├── 异步版本
│   ├── __aenter__() / __aexit__()
│   └── @asynccontextmanager
└── 应用场景
    ├── 文件操作
    ├── 数据库连接
    ├── 线程锁
    ├── 计时器
    ├── 临时修改状态
    └── 网络连接
```

---

## 三、代码演进

### v1：手动 try/finally

```python
# Manual resource management - error prone
f = None
try:
    f = open("example.txt", "w")
    f.write("Hello, World!")
finally:
    if f:
        f.close()

# Database connection
conn = None
try:
    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
finally:
    if conn:
        conn.close()
```

**问题**：每次都要写 try/finally，容易遗漏，代码冗长。

### v2：类实现上下文管理器

```python
class Timer:
    """Measure execution time using context manager protocol."""

    def __enter__(self):
        # Called when entering the with block
        import time
        self.start = time.perf_counter()
        return self  # Bound to as variable

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Called when exiting the with block (even on exception)
        import time
        self.elapsed = time.perf_counter() - self.start
        print(f"Elapsed: {self.elapsed:.4f}s")
        return False  # Propagate exceptions


class DatabaseConnection:
    """Simulate a database connection with auto cleanup."""

    def __init__(self, db_url):
        self.db_url = db_url
        self.connected = False

    def __enter__(self):
        print(f"Connecting to {self.db_url}...")
        self.connected = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            print(f"Error occurred: {exc_val}")
            print("Rolling back transaction...")
        else:
            print("Committing transaction...")
        print("Closing connection...")
        self.connected = False
        return False

    def execute(self, query):
        if not self.connected:
            raise RuntimeError("Not connected")
        print(f"Executing: {query}")


# Usage
with Timer():
    sum(range(10_000_000))

with DatabaseConnection("postgresql://localhost/mydb") as db:
    db.execute("INSERT INTO users VALUES (1, 'Alice')")
    db.execute("SELECT * FROM users")
```

**执行预览：**
```
Elapsed: 0.1234s
Connecting to postgresql://localhost/mydb...
Executing: INSERT INTO users VALUES (1, 'Alice')
Executing: SELECT * FROM users
Committing transaction...
Closing connection...
```

### v3：contextlib 装饰器 + 高级用法

```python
from contextlib import contextmanager, suppress, redirect_stdout, closing
import io
import time
import os


@contextmanager
def timer(label="Block"):
    """Simple timer using @contextmanager decorator."""
    start = time.perf_counter()
    try:
        yield  # Yield control to the with block
    finally:
        elapsed = time.perf_counter() - start
        print(f"[{label}] Elapsed: {elapsed:.4f}s")


@contextmanager
def temp_directory(path):
    """Create and cleanup a temporary directory."""
    import shutil
    os.makedirs(path, exist_ok=True)
    print(f"Created: {path}")
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)
        print(f"Cleaned: {path}")


@contextmanager
def change_working_dir(path):
    """Temporarily change working directory."""
    old_dir = os.getcwd()
    os.chdir(path)
    try:
        yield path
    finally:
        os.chdir(old_dir)


# Timer
with timer("Data processing"):
    data = [x**2 for x in range(1_000_000)]

# Suppress specific exceptions
with suppress(FileNotFoundError):
    os.remove("nonexistent_file.txt")  # No error raised
print("Continues normally")

# Redirect stdout
buffer = io.StringIO()
with redirect_stdout(buffer):
    print("This goes to buffer, not console")
captured = buffer.getvalue()
print(f"Captured: {repr(captured)}")

# Closing - for objects with close() but no context manager
class OldStyleResource:
    def close(self):
        print("Resource closed")

with closing(OldStyleResource()) as r:
    print("Using resource...")
```

**执行预览：**
```
[Data processing] Elapsed: 0.0567s
Continues normally
Captured: 'This goes to buffer, not console\n'
Using resource...
Resource closed
```

---

## 四、注意事项

| 要点 | 说明 | 示例 |
|------|------|------|
| `__exit__` 必定执行 | 即使 with 块中有异常、return、break | 类似 finally 的行为 |
| yield 前是 enter，yield 后是 exit | @contextmanager 的分段逻辑 | yield 前=获取资源，yield 后=释放 |
| 不要吞掉未知异常 | `__exit__` 返回 True 会吞掉异常 | 只对预期异常返回 True |
| 异步用 async with | 配合 `__aenter__` / `__aexit__` | `async with session.post(url) as resp:` |
| 多个上下文管理器可嵌套 | `with A() as a, B() as b:` | Python 3.10+ 更推荐 |
| yield 只能出现一次 | @contextmanager 中只能有一个 yield | 否则 RuntimeError |

---

## 五、避坑指南

### ❌ 坑1：在 `__exit__` 中吞掉所有异常

```python
# ❌ Wrong: silently swallowing all exceptions
class BadManager:
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        return True  # All exceptions suppressed!

# ✅ Correct: only suppress expected exceptions
class GoodManager:
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is ValueError:
            print(f"Handled: {exc_val}")
            return True  # Only suppress ValueError
        return False  # Propagate everything else
```

### ❌ 坑2：在 @contextmanager 中 yield 多次

```python
# ❌ Wrong: multiple yields
@contextmanager
def bad():
    yield 1
    yield 2  # RuntimeError!

# ✅ Correct: single yield
@contextmanager
def good():
    setup()
    try:
        yield resource
    finally:
        cleanup()
```

### ❌ 坑3：忘记处理 yield 后的异常

```python
# ❌ Wrong: cleanup skipped on exception
@contextmanager
def bad():
    conn = get_connection()
    yield conn
    conn.close()  # Skipped if exception in with block!

# ✅ Correct: use try/finally around yield
@contextmanager
def good():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()  # Always executed
```

### ❌ 坑4：用 with 赋值但不使用

```python
# ❌ Wrong: ignoring the context variable
with open("file.txt") as _:
    # Can not read the file!
    pass

# ✅ Correct: use the variable
with open("file.txt") as f:
    content = f.read()
```

---

## 六、练习题

### 🟢 初级

1. 用类实现一个文件写入上下文管理器，自动在写入前后打印日志。

```python
class LoggedFileWriter:
    def __init__(self, path, mode="w"):
        self.path = path
        self.mode = mode

    def __enter__(self):
        self.file = open(self.path, self.mode)
        print(f"[LOG] Opened {self.path}")
        return self.file

    def __exit__(self, *args):
        self.file.close()
        print(f"[LOG] Closed {self.path}")

with LoggedFileWriter("test.txt") as f:
    f.write("Hello!")
```

2. 用 `@contextmanager` 实现 `suppress(KeyError)`。

### 🟡 中级

3. 实现一个可嵌套的缩进打印上下文管理器：

```python
@contextmanager
def indent(level=1):
    # Each nested usage adds more indentation
    pass

with indent():
    print("level 1")
    with indent():
        print("level 2")
```

4. 实现一个数据库事务上下文管理器，异常时回滚，正常时提交。

### 🔴 高级

5. 实现一个异步上下文管理器 `AsyncTimer`，支持 `async with`。

6. 实现一个可重入的上下文管理器（支持嵌套 with 同一个对象）。

---

## 七、知识点总结

```
上下文管理器
├── 协议实现
│   ├── __enter__() → 返回资源对象
│   ├── __exit__(type, val, tb) → 清理资源
│   ├── 返回 True → 吞掉异常
│   └── 返回 False/None → 传播异常
├── contextlib 工具
│   ├── @contextmanager → 生成器方式
│   ├── suppress(*exceptions) → 忽略异常
│   ├── closing(thing) → 自动 close()
│   ├── redirect_stdout/stderr → 重定向输出
│   └── nullcontext() → 空上下文
├── 异步版本
│   ├── __aenter__() / __aexit__()
│   └── @asynccontextmanager
└── 多上下文
    ├── with A(), B(): → 同时管理多个
    ├── ExitStack → 动态数量
    └── AsyncExitStack → 异步版本
```

---

## 八、举一反三

| 场景 | 实现方式 | 核心思路 |
|------|---------|---------|
| 计时代码 | `@contextmanager` + `time.perf_counter` | yield 前后计时 |
| 临时目录 | `@contextmanager` + `tempfile.mkdtemp` | yield 前创建，finally 删除 |
| 数据库事务 | 类实现 `__enter__`/`__exit__` | 异常时 rollback，正常 commit |
| 文件锁 | `fcntl.flock` + contextmanager | yield 前加锁，finally 释放 |
| 临时环境变量 | `@contextmanager` + `os.environ` | 保存旧值，finally 恢复 |
| 测试 mock | `@contextmanager` + `unittest.mock.patch` | yield 前打补丁，finally 恢复 |

---

## 九、参考资料

1. [Python 官方文档 - 上下文管理器类型](https://docs.python.org/3/library/stdtypes.html#context-manager-types)
2. [Python 官方文档 - contextlib](https://docs.python.org/3/library/contextlib.html)
3. [PEP 343 — The "with" Statement](https://peps.python.org/pep-0343/)
4. 《Fluent Python》第二版，第18章
5. [Real Python - Context Managers](https://realpython.com/python-with-statement/)

---

## 十、完整示例代码

```python
"""
Complete demo: context managers in Python.
Covers class-based, decorator-based, and contextlib utilities.
"""

from contextlib import contextmanager, suppress, redirect_stdout
import io
import time
import os


# === Class-based ===

class Timer:
    """Measure execution time."""

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed = time.perf_counter() - self.start
        print(f"  ⏱ {self.elapsed:.6f}s")


# === Decorator-based ===

@contextmanager
def temp_env(key, value):
    """Temporarily set an environment variable."""
    old = os.environ.get(key)
    os.environ[key] = value
    try:
        yield
    finally:
        if old is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = old


@contextmanager
def tag(name):
    """HTML tag generator (demonstrates yield usage)."""
    print(f"<{name}>", end="")
    yield
    print(f"</{name}>", end="")


# === Demo ===

if __name__ == "__main__":
    print("=== Timer ===")
    with Timer():
        total = sum(range(1_000_000))
    print(f"  Total: {total}")

    print("\n=== Temp env ===")
    with temp_env("MY_VAR", "hello"):
        print(f"  Inside: {os.environ['MY_VAR']}")
    print(f"  Outside: {os.environ.get('MY_VAR', 'Not set')}")

    print("\n=== HTML tags ===")
    with tag("div"):
        with tag("p"):
            print("Hello, World!", end="")
    print()

    print("\n=== Suppress ===")
    with suppress(ZeroDivisionError):
        result = 1 / 0
        print("Won't reach here")
    print("  But we continue normally")

    print("\n=== Redirect stdout ===")
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        print("captured!")
    print(f"  Buffer: {buffer.getvalue().strip()}")
```

**执行预览：**
```
=== Timer ===
  ⏱ 0.034521s
  Total: 499999500000

=== Temp env ===
  Inside: hello
  Outside: Not set

=== HTML tags ===
<div><p>Hello, World!</p></div>

=== Suppress ===
  But we continue normally

=== Redirect stdout ===
  Buffer: captured!
```

---

> 💡 **一句话总结**：上下文管理器用 `with` 一行代码取代了 try/finally 的样板代码，是 Python 资源管理的核心机制——数据库连接、文件操作、锁、事务，都该用它来保护。
