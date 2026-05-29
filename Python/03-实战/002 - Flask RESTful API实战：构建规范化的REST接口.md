---
title: "002 - Flask RESTful API实战：构建规范化的REST接口"
slug: "002-flask-restful"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.466+08:00"
updated_at: "2026-04-29T10:02:47.675+08:00"
reading_time: 32
tags: []
---

## 难度标注

> 🟡 中级 | 适合已掌握Flask基础，想构建RESTful API的读者

---

## 概念讲解

### 什么是RESTful API？

REST（Representational State Transfer）是一种软件架构风格，定义了Web服务的设计原则。RESTful API使用HTTP动词操作资源：

| HTTP方法 | 用途 | 幂等性 | 安全性 |
|---------|------|--------|--------|
| GET | 获取资源 | ✅ | ✅ |
| POST | 创建资源 | ❌ | ❌ |
| PUT | 全量更新 | ✅ | ❌ |
| PATCH | 部分更新 | ✅ | ❌ |
| DELETE | 删除资源 | ✅ | ❌ |

### RESTful设计原则

1. **资源导向**：URL代表资源，用名词不用动词（`/users`而非`/getUsers`）
2. **HTTP动词**：用HTTP方法表达操作意图
3. **状态码**：用HTTP状态码表达结果（200成功、201创建、404未找到）
4. **JSON格式**：请求和响应使用JSON
5. **无状态**：每个请求包含所有必要信息

### Flask构建API的几种方式

| 方式 | 优点 | 缺点 |
|------|------|------|
| 原生Flask路由 | 简单、无额外依赖 | 需手动处理很多细节 |
| Flask-RESTful | 结构化、资源类 | 项目已不太活跃 |
| Flask-RESTX | 自动Swagger文档 | 较重 |
| Flask APIFairy | 轻量、现代 | 社区较小 |

本文使用**原生Flask + 手写JSON响应**，最实用且无额外依赖。

---

## 脑图

```
Flask RESTful API
├── REST基础
│   ├── HTTP方法语义
│   ├── 状态码规范
│   ├── URL设计
│   └── JSON请求/响应
├── API实现
│   ├── GET - 列表/详情
│   ├── POST - 创建
│   ├── PUT/PATCH - 更新
│   └── DELETE - 删除
├── 高级特性
│   ├── 分页
│   ├── 过滤与排序
│   ├── 错误处理
│   └── 请求验证
├── API文档
│   └── Swagger/OpenAPI
└── 测试
    ├── curl命令
    └── pytest
```

---

## 完整Python代码

### v1: 基础CRUD API

```python
# api_v1.py - Basic CRUD REST API
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory database
books = [
    {"id": 1, "title": "Flask Web Development", "author": "Miguel Grinberg", "year": 2018},
    {"id": 2, "title": "Python Crash Course", "author": "Eric Matthes", "year": 2019},
]
next_id = 3

@app.route("/api/books", methods=["GET"])
def list_books():
    """List all books"""
    return jsonify(books)

@app.route("/api/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    """Get a single book by ID"""
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    return jsonify(book)

@app.route("/api/books", methods=["POST"])
def create_book():
    """Create a new book"""
    global next_id
    data = request.get_json()
    if not data or "title" not in data:
        return jsonify({"error": "title is required"}), 400
    book = {
        "id": next_id,
        "title": data["title"],
        "author": data.get("author", ""),
        "year": data.get("year", 0),
    }
    next_id += 1
    books.append(book)
    return jsonify(book), 201

@app.route("/api/books/<int:book_id>", methods=["PUT"])
def update_book(book_id):
    """Update a book (full replacement)"""
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    data = request.get_json()
    book["title"] = data.get("title", book["title"])
    book["author"] = data.get("author", book["author"])
    book["year"] = data.get("year", book["year"])
    return jsonify(book)

@app.route("/api/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    """Delete a book"""
    global books
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    books = [b for b in books if b["id"] != book_id]
    return jsonify({"message": "deleted"}), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### v2: 添加分页、过滤、验证

```python
# api_v2.py - CRUD with pagination, filtering, and validation
from flask import Flask, request, jsonify, url_for
from functools import wraps

app = Flask(__name__)

books = [
    {"id": i, "title": f"Book {i}", "author": f"Author {i % 5}", "year": 2000 + i}
    for i in range(1, 51)
]
next_id = 51

# Validation decorator
def validate_json(*required_fields):
    """Decorator to validate JSON request body"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True)
            if not data:
                return jsonify({"error": "Request body must be JSON"}), 400
            missing = [f for f in required_fields if f not in data]
            if missing:
                return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
            return f(*args, **kwargs, data=data)
        return wrapper
    return decorator

# Pagination helper
def paginate(items, page, per_page):
    """Return a paginated subset of items"""
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "items": items[start:end],
        "page": page,
        "per_page": per_page,
        "total": len(items),
        "pages": (len(items) + per_page - 1) // per_page,
    }

@app.route("/api/books", methods=["GET"])
def list_books():
    """List books with pagination and filtering"""
    # Filtering
    author = request.args.get("author")
    year = request.args.get("year", type=int)
    result = books[:]
    if author:
        result = [b for b in result if author.lower() in b["author"].lower()]
    if year:
        result = [b for b in result if b["year"] == year]

    # Pagination
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    per_page = min(per_page, 100)  # Cap at 100

    return jsonify(paginate(result, page, per_page))

@app.route("/api/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    return jsonify(book)

@app.route("/api/books", methods=["POST"])
@validate_json("title")
def create_book(data):
    global next_id
    book = {
        "id": next_id,
        "title": data["title"],
        "author": data.get("author", ""),
        "year": data.get("year", 0),
    }
    next_id += 1
    books.append(book)
    return jsonify(book), 201

@app.route("/api/books/<int:book_id>", methods=["PUT"])
@validate_json()
def update_book(book_id, data):
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    for key in ("title", "author", "year"):
        if key in data:
            book[key] = data[key]
    return jsonify(book)

@app.route("/api/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    global books
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return jsonify({"error": "Book not found"}), 404
    books = [b for b in books if b["id"] != book_id]
    return jsonify({"message": "deleted"}), 200

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### v3: 完整API项目（蓝图+错误处理+版本控制）

```python
# api_v3.py - Production-style API with blueprints, error handling, versioning
from flask import Flask, Blueprint, request, jsonify
from functools import wraps
from datetime import datetime

def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False  # Preserve JSON key order

    # Register API v1 blueprint
    app.register_blueprint(api_v1, url_prefix="/api/v1")

    # Health check at root level
    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "time": datetime.now().isoformat()})

    return app

# Blueprint for API v1
api_v1 = Blueprint("api_v1", __name__)

# Storage
_store = {
    "books": [
        {"id": 1, "title": "Flask Web Development", "author": "Miguel Grinberg", "year": 2018},
        {"id": 2, "title": "Clean Code", "author": "Robert C. Martin", "year": 2008},
    ],
    "next_id": 3,
}

def validate_json(*required):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True)
            if not data:
                return error_response(400, "Request body must be valid JSON")
            missing = [f for f in required if f not in data]
            if missing:
                return error_response(400, f"Missing: {', '.join(missing)}")
            return f(*args, **kwargs, data=data)
        return wrapper
    return decorator

def error_response(status_code, message):
    return jsonify({"error": message, "status": status_code}), status_code

def paginate(items, page=1, per_page=10):
    start = (page - 1) * per_page
    return {
        "data": items[start:start + per_page],
        "meta": {
            "page": page,
            "per_page": per_page,
            "total": len(items),
            "pages": max(1, (len(items) + per_page - 1) // per_page),
        }
    }

@api_v1.route("/books", methods=["GET"])
def list_books():
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 10, type=int), 100)
    author = request.args.get("author")

    result = _store["books"][:]
    if author:
        result = [b for b in result if author.lower() in b["author"].lower()]

    return jsonify(paginate(result, page, per_page))

@api_v1.route("/books/<int:book_id>", methods=["GET"])
def get_book(book_id):
    book = next((b for b in _store["books"] if b["id"] == book_id), None)
    if not book:
        return error_response(404, "Book not found")
    return jsonify({"data": book})

@api_v1.route("/books", methods=["POST"])
@validate_json("title")
def create_book(data):
    book = {
        "id": _store["next_id"],
        "title": data["title"],
        "author": data.get("author", ""),
        "year": data.get("year", 0),
    }
    _store["next_id"] += 1
    _store["books"].append(book)
    return jsonify({"data": book}), 201

@api_v1.route("/books/<int:book_id>", methods=["PUT"])
@validate_json()
def update_book(book_id, data):
    book = next((b for b in _store["books"] if b["id"] == book_id), None)
    if not book:
        return error_response(404, "Book not found")
    for key in ("title", "author", "year"):
        if key in data:
            book[key] = data[key]
    return jsonify({"data": book})

@api_v1.route("/books/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    books = _store["books"]
    book = next((b for b in books if b["id"] == book_id), None)
    if not book:
        return error_response(404, "Book not found")
    books.remove(book)
    return jsonify({"message": "deleted"}), 200

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
```

---

## 执行预览

```bash
# 列出书籍（默认分页）
$ curl http://localhost:5000/api/v1/books
{"data":[...],"meta":{"page":1,"per_page":10,"total":2,"pages":1}}

# 创建书籍
$ curl -X POST http://localhost:5000/api/v1/books \
  -H "Content-Type: application/json" \
  -d '{"title":"New Book","author":"Test","year":2024}'
{"data":{"id":3,"title":"New Book","author":"Test","year":2024}}

# 获取单本书
$ curl http://localhost:5000/api/v1/books/3
{"data":{"id":3,"title":"New Book","author":"Test","year":2024}}

# 更新
$ curl -X PUT http://localhost:5000/api/v1/books/3 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Book"}'
{"data":{"id":3,"title":"Updated Book","author":"Test","year":2024}}

# 删除
$ curl -X DELETE http://localhost:5000/api/v1/books/3
{"message":"deleted"}

# 缺少必填字段
$ curl -X POST http://localhost:5000/api/v1/books \
  -H "Content-Type: application/json" \
  -d '{"author":"Test"}'
{"error":"Missing: title","status":400}
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| Content-Type | POST/PUT请求必须设置`application/json` |
| 状态码 | 201创建、204无内容（DELETE可选）、400错误请求、404未找到 |
| 分页上限 | 设置`per_page`最大值，防止一次查太多数据 |
| 输入验证 | 永远不要信任客户端输入 |
| API版本 | URL中加版本号`/api/v1/`，方便后续升级 |
| CORS | 前端调用需要配置`flask-cors` |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| 用GET做删除/修改操作 | 严格遵循HTTP语义，DELETE/PUT |
| 返回裸数组`[...]` | 包裹成`{"data": [...]}`，方便扩展 |
| 不做输入验证 | 所有入口验证必填字段和类型 |
| 状态码全返回200 | 正确使用201/400/404等语义状态码 |
| `request.json`直接取值 | 用`get_json(silent=True)` + 验证 |
| URL用动词`/createBook` | 用名词复数`/books` + POST方法 |

---

## 练习题

### 🟢 基础题
1. 实现一个`/api/time`接口，返回当前时间的JSON
2. 给v1的books API添加搜索功能，支持按`title`关键字搜索

### 🟡 进阶题
3. 实现一个完整的用户CRUD API，包含注册（密码哈希）、查询、更新、删除
4. 给API添加分页响应中的`next`/`prev`链接

### 🔴 挑战题
5. 实现API限流（Rate Limiting），每个IP每分钟最多60次请求，使用Flask中间件

---

## 知识点总结

```
Flask RESTful API知识树
├── REST原则
│   ├── 资源导向URL设计
│   ├── HTTP方法语义
│   ├── 状态码规范
│   └── 无状态通信
├── 请求处理
│   ├── request.get_json()
│   ├── request.args (查询参数)
│   ├── 输入验证装饰器
│   └── 错误响应封装
├── 响应格式
│   ├── jsonify()
│   ├── 统一响应结构
│   └── 分页meta信息
├── 项目组织
│   ├── Blueprint蓝图
│   ├── API版本控制
│   └── 工厂模式
└── 最佳实践
    ├── CORS配置
    ├── API文档(Swagger)
    └── 限流
```

---

## 举一反三

| 学到什么 | 可以迁移到 |
|---------|----------|
| REST设计规范 | 任何语言的后端API开发 |
| 验证装饰器 | FastAPI的Depends、Django装饰器 |
| 分页逻辑 | 数据库查询分页（SQL LIMIT/OFFSET） |
| Blueprint组织 | Django Apps、FastAPI Router |
| API版本控制 | 微服务版本管理、gRPC版本 |

---

## 参考资料

- [RESTful API设计指南](https://restfulapi.net/)
- [Flask官方文档 - API](https://flask.palletsprojects.com/en/latest/api/)
- [HTTP状态码详解](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [OpenAPI/Swagger规范](https://swagger.io/specification/)

---

## 代码演进

### v1 → v2
- 添加分页功能（`paginate`辅助函数）
- 添加过滤查询（`author`、`year`参数）
- 输入验证装饰器`@validate_json`
- `per_page`上限保护

### v2 → v3
- 从单文件 → Blueprint蓝图组织
- API版本控制`/api/v1/`
- 统一响应格式`{"data": ..., "meta": ...}`
- 统一错误响应`error_response()`
- `create_app()`工厂模式
- `JSON_SORT_KEYS = False`保持字段顺序
