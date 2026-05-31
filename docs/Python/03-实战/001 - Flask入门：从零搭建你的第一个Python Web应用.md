---
title: "001 - Flask入门：从零搭建你的第一个Python Web应用"
slug: "001-flask-basics"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.462+08:00"
updated_at: "2026-04-29T10:02:47.667+08:00"
reading_time: 21
tags: []
---

## 难度标注

> 🟢 入门级 | 适合有Python基础、刚接触Web开发的读者

---

## 概念讲解

### 什么是Flask？

Flask是一个基于Python的轻量级Web框架，由Armin Ronacher开发。它的核心哲学是**"微框架"（Micro Framework）**——只提供Web开发的核心功能，其他一切通过扩展按需引入。

**核心三件套：**
- **Werkzeug**：WSGI工具库，处理HTTP请求/响应
- **Jinja2**：模板引擎，渲染HTML页面
- **Click**：CLI工具，管理命令行操作

### Flask vs Django

| 特性 | Flask | Django |
|------|-------|--------|
| 定位 | 微框架 | 全栈框架 |
| 学习曲线 | 低 | 中高 |
| 灵活度 | 极高 | 约定大于配置 |
| ORM | 需自行集成 | 内置Django ORM |
| 适用场景 | API/微服务/中小项目 | 大型全栈应用 |

### WSGI是什么？

WSGI（Web Server Gateway Interface）是Python Web应用与Web服务器之间的标准接口协议。Flask应用本质上就是一个WSGI应用。

```
浏览器 → Web服务器(Nginx) → WSGI服务器(Gunicorn) → Flask应用
```

---

## 脑图

```
Flask入门
├── 核心概念
│   ├── 路由(Routing)
│   ├── 视图函数(View Function)
│   ├── 请求(Request)
│   └── 响应(Response)
├── 路由系统
│   ├── @app.route()
│   ├── 动态路由 <name>
│   ├── HTTP方法 GET/POST
│   └── url_for() 反向解析
├── 模板渲染
│   ├── Jinja2基础
│   ├── 模板继承
│   └── 模板变量
├── 请求处理
│   ├── request对象
│   ├── 表单数据
│   └── JSON数据
└── 部署基础
    ├── 开发服务器
    └── 生产部署概述
```

---

## 完整Python代码

### v1: 最小Flask应用

```python
# app_v1.py - Minimal Flask application
from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello, Flask!"

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

### v2: 路由与模板

```python
# app_v2.py - Routes and templates
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

# In-memory data store
tasks = [
    {"id": 1, "title": "Learn Flask", "done": False},
    {"id": 2, "title": "Build a project", "done": False},
]

@app.route("/")
def index():
    """Home page - show all tasks"""
    return render_template("index.html", tasks=tasks)

@app.route("/add", methods=["POST"])
def add_task():
    """Add a new task"""
    title = request.form.get("title", "").strip()
    if title:
        new_id = max(t["id"] for t in tasks) + 1 if tasks else 1
        tasks.append({"id": new_id, "title": title, "done": False})
    return redirect(url_for("index"))

@app.route("/toggle/<int:task_id>")
def toggle_task(task_id):
    """Toggle task completion status"""
    for task in tasks:
        if task["id"] == task_id:
            task["done"] = not task["done"]
            break
    return redirect(url_for("index"))

@app.route("/delete/<int:task_id>")
def delete_task(task_id):
    """Delete a task"""
    global tasks
    tasks = [t for t in tasks if t["id"] != task_id]
    return redirect(url_for("index"))

@app.route("/user/<name>")
def user_profile(name):
    """Dynamic route example"""
    return render_template("profile.html", name=name)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

模板文件 `templates/index.html`：

```html
<!DOCTYPE html>
<html>
<head><title>Flask Todo</title></head>
<body>
  <h1>My Tasks</h1>
  <form action="{{ url_for('add_task') }}" method="POST">
    <input type="text" name="title" placeholder="New task..." required>
    <button type="submit">Add</button>
  </form>
  <ul>
  {% for task in tasks %}
    <li style="{{ 'text-decoration: line-through' if task.done }}">
      {{ task.title }}
      <a href="{{ url_for('toggle_task', task_id=task.id) }}">✓</a>
      <a href="{{ url_for('delete_task', task_id=task.id) }}">✗</a>
    </li>
  {% endfor %}
  </ul>
</body>
</html>
```

### v3: 完整项目结构

```python
# app_v3.py - Structured Flask app with error handling, config, and blueprints
import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, abort

# Configuration class
class Config:
    DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")

def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # In-memory store (replace with database in production)
    app.extensions["tasks"] = []

    # Register error handlers
    register_error_handlers(app)

    # Register routes
    register_routes(app)

    return app

def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return render_template("404.html"), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

def register_routes(app):
    @app.route("/")
    def index():
        tasks = app.extensions["tasks"]
        return render_template("index.html", tasks=tasks)

    @app.route("/api/tasks", methods=["GET"])
    def api_list_tasks():
        """REST API: list all tasks"""
        return jsonify(app.extensions["tasks"])

    @app.route("/api/tasks", methods=["POST"])
    def api_create_task():
        """REST API: create a task"""
        data = request.get_json()
        if not data or "title" not in data:
            abort(400, description="title is required")
        tasks = app.extensions["tasks"]
        new_id = max(t["id"] for t in tasks) + 1 if tasks else 1
        task = {"id": new_id, "title": data["title"], "done": False}
        tasks.append(task)
        return jsonify(task), 201

    @app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
    def api_delete_task(task_id):
        """REST API: delete a task"""
        tasks = app.extensions["tasks"]
        task = next((t for t in tasks if t["id"] == task_id), None)
        if not task:
            abort(404)
        tasks.remove(task)
        return jsonify({"message": "deleted"}), 200

    @app.route("/health")
    def health():
        """Health check endpoint"""
        return jsonify({"status": "ok"})

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
```

---

## 执行预览

```bash
# 安装Flask
$ pip install flask

# 运行v1
$ python app_v1.py
 * Serving Flask app 'app_v1'
 * Debug mode: on
 * Running on http://127.0.0.1:5000

# 测试访问
$ curl http://127.0.0.1:5000/
Hello, Flask!

# 测试v3的API
$ curl -X POST http://127.0.0.1:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Flask"}'
{"id":1,"title":"Learn Flask","done":false}

$ curl http://127.0.0.1:5000/api/tasks
[{"id":1,"title":"Learn Flask","done":false}]

$ curl http://127.0.0.1:5000/health
{"status":"ok"}
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| debug模式 | 开发时开启，生产必须关闭 |
| SECRET_KEY | 生产环境必须设置强随机值 |
| 内置服务器 | 仅用于开发，生产用Gunicorn/uWSGI |
| 线程安全 | 默认多线程，注意共享状态 |
| 静态文件 | 默认放在`static/`目录，通过`/static/`访问 |
| 模板目录 | 默认放在`templates/`目录 |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| `app.run()` 不加`debug=True` | 开发时始终开启debug，方便调试 |
| 把所有代码写在单文件 | 超过200行就用Blueprint拆分 |
| 直接`return`拼接HTML字符串 | 使用Jinja2模板引擎 |
| 硬编码URL做跳转 | 使用`url_for()`反向解析 |
| 用全局变量存数据 | 使用数据库或Redis |
| `app.run(host="0.0.0.0")` 在生产环境 | 用Gunicorn等WSGI服务器 |

---

## 练习题

### 🟢 基础题
1. 创建一个Flask应用，有两个路由：`/`返回"Welcome"，`/about`返回"About Us"
2. 实现一个路由`/greet/<name>`，返回"Hello, {name}!"

### 🟡 进阶题
3. 实现一个简单的计算器API，支持`/add?a=1&b=2`返回`{"result": 3}`
4. 使用Jinja2模板实现一个页面，展示当前时间，并根据时间段显示"早上好/下午好/晚上好"

### 🔴 挑战题
5. 实现一个完整的CRUD待办事项应用，包含：创建、读取、更新、删除，使用HTML模板渲染

---

## 知识点总结

```
Flask核心知识树
├── 应用创建
│   ├── Flask(__name__)
│   └── 工厂模式 create_app()
├── 路由
│   ├── @app.route(path)
│   ├── 动态参数 <int:id>
│   ├── HTTP方法 methods=["GET","POST"]
│   └── url_for() 反向生成URL
├── 请求与响应
│   ├── request.form  # 表单数据
│   ├── request.args  # URL参数
│   ├── request.json  # JSON body
│   └── jsonify()     # JSON响应
├── 模板
│   ├── render_template()
│   ├── {{ variable }}
│   ├── {% for %} / {% if %}
│   └── 模板继承 extends/block
└── 错误处理
    ├── @app.errorhandler(404)
    └── abort(400)
```

---

## 举一反三

| 学到什么 | 可以迁移到 |
|---------|----------|
| 路由装饰器 | FastAPI的`@app.get()`、Django的URL patterns |
| Jinja2模板 | Django模板、Ansible playbook |
| 工厂模式 | 任何框架的应用初始化 |
| REST API设计 | FastAPI、Django REST Framework |
| WSGI概念 | ASGI（异步）、Celery集成 |

---

## 参考资料

- [Flask官方文档](https://flask.palletsprojects.com/)
- [Werkzeug文档](https://werkzeug.palletsprojects.com/)
- [Jinja2模板文档](https://jinja.palletsprojects.com/)
- [Flask Mega-Tutorial (Miguel Grinberg)](https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world)

---

## 代码演进

### v1 → v2 的改进
- 从纯文本响应 → HTML模板渲染
- 添加动态路由、表单处理
- 引入`url_for()`和`redirect`

### v2 → v3 的改进
- 从单文件 → 工厂模式（`create_app`）
- 添加RESTful API支持（JSON）
- 添加错误处理（404/500）
- 添加健康检查端点
- 配置类管理，支持环境变量

### 下一步可以做什么
- 集成SQLAlchemy做数据持久化
- 添加用户认证（Flask-Login）
- 使用Blueprint拆分大型应用
- 部署到Docker + Nginx + Gunicorn
