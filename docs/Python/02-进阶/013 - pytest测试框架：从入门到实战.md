---
title: "013 - pytest测试框架：从入门到实战"
slug: "013-testing-pytest"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.42+08:00"
updated_at: "2026-04-29T10:02:47.605+08:00"
reading_time: 39
tags: []
---

---
difficulty: ⭐⭐⭐中级
tags: [Python, pytest, 测试, 单元测试]
---

# pytest测试框架：从入门到实战

> **难度标注：⭐⭐⭐ 中级** | 适合有Python基础，想系统学习测试的开发者

## 一、概念讲解

### 什么是 pytest？

pytest 是 Python 生态中最流行的测试框架，相比 unittest，它更简洁、更强大、插件生态更丰富。

**核心优势：**
- **零样板代码**：不需要继承任何基类，普通函数即可作为测试
- **强大的断言**：用原生 `assert`，失败信息自动生成详细对比
- **fixture 机制**：灵活的测试准备和清理机制
- **插件生态**：800+ 插件覆盖各种场景
- **参数化测试**：一行代码实现多组数据测试

### pytest vs unittest

| 特性 | pytest | unittest |
|------|--------|----------|
| 断言方式 | `assert x == 1` | `self.assertEqual(x, 1)` |
| 测试发现 | 自动发现 `test_*.py` | 需要配置或手动加载 |
| fixture | 灵活，支持依赖注入 | `setUp/tearDown` |
| 参数化 | `@pytest.mark.parametrize` | 需要 `subTest` |
| 插件数 | 800+ | 较少 |
| 学习曲线 | 低 | 中 |

## 二、脑图

```
pytest 测试框架
├── 基础
│   ├── 安装：pip install pytest
│   ├── 测试文件命名：test_*.py / *_test.py
│   ├── 测试函数命名：test_*
│   └── 运行：pytest / pytest -v / pytest -k "pattern"
├── 断言
│   ├── assert 语句
│   ├── pytest.approx()（浮点比较）
│   └── 异常断言：pytest.raises()
├── Fixture
│   ├── @pytest.fixture 定义
│   ├── 作用域：function / class / module / session
│   ├── conftest.py 共享
│   ├── yield 清理
│   └── 参数化 fixture
├── 参数化
│   ├── @pytest.mark.parametrize
│   ├── 多参数组合
│   └── indirect 参数化
├── 标记
│   ├── @pytest.mark.skip / skipif
│   ├── @pytest.mark.xfail
│   ├── @pytest.mark.slow（自定义）
│   └── -m 选择性运行
├── 插件
│   ├── pytest-cov（覆盖率）
│   ├── pytest-mock（mock 支持）
│   ├── pytest-asyncio（异步测试）
│   └── pytest-xdist（并行执行）
└── 高级
    ├── conftest.py 层级
    ├── hook 函数
    └── 自定义插件
```

## 三、完整代码示例

### 项目结构

```
calculator/
├── calc.py              # 被测代码
├── tests/
│   ├── conftest.py      # 共享 fixture
│   ├── test_calc.py     # 基础测试
│   ├── test_advanced.py # 高级测试
│   └── test_params.py   # 参数化测试
└── pytest.ini           # 配置
```

### calc.py -- 被测模块

```python
"""A simple calculator module to demonstrate pytest."""


class Calculator:
    """Basic calculator with history tracking."""

    def __init__(self):
        self.history: list[float] = []

    def add(self, a: float, b: float) -> float:
        """Add two numbers."""
        result = a + b
        self.history.append(result)
        return result

    def subtract(self, a: float, b: float) -> float:
        """Subtract b from a."""
        result = a - b
        self.history.append(result)
        return result

    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers."""
        result = a * b
        self.history.append(result)
        return result

    def divide(self, a: float, b: float) -> float:
        """Divide a by b. Raises ZeroDivisionError if b is 0."""
        if b == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        result = a / b
        self.history.append(result)
        return result

    def clear_history(self) -> None:
        """Clear calculation history."""
        self.history.clear()

    def get_last(self) -> float | None:
        """Get the last calculation result."""
        return self.history[-1] if self.history else None
```

### conftest.py -- 共享 Fixture

```python
"""Shared fixtures for calculator tests."""
import pytest
from calc import Calculator


@pytest.fixture
def calc():
    """Provide a fresh Calculator instance for each test."""
    return Calculator()


@pytest.fixture
def calc_with_history(calc):
    """Provide a Calculator with some pre-loaded history."""
    calc.add(1, 2)
    calc.add(3, 4)
    return calc


@pytest.fixture(scope="session")
def db_connection():
    """Simulate a database connection (session-scoped)."""
    print("\n[Setup] Connecting to database...")
    conn = {"connected": True, "data": {}}
    yield conn
    print("\n[Teardown] Closing database connection...")
    conn["connected"] = False
```

### test_calc.py -- 基础测试

```python
"""Basic tests for Calculator class."""
import pytest
from calc import Calculator


def test_add(calc):
    """Test addition."""
    assert calc.add(2, 3) == 5
    assert calc.add(-1, 1) == 0
    assert calc.add(0.1, 0.2) == pytest.approx(0.3)


def test_subtract(calc):
    """Test subtraction."""
    assert calc.subtract(5, 3) == 2
    assert calc.subtract(0, 5) == -5


def test_multiply(calc):
    """Test multiplication."""
    assert calc.multiply(3, 4) == 12
    assert calc.multiply(-2, 3) == -6
    assert calc.multiply(0, 100) == 0


def test_divide(calc):
    """Test division."""
    assert calc.divide(10, 2) == 5
    assert calc.divide(7, 2) == pytest.approx(3.5)


def test_divide_by_zero(calc):
    """Test that dividing by zero raises an exception."""
    with pytest.raises(ZeroDivisionError, match="Cannot divide by zero"):
        calc.divide(10, 0)


def test_history(calc):
    """Test calculation history."""
    calc.add(1, 2)
    calc.add(3, 4)
    assert len(calc.history) == 2
    assert calc.get_last() == 7


def test_clear_history(calc_with_history):
    """Test clearing history."""
    assert len(calc_with_history.history) == 2
    calc_with_history.clear_history()
    assert len(calc_with_history.history) == 0


def test_get_last_empty(calc):
    """Test get_last on empty history returns None."""
    assert calc.get_last() is None
```

### test_params.py -- 参数化测试

```python
"""Parameterized tests for Calculator."""
import pytest
from calc import Calculator


@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3),
    (0, 0, 0),
    (-1, -2, -3),
    (100, 200, 300),
    (0.1, 0.2, pytest.approx(0.3)),
])
def test_add_parameterized(calc, a, b, expected):
    """Test addition with multiple data sets."""
    assert calc.add(a, b) == expected


@pytest.mark.parametrize("a, b, expected", [
    (10, 2, 5),
    (9, 3, 3),
    (-6, 2, -3),
    (0, 1, 0),
])
def test_divide_parameterized(calc, a, b, expected):
    """Test division with multiple data sets."""
    assert calc.divide(a, b) == expected


# Combine multiple parametrize decorators (Cartesian product)
@pytest.mark.parametrize("x", [1, 2])
@pytest.mark.parametrize("y", [10, 20])
def test_multiply_combo(calc, x, y):
    """Test multiply with all x,y combinations."""
    assert calc.multiply(x, y) == x * y


# Use pytest.param to customize test IDs and marks
@pytest.mark.parametrize("a, b, expected", [
    pytest.param(1, 1, 2, id="one-plus-one"),
    pytest.param(2, 3, 5, id="small-numbers"),
    pytest.param(1000, 2000, 3000, id="large-numbers"),
    pytest.param(-5, 5, 0, id="cancel-out"),
])
def test_add_with_ids(calc, a, b, expected):
    """Test addition with descriptive test IDs."""
    assert calc.add(a, b) == expected


# Fixture parametrization
@pytest.fixture(params=[
    (2, 3, 6),
    (4, 5, 20),
    (0, 99, 0),
])
def multiply_case(request):
    """Parametrized fixture providing multiply test cases."""
    return request.param


def test_multiply_with_fixture_param(calc, multiply_case):
    """Test multiply using parametrized fixture."""
    a, b, expected = multiply_case
    assert calc.multiply(a, b) == expected
```

### test_advanced.py -- 高级特性

```python
"""Advanced pytest features demo."""
import sys
import pytest
from calc import Calculator


@pytest.mark.slow
class TestAdvancedCalculator:
    """Tests marked as slow (can filter with -m)."""

    def test_many_operations(self, calc):
        """Run many operations in sequence."""
        for i in range(100):
            calc.add(i, i + 1)
        assert len(calc.history) == 100

    def test_mixed_operations(self, calc):
        """Test mixing different operations."""
        calc.add(10, 5)
        calc.subtract(20, 8)
        calc.multiply(3, 7)
        assert len(calc.history) == 3
        assert calc.get_last() == 21


# Skip tests based on conditions
@pytest.mark.skip(reason="Not implemented yet")
def test_future_feature(calc):
    """This test is skipped."""
    assert False


@pytest.mark.skipif(sys.platform == "win32", reason="Unix-specific test")
def test_unix_only(calc):
    """Only runs on Unix systems."""
    pass


# Expected failures
@pytest.mark.xfail(reason="Known bug: float precision issue")
def test_float_precision(calc):
    """This test is expected to fail."""
    assert calc.add(0.1, 0.2) == 0.3  # Will fail due to float precision


# Custom markers (register in pytest.ini)
@pytest.mark.integration
def test_database_integration(db_connection):
    """Test with database connection (session-scoped fixture)."""
    assert db_connection["connected"] is True
    db_connection["data"]["key"] = "value"
    assert db_connection["data"]["key"] == "value"
```

### pytest.ini -- 配置文件

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks integration tests
addopts = -v --tb=short
```

## 四、执行预览

```bash
$ pytest -v
===================== test session starts =====================
collected 25 items

tests/test_calc.py::test_add PASSED                        [  4%]
tests/test_calc.py::test_subtract PASSED                   [  8%]
tests/test_calc.py::test_multiply PASSED                   [ 12%]
tests/test_calc.py::test_divide PASSED                     [ 16%]
tests/test_calc.py::test_divide_by_zero PASSED             [ 20%]
tests/test_calc.py::test_history PASSED                    [ 24%]
tests/test_calc.py::test_clear_history PASSED              [ 28%]
tests/test_calc.py::test_get_last_empty PASSED             [ 32%]
tests/test_params.py::test_add_parameterized[1-2-3] PASSED [ 36%]
tests/test_params.py::test_add_parameterized[0-0-0] PASSED [ 40%]
tests/test_params.py::test_add_parameterized[-1--2--3] PASSED [ 44%]
tests/test_params.py::test_add_parameterized[100-200-300] PASSED [ 48%]
tests/test_params.py::test_add_parameterized[0.1-0.2-0.3] PASSED [ 52%]
tests/test_params.py::test_divide_parameterized[10-2-5] PASSED [ 56%]
...
tests/test_advanced.py::test_float_precision XFAIL         [ 96%]
tests/test_advanced.py::test_future_feature SKIPPED        [100%]

================= 23 passed, 1 xfailed, 1 skipped =================
```

```bash
# Run only fast tests
$ pytest -m "not slow"

# Run with keyword filter
$ pytest -k "add"

# Run with coverage
$ pytest --cov=calc --cov-report=term-missing

# Run in parallel (needs pytest-xdist)
$ pytest -n auto
```

## 五、注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| 浮点比较 | `0.1 + 0.2 != 0.3` | 使用 `pytest.approx()` |
| fixture 作用域 | `session` 级别共享状态 | 注意测试隔离性 |
| conftest 层级 | 子目录的 conftest 覆盖父级 | 合理组织目录结构 |
| 参数化 ID | 默认 ID 不直观 | 用 `pytest.param(id=...)` |
| 异步测试 | 普通 pytest 不支持 async | 安装 `pytest-asyncio` |
| import 路径 | 测试文件 import 路径问题 | 用 `pyproject.toml` 配置包 |
| 测试顺序 | pytest 不保证执行顺序 | 不要让测试之间有依赖 |
| 临时文件 | 测试中需要临时目录 | 使用 `tmp_path` fixture |

## 六、避坑指南

### 手动拼接断言消息 vs 用原生 assert

```python
# Bad: unittest 风格
self.assertEqual(result, expected, f"Expected {expected}, got {result}")

# Good: pytest 原生 assert，自动生成详细对比
assert result == expected
```

### fixture 不控制作用域 vs 合理选择 scope

```python
# Bad: 所有 fixture 都是 function scope，重复创建
@pytest.fixture
def db():
    return create_connection()  # 每个测试都创建

# Good: 合理使用 session/module scope
@pytest.fixture(scope="module")
def db():
    conn = create_connection()
    yield conn
    conn.close()
```

### 测试之间共享状态 vs 保持测试隔离

```python
# Bad: 测试修改全局状态
shared_list = []

def test_1():
    shared_list.append(1)

def test_2():
    assert len(shared_list) == 1  # 依赖 test_1 的执行顺序

# Good: 每个 test 用独立 fixture
def test_1(calc):
    calc.add(1, 2)
    assert len(calc.history) == 1

def test_2(calc):  # calc 是全新的实例
    assert len(calc.history) == 0
```

### 不处理异常断言 vs 用 pytest.raises

```python
# Bad: 手动 try/except
def test_divide_by_zero():
    try:
        calc.divide(10, 0)
        assert False, "Should have raised"
    except ZeroDivisionError:
        pass

# Good: pytest.raises
def test_divide_by_zero(calc):
    with pytest.raises(ZeroDivisionError, match="Cannot divide"):
        calc.divide(10, 0)
```

### 硬编码测试数据 vs 参数化

```python
# Bad: 重复的测试代码
def test_add_1():
    assert add(1, 2) == 3

def test_add_2():
    assert add(0, 0) == 0

def test_add_3():
    assert add(-1, 1) == 0

# Good: 参数化
@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3), (0, 0, 0), (-1, 1, 0),
])
def test_add(calc, a, b, expected):
    assert calc.add(a, b) == expected
```

## 七、练习题

### 基础题

1. **编写第一个测试**：为以下函数编写 pytest 测试，要求覆盖正常和边界情况。

```python
def is_palindrome(s: str) -> bool:
    return s == s[::-1]
```

2. **fixture 练习**：创建一个 fixture，提供临时 CSV 文件，写入测试数据，测试结束后自动清理。

3. **异常测试**：编写测试验证 `int("abc")` 会抛出 `ValueError`。

### 进阶题

4. **参数化测试**：为字符串反转函数编写参数化测试，至少包含 5 组数据（空字符串、单字符、偶数长度、奇数长度、含空格）。

5. **conftest 层级**：在 `tests/` 和 `tests/unit/` 各放一个 `conftest.py`，验证 fixture 的覆盖和合并规则。

6. **自定义标记**：创建 `@pytest.mark.smoke` 标记，选择 5 个关键测试标记为 smoke，用 `pytest -m smoke` 运行。

### 挑战题

7. **端到端测试套件**：为一个 TODO 应用（支持增删改查 + 持久化到 JSON）编写完整的测试套件，包括：
   - fixture 管理临时文件
   - 参数化测试
   - 边界情况和异常测试
   - 至少 15 个测试用例

8. **自定义 pytest 插件**：编写一个 pytest 插件，在测试开始前打印当前时间，测试结束后打印耗时，并生成简易 HTML 报告。

## 八、知识点总结

```
pytest 知识树
├── 1. 安装与运行
│   ├── pip install pytest
│   ├── pytest (运行全部)
│   ├── pytest -v (详细输出)
│   ├── pytest -k "pattern" (关键字过滤)
│   ├── pytest -m "marker" (标记过滤)
│   └── pytest --cov (覆盖率)
├── 2. 测试编写
│   ├── 函数式：def test_xxx()
│   ├── 类式：class TestXXX
│   ├── assert 语句
│   ├── pytest.raises() (异常)
│   └── pytest.approx() (浮点)
├── 3. Fixture 机制
│   ├── @pytest.fixture
│   ├── scope: function/class/module/session
│   ├── yield (清理)
│   ├── conftest.py (共享)
│   ├── autouse=True (自动)
│   └── params (参数化)
├── 4. 参数化
│   ├── @pytest.mark.parametrize
│   ├── pytest.param(id=, marks=)
│   ├── indirect 参数化
│   └── 笛卡尔积组合
├── 5. 标记系统
│   ├── skip / skipif
│   ├── xfail
│   ├── 自定义标记
│   └── -m 选择运行
└── 6. 插件生态
    ├── pytest-cov (覆盖率)
    ├── pytest-xdist (并行)
    ├── pytest-mock (Mock)
    ├── pytest-asyncio (异步)
    └── pytest-html (报告)
```

## 九、举一反三

| 你学到的 | 可以应用到 | 示例 |
|----------|-----------|------|
| fixture 依赖注入 | 任何需要测试准备的场景 | 数据库连接、API 客户端、Mock 对象 |
| 参数化测试 | API 接口的边界值测试 | 各种 HTTP 状态码、参数组合 |
| conftest 层级 | 多环境测试配置 | dev/staging/prod 不同配置 |
| mark 标记 | CI/CD 流水线分组运行 | smoke 快速验证，regression 完整回归 |
| tmp_path fixture | 文件操作相关测试 | 日志处理、文件上传、CSV 解析 |
| pytest.raises | 防御性编程验证 | 输入校验、权限检查、状态异常 |
| 自定义插件 | 团队测试规范 | 强制代码风格、自动生成文档 |

## 十、参考资料

- [pytest 官方文档](https://docs.pytest.org/)
- [pytest 优质插件列表](https://docs.pytest.org/en/latest/reference/plugin_list.html)
- [Effective Python Testing with pytest -- Real Python](https://realpython.com/pytest-python-testing/)
- [pytest Cookbook -- O'Reilly](https://www.oreilly.com/library/view/pytest-cookbook/)
- 《Python Testing with pytest》-- Brian Okken

## 十一、代码演进

### v1 -- 最简单的测试

```python
# test_calc_v1.py -- No framework, just assert
from calc import Calculator

def test_add():
    calc = Calculator()
    assert calc.add(1, 2) == 3
    print("test_add passed")

def test_divide_by_zero():
    calc = Calculator()
    try:
        calc.divide(10, 0)
        assert False
    except ZeroDivisionError:
        print("test_divide_by_zero passed")

if __name__ == "__main__":
    test_add()
    test_divide_by_zero()
```

**问题**：无自动发现、无详细报告、手动运行。

### v2 -- 基础 pytest

```python
# test_calc_v2.py -- Basic pytest
import pytest
from calc import Calculator

def test_add():
    calc = Calculator()
    assert calc.add(1, 2) == 3

def test_divide_by_zero():
    calc = Calculator()
    with pytest.raises(ZeroDivisionError):
        calc.divide(10, 0)
```

**改进**：自动发现、详细断言、异常断言。**问题**：重复创建 Calculator、无参数化。

### v3 -- 完整 pytest 套件

```python
# test_calc_v3.py -- Full pytest with fixture, parametrize, conftest
import pytest

@pytest.fixture
def calc():
    return Calculator()

@pytest.mark.parametrize("a, b, expected", [
    (1, 2, 3), (0, 0, 0), (-1, 1, 0),
])
def test_add(calc, a, b, expected):
    assert calc.add(a, b) == expected

def test_divide_by_zero(calc):
    with pytest.raises(ZeroDivisionError, match="Cannot divide"):
        calc.divide(10, 0)
```

**最终形态**：fixture 复用、参数化、清晰断言、可维护。
