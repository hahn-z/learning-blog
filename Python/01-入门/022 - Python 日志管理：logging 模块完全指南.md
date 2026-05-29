---
title: "022 - Python 日志管理：logging 模块完全指南"
slug: "022-logging"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.329+08:00"
updated_at: "2026-04-29T10:02:47.453+08:00"
reading_time: 26
tags: []
---

# Python 日志管理：logging 模块完全指南

> **难度：** 🟡 中级 | **预计阅读：** 20 分钟
> **前置知识：** Python 基础语法、文件操作、异常处理

---

## 一、概念讲解：为什么需要日志？

在开发中，`print()` 是最直觉的调试手段。但当项目上线后，你需要知道：

- 程序运行时发生了什么？
- 哪个用户在什么时间触发了错误？
- 性能瓶颈在哪里？

**日志（Logging）** 就是程序的"黑匣子飞行记录仪"。

### logging 模块的核心架构

```
Logger（记录器）→ Handler（处理器）→ Formatter（格式化器）→ 输出目标
```

| 组件 | 作用 | 类比 |
|------|------|------|
| Logger | 产生日志消息的入口 | 你说话的嘴巴 |
| Handler | 决定日志输出到哪里（文件/控制台） | 你选择的通讯工具 |
| Formatter | 决定日志长什么样 | 你说话的语气和格式 |
| Filter | 过滤特定的日志 | 你的选择性听力 |

### 日志级别（从低到高）

| 级别 | 数值 | 使用场景 |
|------|------|----------|
| DEBUG | 10 | 调试信息，只在开发时关注 |
| INFO | 20 | 确认程序按预期运行 |
| WARNING | 30 | 意外情况，但程序还能工作 |
| ERROR | 40 | 严重问题，部分功能失败 |
| CRITICAL | 50 | 程序可能无法继续运行 |

---

## 二、脑图（ASCII）

```
Python logging
├── 基本用法
│   ├── basicConfig()
│   ├── getLogger()
│   └── 五个级别: debug/info/warning/error/critical
├── 核心组件
│   ├── Logger  ── 记录器
│   ├── Handler ── 处理器
│   │   ├── StreamHandler   (控制台)
│   │   ├── FileHandler     (文件)
│   │   ├── RotatingFileHandler (滚动文件)
│   │   └── TimedRotatingFileHandler (按时间滚动)
│   ├── Formatter ── 格式化
│   └── Filter ── 过滤器
├── 最佳实践
│   ├── 使用 __name__ 作为 logger 名
│   ├── 配置文件(dictConfig/YAML)
│   └── 避免在日志中泄露敏感信息
└── 高级技巧
    ├── 自定义 Handler
    ├── 日志链路追踪
    └── 结构化日志(JSON)
```

---

## 三、完整代码示例

### v1：快速上手（basicConfig）

```python
"""
v1: Quick start with basicConfig
Suitable for simple scripts and learning
"""
import logging

# Configure logging in one line
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)

def divide(a: float, b: float) -> float:
    """Divide two numbers with logging."""
    logger.debug(f"Dividing {a} by {b}")
    if b == 0:
        logger.error("Division by zero!")
        raise ValueError("Cannot divide by zero")
    result = a / b
    logger.info(f"Result: {result}")
    return result

if __name__ == "__main__":
    divide(10, 3)
    divide(10, 0)
```

### v2：多 Handler + 文件输出

```python
"""
v2: Multiple handlers - console + file
Suitable for production services
"""
import logging
import sys

# Create a custom logger
logger = logging.getLogger("myapp")
logger.setLevel(logging.DEBUG)

# Console handler - WARNING and above
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.WARNING)
console_fmt = logging.Formatter("%(levelname)s: %(message)s")
console_handler.setFormatter(console_fmt)

# File handler - DEBUG and above (append mode)
file_handler = logging.FileHandler("app.log", encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_fmt = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s"
)
file_handler.setFormatter(file_fmt)

# Add handlers to logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)

def process_order(order_id: str, amount: float):
    """Simulate order processing with detailed logging."""
    logger.info(f"Processing order {order_id}, amount={amount}")

    if amount <= 0:
        logger.warning(f"Invalid amount {amount} for order {order_id}")
        return False

    # Simulate business logic
    logger.debug("Validating payment...")
    logger.debug("Updating inventory...")
    logger.info(f"Order {order_id} completed successfully")
    return True

if __name__ == "__main__":
    process_order("ORD-001", 99.9)
    process_order("ORD-002", -5)
    logger.error("Database connection timeout!")
```

### v3：生产级配置（dictConfig + RotatingFileHandler）

```python
"""
v3: Production-grade logging with dictConfig
Features: rotating files, structured format, module-level loggers
"""
import logging
import logging.config

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "detailed": {
            "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "format": "%(levelname)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "WARNING",
            "formatter": "simple",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "detailed",
            "filename": "app.log",
            "maxBytes": 5_000_000,  # 5 MB
            "backupCount": 3,
            "encoding": "utf-8",
        },
    },
    "loggers": {
        "myapp": {
            "level": "DEBUG",
            "handlers": ["console", "file"],
            "propagate": False,
        },
    },
    "root": {
        "level": "WARNING",
    },
}

# Apply configuration
logging.config.dictConfig(LOGGING_CONFIG)

# Create module-level loggers
logger = logging.getLogger("myapp.order")
db_logger = logging.getLogger("myapp.database")

class OrderService:
    """Service class demonstrating production logging patterns."""

    def __init__(self):
        self.logger = logging.getLogger(f"myapp.order.{self.__class__.__name__}")

    def create_order(self, user_id: str, items: list) -> dict:
        self.logger.info(f"Creating order for user={user_id}, items={len(items)}")

        if not items:
            self.logger.warning(f"Empty order from user={user_id}")
            return {"status": "error", "message": "No items"}

        # Simulate processing
        total = sum(item.get("price", 0) for item in items)
        self.logger.debug(f"Order total: {total}")

        self.logger.info(f"Order created successfully, total={total}")
        return {"status": "ok", "total": total}

if __name__ == "__main__":
    service = OrderService()
    service.create_order("user_123", [{"price": 29.9}, {"price": 49.5}])
    service.create_order("user_456", [])

    db_logger.error("Connection pool exhausted, retrying in 5s...")
```

---

## 四、执行预览

### v1 输出

```
2025-01-15 10:30:00 [DEBUG] __main__: Dividing 10 by 3
2025-01-15 10:30:00 [INFO] __main__: Result: 3.3333333333333335
2025-01-15 10:30:00 [DEBUG] __main__: Dividing 10 by 0
2025-01-15 10:30:00 [ERROR] __main__: Division by zero!
Traceback (most recent call last):
ValueError: Cannot divide by zero
```

### v2 输出（控制台只显示 WARNING+）

```
WARNING: Invalid amount -5 for order ORD-002
ERROR: Database connection timeout!
```

### v3 输出（app.log 文件）

```
2025-01-15 10:30:00 [INFO] myapp.order.OrderService: Creating order for user=user_123, items=2
2025-01-15 10:30:00 [DEBUG] myapp.order.OrderService: Order total: 79.4
2025-01-15 10:30:00 [INFO] myapp.order.OrderService: Order created successfully, total=79.4
2025-01-15 10:30:00 [WARNING] myapp.order.OrderService: Empty order from user=user_456
2025-01-15 10:30:00 [ERROR] myapp.database: Connection pool exhausted, retrying in 5s...
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| basicConfig 只生效一次 | 第二次调用会被忽略 | 在程序入口统一配置 |
| 日志泄露敏感信息 | 密码、token 可能被记录 | 对敏感字段脱敏 |
| 日志文件无限增长 | FileHandler 不会自动清理 | 使用 RotatingFileHandler |
| 多进程日志冲突 | 多进程写同一文件会出错 | 用 QueueHandler 或 SocketHandler |
| Logger 继承 | 子 logger 会向父传播 | 设置 `propagate=False` 阻断 |
| 性能影响 | 过多 DEBUG 日志拖慢速度 | 生产环境设 INFO 或 WARNING |

---

## 六、避坑指南

### ❌ 坑 1：在循环中用 f-string 格式化日志

```python
# ❌ 即使日志级别不匹配也会执行 f-string
for item in large_list:
    logger.debug(f"Processing item: {json.dumps(item)}")

# ✅ 用 % 格式化，延迟求值
for item in large_list:
    logger.debug("Processing item: %s", json.dumps(item))
```

### ❌ 坑 2：重复添加 Handler

```python
# ❌ 每次调用都加一个 handler，日志会重复打印
def get_logger():
    logger = logging.getLogger("myapp")
    logger.addHandler(logging.StreamHandler())
    return logger

# ✅ 先检查再添加
def get_logger():
    logger = logging.getLogger("myapp")
    if not logger.handlers:
        logger.addHandler(logging.StreamHandler())
    return logger
```

### ❌ 坑 3：直接 logging.xxx() 用根记录器

```python
# ❌ 用根记录器，影响所有第三方库的日志
logging.info("Doing something")

# ✅ 用模块级 logger
logger = logging.getLogger(__name__)
logger.info("Doing something")
```

---

## 七、练习题

### 🟢 入门：日志基础

编写一个脚本，使用 `basicConfig` 配置日志，实现：
1. 将 DEBUG 及以上级别的日志输出到控制台
2. 格式包含时间、级别、消息
3. 模拟一个文件读取操作，记录成功/失败日志

### 🟡 进阶：多 Handler 配置

为一个小型 Web 服务配置日志系统：
1. 控制台只显示 WARNING 以上
2. 所有日志写入文件 `server.log`
3. ERROR 以上单独写入 `error.log`
4. 使用 `dictConfig` 配置

### 🔴 挑战：结构化日志

实现一个 JSON 格式的日志 Formatter：
1. 每条日志输出为 JSON 行 `{"time": "...", "level": "...", "msg": "..."}`
2. 支持额外字段（如 `request_id`、`user_id`）
3. 集成到 dictConfig 中

---

## 八、知识点总结（树状）

```
logging 模块
├── 配置方式
│   ├── basicConfig() ─── 简单脚本
│   ├── dictConfig()  ─── 生产推荐
│   ├── fileConfig()  ─── INI 配置文件
│   └── 代码手动配置  ─── 灵活但啰嗦
├── 核心组件
│   ├── Logger ─── getLogger(__name__)
│   ├── Handler
│   │   ├── StreamHandler
│   │   ├── FileHandler
│   │   ├── RotatingFileHandler ─── 按大小滚动
│   │   └── TimedRotatingFileHandler ─── 按时间滚动
│   ├── Formatter ─── 日志格式模板
│   └── Filter ─── 高级过滤
├── 格式占位符
│   ├── %(asctime)s  ─── 时间
│   ├── %(levelname)s ─── 级别
│   ├── %(name)s     ─── Logger 名
│   ├── %(message)s  ─── 消息
│   └── %(lineno)d   ─── 行号
└── 最佳实践
    ├── 用 __name__ 命名 Logger
    ├── 生产用 dictConfig
    ├── 延迟格式化（% 而非 f-string）
    └── RotatingFileHandler 防止日志膨胀
```

---

## 九、举一反三

| 场景 | 推荐方案 | 关键配置 |
|------|----------|----------|
| 一次性脚本 | basicConfig | `level=logging.DEBUG` |
| Web 服务 | dictConfig + RotatingFileHandler | console WARNING + file DEBUG |
| 微服务/云原生 | JSON 结构化日志 + stdout | 第三方库 `python-json-logger` |
| 数据处理管道 | 按 module 分 Logger + 按级别分文件 | 多 handler + filter |
| CLI 工具 | Rich Handler（彩色输出） | `from rich.logging import RichHandler` |
| 多进程服务 | QueueHandler + QueueListener | 主进程统一写文件 |

---

## 十、参考资料

- 📖 [Python 官方文档 - logging](https://docs.python.org/3/library/logging.html)
- 📖 [Logging HOWTO](https://docs.python.org/3/howto/logging.html)
- 📖 [Logging Cookbook](https://docs.python.org/3/howto/logging-cookbook.html)
- 🔧 [python-json-logger](https://github.com/madzak/python-json-logger) - JSON 格式日志
- 🔧 [structlog](https://www.structlog.org/) - 结构化日志库
- 🔧 [loguru](https://github.com/Delgan/loguru) - 更简洁的第三方日志库

---

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 basicConfig | 一行配置，简单直接 | 学习、小脚本 |
| v2 多 Handler | 控制台+文件分离，灵活控制 | 中小型项目 |
| v3 dictConfig | 生产级配置，滚动文件，模块化 Logger | 生产环境服务 |

**演进路径：** `basicConfig → 手动 Handler → dictConfig → 结构化日志`

> 💡 **一句话总结：** 永远不要用 print 调试生产代码。logging 模块 5 分钟学会，终身受益。
