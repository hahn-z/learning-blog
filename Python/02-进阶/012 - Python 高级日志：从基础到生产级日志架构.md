---
title: "012 - Python 高级日志：从基础到生产级日志架构"
slug: "012-logging-advanced"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.414+08:00"
updated_at: "2026-04-29T10:02:47.597+08:00"
reading_time: 36
tags: []
---


# Python 高级日志：从基础到生产级日志架构

> **难度：⭐⭐⭐⭐ 高级** | **阅读时间：约 18 分钟**

---

## 一、概念讲解

Python `logging` 模块采用**三层架构**：

- **Logger**：产生日志的入口，每个模块一个 logger
- **Handler**：决定日志发往哪里（文件、控制台、网络）
- **Formatter**：决定日志长什么样

**数据流：Logger → Filter → Handler → Formatter → 目的地**

日志级别（从低到高）：`DEBUG(10)` → `INFO(20)` → `WARNING(30)` → `ERROR(40)` → `CRITICAL(50)`

```
┌────────────────────────────────────────────────────┐
│              logging 架构全景脑图                     │
├──────────────┬───────────────┬─────────────────────┤
│   Logger     │   Handler     │   Formatter          │
│   (产生日志)  │  (发送日志)    │  (格式化日志)         │
├──────────────┼───────────────┼─────────────────────┤
│ getLogger()  │ StreamHandler │ Formatter(fmt)       │
│ setLevel()   │ FileHandler   │ JSONFormatter(自定义) │
│ addHandler() │ RotatingFile  │                      │
│              │ TimedRotating │                      │
│              │ SMTPHandler   │                      │
│              │ QueueHandler  │                      │
├──────────────┴───────────────┴─────────────────────┤
│  Filter (可选：细粒度过滤，按条件决定是否记录)           │
└────────────────────────────────────────────────────┘
```

---

## 二、代码演进

### v1：print 大法（初级）

```python
def process_order(order_id):
    print(f"Processing order {order_id}")
    try:
        result = calculate_total(order_id)
        print(f"Total: {result}")
        return result
    except Exception as e:
        print(f"Error: {e}")  # Where? When? What context?
```

问题：没法按级别过滤、没法轮转、没法输出到文件、生产环境灾难。

### v2：basicConfig（中级）

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    filename="app.log"
)
logging.info("Processing order 123")
# → 2024-01-15 10:30:00 [INFO] Processing order 123
```

问题：全局配置共享，不同模块无法设不同级别，日志文件不轮转。

### v3：生产级日志架构（终极）

```python
import logging
import logging.handlers
import json
from datetime import datetime

# Custom JSON Formatter for ELK/Datadog
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        # Include extra fields
        for key in ("user_id", "request_id", "duration_ms"):
            if hasattr(record, key):
                log_data[key] = getattr(record, key)
        return json.dumps(log_data, ensure_ascii=False)

def setup_logger(name="app", level=logging.DEBUG, log_file="app.log"):
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.handlers.clear()  # Prevent duplicate handlers!

    # Console: human readable
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))
    logger.addHandler(console)

    # File: JSON + rotation
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=10*1024*1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(JSONFormatter())
    logger.addHandler(file_handler)

    return logger

# Usage
logger = setup_logger("myapp")
logger.info("Application started")
logger.info("User login", extra={"user_id": "user_123"})
logger.info("API completed", extra={"request_id": "req_abc", "duration_ms": 142})

try:
    1 / 0
except ZeroDivisionError:
    logger.error("Division failed", exc_info=True)
```

---

## 三、核心高级用法

### 3.1 日志轮转

```python
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler

# By size: 10MB per file, keep 5 backups
size_handler = RotatingFileHandler(
    "app.log", maxBytes=10*1024*1024, backupCount=5, encoding="utf-8"
)
# Creates: app.log, app.log.1, ..., app.log.5

# By time: new file every midnight, keep 30 days
time_handler = TimedRotatingFileHandler(
    "app.log", when="midnight", backupCount=30, encoding="utf-8"
)
# when options: "S"=seconds, "M"=minutes, "H"=hourly, "D"=daily,
#               "midnight", "W0"-"W6"=weekday
```

### 3.2 按模块设置不同级别

```python
# Different modules, different levels
api_logger = logging.getLogger("app.api")
api_logger.setLevel(logging.INFO)

db_logger = logging.getLogger("app.db")
db_logger.setLevel(logging.WARNING)  # Only warnings+

# Silence noisy third-party libraries
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Logger hierarchy: "app.api" inherits from "app" inherits from root
# propagate=False stops bubbling up to parent
api_logger.propagate = False
```

### 3.3 结构化 JSON 日志

```python
import json, logging
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "file": f"{record.module}:{record.lineno}",
        }
        if record.exc_info:
            log["exc"] = self.formatException(record.exc_info)
        # Auto-include any extra fields
        standard_attrs = {
            "name","msg","args","created","exc_info","levelname",
            "levelno","lineno","module","funcName","msecs","message",
            "pathname","process","processName","relativeCreated",
            "thread","threadName","taskName","stack_info",
        }
        for k, v in record.__dict__.items():
            if k not in standard_attrs and not k.startswith("_"):
                log[k] = v
        return json.dumps(log, ensure_ascii=False, default=str)

handler = logging.FileHandler("structured.jsonl")
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("structured")
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

logger.info("Order created", extra={
    "order_id": "ORD-001", "amount": 99.9, "currency": "CNY"
})
# {"ts":"2024-...","level":"INFO","msg":"Order created","order_id":"ORD-001","amount":99.9}
```

### 3.4 QueueHandler — 异步日志

```python
import logging.handlers
import queue

log_queue = queue.Queue(-1)  # Unlimited

# Main thread: non-blocking queue handler
queue_handler = logging.handlers.QueueHandler(log_queue)

# Listener thread: writes to actual destination
file_handler = logging.FileHandler("app.log")
listener = logging.handlers.QueueListener(log_queue, file_handler)
listener.start()

logger = logging.getLogger("async_app")
logger.addHandler(queue_handler)
logger.setLevel(logging.INFO)

# Logging is now non-blocking!
for i in range(10000):
    logger.info(f"Processing item {i}")  # Won't block main thread

# On shutdown:
# listener.stop()
```

### 3.5 自定义 Filter

```python
import time, logging

class RateLimitFilter(logging.Filter):
    """Limit how often identical messages appear."""
    def __init__(self, rate=60):
        super().__init__()
        self.rate = rate
        self._last = {}

    def filter(self, record):
        now = time.time()
        key = (record.name, record.getMessage()[:80])
        if key in self._last and now - self._last[key] < self.rate:
            return False  # Suppress duplicate
        self._last[key] = now
        return True

class ContextFilter(logging.Filter):
    """Add contextual info to every log record."""
    def __init__(self, app_name, version):
        super().__init__()
        self.app_name = app_name
        self.version = version

    def filter(self, record):
        record.app_name = self.app_name
        record.version = self.version
        return True

# Usage
logger.addFilter(RateLimitFilter(rate=10))
logger.addFilter(ContextFilter("myapp", "2.0.0"))
```

### 3.6 dictConfig — 配置文件管理

```python
import logging.config

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        },
        "detailed": {
            "format": "%(asctime)s [%(levelname)s] %(name)s %(funcName)s:%(lineno)d - %(message)s"
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "simple",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "detailed",
            "filename": "app.log",
            "maxBytes": 10485760,
            "backupCount": 5,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "app.api": {
            "level": "INFO",
            "handlers": ["console", "file"],
            "propagate": False,
        },
        "app.db": {
            "level": "WARNING",
            "handlers": ["file"],
            "propagate": False,
        },
    },
    "root": {
        "level": "WARNING",
        "handlers": ["console"],
    },
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger("app.api")
logger.info("API server started")
```

---

## 四、执行预览

```
$ python advanced_logging_demo.py
2024-01-15 10:30:00,123 [INFO] myapp: Application started
2024-01-15 10:30:00,124 [INFO] myapp: User login
2024-01-15 10:30:00,125 [INFO] myapp: API completed
2024-01-15 10:30:00,126 [ERROR] myapp: Division failed
Traceback (most recent call last):
  File "demo.py", line 45, in <module>
    1 / 0
ZeroDivisionError: division by zero

$ cat app.log
{"ts":"2024-01-15T02:30:00.123Z","level":"INFO","logger":"myapp","msg":"Application started","module":"demo","line":38}
{"ts":"2024-01-15T02:30:00.124Z","level":"INFO","logger":"myapp","msg":"User login","user_id":"user_123"}
{"ts":"2024-01-15T02:30:00.125Z","level":"INFO","logger":"myapp","msg":"API completed","request_id":"req_abc","duration_ms":142}
{"ts":"2024-01-15T02:30:00.126Z","level":"ERROR","logger":"myapp","msg":"Division failed","exc":"Traceback..."}
```

---

## 五、注意事项

| 主题 | 注意点 | 风险 |
|------|--------|------|
| Handler 重复 | `getLogger` 返回同一对象，重复 `addHandler` 会重复输出 | 🔴 日志翻倍 |
| 日志级别 | 生产至少 INFO，开发用 DEBUG | ⚠️ 噪音/遗漏 |
| 日志轮转 | 多进程写同一文件会冲突，需用 QueueHandler | 🔴 数据丢失 |
| propagate | 默认 True，日志会冒泡到 root logger | ⚠️ 重复输出 |
| 异常日志 | 用 `exc_info=True` 记录完整堆栈 | ⚠️ 丢失上下文 |
| 性能 | 避免在 DEBUG 日志中做昂贵计算（用 `isEnabledFor` 守卫） | ⚠️ 性能 |
| 敏感信息 | 不要记录密码、token、个人信息 | 🔴 安全 |

---

## 六、避坑指南

### ❌ 坑1：重复添加 Handler

```python
# ❌ Wrong: every call adds another handler
def get_logger():
    logger = logging.getLogger("app")
    logger.addHandler(logging.StreamHandler())  # Duplicated!
    return logger
# 3 calls = 3 handlers = each message printed 3 times
```

```python
# ✅ Correct: check before adding, or clear first
def get_logger():
    logger = logging.getLogger("app")
    if not logger.handlers:  # Only add once
        logger.addHandler(logging.StreamHandler())
    return logger
```

### ❌ 坑2：日志中的昂贵计算

```python
# ❌ Wrong: expensive operation always runs even if DEBUG is disabled
logger.debug(f"Data: {expensive_serialize(big_object)}")
```

```python
# ✅ Correct: guard with isEnabledFor
if logger.isEnabledFor(logging.DEBUG):
    logger.debug(f"Data: {expensive_serialize(big_object)}")

# Or use %s lazy formatting
logger.debug("Data: %s", lambda: expensive_serialize(big_object))
```

### ❌ 坑3：多进程写同一日志文件

```python
# ❌ Wrong: multiple processes writing to same file
# Process 1 and Process 2 both write to "app.log" → corruption!
```

```python
# ✅ Correct: each process writes to its own file, or use QueueHandler
# Option 1: per-process files
file_handler = logging.FileHandler(f"app_{os.getpid()}.log")

# Option 2: central queue (for multi-process, use multiprocessing.Queue)
import multiprocessing
log_queue = multiprocessing.Queue(-1)
queue_handler = logging.handlers.QueueHandler(log_queue)
```

### ❌ 坑4：propagate 导致重复日志

```python
# ❌ Wrong: both child AND root handler output the message
logger = logging.getLogger("app.api")
logger.addHandler(console_handler)  # Output #1
# propagate=True (default) → root logger also handles → Output #2
```

```python
# ✅ Correct: set propagate=False for child loggers
logger = logging.getLogger("app.api")
logger.addHandler(console_handler)
logger.propagate = False  # Stop bubbling to root
```

---

## 七、练习题

### 🟢 基础题

**题目1：** 配置一个 logger，同时输出到控制台（INFO 级别）和文件（DEBUG 级别），使用不同格式。

**题目2：** 用 `RotatingFileHandler` 实现日志轮转：每个文件最大 1MB，保留 3 个备份。

### 🟡 进阶题

**题目3：** 实现 `JSONFormatter`，输出的每条日志都是合法 JSON，包含 timestamp、level、logger、message、module 五个字段。

**题目4：** 用 `dictConfig` 配置一个 Web 应用的日志系统：API 层 INFO 级别、数据库层 WARNING 级别、第三方库静默。

### 🔴 挑战题

**题目5：** 实现一个带请求追踪 ID 的日志中间件，在 Web 框架中自动为每个请求的日志添加 `request_id` 字段。

**题目6：** 用 `QueueHandler` + `QueueListener` 实现多进程安全的日志系统，支持子进程日志统一写入。

---

## 八、知识点总结

```
logging 高级架构
├── 核心组件
│   ├── Logger — 日志入口，分层命名 (app.api.v1)
│   ├── Handler — 输出目的地
│   │   ├── StreamHandler — 控制台
│   │   ├── FileHandler — 文件
│   │   ├── RotatingFileHandler — 按大小轮转
│   │   ├── TimedRotatingFileHandler — 按时间轮转
│   │   ├── SMTPHandler — 邮件告警
│   │   └── QueueHandler — 异步队列
│   ├── Formatter — 格式化
│   │   ├── Formatter(fmt) — 文本格式
│   │   └── 自定义 JSONFormatter — 结构化
│   └── Filter — 细粒度过滤
├── 配置方式
│   ├── basicConfig() — 简单配置
│   ├── dictConfig() — 字典配置（推荐）
│   ├── fileConfig() — INI 文件配置
│   └── 代码配置 — 最灵活
├── 高级模式
│   ├── QueueHandler/QueueListener — 异步日志
│   ├── 自定义 Filter — 限流/添加上下文
│   ├── LoggerAdapter — 动态附加信息
│   └── structured logging — JSON 日志
└── 最佳实践
    ├── 生产用 INFO+，开发用 DEBUG
    ├── 每个模块用 __name__ 做 logger 名
    ├── exc_info=True 记录异常堆栈
    ├── 日志轮转防磁盘满
    └── 敏感信息不入日志
```

---

## 九、举一反三

| 场景 | 推荐方案 | 要点 |
|------|----------|------|
| Web 应用日志 | dictConfig + 按模块分层 | API=INFO, DB=WARNING |
| 日志分析/检索 | JSON 格式 → ELK/Datadog | 结构化便于检索 |
| 高并发日志 | QueueHandler 异步 | 不阻塞主线程 |
| 邮件告警 | SMTPHandler | 仅 ERROR+ 级别 |
| 多进程日志 | QueueHandler + multiprocessing.Queue | 避免文件冲突 |
| 日志限流 | 自定义 RateLimitFilter | 防止日志风暴 |
| 分布式追踪 | request_id + ContextFilter | 关联请求链路 |
| 日志脱敏 | 自定义 Filter 过滤敏感字段 | 合规要求 |

---

## 十、参考资料

- [Python 官方文档 — logging](https://docs.python.org/3/library/logging.html)
- [Logging HOWTO（官方教程）](https://docs.python.org/3/howto/logging.html)
- [Logging Cookbook（官方进阶）](https://docs.python.org/3/howto/logging-cookbook.html)
- [PEP 282 — Logging System](https://peps.python.org/pep-0282/)
- 《Python Cookbook》第 13 章：测试、调试与异常
