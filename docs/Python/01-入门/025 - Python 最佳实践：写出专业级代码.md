---
title: "025 - Python 最佳实践：写出专业级代码"
slug: "025-python-best-practices"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.344+08:00"
updated_at: "2026-04-29T10:02:47.485+08:00"
reading_time: 39
tags: []
---

# Python 最佳实践：写出专业级代码

> **难度：** 🟡 中级 | **预计阅读：** 25 分钟
> **前置知识：** Python 基础语法、函数、类、模块

---

## 一、概念讲解：为什么需要最佳实践？

"能跑就行"和"专业代码"之间的差距，就是最佳实践。

最佳实践不是教条，而是前人踩坑总结的经验：

- **可读性** —— 6 个月后的你能看懂吗？
- **可维护性** —— 改一个功能要改几个文件？
- **健壮性** —— 边界情况处理了吗？
- **一致性** —— 团队代码风格统一吗？

### 核心原则

| 原则 | 含义 | 代码体现 |
|------|------|----------|
| DRY | Don't Repeat Yourself | 提取函数和类 |
| KISS | Keep It Simple, Stupid | 不过度设计 |
| YAGNI | You Aren't Gonna Need It | 不提前写用不到的代码 |
| SRP | Single Responsibility | 一个函数只做一件事 |
| EAFP | Easier to Ask Forgiveness | 先做，出错再处理 |
| LBYL | Look Before You Leap | 先检查，再做（Python 不推荐） |

---

## 二、脑图（ASCII）

```
Python 最佳实践
├── 代码风格
│   ├── PEP 8 规范
│   ├── Black (自动格式化)
│   ├── Ruff (lint + format)
│   └── 命名规范
├── 项目结构
│   ├── src layout
│   ├── pyproject.toml
│   ├── __init__.py
│   └── tests/
├── 代码质量
│   ├── 类型注解 (mypy)
│   ├── Lint (ruff/flake8)
│   ├── 测试 (pytest)
│   └── pre-commit hooks
├── 错误处理
│   ├── 具体异常 > 裸 except
│   ├── 自定义异常类
│   └── 上下文管理器
├── 性能优化
│   ├── 算法优先
│   ├── 生成器 > 列表
│   ├── 缓存 (functools.lru_cache)
│   └── 性能分析 (cProfile)
└── 现代特性
    ├── f-string (3.6+)
    ├── dataclass (3.7+)
    ├── walrus operator := (3.8+)
    ├── match/case (3.10+)
    └── type hints | 语法 (3.10+)
```

---

## 三、完整代码示例

### v1：代码风格与基础规范

```python
"""
v1: Code style and basic conventions
Following PEP 8 and modern Python patterns
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

# ============================================================
# 1. Naming conventions
# ============================================================
# Variables and functions: snake_case
user_name = "Alice"
total_count = 42

def calculate_total(prices: list[float]) -> float:
    return sum(prices)

# Constants: UPPER_SNAKE_CASE
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30

# Classes: PascalCase
class UserRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

# ============================================================
# 2. Use dataclass instead of boilerplate __init__
# ============================================================
@dataclass(frozen=True)  # frozen=True for immutability
class User:
    """Represents a user in the system."""
    id: int
    name: str
    email: str
    active: bool = True

    def display_name(self) -> str:
        return f"{self.name} <{self.email}>"

# ============================================================
# 3. Use pathlib instead of os.path
# ============================================================
def find_python_files(directory: str) -> list[Path]:
    """Find all Python files in a directory recursively."""
    base = Path(directory)
    if not base.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")
    return sorted(base.rglob("*.py"))

# ============================================================
# 4. Use generators for large datasets
# ============================================================
def read_large_file(path: Path) -> Iterator[str]:
    """Yield lines from a large file without loading it all."""
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            yield line.strip()

def count_words(lines: Iterator[str]) -> dict[str, int]:
    """Count word frequencies from an iterator of lines."""
    freq: dict[str, int] = {}
    for line in lines:
        for word in line.split():
            freq[word] = freq.get(word, 0) + 1
    return freq

# ============================================================
# 5. Context managers for resource management
# ============================================================
class Timer:
    """A simple context manager to measure execution time."""

    def __init__(self, label: str = "Operation"):
        self.label = label

    def __enter__(self) -> "Timer":
        import time
        self.start = time.monotonic()
        return self

    def __exit__(self, *args) -> None:
        import time
        elapsed = time.monotonic() - self.start
        print(f"{self.label}: {elapsed:.4f}s")

if __name__ == "__main__":
    users = [
        User(1, "Alice", "alice@example.com"),
        User(2, "Bob", "bob@example.com", active=False),
    ]
    for u in users:
        print(u.display_name())

    with Timer("List comprehension"):
        squares = [x**2 for x in range(1_000_000)]
```

### v2：错误处理与测试

```python
"""
v2: Error handling and testing patterns
Robust error handling with custom exceptions
"""
from dataclasses import dataclass
from typing import Optional
import json
from pathlib import Path

# ============================================================
# 1. Custom exception hierarchy
# ============================================================
class AppError(Exception):
    """Base exception for the application."""
    pass

class ValidationError(AppError):
    """Raised when input validation fails."""
    pass

class NotFoundError(AppError):
    """Raised when a resource is not found."""
    pass

class DatabaseError(AppError):
    """Raised when a database operation fails."""
    pass

# ============================================================
# 2. Result pattern (alternative to exceptions for expected cases)
# ============================================================
@dataclass
class Result[T]:
    """A simple Result type for success/error handling."""
    value: Optional[T] = None
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.error is None

    def unwrap(self) -> T:
        if self.error is not None:
            raise AppError(self.error)
        return self.value  # type: ignore

def parse_user(data: str) -> Result[dict]:
    """Parse a JSON string into user data."""
    try:
        user = json.loads(data)
    except json.JSONDecodeError as e:
        return Result(error=f"Invalid JSON: {e}")

    if "name" not in user:
        return Result(error="Missing required field: name")
    if "email" not in user:
        return Result(error="Missing required field: email")

    return Result(value=user)

# ============================================================
# 3. EAFP style (Pythonic error handling)
# ============================================================
def get_config_value(config: dict, key: str, default: str = "") -> str:
    """Get config value using EAFP style."""
    try:
        return config[key]
    except KeyError:
        return default

# ============================================================
# 4. Proper resource cleanup
# ============================================================
class DataFile:
    """Context manager for safe file operations."""

    def __init__(self, path: str, mode: str = "r") -> None:
        self.path = Path(path)
        self.mode = mode
        self._file = None

    def __enter__(self) -> "DataFile":
        try:
            self._file = self.path.open(self.mode, encoding="utf-8")
        except FileNotFoundError:
            raise NotFoundError(f"File not found: {self.path}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._file:
            self._file.close()

    def read_lines(self) -> list[str]:
        if self._file is None:
            raise DatabaseError("File not opened")
        return [line.strip() for line in self._file]

if __name__ == "__main__":
    # Result pattern
    good = parse_user('{"name": "Alice", "email": "a@b.com"}')
    print(f"OK: {good.ok}, value: {good.value}")

    bad = parse_user("not json")
    print(f"OK: {bad.ok}, error: {bad.error}")

    # EAFP
    config = {"host": "localhost", "port": "8080"}
    print(get_config_value(config, "host"))       # localhost
    print(get_config_value(config, "debug", "false"))  # false
```

```python
# test_app.py - pytest tests for v2 code
"""Tests demonstrating testing best practices."""
import pytest
from v2_error_handling import parse_user, Result, get_config_value

class TestParseUser:
    """Tests for the parse_user function."""

    def test_valid_json(self):
        result = parse_user('{"name": "Alice", "email": "a@b.com"}')
        assert result.ok
        assert result.value["name"] == "Alice"

    def test_invalid_json(self):
        result = parse_user("not json")
        assert not result.ok
        assert "Invalid JSON" in result.error

    def test_missing_name(self):
        result = parse_user('{"email": "a@b.com"}')
        assert not result.ok
        assert "name" in result.error

    def test_missing_email(self):
        result = parse_user('{"name": "Alice"}')
        assert not result.ok
        assert "email" in result.error

class TestGetConfigValue:
    """Tests for the get_config_value function."""

    def test_existing_key(self):
        assert get_config_value({"a": "1"}, "a") == "1"

    def test_missing_key_with_default(self):
        assert get_config_value({}, "x", "default") == "default"

    def test_missing_key_no_default(self):
        assert get_config_value({}, "x") == ""
```

### v3：生产级项目结构

```
v3: Production-grade project structure and tooling

Project layout:
myproject/
├── pyproject.toml
├── README.md
├── .github/workflows/ci.yml
├── src/
│   └── myproject/
│       ├── __init__.py
│       ├── config.py
│       ├── models.py
│       ├── services.py
│       └── main.py
└── tests/
    ├── conftest.py
    ├── test_models.py
    └── test_services.py
```

```toml
# pyproject.toml
[project]
name = "myproject"
version = "1.0.0"
requires-python = ">=3.10"
dependencies = ["pydantic>=2.0"]

[project.optional-dependencies]
dev = ["pytest>=7.4", "ruff>=0.1", "mypy>=1.7", "pre-commit>=3.0"]

[tool.ruff]
line-length = 88
select = ["E", "F", "I", "N", "UP", "B"]

[tool.ruff.format]
quote-style = "double"

[tool.mypy]
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
```

```python
# src/myproject/config.py
"""Application configuration with validation."""
from dataclasses import dataclass
import os

@dataclass(frozen=True)
class Config:
    """Immutable application configuration."""
    debug: bool = False
    database_url: str = "sqlite:///app.db"
    log_level: str = "INFO"
    port: int = 8000

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            debug=os.getenv("DEBUG", "false").lower() == "true",
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            log_level=os.getenv("LOG_LEVEL", cls.log_level),
            port=int(os.getenv("PORT", str(cls.port))),
        )
```

```python
# src/myproject/services.py
"""Business logic layer with proper dependency injection."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol

class UserStore(Protocol):
    """Protocol for user storage backends."""
    def get(self, user_id: int) -> User | None: ...
    def save(self, user: User) -> None: ...

@dataclass(frozen=True)
class User:
    id: int
    name: str
    email: str

class UserService:
    """Service with dependency injection via Protocol."""

    def __init__(self, store: UserStore) -> None:
        self._store = store

    def get_user(self, user_id: int) -> User:
        user = self._store.get(user_id)
        if user is None:
            raise ValueError(f"User {user_id} not found")
        return user

    def create_user(self, name: str, email: str) -> User:
        user_id = hash(email) & 0xFFFFFFFF  # Simplified ID generation
        user = User(id=user_id, name=name, email=email)
        self._store.save(user)
        return user
```

---

## 四、执行预览

### pytest 运行结果

```bash
$ pytest tests/ -v
tests/test_app.py::TestParseUser::test_valid_json PASSED
tests/test_app.py::TestParseUser::test_invalid_json PASSED
tests/test_app.py::TestParseUser::test_missing_name PASSED
tests/test_app.py::TestParseUser::test_missing_email PASSED
tests/test_app.py::TestGetConfigValue::test_existing_key PASSED
tests/test_app.py::TestGetConfigValue::test_missing_key_with_default PASSED
tests/test_app.py::TestGetConfigValue::test_missing_key_no_default PASSED
===== 7 passed in 0.03s =====
```

### ruff 检查

```bash
$ ruff check src/
0 errors, 0 warnings

$ ruff format --check src/
3 files already formatted
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| PEP 8 不是教条 | 有些规则可以灵活处理 | 用 Black/Ruff 自动格式化 |
| 过度优化 | 不要过早优化 | 先正确，再高效 |
| 测试覆盖率 | 100% 覆盖不一定好 | 核心逻辑覆盖即可 |
| 类型注解成本 | 维护注解需要时间 | 渐进式添加 |
| 依赖膨胀 | 谨慎添加第三方依赖 | 能用标准库就用标准库 |
| 文档字符串 | 不是每个函数都需要 | 公共 API 必须有 |

---

## 六、避坑指南

### ❌ 坑 1：裸 except 捕获所有异常

```python
# ❌ Catches everything including KeyboardInterrupt
try:
    do_something()
except:
    pass

# ✅ Catch specific exceptions
try:
    do_something()
except (ValueError, TypeError) as e:
    logger.error(f"Failed: {e}")
```

### ❌ 坑 2：可变默认参数

```python
# ❌ Default list is shared across calls!
def append_to(item, target=[]):
    target.append(item)
    return target

# ✅ Use None as default
def append_to(item, target=None):
    if target is None:
        target = []
    target.append(item)
    return target
```

### ❌ 坑 3：用 == 判断 None

```python
# ❌ Can be fooled by __eq__ override
if value == None:
    ...

# ✅ Use is for None checks
if value is None:
    ...
```

### ❌ 坑 4：忽略 with 语句

```python
# ❌ File might not be closed if exception occurs
f = open("data.txt")
content = f.read()
f.close()

# ✅ Always use with
with open("data.txt") as f:
    content = f.read()
```

---

## 七、练习题

### 🟢 入门：代码规范改造

将以下代码改写为符合最佳实践的版本：

```python
def process_data(d):
    r=[]
    for i in d:
        if type(i)==int and i>0:
            r.append(i*2)
    return r
```

要求：类型注解、列表推导式、命名规范。

### 🟡 进阶：完整项目结构

1. 创建 `src/mypackage/` 结构
2. 配置 `pyproject.toml`（ruff + mypy + pytest）
3. 编写 dataclass 模型 + Protocol 接口
4. 编写 pytest 测试

### 🔴 挑战：CI/CD 流水线

1. 配置 GitHub Actions（ruff + mypy + pytest）
2. 添加 pre-commit hooks
3. 实现自动化版本号管理
4. 配置 coverage 报告

---

## 八、知识点总结（树状）

```
Python 最佳实践
├── 代码风格
│   ├── PEP 8
│   ├── 命名：snake_case / PascalCase / UPPER
│   ├── Black/Ruff 自动格式化
│   └── isort 导入排序
├── 项目结构
│   ├── src layout（推荐）
│   ├── pyproject.toml 统一配置
│   └── README + CHANGELOG
├── 代码质量工具链
│   ├── Ruff (lint + format)
│   ├── mypy (类型检查)
│   ├── pytest (测试)
│   └── pre-commit (Git hooks)
├── Pythonic 模式
│   ├── EAFP > LBYL
│   ├── 生成器/迭代器
│   ├── 上下文管理器
│   ├── dataclass
│   └── pathlib > os.path
├── 错误处理
│   ├── 具体异常类型
│   ├── 自定义异常层次
│   ├── Result 模式
│   └── 资源管理 (with)
└── 性能意识
    ├── 算法复杂度优先
    ├── functools.lru_cache
    ├── 生成器避免大列表
    └── cProfile 定位瓶颈
```

---

## 九、举一反三

| 场景 | 推荐实践 | 关键工具 |
|------|----------|----------|
| 个人脚本 | 类型注解 + pathlib + f-string | mypy |
| 团队项目 | src layout + ruff + pytest + CI | GitHub Actions |
| 开源库 | pyproject.toml + 完整文档 + typing | Sphinx + CI |
| 数据处理 | dataclass + 生成器 + 类型注解 | pandas/polars |
| Web 服务 | Protocol + 分层架构 + 测试 | FastAPI + pytest |
| CLI 工具 | click/typer + Rich + 打包 | PyPI 发布 |

---

## 十、参考资料

- 📖 [PEP 8 - Style Guide](https://peps.python.org/pep-0008/)
- 📖 [The Hitchhiker's Guide to Python](https://docs.python-guide.org/)
- 📖 [Real Python - Best Practices](https://realpython.com/tutorials/best-practices/)
- 🔧 [Ruff](https://docs.astral.sh/ruff/) - 极速 Python linter + formatter
- 🔧 [Black](https://github.com/psf/black) - 代码格式化工具
- 🔧 [pre-commit](https://pre-commit.com/) - Git hooks 管理
- 📖 [Structuring Your Project](https://docs.python-guide.org/writing/structure/)

---

## 十一、代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 代码规范 | 命名、dataclass、pathlib、生成器 | 所有 Python 项目的基础 |
| v2 错误处理与测试 | 自定义异常、Result 模式、pytest | 中大型项目 |
| v3 生产级结构 | src layout、Protocol、pyproject.toml、CI | 生产环境项目 |

**演进路径：** `代码规范 → 错误处理/测试 → 项目结构/CI → 持续改进`

> 💡 **一句话总结：** 好的代码不是一次写成的，而是通过规范、工具和持续改进打磨出来的。先让它工作，再让它正确，最后让它快。
