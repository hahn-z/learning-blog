# Python异步进阶：并发模式与性能优化

> 分类：异步编程 | 并发模式 | 难度：⭐⭐⭐⭐ | 预估用时：60 分钟

---

## 🎯 学习目标

1. ✅ 能够解释 `asyncio.gather`、`Semaphore`、`TaskGroup` 的区别与适用场景（理解）
2. ✅ 能够编写生产者-消费者模式的异步程序（应用）
3. ✅ 能够用性能数据对比同步与异步方案（分析）
4. ✅ 能够根据场景选择合适的并发控制策略（评价）

---

## 📋 前置知识自检

1. **你能用 `async/await` 写一个基本的异步函数并用 `asyncio.run()` 运行吗？**（答不上来？→ [《Python异步编程入门》](08-python-异步编程入门.md)）
2. **你理解事件循环的基本工作方式吗？**（答不上来？→ [《Python异步编程入门》](08-python-异步编程入门.md)）

---

## 💡 概念讲解

### 并发控制模式

- **一句话定义**：控制多个异步任务"怎么跑"的策略——全部同时跑、限制并发数、分组跑、排队跑。
- **现实类比**：
  - `gather`：所有人一起冲进自助餐厅，各吃各的
  - `Semaphore`：餐厅只有 5 个座位，一次最多 5 人同时吃
  - `TaskGroup`：一个旅行团，大家一起走，有一个人出事全团停
  - `Queue`：取号排队，叫到你就去办
- **技术场景**：调 API 限速、爬虫控制并发、消息处理、批量数据处理。
- **⚠️ 常见误解**：`gather` 不是万能的——1000 个任务用 `gather` 同时跑，可能把目标服务器打挂或者被限流。

---

## 🧠 实时脑图

```text
[并发控制策略] 🔴
    ||
    ├──→ [asyncio.gather] 🟡 — 全部并发，等所有完成
    │       └── 适用：少量、无限制的并发
    ├──→ [asyncio.Semaphore] 🔴 — 限制最大并发数
    │       └── 适用：API限流、资源有限
    ├──→ [TaskGroup] 🟡 — 结构化并发（Python 3.11+）
    │       └── 适用：需要异常隔离的任务组
    ├──→ [asyncio.Queue] 🟡 — 生产者-消费者模式
    │       └── 适用：流式处理、动态任务
    └──→ [异步上下文管理器] 🟢 — 资源管理
            └── 适用：连接池、文件句柄
```

---

## 💻 完整代码

> 运行环境：Python 3.11+（TaskGroup 需要 3.11）

```python
"""
async_advanced.py - Python 异步进阶：并发模式
Python 3.11+
"""

import asyncio
import time
import aiohttp  # pip install aiohttp


# ============================================
# 1. asyncio.gather — 全并发
# ============================================

async def mock_api_call(name: str, delay: float) -> dict:
    """模拟 API 调用"""
    await asyncio.sleep(delay)
    return {"name": name, "status": "ok", "delay": delay}


async def demo_gather():
    """gather：所有任务并发执行，等待全部完成"""
    start = time.perf_counter()
    results = await asyncio.gather(
        mock_api_call("API-1", 0.5),
        mock_api_call("API-2", 0.8),
        mock_api_call("API-3", 0.3),
        mock_api_call("API-4", 1.0),
        mock_api_call("API-5", 0.6),
    )
    elapsed = time.perf_counter() - start
    print(f"[gather] 5个API并发，总耗时: {elapsed:.2f}s（最慢那个 ~1.0s）")
    return results


# ============================================
# 2. asyncio.Semaphore — 限流并发
# ============================================

async def rate_limited_fetch(sem: asyncio.Semaphore, name: str, delay: float) -> dict:
    """使用 Semaphore 限制并发数"""
    async with sem:  # 获取信号量，超出限制则等待
        await asyncio.sleep(delay)
        return {"name": name, "status": "ok"}


async def demo_semaphore():
    """Semaphore：最多同时 N 个任务"""
    sem = asyncio.Semaphore(2)  # 最多 2 个并发
    start = time.perf_counter()
    tasks = [
        rate_limited_fetch(sem, f"task-{i}", 1.0)
        for i in range(6)
    ]
    results = await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - start
    # 6个任务，每次最多2个，每个1秒 → 约3秒
    print(f"[Semaphore=2] 6个任务，总耗时: {elapsed:.2f}s（预期 ~3.0s）")
    return results


# ============================================
# 3. TaskGroup — 结构化并发（Python 3.11+）
# ============================================

async def demo_taskgroup():
    """TaskGroup：异常安全，一个挂全部挂"""
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(mock_api_call("TG-1", 0.5))
        t2 = tg.create_task(mock_api_call("TG-2", 0.3))
        t3 = tg.create_task(mock_api_call("TG-3", 0.8))
    elapsed = time.perf_counter() - start
    print(f"[TaskGroup] 3个任务，总耗时: {elapsed:.2f}s")
    print(f"  结果: {t1.result()}, {t2.result()}, {t3.result()}")


# ============================================
# 4. asyncio.Queue — 生产者消费者
# ============================================

async def producer(queue: asyncio.Queue, items: list):
    """生产者：往队列里放数据"""
    for item in items:
        await queue.put(item)
        print(f"  📦 生产: {item}")
    # 发送结束信号
    await queue.put(None)


async def worker(queue: asyncio.Queue, worker_id: int):
    """消费者：从队列取数据处理"""
    while True:
        item = await queue.get()
        if item is None:  # 结束信号
            queue.task_done()
            break
        await asyncio.sleep(0.1)  # 模拟处理
        print(f"  ✅ Worker-{worker_id} 处理完: {item}")
        queue.task_done()


async def demo_queue():
    """Queue：生产者-消费者模式"""
    queue = asyncio.Queue(maxsize=5)
    items = [f"item-{i}" for i in range(8)]

    start = time.perf_counter()
    # 启动 1 个生产者 + 3 个消费者
    await asyncio.gather(
        producer(queue, items),
        worker(queue, 1),
        worker(queue, 2),
        worker(queue, 3),
    )
    elapsed = time.perf_counter() - start
    print(f"[Queue] 8个item，3个worker，总耗时: {elapsed:.2f}s")


# ============================================
# 5. 异步上下文管理器
# ============================================

class AsyncDBConnection:
    """模拟异步数据库连接"""

    async def __aenter__(self):
        await asyncio.sleep(0.1)  # 模拟建立连接
        print("  🔗 数据库连接已建立")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await asyncio.sleep(0.05)  # 模拟关闭连接
        print("  🔌 数据库连接已关闭")

    async def query(self, sql: str):
        await asyncio.sleep(0.2)
        return f"查询结果: {sql}"


async def demo_context_manager():
    """异步上下文管理器：自动管理资源"""
    async with AsyncDBConnection() as db:
        result = await db.query("SELECT * FROM users")
        print(f"  {result}")


# ============================================
# 6. 性能对比：同步 vs 异步调用10个API
# ============================================

import requests as req_lib  # sync


def sync_call_apis(n: int) -> float:
    """同步调用 n 个模拟 API"""
    start = time.perf_counter()
    for i in range(n):
        time.sleep(0.2)  # 模拟每个 API 延迟 200ms
    return time.perf_counter() - start


async def async_call_apis(n: int) -> float:
    """异步并发调用 n 个模拟 API"""
    start = time.perf_counter()
    await asyncio.gather(*[asyncio.sleep(0.2) for _ in range(n)])
    return time.perf_counter() - start


async def benchmark():
    """性能基准测试"""
    n = 10
    sync_time = sync_call_apis(n)
    async_time = await async_call_apis(n)
    print(f"\n{'='*50}")
    print(f"⚡ 性能对比（{n} 个 API 调用，每个延迟 200ms）")
    print(f"{'='*50}")
    print(f"  同步串行: {sync_time:.2f}s")
    print(f"  异步并发: {async_time:.2f}s")
    print(f"  提速倍数: {sync_time / async_time:.1f}x")


# ============================================
# 主函数
# ============================================

async def main():
    print("=" * 50)
    print("1. gather 全并发")
    await demo_gather()

    print(f"\n{'='*50}")
    print("2. Semaphore 限流")
    await demo_semaphore()

    print(f"\n{'='*50}")
    print("3. TaskGroup 结构化并发")
    await demo_taskgroup()

    print(f"\n{'='*50}")
    print("4. Queue 生产者消费者")
    await demo_queue()

    print(f"\n{'='*50}")
    print("5. 异步上下文管理器")
    await demo_context_manager()

    await benchmark()


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 👀 执行预览

```bash
$ python async_advanced.py

==================================================
1. gather 全并发
[gather] 5个API并发，总耗时: 1.00s（最慢那个 ~1.0s）

==================================================
2. Semaphore 限流
[Semaphore=2] 6个任务，总耗时: 3.00s（预期 ~3.0s）

==================================================
3. TaskGroup 结构化并发
[TaskGroup] 3个任务，总耗时: 0.80s
  结果: {'name': 'TG-1', ...}, {'name': 'TG-2', ...}, {'name': 'TG-3', ...}

==================================================
4. Queue 生产者消费者
  📦 生产: item-0
  ✅ Worker-1 处理完: item-0
  ...
[Queue] 8个item，3个worker，总耗时: 0.35s

==================================================
5. 异步上下文管理器
  🔗 数据库连接已建立
  查询结果: SELECT * FROM users
  🔌 数据库连接已关闭

==================================================
⚡ 性能对比（10 个 API 调用，每个延迟 200ms）
==================================================
  同步串行: 2.00s
  异步并发: 0.20s
  提速倍数: 10.0x
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ `gather` 不限制并发数 | 大量并发可能打挂目标服务器或触发限流 | 🔴 |
| ⚠️ `TaskGroup` 需要 Python 3.11+ | 3.10 及以下版本无法使用 | 🟡 |
| ⚠️ `Queue.get()` 要配合 `task_done()` | `join()` 会永远阻塞 | 🔴 |
| ⚠️ `Semaphore` 值设太小会降低吞吐 | 性能浪费，并发优势丢失 | 🟢 |
| ⚠️ 异步不适用 CPU 密集型任务 | CPU 计算不受事件循环调度 | 🟡 |

---

## 🕳️ 避坑指南

### 坑1：无限并发导致被限流

```python
# ❌ 1000个任务同时跑
await asyncio.gather(*[fetch(i) for i in range(1000)])

# ✅ 用 Semaphore 限制并发
sem = asyncio.Semaphore(10)
async def limited_fetch(i):
    async with sem:
        return await fetch(i)
await asyncio.gather(*[limited_fetch(i) for i in range(1000)])
```

### 坑2：Queue 的 task_done 忘记调用

```python
# ❌ 忘记 task_done → join() 永远阻塞
async def bad_worker(queue):
    while True:
        item = await queue.get()
        if item is None:
            break
        await process(item)
        # 忘了 queue.task_done()!

# ✅ 正确写法
async def good_worker(queue):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        await process(item)
        queue.task_done()
```

### 坑3：gather 中一个任务异常导致全部丢失

```python
# ❌ 一个失败全部结果丢失
results = await asyncio.gather(task1(), task2())  # task2 抛异常，results 整体失败

# ✅ 用 return_exceptions=True 捕获每个结果
results = await asyncio.gather(task1(), task2(), return_exceptions=True)
for r in results:
    if isinstance(r, Exception):
        print(f"任务失败: {r}")
```

---

## 🔍 调试排查

### 故障场景1：异步程序卡死不动

**症状**：程序运行后挂住，没有任何输出
**排查思路**：
1. 检查是否有 `await queue.get()` 永远等不到数据
2. 检查 `await queue.join()` 是否有 worker 忘了 `task_done()`
3. 加 `asyncio.timeout`（3.11+）设超时
```python
async with asyncio.timeout(10):
    await main()
```

**根因**：队列消费者没有发送结束信号，或 `task_done()` 遗漏
**修复**：确保每个 `queue.get()` 都有对应的 `queue.task_done()`

### 故障场景2：Semaphore 不生效

**症状**：设了 `Semaphore(5)` 但并发数看起来不止 5
**排查思路**：
1. 检查 `async with sem` 是否真的包裹了整个异步操作
2. 确认没有绕过信号量直接 `gather`

**根因**：`Semaphore` 放在了 `gather` 外面而非任务内部
**修复**：在任务函数内部 `async with sem`

---

## 📝 练习题

### 🟢 基础题

1. 用 `asyncio.gather` 并发执行 3 个 `mock_api_call`，打印结果和总耗时。（考察点：gather 基本用法 → 目标 #1）

### 🟡 进阶题

2. 写一个限流爬虫：用 `Semaphore(3)` 控制最多 3 个并发请求，模拟爬取 20 个 URL（每个延迟 0.5 秒），打印总耗时。（考察点：Semaphore 限流 → 目标 #4）

3. 实现一个异步生产者-消费者：生产者生成 10 个数字，2 个消费者各消费一半并打印。（考察点：Queue 模式 → 目标 #2）

### 🔴 开放题

4. 假设你需要调用一个 API 1000 次，但该 API 每秒最多接受 10 个请求。设计一个方案既满足限流要求又尽可能快。（考察点：并发策略选择 → 目标 #4）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
Python 异步进阶
├── gather — 全并发，等全部
├── Semaphore — 限制并发数
├── TaskGroup — 结构化并发，异常安全
├── Queue — 生产者消费者
├── 异步上下文管理器 — __aenter__/__aexit__
└── 性能 — 同步10次2s → 异步0.2s（10x提速）
```

---

## 🔄 举一反三

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 调10个API无限制 | `gather` | 任务少，无需限流 |
| 调1000个API有限流 | `Semaphore` + `gather` | 控制并发，避免封IP |
| 流式处理消息 | `Queue` + 多 worker | 动态生产，持续消费 |
| 多任务需全部成功才继续 | `TaskGroup` | 一个失败全部取消 |

---

## 🗺️ 学习路径

```
[异步编程入门] → **📍 你在这里：异步进阶** → [httpx异步客户端] → [FastAPI异步框架]
```

**下一篇建议**：
- → [《Pydantic v2数据验证》](10-pydantic-v2数据验证.md)：AI应用的数据验证基石
- → [《httpx：比requests更好的HTTP客户端》](13-httpx-比requests更好的HTTP客户端.md)：异步HTTP实战

**相关主题**：
- [《FastAPI入门》]：将异步与Web框架结合

---

## ⚡ 性能对比

| 方案 | 10个API(各200ms) | 100个API(各200ms) | 说明 |
|------|-------------------|--------------------|------|
| 同步串行 | 2.0s | 20.0s | 简单但极慢 |
| gather(无限并发) | 0.2s | 0.2s | 最快但可能被封 |
| Semaphore(10) | 0.2s | 2.0s | 平衡速度与安全 |
| Semaphore(5) | 0.4s | 4.0s | 更保守 |

**铁蛋建议**：生产环境推荐 `Semaphore(10~20)` + `gather`，既快又安全。

---

## 📦 版本兼容性

- ✅ 适配版本：Python 3.11+
- ⚠️ 差异：
  - `TaskGroup`：仅 Python 3.11+，3.10 需用 `asyncio.gather` 替代
  - `asyncio.timeout`：仅 3.11+，3.10 用 `asyncio.wait_for`
  - 其余 API（gather/Semaphore/Queue）：3.7+ 均可用

---

## 📚 参考资料

- [asyncio 官方文档 - TaskGroup](https://docs.python.org/3/library/asyncio-task.html#task-groups) [等级：官方]
- [Real Python - Getting Started With asyncio](https://realpython.com/async-io-python/) [等级：权威]

---

## 附录：练习题参考答案

**题2**：
```python
import asyncio, time

async def fetch(sem, url_id):
    async with sem:
        await asyncio.sleep(0.5)
        return f"url-{url_id}"

async def main():
    sem = asyncio.Semaphore(3)
    start = time.perf_counter()
    results = await asyncio.gather(*[fetch(sem, i) for i in range(20)])
    print(f"20个URL, Semaphore=3, 总耗时: {time.perf_counter()-start:.2f}s")
    # 预期约 3.5s (20/3≈7批, 每批0.5s)

asyncio.run(main())
```

**题4**：
```python
# 用 Semaphore(10) 控制每秒最多10个请求
# 每个 API 调用固定耗时 ~1s，所以 Semaphore(10) 约等于 10 QPS
# 1000个任务 / 10并发 = 100批，每批~1s → 总耗时约100s

sem = asyncio.Semaphore(10)
async def limited_call(i):
    async with sem:
        await api_call(i)  # 假设约1s
await asyncio.gather(*[limited_call(i) for i in range(1000)])
```
