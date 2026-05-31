---
title: "014 - Mock与测试替身：隔离测试的艺术"
slug: "014-mocking"
category: "Python进阶"
tech_stack: "其他"
created_at: "2026-04-29T06:16:59.425+08:00"
updated_at: "2026-04-29T10:02:47.614+08:00"
reading_time: 54
tags: []
---

---
difficulty: ⭐⭐⭐中级
tags: [Python, Mock, 测试替身, unittest.mock]
---

# Mock与测试替身：隔离测试的艺术

> **难度标注：⭐⭐⭐ 中级** | 适合已掌握 pytest 基础，想学习隔离测试的开发者

## 一、概念讲解

### 为什么需要 Mock？

在真实项目中，代码往往依赖外部系统：数据库、API、文件系统、第三方服务。直接测试这些依赖会导致：
- **测试慢**：网络请求、数据库查询耗时
- **不稳定**：外部服务不可用时测试失败
- **难控制**：无法模拟异常、超时等场景
- **副作用**：测试数据污染真实环境

**测试替身（Test Double）** 就是解决这些问题的手段。

### 测试替身的五种类型

| 类型 | 英文 | 用途 | 类比 |
|------|------|------|------|
| 哑对象 | Dummy | 只为填充参数，不被使用 | 群演，不出镜 |
| 桩 | Stub | 返回预设的固定值 | 备考答案 |
| 间谍 | Spy | 记录调用信息，也执行真实逻辑 | 卧底 |
| 模拟 | Mock | 验证交互行为（是否被调用、参数是否正确） | 审计员 |
| 伪造 | Fake | 有可工作的简化实现（如内存数据库） | 样板间 |

### Python 的 Mock 工具

```python
# 标准库
from unittest.mock import Mock, MagicMock, patch, call

# pytest-mock 插件（推荐）
# pip install pytest-mock
# 提供 mocker fixture
```

## 二、脑图

```
Mock 与测试替身
├── 核心概念
│   ├── 五种替身：Dummy / Stub / Spy / Mock / Fake
│   ├── 为什么 Mock：隔离、速度、可控性
│   └── Mock vs Stub vs Fake 区别
├── unittest.mock
│   ├── Mock -- 可配置的模拟对象
│   ├── MagicMock -- 带魔术方法的 Mock
│   ├── patch -- 替换目标对象
│   ├── call -- 验证调用参数
│   └── PropertyMock -- 模拟属性
├── patch 三种用法
│   ├── 装饰器：@patch('module.target')
│   ├── 上下文管理器：with patch(...)
│   └── 手动 start/stop
├── 验证技巧
│   ├── called / call_count
│   ├── called_with / any_order
│   ├── assert_not_called()
│   ├── return_value / side_effect
│   └── 检查调用参数
├── pytest-mock
│   ├── mocker.patch()
│   ├── mocker.spy()
│   ├── mocker.stub()
│   └── 自动清理
├── 常见场景
│   ├── Mock HTTP 请求
│   ├── Mock 数据库
│   ├── Mock 时间
│   ├── Mock 文件操作
│   └── Mock 第三方 SDK
└── 最佳实践
    ├── Mock 接口不实现
    ├── Patch where it's used
    ├── 避免过度 Mock
    └── Mock 与集成测试互补
```

## 三、完整代码示例

### 被测代码 -- user_service.py

```python
"""User service module - the code we want to test."""
import requests
from typing import Optional


class EmailSender:
    """Send emails to users."""

    def send(self, to: str, subject: str, body: str) -> bool:
        """Send an email. Returns True on success."""
        resp = requests.post(
            "https://api.email-service.com/send",
            json={"to": to, "subject": subject, "body": body},
        )
        return resp.status_code == 200


class UserRepository:
    """Database operations for users."""

    def __init__(self, db_connection):
        self.db = db_connection

    def find_by_id(self, user_id: int) -> Optional[dict]:
        """Find a user by ID."""
        return self.db.query("SELECT * FROM users WHERE id = ?", (user_id,))

    def save(self, user: dict) -> dict:
        """Save a user to the database."""
        self.db.execute(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            (user["name"], user["email"]),
        )
        return user


class UserService:
    """Business logic for user operations."""

    def __init__(self, repo: UserRepository, email_sender: EmailSender):
        self.repo = repo
        self.email = email_sender

    def get_user(self, user_id: int) -> Optional[dict]:
        """Get a user by ID."""
        user = self.repo.find_by_id(user_id)
        if user is None:
            raise ValueError(f"User {user_id} not found")
        return user

    def create_user(self, name: str, email: str) -> dict:
        """Create a new user and send welcome email."""
        if not name or not email:
            raise ValueError("Name and email are required")

        user = {"name": name, "email": email}
        saved = self.repo.save(user)

        # Send welcome email (external dependency - must mock!)
        success = self.email.send(
            to=email,
            subject="Welcome!",
            body=f"Hello {name}, welcome aboard!",
        )
        if not success:
            print(f"Warning: welcome email failed for {email}")

        return saved

    def notify_user(self, user_id: int, message: str) -> bool:
        """Send a notification to a user."""
        user = self.get_user(user_id)
        return self.email.send(
            to=user["email"],
            subject="Notification",
            body=message,
        )
```

### 测试文件 -- test_user_service.py

```python
"""Tests for UserService using mock objects."""
import pytest
from unittest.mock import Mock, MagicMock, patch, call, PropertyMock
from user_service import UserService, UserRepository, EmailSender


# ============================================================
# 1. Basic Mock - creating mock objects
# ============================================================

class TestBasicMock:
    """Demonstrate basic Mock usage."""

    def test_mock_return_value(self):
        """Mock can return preset values."""
        mock_repo = Mock()
        mock_repo.find_by_id.return_value = {
            "id": 1, "name": "Alice", "email": "alice@test.com"
        }

        result = mock_repo.find_by_id(1)
        assert result["name"] == "Alice"
        mock_repo.find_by_id.assert_called_once_with(1)

    def test_mock_raise_exception(self):
        """Mock can simulate exceptions."""
        mock_repo = Mock()
        mock_repo.find_by_id.side_effect = ValueError("Not found")

        with pytest.raises(ValueError, match="Not found"):
            mock_repo.find_by_id(999)

    def test_mock_multiple_returns(self):
        """Mock can return different values on successive calls."""
        mock_repo = Mock()
        mock_repo.find_by_id.side_effect = [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"},
            None,  # Third call returns None
        ]

        assert mock_repo.find_by_id(1)["name"] == "Alice"
        assert mock_repo.find_by_id(2)["name"] == "Bob"
        assert mock_repo.find_by_id(3) is None

    def test_mock_call_verification(self):
        """Verify how a mock was called."""
        mock_email = Mock()
        mock_email.send.return_value = True

        mock_email.send("alice@test.com", "Hello", "Body")
        mock_email.send("bob@test.com", "Hi", "Message")

        # Verify total calls
        assert mock_email.send.call_count == 2

        # Verify specific calls
        mock_email.send.assert_any_call("bob@test.com", "Hi", "Message")

        # Verify the last call
        mock_email.send.assert_called_with("bob@test.com", "Hi", "Message")


# ============================================================
# 2. Constructor Injection - recommended Mock approach
# ============================================================

class TestUserServiceWithInjection:
    """Test UserService by injecting mocks via constructor."""

    @pytest.fixture
    def mock_repo(self):
        return Mock(spec=UserRepository)

    @pytest.fixture
    def mock_email(self):
        return Mock(spec=EmailSender)

    @pytest.fixture
    def service(self, mock_repo, mock_email):
        return UserService(mock_repo, mock_email)

    def test_get_user_success(self, service, mock_repo):
        """Test getting an existing user."""
        mock_repo.find_by_id.return_value = {"id": 1, "name": "Alice"}

        user = service.get_user(1)
        assert user["name"] == "Alice"
        mock_repo.find_by_id.assert_called_once_with(1)

    def test_get_user_not_found(self, service, mock_repo):
        """Test getting a non-existent user raises error."""
        mock_repo.find_by_id.return_value = None

        with pytest.raises(ValueError, match="User 999 not found"):
            service.get_user(999)

    def test_create_user_success(self, service, mock_repo, mock_email):
        """Test creating a user sends welcome email."""
        mock_repo.save.return_value = {"name": "Alice", "email": "alice@test.com"}
        mock_email.send.return_value = True

        result = service.create_user("Alice", "alice@test.com")

        # Verify repo was called correctly
        mock_repo.save.assert_called_once_with(
            {"name": "Alice", "email": "alice@test.com"}
        )

        # Verify email was sent with correct params
        mock_email.send.assert_called_once_with(
            to="alice@test.com",
            subject="Welcome!",
            body="Hello Alice, welcome aboard!",
        )

    def test_create_user_email_failure_doesnt_crash(self, service, mock_repo, mock_email):
        """User creation succeeds even if email fails."""
        mock_repo.save.return_value = {"name": "Alice", "email": "alice@test.com"}
        mock_email.send.return_value = False

        # Should NOT raise
        result = service.create_user("Alice", "alice@test.com")
        assert result is not None

    def test_create_user_missing_name(self, service):
        """Creating user without name raises error."""
        with pytest.raises(ValueError, match="Name and email are required"):
            service.create_user("", "alice@test.com")

    def test_notify_user(self, service, mock_repo, mock_email):
        """Test sending notification to a user."""
        mock_repo.find_by_id.return_value = {"id": 1, "email": "alice@test.com"}
        mock_email.send.return_value = True

        result = service.notify_user(1, "Your order is ready")

        assert result is True
        mock_email.send.assert_called_once_with(
            to="alice@test.com",
            subject="Notification",
            body="Your order is ready",
        )


# ============================================================
# 3. @patch - replace module-level objects
# ============================================================

class TestWithPatch:
    """Test using @patch to replace dependencies."""

    @patch("user_service.requests.post")
    def test_email_sender_success(self, mock_post):
        """Test EmailSender with mocked requests."""
        mock_post.return_value = Mock(status_code=200)

        sender = EmailSender()
        result = sender.send("test@test.com", "Hi", "Body")

        assert result is True
        mock_post.assert_called_once_with(
            "https://api.email-service.com/send",
            json={"to": "test@test.com", "subject": "Hi", "body": "Body"},
        )

    @patch("user_service.requests.post")
    def test_email_sender_failure(self, mock_post):
        """Test EmailSender when API returns 500."""
        mock_post.return_value = Mock(status_code=500)

        sender = EmailSender()
        result = sender.send("test@test.com", "Hi", "Body")
        assert result is False

    # Patch as context manager
    def test_with_context_manager(self):
        """Use patch as context manager."""
        with patch("user_service.requests.post") as mock_post:
            mock_post.return_value = Mock(status_code=200)
            sender = EmailSender()
            assert sender.send("a@b.com", "Sub", "Body") is True


# ============================================================
# 4. pytest-mock - more elegant mocking
# ============================================================

class TestWithPytestMock:
    """Test using pytest-mock's mocker fixture."""

    def test_mocker_patch(self, mocker):
        """mocker.patch is cleaner and auto-cleans up."""
        mock_post = mocker.patch("user_service.requests.post")
        mock_post.return_value = Mock(status_code=200)

        sender = EmailSender()
        assert sender.send("a@b.com", "Hi", "Body") is True

    def test_mocker_spy(self, mocker):
        """Spy wraps the real object, recording calls."""
        sender = EmailSender()
        mock_post = mocker.patch("user_service.requests.post")
        mock_post.return_value = Mock(status_code=200)

        spy_send = mocker.spy(sender, "send")

        sender.send("test@test.com", "Sub", "Body")

        spy_send.assert_called_once_with("test@test.com", "Sub", "Body")

    def test_mocker_stub(self, mocker):
        """Stub returns a predefined value."""
        stub = mocker.stub(name="email_sender")
        stub.return_value = True

        assert stub("test@test.com", "Sub", "Body") is True


# ============================================================
# 5. side_effect advanced patterns
# ============================================================

class TestSideEffect:
    """Advanced side_effect patterns."""

    def test_side_effect_function(self):
        """Use a function as side_effect for dynamic behavior."""
        mock = Mock()

        def dynamic_response(url, **kwargs):
            if "error" in url:
                raise ConnectionError("Network error")
            return Mock(status_code=200)

        mock.side_effect = dynamic_response

        # Normal call works
        result = mock("https://api.example.com/users")
        assert result.status_code == 200

        # Error URL raises exception
        with pytest.raises(ConnectionError):
            mock("https://api.example.com/error")

    def test_side_effect_exception(self):
        """Simulate exceptions with side_effect."""
        mock_db = Mock()
        mock_db.query.side_effect = ConnectionError("DB down")

        with pytest.raises(ConnectionError):
            mock_db.query("SELECT * FROM users")

    def test_side_effect_iterable(self):
        """Return different values on each call."""
        mock = Mock()
        mock.side_effect = [1, 2, 3]

        assert mock() == 1
        assert mock() == 2
        assert mock() == 3

        # 4th call raises StopIteration
        with pytest.raises(StopIteration):
            mock()
```

## 四、执行预览

```bash
$ pytest tests/test_user_service.py -v
===================== test session starts =====================
tests/test_user_service.py::TestBasicMock::test_mock_return_value PASSED
tests/test_user_service.py::TestBasicMock::test_mock_raise_exception PASSED
tests/test_user_service.py::TestBasicMock::test_mock_multiple_returns PASSED
tests/test_user_service.py::TestBasicMock::test_mock_call_verification PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_get_user_success PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_get_user_not_found PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_create_user_success PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_create_user_email_failure_doesnt_crash PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_create_user_missing_name PASSED
tests/test_user_service.py::TestUserServiceWithInjection::test_notify_user PASSED
tests/test_user_service.py::TestWithPatch::test_email_sender_success PASSED
tests/test_user_service.py::TestWithPatch::test_email_sender_failure PASSED
tests/test_user_service.py::TestWithPatch::test_with_context_manager PASSED
tests/test_user_service.py::TestWithPytestMock::test_mocker_patch PASSED
tests/test_user_service.py::TestWithPytestMock::test_mocker_spy PASSED
tests/test_user_service.py::TestWithPytestMock::test_mocker_stub PASSED
tests/test_user_service.py::TestSideEffect::test_side_effect_function PASSED
tests/test_user_service.py::TestSideEffect::test_side_effect_exception PASSED
tests/test_user_service.py::TestSideEffect::test_side_effect_iterable PASSED
===================== 19 passed ==============================
```

## 五、注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| patch 位置 | Patch 必须在**使用位置**而非定义位置 | `@patch('module.where.used')` |
| spec 参数 | 不加 spec 的 Mock 接受任何调用 | 用 `Mock(spec=RealClass)` |
| Mock 属性 | 访问不存在的属性自动创建子 Mock | 可能隐藏拼写错误 |
| 测试覆盖率 | 过度 Mock 导致测试与实现强耦合 | 只 Mock 外部边界 |
| 自动清理 | 手动 patch 需要 stop() | 用 pytest-mocker 自动清理 |
| 异步 Mock | 普通 Mock 不支持 async/await | 用 `AsyncMock`（Python 3.8+） |
| return_value vs side_effect | `side_effect` 优先级更高 | 不要同时设置 |

## 六、避坑指南

### Patch 定义位置 vs Patch 使用位置

```python
# Bad: Patching where the function is defined
@patch("requests.post")
def test_something(mock_post):
    ...

# Good: Patching where the function is used
@patch("user_service.requests.post")
def test_something(mock_post):
    ...
```

**原因**：`import requests` 在 `user_service.py` 中创建了局部引用，必须替换那个引用。

### 不用 spec vs 用 spec 限制接口

```python
# Bad: Mock accepts anything, typos go unnoticed
mock = Mock()
mock.typos_are_fine()  # No error!
mock.any_method_at_all()  # Still no error!

# Good: spec enforces the real interface
mock = Mock(spec=UserRepository)
mock.typos_are_fine()  # AttributeError!
mock.find_by_id(1)  # OK, it's a real method
```

### Mock 所有东西 vs 只 Mock 外部边界

```python
# Bad: Mocking internal business logic
def test_calculate_price():
    mock_calc = Mock()
    mock_calc.calculate.return_value = 100
    assert mock_calc.calculate() == 100  # Tests nothing real!

# Good: Only mock external dependencies
def test_calculate_price():
    mock_api = Mock()  # Mock the external pricing API
    mock_api.get_base_price.return_value = 50

    service = PricingService(api=mock_api)
    result = service.calculate_price(quantity=2)  # Test real logic
    assert result == 100
```

### 忽略 Mock 状态 vs 每个测试重置 Mock

```python
# Bad: Shared mock across tests
shared_mock = Mock()

def test_1():
    shared_mock("first")
    assert shared_mock.call_count == 1

def test_2():
    # shared_mock still has state from test_1!
    assert shared_mock.call_count == 1  # FAILS!

# Good: Fresh mock per test (use fixture)
@pytest.fixture
def fresh_mock():
    return Mock()

def test_1(fresh_mock):
    fresh_mock("first")
    assert fresh_mock.call_count == 1

def test_2(fresh_mock):
    assert fresh_mock.call_count == 0  # Fresh mock
```

## 七、练习题

### 基础题

1. **创建 Mock**：为以下接口创建 Mock，设置 `fetch_data()` 返回 `{"status": "ok", "data": [1, 2, 3]}`。

```python
class DataClient:
    def fetch_data(self, query: str) -> dict: ...
    def send_data(self, data: dict) -> bool: ...
```

2. **验证调用**：创建 Mock，调用 `send("test@mail.com", "Hello")`，然后验证调用参数正确。

3. **异常模拟**：模拟一个数据库连接，第一次查询成功，第二次抛出 `ConnectionError`。

### 进阶题

4. **完整 Service 测试**：为以下服务编写测试，Mock 所有外部依赖：

```python
class OrderService:
    def __init__(self, payment_gateway, inventory, notifier):
        self.payment = payment_gateway
        self.inventory = inventory
        self.notifier = notifier

    def place_order(self, user_id: int, items: list[dict]) -> dict:
        # Check inventory
        for item in items:
            if not self.inventory.check_stock(item["id"], item["qty"]):
                raise ValueError(f"Item {item['id']} out of stock")
        # Process payment
        total = sum(i["price"] * i["qty"] for i in items)
        if not self.payment.charge(user_id, total):
            raise RuntimeError("Payment failed")
        # Send confirmation
        self.notifier.send(user_id, f"Order confirmed, total: ${total}")
        return {"status": "confirmed", "total": total}
```

5. **Patch 练习**：使用 `@patch` 替换 `time.sleep`，让测试不等待。

### 挑战题

6. **Mock 文件系统**：编写一个函数读取配置文件（JSON），用 Mock 测试正常读取、文件不存在、JSON 格式错误三种场景。

7. **构建 Fake 仓库**：实现 `FakeUserRepository`（用内存 dict 模拟数据库），然后用它进行集成测试，对比 Mock 和 Fake 的优劣。

## 八、知识点总结

```
Mock 知识树
├── 1. 测试替身类型
│   ├── Dummy（填充参数）
│   ├── Stub（返回固定值）
│   ├── Spy（记录+执行）
│   ├── Mock（验证交互）
│   └── Fake（简化实现）
├── 2. unittest.mock 核心
│   ├── Mock / MagicMock
│   ├── return_value / side_effect
│   ├── assert_called_with / call_count
│   ├── patch (装饰器/上下文/手动)
│   ├── call 对象
│   └── PropertyMock / AsyncMock
├── 3. pytest-mock
│   ├── mocker.patch()
│   ├── mocker.spy()
│   ├── mocker.stub()
│   └── 自动清理
├── 4. 常见场景
│   ├── HTTP 请求 Mock
│   ├── 数据库 Mock
│   ├── 时间 Mock
│   └── 文件系统 Mock
└── 5. 最佳实践
    ├── Patch where used
    ├── 使用 spec
    ├── 只 Mock 外部边界
    └── Mock 与集成测试互补
```

## 九、举一反三

| 你学到的 | 可以应用到 | 示例 |
|----------|-----------|------|
| 构造函数注入 | 任何依赖外部服务的类 | 注入 Mock 的 HTTP 客户端、DB 连接 |
| patch 装饰器 | 替换模块级全局变量/函数 | 替换 `os.environ`、`time.time()` |
| side_effect | 模拟不稳定的外部服务 | 网络超时、限流、间歇性故障 |
| pytest-mock | 更简洁的 Mock 代码 | 自动清理、spy 功能 |
| spec 参数 | 防止 Mock 接口漂移 | 重构后自动发现过时的 Mock |
| Fake 对象 | 需要真实行为的测试 | 内存数据库、本地文件系统 |

## 十、参考资料

- [unittest.mock 官方文档](https://docs.python.org/3/library/unittest.mock.html)
- [pytest-mock 文档](https://pytest-mock.readthedocs.io/)
- [Martin Fowler -- TestDouble](https://martinfowler.com/bliki/TestDouble.html)
- [Mocking Best Practices -- Real Python](https://realpython.com/testing-third-party-apis-with-mocks/)

## 十一、代码演进

### v1 -- 手动 Stub

```python
# test_email_v1.py -- Manual stub without framework
class FakeEmailSender:
    def __init__(self):
        self.sent = []

    def send(self, to, subject, body):
        self.sent.append((to, subject, body))
        return True

def test_create_user():
    fake_email = FakeEmailSender()
    fake_repo = type("Repo", (), {"save": lambda self, u: u})()

    service = UserService(fake_repo, fake_email)
    service.create_user("Alice", "alice@test.com")

    assert len(fake_email.sent) == 1
    assert fake_email.sent[0][0] == "alice@test.com"
```

**问题**：手写 Stub 费时，验证逻辑有限。

### v2 -- unittest.mock

```python
# test_email_v2.py -- Using unittest.mock
from unittest.mock import Mock

def test_create_user():
    mock_repo = Mock()
    mock_repo.save.return_value = {"name": "Alice", "email": "a@b.com"}
    mock_email = Mock()
    mock_email.send.return_value = True

    service = UserService(mock_repo, mock_email)
    service.create_user("Alice", "a@b.com")

    mock_email.send.assert_called_once()
```

**改进**：无需手写 Stub，丰富的断言方法。**问题**：需要手动管理 patch 清理。

### v3 -- pytest-mock + 最佳实践

```python
# test_email_v3.py -- pytest-mock with best practices
import pytest

@pytest.fixture
def service(mocker):
    mock_repo = mocker.Mock(spec=UserRepository)
    mock_email = mocker.Mock(spec=EmailSender)
    return UserService(mock_repo, mock_email), mock_repo, mock_email

def test_create_user(service):
    svc, repo, email = service
    repo.save.return_value = {"name": "Alice", "email": "a@b.com"}
    email.send.return_value = True

    svc.create_user("Alice", "a@b.com")

    email.send.assert_called_once_with(
        to="a@b.com", subject="Welcome!", body="Hello Alice, welcome aboard!"
    )
```

**最终形态**：自动清理、spec 约束、fixture 复用、清晰可维护。
