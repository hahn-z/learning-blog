---
title: "007 - Django REST Framework 完全指南：从手动序列化到生产级 API"
slug: "007-django-rest"
category: "Python实战"
tech_stack: "Python"
created_at: "2026-04-29T06:16:59.494+08:00"
updated_at: "2026-04-29T10:02:47.716+08:00"
reading_time: 27
tags: []
---

## 难度标注

> **难度：⭐⭐⭐ 中级** | 预计阅读时间：15分钟 | 前置知识：Django基础、HTTP协议、JSON

## 概念讲解

### 什么是 REST？

REST（Representational State Transfer）是一种软件架构风格，核心思想是用 **URL 表示资源**，用 **HTTP 方法表示操作**：

| HTTP方法 | 用途 | 幂等性 | 安全性 |
|---------|------|--------|--------|
| GET | 获取资源 | ✅ | ✅ |
| POST | 创建资源 | ❌ | ❌ |
| PUT | 全量更新 | ✅ | ❌ |
| PATCH | 部分更新 | ✅ | ❌ |
| DELETE | 删除资源 | ✅ | ❌ |

### 为什么选 DRF？

Django REST Framework（DRF）是 Django 生态中最成熟的 API 框架：

- **序列化器**：自动处理 Model ↔ JSON 转换
- **视图集**：一套 CRUD 逻辑，几行代码搞定
- **认证/权限**：内置 Token、JWT、OAuth 等方案
- **Browsable API**：自带可调试的 Web 界面
- **分页/过滤/排序**：开箱即用

## 脑图

```
DRF 核心架构
├── Serializer（序列化器）
│   ├── ModelSerializer
│   ├── SerializerMethodField
│   └── 嵌套序列化
├── View（视图层）
│   ├── APIView
│   ├── GenericAPIView + Mixins
│   ├── ViewSet
│   └── ModelViewSet（推荐）
├── Router（路由）
│   ├── DefaultRouter
│   └── SimpleRouter
├── Authentication（认证）
│   ├── SessionAuthentication
│   ├── TokenAuthentication
│   └── JWTAuthentication
└── Permission（权限）
    ├── IsAuthenticated
    ├── IsAdminUser
    └── 自定义权限
```

## 完整代码：博客 API 系统

### v1 基础版本 - 手动序列化

```python
# models.py
from django.db import models

class Article(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(default=False)

    def __str__(self):
        return self.title
```

```python
# views.py - v1: raw APIView, manual serialization
from django.http import JsonResponse
from django.views import View
import json
from .models import Article

class ArticleListView(View):
    """Manual list/create without DRF."""

    def get(self, request):
        articles = Article.objects.all()
        data = [
            {
                "id": a.id,
                "title": a.title,
                "author": a.author.username,
                "created_at": a.created_at.isoformat(),
            }
            for a in articles
        ]
        return JsonResponse(data, safe=False)

    def post(self, request):
        body = json.loads(request.body)
        article = Article.objects.create(
            title=body["title"],
            content=body.get("content", ""),
            author=request.user,
        )
        return JsonResponse({"id": article.id}, status=201)
```

**v1 的问题**：手动序列化太累、没有验证、没有分页、错误处理不全。

### v2 进阶版本 - 使用 Serializer + Generic View

```python
# serializers.py
from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Article
        fields = ["id", "title", "content", "author", "author_name",
                  "created_at", "updated_at", "is_published"]
        read_only_fields = ["author", "created_at", "updated_at"]

    def validate_title(self, value):
        """Title must be at least 2 characters."""
        if len(value) < 2:
            raise serializers.ValidationError("Title too short")
        return value
```

```python
# views.py - v2: generic views with serializer
from rest_framework import generics, permissions
from .models import Article
from .serializers import ArticleSerializer

class ArticleListCreateView(generics.ListCreateAPIView):
    queryset = Article.objects.select_related("author").all()
    serializer_class = ArticleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class ArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Article.objects.select_related("author").all()
    serializer_class = ArticleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

```python
# urls.py - v2
from django.urls import path
from .views import ArticleListCreateView, ArticleDetailView

urlpatterns = [
    path("api/articles/", ArticleListCreateView.as_view()),
    path("api/articles/<int:pk>/", ArticleDetailView.as_view()),
]
```

### v3 生产版本 - ViewSet + Router + JWT + 分页 + 过滤

```python
# serializers.py - v3: nested + custom fields
from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    word_count = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = "__all__"
        read_only_fields = ["author", "created_at", "updated_at"]

    def get_word_count(self, obj):
        return len(obj.content.split()) if obj.content else 0
```

```python
# views.py - v3: ViewSet + filter + permission
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Article
from .serializers import ArticleSerializer
from .permissions import IsAuthorOrReadOnly

class ArticleViewSet(viewsets.ModelViewSet):
    """Full CRUD + custom actions for articles."""

    queryset = Article.objects.select_related("author").all()
    serializer_class = ArticleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_published", "author"]
    search_fields = ["title", "content"]
    ordering_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=["get"])
    def published(self, request):
        """Custom action: list only published articles."""
        articles = self.queryset.filter(is_published=True)
        serializer = self.get_serializer(articles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Custom action: publish an article."""
        article = self.get_object()
        article.is_published = True
        article.save()
        return Response({"status": "published"})
```

```python
# permissions.py
from rest_framework import permissions

class IsAuthorOrReadOnly(permissions.BasePermission):
    """Only allow author to edit/delete their own articles."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user
```

```python
# urls.py - v3: router auto-generates URLs
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ArticleViewSet

router = DefaultRouter()
router.register(r"articles", ArticleViewSet)

urlpatterns = [
    path("api/", include(router.urls)),
]
```

```python
# settings.py - key DRF settings
INSTALLED_APPS += [
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}
```

## 执行预览

```bash
# Start server
python manage.py runserver

# Get JWT token
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
# -> {"access":"eyJ...","refresh":"eyJ..."}

# List articles
curl http://localhost:8000/api/articles/
# -> {"count":42,"next":"...?page=2","results":[...]}

# Create article
curl -X POST http://localhost:8000/api/articles/ \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"title":"DRF Guide","content":"Hello World"}'
# -> {"id":1,"title":"DRF Guide","author_name":"admin",...}

# Custom action: publish
curl -X POST http://localhost:8000/api/articles/1/publish/ \
  -H "Authorization: Bearer eyJ..."
# -> {"status":"published"}
```

## 注意事项

| 项目 | 说明 | 建议 |
|-----|------|------|
| N+1 查询 | 嵌套序列化导致多次查询 | 用 `select_related`/`prefetch_related` |
| 分页 | 数据量大时必须分页 | 设置 `DEFAULT_PAGINATION_CLASS` |
| 认证 | 生产环境别用 Session | 推荐 JWT（SimpleJWT） |
| CORS | 前端跨域请求被拒 | 安装 `django-cors-headers` |
| 版本控制 | API 迭代需要版本管理 | URL前缀 `/api/v1/` 或 Header 版本 |
| 序列化嵌套 | 深层嵌套导致性能差 | 控制嵌套层数，用 `depth = 1` 限制 |

## 避坑指南

❌ **在 Serializer 的 `to_representation` 里做数据库查询**
✅ 在 ViewSet 的 `get_queryset` 里用 `prefetch_related` 预加载

❌ **把所有逻辑写在 View 里**
✅ 业务逻辑放 Service 层，View 只做参数校验和调用

❌ **用 `fields = "__all__"` 忽略敏感字段**
✅ 显式列出 fields，敏感字段加 `read_only_fields`

❌ **忘记配置权限类**
✅ 全局默认 `DEFAULT_PERMISSION_CLASSES` + 视图级别覆盖

❌ **GET 请求需要认证才能查看公开内容**
✅ 用 `IsAuthenticatedOrReadOnly` 区分读写权限

## 练习题

🟢 **基础题：创建一个只读 API**
创建一个 Book 模型的只读 API（GET list + GET detail），使用 `ReadOnlyModelViewSet`。

🟡 **进阶题：自定义 Action**
为 Article 添加一个 `toggle_publish` Action，每次调用切换 `is_published` 状态，返回当前状态。

🔴 **挑战题：嵌套资源 + 权限**
实现 `/api/articles/<id>/comments/` 嵌套路由，评论只能由文章作者和评论作者删除。

## 知识点总结

```
Django REST Framework
├── 序列化
│   ├── ModelSerializer - 自动映射 Model 字段
│   ├── SerializerMethodField - 计算字段
│   └── validate_* - 字段级验证
├── 视图层
│   ├── APIView -> 最底层
│   ├── GenericAPIView -> 加入 queryset/serializer
│   └── ModelViewSet -> 完整 CRUD（推荐）
├── 路由
│   └── Router.register() - 自动生成 URL
├── 认证
│   ├── Token - 简单场景
│   └── JWT - 生产推荐
└── 进阶
    ├── 自定义 Action - @action 装饰器
    ├── 过滤/搜索/排序 - filter_backends
    └── 权限 - has_permission + has_object_permission
```

## 举一反三

| 场景 | 方案 | 关键点 |
|------|------|--------|
| 只读公开 API | `ReadOnlyModelViewSet` + `AllowAny` | 禁用写方法 |
| 用户注册/登录 | `dj-rest-auth` 或手动 ViewSet | 密码哈希、Token返回 |
| 文件上传 API | `FileField` + multipart parser | 限制文件大小和类型 |
| API 限流 | `rest_framework.throttling` | 按 IP/User 限速 |
| API 文档自动生成 | `drf-spectacular` (OpenAPI 3) | 自动生成 Swagger UI |
| 多角色权限 | 自定义 Permission 类 | 粒度控制到字段级别 |

## 参考资料

- [DRF 官方文档](https://www.django-rest-framework.org/)
- [SimpleJWT 文档](https://django-rest-framework-simplejwt.readthedocs.io/)
- [drf-spectacular - OpenAPI 3 自动文档](https://drf-spectacular.readthedocs.io/)
- [Django Filter 文档](https://django-filter.readthedocs.io/)

## 代码演进总结

| 版本 | 特点 | 适用场景 |
|------|------|----------|
| v1 | 手动序列化 + APIView | 学习理解原理 |
| v2 | Serializer + GenericView | 小型项目、简单 CRUD |
| v3 | ViewSet + Router + JWT + 过滤 | 生产级项目 |
