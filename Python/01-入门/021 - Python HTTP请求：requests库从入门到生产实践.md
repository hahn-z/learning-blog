---
title: "021 - Python HTTP请求：requests库从入门到生产实践"
slug: "021-requests"
category: "Python入门"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.324+08:00"
updated_at: "2026-04-29T10:02:47.438+08:00"
reading_time: 31
tags: []
---

## 📊 难度标注

> **难度等级：** ⭐⭐⭐☆☆（中级）
> **前置知识：** Python基础语法、字典操作、异常处理
> **预计学习时间：** 40-50分钟
> **适用场景：** Web API调用、爬虫、数据采集、微服务通信

---

## 📖 概念讲解

### 什么是 HTTP 请求？

HTTP（HyperText Transfer Protocol）是互联网通信的基础协议。每次你打开网页、调用 API、提交表单，底层都是 HTTP 请求。Python 的 `requests` 库是最流行的 HTTP 客户端库，以"人类可读"的 API 设计著称。

### HTTP 请求核心概念

```
HTTP 请求构成：
├── Method（方法）
│   ├── GET     → 获取资源
│   ├── POST    → 创建资源
│   ├── PUT     → 更新资源（全量）
│   ├── PATCH   → 更新资源（部分）
│   └── DELETE  → 删除资源
├── URL（地址）
│   ├── 基础URL  → https://api.example.com
│   ├── 路径     → /users/123
│   └── 查询参数 → ?page=1&limit=10
├── Headers（请求头）
│   ├── Content-Type → 数据格式
│   ├── Authorization → 认证信息
│   └── User-Agent   → 客户端标识
├── Body（请求体）
│   ├── JSON → 最常用
│   ├── Form → 表单数据
│   └── File → 文件上传
└── Response（响应）
    ├── Status Code → 200/404/500...
    ├── Headers     → 响应头
    └── Body        → 响应内容
```

**核心理解：**
- `requests` 是同步阻塞库，一个请求完成后才发下一个
- Session 对象可以复用连接、保持 Cookie
- 超时设置是生产环境的**必须项**

---

## 🧠 知识脑图

```
requests 库
├── 基础请求
│   ├── requests.get()
│   ├── requests.post()
│   ├── requests.put()
│   ├── requests.delete()
│   └── requests.patch()
├── 请求参数
│   ├── params     → URL查询参数
│   ├── headers    → 请求头
│   ├── json       → JSON请求体
│   ├── data       → 表单数据
│   └── cookies    → Cookie
├── 响应处理
│   ├── .status_code → 状态码
│   ├── .json()      → JSON解析
│   ├── .text        → 文本内容
│   ├── .content     → 二进制内容
│   └── .headers     → 响应头
├── 高级功能
│   ├── Session      → 会话管理
│   ├── timeout      → 超时设置
│   ├── auth         → 认证
│   ├── proxies      → 代理
│   └── files        → 文件上传
├── 异常处理
│   ├── Timeout
│   ├── ConnectionError
│   ├── HTTPError
│   └── RequestException
└── 最佳实践
    ├── 重试策略
    ├── 连接池
    └── 超时必设
```

---

## 💻 完整代码示例

### v1 基础：GET 与 POST 请求

```python
# v1: Basic GET and POST requests
import requests

# --- GET request ---
# Fetch data from a public API
response = requests.get("https://httpbin.org/get")
print(f"Status: {response.status_code}")
print(f"Type: {response.headers.get('content-type')}")
data = response.json()
print(f"Origin: {data.get('origin')}")

# GET with query parameters
params = {"page": 1, "limit": 10, "sort": "created_at"}
response = requests.get("https://httpbin.org/get", params=params)
print(f"URL: {response.url}")
# URL becomes: https://httpbin.org/get?page=1&limit=10&sort=created_at

# --- POST request with JSON ---
payload = {"username": "alice", "email": "alice@example.com"}
response = requests.post(
    "https://httpbin.org/post",
    json=payload  # Automatically sets Content-Type: application/json
)
print(f"POST status: {response.status_code}")
result = response.json()
print(f"Sent data: {result.get('json')}")

# --- POST with form data ---
form_data = {"username": "bob", "password": "secret123"}
response = requests.post(
    "https://httpbin.org/post",
    data=form_data  # Sends as application/x-www-form-urlencoded
)
print(f"Form data: {response.json().get('form')}")

# --- Custom headers ---
headers = {
    "User-Agent": "MyApp/1.0",
    "Accept": "application/json",
    "X-Custom-Header": "hello"
}
response = requests.get("https://httpbin.org/headers", headers=headers)
print(f"Custom header sent: {response.json().get('headers', {}).get('X-Custom-Header')}")
```

### v2 进阶：Session、异常处理与认证

```python
# v2: Session, error handling, and authentication
import requests
from requests.exceptions import Timeout, ConnectionError, HTTPError, RequestException

# --- Session for connection reuse ---
session = requests.Session()
session.headers.update({"Authorization": "Bearer demo-token"})
session.headers.update({"User-Agent": "MyApp/1.0"})

# All requests via session share headers and cookies
r1 = session.get("https://httpbin.org/headers")
r2 = session.get("https://httpbin.org/get")
print(f"Session request 1: {r1.status_code}")
print(f"Session request 2: {r2.status_code}")

# Session maintains cookies automatically
session.get("https://httpbin.org/cookies/set?session_id=abc123")
r3 = session.get("https://httpbin.org/cookies")
print(f"Cookies: {r3.json().get('cookies')}")

session.close()  # Always close session when done

# --- Error handling ---
def safe_get(url, timeout=5):
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()  # Raise exception for 4xx/5xx
        return response.json()
    except Timeout:
        print(f"Request timed out: {url}")
        return None
    except ConnectionError:
        print(f"Connection failed: {url}")
        return None
    except HTTPError as e:
        print(f"HTTP error: {e}")
        return None
    except RequestException as e:
        print(f"Request error: {e}")
        return None

result = safe_get("https://httpbin.org/get")
print(f"Safe get result: {result is not None}")

# --- Basic authentication ---
from requests.auth import HTTPBasicAuth
response = requests.get(
    "https://httpbin.org/basic-auth/user/pass",
    auth=HTTPBasicAuth("user", "pass")
)
print(f"Auth status: {response.status_code}")

# --- Bearer token authentication ---
token = "your-api-token-here"
response = requests.get(
    "https://httpbin.org/headers",
    headers={"Authorization": f"Bearer {token}"}
)
print(f"Bearer auth: {response.status_code}")
```

### v3 高级：重试策略、文件上传与异步考量

```python
# v3: Retry strategy, file upload, and production patterns
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import time

# --- Retry strategy with Session ---
def create_session(retries=3, backoff=0.3):
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=backoff,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

session = create_session()
response = session.get("https://httpbin.org/get", timeout=5)
print(f"Retry session: {response.status_code}")
session.close()

# --- File upload ---
# Upload single file
with open("example.txt", "w") as f:
    f.write("Hello, this is a test file for upload.")

with open("example.txt", "rb") as f:
    response = requests.post(
        "https://httpbin.org/post",
        files={"file": ("example.txt", f, "text/plain")}
    )
    print(f"Upload status: {response.status_code}")

# --- Download file ---
response = requests.get("https://httpbin.org/json", stream=True)
if response.status_code == 200:
    with open("downloaded.json", "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print("File downloaded")

# --- REST API wrapper pattern ---
class APIClient:
    def __init__(self, base_url, token=None):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"
        self.session.headers["Content-Type"] = "application/json"

    def get(self, path, **kwargs):
        return self._request("GET", path, **kwargs)

    def post(self, path, data=None, **kwargs):
        return self._request("POST", path, json=data, **kwargs)

    def put(self, path, data=None, **kwargs):
        return self._request("PUT", path, json=data, **kwargs)

    def delete(self, path, **kwargs):
        return self._request("DELETE", path, **kwargs)

    def _request(self, method, path, **kwargs):
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", 10)
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()

    def close(self):
        self.session.close()

# Usage
api = APIClient("https://httpbin.org")
result = api.get("/get")
print(f"API client: {result.get('url')}")
api.close()
```

---

## 👀 执行预览

```
Status: 200
Type: application/json
Origin: 192.168.1.100
URL: https://httpbin.org/get?page=1&limit=10&sort=created_at
POST status: 200
Sent data: {'username': 'alice', 'email': 'alice@example.com'}
Form data: {'username': 'bob', 'password': 'secret123'}
Custom header sent: hello

Session request 1: 200
Session request 2: 200
Cookies: {'session_id': 'abc123'}

Safe get result: True
Auth status: 200
Bearer auth: 200

Retry session: 200
Upload status: 200
File downloaded
API client: https://httpbin.org/get
```

---

## ⚠️ 注意事项

| 场景 | 注意点 | 建议 |
|------|--------|------|
| 超时 | 不设 timeout 会无限等待 | 始终设置 timeout=(连接超时, 读取超时) |
| 编码 | response.text 自动猜测编码 | 乱码时手动设置 `response.encoding = 'utf-8'` |
| JSON | response.json() 可能抛异常 | 用 try/except 包裹 |
| 大文件 | response.content 全部读入内存 | 使用 stream=True + iter_content |
| HTTPS | 默认验证 SSL 证书 | 不要设 verify=False（不安全） |
| 重定向 | 默认跟随重定向 | 设 allow_redirects=False 可禁止 |
| 连接池 | 每次请求创建新连接 | 使用 Session 复用连接 |
| Cookie | Session 自动管理 Cookie | 注意不要泄露敏感 Cookie |

---

## 🚫 避坑指南

### ❌ 不设 timeout
```python
# Wrong: may hang forever
response = requests.get("https://slow-api.example.com")
```
✅ **正确做法：** 始终设置超时
```python
# Correct: always set timeout
response = requests.get("https://slow-api.example.com", timeout=10)
# Or separate connect and read timeouts
response = requests.get(url, timeout=(3.05, 10))  # (connect, read)
```

### ❌ 忽略错误状态码
```python
# Wrong: 404/500 won't raise exception
response = requests.get("https://api.example.com/users/999")
data = response.json()  # May fail or return error message
```
✅ **正确做法：** 检查状态码或用 raise_for_status
```python
# Correct: check status explicitly
response = requests.get("https://api.example.com/users/999")
response.raise_for_status()  # Raises HTTPError for 4xx/5xx
data = response.json()

# Or check manually
if response.status_code == 200:
    data = response.json()
else:
    print(f"Error: {response.status_code}")
```

### ❌ 不使用 Session
```python
# Wrong: new TCP connection for every request
for i in range(100):
    requests.get(f"https://api.example.com/items/{i}")
```
✅ **正确做法：** 用 Session 复用连接
```python
# Correct: reuse connections with Session
session = requests.Session()
for i in range(100):
    session.get(f"https://api.example.com/items/{i}")
session.close()
```

---

## 🏋️ 练习题

### 🟢 入门级

**题目1：** 调用公开 API 获取随机用户信息并打印姓名和邮箱。

```python
import requests

response = requests.get("https://randomuser.me/api/", timeout=10)
data = response.json()
user = data["results"][0]
print(f"Name: {user['name']['first']} {user['name']['last']}")
print(f"Email: {user['email']}")
```

**题目2：** 使用 GET 请求下载一个图片并保存到本地。

### 🟡 进阶级

**题目3：** 实现一个带重试机制的请求函数，最多重试3次，每次间隔递增。

```python
import requests
import time

def retry_request(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            print(f"Attempt {attempt+1} failed: {e}, retrying in {wait}s...")
            time.sleep(wait)
    return None
```

**题目4：** 封装一个 GitHub API 客户端，支持获取用户信息和仓库列表。

### 🔴 挑战级

**题目5：** 实现一个支持速率限制的 API 客户端，自动根据响应头 `X-RateLimit-Remaining` 调整请求频率。

---

## 🌳 知识点总结

```
requests 库
├── 请求方法
│   ├── GET → 获取资源
│   ├── POST → 创建/提交
│   ├── PUT → 全量更新
│   ├── PATCH → 部分更新
│   └── DELETE → 删除
├── 请求配置
│   ├── params → 查询参数
│   ├── json/data → 请求体
│   ├── headers → 请求头
│   ├── timeout → 超时
│   └── auth → 认证
├── 响应处理
│   ├── .status_code → 状态码
│   ├── .json() → 解析JSON
│   ├── .text/.content → 内容
│   └── raise_for_status() → 错误检查
├── 高级特性
│   ├── Session → 连接复用
│   ├── Retry → 重试策略
│   ├── stream → 流式下载
│   └── files → 文件上传
└── 异常体系
    ├── Timeout → 超时
    ├── ConnectionError → 连接失败
    ├── HTTPError → HTTP错误
    └── RequestException → 所有异常基类
```

---

## 🔗 举一反三

| 技术点 | 本文用法 | 扩展场景 |
|--------|---------|---------|
| GET + params | 查询API | 搜索接口、分页查询 |
| POST + json | 提交数据 | 登录注册、表单提交 |
| Session | 复用连接 | 批量API调用、爬虫 |
| timeout | 超时控制 | 所有生产环境必设 |
| raise_for_status | 错误检查 | API调用异常处理 |
| Retry + HTTPAdapter | 自动重试 | 不稳定网络、微服务调用 |
| Bearer token | API认证 | OAuth2、JWT认证 |
| stream + iter_content | 流式下载 | 大文件下载、进度条 |

---

## 📚 参考资料

- [requests 官方文档](https://requests.readthedocs.io/)
- [HTTP 状态码速查](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)
- [RESTful API 设计指南](https://restfulapi.net/)
- [urllib3 Retry 文档](https://urllib3.readthedocs.io/en/stable/reference/urllib3.util.html)
- [httpx](https://www.python-httpx.org/) — 支持 async 的现代HTTP客户端

---

## 🔄 代码演进

| 版本 | 重点 | 适用场景 |
|------|------|---------|
| v1 基础版 | GET/POST、参数、请求头 | 快速脚本、API测试 |
| v2 进阶版 | Session、异常处理、认证 | 正式项目、多请求场景 |
| v3 高级版 | 重试策略、API封装、文件操作 | 生产环境、微服务客户端 |

**演进路径：** v1 满足单次请求 → v2 解决健壮性和连接管理 → v3 达到生产级别。实际开发中，v2 是最低标准（超时+异常处理），v3 适合核心业务。
