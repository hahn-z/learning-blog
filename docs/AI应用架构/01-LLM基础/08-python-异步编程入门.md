# Python异步编程入门：从同步到async/await

> 分类：异步编程 | asyncio基础 | 难度：⭐⭐⭐ | 预估用时：45 分钟

---

## 🎯 学习目标

1. ✅ 能够用类比解释同步与异步的区别（理解）
2. ✅ 能够独立编写 `async/await` 异步函数并正确调用（应用）
3. ✅ 能够定位"忘记 await"等常见异步错误（分析）
4. ✅ 能够在 I/O 密集场景中选择同步或异步方案（评价）

---

## 📋 前置知识自检

1. **你能用 `def` 定义函数并用 `return` 返回值吗？**（答不上来？→ 先学 Python 函数基础）
2. **你知道什么是 I/O 操作（读文件、网络请求）吗？**（答不上来？→ 先了解 Python 文件操作）
3. **你理解「阻塞」是什么意思吗？**（答不上来？→ 先理解进程/线程基础概念）

---

## 💡 概念讲解

### 同步 vs 异步

- **一句话定义**：同步是"排队等结果"，异步是"先去干别的，好了叫我"。
- **现实类比**：去医院挂号——同步就像排队等叫号，你站在窗口啥也干不了；异步就像拿了个号码牌，坐着刷手机，到了叫你。
- **技术场景**：批量调用 API、同时爬取多个网页、并发查询数据库——凡是"大部分时间在等"的 I/O 操作，异步都能大幅提速。
- **⚠️ 常见误解**：很多人以为异步 = 多线程。其实 Python 的 `asyncio` 是**单线程并发**，靠事件循环在多个任务间切换，不是多线程。

### 事件循环（Event Loop）

- **一句话定义**：一个不停转的调度器，负责在多个异步任务之间来回切换执行。
- **现实类比**：一个服务员同时服务 5 桌客人——客人点完菜，服务员不傻等上菜，而是去下一桌点单。哪桌上好了再送过去。
- **技术场景**：`asyncio.run()` 启动事件循环，所有 `async def` 函数都由它调度执行。

---

## 🧠 实时脑图

```text
[asyncio.run()] 🔴 — 启动事件循环
    ||
    ↓
[Event Loop] 🔴 — 核心调度器
    ||
    ├──→ [Task A: await io操作] 🟡 — 挂起，交出控制权
    ├──→ [Task B: await io操作] 🟡 — 挂起，交出控制权
    └──→ [Task C: 计算完成] 🟢 — 返回结果
           ||
           ↓
    [所有 Task 完成] 🟢 — 事件循环结束
```

---

## 💻 完整代码

> 运行环境：Python 3.10+

```python
"""
async_basics.py - Python 异步编程入门示例
Python 3.10+
"""

import asyncio
import time


# ---- 1. 同步版本：逐个等待 ----

def sync_fetch(name: str, delay: float) -> str:
    """模拟一个耗时的 I/O 操作（如网络请求）"""
    time.sleep(delay)  # 同步阻塞
    return f"[同步] {name} 完成，耗时 {delay}s"


def sync_main():
    start = time.perf_counter()
    results = [
        sync_fetch("任务A", 2),
        sync_fetch("任务B", 1),
        sync_fetch("任务C", 3),
    ]
    for r in results:
        print(r)
    print(f"同步总耗时: {time.perf_counter() - start:.2f}s")


# ---- 2. 异步版本：并发执行 ----

async def async_fetch(name: str, delay: float) -> str:
    """模拟异步 I/O 操作"""
    await asyncio.sleep(delay)  # 异步等待，不阻塞事件循环
    return f"[异步] {name} 完成，耗时 {delay}s"


async def async_main():
    start = time.perf_counter()
    # asyncio.gather 并发执行多个协程
    results = await asyncio.gather(
        async_fetch("任务A", 2),
        async_fetch("任务B", 1),
        async_fetch("任务C", 3),
    )
    for r in results:
        print(r)
    print(f"异步总耗时: {time.perf_counter() - start:.2f}s")


# ---- 3. 常见陷阱演示 ----

async def trap_no_await():
    """陷阱1：忘记 await，协程不会执行"""
    print("\n--- 陷阱演示 ---")
    
    # ❌ 忘记 await：不会执行，只会返回协程对象
    result = async_fetch("忘记await", 0.1)
    print(f"❌ 没有await的结果: {result}")  # <coroutine object ...>
    
    # ✅ 正确写法
    result = await async_fetch("正确await", 0.1)
    print(f"✅ 正确await的结果: {result}")


async def trap_sync_in_async():
    """陷阱2：在异步函数中使用同步阻塞调用"""
    # ❌ 在 async 函数中用 time.sleep 会阻塞整个事件循环
    # time.sleep(1)  # 这会让所有异步任务都卡住
    
    # ✅ 使用 asyncio.sleep 替代
    await asyncio.sleep(1)


# ---- 运行 ----

if __name__ == "__main__":
    print("=" * 50)
    print("同步版本：")
    sync_main()
    
    print("\n" + "=" * 50)
    print("异步版本：")
    asyncio.run(async_main())
    
    print("\n" + "=" * 50)
    asyncio.run(trap_no_await())
```

---

## 👀 执行预览

```bash
$ python async_basics.py

==================================================
同步版本：
[同步] 任务A 完成，耗时 2s
[同步] 任务B 完成，耗时 1s
[同步] 任务C 完成，耗时 3s
同步总耗时: 6.00s

==================================================
异步版本：
[异步] 任务B 完成，耗时 1s
[异步] 任务A 完成，耗时 2s
[异步] 任务C 完成，耗时 3s
异步总耗时: 3.00s

==================================================
--- 陷阱演示 ---
❌ 没有await的结果: <coroutine object async_fetch at 0x7f...>
✅ 正确await的结果: [异步] 正确await 完成，耗时 0.1s
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ 异步函数必须用 `await` 调用 | 协程不执行，返回 coroutine 对象 | 🔴 |
| ⚠️ 不要在异步函数中调用 `time.sleep()` | 阻塞整个事件循环，所有任务卡住 | 🔴 |
| ⚠️ `asyncio.run()` 只能在最外层调用一次 | 嵌套调用会报 RuntimeError | 🟡 |
| ⚠️ 异步不等于多线程，CPU密集型任务不会加速 | CPU 计算仍然串行 | 🟡 |
| ⚠️ 入口函数用 `asyncio.run()`，不是直接 `await` | 没有事件循环就无法运行协程 | 🔴 |

---

## 🕳️ 避坑指南

### 坑1：忘记 await

```python
# ❌ 错误：协程没有被执行
async def get_data():
    await asyncio.sleep(1)
    return "data"

result = get_data()  # result 是 coroutine 对象，不是 "data"

# ✅ 正确
result = await get_data()  # 等待协程执行完毕
```

### 坑2：混用同步阻塞和异步

```python
# ❌ 在 async 函数中使用同步 I/O
async def bad_example():
    time.sleep(5)       # 阻塞事件循环 5 秒！
    requests.get(url)   # 同步 HTTP 请求，也会阻塞！

# ✅ 使用异步替代
async def good_example():
    await asyncio.sleep(5)           # 异步等待
    async with httpx.AsyncClient() as c:  # 异步 HTTP
        resp = await c.get(url)
```

### 坑3：在同步函数中调用异步函数

```python
# ❌ 直接调用 async 函数会报错
def sync_func():
    result = await async_func()  # SyntaxError: await outside async function

# ✅ 用 asyncio.run() 启动
def sync_func():
    result = asyncio.run(async_func())
```

---

## 🔍 调试排查

### 故障场景1：RuntimeWarning: coroutine was never awaited

**症状**：运行代码后看到警告 `RuntimeWarning: coroutine 'xxx' was never awaited`
**排查思路**：
1. 搜索代码中所有 `async def` 函数的调用点
2. 检查调用时是否缺少 `await`
3. 如果是顶层调用，确认用了 `asyncio.run()`

**根因**：创建了协程但没有 `await` 或 `asyncio.run()`，协程从未执行
**修复**：在调用处加 `await`，或用 `asyncio.run()` 包装

### 故障场景2：异步代码比同步还慢

**症状**：改写成 async 后耗时反而更长
**排查思路**：
1. 搜索代码中是否有 `time.sleep()`、`requests.get()` 等同步调用
2. 检查是否有 CPU 密集型操作没有用 `run_in_executor`
3. 确认是否串行 `await` 了本可以并发的任务

**根因**：混用了同步阻塞调用，或串行化了可并发的任务
**修复**：替换为异步版本，或用 `asyncio.gather()` 并发执行

---

## 📝 练习题

### 🟢 基础题

1. 写一个异步函数 `greet(name, delay)`，等待 `delay` 秒后打印 `f"Hello, {name}!"`，并用 `asyncio.run()` 运行它。（考察点：async/await 基本语法 → 目标 #2）

2. 解释以下代码的输出顺序，并说明原因：
```python
async def main():
    await asyncio.sleep(1)
    print("A")
    await asyncio.sleep(1)
    print("B")
```
（考察点：理解 await 挂起 → 目标 #1）

### 🟡 进阶题

3. 将以下同步代码改写为异步版本，要求总耗时约 1 秒而不是 3 秒：
```python
import time
def fetch(n):
    time.sleep(1)
    return f"data_{n}"

results = [fetch(i) for i in range(3)]
```
（考察点：asyncio.gather 并发 → 目标 #2）

### 🔴 开放题

4. 如果你的程序需要同时做"下载10个文件"和"计算一个大数的质因数"，你会如何设计？异步能帮上忙吗？（考察点：异步适用场景判断 → 目标 #4）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
Python 异步编程入门
├── 核心概念
│   ├── 同步：排队等，一个做完下一个
│   ├── 异步：不等，先去干别的
│   └── 事件循环：调度器，管理任务切换
├── 语法
│   ├── async def：定义协程函数
│   ├── await：等待协程执行
│   └── asyncio.run()：启动事件循环
├── 关键规则
│   ├── 异步函数中用 asyncio.sleep 不用 time.sleep
│   ├── 调用 async 函数必须 await
│   └── CPU 密集型用多进程，I/O 密集型用异步
└── 性能
    └── 同步 6s → 异步 3s（并发等待）
```

---

## 🔄 举一反三

| 场景 | 如何应用 |
|------|----------|
| 批量调用第三方 API | 每个请求包装为 async 函数，用 `asyncio.gather()` 并发 |
| 同时查询多个数据库 | 每个查询为 async 函数，并发执行减少等待 |
| 文件下载管理器 | 异步下载多个文件，实时报告进度 |

---

## 🗺️ 学习路径

```
[Python基础] → [函数与模块] → **📍 你在这里：异步编程入门** → [异步进阶：并发模式]
```

**下一篇建议**：
- → [《Python异步进阶：并发模式与性能优化》](09-python-异步进阶.md)：掌握 `asyncio.gather`、`Semaphore`、`TaskGroup` 等进阶并发模式

**相关主题**：
- [《httpx：比requests更好的HTTP客户端》](13-httpx-比requests更好的HTTP客户端.md)：异步 HTTP 客户端实战

---

## ⚡ 性能对比

| 方案 | 3个任务(各1-3秒) | 总耗时 | 说明 |
|------|-------------------|--------|------|
| 同步串行 | 6.00s | ⭐⭐ | 简单但慢 |
| asyncio.gather | 3.00s | ⭐⭐⭐⭐ | 并发等待，快一倍 |
| asyncio.gather (10个任务) | ~3.00s | ⭐⭐⭐⭐⭐ | 并发优势随任务数增大更明显 |

---

## 📦 版本兼容性

- ✅ 适配版本：Python 3.10+
- ⚠️ 差异：
  - Python 3.6-3.9：`asyncio.run()` 可用但部分特性不同，`async for`/`async with` 需 3.7+
  - Python 3.10+：推荐使用，类型注解完整支持
  - Python 3.11+：`TaskGroup` 可用（更安全的并发方式，见下一篇）

---

## 📚 参考资料

- [Python 官方 asyncio 文档](https://docs.python.org/3/library/asyncio.html) [等级：官方] — 完整 API 参考
- [Real Python - Async IO in Python](https://realpython.com/async-io-python/) [等级：权威] — 最通俗易懂的异步教程

---

## 附录：练习题参考答案

**题1**：
```python
import asyncio

async def greet(name: str, delay: float):
    await asyncio.sleep(delay)
    print(f"Hello, {name}!")

asyncio.run(greet("World", 1))
```

**题2**：顺序输出 A → B。第一个 `await asyncio.sleep(1)` 挂起 1 秒后打印 A，再挂起 1 秒后打印 B。因为只有一个任务，没有并发，所以是串行等待。

**题3**：
```python
import asyncio

async def fetch(n: int) -> str:
    await asyncio.sleep(1)
    return f"data_{n}"

async def main():
    results = await asyncio.gather(*[fetch(i) for i in range(3)])
    print(results)

asyncio.run(main())
# 总耗时约 1 秒
```

**题4**：下载文件是 I/O 密集型，适合异步并发；质因数计算是 CPU 密集型，异步帮不上忙，应该用 `asyncio.to_thread()` 或 `ProcessPoolExecutor` 把计算丢到线程/进程中，两者可以并行进行。
