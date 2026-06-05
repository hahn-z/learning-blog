# Python 上下文管理器

> 分类：进阶语法 | 上下文管理 | 难度：⭐⭐ | 预估用时：25 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 `with` 语句和上下文管理器协议的原理（理解）
2. ✅ 能够用 `__enter__`/`__exit__` 和 `contextlib` 两种方式编写上下文管理器（应用）
3. ✅ 能够在文件、数据库、锁等场景中正确使用上下文管理器（应用）
4. ✅ 能够分析异常是否被正确处理并决定是否向上传播（分析）

---

## 📋 前置知识自检

1. **`with open('f.txt') as f` 这行代码，`f` 在 `with` 块外还能用吗？**（答不上来？→ 本文会讲）
2. **你知道 `try...finally` 的执行顺序吗？**（答不上来？→ 先补 [《04-异常处理》](./04-python-异常处理.md)）
3. **你用过 `@decorator` 语法糖吗？**（答不上来？→ 先补 [《05-装饰器》](./05-python-装饰器.md)）

---

## 💡 概念讲解

- **一句话定义**：上下文管理器是定义了"进入"和"退出"行为的对象，确保资源在使用后正确清理，即使发生异常。
- **现实类比**：去图书馆借书 → 登记拿书（`__enter__`） → 阅读 → 归还（`__exit__`），不管你读没读完甚至把书弄脏了（异常），都必须归还。
- **技术场景**：文件操作、数据库连接/事务、线程锁、临时修改环境变量、计时器、临时目录。
- **⚠️ 常见误解**：很多人以为 `with` 只是 `try...finally` 的语法糖。它确实是，但上下文管理器的意义在于**封装资源获取和释放的协议**，使得资源管理可组合、可复用。

---

## 🧠 实时脑图

```text
[with 语句] 🔴
    ||
    ├──→ 调用 __enter__() 🔴 → 获取资源 → 返回 as 变量
    ||         ||
    ||         ↓
    ||    [执行 with 块体] 🔴
    ||         ||
    ||         ↓ (无论是否异常)
    ||    调用 __exit__(exc_type, exc_val, exc_tb) 🔴
    ||         ||
    ||         ├── 返回 True  → 吞掉异常 🟡
    ||         └── 返回 False → 异常向上传播 🟢
    ||
    ├──→ 实现方式 1：类（__enter__ / __exit__）🟡
    ├──→ 实现方式 2：@contextlib.contextmanager 🟡
    ├──→ 实现方式 3：@contextlib.asynccontextmanager 🟢
    └──→ 标准库内置：open / lock / suppress / redirect_stdout 🟢
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

### 1. 类实现 — `__enter__` / `__exit__`

```python
"""类方式实现上下文管理器"""

import time
from typing import Self


class Timer:
    """计时器上下文管理器"""

    def __enter__(self) -> Self:
        self.start = time.perf_counter()
        return self  # 🔴 返回 self，赋值给 as 变量

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed = time.perf_counter() - self.start
        print(f"⏱️ 耗时: {elapsed:.4f}s")
        return False  # 🔴 不吞异常，让异常继续传播


# 使用
with Timer() as t:
    time.sleep(0.1)
    # t.start 可访问，因为 __enter__ 返回了 self
# 自动打印: ⏱️ 耗时: 0.1002s


# __exit__ 的异常处理参数
class SafeDB:
    """模拟数据库事务"""

    def __enter__(self):
        print("🔗 开启事务")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            print("✅ 提交事务")
        else:
            print(f"❌ 回滚事务，原因: {exc_val}")
            return False  # 异常继续传播


with SafeDB():
    print("执行 SQL...")
    # 正常结束 → 提交

with SafeDB():
    print("执行 SQL...")
    raise ValueError("主键冲突")  # 异常 → 回滚
```

### 2. contextlib.contextmanager — 装饰器方式

```python
"""用 @contextmanager 装饰器实现（更 Pythonic）"""
from contextlib import contextmanager
import os


@contextmanager
def temp_env(key: str, value: str):
    """临时修改环境变量，退出后自动恢复"""
    old_value = os.environ.get(key)
    os.environ[key] = value
    try:
        yield  # 🔴 yield 之前 = __enter__，之后 = __exit__
    finally:
        if old_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = old_value


# 使用
print(os.environ.get("MY_VAR"))  # None
with temp_env("MY_VAR", "hello"):
    print(os.environ["MY_VAR"])  # hello
print(os.environ.get("MY_VAR"))  # None（已恢复）


@contextmanager
def database_connection(url: str):
    """模拟数据库连接管理"""
    print(f"🔌 连接数据库: {url}")
    conn = {"url": url, "closed": False}
    try:
        yield conn  # 🔴 yield 的值赋给 as 变量
    finally:
        conn["closed"] = True
        print("🔌 关闭连接")


with database_connection("postgresql://localhost/mydb") as conn:
    print(f"使用连接: {conn}")
    # 异常也会关闭连接
```

### 3. 实战场景

```python
"""常见上下文管理器场景"""

import threading
from contextlib import suppress, redirect_stdout
import io


# --- 场景1：线程锁 ---
class SharedCounter:
    def __init__(self):
        self.value = 0
        self._lock = threading.Lock()

    def increment(self):
        # ✅ with 自动释放锁，即使异常也不会死锁
        with self._lock:
            self.value += 1


# --- 场景2：suppress 忽略指定异常 ---
# ❌ 传统写法
try:
    os.remove("nonexistent.txt")
except FileNotFoundError:
    pass

# ✅ 上下文管理器写法
with suppress(FileNotFoundError):
    os.remove("nonexistent.txt")

# --- 场景3：redirect_stdout 捕获输出 ---
buffer = io.StringIO()
with redirect_stdout(buffer):
    print("这行不会显示在终端")
    print("而是被捕获到 buffer 中")

captured = buffer.getvalue()
print(f"捕获到: {captured.strip()}")  # 捕获到: 这行不会显示在终端...
```

### 4. 异步上下文管理器

```python
"""异步上下文管理器（Python 3.10+）"""
import asyncio
from contextlib import asynccontextmanager


class AsyncTimer:
    """异步计时器"""

    async def __aenter__(self):
        self.start = time.perf_counter()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        elapsed = time.perf_counter() - self.start
        print(f"⏱️ 异步耗时: {elapsed:.4f}s")
        return False


# 装饰器方式
@asynccontextmanager
async def async_http_client(base_url: str):
    """模拟异步 HTTP 客户端"""
    print(f"🌐 建立 async 连接: {base_url}")
    client = {"base_url": base_url}
    try:
        yield client
    finally:
        print("🌐 关闭 async 连接")


async def main():
    # 类方式
    async with AsyncTimer():
        await asyncio.sleep(0.1)

    # 装饰器方式
    async with async_http_client("https://api.example.com") as client:
        print(f"使用: {client}")


if __name__ == "__main__":
    asyncio.run(main())
```

### 5. 可组合 — ExitStack

```python
"""ExitStack：动态管理多个上下文"""
from contextlib import ExitStack


def process_files(file_paths: list[str]):
    """同时打开多个文件（数量不确定）"""
    with ExitStack() as stack:
        files = [stack.enter_context(open(fp)) for fp in file_paths]
        # 所有文件会在 with 结束时自动关闭
        for f in files:
            print(f.read()[:50])


# 模拟
import tempfile, os
with tempfile.TemporaryDirectory() as td:
    paths = []
    for i in range(3):
        p = os.path.join(td, f"file{i}.txt")
        with open(p, "w") as f:
            f.write(f"内容 {i}\n")
        paths.append(p)
    process_files(paths)
```

---

## 👀 执行预览

```bash
$ python 07-demo.py
⏱️ 耗时: 0.1002s
🔗 开启事务
执行 SQL...
✅ 提交事务
🔗 开启事务
执行 SQL...
❌ 回滚事务，原因: 主键冲突
Traceback: ValueError: 主键冲突
None
hello
None
🔌 连接数据库: postgresql://localhost/mydb
使用连接: {'url': 'postgresql://localhost/mydb', 'closed': False}
🔌 关闭连接
捕获到: 这行不会显示在终端...
⏱️ 异步耗时: 0.1003s
🌐 建立 async 连接: https://api.example.com
使用: {'base_url': 'https://api.example.com'}
🌐 关闭 async 连接
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| `__exit__` 返回 `True` 会吞掉异常 | 调用方感知不到错误 | 🔴 |
| `@contextmanager` 中 `yield` 必须在 `try...finally` 中 | 异常时清理代码不执行 | 🔴 |
| 异步上下文必须用 `async with`，不能用 `with` | `TypeError` | 🟡 |
| `__exit__` 的三个参数在无异常时全为 `None` | 需要判断 `exc_type is not None` | 🟢 |

---

## 🕳️ 避坑指南

| 常见错误 | 现象 | 正确做法 |
|----------|------|----------|
| ❌ `@contextmanager` 中 `yield` 裸露（无 `try...finally`） | 异常时清理逻辑不执行 | ✅ 始终用 `try...finally` 包裹 `yield` |
| ❌ 在 `__enter__` 中抛异常 | `__exit__` 不会被调用 | ✅ 把资源获取放在 `__enter__` 中并处理异常 |
| ❌ `with` 块内重新赋值 `as` 变量 | 原始对象的 `__exit__` 仍会调用，但代码混淆 | ✅ 不要重新赋值 `as` 变量 |

---

## 🔍 调试排查

#### 故障场景1：`__exit__` 没有被调用

**症状**：资源没有被正确清理
**排查思路**：
1. 确认是否在 `__enter__` 中抛了异常 → `__exit__` 不会调用
2. 确认是否用了 `with` 语句（不是直接调用方法）
3. 确认是否在 `@contextmanager` 中忘记 `try...finally`

**根因**：最常见的是 `__enter__` 抛异常或忘记 `try...finally`
**修复**：在 `__enter__` 中处理异常，或将资源获取延迟到 yield 之后

#### 故障场景2：异常被意外吞掉

**症状**：代码出错但没有任何报错信息
**排查思路**：
1. 检查 `__exit__` 是否返回了 `True`
2. 在 `__exit__` 中打印 `exc_type` 确认是否有异常

**根因**：`__exit__` 返回了 `True`
**修复**：改为 `return False` 或 `return None`

---

## 📝 练习题

### 🟢 基础题
1. **写一个上下文管理器 `cd(path)`**，临时切换工作目录，退出后恢复（→ 目标 #2）
2. **解释 `__exit__(self, exc_type, exc_val, exc_tb)` 四个参数的含义**（→ 目标 #1）

### 🟡 进阶题
3. **用 `@contextmanager` 实现一个临时文件管理器**，`with` 块结束后自动删除文件（→ 目标 #2）
4. **写一个 `ReentrantLock` 上下文管理器**，支持同一线程多次获取锁（→ 目标 #3）

### 🔴 开放题
5. **设计一个数据库连接池**，用上下文管理器管理连接的获取和归还（→ 目标 #3）
6. **讨论 `__exit__` 返回 `True` vs `False` 的场景**，什么时候应该吞掉异常？（→ 目标 #4）

📝 参考答案：见文末

---

## 📌 知识点总结

```text
上下文管理器
├── 协议
│   ├── __enter__() → 获取资源，返回 as 变量
│   ├── __exit__(exc_type, exc_val, exc_tb) → 清理资源
│   └── 返回 True → 吞异常 / False → 传播
├── 实现方式
│   ├── 类（__enter__ / __exit__）→ 复杂状态
│   ├── @contextmanager → 简洁，推荐
│   └── @asynccontextmanager → 异步版
├── 标准库工具
│   ├── suppress(异常) → 忽略异常
│   ├── redirect_stdout → 重定向输出
│   ├── closing(obj) → 调用 obj.close()
│   └── ExitStack → 动态管理多个上下文
└── 典型场景
    ├── 文件操作 → with open(...)
    ├── 数据库连接/事务
    ├── 线程锁 → with lock:
    └── 临时环境修改
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 临时修改配置 | `@contextmanager` 保存旧值、设置新值、finally 恢复 |
| 计时/性能测量 | `__enter__` 记录开始时间，`__exit__` 计算差值 |
| Mock 测试 | 临时替换对象/函数，测试完恢复 |
| 多资源管理 | `ExitStack` 动态管理不确定数量的资源 |

---

## 🗺️ 学习路径

```
[《05-装饰器》] → [《06-生成器与迭代器》] → **📍 本篇：上下文管理器** → [《08-异步编程入门》]
```

**下一篇**：
- → [《08-Python异步编程入门》](./08-python-异步编程入门.md)：异步上下文管理器是 `async with` 的基础

**相关主题**：
- [《04-Python异常处理》](./04-python-异常处理.md)：上下文管理器是异常安全的资源管理方式
- [《06-Python生成器与迭代器》](./06-python-生成器与迭代器.md)：`@contextmanager` 内部用生成器实现

---

## 📚 参考资料

- [Python 官方文档 - contextlib](https://docs.python.org/3/library/contextlib.html) [等级：官方] — 标准库 contextlib 全部工具
- [PEP 343 — The "with" Statement](https://peps.python.org/pep-0343/) [等级：权威] — with 语句的设计提案

---

## 📝 练习题参考答案

<details>
<summary>点击展开答案</summary>

**1. cd 上下文管理器：**
```python
import os
from contextlib import contextmanager

@contextmanager
def cd(path):
    old = os.getcwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(old)
```

**2. 答案：** `self` 不算，三个异常参数：`exc_type` 异常类型（如 ValueError），`exc_val` 异常实例，`exc_tb` 追踪栈。无异常时三个都为 None。

</details>
