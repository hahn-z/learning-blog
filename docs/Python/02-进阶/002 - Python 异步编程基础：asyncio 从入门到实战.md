---
title: "002 - Python 异步编程基础：asyncio 从入门到实战"
slug: "002-async-basics"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.355+08:00"
updated_at: "2026-04-29T10:02:47.514+08:00"
reading_time: 24
tags: []
---

> **难度标注**：⭐⭐⭐⭐ 高级 | 预计阅读时间：25 分钟
> **前置知识**：Python 函数、生成器、装饰器基础、网络编程概念

---

## 一、概念讲解

### 1.1 什么是异步编程

异步编程是一种**并发模型**：遇到 I/O 等待时不阻塞线程，而是切走去做别的事。核心区别：

| 模型 | 等待时做什么 | 适合场景 |
|------|-------------|---------|
| 同步 | 阻塞等待 | CPU 密集型 |
| 多线程 | OS 切换线程 | I/O 密集型（有 GIL 限制） |
| 异步 | 事件循环切换协程 | I/O 密集型（高并发） |

### 1.2 核心概念三件套

**协程（Coroutine）**：用 `async def` 定义的函数，调用后返回协程对象，不会立即执行。

**事件循环（Event Loop）**：`asyncio` 的心脏，负责调度协程、处理 I/O 回调。每个线程只有一个。

**await**：挂起当前协程，把控制权还给事件循环，等待另一个协程完成。

### 1.3 asyncio 执行模型

```
┌─────────────────────────────────────┐
│          Event Loop                  │
│  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │ Co1 │  │ Co2 │  │ Co3 │        │
│  │ ↓   │  │ ↓   │  │ ↓   │        │
│  │await│→ │run  │→ │await│→ ...   │
│  └─────┘  └─────┘  └─────┘        │
│       ↑ I/O ready → resume Co1     │
└─────────────────────────────────────┘
```

协程在 `await` 处让出控制权，事件循环调度其他协程，I/O 完成后恢复。

---

## 二、脑图

```
asyncio 异步编程基础
├── 核心概念
│   ├── async def → 协程函数
│   ├── await → 挂起/让出控制权
│   └── Event Loop → 调度器
├── 运行方式
│   ├── asyncio.run(coro) — 推荐入口
│   ├── asyncio.create_task() — 并发调度
│   └── asyncio.gather() — 等待多个
├── 常用 API
│   ├── sleep / wait_for / timeout
│   ├── Queue — 异步队列
│   ├── Lock / Semaphore / Event
│   └── subprocess — 异步子进程
├── I/O 模型
│   ├── StreamReader / StreamWriter
│   └── open_connection / start_server
└── 注意
    ├── 协程不等同于线程
    ├── 避免阻塞调用
    └── debug 模式: asyncio.run(debug=True)
```

---

## 三、完整代码

### 3.1 基础：协程定义与运行

```python
import asyncio
import time

# Basic coroutine
async def say_hello(name, delay):
    print(f"Hello {name}! Waiting {delay}s...")
    await asyncio.sleep(delay)  # Non-blocking sleep
    print(f"Done waiting for {name}!")
    return f"{name} finished"

async def main_basic():
    result = await say_hello("World", 1)
    print(f"Result: {result}")

asyncio.run(main_basic())
```

### 3.2 并发：Task 和 gather

```python
import asyncio
import time

async def fetch_data(url, delay):
    # Simulate an HTTP request
    print(f"Fetching {url}...")
    await asyncio.sleep(delay)
    print(f"Done: {url}")
    return f"data from {url}"

async def main_concurrent():
    start = time.time()

    # Method 1: create_task for manual control
    task1 = asyncio.create_task(fetch_data("api/users", 2))
    task2 = asyncio.create_task(fetch_data("api/posts", 3))
    task3 = asyncio.create_task(fetch_data("api/comments", 1))

    r1 = await task1
    r2 = await task2
    r3 = await task3
    print(f"All done in {time.time()-start:.1f}s")  # ~3s, not 6s

    # Method 2: gather for collecting all results
    start = time.time()
    results = await asyncio.gather(
        fetch_data("api/a", 1),
        fetch_data("api/b", 2),
        fetch_data("api/c", 1.5),
    )
    print(f"Results: {results}")
    print(f"Gather done in {time.time()-start:.1f}s")  # ~2s

asyncio.run(main_concurrent())
```

### 3.3 异步锁与限流

```python
import asyncio

class AsyncRateLimiter:
    # Rate limiter using asyncio.Semaphore
    def __init__(self, max_concurrent=3):
        self.sem = asyncio.Semaphore(max_concurrent)

    async def fetch(self, url):
        async with self.sem:
            print(f"Processing {url}")
            await asyncio.sleep(1)  # Simulate work
            print(f"Done {url}")
            return f"result-{url}"

async def main_limiter():
    limiter = AsyncRateLimiter(max_concurrent=2)
    tasks = [limiter.fetch(f"url-{i}") for i in range(6)]
    results = await asyncio.gather(*tasks)
    print(f"All results: {results}")

asyncio.run(main_limiter())
```

### 3.4 生产者-消费者模式

```python
import asyncio
import random

async def producer(queue, producer_id):
    # Produce items and put them in the queue
    for i in range(5):
        item = f"P{producer_id}-item{i}"
        await asyncio.sleep(random.uniform(0.1, 0.3))
        await queue.put(item)
        print(f"Produced: {item}")
    await queue.put(None)  # Sentinel

async def consumer(queue, consumer_id):
    # Consume items from the queue
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        await asyncio.sleep(random.uniform(0.2, 0.5))
        print(f"  Consumer {consumer_id} processed: {item}")
        queue.task_done()

async def main_queue():
    queue = asyncio.Queue(maxsize=10)
    producers = [asyncio.create_task(producer(queue, i)) for i in range(2)]
    consumers = [asyncio.create_task(consumer(queue, i)) for i in range(3)]
    await asyncio.gather(*producers)
    for _ in range(len(consumers) - len(producers)):
        await queue.put(None)
    await asyncio.gather(*consumers)
    print("All done!")

asyncio.run(main_queue())
```

---

## 四、执行预览

```
# main_basic
Hello World! Waiting 1s...
Done waiting for World!
Result: World finished

# main_concurrent
Fetching api/users...
Fetching api/posts...
Fetching api/comments...
Done: api/comments
Done: api/users
Done: api/posts
All done in 3.0s
Fetching api/a...
Fetching api/b...
Fetching api/c...
Done: api/a
Done: api/c
Done: api/b
Results: ['data from api/a', 'data from api/b', 'data from api/c']
Gather done in 2.0s

# main_limiter (max 2 concurrent)
Processing url-0
Processing url-1
Done url-0
Processing url-2
Done url-1
Processing url-3
...
```

---

## 五、注意事项

| 要点 | 说明 |
|------|------|
| `asyncio.run()` 是入口 | 只能调用一次，自动管理事件循环 |
| `await` 只在 async 函数中 | 在普通函数中 await 会语法错误 |
| 协程不自动并发 | 必须用 `create_task` 或 `gather` 才会并发执行 |
| 不要在协程中阻塞 | `time.sleep()`、`requests.get()` 会阻塞整个事件循环 |
| 异步上下文管理器 | `async with` 对应 `aiofiles`、`aiohttp` 等异步库 |
| 异步迭代器 | `async for` 用于异步生成器 |
| 调试 | `asyncio.run(main(), debug=True)` 开启调试模式 |

---

## 六、避坑指南

### ❌ 在协程中调用阻塞函数 → ✅ 用 run_in_executor

```python
import asyncio, time

async def bad():
    time.sleep(5)  # ❌ Blocks the entire event loop!

async def good():
    loop = asyncio.get_event_loop()
    # ✅ Run blocking code in thread pool
    await loop.run_in_executor(None, lambda: time.sleep(5))
```

### ❌ 忘记 await → ✅ 始终 await 协程

```python
async def fetch():
    return 42

async def bad():
    result = fetch()  # ❌ Returns coroutine object, not 42
    print(result)  # <coroutine object fetch at 0x...>

async def good():
    result = await fetch()  # ✅ Properly await
    print(result)  # 42
```

### ❌ 用 requests 库 → ✅ 用 aiohttp

```python
import requests  # ❌ Synchronous, blocks event loop

import aiohttp  # ✅ Async HTTP client
async def fetch(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            return await resp.text()
```

### ❌ 过度并发 → ✅ 用 Semaphore 控制并发数

```python
# ❌ 1000 simultaneous connections
tasks = [fetch(url) for url in urls]
await asyncio.gather(*tasks)

# ✅ Limit concurrent connections
sem = asyncio.Semaphore(10)
async def limited_fetch(url):
    async with sem:
        return await fetch(url)
tasks = [limited_fetch(url) for url in urls]
await asyncio.gather(*tasks)
```

---

## 七、练习题

### 🟢 基础题

**题目 1**：写一个异步计时器，每秒打印当前时间，共打印 10 次。

**题目 2**：用 `asyncio.gather` 并发请求 5 个 URL（用 `asyncio.sleep` 模拟），统计总耗时。

### 🟡 进阶题

**题目 3**：实现一个异步缓存装饰器 `@async_cache`，对异步函数的结果缓存指定时间。

**题目 4**：用 `asyncio.Queue` 实现一个异步管道：读取器 → 处理器 → 写入器，每个阶段并发运行。

### 🔴 挑战题

**题目 5**：实现一个异步 Web 爬虫：给定起始 URL，异步抓取页面中的所有链接，BFS 爬取到指定深度，限制最大并发数和最大页面数。

---

## 八、知识点总结

```
asyncio 基础
├── 协程
│   ├── async def → 定义协程函数
│   ├── await → 等待协程，让出控制权
│   └── 协程对象 → 调用协程函数返回，不立即执行
├── 调度
│   ├── asyncio.run() → 程序入口
│   ├── create_task() → 并发调度协程
│   ├── gather() → 等待多个协程，收集结果
│   └── wait() → 更灵活的等待（FIRST_COMPLETED 等）
├── 同步原语
│   ├── Lock → 异步锁
│   ├── Semaphore → 限制并发数
│   ├── Event → 事件通知
│   └── Condition → 条件变量
├── 通信
│   ├── Queue → 异步队列
│   └── StreamReader/Writer → 异步 I/O
└── 最佳实践
    ├── 不阻塞事件循环
    ├── 用 Semaphore 控制并发
    ├── 用 run_in_executor 处理阻塞代码
    └── 开启 debug 模式排错
```

---

## 九、举一反三

| 场景 | 异步方案 | 同步方案对比 |
|------|---------|------------|
| 抓取 100 个 API | aiohttp + gather | requests 顺序调用慢 100 倍 |
| 数据库查询 | asyncpg / motor | psycopg2 同步阻塞 |
| 文件读写 | aiofiles / aiofile | open() 阻塞 |
| WebSocket 服务 | websockets 库 | 需要多线程 |
| 定时任务 | asyncio.sleep 循环 | time.sleep 阻塞 |
| 微服务调用 | httpx.AsyncClient | requests 库 |
| 进程管理 | asyncio.create_subprocess_exec | subprocess 阻塞 |

---

## 十、参考资料

- [Python asyncio 官方文档](https://docs.python.org/3/library/asyncio.html)
- [asyncio 官方教程](https://docs.python.org/3/library/asyncio-task.html)
- [aiohttp 文档](https://docs.aiohttp.org/)
- 《Python Concurrency with asyncio》— Matthew Fowler
- Real Python: [Async IO in Python](https://realpython.com/async-io-python/)

---

## 十一、代码演进

### 需求：并发请求多个 API

```python
# v1: Synchronous — simple but slow
import requests, time

def fetch_all_sync(urls):
    results = []
    for url in urls:
        resp = requests.get(url)
        results.append(resp.status_code)
    return results

# v2: Async with aiohttp — 10x faster
import aiohttp, asyncio

async def fetch_all_async(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.status for r in responses]

# v3: Add rate limiting and error handling
async def fetch_all_robust(urls, max_concurrent=10):
    sem = asyncio.Semaphore(max_concurrent)
    async with aiohttp.ClientSession() as session:
        async def safe_fetch(url):
            async with sem:
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
                        return url, r.status, None
                except Exception as e:
                    return url, None, str(e)
        results = await asyncio.gather(*[safe_fetch(u) for u in urls])
    return results
```

**演进说明**：v1 同步顺序请求 → v2 异步并发 → v3 加限流、超时、错误处理，生产可用。
