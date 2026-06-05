# HTTP协议全解析：从请求到响应

> 分类：Web基础 | HTTP协议 | 难度：⭐ | 预估用时：25 分钟

---

## 🎯 学习目标

1. ✅ 能够说出 HTTP 请求和响应的基本结构（理解）
2. ✅ 能够解释常见 HTTP 方法、状态码、Header 的含义（理解）
3. ✅ 能够区分 Cookie、Session、Token 三种状态管理方式（分析）
4. ✅ 能够在开发中正确选择 HTTP 方法和状态码（应用）

---

## 📋 前置知识自检

1. **你知道浏览器地址栏输入 URL 后会发生什么吗？**（答不上来？→ 先了解 Web 基础概念）
2. **你用过 `curl` 或 Postman 发过 HTTP 请求吗？**（答不上来？→ 建议先试一下）

---

## 💡 概念讲解

### HTTP 协议

- **一句话定义**：HTTP 是浏览器和服务器之间"对话"的规则——你说我要什么，我说给你什么。
- **现实类比**：HTTP 就像餐厅点菜——你是客户端（顾客），服务器是厨房。你拿着菜单（URL）告诉服务员你要什么菜（GET/POST），服务员把需求告诉厨房，厨房做好端给你（响应），有时候菜卖完了会告诉你（状态码 404）。
- **技术场景**：前后端通信、API 调用、微服务间通信——几乎所有 Web 开发都基于 HTTP。
- **⚠️ 常见误解**：HTTP 不是编程语言，是通信协议。就像交通规则不是车，但所有车都要遵守。

---

## 🧠 实时脑图

```text
[HTTP 协议] 🔴
    ||
    ├──→ [请求 Request] 🔴
    │       ├── 方法: GET / POST / PUT / DELETE 🟡
    │       ├── URL: 资源地址 🟡
    │       ├── Headers: 元信息 🟢
    │       └── Body: 请求体（POST/PUT有）🟡
    ├──→ [响应 Response] 🔴
    │       ├── 状态码: 200 / 404 / 500 🟡
    │       ├── Headers: 响应头 🟢
    │       └── Body: 响应体（JSON/HTML）🟡
    ├──→ [状态管理] 🟡
    │       ├── Cookie — 客户端存储
    │       ├── Session — 服务端存储
    │       └── Token — 无状态令牌
    └──→ [HTTPS] 🟢 — 加密传输
```

---

## 💻 完整代码

> 运行环境：Python 3.10+, `pip install httpx`

```python
"""
http_basics.py - HTTP 协议全解析示例
Python 3.10+ | pip install httpx
"""

import httpx
import json


# ============================================
# 1. HTTP 方法演示
# ============================================

# 使用 httpbin.org 作为测试服务器
BASE = "https://httpbin.org"

with httpx.Client(timeout=10) as client:

    # ---- GET：获取资源 ----
    print("=" * 50)
    print("GET 请求")
    resp = client.get(f"{BASE}/get", params={"name": "铁蛋", "lang": "python"})
    print(f"  状态码: {resp.status_code}")
    data = resp.json()
    print(f"  请求参数: {data['args']}")

    # ---- POST：创建资源 ----
    print("\n" + "=" * 50)
    print("POST 请求 (JSON Body)")
    resp = client.post(
        f"{BASE}/post",
        json={"title": "学HTTP", "content": "HTTP很简单"},
    )
    print(f"  状态码: {resp.status_code}")
    print(f"  发送的JSON: {resp.json()['json']}")

    # ---- POST：Form 表单 ----
    print("\n" + "=" * 50)
    print("POST 请求 (Form 表单)")
    resp = client.post(
        f"{BASE}/post",
        data={"username": "tiedan", "password": "secret"},
    )
    print(f"  表单数据: {resp.json()['form']}")

    # ---- PUT：更新资源 ----
    print("\n" + "=" * 50)
    print("PUT 请求")
    resp = client.put(f"{BASE}/put", json={"name": "更新后的铁蛋"})
    print(f"  状态码: {resp.status_code}")

    # ---- DELETE：删除资源 ----
    print("\n" + "=" * 50)
    print("DELETE 请求")
    resp = client.delete(f"{BASE}/delete")
    print(f"  状态码: {resp.status_code}")


# ============================================
# 2. 状态码分类
# ============================================

print("\n" + "=" * 50)
print("HTTP 状态码分类")
status_groups = {
    "1xx 信息": "请求已接收，继续处理",
    "2xx 成功": {
        200: "OK - 请求成功",
        201: "Created - 资源已创建",
        204: "No Content - 成功但无返回内容",
    },
    "3xx 重定向": {
        301: "Moved Permanently - 永久重定向",
        302: "Found - 临时重定向",
        304: "Not Modified - 缓存未变",
    },
    "4xx 客户端错误": {
        400: "Bad Request - 请求格式错误",
        401: "Unauthorized - 未认证",
        403: "Forbidden - 无权限",
        404: "Not Found - 资源不存在",
        429: "Too Many Requests - 请求太频繁",
    },
    "5xx 服务端错误": {
        500: "Internal Server Error - 服务器内部错误",
        502: "Bad Gateway - 网关错误",
        503: "Service Unavailable - 服务不可用",
    },
}

for group, val in status_groups.items():
    print(f"\n  {group}:")
    if isinstance(val, dict):
        for code, desc in val.items():
            print(f"    {code}: {desc}")
    else:
        print(f"    {val}")


# ============================================
# 3. Headers 演示
# ============================================

print("\n" + "=" * 50)
print("常见 Headers")

common_headers = {
    "请求头": {
        "Content-Type": "请求体格式（application/json, application/x-www-form-urlencoded）",
        "Authorization": "认证信息（Bearer token, Basic auth）",
        "User-Agent": "客户端标识",
        "Accept": "期望的响应格式",
        "Cookie": "客户端存储的Cookie",
    },
    "响应头": {
        "Content-Type": "响应体格式",
        "Set-Cookie": "设置客户端Cookie",
        "Cache-Control": "缓存策略",
        "Location": "重定向地址（配合3xx）",
        "Access-Control-Allow-Origin": "CORS 跨域控制",
    },
}

for direction, headers in common_headers.items():
    print(f"\n  {direction}:")
    for name, desc in headers.items():
        print(f"    {name}: {desc}")


# ============================================
# 4. Cookie vs Session vs Token
# ============================================

print("\n" + "=" * 50)
print("状态管理对比")
comparison = """
| 维度         | Cookie              | Session              | Token (JWT)          |
|-------------|---------------------|----------------------|----------------------|
| 存储位置     | 客户端（浏览器）      | 服务端（内存/Redis）   | 客户端（localStorage） |
| 安全性       | 较低（可伪造）         | 较高（服务端控制）      | 中（签名防篡改）       |
| 跨域支持     | 需配置               | 需配置               | 天然支持              |
| 服务端压力   | 无                  | 有（存储session）      | 无（无状态）           |
| 适用场景     | 简单偏好存储          | 传统Web应用           | API/微服务/移动端      |
"""
print(comparison)
```

---

## 👀 执行预览

```bash
$ python http_basics.py

==================================================
GET 请求
  状态码: 200
  请求参数: {'name': '铁蛋', 'lang': 'python'}

==================================================
POST 请求 (JSON Body)
  状态码: 200
  发送的JSON: {'title': '学HTTP', 'content': 'HTTP很简单'}

==================================================
POST 请求 (Form 表单)
  表单数据: {'username': 'tiedan', 'password': 'secret'}

==================================================
PUT 请求
  状态码: 200

==================================================
DELETE 请求
  状态码: 200

==================================================
HTTP 状态码分类

  2xx 成功:
    200: OK - 请求成功
    201: Created - 资源已创建
    ...

  4xx 客户端错误:
    400: Bad Request - 请求格式错误
    401: Unauthorized - 未认证
    403: Forbidden - 无权限
    404: Not Found - 资源不存在
    ...
```

---

## ⚠️ 注意事项

| 注意事项 | 违反后果 | 级别 |
|----------|----------|------|
| ⚠️ GET 请求不应有副作用（不应修改数据） | 破坏幂等性，CDN/浏览器缓存导致意外 | 🔴 |
| ⚠️ 状态码要准确使用 | 前端/客户端逻辑混乱，错误处理失败 | 🟡 |
| ⚠️ 敏感信息不要放 URL 参数中 | URL 会被记录在日志、浏览器历史中 | 🔴 |
| ⚠️ HTTPS 是必须的 | HTTP 明文传输，数据可被窃听 | 🔴 |

---

## 🕳️ 避坑指南

### 坑1：GET 请求传大量数据

```python
# ❌ GET 请求把数据放在 URL，URL 有长度限制
client.get(f"{BASE}/get?data={'x' * 10000}")  # 可能被截断或拒绝

# ✅ 大量数据用 POST，放 Body 里
client.post(f"{BASE}/post", json={"data": "x" * 10000})
```

### 坑2：混淆 401 和 403

```python
# 401 = 未认证（没登录）
# 403 = 已认证但没权限（登录了但不是管理员）
# ❌ 没登录返回 403
# ✅ 没登录返回 401，没权限返回 403
```

### 坑3：POST 和 PUT 不分

```python
# POST = 创建新资源（每次调用创建一个新订单）
# PUT  = 更新已有资源（更新订单 #123 的状态）
# ❌ 用 POST 更新资源
# ✅ 用 PUT 更新，用 POST 创建
```

---

## 🔍 调试排查

### 故障场景1：API 返回 404 但 URL 没问题

**症状**：URL 拼写正确但仍然 404
**排查思路**：
1. 检查请求方法是否正确（POST 的接口用 GET 请求可能 404）
2. 检查 Content-Type 是否匹配（有些路由只响应特定 Content-Type）
3. 确认 API 版本号是否正确（`/v1/users` vs `/v2/users`）

### 故障场景2：跨域请求被拒绝（CORS）

**症状**：浏览器控制台报 CORS 错误，但 Postman 正常
**排查思路**：
1. CORS 是浏览器安全策略，Postman 不受限制
2. 服务端需返回 `Access-Control-Allow-Origin` 头
3. 检查是简单请求还是预检请求（OPTIONS）

---

## 📝 练习题

### 🟢 基础题

1. 说出以下 HTTP 方法的主要用途：GET、POST、PUT、DELETE。（考察点：HTTP 方法语义 → 目标 #1）

2. 以下状态码分别代表什么：200、201、400、401、404、500？（考察点：状态码含义 → 目标 #2）

### 🟡 进阶题

3. 用 `httpx` 发一个 POST 请求到 `https://httpbin.org/post`，发送 JSON `{"name": "铁蛋", "skill": "Python"}`，打印响应状态码和返回的 JSON。（考察点：HTTP 请求实践 → 目标 #4）

### 🔴 开放题

4. 设计一个博客 API 的 URL 结构，覆盖文章的增删改查和用户注册登录。说明每个接口用什么 HTTP 方法和状态码。（考察点：HTTP 方法与状态码选择 → 目标 #4）

---

📝 参考答案：见文末附录

---

## 📌 知识点总结

```text
HTTP 协议
├── 请求
│   ├── 方法: GET(获取) POST(创建) PUT(更新) DELETE(删除)
│   ├── Header: Content-Type, Authorization, Cookie
│   └── Body: JSON, Form, Multipart
├── 响应
│   ├── 状态码: 2xx成功 3xx重定向 4xx客户端错 5xx服务端错
│   ├── Header: Content-Type, Set-Cookie, Cache-Control
│   └── Body: JSON, HTML, XML
├── 状态管理
│   ├── Cookie — 客户端
│   ├── Session — 服务端
│   └── Token — 无状态
└── HTTPS — TLS加密
```

---

## 🔄 举一反三

| 场景 | HTTP 知识应用 |
|------|---------------|
| 前后端联调 | 理解请求/响应结构，正确使用方法和状态码 |
| API 设计 | 遵循 RESTful 规范，语义化使用 HTTP 方法 |
| 调试线上问题 | 根据状态码快速定位是客户端还是服务端问题 |

---

## 🗺️ 学习路径

```
[编程基础] → **📍 你在这里：HTTP协议** → [RESTful API设计] → [httpx客户端] → [JWT认证]
```

**下一篇建议**：
- → [《RESTful API设计原则与最佳实践》](12-restful-api设计原则.md)：学会设计规范的 API
- → [《httpx：比requests更好的HTTP客户端》](13-httpx-比requests更好的HTTP客户端.md)：实战 HTTP 请求

---

## 📚 参考资料

- [MDN - HTTP 概述](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Overview) [等级：权威] — 最全面的 HTTP 教程
- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) [等级：官方] — HTTP 规范原文

---

## 附录：练习题参考答案

**题1**：GET=获取资源、POST=创建资源、PUT=更新资源、DELETE=删除资源

**题2**：200=成功、201=已创建、400=请求错误、401=未认证、404=未找到、500=服务器内部错误

**题3**：
```python
import httpx
resp = httpx.post("https://httpbin.org/post", json={"name": "铁蛋", "skill": "Python"})
print(f"状态码: {resp.status_code}")
print(f"返回JSON: {resp.json()['json']}")
```

**题4**：
```
POST   /api/users/register    → 201 (注册成功)
POST   /api/users/login       → 200 (登录成功) / 401 (密码错误)
GET    /api/posts              → 200 (获取文章列表)
GET    /api/posts/123          → 200 (获取单篇文章) / 404 (不存在)
POST   /api/posts              → 201 (创建文章)
PUT    /api/posts/123          → 200 (更新文章)
DELETE /api/posts/123          → 204 (删除成功)
```
