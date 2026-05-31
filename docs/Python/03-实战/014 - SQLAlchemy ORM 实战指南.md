---
title: "014 - SQLAlchemy ORM 实战指南"
slug: "014-sqlalchemy"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.531+08:00"
updated_at: "2026-04-29T10:02:47.77+08:00"
reading_time: 32
tags: []
---

# SQLAlchemy ORM 实战指南

> **难度：** ⭐⭐⭐ 中高级 | **预计阅读：** 30 分钟 | **标签：** Python, ORM, 数据库, SQLAlchemy

---

## 一、概念讲解

SQLAlchemy 是 Python 生态中最强大的数据库工具包，提供两个主要抽象层：

- **Core 层**：SQL Expression Language，直接操作 SQL，灵活高效
- **ORM 层**：对象关系映射，用 Python 类操作数据库，开发效率高

### ORM 核心思想

ORM（Object-Relational Mapping）将数据库表映射为 Python 类，表中的行映射为对象实例，消除 SQL 字符串拼接的痛苦。

```
Python 对象         <->         数据库表
+----------+                    +----------+
| User类    |     ORM映射       | users表   |
| - name   | <---------------> | - name   |
| - email  |                    | - email  |
+----------+                    +----------+
```

**为什么选 SQLAlchemy？**

| 对比项 | 原生 SQL | SQLAlchemy ORM |
|--------|---------|----------------|
| SQL 注入 | 手动防护 | 自动参数化 |
| 数据库迁移 | 手动写 SQL | Alembic 自动生成 |
| 多数据库 | 重写 SQL | 切换连接字符串即可 |
| 代码可读性 | 字符串拼接 | Pythonic 链式调用 |
| 类型安全 | 无 | 混合类型提示 |

---

## 二、知识脑图

```
SQLAlchemy ORM
├── 基础配置
│   ├── create_engine() 连接引擎
│   ├── sessionmaker() 会话工厂
│   ├── DeclarativeBase 声明基类
│   └── Mapped / mapped_column 类型映射
├── 模型定义
│   ├── Column 类型 (String, Integer, DateTime)
│   ├── 主键 PrimaryKeyConstraint
│   ├── 外键 ForeignKey
│   ├── 唯一约束 UniqueConstraint
│   └── 索引 Index
├── 关系映射
│   ├── relationship() 关系定义
│   ├── 一对多 (ForeignKey + relationship)
│   ├── 多对多 (association table)
│   └── 自引用关系
├── CRUD 操作
│   ├── session.add() 新增
│   ├── session.query() / select() 查询
│   ├── session.commit() 提交
│   └── session.delete() 删除
├── 查询进阶
│   ├── filter / where 条件过滤
│   ├── join / select_from 关联查询
│   ├── func 聚合函数
│   ├── order_by / limit / offset
│   └── 子查询 subquery()
└── 高级特性
    ├── eager/lazy loading
    ├── 事务控制
    ├── 事件系统
    └── Alembic 迁移
```

---

## 三、完整代码实战

### 项目：博客系统数据库层

```python
'''
Blog System Database Layer with SQLAlchemy ORM 2.0
Demonstrates: models, relationships, CRUD, queries
'''
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    create_engine, String, Text, Integer, DateTime, ForeignKey,
    func, select, desc, Table, Column, MetaData
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column,
    relationship, Session, sessionmaker
)

# ---------- 1. Base & Engine ----------
class Base(DeclarativeBase):
    '''Base class for all models.'''
    pass

engine = create_engine("sqlite:///blog.db", echo=False)
SessionLocal = sessionmaker(bind=engine)

# Association table for many-to-many: Post <-> Tag
post_tags_table = Table(
    "post_tags", Base.metadata,
    Column("post_id", Integer, ForeignKey("posts.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


# ---------- 2. Models ----------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationship: one user has many posts
    posts: Mapped[List["Post"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(username='{self.username}')>"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    content: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Foreign key to users table
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author: Mapped["User"] = relationship(back_populates="posts")

    # Many-to-many with tags
    tags: Mapped[List["Tag"]] = relationship(
        secondary=post_tags_table, back_populates="posts"
    )

    def __repr__(self):
        return f"<Post(title='{self.title}')>"


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)

    posts: Mapped[List["Post"]] = relationship(
        secondary=post_tags_table, back_populates="tags"
    )

    def __repr__(self):
        return f"<Tag(name='{self.name}')>"


# ---------- 3. CRUD Operations ----------
def create_user(session: Session, username: str, email: str, bio: str = None) -> User:
    '''Create a new user.'''
    user = User(username=username, email=email, bio=bio)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_post(session: Session, title: str, content: str,
                author_id: int, tag_names: List[str] = None) -> Post:
    '''Create a new post with optional tags.'''
    post = Post(title=title, content=content, author_id=author_id)

    # Handle tags: create if not exist
    if tag_names:
        for name in tag_names:
            tag = session.execute(
                select(Tag).where(Tag.name == name)
            ).scalar_one_or_none()
            if not tag:
                tag = Tag(name=name)
                session.add(tag)
            post.tags.append(tag)

    session.add(post)
    session.commit()
    session.refresh(post)
    return post


def get_posts_by_author(session: Session, username: str) -> List[Post]:
    '''Get all published posts by a specific author.'''
    stmt = (
        select(Post)
        .join(Post.author)
        .where(User.username == username)
        .where(Post.published == True)
        .order_by(desc(Post.created_at))
    )
    return list(session.execute(stmt).scalars())


def get_popular_tags(session: Session, limit: int = 10):
    '''Get tags sorted by post count.'''
    stmt = (
        select(Tag.name, func.count(post_tags_table.c.post_id).label("post_count"))
        .join(post_tags_table, Tag.id == post_tags_table.c.tag_id)
        .group_by(Tag.name)
        .order_by(desc("post_count"))
        .limit(limit)
    )
    return session.execute(stmt).all()


def search_posts(session: Session, keyword: str) -> List[Post]:
    '''Search in title and content.'''
    stmt = (
        select(Post)
        .where(
            (Post.title.contains(keyword)) | (Post.content.contains(keyword))
        )
        .where(Post.published == True)
        .order_by(desc(Post.created_at))
    )
    return list(session.execute(stmt).scalars())


# ---------- 4. Main Demo ----------
def main():
    Base.metadata.create_all(engine)
    print("Tables created successfully!")

    session = SessionLocal()
    try:
        alice = create_user(session, "alice", "alice@example.com", "Python dev")
        bob = create_user(session, "bob", "bob@example.com", "Data scientist")
        print(f"Created: {alice}, {bob}")

        p1 = create_post(session,
            "Getting Started with SQLAlchemy",
            "SQLAlchemy is the most popular Python ORM...",
            author_id=alice.id,
            tag_names=["Python", "Database", "ORM"]
        )
        p1.published = True

        p2 = create_post(session,
            "Advanced Query Techniques",
            "Let's explore subqueries and window functions...",
            author_id=alice.id,
            tag_names=["Python", "SQL"]
        )
        p2.published = True

        p3 = create_post(session,
            "Data Analysis with Pandas",
            "Pandas makes data analysis easy...",
            author_id=bob.id,
            tag_names=["Python", "Data Analysis"]
        )
        p3.published = True
        session.commit()

        print("\\n--- Alice's Posts ---")
        for post in get_posts_by_author(session, "alice"):
            print(f"  {post.title} (views: {post.view_count})")

        print("\\n--- Popular Tags ---")
        for name, count in get_popular_tags(session):
            print(f"  #{name}: {count} posts")

        print("\\n--- Search: 'SQL' ---")
        for post in search_posts(session, "SQL"):
            print(f"  {post.title} by {post.author.username}")
    finally:
        session.close()

if __name__ == "__main__":
    main()
```

---

## 四、执行预览

```
Tables created successfully!
Created: <User(username='alice')>, <User(username='bob')>

--- Alice's Posts ---
  Advanced Query Techniques (views: 0)
  Getting Started with SQLAlchemy (views: 0)

--- Popular Tags ---
  #Python: 3 posts
  #Database: 1 posts
  #ORM: 1 posts
  #SQL: 1 posts
  #Data Analysis: 1 posts

--- Search: 'SQL' ---
  Getting Started with SQLAlchemy by alice
  Advanced Query Techniques by alice
```

---

## 五、注意事项

| 场景 | 注意事项 | 说明 |
|------|---------|------|
| Session 管理 | 用完必关 | 使用 `try/finally` 或上下文管理器 |
| 懒加载 | 默认 lazy | 大量数据时注意 N+1 查询问题 |
| 连接池 | 默认 5 个 | 高并发需调大 `pool_size` |
| 事务隔离 | 默认 READ COMMITTED | 关键业务需明确隔离级别 |
| 批量操作 | 逐条 add 慢 | 用 `bulk_insert_mappings()` 批量插入 |
| 异步支持 | 2.0 新增 | 用 `create_async_engine` + `AsyncSession` |
| 类型映射 | Mapped vs Column | 2.0 推荐 `Mapped` + `mapped_column` |

---

## 六、避坑指南

### 错误：Session 泄漏 → 正确：上下文管理

```python
# Wrong: Session never closed
session = SessionLocal()
user = session.query(User).first()
# If exception happens, session leaks

# Correct: Use context manager
with SessionLocal() as session:
    user = session.execute(select(User).limit(1)).scalar_one()
# Session auto-closes even on exception
```

### 错误：N+1 查询问题 → 正确：Eager Loading

```python
# Wrong: Triggers N+1 queries
posts = session.execute(select(Post)).scalars().all()
for p in posts:
    print(p.author.username)  # Each access = 1 SQL query!

# Correct: Use joinedload
from sqlalchemy.orm import joinedload
stmt = select(Post).options(joinedload(Post.author))
posts = session.execute(stmt).unique().scalars().all()
```

### 错误：忘记 commit → 正确：显式事务控制

```python
# Wrong: Changes lost because no commit
session.add(user)
print("done")  # User not persisted!

# Correct: Always commit
session.add(user)
session.commit()
```

### 错误：字符串拼接 SQL → 正确：参数化查询

```python
# Wrong: SQL injection risk!
session.execute(text(f"SELECT * FROM users WHERE username = '{username}'"))

# Correct: Use ORM filter
stmt = select(User).where(User.username == username)
```

---

## 七、练习题

### 入门级

1. 定义一个 `Product` 模型（name, price, stock, created_at），创建表并插入 3 条数据
2. 查询所有 price > 100 的产品，按价格降序排列

### 中级

3. 实现 `Category` 和 `Product` 的一对多关系，支持通过 Category 查询所有产品
4. 实现分页查询函数 `paginate(query, page, per_page)`，返回指定页的数据

### 高级

5. 实现多对多关系：`Student` 和 `Course`，通过中间表关联，查询某学生的所有课程
6. 用 Alembic 为已有模型添加新字段，生成并执行迁移脚本

---

## 八、知识点总结

```
SQLAlchemy ORM 知识树
├── 连接配置
│   ├── create_engine(url, pool_size, echo)
│   ├── sessionmaker(bind=engine)
│   └── AsyncSession (异步)
├── 模型定义 (2.0 风格)
│   ├── DeclarativeBase
│   ├── Mapped[type] + mapped_column()
│   ├── __tablename__
│   └── __repr__()
├── 关系映射
│   ├── ForeignKey() 外键
│   ├── relationship() 关系
│   ├── back_populates 双向引用
│   ├── secondary 多对多中间表
│   └── cascade 级联操作
├── 查询 API (2.0 select 风格)
│   ├── select(Model) 基础查询
│   ├── .where() / .filter() 条件
│   ├── .join() 关联查询
│   ├── .order_by() 排序
│   ├── .limit() / .offset() 分页
│   └── func.count/sum/max 聚合
├── 加载策略
│   ├── lazy (默认，按需加载)
│   ├── joinedload (JOIN 一次加载)
│   ├── selectinload (IN 查询加载)
│   └── subqueryload (子查询加载)
└── 生命周期
    ├── session.add() -> 挂起态
    ├── session.commit() -> 持久态
    ├── session.rollback() -> 回滚
    └── session.close() -> 脱管态
```

---

## 九、举一反三

| 技能 | 基础用法 | 进阶场景 | 实战扩展 |
|------|---------|---------|---------|
| 模型定义 | 单表映射 | 继承（单表/联合表） | 多态查询 |
| 关系 | 一对多 | 多对多 + 自引用 | 权限树、评论嵌套 |
| 查询 | 条件过滤 | 窗口函数 + CTE | 复杂报表 |
| 事务 | 自动提交 | 分布式事务 | 订单 + 库存一致性 |
| 迁移 | 手动建表 | Alembic 版本管理 | CI/CD 自动迁移 |
| 性能 | 基本 CRUD | 批量操作 + 连接池 | 高并发服务 |

---

## 十、参考资料

- [SQLAlchemy 2.0 官方文档](https://docs.sqlalchemy.org/en/20/)
- [SQLAlchemy ORM Tutorial](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
- [Alembic 迁移工具](https://alembic.sqlalchemy.org/)
- [FastAPI + SQLAlchemy 集成](https://fastapi.tiangolo.com/tutorial/sql-databases/)

---

## 十一、代码演进

### v1：原始 SQL（手动拼接）

```python
import sqlite3
conn = sqlite3.connect("blog.db")
conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
conn.execute("INSERT INTO users (name) VALUES ('alice')")
conn.commit()
for row in conn.execute("SELECT * FROM users"):
    print(row)
conn.close()
```

### v2：SQLAlchemy Core（表达式语言）

```python
from sqlalchemy import create_engine, Table, Column, Integer, String, MetaData, select

engine = create_engine("sqlite:///blog.db")
metadata = MetaData()
users = Table("users", metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(50))
)
metadata.create_all(engine)

with engine.connect() as conn:
    conn.execute(users.insert().values(name="alice"))
    conn.commit()
    for row in conn.execute(select(users)):
        print(row)
```

### v3：SQLAlchemy ORM（本文实战代码）

- 声明式模型 + 类型注解
- 关系映射 + 懒加载控制
- 2.0 select 风格查询
- 完整 CRUD + 业务查询封装
