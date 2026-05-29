---
title: "003 - Flask SQLAlchemy实战：用ORM优雅操作数据库"
slug: "003-flask-sqlalchemy"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.473+08:00"
updated_at: "2026-04-29T10:02:47.683+08:00"
reading_time: 41
tags: []
---

## 难度标注

> 🟡 中级 | 适合已掌握Flask基础，需要数据持久化的读者

---

## 概念讲解

### 什么是SQLAlchemy？

SQLAlchemy是Python最强大的ORM（对象关系映射）框架，它让你用Python类操作数据库，而不用手写SQL。

**Flask-SQLAlchemy**是Flask的扩展，简化了SQLAlchemy在Flask中的集成。

### ORM vs 原生SQL

| 特性 | ORM (SQLAlchemy) | 原生SQL |
|------|-------------------|---------|
| 学习曲线 | 中等 | 低 |
| 开发效率 | 高 | 低 |
| 可维护性 | 好 | 一般 |
| 数据库迁移 | 方便 | 手动 |
| 性能控制 | 需要了解底层 | 直观 |
| 跨数据库 | ✅ 轻松切换 | ❌ 需重写 |

### 核心概念

1. **Model（模型）**：Python类，对应数据库表
2. **Column（字段）**：类的属性，对应表的列
3. **Session（会话）**：与数据库交互的入口
4. **Relationship（关系）**：表之间的关联（一对多、多对多等）
5. **Migration（迁移）**：数据库结构变更管理（Flask-Migrate）

---

## 脑图

```
Flask-SQLAlchemy
├── 配置
│   ├── SQLALCHEMY_DATABASE_URI
│   ├── SQLALCHEMY_TRACK_MODIFICATIONS
│   └── SQLite / PostgreSQL / MySQL
├── 模型定义
│   ├── db.Model基类
│   ├── Column类型
│   ├── 主键与自增
│   └── 关系定义
├── CRUD操作
│   ├── Create - db.session.add()
│   ├── Read - Model.query
│   ├── Update - 修改属性+commit
│   └── Delete - db.session.delete()
├── 查询进阶
│   ├── filter() / filter_by()
│   ├── order_by()
│   ├── paginate()
│   ├── join()
│   └── 聚合函数
├── 关系
│   ├── 一对多 (db.relationship)
│   ├── 多对多 (关联表)
│   └── 一对一
└── 迁移
    ├── flask db init
    ├── flask db migrate
    └── flask db upgrade
```

---

## 完整Python代码

### v1: 基础模型与CRUD

```python
# app_v1.py - Basic SQLAlchemy models and CRUD
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
# SQLite database file
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///blog.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# Model definition
class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=True)
    published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        """Convert model to dictionary for API responses"""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "published": self.published,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

# Create tables
with app.app_context():
    db.create_all()

# CRUD operations
def create_post(title, content="", published=False):
    """Create a new post"""
    post = Post(title=title, content=content, published=published)
    db.session.add(post)
    db.session.commit()
    return post

def get_post(post_id):
    """Get a post by ID"""
    return Post.query.get(post_id)

def get_all_posts():
    """Get all posts"""
    return Post.query.all()

def update_post(post_id, **kwargs):
    """Update a post"""
    post = Post.query.get(post_id)
    if not post:
        return None
    for key, value in kwargs.items():
        if hasattr(post, key):
            setattr(post, key, value)
    db.session.commit()
    return post

def delete_post(post_id):
    """Delete a post"""
    post = Post.query.get(post_id)
    if post:
        db.session.delete(post)
        db.session.commit()
        return True
    return False

# Demo
if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        # Create
        p1 = create_post("First Post", "Hello SQLAlchemy!")
        p2 = create_post("Second Post", "Flask + SQLAlchemy rocks!", published=True)
        print(f"Created: {p1.to_dict()}")

        # Read
        print(f"All posts: {[p.to_dict() for p in get_all_posts()]}")
        print(f"Post 1: {get_post(1).to_dict()}")

        # Update
        update_post(1, title="Updated First Post", published=True)
        print(f"Updated: {get_post(1).to_dict()}")

        # Delete
        delete_post(2)
        print(f"After delete: {[p.to_dict() for p in get_all_posts()]}")
```

### v2: 关系与查询进阶

```python
# app_v2.py - Relationships and advanced queries
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///blog.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# Association table for many-to-many
post_tags = db.Table(
    "post_tags",
    db.Column("post_id", db.Integer, db.ForeignKey("posts.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    posts = db.relationship("Post", backref="author", lazy=True)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "email": self.email}

class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Foreign key to users table
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    # Many-to-many with tags
    tags = db.relationship("Tag", secondary=post_tags, backref="posts", lazy="dynamic")

    def to_dict(self, include_author=False, include_tags=False):
        d = {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "published": self.published,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_author and self.author:
            d["author"] = self.author.to_dict()
        if include_tags:
            d["tags"] = [t.to_dict() for t in self.tags]
        return d

class Tag(db.Model):
    __tablename__ = "tags"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "name": self.name}

with app.app_context():
    db.create_all()

def seed_data():
    """Seed sample data"""
    with app.app_context():
        db.create_all()
        # Create users
        u1 = User(username="alice", email="alice@example.com")
        u2 = User(username="bob", email="bob@example.com")
        db.session.add_all([u1, u2])
        db.session.flush()  # Get IDs without committing

        # Create tags
        t1 = Tag(name="Python")
        t2 = Tag(name="Flask")
        t3 = Tag(name="Tutorial")
        db.session.add_all([t1, t2, t3])
        db.session.flush()

        # Create posts with relationships
        p1 = Post(title="Learn Flask", content="Flask is great!", author=u1, tags=[t1, t2])
        p2 = Post(title="Python Tips", content="Use list comprehensions!", author=u1, tags=[t1, t3])
        p3 = Post(title="Bob's Post", content="Hello world", author=u2, published=True)
        db.session.add_all([p1, p2, p3])
        db.session.commit()
        print("Seeded data successfully")

def demo_queries():
    """Demonstrate advanced queries"""
    with app.app_context():
        # filter_by (simple equality)
        alice_posts = Post.query.filter_by(user_id=1).all()
        print(f"Alice's posts: {len(alice_posts)}")

        # filter (complex conditions)
        recent = Post.query.filter(Post.created_at > datetime(2020, 1, 1)).all()
        print(f"Recent posts: {len(recent)}")

        # Order by
        ordered = Post.query.order_by(Post.created_at.desc()).all()
        print(f"Newest first: {[p.title for p in ordered]}")

        # Pagination
        page = Post.query.paginate(page=1, per_page=2)
        print(f"Page 1: {[p.title for p in page.items]}, Total: {page.total}")

        # Join
        posts_with_authors = (
            db.session.query(Post, User)
            .join(User, Post.user_id == User.id)
            .all()
        )
        for post, user in posts_with_authors:
            print(f"  {post.title} by {user.username}")

        # Aggregate
        post_count = db.session.query(db.func.count(Post.id)).scalar()
        print(f"Total posts: {post_count}")

        # Group by
        from sqlalchemy import func
        counts = (
            db.session.query(User.username, func.count(Post.id))
            .join(Post, User.id == Post.user_id)
            .group_by(User.username)
            .all()
        )
        for username, count in counts:
            print(f"  {username}: {count} posts")

        # Tags for a post
        post = Post.query.first()
        print(f"Tags for '{post.title}': {[t.name for t in post.tags]}")

        # Posts with a specific tag
        tag = Tag.query.filter_by(name="Python").first()
        print(f"Posts tagged 'Python': {[p.title for p in tag.posts]}")

if __name__ == "__main__":
    seed_data()
    demo_queries()
```

### v3: 完整Flask+SQLAlchemy应用（含迁移）

```python
# app_v3.py - Full Flask + SQLAlchemy app with Flask-Migrate
import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime

db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__)

    # Database configuration
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'app.db')}"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Register routes
    register_routes(app)

    return app

# Models
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    posts = db.relationship("Post", backref="author", lazy="dynamic")

class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    published = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "published": self.published,
            "author": self.author.username if self.author else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

def register_routes(app):
    @app.route("/api/posts", methods=["GET"])
    def list_posts():
        query = Post.query.filter_by(published=True)

        # Search
        search = request.args.get("q")
        if search:
            query = query.filter(Post.title.contains(search))

        # Pagination
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 10, type=int), 50)
        paginated = query.order_by(Post.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            "data": [p.to_dict() for p in paginated.items],
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": paginated.total,
                "pages": paginated.pages,
            }
        })

    @app.route("/api/posts/<int:post_id>", methods=["GET"])
    def get_post(post_id):
        post = Post.query.get_or_404(post_id)
        return jsonify({"data": post.to_dict()})

    @app.route("/api/posts", methods=["POST"])
    def create_post():
        data = request.get_json()
        if not data or "title" not in data:
            return jsonify({"error": "title is required"}), 400

        post = Post(
            title=data["title"],
            content=data.get("content", ""),
            published=data.get("published", False),
            user_id=data.get("user_id"),
        )
        db.session.add(post)
        db.session.commit()
        return jsonify({"data": post.to_dict()}), 201

    @app.route("/api/posts/<int:post_id>", methods=["PUT"])
    def update_post(post_id):
        post = Post.query.get_or_404(post_id)
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        for key in ("title", "content", "published"):
            if key in data:
                setattr(post, key, data[key])
        db.session.commit()
        return jsonify({"data": post.to_dict()})

    @app.route("/api/posts/<int:post_id>", methods=["DELETE"])
    def delete_post(post_id):
        post = Post.query.get_or_404(post_id)
        db.session.delete(post)
        db.session.commit()
        return jsonify({"message": "deleted"}), 200

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
```

迁移命令：

```bash
# 初始化迁移仓库（仅需一次）
flask db init

# 生成迁移脚本
flask db migrate -m "add user and post tables"

# 执行迁移
flask db upgrade

# 回滚上一次迁移
flask db downgrade
```

---

## 执行预览

```bash
# 安装依赖
$ pip install flask-sqlalchemy flask-migrate

# 运行v1（自动创建SQLite数据库）
$ python app_v1.py
Created: {'id': 1, 'title': 'First Post', ...}
All posts: [{'id': 1, ...}, {'id': 2, ...}]
Updated: {'id': 1, 'title': 'Updated First Post', ...}
After delete: [{'id': 1, ...}]

# v3迁移流程
$ export FLASK_APP=app_v3.py
$ flask db init
  Creating directory 'migrations' ... done

$ flask db migrate -m "initial"
  Generating migrations/versions/001_initial.py ... done

$ flask db upgrade
  Running upgrade -> 001, initial

# 测试API
$ curl http://localhost:5000/api/posts
{"data":[],"meta":{"page":1,"per_page":10,"total":0,"pages":0}}

$ curl -X POST http://localhost:5000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"My Post","content":"Hello DB!"}'
{"data":{"id":1,"title":"My Post","content":"Hello DB!",...}}
```

---

## 注意事项

| 项目 | 说明 |
|------|------|
| 数据库URI | SQLite用`sqlite:///path`，PostgreSQL用`postgresql://user:pass@host/db` |
| 会话管理 | 每次操作后记得`db.session.commit()` |
| 延迟加载 | `lazy=True`首次访问时查询，`lazy="dynamic"`返回查询对象 |
| N+1问题 | 关联查询时注意，用`joinedload()`优化 |
| 连接池 | 生产环境配置`SQLALCHEMY_POOL_SIZE` |
| 编码 | MySQL需要设置`charset=utf8mb4` |

---

## 避坑指南

| ❌ 错误做法 | ✅ 正确做法 |
|------------|------------|
| `db.create_all()`做迁移 | 使用`Flask-Migrate`管理数据库变更 |
| 在循环里逐条commit | 批量操作后一次commit |
| 忘记`db.session.commit()` | 增删改后必须commit |
| 用字符串拼接SQL | 用ORM的`filter()`或`filter_by()` |
| `Post.query.get()`不检查None | 用`get_or_404()`或手动判断 |
| `lazy="dynamic"`到处用 | 理解lazy选项，按需选择 |

---

## 练习题

### 🟢 基础题
1. 定义一个`Comment`模型，包含`content`、`post_id`（外键）、`created_at`字段
2. 实现一个函数，查询某个用户的所有已发布文章

### 🟡 进阶题
3. 给`Post`模型添加多对多标签关系，实现"查找带有某个标签的所有文章"
4. 实现一个`GET /api/stats`接口，返回文章总数、用户总数、每用户文章数

### 🔴 挑战题
5. 实现软删除（`deleted_at`字段），让查询自动过滤已删除记录（用SQLAlchemy事件或`query`属性覆盖）

---

## 知识点总结

```
Flask-SQLAlchemy知识树
├── 配置
│   ├── SQLALCHEMY_DATABASE_URI
│   ├── SQLALCHEMY_TRACK_MODIFICATIONS = False
│   └── 多数据库支持
├── 模型
│   ├── db.Model + db.Column
│   ├── 字段类型: String/Text/Integer/Boolean/DateTime
│   ├── 约束: nullable/unique/default/index
│   └── to_dict() 序列化
├── CRUD
│   ├── db.session.add() + commit()
│   ├── Model.query.get() / get_or_404()
│   ├── 修改属性 + commit
│   └── db.session.delete() + commit()
├── 查询
│   ├── filter_by() (等值)
│   ├── filter() (复杂条件)
│   ├── order_by() / limit() / offset()
│   ├── paginate()
│   └── func.count() 等聚合
├── 关系
│   ├── db.ForeignKey()
│   ├── db.relationship(backref=)
│   ├── 一对多 / 多对多
│   └── lazy加载策略
└── 迁移
    ├── flask db init/migrate/upgrade
    └── flask db downgrade
```

---

## 举一反三

| 学到什么 | 可以迁移到 |
|---------|----------|
| ORM概念 | Django ORM、SQLModel、Peewee |
| 数据库迁移 | Alembic（独立）、Django Migrations |
| 关系设计 | 任何关系数据库建模 |
| 会话模式 | SQLAlchemy Core、其他ORM |
| 分页查询 | 任何Web框架的分页实现 |

---

## 参考资料

- [Flask-SQLAlchemy官方文档](https://flask-sqlalchemy.palletsprojects.com/)
- [SQLAlchemy官方文档](https://docs.sqlalchemy.org/)
- [Flask-Migrate文档](https://flask-migrate.readthedocs.io/)
- [SQLAlchemy关系模式](https://docs.sqlalchemy.org/en/20/orm/basic_relationships.html)

---

## 代码演进

### v1 → v2
- 单模型 → 多模型关系（User-Post一对多、Post-Tag多对多）
- 基础CRUD → 高级查询（filter、join、聚合、分页）
- 添加示例数据种子和查询演示

### v2 → v3
- 脚本式 → 完整Flask REST API
- 手动建表 → Flask-Migrate数据库迁移
- 添加`get_or_404()`便捷方法
- 添加`index=True`优化查询性能
- 添加`updated_at`自动更新时间戳
- 环境变量配置数据库连接
