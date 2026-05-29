---
title: "006 - Django入门：从零搭建Web应用"
slug: "006-django-basics"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.489+08:00"
updated_at: "2026-04-29T10:02:47.709+08:00"
reading_time: 32
tags: []
---

# Django入门：从零搭建Web应用

> **难度标注：** ⭐⭐⭐☆☆（中级）
> **前置知识：** Python基础、HTML基础概念、数据库基础概念
> **预计阅读时间：** 30分钟

---

## 一、概念讲解

Django 是一个高级 Python Web 框架，鼓励快速开发和干净实用的设计。核心理念是 **DRY（Don't Repeat Yourself）** 和 **Batteries Included（自带一切）**。

### Django vs 其他框架

| 特性 | Django | Flask | FastAPI |
|------|--------|-------|---------|
| 定位 | 全栈框架 | 微框架 | API框架 |
| ORM | ✅ 内置 | ❌ 需SQLAlchemy | ❌ 需SQLAlchemy |
| Admin后台 | ✅ 内置 | ❌ | ❌ |
| 模板引擎 | ✅ 内置 | ❌ 需Jinja2 | ❌ |
| 认证系统 | ✅ 内置 | ❌ | ❌ |
| 迁移系统 | ✅ 内置 | ❌ | ❌ |
| 学习曲线 | 中高 | 低 | 低 |
| 适合项目 | 内容型网站 | 小型API | 高性能API |

### Django 核心架构（MTV）

```
M - Model（模型）：数据层，定义数据库结构
T - Template（模板）：展示层，渲染HTML
V - View（视图）：逻辑层，处理请求和响应
```

Django 的"自带一切"意味着：ORM、Admin后台、认证系统、表单处理、缓存框架、国际化等全部内置，开箱即用。

---

## 二、知识脑图

```
Django入门
├── 项目搭建
│   ├── django-admin startproject
│   ├── python manage.py startapp
│   └── settings.py 配置
├── Model（模型）
│   ├── Model类定义
│   ├── 字段类型（CharField, IntegerField...）
│   ├── 关系（ForeignKey, ManyToManyField）
│   ├── Meta选项
│   └── Makemigrations / Migrate
├── Admin（管理后台）
│   ├── admin.site.register
│   ├── ModelAdmin定制
│   └── list_display / search_fields
├── View（视图）
│   ├── 函数视图 (FBV)
│   ├── 类视图 (CBV)
│   └── 请求/响应对象
├── URL路由
│   ├── urlpatterns
│   ├── path() / include()
│   └── 命名URL
└── Template（模板）
    ├── 变量 {{ var }}
    ├── 标签 {% if %} {% for %}
    └── 模板继承 {% extends %}
```

---

## 三、代码演进

### v1：创建项目和模型

```bash
# Step 1: Create project and app
django-admin startproject mysite
cd mysite
python manage.py startapp blog
```

```python
# blog/models.py - Define the data model
from django.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name

class Post(models.Model):
    STATUS_CHOICES = [("draft", "Draft"), ("published", "Published")]
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    content = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
```

```python
# blog/admin.py - Register with admin site
from django.contrib import admin
from .models import Category, Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "status", "created_at"]
    list_filter = ["status", "category"]
    search_fields = ["title", "content"]
    prepopulated_fields = {"slug": ["title"]}
    date_hierarchy = "created_at"

admin.site.register(Category)
```

```python
# mysite/settings.py - Key settings to update
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "blog",  # <-- Add our app
]

TIME_ZONE = "Asia/Shanghai"
USE_TZ = True
```

v1 要点：
- **模型定义**：用Python类定义数据库表，每个属性对应一个字段
- **字段类型**：`CharField`（字符串）、`TextField`（长文本）、`SlugField`（URL友好标识）
- **关系字段**：`ForeignKey` 外键关联，`on_delete` 定义删除行为
- **Meta类**：排序、复数名称等元数据
- **Admin注册**：几行代码就能得到完整的后台管理界面

### v2：视图和URL路由

```python
# blog/views.py - Views for listing and detail
from django.shortcuts import render, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin
from .models import Post, Category

# Function-based views (FBV)
def post_list(request):
    posts = Post.objects.filter(status="published")
    categories = Category.objects.all()
    return render(request, "blog/post_list.html", {
        "posts": posts,
        "categories": categories,
    })

def post_detail(request, slug):
    post = get_object_or_404(Post, slug=slug, status="published")
    return render(request, "blog/post_detail.html", {"post": post})

# Class-based views (CBV) - recommended for CRUD
class PostListView(ListView):
    model = Post
    template_name = "blog/post_list.html"
    context_object_name = "posts"
    paginate_by = 10
    queryset = Post.objects.filter(status="published")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["categories"] = Category.objects.all()
        return context

class PostDetailView(DetailView):
    model = Post
    template_name = "blog/post_detail.html"
    context_object_name = "post"

    def get_queryset(self):
        return Post.objects.filter(status="published")

class PostCreateView(LoginRequiredMixin, CreateView):
    model = Post
    fields = ["title", "slug", "content", "status", "category"]
    template_name = "blog/post_form.html"

    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)
```

```python
# blog/urls.py - URL routing
from django.urls import path
from . import views

app_name = "blog"

urlpatterns = [
    path("", views.PostListView.as_view(), name="post_list"),
    path("post/<slug:slug>/", views.PostDetailView.as_view(), name="post_detail"),
    path("post/new/", views.PostCreateView.as_view(), name="post_create"),
]
```

```python
# mysite/urls.py - Include app URLs
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("blog/", include("blog.urls")),
]
```

v2 新增：
- **FBV vs CBV**：函数视图简单直接，类视图复用性强（推荐CRUD用CBV）
- **通用视图**：`ListView`、`DetailView`、`CreateView` 内置常见逻辑
- **LoginRequiredMixin**：类视图版的 `@login_required`
- **URL命名空间**：`app_name` 避免路由名冲突

### v3：完整项目含模板、表单和API

```python
# blog/forms.py - Model forms with validation
from django import forms
from .models import Post

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ["title", "slug", "content", "status", "category"]
        widgets = {
            "content": forms.Textarea(attrs={"rows": 10, "class": "form-control"}),
            "title": forms.TextInput(attrs={"class": "form-control"}),
        }

    def clean_title(self):
        title = self.cleaned_data["title"]
        if len(title) < 5:
            raise forms.ValidationError("Title must be at least 5 characters")
        return title
```

```python
# blog/api.py - Django REST Framework API
from rest_framework import serializers, viewsets, permissions
from .models import Post, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

class PostSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Post
        fields = ["id", "title", "slug", "author_name", "content",
                  "category_name", "status", "created_at"]

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.filter(status="published")
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
```

```html
<!-- blog/templates/blog/base.html - Base template -->
<!DOCTYPE html>
<html>
<head><title>{% block title %}My Blog{% endblock %}</title></head>
<body>
<nav><a href="{% url 'blog:post_list' %}">Home</a></nav>
{% block content %}{% endblock %}
<footer>&copy; 2024 My Blog</footer>
</body>
</html>
```

```html
<!-- blog/templates/blog/post_list.html - List template -->
{% extends "blog/base.html" %}
{% block content %}
<h1>Blog Posts</h1>
{% for post in posts %}
<article>
    <h2><a href="{% url 'blog:post_detail' post.slug %}">{{ post.title }}</a></h2>
    <p>By {{ post.author }} on {{ post.created_at|date:"M d, Y" }}</p>
    <p>{{ post.content|truncatewords:30 }}</p>
</article>
{% empty %}
<p>No posts yet.</p>
{% endfor %}

{% if is_paginated %}
<div class="pagination">
    {% if page_obj.has_previous %}
    <a href="?page={{ page_obj.previous_page_number }}">Previous</a>
    {% endif %}
    <span>Page {{ page_obj.number }} of {{ page_obj.paginator.num_pages }}</span>
    {% if page_obj.has_next %}
    <a href="?page={{ page_obj.next_page_number }}">Next</a>
    {% endif %}
</div>
{% endif %}
{% endblock %}
```

v3 新增：
- **ModelForm**：自动从模型生成表单，内置验证
- **DRF API**：ViewSet + Serializer 提供完整REST API
- **模板继承**：`base.html` 定义布局，子模板用 `{% block %}` 覆盖
- **分页模板**：`ListView` 自动分页，模板中用 `page_obj` 控制导航

---

## 四、执行预览

```bash
# 创建项目和应用
$ django-admin startproject mysite && cd mysite
$ python manage.py startapp blog

# 创建迁移并应用
$ python manage.py makemigrations blog
Migrations for 'blog':
  blog/migrations/0001_initial.py
    - Create model Category
    - Create model Post

$ python manage.py migrate
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying auth.0001_initial... OK
  Applying blog.0001_initial... OK

# 创建超级用户
$ python manage.py createsuperuser
Username: admin
Password: ********
Superuser created successfully.

# 启动开发服务器
$ python manage.py runserver
Starting development server at http://127.0.0.1:8000/

# 访问管理后台 -> http://127.0.0.1:8000/admin/
# 访问博客列表 -> http://127.0.0.1:8000/blog/
```

---

## 五、注意事项

| 事项 | 说明 | 建议 |
|------|------|------|
| INSTALLED_APPS | 必须添加自定义app | 放在默认app之后 |
| makemigrations vs migrate | make生成文件，migrate执行 | 先make后migrate |
| slug字段 | 用于URL友好标识 | 配合prepopulated_fields自动生成 |
| DEBUG模式 | settings.py中DEBUG=True | 生产必须设False |
| SECRET_KEY | 项目密钥 | 生产环境从环境变量读取 |
| 静态文件 | collectstatic收集 | 部署时需要执行 |
| 时区设置 | USE_TZ=True | 配置TIME_ZONE = "Asia/Shanghai" |

---

## 六、避坑指南

### ❌ 忘记注册App
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    # ... 缺少自己的app ❌
]
```
### ✅ 正确注册
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    # ...
    "blog",  # ✅ 添加自定义app
]
```

### ❌ 直接操作数据库
```bash
ALTER TABLE blog_post ADD COLUMN tags TEXT;  # ❌ 绕过迁移系统
```
### ✅ 使用迁移系统
```bash
# 修改models.py后
python manage.py makemigrations  # ✅ 生成迁移文件
python manage.py migrate         # ✅ 应用迁移
```

### ❌ View中不处理不存在的对象
```python
def post_detail(request, pk):
    post = Post.objects.get(pk=pk)  # ❌ DoesNotExist异常 -> 500
```
### ✅ 使用 get_object_or_404
```python
from django.shortcuts import get_object_or_404

def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)  # ✅ 不存在返回404
```

### ❌ URL缺少末尾斜杠
```python
path("blog", views.post_list),  # ❌ Django默认需要斜杠
```
### ✅ 正确的URL
```python
path("blog/", views.post_list),  # ✅ 带末尾斜杠
```

### ❌ 在settings中硬编码SECRET_KEY
```python
SECRET_KEY = "my-super-secret-key"  # ❌ 提交到Git就泄露了
```
### ✅ 从环境变量读取
```python
import os
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-key")  # ✅
```

---

## 七、练习题

### 🟢 入门题
1. 创建Django项目 `library`，包含 `books` app，定义Book模型(title, author, isbn, published_date)
2. 为Book模型注册Admin，配置list_display和search_fields

### 🟡 进阶题
3. 实现Book的CRUD视图（列表、详情、创建、编辑、删除），使用类视图
4. 添加模板继承：创建base.html含导航栏和页脚

### 🔴 挑战题
5. 实现完整博客系统：文章CRUD、分类管理、评论系统（一对多关系）、用户认证、分页、搜索

---

## 八、知识点总结

```
Django入门知识树
├── 项目结构
│   ├── manage.py（命令行工具）
│   ├── settings.py（项目配置）
│   ├── urls.py（路由入口）
│   └── wsgi.py / asgi.py（部署入口）
├── App结构
│   ├── models.py（数据模型）
│   ├── views.py（视图逻辑）
│   ├── urls.py（子路由）
│   ├── admin.py（后台配置）
│   ├── forms.py（表单）
│   └── templates/（HTML模板）
├── ORM核心
│   ├── 模型定义（Field类型）
│   ├── 查询（objects.filter/get/all）
│   ├── 关系（ForeignKey/ManyToMany）
│   └── 迁移（makemigrations/migrate）
└── 视图与模板
    ├── FBV vs CBV
    ├── 模板语法 ({{ }} / {% %})
    └── 模板继承 (extends/block)
```

---

## 九、举一反三

| 场景 | 方案 | 关键组件 |
|------|------|----------|
| 用户认证 | 内置auth系统 | User模型、LoginView、装饰器 |
| API开发 | Django REST Framework | Serializer、ViewSet、Router |
| 文件上传 | Model的FileField | MEDIA_ROOT配置 |
| 缓存 | 内置缓存框架 | cache_page装饰器、Redis后端 |
| 国际化 | 内置i18n | {% trans %}标签 |
| 测试 | TestCase类 | Client、assertContains |
| 部署 | Gunicorn + Nginx | collectstatic、WSGI |
| Celery任务 | django-celery | 异步任务、定时任务 |

---

## 十、参考资料

1. **Django官方文档**：https://docs.djangoproject.com/ （最权威，教程详细）
2. **Django Girls教程**：https://tutorial.djangogirls.org/ （适合新手）
3. **Django REST Framework**：https://www.django-rest-framework.org/ （API开发必读）
4. **Two Scoops of Django**：最佳实践书籍
5. **Django by Example**：实战项目驱动学习

---

## 十一、代码演进总结

| 版本 | 重点 | 新增能力 |
|------|------|----------|
| v1 | 模型+Admin | 模型定义、迁移、Admin后台 |
| v2 | 视图+路由 | FBV/CBV、URL路由、模板渲染 |
| v3 | 完整项目 | DRF API、表单验证、模板继承、分页 |

**下一步学习：** Django进阶 - 信号、中间件、缓存、Celery、部署实战
